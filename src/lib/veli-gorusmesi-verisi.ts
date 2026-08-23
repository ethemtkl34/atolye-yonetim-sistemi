import { db } from "./db";
import { yasYil } from "./tarih";
import { gelisimCevaplariCozumle, DONEM_ETIKETLERI } from "./gelisim-degerlendirmesi";
import { raporGirdisiHazirla } from "./rapor-verisi";
import { raporAnaliziUret, type RaporGirdisi } from "./rapor-motoru";
import {
  gorusmeOnerileriUret,
  type GorusmeOnerileri,
} from "./veli-gorusmesi-onerisi";
import type { OneriAdayi } from "./urun-onerileri";

/**
 * Veli görüşmesi brief'inin veri katmanı.
 *
 * Motor saf ve veritabanı bilmiyor (`veli-gorusmesi.ts`); bu dosya ona girdiyi
 * hazırlıyor. Rapordan farkı: kapsam SEÇİLMEZ — brief öğrencinin BÜTÜN
 * kayıtlarını, görüşme tarihine kadarki oturumlarıyla özetler. Veli "nasıl
 * gidiyor" diye geliyor; hangi kaydın kapsama gireceğini seçtirmek görüşme
 * hazırlığını rapor üretimine çevirirdi.
 *
 * ŞUBE: her sorgu `subeId` zorunlu alır; başka şubenin öğrenci id'si
 * yapıştırılırsa sorgu boş döner.
 */
export async function veliBriefGirdisiHazirla(
  ogrenciId: string,
  subeId: string,
  gorusmeTarihi: Date,
): Promise<RaporGirdisi | null> {
  const kayitlar = await db.enrollment.findMany({
    where: { studentId: ogrenciId, group: { branchId: subeId } },
    select: { id: true },
  });

  return raporGirdisiHazirla(
    ogrenciId,
    kayitlar.map((kayit) => kayit.id),
    subeId,
    { enGecTarih: gorusmeTarihi },
  );
}

/**
 * §11.4 — Görüşme formunun ön-doldurma önerileri.
 *
 * Motor saf (`veli-gorusmesi-onerisi.ts`); burada iki kaynak toplanıyor:
 * görüşme tarihine KADARki atölye puanlamaları (brief'le aynı kapsam) ve
 * öğrencinin en güncel gelişim testi.
 *
 * Gelişim testi tek satır seçilir, birleştirilmez: iki farklı dönemin
 * cevaplarını ortalamak "şu an nerede" sorusunun cevabını bulandırırdı.
 * Dönem sonu varsa o, yoksa dönem ortası — ikisinden de en yenisi.
 *
 * ŞUBE: `subeId` zorunlu; başka şubenin öğrencisi için boş döner.
 */
export async function gorusmeOnerileriHazirla(
  ogrenciId: string,
  subeId: string,
  gorusmeTarihi: Date,
): Promise<GorusmeOnerileri | null> {
  const girdi = await veliBriefGirdisiHazirla(ogrenciId, subeId, gorusmeTarihi);
  if (!girdi) return null;

  const analiz = raporAnaliziUret(girdi);

  // Başlıksız (eski) cevaplar ortak sözcüğe indirgenemez; motora hiç
  // gitmezler — soru cümlesinden etiket çıkarmak yanlış eşleşme üretirdi.
  const atolyeBasliklari = analiz.atolyeler.flatMap((atolye) =>
    atolye.soruOrtalamalari
      .filter(
        (soru): soru is typeof soru & { baslik: string; ortalama: number } =>
          soru.baslik !== null && soru.ortalama !== null,
      )
      .map((soru) => ({
        baslik: soru.baslik,
        ortalama: soru.ortalama,
        gozlemSayisi: soru.puanlananOturumSayisi,
      })),
  );

  const degerlendirme = await db.developmentAssessment.findFirst({
    where: {
      enrollment: { studentId: ogrenciId, group: { branchId: subeId } },
    },
    // Dönem sonu her zaman dönem ortasının önünde; eşitlikte en yeni kayıt.
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    select: { period: true, answersJson: true },
  });

  const gelisimCevaplari = degerlendirme
    ? gelisimCevaplariCozumle(degerlendirme.answersJson)
        .filter((cevap) => cevap.deger !== null)
        .map((cevap) => ({ anahtar: cevap.anahtar, deger: cevap.deger! }))
    : [];

  return gorusmeOnerileriUret({
    atolyeBasliklari,
    gelisimCevaplari,
    gelisimDonemi: degerlendirme
      ? DONEM_ETIKETLERI[degerlendirme.period]
      : null,
    katilim: {
      kapsam:
        analiz.genel.katildigiOturumSayisi + analiz.genel.katilmadigiOturumSayisi,
      katildi: analiz.genel.katildigiOturumSayisi,
    },
  });
}

/**
 * §11.4 — Görüşme formunun ihtiyaç duyduğu bütün yardımcı veri, tek çağrıda.
 *
 * Dördü de aynı anda ve aynı öğrenci için gerekiyor; ayrı ayrı çağrılsaydı
 * form açılışında dört gidiş-dönüş olurdu. Ürün adayları yaşa göre burada
 * SÜZÜLÜR: katalogda 108 ürün var, tamamını istemciye taşımanın anlamı yok.
 *
 * `zekaTestleri` yalnızca ÜSTVERİ taşır — dosyanın kendisi asla buradan
 * geçmez, indirme rotasından okunur (bkz. `IntelligenceTest` şema notu).
 * Çağıran taraf zekâ testi yetkisini ayrıca doğrular.
 */
export type GorusmeYardimi = {
  oneriler: GorusmeOnerileri;
  /** Yaşa uygun ürün kataloğu — işaretlenen alanlara göre istemci eşler. */
  urunAdaylari: OneriAdayi[];
  /** Görüşme anındaki yaş; ürün eşlemesi ve ekrandaki not için. */
  yas: number | null;
  /** Öğrencinin yüklü zekâ testi belgeleri (üstveri). */
  zekaTestleri: { id: string; testAdi: string; tarih: Date }[];
  /** Önceki görüşmelerde alınmış yönlendirme kararları, en yeniden eskiye. */
  yonlendirmeGecmisi: {
    id: string;
    etiket: string;
    not: string | null;
    tarih: Date;
  }[];
};

export async function gorusmeYardimiHazirla(
  ogrenciId: string,
  subeId: string,
  gorusmeTarihi: Date,
  secenekler: { zekaTestiGorebilir: boolean },
): Promise<GorusmeYardimi | null> {
  const ogrenci = await db.student.findFirst({
    where: { id: ogrenciId, branchId: subeId },
    select: { birthDate: true },
  });
  if (!ogrenci) return null;

  const oneriler = await gorusmeOnerileriHazirla(
    ogrenciId,
    subeId,
    gorusmeTarihi,
  );
  if (!oneriler) return null;

  const yas = ogrenci.birthDate
    ? yasYil(ogrenci.birthDate, gorusmeTarihi)
    : null;

  const [urunler, zekaTestleri, yonlendirmeler] = await Promise.all([
    db.oneriUrunu.findMany({
      where: {
        active: true,
        // Yaş bilinmiyorsa süzülmez (`yasaUygun` ile aynı ilke): yaş alanı
        // isteğe bağlı ve boş olması öneri üretmemek için gerekçe değil.
        ...(yas === null ? {} : { yasMin: { lte: yas }, yasMax: { gte: yas } }),
      },
      orderBy: { ad: "asc" },
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
    }),
    secenekler.zekaTestiGorebilir
      ? db.intelligenceTest.findMany({
          where: { studentId: ogrenciId, student: { branchId: subeId } },
          orderBy: { date: "desc" },
          // `fileData` SEÇİLMEZ — megabaytlarca veri forma taşınmamalı.
          select: { id: true, testName: true, date: true },
        })
      : [],
    db.parentMeetingReferral.findMany({
      where: { studentId: ogrenciId, student: { branchId: subeId } },
      orderBy: { createdAt: "desc" },
      // Geçmiş bir hatırlatma, arşiv değil: son on karar yeter.
      take: 10,
      select: {
        id: true,
        label: true,
        note: true,
        meeting: { select: { date: true } },
      },
    }),
  ]);

  return {
    oneriler,
    urunAdaylari: urunler,
    yas,
    zekaTestleri: zekaTestleri.map((test) => ({
      id: test.id,
      testAdi: test.testName,
      tarih: test.date,
    })),
    yonlendirmeGecmisi: yonlendirmeler.map((satir) => ({
      id: satir.id,
      etiket: satir.label,
      not: satir.note,
      tarih: satir.meeting.date,
    })),
  };
}
