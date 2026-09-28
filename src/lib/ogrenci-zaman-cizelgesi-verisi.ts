import { db } from "@/lib/db";
import { ADAY_ASAMALARI, ADAY_KAYNAKLARI } from "@/lib/aday-durumlari";
import { DURUM_ADLARI } from "@/app/koordinator/randevular/sema";
import {
  zamanCizelgesiniKur,
  type HamOlay,
  type ZamanCizelgesiOlayi,
} from "@/lib/ogrenci-zaman-cizelgesi";
import type { Modul, Seviye } from "@/lib/yetkiler";

/**
 * §6.5 — Zaman çizelgesinin okuma katmanı (28 Eylül 2026).
 *
 * YETKİ, BU DOSYANIN ASIL İŞİ. Çizelge tek modülden değil YEDİ ayrı modülden
 * besleniyor ve yetkileri birbirinden farklı: danışma görevlisinde terapi
 * görüşmeleri, veli görüşmeleri, raporlar ve arşiv KAPALI. Kaynakları düz
 * toplasaydık, matrisin sağlık mahremiyeti gerekçesiyle sakladığı terapi
 * seansı tarihleri danışma masasının ekranında belirirdi.
 *
 * Sayfanın kendi kuralı burada da geçerli (bkz. `ogrenciler/[id]/page.tsx`
 * şerhi): görülemeyen bölümün verisi arayüzde gizlenmez, SORGUSU HİÇ
 * ATILMAZ. Aşağıdaki her sorgu kendi modülünün kapısının arkasında.
 */

/** Çizelgeyi görebilen kullanıcının modül yetkileri. */
type Yetkiler = Record<Modul, Seviye>;

const gorebilir = (yetkiler: Yetkiler, modul: Modul): boolean =>
  yetkiler[modul] !== "YOK";

/** Öğrencinin bütün hareketleri, eskiden yeniye. */
export async function ogrenciZamanCizelgesi(args: {
  ogrenciId: string;
  /** Öğrencinin kendi şubesi — başka şubede geçen olayları etiketlemek için. */
  subeId: string;
  yetkiler: Yetkiler;
}): Promise<ZamanCizelgesiOlayi[]> {
  const { ogrenciId, subeId, yetkiler } = args;

  const [ogrenci, aday, randevular, kayitlar, gorusmeler, veliGorusmeleri, onGorusme, zekaTestleri, raporlar, arsivRaporlari] =
    await Promise.all([
      db.student.findUnique({
        where: { id: ogrenciId },
        select: { createdAt: true },
      }),

      gorebilir(yetkiler, "adaylar")
        ? db.lead.findUnique({
            // Öğrenci tarafındaki `sourceLead`ın aday tarafındaki karşılığı.
            where: { convertedStudentId: ogrenciId },
            select: {
              id: true,
              createdAt: true,
              source: true,
              sourceDetail: true,
              convertedAt: true,
              // Yalnız aşama değişimleri: arama, WhatsApp ve notlar çizelgeyi
              // boğardı ve aday ekranında zaten duruyor (kurum kararı).
              activities: {
                where: { type: "ASAMA_DEGISIMI" },
                select: { id: true, createdAt: true, fromStage: true, toStage: true },
              },
            },
          })
        : null,

      gorebilir(yetkiler, "randevular")
        ? db.randevu.findMany({
            where: { ogrenciId },
            orderBy: { baslangic: "asc" },
            select: {
              id: true,
              createdAt: true,
              baslangic: true,
              durum: true,
              iptalAt: true,
              branchId: true,
              branch: { select: { name: true } },
              hizmet: { select: { ad: true } },
              uzman: { select: { ad: true } },
            },
          })
        : [],

      gorebilir(yetkiler, "kayitlar")
        ? db.enrollment.findMany({
            where: { studentId: ogrenciId },
            select: {
              id: true,
              createdAt: true,
              cancelledAt: true,
              group: {
                select: {
                  name: true,
                  term: { select: { name: true } },
                  club: { select: { name: true } },
                },
              },
            },
          })
        : [],

      gorebilir(yetkiler, "danismanlik")
        ? db.counselingSession.findMany({
            where: { studentId: ogrenciId },
            select: { id: true, date: true },
          })
        : [],

      gorebilir(yetkiler, "danismanlik")
        ? db.parentMeeting.findMany({
            where: { studentId: ogrenciId },
            select: { id: true, date: true },
          })
        : [],

      gorebilir(yetkiler, "danismanlik")
        ? db.therapyIntake.findUnique({
            where: { studentId: ogrenciId },
            select: { id: true, createdAt: true },
          })
        : null,

      gorebilir(yetkiler, "zekaTestleri")
        ? db.intelligenceTest.findMany({
            where: { studentId: ogrenciId },
            select: { id: true, date: true, testName: true },
          })
        : [],

      gorebilir(yetkiler, "raporlar")
        ? db.report.findMany({
            where: { studentId: ogrenciId },
            select: { id: true, generatedAt: true },
          })
        : [],

      gorebilir(yetkiler, "raporlar")
        ? db.legacyReport.findMany({
            where: { studentId: ogrenciId },
            select: { id: true, reportDate: true },
          })
        : [],
    ]);

  const olaylar: HamOlay[] = [];
  const ekle = (olay: HamOlay) => olaylar.push(olay);

  const temel = {
    gunBazli: false,
    ayrinti: null,
    rozet: null,
    grupAnahtari: null,
    baskaSube: null,
    ilkAdayiMi: false,
  } as const;

  if (ogrenci) {
    ekle({
      ...temel,
      id: `ogrenci:${ogrenciId}`,
      tur: "ogrenciKaydi",
      an: ogrenci.createdAt,
      baslik: "Öğrenci kaydı açıldı",
    });
  }

  if (aday) {
    ekle({
      ...temel,
      id: `aday:${aday.id}`,
      tur: "aday",
      an: aday.createdAt,
      baslik: "Aday oluştu",
      ayrinti: aday.sourceDetail
        ? `${ADAY_KAYNAKLARI[aday.source]} · ${aday.sourceDetail}`
        : ADAY_KAYNAKLARI[aday.source],
    });

    for (const etkinlik of aday.activities) {
      // CHECK kısıtı ASAMA_DEGISIMI satırlarında iki alanı da doldurur;
      // yine de eksik bir satır çizelgeyi bozmasın.
      if (!etkinlik.toStage) continue;
      ekle({
        ...temel,
        id: `adayAsama:${etkinlik.id}`,
        tur: "adayAsama",
        an: etkinlik.createdAt,
        baslik: `Aday aşaması: ${ADAY_ASAMALARI[etkinlik.toStage].etiket}`,
        ayrinti: etkinlik.fromStage
          ? `${ADAY_ASAMALARI[etkinlik.fromStage].etiket} aşamasından`
          : null,
      });
    }

    if (aday.convertedAt) {
      ekle({
        ...temel,
        id: `adayDonusum:${aday.id}`,
        tur: "adayDonusum",
        an: aday.convertedAt,
        baslik: "Adaydan öğrenciye dönüştü",
      });
    }
  }

  for (const randevu of randevular) {
    const baskaSube = randevu.branchId === subeId ? null : randevu.branch.name;

    ekle({
      ...temel,
      id: `randevuVerildi:${randevu.id}`,
      tur: "randevuVerildi",
      an: randevu.createdAt,
      baslik: "Randevu verildi",
      ayrinti: `${randevu.hizmet.ad} · ${randevu.uzman.ad}`,
      baskaSube,
    });

    // İptal, seansın kendisi yerine İPTAL GÜNÜNE düşüyor: randevu o gün
    // iptal edildi, planlanan günde bir şey yaşanmadı.
    if (randevu.durum === "IPTAL") {
      if (randevu.iptalAt) {
        ekle({
          ...temel,
          id: `seansIptal:${randevu.id}`,
          tur: "kayitIptal",
          an: randevu.iptalAt,
          baslik: "Randevu iptal edildi",
          ayrinti: randevu.hizmet.ad,
          baskaSube,
        });
      }
      continue;
    }

    ekle({
      ...temel,
      id: `seans:${randevu.id}`,
      tur: "seans",
      an: randevu.baslangic,
      baslik: `${randevu.hizmet.ad} seansı`,
      ayrinti: randevu.uzman.ad,
      rozet: DURUM_ADLARI[randevu.durum],
      grupAnahtari: randevu.hizmet.ad,
      baskaSube,
      // Yalnız gerçekleşen seans "ilk" olabilir; planlı ya da gelinmemiş
      // seans hikâyeyi başlatmaz.
      ilkAdayiMi: randevu.durum === "GERCEKLESTI",
    });
  }

  for (const kayit of kayitlar) {
    const program =
      kayit.group.term?.name ?? kayit.group.club?.name ?? kayit.group.name;
    ekle({
      ...temel,
      id: `kayit:${kayit.id}`,
      tur: "kayit",
      an: kayit.createdAt,
      baslik: "Programa kaydoldu",
      ayrinti: `${program} · ${kayit.group.name}`,
    });
    if (kayit.cancelledAt) {
      ekle({
        ...temel,
        id: `kayitIptal:${kayit.id}`,
        tur: "kayitIptal",
        an: kayit.cancelledAt,
        baslik: "Program kaydı iptal edildi",
        ayrinti: program,
      });
    }
  }

  if (onGorusme) {
    ekle({
      ...temel,
      id: `onGorusme:${onGorusme.id}`,
      tur: "terapiOnGorusme",
      an: onGorusme.createdAt,
      baslik: "Terapi ön görüşme formu dolduruldu",
    });
  }

  for (const gorusme of gorusmeler) {
    ekle({
      ...temel,
      id: `terapi:${gorusme.id}`,
      tur: "terapi",
      an: gorusme.date,
      gunBazli: true,
      baslik: "Terapi görüşmesi",
    });
  }

  for (const gorusme of veliGorusmeleri) {
    ekle({
      ...temel,
      id: `veli:${gorusme.id}`,
      tur: "veliGorusmesi",
      an: gorusme.date,
      gunBazli: true,
      baslik: "Veli görüşmesi",
    });
  }

  for (const test of zekaTestleri) {
    ekle({
      ...temel,
      id: `zeka:${test.id}`,
      tur: "zekaTesti",
      an: test.date,
      gunBazli: true,
      baslik: "Zekâ testi uygulandı",
      ayrinti: test.testName,
    });
  }

  for (const rapor of raporlar) {
    ekle({
      ...temel,
      id: `rapor:${rapor.id}`,
      tur: "rapor",
      an: rapor.generatedAt,
      baslik: "Dönem raporu üretildi",
    });
  }

  for (const rapor of arsivRaporlari) {
    ekle({
      ...temel,
      id: `arsiv:${rapor.id}`,
      tur: "arsivRapor",
      an: rapor.reportDate,
      gunBazli: true,
      baslik: "Arşiv raporu",
    });
  }

  return zamanCizelgesiniKur(olaylar);
}
