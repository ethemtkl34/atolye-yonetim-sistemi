import type { Day } from "@/generated/prisma/enums";
import { gunundenGun } from "@/lib/tarih";

/**
 * §17.4 — "Program" ızgara görünümünün yerleşim hesabı.
 *
 * SAF: veritabanına gitmiyor, çağıran taraf o güne ait uzman/mesai/izin/
 * randevu satırlarını okuyup buraya veriyor. Bu modül HİÇBİR ŞEYİ reddetmez —
 * mesai dışına taşan ya da izinle çakışan randevu da olduğu gibi yerleştirilir.
 * "Bu saate randevu açılabilir mi" kararı yalnız yazma anında `cakisma.ts`'te
 * verilir; burada amaç sadece var olan veriyi dakika ekseninde konumlamak.
 */

const GUN_MS = 24 * 60 * 60 * 1000;

/** Dakika cinsinden bir zaman aralığı — gün başlangıcından itibaren. */
export type IzgaraBlok = { baslangicDk: number; bitisDk: number };

export type IzgaraRandevu<T> = IzgaraBlok & { randevu: T };

export type IzgaraSutunu<T> = {
  uzmanId: string;
  /** O gün için hiç mesai tanımı yok — sütun baştan sona "kapalı" render edilir. */
  mesaiYok: boolean;
  /** O günkü çalışma pencereleri (zemin gölgeleme için). */
  calismaBloklari: IzgaraBlok[];
  /** Güne kırpılmış izin aralıkları. */
  izinBloklari: IzgaraBlok[];
  randevular: IzgaraRandevu<T>[];
};

export type IzgaraEkseni = { baslangicDk: number; bitisDk: number; adimDk: number };

export const IZGARA_ADIM_DK = 30;

/**
 * Kimse çalışmıyorsa (hafta sonu vb.) düşülecek varsayılan saat aralığı.
 * Izgara sıfır yüksekliğe çökmesin diye.
 */
export const VARSAYILAN_EKSEN: IzgaraEkseni = {
  baslangicDk: 9 * 60,
  bitisDk: 18 * 60,
  adimDk: IZGARA_ADIM_DK,
};

/** Bir tarihin, verilen gün başlangıcından itibaren kaçıncı dakikada olduğu. */
function gunIcindekiDakika(tarih: Date, gunBaslangici: Date): number {
  return Math.round((tarih.getTime() - gunBaslangici.getTime()) / 60_000);
}

/**
 * Bir günlük ızgara sütunlarını kurar: her uzman için o günkü mesai
 * pencereleri, izin blokları ve randevular.
 *
 * Mesaisi olmayan uzman sütunu GİZLENMEZ (`mesaiYok: true` ile tam boy
 * "kapalı" döner) — koordinatörün "bugün kim çalışmıyor" sorusunu da
 * cevaplayabilmesi için. `mesailer`/`izinler` filtrelenmemiş (uzmanın tüm
 * haftası / tarih aralığındaki tüm izinleri) verilebilir; bu fonksiyon güne
 * göre kendi süzer — tarih mantığının tek bir yerde toplanması için.
 */
export function izgaraSutunlariniOlustur<
  T extends { uzmanId: string; baslangic: Date; bitis: Date },
>(args: {
  /** İlgili günün UTC gece yarısı çapası. */
  gun: Date;
  uzmanlar: readonly { id: string }[];
  mesailer: readonly {
    uzmanId: string;
    gun: Day;
    baslangicDk: number;
    bitisDk: number;
  }[];
  izinler: readonly { uzmanId: string; baslangic: Date; bitis: Date }[];
  /** Çağıran taraf zaten bu güne ait randevuları filtrelemiş olmalı. */
  randevular: readonly T[];
}): IzgaraSutunu<T>[] {
  const { gun, uzmanlar, mesailer, izinler, randevular } = args;
  const gunEnumu = gunundenGun(gun);
  const gunSonu = new Date(gun.getTime() + GUN_MS);

  return uzmanlar.map((uzman): IzgaraSutunu<T> => {
    const oGununMesaileri = mesailer
      .filter((mesai) => mesai.uzmanId === uzman.id && mesai.gun === gunEnumu)
      .map((mesai) => ({
        baslangicDk: mesai.baslangicDk,
        bitisDk: mesai.bitisDk,
      }))
      .sort((a, b) => a.baslangicDk - b.baslangicDk);

    const izinBloklari = izinler
      .filter(
        (izin) =>
          izin.uzmanId === uzman.id &&
          izin.bitis > gun &&
          izin.baslangic < gunSonu,
      )
      .map((izin) => ({
        // Çok günlü izin güne kırpılır: yalnız o günün payı gösterilir.
        baslangicDk: Math.max(0, gunIcindekiDakika(izin.baslangic, gun)),
        bitisDk: Math.min(24 * 60, gunIcindekiDakika(izin.bitis, gun)),
      }));

    const uzmanRandevulari = randevular
      .filter((randevu) => randevu.uzmanId === uzman.id)
      .map((randevu) => ({
        baslangicDk: gunIcindekiDakika(randevu.baslangic, gun),
        bitisDk: gunIcindekiDakika(randevu.bitis, gun),
        randevu,
      }))
      .sort((a, b) => a.baslangicDk - b.baslangicDk);

    return {
      uzmanId: uzman.id,
      mesaiYok: oGununMesaileri.length === 0,
      calismaBloklari: oGununMesaileri,
      izinBloklari,
      randevular: uzmanRandevulari,
    };
  });
}

/**
 * Görünür saat ekseni: en erken mesai başlangıcından en geç mesai bitişine,
 * `adimDk`'a yuvarlanmış. Hiçbir sütunda mesai yoksa (hafta sonu, ya da
 * seçilen uzman süzgeci o gün çalışmıyorsa) `VARSAYILAN_EKSEN`'e düşer.
 */
export function izgaraEkseni(
  sutunlar: readonly IzgaraSutunu<unknown>[],
): IzgaraEkseni {
  let min = Infinity;
  let max = -Infinity;

  for (const sutun of sutunlar) {
    for (const blok of sutun.calismaBloklari) {
      min = Math.min(min, blok.baslangicDk);
      max = Math.max(max, blok.bitisDk);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return VARSAYILAN_EKSEN;

  const adimDk = IZGARA_ADIM_DK;
  return {
    baslangicDk: Math.floor(min / adimDk) * adimDk,
    bitisDk: Math.ceil(max / adimDk) * adimDk,
    adimDk,
  };
}

/** Dakikayı eksene göre 0–1 arası orana çevirir — CSS `top`/`height` yüzdesi için. */
export function dakikadanOran(dakika: number, eksen: IzgaraEkseni): number {
  const uzunluk = eksen.bitisDk - eksen.baslangicDk;
  if (uzunluk <= 0) return 0;
  return (dakika - eksen.baslangicDk) / uzunluk;
}

/** Oranın tersi: tıklanan y-konumundan (0–1) dakikaya, `adimDk`'a yuvarlanmış. */
export function orandanDakika(oran: number, eksen: IzgaraEkseni): number {
  const ham = eksen.baslangicDk + oran * (eksen.bitisDk - eksen.baslangicDk);
  return Math.round(ham / eksen.adimDk) * eksen.adimDk;
}

/**
 * "Hafta" ızgarasında sütun GÜN, satır saat, o günkü TÜM uzmanların
 * randevuları aynı sütunda renkle ayrılır (bkz. `hafta-izgarasi.tsx`).
 * Çakışan randevular yan yana "lane"lere (2, 3... sütuncuk) ayrılır ki
 * üst üste binmesin.
 */
export type HaftaBlok<T> = IzgaraRandevu<T> & { lane: number; laneSayisi: number };
export type HaftaSutunu<T> = { gun: Date; bloklar: HaftaBlok<T>[] };

/**
 * Zaten güne göre gruplanmış randevu listesinden (bkz. `gunlereBol`)
 * haftalık ızgara sütunlarını kurar. Gün gruplaması burada TEKRAR
 * hesaplanmıyor — çağıran tarafın ürettiği `gruplar` doğrudan kullanılıyor
 * ki iki yerde ayrı gün mantığı birbirinden sapmasın.
 */
export function haftaSutunlariniOlustur<T extends { baslangic: Date; bitis: Date }>(
  gruplar: readonly { gun: Date; randevular: readonly T[] }[],
): HaftaSutunu<T>[] {
  return gruplar.map(({ gun, randevular }) => {
    const bloklar = randevular.map((randevu) => ({
      baslangicDk: Math.max(0, gunIcindekiDakika(randevu.baslangic, gun)),
      bitisDk: Math.min(24 * 60, gunIcindekiDakika(randevu.bitis, gun)),
      randevu,
    }));
    return { gun, bloklar: laneAta(bloklar) };
  });
}

/**
 * Çakışan bloklara "lane" (0, 1, 2...) atar; birbiriyle hiç çakışmayan
 * bloklar aynı lane'i tekrar kullanabilir. Zaman ekseninde ayrık gruplar
 * ("küme") ayrı ayrı ele alınır ki bir günün sonundaki tek bir randevu,
 * günün başındaki kalabalık yüzünden gereksiz yere daralmasın.
 */
function laneAta<T extends IzgaraBlok>(
  bloklar: readonly T[],
): Array<T & { lane: number; laneSayisi: number }> {
  const sirali = [...bloklar].sort(
    (a, b) => a.baslangicDk - b.baslangicDk || a.bitisDk - b.bitisDk,
  );

  const sonuc: Array<T & { lane: number; laneSayisi: number }> = [];
  let kume: Array<T & { lane: number }> = [];
  let kumeSonu = -Infinity;

  function kumeyiKapat() {
    if (kume.length === 0) return;
    const laneSayisi = Math.max(...kume.map((blok) => blok.lane)) + 1;
    for (const blok of kume) sonuc.push({ ...blok, laneSayisi });
    kume = [];
    kumeSonu = -Infinity;
  }

  for (const blok of sirali) {
    if (kume.length > 0 && blok.baslangicDk >= kumeSonu) kumeyiKapat();

    const laneSonlari: number[] = [];
    for (const b of kume) laneSonlari[b.lane] = b.bitisDk;
    let lane = laneSonlari.findIndex((son) => son <= blok.baslangicDk);
    if (lane === -1) lane = laneSonlari.length;

    kume.push({ ...blok, lane });
    kumeSonu = Math.max(kumeSonu, blok.bitisDk);
  }
  kumeyiKapat();

  return sonuc;
}

/**
 * Haftalık ızgaranın saat ekseni — `izgaraEkseni` ile aynı fikir, ama
 * kaynak mesai değil RANDEVULARIN kendisi: sütun artık uzman değil gün
 * olduğu için "kimin mesaisi" sorusu anlamını yitiriyor.
 */
export function haftaEkseni<T>(
  sutunlar: readonly HaftaSutunu<T>[],
): IzgaraEkseni {
  let min = Infinity;
  let max = -Infinity;

  for (const sutun of sutunlar) {
    for (const blok of sutun.bloklar) {
      min = Math.min(min, blok.baslangicDk);
      max = Math.max(max, blok.bitisDk);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return VARSAYILAN_EKSEN;

  const adimDk = IZGARA_ADIM_DK;
  return {
    baslangicDk: Math.floor(min / adimDk) * adimDk,
    bitisDk: Math.ceil(max / adimDk) * adimDk,
    adimDk,
  };
}

/**
 * `calismaBloklari`nin eksen içindeki TÜMLEYENİ — "mesai dışı" gölgeleme
 * için boş dakika aralıkları. Sütun grafiği bu boşlukları gri (kil-oyuk)
 * çiziyor; yeşil boşluk kalmıyorsa uzman o eksende hep meşgul demektir.
 */
export function mesaiDisiBloklari(
  calismaBloklari: readonly IzgaraBlok[],
  eksen: IzgaraEkseni,
): IzgaraBlok[] {
  const sirali = [...calismaBloklari].sort(
    (a, b) => a.baslangicDk - b.baslangicDk,
  );
  const bosluklar: IzgaraBlok[] = [];
  let imlec = eksen.baslangicDk;

  for (const blok of sirali) {
    const baslangic = Math.max(blok.baslangicDk, eksen.baslangicDk);
    const bitis = Math.min(blok.bitisDk, eksen.bitisDk);
    if (baslangic > imlec) {
      bosluklar.push({ baslangicDk: imlec, bitisDk: baslangic });
    }
    imlec = Math.max(imlec, bitis);
  }

  if (imlec < eksen.bitisDk) {
    bosluklar.push({ baslangicDk: imlec, bitisDk: eksen.bitisDk });
  }

  return bosluklar;
}
