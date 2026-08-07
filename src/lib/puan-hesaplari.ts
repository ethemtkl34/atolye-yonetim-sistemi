/**
 * Puan ortalamalarının ve biçimlemesinin tek kaynağı.
 *
 * Buradaki fonksiyonların hepsi saf (pure) — veritabanı bilmezler, yalnızca
 * verilen veriyi hesaplarlar. Böylece hem sunucu bileşenlerinden hem de
 * testlerden aynı şekilde çağrılabilirler. Ortalama hesabı yapan başka bir
 * yer olmamalı; her ekran ve rapor motoru buradan okur.
 *
 * Kurallar: docs/PROJECT_SPEC.md §10 (puanlama) ve §11 (raporlama).
 */

/** §10.4 — Puan seçenekleri ve anlamları. */
export const PUAN_ACIKLAMALARI: Record<number, string> = {
  1: "Davranışı henüz gerçekleştiremedi.",
  2: "Yoğun yönlendirmeyle gerçekleştirdi.",
  3: "Kısmen veya zaman zaman gerçekleştirdi.",
  4: "Büyük ölçüde bağımsız gerçekleştirdi.",
  5: "Sürekli ve bağımsız gerçekleştirdi.",
};

export const DEGERLENDIRILEMEDI_ACIKLAMA =
  "İlgili davranış bu atölyede gözlemlenemedi. Ortalamaya dahil edilmez.";

export type CevapGirdisi = {
  /** Soru silinmişse null olabilir; gruplama metne düşer. */
  questionId: string | null;
  /** §13.14 — Puanlama anındaki soru metni. */
  questionTextSnapshot: string;
  /** §10.3 — 1–5 arası puan; null = Değerlendirilemedi. */
  value: number | null;
  sortOrder: number;
};

export type PuanlamaGirdisi = {
  /** §10.2 — Katılmadıysa hiçbir ortalamaya girmez. */
  attended: boolean;
  answers: CevapGirdisi[];
};

/**
 * Sayı listesinin ortalamasını alır; `null` değerler (Değerlendirilemedi)
 * hesaba katılmaz. Hesaplanacak hiç değer yoksa `null` döner — bu "ortalama
 * 0" demek DEĞİLDİR, "ortalama hesaplanamaz" demektir. Rapor metni bu ayrımı
 * kullanır (§11.3: Değerlendirilemedi olumsuz puan gibi yorumlanmamalıdır).
 */
export function ortalama(degerler: readonly (number | null)[]): number | null {
  const gecerli = degerler.filter((d): d is number => d !== null);
  if (gecerli.length === 0) return null;
  const toplam = gecerli.reduce((a, b) => a + b, 0);
  return toplam / gecerli.length;
}

/**
 * Tek bir atölye oturumunun ortalaması.
 * §10.2 — Katılmadıysa puan yoktur, ortalama hesaplanmaz.
 */
export function puanlamaOrtalamasi(
  puanlama: PuanlamaGirdisi,
): number | null {
  if (!puanlama.attended) return null;
  return ortalama(puanlama.answers.map((c) => c.value));
}

export type SoruOrtalamasi = {
  /** Soru silinmiş olabileceği için anahtar metne de düşebilir. */
  anahtar: string;
  soruMetni: string;
  ortalama: number | null;
  /** Bu soruya kaç oturumda gerçek puan verildi (Değerlendirilemedi hariç). */
  puanlananOturumSayisi: number;
  /**
   * Geçerli puanların toplamı. Rapor motoru atölyeler arası birleşimlerde
   * ortalamaların ortalamasını değil, bu toplamlar üzerinden ağırlıklı
   * ortalamayı kullanır — az cevaplanmış bir soru çok cevaplanmışla eşit
   * ağırlık taşımamalı (aşağıdaki genel ortalama kuralıyla aynı ilke).
   */
  puanToplami: number;
  sortOrder: number;
};

export type AtolyeOzeti = {
  katildigiOturumSayisi: number;
  katilmadigiOturumSayisi: number;
  /** §11.2 — Değerlendirilen soru sayısı (en az bir kez puan almış sorular). */
  degerlendirilenSoruSayisi: number;
  soruOrtalamalari: SoruOrtalamasi[];
  /** Atölyenin genel ortalaması; hiç puan yoksa null. */
  genelOrtalama: number | null;
};

/**
 * §11.2.A — Bir atölyenin bütün oturumlarını tek bir özete indirger.
 *
 * Katılmadığı oturumlar sayılır ama hiçbir ortalamaya girmez (§13.12).
 * Soru bazlı ortalamalar `questionId` üzerinden gruplanır; soru silinmişse
 * korunan metin anahtar olur, böylece geçmiş bozulmaz.
 */
export function atolyeOzetiHesapla(
  puanlamalar: readonly PuanlamaGirdisi[],
): AtolyeOzeti {
  const katilinan = puanlamalar.filter((p) => p.attended);
  const katilinmayan = puanlamalar.filter((p) => !p.attended);

  const soruGruplari = new Map<
    string,
    { metin: string; degerler: (number | null)[]; sortOrder: number }
  >();

  for (const puanlama of katilinan) {
    for (const cevap of puanlama.answers) {
      const anahtar = cevap.questionId ?? `metin:${cevap.questionTextSnapshot}`;
      const mevcut = soruGruplari.get(anahtar);
      if (mevcut) {
        mevcut.degerler.push(cevap.value);
      } else {
        soruGruplari.set(anahtar, {
          metin: cevap.questionTextSnapshot,
          degerler: [cevap.value],
          sortOrder: cevap.sortOrder,
        });
      }
    }
  }

  const soruOrtalamalari: SoruOrtalamasi[] = [...soruGruplari.entries()]
    .map(([anahtar, grup]) => {
      const gecerli = grup.degerler.filter((d): d is number => d !== null);
      return {
        anahtar,
        soruMetni: grup.metin,
        ortalama: ortalama(grup.degerler),
        puanlananOturumSayisi: gecerli.length,
        puanToplami: gecerli.reduce((a, b) => a + b, 0),
        sortOrder: grup.sortOrder,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Genel ortalama bütün geçerli puanlar üzerinden alınır; soru ortalamalarının
  // ortalaması değil. Aksi halde az cevaplanmış bir soru, çok cevaplanmış bir
  // soruyla eşit ağırlık taşırdı.
  const tumDegerler = katilinan.flatMap((p) => p.answers.map((c) => c.value));

  return {
    katildigiOturumSayisi: katilinan.length,
    katilmadigiOturumSayisi: katilinmayan.length,
    degerlendirilenSoruSayisi: soruOrtalamalari.filter(
      (s) => s.puanlananOturumSayisi > 0,
    ).length,
    soruOrtalamalari,
    genelOrtalama: ortalama(tumDegerler),
  };
}

/**
 * Ortalamayı Türkçe biçimde metne çevirir: ondalık ayırıcı virgül,
 * tek basamak. Hesaplanamayan ortalama için tire döner.
 *
 *   ortalamaBicimle(4.28) === "4,3"
 *   ortalamaBicimle(null) === "—"
 */
export function ortalamaBicimle(deger: number | null): string {
  if (deger === null) return "—";
  return deger.toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
