import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ParolaDegistirFormu } from "./parola-degistir-formu";

export const metadata: Metadata = {
  title: "Parola belirle",
};

/**
 * Zorunlu ilk parola değişimi ekranı.
 *
 * Hesabı açan (veya parolayı sıfırlayan) yönetici geçici bir parola koyar ve
 * `mustChangePassword` bayrağını bırakır; `girisZorunlu()` bayrak temizlenene
 * kadar bütün panel sayfalarından buraya yönlendirir. Bu sayfa `girisZorunlu`
 * KULLANMAZ (döngü olurdu) — oturumu kendisi çözer (hesap-pasif deseni).
 */
export default async function ParolaDegistirSayfasi() {
  const oturum = await auth();
  if (!oturum?.user?.id) redirect("/giris");

  // şube-muaf: oturumun sahibi kendi hesabına bakıyor.
  const kullanici = await db.user.findUnique({
    where: { id: oturum.user.id },
    select: { active: true, mustChangePassword: true, name: true },
  });

  if (!kullanici || !kullanici.active) redirect("/hesap-pasif");
  // Bayrak yoksa burada işi yok; parolasını Hesabım sayfasından değiştirir.
  if (!kullanici.mustChangePassword) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-marka-700 to-marka-900 p-6">
      <div className="kil-yuzey w-full max-w-sm p-6 shadow-[16px_16px_40px_var(--kil-koyu-golge),-10px_-10px_26px_rgba(255,255,255,0.08),inset_0_1px_0_#fff]">
        <h1 className="text-lg font-semibold text-zinc-900">
          Hoş geldiniz, {kullanici.name}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Güvenliğiniz için size iletilen geçici parolayı değiştirip kendi
          parolanızı belirlemeniz gerekiyor. Panel bundan sonra açılacak.
        </p>
        <div className="mt-5">
          <ParolaDegistirFormu />
        </div>
      </div>
    </main>
  );
}
