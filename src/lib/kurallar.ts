/**
 * Ürünün sayısal iş kuralları (docs/PROJECT_SPEC.md §13).
 *
 * Bu değerler hem sunucu işlemlerinde hem arayüzde kullanılıyor. Ayrı bir
 * dosyada duruyorlar çünkü `"use server"` işaretli dosyalar yalnızca async
 * fonksiyon dışa aktarabilir; sabitleri oraya koymak derlemeyi bozar.
 */

/**
 * Programın hafta sayısı SABİT DEĞİL.
 *
 * §13.1 "bir dönem tam olarak 10 hafta" diyordu ve sistem bunu zorluyordu.
 * Kurum pratikte farklı uzunlukta programlar açıyor — 6 haftalık bir kulüp,
 * 30 haftalık bir dönem — ve müfredat buna göre değişiyor. Sayı artık
 * koordinatörün kararı; aşağıdakiler yalnızca varsayılan ve makul sınırlar.
 *
 * Üst sınır bir yıl: daha uzun bir "program" pratikte iki ayrı programdır ve
 * kazara 300 hafta seçilmesi 1500 oturum üretirdi.
 */
export const VARSAYILAN_HAFTA_SAYISI = 10;
export const EN_AZ_HAFTA = 1;
export const EN_FAZLA_HAFTA = 52;

/** §13.2 — Bir dönem grubunda her eğitim gününde 5 atölye yapılır. */
export const DONEM_ATOLYE_SAYISI = 5;

/** §13.6 — Bir kulüp tek yarım gün sürer ve 3 atölye içerir. */
export const KULUP_ATOLYE_SAYISI = 3;

/**
 * §11.5 — PDF raporda ve belge üst bilgisinde görünen kurum adı.
 * Kurumun resmî yazımı P12'de (yayına alma) teyit edilecek.
 */
export const KURUM_ADI = "TÜZDER";

/** §10.3 — Puanlama ölçeğinin alt ve üst sınırı. */
export const EN_DUSUK_PUAN = 1;
export const EN_YUKSEK_PUAN = 5;
