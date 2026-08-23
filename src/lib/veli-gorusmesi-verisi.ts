import { db } from "./db";
import { gelisimCevaplariCozumle, DONEM_ETIKETLERI } from "./gelisim-degerlendirmesi";
import { raporGirdisiHazirla } from "./rapor-verisi";
import { raporAnaliziUret, type RaporGirdisi } from "./rapor-motoru";
import {
  gorusmeOnerileriUret,
  type GorusmeOnerileri,
} from "./veli-gorusmesi-onerisi";

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
