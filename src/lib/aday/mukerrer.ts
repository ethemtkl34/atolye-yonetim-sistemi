/**
 * §16.8 — Mükerrer aday kararı.
 *
 * Veritabanına DOKUNMAYAN saf mantık: `aday-kaydi.ts` sorguları yapar, karar
 * burada verilir. Ayrı dosyada çünkü `db.ts` modül yüklenirken ortam
 * değişkenlerini zorunlu kılıyor; kararın birim testi bağlantısız çalışmalı
 * (repo'daki `kayit-kurallari.ts` deseni).
 */

export type BenzerKayit =
  | { tur: "aday"; id: string; ad: string }
  | { tur: "ogrenci"; id: string; ad: string };

export type MukerrerBaglami = {
  kanal: "api" | "elle";
  /** Elle girişte "Yine de kaydet" onayı. */
  zorla: boolean;
  telefonVar: boolean;
  /** Aynı şube + aynı telefonla AÇIK aşamada duran aday. */
  acikAday: { id: string; ad: string; kacDakikaOnce: number } | null;
  /** Aynı telefonu taşıyan mevcut veli (şube içinde). */
  veliEslesmesi: { ogrenciId: string; ogrenciAdi: string } | null;
};

export type MukerrerKarar =
  | { tur: "olustur" }
  | { tur: "olustur-notlu"; not: string }
  | { tur: "mevcuda-not"; adayId: string }
  | { tur: "sessiz"; adayId: string }
  | { tur: "uyar"; benzer: BenzerKayit };

/** API'nin çift gönderim penceresi — bu süre içindeki tekrar sessizce yutulur. */
const SESSIZ_PENCERE_DAKIKA = 10;

/**
 * Kurallar:
 * 1. Telefon yoksa karşılaştırılacak anahtar da yok: aday açılır.
 * 2. Aynı telefonla AÇIK aday varken API'den yenisi gelirse yeni aday
 *    AÇILMAZ; mevcut adaya sistem notu düşer ve takip tarihi bugüne çekilir
 *    (aday kuyruğa geri döner). Birkaç dakika içindeki tekrar (çift tıklama,
 *    entegratör yeniden denemesi) not bile düşürmez — sessizce yutulur.
 * 3. Elle girişte aynı durum ENGEL değil UYARIDIR: danışman eşleşmeyi görüp
 *    "Yine de kaydet" diyebilir (kardeşler aynı veli telefonunu paylaşır).
 * 4. Telefon kapalı bir adayla ya da kayıtlı bir veliyle eşleşiyorsa yeni
 *    aday MEŞRUDUR (geri dönen aile, kardeş) — açılır ama nota bağlanır.
 */
export function mukerrerKarari(baglam: MukerrerBaglami): MukerrerKarar {
  if (!baglam.telefonVar) return { tur: "olustur" };

  if (baglam.acikAday) {
    if (baglam.kanal === "api") {
      if (baglam.acikAday.kacDakikaOnce <= SESSIZ_PENCERE_DAKIKA) {
        return { tur: "sessiz", adayId: baglam.acikAday.id };
      }
      return { tur: "mevcuda-not", adayId: baglam.acikAday.id };
    }
    if (!baglam.zorla) {
      return {
        tur: "uyar",
        benzer: { tur: "aday", id: baglam.acikAday.id, ad: baglam.acikAday.ad },
      };
    }
    return {
      tur: "olustur-notlu",
      not: `Benzer kayıt uyarısına rağmen eklendi — aynı telefonla açık aday: ${baglam.acikAday.ad}`,
    };
  }

  if (baglam.veliEslesmesi) {
    if (baglam.kanal === "elle" && !baglam.zorla) {
      return {
        tur: "uyar",
        benzer: {
          tur: "ogrenci",
          id: baglam.veliEslesmesi.ogrenciId,
          ad: baglam.veliEslesmesi.ogrenciAdi,
        },
      };
    }
    return {
      tur: "olustur-notlu",
      not: `Bu telefon kayıtlı bir öğrencinin velisiyle eşleşiyor: ${baglam.veliEslesmesi.ogrenciAdi}`,
    };
  }

  return { tur: "olustur" };
}
