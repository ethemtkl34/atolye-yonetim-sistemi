"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";

/**
 * §3.2 ve §8 — Stajyer hesaplarının yönetimi.
 *
 * Stajyer ayrı bir tablo değil, `role = STAJYER` olan bir kullanıcı: puanlamayı
 * kendisi girdiği için giriş yapabilmesi gerekiyor. Hesabı koordinatör açar,
 * kendi kaydını açan kullanıcı yok.
 */

export type EylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
};

const stajyerSemasi = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı")
    .max(120, "Ad soyad en fazla 120 karakter olabilir"),
  email: z
    .string()
    .trim()
    .min(1, "E-posta gerekli")
    .email("Geçerli bir e-posta adresi girin"),
  password: z
    .string()
    .min(8, "Parola en az 8 karakter olmalı")
    .max(100, "Parola en fazla 100 karakter olabilir"),
});

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path.join(".");
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message;
  }
  return sonuc;
}

export async function stajyerEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const cozumlenen = stajyerSemasi.safeParse({
    name: formVerisi.get("name"),
    email: formVerisi.get("email"),
    password: formVerisi.get("password"),
  });

  if (!cozumlenen.success) {
    return { alanHatalari: alanHatalari(cozumlenen.error) };
  }

  // Giriş sırasında e-posta Türkçe küçük harfe çevrilerek aranıyor;
  // kayıt da aynı biçimde yapılmalı ki eşleşsin.
  const email = cozumlenen.data.email.toLocaleLowerCase("tr-TR");

  const mevcut = await db.user.findUnique({ where: { email } });
  if (mevcut) {
    return { alanHatalari: { email: "Bu e-posta zaten kullanılıyor." } };
  }

  await db.user.create({
    data: {
      name: cozumlenen.data.name,
      email,
      passwordHash: await hash(cozumlenen.data.password, 12),
      role: "STAJYER",
    },
  });

  revalidatePath("/koordinator/stajyerler");
  return {
    basari: `${cozumlenen.data.name} eklendi. Giriş bilgilerini stajyere iletin ve ilk girişten sonra parolayı değiştirmesini isteyin.`,
  };
}

export async function stajyerAdiGuncelle(
  stajyerId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const ad = String(formVerisi.get("name") ?? "").trim();
  if (ad.length < 2) {
    return { alanHatalari: { name: "Ad soyad en az 2 karakter olmalı" } };
  }
  if (ad.length > 120) {
    return { alanHatalari: { name: "Ad soyad en fazla 120 karakter olabilir" } };
  }

  const sonuc = await db.user.updateMany({
    where: { id: stajyerId, role: "STAJYER" },
    data: { name: ad },
  });
  if (sonuc.count === 0) return { hata: "Stajyer bulunamadı." };

  revalidatePath("/koordinator/stajyerler");
  return { basari: "Stajyer bilgisi güncellendi." };
}

/**
 * Pasife alınan stajyer giriş yapamaz ama geçmiş atamaları ve girdiği
 * puanlamalar olduğu gibi kalır — dönem ortasında ayrılan bir stajyerin
 * verisi silinmemeli.
 */
export async function stajyerDurumDegistir(
  stajyerId: string,
): Promise<EylemDurumu> {
  const koordinator = await koordinatorZorunlu();

  if (stajyerId === koordinator.id) {
    return { hata: "Kendi hesabınızı pasife alamazsınız." };
  }

  const stajyer = await db.user.findUnique({
    where: { id: stajyerId },
    select: { active: true, name: true, role: true },
  });

  if (!stajyer) return { hata: "Stajyer bulunamadı." };
  if (stajyer.role !== "STAJYER") {
    return { hata: "Bu hesap bir stajyer hesabı değil." };
  }

  await db.user.update({
    where: { id: stajyerId },
    data: { active: !stajyer.active },
  });

  revalidatePath("/koordinator/stajyerler");
  return {
    basari: stajyer.active
      ? `${stajyer.name} pasife alındı; artık giriş yapamaz. Geçmiş puanlamaları korundu.`
      : `${stajyer.name} yeniden aktif.`,
  };
}

/** Parola sıfırlama — stajyer parolasını unuttuğunda koordinatör yeniler. */
export async function stajyerParolaSifirla(
  stajyerId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const parola = String(formVerisi.get("password") ?? "");
  if (parola.length < 8) {
    return { alanHatalari: { password: "Parola en az 8 karakter olmalı" } };
  }
  if (parola.length > 100) {
    return { alanHatalari: { password: "Parola en fazla 100 karakter olabilir" } };
  }

  const sonuc = await db.user.updateMany({
    where: { id: stajyerId, role: "STAJYER" },
    data: { passwordHash: await hash(parola, 12) },
  });
  if (sonuc.count === 0) return { hata: "Stajyer bulunamadı." };

  revalidatePath("/koordinator/stajyerler");
  return { basari: "Parola yenilendi. Yeni parolayı stajyere iletin." };
}
