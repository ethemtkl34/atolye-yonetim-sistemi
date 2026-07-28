import { db } from "./db";
import { raporGuncelMi } from "./scoring";
import {
  raporUret,
  type RaporGirdisi,
  type RaporGovdesi,
} from "./report-engine";

/**
 * Rapor motorunun veri katmanı — §11.
 *
 * Motor saf ve veritabanı bilmiyor; bu dosya ona girdiyi hazırlıyor, ürettiği
 * gövdeyi saklıyor ve raporun güncelliğini okuma anında hesaplıyor.
 *
 * §13.16 — Güncellik saklanmaz, türetilir: kapsamdaki puanların en yeni
 * `updatedAt` değeri raporun `generatedAt` değerinden sonraysa rapor "Güncel
 * değil" görünür. Ayrı bir bayrak veya arka plan işi yok.
 */

export type KapsamKaydi = {
  id: string;
  programAdi: string;
  grupAdi: string;
  tur: "Dönem" | "Kulüp";
  aktif: boolean;
  puanlanmisOturumSayisi: number;
};

/** Rapor kapsamına alınabilecek kayıtlar ve her birinde kaç form dolu. */
export async function raporKapsamSecenekleri(
  ogrenciId: string,
): Promise<KapsamKaydi[]> {
  const kayitlar = await db.enrollment.findMany({
    where: { studentId: ogrenciId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
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
  }));
}

/**
 * Seçilen kayıtların puanlamalarını rapor motorunun beklediği biçime çevirir.
 *
 * Atölye bazlı gruplama burada yapılır: aynı atölye farklı kayıtlarda da
 * geçebilir (dönem + kulüp), rapor tek bir "Bilim Atölyesi" bölümü gösterir.
 */
export async function raporGirdisiHazirla(
  ogrenciId: string,
  kayitIdleri: readonly string[],
): Promise<RaporGirdisi | null> {
  const ogrenci = await db.student.findUnique({
    where: { id: ogrenciId },
    select: { firstName: true, lastName: true },
  });

  if (!ogrenci) return null;

  const kayitlar = await db.enrollment.findMany({
    where: { id: { in: [...kayitIdleri] }, studentId: ogrenciId },
    select: {
      group: {
        select: {
          name: true,
          term: { select: { name: true } },
          club: { select: { name: true } },
        },
      },
      scores: {
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
 * Raporları güncellik bilgisiyle birlikte listeler.
 *
 * Güncellik için kapsamdaki kayıtların en yeni puan güncellemesi okunur;
 * `raporGuncelMi` karşılaştırmayı yapan tek yerdir (`scoring.ts`).
 */
export async function raporOzetleri(kosul: {
  ogrenciId?: string;
  enFazla?: number;
}): Promise<RaporOzeti[]> {
  const raporlar = await db.report.findMany({
    where: kosul.ogrenciId ? { studentId: kosul.ogrenciId } : {},
    orderBy: { generatedAt: "desc" },
    take: kosul.enFazla ?? 100,
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
      atolyeSayisi: govde?.analiz?.atolyeler?.length ?? 0,
    };
  });
}

export type RaporDetayi = {
  ozet: RaporOzeti;
  govde: RaporGovdesi;
};

export async function raporDetayi(raporId: string): Promise<RaporDetayi | null> {
  const rapor = await db.report.findUnique({
    where: { id: raporId },
    select: { id: true, studentId: true },
  });

  if (!rapor) return null;

  const ozetler = await raporOzetleri({ ogrenciId: rapor.studentId });
  const ozet = ozetler.find((aday) => aday.id === raporId);
  if (!ozet) return null;

  const govde = await db.report.findUnique({
    where: { id: raporId },
    select: { bodyJson: true },
  });

  return {
    ozet,
    govde: govde!.bodyJson as unknown as RaporGovdesi,
  };
}

/** Rapor gövdesini üretir — motor saf olduğu için tarih burada damgalanır. */
export async function raporGovdesiUret(
  ogrenciId: string,
  kayitIdleri: readonly string[],
): Promise<RaporGovdesi | null> {
  const girdi = await raporGirdisiHazirla(ogrenciId, kayitIdleri);
  return girdi ? raporUret(girdi) : null;
}
