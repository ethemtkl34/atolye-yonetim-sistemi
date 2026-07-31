import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { AKTIF_GRUP_KOSULU } from "@/lib/durumlar";
import { kontenjanDurumu } from "@/lib/scoring";
import { grupZamani } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Gruplar",
};

const TEMEL_YOL = "/koordinator/gruplar";

/**
 * §12.2 — Bütün grupların tek listesi.
 *
 * Dönem ve kulüp grupları birlikte gösterilir; koordinatörün "hangi gruplar
 * dolu, nereye kayıt alabilirim" sorusunun tek ekrandan cevabı burasıdır.
 *
 * Süzgeçler dashboard kartlarının karşılığıdır: "Aktif grup" kartı
 * `?kapsam=aktif`, "Kontenjanı dolan grup" kartı `?kapsam=aktif&durum=dolu`
 * adresine gider. Aktiflik koşulu `AKTIF_GRUP_KOSULU` ile paylaşıldığı için
 * karttaki sayı ile buradaki liste uzunluğu her zaman aynıdır.
 */
export default async function GruplarSayfasi(
  props: PageProps<"/koordinator/gruplar">,
) {
  await koordinatorZorunlu();

  const parametreler = await props.searchParams;
  const kapsam = parametreler.kapsam === "aktif" ? "aktif" : "tumu";
  const durum = parametreler.durum === "dolu" ? "dolu" : "tumu";

  const gruplar = await db.group.findMany({
    // "Tümü" de arşivlenmiş programların gruplarını göstermez — Dönemler ve
    // Kulüpler listeleriyle aynı sözleşme: arşivlenen her şeyin tek adresi
    // Arşiv ekranıdır. Aksi hâlde arşivdeki bir dönemin grupları burada
    // görünüp aktif listede olmayan bir programa bağlantı veriyordu.
    where:
      kapsam === "aktif"
        ? AKTIF_GRUP_KOSULU
        : {
            AND: [
              {
                OR: [
                  { termId: null },
                  { term: { status: { not: "ARSIVLENDI" } } },
                ],
              },
              {
                OR: [
                  { clubId: null },
                  { club: { status: { not: "ARSIVLENDI" } } },
                ],
              },
            ],
          },
    // Program ve grup adına göre sıralanır; oluşturulma tarihi "2. Grup"u
    // "1. Grup"un üstüne taşıyordu.
    orderBy: [
      { active: "desc" },
      { term: { name: "asc" } },
      { club: { name: "asc" } },
      { name: "asc" },
    ],
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

  // Kontenjan doluluğu iki sütunun karşılaştırması olduğu için veritabanı
  // koşuluyla değil, `kontenjanDurumu` ile — yani ekranda gösterilen sayıyı
  // üreten aynı fonksiyonla — süzülüyor.
  const gosterilecek =
    durum === "dolu"
      ? gruplar.filter(
          (grup) =>
            kontenjanDurumu(grup.capacity, grup._count.enrollments).dolu,
        )
      : gruplar;

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Gruplar"
        aciklama="Dönem ve kulüp gruplarının tamamı. Kontenjanı dolan gruplara yeni kayıt alınamaz; aynı programa yeni grup eklenebilir."
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Kapsam"
          temelYol={TEMEL_YOL}
          anahtar="kapsam"
          secenekler={[
            { deger: "aktif", etiket: "Aktif programlar" },
            { deger: "tumu", etiket: "Tümü" },
          ]}
          secili={kapsam}
          digerler={{ durum }}
        />
        <SuzgecGrubu
          etiket="Kontenjan"
          temelYol={TEMEL_YOL}
          anahtar="durum"
          secenekler={[
            { deger: "tumu", etiket: "Tümü" },
            { deger: "dolu", etiket: "Yalnızca dolanlar" },
          ]}
          secili={durum}
          digerler={{ kapsam }}
        />
      </SuzgecCubugu>

      {gosterilecek.length === 0 ? (
        <BosDurum
          baslik={
            durum === "dolu"
              ? "Kontenjanı dolan grup yok."
              : kapsam === "aktif"
                ? "Aktif programda grup yok."
                : "Henüz grup yok."
          }
          aciklama={
            durum === "dolu" || kapsam === "aktif"
              ? "Süzgeci “Tümü” yaparak bütün grupları görebilirsiniz."
              : "Grup, bir dönem veya kulüp oluşturulduğunda açılır."
          }
        />
      ) : (
        <div className="space-y-3">
          {gosterilecek.map((grup) => {
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
                    className="h-1.5 w-40 overflow-hidden rounded-full bg-yuzey-200"
                    role="presentation"
                  >
                    <div
                      className={
                        kontenjan.dolu
                          ? "h-full bg-vurgu-600"
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
