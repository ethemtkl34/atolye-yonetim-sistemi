import type { RaporGovdesiV2 } from "./rapor-govdesi";

/**
 * §11.4 — Raporda elle düzenlenebilen metinlerin tek tanımı.
 *
 * Bu dosya SAF: veritabanı, tarih ve React bilmez. İki tarafı da o yüzden
 * besleyebiliyor — sunucu eylemi (kaydetme, geri alma, yeniden üretimde
 * taşıma) ve arayüz (kutunun etiketini yazma).
 *
 * ANAHTAR neden gerekli: düzenlenen metin gövdenin içinde adıyla duruyor
 * ("Bilim Atölyesi"nin içerik paragrafı gibi). Rapor yeniden üretildiğinde
 * yeni gövdedeki karşılığını bulmak için kararlı bir kimlik gerekiyor; alan
 * tanımını düz metne çeviren `alanAnahtari` bunu veriyor ve `alandanCoz` geri
 * okuyor.
 */

export type DuzenlenebilirAlan =
  | { tur: "atolyeIcerik"; atolyeAdi: string }
  | { tur: "atolyeMetni"; atolyeAdi: string }
  | { tur: "gelisimCumle"; alanAdi: string }
  | { tur: "gelisimDegisim"; alanAdi: string }
  | { tur: "asimetriCumle"; atolyeAdi: string }
  | { tur: "gozlem"; bolum: "giris" | "profil" | "sonuc" | "oneriler" }
  | { tur: "gozlemBlok"; beceriAdi: string };

/**
 * §11.4 — Elle düzenlenmiş bir metnin kaydı.
 *
 * `ozgunMetin` iki işe yarıyor: koordinatör düzenlemesinden vazgeçip üretimin
 * yazdığına dönebiliyor, ve rapor yeniden üretilince hangi metinlerin elle
 * yazıldığı listelenebiliyor. Sistem düzenlemeyi sessizce çöpe atmamalı.
 */
export type RaporDuzenlemesi = {
  anahtar: string;
  /** İnsan okur etiket — onay ekranında ve listede geçer. */
  etiket: string;
  /** Üretimin yazdığı, düzenlemeden ÖNCEKİ metin. */
  ozgunMetin: string;
  /** Düzenleyen kişinin adı; kullanıcı silinmişse null. */
  kisi: string | null;
  /** ISO tarih — gövde JSON'a yazıldığı için Date değil metin. */
  zaman: string;
};

const GOZLEM_BOLUMLERI = ["giris", "profil", "sonuc", "oneriler"] as const;

/** Alanın gövde içindeki kararlı kimliği. */
export function alanAnahtari(alan: DuzenlenebilirAlan): string {
  switch (alan.tur) {
    case "atolyeIcerik":
    case "atolyeMetni":
    case "asimetriCumle":
      return `${alan.tur}:${alan.atolyeAdi}`;
    case "gelisimCumle":
    case "gelisimDegisim":
      return `${alan.tur}:${alan.alanAdi}`;
    case "gozlem":
      return `gozlem:${alan.bolum}`;
    case "gozlemBlok":
      return `gozlemBlok:${alan.beceriAdi}`;
  }
}

/** `alanAnahtari`nin tersi — yeniden üretimde eski kayıtları çözmek için. */
export function alandanCoz(anahtar: string): DuzenlenebilirAlan | null {
  const ayrac = anahtar.indexOf(":");
  if (ayrac <= 0) return null;
  const tur = anahtar.slice(0, ayrac);
  const ad = anahtar.slice(ayrac + 1);
  if (!ad) return null;

  switch (tur) {
    case "atolyeIcerik":
    case "atolyeMetni":
    case "asimetriCumle":
      return { tur, atolyeAdi: ad };
    case "gelisimCumle":
    case "gelisimDegisim":
      return { tur, alanAdi: ad };
    case "gozlem":
      return GOZLEM_BOLUMLERI.includes(ad as (typeof GOZLEM_BOLUMLERI)[number])
        ? { tur: "gozlem", bolum: ad as (typeof GOZLEM_BOLUMLERI)[number] }
        : null;
    case "gozlemBlok":
      return { tur: "gozlemBlok", beceriAdi: ad };
    default:
      return null;
  }
}

const GOZLEM_ETIKETLERI: Record<
  (typeof GOZLEM_BOLUMLERI)[number],
  string
> = {
  giris: "Gözlem raporu · giriş",
  profil: "Gözlem raporu · öğrenci profili",
  sonuc: "Gözlem raporu · sonuç",
  oneriler: "Gözlem raporu · ev önerileri",
};

/** Onay ekranında ve düzenleme listesinde okunacak ad. */
export function alanEtiketi(alan: DuzenlenebilirAlan): string {
  switch (alan.tur) {
    case "atolyeIcerik":
      return `${alan.atolyeAdi} · içerik paragrafı`;
    case "atolyeMetni":
      return `${alan.atolyeAdi} · öğrenci değerlendirmesi`;
    case "asimetriCumle":
      return `${alan.atolyeAdi} · ilgi–başarı notu`;
    case "gelisimCumle":
      return `${alan.alanAdi} · değerlendirme cümlesi`;
    case "gelisimDegisim":
      return `${alan.alanAdi} · ilerleme yorumu`;
    case "gozlem":
      return GOZLEM_ETIKETLERI[alan.bolum];
    case "gozlemBlok":
      return `Gözlem bloğu · ${alan.beceriAdi}`;
  }
}

/** Alanın gövdedeki mevcut metni; hedef yoksa null. */
export function metniOku(
  govde: RaporGovdesiV2,
  alan: DuzenlenebilirAlan,
): string | null {
  switch (alan.tur) {
    case "atolyeIcerik":
      return (
        govde.atolyeIcerikleri.find((a) => a.atolyeAdi === alan.atolyeAdi)
          ?.metin ?? null
      );
    case "atolyeMetni":
      return (
        govde.atolyeKademeleri.find((a) => a.atolyeAdi === alan.atolyeAdi)
          ?.metin ?? null
      );
    case "gelisimCumle":
      return (
        govde.gelisimAlanlari.find((a) => a.ad === alan.alanAdi)?.cumle ?? null
      );
    case "gelisimDegisim":
      return (
        govde.gelisimAlanlari.find((a) => a.ad === alan.alanAdi)?.degisim
          ?.cumle ?? null
      );
    case "asimetriCumle":
      return (
        govde.asimetriler.find((a) => a.atolyeAdi === alan.atolyeAdi)?.cumle ??
        null
      );
    case "gozlem":
      return govde.gozlem?.[alan.bolum] ?? null;
    case "gozlemBlok":
      return (
        govde.gozlem?.bloklar.find((b) => b.beceriAdi === alan.beceriAdi)
          ?.gozlem ?? null
      );
  }
}

/**
 * Metni gövdeye yazar; hedef bölüm yoksa `false` döner ve hiçbir şey
 * değişmez.
 *
 * Gövdeyi YERİNDE değiştirir — çağıran taraf zaten JSON'dan yeni çözülmüş bir
 * nesneyle çalışıyor. Hedefin yokluğu bir hata değil, olağan bir durum: rapor
 * yeniden üretildiğinde bir atölye programdan çıkmış ya da gözlem bölümü hiç
 * yazılmamış olabilir.
 */
export function metniYaz(
  govde: RaporGovdesiV2,
  alan: DuzenlenebilirAlan,
  metin: string,
): boolean {
  switch (alan.tur) {
    case "atolyeIcerik": {
      const hedef = govde.atolyeIcerikleri.find(
        (a) => a.atolyeAdi === alan.atolyeAdi,
      );
      if (!hedef) return false;
      hedef.metin = metin;
      return true;
    }
    case "atolyeMetni": {
      const hedef = govde.atolyeKademeleri.find(
        (a) => a.atolyeAdi === alan.atolyeAdi,
      );
      // Metni hiç üretilmemiş atölyeye (eski snapshot) metin yazılmaz:
      // PDF o durumda zaten başka bir sayfa düzenine düşüyor.
      if (!hedef?.metin) return false;
      hedef.metin = metin;
      return true;
    }
    case "gelisimCumle": {
      const hedef = govde.gelisimAlanlari.find((a) => a.ad === alan.alanAdi);
      if (!hedef) return false;
      hedef.cumle = metin;
      return true;
    }
    case "gelisimDegisim": {
      const hedef = govde.gelisimAlanlari.find((a) => a.ad === alan.alanAdi);
      // Yön ve fark DEĞİŞMEZ; yalnızca cümle. Yönü de düzenlemeye açmak,
      // ölçümle metnin çelişmesine izin verirdi.
      if (!hedef?.degisim) return false;
      hedef.degisim.cumle = metin;
      return true;
    }
    case "asimetriCumle": {
      const hedef = govde.asimetriler.find(
        (a) => a.atolyeAdi === alan.atolyeAdi,
      );
      if (!hedef) return false;
      hedef.cumle = metin;
      return true;
    }
    case "gozlem": {
      if (!govde.gozlem) return false;
      govde.gozlem[alan.bolum] = metin;
      return true;
    }
    case "gozlemBlok": {
      const hedef = govde.gozlem?.bloklar.find(
        (b) => b.beceriAdi === alan.beceriAdi,
      );
      if (!hedef) return false;
      hedef.gozlem = metin;
      return true;
    }
  }
}

/**
 * §11.4 — Bir düzenlemeyi gövdenin düzenleme defterine işler.
 *
 * `ozgunMetin` yalnızca İLK düzenlemede yazılır: koordinatör aynı kutuyu üç
 * kez düzeltirse "özgüne dön" hâlâ üretimin yazdığına döner, ikinci
 * taslağına değil.
 */
export function duzenlemeIsle(
  govde: RaporGovdesiV2,
  alan: DuzenlenebilirAlan,
  ozgunMetin: string,
  kisi: string | null,
  zaman: Date,
): void {
  const anahtar = alanAnahtari(alan);
  const defter = (govde.duzenlemeler ??= []);
  const mevcut = defter.find((kayit) => kayit.anahtar === anahtar);

  if (mevcut) {
    mevcut.kisi = kisi;
    mevcut.zaman = zaman.toISOString();
    return;
  }

  defter.push({
    anahtar,
    etiket: alanEtiketi(alan),
    ozgunMetin,
    kisi,
    zaman: zaman.toISOString(),
  });
}

/** Düzenleme kaydını defterden düşürür (geri alma). */
export function duzenlemeSil(
  govde: RaporGovdesiV2,
  alan: DuzenlenebilirAlan,
): void {
  if (!govde.duzenlemeler) return;
  const anahtar = alanAnahtari(alan);
  govde.duzenlemeler = govde.duzenlemeler.filter(
    (kayit) => kayit.anahtar !== anahtar,
  );
}

/**
 * §11.4 — Eski raporun elle yazılmış metinlerini yeni gövdeye taşır.
 *
 * Rapor "güncel puanlarla yeniden üret" ile yenilendiğinde koordinatörün
 * düzelttiği bütün metinler eskiden sessizce kayboluyordu; emek harcanmış bir
 * veli metni tek tıkla siliniyor ve bu hiçbir yerde söylenmiyordu.
 *
 * TAŞIMA SEÇİMLİDİR (çağıran taraf sorar): puanlar değiştiyse üretimin yeni
 * yazdığı metin daha doğru olabilir. Taşınan metinler yeni defterde de
 * düzenleme olarak işaretlenir — hem "özgüne dön" çalışmaya devam eder (bu
 * kez YENİ üretimin metnine döner) hem de koordinatör hangi kutuların elle
 * yazıldığını görmeyi sürdürür.
 *
 * Hedefi kalmayan metinler taşınmaz ve `tasinamayan` olarak bildirilir.
 */
export function duzenlemeleriTasi(
  eskiGovde: RaporGovdesiV2,
  yeniGovde: RaporGovdesiV2,
  zaman: Date,
): { tasinan: string[]; tasinamayan: string[] } {
  const tasinan: string[] = [];
  const tasinamayan: string[] = [];

  for (const kayit of eskiGovde.duzenlemeler ?? []) {
    const alan = alandanCoz(kayit.anahtar);
    if (!alan) {
      tasinamayan.push(kayit.etiket);
      continue;
    }

    const elleYazilan = metniOku(eskiGovde, alan);
    const yeniUretilen = metniOku(yeniGovde, alan);

    if (elleYazilan === null || yeniUretilen === null) {
      tasinamayan.push(kayit.etiket);
      continue;
    }

    if (!metniYaz(yeniGovde, alan, elleYazilan)) {
      tasinamayan.push(kayit.etiket);
      continue;
    }

    duzenlemeIsle(yeniGovde, alan, yeniUretilen, kayit.kisi, zaman);
    tasinan.push(kayit.etiket);
  }

  return { tasinan, tasinamayan };
}
