import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { kontenjanDurumu } from "@/lib/scoring";
import { grupZamani, tarihBicimle } from "@/lib/tarih";
import { BosDurum, SayfaBasligi, butonStili } from "@/components/ui";
import {
  KayitFormu,
  type ProgramSecenegi,
  type StajyerSecenegi,
} from "./kayit-formu";

export const metadata: Metadata = {
  title: "Yeni kayıt",
};

/** §7 — Öğrenci profilinden başlayan dönem/kulüp kayıt sihirbazı. */
export default async function YeniKayitSayfasi(
  props: PageProps<"/koordinator/kayitlar/yeni">,
) {
  await koordinatorZorunlu();

  const parametreler = await props.searchParams;
  const studentId =
    typeof parametreler.studentId === "string"
      ? parametreler.studentId
      : undefined;

  if (!studentId) {
    return (
      <div className="space-y-6">
        <SayfaBasligi
          baslik="Yeni kayıt"
          aciklama="Kayıt oluşturmak için önce öğrenciyi seçin."
        />
        <BosDurum
          baslik="Öğrenci seçilmedi."
          aciklama="Öğrenci profilini açıp “Yeni kayıt” düğmesini kullanın."
        />
        <Link
          href="/koordinator/ogrenciler"
          className={butonStili()}
        >
          Öğrencilere git
        </Link>
      </div>
    );
  }

  const [ogrenci, donemler, kulupler, stajyerler] = await Promise.all([
    db.student.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.term.findMany({
      where: { status: "KAYIT_ALIYOR" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        interns: { select: { userId: true } },
        groups: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            day: true,
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
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            day: true,
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
    db.user.findMany({
      where: { role: "STAJYER", active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            assignedEnrollments: { where: { status: "AKTIF" } },
          },
        },
      },
    }),
  ]);

  if (!ogrenci) notFound();

  function gruplariDonustur<
    T extends {
      id: string;
      name: string;
      day: "CUMARTESI" | "PAZAR";
      timeSlot: "OGLEDEN_ONCE" | "OGLEDEN_SONRA";
      capacity: number;
      active: boolean;
      startWeekNumber: number;
      _count: { sessions: number; enrollments: number };
    },
  >(gruplar: T[]) {
    return gruplar.map((grup) => {
      const kontenjan = kontenjanDurumu(
        grup.capacity,
        grup._count.enrollments,
      );
      return {
        id: grup.id,
        ad: grup.name,
        zaman: grupZamani(grup.day, grup.timeSlot),
        kapasite: kontenjan.kapasite,
        doluluk: kontenjan.doluluk,
        dolu: kontenjan.dolu,
        aktif: grup.active,
        oturumSayisi: grup._count.sessions,
        baslangicHaftasi: grup.startWeekNumber,
      };
    });
  }

  const programlar: ProgramSecenegi[] = [
    ...donemler.map((donem) => ({
      id: donem.id,
      ad: donem.name,
      tur: "Dönem" as const,
      gruplar: gruplariDonustur(donem.groups),
      // Kadro tanımlıysa sorumlu stajyer yalnızca kadrodan seçilir; boş
      // kadro (null) kısıt uygulamaz — eski dönemler eskisi gibi çalışır.
      stajyerIdleri:
        donem.interns.length > 0
          ? donem.interns.map((kadro) => kadro.userId)
          : null,
    })),
    ...kulupler.map((kulup) => ({
      id: kulup.id,
      ad: `${kulup.name} · ${tarihBicimle(kulup.date)}`,
      tur: "Kulüp" as const,
      gruplar: gruplariDonustur(kulup.groups),
      stajyerIdleri: null,
    })),
  ];

  const stajyerSecenekleri: StajyerSecenegi[] = stajyerler.map((stajyer) => ({
    id: stajyer.id,
    ad: stajyer.name,
    aktifOgrenciSayisi: stajyer._count.assignedEnrollments,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/koordinator/ogrenciler/${ogrenci.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Öğrenci profili
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik="Yeni kayıt"
            aciklama="Kayıt, seçilen gruba ve sorumlu stajyere bağlıdır. Kontenjan işlem sırasında sunucuda yeniden kontrol edilir."
          />
        </div>
      </div>

      <KayitFormu
        ogrenci={{
          id: ogrenci.id,
          ad: `${ogrenci.firstName} ${ogrenci.lastName}`,
        }}
        programlar={programlar}
        stajyerler={stajyerSecenekleri}
      />
    </div>
  );
}
