import type { Metadata } from "next";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { SayfaBasligi } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu, SuzgecSecici } from "@/components/suzgec";
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

const TEMEL_YOL = "/koordinator/danismanlik";

/** Adresteki terapi türü slug'ı → veritabanı enum değeri. */
const TERAPI_TURU_SORGULARI = {
  oyun: "OYUN_TERAPISI",
  danisan: "DANISAN_TERAPISI",
} as const;

/** Tür seçimine göre alt süzgecin tanımı — iki ikiz JSX bloğu yerine veri. */
const ALT_SUZGECLER = {
  veli: {
    etiket: "Durum",
    anahtar: "durum",
    secenekler: [
      { deger: "tumu", etiket: "Tümü" },
      { deger: "bekliyor", etiket: "Not bekliyor" },
      { deger: "tamamlandi", etiket: "Tamamlandı" },
    ],
  },
  terapi: {
    etiket: "Terapi türü",
    anahtar: "terapi",
    secenekler: [
      { deger: "tumu", etiket: "Tümü" },
      { deger: "oyun", etiket: "Oyun terapisi" },
      { deger: "danisan", etiket: "Danışan terapisi" },
    ],
  },
} as const;

/**
 * Danışmanlık — veli görüşmeleri (mini test + brief) ve terapi görüşmeleri
 * (oyun / danışan terapisi) tek yerden yönetilir.
 *
 * Ekran TEK liste gösterir: "Görüşme türü" süzgeci sekme gibi çalışır ve
 * yalnızca seçili türün kayıtları sorgulanır. Süzgeçler diğer liste
 * ekranlarıyla aynı sözleşmede: etiketli, adres satırında, paylaşılabilir
 * (`SuzgecCubugu`); süzme sunucuda yapılır.
 *
 * Görüşmelerin EKLEME, SİLME ve NOT işlemlerinin tek adresi burasıdır;
 * öğrenci profili aynı kayıtları yalnızca gösterir.
 *
 * GİZLİLİK: Görüşmeler sağlık bilgisi kuralına tabidir — stajyer sorgularına
 * hiç girmez; danışma görevlisinin de bu modülde yetkisi yoktur.
 */
export default async function DanismanlikSayfasi(
  props: PageProps<"/koordinator/danismanlik">,
) {
  const kullanici = await yonetimZorunlu("danismanlik");
  const subeId = kullanici.aktifSubeId;

  const parametreler = await props.searchParams;
  const turSuzgeci = parametreler.tur === "terapi" ? "terapi" : "veli";
  const durumSuzgeci =
    parametreler.durum === "bekliyor" || parametreler.durum === "tamamlandi"
      ? parametreler.durum
      : "tumu";
  const terapiTuruSuzgeci =
    parametreler.terapi === "oyun" || parametreler.terapi === "danisan"
      ? parametreler.terapi
      : "tumu";
  const ogrenciSuzgeci =
    typeof parametreler.ogrenci === "string" ? parametreler.ogrenci : "";

  const altSuzgec = ALT_SUZGECLER[turSuzgeci];
  const altDeger = turSuzgeci === "veli" ? durumSuzgeci : terapiTuruSuzgeci;
  const suzgecEtkin = Boolean(ogrenciSuzgeci) || altDeger !== "tumu";

  /**
   * Adreste korunan süzgeç durumu — bütün süzgeçlere aynı nesne gider,
   * her süzgeç kendi anahtarını zaten üzerine yazar. Varsayılan değerler
   * adrese YAZILMAZ (`?durum=tumu` ile parametresiz adres aynı sayfadır,
   * iki ayrı önbellek anahtarı olmasın). Tür değiştiren bağlantı diğer
   * türün alt süzgecini taşımaz; o süzgeç türle birlikte sıfırlanır.
   */
  const korunanlar: Record<string, string> = {
    ...(turSuzgeci !== "veli" ? { tur: turSuzgeci } : {}),
    ...(altDeger !== "tumu" ? { [altSuzgec.anahtar]: altDeger } : {}),
    ...(ogrenciSuzgeci ? { ogrenci: ogrenciSuzgeci } : {}),
  };
  const korunanlarHaric = (...haric: string[]) =>
    Object.fromEntries(
      Object.entries(korunanlar).filter(([anahtar]) => !haric.includes(anahtar)),
    );

  // Yalnızca gösterilen türün kayıtları çekilir — diğer sekmenin sorgusu
  // (veli tarafında brief/mini-test JSON'ları dahil) boşa koşturulmaz.
  const [ogrenciler, kayitlar] = await Promise.all([
    // Ekleme formlarındaki öğrenci seçici — şubenin bütün öğrencileri.
    db.student.findMany({
      where: { branchId: subeId },
      select: { id: true, firstName: true, lastName: true },
    }),
    turSuzgeci === "veli"
      ? db.parentMeeting.findMany({
          where: {
            student: { branchId: subeId },
            ...(ogrenciSuzgeci ? { studentId: ogrenciSuzgeci } : {}),
            ...(durumSuzgeci !== "tumu"
              ? { note: durumSuzgeci === "bekliyor" ? null : { not: null } }
              : {}),
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          include: {
            student: { select: { firstName: true, lastName: true } },
            createdBy: { select: { name: true } },
          },
        })
      : db.counselingSession.findMany({
          where: {
            student: { branchId: subeId },
            ...(ogrenciSuzgeci ? { studentId: ogrenciSuzgeci } : {}),
            ...(terapiTuruSuzgeci !== "tumu"
              ? { therapyType: TERAPI_TURU_SORGULARI[terapiTuruSuzgeci] }
              : {}),
          },
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

  const bugunMetni = tarihMetni(bugun());

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Danışmanlık"
        aciklama="Veli görüşmeleri (mini test + görüşme brief'i) ve terapi görüşmeleri (oyun / danışan) buradan yönetilir; öğrenci profili kayıtları yalnızca gösterir. Bu bölüm stajyerlere hiçbir ekranda görünmez."
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Görüşme türü"
          temelYol={TEMEL_YOL}
          anahtar="tur"
          secili={turSuzgeci}
          digerler={korunanlarHaric("tur", "durum", "terapi")}
          secenekler={[
            { deger: "veli", etiket: "Veli görüşmeleri" },
            { deger: "terapi", etiket: "Terapi görüşmeleri" },
          ]}
        />
        <SuzgecGrubu
          etiket={altSuzgec.etiket}
          temelYol={TEMEL_YOL}
          anahtar={altSuzgec.anahtar}
          secili={altDeger}
          digerler={korunanlarHaric(altSuzgec.anahtar)}
          secenekler={altSuzgec.secenekler}
        />
        <SuzgecSecici
          etiket="Öğrenci"
          temelYol={TEMEL_YOL}
          anahtar="ogrenci"
          secili={ogrenciSuzgeci}
          secenekler={ogrenciSecenekleri.map((ogrenci) => ({
            deger: ogrenci.id,
            etiket: ogrenci.ad,
          }))}
          digerler={korunanlarHaric("ogrenci")}
        />
      </SuzgecCubugu>

      {turSuzgeci === "veli" ? (
        <VeliGorusmeleriBolumu
          mod="yonetim"
          gorusmeler={(kayitlar as VeliKaydi[]).map(veliSatiri)}
          ogrenciSecenekleri={ogrenciSecenekleri}
          bugunMetni={bugunMetni}
          suzgecEtkin={suzgecEtkin}
        />
      ) : (
        <TerapiGorusmeleriBolumu
          mod="yonetim"
          gorusmeler={(kayitlar as TerapiKaydi[]).map(terapiSatiri)}
          ogrenciSecenekleri={ogrenciSecenekleri}
          bugunMetni={bugunMetni}
          suzgecEtkin={suzgecEtkin}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Veritabanı satırı → bölüm bileşeninin satır tipi
// ---------------------------------------------------------------------------

type OrtakIliskiler = {
  student: { firstName: string; lastName: string };
  createdBy: { name: string } | null;
};

type VeliKaydi = OrtakIliskiler & {
  id: string;
  date: Date;
  interviewerName: string;
  answersJson: unknown;
  briefJson: unknown;
  note: string | null;
  noteUpdatedAt: Date | null;
  createdAt: Date;
};

type TerapiKaydi = OrtakIliskiler & {
  id: string;
  date: Date;
  counselorName: string;
  counselorType: "PSIKOLOG" | "KOORDINATOR";
  therapyType: "OYUN_TERAPISI" | "DANISAN_TERAPISI";
  notes: string;
  createdAt: Date;
};

function veliSatiri(gorusme: VeliKaydi): VeliGorusmesiSatiri {
  return {
    id: gorusme.id,
    ogrenciAdi: tamAd(gorusme.student.firstName, gorusme.student.lastName),
    tarih: gorusme.date,
    gorusmeciAdi: gorusme.interviewerName,
    cevaplar: gorusme.answersJson as MiniTestCevabi[],
    brief: gorusme.briefJson as VeliBriefi,
    not: gorusme.note,
    notGuncellemeZamani: gorusme.noteUpdatedAt,
    ekleyen: gorusme.createdBy?.name ?? null,
    eklenmeTarihi: gorusme.createdAt,
  };
}

function terapiSatiri(gorusme: TerapiKaydi): TerapiGorusmesiSatiri {
  return {
    id: gorusme.id,
    ogrenciAdi: tamAd(gorusme.student.firstName, gorusme.student.lastName),
    tarih: gorusme.date,
    gorusmeciAdi: gorusme.counselorName,
    tur: gorusme.counselorType,
    terapiTuru: gorusme.therapyType,
    not: gorusme.notes,
    ekleyen: gorusme.createdBy?.name ?? null,
    eklenmeTarihi: gorusme.createdAt,
  };
}
