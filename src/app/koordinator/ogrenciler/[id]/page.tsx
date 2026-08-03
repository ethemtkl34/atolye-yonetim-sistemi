import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, baglantiStili, butonStili, geriBaglantiStili } from "@/components/ui";
import {
  pdfGecmisi,
  raporKapsamSecenekleri,
  raporOzetleri,
} from "@/lib/rapor-verisi";
import { KayitIptalOzeti } from "@/components/kayit-iptal-ozeti";
import { RaporBolumu } from "./rapor-bolumu";
import { StajyerAtamalari, type AtamaKaydi } from "./stajyer-atamalari";
import { GorusmelerBolumu, type GorusmeSatiri } from "./gorusmeler-bolumu";
import {
  AKTIF_DONEM_DURUMLARI,
  AKTIF_KULUP_DURUMLARI,
  DONEM_DURUMLARI,
  KULUP_DURUMLARI,
} from "@/lib/durumlar";
import type { CancelReason, ClubStatus, Day, TermStatus } from "@/generated/prisma/enums";
import { bugun, grupZamani, tarihBicimle, tarihMetni } from "@/lib/tarih";

export async function generateMetadata(
  props: PageProps<"/koordinator/ogrenciler/[id]">,
): Promise<Metadata> {
  // Sekme başlığı da şubeye kapalı: başka şubenin öğrenci id'si yapıştırılınca
  // sayfa 404 verirken başlıkta çocuğun adının görünmesi sızıntıdır.
  // `yonetimZorunlu` istek başına önbellekli, ek sorgu maliyeti yok.
  const kullanici = await yonetimZorunlu();
  const { id } = await props.params;
  const ogrenci = await db.student.findFirst({
    where: { id, branchId: kullanici.aktifSubeId },
    select: { firstName: true, lastName: true },
  });
  return {
    title: ogrenci ? `${ogrenci.firstName} ${ogrenci.lastName}` : "Öğrenci",
  };
}

/**
 * §6.3 — Öğrenci profili.
 *
 * Sayfa iki kata ayrıldı: üstte HER ZAMAN görünen operasyonel kat (özet
 * kartı, aktif kayıtlar, görüşmeler, raporlar), altta KAPALI başlayan arşiv
 * katı (genel bilgiler, veliler, sağlık, geçmiş kayıtlar, stajyer atamaları).
 * Önceki düzende sekiz bölüm alt alta ~5 ekran boyu tutuyordu ve koordinatör
 * her seferinde aynı uzun sayfayı kaydırıyordu; oysa günlük iş ilk kattaki
 * dört bölümde geçiyor.
 */
export default async function OgrenciProfilSayfasi(
  props: PageProps<"/koordinator/ogrenciler/[id]">,
) {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;
  const { id } = await props.params;

  // `?rapor=<id>` veya `?rapor=yeni` ile rapor penceresi doğrudan açılabilir;
  // dashboard'dan ve eski rapor adreslerinden gelen bağlantılar bunu kullanır.
  const parametreler = await props.searchParams;
  const acilisRaporu =
    typeof parametreler.rapor === "string" ? parametreler.rapor : undefined;

  const ogrenci = await db.student.findFirst({
    where: { id, branchId: subeId },
    include: {
      guardians: true,
      healthInfo: true,
      enrollments: {
        orderBy: { createdAt: "desc" },
        include: {
          intern: { select: { name: true, active: true } },
          // İptal özetindeki atölye sayıları buradan türetiliyor; iptal anında
          // ayrıca saklanmıyor (bkz. `atolyeOzeti`).
          _count: { select: { scores: { where: { attended: true } } } },
          group: {
            include: {
              _count: { select: { sessions: true } },
              term: {
                select: {
                  name: true,
                  status: true,
                  // Dönem kadrosu: atama seçenekleri buna göre süzülür.
                  // Dönem iki şubede ortak olduğu için kadro da iki şubenin
                  // stajyerlerini birlikte tutuyor; kendi şubemizinkiler
                  // ayıklanmazsa diğer şubenin stajyeri atanabilir hâle gelir.
                  interns: {
                    where: { user: { branchId: subeId } },
                    select: { userId: true },
                  },
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

  const [raporlar, pdfler, kapsamKayitlari, aktifStajyerler, gorusmeKayitlari] =
    await Promise.all([
      raporOzetleri({ subeId, ogrenciId: id }),
      pdfGecmisi({ subeId, ogrenciId: id }),
      // Yeni rapor penceresinin kapsam seçenekleri; küçük bir liste olduğu için
      // pencere açılmasa da peşinen okunuyor.
      raporKapsamSecenekleri(id, subeId),
      db.user.findMany({
        where: { role: "STAJYER", active: true, branchId: subeId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      // GİZLİLİK: görüşmeler yalnızca bu koordinatör sayfasında okunur;
      // stajyer sorgularının hiçbirine girmez (sağlık bilgisi kuralı).
      db.counselingSession.findMany({
        where: { studentId: id, student: { branchId: subeId } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { createdBy: { select: { name: true } } },
      }),
    ]);

  const gorusmeler: GorusmeSatiri[] = gorusmeKayitlari.map((gorusme) => ({
    id: gorusme.id,
    tarih: gorusme.date,
    gorusmeciAdi: gorusme.counselorName,
    tur: gorusme.counselorType,
    not: gorusme.notes,
    ekleyen: gorusme.createdBy?.name ?? null,
    eklenmeTarihi: gorusme.createdAt,
  }));

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
          className={geriBaglantiStili}
        >
          ← Öğrenciler
        </Link>
        <div className="mt-2">
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

      {/* --- Özet kartı: tek bakışta öğrenci. Ayrıntılar aşağıdaki kapalı
          bölümlerde; buradaki her hücre "aramadan görülmesi gereken" bilgi.
          Veli telefonları tıklanabilir — koordinatör en çok aileyi arıyor. */}
      <Kart className="p-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-5">
          <OzetHucresi
            etiket="Okul · Sınıf"
            deger={
              ogrenci.school || ogrenci.grade
                ? [ogrenci.school, ogrenci.grade].filter(Boolean).join(" · ")
                : null
            }
          />
          <VeliHucresi etiket="Anne" veli={anne} />
          <VeliHucresi etiket="Baba" veli={baba} />
          <OzetHucresi
            etiket="Aktif kayıt"
            deger={String(aktifKayitlar.length)}
          />
          <OzetHucresi etiket="Görüşme" deger={String(gorusmeler.length)} />
        </dl>

        {saglik?.internSafetyNote ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">
              Güvenlik uyarısı (stajyerler de görür)
            </p>
            <p className="mt-1 text-sm text-amber-900">
              {saglik.internSafetyNote}
            </p>
          </div>
        ) : null}
      </Kart>

      {/* --- Aktif kayıtlar --- */}
      <KayitBolumu
        baslik="Aktif kayıtlar"
        kayitlar={aktifKayitlar}
        bosAciklama="Öğrencinin kayıt alan veya devam eden bir programda aktif kaydı yok."
        aksiyon={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* Katılım ve puanlama geçmişi kendi sayfalarında; eski "Geçmiş"
                kart bölümü kaldırıldı, erişim bu iki bağlantıdan sürüyor. */}
            <Link
              href={`/koordinator/ogrenciler/${ogrenci.id}/gecmis`}
              className={baglantiStili}
            >
              Katılım geçmişi
            </Link>
            <Link
              href={`/koordinator/ogrenciler/${ogrenci.id}/puanlamalar`}
              className={baglantiStili}
            >
              Puanlamalar
            </Link>
            <Link
              href={`/koordinator/kayitlar/yeni?studentId=${ogrenci.id}`}
              className={baglantiStili}
            >
              + Yeni kayıt
            </Link>
          </div>
        }
      />

      {/* --- Görüşmeler (psikolog/koordinatör) — stajyerden gizli --- */}
      <GorusmelerBolumu
        ogrenciId={ogrenci.id}
        gorusmeler={gorusmeler}
        bugunMetni={tarihMetni(bugun())}
      />

      {/* --- Raporlar ve PDF geçmişi.

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

      {/* --- Arşiv katı: kapalı başlayan bölümler. Sık bakılmayan ayrıntılar
          buraya indi; sayfa artık günlük işte tek ekran boyunda. --- */}

      <KatlanirBolum baslik="Genel bilgiler">
        <dl className="grid gap-3 sm:grid-cols-3">
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
      </KatlanirBolum>

      <KatlanirBolum baslik="Anne ve baba bilgileri">
        <dl className="grid gap-3 sm:grid-cols-2">
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
      </KatlanirBolum>

      <KatlanirBolum
        baslik="Sağlık ve özel durum"
        etiket={
          <span className="text-xs font-normal text-zinc-500">
            Stajyerlere kapalı
          </span>
        }
      >
        {saglikSatirlari.length === 0 ? (
          <p className="text-sm text-zinc-500">Kayıtlı sağlık bilgisi yok.</p>
        ) : (
          <dl className="space-y-3">
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
      </KatlanirBolum>

      <KatlanirBolum
        baslik="Geçmiş kayıtlar"
        etiket={
          gecmisKayitlar.length > 0 ? (
            <span className="text-xs font-normal text-zinc-500">
              {gecmisKayitlar.length} kayıt
            </span>
          ) : undefined
        }
      >
        <KayitListesi
          kayitlar={gecmisKayitlar}
          bosAciklama="Tamamlanmış veya iptal edilmiş kayıt yok."
        />
      </KatlanirBolum>

      <KatlanirBolum baslik="Stajyer atamaları">
        <StajyerAtamalari kayitlar={atamaKayitlari} />
      </KatlanirBolum>
    </div>
  );
}

type ProfilKaydi = {
  id: string;
  status: "AKTIF" | "IPTAL";
  createdAt: Date;
  intern: { name: string; active: boolean } | null;
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  lastAttendedWeek: number | null;
  lastAttendedDate: Date | null;
  _count: { scores: number };
  group: {
    name: string;
    days: Day[];
    timeSlot: "OGLEDEN_ONCE" | "OGLEDEN_SONRA";
    term: { name: string; status: TermStatus } | null;
    club: { name: string; status: ClubStatus; date: Date } | null;
    _count: { sessions: number };
  };
};

/**
 * Kapalı başlayan bölüm çerçevesi.
 *
 * Native `<details>`: JS gerektirmediği için sunucu bileşeninde çalışıyor ve
 * içindeki istemci bileşenleri (stajyer atamaları gibi) etkilenmiyor. Özet
 * satırı telefonda 44px dokunma hedefi; masaüstünde sıkı ölçüye dönüyor.
 */
function KatlanirBolum({
  baslik,
  etiket,
  children,
}: {
  baslik: string;
  etiket?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Kart className="p-4">
      <details className="group">
        <summary className="flex min-h-[2.75rem] cursor-pointer list-none items-center justify-between gap-2 sm:min-h-0">
          <span className="flex flex-wrap items-center gap-2 text-base font-semibold text-zinc-900">
            {baslik}
            {etiket}
          </span>
          <span className="shrink-0 text-xs text-zinc-500 group-open:hidden">
            Göster
          </span>
          <span className="hidden shrink-0 text-xs text-zinc-500 group-open:inline">
            Gizle
          </span>
        </summary>
        <div className="mt-3">{children}</div>
      </details>
    </Kart>
  );
}

function OzetHucresi({
  etiket,
  deger,
}: {
  etiket: string;
  deger: string | null;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{etiket}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-900">
        {deger ?? <span className="font-normal text-zinc-400">—</span>}
      </dd>
    </div>
  );
}

/** Veli adı + tıklanabilir telefon. Koordinatörün en sık işi aileyi aramak. */
function VeliHucresi({
  etiket,
  veli,
}: {
  etiket: string;
  veli: { fullName: string; phone: string | null } | undefined;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{etiket}</dt>
      <dd className="mt-0.5 text-sm">
        {veli ? (
          <>
            <span className="font-medium text-zinc-900">{veli.fullName}</span>
            {veli.phone ? (
              <a href={`tel:${veli.phone}`} className={`block ${baglantiStili}`}>
                {veli.phone}
              </a>
            ) : null}
          </>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </dd>
    </div>
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
      <KayitListesi kayitlar={kayitlar} bosAciklama={bosAciklama} />
    </div>
  );
}

/** Kayıt kartları — başlıksız; katlanır bölümün içinde de kullanılıyor. */
function KayitListesi({
  kayitlar,
  bosAciklama,
}: {
  kayitlar: ProfilKaydi[];
  bosAciklama: string;
}) {
  if (kayitlar.length === 0) {
    return <BosDurum baslik={bosAciklama} />;
  }

  return (
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
              {grupZamani(kayit.group.days, kayit.group.timeSlot)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Kayıt tarihi {tarihBicimle(kayit.createdAt)}
              {kayit.group.club
                ? ` · Kulüp tarihi ${tarihBicimle(kayit.group.club.date)}`
                : ""}
              {" · "}
              Sorumlu: {kayit.intern?.name ?? "Atanmamış"}
            </p>

            {kayit.status === "IPTAL" ? (
              <KayitIptalOzeti
                kayit={{
                  cancelReason: kayit.cancelReason,
                  cancelNote: kayit.cancelNote,
                  lastAttendedWeek: kayit.lastAttendedWeek,
                  lastAttendedDate: kayit.lastAttendedDate,
                  tamamlananAtolye: kayit._count.scores,
                  toplamAtolye: kayit.group._count.sessions,
                }}
              />
            ) : null}
          </Kart>
        );
      })}
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
