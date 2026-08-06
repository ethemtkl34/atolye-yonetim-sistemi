import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { Kart, Rozet, geriBaglantiStili } from "@/components/ui";
import { AtolyeDuzenleFormu } from "./atolye-duzenle-formu";
import { SoruYonetimi, type SoruSatiri } from "./soru-yonetimi";

export async function generateMetadata(
  props: PageProps<"/koordinator/atolyeler/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const atolye = await db.workshopType.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: atolye?.name ?? "Atölye" };
}

/** §9.1 — Bir atölyenin bilgileri ve kendine ait soru seti. */
export default async function AtolyeDetaySayfasi(
  props: PageProps<"/koordinator/atolyeler/[id]">,
) {
  await yonetimZorunlu("atolyeler");
  const { id } = await props.params;

  const atolye = await db.workshopType.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { answers: true } } },
      },
    },
  });

  if (!atolye) notFound();

  const sorular: SoruSatiri[] = atolye.questions.map((soru) => ({
    id: soru.id,
    text: soru.text,
    active: soru.active,
    sortOrder: soru.sortOrder,
    kullanimSayisi: soru._count.answers,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/atolyeler"
          className={geriBaglantiStili}
        >
          ← Atölye çeşitleri
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-zinc-900">{atolye.name}</h1>
          {atolye.active ? (
            <Rozet tur="olumlu">Aktif</Rozet>
          ) : (
            <Rozet tur="pasif">Pasif</Rozet>
          )}
        </div>

        {atolye.description ? (
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            {atolye.description}
          </p>
        ) : null}
      </div>

      <Kart className="p-4">
        <AtolyeDuzenleFormu
          atolye={{
            id: atolye.id,
            name: atolye.name,
            description: atolye.description,
          }}
        />
      </Kart>

      <SoruYonetimi atolyeId={atolye.id} sorular={sorular} />
    </div>
  );
}
