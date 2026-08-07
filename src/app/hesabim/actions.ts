"use server";

import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { girisZorunlu } from "@/lib/auth-guard";
import type { EylemDurumu } from "@/lib/formlar";

/**
 * Kullanıcının kendi parolasını değiştirmesi.
 *
 * Bu ekrana kadar parolalar yalnızca seed veya elle çalıştırılan betiklerle
 * değişebiliyordu; stajyer parolasını koordinatör sıfırlayabiliyordu ama
 * koordinatörün kendi parolasını değiştirecek hiçbir yol yoktu.
 *
 * Rol ayrımı yok: her giriş yapmış kullanıcı yalnızca KENDİ parolasını
 * değiştirir. Hangi hesabın değiştirileceği formdan gelmiyor, oturumdan
 * okunuyor — aksi halde gönderilen kimlikle başka bir hesabın parolası
 * değiştirilebilirdi.
 */

export type { EylemDurumu };

const parolaSemasi = z
  .object({
    mevcut: z.string().min(1, "Mevcut parolanızı girin"),
    yeni: z
      .string()
      .min(8, "Yeni parola en az 8 karakter olmalı")
      .max(100, "Yeni parola en fazla 100 karakter olabilir"),
    tekrar: z.string().min(1, "Yeni parolayı tekrar girin"),
  })
  .refine((d) => d.yeni === d.tekrar, {
    path: ["tekrar"],
    message: "Parolalar birbiriyle aynı değil",
  })
  .refine((d) => d.yeni !== d.mevcut, {
    path: ["yeni"],
    message: "Yeni parola mevcut parolayla aynı olamaz",
  });

export async function parolamiDegistir(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await girisZorunlu();

  const cozumlenen = parolaSemasi.safeParse({
    mevcut: formVerisi.get("mevcut"),
    yeni: formVerisi.get("yeni"),
    tekrar: formVerisi.get("tekrar"),
  });

  if (!cozumlenen.success) {
    const alanlar = cozumlenen.error.flatten().fieldErrors;
    return {
      alanHatalari: {
        ...(alanlar.mevcut?.[0] ? { mevcut: alanlar.mevcut[0] } : {}),
        ...(alanlar.yeni?.[0] ? { yeni: alanlar.yeni[0] } : {}),
        ...(alanlar.tekrar?.[0] ? { tekrar: alanlar.tekrar[0] } : {}),
      },
    };
  }

  // şube-muaf: kullanıcı kendi hesabını okuyor; kimlik oturumdan geliyor,
  // dışarıdan gelen bir id yok.
  const kayit = await db.user.findUnique({
    where: { id: kullanici.id },
    select: { passwordHash: true },
  });

  if (!kayit) return { hata: "Hesap bulunamadı." };

  const mevcutDogru = await compare(cozumlenen.data.mevcut, kayit.passwordHash);
  if (!mevcutDogru) {
    return { alanHatalari: { mevcut: "Mevcut parola hatalı." } };
  }

  // şube-muaf: kendi parolasını değiştiriyor; kimlik oturumdan geliyor.
  // Bayrak da temizlenir: kendi parolasını koyan kullanıcıdan bir daha
  // zorunlu değişim istenmez.
  await db.user.update({
    where: { id: kullanici.id },
    data: {
      passwordHash: await hash(cozumlenen.data.yeni, 12),
      mustChangePassword: false,
    },
  });

  // Oturum JWT tabanlı ve parolayı taşımıyor; parola değişince mevcut oturum
  // düşmüyor. Kullanıcıyı çıkışa zorlamıyoruz ama diğer cihazlarda oturumun
  // açık kalabileceğini söylüyoruz — sessizce bırakmak yanlış izlenim verirdi.
  return {
    basari:
      "Parolanız değiştirildi. Başka bir cihazda açık oturumunuz varsa oradan çıkış yapmanız önerilir.",
  };
}
