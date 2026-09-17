/**
 * Kişi bazlı randevu geçmişinin özeti — öğrenci kartı ve uzman sayfası
 * (Eylül 2026). Saf: sorgu `gecmis-verisi.ts`te, sayım burada.
 */

export type RandevuDurumu = "PLANLANDI" | "GERCEKLESTI" | "GELMEDI" | "IPTAL";

export type OzetGirdisi = {
  baslangic: Date;
  durum: RandevuDurumu;
  /** İndirim düşülmüş tutar; başka şubenin randevusunda null. */
  netUcretKurus: number | null;
};

export type GecmisOzeti = {
  toplam: number;
  gerceklesti: number;
  gelmedi: number;
  iptal: number;
  /** Henüz günü gelmemiş ya da bugünkü planlı randevular. */
  yaklasan: number;
  /** Günü geçmiş ama hâlâ "Planlandı" — işaretlenmemiş. */
  isaretsiz: number;
  /** Yalnız GERÇEKLEŞEN ve ücreti görünen seanslar (§17.5 kuralı). */
  ciroKurus: number;
};

/**
 * `bugun`: İstanbul'daki bugünün UTC gece yarısı çapası (bkz.
 * `gecmis-kilidi.ts` `istanbulBugunu`). Bugünün planlı randevusu "yaklaşan"
 * sayılır, dününki "işaretsiz".
 */
export function gecmisOzeti(satirlar: readonly OzetGirdisi[], bugun: Date): GecmisOzeti {
  const ozet: GecmisOzeti = {
    toplam: satirlar.length,
    gerceklesti: 0,
    gelmedi: 0,
    iptal: 0,
    yaklasan: 0,
    isaretsiz: 0,
    ciroKurus: 0,
  };

  for (const satir of satirlar) {
    switch (satir.durum) {
      case "GERCEKLESTI":
        ozet.gerceklesti += 1;
        ozet.ciroKurus += satir.netUcretKurus ?? 0;
        break;
      case "GELMEDI":
        ozet.gelmedi += 1;
        break;
      case "IPTAL":
        ozet.iptal += 1;
        break;
      case "PLANLANDI":
        if (satir.baslangic.getTime() < bugun.getTime()) ozet.isaretsiz += 1;
        else ozet.yaklasan += 1;
        break;
    }
  }

  return ozet;
}

/**
 * Listeyi "yaklaşan" (bugün ve sonrası, iptal hariç — en yakından uzağa) ve
 * "geçmiş" (en yeniden eskiye; iptaller tarihine göre burada) olarak ayırır.
 * İptal edilmiş gelecek randevu yaklaşanlara karışmaz: gelmeyecek bir seansı
 * "yaklaşan" diye göstermek yanıltırdı.
 */
export function gecmisiAyir<T extends { baslangic: Date; durum: RandevuDurumu }>(
  satirlar: readonly T[],
  bugun: Date,
): { yaklasan: T[]; gecmis: T[] } {
  const yaklasan = satirlar
    .filter((s) => s.durum !== "IPTAL" && s.baslangic.getTime() >= bugun.getTime())
    .sort((a, b) => a.baslangic.getTime() - b.baslangic.getTime());
  const gecmis = satirlar
    .filter((s) => !(s.durum !== "IPTAL" && s.baslangic.getTime() >= bugun.getTime()))
    .sort((a, b) => b.baslangic.getTime() - a.baslangic.getTime());
  return { yaklasan, gecmis };
}
