import { ayBasi, gunEkle, haftaBasi } from "@/lib/tarih";
import type { Gorunum } from "@/app/koordinator/randevular/sema";

/**
 * §17.4 — Takvim görünümünün tarih aralığı ve gün gruplaması.
 *
 * SAF: veritabanına gitmiyor. Aralık hesabı hem sorguda hem başlıkta hem
 * ileri/geri düğmelerinde kullanılıyor; üç yerde ayrı hesaplanırsa bir gün
 * kayması sessizce girer.
 *
 * Aralık kapalı-açık: `baslangic` dahil, `bitis` hariç. Sorgular bunu
 * doğrudan kullanıyor (`baslangic: { gte: ilk, lt: son }`).
 */

export type TakvimAraligi = { ilk: Date; son: Date };

/** Görünümün kapsadığı tarih aralığı. */
export function takvimAraligi(gorunum: Gorunum, capa: Date): TakvimAraligi {
  if (gorunum === "gun") {
    return { ilk: capa, son: gunEkle(capa, 1) };
  }

  if (gorunum === "hafta") {
    const basla = haftaBasi(capa);
    return { ilk: basla, son: gunEkle(basla, 7) };
  }

  const basla = ayBasi(capa);
  const son = new Date(
    Date.UTC(basla.getUTCFullYear(), basla.getUTCMonth() + 1, 1),
  );
  return { ilk: basla, son };
}

/** İleri/geri düğmelerinin götürdüğü yeni çapa. */
export function takvimKaydir(
  gorunum: Gorunum,
  capa: Date,
  yon: -1 | 1,
): Date {
  if (gorunum === "gun") return gunEkle(capa, yon);
  if (gorunum === "hafta") return gunEkle(haftaBasi(capa), yon * 7);

  const basla = ayBasi(capa);
  return new Date(
    Date.UTC(basla.getUTCFullYear(), basla.getUTCMonth() + yon, 1),
  );
}

/**
 * Aralıktaki bütün günler — randevusu OLMAYAN günler dahil.
 *
 * Boş günler listeden düşseydi hafta görünümü randevusu olan günlerin
 * listesine dönerdi ve "salı günü kimse yok" bilgisi kaybolurdu; doluluk
 * ancak boşluğun görünmesiyle okunuyor.
 */
export function araliktakiGunler({ ilk, son }: TakvimAraligi): Date[] {
  const gunler: Date[] = [];
  for (
    let gun = ilk;
    gun.getTime() < son.getTime();
    gun = gunEkle(gun, 1)
  ) {
    gunler.push(gun);
  }
  return gunler;
}

/** "YYYY-MM-DD" anahtarı — gün gruplamasının anahtarı. */
export function gunAnahtari(tarih: Date): string {
  return tarih.toISOString().slice(0, 10);
}

/**
 * Randevuları güne göre gruplar; her gün için (boş olsa da) bir kutu döner.
 * Gün içinde saate göre sıralı.
 */
export function gunlereBol<T extends { baslangic: Date }>(
  aralik: TakvimAraligi,
  randevular: readonly T[],
): { gun: Date; randevular: T[] }[] {
  const kova = new Map<string, T[]>();
  for (const randevu of randevular) {
    const anahtar = gunAnahtari(randevu.baslangic);
    const liste = kova.get(anahtar);
    if (liste) liste.push(randevu);
    else kova.set(anahtar, [randevu]);
  }

  return araliktakiGunler(aralik).map((gun) => ({
    gun,
    randevular: (kova.get(gunAnahtari(gun)) ?? []).sort(
      (a, b) => a.baslangic.getTime() - b.baslangic.getTime(),
    ),
  }));
}
