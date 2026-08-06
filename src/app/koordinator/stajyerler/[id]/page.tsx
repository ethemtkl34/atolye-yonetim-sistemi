import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { Kart, Rozet, SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { AKTIF_DONEM_KOSULU, AKTIF_KULUP_KOSULU } from "@/lib/durumlar";
import { grupZamani, tarihBicimle } from "@/lib/tarih";
import { AtamaPaneli, type AtanabilirKayit } from "./atama-paneli";

export async function generateMetadata(
  props: PageProps<"/koordinator/stajyerler/[id]">,
): Promise<Metadata> {
  const kullanici = await yonetimZorunlu("stajyerler");
  const { id } = await props.params;
  const stajyer = await db.user.findFirst({
    where: { id, branchId: kullanici.aktifSubeId },
    select: { name: true },
  });
  return { title: stajyer?.name ?? "Stajyer" };
}

/**
 * §8 — Stajyer sayfası: program seç, öğrenci ata.
 *
 * Ayrı bir "Stajyer atamaları" ekranı vardı ve bütün kayıtları tek listede
 * gösteriyordu; hangi stajyerin hangi dönemde ne kadar yükü olduğu oradan
 * okunmuyordu. Burada sıra doğal: stajyeri aç, çalışacağı programı seç,
 * o programın öğrencilerini tıklayarak ata.
 *
 * Seçim adres satırında (`?program=donem:<id>` / `?program=kulup:<id>`)
 * tutuluyor; sayfa paylaşılabiliyor ve geri tuşu beklendiği gibi çalışıyor.
 */
export default async function StajyerDetaySayfasi(
  props: PageProps<"/koordinator/stajyerler/[id]">,
) {
  const kullanici = await yonetimZorunlu("stajyerler");
  const subeId = kullanici.aktifSubeId;
  const { id } = await props.params;
  const parametreler = await props.searchParams;

  const secim =
    typeof parametreler.program === "string" ? parametreler.program : "";
  const [secilenTur, secilenId] = secim.includes(":")
    ? secim.split(":")
    : ["", ""];
  const donemSecili = secilenTur === "donem" && secilenId;
  const kulupSecili = secilenTur === "kulup" && secilenId;

  const [stajyer, donemler, kulupler] = await Promise.all([
    db.user.findFirst({
      where: { id, branchId: subeId },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        roles: true,
        _count: {
          select: {
            assignedEnrollments: { where: { status: "AKTIF" } },
            enteredScores: true,
          },
        },
      },
    }),
    // Program listesi aktif programlardan; stajyer geçmiş bir programa
    // atanacaksa zaten kayıt oradan yönetilir.
    db.term.findMany({
      where: AKTIF_DONEM_KOSULU,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        interns: {
          where: { user: { branchId: subeId } },
          select: { userId: true },
        },
      },
    }),
    db.club.findMany({
      where: AKTIF_KULUP_KOSULU,
      orderBy: { date: "desc" },
      select: { id: true, name: true, date: true },
    }),
  ]);

  if (!stajyer || !stajyer.roles.includes("STAJYER")) notFound();

  const secilenDonem = donemSecili
    ? (donemler.find((donem) => donem.id === secilenId) ?? null)
    : null;
  const secilenKulup = kulupSecili
    ? (kulupler.find((kulup) => kulup.id === secilenId) ?? null)
    : null;

  // Seçilen programın aktif kayıtları — atama listesi bunlardan oluşur.
  const kayitlar =
    secilenDonem || secilenKulup
      ? await db.enrollment.findMany({
          where: {
            status: "AKTIF",
            group: secilenDonem
              ? { termId: secilenDonem.id, branchId: subeId }
              : { clubId: secilenKulup!.id, branchId: subeId },
          },
          orderBy: { student: { searchName: "asc" } },
          select: {
            id: true,
            internId: true,
            student: { select: { id: true, firstName: true, lastName: true } },
            intern: { select: { name: true } },
            group: { select: { name: true, days: true, timeSlot: true } },
          },
        })
      : [];

  const atanabilirler: AtanabilirKayit[] = kayitlar.map((kayit) => ({
    kayitId: kayit.id,
    ogrenciId: kayit.student.id,
    ogrenciAdi: `${kayit.student.firstName} ${kayit.student.lastName}`,
    grupAdi: kayit.group.name,
    grupZamani: grupZamani(kayit.group.days, kayit.group.timeSlot),
    mevcutStajyerAdi: kayit.intern?.name ?? null,
    bende: kayit.internId === stajyer.id,
  }));

  const bendekiSayi = atanabilirler.filter((kayit) => kayit.bende).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/stajyerler"
          className={geriBaglantiStili}
        >
          ← Stajyerler
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={stajyer.name}
            aciklama={`${stajyer.email} · ${stajyer._count.assignedEnrollments} aktif öğrenci · ${stajyer._count.enteredScores} puanlama`}
            aksiyon={
              stajyer.active ? undefined : <Rozet tur="pasif">Pasif hesap</Rozet>
            }
          />
        </div>
      </div>

      {/* --- Program seçimi --- */}
      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Hangi programda atama yapılacak?
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Programı seçin; o programın öğrencileri aşağıda listelenir ve
          tıklayarak {stajyer.name} adlı stajyere atayabilirsiniz.
        </p>

        {donemler.length === 0 && kulupler.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Aktif dönem veya kulüp yok.
          </p>
        ) : (
          <form method="get" className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="text-zinc-600">Program</span>
              <select
                name="program"
                defaultValue={secim}
                className="mt-1 min-h-[2.75rem] w-full min-w-64 rounded-md border border-yuzey-200 bg-white px-3 py-2 text-base outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100 sm:min-h-0 sm:text-sm"
              >
                <option value="">Seçin…</option>
                {donemler.length > 0 ? (
                  <optgroup label="Dönemler">
                    {donemler.map((donem) => (
                      <option key={donem.id} value={`donem:${donem.id}`}>
                        {donem.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {kulupler.length > 0 ? (
                  <optgroup label="Kulüpler">
                    {kulupler.map((kulup) => (
                      <option key={kulup.id} value={`kulup:${kulup.id}`}>
                        {kulup.name} · {tarihBicimle(kulup.date)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-marka-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-marka-700"
            >
              Göster
            </button>
          </form>
        )}
      </Kart>

      {/* --- Atama listesi --- */}
      {secilenDonem || secilenKulup ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900">
              {secilenDonem?.name ?? secilenKulup?.name}
            </h2>
            <span className="text-sm text-zinc-500">
              {atanabilirler.length} aktif kayıt · {bendekiSayi} tanesi{" "}
              {stajyer.name} adlı stajyerde
            </span>
          </div>

          <AtamaPaneli
            stajyerId={stajyer.id}
            stajyerAdi={stajyer.name}
            stajyerAktif={stajyer.active}
            donemId={secilenDonem?.id ?? null}
            donemAdi={secilenDonem?.name ?? null}
            kadroda={
              secilenDonem
                ? secilenDonem.interns.length === 0
                  ? null
                  : secilenDonem.interns.some(
                      (satir) => satir.userId === stajyer.id,
                    )
                : null
            }
            kayitlar={atanabilirler}
          />
        </div>
      ) : null}
    </div>
  );
}
