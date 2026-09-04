import { GUN_SIRASI } from "@/lib/tarih";
import type { Day } from "@/generated/prisma/enums";

/**
 * §17.4 — "Bu saate randevu açılabilir mi?" kararı.
 *
 * SAF: veritabanına gitmiyor, çağıran taraf gerekli satırları okuyup buraya
 * veriyor. Karar mantığının sorgudan ayrılması bilinçli — çakışma kuralı
 * takvim ekranında, randevu formunda ve tekrar üretiminde aynı olmak zorunda
 * ve tek yerde testlenebilmeli (`kayit-kurallari.ts` deseni).
 *
 * ÜÇ ENGEL VAR ve üçü de UYARI DEĞİL, ENGEL (§17.4):
 *   1. Uzmanın aynı saatte başka randevusu (aynı kişi iki yerde olamaz).
 *   2. Mesai dışı saat (uzman o gün o şubede çalışmıyor).
 *   3. İzin aralığı.
 *
 * Kayıt çakışmasından farkı bu: orada koordinatör bilinçli olarak devam
 * edebiliyor, burada edemez.
 *
 * SAAT SÖZLEŞMESİ: bütün tarihler duvar saati olarak UTC'de (bkz. Randevu
 * şema şerhi). Gün ve dakika hesapları da UTC üzerinden.
 */

export type Aralik = { baslangic: Date; bitis: Date };

export type MevcutRandevu = Aralik & {
  id: string;
  /** İptal edilmiş randevu yer tutmaz — çakışma sayılmaz. */
  iptal: boolean;
};

export type MesaiAraligi = {
  gun: Day;
  baslangicDk: number;
  bitisDk: number;
};

export type RandevuEngeli =
  | { tur: "cakisma"; mesaj: string; cakisanId: string }
  | { tur: "mesai"; mesaj: string }
  | { tur: "izin"; mesaj: string };

/** Gece yarısından itibaren dakika — mesai karşılaştırmasının birimi. */
export function gununDakikasi(tarih: Date): number {
  return tarih.getUTCHours() * 60 + tarih.getUTCMinutes();
}

/** Tarihin haftanın hangi gününe denk geldiği (`Day` enum'ı). */
export function gunEnum(tarih: Date): Day {
  // `getUTCDay` pazardan başlıyor; `GUN_SIRASI` pazartesiden.
  return GUN_SIRASI[(tarih.getUTCDay() + 6) % 7];
}

/**
 * İki aralık kesişiyor mu — uçlar HARİÇ.
 *
 * 09:00–10:00 ile 10:00–11:00 çakışmaz: bir seans bitince diğeri başlayabilir.
 * Aksi hâlde arka arkaya seans hiç açılamazdı.
 */
export function araliklarCakisiyorMu(a: Aralik, b: Aralik): boolean {
  return a.baslangic < b.bitis && b.baslangic < a.bitis;
}

/**
 * Randevunun tamamı TEK BİR mesai aralığının içinde mi.
 *
 * "Başlangıcı mesai içinde" yetmez: 17:30'da açılan 90 dakikalık bir seans
 * 19:00'da biter ve uzman 18:00'da gitmiştir. Aralıkların birleşimine değil
 * tek tek bakılıyor — iki ayrı mesai aralığı (09:00–12:00 ve 13:00–18:00)
 * arasındaki öğle arasına sarkan bir seans da kabul edilmemeli.
 */
export function mesaiIcindeMi(
  randevu: Aralik,
  mesailer: readonly MesaiAraligi[],
): boolean {
  const gun = gunEnum(randevu.baslangic);
  const basla = gununDakikasi(randevu.baslangic);

  // Bitiş gece yarısını aşarsa gün değişir; mesai tanımı tek güne ait
  // olduğu için böyle bir randevu hiçbir aralığa sığmaz.
  const gunFarki =
    Math.floor(randevu.bitis.getTime() / 86_400_000) -
    Math.floor(randevu.baslangic.getTime() / 86_400_000);
  if (gunFarki !== 0) return false;

  const bit = gununDakikasi(randevu.bitis);

  return mesailer.some(
    (mesai) =>
      mesai.gun === gun && basla >= mesai.baslangicDk && bit <= mesai.bitisDk,
  );
}

/**
 * Randevunun engeli varsa onu, yoksa `null` döner.
 *
 * Sıra ÖNEMLİ ve kullanıcıya en anlaşılır cevabı veriyor: önce izin (uzman
 * bugün yok), sonra mesai (o saatte çalışmıyor), sonra çakışma (o saat dolu).
 * Ters sırada "o saat dolu" derdik ve kullanıcı başka saat denerdi; oysa
 * uzman o gün hiç gelmiyor.
 */
export function randevuEngeli(args: {
  randevu: Aralik;
  mesailer: readonly MesaiAraligi[];
  izinler: readonly Aralik[];
  /** Uzmanın o gündeki diğer randevuları. Düzenlemede kendisi hariç. */
  mevcutlar: readonly MevcutRandevu[];
}): RandevuEngeli | null {
  const { randevu, mesailer, izinler, mevcutlar } = args;

  const izin = izinler.find((aralik) => araliklarCakisiyorMu(randevu, aralik));
  if (izin) {
    return { tur: "izin", mesaj: "Uzman bu tarihte izinli." };
  }

  if (!mesaiIcindeMi(randevu, mesailer)) {
    return {
      tur: "mesai",
      mesaj:
        mesailer.length === 0
          ? "Uzmanın bu şubede tanımlı mesaisi yok."
          : "Seans uzmanın mesai saatlerinin dışına taşıyor.",
    };
  }

  const cakisan = mevcutlar.find(
    (mevcut) => !mevcut.iptal && araliklarCakisiyorMu(randevu, mevcut),
  );
  if (cakisan) {
    return {
      tur: "cakisma",
      mesaj: "Uzmanın bu saatte başka bir randevusu var.",
      cakisanId: cakisan.id,
    };
  }

  return null;
}

/** Hizmetin süresinden randevunun bitiş saati. */
export function randevuAraligi(baslangic: Date, sureDk: number): Aralik {
  return {
    baslangic,
    bitis: new Date(baslangic.getTime() + sureDk * 60_000),
  };
}
