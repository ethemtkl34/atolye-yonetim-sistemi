import type { Role } from "@/generated/prisma/enums";

/**
 * Rollerin tek kaynağı.
 *
 * Bu dosya bilerek bağımlılıksız: `proxy.ts` (Next.js 16'da middleware'in
 * yeni adı) bunu import edebilsin diye içinde ne veritabanı ne de Auth.js
 * var. `yetki-kapisi.ts` Prisma çekiyor ve proxy'den import edilemez.
 * Modül bazlı yetkiler ayrı dosyada (`yetkiler.ts`) — burası yönlendirme ve
 * etiket, orası yetki.
 *
 * Haritalar `Record<Role, …>` — üçlü if/ternary değil. Sebebi somut: rol
 * ikiliyken (`role === "KOORDINATOR" ? … : …`) yazılmış her ternary, üçüncü
 * rol eklendiğinde SESSİZCE yanlış dalı seçiyordu. Bir yönetici "Stajyer"
 * diye etiketlenip `/stajyer`'e yönlendiriliyor, oradan geri atılıyor ve
 * sonsuz döngüye giriyordu. `Record` ile yeni bir rol eklenirse bu dosya
 * derlenmez — hata çalışma zamanında değil, derlemede çıkar. Altıncı rol
 * eklenirken bu tasarım tam olarak beklendiği gibi çalıştı.
 *
 * ADMIN ve KOORDINATOR enum değerleri eski adlarıyla duruyor (üretim
 * veritabanında enum yeniden adlandırmak gereksiz risk); görünen unvanlar
 * buradaki haritadan geliyor.
 */

export const ROL_ADLARI: Record<Role, string> = {
  ADMIN: "Kurum Yöneticisi",
  KOORDINATOR: "Atölye Koordinatörü",
  ATOLYE_PSIKOLOGU: "Atölye Psikoloğu",
  TEST_UYGULAYICISI: "Test Uygulayıcısı",
  DANISMA_GOREVLISI: "Danışma Görevlisi",
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
  ATOLYE_PSIKOLOGU: "/koordinator",
  TEST_UYGULAYICISI: "/koordinator",
  DANISMA_GOREVLISI: "/koordinator",
  STAJYER: "/stajyer",
};

/** Koordinatör panelini kullanabilen roller (STAJYER dışındaki herkes). */
export const YONETIM_ROLLERI: readonly Role[] = [
  "ADMIN",
  "KOORDINATOR",
  "ATOLYE_PSIKOLOGU",
  "TEST_UYGULAYICISI",
  "DANISMA_GOREVLISI",
];

/** Tek rolün Türkçe unvanı — rozetlerde tek tek gösterim için. */
export function rolAdi(role: Role): string {
  return ROL_ADLARI[role];
}

/**
 * Rol birleşiminin unvan etiketi: "Atölye Psikoloğu / Test Uygulayıcısı".
 * Üst şeritte ve kullanıcı listesinde çoklu unvan böyle gösterilir.
 */
export function rolEtiketi(roller: readonly Role[]): string {
  return roller.map((rol) => ROL_ADLARI[rol]).join(" / ");
}

/**
 * Kullanıcının rollerine göre gideceği ana sayfa.
 *
 * STAJYER tek başına bir rol (veritabanı CHECK'i başka rolle birleşmesini
 * engelliyor); dizide varsa stajyer paneline, yoksa koordinatör paneline.
 */
export function anaSayfaYolu(roller: readonly Role[]): string {
  return roller.includes("STAJYER") ? "/stajyer" : "/koordinator";
}

/** Koordinatör paneline girebilir mi (STAJYER dışındaki herhangi bir rol). */
export function yonetimRoluMu(roller: readonly Role[]): boolean {
  return roller.some((rol) => YONETIM_ROLLERI.includes(rol));
}
