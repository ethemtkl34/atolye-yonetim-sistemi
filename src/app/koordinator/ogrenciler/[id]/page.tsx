import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, butonStili } from "@/components/ui";
import { kayitIlerlemeleri } from "@/lib/puanlama-verisi";
import {
  pdfGecmisi,
  raporKapsamSecenekleri,
  raporOzetleri,
} from "@/lib/rapor-verisi";
import { RaporBolumu } from "./rapor-bolumu";
import { StajyerAtamalari, type AtamaKaydi } from "./stajyer-atamalari";
import {
  AKTIF_DONEM_DURUMLARI,
  AKTIF_KULUP_DURUMLARI,
  DONEM_DURUMLARI,
  KULUP_DURUMLARI,
} from "@/lib/durumlar";
import type { ClubStatus, TermStatus } from "@/generated/prisma/enums";
import { grupZamani, tarihBicimle } from "@/lib/tarih";

export async function generateMetadata(
  props: PageProps<"/koordinator/ogrenciler/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const ogrenci = await db.student.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  return {
    title: ogrenci ? `${ogrenci.firstName} ${ogrenci.lastName}` : "Öğrenci",
  };
}

/**
 * §6.3 — Öğrenci profili.
 *
 * Genel bilgiler, veliler, sağlık, kayıtlar ve kayıt bazlı stajyer atamaları
 * dolu. Katılım, puanlama ve rapor bölümleri sonraki paketlerde eklenecek.
 */
export default async function OgrenciProfilSayfasi(
  props: PageProps<"/koordinator/ogrenciler/[id]">,
) {
  await yonetimZorunlu();
  const { id } = await props.params;

  // `?rapor=<id>` veya `?rapor=yeni` ile rapor penceresi doğrudan açılabilir;
  // dashboard'dan ve eski rapor adreslerinden gelen bağlantılar bunu kullanır.
  const parametreler = await props.searchParams;
  const acilisRaporu =
    typeof parametreler.rapor === "string" ? parametreler.rapor : undefined;

  const ogrenci = await db.student.findUnique({
    where: { id },
    include: {
      guardians: true,
      healthInfo: true,
      enrollments: {
        orderBy: { createdAt: "desc" },
        include: {
          intern: { select: { name: true, active: true } },
          group: {
            include: {
              term: {
                select: {
                  name: true,
                  status: true,
                  // Dönem kadrosu: atama seçenekleri buna göre süzülür.
                  interns: { select: { userId: true } },
                },
              },
              club: { select: { name: true, status: true, date: true } },
            },
          },
        },
      },
    },
  });

  if (!ogrenci) notFound();

  // §6.3.7–8 — Katılım ve puanlama geçmişi profilde liste olarak değil,
  // kendi sayfalarına götüren özet kartları olarak durur; ekran kalabalığı
  // bu iki uzun listeden geliyordu. Burada yalnızca özet sayılar okunur.
  const [
    puanlamaIlerlemeleri,
    raporlar,
    pdfler,
    kapsamKayitlari,
    aktifStajyerler,
    toplamFormSayisi,
    katildigiFormSayisi,
  ] = await Promise.all([
    kayitIlerlemeleri({ studentId: id }),
    raporOzetleri({ ogrenciId: id }),
    pdfGecmisi({ ogrenciId: id }),
    // Yeni rapor penceresinin kapsam seçenekleri; küçük bir liste olduğu için
    // pencere açılmasa da peşinen okunuyor.
    raporKapsamSecenekleri(id),
    db.user.findMany({
      where: { role: "STAJYER", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.score.count({ where: { enrollment: { studentId: id } } }),
    db.score.count({
      where: { enrollment: { studentId: id }, attended: true },
    }),
  ]);

  const bekleyenFormSayisi = puanlamaIlerlemeleri.reduce(
    (toplam, ilerleme) => toplam + ilerleme.ozet.bekleyen,
    0,
  );

  /**
   * §8 — Atama satırları. Dönem kadrosu tanımlıysa seçenekler kadroyla
   * sınırlanır; sunucu eylemi de aynı kuralı uyguladığı için burada
   * gösterilmeyen bir stajyer zaten atanamaz.
   */
  const atamaKayitlari: AtamaKaydi[] = ogrenci.enrollments.map((kayit) => {
    const kadro = kayit.group.term?.interns ?? [];
    const kadroluMu = kadro.length > 0;
    const secenekler = kadroluMu
      ? aktifStajyerler.filter((stajyer) =>
          kadro.some((satir) => satir.userId === stajyer.id),
        )
      : aktifStajyerler;

    return {
      kayitId: kayit.id,
      programAdi:
        kayit.group.term?.name ?? kayit.group.club?.name ?? "Program",
      grupAdi: kayit.group.name,
      aktif: kayit.status === "AKTIF",
      stajyerId: kayit.internId,
      stajyerAdi: kayit.intern?.name ?? null,
      stajyerPasif: Boolean(kayit.intern && !kayit.intern.active),
      secenekler: secenekler.map((stajyer) => ({
        id: stajyer.id,
        ad: stajyer.name,
      })),
      kadroUyarisi:
        kadroluMu && secenekler.length === 0
          ? `"${kayit.group.term?.name}" döneminin kadrosunda aktif stajyer yok. Stajyerin sayfasından bu döneme ekleyin.`
          : null,
    };
  });

  const anne = ogrenci.guardians.find((v) => v.type === "ANNE");
  const baba = ogrenci.guardians.find((v) => v.type === "BABA");
  const saglik = ogrenci.healthInfo;

  const saglikSatirlari = [
    { etiket: "Alerji", deger: saglik?.allergies },
    { etiket: "Düzenli kullanılan ilaç", deger: saglik?.medications },
    { etiket: "Özel eğitim / destek", deger: saglik?.specialEducation },
    { etiket: "Sağlık durumu", deger: saglik?.healthNotes },
    { etiket: "Acil durum", deger: saglik?.emergencyInfo },
  ].filter((satir) => satir.deger);

  // Aktiflik ölçütü dashboard ve liste ekranlarıyla aynı yerden okunur;
  // burada ikinci bir tanım yazılsaydı zamanla ayrışırdı (P11).
  const aktifKayitlar = ogrenci.enrollments.filter(
    (kayit) =>
      kayit.status === "AKTIF" &&
      (kayit.group.term
        ? AKTIF_DONEM_DURUMLARI.includes(kayit.group.term.status)
        : kayit.group.club
          ? AKTIF_KULUP_DURUMLARI.includes(kayit.group.club.status)
          : false),
  );
  const gecmisKayitlar = ogrenci.enrollments.filter(
    (kayit) => !aktifKayitlar.includes(kayit),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/ogrenciler"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Öğrenciler
        </Link>
        <div className="mt-2">
          {/* Başlıkta tek eylem duruyor; "Yeni kayıt" buradan kaldırılıp
              ait olduğu yere, Aktif kayıtlar bölümünün köşesine taşındı —
              sayfa açılır açılmaz kayıt butonuyla karşılaşılması ekranı
              kalabalıklaştırıyordu. */}
          <SayfaBasligi
            baslik={`${ogrenci.firstName} ${ogrenci.lastName}`}
            aksiyon={
              <Link
                href={`/koordinator/ogrenciler/${ogrenci.id}/duzenle`}
                className={butonStili("ikincil")}
              >
                Bilgileri düzenle
              </Link>
            }
          />
        </div>
      </div>

      {/* 1. Genel bilgiler */}
      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Genel bilgiler
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <Bilgi
            etiket="Doğum tarihi"
            deger={ogrenci.birthDate ? tarihBicimle(ogrenci.birthDate) : null}
          />
          <Bilgi etiket="Okul" deger={ogrenci.school} />
          <Bilgi etiket="Sınıf" deger={ogrenci.grade} />
        </dl>
        {ogrenci.notes ? (
          <div className="mt-3">
            <p className="text-sm text-zinc-500">Notlar</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-800">
              {ogrenci.notes}
            </p>
          </div>
        ) : null}
      </Kart>

      {/* 2. Anne ve baba */}
      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Anne ve baba bilgileri
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Bilgi
            etiket="Anne"
            deger={
              anne
                ? `${anne.fullName}${anne.phone ? ` · ${anne.phone}` : ""}`
                : null
            }
          />
          <Bilgi
            etiket="Baba"
            deger={
              baba
                ? `${baba.fullName}${baba.phone ? ` · ${baba.phone}` : ""}`
                : null
            }
          />
        </dl>
      </Kart>

      {/* 3. Sağlık */}
      <Kart className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">
            Sağlık ve özel durum
          </h2>
          <span className="text-xs text-zinc-500">
            Stajyerlere kapalı
          </span>
        </div>

        {saglikSatirlari.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Kayıtlı sağlık bilgisi yok.
          </p>
        ) : (
          <dl className="mt-3 space-y-3">
            {saglikSatirlari.map((satir) => (
              <div key={satir.etiket}>
                <dt className="text-sm text-zinc-500">{satir.etiket}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-800">
                  {satir.deger}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {saglik?.internSafetyNote ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">
              Stajyerin gördüğü uyarı
            </p>
            <p className="mt-1 text-sm text-amber-900">
              {saglik.internSafetyNote}
            </p>
          </div>
        ) : null}
      </Kart>

      {/* 4. Aktif kayıtlar */}
      <KayitBolumu
        baslik="Aktif kayıtlar"
        kayitlar={aktifKayitlar}
        bosAciklama="Öğrencinin kayıt alan veya devam eden bir programda aktif kaydı yok."
        aksiyon={
          <Link
            href={`/koordinator/kayitlar/yeni?studentId=${ogrenci.id}`}
            className="text-sm text-marka-700 hover:underline"
          >
            + Yeni kayıt
          </Link>
        }
      />

      {/* 5. Geçmiş kayıtlar */}
      <KayitBolumu
        baslik="Geçmiş kayıtlar"
        kayitlar={gecmisKayitlar}
        bosAciklama="Tamamlanmış veya iptal edilmiş kayıt yok."
      />

      {/* 6. Stajyer atamaları — atama doğrudan burada yapılır. */}
      <StajyerAtamalari kayitlar={atamaKayitlari} />

      {/* 7–8. Katılım ve puanlama geçmişi — listeler kendi sayfalarında,
          profilde yalnızca özet sayıları taşıyan bağlantı kartları durur. */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Geçmiş</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <GecmisKarti
            baslik="Atölye katılım geçmişi"
            ozet={
              toplamFormSayisi === 0
                ? "Henüz doldurulmuş form yok"
                : `${toplamFormSayisi} form · ${katildigiFormSayisi} katıldı · ${toplamFormSayisi - katildigiFormSayisi} katılmadı`
            }
            href={`/koordinator/ogrenciler/${ogrenci.id}/gecmis`}
          />
          <GecmisKarti
            baslik="Puanlama geçmişi"
            ozet={
              puanlamaIlerlemeleri.length === 0
                ? "Henüz kayıt yok"
                : `${puanlamaIlerlemeleri.length} kayıt · ${
                    bekleyenFormSayisi > 0
                      ? `${bekleyenFormSayisi} form bekliyor`
                      : "bekleyen form yok"
                  }`
            }
            vurgu={bekleyenFormSayisi > 0}
            href={`/koordinator/ogrenciler/${ogrenci.id}/puanlamalar`}
          />
        </div>
      </div>

      {/* 9–11. Raporlar ve PDF geçmişi.

          Rapor öğrenciye ait bir belge olduğu için listesi de içeriği de
          burada duruyor: karta tıklayınca sayfadan çıkmadan bir pencere
          açılıyor, düzenleme ve PDF üretimi de o pencerede yapılıyor. */}
      <RaporBolumu
        ogrenciId={ogrenci.id}
        ogrenciAdi={`${ogrenci.firstName} ${ogrenci.lastName}`}
        raporlar={raporlar}
        kapsamKayitlari={kapsamKayitlari}
        pdfler={pdfler}
        acilisParametresi={acilisRaporu}
      />
    </div>
  );
}

type ProfilKaydi = {
  id: string;
  status: "AKTIF" | "IPTAL";
  createdAt: Date;
  intern: { name: string; active: boolean } | null;
  group: {
    name: string;
    day: "CUMARTESI" | "PAZAR";
    timeSlot: "OGLEDEN_ONCE" | "OGLEDEN_SONRA";
    term: { name: string; status: TermStatus } | null;
    club: { name: string; status: ClubStatus; date: Date } | null;
  };
};

/**
 * Uzun bir listeyi kendi sayfasına taşıyan özet kartı. Kartın tamamı
 * tıklanabilir; sağdaki ok gidilecek bir sayfa olduğunu belli eder.
 */
function GecmisKarti({
  baslik,
  ozet,
  href,
  vurgu = false,
}: {
  baslik: string;
  ozet: string;
  href: string;
  vurgu?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-lg border border-yuzey-200 bg-white p-4 shadow-[0_1px_2px_rgba(91,16,53,0.04)] transition-colors hover:border-marka-200 hover:bg-marka-50"
    >
      <span>
        <span className="block text-sm font-medium text-zinc-900">
          {baslik}
        </span>
        <span
          className={`mt-0.5 block text-xs ${vurgu ? "font-medium text-vurgu-700" : "text-zinc-500"}`}
        >
          {ozet}
        </span>
      </span>
      <span
        aria-hidden
        className="text-lg text-zinc-300 transition-colors group-hover:text-marka-600"
      >
        →
      </span>
    </Link>
  );
}

function KayitBolumu({
  baslik,
  kayitlar,
  bosAciklama,
  aksiyon,
}: {
  baslik: string;
  kayitlar: ProfilKaydi[];
  bosAciklama: string;
  aksiyon?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">{baslik}</h2>
        {aksiyon}
      </div>
      {kayitlar.length === 0 ? (
        <BosDurum baslik={bosAciklama} />
      ) : (
        <div className="space-y-2">
          {kayitlar.map((kayit) => {
            // İki ayrı durum var ve karıştırılmamalı: kaydın kendi durumu
            // (aktif / iptal) ve programın durumu (tamamlandı, arşivlendi...).
            // Kayıt aktif olduğu hâlde program bittiyse bunu yazmak gerekiyor;
            // yoksa "Geçmiş kayıtlar" başlığı altındaki "Aktif" rozeti
            // çelişkili görünüyor.
            const programDurumu = kayit.group.term
              ? DONEM_DURUMLARI[kayit.group.term.status]
              : kayit.group.club
                ? KULUP_DURUMLARI[kayit.group.club.status]
                : null;

            return (
            <Kart key={kayit.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900">
                  {kayit.group.term?.name ??
                    kayit.group.club?.name ??
                    "Program bulunamadı"}
                </span>
                <Rozet>{kayit.group.term ? "Dönem" : "Kulüp"}</Rozet>
                <Rozet tur={kayit.status === "AKTIF" ? "olumlu" : "pasif"}>
                  Kayıt: {kayit.status === "AKTIF" ? "Aktif" : "İptal"}
                </Rozet>
                {programDurumu ? (
                  <Rozet tur={programDurumu.rozet}>
                    Program: {programDurumu.etiket}
                  </Rozet>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-zinc-700">
                {kayit.group.name} ·{" "}
                {grupZamani(kayit.group.day, kayit.group.timeSlot)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Kayıt tarihi {tarihBicimle(kayit.createdAt)}
                {kayit.group.club
                  ? ` · Kulüp tarihi ${tarihBicimle(kayit.group.club.date)}`
                  : ""}
                {" · "}
                Sorumlu: {kayit.intern?.name ?? "Atanmamış"}
              </p>
            </Kart>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Bilgi({
  etiket,
  deger,
}: {
  etiket: string;
  deger: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{etiket}</dt>
      <dd className="mt-0.5 text-sm text-zinc-800">
        {deger ?? <span className="text-zinc-400">—</span>}
      </dd>
    </div>
  );
}
