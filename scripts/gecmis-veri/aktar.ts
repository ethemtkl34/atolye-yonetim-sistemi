/**
 * Geçmiş veri aktarımı — 2. aşama: hazırlanmış paketi veritabanına yazar.
 *
 *   npx tsx --env-file=.env.local scripts/gecmis-veri/aktar.ts
 *   DATABASE_URL="<üretim>" npx tsx scripts/gecmis-veri/aktar.ts
 *
 * Girdi `cikti/gecmis-veri.json` — `hazirla.py` üretir ve DB'ye dokunmaz;
 * neyin yazılacağı çalıştırmadan önce okunabilsin diye araya konuldu.
 *
 * Yazdığı her satırın kimliği `cikti/manifest.json`'a düşer; `geri-al.ts`
 * yalnızca o listeye dokunur. `scripts/test-verisi/` ile aynı sözleşme.
 *
 * IDEMPOTANLIK: betik iki kez koşarsa ikinci koşu hiçbir şey eklemez.
 *  - Öğrenci: aynı şube + `searchName` + doğum tarihi varsa yeniden kullanılır.
 *  - Kayıt: `@@unique([studentId, groupId])` zaten engelliyor, `skipDuplicates`.
 *  - Rapor: `LegacyReport.sourcePath` benzersiz; var olan dosya atlanır.
 *
 * Aktarılan dönem ve kulüpler `gecmisVerisi: true` yazılır — puanlaması ve
 * müfredatı olmadığı için sistem bunlar için RAPOR ÜRETEMEZ. Geçmişin kanıtı
 * arşivdeki PDF'in kendisi.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import type { TimeSlot } from "../../src/generated/prisma/enums";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CIKTI = join(import.meta.dirname, "cikti");
const VERI_YOLU = join(CIKTI, "gecmis-veri.json");
const MANIFEST_YOLU = join(CIKTI, "manifest.json");

type Veli = {
  type: "ANNE" | "BABA";
  fullName: string;
  phone: string | null;
  searchPhone: string | null;
};

type Ogrenci = {
  anahtar: string;
  searchName: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  school: string | null;
  grade: string | null;
  branchCode: string;
  guardians: Veli[];
  yalnizPdf?: boolean;
};

type Kayit = {
  ogrenciAnahtari: string;
  programAdi: string;
  programTuru: "donem" | "kulup";
  grupAdi: string;
  timeSlot: TimeSlot;
  status: "AKTIF" | "IPTAL";
  rapordanTuretildi?: boolean;
};

type Rapor = {
  ogrenciAnahtari: string;
  programAdi: string;
  termLabel: string;
  groupLabel: string | null;
  reportDate: string;
  sourcePath: string;
  mutlakYol: string;
  fileName: string;
  fileSize: number;
};

type Paket = {
  uretim: { excel: string; pdfKok: string; ustBlokSube: string; altBlokSube: string };
  donemler: { name: string; egitimYili: string }[];
  kulupler: { name: string }[];
  ogrenciler: Ogrenci[];
  kayitlar: Kayit[];
  raporlar: Rapor[];
};

type Manifest = {
  olusturmaZamani: string;
  termIdleri: string[];
  clubIdleri: string[];
  groupIdleri: string[];
  studentIdleri: string[];
  enrollmentIdleri: string[];
  legacyReportIdleri: string[];
};

/**
 * Kulüplerin gerçek takvimi Excel'de yok; `Club.date` ve `weekDates` zorunlu
 * olduğu için eğitim yılının başındaki bir cumartesi yer tutucu olarak
 * yazılıyor. Kulüp arşivlendiği ve rapor üretimine kapalı olduğu için bu
 * tarih hiçbir hesaba girmiyor.
 */
const KULUP_YER_TUTUCU_TARIH = new Date("2025-10-04T00:00:00.000Z");

/**
 * Aktarılan öğrencinin `notes` alanına düşen damga.
 *
 * Yarım kalmış bir koşu tamamlanırken "bu satırı ben mi yazdım?" sorusunun
 * cevabı buradan okunuyor: damgalı öğrenci bizim, damgasız öğrenci paneldeki
 * gerçek bir kayıt olabilir ve geri alma listesine ASLA girmemeli.
 */
const AKTARIM_DAMGASI = "Geçmişten aktarıldı";

function gun(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Defteri diske yazar. Aşama aşama çağrılıyor: 133 MB'lık PDF yazımı uzun
 * sürüyor ve koşu yarıda kesilirse (ağ, zaman aşımı) o ana kadar yazılmış
 * satırların kimliği elde kalmalı — yoksa geri alınamaz veri oluşur.
 */
function manifestiYaz(manifest: Manifest): void {
  writeFileSync(
    MANIFEST_YOLU,
    `${JSON.stringify(manifestiBirlestir(manifest), null, 1)}\n`,
    "utf8",
  );
}

/** Var olan manifestle birleştirir; kimlikler tekilleştirilir. */
function manifestiBirlestir(yeni: Manifest): Manifest {
  if (!existsSync(MANIFEST_YOLU)) return yeni;

  const eski = JSON.parse(readFileSync(MANIFEST_YOLU, "utf8")) as Manifest;
  const birlestir = (a: string[] = [], b: string[] = []) => [
    ...new Set([...a, ...b]),
  ];

  return {
    // İlk aktarımın zamanı korunur: geri alma "ne zaman yazıldı" diye
    // bakarken son (etkisiz) koşunun saatini görmesin.
    olusturmaZamani: eski.olusturmaZamani ?? yeni.olusturmaZamani,
    termIdleri: birlestir(eski.termIdleri, yeni.termIdleri),
    clubIdleri: birlestir(eski.clubIdleri, yeni.clubIdleri),
    groupIdleri: birlestir(eski.groupIdleri, yeni.groupIdleri),
    studentIdleri: birlestir(eski.studentIdleri, yeni.studentIdleri),
    enrollmentIdleri: birlestir(eski.enrollmentIdleri, yeni.enrollmentIdleri),
    legacyReportIdleri: birlestir(
      eski.legacyReportIdleri,
      yeni.legacyReportIdleri,
    ),
  };
}

async function main() {
  const paket = JSON.parse(readFileSync(VERI_YOLU, "utf8")) as Paket;

  /**
   * Gerçekten OLUŞTURULAN satırlar. Manifest'in uzunluğu bu sayıyı vermez:
   * yarım kalmış koşu tamamlanırken var olan satırlar da deftere işleniyor,
   * dolayısıyla hiçbir şey yazmayan ikinci bir koşu bile dolu bir manifest
   * üretir. Kullanıcıya "429 yeni" demek yanlış olurdu.
   */
  const olusan = {
    donem: 0,
    kulup: 0,
    grup: 0,
    ogrenci: 0,
    kayit: 0,
    rapor: 0,
  };

  const manifest: Manifest = {
    olusturmaZamani: new Date().toISOString(),
    termIdleri: [],
    clubIdleri: [],
    groupIdleri: [],
    studentIdleri: [],
    enrollmentIdleri: [],
    legacyReportIdleri: [],
  };

  // --- Şubeler -------------------------------------------------------------
  const subeKodlari = [...new Set(paket.ogrenciler.map((o) => o.branchCode))];
  const subeler = await db.branch.findMany({
    where: { code: { in: subeKodlari } },
    select: { id: true, code: true },
  });
  const subeId = new Map(subeler.map((s) => [s.code, s.id]));
  for (const kod of subeKodlari) {
    if (!subeId.has(kod)) throw new Error(`Şube bulunamadı: ${kod}`);
  }

  // --- Dönemler ------------------------------------------------------------
  const donemId = new Map<string, string>();
  for (const donem of paket.donemler) {
    const mevcut = await db.term.findFirst({
      where: { name: donem.name, gecmisVerisi: true },
      select: { id: true },
    });
    if (mevcut) {
      // Yarım kalmış koşudan kalma: `gecmisVerisi` işaretli dönem yalnızca bu
      // betikten çıkabilir, dolayısıyla bizimdir ve deftere geri işlenir.
      donemId.set(donem.name, mevcut.id);
      manifest.termIdleri.push(mevcut.id);
      continue;
    }
    const yeniDonem = await db.term.create({
      data: {
        name: donem.name,
        egitimYili: donem.egitimYili,
        status: "ARSIVLENDI",
        dayMode: "HAFTA_SONU",
        gecmisVerisi: true,
        description:
          "Panel açılmadan önce yaşanmış dönem; kayıtlar Excel kütüğünden, " +
          "raporlar PDF arşivinden aktarıldı. Puanlaması ve müfredatı yoktur.",
      },
      select: { id: true },
    });
    donemId.set(donem.name, yeniDonem.id);
    manifest.termIdleri.push(yeniDonem.id);
    olusan.donem += 1;
  }

  // --- Kulüpler ------------------------------------------------------------
  const kulupId = new Map<string, string>();
  for (const kulup of paket.kulupler) {
    const mevcut = await db.club.findFirst({
      where: { name: kulup.name, gecmisVerisi: true },
      select: { id: true },
    });
    if (mevcut) {
      kulupId.set(kulup.name, mevcut.id);
      manifest.clubIdleri.push(mevcut.id);
      continue;
    }
    const yeniKulup = await db.club.create({
      data: {
        name: kulup.name,
        date: KULUP_YER_TUTUCU_TARIH,
        weekDates: [KULUP_YER_TUTUCU_TARIH],
        status: "ARSIVLENDI",
        gecmisVerisi: true,
        description:
          "Geçmişten aktarılan kulüp. Toplanma takvimi kütükte olmadığı için " +
          "tarih yer tutucudur.",
      },
      select: { id: true },
    });
    kulupId.set(kulup.name, yeniKulup.id);
    manifest.clubIdleri.push(yeniKulup.id);
    olusan.kulup += 1;
  }

  // --- Gruplar -------------------------------------------------------------
  // Grup anahtarı: program + grup adı + zaman dilimi + şube.
  // Gün ayrımı yapılmıyor (karar): hepsi cumartesi.
  const grupKontenjani = new Map<string, number>();
  for (const kayit of paket.kayitlar) {
    const ogrenci = paket.ogrenciler.find((o) => o.anahtar === kayit.ogrenciAnahtari)!;
    const anahtar = `${kayit.programAdi}|${kayit.grupAdi}|${kayit.timeSlot}|${ogrenci.branchCode}`;
    grupKontenjani.set(anahtar, (grupKontenjani.get(anahtar) ?? 0) + 1);
  }

  const grupId = new Map<string, string>();
  for (const [anahtar, adet] of grupKontenjani) {
    const [program, grupAdi, dilim, subeKodu] = anahtar.split("|");
    const donem = donemId.get(program);
    const kulup = kulupId.get(program);
    const kapsam = donem ? { termId: donem } : { clubId: kulup! };

    const mevcut = await db.group.findFirst({
      where: {
        ...kapsam,
        name: grupAdi,
        timeSlot: dilim as TimeSlot,
        branchId: subeId.get(subeKodu)!,
      },
      select: { id: true },
    });
    if (mevcut) {
      // Grubun bağlı olduğu dönem/kulüp bizim olduğu için grup da bizim.
      grupId.set(anahtar, mevcut.id);
      manifest.groupIdleri.push(mevcut.id);
      continue;
    }
    const yeniGrup = await db.group.create({
      data: {
        ...kapsam,
        name: grupAdi,
        branchId: subeId.get(subeKodu)!,
        days: ["CUMARTESI"],
        timeSlot: dilim as TimeSlot,
        capacity: adet,
        // Geçmiş grup yeni kayıt almasın.
        active: false,
      },
      select: { id: true },
    });
    grupId.set(anahtar, yeniGrup.id);
    manifest.groupIdleri.push(yeniGrup.id);
    olusan.grup += 1;
  }

  // Program iskeleti bitti; defteri şimdiden diske al.
  manifestiYaz(manifest);

  // --- Öğrenciler ve veliler ----------------------------------------------
  const ogrenciId = new Map<string, string>();
  for (const ogrenci of paket.ogrenciler) {
    const sube = subeId.get(ogrenci.branchCode)!;
    const mevcut = await db.student.findFirst({
      where: {
        branchId: sube,
        searchName: ogrenci.searchName,
        birthDate: ogrenci.birthDate ? gun(ogrenci.birthDate) : null,
      },
      select: { id: true, notes: true },
    });
    if (mevcut) {
      ogrenciId.set(ogrenci.anahtar, mevcut.id);
      // Deftere YALNIZCA aktarım damgalı öğrenci girer. Damgasız bir eşleşme
      // paneldeki gerçek bir çocuk olabilir (aynı ad, aynı doğum tarihi);
      // geri alma onu silmemeli.
      if (mevcut.notes?.startsWith(AKTARIM_DAMGASI)) {
        manifest.studentIdleri.push(mevcut.id);
      }
      continue;
    }
    const yeniOgrenci = await db.student.create({
      data: {
        firstName: ogrenci.firstName,
        lastName: ogrenci.lastName,
        searchName: ogrenci.searchName,
        birthDate: ogrenci.birthDate ? gun(ogrenci.birthDate) : null,
        school: ogrenci.school,
        grade: ogrenci.grade,
        branchId: sube,
        notes: ogrenci.yalnizPdf
          ? `${AKTARIM_DAMGASI} — kütükte kaydı yoktu, arşiv raporunun ` +
            "kapağından oluşturuldu. Veli bilgisi eksik."
          : `${AKTARIM_DAMGASI} (2025-2026 ve öncesi kütük).`,
        guardians: {
          create: ogrenci.guardians.map((veli) => ({
            type: veli.type,
            fullName: veli.fullName,
            phone: veli.phone,
            searchPhone: veli.searchPhone,
          })),
        },
      },
      select: { id: true },
    });
    ogrenciId.set(ogrenci.anahtar, yeniOgrenci.id);
    manifest.studentIdleri.push(yeniOgrenci.id);
    olusan.ogrenci += 1;
  }

  manifestiYaz(manifest);

  // --- Kayıtlar ------------------------------------------------------------
  const kayitId = new Map<string, string>();
  for (const kayit of paket.kayitlar) {
    const ogrenci = paket.ogrenciler.find((o) => o.anahtar === kayit.ogrenciAnahtari)!;
    const grupAnahtari = `${kayit.programAdi}|${kayit.grupAdi}|${kayit.timeSlot}|${ogrenci.branchCode}`;
    const grup = grupId.get(grupAnahtari)!;
    const ogr = ogrenciId.get(kayit.ogrenciAnahtari)!;

    const mevcut = await db.enrollment.findUnique({
      where: { studentId_groupId: { studentId: ogr, groupId: grup } },
      select: { id: true },
    });
    if (mevcut) {
      // Kaydın grubu bizim olduğu için kayıt da bizim.
      kayitId.set(`${kayit.ogrenciAnahtari}|${kayit.programAdi}`, mevcut.id);
      manifest.enrollmentIdleri.push(mevcut.id);
      continue;
    }
    const yeniKayit = await db.enrollment.create({
      data: {
        studentId: ogr,
        groupId: grup,
        status: kayit.status,
        ...(kayit.status === "IPTAL"
          ? { cancelReason: "DIGER", cancelNote: "Kütükte iptal olarak işaretli." }
          : {}),
        gozlemNotu: kayit.rapordanTuretildi
          ? "Kayıt kütükte yoktu; öğrencinin bu döneme ait arşiv raporundan türetildi."
          : null,
      },
      select: { id: true },
    });
    kayitId.set(`${kayit.ogrenciAnahtari}|${kayit.programAdi}`, yeniKayit.id);
    manifest.enrollmentIdleri.push(yeniKayit.id);
    olusan.kayit += 1;
  }

  manifestiYaz(manifest);

  // --- Arşiv raporları -----------------------------------------------------
  // En uzun aşama: 351 PDF, 133 MB. Defter her 25 belgede bir diske düşüyor
  // ki koşu kesilirse yazılanlar geri alınabilir kalsın.
  let yazilan = 0;
  for (const rapor of paket.raporlar) {
    const mevcut = await db.legacyReport.findUnique({
      where: { sourcePath: rapor.sourcePath },
      select: { id: true },
    });
    if (mevcut) {
      // `sourcePath` yalnızca bu betikten yazılır; her zaman bizimdir.
      manifest.legacyReportIdleri.push(mevcut.id);
      continue;
    }
    const icerik = readFileSync(rapor.mutlakYol);
    const yeniRapor = await db.legacyReport.create({
      data: {
        studentId: ogrenciId.get(rapor.ogrenciAnahtari)!,
        enrollmentId:
          kayitId.get(`${rapor.ogrenciAnahtari}|${rapor.programAdi}`) ?? null,
        termLabel: rapor.termLabel,
        groupLabel: rapor.groupLabel,
        reportDate: gun(rapor.reportDate),
        sourcePath: rapor.sourcePath,
        fileName: rapor.fileName,
        mimeType: "application/pdf",
        fileSize: icerik.byteLength,
        fileData: icerik,
      },
      select: { id: true },
    });
    manifest.legacyReportIdleri.push(yeniRapor.id);
    olusan.rapor += 1;

    yazilan += 1;
    if (yazilan % 25 === 0) {
      manifestiYaz(manifest);
      console.log(`  ${yazilan}/${paket.raporlar.length} belge yazıldı`);
    }
  }

  manifestiYaz(manifest);

  // Manifest ÜSTÜNE YAZILMAZ, birleştirilir. Betik idempotan olduğu için
  // ikinci koşu hiçbir şey eklemez; düz yazsaydık manifest boşalır ve
  // `geri-al.ts` dokunacak satır bulamazdı — aktarım geri alınamaz hâle
  // gelirdi. Yarım kalmış bir koşudan sonra tamamlamak da bu sayede güvenli.


  const satir = (etiket: string, yeni: number, toplam: number) =>
    `${etiket.padEnd(12)}: ${yeni} yeni${yeni === toplam ? "" : ` (${toplam - yeni} zaten vardı)`}`;

  console.log(satir("Dönem", olusan.donem, manifest.termIdleri.length));
  console.log(satir("Kulüp", olusan.kulup, manifest.clubIdleri.length));
  console.log(satir("Grup", olusan.grup, manifest.groupIdleri.length));
  console.log(satir("Öğrenci", olusan.ogrenci, manifest.studentIdleri.length));
  console.log(satir("Kayıt", olusan.kayit, new Set(manifest.enrollmentIdleri).size));
  console.log(satir("Arşiv raporu", olusan.rapor, manifest.legacyReportIdleri.length));
  console.log(`\nManifest: ${MANIFEST_YOLU}`);
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
