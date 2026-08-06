import type { Metadata } from "next";
import Link from "next/link";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { grupZamani, tarihBicimle, tarihMetni } from "@/lib/tarih";
import { BosDurum, Kart, Rozet, SayfaBasligi, baglantiStili, butonStili, kartBasligiStili } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { atanmamisKayitKosulu } from "@/lib/durumlar";
import { KayitIptalOzeti } from "@/components/kayit-iptal-ozeti";
import { KayitDurumButonu, type IptalGunu } from "./kayit-durum-butonu";

export const metadata: Metadata = {
  title: "Öğrenci kayıtları",
};

const TEMEL_YOL = "/koordinator/kayitlar";

/**
 * §7 — Dönem ve kulüp kayıtlarının tek operasyon listesi.
 *
 * "Stajyeri atanmamış" süzgeci dashboard kartının karşılığıdır: kart ile
 * liste aynı koşulu (`atanmamisKayitKosulu()`) okur, böylece karttaki sayı
 * ile listenin uzunluğu ayrışmaz.
 */
export default async function KayitlarSayfasi(
  props: PageProps<"/koordinator/kayitlar">,
) {
  const kullanici = await yonetimZorunlu("kayitlar");
  const subeId = kullanici.aktifSubeId;

  const parametreler = await props.searchParams;
  const suzgec =
    parametreler.suzgec === "atanmamis" ? "atanmamis" : "tumu";

  const [kayitlar, atanmamisSayisi] = await Promise.all([
    db.enrollment.findMany({
    where:
      suzgec === "atanmamis"
        ? atanmamisKayitKosulu(subeId)
        : { group: { branchId: subeId } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true },
      },
      intern: { select: { id: true, name: true, active: true } },
      // Atölye özeti türetiliyor: katılım işaretli puanlama sayısı ile grubun
      // oturum sayısı. İptal anında ayrıca saklanmıyor (bkz. `atolyeOzeti`).
      _count: { select: { scores: { where: { attended: true } } } },
      group: {
        include: {
          term: { select: { id: true, name: true } },
          club: { select: { id: true, name: true, date: true } },
          _count: { select: { sessions: true } },
        },
      },
    },
    }),
    db.enrollment.count({ where: atanmamisKayitKosulu(subeId) }),
  ]);

  /**
   * İptal formundaki "son katıldığı gün" listesi grubun KENDİ takviminden
   * geliyor. Tek sorguda bütün gruplar okunuyor; kayıt başına bir sorgu
   * açılsaydı liste uzadıkça sayfa açılışı yavaşlardı.
   */
  const grupIdleri = [...new Set(kayitlar.map((kayit) => kayit.groupId))];
  const oturumGunleri =
    grupIdleri.length > 0
      ? await db.session.findMany({
          where: { groupId: { in: grupIdleri }, group: { branchId: subeId } },
          distinct: ["groupId", "date"],
          orderBy: { date: "asc" },
          select: { groupId: true, date: true, weekNumber: true },
        })
      : [];

  const gruplarinGunleri = new Map<string, IptalGunu[]>();
  for (const oturum of oturumGunleri) {
    const liste = gruplarinGunleri.get(oturum.groupId) ?? [];
    liste.push({
      deger: tarihMetni(oturum.date),
      etiket:
        oturum.weekNumber === null
          ? `Telafi günü · ${tarihBicimle(oturum.date)}`
          : `${oturum.weekNumber}. hafta · ${tarihBicimle(oturum.date)}`,
    });
    gruplarinGunleri.set(oturum.groupId, liste);
  }

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Öğrenci kayıtları"
        aciklama="Dönem ve kulüp kayıtları burada birlikte görünür. Yeni kayıt öğrenci profilinden başlatılır."
        aksiyon={
          <Link
            href="/koordinator/ogrenciler"
            className={butonStili()}
          >
            Öğrenci seç
          </Link>
        }
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Süzgeç"
          temelYol={TEMEL_YOL}
          anahtar="suzgec"
          secenekler={[
            { deger: "tumu", etiket: "Tümü" },
            {
              deger: "atanmamis",
              etiket: `Stajyeri atanmamış (${atanmamisSayisi})`,
            },
          ]}
          secili={suzgec}
        />
      </SuzgecCubugu>

      {kayitlar.length === 0 ? (
        <BosDurum
          baslik={
            suzgec === "atanmamis"
              ? "Stajyeri atanmamış kayıt yok."
              : "Henüz öğrenci kaydı yok."
          }
          aciklama={
            suzgec === "atanmamis"
              ? "Aktif programlardaki bütün kayıtların sorumlusu var."
              : "Bir öğrenci profilini açıp dönem veya kulüp kaydı oluşturun."
          }
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
                        className={kartBasligiStili}
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
                          className={baglantiStili}
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
                      {grupZamani(kayit.group.days, kayit.group.timeSlot)}
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
                        <span className="text-vurgu-700">Atanmamış</span>
                      )}
                    </p>
                  </div>

                  <KayitDurumButonu
                    kayitId={kayit.id}
                    aktif={kayit.status === "AKTIF"}
                    gunler={gruplarinGunleri.get(kayit.groupId) ?? []}
                  />
                </div>

                {kayit.status === "IPTAL" ? (
                  <KayitIptalOzeti
                    kayit={{
                      cancelReason: kayit.cancelReason,
                      cancelNote: kayit.cancelNote,
                      lastAttendedWeek: kayit.lastAttendedWeek,
                      lastAttendedDate: kayit.lastAttendedDate,
                      tamamlananAtolye: kayit._count.scores,
                      toplamAtolye: kayit.group._count.sessions,
                    }}
                  />
                ) : null}
              </Kart>
            );
          })}
        </div>
      )}
    </div>
  );
}
