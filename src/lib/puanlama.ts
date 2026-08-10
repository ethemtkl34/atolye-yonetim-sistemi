import { EN_DUSUK_PUAN, EN_YUKSEK_PUAN } from "./kurallar";

/**
 * Puanlama formunun kuralları — §10.
 *
 * `puan-hesaplari.ts` puanlardan ortalama üretir; bu dosya ise bir formun doldurulmuş
 * sayılıp sayılmadığına ve gönderilen cevabın geçerliliğine karar verir. İkisi
 * de saf: veritabanı bilmezler, hem sunucu eylemlerinden hem testlerden aynı
 * şekilde çağrılırlar. Aynı kararı ikinci bir yerde tekrar yazmak yasak —
 * arayüzdeki rozet ile sunucudaki doğrulama aynı fonksiyondan çıkmalı ki
 * "ekranda tamam görünüyor ama kayıt eksik" durumu oluşamasın.
 */

/** Formda "Değerlendirilemedi" seçeneğinin taşıdığı değer. */
export const DEGERLENDIRILEMEDI = "degerlendirilemedi";

export type PuanlamaDurumu =
  /** Hiç form açılmamış. */
  | "BOS"
  /** §10.2 — Katılmadı işaretlenmiş; soru cevaplanmaz. */
  | "KATILMADI"
  /** §10.3 — Katıldı ve bütün aktif sorular cevaplanmış. */
  | "TAMAM"
  /** Katıldı ama cevaplanmamış soru var. */
  | "EKSIK";

export const PUANLAMA_DURUM_ETIKETLERI: Record<
  PuanlamaDurumu,
  { etiket: string; rozet: "notr" | "olumlu" | "uyari" | "pasif" }
> = {
  BOS: { etiket: "Doldurulmadı", rozet: "uyari" },
  KATILMADI: { etiket: "Katılmadı", rozet: "pasif" },
  TAMAM: { etiket: "Dolduruldu", rozet: "olumlu" },
  EKSIK: { etiket: "Eksik", rozet: "uyari" },
};

export type PuanlamaOzeti = {
  attended: boolean;
  /** Bu puanlamada cevap satırı yazılmış soruların kimlikleri. */
  cevaplananSoruIdleri: readonly string[];
};

/**
 * Bir oturum formunun durumunu belirler.
 *
 * Karşılaştırma sayı üzerinden değil, soru kimlikleri üzerinden yapılır:
 * koordinatör bir soruyu pasife alıp yerine yenisini eklediğinde sayı aynı
 * kalabilir ama form gerçekte eksiktir. Sonradan eklenen soru geçmiş formu
 * "Eksik" durumuna düşürür; §10.3 katıldığı atölyede bütün soruların
 * cevaplanmasını istediği için bu bilinçli — stajyer eksik kalanı görüp
 * tamamlayabilir.
 *
 * Aktif sorusu olmayan bir atölyede cevaplanacak bir şey yoktur; katıldı
 * işaretlenmiş form tamam sayılır.
 */
export function puanlamaDurumu(
  puanlama: PuanlamaOzeti | null,
  aktifSoruIdleri: readonly string[],
): PuanlamaDurumu {
  if (!puanlama) return "BOS";
  if (!puanlama.attended) return "KATILMADI";

  const cevaplanan = new Set(puanlama.cevaplananSoruIdleri);
  return aktifSoruIdleri.every((id) => cevaplanan.has(id)) ? "TAMAM" : "EKSIK";
}

export type GorevOzeti = {
  toplam: number;
  /** §12.3 — Doldurulmamış formlar: hiç açılmamış veya eksik kalmış. */
  bekleyen: number;
  dolduruldu: number;
  katilmadi: number;
  /** Bekleyen form kalmadıysa true. */
  tamamlandi: boolean;
};

/** Bir günün ya da bir kaydın form durumlarını tek satırlık özete indirger. */
export function gorevOzeti(durumlar: readonly PuanlamaDurumu[]): GorevOzeti {
  const bekleyen = durumlar.filter((d) => d === "BOS" || d === "EKSIK").length;

  return {
    toplam: durumlar.length,
    bekleyen,
    dolduruldu: durumlar.filter((d) => d === "TAMAM").length,
    katilmadi: durumlar.filter((d) => d === "KATILMADI").length,
    tamamlandi: durumlar.length > 0 && bekleyen === 0,
  };
}

export type CevapCozumu =
  | { gecerli: true; deger: number | null }
  | { gecerli: false };

/**
 * §10.3 — Formdan gelen tek bir cevabı çözümler.
 *
 * Geçerli girdiler: "degerlendirilemedi" ve 1–5 arası tam sayılar.
 * "Değerlendirilemedi" `null` değere dönüşür; bu "cevap yok" değil, "davranış
 * gözlemlenemedi" demektir ve ortalamaya girmez (§10.4). Boş gönderim
 * geçersizdir — katıldı işaretli formda soru boş bırakılamaz.
 */
export function cevapCozumle(ham: unknown): CevapCozumu {
  if (ham === DEGERLENDIRILEMEDI) return { gecerli: true, deger: null };
  if (typeof ham !== "string" || ham.trim() === "") return { gecerli: false };

  const sayi = Number(ham);
  if (!Number.isInteger(sayi)) return { gecerli: false };
  if (sayi < EN_DUSUK_PUAN || sayi > EN_YUKSEK_PUAN) return { gecerli: false };

  return { gecerli: true, deger: sayi };
}

export type SoruGirdisi = {
  id: string;
  text: string;
  /** Kısa başlık (örn. "Duygu Düzenleme"); tek parçalı sorularda null. */
  title: string | null;
  /** Konu başlığı (örn. "İlgi ve Merak Alanları"). */
  category: string | null;
  sortOrder: number;
};

export type MevcutCevap = {
  id: string;
  questionId: string | null;
  questionTextSnapshot: string;
  titleSnapshot: string | null;
  categorySnapshot: string | null;
  value: number | null;
  sortOrder: number;
};

export type FormSatiri = {
  /** Form alanı adı ve sunucu tarafındaki eşleşme anahtarı. */
  anahtar: string;
  questionId: string | null;
  /** Ekranda gösterilecek metin: geçmiş cevap varsa o günkü soru metni. */
  metin: string;
  /** Kısa başlık: geçmiş cevap varsa o günkü, yoksa güncel. */
  baslik: string | null;
  /** Konu başlığı; form bu alana göre bölümlere ayrılır. */
  kategori: string | null;
  /** Soru sonradan düzenlendiyse güncel metin, yoksa null. */
  guncelMetin: string | null;
  /** Kaydedilecek snapshot — mevcut cevabınki korunur (§13.14). */
  kaydedilecekMetin: string;
  kaydedilecekBaslik: string | null;
  kaydedilecekKategori: string | null;
  sortOrder: number;
  mevcutDeger: number | null;
  cevaplandi: boolean;
  /** Soru pasife alınmış ama geçmiş cevabı duruyorsa false. */
  aktif: boolean;
};

/**
 * Formun satırlarını üretir — hem ekran hem sunucu doğrulaması bunu kullanır.
 *
 * İki kaynak birleştirilir:
 *   1. Atölyenin şu anki aktif soruları (cevaplanması zorunlu olanlar),
 *   2. Bu formda zaten cevabı bulunan sorular (soru sonradan pasife alınmış
 *      veya silinmiş olsa bile).
 *
 * İkinci grup korunur çünkü geçmiş değerlendirme silinmemeli; formda görünür
 * ama sonuna alınır ve pasif olduğu belirtilir.
 *
 * §13.14 — Zaten cevabı olan satırın snapshot metni değişmez. Koordinatör soru
 * metnini sonradan düzelttiyse form o günkü metni gösterir; güncel metin
 * yalnızca bilgi olarak yanına yazılır. Yeni açılan satırlar bugünkü metni alır.
 */
export function formSatirlariOlustur(
  aktifSorular: readonly SoruGirdisi[],
  mevcutCevaplar: readonly MevcutCevap[],
): FormSatiri[] {
  const cevapHaritasi = new Map<string, MevcutCevap>();
  for (const cevap of mevcutCevaplar) {
    if (cevap.questionId) cevapHaritasi.set(cevap.questionId, cevap);
  }

  const aktifSatirlar: FormSatiri[] = aktifSorular.map((soru) => {
    const cevap = cevapHaritasi.get(soru.id);

    return {
      anahtar: `q:${soru.id}`,
      questionId: soru.id,
      metin: cevap?.questionTextSnapshot ?? soru.text,
      baslik: cevap ? cevap.titleSnapshot : soru.title,
      kategori: cevap ? cevap.categorySnapshot : soru.category,
      guncelMetin:
        cevap && cevap.questionTextSnapshot !== soru.text ? soru.text : null,
      kaydedilecekMetin: cevap?.questionTextSnapshot ?? soru.text,
      kaydedilecekBaslik: cevap ? cevap.titleSnapshot : soru.title,
      kaydedilecekKategori: cevap ? cevap.categorySnapshot : soru.category,
      sortOrder: soru.sortOrder,
      mevcutDeger: cevap?.value ?? null,
      cevaplandi: Boolean(cevap),
      aktif: true,
    };
  });

  const aktifIdler = new Set(aktifSorular.map((soru) => soru.id));

  const pasifSatirlar: FormSatiri[] = mevcutCevaplar
    .filter((cevap) => !cevap.questionId || !aktifIdler.has(cevap.questionId))
    .map((cevap) => ({
      // Soru büsbütün silinmişse kimlik kalmaz; satır kendi kimliğiyle anılır.
      anahtar: cevap.questionId ? `q:${cevap.questionId}` : `a:${cevap.id}`,
      questionId: cevap.questionId,
      metin: cevap.questionTextSnapshot,
      baslik: cevap.titleSnapshot,
      kategori: cevap.categorySnapshot,
      guncelMetin: null,
      kaydedilecekMetin: cevap.questionTextSnapshot,
      kaydedilecekBaslik: cevap.titleSnapshot,
      kaydedilecekKategori: cevap.categorySnapshot,
      sortOrder: cevap.sortOrder,
      mevcutDeger: cevap.value,
      cevaplandi: true,
      aktif: false,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return [
    ...aktifSatirlar.sort((a, b) => a.sortOrder - b.sortOrder),
    ...pasifSatirlar,
  ];
}

/**
 * Henüz yapılmamış bir atölye puanlanamaz.
 *
 * §10.5 puanlama için son tarih koymuyor ama başlangıç tarihi de gerekmiyor
 * demiyor: oturumlar grup açılırken 10 hafta boyunca önden üretiliyor, yani
 * gelecek haftaların formları da veritabanında duruyor. Gözlenmemiş bir
 * davranışı puanlamak mümkün olmadığı için gelecek tarihli oturumların formu
 * kilitli gösterilir; oturum günü geldiğinde kendiliğinden açılır.
 */
export function oturumPuanlanabilirMi(oturumTarihi: Date, bugun: Date): boolean {
  return oturumTarihi.getTime() <= bugun.getTime();
}
