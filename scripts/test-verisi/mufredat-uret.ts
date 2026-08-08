/**
 * Eksik atölye müfredatlarını yazar ve içerik paragraflarını ürettirir.
 *
 *   npx tsx --env-file=.env.local scripts/test-verisi/mufredat-uret.ts
 *
 * NEDEN SERVER ACTION ÇAĞRILMIYOR: `atolyeIcerigiUretEylem` ilk satırında
 * `yonetimZorunlu("mufredat", "TAM")` çağırıyor; o da `auth()` üzerinden
 * istek bağlamındaki oturum çerezini okuyor. Betikte istek bağlamı yok,
 * fonksiyon oturum bulamayıp `redirect("/giris")` fırlatırdı. Bu yüzden
 * eylemin yetki kapısı dışındaki gövdesi burada birebir tekrarlanıyor: aynı
 * `atolyeIcerigiUret` çağrısı, aynı `kilitli` kontrolü, aynı upsert.
 * Üretilen metin arayüzden üretilenle aynı yoldan çıkıyor.
 *
 * Yazılan satırların kimlikleri `manifest.json`a eklenir; `geri-al.ts` siler.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { atolyeIcerigiUret } from "../../src/lib/ai/atolye-icerigi";
import {
  EKSIK_MUFREDATLAR,
  ICERIK_URETILECEK_ATOLYELER,
} from "./mufredat-konulari";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MANIFEST_YOLU = join(import.meta.dirname, "manifest.json");
const HEDEF_DONEM = "cms3yfj170000yuguqr1zc7bl"; // 2026 Sonbahar Dönemi

/** Metni üreten olarak işaretlenecek hesap — izlenebilirlik için. */
const URETEN_KULLANICI = "cmsi2z1k600025bj8yfwm1ks1"; // Fatih İnceer, Ümraniye koordinatörü

type Manifest = {
  mufredatIdleri: string[];
  atolyeIcerikIdleri: string[];
  [k: string]: unknown;
};

function manifestOku(): Manifest {
  if (!existsSync(MANIFEST_YOLU)) {
    return { mufredatIdleri: [], atolyeIcerikIdleri: [] };
  }
  const ham = JSON.parse(readFileSync(MANIFEST_YOLU, "utf8")) as Manifest;
  return {
    ...ham,
    mufredatIdleri: ham.mufredatIdleri ?? [],
    atolyeIcerikIdleri: ham.atolyeIcerikIdleri ?? [],
  };
}

// ---------------------------------------------------------------------------

async function mufredatYaz(manifest: Manifest) {
  console.log("\n[1/2] Eksik müfredatlar yazılıyor...");

  for (const atolye of EKSIK_MUFREDATLAR) {
    let yazilan = 0;

    for (const hafta of atolye.haftalar) {
      // Hafta × atölye başına tek girdi (@@unique); var olanı ezmiyoruz.
      const mevcut = await db.curriculumEntry.findFirst({
        where: {
          termId: HEDEF_DONEM,
          workshopTypeId: atolye.atolyeId,
          weekNumber: hafta.hafta,
        },
        select: { id: true },
      });
      if (mevcut) continue;

      const olusan = await db.curriculumEntry.create({
        data: {
          termId: HEDEF_DONEM,
          workshopTypeId: atolye.atolyeId,
          weekNumber: hafta.hafta,
          title: hafta.baslik,
          description: hafta.aciklama,
        },
        select: { id: true },
      });
      manifest.mufredatIdleri.push(olusan.id);
      yazilan++;
    }

    console.log(`  ${atolye.atolyeAdi}: ${yazilan} hafta yazıldı.`);
  }
}

async function icerikUret(manifest: Manifest) {
  console.log("\n[2/2] Atölye içerik paragrafları üretiliyor...");

  for (const hedef of ICERIK_URETILECEK_ATOLYELER) {
    const mevcut = await db.atolyeIcerigi.findFirst({
      where: { termId: HEDEF_DONEM, workshopTypeId: hedef.id },
      select: { id: true, kilitli: true },
    });

    if (mevcut?.kilitli) {
      console.log(`  ${hedef.ad}: kilitli, atlandı.`);
      continue;
    }
    if (mevcut) {
      console.log(`  ${hedef.ad}: metin zaten var, atlandı.`);
      continue;
    }

    const atolye = await db.workshopType.findUnique({
      where: { id: hedef.id },
      select: {
        name: true,
        description: true,
        questions: {
          where: { active: true, title: { not: null } },
          orderBy: { sortOrder: "asc" },
          select: { title: true },
        },
      },
    });
    if (!atolye) {
      console.log(`  ${hedef.ad}: atölye bulunamadı, atlandı.`);
      continue;
    }

    const haftalar = await db.curriculumEntry.findMany({
      where: { termId: HEDEF_DONEM, workshopTypeId: hedef.id },
      orderBy: { weekNumber: "asc" },
      select: { weekNumber: true, title: true, description: true },
    });

    const sonuc = await atolyeIcerigiUret({
      atolyeAdi: atolye.name,
      atolyeAciklamasi: atolye.description,
      haftalar: haftalar.map((h) => ({
        hafta: h.weekNumber,
        baslik: h.title,
        aciklama: h.description,
      })),
      beceriBasliklari: atolye.questions
        .map((s) => s.title)
        .filter((b): b is string => b !== null && b.trim() !== ""),
    });

    if (sonuc.durum !== "tamam") {
      const sebep =
        sonuc.durum === "hata" ? sonuc.mesaj : sonuc.durum;
      console.log(`  ${hedef.ad}: ÜRETİLEMEDİ — ${sebep}`);
      continue;
    }

    const olusan = await db.atolyeIcerigi.create({
      data: {
        termId: HEDEF_DONEM,
        workshopTypeId: hedef.id,
        metin: sonuc.metin,
        kaynak: "ai",
        uretenUserId: URETEN_KULLANICI,
      },
      select: { id: true },
    });
    manifest.atolyeIcerikIdleri.push(olusan.id);

    console.log(`  ✓ ${hedef.ad}: ${sonuc.metin.length} karakter.`);
  }
}

async function main() {
  const manifest = manifestOku();
  try {
    await mufredatYaz(manifest);
    await icerikUret(manifest);
  } finally {
    writeFileSync(MANIFEST_YOLU, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`\nManifest güncellendi: ${MANIFEST_YOLU}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
