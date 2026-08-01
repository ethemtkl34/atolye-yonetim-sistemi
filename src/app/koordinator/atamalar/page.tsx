import type { Metadata } from "next";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { BosDurum, SayfaBasligi } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { ATANMAMIS_KAYIT_KOSULU } from "@/lib/durumlar";
import {
  AtamaYonetimi,
  type AtamaSatiri,
  type AtamaStajyeri,
} from "./atama-yonetimi";

export const metadata: Metadata = {
  title: "Stajyer atamaları",
};

const TEMEL_YOL = "/koordinator/atamalar";

/**
 * §8 — Aktif kayıt bazında stajyer atamaları ve yük dağılımı.
 *
 * "Atanmamış" süzgeci dashboarddaki aynı adlı kartla birebir aynı koşulu
 * (`ATANMAMIS_KAYIT_KOSULU`) okur: kartta yazan sayı ile buradaki liste
 * uzunluğu ayrışamaz.
 */
export default async function AtamalarSayfasi(
  props: PageProps<"/koordinator/atamalar">,
) {
  await koordinatorZorunlu();

  const parametreler = await props.searchParams;
  const suzgec =
    parametreler.suzgec === "atanmamis" ? "atanmamis" : "tumu";

  const [kayitlar, stajyerler, atanmamisSayisi] = await Promise.all([
    db.enrollment.findMany({
      where: suzgec === "atanmamis" ? ATANMAMIS_KAYIT_KOSULU : { status: "AKTIF" },
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
            term: {
              select: {
                name: true,
                interns: { select: { userId: true } },
              },
            },
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
    db.enrollment.count({ where: ATANMAMIS_KAYIT_KOSULU }),
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
    // Dönemin kadrosu tanımlıysa bu satırda yalnızca kadro listelenir;
    // null = kısıt yok (kulüpler ve kadrosuz dönemler).
    izinliStajyerIdleri:
      kayit.group.term && kayit.group.term.interns.length > 0
        ? kayit.group.term.interns.map((satir) => satir.userId)
        : null,
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

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Kayıtlar"
          temelYol={TEMEL_YOL}
          anahtar="suzgec"
          secenekler={[
            { deger: "tumu", etiket: "Bütün aktif kayıtlar" },
            {
              deger: "atanmamis",
              etiket: `Stajyeri atanmamış (${atanmamisSayisi})`,
            },
          ]}
          secili={suzgec}
        />
      </SuzgecCubugu>

      {atamalar.length === 0 ? (
        <BosDurum
          baslik={
            suzgec === "atanmamis"
              ? "Stajyeri atanmamış kayıt yok."
              : "Atanacak aktif kayıt yok."
          }
          aciklama={
            suzgec === "atanmamis"
              ? "Aktif programlardaki bütün kayıtların sorumlusu belli."
              : "Yeni öğrenci kaydı oluşturulduğunda sorumlu stajyer burada görünür."
          }
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
