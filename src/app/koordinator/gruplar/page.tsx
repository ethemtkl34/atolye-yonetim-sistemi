import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { kontenjanDurumu } from "@/lib/scoring";
import { grupZamani } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Gruplar",
};

/**
 * §12.2 — Bütün grupların tek listesi.
 *
 * Dönem ve kulüp grupları birlikte gösterilir; koordinatörün "hangi gruplar
 * dolu, nereye kayıt alabilirim" sorusunun tek ekrandan cevabı burasıdır.
 */
export default async function GruplarSayfasi() {
  await koordinatorZorunlu();

  const gruplar = await db.group.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: {
      term: { select: { id: true, name: true } },
      club: { select: { id: true, name: true } },
      _count: {
        select: {
          sessions: true,
          enrollments: { where: { status: "AKTIF" } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Gruplar"
        aciklama="Dönem ve kulüp gruplarının tamamı. Kontenjanı dolan gruplara yeni kayıt alınamaz; aynı programa yeni grup eklenebilir."
      />

      {gruplar.length === 0 ? (
        <BosDurum
          baslik="Henüz grup yok."
          aciklama="Grup, bir dönem veya kulüp oluşturulduğunda açılır."
        />
      ) : (
        <div className="space-y-3">
          {gruplar.map((grup) => {
            const kontenjan = kontenjanDurumu(
              grup.capacity,
              grup._count.enrollments,
            );

            const program = grup.term
              ? { etiket: "Dönem", ad: grup.term.name, yol: `/koordinator/donemler/${grup.term.id}` }
              : grup.club
                ? { etiket: "Kulüp", ad: grup.club.name, yol: `/koordinator/kulupler/${grup.club.id}` }
                : null;

            return (
              <Kart key={grup.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">{grup.name}</span>
                  <span className="text-sm text-zinc-600">
                    {grupZamani(grup.day, grup.timeSlot)}
                  </span>
                  {kontenjan.dolu ? (
                    <Rozet tur="uyari">Kontenjan dolu</Rozet>
                  ) : null}
                  {grup.active ? null : <Rozet tur="pasif">Kapalı</Rozet>}
                </div>

                {program ? (
                  <p className="mt-1 text-sm text-zinc-600">
                    {program.etiket}:{" "}
                    <Link
                      href={program.yol}
                      className="text-marka-700 hover:underline"
                    >
                      {program.ad}
                    </Link>
                  </p>
                ) : null}

                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-1.5 w-40 overflow-hidden rounded-full bg-zinc-100"
                    role="presentation"
                  >
                    <div
                      className={
                        kontenjan.dolu
                          ? "h-full bg-amber-500"
                          : "h-full bg-marka-600"
                      }
                      style={{ width: `${kontenjan.yuzde}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-600">
                    {kontenjan.doluluk} / {kontenjan.kapasite} öğrenci
                  </span>
                  <span className="text-xs text-zinc-500">
                    {grup._count.sessions} oturum
                  </span>
                </div>
              </Kart>
            );
          })}
        </div>
      )}
    </div>
  );
}
