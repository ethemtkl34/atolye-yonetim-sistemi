import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, baglantiStili, butonStili, kartBasligiStili } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { AKTIF_KULUP_KOSULU, KULUP_DURUMLARI } from "@/lib/durumlar";
import { kontenjanDurumu } from "@/lib/scoring";
import { tarihGunleBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Kulüpler",
};

const TEMEL_YOL = "/koordinator/kulupler";

/**
 * §5 — Kulüp listesi.
 *
 * Arşivlenmiş kulüpler Arşiv ekranında durur. "Aktif" süzgeci dashboard
 * kartıyla aynı koşulu (`AKTIF_KULUP_KOSULU`) okur.
 */
export default async function KuluplerSayfasi(
  props: PageProps<"/koordinator/kulupler">,
) {
  const kullanici = await yonetimZorunlu();

  const parametreler = await props.searchParams;
  const kapsam = parametreler.kapsam === "aktif" ? "aktif" : "tumu";

  const [kulupler, arsivSayisi] = await Promise.all([
    db.club.findMany({
    where:
      kapsam === "aktif"
        ? AKTIF_KULUP_KOSULU
        : { status: { not: "ARSIVLENDI" } },
    orderBy: { date: "desc" },
    include: {
      workshops: {
        orderBy: { sortOrder: "asc" },
        include: { workshopType: { select: { name: true } } },
      },
      // Kulüp ortak, grupları şubeye ait: doluluk kendi şubesinin.
      groups: {
        where: { branchId: kullanici.aktifSubeId },
        select: {
          capacity: true,
          active: true,
          _count: { select: { enrollments: { where: { status: "AKTIF" } } } },
        },
      },
    },
    }),
    db.club.count({ where: { status: "ARSIVLENDI" } }),
  ]);

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Kulüpler"
        aciklama="Kulüp, dönemden bağımsız tek yarım günlük hazır programdır: 3 atölye, kendi grubu ve kontenjanı. Kulübün tanımı iki şubede ortaktır; gruplar ve kayıtlar yalnızca sizin şubenizindir. Kulüp öğrencileri dönem gruplarına dahil edilmez."
        ustBilgi={<Rozet tur="notr">Tanım bütün şubelerde ortak</Rozet>}
        aksiyon={
          <Link
            href="/koordinator/kulupler/yeni"
            className={butonStili()}
          >
            Yeni kulüp
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
            className={baglantiStili}
          >
            Arşivde {arsivSayisi} kulüp
          </Link>
        ) : null}
      </SuzgecCubugu>

      {kulupler.length === 0 ? (
        <BosDurum
          baslik={
            kapsam === "aktif"
              ? "Kayıt alan kulüp yok."
              : "Henüz kulüp oluşturulmamış."
          }
          aciklama={
            kapsam === "aktif"
              ? "“Tümü” süzgeciyle taslak, tamamlanmış ve iptal edilmiş kulüpleri de görebilirsiniz."
              : "Yarım günlük 3 atölyelik bir program açmak için “Yeni kulüp” düğmesini kullanın."
          }
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
                    className={kartBasligiStili}
                  >
                    {kulup.name}
                  </Link>
                  <Rozet tur={durum.rozet}>{durum.etiket}</Rozet>
                  {kontenjan.dolu && kapasite > 0 ? (
                    <Rozet tur="uyari">Kontenjan dolu</Rozet>
                  ) : null}
                </div>

                <p className="mt-1 text-sm text-zinc-600">
                  {tarihGunleBicimle(kulup.date)}
                  {kulup.weekDates.length > 1
                    ? ` · ${kulup.weekDates.length} gün`
                    : ""}{" "}
                  · {kulup.groups.length} grup ·{" "}
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
