import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi } from "@/components/ui";
import {
  AKTIF_DONEM_KOSULU,
  AKTIF_GRUP_KOSULU,
  AKTIF_KULUP_KOSULU,
  AKTIF_OGRENCI_KOSULU,
} from "@/lib/durumlar";
import { kayitIlerlemeleri } from "@/lib/puanlama-verisi";
import { raporOzetleri } from "@/lib/rapor-verisi";
import { kontenjanDurumu } from "@/lib/scoring";
import { grupZamani, tarihBicimle } from "@/lib/tarih";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * §12.1 — Koordinatör dashboardu.
 *
 * Her sayı, ilgili listenin kendi sorgusuyla aynı koşuldan üretilir; kart ile
 * liste arasında ikinci bir "özet" tablosu yok. Koşullar `lib/durumlar.ts`
 * içinde tek yerde tanımlı ve her kart, tıklanınca aynı koşulu uygulayan
 * süzgeçli adrese gidiyor. Böylece kartta yazan sayı ile açılan listenin
 * uzunluğu birebir aynı kalıyor.
 */
export default async function KoordinatorDashboard() {
  const kullanici = await koordinatorZorunlu();

  const [
    aktifDonemSayisi,
    aktifKulupSayisi,
    aktifGruplar,
    aktifOgrenciSayisi,
    ilerlemeler,
    raporlar,
    toplamRaporSayisi,
  ] = await Promise.all([
    db.term.count({ where: AKTIF_DONEM_KOSULU }),
    db.club.count({ where: AKTIF_KULUP_KOSULU }),
    db.group.findMany({
      where: AKTIF_GRUP_KOSULU,
      select: {
        id: true,
        name: true,
        day: true,
        timeSlot: true,
        capacity: true,
        term: { select: { id: true, name: true } },
        club: { select: { id: true, name: true } },
        _count: { select: { enrollments: { where: { status: "AKTIF" } } } },
      },
    }),
    // §12.1 — "Toplam aktif öğrenci": aktif programlarda kaydı olan farklı
    // öğrenci sayısı. Aynı öğrencinin iki kaydı varsa bir kez sayılır.
    db.student.count({ where: AKTIF_OGRENCI_KOSULU }),
    kayitIlerlemeleri({ yalnizcaAktif: true, yalnizcaAktifProgram: true }),
    raporOzetleri({}),
    // "Toplam rapor" listeden değil count'tan: raporOzetleri en yeni 200
    // satırla sınırlı, kart ise gerçek toplamı söylemeli.
    db.report.count(),
  ]);

  const dolanGruplar = aktifGruplar.filter(
    (grup) => kontenjanDurumu(grup.capacity, grup._count.enrollments).dolu,
  );

  const eksikPuanlamalar = ilerlemeler.filter(
    (ilerleme) => ilerleme.ozet.bekleyen > 0,
  );
  const bekleyenFormSayisi = eksikPuanlamalar.reduce(
    (toplam, ilerleme) => toplam + ilerleme.ozet.bekleyen,
    0,
  );

  const guncelOlmayanRaporlar = raporlar.filter((rapor) => !rapor.guncel);
  const sonRaporlar = raporlar.slice(0, 5);

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik={`Hoş geldiniz, ${kullanici.name}`}
        aciklama="Kurumun güncel durumu. Her karta tıklayarak ilgili listeye gidebilirsiniz."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OzetKart
          baslik="Aktif dönem"
          deger={aktifDonemSayisi}
          yol="/koordinator/donemler?kapsam=aktif"
        />
        <OzetKart
          baslik="Aktif kulüp"
          deger={aktifKulupSayisi}
          yol="/koordinator/kulupler?kapsam=aktif"
        />
        <OzetKart
          baslik="Aktif grup"
          deger={aktifGruplar.length}
          yol="/koordinator/gruplar?kapsam=aktif&durum=tumu"
        />
        <OzetKart
          baslik="Aktif öğrenci"
          deger={aktifOgrenciSayisi}
          yol="/koordinator/ogrenciler?kapsam=aktif"
        />
        <OzetKart
          baslik="Kontenjanı dolan grup"
          deger={dolanGruplar.length}
          yol="/koordinator/gruplar?kapsam=aktif&durum=dolu"
          vurgu={dolanGruplar.length > 0}
        />
        <OzetKart
          baslik="Eksik puanlama"
          deger={bekleyenFormSayisi}
          altBilgi={
            eksikPuanlamalar.length > 0
              ? `${eksikPuanlamalar.length} kayıtta`
              : undefined
          }
          yol="/koordinator/puanlamalar?suzgec=eksik&kapsam=aktif"
          vurgu={bekleyenFormSayisi > 0}
        />
        <OzetKart
          baslik="Güncelliğini yitiren rapor"
          deger={guncelOlmayanRaporlar.length}
          yol="/koordinator/raporlar?suzgec=eski"
          vurgu={guncelOlmayanRaporlar.length > 0}
        />
        <OzetKart
          baslik="Toplam rapor"
          deger={toplamRaporSayisi}
          yol="/koordinator/raporlar?suzgec=tumu"
        />
      </div>

      {/* --- Kontenjanı dolan gruplar --- */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Kontenjanı dolan gruplar
        </h2>
        {dolanGruplar.length === 0 ? (
          <BosDurum baslik="Kontenjanı dolan grup yok." />
        ) : (
          <Kart className="divide-y divide-yuzey-100">
            {dolanGruplar.map((grup) => (
              <div
                key={grup.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {grup.term?.name ?? grup.club?.name} · {grup.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {grupZamani(grup.day, grup.timeSlot)} ·{" "}
                    {grup._count.enrollments}/{grup.capacity} öğrenci
                  </p>
                </div>
                <Link
                  href={
                    grup.term
                      ? `/koordinator/donemler/${grup.term.id}`
                      : `/koordinator/kulupler/${grup.club?.id}`
                  }
                  className="text-sm text-marka-700 hover:underline"
                >
                  Yeni grup ekle
                </Link>
              </div>
            ))}
          </Kart>
        )}
      </div>

      {/* --- Eksik puanlamalar --- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">
            Eksik puanlamalar
          </h2>
          <Link
            href="/koordinator/puanlamalar?suzgec=eksik&kapsam=aktif"
            className="text-sm text-marka-700 hover:underline"
          >
            Tümü
          </Link>
        </div>
        {eksikPuanlamalar.length === 0 ? (
          <BosDurum
            baslik={
              aktifGruplar.length === 0
                ? "Aktif programda bekleyen form yok."
                : "Yapılmış bütün atölyelerin formları dolduruldu."
            }
          />
        ) : (
          <Kart className="divide-y divide-yuzey-100">
            {eksikPuanlamalar.slice(0, 5).map((ilerleme) => (
              <div
                key={ilerleme.kayit.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {ilerleme.kayit.ogrenciAdi}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {ilerleme.kayit.program} · {ilerleme.kayit.grupAdi} ·
                    Sorumlu: {ilerleme.kayit.stajyerAdi ?? "Atanmamış"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Rozet tur="uyari">{ilerleme.ozet.bekleyen} form</Rozet>
                  <Link
                    href={`/koordinator/puanlamalar/${ilerleme.kayit.id}`}
                    className="text-sm text-marka-700 hover:underline"
                  >
                    Aç
                  </Link>
                </div>
              </div>
            ))}
          </Kart>
        )}
      </div>

      {/* --- Son raporlar --- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">
            Son oluşturulan raporlar
          </h2>
          <Link
            href="/koordinator/raporlar?suzgec=tumu"
            className="text-sm text-marka-700 hover:underline"
          >
            Tümü
          </Link>
        </div>
        {sonRaporlar.length === 0 ? (
          <BosDurum baslik="Henüz rapor üretilmemiş." />
        ) : (
          <Kart className="divide-y divide-yuzey-100">
            {sonRaporlar.map((rapor) => (
              <div
                key={rapor.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {rapor.ogrenciAdi}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {tarihBicimle(rapor.uretimZamani)} · {rapor.kapsam.join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Rozet tur={rapor.guncel ? "olumlu" : "uyari"}>
                    {rapor.guncel ? "Güncel" : "Güncel değil"}
                  </Rozet>
                  <Link
                    href={`/koordinator/raporlar/${rapor.id}`}
                    className="text-sm text-marka-700 hover:underline"
                  >
                    Aç
                  </Link>
                </div>
              </div>
            ))}
          </Kart>
        )}
      </div>
    </div>
  );
}

/**
 * Özet kartı.
 *
 * Sol kenardaki renk şeridi kartın ne anlattığını uzaktan ayırt ettiriyor:
 * mürdüm "durum bilgisi", turuncu ise "işlem bekliyor". Turuncu yalnızca
 * şerit ve sayıda; küçük metin için beyaz üstünde kontrastı yetmediğinden
 * başlıklar nötr kalıyor.
 */
function OzetKart({
  baslik,
  deger,
  altBilgi,
  yol,
  vurgu = false,
}: {
  baslik: string;
  deger: number;
  altBilgi?: string;
  yol: string;
  vurgu?: boolean;
}) {
  // Bekleyen iş yoksa turuncuya gerek yok: sıfır, uyarı değil iyi haber.
  const dikkat = vurgu && deger > 0;

  return (
    <Link
      href={yol}
      className={cn(
        "relative overflow-hidden rounded-lg border p-4 pl-5 shadow-[0_1px_2px_rgba(91,16,53,0.04)] transition-colors",
        dikkat
          ? "border-vurgu-200 bg-vurgu-50 hover:bg-vurgu-100"
          : "border-yuzey-200 bg-white hover:bg-marka-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          dikkat ? "bg-vurgu-600" : "bg-marka-600",
        )}
      />
      <p className="text-sm text-zinc-600">{baslik}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          dikkat ? "text-vurgu-800" : "text-marka-800",
        )}
      >
        {deger}
      </p>
      {altBilgi ? (
        <p className="mt-0.5 text-xs text-zinc-500">{altBilgi}</p>
      ) : null}
    </Link>
  );
}
