/**
 * Doğrulama: seçilen öğrenciler için rapor üretir, PDF basar ve gövdeyi
 * denetlenebilir biçimde döker.
 *
 *   npx tsx --env-file=.env.local scripts/test-verisi/rapor-dogrula.ts
 *
 * `raporOlustur` Server Action'ı doğrudan çağrılamıyor (yetki kapısı istek
 * bağlamı istiyor), bu yüzden eylemin kullandığı `raporGovdesiV2Uret` aynı
 * argümanlarla çağrılıp `Report` satırı aynı biçimde yazılıyor.
 *
 * Çıktı: her öğrenci için bir PDF ve bir JSON (gövde). JSON, rapordaki her
 * cümlenin kaynağına kadar izlenebilmesi için gerekiyor — PDF'te görünen bir
 * ifadenin gözlem notlarında karşılığı var mı, buradan bakılıyor.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "../../src/lib/db";
import { raporGovdesiV2Uret } from "../../src/lib/rapor-govdesi-verisi";
import { RaporBelgesiV2 } from "../../src/lib/pdf/rapor-belgesi-v2";
import type { RaporGovdesiV2 } from "../../src/lib/rapor-govdesi";

const MANIFEST_YOLU = join(import.meta.dirname, "manifest.json");
const CIKTI_KLASORU = join(import.meta.dirname, "cikti");

const HEDEF_SUBE = "sube_umraniye";
const HEDEF_DONEM = "cms3yfj170000yuguqr1zc7bl";

/** Karşıt profiller: kademelerin üç bandı da çıktıda görünsün. */
const OGRENCILER = ["Ada", "Ömer", "Kerem", "Masal"];

async function main() {
  if (!existsSync(CIKTI_KLASORU)) mkdirSync(CIKTI_KLASORU, { recursive: true });

  const manifest = JSON.parse(readFileSync(MANIFEST_YOLU, "utf8")) as Record<
    string,
    unknown
  > & { raporIdleri?: string[] };
  manifest.raporIdleri ??= [];

  for (const ad of OGRENCILER) {
    const kayit = await db.enrollment.findFirst({
      where: {
        status: "AKTIF",
        student: { firstName: ad, branchId: HEDEF_SUBE },
        group: { branchId: HEDEF_SUBE, termId: HEDEF_DONEM },
      },
      select: { id: true, studentId: true, student: { select: { firstName: true, lastName: true } } },
    });

    if (!kayit) {
      console.log(`${ad}: kayıt bulunamadı, atlandı.`);
      continue;
    }

    const uretimZamani = new Date();
    const govde = await raporGovdesiV2Uret(
      kayit.studentId,
      [kayit.id],
      HEDEF_SUBE,
      new Date(),
    );

    if (!govde) {
      console.log(`${ad}: gövde üretilemedi.`);
      continue;
    }

    const rapor = await db.report.create({
      data: {
        studentId: kayit.studentId,
        generatedAt: uretimZamani,
        bodyJson: govde as unknown as object,
        enrollmentLinks: { create: [{ enrollmentId: kayit.id }] },
      },
      select: { id: true },
    });
    manifest.raporIdleri.push(rapor.id);

    const dosyaAdi = `${kayit.student.firstName}-${kayit.student.lastName}`
      .toLocaleLowerCase("tr-TR")
      .replace(/[^a-zçğıöşü0-9]+/gi, "-");

    writeFileSync(
      join(CIKTI_KLASORU, `${dosyaAdi}.json`),
      JSON.stringify(govde, null, 2) + "\n",
    );

    const belge = await renderToBuffer(
      RaporBelgesiV2({
        govde: govde as unknown as RaporGovdesiV2,
        uretimZamani,
      }),
    );
    writeFileSync(join(CIKTI_KLASORU, `${dosyaAdi}.pdf`), belge);

    const g = govde as RaporGovdesiV2;
    console.log(
      `\n=== ${g.ogrenci.adSoyad} === (metin kaynağı: ${g.metinKaynagi})`,
    );
    console.log(`  atölye içerikleri: ${g.atolyeIcerikleri.length}`);
    console.log(
      `  gelişim: ${g.gelisimAlanlari
        .map((a) => `${a.ad.split(" ")[0]}=${a.bant?.etiket ?? "YOK"}`)
        .join(", ")}`,
    );
    console.log(
      `  atölyeler: ${g.atolyeKademeleri
        .map(
          (a) =>
            `${a.atolyeAdi.replace(" Atölyesi", "")}[ilgi ${a.ilgi?.etiket ?? "YOK"} / başarı ${a.basari?.etiket ?? "YOK"}]`,
        )
        .join(", ")}`,
    );
    console.log(`  asimetri: ${g.asimetriler.length}`);
    console.log(
      `  gözlem bölümü: ${g.gozlem ? `${g.gozlem.bloklar.length} beceri bloğu` : "YOK"}`,
    );
    console.log(`  PDF: ${belge.length} bayt`);
  }

  writeFileSync(MANIFEST_YOLU, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nÇıktılar: ${CIKTI_KLASORU}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
