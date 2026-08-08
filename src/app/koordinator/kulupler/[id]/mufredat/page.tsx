import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { Bildirim, SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { tarihGunleBicimle } from "@/lib/tarih";
import { MufredatEditoru } from "@/app/koordinator/mufredat/mufredat-editoru";

export async function generateMetadata(
  props: PageProps<"/koordinator/kulupler/[id]/mufredat">,
): Promise<Metadata> {
  const { id } = await props.params;
  const kulup = await db.club.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: kulup ? `Müfredat — ${kulup.name}` : "Müfredat" };
}

/**
 * Kulübün müfredatı — dönemdekiyle aynı editör; hafta yerine kulübün
 * toplanma günleri listelenir (hafta numarası = `weekDates` dizisindeki sıra).
 */
export default async function KulupMufredatSayfasi(
  props: PageProps<"/koordinator/kulupler/[id]/mufredat">,
) {
  const kullanici = await yonetimZorunlu("mufredat");
  const { id } = await props.params;

  // Kulüp ve müfredatı ortak (şubeden bağımsız); şube süzgeci bilerek yok.
  const kulup = await db.club.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      date: true,
      weekDates: true,
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

  if (!kulup) notFound();

  // Eski kulüplerde `weekDates` boş kalmış olabilir (detay sayfasındaki
  // korumanın aynısı).
  const gunler = kulup.weekDates.length > 0 ? kulup.weekDates : [kulup.date];

  const kilitli =
    kulup.status === "ARSIVLENDI" || kulup.status === "IPTAL_EDILDI";
  const duzenlenebilir = !kilitli && kullanici.yetkiler.mufredat === "TAM";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/koordinator/kulupler/${kulup.id}`}
          className={geriBaglantiStili}
        >
          ← {kulup.name}
        </Link>

        <div className="mt-2">
          <SayfaBasligi
            baslik="Müfredat ve öğretmenler"
            aciklama="Her atölyenin öğretmeni ve gün gün işlenen konular. Konu önceden planlanabilir ya da ders işlendikten sonra kaydedilebilir; stajyerler puanlama ekranında o günün konusunu görür."
          />
        </div>
      </div>

      {kilitli ? (
        <Bildirim tur="bilgi">
          Bu kulüp {kulup.status === "ARSIVLENDI" ? "arşivlenmiş" : "iptal edilmiş"};
          müfredat yalnızca görüntülenebilir.
        </Bildirim>
      ) : null}

      <MufredatEditoru
        hedef={{ tur: "kulup", id: kulup.id }}
        atolyeler={kulup.workshops.map((atolye) => ({
          programAtolyeId: atolye.id,
          atolyeTipiId: atolye.workshopTypeId,
          ad: atolye.workshopType.name,
          ogretmenAdi: atolye.teacherName,
        }))}
        haftalar={gunler.map((gun, sira) => ({
          numara: sira + 1,
          etiket: `${sira + 1}. gün · ${tarihGunleBicimle(gun)}`,
        }))}
        girdiler={kulup.curriculumEntries.map((girdi) => ({
          id: girdi.id,
          haftaNo: girdi.weekNumber,
          atolyeTipiId: girdi.workshopTypeId,
          baslik: girdi.title,
          aciklama: girdi.description,
        }))}
        duzenlenebilir={duzenlenebilir}
        birim="gün"
      />
    </div>
  );
}
