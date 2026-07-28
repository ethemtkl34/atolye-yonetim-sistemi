import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { BosDurum, SayfaBasligi } from "@/components/ui";
import { raporKapsamSecenekleri } from "@/lib/rapor-verisi";
import { RaporFormu } from "./rapor-formu";

export const metadata: Metadata = {
  title: "Yeni rapor",
};

/** §11.1 — Öğrenci profilinden başlayan rapor üretimi. */
export default async function YeniRaporSayfasi(
  props: PageProps<"/koordinator/raporlar/yeni">,
) {
  await koordinatorZorunlu();

  const parametreler = await props.searchParams;
  const ogrenciId =
    typeof parametreler.studentId === "string"
      ? parametreler.studentId
      : undefined;

  if (!ogrenciId) {
    return (
      <div className="space-y-6">
        <SayfaBasligi
          baslik="Yeni rapor"
          aciklama="Rapor üretmek için önce öğrenciyi seçin."
        />
        <BosDurum
          baslik="Öğrenci seçilmedi."
          aciklama="Öğrenci profilini açıp “Rapor oluştur” düğmesini kullanın."
        />
        <Link
          href="/koordinator/ogrenciler"
          className="inline-flex rounded-md bg-marka-600 px-3 py-2 text-sm font-medium text-white hover:bg-marka-700"
        >
          Öğrencilere git
        </Link>
      </div>
    );
  }

  const [ogrenci, kayitlar] = await Promise.all([
    db.student.findUnique({
      where: { id: ogrenciId },
      select: { id: true, firstName: true, lastName: true },
    }),
    raporKapsamSecenekleri(ogrenciId),
  ]);

  if (!ogrenci) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/koordinator/ogrenciler/${ogrenci.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Öğrenci profili
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={`${ogrenci.firstName} ${ogrenci.lastName} için rapor`}
            aciklama="Rapor, oluşturulduğu andaki puanlarla üretilir. Sonradan puan değişirse rapor “Güncel değil” olarak işaretlenir."
          />
        </div>
      </div>

      {kayitlar.length === 0 ? (
        <BosDurum
          baslik="Bu öğrencinin kaydı yok."
          aciklama="Rapor üretebilmek için önce bir dönem veya kulüp kaydı oluşturun."
        />
      ) : (
        <RaporFormu ogrenciId={ogrenci.id} kayitlar={kayitlar} />
      )}
    </div>
  );
}
