/**
 * Operasyonel veriyi siler — çok şubeli yapıya geçiş için.
 *
 * `npm run db:temizlik` ile çalışır. Kurum iki şubeye çıkarken üretimdeki
 * deneme verisi (öğrenciler, kayıtlar, puanlamalar, raporlar, dönemler,
 * kulüpler) temizlenip sistem şubeleriyle birlikte sıfırdan kurulacak.
 *
 * NEDEN MIGRATION DEĞİL: migration'lar ileri yönlüdür ve `prisma migrate
 * deploy` her ortamda -- preview dağıtımları dahil -- otomatik çalışır.
 * Yıkıcı bir migration bir preview dalı uzaklıkta felakettir. Bu yüzden
 * silme işi bilinçli olarak elle çalıştırılan bu betikte duruyor.
 *
 * KORUNANLAR: `Branch`, `WorkshopType`, `Question` ve `User`. Atölye kataloğu
 * ile 60 değerlendirme sorusu kurumun gerçek verisidir; hesaplar da
 * korunur, şube ataması `seed.ts` ile düzeltilir.
 *
 * SİLME SIRASI RASTGELE DEĞİL. Dört `onDelete: Restrict` bağı var
 * (`ReportPdf→Report`, `Session/TermWorkshop/ClubWorkshop→WorkshopType`),
 * bu yüzden PDF'ler her şeyden önce gidiyor. Cascade'ler çoğunu zaten
 * götürürdü ama her tablo tek tek yazıldı: yıkıcı bir betikte neyin
 * silindiği okunarak görülebilmeli.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ONAY_METNI = "EVET-HEPSINI-SIL";

/** Bağlantı adresinden sunucu adını çıkarır — parolayı sızdırmadan. */
function sunucuAdi(adres: string): string {
  try {
    return new URL(adres).host;
  } catch {
    return "(adres çözümlenemedi)";
  }
}

async function main() {
  const adres = process.env.DATABASE_URL ?? "";

  if (process.env.ONAY !== ONAY_METNI) {
    console.error(
      `\nBu betik BÜTÜN öğrenci, kayıt, puanlama, rapor, dönem ve kulüp` +
        `\nverisini siler. Geri alınamaz.` +
        `\n\nHedef veritabanı: ${sunucuAdi(adres)}` +
        `\n\nGerçekten devam etmek istiyorsanız:\n  ONAY=${ONAY_METNI} npm run db:temizlik\n`,
    );
    process.exit(1);
  }

  console.log(`Hedef veritabanı: ${sunucuAdi(adres)}`);
  console.log("Operasyonel veri siliniyor...\n");

  // Tek transaction: yarım kalmış bir temizlik, silinemeyen PDF yüzünden
  // tutarsız bir veritabanı bırakırdı.
  const sonuc = await db.$transaction(async (tx) => {
    // 1) PDF'ler ilk sırada: Report'a Restrict ile bağlılar.
    const pdf = await tx.reportPdf.deleteMany();
    const raporBagi = await tx.reportEnrollment.deleteMany();
    const rapor = await tx.report.deleteMany();

    // 2) Puanlama zinciri
    const cevap = await tx.scoreAnswer.deleteMany();
    const puan = await tx.score.deleteMany();
    const oturum = await tx.session.deleteMany();

    // 3) Kayıtlar ve öğrenciler
    const kayit = await tx.enrollment.deleteMany();
    await tx.guardian.deleteMany();
    await tx.healthInfo.deleteMany();
    const ogrenci = await tx.student.deleteMany();

    // 4) Gruplar ve programlar
    const grup = await tx.group.deleteMany();
    await tx.termIntern.deleteMany();
    await tx.termWeek.deleteMany();
    await tx.termWorkshop.deleteMany();
    const donem = await tx.term.deleteMany();
    await tx.clubWorkshop.deleteMany();
    const kulup = await tx.club.deleteMany();

    return {
      pdf: pdf.count,
      raporBagi: raporBagi.count,
      rapor: rapor.count,
      cevap: cevap.count,
      puan: puan.count,
      oturum: oturum.count,
      kayit: kayit.count,
      ogrenci: ogrenci.count,
      grup: grup.count,
      donem: donem.count,
      kulup: kulup.count,
    };
  });

  console.log(`  ${sonuc.pdf} PDF · ${sonuc.rapor} rapor (${sonuc.raporBagi} kapsam bağı)`);
  console.log(`  ${sonuc.puan} puanlama · ${sonuc.cevap} cevap satırı · ${sonuc.oturum} oturum`);
  console.log(`  ${sonuc.kayit} kayıt · ${sonuc.ogrenci} öğrenci`);
  console.log(`  ${sonuc.grup} grup · ${sonuc.donem} dönem · ${sonuc.kulup} kulüp`);

  const [atolye, soru, hesap, sube] = await Promise.all([
    db.workshopType.count(),
    db.question.count(),
    db.user.count(),
    db.branch.count(),
  ]);

  console.log(
    `\n✓ Temizlik tamam. Korunanlar: ${sube} şube · ${atolye} atölye çeşidi · ` +
      `${soru} soru · ${hesap} hesap`,
  );
  console.log("\nSıradaki adım: npm run db:seed (şube ve hesapları düzeltir)\n");
}

main()
  .catch((hata) => {
    console.error("\nTemizlik başarısız:", hata);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
