import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { KULUP_DURUMLARI } from "@/lib/durumlar";
import { kontenjanDurumu } from "@/lib/scoring";
import { tarihGunleBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Kulüpler",
};

/** §5 — Kulüp listesi. */
export default async function KuluplerSayfasi() {
  await koordinatorZorunlu();

  const kulupler = await db.club.findMany({
    where: { status: { not: "ARSIVLENDI" } },
    orderBy: { date: "desc" },
    include: {
      workshops: {
        orderBy: { sortOrder: "asc" },
        include: { workshopType: { select: { name: true } } },
      },
      groups: {
        select: {
          capacity: true,
          active: true,
          _count: { select: { enrollments: { where: { status: "AKTIF" } } } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Kulüpler"
        aciklama="Kulüp, dönemden bağımsız tek yarım günlük hazır programdır: 3 atölye, kendi grubu ve kontenjanı. Kulüp öğrencileri dönem gruplarına dahil edilmez."
        aksiyon={
          <Link
            href="/koordinator/kulupler/yeni"
            className="inline-flex items-center justify-center rounded-md bg-marka-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-marka-700"
          >
            Yeni kulüp
          </Link>
        }
      />

      {kulupler.length === 0 ? (
        <BosDurum
          baslik="Henüz kulüp oluşturulmamış."
          aciklama="Yarım günlük 3 atölyelik bir program açmak için “Yeni kulüp” düğmesini kullanın."
        />
      ) : (
        <div className="space-y-3">
          {kulupler.map((kulup) => {
            const durum = KULUP_DURUMLARI[kulup.status];
            const kapasite = kulup.groups.reduce(
              (toplam, grup) => toplam + grup.capacity,
              0,
            );
            const doluluk = kulup.groups.reduce(
              (toplam, grup) => toplam + grup._count.enrollments,
              0,
            );
            const kontenjan = kontenjanDurumu(kapasite, doluluk);

            return (
              <Kart key={kulup.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/koordinator/kulupler/${kulup.id}`}
                    className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                  >
                    {kulup.name}
                  </Link>
                  <Rozet tur={durum.rozet}>{durum.etiket}</Rozet>
                  {kontenjan.dolu && kapasite > 0 ? (
                    <Rozet tur="uyari">Kontenjan dolu</Rozet>
                  ) : null}
                </div>

                <p className="mt-1 text-sm text-zinc-600">
                  {tarihGunleBicimle(kulup.date)} · {kulup.groups.length} grup ·{" "}
                  {kontenjan.doluluk}/{kontenjan.kapasite} öğrenci
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  {kulup.workshops
                    .map((atolye) => atolye.workshopType.name)
                    .join(" · ")}
                </p>
              </Kart>
            );
          })}
        </div>
      )}
    </div>
  );
}
