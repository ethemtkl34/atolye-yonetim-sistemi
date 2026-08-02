"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { formDegerleri } from "@/lib/formlar";

/**
 * Atölye çeşitleri ve değerlendirme sorularının işlemleri (§2.1, §9.2).
 *
 * Her işlem `yonetimZorunlu()` ile başlar. Bu sayfaların layout'u da aynı
 * kontrolü yapıyor ama bir Server Action doğrudan çağrılabilir; yetki
 * kontrolünün her işlemin kendi içinde olması şart.
 */

export type EylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
  /** Doğrulama hatasında girilen değerler — form sıfırlanınca geri yazılır. */
  degerler?: Record<string, string>;
};

const atolyeSemasi = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Atölye adı en az 2 karakter olmalı")
    .max(100, "Atölye adı en fazla 100 karakter olabilir"),
  description: z
    .string()
    .trim()
    .max(500, "Açıklama en fazla 500 karakter olabilir")
    .optional()
    .transform((d) => (d ? d : null)),
});

const soruSemasi = z.object({
  text: z
    .string()
    .trim()
    .min(5, "Soru metni en az 5 karakter olmalı")
    .max(300, "Soru metni en fazla 300 karakter olabilir"),
});

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path.join(".");
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message;
  }
  return sonuc;
}

// ---------------------------------------------------------------------------
// Atölye çeşidi
// ---------------------------------------------------------------------------

export async function atolyeEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const cozumlenen = atolyeSemasi.safeParse({
    name: formVerisi.get("name"),
    description: formVerisi.get("description"),
  });

  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, ["name", "description"]),
    };
  }

  const ayniAdVar = await db.workshopType.findUnique({
    where: { name: cozumlenen.data.name },
  });

  if (ayniAdVar) {
    return {
      alanHatalari: { name: "Bu adda bir atölye zaten var." },
      degerler: formDegerleri(formVerisi, ["name", "description"]),
    };
  }

  // Yeni atölye listenin sonuna eklenir.
  const sonSira = await db.workshopType.aggregate({
    _max: { sortOrder: true },
  });

  await db.workshopType.create({
    data: {
      ...cozumlenen.data,
      sortOrder: (sonSira._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/koordinator/atolyeler");
  return { basari: `"${cozumlenen.data.name}" eklendi.` };
}

export async function atolyeGuncelle(
  atolyeId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const cozumlenen = atolyeSemasi.safeParse({
    name: formVerisi.get("name"),
    description: formVerisi.get("description"),
  });

  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, ["name", "description"]),
    };
  }

  const ayniAdVar = await db.workshopType.findFirst({
    where: { name: cozumlenen.data.name, id: { not: atolyeId } },
  });

  if (ayniAdVar) {
    return {
      alanHatalari: { name: "Bu adda başka bir atölye var." },
      degerler: formDegerleri(formVerisi, ["name", "description"]),
    };
  }

  await db.workshopType.update({
    where: { id: atolyeId },
    data: cozumlenen.data,
  });

  revalidatePath("/koordinator/atolyeler");
  revalidatePath(`/koordinator/atolyeler/${atolyeId}`);
  return { basari: "Atölye güncellendi." };
}

/**
 * §2.1 — Atölye silinmez, pasife alınır. Pasif atölye yeni dönem ve kulüp
 * programlarında seçilemez ama geçmiş oturumlarda ve raporlarda kalır.
 */
export async function atolyeDurumDegistir(
  atolyeId: string,
): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const atolye = await db.workshopType.findUnique({
    where: { id: atolyeId },
    select: { active: true, name: true },
  });

  if (!atolye) return { hata: "Atölye bulunamadı." };

  await db.workshopType.update({
    where: { id: atolyeId },
    data: { active: !atolye.active },
  });

  revalidatePath("/koordinator/atolyeler");
  return {
    basari: atolye.active
      ? `"${atolye.name}" pasife alındı.`
      : `"${atolye.name}" yeniden aktif.`,
  };
}

// ---------------------------------------------------------------------------
// Değerlendirme soruları
// ---------------------------------------------------------------------------

export async function soruEkle(
  atolyeId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const cozumlenen = soruSemasi.safeParse({ text: formVerisi.get("text") });

  if (!cozumlenen.success) {
    return { alanHatalari: alanHatalari(cozumlenen.error) };
  }

  const sonSira = await db.question.aggregate({
    where: { workshopTypeId: atolyeId },
    _max: { sortOrder: true },
  });

  await db.question.create({
    data: {
      workshopTypeId: atolyeId,
      text: cozumlenen.data.text,
      sortOrder: (sonSira._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath(`/koordinator/atolyeler/${atolyeId}`);
  return { basari: "Soru eklendi." };
}

/**
 * §13.14 — Soru metni değiştiğinde geçmiş değerlendirmeler etkilenmez;
 * onlar puanlama anındaki metnin kopyasını (`questionTextSnapshot`) taşır.
 */
export async function soruGuncelle(
  soruId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const cozumlenen = soruSemasi.safeParse({ text: formVerisi.get("text") });

  if (!cozumlenen.success) {
    return { alanHatalari: alanHatalari(cozumlenen.error) };
  }

  const soru = await db.question.update({
    where: { id: soruId },
    data: { text: cozumlenen.data.text },
    select: { workshopTypeId: true },
  });

  revalidatePath(`/koordinator/atolyeler/${soru.workshopTypeId}`);
  return { basari: "Soru metni güncellendi. Geçmiş değerlendirmeler eski metni gösterir." };
}

export async function soruDurumDegistir(soruId: string): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const soru = await db.question.findUnique({
    where: { id: soruId },
    select: { active: true, workshopTypeId: true },
  });

  if (!soru) return { hata: "Soru bulunamadı." };

  await db.question.update({
    where: { id: soruId },
    data: { active: !soru.active },
  });

  revalidatePath(`/koordinator/atolyeler/${soru.workshopTypeId}`);
  return {
    basari: soru.active
      ? "Soru pasife alındı; yeni formlarda sorulmayacak."
      : "Soru yeniden aktif.",
  };
}

/**
 * §9.2 — Koordinatör soruyu silebilir.
 *
 * Ancak soru daha önce puanlamada kullanıldıysa gerçekten silmek geçmiş
 * değerlendirmelerin bağını koparır. Bu durumda silme yerine pasife alınır ve
 * koordinatöre sebebi açıkça söylenir. Hiç kullanılmamış soru gerçekten
 * silinir.
 */
export async function soruSil(soruId: string): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const soru = await db.question.findUnique({
    where: { id: soruId },
    select: { workshopTypeId: true, active: true },
  });

  if (!soru) return { hata: "Soru bulunamadı." };

  // şube-muaf: sayım BİLEREK şubeler üstü. Soru iki şubede de ortak; silinip
  // silinemeyeceğine karar verirken yalnızca bir şubenin cevaplarına bakmak,
  // diğer şubenin verisini sessizce yok ederdi.
  const kullanimSayisi = await db.scoreAnswer.count({
    where: { questionId: soruId },
  });

  if (kullanimSayisi > 0) {
    await db.question.update({
      where: { id: soruId },
      data: { active: false },
    });

    revalidatePath(`/koordinator/atolyeler/${soru.workshopTypeId}`);
    return {
      basari: `Bu soru ${kullanimSayisi} değerlendirmede kullanılmış. Geçmiş kayıtlar bozulmasın diye silinmedi, pasife alındı; yeni formlarda sorulmayacak.`,
    };
  }

  await db.question.delete({ where: { id: soruId } });

  revalidatePath(`/koordinator/atolyeler/${soru.workshopTypeId}`);
  return { basari: "Soru silindi." };
}

/**
 * §9.2 — Soru sırasını değiştirir. Komşu soruyla `sortOrder` değerleri
 * takas edilir; tek işlemde (transaction) yapılır ki sıra hiçbir an bozuk
 * kalmasın.
 */
export async function soruSiraDegistir(
  soruId: string,
  yon: "yukari" | "asagi",
): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const soru = await db.question.findUnique({
    where: { id: soruId },
    select: { id: true, sortOrder: true, workshopTypeId: true },
  });

  if (!soru) return { hata: "Soru bulunamadı." };

  const komsu = await db.question.findFirst({
    where: {
      workshopTypeId: soru.workshopTypeId,
      sortOrder:
        yon === "yukari" ? { lt: soru.sortOrder } : { gt: soru.sortOrder },
    },
    orderBy: { sortOrder: yon === "yukari" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });

  // Listenin başındaki veya sonundaki soru için yapacak bir şey yok.
  if (!komsu) return {};

  await db.$transaction([
    db.question.update({
      where: { id: soru.id },
      data: { sortOrder: komsu.sortOrder },
    }),
    db.question.update({
      where: { id: komsu.id },
      data: { sortOrder: soru.sortOrder },
    }),
  ]);

  revalidatePath(`/koordinator/atolyeler/${soru.workshopTypeId}`);
  return {};
}
