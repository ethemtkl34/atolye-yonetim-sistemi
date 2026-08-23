import { db } from "./db";
import { aktifGrupKosulu, GUNCEL_DONEM_KOSULU } from "./durumlar";
import { bugun } from "./tarih";
import type { AssessmentPeriod } from "@/generated/prisma/enums";
import {
  GELISIM_DONEMLERI,
  gelisimCevaplariCozumle,
  gelisimDurumu,
  gelisimPencereleri,
  type GelisimCevabi,
  type GelisimDurumu,
  type GelisimPenceresi,
} from "./gelisim-degerlendirmesi";

/**
 * Gelişim testi ekranlarının veri katmanı.
 *
 * `puanlama-verisi.ts` ile aynı kurallar geçerli:
 *
 * GİZLİLİK (§3.2): Stajyerin gördüğü yollarda veli telefonu ve sağlık detayı
 * `select` listesine alınmaz.
 *
 * ŞUBE: Her fonksiyon `subeId`'yi ZORUNLU alır; kayıt şubesi her zaman grup
 * üzerinden türer (`enrollment.group.branchId`).
 *
 * KAPSAM: Test yalnızca DÖNEM kayıtları için vardır (kulüpte dönem
 * ortası/sonu anlamsız); bütün sorgular `group.termId != null` süzer.
 */

export type GelisimNoktasi = {
  donem: AssessmentPeriod;
  durum: GelisimDurumu;
  pencere: GelisimPenceresi;
  guncellenmeZamani: Date | null;
  dolduran: string | null;
};

export type GelisimKaydi = {
  kayitId: string;
  aktif: boolean;
  ogrenciId: string;
  ogrenciAdi: string;
  stajyerAdi: string | null;
  program: string;
  grupAdi: string;
  noktalar: GelisimNoktasi[];
};

/**
 * Kayıt listesi: stajyerin (veya koordinatörün) göreceği öğrenciler ve iki
 * dönem noktasının durumu.
 */
export async function gelisimListesi(kosul: {
  /** Zorunlu — liste hiçbir zaman şubeler arası olmamalı. */
  subeId: string;
  internId?: string;
  studentId?: string;
  /** Stajyer ekranı yalnızca aktif kayıtları görür; profil hepsini gösterir. */
  yalnizcaAktif?: boolean;
  /** Arşivlenmiş programların kayıtları listelenmez (stajyer ekranı). */
  yalnizcaAktifProgram?: boolean;
}): Promise<GelisimKaydi[]> {
  const kayitlar = await db.enrollment.findMany({
    where: {
      ...(kosul.yalnizcaAktif ? { status: "AKTIF" as const } : {}),
      ...(kosul.internId ? { internId: kosul.internId } : {}),
      ...(kosul.studentId ? { studentId: kosul.studentId } : {}),
      group: {
        ...(kosul.yalnizcaAktifProgram
          ? aktifGrupKosulu(kosul.subeId)
          : { branchId: kosul.subeId }),
        // Gelişim testi yalnızca dönem kayıtlarında var; geçmişten aktarılan
        // dönemlerde ise hiç doldurulamaz (haftası yok).
        term: { is: GUNCEL_DONEM_KOSULU },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      intern: { select: { name: true } },
      student: { select: { id: true, firstName: true, lastName: true } },
      group: {
        select: {
          name: true,
          term: {
            select: {
              name: true,
              weeks: {
                orderBy: { weekNumber: "asc" },
                select: { weekNumber: true, date: true },
              },
            },
          },
        },
      },
      developmentAssessments: {
        select: {
          period: true,
          updatedAt: true,
          filledBy: { select: { name: true } },
        },
      },
    },
  });

  const bugunkuTarih = bugun();

  return kayitlar.map((kayit) => {
    const pencereler = gelisimPencereleri(
      kayit.group.term?.weeks ?? [],
      bugunkuTarih,
    );

    const noktalar: GelisimNoktasi[] = GELISIM_DONEMLERI.map((donem) => {
      const mevcut = kayit.developmentAssessments.find(
        (degerlendirme) => degerlendirme.period === donem,
      );
      return {
        donem,
        pencere: pencereler[donem],
        durum: gelisimDurumu(Boolean(mevcut), pencereler[donem]),
        guncellenmeZamani: mevcut?.updatedAt ?? null,
        dolduran: mevcut?.filledBy?.name ?? null,
      };
    });

    return {
      kayitId: kayit.id,
      aktif: kayit.status === "AKTIF",
      ogrenciId: kayit.student.id,
      ogrenciAdi: `${kayit.student.firstName} ${kayit.student.lastName}`,
      stajyerAdi: kayit.intern?.name ?? null,
      program: kayit.group.term?.name ?? "Dönem",
      grupAdi: kayit.group.name,
      noktalar,
    };
  });
}

export type GelisimFormuVerisi = {
  kayitId: string;
  kayitAktif: boolean;
  internId: string | null;
  ogrenciId: string;
  ogrenciAdi: string;
  program: string;
  grupAdi: string;
  donem: AssessmentPeriod;
  pencere: GelisimPenceresi;
  /** Daha önce kaydedilmiş cevaplar; hiç doldurulmamışsa boş. */
  cevaplar: GelisimCevabi[];
  dolduran: string | null;
  guncellenmeZamani: Date | null;
};

/** Tek bir kaydın tek bir dönem noktasının form verisi. */
export async function gelisimFormu(
  kayitId: string,
  donem: AssessmentPeriod,
  subeId: string,
): Promise<GelisimFormuVerisi | null> {
  const kayit = await db.enrollment.findFirst({
    where: {
      id: kayitId,
      group: { branchId: subeId, term: { is: GUNCEL_DONEM_KOSULU } },
    },
    select: {
      id: true,
      status: true,
      internId: true,
      student: { select: { id: true, firstName: true, lastName: true } },
      group: {
        select: {
          name: true,
          term: {
            select: {
              name: true,
              weeks: {
                orderBy: { weekNumber: "asc" },
                select: { weekNumber: true, date: true },
              },
            },
          },
        },
      },
      developmentAssessments: {
        where: { period: donem },
        select: {
          answersJson: true,
          updatedAt: true,
          filledBy: { select: { name: true } },
        },
      },
    },
  });

  if (!kayit) return null;

  const pencereler = gelisimPencereleri(kayit.group.term?.weeks ?? [], bugun());
  const mevcut = kayit.developmentAssessments[0] ?? null;

  return {
    kayitId: kayit.id,
    kayitAktif: kayit.status === "AKTIF",
    internId: kayit.internId,
    ogrenciId: kayit.student.id,
    ogrenciAdi: `${kayit.student.firstName} ${kayit.student.lastName}`,
    program: kayit.group.term?.name ?? "Dönem",
    grupAdi: kayit.group.name,
    donem,
    pencere: pencereler[donem],
    cevaplar: mevcut ? gelisimCevaplariCozumle(mevcut.answersJson) : [],
    dolduran: mevcut?.filledBy?.name ?? null,
    guncellenmeZamani: mevcut?.updatedAt ?? null,
  };
}
