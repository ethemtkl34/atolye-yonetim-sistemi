import { ogrenciMetniUret } from "./ai/ogrenci-metni";
import { beceriEtiketiCikar } from "./beceri-etiketleri";
import { db } from "./db";
import {
  gelisimAlanOrtalamalari,
  gelisimCevaplariCozumle,
  GELISIM_SORULARI,
} from "./gelisim-degerlendirmesi";
import { atolyeOzetiHesapla } from "./puan-hesaplari";
import {
  asimetriBul,
  atolyeKademesiCikar,
  gelisimAlanlariCikar,
  type RaporGovdesiV2,
} from "./rapor-govdesi";
import { grupGelisimOrtalamalari } from "./rapor-verisi";
import { urunOnerileriSec, type OneriAdayi } from "./urun-onerileri";

/**
 * §11 — İkinci sürüm rapor gövdesini veritabanından kurar.
 *
 * Motor katmanı saf; bu dosya ona girdiyi hazırlıyor. Sıralama önemli:
 * önce puanlardan kademeler, sonra gözlem notlarından yapay zekâ metni.
 * Yapay zekâ çağrısı en sonda ve BAŞARISIZ OLABİLİR — o durumda gövde
 * gözlem bölümü olmadan üretilir, rapor yine de alınabilir (§11.2).
 *
 * ŞUBE: öğrenci ve kayıtlar şube süzgecinden geçirilir; başka şubenin
 * kimliği yapıştırılırsa sorgu boş döner.
 */

/** Kazanım başlıklarının alan bazlı listesi — cümlelere gömülür. */
function kazanimHaritasi(): Map<string, string[]> {
  const harita = new Map<string, string[]>();
  for (const soru of GELISIM_SORULARI) {
    const mevcut = harita.get(soru.kategori);
    if (mevcut) mevcut.push(soru.baslik);
    else harita.set(soru.kategori, [soru.baslik]);
  }
  return harita;
}

/** Doğum tarihinden tam yaş; tarih yoksa null. */
function yasHesapla(dogumTarihi: Date | null, bugun: Date): number | null {
  if (!dogumTarihi) return null;
  let yas = bugun.getFullYear() - dogumTarihi.getFullYear();
  const ayFarki = bugun.getMonth() - dogumTarihi.getMonth();
  if (ayFarki < 0 || (ayFarki === 0 && bugun.getDate() < dogumTarihi.getDate())) {
    yas -= 1;
  }
  return yas >= 0 && yas < 120 ? yas : null;
}

export async function raporGovdesiV2Uret(
  ogrenciId: string,
  kayitIdleri: readonly string[],
  subeId: string,
  bugun: Date,
): Promise<RaporGovdesiV2 | null> {
  const ogrenci = await db.student.findFirst({
    where: { id: ogrenciId, branchId: subeId },
    select: { firstName: true, lastName: true, grade: true, birthDate: true },
  });
  if (!ogrenci) return null;

  const kayitlar = await db.enrollment.findMany({
    where: {
      id: { in: [...kayitIdleri] },
      studentId: ogrenciId,
      group: { branchId: subeId },
    },
    select: {
      id: true,
      groupId: true,
      gozlemNotu: true,
      group: {
        select: {
          name: true,
          term: {
            select: { id: true, name: true, egitimYili: true, _count: { select: { weeks: true } } },
          },
          club: { select: { id: true, name: true } },
        },
      },
      scores: {
        select: {
          attended: true,
          gozlemNotu: true,
          session: {
            select: {
              weekNumber: true,
              workshopType: { select: { id: true, name: true, sortOrder: true } },
            },
          },
          answers: {
            orderBy: { sortOrder: "asc" },
            select: {
              questionId: true,
              questionTextSnapshot: true,
              titleSnapshot: true,
              categorySnapshot: true,
              value: true,
              sortOrder: true,
            },
          },
        },
      },
      developmentAssessments: {
        where: { period: "DONEM_SONU" },
        select: { answersJson: true },
      },
    },
  });

  if (kayitlar.length === 0) return null;

  // --- Atölye kademeleri -------------------------------------------------
  const atolyeHavuzu = new Map<
    string,
    { ad: string; sira: number; puanlamalar: { attended: boolean; answers: typeof kayitlar[number]["scores"][number]["answers"] }[] }
  >();

  for (const kayit of kayitlar) {
    for (const puanlama of kayit.scores) {
      const atolye = puanlama.session.workshopType;
      const mevcut = atolyeHavuzu.get(atolye.id);
      const satir = { attended: puanlama.attended, answers: puanlama.answers };
      if (mevcut) mevcut.puanlamalar.push(satir);
      else
        atolyeHavuzu.set(atolye.id, {
          ad: atolye.name,
          sira: atolye.sortOrder,
          puanlamalar: [satir],
        });
    }
  }

  const atolyeKademeleri = [...atolyeHavuzu.entries()]
    .sort((a, b) => a[1].sira - b[1].sira)
    .map(([, atolye]) => {
      const ozet = atolyeOzetiHesapla(atolye.puanlamalar);
      return atolyeKademesiCikar({
        atolyeAdi: atolye.ad,
        soruOrtalamalari: ozet.soruOrtalamalari,
        katildigiOturumSayisi: ozet.katildigiOturumSayisi,
        katilmadigiOturumSayisi: ozet.katilmadigiOturumSayisi,
      });
    });

  // --- Gelişim alanları --------------------------------------------------
  const gelisimCevaplari = kayitlar.flatMap((kayit) =>
    kayit.developmentAssessments.flatMap((d) =>
      gelisimCevaplariCozumle(d.answersJson),
    ),
  );

  // Kıyas grubu ilk kaydın grubu: rapor tek bir programın raporu, birden
  // fazla kayıt kapsandığında da öğrencinin asıl grubu ilkidir.
  const grupOrtalamalari = await grupGelisimOrtalamalari(
    kayitlar[0].groupId,
    "DONEM_SONU",
  );

  const gelisimAlanlari = gelisimAlanlariCikar(
    gelisimAlanOrtalamalari(gelisimCevaplari),
    grupOrtalamalari,
    kazanimHaritasi(),
  );

  // --- Atölye içerik paragrafları ---------------------------------------
  const donemIdleri = kayitlar
    .map((k) => k.group.term?.id)
    .filter((id): id is string => Boolean(id));
  const kulupIdleri = kayitlar
    .map((k) => k.group.club?.id)
    .filter((id): id is string => Boolean(id));

  const icerikKayitlari = await db.atolyeIcerigi.findMany({
    where: {
      OR: [
        ...(donemIdleri.length ? [{ termId: { in: donemIdleri } }] : []),
        ...(kulupIdleri.length ? [{ clubId: { in: kulupIdleri } }] : []),
      ],
      workshopTypeId: { in: [...atolyeHavuzu.keys()] },
    },
    select: { metin: true, workshopType: { select: { name: true, sortOrder: true } } },
  });

  const atolyeIcerikleri = icerikKayitlari
    .sort((a, b) => a.workshopType.sortOrder - b.workshopType.sortOrder)
    .map((kayit) => ({ atolyeAdi: kayit.workshopType.name, metin: kayit.metin }));

  // --- Gözlem bölümü (yapay zekâ) ---------------------------------------
  const beceriler = await db.beceriTanimi.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { ad: true, tanim: true },
  });

  const yas = yasHesapla(ogrenci.birthDate, bugun);

  // Ürün adayları: öğrencinin desteklenecek ve güçlü alanları, ilgi duyduğu
  // atölyeler. Adaylar sistem tarafından süzülür; yapay zekâ yalnızca bu
  // listeden seçebilir.
  const desteklenecek = atolyeKademeleri
    .filter((a) => a.basari?.kademe === "DUSUK")
    .map((a) => a.atolyeAdi);
  const guclu = atolyeKademeleri
    .filter((a) => a.basari?.kademe === "YUKSEK")
    .map((a) => a.atolyeAdi);

  const ilgiliAtolyeIdleri = [...atolyeHavuzu.entries()]
    .filter(([, atolye]) =>
      atolyeKademeleri.find(
        (k) => k.atolyeAdi === atolye.ad && k.ilgi?.kademe === "YUKSEK",
      ),
    )
    .map(([id]) => id);

  const urunAdaylari: OneriAdayi[] = await db.oneriUrunu.findMany({
    where: { active: true },
    select: {
      id: true,
      ad: true,
      url: true,
      kategori: true,
      yasMin: true,
      yasMax: true,
      alanlar: true,
      beceriler: true,
      workshopTypeId: true,
    },
  });

  const secilenUrunler = urunOnerileriSec(urunAdaylari, {
    yas,
    desteklenecekBasliklar: desteklenecek,
    gucluBasliklar: guclu,
    ilgiliAtolyeIdleri,
  });

  const gozlemNotlari = kayitlar.flatMap((kayit) =>
    kayit.scores
      .filter((puanlama) => puanlama.gozlemNotu?.trim())
      .map((puanlama) => ({
        atolyeAdi: puanlama.session.workshopType.name,
        hafta: puanlama.session.weekNumber,
        konu: null as string | null,
        not: puanlama.gozlemNotu!.trim(),
      })),
  );

  const genelGozlem =
    kayitlar
      .map((kayit) => kayit.gozlemNotu?.trim())
      .filter(Boolean)
      .join("\n") || null;

  const ilkKayit = kayitlar[0];
  const programAdi =
    ilkKayit.group.term?.name ?? ilkKayit.group.club?.name ?? "Program";

  const metinSonucu = await ogrenciMetniUret({
    ilkAd: ogrenci.firstName,
    programAdi,
    haftaSayisi: ilkKayit.group.term?._count.weeks ?? null,
    atolyeSayisi: atolyeKademeleri.length,
    atolyeler: atolyeKademeleri.map((a) => ({
      ad: a.atolyeAdi,
      ilgi: a.ilgi?.etiket ?? null,
      basari: a.basari?.etiket ?? null,
    })),
    gelisimAlanlari: gelisimAlanlari.map((a) => ({
      ad: a.ad,
      kademe: a.bant?.etiket ?? null,
    })),
    gozlemler: gozlemNotlari,
    genelGozlem,
    beceriler,
    urunler: secilenUrunler.map((secim) => ({
      ad: secim.urun.ad,
      url: secim.urun.url,
      gerekce: secim.gerekce,
    })),
  });

  const beceriTanimHaritasi = new Map(beceriler.map((b) => [b.ad, b.tanim]));

  const gozlem =
    metinSonucu.durum === "tamam"
      ? {
          giris: metinSonucu.metin.giris,
          profil: metinSonucu.metin.profil,
          bloklar: metinSonucu.metin.bloklar.map((blok) => ({
            beceriAdi: blok.beceriAdi,
            // Tanım sözlükten alınır, modelin yazdığından değil: bu metin
            // kurumun sabit tanımı ve her raporda aynı olmalı.
            tanim: beceriTanimHaritasi.get(blok.beceriAdi) ?? "",
            etkinlik: blok.etkinlik || null,
            gozlem: blok.gozlem,
          })),
          sonuc: metinSonucu.metin.sonuc,
          oneriler: metinSonucu.metin.oneriler,
          urunler: secilenUrunler.map((secim) => ({
            ad: secim.urun.ad,
            url: secim.urun.url,
          })),
        }
      : null;

  return {
    surum: 2,
    ogrenci: {
      adSoyad: `${ogrenci.firstName} ${ogrenci.lastName}`,
      ilkAd: ogrenci.firstName,
      sinif: ogrenci.grade,
    },
    egitimYili: ilkKayit.group.term?.egitimYili ?? null,
    kapsam: kayitlar.map((kayit) => ({
      programAdi: kayit.group.term?.name ?? kayit.group.club?.name ?? "Program",
      grupAdi: kayit.group.name,
      tur: kayit.group.term ? ("Dönem" as const) : ("Kulüp" as const),
    })),
    atolyeIcerikleri,
    gelisimAlanlari,
    atolyeKademeleri,
    asimetriler: asimetriBul(
      atolyeKademeleri.map((a) => ({
        atolyeAdi: a.atolyeAdi,
        // Asimetri ham ortalamayla ölçülür ama kademe adımları da yeterli
        // bir yaklaşım veriyor: üç kademe arasındaki fark bir tam adım.
        ilgi: kademeSayisi(a.ilgi?.kademe),
        basari: kademeSayisi(a.basari?.kademe),
      })),
    ),
    gozlem,
    metinKaynagi: gozlem ? "ai" : "sablon",
  };
}

/** Kademeyi asimetri karşılaştırması için sayıya çevirir. */
function kademeSayisi(kademe: string | undefined): number | null {
  if (kademe === "YUKSEK") return 4.5;
  if (kademe === "ORTALAMA") return 3.5;
  if (kademe === "DUSUK") return 2.5;
  return null;
}

export { beceriEtiketiCikar };
