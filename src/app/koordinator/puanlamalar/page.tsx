import type { Metadata } from "next";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { BosDurum, SayfaBasligi } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { KayitListesi } from "@/components/puanlama-ekranlari";
import { kayitIlerlemeleri } from "@/lib/puanlama-verisi";

export const metadata: Metadata = {
  title: "Puanlamalar",
};

const TEMEL_YOL = "/koordinator/puanlamalar";

/**
 * §10.5 — Koordinatör bütün puanlamaları görüntüleyip düzenleyebilir.
 *
 * Liste kayıt bazlı ilerliyor çünkü puanlama da kayıt bazlı: bir öğrencinin
 * dönem kaydı ile kulüp kaydının formları ayrı yürür. Süzgeç sıradan GET
 * bağlantılarıyla çalışır, adres satırında durur.
 */
export default async function PuanlamalarSayfasi(
  props: PageProps<"/koordinator/puanlamalar">,
) {
  const kullanici = await yonetimZorunlu("puanlamalar");

  const parametreler = await props.searchParams;
  const suzgec = parametreler.suzgec === "tumu" ? "tumu" : "eksik";
  const kapsam = parametreler.kapsam === "tumu" ? "tumu" : "aktif";

  // "Aktif" kapsamı dashboarddaki "Eksik puanlama" kartıyla aynı: hem kaydın
  // hem programın aktif olması gerekir. Arşivlenmiş bir programın bekleyen
  // formları "Tümü" kapsamında görünmeye devam eder.
  const ilerlemeler = await kayitIlerlemeleri({
    subeId: kullanici.aktifSubeId,
    yalnizcaAktif: kapsam === "aktif",
    yalnizcaAktifProgram: kapsam === "aktif",
  });

  const gosterilecek =
    suzgec === "eksik"
      ? ilerlemeler.filter((ilerleme) => ilerleme.ozet.bekleyen > 0)
      : ilerlemeler;

  const toplamBekleyen = ilerlemeler.reduce(
    (toplam, ilerleme) => toplam + ilerleme.ozet.bekleyen,
    0,
  );

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Puanlamalar"
        aciklama="Stajyerlerin doldurduğu bütün formlar burada görüntülenir ve düzenlenebilir. Yalnızca yapılmış oturumlar sayılır; gelecek haftaların formları eksik sayılmaz."
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Formlar"
          temelYol={TEMEL_YOL}
          anahtar="suzgec"
          secenekler={[
            { deger: "eksik", etiket: `Eksik olanlar (${toplamBekleyen})` },
            { deger: "tumu", etiket: "Tümü" },
          ]}
          secili={suzgec}
          digerler={{ kapsam }}
        />
        <SuzgecGrubu
          etiket="Kayıtlar"
          temelYol={TEMEL_YOL}
          anahtar="kapsam"
          secenekler={[
            { deger: "aktif", etiket: "Aktif programlar" },
            { deger: "tumu", etiket: "İptal ve arşiv dahil" },
          ]}
          secili={kapsam}
          digerler={{ suzgec }}
        />
      </SuzgecCubugu>

      {gosterilecek.length === 0 ? (
        <BosDurum
          baslik={
            suzgec === "eksik"
              ? "Eksik puanlama yok."
              : "Listelenecek kayıt yok."
          }
          aciklama={
            suzgec === "eksik"
              ? "Yapılmış bütün atölyelerin formları dolduruldu."
              : "Öğrenci kaydı oluşturulduğunda puanlama takibi burada başlar."
          }
        />
      ) : (
        <KayitListesi
          ilerlemeler={gosterilecek}
          temelYol="/koordinator/puanlamalar"
          ogrenciYolu="/koordinator/ogrenciler"
        />
      )}
    </div>
  );
}
