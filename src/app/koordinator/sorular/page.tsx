import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { BosDurum, Kart, Rozet, SayfaBasligi, baglantiStili } from "@/components/ui";
import { SuzgecCubugu, SuzgecSecici } from "@/components/suzgec";

export const metadata: Metadata = {
  title: "Değerlendirme soruları",
};

/**
 * §9.1 — Bütün atölyelerin soru setlerine tek ekrandan bakış.
 *
 * Ayrı bir modül olmasının sebebi: setlerin birbirinden bağımsız olduğunu
 * göstermek. Bir atölyenin sorusunu değiştirmek diğerlerini etkilemez ve bu
 * ancak yan yana görülünce anlaşılır.
 */
export default async function SorularSayfasi(
  props: PageProps<"/koordinator/sorular">,
) {
  await yonetimZorunlu("sorular");

  const parametreler = await props.searchParams;
  const atolyeSuzgeci =
    typeof parametreler.atolye === "string" ? parametreler.atolye : "";

  const atolyeler = await db.workshopType.findMany({
    where: atolyeSuzgeci ? { id: atolyeSuzgeci } : {},
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    include: {
      questions: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, text: true },
      },
    },
  });

  // Seçici bütün atölyeleri listeler; süzgeç uygulanmış sorgudan türetilemez.
  const atolyeSecenekleri = await db.workshopType.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Değerlendirme soruları"
        aciklama="Her atölyenin kendi soru seti vardır ve bağımsız düzenlenir. Setler iki şubede ortaktır. Bir sorunun metnini değiştirmek geçmiş değerlendirmeleri etkilemez; onlar puanlama anındaki metni saklar."
        ustBilgi={<Rozet tur="notr">Bütün şubelerde ortak</Rozet>}
      />

      <SuzgecCubugu>
        <SuzgecSecici
          etiket="Atölye"
          temelYol="/koordinator/sorular"
          anahtar="atolye"
          secili={atolyeSuzgeci}
          secenekler={atolyeSecenekleri.map((atolye) => ({
            deger: atolye.id,
            etiket: atolye.name,
          }))}
        />
      </SuzgecCubugu>

      {atolyeler.length === 0 ? (
        <BosDurum baslik="Henüz atölye çeşidi yok." />
      ) : (
        <div className="space-y-4">
          {atolyeler.map((atolye) => (
            <Kart key={atolye.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-zinc-900">{atolye.name}</h2>
                  {atolye.active ? null : <Rozet tur="pasif">Pasif</Rozet>}
                  <span className="text-xs text-zinc-500">
                    {atolye.questions.length} aktif soru
                  </span>
                </div>

                <Link
                  href={`/koordinator/atolyeler/${atolye.id}`}
                  className={baglantiStili}
                >
                  Düzenle
                </Link>
              </div>

              {atolye.questions.length === 0 ? (
                <p className="mt-3 text-sm text-vurgu-700">
                  Bu atölyenin aktif sorusu yok — puanlama yapılamaz.
                </p>
              ) : (
                <ol className="mt-3 space-y-1">
                  {atolye.questions.map((soru, sira) => (
                    <li key={soru.id} className="flex gap-2 text-sm">
                      <span className="w-5 shrink-0 tabular-nums text-zinc-400">
                        {sira + 1}.
                      </span>
                      <span className="text-zinc-700">{soru.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Kart>
          ))}
        </div>
      )}
    </div>
  );
}
