import type { Metadata } from "next";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { BosDurum, SayfaBasligi } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { StajyerYonetimi, type StajyerSatiri } from "./stajyer-yonetimi";

export const metadata: Metadata = {
  title: "Stajyerler",
};

const TEMEL_YOL = "/koordinator/stajyerler";

/** §8 — Stajyer listesi ve yük dağılımı. */
export default async function StajyerlerSayfasi(
  props: PageProps<"/koordinator/stajyerler">,
) {
  const kullanici = await yonetimZorunlu("stajyerler");

  const parametreler = await props.searchParams;
  const durumSuzgeci = parametreler.durum === "pasif" ? "pasif" : "aktif";

  const stajyerler = await db.user.findMany({
    where: {
      roles: { has: "STAJYER" },
      branchId: kullanici.aktifSubeId,
      active: durumSuzgeci === "aktif",
    },
    orderBy: { name: "asc" },
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

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Durum"
          temelYol={TEMEL_YOL}
          anahtar="durum"
          secili={durumSuzgeci}
          secenekler={[
            { deger: "aktif", etiket: "Aktif" },
            { deger: "pasif", etiket: "Pasif" },
          ]}
        />
      </SuzgecCubugu>

      {satirlar.length === 0 ? (
        <BosDurum
          baslik={
            durumSuzgeci === "pasif"
              ? "Pasif stajyer hesabı yok."
              : "Henüz stajyer hesabı yok."
          }
          aciklama={
            durumSuzgeci === "pasif"
              ? "Pasife alınan stajyer hesapları burada listelenir."
              : "Kayıt oluştururken öğrenciye stajyer atayabilmek için önce stajyer ekleyin."
          }
        />
      ) : null}

      <StajyerYonetimi stajyerler={satirlar} />
    </div>
  );
}
