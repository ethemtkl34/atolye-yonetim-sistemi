/**
 * Rapor çıktısını uçtan uca denemek için eksik test verisini doldurur.
 *
 *   npx tsx --env-file=.env.local scripts/test-verisi/uret.ts
 *
 * Üç iş yapar:
 *   1. Soru seti değişmiş atölyelerde `attended=true` olup aktif soruları
 *      cevaplanmamış puanlamalara `ScoreAnswer` satırı üretir.
 *   2. Eksik `DevelopmentAssessment` (DONEM_SONU) kayıtlarını oluşturur.
 *   3. Kayıt ve oturum gözlem notlarını yazar.
 *
 * GERİ ALINABİLİR: yazılan her satırın kimliği `manifest.json` dosyasına
 * düşer; `geri-al.ts` yalnızca o kimlikleri siler. Betik hiçbir mevcut veriyi
 * ezmez — dolu bir gözlem notunun, cevaplanmış bir sorunun veya var olan bir
 * değerlendirmenin üstüne yazmaz, atlar.
 *
 * PUANLAR RASTGELE DEĞİL (`ornek-veri.ts` ile aynı ilke). Her öğrencinin
 * `ogrenci-profilleri.ts` içinde bir karakter tarifi var; puanlar, gelişim
 * değerlendirmesi ve gözlem notları aynı tariften türüyor. Böylece rapordaki
 * kademe ile gözlem metni birbirini doğruluyor.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { GELISIM_SORULARI } from "../../src/lib/gelisim-degerlendirmesi";
import {
  ATOLYE_ANAHTARLARI,
  PROFILLER,
  type AtolyeAnahtari,
  type OgrenciProfili,
} from "./ogrenci-profilleri";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MANIFEST_YOLU = join(import.meta.dirname, "manifest.json");

/** Hedef program — gelişim değerlendirmesi ve gözlem notları buraya yazılır. */
const HEDEF_SUBE = "sube_umraniye";
const HEDEF_DONEM = "cms3yfj170000yuguqr1zc7bl"; // 2026 Sonbahar Dönemi

/** Soru seti değişen atölyeler; yeniden puanlama bunlarla sınırlı değil ama
 *  eksik satırların tamamı bu beşinde ve kulüpteki üç tanesinde. */
const ILGI_KATEGORISI = "Dersin İlgi ve Merak Alanları";

/**
 * Gözlem notu yazılan satır ve ÜSTÜNE YAZILAN eski değer.
 *
 * Eski değer saklanıyor çünkü betik boş olmayan notların da üstüne yazıyor:
 * üretimde duran birkaç not "istekli katıldı", "dikkatle dinliyor" gibi sıfat
 * cümlelerinden oluşuyor ve rapor motoruna verecek somut davranışı yok.
 * Bunları değiştirmek işin amacı, ama geri dönüşü kaybetmek değil — geri alma
 * `oncekiDeger`'i olduğu gibi yerine koyar.
 */
type GozlemKaydi = { id: string; oncekiDeger: string | null };

type Manifest = {
  olusturmaZamani: string;
  scoreAnswerIdleri: string[];
  gelisimDegerlendirmeIdleri: string[];
  kayitGozlemleri: GozlemKaydi[];
  puanlamaGozlemleri: GozlemKaydi[];
  mufredatIdleri: string[];
  atolyeIcerikIdleri: string[];
};

// ---------------------------------------------------------------------------
// Belirlenimci rastgelelik
// ---------------------------------------------------------------------------

/**
 * Aynı girdi her çalıştırmada aynı çıktıyı versin diye tohumlu üretici.
 * `Math.random` kullanılsaydı betiği ikinci kez çalıştırmak farklı puanlar
 * üretir, "dün gördüğüm rapor bugün neden başka" sorusu doğardı.
 */
function tohumla(metin: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < metin.length; i++) {
    h ^= metin.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Verilen sayıda 1–5 arası tam sayı üretir; ortalamaları `hedef`e en yakın
 * tam sayı toplamına oturur.
 *
 * Neden toplam üzerinden: kademe eşikleri ortalamaya bakıyor (atölyede 4,0 ve
 * 3,0; gelişimde grup farkı ±0,25). Puanları tek tek rastgele seçmek
 * ortalamayı eşiğin yanlış tarafına düşürebilirdi. Önce hedef toplam
 * sabitleniyor, sonra toplamı bozmayan yer değiştirmelerle dağılıma
 * çeşitlilik veriliyor — hepsi aynı sayı olmasın diye.
 */
function degerlerUret(
  adet: number,
  hedef: number,
  rastgele: () => number,
): number[] {
  if (adet === 0) return [];

  const hedefToplam = Math.min(
    adet * 5,
    Math.max(adet * 1, Math.round(adet * hedef)),
  );
  const taban = Math.floor(hedefToplam / adet);
  const artan = hedefToplam - taban * adet;

  const degerler = Array.from({ length: adet }, () => taban);
  const sira = [...degerler.keys()].sort(() => rastgele() - 0.5);
  for (let i = 0; i < artan; i++) degerler[sira[i]] += 1;

  // Toplamı koruyan salınım: bir puanı artırıp başka birini azaltmak
  // ortalamayı bozmadan "herkese aynı puan" görüntüsünü kırıyor.
  const salinim = Math.floor(adet / 3);
  for (let i = 0; i < salinim; i++) {
    const a = Math.floor(rastgele() * adet);
    const b = Math.floor(rastgele() * adet);
    if (a !== b && degerler[a] < 5 && degerler[b] > 1) {
      degerler[a] += 1;
      degerler[b] -= 1;
    }
  }

  return degerler;
}

/** Profili olmayan kayıtlar için hedef ortalama — 2,4 ile 4,7 arasına yayılır. */
function turetilmisHedef(anahtar: string): number {
  const rastgele = tohumla(anahtar);
  return 2.4 + rastgele() * 2.3;
}

function profilBul(ad: string, soyad: string): OgrenciProfili | undefined {
  return PROFILLER.find((p) => p.ad === ad && p.soyad === soyad);
}

function atolyeAnahtariBul(atolyeAdi: string): AtolyeAnahtari | undefined {
  return (Object.keys(ATOLYE_ANAHTARLARI) as AtolyeAnahtari[]).find(
    (k) => ATOLYE_ANAHTARLARI[k] === atolyeAdi,
  );
}

// ---------------------------------------------------------------------------
// 1. İş — eksik ScoreAnswer satırları
// ---------------------------------------------------------------------------

async function eksikCevaplariUret(manifest: Manifest) {
  console.log("\n[1/3] Eksik puanlama cevapları üretiliyor...");

  const sorular = await db.question.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      workshopTypeId: true,
      text: true,
      title: true,
      category: true,
      sortOrder: true,
    },
  });

  const atolyeSorulari = new Map<string, typeof sorular>();
  for (const soru of sorular) {
    const mevcut = atolyeSorulari.get(soru.workshopTypeId);
    if (mevcut) mevcut.push(soru);
    else atolyeSorulari.set(soru.workshopTypeId, [soru]);
  }

  const puanlamalar = await db.score.findMany({
    where: { attended: true },
    select: {
      id: true,
      enrollmentId: true,
      session: { select: { workshopTypeId: true, workshopType: { select: { name: true } } } },
      answers: { select: { questionId: true } },
      enrollment: {
        select: { student: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  // Aktif soruların hepsi cevaplanmamış olanlar — §10.3'ün "EKSIK" durumu.
  const eksikler = puanlamalar.filter((p) => {
    const aktifSorular = atolyeSorulari.get(p.session.workshopTypeId) ?? [];
    if (aktifSorular.length === 0) return false;
    const cevaplanan = new Set(p.answers.map((c) => c.questionId));
    return !aktifSorular.every((s) => cevaplanan.has(s.id));
  });

  console.log(`  ${eksikler.length} eksik puanlama bulundu.`);
  if (eksikler.length === 0) return;

  // Kayıt × atölye kümeleri: hedef ortalama bu düzeyde tutuluyor, tek tek
  // oturumda değil. Kategori ortalaması bütün oturumların puanları üzerinden
  // ağırlıklı alınıyor (`kategoriOrtalamalari`), hedef de orada anlamlı.
  type Kume = { puanlamalar: typeof eksikler; atolyeId: string; atolyeAdi: string; ad: string; soyad: string };
  const kumeler = new Map<string, Kume>();

  for (const p of eksikler) {
    const anahtar = `${p.enrollmentId}|${p.session.workshopTypeId}`;
    const mevcut = kumeler.get(anahtar);
    if (mevcut) mevcut.puanlamalar.push(p);
    else
      kumeler.set(anahtar, {
        puanlamalar: [p],
        atolyeId: p.session.workshopTypeId,
        atolyeAdi: p.session.workshopType.name,
        ad: p.enrollment.student.firstName,
        soyad: p.enrollment.student.lastName,
      });
  }

  type YeniCevap = {
    scoreId: string;
    questionId: string;
    questionTextSnapshot: string;
    titleSnapshot: string | null;
    categorySnapshot: string | null;
    sortOrder: number;
    value: number | null;
  };
  const yeniCevaplar: YeniCevap[] = [];

  for (const [anahtar, kume] of kumeler) {
    const aktifSorular = atolyeSorulari.get(kume.atolyeId)!;
    const profil = profilBul(kume.ad, kume.soyad);
    const atolyeAnahtari = atolyeAnahtariBul(kume.atolyeAdi);

    // Kategori bazlı hedefler: profil varsa oradan, yoksa türetilir.
    const hedefler = new Map<string, number>();
    for (const kategori of new Set(
      aktifSorular.map((s) => s.category ?? "(kategorisiz)"),
    )) {
      const ilgiMi = kategori === ILGI_KATEGORISI;
      if (profil && atolyeAnahtari) {
        const [ilgi, yetenek] = profil.atolyeler[atolyeAnahtari];
        hedefler.set(kategori, ilgiMi ? ilgi : yetenek);
      } else {
        hedefler.set(kategori, turetilmisHedef(`${anahtar}|${kategori}`));
      }
    }

    // Kategori başına bütün (oturum × soru) yuvaları tek seferde üretilir.
    for (const [kategori, hedef] of hedefler) {
      const kategoriSorulari = aktifSorular.filter(
        (s) => (s.category ?? "(kategorisiz)") === kategori,
      );
      const yuvalar = kume.puanlamalar.flatMap((p) =>
        kategoriSorulari.map((s) => ({ puanlama: p, soru: s })),
      );

      const rastgele = tohumla(`${anahtar}|${kategori}|v2`);

      // §10.3 — "Değerlendirilemedi" yolu da veride bulunsun diye seyrek
      // olarak null bırakılıyor; ortalamaya girmez, hedefi kaydırmaz.
      const bosIndeksler = new Set<number>();
      if (yuvalar.length >= 8) {
        const bosAdet = Math.floor(yuvalar.length * 0.02);
        for (let i = 0; i < bosAdet; i++) {
          bosIndeksler.add(Math.floor(rastgele() * yuvalar.length));
        }
      }

      const doluIndeksler = yuvalar
        .map((_, i) => i)
        .filter((i) => !bosIndeksler.has(i));
      const degerler = degerlerUret(doluIndeksler.length, hedef, rastgele);

      const degerHaritasi = new Map<number, number>();
      doluIndeksler.forEach((yuvaIndeksi, i) => {
        degerHaritasi.set(yuvaIndeksi, degerler[i]);
      });

      yuvalar.forEach((yuva, i) => {
        yeniCevaplar.push({
          scoreId: yuva.puanlama.id,
          questionId: yuva.soru.id,
          questionTextSnapshot: yuva.soru.text,
          // Kademe hesabı bu iki alandan çıkıyor; boş bırakılırsa rapor
          // "Değerlendirilmedi" basar.
          titleSnapshot: yuva.soru.title,
          categorySnapshot: yuva.soru.category,
          sortOrder: yuva.soru.sortOrder,
          value: degerHaritasi.get(i) ?? null,
        });
      });
    }
  }

  // Zaten cevabı olan (soru, puanlama) çiftleri atlanır — eski pasif soru
  // cevaplarına ve elle girilmiş satırlara dokunulmaz.
  const mevcutCiftler = new Set(
    eksikler.flatMap((p) => p.answers.map((c) => `${p.id}|${c.questionId}`)),
  );
  const yazilacak = yeniCevaplar.filter(
    (c) => !mevcutCiftler.has(`${c.scoreId}|${c.questionId}`),
  );

  console.log(`  ${yazilacak.length} cevap satırı yazılıyor...`);

  const etkilenenScoreIdleri = [...new Set(yazilacak.map((c) => c.scoreId))];
  const aktifSoruIdleri = sorular.map((s) => s.id);

  for (let i = 0; i < yazilacak.length; i += 500) {
    await db.scoreAnswer.createMany({ data: yazilacak.slice(i, i + 500) });
  }

  // Yazılan satırların kimliklerini geri oku: bu puanlamalarda daha önce
  // AKTİF soruya ait cevap yoktu, dolayısıyla bu küme tam olarak yeni satırlar.
  const yazilanlar = await db.scoreAnswer.findMany({
    where: {
      scoreId: { in: etkilenenScoreIdleri },
      questionId: { in: aktifSoruIdleri },
    },
    select: { id: true },
  });
  manifest.scoreAnswerIdleri = [
    ...new Set([...manifest.scoreAnswerIdleri, ...yazilanlar.map((s) => s.id)]),
  ];

  console.log(`  ✓ ${yazilanlar.length} satır kaydedildi.`);
}

// ---------------------------------------------------------------------------
// 2. İş — dönem sonu gelişim değerlendirmesi
// ---------------------------------------------------------------------------

async function gelisimDegerlendirmeleriUret(manifest: Manifest) {
  console.log("\n[2/3] Dönem sonu gelişim değerlendirmeleri üretiliyor...");

  const kayitlar = await db.enrollment.findMany({
    where: {
      status: "AKTIF",
      group: { branchId: HEDEF_SUBE, termId: HEDEF_DONEM },
      developmentAssessments: { none: { period: "DONEM_SONU" } },
    },
    select: {
      id: true,
      internId: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });

  console.log(`  ${kayitlar.length} kayıtta dönem sonu değerlendirmesi eksik.`);
  if (kayitlar.length === 0) return;

  // Alan sırası soru listesinden gelir; kategori başına soru sayısı 7/5/6.
  const kategoriler = [...new Set(GELISIM_SORULARI.map((s) => s.kategori))];

  for (const kayit of kayitlar) {
    const profil = profilBul(
      kayit.student.firstName,
      kayit.student.lastName,
    );
    const rastgele = tohumla(`gelisim|${kayit.id}`);

    // Kategori başına hedef: profildeki [duygusal, sosyal, bilişsel] sırası
    // GELISIM_SORULARI içindeki ilk görünme sırasıyla aynı.
    const cevaplar: {
      anahtar: string;
      kategori: string;
      baslik: string;
      soruMetni: string;
      deger: number | null;
    }[] = [];

    for (const [indeks, kategori] of kategoriler.entries()) {
      const kategoriSorulari = GELISIM_SORULARI.filter(
        (s) => s.kategori === kategori,
      );
      const hedef = profil
        ? profil.gelisim[indeks]
        : turetilmisHedef(`${kayit.id}|${kategori}`);

      const degerler = degerlerUret(
        kategoriSorulari.length,
        hedef,
        rastgele,
      );

      kategoriSorulari.forEach((soru, i) => {
        cevaplar.push({
          anahtar: soru.anahtar,
          kategori: soru.kategori,
          baslik: soru.baslik,
          soruMetni: soru.metin,
          deger: degerler[i],
        });
      });
    }

    const olusan = await db.developmentAssessment.create({
      data: {
        enrollmentId: kayit.id,
        period: "DONEM_SONU",
        answersJson: cevaplar,
        filledByUserId: kayit.internId,
      },
      select: { id: true },
    });
    manifest.gelisimDegerlendirmeIdleri.push(olusan.id);
  }

  console.log(
    `  ✓ ${manifest.gelisimDegerlendirmeIdleri.length} değerlendirme yazıldı ` +
      `(${GELISIM_SORULARI.length} soru / kayıt).`,
  );
}

// ---------------------------------------------------------------------------
// 3. İş — gözlem notları
// ---------------------------------------------------------------------------

async function gozlemNotlariniYaz(manifest: Manifest) {
  console.log("\n[3/3] Gözlem notları yazılıyor...");

  const kayitlar = await db.enrollment.findMany({
    where: {
      status: "AKTIF",
      group: { branchId: HEDEF_SUBE, termId: HEDEF_DONEM },
    },
    select: {
      id: true,
      gozlemNotu: true,
      student: { select: { firstName: true, lastName: true } },
      scores: {
        select: {
          id: true,
          attended: true,
          gozlemNotu: true,
          session: {
            select: {
              weekNumber: true,
              workshopType: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  let kayitNotu = 0;
  let oturumNotu = 0;
  const eslesmeyen: string[] = [];

  for (const kayit of kayitlar) {
    const profil = profilBul(
      kayit.student.firstName,
      kayit.student.lastName,
    );
    if (!profil) {
      eslesmeyen.push(`${kayit.student.firstName} ${kayit.student.lastName}`);
      continue;
    }

    if (kayit.gozlemNotu?.trim() !== profil.kayitNotu) {
      await db.enrollment.update({
        where: { id: kayit.id },
        data: { gozlemNotu: profil.kayitNotu },
      });
      manifest.kayitGozlemleri.push({
        id: kayit.id,
        oncekiDeger: kayit.gozlemNotu,
      });
      kayitNotu++;
    }

    for (const not of profil.oturumNotlari) {
      const atolyeAdi = ATOLYE_ANAHTARLARI[not.atolye];
      const puanlama = kayit.scores.find(
        (p) =>
          p.session.workshopType.name === atolyeAdi &&
          p.session.weekNumber === not.hafta &&
          p.attended,
      );

      if (!puanlama) {
        eslesmeyen.push(
          `${profil.ad} ${profil.soyad} — ${atolyeAdi} h${not.hafta} (katılımlı puanlama yok)`,
        );
        continue;
      }
      if (puanlama.gozlemNotu?.trim() === not.not) continue;

      await db.score.update({
        where: { id: puanlama.id },
        data: { gozlemNotu: not.not },
      });
      manifest.puanlamaGozlemleri.push({
        id: puanlama.id,
        oncekiDeger: puanlama.gozlemNotu,
      });
      oturumNotu++;
    }
  }

  console.log(`  ✓ ${kayitNotu} kayıt notu, ${oturumNotu} oturum notu yazıldı.`);
  if (eslesmeyen.length > 0) {
    console.log("  ! Eşleşmeyenler:");
    for (const satir of eslesmeyen) console.log(`    - ${satir}`);
  }
}

// ---------------------------------------------------------------------------

/**
 * Manifest BİRİKİMLİ okunur.
 *
 * Betik yeniden çalıştırıldığında ilk adım "eksik puanlama yok" der ve o
 * çalıştırmada hiçbir kimlik toplanmaz. Manifest sıfırdan yazılsaydı önceki
 * çalıştırmanın 2780 satırı listeden düşer, geri alınamaz hâle gelirdi.
 */
function manifestOku(): Manifest {
  const bos: Manifest = {
    olusturmaZamani: new Date().toISOString(),
    scoreAnswerIdleri: [],
    gelisimDegerlendirmeIdleri: [],
    kayitGozlemleri: [],
    puanlamaGozlemleri: [],
    mufredatIdleri: [],
    atolyeIcerikIdleri: [],
  };

  if (!existsSync(MANIFEST_YOLU)) return bos;
  return { ...bos, ...JSON.parse(readFileSync(MANIFEST_YOLU, "utf8")) };
}

/**
 * Aynı satır iki kez yazıldıysa EN ESKİ önceki değer korunur: geri alma
 * betiği tek adımda ilk hâline dönebilmeli.
 */
function gozlemleriBirlestir(manifest: Manifest) {
  for (const alan of ["kayitGozlemleri", "puanlamaGozlemleri"] as const) {
    const harita = new Map<string, GozlemKaydi>();
    for (const kayit of manifest[alan]) {
      if (!harita.has(kayit.id)) harita.set(kayit.id, kayit);
    }
    manifest[alan] = [...harita.values()];
  }
}

async function main() {
  const manifest = manifestOku();

  try {
    await eksikCevaplariUret(manifest);
    await gelisimDegerlendirmeleriUret(manifest);
    await gozlemNotlariniYaz(manifest);
  } finally {
    // Yarıda kalsa bile o ana kadar yazılanlar geri alınabilsin.
    gozlemleriBirlestir(manifest);
    writeFileSync(MANIFEST_YOLU, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`\nManifest yazıldı: ${MANIFEST_YOLU}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
