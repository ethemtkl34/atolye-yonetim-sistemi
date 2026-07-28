import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, butonStili } from "@/components/ui";
import { AtolyeEkleFormu } from "./atolye-ekle-formu";
import { DurumButonu } from "./durum-butonu";
import { atolyeDurumDegistir } from "./actions";

export const metadata: Metadata = {
  title: "Atölye çeşitleri",
};

/** §2.1 — Kurumun tekrar kullandığı atölye tanımlarının yönetimi. */
export default async function AtolyelerSayfasi() {
  await koordinatorZorunlu();

  const atolyeler = await db.workshopType.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    include: {
      _count: {
        select: {
          questions: { where: { active: true } },
          termWorkshops: true,
          clubWorkshops: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Atölye çeşitleri"
        aciklama="Dönem ve kulüp programlarında kullanılan atölye tanımları. Her atölyenin kendi değerlendirme soru seti vardır."
      />

      <AtolyeEkleFormu />

      {atolyeler.length === 0 ? (
        <BosDurum
          baslik="Henüz atölye çeşidi yok."
          aciklama="Dönem oluşturabilmek için en az 5 atölye çeşidi gerekir."
        />
      ) : (
        <div className="space-y-3">
          {atolyeler.map((atolye) => {
            const programSayisi =
              atolye._count.termWorkshops + atolye._count.clubWorkshops;

            return (
              <Kart
                key={atolye.id}
                className="flex flex-wrap items-start justify-between gap-4 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/koordinator/atolyeler/${atolye.id}`}
                      className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                    >
                      {atolye.name}
                    </Link>
                    {atolye.active ? (
                      <Rozet tur="olumlu">Aktif</Rozet>
                    ) : (
                      <Rozet tur="pasif">Pasif</Rozet>
                    )}
                  </div>

                  {atolye.description ? (
                    <p className="mt-1 text-sm text-zinc-600">
                      {atolye.description}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-zinc-500">
                    {atolye._count.questions} aktif soru
                    {programSayisi > 0
                      ? ` · ${programSayisi} programda kullanılıyor`
                      : " · henüz programda kullanılmadı"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/koordinator/atolyeler/${atolye.id}`}
                    className={butonStili("ikincil")}
                  >
                    Soruları yönet
                  </Link>
                  <DurumButonu
                    aktif={atolye.active}
                    eylem={atolyeDurumDegistir.bind(null, atolye.id)}
                  />
                </div>
              </Kart>
            );
          })}
        </div>
      )}
    </div>
  );
}
