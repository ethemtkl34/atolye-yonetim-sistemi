import type { Role } from "@/generated/prisma/enums";

/**
 * Rollerin tek kaynağı.
 *
 * Bu dosya bilerek bağımlılıksız: `proxy.ts` (Next.js 16'da middleware'in
 * yeni adı) bunu import edebilsin diye içinde ne veritabanı ne de Auth.js
 * var. `auth-guard.ts` Prisma çekiyor ve proxy'den import edilemez.
 *
 * Haritalar `Record<Role, …>` — üçlü if/ternary değil. Sebebi somut: rol
 * ikiliyken (`role === "KOORDINATOR" ? … : …`) yazılmış her ternary, üçüncü
 * rol eklendiğinde SESSİZCE yanlış dalı seçiyordu. Bir yönetici "Stajyer"
 * diye etiketlenip `/stajyer`'e yönlendiriliyor, oradan geri atılıyor ve
 * sonsuz döngüye giriyordu. `Record` ile dördüncü bir rol eklenirse bu
 * dosya derlenmez — hata çalışma zamanında değil, derlemede çıkar.
 */

export const ROL_ADLARI: Record<Role, string> = {
  ADMIN: "Yönetici",
  KOORDINATOR: "Koordinatör",
  STAJYER: "Stajyer",
};

/**
 * Her rolün kendi alanı.
 *
 * Yönlendirme döngüsünü imkânsız kılan değişmez kural: "yanlış alandasın"
 * yönlendirmeleri her zaman buradaki adrese gider ve her rol, kendisine
 * verilen adrese girebilir. İki taraf da birbirine atarsa döngü olur;
 * bu tablo tek yön olduğu için olamaz.
 */
export const ANA_SAYFA_YOLLARI: Record<Role, string> = {
  ADMIN: "/koordinator",
  KOORDINATOR: "/koordinator",
  STAJYER: "/stajyer",
};

/** Koordinatör panelini kullanabilen roller. */
export const YONETIM_ROLLERI: readonly Role[] = ["ADMIN", "KOORDINATOR"];

/** Rolün Türkçe karşılığı — arayüzde gösterim için. */
export function rolAdi(role: Role): string {
  return ROL_ADLARI[role];
}

/** Kullanıcının rolüne göre gideceği ana sayfa. */
export function anaSayfaYolu(role: Role): string {
  return ANA_SAYFA_YOLLARI[role];
}

/** Koordinatör paneline girebilir mi (koordinatör veya yönetici). */
export function yonetimRoluMu(role: Role): boolean {
  return YONETIM_ROLLERI.includes(role);
}
