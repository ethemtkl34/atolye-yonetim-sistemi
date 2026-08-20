import type { AssessmentPeriod } from "@/generated/prisma/enums";
import { db } from "./db";
import { gelisimCevaplariCozumle } from "./gelisim-degerlendirmesi";
import { raporGuncelMi } from "./rapor-motoru";
import {
  raporUret,
  type RaporGirdisi,
  type RaporGovdesi,
} from "./rapor-motoru";

/**
 * Rapor motorunun veri katmanı — §11.
 *
 * Motor saf ve veritabanı bilmiyor; bu dosya ona girdiyi hazırlıyor, ürettiği
 * gövdeyi saklıyor ve raporun güncelliğini okuma anında hesaplıyor.
 *
 * §13.16 — Güncellik saklanmaz, türetilir: kapsamdaki puanların en yeni
 * `updatedAt` değeri raporun `generatedAt` değerinden sonraysa rapor "Güncel
 * değil" görünür. Ayrı bir bayrak veya arka plan işi yok.
 *
 * ŞUBE: Raporun şubesi öğrenciden türer (`report.student.branchId`). Her
 * fonksiyon `subeId`'yi zorunlu alır; başka şubenin rapor id'si yapıştırılırsa
 * sorgu boş döner.
 */

export type KapsamKaydi = {
  id: string;
  programAdi: string;
  grupAdi: string;
  tur: "Dönem" | "Kulüp";
  aktif: boolean;
  puanlanmisOturumSayisi: number;
  /** Kayda atanmış stajyerin adı; atanmamışsa null ve rapor üretilemez. */
  stajyerAdi: string | null;
};

/** Rapor kapsamına alınabilecek kayıtlar ve her birinde kaç form dolu. */
export async function raporKapsamSecenekleri(
  ogrenciId: string,
  subeId: string,
): Promise<KapsamKaydi[]> {
  const kayitlar = await db.enrollment.findMany({
    where: { studentId: ogrenciId, group: { branchId: subeId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      intern: { select: { name: true } },
      _count: { select: { scores: true } },
      group: {
        select: {
          name: true,
          term: { select: { name: true } },
          club: { select: { name: true } },
        },
      },
    },
  });

  return kayitlar.map((kayit) => ({
    id: kayit.id,
    programAdi: kayit.group.term?.name ?? kayit.group.club?.name ?? "Program",
    grupAdi: kayit.group.name,
    tur: kayit.group.term ? "Dönem" : "Kulüp",
    aktif: kayit.status === "AKTIF",
    puanlanmisOturumSayisi: kayit._count.scores,
    stajyerAdi: kayit.intern?.name ?? null,
  }));
}

/**
 * Seçilen kayıtların puanlamalarını rapor motorunun beklediği biçime çevirir.
 *
 * Atölye bazlı gruplama burada yapılır: aynı atölye farklı kayıtlarda da
 * geçebilir (dönem + kulüp), rapor tek bir "Bilim Atölyesi" bölümü gösterir.
 *
 * `enGecTarih` veli görüşmesi brief'i için: yalnızca o güne KADAR (dahil)
 * yapılmış oturumların puanlamaları alınır — görüşme günü sabah yapılan
 * atölye de sayılır. Raporlar süzgeçsiz çağırır, davranışları değişmez.
 */
export async function raporGirdisiHazirla(
  ogrenciId: string,
  kayitIdleri: readonly string[],
  subeId: string,
  secenekler?: { enGecTarih?: Date },
): Promise<RaporGirdisi | null> {
  const ogrenci = await db.student.findFirst({
    where: { id: ogrenciId, branchId: subeId },
    select: { firstName: true, lastName: true },
  });

  if (!ogrenci) return null;

  const kayitlar = await db.enrollment.findMany({
    where: {
      id: { in: [...kayitIdleri] },
      studentId: ogrenciId,
      group: { branchId: subeId },
    },
    select: {
      group: {
        select: {
          name: true,
          term: { select: { name: true } },
          club: { select: { name: true } },
        },
      },
      scores: {
        ...(secenekler?.enGecTarih
          ? { where: { session: { date: { lte: secenekler.enGecTarih } } } }
          : {}),
        select: {
          attended: true,
          session: {
            select: {
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
    },
  });

  const atolyeler = new Map<
    string,
    { ad: string; sira: number; puanlamalar: RaporGirdisi["atolyeler"][number]["puanlamalar"] }
  >();

  for (const kayit of kayitlar) {
    for (const puanlama of kayit.scores) {
      const atolye = puanlama.session.workshopType;
      const mevcut = atolyeler.get(atolye.id);
      const satir = {
        attended: puanlama.attended,
        answers: puanlama.answers,
      };

      if (mevcut) {
        mevcut.puanlamalar.push(satir);
      } else {
        atolyeler.set(atolye.id, {
          ad: atolye.name,
          sira: atolye.sortOrder,
          puanlamalar: [satir],
        });
      }
    }
  }

  return {
    ogrenciAdi: `${ogrenci.firstName} ${ogrenci.lastName}`,
    ogrenciIlkAdi: ogrenci.firstName,
    kapsam: kayitlar.map((kayit) => ({
      programAdi: kayit.group.term?.name ?? kayit.group.club?.name ?? "Program",
      grupAdi: kayit.group.name,
      tur: kayit.group.term ? ("Dönem" as const) : ("Kulüp" as const),
    })),
    atolyeler: [...atolyeler.values()]
      .sort((a, b) => a.sira - b.sira)
      .map((atolye) => ({
        atolyeAdi: atolye.ad,
        puanlamalar: atolye.puanlamalar,
      })),
  };
}

export type RaporOzeti = {
  id: string;
  ogrenciId: string;
  ogrenciAdi: string;
  uretimZamani: Date;
  duzenlemeZamani: Date | null;
  duzenleyen: string | null;
  kapsam: string[];
  guncel: boolean;
  atolyeSayisi: number;
};

/**
 * Rapor listelerinin ortak üst sınırı. Dashboard kartı ile Raporlar listesi
 * aynı sayıyı göstersin diye ikisi de bu sınırı kullanır (P11).
 */
export const RAPOR_LISTE_SINIRI = 200;

/**
 * Raporları güncellik bilgisiyle birlikte listeler.
 *
 * Güncellik için kapsamdaki kayıtların en yeni puan güncellemesi okunur;
 * `raporGuncelMi` karşılaştırmayı yapan tek yerdir (`puan-hesaplari.ts`).
 */
export async function raporOzetleri(kosul: {
  subeId: string;
  ogrenciId?: string;
  enFazla?: number;
}): Promise<RaporOzeti[]> {
  const raporlar = await db.report.findMany({
    where: {
      student: { branchId: kosul.subeId },
      ...(kosul.ogrenciId ? { studentId: kosul.ogrenciId } : {}),
    },
    orderBy: { generatedAt: "desc" },
    take: kosul.enFazla ?? RAPOR_LISTE_SINIRI,
    select: {
      id: true,
      generatedAt: true,
      editedAt: true,
      bodyJson: true,
      student: { select: { id: true, firstName: true, lastName: true } },
      editedBy: { select: { name: true } },
      enrollmentLinks: {
        select: {
          enrollment: {
            select: {
              id: true,
              group: {
                select: {
                  name: true,
                  term: { select: { name: true } },
                  club: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (raporlar.length === 0) return [];

  // Kapsamdaki bütün kayıtların en yeni puan güncellemesi tek sorguda alınır.
  const kayitIdleri = [
    ...new Set(
      raporlar.flatMap((rapor) =>
        rapor.enrollmentLinks.map((bag) => bag.enrollment.id),
      ),
    ),
  ];

  // şube-muaf: `kayitIdleri` bir üstteki şube süzgeçli rapor sorgusundan
  // türedi; liste zaten tek şubenin kayıtlarından oluşuyor.
  const sonGuncellemeler = await db.score.groupBy({
    by: ["enrollmentId"],
    where: { enrollmentId: { in: kayitIdleri } },
    _max: { updatedAt: true },
  });

  const guncellemeHaritasi = new Map(
    sonGuncellemeler.map((satir) => [satir.enrollmentId, satir._max.updatedAt]),
  );

  return raporlar.map((rapor) => {
    const kapsamZamanlari = rapor.enrollmentLinks
      .map((bag) => guncellemeHaritasi.get(bag.enrollment.id) ?? null)
      .filter((zaman): zaman is Date => zaman !== null);

    const enYeni =
      kapsamZamanlari.length === 0
        ? null
        : kapsamZamanlari.reduce((a, b) => (a.getTime() > b.getTime() ? a : b));

    const govde = rapor.bodyJson as unknown as RaporGovdesi;
    // Gövde biçimi sürümlü: v2'de atölyeler `atolyeKademeleri`nde, v1'de
    // `analiz.atolyeler`de. Tek yapıdan okumak yeni raporların listesini
    // "0 atölye" gösteriyordu.
    const surumlu = rapor.bodyJson as unknown as {
      surum?: number;
      atolyeKademeleri?: unknown[];
    };
    const atolyeSayisi =
      surumlu?.surum === 2
        ? (surumlu.atolyeKademeleri?.length ?? 0)
        : (govde?.analiz?.atolyeler?.length ?? 0);

    return {
      id: rapor.id,
      ogrenciId: rapor.student.id,
      ogrenciAdi: `${rapor.student.firstName} ${rapor.student.lastName}`,
      uretimZamani: rapor.generatedAt,
      duzenlemeZamani: rapor.editedAt,
      duzenleyen: rapor.editedBy?.name ?? null,
      kapsam: rapor.enrollmentLinks.map(
        (bag) =>
          `${bag.enrollment.group.term?.name ?? bag.enrollment.group.club?.name ?? "Program"} · ${bag.enrollment.group.name}`,
      ),
      guncel: raporGuncelMi(rapor.generatedAt, enYeni),
      atolyeSayisi,
    };
  });
}

export type PdfKaydi = {
  id: string;
  adres: string;
  olusturmaZamani: Date;
  raporId: string;
  raporUretimZamani: Date;
};

/**
 * §13.17 — Üretilmiş PDF'ler asla silinmez; rapor yeniden üretilse de eski
 * belgeler listede kalır. Sıralama en yeniden eskiye.
 */
export async function pdfGecmisi(kosul: {
  subeId: string;
  raporId?: string;
  ogrenciId?: string;
}): Promise<PdfKaydi[]> {
  const pdfler = await db.reportPdf.findMany({
    where: {
      report: {
        student: {
          branchId: kosul.subeId,
          ...(kosul.ogrenciId ? { id: kosul.ogrenciId } : {}),
        },
      },
      ...(kosul.raporId ? { reportId: kosul.raporId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileUrl: true,
      createdAt: true,
      report: { select: { id: true, generatedAt: true } },
    },
  });

  return pdfler.map((pdf) => ({
    id: pdf.id,
    adres: pdf.fileUrl,
    olusturmaZamani: pdf.createdAt,
    raporId: pdf.report.id,
    raporUretimZamani: pdf.report.generatedAt,
  }));
}

export type RaporDetayi = {
  ozet: RaporOzeti;
  govde: RaporGovdesi;
};

export async function raporDetayi(
  raporId: string,
  subeId: string,
): Promise<RaporDetayi | null> {
  const rapor = await db.report.findFirst({
    where: { id: raporId, student: { branchId: subeId } },
    select: { id: true, studentId: true, bodyJson: true },
  });

  if (!rapor) return null;

  const ozetler = await raporOzetleri({ subeId, ogrenciId: rapor.studentId });
  const ozet = ozetler.find((aday) => aday.id === raporId);
  if (!ozet) return null;

  return {
    ozet,
    govde: rapor.bodyJson as unknown as RaporGovdesi,
  };
}

/** Rapor gövdesini üretir — motor saf olduğu için tarih burada damgalanır. */
export async function raporGovdesiUret(
  ogrenciId: string,
  kayitIdleri: readonly string[],
  subeId: string,
): Promise<RaporGovdesi | null> {
  const girdi = await raporGirdisiHazirla(ogrenciId, kayitIdleri, subeId);
  return girdi ? raporUret(girdi) : null;
}

// ---------------------------------------------------------------------------
// Akran kıyası
// ---------------------------------------------------------------------------

/**
 * §11.2 — Bir grubun üç gelişim alanındaki ortalaması.
 *
 * Rapor, öğrencinin duygusal/sosyal/bilişsel kademesini bu ortalamayla
 * karşılaştırarak belirler ("yaşıtlarının üzerinde"). Kıyas grubu, öğrencinin
 * kendi grubudur: sistemde yaş grubu diye bir kavram yok ve grup zaten aynı
 * dönemde aynı programı gören yaş yakın öğrencilerden oluşuyor.
 *
 * Öğrencinin kendisi de ortalamaya dahildir. Hariç tutulsaydı her öğrenci
 * farklı bir kıyas tabanı görürdü ve aynı gruptaki iki rapor birbiriyle
 * tutarsız olurdu.
 *
 * `donem` seçilen değerlendirme zamanı; rapor dönem sonunu kullanır.
 * O değerlendirmeyi hiç kimse doldurmamışsa kıyas yapılamaz ve fonksiyon boş
 * harita döner — çağıran taraf bu durumda mutlak eşiklere düşer.
 *
 * ŞUBE: grup zaten tek bir şubeye ait (`Group.branchId`); çağıran şube
 * süzgecinden geçmiş bir grup kimliği verdiği için burada ayrıca süzülmez.
 */
export async function grupGelisimOrtalamalari(
  grupId: string,
  donem: AssessmentPeriod,
): Promise<Map<string, number>> {
  const degerlendirmeler = await db.developmentAssessment.findMany({
    where: { period: donem, enrollment: { groupId: grupId } },
    select: { answersJson: true },
  });

  const havuz = new Map<string, { toplam: number; adet: number }>();

  for (const degerlendirme of degerlendirmeler) {
    for (const cevap of gelisimCevaplariCozumle(degerlendirme.answersJson)) {
      if (cevap.deger === null) continue;
      const mevcut = havuz.get(cevap.kategori);
      if (mevcut) {
        mevcut.toplam += cevap.deger;
        mevcut.adet += 1;
      } else {
        havuz.set(cevap.kategori, { toplam: cevap.deger, adet: 1 });
      }
    }
  }

  return new Map(
    [...havuz.entries()]
      .filter(([, veri]) => veri.adet > 0)
      .map(([kategori, veri]) => [kategori, veri.toplam / veri.adet]),
  );
}
