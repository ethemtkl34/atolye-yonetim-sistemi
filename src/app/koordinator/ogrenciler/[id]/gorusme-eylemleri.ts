"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { bugun, tarihBicimle, tarihCozumle } from "@/lib/tarih";

/**
 * Psikolog görüşmeleri — ekleme ve silme.
 *
 * GİZLİLİK: Görüşme notları sağlık bilgisi gibi hassastır ve stajyerden
 * tamamen gizlidir; bu eylemler ve okuma sorgusu yalnızca koordinatör
 * ekranlarından çağrılır (`yonetimZorunlu`).
 *
 * ŞUBE: Öğrenci ve görüşme id'leri istemciden geliyor; her işlem
 * `branchId`/`student.branchId` ile aktif şubeye kilitli doğrulanır.
 */

export type GorusmeEylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
};

const gorusmeSemasi = z.object({
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
  not: z
    .string()
    .trim()
    .min(1, "Görüşme notu boş olamaz")
    .max(5000, "Not en fazla 5000 karakter olabilir"),
});

export async function gorusmeEkle(
  ogrenciId: string,
  _oncekiDurum: GorusmeEylemDurumu,
  formVerisi: FormData,
): Promise<GorusmeEylemDurumu> {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

  const cozumlenen = gorusmeSemasi.safeParse({
    tarih: formVerisi.get("tarih"),
    gorusmeciAdi: formVerisi.get("gorusmeciAdi"),
    tur: formVerisi.get("tur"),
    not: formVerisi.get("not"),
  });

  if (!cozumlenen.success) {
    const hatalar: Record<string, string> = {};
    for (const sorun of cozumlenen.error.issues) {
      const alan = sorun.path.join(".");
      if (alan && !hatalar[alan]) hatalar[alan] = sorun.message;
    }
    return { alanHatalari: hatalar };
  }

  const veri = cozumlenen.data;

  const tarih = veri.tarih ? tarihCozumle(veri.tarih) : bugun();
  if (!tarih) {
    return { alanHatalari: { tarih: "Geçerli bir tarih seçin." } };
  }

  // Gelecek tarih kabul edilmez: bu yapılmış bir görüşmenin kaydıdır,
  // randevu defteri değil. İleri tarihli kayıt "yapıldı mı yapılmadı mı"
  // belirsizliği doğururdu.
  if (tarih.getTime() > bugun().getTime()) {
    return { alanHatalari: { tarih: "Görüşme tarihi ileride olamaz." } };
  }

  const ogrenci = await db.student.findFirst({
    where: { id: ogrenciId, branchId: subeId },
    select: { id: true },
  });
  if (!ogrenci) return { hata: "Öğrenci bulunamadı." };

  await db.counselingSession.create({
    data: {
      studentId: ogrenciId,
      date: tarih,
      counselorName: veri.gorusmeciAdi,
      counselorType: veri.tur,
      notes: veri.not,
      createdByUserId: kullanici.id,
    },
  });

  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
  return { basari: "Görüşme kaydedildi." };
}

/**
 * Yanlış girilen görüşme silinir; düzenleme yok. Dört alanlık bir kayıt için
 * "sil + yeniden ekle" yeterli, düzenleme formu ve "kim düzenledi" izi
 * gereksiz karmaşıklık olurdu. Onay istemcide soruluyor (window.confirm).
 */
export async function gorusmeSil(
  gorusmeId: string,
): Promise<GorusmeEylemDurumu> {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

  const gorusme = await db.counselingSession.findFirst({
    where: { id: gorusmeId, student: { branchId: subeId } },
    select: { id: true, studentId: true, date: true },
  });
  if (!gorusme) return { hata: "Görüşme bulunamadı." };

  await db.counselingSession.delete({ where: { id: gorusme.id } });

  revalidatePath(`/koordinator/ogrenciler/${gorusme.studentId}`);
  return {
    basari: `${tarihBicimle(gorusme.date)} tarihli görüşme silindi.`,
  };
}
