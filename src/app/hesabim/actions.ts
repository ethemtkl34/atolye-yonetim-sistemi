"use server";

import { db } from "@/lib/db";
import { girisZorunlu } from "@/lib/yetki-kapisi";
import type { EylemDurumu } from "@/lib/formlar";
import { parolayiDogrulaVeDegistir } from "@/lib/parola";

/**
 * Kullanıcının kendi parolasını değiştirmesi.
 *
 * Bu ekrana kadar parolalar yalnızca seed veya elle çalıştırılan betiklerle
 * değişebiliyordu; stajyer parolasını koordinatör sıfırlayabiliyordu ama
 * koordinatörün kendi parolasını değiştirecek hiçbir yol yoktu.
 *
 * Rol ayrımı yok: her giriş yapmış kullanıcı yalnızca KENDİ parolasını
 * değiştirir. Doğrulama ve yazma akışı `lib/parola.ts`'te.
 */


export async function parolamiDegistir(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await girisZorunlu();

  // şube-muaf: kullanıcı kendi hesabını okuyor; kimlik oturumdan geliyor,
  // dışarıdan gelen bir id yok.
  const kayit = await db.user.findUnique({
    where: { id: kullanici.id },
    select: { passwordHash: true },
  });

  if (!kayit) return { hata: "Hesap bulunamadı." };

  const hata = await parolayiDogrulaVeDegistir({
    kullaniciId: kullanici.id,
    mevcutHash: kayit.passwordHash,
    formVerisi,
    metinler: {
      mevcutBos: "Mevcut parolanızı girin",
      mevcutAyni: "Yeni parola mevcut parolayla aynı olamaz",
      mevcutHatali: "Mevcut parola hatalı.",
    },
  });
  if (hata) return hata;

  // Oturum JWT tabanlı ve parolayı taşımıyor; parola değişince mevcut oturum
  // düşmüyor. Kullanıcıyı çıkışa zorlamıyoruz ama diğer cihazlarda oturumun
  // açık kalabileceğini söylüyoruz — sessizce bırakmak yanlış izlenim verirdi.
  return {
    basari:
      "Parolanız değiştirildi. Başka bir cihazda açık oturumunuz varsa oradan çıkış yapmanız önerilir.",
  };
}
