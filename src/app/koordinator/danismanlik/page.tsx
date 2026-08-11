import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import {
  Girdi,
  SayfaBasligi,
  baglantiStili,
  butonStili,
} from "@/components/ui";
import { SuzgecCubugu, SuzgecSecici } from "@/components/suzgec";
import { bugun, tarihMetni } from "@/lib/tarih";
import { normalizeArama, tamAd, turkceKarsilastir } from "@/lib/turkce";
import {
  TerapiGorusmeleriBolumu,
  type TerapiGorusmesiSatiri,
} from "@/components/terapi-gorusmeleri-bolumu";
import {
  TERAPI_TURLERI,
  TERAPI_TURU_SLUGLARI,
  terapiTuruSlugMu,
  type TerapiTuru,
} from "@/lib/terapi-turleri";
import { DanisanBasvurusuFormu } from "@/components/danisan-basvurusu-formu";

export const metadata: Metadata = {
  title: "Danışmanlık",
};

const TEMEL_YOL = "/koordinator/danismanlik";

/**
 * Danışmanlık — terapi görüşmeleri (oyun / danışan terapisi) ve danışan
 * başvuruları tek yerden yönetilir.
 *
 * VELİ GÖRÜŞMELERİ BURADA DEĞİL: mini test + brief akışı öğrencinin kendi
 * profilinden yürütülür (orada öğrenci zaten belli, seçici de gerekmiyor).
 * Bu ekran çok öğrencili terapi listesidir.
 *
 * Süzgeçler diğer liste ekranlarıyla aynı sözleşmede: etiketli, adres
 * satırında, paylaşılabilir (`SuzgecCubugu`); süzme sunucuda yapılır.
 * Terapi türü çip yerine açılır liste — altı uzun tür adı çip olarak süzgeç
 * çubuğunu tek başına doldururdu (`SuzgecSecici`, öğrenci süzgecindeki gibi).
 *
 * Terapi görüşmelerinin EKLEME ve SİLME işlemlerinin tek adresi burasıdır;
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
  const terapiTuruSuzgeci = terapiTuruSlugMu(parametreler.terapi)
    ? parametreler.terapi
    : "tumu";
  /**
   * Öğrenci araması — açılır seçicinin yerini aldı. Şubede yüzlerce öğrenci
   * birikince isimler arasında kaydırmak listeyi süzmenin en yavaş yolu;
   * kutu Öğrenciler sayfasındakiyle aynı sözleşmede (`q`, sıradan GET formu,
   * Türkçe karakter duyarsız `searchName` sütunu).
   */
  const aramaSorgusu =
    typeof parametreler.q === "string" ? parametreler.q.trim() : "";
  const aramaAnahtari = normalizeArama(aramaSorgusu);

  const suzgecEtkin = Boolean(aramaSorgusu) || terapiTuruSuzgeci !== "tumu";

  /**
   * Aramanın öğrenci koşuluna eklediği parça. Şube kilidi BİLEREK bu nesnenin
   * dışında, her sorgunun içinde açıkça duruyor: `sube-sizinti.test.ts` şube
   * süzgecini kaynak metninde arıyor ve değişkene saklanan kilit denetimden
   * kaçar — kuralın kendisi de "her sorguda gözle görülür olsun" diyor.
   */
  const aramaKosulu = aramaAnahtari
    ? { searchName: { contains: aramaAnahtari } }
    : {};

  /**
   * Adreste korunan süzgeç durumu — bütün süzgeçlere aynı nesne gider,
   * her süzgeç kendi anahtarını zaten üzerine yazar. Varsayılan değerler
   * adrese YAZILMAZ (`?terapi=tumu` ile parametresiz adres aynı sayfadır,
   * iki ayrı önbellek anahtarı olmasın).
   */
  const korunanlar: Record<string, string> = {
    ...(terapiTuruSuzgeci !== "tumu" ? { terapi: terapiTuruSuzgeci } : {}),
    ...(aramaSorgusu ? { q: aramaSorgusu } : {}),
  };
  const korunanlarHaric = (...haric: string[]) =>
    Object.fromEntries(
      Object.entries(korunanlar).filter(([anahtar]) => !haric.includes(anahtar)),
    );

  const [ogrenciler, gorusmeler] = await Promise.all([
    // Ekleme formlarındaki öğrenci seçici — şubenin bütün öğrencileri.
    db.student.findMany({
      where: { branchId: subeId },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.counselingSession.findMany({
      where: {
        student: { branchId: subeId, ...aramaKosulu },
        ...(terapiTuruSuzgeci !== "tumu"
          ? { therapyType: TERAPI_TURU_SLUGLARI[terapiTuruSuzgeci] }
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
      {/* Başlıkta eylem YOK: iki ekleme düğmesi de listenin başında yan yana
          duruyor (bkz. `ekAksiyon`). Başlıkta duran düğme, araya giren süzgeç
          ve arama satırları yüzünden listeden kopuyordu. */}
      <SayfaBasligi
        baslik="Danışmanlık"
        aciklama="Terapi görüşmeleri (oyun ve danışan terapisi) buradan yönetilir; bütün öğrenciler tek listede. Veli görüşmeleri öğrencinin kendi profilinden yürütülür. Bu bölüm stajyerlere hiçbir ekranda görünmez."
      />

      <SuzgecCubugu>
        {/* Açılır listede "Tümü" boş dizeyle temsil ediliyor (`SuzgecSecici`
            sözleşmesi); sayfanın "tumu" değeri kapıda çevriliyor. */}
        <SuzgecSecici
          etiket="Terapi türü"
          temelYol={TEMEL_YOL}
          anahtar="terapi"
          secili={terapiTuruSuzgeci === "tumu" ? "" : terapiTuruSuzgeci}
          digerler={korunanlarHaric("terapi")}
          secenekler={TERAPI_TURLERI.map((tur) => ({
            deger: tur.slug,
            etiket: tur.etiket,
          }))}
        />
      </SuzgecCubugu>

      {/* Arama sıradan bir GET formu (Öğrenciler sayfasındaki desen): sorgu
          adres satırında durur, sonuç paylaşılabilir. Diğer süzgeçler gizli
          alanlarla taşınır, arama yapınca sıfırlanmasınlar. */}
      <form method="get" className="flex max-w-lg gap-2">
        {Object.entries(korunanlarHaric("q")).map(([anahtar, deger]) => (
          <input key={anahtar} type="hidden" name={anahtar} value={deger} />
        ))}
        <Girdi
          name="q"
          type="search"
          defaultValue={aramaSorgusu}
          placeholder="Öğrenci adı veya soyadı"
          aria-label="Öğrenci ara"
        />
        <button type="submit" className={butonStili("ikincil", "shrink-0")}>
          Ara
        </button>
      </form>

      {aramaSorgusu ? (
        <p className="text-sm text-zinc-600">
          <span className="font-medium">{gorusmeler.length}</span> görüşme ·{" "}
          <Link
            href={
              Object.keys(korunanlarHaric("q")).length > 0
                ? `${TEMEL_YOL}?${new URLSearchParams(korunanlarHaric("q")).toString()}`
                : TEMEL_YOL
            }
            className={baglantiStili}
          >
            aramayı temizle
          </Link>
        </p>
      ) : null}

      <TerapiGorusmeleriBolumu
        mod="yonetim"
        gorusmeler={gorusmeler.map(terapiSatiri)}
        ogrenciSecenekleri={ogrenciSecenekleri}
        bugunMetni={bugunMetni}
        suzgecEtkin={suzgecEtkin}
        ekAksiyon={
          <DanisanBasvurusuFormu ogrenciSecenekleri={ogrenciSecenekleri} />
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Veritabanı satırı → bölüm bileşeninin satır tipi
// ---------------------------------------------------------------------------

type TerapiKaydi = {
  id: string;
  date: Date;
  counselorName: string;
  counselorType: "PSIKOLOG" | "KOORDINATOR";
  therapyType: TerapiTuru;
  notes: string;
  createdAt: Date;
  student: { firstName: string; lastName: string };
  createdBy: { name: string } | null;
};

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
