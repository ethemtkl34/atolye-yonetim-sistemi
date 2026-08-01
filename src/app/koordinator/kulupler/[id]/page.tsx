import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { Kart, Rozet, SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { KULUP_DURUMLARI } from "@/lib/durumlar";
import { kontenjanDurumu } from "@/lib/scoring";
import { grupZamani, tarihGunleBicimle } from "@/lib/tarih";
import { KULUP_ATOLYE_SAYISI } from "@/lib/kurallar";
import { GrupDurumButonu } from "@/components/grup-durum-butonu";
import { DurumSecici } from "./durum-secici";
import { GrupEkleFormu } from "./grup-ekle-formu";

export async function generateMetadata(
  props: PageProps<"/koordinator/kulupler/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const kulup = await db.club.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: kulup?.name ?? "Kulüp" };
}

/** §5 — Kulüp detayı: atölyeler, gruplar ve durum. */
export default async function KulupDetaySayfasi(
  props: PageProps<"/koordinator/kulupler/[id]">,
) {
  const kullanici = await yonetimZorunlu();
  const { id } = await props.params;

  // Kulübün kendisi ortak; her şube kendi gruplarını açar.
  const kulup = await db.club.findUnique({
    where: { id },
    include: {
      workshops: {
        orderBy: { sortOrder: "asc" },
        include: { workshopType: { select: { name: true } } },
      },
      groups: {
        where: { branchId: kullanici.aktifSubeId },
        orderBy: { createdAt: "asc" },
        include: {
          _count: {
            select: {
              sessions: true,
              enrollments: { where: { status: "AKTIF" } },
            },
          },
        },
      },
    },
  });

  if (!kulup) notFound();

  const durum = KULUP_DURUMLARI[kulup.status];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/kulupler"
          className={geriBaglantiStili}
        >
          ← Kulüpler
        </Link>

        <div className="mt-2">
          <SayfaBasligi
            baslik={kulup.name}
            aciklama={kulup.description ?? undefined}
            aksiyon={
              <DurumSecici kulupId={kulup.id} mevcutDurum={kulup.status} />
            }
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Rozet tur={durum.rozet}>{durum.etiket}</Rozet>
          <span className="text-sm text-zinc-600">
            {tarihGunleBicimle(kulup.date)}
          </span>
        </div>
      </div>

      {/* --- Atölyeler --- */}
      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Kulübün atölyeleri
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Kulüp tek yarım gün sürer; bu {kulup.workshops.length} atölye kulübün
          bütün gruplarında uygulanır.
        </p>
        <ol className="mt-3 space-y-1">
          {kulup.workshops.map((atolye, sira) => (
            <li key={atolye.id} className="flex gap-2 text-sm">
              <span className="w-5 shrink-0 tabular-nums text-zinc-400">
                {sira + 1}.
              </span>
              <span className="text-zinc-700">{atolye.workshopType.name}</span>
            </li>
          ))}
        </ol>
      </Kart>

      {/* --- Gruplar --- */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Gruplar</h2>

        {kulup.groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-marka-200 bg-white p-6 text-center text-sm text-zinc-600">
            Bu kulüpte henüz grup yok. Öğrenci kaydı alabilmek için bir grup
            ekleyin.
          </p>
        ) : null}

        {kulup.groups.map((grup) => {
          const kontenjan = kontenjanDurumu(
            grup.capacity,
            grup._count.enrollments,
          );

          return (
            <Kart key={grup.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
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
                <GrupDurumButonu
                  grupId={grup.id}
                  aktif={grup.active}
                  tur="kulup"
                />
              </div>

              <p className="mt-2 text-sm text-zinc-600">
                {kontenjan.doluluk} / {kontenjan.kapasite} öğrenci ·{" "}
                {grup._count.sessions} atölye oturumu
              </p>
            </Kart>
          );
        })}

        <GrupEkleFormu
          kulupId={kulup.id}
          bilgi={`Yeni grup ${tarihGunleBicimle(kulup.date)} günü toplanır ve aynı ${KULUP_ATOLYE_SAYISI} atölyeyi kullanır. Gruplar zaman dilimiyle ayrışır.`}
          engelSebebi={
            kulup.status !== "TASLAK" && kulup.status !== "KAYIT_ALIYOR"
              ? `Bu kulüp "${durum.etiket}" durumunda; yeni grup eklenemez.`
              : undefined
          }
        />
      </div>
    </div>
  );
}
