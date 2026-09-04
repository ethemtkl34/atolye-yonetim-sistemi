import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { HizmetYonetimi, type HizmetSatiri } from "./hizmet-yonetimi";

export const metadata: Metadata = {
  title: "Hizmet kataloğu",
};

/**
 * §17.2 — Hizmet kataloğu: süre, ücret ve yaş aralığı.
 *
 * Katalog ŞUBEDEN BAĞIMSIZ — fiyat listesi kurumun tamamı için tek. Bu yüzden
 * ekranda üst şeritteki şube seçimi hiçbir şeyi daraltmaz; yapılan değişiklik
 * iki şubeyi birden etkiler ve sayfa bunu üst bilgide söyler (atölye
 * kataloğuyla aynı sözleşme).
 */
export default async function HizmetlerSayfasi() {
  const kullanici = await yonetimZorunlu("uzmanlar");
  const duzenleyebilir = kullanici.yetkiler.uzmanlar === "TAM";

  const hizmetler = await db.hizmet.findMany({
    orderBy: [{ aktif: "desc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      ad: true,
      grup: true,
      sureDk: true,
      ucretKurus: true,
      yasAlt: true,
      yasUst: true,
      danisanTuru: true,
      tekrarli: true,
      aktif: true,
      _count: { select: { uzmanlar: true } },
    },
  });

  const satirlar: HizmetSatiri[] = hizmetler.map((hizmet) => ({
    id: hizmet.id,
    ad: hizmet.ad,
    grup: hizmet.grup,
    sureDk: hizmet.sureDk,
    ucretKurus: hizmet.ucretKurus,
    yasAlt: hizmet.yasAlt,
    yasUst: hizmet.yasUst,
    danisanTuru: hizmet.danisanTuru,
    tekrarli: hizmet.tekrarli,
    aktif: hizmet.aktif,
    uzmanSayisi: hizmet._count.uzmanlar,
  }));

  return (
    <div className="space-y-6">
      <Link href="/koordinator/uzmanlar" className={geriBaglantiStili}>
        Uzmanlar
      </Link>

      <SayfaBasligi
        ustBilgi="Bütün şubeler için ortak"
        baslik="Hizmet kataloğu"
        aciklama="Randevuda seçilebilecek hizmetler, süreleri ve ücretleri. Fiyat değişikliği yalnız yeni randevuları etkiler."
      />

      <HizmetYonetimi hizmetler={satirlar} duzenleyebilir={duzenleyebilir} />
    </div>
  );
}
