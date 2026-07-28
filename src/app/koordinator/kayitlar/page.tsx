import type { Metadata } from "next";
import Link from "next/link";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { grupZamani, tarihBicimle } from "@/lib/tarih";
import { BosDurum, Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { KayitDurumButonu } from "./kayit-durum-butonu";

export const metadata: Metadata = {
  title: "Öğrenci kayıtları",
};

/** §7 — Dönem ve kulüp kayıtlarının tek operasyon listesi. */
export default async function KayitlarSayfasi() {
  await koordinatorZorunlu();

  const kayitlar = await db.enrollment.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true },
      },
      intern: { select: { id: true, name: true, active: true } },
      group: {
        include: {
          term: { select: { id: true, name: true } },
          club: { select: { id: true, name: true, date: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Öğrenci kayıtları"
        aciklama="Dönem ve kulüp kayıtları burada birlikte görünür. Yeni kayıt öğrenci profilinden başlatılır."
        aksiyon={
          <Link
            href="/koordinator/ogrenciler"
            className="inline-flex rounded-md bg-marka-600 px-3 py-2 text-sm font-medium text-white hover:bg-marka-700"
          >
            Öğrenci seç
          </Link>
        }
      />

      {kayitlar.length === 0 ? (
        <BosDurum
          baslik="Henüz öğrenci kaydı yok."
          aciklama="Bir öğrenci profilini açıp dönem veya kulüp kaydı oluşturun."
        />
      ) : (
        <div className="space-y-3">
          {kayitlar.map((kayit) => {
            const program = kayit.group.term
              ? {
                  tur: "Dönem",
                  ad: kayit.group.term.name,
                  yol: `/koordinator/donemler/${kayit.group.term.id}`,
                }
              : kayit.group.club
                ? {
                    tur: "Kulüp",
                    ad: kayit.group.club.name,
                    yol: `/koordinator/kulupler/${kayit.group.club.id}`,
                  }
                : null;

            return (
              <Kart key={kayit.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/koordinator/ogrenciler/${kayit.student.id}`}
                        className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                      >
                        {kayit.student.firstName} {kayit.student.lastName}
                      </Link>
                      <Rozet
                        tur={kayit.status === "AKTIF" ? "olumlu" : "pasif"}
                      >
                        {kayit.status === "AKTIF" ? "Aktif" : "İptal"}
                      </Rozet>
                      <Rozet>{program?.tur ?? "Program"}</Rozet>
                    </div>

                    <p className="mt-1 text-sm text-zinc-700">
                      {program ? (
                        <Link
                          href={program.yol}
                          className="text-marka-700 hover:underline"
                        >
                          {program.ad}
                        </Link>
                      ) : (
                        "Program bulunamadı"
                      )}
                      {" · "}
                      {kayit.group.name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {grupZamani(kayit.group.day, kayit.group.timeSlot)}
                      {kayit.group.club
                        ? ` · ${tarihBicimle(kayit.group.club.date)}`
                        : ""}
                      {" · "}
                      Kayıt tarihi {tarihBicimle(kayit.createdAt)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Sorumlu stajyer:{" "}
                      {kayit.intern ? (
                        <>
                          {kayit.intern.name}
                          {!kayit.intern.active ? " (pasif hesap)" : ""}
                        </>
                      ) : (
                        <span className="text-amber-700">Atanmamış</span>
                      )}
                    </p>
                  </div>

                  <KayitDurumButonu
                    kayitId={kayit.id}
                    aktif={kayit.status === "AKTIF"}
                  />
                </div>
              </Kart>
            );
          })}
        </div>
      )}
    </div>
  );
}
