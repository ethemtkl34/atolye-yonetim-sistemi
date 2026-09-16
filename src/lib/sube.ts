import { cookies } from "next/headers";

/**
 * Şube bağlamı.
 *
 * ŞUBE SINIRI NEREDE: yalnızca üç tabloda doğrudan durur — `User`, `Group`,
 * `Student`. Kalan her satırın şubesi ilişkiden türetilir. Sorgu yazarken
 * her model için AŞAĞIDAKİ TEK yolu kullanın; ikinci bir yol icat etmek
 * (örneğin kaydı hem grup hem öğrenci üzerinden süzmek) zamanla ayrışan iki
 * doğruluk kaynağı üretir:
 *
 *   Group, Student, User   → { branchId }
 *   Enrollment             → { group: { branchId } }
 *   Session                → { group: { branchId } }
 *   Score                  → { enrollment: { group: { branchId } } }
 *   ScoreAnswer            → { score: { enrollment: { group: { branchId } } } }
 *   Guardian, HealthInfo   → { student: { branchId } }
 *   Report                 → { student: { branchId } }
 *   ReportEnrollment       → { report: { student: { branchId } } }
 *   ReportPdf              → { report: { student: { branchId } } }
 *   TermIntern             → { user: { branchId } }
 *   Term, Club, TermWeek, TermWorkshop, ClubWorkshop,
 *   WorkshopType, Question → ORTAK, süzgeç YOK
 *
 * ŞUBE ASLA FORM ALANINDAN GELMEZ. Şubeye ait veri yazan her eylem şubeyi
 * oturumdan (koordinatör/stajyer) ya da çerezden (yönetici) çözer. Gizli bir
 * `subeId` input'u, koordinatörün DOM'u düzenleyerek diğer şubeye kayıt
 * açmasına izin verirdi.
 */

/** Yöneticinin seçtiği şubeyi taşıyan çerez. */
export const SUBE_CEREZI = "aktif-sube";

/** Çerez ömrü oturumla aynı: 12 saat (bkz. auth.config.ts `maxAge`). */
export const SUBE_CEREZ_OMRU = 12 * 60 * 60;

/** Çerezdeki şube seçimi — yalnızca yönetici için anlamlı. */
export async function secilenSubeCerezi(): Promise<string | undefined> {
  return (await cookies()).get(SUBE_CEREZI)?.value;
}

/**
 * Danışma görevlisinin YALNIZ RANDEVULAR ekranında seçtiği şube (Eylül 2026).
 *
 * Genel şube çerezinden (`SUBE_CEREZI`) bilinçli olarak AYRI: o çerez
 * yöneticinin bütün paneli başka şubeye çevirmesi içindir. Danışma masası
 * ise öğrenci, aday ve kayıt ekranlarında kendi şubesinde kalmalı; yalnız
 * randevu takvimi — uzmanlar iki şubede çalıştığı için — öbür şubede de
 * yönetilebilmeli. Aynı çerezi paylaşsalardı bir ekranda yapılan seçim
 * öbürlerini sessizce etkilerdi.
 */
export const RANDEVU_SUBE_CEREZI = "randevu-subesi";

export async function randevuSubesiCerezi(): Promise<string | undefined> {
  return (await cookies()).get(RANDEVU_SUBE_CEREZI)?.value;
}

/**
 * Randevular ekranında hangi şubede çalışılacağı — yalnız randevu şubesi
 * seçebilen roller için çağrılır (bkz. roller.ts `randevuSubesiSecebilirMi`).
 *
 * Çerez aktif bir şubeyi gösteriyorsa o; yoksa, bozuksa ya da şube pasife
 * alınmışsa KULLANICININ KENDİ ŞUBESİ. Yöneticideki "ilk şubeye düş"
 * davranışından farkı bu: seçim yapmamış bir danışma görevlisi hiç fark
 * etmeden başka şubenin takviminde çalışmaya başlamamalı.
 */
export function randevuSubesiniCoz(
  kullaniciSubeId: string,
  cerezDegeri: string | undefined,
  subeler: readonly { id: string }[],
): string {
  return subeler.find((sube) => sube.id === cerezDegeri)?.id ?? kullaniciSubeId;
}

/**
 * Hangi şubede çalışılacağını belirler. Saf fonksiyon — testten çağrılabilsin
 * diye veritabanı ve çerez okuma dışarıda bırakıldı.
 *
 * - Şubeli roller (yönetici olmayan herkes): kendi şubesi. Çerez YOK
 *   SAYILIR; istemcinin gönderdiği bir değer görüş alanını genişletemez.
 * - Yönetici (`yoneticiMi`): çerezdeki şube, aktif şubeler arasındaysa o;
 *   değilse (çerez yok, bozuk ya da şube pasife alınmış) listedeki ilk şube.
 *   Hata vermek yerine ilkine düşmek, "şube seçilmedi" diye kilitlenen bir
 *   panel oluşmasını engelliyor.
 *
 * Parametre rol değil boolean: çoklu rolde soru "ADMIN mi" sorusuna indi ve
 * bu dosyanın `Role` tipine bağımlılığı kalksın diye çağıran taraf cevabı
 * kendisi veriyor.
 */
export function aktifSubeyiCoz(
  yoneticiMi: boolean,
  kullaniciSubeId: string | null,
  cerezDegeri: string | undefined,
  subeler: readonly { id: string }[],
): string | null {
  if (!yoneticiMi) {
    return kullaniciSubeId;
  }

  if (subeler.length === 0) return null;

  const secili = subeler.find((sube) => sube.id === cerezDegeri);
  return secili?.id ?? subeler[0].id;
}
