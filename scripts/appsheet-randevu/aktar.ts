/**
 * Eski CRM (AppSheet) randevularının aktarımı — Eylül 2026.
 *
 *   DATABASE_URL="…" npx tsx scripts/appsheet-randevu/aktar.ts <csv> --kuru
 *   DATABASE_URL="…" APPSHEET_ONAY=evet npx tsx scripts/appsheet-randevu/aktar.ts <csv>
 *
 * `--kuru` hiçbir şey yazmaz; eşleştirmeyi yapıp `cikti/rapor.json` üretir.
 * Yazma koşusu tek bir işlemde (transaction) çalışır: yarıda kalırsa hiçbir
 * satır kalmaz. Yazılan her uzman/veli/öğrenci kimliği `cikti/manifest.json`a
 * düşer; randevular `disKaynakId = "appsheet:<Rand. ID>"` taşır. `geri-al.ts`
 * yalnız bunlara dokunur.
 *
 * IDEMPOTANLIK: `disKaynakId` benzersiz — dosya iki kez aktarılırsa ikinci
 * koşu var olan randevuları atlar, veli/öğrenci de yeniden kullanılır.
 *
 * KURUM KARARLARI (17 Eylül 2026):
 *  - "Son Durum" boş geçmiş randevu → GERÇEKLEŞTİ; Tamamlandı/Ödendi/Uzman
 *    Sonlandırdı → GERÇEKLEŞTİ; İptal → İPTAL; Kaparo Bekliyor ve günü
 *    gelmemiş boşlar → PLANLANDI.
 *  - Kesim: Ümraniye yalnız 9 Eylül 2026 ÖNCESİ (sonrası yeni sistemde zaten
 *    var), Güneşli tamamı. Ek güvence: canlıda aynı şube + başlangıç + uzmanla
 *    duran randevu atlanır.
 *  - Kayıtlı olmayan çocuk için kısa öğrenci kaydı (ad, soyad) açılır — randevu
 *    formundaki "yeni öğrenci" ile aynı. Veli bağı (Guardian) KURULMAZ: bağ
 *    anne/baba türü istiyor ve dosyada bu bilgi yok.
 *  - Hizmet: OYUN TERAPİSİ → Oyun Temelli Danışmanlık, ERGEN TERAPİ → Ergen
 *    Danışmanlığı, Ergoterapi → Duyu Bütünleme Programı.
 *  - Sistemde olmayan uzman PASİF açılır (yeni randevuda seçilemez).
 *
 * VELİ: aynı şubede aynı telefonlu veliler aday. Önce tam ad; yoksa İLK ADI
 * uyan TEK aday (canlıdaki velilerin çoğu yalnız ilk adla girilmiş: "İrem" ↔
 * "İrem Aksu Enginyurt"); o da yoksa yeni veli. Yalnız telefona göre
 * birleştirmek anne ile babayı tek veliye çökertirdi (bkz. DECISIONS "Veli
 * kimlik anahtarı") — aynı telefonda adı uymayan kişi ayrı veli kalır.
 * Var olan velinin adı DEĞİŞTİRİLMEZ.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import type { RandevuDurumu } from "../../src/generated/prisma/enums";
import { normalizeArama, normalizeTelefon } from "../../src/lib/turkce";
import { siradakiUzmanRengi } from "../../src/lib/uzman-renkleri";

const KURU = process.argv.includes("--kuru");
const CSV_YOLU = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!CSV_YOLU) throw new Error("CSV yolu verilmeli.");
if (!KURU && process.env.APPSHEET_ONAY !== "evet") {
  throw new Error("Yazma koşusu için APPSHEET_ONAY=evet gerekli (önce --kuru ile deneyin).");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CIKTI = join(import.meta.dirname, "cikti");
const KAYNAK_ONEKI = "appsheet:";

const SUBELER: Record<string, string> = {
  ÜMRANİYE: "sube_umraniye",
  GÜNEŞLİ: "sube_gunesli",
};
/** Ümraniye bu günden itibaren yeni sistemi kullanıyor (UTC gece yarısı çapası). */
const UMRANIYE_KESIM = Date.UTC(2026, 8, 9);

const HIZMET_ESLEME: Record<string, string> = {
  "oyun terapisi": "oyun temelli danismanlik",
  "ergen terapi": "ergen danismanligi",
  ergoterapi: "duyu butunleme programi",
  "st.binet": "st. binet",
};

/** Aynı kişinin dosyadaki yazım hataları → doğru yazımın normal hâli. */
const UZMAN_YAZIM: Record<string, string> = {
  "vefa abdrahimova": "vefa abdurrahimova",
  "eda erturk": "eda nur erturk",
};

// ---------------------------------------------------------------- yardımcılar

/** `;` ayraçlı, tırnaklı alan destekli CSV. */
function csvOku(metin: string): Record<string, string>[] {
  const satirlar: string[][] = [];
  let alan = "";
  let satir: string[] = [];
  let tirnakta = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnakta) {
      if (c === '"' && metin[i + 1] === '"') {
        alan += '"';
        i++;
      } else if (c === '"') tirnakta = false;
      else alan += c;
    } else if (c === '"') tirnakta = true;
    else if (c === ";") {
      satir.push(alan);
      alan = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && metin[i + 1] === "\n") i++;
      satir.push(alan);
      satirlar.push(satir);
      satir = [];
      alan = "";
    } else alan += c;
  }
  if (alan || satir.length) {
    satir.push(alan);
    satirlar.push(satir);
  }
  const [baslik, ...govde] = satirlar.filter((s) => s.some((a) => a.trim()));
  return govde.map((s) => Object.fromEntries(baslik.map((b, i) => [b, s[i] ?? ""])));
}

/** "10.01.2024" + "14:30" → duvar saati, UTC alanlarında (sistemin saat sözleşmesi). */
function duvarSaati(tarih: string, saat = "00:00"): Date | null {
  const t = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(tarih.trim());
  const s = /^(\d{1,2}):(\d{2})/.exec(saat.trim());
  if (!t || !s) return null;
  return new Date(Date.UTC(+t[3], +t[2] - 1, +t[1], +s[1], +s[2]));
}

/** "6.01.2025 10:40" İstanbul saati → gerçek an (UTC). */
function istanbulAni(metin: string): Date | null {
  const [tarih, saat] = metin.trim().split(/\s+/);
  const duvar = tarih ? duvarSaati(tarih, saat ?? "00:00") : null;
  return duvar ? new Date(duvar.getTime() - 3 * 3_600_000) : null;
}

/** "₺5.470,00" → 547000 kuruş. */
function kurus(metin: string): number | null {
  const temiz = metin.replace(/[^\d,]/g, "").replace(",", ".");
  if (!temiz) return null;
  const deger = Math.round(Number(temiz) * 100);
  return Number.isFinite(deger) ? deger : null;
}

/** "ÖMER ASAF serçe" → "Ömer Asaf Serçe". */
function ozelAd(metin: string): string {
  return metin
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .map((k) => k.charAt(0).toLocaleUpperCase("tr-TR") + k.slice(1))
    .join(" ");
}

/** Son sözcük soyad, gerisi ad. */
function adSoyad(metin: string): { ad: string; soyad: string } {
  const parcalar = ozelAd(metin).split(" ");
  if (parcalar.length === 1) return { ad: parcalar[0], soyad: "" };
  return { ad: parcalar.slice(0, -1).join(" "), soyad: parcalar.at(-1)! };
}

const say = (sayac: Record<string, number>, anahtar: string) => {
  sayac[anahtar] = (sayac[anahtar] ?? 0) + 1;
};

// ---------------------------------------------------------------- ana akış

async function main() {
  const satirlar = csvOku(readFileSync(CSV_YOLU!, "utf8").replace(/^﻿/, ""));
  const bugun = (() => {
    const [y, a, g] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" })
      .format(new Date())
      .split("-")
      .map(Number);
    return Date.UTC(y, a - 1, g);
  })();

  const [uzmanlar, hizmetler, veliler, ogrenciler, kullanicilar, mevcutRandevular] =
    await Promise.all([
      db.uzman.findMany({ select: { id: true, ad: true, renk: true } }),
      db.hizmet.findMany({ select: { id: true, ad: true, sureDk: true } }),
      db.veli.findMany({ select: { id: true, branchId: true, searchName: true, searchPhone: true } }),
      db.student.findMany({ select: { id: true, branchId: true, searchName: true } }),
      db.user.findMany({ select: { id: true, name: true } }),
      db.randevu.findMany({
        select: { branchId: true, baslangic: true, uzmanId: true, disKaynakId: true },
      }),
    ]);

  const hizmetHaritasi = new Map(hizmetler.map((h) => [normalizeArama(h.ad), h]));
  const uzmanHaritasi = new Map(uzmanlar.map((u) => [normalizeArama(u.ad), u.id]));
  const kullaniciHaritasi = new Map(kullanicilar.map((k) => [normalizeArama(k.name), k.id]));
  /** Şube + telefon → o telefonlu veliler (yeni açılanlar da eklenir). */
  const telefonVelileri = new Map<string, { id: string; searchName: string }[]>();
  for (const v of veliler) {
    const k = `${v.branchId}|${v.searchPhone ?? ""}`;
    telefonVelileri.set(k, [...(telefonVelileri.get(k) ?? []), { id: v.id, searchName: v.searchName }]);
  }
  const ilkAdUyumlu = (a: string, b: string) =>
    a.split(" ")[0] === b.split(" ")[0] || a.startsWith(b) || b.startsWith(a);
  const veliEslesmesi = { tam: 0, ilkAd: 0, yeni: 0 };
  const ogrenciAdlari = new Map<string, string[]>();
  for (const o of ogrenciler) {
    const k = `${o.branchId}|${o.searchName}`;
    ogrenciAdlari.set(k, [...(ogrenciAdlari.get(k) ?? []), o.id]);
  }
  const mevcutAnahtar = new Set(
    mevcutRandevular.map((r) => `${r.branchId}|${r.baslangic.getTime()}|${r.uzmanId}`),
  );
  const mevcutKaynak = new Set(
    mevcutRandevular.map((r) => r.disKaynakId).filter((x): x is string => Boolean(x)),
  );

  // Şubesi boş satır için: uzmanın dosyada en çok geçtiği şube.
  const uzmanSubeleri = new Map<string, Record<string, number>>();
  for (const s of satirlar) {
    const sube = SUBELER[s["Şube"].trim()];
    const uz = normalizeArama(s["Uzman"]);
    if (!sube || !uz) continue;
    const sayac = uzmanSubeleri.get(uz) ?? {};
    say(sayac, sube);
    uzmanSubeleri.set(uz, sayac);
  }

  const atlanan: Record<string, number> = {};
  const durumlar: Record<string, number> = {};
  const uyarilar: Record<string, number> = {};

  const yeniUzmanlar = new Map<
    string,
    { id: string; ad: string; subeler: Set<string>; hizmetler: Set<string> }
  >();
  const yeniVeliler = new Map<
    string,
    { id: string; branchId: string; fullName: string; phone: string | null; searchName: string; searchPhone: string | null }
  >();
  const yeniOgrenciler = new Map<
    string,
    { id: string; branchId: string; firstName: string; lastName: string; searchName: string }
  >();
  const eslesenOgrenci = { tekil: 0, belirsiz: 0 };

  const randevular: Prisma.RandevuCreateManyInput[] = [];

  for (const s of satirlar) {
    const kaynakId = `${KAYNAK_ONEKI}${s["Rand. ID"].trim()}`;
    if (mevcutKaynak.has(kaynakId)) {
      say(atlanan, "daha önce aktarılmış");
      continue;
    }

    // Uzman
    let uzmanNormal = normalizeArama(s["Uzman"]);
    uzmanNormal = UZMAN_YAZIM[uzmanNormal] ?? uzmanNormal;
    if (!uzmanNormal) {
      say(atlanan, "uzman boş");
      continue;
    }

    // Şube
    let subeId = SUBELER[s["Şube"].trim()];
    if (!subeId) {
      const sayac = uzmanSubeleri.get(uzmanNormal);
      subeId = sayac ? Object.entries(sayac).sort((a, b) => b[1] - a[1])[0][0] : "";
      if (!subeId) {
        say(atlanan, "şube çıkarılamadı");
        continue;
      }
      say(uyarilar, "şube uzmandan çıkarıldı");
    }

    // Zaman
    const baslangic = duvarSaati(s["Tarih"], s["Başlama"]);
    if (!baslangic) {
      say(atlanan, "tarih/saat okunamadı");
      continue;
    }
    if (subeId === "sube_umraniye" && baslangic.getTime() >= UMRANIYE_KESIM) {
      say(atlanan, "Ümraniye 9 Eylül ve sonrası (yeni sistemde)");
      continue;
    }

    // Hizmet
    const hizmetNormal = normalizeArama(s["Hizmet"]);
    const hizmet = hizmetHaritasi.get(HIZMET_ESLEME[hizmetNormal] ?? hizmetNormal);
    if (!hizmet) {
      say(atlanan, `hizmet eşleşmedi: ${s["Hizmet"]}`);
      continue;
    }

    let bitis = duvarSaati(s["Tarih"], s["Bitiş"]);
    if (!bitis || bitis <= baslangic) {
      bitis = new Date(baslangic.getTime() + hizmet.sureDk * 60_000);
      say(uyarilar, "bitiş hizmet süresinden hesaplandı");
    }

    // Uzman kimliği (yoksa pasif yeni uzman)
    let uzmanId = uzmanHaritasi.get(uzmanNormal);
    if (!uzmanId) {
      const yeni =
        yeniUzmanlar.get(uzmanNormal) ??
        { id: randomUUID(), ad: ozelAd(s["Uzman"]), subeler: new Set<string>(), hizmetler: new Set<string>() };
      yeni.subeler.add(subeId);
      yeni.hizmetler.add(hizmet.id);
      yeniUzmanlar.set(uzmanNormal, yeni);
      uzmanId = yeni.id;
    }

    // Aynı randevu canlıda var mı (panelden girilmiş)
    if (mevcutAnahtar.has(`${subeId}|${baslangic.getTime()}|${uzmanId}`)) {
      say(atlanan, "canlıda aynı şube/saat/uzmanla zaten var");
      continue;
    }

    // Veli
    const veliBilgisi = s["virVeliBilgi"];
    const virgul = veliBilgisi.lastIndexOf(",");
    const veliAdHam = (virgul >= 0 ? veliBilgisi.slice(0, virgul) : veliBilgisi).trim();
    const telefonHam = (virgul >= 0 ? veliBilgisi.slice(virgul + 1) : "").trim();
    const veliAdi = veliAdHam ? ozelAd(veliAdHam) : "İsimsiz veli";
    const searchName = normalizeArama(veliAdi);
    const searchPhone = /\d/.test(telefonHam) ? normalizeTelefon(telefonHam) : null;
    const telefonAnahtari = `${subeId}|${searchPhone ?? ""}`;
    const adaylar = telefonVelileri.get(telefonAnahtari) ?? [];
    const tam = adaylar.find((v) => v.searchName === searchName);
    // Telefonsuz velide ilk ad benzerliği anlamsız: yalnız tam ad.
    const uyumlular = searchPhone ? adaylar.filter((v) => ilkAdUyumlu(v.searchName, searchName)) : [];
    let veliId: string;
    if (tam) {
      veliId = tam.id;
      veliEslesmesi.tam += 1;
    } else if (uyumlular.length === 1) {
      veliId = uyumlular[0].id;
      veliEslesmesi.ilkAd += 1;
    } else {
      const yeni = {
        id: randomUUID(),
        branchId: subeId,
        fullName: veliAdi,
        phone: telefonHam || null,
        searchName,
        searchPhone,
      };
      yeniVeliler.set(yeni.id, yeni);
      telefonVelileri.set(telefonAnahtari, [...adaylar, { id: yeni.id, searchName }]);
      veliId = yeni.id;
      veliEslesmesi.yeni += 1;
    }
    if (searchPhone && searchPhone.length !== 10) say(uyarilar, "telefon 10 haneli değil");

    // Öğrenci
    const notlar: string[] = [];
    let ogrenciId: string | null = null;
    const cocukHam = s["Öğrenci"].trim();
    if (cocukHam) {
      const cocukNormal = normalizeArama(cocukHam);
      const adaylar = ogrenciAdlari.get(`${subeId}|${cocukNormal}`) ?? [];
      if (adaylar.length === 1) {
        ogrenciId = adaylar[0];
        eslesenOgrenci.tekil += 1;
      } else if (adaylar.length > 1) {
        // Aynı şubede aynı adla birden çok öğrenci: yanlış karta bağlamaktansa
        // bağlamayıp adı nota yazmak.
        eslesenOgrenci.belirsiz += 1;
        notlar.push(`Çocuk: ${ozelAd(cocukHam)}`);
      } else {
        const anahtar = `${subeId}|${cocukNormal}|${veliId}`;
        const { ad, soyad } = adSoyad(cocukHam);
        const yeni =
          yeniOgrenciler.get(anahtar) ??
          { id: randomUUID(), branchId: subeId, firstName: ad, lastName: soyad, searchName: normalizeArama(`${ad} ${soyad}`) };
        yeniOgrenciler.set(anahtar, yeni);
        ogrenciId = yeni.id;
      }
    } else say(uyarilar, "öğrenci adı boş");

    // Durum
    const sonDurum = s["Son Durum"].trim();
    let durum: RandevuDurumu;
    if (sonDurum === "İptal") durum = "IPTAL";
    else if (["Tamamlandı", "Ödendi", "Uzman Sonlandırdı"].includes(sonDurum)) durum = "GERCEKLESTI";
    else if (sonDurum === "Kaparo Bekliyor") durum = "PLANLANDI";
    else if (sonDurum === "") durum = baslangic.getTime() < bugun ? "GERCEKLESTI" : "PLANLANDI";
    else {
      say(atlanan, `bilinmeyen durum: ${sonDurum}`);
      continue;
    }
    say(durumlar, `${sonDurum || "(boş)"} → ${durum}`);
    if (sonDurum === "Uzman Sonlandırdı") notlar.push("Uzman sonlandırdı.");
    if (sonDurum === "Kaparo Bekliyor") notlar.push("Kaparo bekliyor.");

    // Ücret
    const birim = kurus(s["Birim Fiyat"]) ?? 0;
    const tutar = kurus(s["Tutar"]) ?? birim;
    const ucretKurus = Math.max(birim, tutar, 0);
    const indirimKurus = Math.max(0, ucretKurus - tutar);
    const indirimNotu = s["İndirim ID"].trim() || null;

    for (const alan of ["Açıklama", "Randevu Notları"]) {
      if (s[alan]?.trim()) notlar.push(s[alan].trim());
    }

    const olusturulma = istanbulAni(s["Kayit Tar"]);
    const guncelleme = istanbulAni(s["Günc. Tar"]);

    randevular.push({
      id: randomUUID(),
      disKaynakId: kaynakId,
      branchId: subeId,
      uzmanId,
      hizmetId: hizmet.id,
      veliId,
      ogrenciId,
      baslangic,
      bitis,
      durum,
      ucretKurus,
      indirimKurus,
      indirimNotu: indirimKurus > 0 ? indirimNotu : null,
      not: notlar.length ? notlar.join(" · ").slice(0, 2000) : null,
      iptalAt: durum === "IPTAL" ? (guncelleme ?? olusturulma ?? baslangic) : null,
      createdByUserId: kullaniciHaritasi.get(normalizeArama(s["Personel"])) ?? null,
      ...(olusturulma ? { createdAt: olusturulma } : {}),
    });
  }

  const subeSayisi: Record<string, number> = {};
  const aySayisi: Record<string, number> = {};
  for (const r of randevular) {
    say(subeSayisi, r.branchId);
    say(aySayisi, new Date(r.baslangic).toISOString().slice(0, 4));
  }

  const rapor = {
    kuru: KURU,
    csvSatiri: satirlar.length,
    yazilacakRandevu: randevular.length,
    subeye: subeSayisi,
    yila: aySayisi,
    durumlar,
    atlanan,
    uyarilar,
    yeniUzman: [...yeniUzmanlar.values()].map((u) => ({ ad: u.ad, subeler: [...u.subeler] })),
    yeniVeli: yeniVeliler.size,
    yeniOgrenci: yeniOgrenciler.size,
    mevcutOgrenciyeBaglanan: eslesenOgrenci.tekil,
    adiBelirsizOgrenci: eslesenOgrenci.belirsiz,
    veliEslesmesi,
  };

  mkdirSync(CIKTI, { recursive: true });
  writeFileSync(join(CIKTI, KURU ? "rapor-kuru.json" : "rapor.json"), JSON.stringify(rapor, null, 2));
  console.log(JSON.stringify(rapor, null, 2));
  if (KURU) return;

  // ------------------------------------------------------------ yazma
  const kullanilanRenkler = uzmanlar.map((u) => u.renk);
  const uzmanKayitlari = [...yeniUzmanlar.values()].map((u) => {
    const renk = siradakiUzmanRengi(kullanilanRenkler);
    kullanilanRenkler.push(renk);
    return { ...u, renk };
  });

  await db.$transaction(
    async (tx) => {
      for (const u of uzmanKayitlari) {
        await tx.uzman.create({ data: { id: u.id, ad: u.ad, renk: u.renk, aktif: false } });
      }
      await tx.uzmanSube.createMany({
        data: uzmanKayitlari.flatMap((u) => [...u.subeler].map((subeId) => ({ uzmanId: u.id, subeId }))),
      });
      await tx.uzmanHizmet.createMany({
        data: uzmanKayitlari.flatMap((u) => [...u.hizmetler].map((hizmetId) => ({ uzmanId: u.id, hizmetId }))),
      });
      const veliListesi = [...yeniVeliler.values()];
      for (let i = 0; i < veliListesi.length; i += 1000) {
        await tx.veli.createMany({ data: veliListesi.slice(i, i + 1000) });
      }
      const ogrenciListesi = [...yeniOgrenciler.values()];
      for (let i = 0; i < ogrenciListesi.length; i += 1000) {
        await tx.student.createMany({ data: ogrenciListesi.slice(i, i + 1000) });
      }
      for (let i = 0; i < randevular.length; i += 1000) {
        await tx.randevu.createMany({ data: randevular.slice(i, i + 1000), skipDuplicates: true });
      }
    },
    { timeout: 10 * 60_000, maxWait: 60_000 },
  );

  const manifest = {
    aktarimTarihi: new Date().toISOString(),
    kaynakOneki: KAYNAK_ONEKI,
    uzmanlar: uzmanKayitlari.map((u) => u.id),
    veliler: [...yeniVeliler.values()].map((v) => v.id),
    ogrenciler: [...yeniOgrenciler.values()].map((o) => o.id),
    randevuSayisi: randevular.length,
  };
  writeFileSync(join(CIKTI, `manifest-${Date.now()}.json`), JSON.stringify(manifest, null, 2));
  console.log("YAZILDI:", manifest.randevuSayisi, "randevu");
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
