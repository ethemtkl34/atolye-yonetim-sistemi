import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { db } from "@/lib/db";
import { kayitAlanProgramlar } from "@/lib/kayit-secenekleri";
import { BosDurum, SayfaBasligi, butonStili, geriBaglantiStili } from "@/components/ui";
import { KayitFormu, type StajyerSecenegi } from "./kayit-formu";

export const metadata: Metadata = {
  title: "Yeni kayıt",
};

/** §7 — Öğrenci profilinden başlayan dönem/kulüp kayıt sihirbazı. */
export default async function YeniKayitSayfasi(
  props: PageProps<"/koordinator/kayitlar/yeni">,
) {
  const kullanici = await yonetimZorunlu("kayitlar", "TAM");
  const subeId = kullanici.aktifSubeId;

  const parametreler = await props.searchParams;
  const studentId =
    typeof parametreler.studentId === "string"
      ? parametreler.studentId
      : undefined;

  if (!studentId) {
    return (
      <div className="space-y-6">
        <SayfaBasligi
          baslik="Yeni kayıt"
          aciklama="Kayıt oluşturmak için önce öğrenciyi seçin."
        />
        <BosDurum
          baslik="Öğrenci seçilmedi."
          aciklama="Öğrenci profilini açıp “Yeni kayıt” düğmesini kullanın."
        />
        <Link
          href="/koordinator/ogrenciler"
          className={butonStili()}
        >
          Öğrencilere git
        </Link>
      </div>
    );
  }

  const [ogrenci, programlar, stajyerler] = await Promise.all([
    db.student.findFirst({
      where: { id: studentId, branchId: subeId },
      select: { id: true, firstName: true, lastName: true },
    }),
    kayitAlanProgramlar(subeId),
    db.user.findMany({
      where: { roles: { has: "STAJYER" }, active: true, branchId: subeId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            assignedEnrollments: { where: { status: "AKTIF" } },
          },
        },
      },
    }),
  ]);

  if (!ogrenci) notFound();

  const stajyerSecenekleri: StajyerSecenegi[] = stajyerler.map((stajyer) => ({
    id: stajyer.id,
    ad: stajyer.name,
    aktifOgrenciSayisi: stajyer._count.assignedEnrollments,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/koordinator/ogrenciler/${ogrenci.id}`}
          className={geriBaglantiStili}
        >
          ← Öğrenci profili
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik="Yeni kayıt"
            aciklama="Kayıt seçilen gruba bağlıdır; sorumlu stajyer isteğe bağlıdır ve sonradan atanabilir. Kontenjan işlem sırasında sunucuda yeniden kontrol edilir."
          />
        </div>
      </div>

      <KayitFormu
        ogrenci={{
          id: ogrenci.id,
          ad: `${ogrenci.firstName} ${ogrenci.lastName}`,
        }}
        programlar={programlar}
        stajyerler={stajyerSecenekleri}
      />
    </div>
  );
}
