import { randomBytes } from "node:crypto";
import { haftaBasi, tarihCozumle } from "@/lib/tarih";

/**
 * §17.8 — Uzmanın giriş gerektirmeyen haftalık program adresi (saf kurallar).
 *
 * Veritabanına gitmeyen her şey burada: jeton üretimi, hafta çapasının
 * çözümü ve "bu hafta görülebilir mi" kararı. Sayfa ve eylem dosyaları bunu
 * çağırır; test bunu doğrudan çağırabilir.
 */

/**
 * Jetonun ham uzunluğu (bayt). 24 bayt = 192 bit; base64url'de 32 karakter.
 *
 * Adres TEK savunma olduğu için jeton kaba kuvvetle denenemeyecek kadar
 * geniş olmalı. 192 bit, saniyede milyarlarca deneme yapan birine bile evren
 * yaşından uzun sürer — bu yüzden ayrıca hız sınırı koymaya gerek yok.
 */
const JETON_BAYT = 24;

/** Yeni bir program jetonu üretir. */
export function programJetonuUret(): string {
  return randomBytes(JETON_BAYT).toString("base64url");
}

/**
 * Adresten gelen jeton, veritabanına sorulmaya değer biçimde mi.
 *
 * Amaç güvenlik değil gürültü kesmek: tarayıcı eklentileri ve tarayıcılar
 * `/program/...` altına alakasız yollar deniyor ve her biri veritabanına bir
 * sorgu olurdu. Biçim tutmuyorsa sorgu hiç açılmaz.
 */
export function jetonBicimiTutuyorMu(jeton: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(jeton);
}

/**
 * Linkin açtığı hafta çapası.
 *
 * KARAR (Eylül 2026): link YALNIZ bu haftayı ve sonrasını açar. Sızan bir
 * adres geçmiş danışan listesini vermesin diye geriye gidilemiyor; "geçen
 * hafta kim gelmişti" sorusu panelin işi, linkin değil.
 *
 * `istenen` boşsa ya da çözülemezse bu haftaya düşer. Geçmiş bir hafta
 * istenirse de sessizce bu haftaya çekilir — hata sayfası göstermek yerine
 * kullanıcıyı doğru yere koymak daha yardımcı.
 */
export function programHaftasi(
  istenen: string | undefined,
  simdi: Date,
): { capa: Date; buHaftaMi: boolean } {
  const buHafta = haftaBasi(simdi);
  const cozulen = istenen ? tarihCozumle(istenen) : null;
  if (!cozulen) return { capa: buHafta, buHaftaMi: true };

  const istenenHafta = haftaBasi(cozulen);
  if (istenenHafta.getTime() <= buHafta.getTime()) {
    return { capa: buHafta, buHaftaMi: true };
  }
  return { capa: istenenHafta, buHaftaMi: false };
}

/** Program adresinin tam hâli — kopyalanıp uzmana gönderilen metin. */
export function programAdresi(kokAdres: string, jeton: string): string {
  return `${kokAdres.replace(/\/+$/, "")}/program/${jeton}`;
}
