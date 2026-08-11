import { normalizeArama, normalizeTelefon } from "@/lib/turkce";
import { tarihCozumle } from "@/lib/tarih";
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

/** Girilen ebeveynleri satır listesine çevirir; boş bırakılan ebeveyn yazılmaz. */
export function veliSatirlari(veri: OgrenciGirdisi) {
  const veliler: {
    type: "ANNE" | "BABA";
    fullName: string;
    phone: string | null;
    searchPhone: string | null;
  }[] = [];

  if (veri.anneAdi) {
    veliler.push({
      type: "ANNE",
      fullName: veri.anneAdi,
      phone: veri.anneTelefon,
      searchPhone: veri.anneTelefon
        ? normalizeTelefon(veri.anneTelefon)
        : null,
    });
  }

  if (veri.babaAdi) {
    veliler.push({
      type: "BABA",
      fullName: veri.babaAdi,
      phone: veri.babaTelefon,
      searchPhone: veri.babaTelefon
        ? normalizeTelefon(veri.babaTelefon)
        : null,
    });
  }

  return veliler;
}
