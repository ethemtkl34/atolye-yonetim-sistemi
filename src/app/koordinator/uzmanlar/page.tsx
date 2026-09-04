import type { Metadata } from "next";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { SayfaBasligi } from "@/components/ui";
import { turkceKarsilastir } from "@/lib/turkce";
import { UzmanYonetimi, type UzmanSatiri } from "./uzman-yonetimi";

export const metadata: Metadata = {
  title: "Uzmanlar",
};

/**
 * §17.3 — Uzman kadrosu.
 *
 * Seansı veren kişiler burada tanımlanır: renk, çalışma tipi, çalıştığı
 * şubeler ve yapabildiği hizmetler. Mesai ve izin uzmanın kendi sayfasında
 * (`/koordinator/uzmanlar/[id]`), hizmet kataloğu ayrı ekranda.
 *
 * ŞUBE: uzman ÇOK ŞUBELİ olduğu için bu liste şubeye göre daraltılmıyor —
 * Ümraniye koordinatörü Güneşli'de de çalışan bir uzmanı görmek zorunda,
 * yoksa takvimdeki randevusunu kime ait olduğunu anlayamaz. Kişisel veri
 * değil kadro bilgisi; §17'nin "takvim şubeler arası görünür" kararının
 * doğal uzantısı.
 *
 * YAZMA yetkisi ise şubeye bağlı: Şube Yöneticisi yalnız kendi şubesinin
 * bağını ekleyip kaldırabiliyor (bkz. actions.ts `subeleriSuz`).
 */
export default async function UzmanlarSayfasi() {
  const kullanici = await yonetimZorunlu("uzmanlar");
  const duzenleyebilir = kullanici.yetkiler.uzmanlar === "TAM";

  // şube-muaf: uzman kadrosu şubeler arası görünür (yukarıdaki şerh);
  // `Uzman` kendi `branchId` sütununu taşımıyor, bağ `UzmanSube` üzerinden.
  const [uzmanlar, subeler, hizmetler, hesaplar] = await Promise.all([
    db.uzman.findMany({
      orderBy: [{ aktif: "desc" }, { sortOrder: "asc" }, { ad: "asc" }],
      select: {
        id: true,
        ad: true,
        renk: true,
        calismaTipi: true,
        aktif: true,
        userId: true,
        subeler: { select: { subeId: true, sube: { select: { name: true } } } },
        hizmetler: {
          select: { hizmetId: true, hizmet: { select: { ad: true } } },
        },
        _count: { select: { mesailer: true, izinler: true } },
      },
    }),
    db.branch.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    db.hizmet.findMany({
      where: { aktif: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, ad: true, grup: true },
    }),
    // Hesap bağı için: stajyerler listede yok, panele giren uzman
    // koordinatör/psikolog unvanıyla giriyor.
    // şube-muaf: hesap listesi yalnız bağ kurmak için; kişisel veri
    // taşımıyor ve uzmanın kendisi gibi şubeler arası.
    db.user.findMany({
      where: { active: true, NOT: { roles: { has: "STAJYER" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const satirlar: UzmanSatiri[] = uzmanlar.map((uzman) => ({
    id: uzman.id,
    ad: uzman.ad,
    renk: uzman.renk,
    calismaTipi: uzman.calismaTipi,
    aktif: uzman.aktif,
    userId: uzman.userId,
    subeIdleri: uzman.subeler.map((bag) => bag.subeId),
    subeAdlari: uzman.subeler.map((bag) => bag.sube.name),
    hizmetIdleri: uzman.hizmetler.map((bag) => bag.hizmetId),
    hizmetAdlari: uzman.hizmetler
      .map((bag) => bag.hizmet.ad)
      .sort(turkceKarsilastir),
    mesaiSayisi: uzman._count.mesailer,
    izinSayisi: uzman._count.izinler,
  }));

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Uzmanlar"
        aciklama="Seansı veren kadro: renk, yetkinlik, çalıştığı şubeler. Mesai ve izin uzmanın sayfasında."
      />

      <UzmanYonetimi
        uzmanlar={satirlar}
        subeler={subeler.map((sube) => ({ id: sube.id, ad: sube.name }))}
        hizmetler={hizmetler}
        hesaplar={hesaplar.map((hesap) => ({
          id: hesap.id,
          ad: hesap.name,
          email: hesap.email,
        }))}
        duzenleyebilir={duzenleyebilir}
      />
    </div>
  );
}
