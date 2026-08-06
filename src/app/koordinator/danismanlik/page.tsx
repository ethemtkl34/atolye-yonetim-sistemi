import type { Metadata } from "next";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { SayfaBasligi } from "@/components/ui";
import { bugun, tarihMetni } from "@/lib/tarih";
import { tamAd, turkceKarsilastir } from "@/lib/turkce";
import {
  TerapiGorusmeleriBolumu,
  type TerapiGorusmesiSatiri,
} from "@/components/terapi-gorusmeleri-bolumu";
import {
  VeliGorusmeleriBolumu,
  type VeliGorusmesiSatiri,
} from "@/components/veli-gorusmeleri-bolumu";
import type { MiniTestCevabi, VeliBriefi } from "@/lib/veli-gorusmesi";

export const metadata: Metadata = {
  title: "Danışmanlık",
};

/**
 * Danışmanlık — veli görüşmeleri (mini test + brief) ve terapi görüşmeleri
 * (oyun / danışan terapisi) tek yerden yönetilir.
 *
 * Görüşmelerin EKLEME, SİLME ve NOT işlemlerinin tek adresi burasıdır;
 * öğrenci profili aynı kayıtları yalnızca gösterir. Psikolog haftalık akışı
 * tek listeden görür, öğrenci profilinde gezinmek zorunda kalmaz.
 *
 * GİZLİLİK: Görüşmeler sağlık bilgisi kuralına tabidir — sayfa yalnızca
 * koordinatör/yönetici rolüne açıktır, stajyer sorgularına hiç girmez.
 */
export default async function DanismanlikSayfasi() {
  const kullanici = await yonetimZorunlu("danismanlik");
  const subeId = kullanici.aktifSubeId;

  const [ogrenciler, veliKayitlari, terapiKayitlari] = await Promise.all([
    // Ekleme formlarındaki öğrenci seçici — şubenin bütün öğrencileri.
    db.student.findMany({
      where: { branchId: subeId },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.parentMeeting.findMany({
      where: { student: { branchId: subeId } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        student: { select: { firstName: true, lastName: true } },
        createdBy: { select: { name: true } },
      },
    }),
    db.counselingSession.findMany({
      where: { student: { branchId: subeId } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        student: { select: { firstName: true, lastName: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  // Prisma'nın sıralaması Türkçe harfleri bilmez; seçici listesi burada
  // sıralanır ("Çınar" C'den sonra gelsin).
  const ogrenciSecenekleri = ogrenciler
    .map((ogrenci) => ({
      id: ogrenci.id,
      ad: tamAd(ogrenci.firstName, ogrenci.lastName),
    }))
    .sort((a, b) => turkceKarsilastir(a.ad, b.ad));

  const veliGorusmeleri: VeliGorusmesiSatiri[] = veliKayitlari.map(
    (gorusme) => ({
      id: gorusme.id,
      ogrenciId: gorusme.studentId,
      ogrenciAdi: tamAd(gorusme.student.firstName, gorusme.student.lastName),
      tarih: gorusme.date,
      gorusmeciAdi: gorusme.interviewerName,
      cevaplar: gorusme.answersJson as unknown as MiniTestCevabi[],
      brief: gorusme.briefJson as unknown as VeliBriefi,
      not: gorusme.note,
      notGuncellemeZamani: gorusme.noteUpdatedAt,
      ekleyen: gorusme.createdBy?.name ?? null,
      eklenmeTarihi: gorusme.createdAt,
    }),
  );

  const terapiGorusmeleri: TerapiGorusmesiSatiri[] = terapiKayitlari.map(
    (gorusme) => ({
      id: gorusme.id,
      ogrenciId: gorusme.studentId,
      ogrenciAdi: tamAd(gorusme.student.firstName, gorusme.student.lastName),
      tarih: gorusme.date,
      gorusmeciAdi: gorusme.counselorName,
      tur: gorusme.counselorType,
      terapiTuru: gorusme.therapyType,
      not: gorusme.notes,
      ekleyen: gorusme.createdBy?.name ?? null,
      eklenmeTarihi: gorusme.createdAt,
    }),
  );

  const bugunMetni = tarihMetni(bugun());

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Danışmanlık"
        aciklama="Veli görüşmeleri ve terapi görüşmeleri buradan yönetilir; öğrenci profili kayıtları yalnızca gösterir. Bu bölüm stajyerlere hiçbir ekranda görünmez."
      />

      <VeliGorusmeleriBolumu
        mod="yonetim"
        gorusmeler={veliGorusmeleri}
        ogrenciSecenekleri={ogrenciSecenekleri}
        bugunMetni={bugunMetni}
      />

      <TerapiGorusmeleriBolumu
        mod="yonetim"
        gorusmeler={terapiGorusmeleri}
        ogrenciSecenekleri={ogrenciSecenekleri}
        bugunMetni={bugunMetni}
      />
    </div>
  );
}
