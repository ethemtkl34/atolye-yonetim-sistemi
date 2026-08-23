import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { Bildirim, SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { haftaBicimle } from "@/lib/tarih";
import { MufredatEditoru } from "@/app/koordinator/mufredat/mufredat-editoru";
import { AtolyeIcerikleri } from "@/app/koordinator/mufredat/atolye-icerikleri";
import { atolyeIcerikleriniOku } from "@/app/koordinator/mufredat/atolye-icerik-eylemleri";

export async function generateMetadata(
  props: PageProps<"/koordinator/donemler/[id]/mufredat">,
): Promise<Metadata> {
  const { id } = await props.params;
  const donem = await db.term.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: donem ? `Müfredat — ${donem.name}` : "Müfredat" };
}

/**
 * Dönemin haftalık müfredatı: her atölyenin öğretmeni ve hafta hafta işlenen
 * konular. Ayrı sayfa — dönem detayı zaten beş bölüm taşıyor, hafta × atölye
 * editörü oraya sığmazdı.
 */
export default async function DonemMufredatSayfasi(
  props: PageProps<"/koordinator/donemler/[id]/mufredat">,
) {
  const kullanici = await yonetimZorunlu("mufredat");
  const { id } = await props.params;

  // Dönem ve müfredatı ortak (şubeden bağımsız): iki şube aynı programı aynı
  // müfredatla uygular, şube süzgeci bilerek yok.
  const donem = await db.term.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      gecmisVerisi: true,
      dayMode: true,
      weeks: {
        orderBy: { weekNumber: "asc" },
        select: { weekNumber: true, date: true },
      },
      workshops: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          workshopTypeId: true,
          teacherName: true,
          workshopType: { select: { name: true } },
        },
      },
      curriculumEntries: {
        select: {
          id: true,
          weekNumber: true,
          workshopTypeId: true,
          title: true,
          description: true,
        },
      },
    },
  });

  if (!donem) notFound();

  const icerikler = await atolyeIcerikleriniOku({ tur: "donem", id: donem.id });

  const arsivli = donem.status === "ARSIVLENDI";
  const duzenlenebilir = !arsivli && kullanici.yetkiler.mufredat === "TAM";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/koordinator/donemler/${donem.id}`}
          className={geriBaglantiStili}
        >
          ← {donem.name}
        </Link>

        <div className="mt-2">
          <SayfaBasligi
            baslik="Müfredat ve öğretmenler"
            aciklama="Her atölyenin öğretmeni ve hafta hafta işlenen konular. Konu önceden planlanabilir ya da ders işlendikten sonra kaydedilebilir; stajyerler puanlama ekranında o haftanın konusunu görür."
          />
        </div>
      </div>

      {donem.gecmisVerisi ? (
        <Bildirim tur="bilgi">
          Bu dönem panel açılmadan önce yaşandı ve kütükten aktarıldı.
          Puanlaması ve müfredatı hiç girilmedi; bu yüzden burada gösterilecek
          bir şey yok ve sistem bu dönem için rapor üretemez. Öğrencilerin
          o dönemki raporları profillerindeki “Arşiv raporları” bölümündedir.
        </Bildirim>
      ) : arsivli ? (
        <Bildirim tur="bilgi">
          Bu dönem arşivlenmiş; müfredat yalnızca görüntülenebilir.
        </Bildirim>
      ) : null}

      <MufredatEditoru
        hedef={{ tur: "donem", id: donem.id }}
        atolyeler={donem.workshops.map((atolye) => ({
          programAtolyeId: atolye.id,
          atolyeTipiId: atolye.workshopTypeId,
          ad: atolye.workshopType.name,
          ogretmenAdi: atolye.teacherName,
        }))}
        haftalar={donem.weeks.map((hafta) => ({
          numara: hafta.weekNumber,
          etiket: `${hafta.weekNumber}. hafta · ${haftaBicimle(hafta.date, donem.dayMode)}`,
        }))}
        girdiler={donem.curriculumEntries.map((girdi) => ({
          id: girdi.id,
          haftaNo: girdi.weekNumber,
          atolyeTipiId: girdi.workshopTypeId,
          baslik: girdi.title,
          aciklama: girdi.description,
        }))}
        duzenlenebilir={duzenlenebilir}
        birim="hafta"
      />

      <AtolyeIcerikleri
        hedef={{ tur: "donem", id: donem.id }}
        atolyeler={donem.workshops.map((atolye) => ({
          atolyeTipiId: atolye.workshopTypeId,
          ad: atolye.workshopType.name,
        }))}
        kayitlar={icerikler}
        duzenlenebilir={duzenlenebilir}
      />
    </div>
  );
}
