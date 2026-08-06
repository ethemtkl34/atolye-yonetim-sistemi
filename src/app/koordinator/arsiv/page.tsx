import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, kartBasligiStili } from "@/components/ui";
import {
  ARSIV_DONEM_KOSULU,
  ARSIV_KULUP_KOSULU,
  KULUP_DURUMLARI,
  DONEM_DURUMLARI,
} from "@/lib/durumlar";
import { grupZamani, haftaBicimle, tarihGunleBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Arşiv",
};

/**
 * §12.2 — Arşiv.
 *
 * Durumu "Arşivlendi" yapılan dönem ve kulüpler burada toplanır. Dönemler ve
 * Kulüpler listeleri tam olarak bu koşulun dışını gösterir; yani her program
 * ya aktif listelerde ya arşivde görünür, ikisinde birden asla görünmez.
 *
 * Arşivlemek silmek değildir: grup, kayıt, puanlama ve raporlar yerinde durur,
 * program sayfası açılmaya devam eder. Değişen tek şey, yeni kayıt alınamaması
 * (kayıt yalnızca "Kayıt alıyor" durumundaki programa açılabiliyor) ve günlük
 * listeleri meşgul etmemesi.
 */
export default async function ArsivSayfasi() {
  const kullanici = await yonetimZorunlu("arsiv");
  const subeId = kullanici.aktifSubeId;

  const [donemler, kulupler] = await Promise.all([
    db.term.findMany({
      where: ARSIV_DONEM_KOSULU,
      orderBy: { createdAt: "desc" },
      include: {
        weeks: { orderBy: { weekNumber: "asc" }, select: { date: true } },
        groups: {
          where: { branchId: subeId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            days: true,
            timeSlot: true,
            // Diğer bütün ekranlar gibi yalnızca AKTIF kayıtlar sayılır;
            // filtresiz sayım iptal edilmiş kayıtları da katıyor ve arşiv,
            // programın kendi sayfasından daha yüksek bir sayı gösteriyordu.
            _count: {
              select: {
                enrollments: { where: { status: "AKTIF" } },
                sessions: true,
              },
            },
          },
        },
        _count: { select: { workshops: true } },
      },
    }),
    db.club.findMany({
      where: ARSIV_KULUP_KOSULU,
      orderBy: { date: "desc" },
      include: {
        groups: {
          where: { branchId: subeId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            days: true,
            timeSlot: true,
            _count: {
              select: {
                enrollments: { where: { status: "AKTIF" } },
                sessions: true,
              },
            },
          },
        },
        _count: { select: { workshops: true } },
      },
    }),
  ]);

  const bosMu = donemler.length === 0 && kulupler.length === 0;

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Arşiv"
        aciklama="Arşivlenmiş dönem ve kulüpler. Kayıtlar, puanlamalar ve raporlar korunur; arşivlenen programa yeni kayıt alınamaz. Programı geri almak için sayfasındaki durumu değiştirmeniz yeterli."
      />

      {bosMu ? (
        <BosDurum
          baslik="Arşivde program yok."
          aciklama="Bir dönem veya kulübün durumu “Arşivlendi” yapıldığında burada listelenir ve aktif listelerden çıkar."
        />
      ) : null}

      {donemler.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900">
            Dönemler ({donemler.length})
          </h2>
          {donemler.map((donem) => {
            const durum = DONEM_DURUMLARI[donem.status];
            const ilkHafta = donem.weeks.at(0);
            const sonHafta = donem.weeks.at(-1);
            const toplamKayit = donem.groups.reduce(
              (toplam, grup) => toplam + grup._count.enrollments,
              0,
            );

            return (
              <Kart key={donem.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/koordinator/donemler/${donem.id}`}
                    className={kartBasligiStili}
                  >
                    {donem.name}
                  </Link>
                  <Rozet tur={durum.rozet}>{durum.etiket}</Rozet>
                </div>

                <p className="mt-1 text-sm text-zinc-600">
                  {donem.weeks.length} hafta · {donem._count.workshops} atölye ·{" "}
                  {donem.groups.length} grup · {toplamKayit} kayıt
                  {ilkHafta && sonHafta
                    ? ` · ${haftaBicimle(ilkHafta.date, donem.dayMode)} – ${haftaBicimle(sonHafta.date, donem.dayMode)}`
                    : ""}
                </p>

                <ul className="mt-2 space-y-1">
                  {donem.groups.map((grup) => (
                    <li key={grup.id} className="text-xs text-zinc-500">
                      {grup.name} · {grupZamani(grup.days, grup.timeSlot)} ·{" "}
                      {grup._count.enrollments} kayıt · {grup._count.sessions}{" "}
                      oturum
                    </li>
                  ))}
                </ul>
              </Kart>
            );
          })}
        </div>
      ) : null}

      {kulupler.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900">
            Kulüpler ({kulupler.length})
          </h2>
          {kulupler.map((kulup) => {
            const durum = KULUP_DURUMLARI[kulup.status];
            const toplamKayit = kulup.groups.reduce(
              (toplam, grup) => toplam + grup._count.enrollments,
              0,
            );

            return (
              <Kart key={kulup.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/koordinator/kulupler/${kulup.id}`}
                    className={kartBasligiStili}
                  >
                    {kulup.name}
                  </Link>
                  <Rozet tur={durum.rozet}>{durum.etiket}</Rozet>
                </div>

                <p className="mt-1 text-sm text-zinc-600">
                  {tarihGunleBicimle(kulup.date)} · {kulup._count.workshops}{" "}
                  atölye · {kulup.groups.length} grup · {toplamKayit} kayıt
                </p>

                <ul className="mt-2 space-y-1">
                  {kulup.groups.map((grup) => (
                    <li key={grup.id} className="text-xs text-zinc-500">
                      {grup.name} · {grupZamani(grup.days, grup.timeSlot)} ·{" "}
                      {grup._count.enrollments} kayıt · {grup._count.sessions}{" "}
                      oturum
                    </li>
                  ))}
                </ul>
              </Kart>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
