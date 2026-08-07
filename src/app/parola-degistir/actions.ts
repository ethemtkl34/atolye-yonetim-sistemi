"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { anaSayfaYolu } from "@/lib/roller";
import type { EylemDurumu } from "@/lib/formlar";
import { parolayiDogrulaVeDegistir } from "@/lib/parola";

/**
 * Zorunlu ilk parola değişimi.
 *
 * `girisZorunlu()` BİLEREK kullanılmıyor: o fonksiyon `mustChangePassword`
 * dolu olan herkesi bu sayfaya yönlendiriyor; burada da onu çağırmak döngü
 * olurdu (hesap-pasif sayfasındaki desenin aynısı). Oturum ve hesap durumu
 * elle çözülür. Doğrulama ve yazma akışı `lib/parola.ts`'te.
 */


export async function zorunluParolaDegistir(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const oturum = await auth();
  if (!oturum?.user?.id) redirect("/giris");

  // şube-muaf: kullanıcı kendi hesabını okuyor; kimlik oturumdan geliyor.
  const kullanici = await db.user.findUnique({
    where: { id: oturum.user.id },
    select: {
      passwordHash: true,
      active: true,
      mustChangePassword: true,
      roles: true,
    },
  });

  if (!kullanici || !kullanici.active) redirect("/hesap-pasif");

  const hata = await parolayiDogrulaVeDegistir({
    kullaniciId: oturum.user.id,
    mevcutHash: kullanici.passwordHash,
    formVerisi,
    metinler: {
      mevcutBos: "Size iletilen geçici parolayı girin",
      mevcutAyni: "Yeni parola geçici parolayla aynı olamaz",
      mevcutHatali: "Geçici parola hatalı.",
    },
  });
  if (hata) return hata;

  redirect(anaSayfaYolu(kullanici.roles));
}
