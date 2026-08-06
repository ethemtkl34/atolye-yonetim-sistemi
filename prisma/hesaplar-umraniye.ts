/**
 * Ümraniye kadrosunun gerçek hesapları — TEK SEFERLİK kurulum script'i.
 *
 * Çalıştırma (deploy SONRASI, yerelden, üretim veritabanına):
 *
 *   DATABASE_URL="<üretim adresi>" npx tsx prisma/hesaplar-umraniye.ts
 *
 * seed.ts'e BİLEREK eklenmedi: seed idempotenttir ve her çalışmada rol/şubeyi
 * üzerine yazar — gerçek kişilerin hesabında sonradan yapılan değişiklikleri
 * ezerdi. Bu script yalnızca-create çalışır: e-posta zaten varsa satıra hiç
 * dokunmaz ve "mevcut" diye raporlar.
 *
 * Her kişiye AYRI rastgele geçici parola üretilir ve tablo EKRANA BİR KEZ
 * basılır — parolaları kaydedip kişilere iletin. Bütün hesaplar
 * `mustChangePassword: true` ile açılır; ilk girişte sistem kendi parolasını
 * belirlemeden paneli açmaz.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Role } from "../src/generated/prisma/enums";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Şube kimliği seed/migration ile aynı ve sabit (bkz. seed.ts SUBELER). */
const UMRANIYE = "sube_umraniye";

/**
 * Yetkilendirme matrisindeki kadro. E-postalar Türkçe karakterden
 * arındırılmış ad.soyad biçiminde; 7 kişilik liste için üreteç yerine
 * elle yazıldı.
 */
const KISILER: {
  email: string;
  name: string;
  roles: Role[];
  branchId: string | null;
}[] = [
  {
    email: "akif.atak@tuzder.org",
    name: "Akif Atak",
    roles: ["ADMIN"],
    // Kurum Yöneticisi şubeler üstüdür (CHECK: ADMIN → branchId null);
    // panelde üst şeritten şube seçerek çalışır.
    branchId: null,
  },
  {
    email: "eda.erturk@tuzder.org",
    name: "Eda Ertürk",
    roles: ["ATOLYE_PSIKOLOGU"],
    branchId: UMRANIYE,
  },
  {
    email: "fatih.inceer@tuzder.org",
    name: "Fatih İnceer",
    roles: ["KOORDINATOR"],
    branchId: UMRANIYE,
  },
  {
    email: "gulsah.bulut@tuzder.org",
    name: "Gülşah Bulut",
    roles: ["ATOLYE_PSIKOLOGU", "TEST_UYGULAYICISI"],
    branchId: UMRANIYE,
  },
  {
    email: "firat.gunes@tuzder.org",
    name: "Fırat Güneş",
    roles: ["ATOLYE_PSIKOLOGU", "TEST_UYGULAYICISI"],
    branchId: UMRANIYE,
  },
  {
    email: "rabia.canli@tuzder.org",
    name: "Rabia Canlı",
    roles: ["DANISMA_GOREVLISI"],
    branchId: UMRANIYE,
  },
  {
    email: "firuzan.ozdemir@tuzder.org",
    name: "Firuzan Özdemir",
    roles: ["DANISMA_GOREVLISI"],
    branchId: UMRANIYE,
  },
];

/** Okunur, yazması kolay geçici parola: "atolye-X7KQ2M" biçiminde. */
function geciciParola(): string {
  const govde = randomBytes(4).toString("hex").toUpperCase();
  return `atolye-${govde}`;
}

async function main() {
  const sube = await db.branch.findUnique({
    where: { id: UMRANIYE },
    select: { name: true },
  });
  if (!sube) {
    throw new Error(
      `"${UMRANIYE}" şubesi bulunamadı. Önce migration'lar ve seed çalışmalı.`,
    );
  }

  console.log(`Ümraniye kadrosu açılıyor (${sube.name})...\n`);

  const acilanlar: { name: string; email: string; parola: string }[] = [];

  for (const kisi of KISILER) {
    const mevcut = await db.user.findUnique({
      where: { email: kisi.email },
      select: { id: true },
    });

    if (mevcut) {
      console.log(`· ${kisi.email} zaten mevcut, dokunulmadı.`);
      continue;
    }

    const parola = geciciParola();
    await db.user.create({
      data: {
        email: kisi.email,
        name: kisi.name,
        roles: kisi.roles,
        branchId: kisi.branchId,
        passwordHash: await hash(parola, 12),
        mustChangePassword: true,
      },
    });

    acilanlar.push({ name: kisi.name, email: kisi.email, parola });
    console.log(`✓ ${kisi.name} (${kisi.roles.join(" + ")})`);
  }

  if (acilanlar.length === 0) {
    console.log("\nAçılacak yeni hesap yok; bütün e-postalar zaten kayıtlı.");
    return;
  }

  console.log("\n" + "─".repeat(66));
  console.log("  GEÇİCİ PAROLALAR — bir daha gösterilmeyecek, şimdi kaydedin.");
  console.log("  Her kullanıcı ilk girişte kendi parolasını belirleyecek.\n");
  for (const hesap of acilanlar) {
    console.log(
      `  ${hesap.name.padEnd(18)} ${hesap.email.padEnd(28)} ${hesap.parola}`,
    );
  }
  console.log("─".repeat(66));
}

main()
  .catch((hata) => {
    console.error("Hesaplar açılamadı:", hata);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
