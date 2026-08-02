import { db } from "./db";
import { aktifGrupKosulu } from "./durumlar";
import { bugun, tarihMetni } from "./tarih";
import { puanlamaOrtalamasi } from "./scoring";
import {
  formSatirlariOlustur,
  gorevOzeti,
  oturumPuanlanabilirMi,
  puanlamaDurumu,
  type FormSatiri,
  type GorevOzeti,
  type PuanlamaDurumu,
} from "./puanlama";
import type { Day, TimeSlot } from "@/generated/prisma/enums";

/**
 * Puanlama ekranlarının veri katmanı.
 *
 * Stajyer paneli ve koordinatörün puanlama modülü aynı ekranı iki farklı
 * yetkiyle gösteriyor; sorgu ve dönüştürme mantığı burada tek yerde durur.
 * Karar üretmez — durum hesapları `puanlama.ts`, ortalama `scoring.ts`
 * fonksiyonlarına bırakılır.
 *
 * GİZLİLİK (§3.2): Stajyerin gördüğü hiçbir yolda veli telefonu veya sağlık
 * detayı `select` listesine alınmaz. Stajyere açık tek sağlık alanı
 * `HealthInfo.internSafetyNote`.
 *
 * ŞUBE: Buradaki her fonksiyon `subeId`'yi ZORUNLU alır. Opsiyonel olsaydı
 * mevcut çağrılar sessizce derlenir ve şube süzgeci olmadan çalışırdı; zorunlu
 * olunca derleyici her çağrı yerini tek tek saydırıyor. Kayıt/puanlama şubesi
 * her zaman grup üzerinden türer (`enrollment.group.branchId`).
 */

export type OturumFormu = {
  oturumId: string;
  atolyeId: string;
  atolyeAdi: string;
  durum: PuanlamaDurumu;
  /** Form hiç açılmamışsa null. */
  attended: boolean | null;
  /** §10.2 — Katılmadıysa ortalama hesaplanmaz. */
  ortalama: number | null;
  satirlar: FormSatiri[];
  /** Gelecek tarihli oturum henüz puanlanamaz. */
  puanlanabilir: boolean;
  puanlayan: string | null;
  guncellenmeZamani: Date | null;
};

export type GunFormlari = {
  tarih: Date;
  tarihAnahtari: string;
  haftaNumarasi: number | null;
  puanlanabilir: boolean;
  formlar: OturumFormu[];
  ozet: GorevOzeti;
};

export type PuanlamaKaydi = {
  id: string;
  aktif: boolean;
  ogrenciId: string;
  ogrenciAdi: string;
  stajyerId: string | null;
  stajyerAdi: string | null;
  program: string;
  programTuru: "Dönem" | "Kulüp";
  grupAdi: string;
  gun: Day;
  zamanDilimi: TimeSlot;
  /** Stajyerin görebildiği tek sağlık bilgisi (§3.2). */
  guvenlikUyarisi: string | null;
};

export type KayitPuanlamasi = {
  kayit: PuanlamaKaydi;
  gunler: GunFormlari[];
  ozet: GorevOzeti;
};

/**
 * Bir kaydın bütün puanlama tablosu: grubun oturumları günlere bölünmüş,
 * her oturumun formu ve durumu hesaplanmış olarak.
 *
 * `findUnique` yerine `findFirst`: Prisma'da `findUnique` yalnızca unique
 * alanlarla süzülür, şube koşulu eklenemez. Başka şubenin kayıt id'si
 * yapıştırılırsa sorgu boş döner, çağıran taraf `notFound()` gösterir.
 */
export async function kayitPuanlamasi(
  kayitId: string,
  subeId: string,
): Promise<KayitPuanlamasi | null> {
  const kayit = await db.enrollment.findFirst({
    where: { id: kayitId, group: { branchId: subeId } },
    select: {
      id: true,
      status: true,
      internId: true,
      intern: { select: { name: true } },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          healthInfo: { select: { internSafetyNote: true } },
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          day: true,
          timeSlot: true,
          term: { select: { name: true } },
          club: { select: { name: true } },
        },
      },
    },
  });

  if (!kayit) return null;

  const oturumlar = await db.session.findMany({
    where: { groupId: kayit.group.id },
    orderBy: [{ date: "asc" }, { workshopType: { sortOrder: "asc" } }],
    select: {
      id: true,
      date: true,
      // Hafta numarası oturumun kendi alanından okunuyor, `termWeek`
      // ilişkisinden değil: kulüplerin `TermWeek` kaydı yok ve kulüp artık
      // haftalara yayılabiliyor. Telafi günlerinde boş kalır.
      weekNumber: true,
      workshopType: {
        select: {
          id: true,
          name: true,
          questions: {
            where: { active: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, text: true, sortOrder: true },
          },
        },
      },
      scores: {
        where: { enrollmentId: kayitId },
        select: {
          attended: true,
          updatedAt: true,
          scoredBy: { select: { name: true } },
          answers: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
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

  const bugunkuTarih = bugun();
  const gunHaritasi = new Map<string, GunFormlari>();

  for (const oturum of oturumlar) {
    const puanlama = oturum.scores[0] ?? null;
    const satirlar = formSatirlariOlustur(
      oturum.workshopType.questions,
      puanlama?.answers ?? [],
    );

    const durum = puanlamaDurumu(
      puanlama
        ? {
            attended: puanlama.attended,
            cevaplananSoruIdleri: puanlama.answers
              .map((cevap) => cevap.questionId)
              .filter((id): id is string => id !== null),
          }
        : null,
      oturum.workshopType.questions.map((soru) => soru.id),
    );

    const form: OturumFormu = {
      oturumId: oturum.id,
      atolyeId: oturum.workshopType.id,
      atolyeAdi: oturum.workshopType.name,
      durum,
      attended: puanlama?.attended ?? null,
      ortalama: puanlama
        ? puanlamaOrtalamasi({
            attended: puanlama.attended,
            answers: puanlama.answers,
          })
        : null,
      satirlar,
      puanlanabilir: oturumPuanlanabilirMi(oturum.date, bugunkuTarih),
      puanlayan: puanlama?.scoredBy?.name ?? null,
      guncellenmeZamani: puanlama?.updatedAt ?? null,
    };

    const anahtar = tarihMetni(oturum.date);
    const mevcut = gunHaritasi.get(anahtar);

    if (mevcut) {
      mevcut.formlar.push(form);
    } else {
      gunHaritasi.set(anahtar, {
        tarih: oturum.date,
        tarihAnahtari: anahtar,
        haftaNumarasi: oturum.weekNumber,
        puanlanabilir: form.puanlanabilir,
        formlar: [form],
        ozet: gorevOzeti([]),
      });
    }
  }

  const gunler = [...gunHaritasi.values()].map((gun) => ({
    ...gun,
    ozet: gorevOzeti(gun.formlar.map((form) => form.durum)),
  }));

  return {
    kayit: kayitSatiri(kayit),
    gunler,
    // Genel özet yalnızca yapılmış oturumları sayar; gelecek haftaların formu
    // "eksik" değil, henüz sırası gelmemiş demektir.
    ozet: gorevOzeti(
      gunler
        .filter((gun) => gun.puanlanabilir)
        .flatMap((gun) => gun.formlar.map((form) => form.durum)),
    ),
  };
}

type KayitSorgusu = {
  id: string;
  status: "AKTIF" | "IPTAL";
  internId: string | null;
  intern: { name: string } | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    healthInfo: { internSafetyNote: string | null } | null;
  };
  group: {
    name: string;
    day: Day;
    timeSlot: TimeSlot;
    term: { name: string } | null;
    club: { name: string } | null;
  };
};

function kayitSatiri(kayit: KayitSorgusu): PuanlamaKaydi {
  return {
    id: kayit.id,
    aktif: kayit.status === "AKTIF",
    ogrenciId: kayit.student.id,
    ogrenciAdi: `${kayit.student.firstName} ${kayit.student.lastName}`,
    stajyerId: kayit.internId,
    stajyerAdi: kayit.intern?.name ?? null,
    program: kayit.group.term?.name ?? kayit.group.club?.name ?? "Program",
    programTuru: kayit.group.term ? "Dönem" : "Kulüp",
    grupAdi: kayit.group.name,
    gun: kayit.group.day,
    zamanDilimi: kayit.group.timeSlot,
    guvenlikUyarisi: kayit.student.healthInfo?.internSafetyNote ?? null,
  };
}

export type GunOzeti = {
  tarih: Date;
  tarihAnahtari: string;
  ozet: GorevOzeti;
};

export type KayitIlerlemesi = {
  kayit: PuanlamaKaydi;
  ozet: GorevOzeti;
  /** Yalnızca yapılmış (puanlanabilir) günler. */
  gunler: GunOzeti[];
  /** Bekleyen formu olan en yakın gün. */
  bekleyenGun: GunOzeti | null;
  sonPuanlama: Date | null;
};

/**
 * Birden çok kaydın ilerlemesini tek turda hesaplar.
 *
 * Liste ekranları (stajyerin öğrencileri, koordinatörün puanlama listesi) her
 * kayıt için ayrı sorgu atmasın diye oturumlar ve puanlamalar toplu çekilir.
 */
export async function kayitIlerlemeleri(kosul: {
  /** Zorunlu — liste hiçbir zaman şubeler arası olmamalı. */
  subeId: string;
  internId?: string;
  yalnizcaAktif?: boolean;
  /**
   * Kayıt aktif olsa bile programı arşivlenmişse listeye alınmaz. Dashboard
   * "aktif dönem 0" derken aynı ekranda o dönemin eksik formlarını saymasın
   * diye koordinatör ekranları bunu açar (P11).
   */
  yalnizcaAktifProgram?: boolean;
  studentId?: string;
}): Promise<KayitIlerlemesi[]> {
  const kayitlar = await db.enrollment.findMany({
    where: {
      ...(kosul.internId ? { internId: kosul.internId } : {}),
      ...(kosul.studentId ? { studentId: kosul.studentId } : {}),
      ...(kosul.yalnizcaAktif ? { status: "AKTIF" } : {}),
      group: kosul.yalnizcaAktifProgram
        ? aktifGrupKosulu(kosul.subeId)
        : { branchId: kosul.subeId },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      internId: true,
      groupId: true,
      intern: { select: { name: true } },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          healthInfo: { select: { internSafetyNote: true } },
        },
      },
      group: {
        select: {
          name: true,
          day: true,
          timeSlot: true,
          term: { select: { name: true } },
          club: { select: { name: true } },
        },
      },
    },
  });

  if (kayitlar.length === 0) return [];

  const kayitIdleri = kayitlar.map((kayit) => kayit.id);
  const grupIdleri = [...new Set(kayitlar.map((kayit) => kayit.groupId))];

  const oturumlar = await db.session.findMany({
    where: { groupId: { in: grupIdleri } },
    orderBy: [{ date: "asc" }, { workshopType: { sortOrder: "asc" } }],
    select: {
      id: true,
      date: true,
      groupId: true,
      workshopType: {
        select: {
          questions: { where: { active: true }, select: { id: true } },
        },
      },
      scores: {
        where: { enrollmentId: { in: kayitIdleri } },
        select: {
          enrollmentId: true,
          attended: true,
          updatedAt: true,
          answers: { select: { questionId: true } },
        },
      },
    },
  });

  const bugunkuTarih = bugun();

  return kayitlar.map((kayit) => {
    const kendiOturumlari = oturumlar.filter(
      (oturum) =>
        oturum.groupId === kayit.groupId &&
        oturumPuanlanabilirMi(oturum.date, bugunkuTarih),
    );

    const durumlar: PuanlamaDurumu[] = [];
    const gunDurumlari = new Map<string, { tarih: Date; durumlar: PuanlamaDurumu[] }>();
    let sonPuanlama: Date | null = null;

    for (const oturum of kendiOturumlari) {
      const puanlama =
        oturum.scores.find((puan) => puan.enrollmentId === kayit.id) ?? null;

      const durum = puanlamaDurumu(
        puanlama
          ? {
              attended: puanlama.attended,
              cevaplananSoruIdleri: puanlama.answers
                .map((cevap) => cevap.questionId)
                .filter((id): id is string => id !== null),
            }
          : null,
        oturum.workshopType.questions.map((soru) => soru.id),
      );

      durumlar.push(durum);

      const anahtar = tarihMetni(oturum.date);
      const gun = gunDurumlari.get(anahtar);
      if (gun) {
        gun.durumlar.push(durum);
      } else {
        gunDurumlari.set(anahtar, { tarih: oturum.date, durumlar: [durum] });
      }

      if (
        puanlama &&
        (!sonPuanlama || puanlama.updatedAt.getTime() > sonPuanlama.getTime())
      ) {
        sonPuanlama = puanlama.updatedAt;
      }
    }

    const gunler: GunOzeti[] = [...gunDurumlari.entries()].map(
      ([tarihAnahtari, gun]) => ({
        tarih: gun.tarih,
        tarihAnahtari,
        ozet: gorevOzeti(gun.durumlar),
      }),
    );

    return {
      kayit: kayitSatiri(kayit),
      ozet: gorevOzeti(durumlar),
      gunler,
      bekleyenGun: gunler.find((gun) => gun.ozet.bekleyen > 0) ?? null,
      sonPuanlama,
    };
  });
}

export type DoldurulmusForm = {
  oturumId: string;
  kayitId: string;
  tarih: Date;
  tarihAnahtari: string;
  ogrenciId: string;
  ogrenciAdi: string;
  program: string;
  programTuru: "Dönem" | "Kulüp";
  grupAdi: string;
  stajyerAdi: string | null;
  atolyeAdi: string;
  attended: boolean;
  ortalama: number | null;
  guncellenmeZamani: Date;
};

/**
 * §12.3 — "Daha önce doldurduğu formlar" listesi. Koordinatör tarafında da
 * aynı liste stajyer süzgeci olmadan kullanılır.
 */
export async function doldurulmusFormlar(kosul: {
  /** Zorunlu — geçmiş formlar da şube dışına çıkmamalı. */
  subeId: string;
  internId?: string;
  studentId?: string;
  enFazla?: number;
}): Promise<DoldurulmusForm[]> {
  const puanlamalar = await db.score.findMany({
    where: {
      enrollment: {
        group: { branchId: kosul.subeId },
        ...(kosul.internId ? { internId: kosul.internId } : {}),
        ...(kosul.studentId ? { studentId: kosul.studentId } : {}),
      },
    },
    orderBy: { updatedAt: "desc" },
    take: kosul.enFazla ?? 50,
    select: {
      attended: true,
      updatedAt: true,
      enrollmentId: true,
      session: {
        select: {
          id: true,
          date: true,
          workshopType: { select: { name: true } },
        },
      },
      enrollment: {
        select: {
          student: { select: { id: true, firstName: true, lastName: true } },
          intern: { select: { name: true } },
          group: {
            select: {
              name: true,
              term: { select: { name: true } },
              club: { select: { name: true } },
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          questionTextSnapshot: true,
          value: true,
          sortOrder: true,
        },
      },
    },
  });

  return puanlamalar.map((puanlama) => ({
    oturumId: puanlama.session.id,
    kayitId: puanlama.enrollmentId,
    tarih: puanlama.session.date,
    tarihAnahtari: tarihMetni(puanlama.session.date),
    ogrenciId: puanlama.enrollment.student.id,
    ogrenciAdi: `${puanlama.enrollment.student.firstName} ${puanlama.enrollment.student.lastName}`,
    program:
      puanlama.enrollment.group.term?.name ??
      puanlama.enrollment.group.club?.name ??
      "Program",
    programTuru: puanlama.enrollment.group.term ? "Dönem" : "Kulüp",
    grupAdi: puanlama.enrollment.group.name,
    stajyerAdi: puanlama.enrollment.intern?.name ?? null,
    atolyeAdi: puanlama.session.workshopType.name,
    attended: puanlama.attended,
    ortalama: puanlamaOrtalamasi({
      attended: puanlama.attended,
      answers: puanlama.answers,
    }),
    guncellenmeZamani: puanlama.updatedAt,
  }));
}
