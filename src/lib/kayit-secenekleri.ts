import type { Day } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { kontenjanDurumu } from "@/lib/scoring";
import { grupZamani, tarihBicimle } from "@/lib/tarih";

/**
 * Kayıt alan programların (dönem + kulüp) grup listesi.
 *
 * İki ekran aynı veriyi istiyor: kayıt sihirbazı ve yeni öğrenci formundaki
 * isteğe bağlı kayıt bölümü. Sorgu tek yerde durmazsa ikisi zamanla ayrışır —
 * özellikle şube süzgeci taşıyan iç içe okumalar (gruplar, kadro) kopyalanırken
 * unutulmaya açık.
 */

export type GrupSecenegi = {
  id: string;
  ad: string;
  zaman: string;
  kapasite: number;
  doluluk: number;
  dolu: boolean;
  aktif: boolean;
  oturumSayisi: number;
  baslangicHaftasi: number;
};

export type ProgramSecenegi = {
  id: string;
  ad: string;
  tur: "Dönem" | "Kulüp";
  gruplar: GrupSecenegi[];
  /** Dönemin stajyer kadrosu; `null` = kısıt yok (kulüpler ve kadrosuz dönemler). */
  stajyerIdleri: string[] | null;
};

type HamGrup = {
  id: string;
  name: string;
  days: Day[];
  timeSlot: "OGLEDEN_ONCE" | "OGLEDEN_SONRA";
  capacity: number;
  active: boolean;
  startWeekNumber: number;
  _count: { sessions: number; enrollments: number };
};

export function grupSecenekleri(gruplar: HamGrup[]): GrupSecenegi[] {
  return gruplar.map((grup) => {
    const kontenjan = kontenjanDurumu(grup.capacity, grup._count.enrollments);
    return {
      id: grup.id,
      ad: grup.name,
      zaman: grupZamani(grup.days, grup.timeSlot),
      kapasite: kontenjan.kapasite,
      doluluk: kontenjan.doluluk,
      dolu: kontenjan.dolu,
      aktif: grup.active,
      oturumSayisi: grup._count.sessions,
      baslangicHaftasi: grup.startWeekNumber,
    };
  });
}

export async function kayitAlanProgramlar(
  subeId: string,
): Promise<ProgramSecenegi[]> {
  // Dönem ve kulübün kendisi ortak — süzülmüyor. Süzülen, içlerindeki gruplar
  // ve kadro: her şube kendi gruplarına kayıt alır, kendi stajyerlerini görür.
  const [donemler, kulupler] = await Promise.all([
    db.term.findMany({
      where: { status: "KAYIT_ALIYOR" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        interns: {
          where: { user: { branchId: subeId } },
          select: { userId: true },
        },
        groups: {
          where: { branchId: subeId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            days: true,
            timeSlot: true,
            capacity: true,
            active: true,
            startWeekNumber: true,
            _count: {
              select: {
                sessions: true,
                enrollments: { where: { status: "AKTIF" } },
              },
            },
          },
        },
      },
    }),
    db.club.findMany({
      where: { status: "KAYIT_ALIYOR" },
      orderBy: { date: "asc" },
      select: {
        id: true,
        name: true,
        date: true,
        groups: {
          where: { branchId: subeId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            days: true,
            timeSlot: true,
            capacity: true,
            active: true,
            startWeekNumber: true,
            _count: {
              select: {
                sessions: true,
                enrollments: { where: { status: "AKTIF" } },
              },
            },
          },
        },
      },
    }),
  ]);

  return [
    ...donemler.map((donem) => ({
      id: donem.id,
      ad: donem.name,
      tur: "Dönem" as const,
      gruplar: grupSecenekleri(donem.groups),
      // Kadro tanımlıysa sorumlu stajyer yalnızca kadrodan seçilir; boş kadro
      // (null) kısıt uygulamaz — eski dönemler eskisi gibi çalışır.
      stajyerIdleri:
        donem.interns.length > 0
          ? donem.interns.map((kadro) => kadro.userId)
          : null,
    })),
    ...kulupler.map((kulup) => ({
      id: kulup.id,
      ad: `${kulup.name} · ${tarihBicimle(kulup.date)}`,
      tur: "Kulüp" as const,
      gruplar: grupSecenekleri(kulup.groups),
      stajyerIdleri: null,
    })),
  ];
}
