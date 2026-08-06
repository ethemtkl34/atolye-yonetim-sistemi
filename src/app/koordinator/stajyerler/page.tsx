import type { Metadata } from "next";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { BosDurum, SayfaBasligi } from "@/components/ui";
import { StajyerYonetimi, type StajyerSatiri } from "./stajyer-yonetimi";

export const metadata: Metadata = {
  title: "Stajyerler",
};

/** §8 — Stajyer listesi ve yük dağılımı. */
export default async function StajyerlerSayfasi() {
  const kullanici = await yonetimZorunlu("stajyerler");

  const stajyerler = await db.user.findMany({
    where: { roles: { has: "STAJYER" }, branchId: kullanici.aktifSubeId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      _count: {
        select: {
          assignedEnrollments: { where: { status: "AKTIF" } },
          enteredScores: true,
        },
      },
    },
  });

  const satirlar: StajyerSatiri[] = stajyerler.map((stajyer) => ({
    id: stajyer.id,
    name: stajyer.name,
    email: stajyer.email,
    active: stajyer.active,
    aktifOgrenciSayisi: stajyer._count.assignedEnrollments,
    puanlamaSayisi: stajyer._count.enteredScores,
  }));

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Stajyerler"
        aciklama="Stajyerler yalnızca kendilerine atanmış öğrencilerin puanlama ekranlarını görür. Öğrenci sayısı bilgi amaçlıdır; sistem sabit bir üst sınır uygulamaz."
      />

      {satirlar.length === 0 ? (
        <BosDurum
          baslik="Henüz stajyer hesabı yok."
          aciklama="Kayıt oluştururken öğrenciye stajyer atayabilmek için önce stajyer ekleyin."
        />
      ) : null}

      <StajyerYonetimi stajyerler={satirlar} />
    </div>
  );
}
