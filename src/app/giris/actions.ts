"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { girisSemasi } from "@/auth";

export type GirisDurumu = {
  hata?: string;
  alanHatalari?: { email?: string; password?: string };
  /**
   * Başarısız denemede e-posta korunur; React 19 formu sıfırladığı için
   * kullanıcı aynı adresi baştan yazmak zorunda kalıyordu. Parola güvenlik
   * gereği hiçbir zaman geri gönderilmez.
   */
  email?: string;
};

/**
 * Giriş formunun Server Action'ı.
 *
 * Hatalı e-posta ile hatalı parola aynı mesajı döner: hangi e-postaların
 * sistemde kayıtlı olduğu dışarıdan anlaşılmamalı.
 */
export async function girisYap(
  _oncekiDurum: GirisDurumu,
  formVerisi: FormData,
): Promise<GirisDurumu> {
  const cozumlenen = girisSemasi.safeParse({
    email: formVerisi.get("email"),
    password: formVerisi.get("password"),
  });

  const girilenEmail = String(formVerisi.get("email") ?? "");

  if (!cozumlenen.success) {
    const alanlar = cozumlenen.error.flatten().fieldErrors;
    return {
      alanHatalari: {
        email: alanlar.email?.[0],
        password: alanlar.password?.[0],
      },
      email: girilenEmail,
    };
  }

  const devam = formVerisi.get("devam");
  const hedef = typeof devam === "string" && devam.startsWith("/")
    ? devam
    : undefined;

  try {
    // signIn başarılı olduğunda yönlendirme için bir hata fırlatır; bu
    // beklenen davranıştır ve aşağıda yeniden fırlatılarak Next.js'e bırakılır.
    await signIn("credentials", {
      email: cozumlenen.data.email,
      password: cozumlenen.data.password,
      redirectTo: hedef ?? "/",
    });
    return {};
  } catch (hata) {
    if (hata instanceof AuthError) {
      return { hata: "E-posta adresi veya parola hatalı.", email: girilenEmail };
    }
    throw hata;
  }
}
