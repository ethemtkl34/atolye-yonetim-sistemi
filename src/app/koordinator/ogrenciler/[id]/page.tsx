import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, butonStili } from "@/components/ui";
import { IlerlemeCubugu } from "@/components/puanlama-ekranlari";
import {
  doldurulmusFormlar,
  kayitIlerlemeleri,
} from "@/lib/puanlama-verisi";
import { pdfGecmisi, raporOzetleri } from "@/lib/rapor-verisi";
import {
  AKTIF_DONEM_DURUMLARI,
  AKTIF_KULUP_DURUMLARI,
  DONEM_DURUMLARI,
  KULUP_DURUMLARI,
} from "@/lib/durumlar";
import type { ClubStatus, TermStatus } from "@/generated/prisma/enums";
import { ortalamaBicimle } from "@/lib/scoring";
import { grupZamani, tarihBicimle, tarihGunleBicimle } from "@/lib/tarih";

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
  await koordinatorZorunlu();
  const { id } = await props.params;

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
              term: { select: { name: true, status: true } },
              club: { select: { name: true, status: true, date: true } },
            },
          },
        },
      },
    },
  });

  if (!ogrenci) notFound();

  // §6.3.7–8 — Katılım ve puanlama geçmişi. Filtreli tam geçmiş ekranı (§6.4)
  // P9'da geliyor; profilde en son kayıtlar ve kayıt bazlı ilerleme duruyor.
  const [katilimGecmisi, puanlamaIlerlemeleri, raporlar, pdfler] =
    await Promise.all([
      doldurulmusFormlar({ studentId: id, enFazla: 30 }),
      kayitIlerlemeleri({ studentId: id }),
      raporOzetleri({ ogrenciId: id }),
      pdfGecmisi({ ogrenciId: id }),
    ]);

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
          <SayfaBasligi
            baslik={`${ogrenci.firstName} ${ogrenci.lastName}`}
            aksiyon={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/koordinator/kayitlar/yeni?studentId=${ogrenci.id}`}
                  className={butonStili()}
                >
                  Yeni kayıt
                </Link>
                <Link
                  href={`/koordinator/ogrenciler/${ogrenci.id}/duzenle`}
                  className={butonStili("ikincil")}
                >
                  Bilgileri düzenle
                </Link>
              </div>
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
      />

      {/* 5. Geçmiş kayıtlar */}
      <KayitBolumu
        baslik="Geçmiş kayıtlar"
        kayitlar={gecmisKayitlar}
        bosAciklama="Tamamlanmış veya iptal edilmiş kayıt yok."
      />

      {/* 6. Stajyer atamaları */}
      <Kart className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">
            Stajyer atamaları
          </h2>
          <Link
            href="/koordinator/atamalar"
            className="text-sm text-marka-700 hover:underline"
          >
            Atamaları yönet
          </Link>
        </div>
        {ogrenci.enrollments.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Henüz atama yok.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {ogrenci.enrollments.map((kayit) => (
              <div
                key={kayit.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-yuzey-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {kayit.group.term?.name ??
                      kayit.group.club?.name ??
                      "Program"}{" "}
                    · {kayit.group.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {kayit.status === "AKTIF" ? "Aktif kayıt" : "İptal kayıt"}
                  </p>
                </div>
                <p className="text-sm text-zinc-700">
                  {kayit.intern?.name ?? (
                    <span className="text-vurgu-700">Atanmamış</span>
                  )}
                  {kayit.intern && !kayit.intern.active
                    ? " (pasif hesap)"
                    : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </Kart>

      {/* 7. Atölye katılım geçmişi */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Atölye katılım geçmişi
        </h2>
        {katilimGecmisi.length === 0 ? (
          <BosDurum
            baslik="Henüz doldurulmuş atölye formu yok."
            aciklama="Stajyer bir atölye formunu kaydettiğinde katılım ve puan burada görünür."
          />
        ) : (
          <Kart className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-yuzey-200 bg-yuzey-50 text-left text-xs font-medium text-marka-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Tarih</th>
                  <th className="px-4 py-2 font-medium">Program</th>
                  <th className="px-4 py-2 font-medium">Atölye</th>
                  <th className="px-4 py-2 font-medium">Katılım</th>
                  <th className="px-4 py-2 font-medium">Ortalama</th>
                  <th className="px-4 py-2 font-medium">Stajyer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yuzey-100">
                {katilimGecmisi.map((satir) => (
                  <tr key={`${satir.kayitId}-${satir.oturumId}`}>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-700">
                      <Link
                        href={`/koordinator/puanlamalar/${satir.kayitId}/${satir.tarihAnahtari}`}
                        className="hover:text-marka-700 hover:underline"
                      >
                        {tarihGunleBicimle(satir.tarih)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {satir.program}
                      <span className="text-zinc-400"> · {satir.grupAdi}</span>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {satir.atolyeAdi}
                    </td>
                    <td className="px-4 py-2">
                      <Rozet tur={satir.attended ? "olumlu" : "pasif"}>
                        {satir.attended ? "Katıldı" : "Katılmadı"}
                      </Rozet>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {satir.attended ? ortalamaBicimle(satir.ortalama) : "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {satir.stajyerAdi ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kart>
        )}
        <p className="text-xs text-zinc-500">
          En son güncellenen 30 form gösteriliyor.{" "}
          <Link
            href={`/koordinator/ogrenciler/${ogrenci.id}/gecmis`}
            className="text-marka-700 hover:underline"
          >
            Filtreli tam geçmiş →
          </Link>
        </p>
      </div>

      {/* 8. Puanlama geçmişi */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Puanlama geçmişi
        </h2>
        {puanlamaIlerlemeleri.length === 0 ? (
          <BosDurum baslik="Kayıt oluşturulduğunda puanlama takibi başlar." />
        ) : (
          <div className="space-y-2">
            {puanlamaIlerlemeleri.map((ilerleme) => (
              <Kart key={ilerleme.kayit.id} className="p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_16rem] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/koordinator/puanlamalar/${ilerleme.kayit.id}`}
                        className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                      >
                        {ilerleme.kayit.program} · {ilerleme.kayit.grupAdi}
                      </Link>
                      <Rozet>{ilerleme.kayit.programTuru}</Rozet>
                      {ilerleme.kayit.aktif ? null : (
                        <Rozet tur="pasif">İptal</Rozet>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      Sorumlu stajyer: {ilerleme.kayit.stajyerAdi ?? "Atanmamış"}
                      {ilerleme.sonPuanlama
                        ? ` · Son puanlama ${tarihBicimle(ilerleme.sonPuanlama)}`
                        : " · Henüz puanlama girilmedi"}
                    </p>
                  </div>
                  <IlerlemeCubugu ozet={ilerleme.ozet} />
                </div>
              </Kart>
            ))}
          </div>
        )}
      </div>

      {/* 9–10. Atölye bazlı ve genel raporlar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Raporlar</h2>
          <Link
            href={`/koordinator/raporlar/yeni?studentId=${ogrenci.id}`}
            className="text-sm text-marka-700 hover:underline"
          >
            Yeni rapor oluştur
          </Link>
        </div>

        {raporlar.length === 0 ? (
          <BosDurum
            baslik="Henüz rapor üretilmemiş."
            aciklama="Rapor, mevcut puanlamalardan istenildiği anda üretilebilir."
          />
        ) : (
          <div className="space-y-2">
            {raporlar.map((rapor) => (
              <Kart key={rapor.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/koordinator/raporlar/${rapor.id}`}
                    className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                  >
                    {tarihBicimle(rapor.uretimZamani)} raporu
                  </Link>
                  <Rozet tur={rapor.guncel ? "olumlu" : "uyari"}>
                    {rapor.guncel ? "Güncel" : "Güncel değil"}
                  </Rozet>
                  {rapor.duzenlemeZamani ? <Rozet>Elle düzenlendi</Rozet> : null}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {rapor.kapsam.join(" · ")} · {rapor.atolyeSayisi} atölye
                </p>
              </Kart>
            ))}
          </div>
        )}
      </div>

      {/* 11. PDF rapor geçmişi */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">
          PDF rapor geçmişi
        </h2>

        {pdfler.length === 0 ? (
          <BosDurum
            baslik="Henüz PDF oluşturulmamış."
            aciklama="Bir raporu açıp “PDF oluştur” düğmesini kullanın. Üretilen PDF’ler burada kalıcı olarak saklanır."
          />
        ) : (
          <Kart className="divide-y divide-yuzey-100">
            {pdfler.map((pdf) => (
              <div
                key={pdf.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm text-zinc-800">
                    {tarihBicimle(pdf.olusturmaZamani)} tarihli PDF
                  </p>
                  <p className="text-xs text-zinc-500">
                    {tarihBicimle(pdf.raporUretimZamani)} raporundan üretildi
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/koordinator/raporlar/${pdf.raporId}`}
                    className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline"
                  >
                    Raporu gör
                  </Link>
                  <a
                    href={pdf.adres}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-marka-700 hover:underline"
                  >
                    PDF’i aç
                  </a>
                </div>
              </div>
            ))}
          </Kart>
        )}
      </div>
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

function KayitBolumu({
  baslik,
  kayitlar,
  bosAciklama,
}: {
  baslik: string;
  kayitlar: ProfilKaydi[];
  bosAciklama: string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-zinc-900">{baslik}</h2>
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
