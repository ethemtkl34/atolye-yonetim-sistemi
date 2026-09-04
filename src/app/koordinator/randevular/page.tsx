import type { Metadata } from "next";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { BosDurum, SayfaBasligi } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu, SuzgecSecici } from "@/components/suzgec";
import {
  ayMetni,
  bugun,
  gunEkle,
  tarihBicimle,
  tarihCozumle,
  tarihGunleBicimle,
  tarihMetni,
} from "@/lib/tarih";
import {
  gunlereBol,
  takvimAraligi,
  takvimKaydir,
} from "@/lib/randevu/takvim-verisi";
import { GORUNUM_ADLARI, GORUNUMLER, gorunumMu } from "./sema";
import { Takvim, type RandevuSatiri } from "./takvim";
import { RandevuFormuAcici } from "./randevu-formu";

export const metadata: Metadata = {
  title: "Randevular",
};

const TEMEL_YOL = "/koordinator/randevular";

/**
 * §17.4 — Randevu takvimi.
 *
 * Belge "günlük, haftalık ve aylık görünümlerde listelenir" diyor; görünüm
 * saat ızgarası değil GÜNE GÖRE GRUPLANMIŞ LİSTE. Gerekçe: seanslar 30–120
 * dakika arasında değişiyor ve bir günde en fazla bir düzine tane oluyor —
 * ızgara aynı bilgiyi daha az okunur ve telefonda kullanılamaz hâlde
 * gösterirdi. Randevusu olmayan günler de listede kalır; doluluk ancak
 * boşluğun görünmesiyle okunuyor.
 *
 * ŞUBE: takvim ŞUBELER ARASI okunur (§17.7) — uzmanlar iki şubede birden
 * çalışabildiği için çakışma ancak böyle görünür. Kendi şubesi dışındaki
 * randevuda danışan adı, öğrenci ve not GİZLENİR; uzman, hizmet ve saat
 * görünür. Kişisel veri sınırı eskisi gibi duruyor, görünen şey "o saat
 * dolu" bilgisi.
 *
 * Süzgeçler diğer liste ekranlarıyla aynı sözleşmede: etiketli, adres
 * satırında, paylaşılabilir; süzme sunucuda.
 */
export default async function RandevularSayfasi(
  props: PageProps<"/koordinator/randevular">,
) {
  const kullanici = await yonetimZorunlu("randevular");
  const subeId = kullanici.aktifSubeId;
  const yazabilir = kullanici.yetkiler.randevular === "TAM";

  const parametreler = await props.searchParams;

  const gorunum = gorunumMu(parametreler.gorunum) ? parametreler.gorunum : "hafta";
  const capa =
    (typeof parametreler.tarih === "string"
      ? tarihCozumle(parametreler.tarih)
      : null) ?? bugun();

  const uzmanSuzgeci =
    typeof parametreler.uzman === "string" ? parametreler.uzman : "tumu";
  const hizmetSuzgeci =
    typeof parametreler.hizmet === "string" ? parametreler.hizmet : "tumu";
  const iptalleriGoster = parametreler.iptal === "1";

  const aralik = takvimAraligi(gorunum, capa);

  const [uzmanlar, hizmetler, randevular] = await Promise.all([
    // şube-muaf: uzman kadrosu çok şubeli ve takvim şubeler arası okunuyor
    // (§17.7); şube bağı `UzmanSube` üzerinden.
    db.uzman.findMany({
      where: { aktif: true },
      orderBy: [{ sortOrder: "asc" }, { ad: "asc" }],
      select: {
        id: true,
        ad: true,
        renk: true,
        subeler: { select: { subeId: true } },
        hizmetler: { select: { hizmetId: true } },
      },
    }),
    db.hizmet.findMany({
      where: { aktif: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        ad: true,
        grup: true,
        sureDk: true,
        ucretKurus: true,
        tekrarli: true,
        danisanTuru: true,
      },
    }),
    // şube-muaf: takvim BİLEREK şubeler arası (§17.7). Kişisel veri aşağıda
    // şubeye göre ayıklanıyor; sorgunun kendisi iki şubeyi de okuyor ki
    // çift şubeli uzmanın dolu saati görünsün.
    db.randevu.findMany({
      where: {
        baslangic: { gte: aralik.ilk, lt: aralik.son },
        ...(iptalleriGoster ? { durum: "IPTAL" } : { durum: { not: "IPTAL" } }),
        ...(uzmanSuzgeci !== "tumu" ? { uzmanId: uzmanSuzgeci } : {}),
        ...(hizmetSuzgeci !== "tumu" ? { hizmetId: hizmetSuzgeci } : {}),
      },
      orderBy: { baslangic: "asc" },
      select: {
        id: true,
        branchId: true,
        baslangic: true,
        bitis: true,
        durum: true,
        ucretKurus: true,
        indirimKurus: true,
        seriId: true,
        not: true,
        iptalNotu: true,
        uzman: { select: { id: true, ad: true, renk: true } },
        hizmet: { select: { ad: true, grup: true } },
        veli: { select: { fullName: true, phone: true } },
        ogrenci: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
    }),
  ]);

  const satirlar: RandevuSatiri[] = randevular.map((randevu) => {
    const bizim = randevu.branchId === subeId;
    return {
      id: randevu.id,
      bizim,
      subeAdi: randevu.branch.name,
      baslangic: randevu.baslangic,
      bitis: randevu.bitis,
      durum: randevu.durum,
      uzmanAdi: randevu.uzman.ad,
      uzmanRengi: randevu.uzman.renk,
      hizmetAdi: randevu.hizmet.ad,
      seriDeMi: Boolean(randevu.seriId),
      // Başka şubenin randevusunda danışan bilgisi ve not GİZLİ; görünen
      // şey yalnız "o saat dolu" bilgisi (§17.7).
      veliAdi: bizim ? randevu.veli.fullName : null,
      veliTelefon: bizim ? randevu.veli.phone : null,
      ogrenciAdi:
        bizim && randevu.ogrenci
          ? `${randevu.ogrenci.firstName} ${randevu.ogrenci.lastName}`
          : null,
      not: bizim ? randevu.not : null,
      iptalNotu: bizim ? randevu.iptalNotu : null,
      ucretKurus: bizim ? randevu.ucretKurus - randevu.indirimKurus : null,
    };
  });

  const gruplar = gunlereBol(aralik, satirlar);

  /** Süzgeçler arasında adreste korunacak parametreler. */
  const korunanlar: Record<string, string> = {
    tarih: tarihMetni(capa),
    ...(uzmanSuzgeci !== "tumu" ? { uzman: uzmanSuzgeci } : {}),
    ...(hizmetSuzgeci !== "tumu" ? { hizmet: hizmetSuzgeci } : {}),
    ...(iptalleriGoster ? { iptal: "1" } : {}),
  };

  const adres = (ek: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set("gorunum", gorunum);
    p.set("tarih", tarihMetni(capa));
    if (uzmanSuzgeci !== "tumu") p.set("uzman", uzmanSuzgeci);
    if (hizmetSuzgeci !== "tumu") p.set("hizmet", hizmetSuzgeci);
    if (iptalleriGoster) p.set("iptal", "1");
    for (const [anahtar, deger] of Object.entries(ek)) {
      if (deger === "") p.delete(anahtar);
      else p.set(anahtar, deger);
    }
    return `${TEMEL_YOL}?${p.toString()}`;
  };

  // Hafta başlığı aralığın kendisini yazar ("31 Ağustos – 6 Eylül 2026"):
  // "31.08.2026 haftası" okuyucuya haftanın nerede bittiğini söylemiyordu ve
  // ay sınırını gizliyordu.
  const baslik =
    gorunum === "gun"
      ? tarihGunleBicimle(capa)
      : gorunum === "hafta"
        ? `${tarihBicimle(aralik.ilk)} – ${tarihBicimle(gunEkle(aralik.son, -1))}`
        : ayMetni(capa);

  const toplamRandevu = satirlar.length;

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Randevular"
        aciklama="Zekâ testleri ve danışmanlık seansları. Takvim iki şubeyi birlikte gösterir; danışan bilgisi yalnız kendi şubenizde açılır."
        aksiyon={
          yazabilir ? (
            <RandevuFormuAcici
              uzmanlar={uzmanlar.map((uzman) => ({
                id: uzman.id,
                ad: uzman.ad,
                renk: uzman.renk,
                buSubede: uzman.subeler.some((bag) => bag.subeId === subeId),
                hizmetIdleri: uzman.hizmetler.map((bag) => bag.hizmetId),
              }))}
              hizmetler={hizmetler}
              varsayilanTarih={tarihMetni(capa)}
            />
          ) : undefined
        }
      />

      <SuzgecCubugu>
        {/* Görünüm üç seçenek: çip. Uzman ve hizmet onlarca olabilir: açılır
            liste (öğrenci süzgecindeki ayrımın aynısı). */}
        <SuzgecGrubu
          etiket="Görünüm"
          temelYol={TEMEL_YOL}
          anahtar="gorunum"
          secili={gorunum}
          digerler={korunanlar}
          secenekler={GORUNUMLER.map((deger) => ({
            deger,
            etiket: GORUNUM_ADLARI[deger],
          }))}
        />
        <SuzgecSecici
          etiket="Uzman"
          temelYol={TEMEL_YOL}
          anahtar="uzman"
          secili={uzmanSuzgeci === "tumu" ? "" : uzmanSuzgeci}
          digerler={{ ...korunanlar, gorunum }}
          secenekler={uzmanlar.map((uzman) => ({
            deger: uzman.id,
            etiket: uzman.ad,
          }))}
        />
        <SuzgecSecici
          etiket="Hizmet"
          temelYol={TEMEL_YOL}
          anahtar="hizmet"
          secili={hizmetSuzgeci === "tumu" ? "" : hizmetSuzgeci}
          digerler={{ ...korunanlar, gorunum }}
          secenekler={hizmetler.map((hizmet) => ({
            deger: hizmet.id,
            etiket: hizmet.ad,
          }))}
        />
      </SuzgecCubugu>

      <Takvim
        baslik={baslik}
        gorunum={gorunum}
        gruplar={gruplar}
        iptalleriGoster={iptalleriGoster}
        yazabilir={yazabilir}
        toplam={toplamRandevu}
        geriYolu={adres({ tarih: tarihMetni(takvimKaydir(gorunum, capa, -1)) })}
        ileriYolu={adres({ tarih: tarihMetni(takvimKaydir(gorunum, capa, 1)) })}
        bugunYolu={adres({ tarih: tarihMetni(bugun()) })}
        iptalYolu={adres({ iptal: iptalleriGoster ? "" : "1" })}
      />

      {toplamRandevu === 0 ? (
        <BosDurum
          baslik={
            iptalleriGoster
              ? "Bu aralıkta iptal edilmiş randevu yok"
              : "Bu aralıkta randevu yok"
          }
          aciklama={
            yazabilir && !iptalleriGoster
              ? "Yeni randevu açmak için üstteki düğmeyi kullanın."
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
