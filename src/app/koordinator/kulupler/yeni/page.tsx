import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { KulupSihirbazi } from "./kulup-sihirbazi";
import { geriBaglantiStili } from "@/components/ui";

export const metadata: Metadata = {
  title: "Yeni kulüp",
};

export default async function YeniKulupSayfasi() {
  await yonetimZorunlu("kulupler", "TAM");

  const atolyeler = await db.workshopType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/koordinator/kulupler"
          className={geriBaglantiStili}
        >
          ← Kulüpler
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          Yeni kulüp oluştur
        </h1>
      </div>

      <KulupSihirbazi atolyeler={atolyeler} />
    </div>
  );
}
