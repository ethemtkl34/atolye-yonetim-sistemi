import { db } from "@/lib/db";
import { normalizeArama } from "@/lib/turkce";
import { tarihCozumle } from "@/lib/tarih";
import type { VeliGirdisi } from "@/lib/veli";
import type { OgrenciGirdisi } from "./sema";

/**
 * Öğrenci formunun doğrulanmış girdisini veritabanı biçimine çeviren ortak
 * yardımcılar.
 *
 * `actions.ts` içinde yerel fonksiyonlardı; Zeka testleri sayfasının kendi
 * öğrenci ekleme eylemi de aynı çeviriye ihtiyaç duyunca buraya alındılar.
 * Ayrı dosyada olmalarının teknik bir zorunluluğu da var: `actions.ts` bir
 * `"use server"` dosyası ve oradan yalnızca async fonksiyon dışa
 * aktarılabilir — bu yardımcılar oradan paylaşılamazdı.
 *
 * Şema (`sema.ts`) ile eylemler arasındaki katman burasıdır: doğrulama orada,
 * yetki ve yazma eylemde, alan eşlemesi burada.
 */

/**
 * Formdaki "Kayıt şubesi" seçimini doğrular (ortak havuz, Eylül 2026).
 *
 * Kayıt şubesi yalnız bir ETİKET: kimin görebileceğini belirlemiyor (iki
 * şube de bütün öğrencileri görür), bu yüzden formdan gelmesi güvenlik
 * açığı değil. Yine de değer AKTİF bir şube olmak zorunda — elle
 * düzenlenmiş bir form var olmayan bir şubeye yazamaz. Alan hiç
 * gönderilmediyse (seçici çizilmeyen tek şubeli kurulum) varsayılan döner;
 * geçersizse null.
 */
export async function kayitSubesiCoz(
  formVerisi: FormData,
  varsayilan: string,
): Promise<string | null> {
  const ham = formVerisi.get("kayitSubesi");
  if (typeof ham !== "string" || ham === "") return varsayilan;
  const sube = await db.branch.findFirst({
    where: { id: ham, active: true },
    select: { id: true },
  });
  return sube?.id ?? null;
}

/** Öğrencinin ana bilgilerini veritabanı biçimine çevirir. */
export function ogrenciAlanlari(veri: OgrenciGirdisi) {
  return {
    firstName: veri.firstName,
    lastName: veri.lastName,
    birthDate: veri.birthDate ? tarihCozumle(veri.birthDate) : null,
    school: veri.school,
    grade: veri.grade,
    notes: veri.notes,
    // §6.2 — Arama bu sütun üzerinden yapılır; her yazımda tazelenir.
    searchName: normalizeArama(`${veri.firstName} ${veri.lastName}`),
  };
}

export function saglikAlanlari(veri: OgrenciGirdisi) {
  return {
    allergies: veri.alerji,
    medications: veri.ilac,
    specialEducation: veri.ozelEgitim,
    healthNotes: veri.saglikNotu,
    emergencyInfo: veri.acilDurum,
    internSafetyNote: veri.stajyerUyarisi,
  };
}

/**
 * Girilen ebeveynleri veli girdisi listesine çevirir; boş bırakılan ebeveyn
 * yazılmaz.
 *
 * Eskiden doğrudan `Guardian` satırı üretiyordu (ad + telefon o satırdaydı).
 * Veli birinci sınıf kayda dönünce (§17.1) burası yalnız FORMDAN OKUNANI
 * taşıyor; normalize etme ve eşleştirme `lib/veli.ts` içinde.
 */
export function veliGirdileri(veri: OgrenciGirdisi): VeliGirdisi[] {
  const veliler: VeliGirdisi[] = [];

  if (veri.anneAdi) {
    veliler.push({
      type: "ANNE",
      fullName: veri.anneAdi,
      phone: veri.anneTelefon,
    });
  }

  if (veri.babaAdi) {
    veliler.push({
      type: "BABA",
      fullName: veri.babaAdi,
      phone: veri.babaTelefon,
    });
  }

  return veliler;
}
