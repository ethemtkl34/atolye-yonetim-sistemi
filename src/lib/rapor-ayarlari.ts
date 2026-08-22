import { db } from "./db";
import {
  KADEMELER,
  VARSAYILAN_ESIKLER,
  type Kademe,
  type RaporEsikleri,
} from "./rapor-bantlari";

/**
 * §11.2 — Rapor eşiklerinin veri katmanı.
 *
 * `rapor-bantlari.ts` saf kalsın diye tablo erişimi buraya alındı. Tek satır
 * var (`id = "tek"`); satır hiç yoksa koddaki varsayılanlar geçerlidir, yani
 * ayar sayfası hiç açılmadan da sistem çalışır ve migration ile deploy
 * arasındaki pencerede davranış değişmez.
 *
 * ŞUBE YOK: rapor kurumun belgesi, iki şubede aynı ölçütle okunmalı (atölye
 * kataloğu ve soru setiyle aynı gerekçe).
 */

/** Ayar satırının tek kimliği. */
const TEK = "tek";

/**
 * Sayısal alanların kabul aralığı — hem sunucu eylemi hem de okuma bu
 * sınırları kullanır. Aralık dışı bir değer tabloya elle yazılmışsa okuma
 * onu varsayılana düşürür: rapor motoru hiçbir zaman anlamsız bir eşikle
 * (örn. negatif ya da 5'in üstünde) çalışmamalı.
 */
export const ESIK_SINIRLARI = {
  atolyeYuksek: { enAz: 1, enFazla: 5 },
  atolyeDusuk: { enAz: 1, enFazla: 5 },
  gelisimFark: { enAz: 0.05, enFazla: 2 },
  gelisimIlerleme: { enAz: 0.05, enFazla: 2 },
  asimetri: { enAz: 0.1, enFazla: 4 },
  kiyasAsgariOgrenci: { enAz: 2, enFazla: 30 },
} as const;

function aralikta(
  deger: number,
  sinir: { enAz: number; enFazla: number },
  varsayilan: number,
): number {
  return Number.isFinite(deger) && deger >= sinir.enAz && deger <= sinir.enFazla
    ? deger
    : varsayilan;
}

/** Boş bırakılmış etiket varsayılan adına döner; hiçbir kademe adsız kalmaz. */
function etiket(deger: string | undefined, kademe: Kademe): string {
  return deger?.trim() || KADEMELER[kademe].etiket;
}

export type RaporAyariGorunumu = RaporEsikleri & {
  /** Tabloda kayıt var mı — arayüz "varsayılanlar kullanılıyor" diyebilsin. */
  kayitliMi: boolean;
  guncellemeZamani: Date | null;
  guncelleyen: string | null;
};

/** Rapor üretiminin kullandığı eşikler; satır yoksa varsayılanlar. */
export async function raporEsikleriOku(): Promise<RaporEsikleri> {
  const g = await raporAyariOku();
  return {
    atolyeYuksek: g.atolyeYuksek,
    atolyeDusuk: g.atolyeDusuk,
    gelisimFark: g.gelisimFark,
    gelisimIlerleme: g.gelisimIlerleme,
    asimetri: g.asimetri,
    kiyasAsgariOgrenci: g.kiyasAsgariOgrenci,
    etiketler: g.etiketler,
  };
}

/** Ayar sayfasının okuduğu tam görünüm (eşikler + kim/ne zaman). */
export async function raporAyariOku(): Promise<RaporAyariGorunumu> {
  const satir = await db.raporAyari.findUnique({
    where: { id: TEK },
    select: {
      atolyeYuksekEsigi: true,
      atolyeDusukEsigi: true,
      gelisimFarkEsigi: true,
      gelisimIlerlemeEsigi: true,
      asimetriEsigi: true,
      kiyasAsgariOgrenci: true,
      etiketYuksek: true,
      etiketOrtalama: true,
      etiketDusuk: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });

  if (!satir) {
    return {
      ...VARSAYILAN_ESIKLER,
      kayitliMi: false,
      guncellemeZamani: null,
      guncelleyen: null,
    };
  }

  // "Yüksek eşiği düşük eşiğinin altında" gibi bir satır tabloya elle
  // yazılmışsa kademe hesabı sessizce tersine dönerdi; okuma sırasında
  // düzeltilir (yazma tarafı da aynı kuralı doğruluyor).
  const yuksek = aralikta(
    satir.atolyeYuksekEsigi,
    ESIK_SINIRLARI.atolyeYuksek,
    VARSAYILAN_ESIKLER.atolyeYuksek,
  );
  const dusukHam = aralikta(
    satir.atolyeDusukEsigi,
    ESIK_SINIRLARI.atolyeDusuk,
    VARSAYILAN_ESIKLER.atolyeDusuk,
  );

  return {
    atolyeYuksek: yuksek,
    atolyeDusuk: dusukHam <= yuksek ? dusukHam : VARSAYILAN_ESIKLER.atolyeDusuk,
    gelisimFark: aralikta(
      satir.gelisimFarkEsigi,
      ESIK_SINIRLARI.gelisimFark,
      VARSAYILAN_ESIKLER.gelisimFark,
    ),
    gelisimIlerleme: aralikta(
      satir.gelisimIlerlemeEsigi,
      ESIK_SINIRLARI.gelisimIlerleme,
      VARSAYILAN_ESIKLER.gelisimIlerleme,
    ),
    asimetri: aralikta(
      satir.asimetriEsigi,
      ESIK_SINIRLARI.asimetri,
      VARSAYILAN_ESIKLER.asimetri,
    ),
    kiyasAsgariOgrenci: aralikta(
      satir.kiyasAsgariOgrenci,
      ESIK_SINIRLARI.kiyasAsgariOgrenci,
      VARSAYILAN_ESIKLER.kiyasAsgariOgrenci,
    ),
    etiketler: {
      YUKSEK: etiket(satir.etiketYuksek, "YUKSEK"),
      ORTALAMA: etiket(satir.etiketOrtalama, "ORTALAMA"),
      DUSUK: etiket(satir.etiketDusuk, "DUSUK"),
    },
    kayitliMi: true,
    guncellemeZamani: satir.updatedAt,
    guncelleyen: satir.updatedBy?.name ?? null,
  };
}

/** Ayar satırını açar ya da günceller. */
export async function raporAyariYaz(
  esikler: RaporEsikleri,
  kullaniciId: string,
): Promise<void> {
  const veri = {
    atolyeYuksekEsigi: esikler.atolyeYuksek,
    atolyeDusukEsigi: esikler.atolyeDusuk,
    gelisimFarkEsigi: esikler.gelisimFark,
    gelisimIlerlemeEsigi: esikler.gelisimIlerleme,
    asimetriEsigi: esikler.asimetri,
    kiyasAsgariOgrenci: esikler.kiyasAsgariOgrenci,
    etiketYuksek: esikler.etiketler.YUKSEK,
    etiketOrtalama: esikler.etiketler.ORTALAMA,
    etiketDusuk: esikler.etiketler.DUSUK,
    updatedByUserId: kullaniciId,
  };

  await db.raporAyari.upsert({
    where: { id: TEK },
    create: { id: TEK, ...veri },
    update: veri,
  });
}
