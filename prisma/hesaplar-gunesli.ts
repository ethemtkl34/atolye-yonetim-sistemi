/**
 * Güneşli kadrosunun gerçek hesapları — TEK SEFERLİK kurulum script'i.
 *
 * Çalıştırma (deploy SONRASI, yerelden, üretim veritabanına):
 *
 *   DATABASE_URL="<üretim adresi>" npx tsx prisma/hesaplar-gunesli.ts
 *
 * DEPLOY ÖNCE OLMALI: kadroda `SUBE_YONETICISI` rolü var ve bu enum değeri
 * veritabanına `20260816090000_sube_yoneticisi` migration'ıyla giriyor.
 * Migration uygulanmadan script çalıştırılırsa Postgres "invalid input value
 * for enum" der.
 *
 * `hesaplar-umraniye.ts` emsali: seed.ts'e BİLEREK eklenmedi. Seed idempotenttir
 * ve her çalışmada rol/şubeyi üzerine yazar — gerçek kişilerin hesabında
 * sonradan yapılan değişiklikleri ezerdi. Bu script yalnızca-create çalışır:
 * e-posta zaten varsa satıra hiç dokunmaz ve "mevcut" diye raporlar.
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
const GUNESLI = "sube_gunesli";

/**
 * Güneşli yetkilendirme matrisindeki kadro. E-postalar Türkçe karakterden
 * arındırılmış ad.soyad biçiminde (Ümraniye ile aynı düzen); iki adlı
 * kişilerde adlar bitişik yazıldı ("Ömer Faruk" → `omerfaruk`).
 *
 * Tunahan Coşkun listede Güneşli başlığı altında ama ŞUBESİZ: "iki kurumu da
 * görebilir" isteği sistemde Kurum Yöneticisi demek — o rol tanım gereği
 * şubeler üstüdür (CHECK: ADMIN → branchId null) ve panelde üst şeritten şube
 * seçerek çalışır.
 *
 * Ömer Faruk ve Mustafa şube yöneticisi: kendi şubelerinde koordinatörün
 * bütün yetkileri + Güneşli kadrosunun hesap yönetimi; Ümraniye'yi görmezler.
 */
const KISILER: {
  email: string;
  name: string;
  roles: Role[];
  branchId: string | null;
}[] = [
  {
    email: "tunahan.coskun@tuzder.org",
    name: "Tunahan Coşkun",
    roles: ["ADMIN"],
    branchId: null,
  },
  {
    email: "omerfaruk.sekeroglu@tuzder.org",
    name: "Ömer Faruk Şekeroğlu",
    roles: ["SUBE_YONETICISI"],
    branchId: GUNESLI,
  },
  {
    email: "mustafa.ugurlu@tuzder.org",
    name: "Mustafa Uğurlu",
    roles: ["SUBE_YONETICISI"],
    branchId: GUNESLI,
  },
  {
    email: "gamzenur.erden@tuzder.org",
    name: "Gamze Nur Erden",
    roles: ["KOORDINATOR"],
    branchId: GUNESLI,
  },
  {
    email: "yeliz.genc@tuzder.org",
    name: "Yeliz Genç",
    roles: ["TEST_UYGULAYICISI"],
    branchId: GUNESLI,
  },
  {
    email: "yasemin.bulut@tuzder.org",
    name: "Yasemin Bulut",
    roles: ["TEST_UYGULAYICISI"],
    branchId: GUNESLI,
  },
  {
    email: "yaren.yasar@tuzder.org",
    name: "Yaren Yaşar",
    roles: ["ATOLYE_PSIKOLOGU"],
    branchId: GUNESLI,
  },
  {
    email: "berrin.geyik@tuzder.org",
    name: "Berrin Geyik",
    roles: ["DANISMA_GOREVLISI"],
    branchId: GUNESLI,
  },
  {
    email: "yildiz.kara@tuzder.org",
    name: "Yıldız Kara",
    roles: ["DANISMA_GOREVLISI"],
    branchId: GUNESLI,
  },
];

/** Okunur, yazması kolay geçici parola: "atolye-X7KQ2M" biçiminde. */
function geciciParola(): string {
  const govde = randomBytes(4).toString("hex").toUpperCase();
  return `atolye-${govde}`;
}

async function main() {
  const sube = await db.branch.findUnique({
    where: { id: GUNESLI },
    select: { name: true },
  });
  if (!sube) {
    throw new Error(
      `"${GUNESLI}" şubesi bulunamadı. Önce migration'lar ve seed çalışmalı.`,
    );
  }

  console.log(`Güneşli kadrosu açılıyor (${sube.name})...\n`);

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

  console.log("\n" + "─".repeat(70));
  console.log("  GEÇİCİ PAROLALAR — bir daha gösterilmeyecek, şimdi kaydedin.");
  console.log("  Her kullanıcı ilk girişte kendi parolasını belirleyecek.\n");
  for (const hesap of acilanlar) {
    console.log(
      `  ${hesap.name.padEnd(22)} ${hesap.email.padEnd(32)} ${hesap.parola}`,
    );
  }
  console.log("─".repeat(70));
}

main()
  .catch((hata) => {
    console.error("Hesaplar açılamadı:", hata);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
