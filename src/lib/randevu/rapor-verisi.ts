import { db } from "@/lib/db";
import { ayBasi, ayMetni, gunEkle, haftaBasi, tarihBicimle } from "@/lib/tarih";
import { ciroRaporu, type CiroGirdisi, type CiroRaporu } from "./ciro";

/**
 * §17.5 — Ciro raporunun veri katmanı.
 *
 * Hesabın kendisi `ciro.ts` içinde ve saf; burası yalnız aralığı çözüp
 * satırları okuyor. Ekran ve CSV rotası ikisi de buradan geçiyor — iki yerde
 * ayrı sorgu yazılsaydı rakamlar sessizce ayrışırdı.
 */

export type RaporKapsami = "hafta" | "ay";

export function raporKapsamiMi(deger: unknown): deger is RaporKapsami {
  return deger === "hafta" || deger === "ay";
}

export type RaporAraligi = {
  ilk: Date;
  son: Date;
  /** Ekranda ve CSV başlığında görünen aralık metni. */
  etiket: string;
};

/** Kapsam ve çapadan rapor aralığı; aralık kapalı-açık. */
export function raporAraligi(kapsam: RaporKapsami, capa: Date): RaporAraligi {
  if (kapsam === "hafta") {
    const ilk = haftaBasi(capa);
    const son = gunEkle(ilk, 7);
    return {
      ilk,
      son,
      etiket: `${tarihBicimle(ilk)} – ${tarihBicimle(gunEkle(son, -1))}`,
    };
  }

  const ilk = ayBasi(capa);
  const son = new Date(
    Date.UTC(ilk.getUTCFullYear(), ilk.getUTCMonth() + 1, 1),
  );
  return { ilk, son, etiket: ayMetni(ilk) };
}

/** İleri/geri düğmelerinin götürdüğü yeni çapa. */
export function raporKaydir(
  kapsam: RaporKapsami,
  capa: Date,
  yon: -1 | 1,
): Date {
  if (kapsam === "hafta") return gunEkle(haftaBasi(capa), yon * 7);
  const ilk = ayBasi(capa);
  return new Date(Date.UTC(ilk.getUTCFullYear(), ilk.getUTCMonth() + yon, 1));
}

/**
 * Aralıktaki randevuları okuyup raporu hesaplar.
 *
 * ŞUBE: rapor takvimden farklı olarak ŞUBEYE KİLİTLİ. Ciro, seansın hangi
 * binada verildiğinin karşılığı; iki şubeyi tek tabloda toplamak kurumun
 * Excel'de yaptığı ayrımı bozardı. Yönetici üst şeritten şube değiştirerek
 * ikisine de bakar.
 */
export async function subeCiroRaporu(
  subeId: string,
  aralik: RaporAraligi,
): Promise<CiroRaporu> {
  const randevular = await db.randevu.findMany({
    where: {
      branchId: subeId,
      baslangic: { gte: aralik.ilk, lt: aralik.son },
    },
    select: {
      durum: true,
      ucretKurus: true,
      indirimKurus: true,
      uzman: { select: { id: true, ad: true } },
      hizmet: { select: { id: true, ad: true, grup: true } },
    },
  });

  const girdiler: CiroGirdisi[] = randevular.map((randevu) => ({
    uzmanId: randevu.uzman.id,
    uzmanAdi: randevu.uzman.ad,
    hizmetId: randevu.hizmet.id,
    hizmetAdi: randevu.hizmet.ad,
    hizmetGrubu: randevu.hizmet.grup,
    durum: randevu.durum,
    ucretKurus: randevu.ucretKurus,
    indirimKurus: randevu.indirimKurus,
  }));

  return ciroRaporu(girdiler);
}
