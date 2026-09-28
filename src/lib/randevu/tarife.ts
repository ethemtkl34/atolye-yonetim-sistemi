/**
 * §17.9 — Hizmetin iki tarifesi (28 Eylül 2026).
 *
 * Kurum zam yaptığında devam eden danışanları eski fiyattan sürdürüyor. Bu
 * yüzden her hizmetin iki ücreti olabiliyor: GÜNCEL (yeni danışan) ve ESKİ
 * DANIŞAN. Randevu açan kişi hangisinin geçerli olduğunu seçiyor ve indirim
 * SEÇİLEN ücret üzerinden hesaplanıyor — indirimi hep güncel fiyattan alıp
 * eski danışana uygulamak sessizce yanlış tutar üretirdi.
 *
 * İkinci ücret BOŞ olabilir ve boş olması normal. O zaman seçilecek bir şey
 * yoktur: form tarife seçicisini hiç çizmez, ücret güncel ücrettir.
 *
 * `MEVCUT_INDIRIM` ile aynı desen: düzenlemede üçüncü bir seçenek olarak
 * "kayıtlı ücret" duruyor ve VARSAYILAN o. Gerekçe somut: randevunun ücreti
 * açılış anında kayda kopyalanıyor (fiyat değişikliği geçmişe işlemiyor);
 * formu açıp yalnız notu değiştiren kullanıcı, katalog o arada zamlandıysa
 * ücreti farkında olmadan güncellememeli.
 */

export const TARIFELER = ["guncel", "eski"] as const;
export type Tarife = (typeof TARIFELER)[number];

/** Düzenlemede: kayda yazılmış ücreti olduğu gibi koru. */
export const KAYITLI_TARIFE = "kayitli";

export type TarifeSecimi = Tarife | typeof KAYITLI_TARIFE;

/** Hizmetin tarife ücretleri; `eskiDanisanUcretKurus` yoksa tek tarife var. */
export type TarifeliHizmet = {
  ucretKurus: number;
  eskiDanisanUcretKurus: number | null;
};

/** Seçim metnini çözer; tanınmayan değer `null`. */
export function tarifeSeciminiCoz(deger: string): TarifeSecimi | null {
  if (deger === KAYITLI_TARIFE) return KAYITLI_TARIFE;
  return (TARIFELER as readonly string[]).includes(deger) ? (deger as Tarife) : null;
}

/**
 * Seçilen tarifenin ücreti.
 *
 * "eski" seçilmiş ama hizmetin ikinci ücreti yoksa `null` döner — çağıran
 * taraf bunu KESİN RET sayar. Sessizce güncel ücrete düşmek, kullanıcının
 * indirim alacağını sandığı bir randevuyu tam fiyattan açardı.
 */
export function tarifeUcreti(hizmet: TarifeliHizmet, tarife: Tarife): number | null {
  if (tarife === "guncel") return hizmet.ucretKurus;
  return hizmet.eskiDanisanUcretKurus;
}

/** Hizmette seçilecek ikinci bir tarife var mı. */
export function tarifeSecilebilirMi(hizmet: TarifeliHizmet): boolean {
  return hizmet.eskiDanisanUcretKurus !== null;
}

/**
 * Düzenlemede randevuya yazılacak BRÜT ücret.
 *
 * `kayitliBrutKurus` adı bilerek açık: `Randevu.ucretKurus` zaten BRÜT
 * saklanıyor ve indirim ayrı sütunda duruyor (net tutar okuma katmanında
 * çıkarılıyor, bkz. `hafta-verisi.ts`). Buraya "net + indirim" geçirmek
 * indirimi iki kez saymak olur ve ücret her düzenlemede indirim kadar
 * şişerdi — 28 Eylül 2026'da tam olarak bu oldu ve yerelde yakalandı.
 */
export function duzenlemeBrutUcreti(
  secim: TarifeSecimi,
  kayitliBrutKurus: number,
  hizmet: TarifeliHizmet,
): number | null {
  if (secim === KAYITLI_TARIFE) return kayitliBrutKurus;
  return tarifeUcreti(hizmet, secim);
}
