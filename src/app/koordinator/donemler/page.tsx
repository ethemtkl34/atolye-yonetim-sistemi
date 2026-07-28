import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { AKTIF_DONEM_KOSULU, DONEM_DURUMLARI } from "@/lib/durumlar";
import { haftaSonuBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Dönemler",
};

const TEMEL_YOL = "/koordinator/donemler";

/**
 * §4 — Dönem listesi.
 *
 * Arşivlenmiş dönemler burada değil, Arşiv ekranında durur; iki liste
 * birbirinin tamamlayıcısıdır. "Aktif" süzgeci dashboard kartıyla aynı
 * koşulu (`AKTIF_DONEM_KOSULU`) okur.
 */
export default async function DonemlerSayfasi(
  props: PageProps<"/koordinator/donemler">,
) {
  await koordinatorZorunlu();

  const parametreler = await props.searchParams;
  const kapsam = parametreler.kapsam === "aktif" ? "aktif" : "tumu";

  const [donemler, arsivSayisi] = await Promise.all([
    db.term.findMany({
      where:
        kapsam === "aktif"
          ? AKTIF_DONEM_KOSULU
          : { status: { not: "ARSIVLENDI" } },
      orderBy: { createdAt: "desc" },
      include: {
        weeks: { orderBy: { weekNumber: "asc" }, select: { date: true } },
        _count: { select: { groups: true, workshops: true } },
      },
    }),
    db.term.count({ where: { status: "ARSIVLENDI" } }),
  ]);

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Dönemler"
        aciklama="Her dönem 10 eğitim haftasından ve 5 atölyeden oluşur. Kontenjan dolduğunda aynı döneme yeni grup eklenebilir."
        aksiyon={
          <Link
            href="/koordinator/donemler/yeni"
            className="inline-flex items-center justify-center rounded-md bg-marka-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-marka-700"
          >
            Yeni dönem
          </Link>
        }
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Kapsam"
          temelYol={TEMEL_YOL}
          anahtar="kapsam"
          secenekler={[
            { deger: "aktif", etiket: "Aktif" },
            { deger: "tumu", etiket: "Tümü" },
          ]}
          secili={kapsam}
        />
        {arsivSayisi > 0 ? (
          <Link
            href="/koordinator/arsiv"
            className="text-sm text-marka-700 hover:underline"
          >
            Arşivde {arsivSayisi} dönem
          </Link>
        ) : null}
      </SuzgecCubugu>

      {donemler.length === 0 ? (
        <BosDurum
          baslik={
            kapsam === "aktif"
              ? "Aktif dönem yok."
              : "Henüz dönem oluşturulmamış."
          }
          aciklama={
            kapsam === "aktif"
              ? "Kayıt alan veya devam eden dönem bulunmuyor. “Tümü” süzgeciyle taslak ve tamamlanmış dönemleri görebilirsiniz."
              : "Öğrenci kaydı alabilmek için önce bir dönem ve grup açın."
          }
        />
      ) : (
        <div className="space-y-3">
          {donemler.map((donem) => {
            const durum = DONEM_DURUMLARI[donem.status];
            const ilkHafta = donem.weeks.at(0);
            const sonHafta = donem.weeks.at(-1);

            return (
              <Kart key={donem.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/koordinator/donemler/${donem.id}`}
                    className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                  >
                    {donem.name}
                  </Link>
                  <Rozet tur={durum.rozet}>{durum.etiket}</Rozet>
                </div>

                {donem.description ? (
                  <p className="mt-1 text-sm text-zinc-600">
                    {donem.description}
                  </p>
                ) : null}

                <p className="mt-2 text-xs text-zinc-500">
                  {ilkHafta && sonHafta
                    ? `${haftaSonuBicimle(ilkHafta.date)} → ${haftaSonuBicimle(sonHafta.date)}`
                    : "Takvim tanımlı değil"}
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  {donem.weeks.length} eğitim haftası ·{" "}
                  {donem._count.workshops} atölye · {donem._count.groups} grup
                </p>
              </Kart>
            );
          })}
        </div>
      )}
    </div>
  );
}
