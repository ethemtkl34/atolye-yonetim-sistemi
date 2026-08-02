import { kontenjanDurumu } from "@/lib/scoring";

/**
 * Gruba yeni kayıt açılabilmesinin şartları.
 *
 * Üç ayrı yerden çağrılıyor: kayıt sihirbazı, yeni öğrenci formundaki isteğe
 * bağlı kayıt ve dönem/kulüp sayfasındaki toplu ekleme. Kural tek yerde
 * durmazsa üç ekran farklı davranmaya başlar; hangisinin doğru olduğu da
 * ancak canlıda anlaşılır.
 *
 * Program durumu ile kontenjan bilerek AYRI: toplu eklemede kontenjan bir
 * engel değil, bir sınır — sığan öğrenciler eklenir, kalanı bildirilir.
 */

type ProgramDurumu = { status: string } | null;

/**
 * "Kayıt almıyor" hatasını çıkmaza dönüştürmeden açıklar. Devam eden döneme
 * grup eklenebilir (§13.5) ama kayıt ancak dönem "Kayıt alıyor" durumundayken
 * açılır; koordinatöre bir sonraki adım söylenmezse bu bir çıkmaz gibi
 * görünüyordu.
 */
export function kayitKapaliMesaji(term: ProgramDurumu): string {
  if (term?.status === "DEVAM_EDIYOR") {
    return 'Dönem devam ediyor ancak yeni kayıt kapalı. Kayıt almak için dönem sayfasından durumu "Kayıt alıyor" yapın.';
  }
  return "Bu program şu anda kayıt almıyor.";
}

/** Grubun kendisi ve bağlı olduğu program kayıt almaya uygun mu. */
export function programKayitEngeli(grup: {
  active: boolean;
  term: ProgramDurumu;
  club: ProgramDurumu;
}): string | null {
  if (!grup.active) return "Bu grup kapalı; yeni kayıt alınamaz.";
  if (
    grup.term?.status !== "KAYIT_ALIYOR" &&
    grup.club?.status !== "KAYIT_ALIYOR"
  ) {
    return kayitKapaliMesaji(grup.term);
  }
  return null;
}

/**
 * Kontenjan dolu grupta kayıt engelleniyor.
 *
 * Şartname bunu açıkça yasaklamıyor ama §2.3 kontenjan dolduğunda "yeni grup
 * açılabilir" diyor; aşılabilen bir kontenjanın anlamı kalmazdı. Engellerken
 * çözüm yolu da söyleniyor.
 */
export function kontenjanEngeli(grup: {
  name: string;
  capacity: number;
  _count: { enrollments: number };
}): string | null {
  const kontenjan = kontenjanDurumu(grup.capacity, grup._count.enrollments);
  if (!kontenjan.dolu) return null;
  return `"${grup.name}" grubunun kontenjanı dolu (${kontenjan.doluluk}/${kontenjan.kapasite}). Aynı programa yeni bir grup ekleyip oraya kaydedebilirsiniz.`;
}

/** Tek kayıt açan akışların tamamı: program uygun mu VE yer var mı. */
export function kayitEngeli(grup: {
  name: string;
  active: boolean;
  capacity: number;
  term: ProgramDurumu;
  club: ProgramDurumu;
  _count: { enrollments: number };
}): string | null {
  return programKayitEngeli(grup) ?? kontenjanEngeli(grup);
}
