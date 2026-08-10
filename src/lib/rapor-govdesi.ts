import {
  asimetriBul,
  atolyeBandi,
  gelisimBandi,
  gelisimCumlesi,
  type Asimetri,
  type BantBilgisi,
} from "./rapor-bantlari";
import { kategoriOrtalamalari } from "./puan-hesaplari";
import type { SoruOrtalamasi } from "./puan-hesaplari";

/**
 * Raporun ikinci sürüm gövdesi — §11.2.
 *
 * BİRİNCİ SÜRÜMDEN FARKI: rapor artık veliye ham puan göstermiyor. Soru
 * bazlı ortalama listesi kalktı; yerine üç şey geldi — atölyenin dönem
 * boyunca ne işlediğini anlatan paragraf, kademe göstergeleri ve eğitmen
 * gözlemi.
 *
 * ESKİ RAPORLAR BOZULMAZ: gövde `surum` alanı taşıyor ve okuyan taraflar
 * (PDF, pencere) iki biçimi de tanıyor. Üretilmiş bir raporun içeriği
 * sonradan değişmemeli — PDF'i alınmış bir rapor, alındığı günkü hâlini
 * göstermeye devam etmeli (§13.17).
 */

export type KademeSatiri = {
  /** "Duygusal Gelişim Alanları" ya da atölye adı. */
  ad: string;
  bant: BantBilgisi | null;
};

export type GelisimAlaniSatiri = KademeSatiri & {
  /** Bu alanda değerlendirilen kazanım başlıkları — raporda listelenir. */
  kazanimlar: string[];
  /** Puan bandından üretilen değerlendirme cümlesi. */
  cumle: string | null;
  /** 5'lik grafik için ham ortalamalar. Eski snapshot'larda yok; PDF o
   *  durumda kademe eksenli grafiğe düşer. */
  ogrenciOrtalamasi?: number | null;
  grupOrtalamasi?: number | null;
};

export type AtolyeKademesi = {
  atolyeAdi: string;
  /** "Dersin İlgi ve Merak Alanları" ortalamasının kademesi. */
  ilgi: BantBilgisi | null;
  /** "Dersin Yetenek Gelişim Alanları" ortalamasının kademesi. */
  basari: BantBilgisi | null;
  /** 5'lik grafik için ham ortalamalar (eski snapshot'larda yok). */
  ilgiOrtalamasi?: number | null;
  basariOrtalamasi?: number | null;
  katildigiOturumSayisi: number;
  katilmadigiOturumSayisi: number;
};

export type BeceriBlogu = {
  beceriAdi: string;
  /** Sabit sözlük tanımı. */
  tanim: string;
  /** Etkinliğin anlatımı — müfredattan. */
  etkinlik: string | null;
  /** Öğrenciye özel gözlem metni. */
  gozlem: string;
};

export type GozlemBolumu = {
  /** Dönemi tanıtan giriş paragrafı. */
  giris: string;
  /** Öğrencinin genel profili. */
  profil: string;
  bloklar: BeceriBlogu[];
  sonuc: string;
  /** Ev önerileri ve varsa kulüp yönlendirmesi. */
  oneriler: string;
  /** Önerilen ürünler — metinde ad geçiyorsa bağlantı da basılır. */
  urunler: { ad: string; url: string }[];
};

export type RaporGovdesiV2 = {
  surum: 2;
  ogrenci: {
    adSoyad: string;
    ilkAd: string;
    sinif: string | null;
  };
  egitimYili: string | null;
  /** Kapağın alt satırı için şube adı. Eski snapshot'larda yok; PDF o
   *  durumda grup adına düşer. */
  subeAdi?: string | null;
  /** "Bu raporlamada ... değerlendirilen grubun öğrenci sayısı" notu için;
   *  kıyas grubundaki dönem sonu değerlendirmesi girilmiş öğrenci sayısı.
   *  Eski snapshot'larda yok; satır o durumda basılmaz. */
  grupOgrenciSayisi?: number | null;
  kapsam: { programAdi: string; grupAdi: string; tur: "Dönem" | "Kulüp" }[];
  /** Program düzeyinde üretilen atölye içerik paragrafları. */
  atolyeIcerikleri: { atolyeAdi: string; metin: string }[];
  gelisimAlanlari: GelisimAlaniSatiri[];
  atolyeKademeleri: AtolyeKademesi[];
  asimetriler: Asimetri[];
  gozlem: GozlemBolumu | null;
  /** Metnin nasıl üretildiği — denetlenebilirlik için saklanır. */
  metinKaynagi: "sablon" | "ai";
};

// ---------------------------------------------------------------------------
// Kademe çıkarımı
// ---------------------------------------------------------------------------

/**
 * Örnek raporun iki grafiği, atölye sorularının iki konu başlığına karşılık
 * geliyor. Eşleme metne göre yapılıyor çünkü başlıklar kurum tarafından
 * yazılıyor ve atölyeden atölyeye küçük farklarla yazılabiliyor.
 */
const ILGI_ANAHTARI = "ilgi";
const BASARI_ANAHTARI = "yetenek";

function kategoriBul(
  kategoriler: readonly { kategori: string; ortalama: number | null }[],
  anahtar: string,
): number | null {
  const bulunan = kategoriler.find((k) =>
    k.kategori.toLocaleLowerCase("tr-TR").includes(anahtar),
  );
  return bulunan?.ortalama ?? null;
}

/**
 * §11.2 — Bir atölyenin ilgi ve başarı kademeleri.
 *
 * Bu iki ölçüm KIYASLANMAZ (örnek rapor: "akran grubu veya sınıf içi
 * kıyaslamayı kapsamamaktadır"), bu yüzden mutlak eşiklerle değerlendirilir.
 */
export function atolyeKademesiCikar(atolye: {
  atolyeAdi: string;
  soruOrtalamalari: readonly SoruOrtalamasi[];
  katildigiOturumSayisi: number;
  katilmadigiOturumSayisi: number;
}): AtolyeKademesi {
  const kategoriler = kategoriOrtalamalari(atolye.soruOrtalamalari);
  const ilgiOrtalamasi = kategoriBul(kategoriler, ILGI_ANAHTARI);
  const basariOrtalamasi = kategoriBul(kategoriler, BASARI_ANAHTARI);

  return {
    atolyeAdi: atolye.atolyeAdi,
    ilgi: atolyeBandi(ilgiOrtalamasi),
    basari: atolyeBandi(basariOrtalamasi),
    // Ham ortalamalar 5'lik grafik için taşınır; kademe hesabı değişmez.
    ilgiOrtalamasi,
    basariOrtalamasi,
    katildigiOturumSayisi: atolye.katildigiOturumSayisi,
    katilmadigiOturumSayisi: atolye.katilmadigiOturumSayisi,
  };
}

/**
 * §11.2 — Üç gelişim alanının kademesi ve değerlendirme cümlesi.
 *
 * Bu bölüm GRUPLA KIYASLANIR; grup ortalaması yoksa (öğrenci grubun tek
 * değerlendirilmiş üyesiyse) cümle yaşıt karşılaştırması yapmaz.
 */
export function gelisimAlanlariCikar(
  ogrenciOrtalamalari: readonly {
    kategori: string;
    ortalama: number | null;
  }[],
  grupOrtalamalari: ReadonlyMap<string, number>,
  kazanimlar: ReadonlyMap<string, string[]>,
): GelisimAlaniSatiri[] {
  return ogrenciOrtalamalari.map((alan) => {
    const grupOrtalamasi = grupOrtalamalari.get(alan.kategori) ?? null;
    const bant = gelisimBandi(alan.ortalama, grupOrtalamasi);
    const alanKazanimlari = kazanimlar.get(alan.kategori) ?? [];

    return {
      ad: alan.kategori,
      bant,
      kazanimlar: alanKazanimlari,
      ogrenciOrtalamasi: alan.ortalama,
      grupOrtalamasi,
      cumle: bant
        ? gelisimCumlesi(
            bant,
            // "Duygusal Gelişim Alanları" → "duygusal beceriler"
            alan.kategori
              .replace(/Gelişim Alanları/i, "beceriler")
              .toLocaleLowerCase("tr-TR"),
            kazanimOzeti(alanKazanimlari),
            grupOrtalamasi !== null,
          )
        : null,
    };
  });
}

/**
 * Kazanım başlıklarını cümleye gömülebilecek kısa bir listeye indirger.
 *
 * Örnek rapordaki gibi tırnak içinde birkaç örnek verilir; hepsini saymak
 * cümleyi okunmaz hâle getirirdi.
 */
function kazanimOzeti(kazanimlar: readonly string[], enFazla = 4): string {
  const secilenler = kazanimlar
    .slice(0, enFazla)
    .map((k) => k.toLocaleLowerCase("tr-TR"));

  if (secilenler.length === 0) return "bu alandaki kazanımlar";
  if (secilenler.length === 1) return `"${secilenler[0]}"`;
  return `"${secilenler.slice(0, -1).join(", ")} ve ${secilenler.at(-1)}"`;
}

export { asimetriBul };
