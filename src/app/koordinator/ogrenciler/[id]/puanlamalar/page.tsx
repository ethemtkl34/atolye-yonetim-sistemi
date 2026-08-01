import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, geriBaglantiStili, kartBasligiStili } from "@/components/ui";
import { IlerlemeCubugu } from "@/components/puanlama-ekranlari";
import { kayitIlerlemeleri } from "@/lib/puanlama-verisi";
import { tarihBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Puanlama geçmişi",
};

/**
 * §6.3.8 — Öğrencinin kayıt bazlı puanlama ilerlemesi.
 *
 * Önceden profil sayfasının içinde liste olarak duruyordu; profil
 * sadeleştirilirken kendi sayfasına taşındı. Profildeki "Puanlama geçmişi"
 * kartı buraya gelir.
 */
export default async function OgrenciPuanlamalariSayfasi(
  props: PageProps<"/koordinator/ogrenciler/[id]/puanlamalar">,
) {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;
  const { id } = await props.params;

  const ogrenci = await db.student.findFirst({
    where: { id, branchId: subeId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!ogrenci) notFound();

  const ilerlemeler = await kayitIlerlemeleri({ subeId, studentId: id });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/koordinator/ogrenciler/${ogrenci.id}`}
          className={geriBaglantiStili}
        >
          ← {ogrenci.firstName} {ogrenci.lastName}
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik="Puanlama geçmişi"
            aciklama="Öğrencinin her kaydındaki form ilerlemesi. Günlere ve formlara inmek için kayda tıklayın."
          />
        </div>
      </div>

      {ilerlemeler.length === 0 ? (
        <BosDurum baslik="Kayıt oluşturulduğunda puanlama takibi başlar." />
      ) : (
        <div className="space-y-2">
          {ilerlemeler.map((ilerleme) => (
            <Kart key={ilerleme.kayit.id} className="p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_16rem] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/koordinator/puanlamalar/${ilerleme.kayit.id}`}
                      className={kartBasligiStili}
                    >
                      {ilerleme.kayit.program} · {ilerleme.kayit.grupAdi}
                    </Link>
                    <Rozet>{ilerleme.kayit.programTuru}</Rozet>
                    {ilerleme.kayit.aktif ? null : (
                      <Rozet tur="pasif">İptal</Rozet>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Sorumlu stajyer: {ilerleme.kayit.stajyerAdi ?? "Atanmamış"}
                    {ilerleme.sonPuanlama
                      ? ` · Son puanlama ${tarihBicimle(ilerleme.sonPuanlama)}`
                      : " · Henüz puanlama girilmedi"}
                  </p>
                </div>
                <IlerlemeCubugu ozet={ilerleme.ozet} />
              </div>
            </Kart>
          ))}
        </div>
      )}
    </div>
  );
}
