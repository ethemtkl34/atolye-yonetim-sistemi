/**
 * Zetzeka ürün kataloğunu `OneriUrunu` tablosuna aktarır.
 *
 *   npx tsx prisma/oneri-urunleri-tohum.ts <katalog.json>
 *
 * Katalog zetzeka.com'un açık WooCommerce Store API'sinden çıkarıldı; her
 * satırda ürünün sitedeki adı, adresi, kategorileri ve tanıtım metni var.
 * Buradaki iş, o ham veriyi rapor motorunun kullanabileceği iki şeye
 * çevirmek: yaş aralığı ve beceri etiketleri.
 *
 * YAŞ: ürün ADINDAKİ değer esas alınır. Katalogda yaş üç ayrı yerde yazıyor
 * (ad, sayfa içi "Yaş Aralığı", kategori adı) ve bunlar çelişebiliyor —
 * ŞAKULİ adında "3+", sayfasında "4-99" diyor. Veli ürün adını göreceği için
 * addaki değer tek doğru kaynak sayıldı.
 *
 * BECERİ: sitenin kendi "Gelişim Alanları" listesi kullanılamıyor, çünkü
 * "Sosyal-Duygusal Gelişim" ifadesi 23 oyunun 20'sinde aynı kalıp metin
 * olarak geçiyor — oyunun çok oyunculu olmasından geliyor, gerçekten
 * duygusal beceri hedeflediğinden değil. Bu yüzden etiketler ürün ailesine
 * göre elle verildi ve eşleşmeyen ürünler kataloğa HİÇ alınmadı: etiketsiz
 * bir ürün öneri motoruna girerse yanlış çocuğa önerilir.
 */

import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Prisma 7'de bağlantı driver adapter üzerinden kurulur (bkz. src/lib/db.ts).
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type HamUrun = {
  name: string;
  url: string;
  cats: string[];
  short: string;
  desc: string;
};

type Etiketleme = {
  alanlar: string[];
  beceriler: string[];
  kategori: string;
  /** Atölye adı — ürün bir atölyede birebir kullanılıyorsa. */
  atolye?: string;
};

/**
 * IQ-Dikkat kitap serileri. Seri adı ürün adının başında geçer ve her yaş
 * bandı için ayrı ürün vardır; etiketler seri boyunca sabittir.
 */
const SERILER: Record<string, string[]> = {
  FIND: ["odaklanma"],
  CUBE: ["odaklanma", "akil-yurutme"],
  DOT: ["ince-motor", "odaklanma"],
  PAINT: ["ince-motor", "odaklanma"],
  DRAW: ["ince-motor", "oz-guven"],
  SOLVE: ["problem-cozme", "akil-yurutme"],
  THINK: ["sira-disi-dusunme", "problem-cozme", "akil-yurutme"],
  COORDINATE: ["akil-yurutme", "odaklanma"],
  ALGORITHM: ["stratejik-dusunme", "akil-yurutme", "problem-cozme"],
  LISTEN: ["isitsel-dikkat", "odaklanma"],
  MIND: ["akil-yurutme", "problem-cozme"],
  MATRIX: ["akil-yurutme", "problem-cozme"],
  CALCULATE: ["akil-yurutme", "problem-cozme", "islemleme-hizi"],
  ARCHITECT: ["sira-disi-dusunme", "odaklanma"],
};

/**
 * Ada göre elle etiketlenen ürünler. Anahtar, ürün adında aranan bir parça.
 *
 * Sıra önemli: ilk tutan kazanır, bu yüzden özel adlar (GO, REVERSİ) genel
 * kalıplardan önce gelir.
 */
const ELLE: [string, Etiketleme][] = [
  // --- Duygusal ve sosyal: katalogdaki TEK gerçek aile ---
  ["Duygularım Kitabı", { alanlar: ["DUYGUSAL", "SOSYAL"], beceriler: ["duygu-yonetimi", "empati", "oz-guven"], kategori: "kitap" }],
  ["Düşüncelerim Kitabı", { alanlar: ["DUYGUSAL", "BILISSEL"], beceriler: ["duygu-yonetimi", "problem-cozme"], kategori: "kitap" }],
  ["Davranışlarım Kitabı", { alanlar: ["SOSYAL", "DUYGUSAL"], beceriler: ["sorumluluk", "iletisim"], kategori: "kitap" }],
  ["Duygusal ve Sosyal Becerileri Geliştiren", { alanlar: ["DUYGUSAL", "SOSYAL"], beceriler: ["duygu-yonetimi", "empati", "oz-guven", "sorumluluk"], kategori: "set" }],
  ["PİNGU", { alanlar: ["DUYGUSAL", "SOSYAL"], beceriler: ["duygu-yonetimi", "sorumluluk", "oz-guven"], kategori: "kitap" }],

  // --- Atölyede birebir oynanan oyunlar: en güçlü öneri tipi ---
  ["Torappu", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["stratejik-dusunme", "akil-yurutme", "odaklanma"], kategori: "oyun", atolye: "Zekâ ve Akıl Oyunları Atölyesi" }],
  ["REVERSİ", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["stratejik-dusunme", "akil-yurutme", "odaklanma"], kategori: "oyun", atolye: "Zekâ ve Akıl Oyunları Atölyesi" }],
  ["GO Ahşap", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["stratejik-dusunme", "akil-yurutme", "odaklanma"], kategori: "oyun", atolye: "Zekâ ve Akıl Oyunları Atölyesi" }],
  ["GO Strateji", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["stratejik-dusunme", "akil-yurutme", "odaklanma"], kategori: "oyun", atolye: "Zekâ ve Akıl Oyunları Atölyesi" }],

  // --- Diğer strateji oyunları ---
  ["SURAKARTA", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["stratejik-dusunme", "akil-yurutme"], kategori: "oyun" }],
  ["9 Taş", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["stratejik-dusunme", "akil-yurutme"], kategori: "oyun" }],
  ["Sayıların Savaşı", { alanlar: ["BILISSEL"], beceriler: ["akil-yurutme", "stratejik-dusunme"], kategori: "oyun" }],
  ["Kelime Hazinesi", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["iletisim", "stratejik-dusunme"], kategori: "oyun" }],
  ["Resfebe", { alanlar: ["BILISSEL"], beceriler: ["islemleme-hizi", "akil-yurutme"], kategori: "oyun" }],
  ["THE ROAD GAME", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["is-birligi", "stratejik-dusunme", "problem-cozme"], kategori: "oyun" }],
  ["İSTİF", { alanlar: ["BILISSEL"], beceriler: ["stratejik-dusunme", "ince-motor", "odaklanma"], kategori: "oyun" }],
  ["VIZ VIZ", { alanlar: ["BILISSEL"], beceriler: ["odaklanma", "islemleme-hizi"], kategori: "oyun" }],
  ["ŞAKULİ", { alanlar: ["BILISSEL"], beceriler: ["odaklanma", "problem-cozme"], kategori: "oyun" }],
  ["ŞEKLİNİ BUL", { alanlar: ["BILISSEL"], beceriler: ["odaklanma", "problem-cozme"], kategori: "oyun" }],
  ["TANGRAM", { alanlar: ["BILISSEL"], beceriler: ["sira-disi-dusunme", "odaklanma", "akil-yurutme"], kategori: "oyun" }],

  // --- Denge ve blok setleri ---
  ["Balance Tower", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "odaklanma", "stratejik-dusunme"], kategori: "oyun" }],
  ["DENGE OYUNU", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["ince-motor", "odaklanma", "is-birligi"], kategori: "oyun" }],
  ["ÇEKUP", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["ince-motor", "odaklanma", "is-birligi"], kategori: "oyun" }],
  ["ATTENTION BLOCKS", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "odaklanma", "sira-disi-dusunme"], kategori: "materyal" }],
  ["Designer Blocks", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "sira-disi-dusunme", "odaklanma"], kategori: "materyal" }],

  // --- Kodlama, robotik, STEM ---
  ["ASTROCODE", { alanlar: ["BILISSEL"], beceriler: ["problem-cozme", "akil-yurutme", "stratejik-dusunme"], kategori: "oyun", atolye: "Robotik ve Kodlama Atölyesi" }],
  ["SMART CODE", { alanlar: ["BILISSEL", "SOSYAL"], beceriler: ["problem-cozme", "stratejik-dusunme", "islemleme-hizi"], kategori: "oyun", atolye: "Robotik ve Kodlama Atölyesi" }],
  ["ROBOTAMI", { alanlar: ["BILISSEL"], beceriler: ["problem-cozme", "ince-motor", "akil-yurutme"], kategori: "set", atolye: "Robotik ve Kodlama Atölyesi" }],
  ["STEAM – MAKER", { alanlar: ["BILISSEL"], beceriler: ["problem-cozme", "ince-motor", "sira-disi-dusunme"], kategori: "set", atolye: "STEM Maker Atölyesi" }],
  ["Funny Electronic Kit", { alanlar: ["BILISSEL"], beceriler: ["problem-cozme", "ince-motor"], kategori: "set", atolye: "Bilim Atölyesi" }],
  ["Electronic Bricks Kit", { alanlar: ["BILISSEL"], beceriler: ["problem-cozme", "ince-motor"], kategori: "set", atolye: "Bilim Atölyesi" }],
  ["EDUCATIONAL KIT", { alanlar: ["BILISSEL"], beceriler: ["problem-cozme", "ince-motor", "akil-yurutme"], kategori: "set", atolye: "Bilim Atölyesi" }],

  // --- El becerileri ---
  ["CUTTING Art Craft", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "odaklanma"], kategori: "kitap", atolye: "Hayal Tasarım Atölyesi" }],
  ["ORIGAMI Art Craft", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "odaklanma", "sira-disi-dusunme"], kategori: "kitap", atolye: "Hayal Tasarım Atölyesi" }],
  ["KIRIGAMI Art Craft", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "odaklanma", "sira-disi-dusunme"], kategori: "kitap", atolye: "Hayal Tasarım Atölyesi" }],
  ["AYATORI Art Craft", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "akil-yurutme"], kategori: "kitap" }],
  ["QUILLING Art Craft", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "odaklanma", "sira-disi-dusunme"], kategori: "kitap", atolye: "Hayal Tasarım Atölyesi" }],
  ["ART CRAFT-El Becerileri Seti", { alanlar: ["BILISSEL", "DUYGUSAL"], beceriler: ["ince-motor", "sira-disi-dusunme", "oz-guven"], kategori: "set", atolye: "Hayal Tasarım Atölyesi" }],
  ["Taş Boyama", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "odaklanma", "sira-disi-dusunme"], kategori: "set", atolye: "Hayal Tasarım Atölyesi" }],
  ["Alçı Boyama", { alanlar: ["BILISSEL"], beceriler: ["ince-motor", "odaklanma"], kategori: "set", atolye: "Hayal Tasarım Atölyesi" }],
];

/**
 * Ürün adından yaş aralığını çıkarır.
 *
 * Üç kalıp var: "4-7 Yaş" (kapalı aralık), "5+ Yaş" (alt sınır), "3-4+ Yaş"
 * (alt sınır aralığı — üst sınır yok). Üst sınırsızlar 99 ile kapatılır;
 * katalogdaki oyun sayfaları da böyle yazıyor ("5-99").
 */
function yasAraligi(ad: string): { min: number; max: number } | null {
  const kapali = ad.match(/(\d+)\s*-\s*(\d+)\s*Yaş/i);
  if (kapali) return { min: Number(kapali[1]), max: Number(kapali[2]) };

  const acikAralik = ad.match(/(\d+)\s*-\s*(\d+)\s*\+\s*Yaş/i);
  if (acikAralik) return { min: Number(acikAralik[1]), max: 99 };

  const alt = ad.match(/(\d+)\s*\+\s*Yaş/i);
  if (alt) return { min: Number(alt[1]), max: 99 };

  return null;
}

function etiketle(urun: HamUrun): Etiketleme | null {
  for (const [parca, etiketleme] of ELLE) {
    if (urun.name.includes(parca)) return etiketleme;
  }

  // Seri adı ürün adının başında büyük harflerle geçer.
  for (const [seri, beceriler] of Object.entries(SERILER)) {
    if (new RegExp(`^${seri}\\b`, "i").test(urun.name)) {
      return { alanlar: ["BILISSEL"], beceriler, kategori: "kitap" };
    }
  }

  return null;
}

async function main() {
  const dosya = process.argv[2];
  if (!dosya) throw new Error("Kullanım: tsx oneri-urunleri-tohum.ts <katalog.json>");

  const ham: HamUrun[] = JSON.parse(readFileSync(dosya, "utf8"));

  const atolyeler = await db.workshopType.findMany({ select: { id: true, name: true } });
  const atolyeHaritasi = new Map(atolyeler.map((a) => [a.name, a.id]));

  let yazilan = 0;
  const atlanan: string[] = [];

  for (const urun of ham) {
    const etiketleme = etiketle(urun);
    const yas = yasAraligi(urun.name);

    // Etiketi ya da yaşı olmayan ürün öneri havuzuna girmez: hangi çocuğa
    // uyduğu bilinmeyen bir ürünü veliye önermek, hiç önermemekten kötüdür.
    if (!etiketleme || !yas) {
      atlanan.push(urun.name);
      continue;
    }

    const atolyeId = etiketleme.atolye
      ? (atolyeHaritasi.get(etiketleme.atolye) ?? null)
      : null;

    const veri = {
      ad: urun.name,
      url: urun.url,
      kategori: etiketleme.kategori,
      yasMin: yas.min,
      yasMax: yas.max,
      alanlar: etiketleme.alanlar,
      beceriler: etiketleme.beceriler,
      aciklama: urun.desc ? urun.desc.slice(0, 400) : null,
      workshopTypeId: atolyeId,
      active: true,
    };

    const mevcut = await db.oneriUrunu.findFirst({ where: { url: urun.url } });
    if (mevcut) {
      await db.oneriUrunu.update({ where: { id: mevcut.id }, data: veri });
    } else {
      await db.oneriUrunu.create({ data: veri });
    }
    yazilan += 1;
  }

  console.log(`Yazılan ürün: ${yazilan}`);
  console.log(`Atlanan (etiket veya yaş yok): ${atlanan.length}`);
  for (const ad of atlanan) console.log(`  - ${ad}`);
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
