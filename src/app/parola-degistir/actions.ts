"use server";

import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { anaSayfaYolu } from "@/lib/roller";

/**
 * Zorunlu ilk parola değişimi.
 *
 * `girisZorunlu()` BİLEREK kullanılmıyor: o fonksiyon `mustChangePassword`
 * dolu olan herkesi bu sayfaya yönlendiriyor; burada da onu çağırmak döngü
 * olurdu (hesap-pasif sayfasındaki desenin aynısı). Oturum ve hesap durumu
 * elle çözülür.
 *
 * Hangi hesabın değiştirileceği formdan gelmiyor, oturumdan okunuyor — aksi
 * halde gönderilen kimlikle başka bir hesabın parolası değiştirilebilirdi.
 */

export type EylemDurumu = {
  hata?: string;
  alanHatalari?: Record<string, string>;
};

const parolaSemasi = z
  .object({
    mevcut: z.string().min(1, "Size iletilen geçici parolayı girin"),
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
    message: "Yeni parola geçici parolayla aynı olamaz",
  });

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

  const mevcutDogru = await compare(
    cozumlenen.data.mevcut,
    kullanici.passwordHash,
  );
  if (!mevcutDogru) {
    return { alanHatalari: { mevcut: "Geçici parola hatalı." } };
  }

  // şube-muaf: kendi parolasını değiştiriyor; kimlik oturumdan geliyor.
  await db.user.update({
    where: { id: oturum.user.id },
    data: {
      passwordHash: await hash(cozumlenen.data.yeni, 12),
      mustChangePassword: false,
    },
  });

  redirect(anaSayfaYolu(kullanici.roles));
}
