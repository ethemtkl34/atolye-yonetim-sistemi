"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { bugun, tarihBicimle, tarihCozumle } from "@/lib/tarih";
import { formDegerleri } from "@/lib/formlar";

/**
 * Terapi görüşmeleri (öğrenci ile psikolog/koordinatör) — ekleme ve silme.
 *
 * Bütün yazma işlemleri Danışmanlık sayfasından yapılır; öğrenci profili bu
 * kayıtları yalnızca gösterir. Öğrenci bu yüzden bind ile değil formdaki
 * seçiciden gelir ve şube kapısından geçirilir.
 *
 * GİZLİLİK: Görüşme notları sağlık bilgisi gibi hassastır ve stajyerden
 * tamamen gizlidir; bu eylemler ve okuma sorguları yalnızca koordinatör
 * ekranlarından çağrılır (`yonetimZorunlu`).
 */

export type GorusmeEylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
  /**
   * Doğrulama hatasında girilenler — React 19 form eylemi bitince alanları
   * sıfırlıyor; not 5000 karaktere kadar olabildiği için yazılanın kaybolması
   * kabul edilemez. Öğrenci formundaki desenle aynı.
   */
  degerler?: Record<string, string>;
};

const GORUSME_FORM_ALANLARI = [
  "ogrenciId",
  "tarih",
  "gorusmeciAdi",
  "tur",
  "terapiTuru",
  "not",
] as const;

const gorusmeSemasi = z.object({
  ogrenciId: z.string().min(1, "Öğrenci seçin"),
  /**
   * Boş bırakılabilir — o zaman bugün sayılır. Ayrı bir "bugün" onay kutusu
   * yok: tarih alanı zaten bugünle dolu geliyor, boş gelmesi yalnızca alanın
   * elle temizlenmesiyle mümkün ve o durumda da niyet aynı.
   */
  tarih: z.string().trim(),
  gorusmeciAdi: z
    .string()
    .trim()
    .min(1, "Görüşmeyi yapan kişinin adını yazın")
    .max(100, "Ad en fazla 100 karakter olabilir"),
  tur: z.enum(["PSIKOLOG", "KOORDINATOR"], {
    message: "Görüşmeci türünü seçin",
  }),
  terapiTuru: z.enum(["OYUN_TERAPISI", "DANISAN_TERAPISI"], {
    message: "Terapi türünü seçin",
  }),
  not: z
    .string()
    .trim()
    .min(1, "Görüşme notu boş olamaz")
    .max(5000, "Not en fazla 5000 karakter olabilir"),
});

/** Görüşme değişince iki ekran birden tazelenir: Danışmanlık ve profil. */
function gorusmeleriTazele(ogrenciId: string) {
  revalidatePath("/koordinator/danismanlik");
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
}

export async function terapiGorusmesiEkle(
  _oncekiDurum: GorusmeEylemDurumu,
  formVerisi: FormData,
): Promise<GorusmeEylemDurumu> {
  const kullanici = await yonetimZorunlu("danismanlik", "TAM");
  const subeId = kullanici.aktifSubeId;

  const cozumlenen = gorusmeSemasi.safeParse({
    ogrenciId: formVerisi.get("ogrenciId"),
    tarih: formVerisi.get("tarih"),
    gorusmeciAdi: formVerisi.get("gorusmeciAdi"),
    tur: formVerisi.get("tur"),
    terapiTuru: formVerisi.get("terapiTuru"),
    not: formVerisi.get("not"),
  });

  if (!cozumlenen.success) {
    const hatalar: Record<string, string> = {};
    for (const sorun of cozumlenen.error.issues) {
      const alan = sorun.path.join(".");
      if (alan && !hatalar[alan]) hatalar[alan] = sorun.message;
    }
    return {
      alanHatalari: hatalar,
      degerler: formDegerleri(formVerisi, GORUSME_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;

  const girilenler = formDegerleri(formVerisi, GORUSME_FORM_ALANLARI);

  const tarih = veri.tarih ? tarihCozumle(veri.tarih) : bugun();
  if (!tarih) {
    return {
      alanHatalari: { tarih: "Geçerli bir tarih seçin." },
      degerler: girilenler,
    };
  }

  // Gelecek tarih kabul edilmez: bu yapılmış bir görüşmenin kaydıdır,
  // randevu defteri değil. İleri tarihli kayıt "yapıldı mı yapılmadı mı"
  // belirsizliği doğururdu. (Veli görüşmesinde tersi geçerli — o kayıt
  // görüşmeden önce, brief için açılıyor.)
  if (tarih.getTime() > bugun().getTime()) {
    return {
      alanHatalari: { tarih: "Görüşme tarihi ileride olamaz." },
      degerler: girilenler,
    };
  }

  const ogrenci = await db.student.findFirst({
    where: { id: veri.ogrenciId, branchId: subeId },
    select: { id: true },
  });
  if (!ogrenci) return { hata: "Öğrenci bulunamadı." };

  await db.counselingSession.create({
    data: {
      studentId: veri.ogrenciId,
      date: tarih,
      counselorName: veri.gorusmeciAdi,
      counselorType: veri.tur,
      therapyType: veri.terapiTuru,
      notes: veri.not,
      createdByUserId: kullanici.id,
    },
  });

  gorusmeleriTazele(veri.ogrenciId);
  return { basari: "Terapi görüşmesi kaydedildi." };
}

/**
 * Yanlış girilen görüşme silinir; düzenleme yok. Beş alanlık bir kayıt için
 * "sil + yeniden ekle" yeterli, düzenleme formu ve "kim düzenledi" izi
 * gereksiz karmaşıklık olurdu. Onay istemcide soruluyor (window.confirm).
 */
export async function terapiGorusmesiSil(
  gorusmeId: string,
): Promise<GorusmeEylemDurumu> {
  const kullanici = await yonetimZorunlu("danismanlik", "TAM");
  const subeId = kullanici.aktifSubeId;

  const gorusme = await db.counselingSession.findFirst({
    where: { id: gorusmeId, student: { branchId: subeId } },
    select: { id: true, studentId: true, date: true },
  });
  if (!gorusme) return { hata: "Görüşme bulunamadı." };

  await db.counselingSession.delete({ where: { id: gorusme.id } });

  gorusmeleriTazele(gorusme.studentId);
  return {
    basari: `${tarihBicimle(gorusme.date)} tarihli görüşme silindi.`,
  };
}
