/**
 * Öğrenci gözlem raporunun istem metni ve girdi biçimi — §11.2.B.
 *
 * Bu dosya SAF: ağ çağrısı ve ortam değişkeni bilmez, testten doğrudan
 * çağrılabilir. Çağrıyı yapan katman `ogrenci-metni.ts`.
 *
 * BU METİN VELİYE GİDİYOR. İstemdeki kuralların hepsi bunun sonucu:
 * modelin elindeki tek bilgi kaynağı gözlemcinin yazdıkları ve puanlardan
 * çıkan kademeler; ikisinde de olmayan bir davranışı yazması, olmamış bir
 * şeyi çocuğun velisine anlatmak olur (§11.3).
 */

export type OgrenciMetniGirdisi = {
  ilkAd: string;
  /** Dönem/kulüp adı ve hafta sayısı — giriş paragrafı için. */
  programAdi: string;
  haftaSayisi: number | null;
  atolyeSayisi: number;

  /** Atölye kademeleri — sayı değil, kademe adı verilir. */
  atolyeler: {
    ad: string;
    ilgi: string | null;
    basari: string | null;
  }[];

  /** Üç gelişim alanının kademesi. */
  gelisimAlanlari: { ad: string; kademe: string | null }[];

  /**
   * Gözlemcinin yazdıkları. Rapordaki her somut davranış buradan çıkar;
   * boşsa gözlem bölümü hiç üretilmez.
   */
  gozlemler: {
    atolyeAdi: string;
    hafta: number | null;
    /** O oturumda işlenen konu — gözlemi bağlama oturtur. */
    konu: string | null;
    not: string;
  }[];

  /** Koordinatörün öğrenci geneli notu. */
  genelGozlem: string | null;

  /** Raporda blok açılabilecek beceriler ve sabit tanımları. */
  beceriler: { ad: string; tanim: string }[];

  /** Sistem tarafından seçilmiş, önerilebilecek ürünler. */
  urunler: { ad: string; url: string; gerekce: string }[];
};

export const OGRENCI_METNI_TALIMATI = `Sen bir eğitim kurumunun dönem sonu veli raporunu yazan editörsün. Yazdığın metin doğrudan çocuğun velisine gidiyor.

GÖREVİN: Sana verilen gözlem notlarını ve kademe bilgilerini, veliye sunulabilir bir rapor bölümüne çevirmek.

MUTLAK KURAL — UYDURMA YASAĞI:
- Yalnızca sana verilen gözlem notlarındaki davranışları yaz. Notlarda geçmeyen hiçbir davranış, söz, olay veya tepki ekleme.
- Bir çocuğun ne söylediğini ancak notta yazıyorsa aktarabilirsin.
- Kademe bilgileri (Yüksek/Ortalama/Düşük) genel bir çerçeve verir; onlardan somut olay üretme.
- Gözlem notu az ise metni kısa tut. Az veriyle uzun yazmak uydurmaktır.

DİL:
- Üçüncü tekil şahıs, geçmiş zaman: "... gözlemlenmiştir", "... görülmüştür".
- Çocuğa yalnızca ilk adıyla hitap et.
- Profesyonel, sıcak ve gelişim odaklı. Tanı koyma, etiketleme ve kesin kişilik yargısı yok.
- Olumsuz ifade kullanma: "yapamıyor" yerine "desteklenmesinin faydalı olacağı değerlendirilmektedir".
- Abartılı övgü yok.

ÇIKTI BİÇİMİ — yalnızca şu JSON'u döndür, başka hiçbir şey yazma:
{
  "giris": "Dönemi ve programı tanıtan 3-4 cümlelik paragraf. Öğrenciden söz etme.",
  "profil": "Öğrencinin genel tutumunu anlatan 4-6 cümlelik paragraf.",
  "bloklar": [
    {
      "beceriAdi": "Sana verilen beceri listesinden birinin adı, aynen",
      "etkinlik": "İlgili etkinliğin ne amaçladığını anlatan 2-3 cümle. Yalnızca gözlem notundaki konuyu kullan.",
      "gozlem": "Öğrencinin o etkinlikteki davranışı, 4-6 cümle. Yalnızca gözlem notundakiler."
    }
  ],
  "sonuc": "Süreci özetleyen 3-4 cümlelik kapanış paragrafı.",
  "oneriler": "Ev ortamında yapılabilecekler, 3-5 cümle."
}

BLOKLAR HAKKINDA:
- En fazla 4 blok yaz. Her blok için yeterli gözlem notu olmalı; yoksa o bloğu hiç açma.
- "beceriAdi" değeri sana verilen beceri listesinden BİREBİR alınmalı.

ÜRÜN ÖNERİSİ:
- "oneriler" içinde ürün adı geçirebilirsin, ama YALNIZCA sana verilen ürün listesinden. Listede olmayan bir ürün, kitap veya oyun adı yazma.
- Liste boşsa ürün adı hiç verme; bunun yerine tema düzeyinde öneri yaz ("paylaşma ve birlikte başarma temalı hikâyelerin birlikte okunması" gibi).`;

/** Kademe bilgisini modele verilen satıra çevirir. */
function kademeSatiri(ad: string, kademe: string | null): string {
  return `${ad}: ${kademe ?? "değerlendirilmedi"}`;
}

export function ogrenciMetniGirdisiYaz(girdi: OgrenciMetniGirdisi): string {
  const bolumler: string[] = [
    `ÖĞRENCİ: ${girdi.ilkAd}`,
    `PROGRAM: ${girdi.programAdi}${girdi.haftaSayisi ? ` (${girdi.haftaSayisi} hafta)` : ""}, ${girdi.atolyeSayisi} atölye`,
  ];

  bolumler.push(
    "",
    "ATÖLYE KADEMELERİ (ilgi / başarı):",
    ...girdi.atolyeler.map(
      (a) =>
        `- ${a.ad}: ilgi ${a.ilgi ?? "değerlendirilmedi"}, başarı ${a.basari ?? "değerlendirilmedi"}`,
    ),
  );

  bolumler.push(
    "",
    "GELİŞİM ALANLARI:",
    ...girdi.gelisimAlanlari.map((a) => `- ${kademeSatiri(a.ad, a.kademe)}`),
  );

  bolumler.push(
    "",
    "AÇILABİLECEK BECERİ BAŞLIKLARI VE TANIMLARI:",
    ...girdi.beceriler.map((b) => `- ${b.ad}: ${b.tanim}`),
  );

  // Gözlem notları en sona konuyor: modelin en son okuduğu ve en çok
  // ağırlık verdiği bölüm, metnin tek gerçek kaynağı olmalı.
  bolumler.push("", "GÖZLEM NOTLARI (metnin tek somut kaynağı):");
  if (girdi.genelGozlem) {
    bolumler.push(`[Genel] ${girdi.genelGozlem}`);
  }
  for (const gozlem of girdi.gozlemler) {
    const baslik = [
      gozlem.atolyeAdi,
      gozlem.hafta ? `${gozlem.hafta}. hafta` : null,
      gozlem.konu,
    ]
      .filter(Boolean)
      .join(" · ");
    bolumler.push(`[${baslik}] ${gozlem.not}`);
  }

  bolumler.push(
    "",
    "ÖNERİLEBİLECEK ÜRÜNLER:",
    girdi.urunler.length > 0
      ? girdi.urunler.map((u) => `- ${u.ad} (${u.gerekce})`).join("\n")
      : "(uygun ürün yok — ürün adı verme, tema düzeyinde öneri yaz)",
  );

  return bolumler.join("\n");
}

export type OgrenciMetni = {
  giris: string;
  profil: string;
  bloklar: { beceriAdi: string; etkinlik: string; gozlem: string }[];
  sonuc: string;
  oneriler: string;
};

/**
 * Modelin JSON çıktısını güvenle çözümler.
 *
 * Model bazen JSON'u ``` çitleri arasına koyuyor; bu yüzden ilk `{` ile son
 * `}` arası alınıyor. Beklenen alanlardan biri eksikse `null` dönülür ve
 * çağıran şablon metnine düşer — yarım bir rapor basmaktansa şablon daha
 * dürüst.
 */
export function ogrenciMetniCozumle(ham: string): OgrenciMetni | null {
  const bas = ham.indexOf("{");
  const son = ham.lastIndexOf("}");
  if (bas < 0 || son <= bas) return null;

  let cozulen: unknown;
  try {
    cozulen = JSON.parse(ham.slice(bas, son + 1));
  } catch {
    return null;
  }

  if (typeof cozulen !== "object" || cozulen === null) return null;
  const nesne = cozulen as Record<string, unknown>;

  const metin = (anahtar: string): string | null =>
    typeof nesne[anahtar] === "string" && (nesne[anahtar] as string).trim()
      ? (nesne[anahtar] as string).trim()
      : null;

  const giris = metin("giris");
  const profil = metin("profil");
  const sonuc = metin("sonuc");
  const oneriler = metin("oneriler");

  if (!giris || !profil || !sonuc || !oneriler) return null;

  const hamBloklar = Array.isArray(nesne.bloklar) ? nesne.bloklar : [];
  const bloklar = hamBloklar
    .filter(
      (blok): blok is { beceriAdi: string; etkinlik: string; gozlem: string } =>
        typeof blok === "object" &&
        blok !== null &&
        typeof (blok as Record<string, unknown>).beceriAdi === "string" &&
        typeof (blok as Record<string, unknown>).gozlem === "string",
    )
    .map((blok) => ({
      beceriAdi: blok.beceriAdi.trim(),
      etkinlik: (blok.etkinlik ?? "").trim(),
      gozlem: blok.gozlem.trim(),
    }))
    .filter((blok) => blok.gozlem.length > 0);

  return { giris, profil, bloklar, sonuc, oneriler };
}

/**
 * Gözlem notu olmadan bu bölüm üretilmez.
 *
 * Kademe bilgileri tek başına yalnızca "yüksek/ortalama" der; onlardan
 * yazılan bir gözlem raporu, gözlemlenmemiş davranışları anlatmak olur.
 */
export function gozlemYeterliMi(girdi: OgrenciMetniGirdisi): boolean {
  const toplamUzunluk =
    (girdi.genelGozlem?.trim().length ?? 0) +
    girdi.gozlemler.reduce((toplam, g) => toplam + g.not.trim().length, 0);

  return toplamUzunluk >= 120;
}
