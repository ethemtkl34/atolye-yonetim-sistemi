"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { raporGovdesiUret } from "@/lib/rapor-verisi";
import type { RaporGovdesi } from "@/lib/report-engine";

/** §11 — Rapor oluşturma, yeniden üretme ve metin düzenleme. */

export type EylemDurumu = {
  basari?: string;
  hata?: string;
};

/**
 * §11.1 — Rapor istenilen anda, o anki puanlarla üretilir; dönemin bitmesi
 * beklenmez. Kapsam koordinatörün seçtiği kayıtlardır.
 */
export async function raporOlustur(
  ogrenciId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const kayitIdleri = formVerisi.getAll("kayitlar").map(String).filter(Boolean);

  if (kayitIdleri.length === 0) {
    return { hata: "Raporun kapsayacağı en az bir kayıt seçin." };
  }

  // Seçilen kayıtların gerçekten bu öğrenciye ait olduğu sunucuda doğrulanır.
  const gecerliKayitlar = await db.enrollment.findMany({
    where: { id: { in: kayitIdleri }, studentId: ogrenciId },
    select: { id: true },
  });

  if (gecerliKayitlar.length !== kayitIdleri.length) {
    return { hata: "Seçilen kayıtlardan biri bu öğrenciye ait değil." };
  }

  const govde = await raporGovdesiUret(ogrenciId, kayitIdleri);
  if (!govde) return { hata: "Öğrenci bulunamadı." };

  const rapor = await db.report.create({
    data: {
      studentId: ogrenciId,
      bodyJson: govde as unknown as object,
      enrollmentLinks: {
        create: kayitIdleri.map((kayitId) => ({ enrollmentId: kayitId })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/koordinator/raporlar");
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
  redirect(`/koordinator/raporlar/${rapor.id}`);
}

/**
 * §11.4 — Puanlar değiştiyse rapor yeniden üretilebilir.
 *
 * Yeni bir rapor satırı açılır; eski rapor ve ona bağlı PDF'ler yerinde kalır
 * (§13.17). Böylece "hangi rapor hangi PDF'in kaynağıydı" sorusu her zaman
 * cevaplanabilir.
 */
export async function raporYenidenUret(raporId: string): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const eski = await db.report.findUnique({
    where: { id: raporId },
    select: {
      studentId: true,
      enrollmentLinks: { select: { enrollmentId: true } },
    },
  });

  if (!eski) return { hata: "Rapor bulunamadı." };

  const kayitIdleri = eski.enrollmentLinks.map((bag) => bag.enrollmentId);
  const govde = await raporGovdesiUret(eski.studentId, kayitIdleri);
  if (!govde) return { hata: "Rapor verisi hazırlanamadı." };

  const yeni = await db.report.create({
    data: {
      studentId: eski.studentId,
      bodyJson: govde as unknown as object,
      enrollmentLinks: {
        create: kayitIdleri.map((kayitId) => ({ enrollmentId: kayitId })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/koordinator/raporlar");
  revalidatePath(`/koordinator/ogrenciler/${eski.studentId}`);
  redirect(`/koordinator/raporlar/${yeni.id}`);
}

/**
 * §11.4 — Koordinatör otomatik üretilen metni düzenleyebilir.
 *
 * Yalnızca metin katmanı değişir; analiz çıktısı olduğu gibi korunur.
 * Böylece rapor hangi puanlardan çıktığını kaybetmez ve P13'te aynı analizle
 * yeniden metin üretilebilir.
 */
export async function raporMetniDuzenle(
  raporId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await koordinatorZorunlu();

  const rapor = await db.report.findUnique({
    where: { id: raporId },
    select: { bodyJson: true, studentId: true },
  });

  if (!rapor) return { hata: "Rapor bulunamadı." };

  const govde = rapor.bodyJson as unknown as RaporGovdesi;

  const yeniAtolyeler = govde.metin.atolyeler.map((atolye, sira) => {
    const girilen = formVerisi.get(`atolye-${sira}`);
    return {
      atolyeAdi: atolye.atolyeAdi,
      paragraf:
        typeof girilen === "string" && girilen.trim()
          ? girilen.trim()
          : atolye.paragraf,
    };
  });

  const genelMetin = formVerisi.get("genel");
  const yeniGenel =
    typeof genelMetin === "string" && genelMetin.trim()
      ? genelMetin
          .split(/\n{2,}/)
          .map((paragraf) => paragraf.trim())
          .filter(Boolean)
      : govde.metin.genelParagraflar;

  await db.report.update({
    where: { id: raporId },
    data: {
      bodyJson: {
        ...govde,
        metin: { atolyeler: yeniAtolyeler, genelParagraflar: yeniGenel },
      } as unknown as object,
      editedByUserId: kullanici.id,
      editedAt: new Date(),
    },
  });

  revalidatePath("/koordinator/raporlar");
  revalidatePath(`/koordinator/raporlar/${raporId}`);
  revalidatePath(`/koordinator/ogrenciler/${rapor.studentId}`);

  return { basari: "Rapor metni güncellendi." };
}
