import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

/**
 * Yetki kontrolünün asıl yeri burasıdır.
 *
 * `proxy.ts` yalnızca iyimser bir ön kontrol yapar (Next.js dokümanının kendi
 * uyarısı: proxy tam bir yetkilendirme çözümü değildir). Gerçek koruma her
 * sayfa ve her Server Action'ın kendi içinde bu fonksiyonları çağırmasıyla
 * sağlanır. Yeni bir sayfa veya işlem yazan herkes buradan başlamalı.
 */

export type OturumKullanicisi = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/**
 * Oturum açmış kullanıcıyı döner; yoksa giriş sayfasına yönlendirir.
 *
 * Oturum belirteci (JWT) 12 saat geçerli olduğu için hesabın hâlâ var ve
 * aktif olduğu her istekte veritabanından doğrulanır. Aksi hâlde pasife
 * alınan bir stajyer, elindeki belirteçle mesai sonuna kadar çalışmaya devam
 * edebilirdi. Pasif hesap `/giris`'e değil `/hesap-pasif`'e gider: proxy,
 * oturum çerezi duran kullanıcıyı `/giris`'ten kendi paneline geri yollar ve
 * bu bir yönlendirme döngüsü oluştururdu.
 */
export async function girisZorunlu(): Promise<OturumKullanicisi> {
  const oturum = await auth();

  if (!oturum?.user?.id) {
    redirect("/giris");
  }

  const kullanici = await db.user.findUnique({
    where: { id: oturum.user.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  if (!kullanici || !kullanici.active) {
    redirect("/hesap-pasif");
  }

  // Ad ve rol belirteçten değil veritabanından okunur; koordinatörün yaptığı
  // ad/rol değişikliği yeni girişi beklemeden geçerli olur.
  return {
    id: kullanici.id,
    name: kullanici.name,
    email: kullanici.email,
    role: kullanici.role,
  };
}

/**
 * Koordinatör yetkisi ister. Stajyer bu fonksiyonu çağıran hiçbir sayfaya
 * veya işleme erişemez — adresi doğrudan yazsa bile.
 */
export async function koordinatorZorunlu(): Promise<OturumKullanicisi> {
  const kullanici = await girisZorunlu();

  if (kullanici.role !== "KOORDINATOR") {
    redirect("/stajyer");
  }

  return kullanici;
}

/** Stajyer paneli için. Koordinatör kendi paneline yönlendirilir. */
export async function stajyerZorunlu(): Promise<OturumKullanicisi> {
  const kullanici = await girisZorunlu();

  if (kullanici.role !== "STAJYER") {
    redirect("/koordinator");
  }

  return kullanici;
}

/** Rolün Türkçe karşılığı — arayüzde gösterim için. */
export function rolAdi(role: Role): string {
  return role === "KOORDINATOR" ? "Koordinatör" : "Stajyer";
}

/** Kullanıcının rolüne göre gideceği ana sayfa. */
export function anaSayfaYolu(role: Role): string {
  return role === "KOORDINATOR" ? "/koordinator" : "/stajyer";
}
