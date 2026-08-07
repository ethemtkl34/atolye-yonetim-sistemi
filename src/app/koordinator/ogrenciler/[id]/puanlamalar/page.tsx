import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { BosDurum, SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { KayitListesi } from "@/components/puanlama-ekranlari";
import { kayitIlerlemeleri } from "@/lib/puanlama-verisi";

export const metadata: Metadata = {
  title: "Puanlama geçmişi",
};

/**
 * §6.3.8 — Öğrencinin kayıt bazlı puanlama ilerlemesi.
 *
 * Önceden profil sayfasının içinde liste olarak duruyordu; profil
 * sadeleştirilirken kendi sayfasına taşındı. Profildeki "Puanlama geçmişi"
 * kartı buraya gelir.
 */
export default async function OgrenciPuanlamalariSayfasi(
  props: PageProps<"/koordinator/ogrenciler/[id]/puanlamalar">,
) {
  const kullanici = await yonetimZorunlu("puanlamalar");
  const subeId = kullanici.aktifSubeId;
  const { id } = await props.params;

  const ogrenci = await db.student.findFirst({
    where: { id, branchId: subeId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!ogrenci) notFound();

  const ilerlemeler = await kayitIlerlemeleri({ subeId, studentId: id });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/koordinator/ogrenciler/${ogrenci.id}`}
          className={geriBaglantiStili}
        >
          ← {ogrenci.firstName} {ogrenci.lastName}
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik="Puanlama geçmişi"
            aciklama="Öğrencinin her kaydındaki form ilerlemesi. Günlere ve formlara inmek için kayda tıklayın."
          />
        </div>
      </div>

      {ilerlemeler.length === 0 ? (
        <BosDurum baslik="Kayıt oluşturulduğunda puanlama takibi başlar." />
      ) : (
        <KayitListesi
          ilerlemeler={ilerlemeler}
          temelYol="/koordinator/puanlamalar"
          baslikBicimi="program"
        />
      )}
    </div>
  );
}
