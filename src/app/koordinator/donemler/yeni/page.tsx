import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { DonemSihirbazi } from "./donem-sihirbazi";

export const metadata: Metadata = {
  title: "Yeni dönem",
};

export default async function YeniDonemSayfasi() {
  const kullanici = await yonetimZorunlu();

  const [atolyeler, stajyerler] = await Promise.all([
    db.workshopType.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: { role: "STAJYER", active: true, branchId: kullanici.aktifSubeId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: { assignedEnrollments: { where: { status: "AKTIF" } } },
        },
      },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/koordinator/donemler"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Dönemler
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          Yeni dönem oluştur
        </h1>
      </div>

      <DonemSihirbazi
        atolyeler={atolyeler}
        stajyerler={stajyerler.map((stajyer) => ({
          id: stajyer.id,
          name: stajyer.name,
          aktifOgrenciSayisi: stajyer._count.assignedEnrollments,
        }))}
      />
    </div>
  );
}
