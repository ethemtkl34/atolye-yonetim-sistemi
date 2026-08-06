"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { bugun, tarihBicimle, tarihCozumle } from "@/lib/tarih";
import { formDegerleri } from "@/lib/formlar";

/**
 * Zeka testleri — sonuç belgesi yükleme ve silme.
 *
 * Bütün yazma işlemleri Zeka testleri sayfasından yapılır; öğrenci profili
 * kayıtları yalnızca gösterir (Danışmanlık ile aynı desen). Öğrenci formdaki
 * seçiciden gelir ve şube kapısından geçirilir.
 *
 * GİZLİLİK: Test sonuçları sağlık bilgisi gibi hassastır ve stajyerden
 * tamamen gizlidir; bu eylemler ve okuma sorguları yalnızca koordinatör
 * ekranlarından çağrılır (`yonetimZorunlu`).
 *
 * DOSYA: İkili veri veritabanına yazılır (bkz. şemadaki gerekçe). Üst sınır
 * 4MB — Server Action gövde sınırı `next.config.ts` içinde 4500kb'ye
 * çekildi, Vercel'in ~4,5MB istek sınırı bunun üstüne izin vermiyor.
 */

export type ZekaTestiEylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
  /**
   * Girilenler — React 19 form eylemi bitince alanları sıfırlıyor; metin
   * alanları buradan geri doldurulur. Dosya seçimi tarayıcı güvenliği gereği
   * geri yüklenemez, hata sonrası yeniden seçilmesi gerekir.
   */
  degerler?: Record<string, string>;
};

/** Kabul edilen dosya türleri — önizleme rotası da bunlara güvenir. */
const IZINLI_TURLER: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const EN_BUYUK_DOSYA = 4 * 1024 * 1024;

const ZEKA_TESTI_FORM_ALANLARI = [
  "ogrenciId",
  "tarih",
  "testAdi",
  "not",
] as const;

const zekaTestiSemasi = z.object({
  ogrenciId: z.string().min(1, "Öğrenci seçin"),
  /** Boş bırakılabilir — o zaman bugün sayılır (görüşme formları deseni). */
  tarih: z.string().trim(),
  testAdi: z.string().trim().min(1, "Listeden bir test seçin"),
  not: z
    .string()
    .trim()
    .max(2000, "Not en fazla 2000 karakter olabilir"),
});

/** Test kaydı değişince iki ekran birden tazelenir: Zeka testleri ve profil. */
function testleriTazele(ogrenciId: string) {
  revalidatePath("/koordinator/zeka-testleri");
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
}

export async function zekaTestiEkle(
  _oncekiDurum: ZekaTestiEylemDurumu,
  formVerisi: FormData,
): Promise<ZekaTestiEylemDurumu> {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

  const girilenler = formDegerleri(formVerisi, ZEKA_TESTI_FORM_ALANLARI);
  const alanHatalari: Record<string, string> = {};

  const cozumlenen = zekaTestiSemasi.safeParse({
    ogrenciId: formVerisi.get("ogrenciId"),
    tarih: formVerisi.get("tarih"),
    testAdi: formVerisi.get("testAdi"),
    not: formVerisi.get("not") ?? "",
  });

  if (!cozumlenen.success) {
    for (const sorun of cozumlenen.error.issues) {
      const alan = sorun.path.join(".");
      if (alan && !alanHatalari[alan]) alanHatalari[alan] = sorun.message;
    }
  }

  // Dosya doğrulaması zod dışında: FormData'daki File nesnesi şemaya girmiyor.
  const dosya = formVerisi.get("dosya");
  if (!(dosya instanceof File) || dosya.size === 0) {
    alanHatalari.dosya = "Bir dosya seçin.";
  } else if (!IZINLI_TURLER[dosya.type]) {
    alanHatalari.dosya = "Yalnızca PDF, JPG veya PNG yüklenebilir.";
  } else if (dosya.size > EN_BUYUK_DOSYA) {
    alanHatalari.dosya =
      "Dosya en fazla 4MB olabilir. Taranmış belgeyi daha düşük çözünürlükte kaydetmeyi deneyin.";
  }

  if (!cozumlenen.success || Object.keys(alanHatalari).length > 0) {
    return { alanHatalari, degerler: girilenler };
  }

  const veri = cozumlenen.data;

  const tarih = veri.tarih ? tarihCozumle(veri.tarih) : bugun();
  if (!tarih) {
    return {
      alanHatalari: { tarih: "Geçerli bir tarih seçin." },
      degerler: girilenler,
    };
  }

  // Gelecek tarih kabul edilmez: bu uygulanmış bir testin sonucudur,
  // randevu defteri değil (terapi görüşmesiyle aynı kural).
  if (tarih.getTime() > bugun().getTime()) {
    return {
      alanHatalari: { tarih: "Test tarihi ileride olamaz." },
      degerler: girilenler,
    };
  }

  const ogrenci = await db.student.findFirst({
    where: { id: veri.ogrenciId, branchId: subeId },
    select: { id: true },
  });
  if (!ogrenci) return { hata: "Öğrenci bulunamadı." };

  // Test adı katalogdan seçilir; formdan gelen değere güvenilmez. Kayda ise
  // katalog satırı değil ADIN KENDİSİ yazılır (snapshot) — katalog sonradan
  // değişse de geçmiş kayıt o günkü adı gösterir.
  const katalogKaydi = await db.intelligenceTestType.findFirst({
    // şube-muaf: test kataloğu şubeden bağımsız (atölye kataloğu gibi).
    where: { name: veri.testAdi, active: true },
    select: { id: true },
  });
  if (!katalogKaydi) {
    return {
      alanHatalari: { testAdi: "Listeden bir test seçin." },
      degerler: girilenler,
    };
  }

  const belge = dosya as File;
  const icerik = new Uint8Array(await belge.arrayBuffer());

  await db.intelligenceTest.create({
    data: {
      studentId: veri.ogrenciId,
      date: tarih,
      testName: veri.testAdi,
      notes: veri.not || null,
      fileName: belge.name,
      mimeType: belge.type,
      fileSize: belge.size,
      fileData: icerik,
      createdByUserId: kullanici.id,
    },
  });

  testleriTazele(veri.ogrenciId);
  return { basari: "Zeka testi belgesi kaydedildi." };
}

/**
 * Yanlış yüklenen belge silinir; düzenleme yok — doğrusu yeniden yüklenir.
 * Onay istemcide soruluyor (window.confirm).
 */
export async function zekaTestiSil(
  testId: string,
): Promise<ZekaTestiEylemDurumu> {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

  const test = await db.intelligenceTest.findFirst({
    where: { id: testId, student: { branchId: subeId } },
    select: { id: true, studentId: true, date: true, testName: true },
  });
  if (!test) return { hata: "Test kaydı bulunamadı." };

  await db.intelligenceTest.delete({ where: { id: test.id } });

  testleriTazele(test.studentId);
  return {
    basari: `${tarihBicimle(test.date)} tarihli "${test.testName}" kaydı silindi.`,
  };
}
