import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { DONEM_DURUMLARI } from "@/lib/durumlar";
import { kontenjanDurumu } from "@/lib/scoring";
import { bugun, grupZamani, haftaSonuBicimle } from "@/lib/tarih";
import { mevcutHaftaNumarasi } from "@/lib/session-generator";
import { GrupDurumButonu } from "@/components/grup-durum-butonu";
import { DurumSecici } from "./durum-secici";
import { GrupEkleFormu } from "./grup-ekle-formu";

export async function generateMetadata(
  props: PageProps<"/koordinator/donemler/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const donem = await db.term.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: donem?.name ?? "Dönem" };
}

export default async function DonemDetaySayfasi(
  props: PageProps<"/koordinator/donemler/[id]">,
) {
  await koordinatorZorunlu();
  const { id } = await props.params;

  const donem = await db.term.findUnique({
    where: { id },
    include: {
      weeks: { orderBy: { weekNumber: "asc" } },
      workshops: {
        orderBy: { sortOrder: "asc" },
        include: { workshopType: { select: { name: true } } },
      },
      groups: {
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
  });

  if (!donem) notFound();

  const durum = DONEM_DURUMLARI[donem.status];
  // Sayfadaki tahmin cumartesi çapasına göre; pazar grubu seçilirse gerçek
  // başlangıç haftası eylemde grubun gününe göre yeniden hesaplanır.
  const baslangicHaftasi = mevcutHaftaNumarasi(donem.weeks, bugun());

  // Eylemin kesin reddedeceği durumlarda buton en baştan kilitlenir ve sebep
  // ipucu olarak gösterilir; kullanıcıya formu doldurtup sonra reddetmek
  // güven kaybettirir.
  const grupEklemeEngeli =
    donem.status === "TAMAMLANDI" || donem.status === "ARSIVLENDI"
      ? `Bu dönem "${durum.etiket}" durumunda; yeni grup eklenemez.`
      : baslangicHaftasi === null
        ? "Bu dönemin bütün eğitim haftaları geçmiş; yeni grup açılsa da hiç oturumu olmaz."
        : null;

  const grupEklemeBilgisi =
    grupEklemeEngeli ??
    (baslangicHaftasi === 1
      ? `Dönem henüz başlamadı; yeni grup ${donem.weeks.length} haftanın tamamına katılır ve ${donem.weeks.length * donem.workshops.length} atölye oturumu oluşturulur.`
      : `Dönem devam ediyor. Yeni grup ${baslangicHaftasi}. haftadan başlar; geçmiş ${(baslangicHaftasi ?? 1) - 1} hafta telafi edilmez ve ${(donem.weeks.length - (baslangicHaftasi ?? 1) + 1) * donem.workshops.length} atölye oturumu oluşturulur.`);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/donemler"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Dönemler
        </Link>

        <div className="mt-2">
          <SayfaBasligi
            baslik={donem.name}
            aciklama={donem.description ?? undefined}
            aksiyon={
              <DurumSecici donemId={donem.id} mevcutDurum={donem.status} />
            }
          />
        </div>

        {/* Durum yalnızca sağdaki seçicide gösterilir; başlığın altında ikinci
            bir rozet aynı bilgiyi tekrarlıyordu. */}
      </div>

      {/* --- Atölyeler --- */}
      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Dönemin atölyeleri
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Bu {donem.workshops.length} atölye, dönemin bütün gruplarında ve
          bütün haftalarda uygulanır.
        </p>
        <ol className="mt-3 space-y-1">
          {donem.workshops.map((atolye, sira) => (
            <li key={atolye.id} className="flex gap-2 text-sm">
              <span className="w-5 shrink-0 tabular-nums text-zinc-400">
                {sira + 1}.
              </span>
              <span className="text-zinc-700">{atolye.workshopType.name}</span>
            </li>
          ))}
        </ol>
      </Kart>

      {/* --- Takvim --- */}
      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Eğitim takvimi
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {donem.weeks.length} eğitim haftası. Cumartesi grupları ilk gün,
          pazar grupları ertesi gün toplanır.
        </p>
        <ol className="mt-3 grid gap-1 sm:grid-cols-2">
          {donem.weeks.map((hafta) => {
            const gecti = hafta.date.getTime() < bugun().getTime();
            return (
              <li
                key={hafta.id}
                className={`flex gap-2 text-sm ${gecti ? "text-zinc-400" : "text-zinc-700"}`}
              >
                {/* w-16 + nowrap: "10. hafta" iki satıra kırılmasın. */}
                <span className="w-16 shrink-0 whitespace-nowrap tabular-nums text-zinc-400">
                  {hafta.weekNumber}. hafta
                </span>
                <span>{haftaSonuBicimle(hafta.date)}</span>
              </li>
            );
          })}
        </ol>
      </Kart>

      {/* --- Gruplar --- */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Gruplar</h2>

        {donem.groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-marka-200 bg-white p-6 text-center text-sm text-zinc-600">
            Bu dönemde henüz grup yok. Öğrenci kaydı alabilmek için bir grup
            ekleyin.
          </p>
        ) : null}

        {donem.groups.map((grup) => {
          const kontenjan = kontenjanDurumu(
            grup.capacity,
            grup._count.enrollments,
          );
          const gecHafta = grup.startWeekNumber > 1;

          return (
            <Kart key={grup.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">{grup.name}</span>
                  <span className="text-sm text-zinc-600">
                    {grupZamani(grup.day, grup.timeSlot)}
                  </span>
                  {kontenjan.dolu ? (
                    <Rozet tur="uyari">Kontenjan dolu</Rozet>
                  ) : null}
                  {grup.active ? null : <Rozet tur="pasif">Kapalı</Rozet>}
                </div>
                <GrupDurumButonu
                  grupId={grup.id}
                  aktif={grup.active}
                  tur="donem"
                />
              </div>

              <p className="mt-2 text-sm text-zinc-600">
                {kontenjan.doluluk} / {kontenjan.kapasite} öğrenci ·{" "}
                {grup._count.sessions} atölye oturumu
              </p>

              {gecHafta ? (
                <p className="mt-1 text-xs text-vurgu-700">
                  Dönem başladıktan sonra açıldı: {grup.startWeekNumber}.
                  haftadan itibaren katılıyor, önceki {grup.startWeekNumber - 1}{" "}
                  hafta telafi edilmiyor.
                </p>
              ) : null}
            </Kart>
          );
        })}

        <GrupEkleFormu
          donemId={donem.id}
          bilgi={grupEklemeBilgisi}
          engelSebebi={grupEklemeEngeli ?? undefined}
        />
      </div>
    </div>
  );
}
