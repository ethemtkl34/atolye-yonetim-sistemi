import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { bugun, grupZamani, tarihGunleBicimle, tarihMetni } from "@/lib/tarih";
import {
  TakvimDuzenleyici,
  type TakvimGunu,
} from "./takvim-duzenleyici";

export const metadata: Metadata = {
  title: "Grup takvimi",
};

/**
 * Bir grubun oturum günleri.
 *
 * Takvim GRUBA ait, programa değil: aynı dönemin iki grubu farklı günlerde
 * toplanabilir, biri bir haftayı erteleyip telafi günü açabilir, diğeri
 * etkilenmez. Program (dönem/kulüp) yalnızca başlangıç takvimini veriyor;
 * grup açıldıktan sonra takvimin sahibi grup.
 */
export default async function GrupTakvimiSayfasi(
  props: PageProps<"/koordinator/gruplar/[id]/takvim">,
) {
  const kullanici = await yonetimZorunlu("gruplar");
  const { id } = await props.params;

  const grup = await db.group.findFirst({
    where: { id, branchId: kullanici.aktifSubeId },
    select: {
      id: true,
      name: true,
      days: true,
      timeSlot: true,
      term: { select: { id: true, name: true } },
      club: { select: { id: true, name: true } },
      sessions: {
        orderBy: { date: "asc" },
        select: {
          date: true,
          // Hafta numarası oturumun kendi alanından: kulüplerin `TermWeek`
          // kaydı yok ve telafi günleri hiçbir haftaya bağlanmıyor.
          weekNumber: true,
          _count: { select: { scores: true } },
        },
      },
    },
  });

  if (!grup) notFound();

  // Oturumlar atölye atölye duruyor; ekran GÜN bazında çalışıyor çünkü
  // ertelenen ya da eklenen şey bir gün, tek bir atölye değil.
  const gunHaritasi = new Map<string, TakvimGunu>();
  const bugunkuTarih = bugun();

  for (const oturum of grup.sessions) {
    const anahtar = tarihMetni(oturum.date);
    const mevcut = gunHaritasi.get(anahtar);

    if (mevcut) {
      mevcut.atolyeSayisi += 1;
      mevcut.puanlamaSayisi += oturum._count.scores;
      continue;
    }

    gunHaritasi.set(anahtar, {
      anahtar,
      gosterim: tarihGunleBicimle(oturum.date),
      haftaNumarasi: oturum.weekNumber,
      atolyeSayisi: 1,
      puanlamaSayisi: oturum._count.scores,
      gecmis: oturum.date.getTime() < bugunkuTarih.getTime(),
    });
  }

  const gunler = [...gunHaritasi.values()];
  const program = grup.term ?? grup.club;
  const programYolu = grup.term
    ? `/koordinator/donemler/${grup.term.id}`
    : `/koordinator/kulupler/${grup.club?.id}`;

  const puanlanmisGunSayisi = gunler.filter(
    (gun) => gun.puanlamaSayisi > 0,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={programYolu} className={geriBaglantiStili}>
          ← {program?.name ?? "Program"}
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={`${grup.name} · takvim`}
            aciklama={`${grupZamani(grup.days, grup.timeSlot)} · ${gunler.length} gün · ${grup.sessions.length} atölye oturumu. Takvim bu gruba aittir; buradaki değişiklik aynı programın diğer gruplarını etkilemez.`}
          />
        </div>
      </div>

      {puanlanmisGunSayisi > 0 ? (
        <p className="rounded-md bg-marka-50 px-3 py-2 text-sm text-marka-700">
          {puanlanmisGunSayisi} günde puanlama girilmiş. Bu günlerin tarihi
          değiştirilebilir — puanlamalar oturuma bağlı olduğu için birlikte
          taşınır — ama gün silinemez.
        </p>
      ) : null}

      <TakvimDuzenleyici grupId={grup.id} gunler={gunler} />
    </div>
  );
}
