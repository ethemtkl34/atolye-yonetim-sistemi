import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { BosDurum, Kart, SayfaBasligi, butonStili } from "@/components/ui";
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
    // Öğrenci seçilmeden gelindiğinde (örn. Raporlar sayfasındaki "Yeni
    // rapor" düğmesi) akış çıkmaza girmesin: kaydı olan öğrenciler burada
    // listelenir, seçim tek tıktır. Eskiden yalnızca "profile gidin" deniyordu.
    const ogrenciler = await db.student.findMany({
      where: { enrollments: { some: {} } },
      orderBy: { searchName: "asc" },
      take: 200,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        _count: { select: { enrollments: true } },
      },
    });

    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <Link
            href="/koordinator/raporlar"
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            ← Raporlar
          </Link>
          <div className="mt-2">
            <SayfaBasligi
              baslik="Yeni rapor"
              aciklama="Raporu hangi öğrenci için üreteceğinizi seçin. Kapsama girecek kayıtları bir sonraki adımda belirleyeceksiniz."
            />
          </div>
        </div>

        {ogrenciler.length === 0 ? (
          <BosDurum
            baslik="Kaydı olan öğrenci yok."
            aciklama="Rapor üretebilmek için önce bir öğrenciye dönem veya kulüp kaydı oluşturun."
          />
        ) : (
          <Kart className="divide-y divide-yuzey-100">
            {ogrenciler.map((ogrenci) => (
              <Link
                key={ogrenci.id}
                href={`/koordinator/raporlar/yeni?studentId=${ogrenci.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-marka-50"
              >
                <span className="font-medium text-zinc-900">
                  {ogrenci.firstName} {ogrenci.lastName}
                </span>
                <span className="text-xs text-zinc-500">
                  {ogrenci._count.enrollments} kayıt
                </span>
              </Link>
            ))}
          </Kart>
        )}

        <Link href="/koordinator/ogrenciler" className={butonStili("ikincil")}>
          Öğrenci aramak için Öğrenciler sayfasına git
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
