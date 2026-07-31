import type { Metadata } from "next";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { BosDurum, SayfaBasligi } from "@/components/ui";
import {
  AtamaYonetimi,
  type AtamaSatiri,
  type AtamaStajyeri,
} from "./atama-yonetimi";

export const metadata: Metadata = {
  title: "Stajyer atamaları",
};

/** §8 — Aktif kayıt bazında stajyer atamaları ve yük dağılımı. */
export default async function AtamalarSayfasi() {
  await koordinatorZorunlu();

  const [kayitlar, stajyerler] = await Promise.all([
    db.enrollment.findMany({
      where: { status: "AKTIF" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        internId: true,
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
        intern: { select: { name: true } },
        group: {
          select: {
            name: true,
            term: { select: { name: true } },
            club: { select: { name: true } },
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

  const atamalar: AtamaSatiri[] = kayitlar.map((kayit) => ({
    id: kayit.id,
    ogrenciId: kayit.student.id,
    ogrenciAdi: `${kayit.student.firstName} ${kayit.student.lastName}`,
    program:
      kayit.group.term?.name ?? kayit.group.club?.name ?? "Program bulunamadı",
    grup: kayit.group.name,
    stajyerId: kayit.internId,
    stajyerAdi: kayit.intern?.name ?? null,
  }));

  const stajyerSecenekleri: AtamaStajyeri[] = stajyerler.map((stajyer) => ({
    id: stajyer.id,
    ad: stajyer.name,
    aktifOgrenciSayisi: stajyer._count.assignedEnrollments,
  }));

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Stajyer atamaları"
        aciklama="Atama öğrenci profiline değil, ilgili dönem veya kulüp kaydına bağlıdır. Sayılar bilgi amaçlıdır; sabit bir üst sınır yoktur."
      />

      {atamalar.length === 0 ? (
        <BosDurum
          baslik="Atanacak aktif kayıt yok."
          aciklama="Yeni öğrenci kaydı oluşturulduğunda sorumlu stajyer burada görünür."
        />
      ) : (
        <>
          {/* Aktif stajyer yoksa liste yine de gösterilir: hangi kayıtların
              sahipsiz kaldığını görmek tam da bu ekranın işi. Yalnızca atama
              yapma imkânı kilitlenir. */}
          {stajyerSecenekleri.length === 0 ? (
            <BosDurum
              baslik="Aktif stajyer yok."
              aciklama="Atama yapabilmek için önce bir stajyer hesabını aktifleştirin. Mevcut atamalar aşağıda görünmeye devam eder."
            />
          ) : null}
          <AtamaYonetimi
            atamalar={atamalar}
            stajyerler={stajyerSecenekleri}
          />
        </>
      )}
    </div>
  );
}
