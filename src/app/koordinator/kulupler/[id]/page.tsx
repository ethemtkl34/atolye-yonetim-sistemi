import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { Kart, Rozet, SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { KULUP_DURUMLARI, KULUP_DURUM_GECISLERI } from "@/lib/durumlar";
import { kulupDurumDegistir } from "../actions";
import { kayitKapaliMesaji } from "@/lib/kayit-kurallari";
import { kontenjanDurumu } from "@/lib/kayit-kurallari";
import { grupZamani, tarihBicimle, tarihGunleBicimle } from "@/lib/tarih";
import { KULUP_ATOLYE_SAYISI } from "@/lib/kurallar";
import { GrupEylemleri } from "@/components/grup-eylemleri";
import { TopluKayitPaneli } from "@/components/toplu-kayit-paneli";
import { DurumSecici } from "@/components/durum-secici";
import { GrupEkleFormu } from "./grup-ekle-formu";

export async function generateMetadata(
  props: PageProps<"/koordinator/kulupler/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const kulup = await db.club.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: kulup?.name ?? "Kulüp" };
}

/** §5 — Kulüp detayı: atölyeler, gruplar ve durum. */
export default async function KulupDetaySayfasi(
  props: PageProps<"/koordinator/kulupler/[id]">,
) {
  const kullanici = await yonetimZorunlu("kulupler");
  const subeId = kullanici.aktifSubeId;
  const { id } = await props.params;

  // Kulübün kendisi ortak; her şube kendi gruplarını açar.
  const [kulup, subeOgrencileri] = await Promise.all([
    db.club.findUnique({
      where: { id },
      include: {
        workshops: {
          orderBy: { sortOrder: "asc" },
          include: { workshopType: { select: { name: true } } },
        },
        groups: {
          where: { branchId: subeId },
          orderBy: { createdAt: "asc" },
          include: {
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
    // Toplu ekleme paneli için şubenin öğrenci listesi ve her öğrencinin BU
    // kulüpteki aktif kayıtları.
    db.student.findMany({
      where: { branchId: subeId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        searchName: true,
        enrollments: {
          where: { status: "AKTIF", group: { clubId: id, branchId: subeId } },
          select: { group: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  if (!kulup) notFound();

  const panelGruplari = kulup.groups.map((grup) => {
    const kontenjan = kontenjanDurumu(grup.capacity, grup._count.enrollments);
    return {
      id: grup.id,
      ad: grup.name,
      zaman: grupZamani(grup.days, grup.timeSlot),
      kapasite: kontenjan.kapasite,
      doluluk: kontenjan.doluluk,
      dolu: kontenjan.dolu,
      aktif: grup.active,
    };
  });

  const panelOgrencileri = subeOgrencileri.map((ogrenci) => ({
    id: ogrenci.id,
    ad: `${ogrenci.firstName} ${ogrenci.lastName}`,
    aramaAdi: ogrenci.searchName,
    mevcutGruplar: ogrenci.enrollments.map((kayit) => ({
      id: kayit.group.id,
      ad: kayit.group.name,
    })),
  }));

  const durum = KULUP_DURUMLARI[kulup.status];

  // Eski kulüplerde `weekDates` boş kalmış olabilir; migration dolduruyor ama
  // okuma tarafı da kendini korusun.
  const gunler =
    kulup.weekDates.length > 0 ? kulup.weekDates : [kulup.date];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/kulupler"
          className={geriBaglantiStili}
        >
          ← Kulüpler
        </Link>

        <div className="mt-2">
          <SayfaBasligi
            baslik={kulup.name}
            aciklama={kulup.description ?? undefined}
            aksiyon={
              <DurumSecici
                mevcutDurum={kulup.status}
                durumlar={KULUP_DURUMLARI}
                gecisler={KULUP_DURUM_GECISLERI}
                eylem={kulupDurumDegistir.bind(null, kulup.id)}
              />
            }
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Rozet tur={durum.rozet}>{durum.etiket}</Rozet>
          {/* Kulüp artık tek gün olmak zorunda değil; kaç gün sürdüğü
              başlıkta görünüyor, günlerin kendisi aşağıda listeleniyor. */}
          <span className="text-sm text-zinc-600">
            {gunler.length === 1
              ? tarihGunleBicimle(gunler[0])
              : `${gunler.length} gün · ${tarihBicimle(gunler[0])} – ${tarihBicimle(gunler[gunler.length - 1])}`}
          </span>
        </div>
      </div>

      {gunler.length > 1 ? (
        <Kart className="p-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Kulüp takvimi
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Bu günler yeni açılan grupların başlangıç takvimidir. Grup
            açıldıktan sonra takvimi grubun kendi sayfasından düzenlenir.
          </p>
          <ol className="mt-3 grid gap-1 text-sm text-zinc-700 sm:grid-cols-2">
            {gunler.map((gun, sira) => (
              <li key={gun.toISOString()}>
                <span className="text-zinc-400">{sira + 1}.</span>{" "}
                {tarihGunleBicimle(gun)}
              </li>
            ))}
          </ol>
        </Kart>
      ) : null}

      {/* --- Atölyeler --- */}
      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Kulübün atölyeleri
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Kulüp tek yarım gün sürer; bu {kulup.workshops.length} atölye kulübün
          bütün gruplarında uygulanır.
        </p>
        <ol className="mt-3 space-y-1">
          {kulup.workshops.map((atolye, sira) => (
            <li key={atolye.id} className="flex gap-2 text-sm">
              <span className="w-5 shrink-0 tabular-nums text-zinc-400">
                {sira + 1}.
              </span>
              <span className="text-zinc-700">{atolye.workshopType.name}</span>
            </li>
          ))}
        </ol>
      </Kart>

      {/* --- Gruplar --- */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Gruplar</h2>

        {kulup.groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-marka-200 bg-white p-6 text-center text-sm text-zinc-600">
            Bu kulüpte henüz grup yok. Öğrenci kaydı alabilmek için bir grup
            ekleyin.
          </p>
        ) : null}

        {kulup.groups.map((grup) => {
          const kontenjan = kontenjanDurumu(
            grup.capacity,
            grup._count.enrollments,
          );

          return (
            <Kart key={grup.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">{grup.name}</span>
                  <span className="text-sm text-zinc-600">
                    {grupZamani(grup.days, grup.timeSlot)}
                  </span>
                  {kontenjan.dolu ? (
                    <Rozet tur="uyari">Kontenjan dolu</Rozet>
                  ) : null}
                  {grup.active ? null : <Rozet tur="pasif">Kapalı</Rozet>}
                </div>
                <GrupEylemleri
                  grupId={grup.id}
                  grupAdi={grup.name}
                  aktif={grup.active}
                  tur="kulup"
                />
              </div>

              <p className="mt-2 text-sm text-zinc-600">
                {kontenjan.doluluk} / {kontenjan.kapasite} öğrenci ·{" "}
                {grup._count.sessions} atölye oturumu
              </p>
            </Kart>
          );
        })}

        <GrupEkleFormu
          kulupId={kulup.id}
          bilgi={`Yeni grup kulübün ${gunler.length} gününde toplanır ve aynı ${KULUP_ATOLYE_SAYISI} atölyeyi kullanır. Gruplar zaman dilimiyle ayrışır; takvim sonradan grup bazında düzenlenebilir.`}
          engelSebebi={
            kulup.status !== "TASLAK" && kulup.status !== "KAYIT_ALIYOR"
              ? `Bu kulüp "${durum.etiket}" durumunda; yeni grup eklenemez.`
              : undefined
          }
        />
      </div>

      {/* --- Gruba öğrenci ekle --- */}
      <TopluKayitPaneli
        gruplar={panelGruplari}
        ogrenciler={panelOgrencileri}
        programAdi="kulüp"
        engelSebebi={
          kulup.status === "KAYIT_ALIYOR"
            ? undefined
            : kayitKapaliMesaji(kulup)
        }
      />
    </div>
  );
}
