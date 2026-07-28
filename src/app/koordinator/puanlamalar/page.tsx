import type { Metadata } from "next";
import Link from "next/link";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, SayfaBasligi } from "@/components/ui";
import { KayitListesi } from "@/components/puanlama-ekranlari";
import { kayitIlerlemeleri } from "@/lib/puanlama-verisi";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Puanlamalar",
};

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
  await koordinatorZorunlu();

  const parametreler = await props.searchParams;
  const suzgec = parametreler.suzgec === "tumu" ? "tumu" : "eksik";
  const kapsam = parametreler.kapsam === "tumu" ? "tumu" : "aktif";

  const ilerlemeler = await kayitIlerlemeleri({
    yalnizcaAktif: kapsam === "aktif",
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

      <Kart className="flex flex-wrap items-center gap-4 p-3">
        <SuzgecGrubu
          etiket="Formlar"
          secenekler={[
            { deger: "eksik", etiket: `Eksik olanlar (${toplamBekleyen})` },
            { deger: "tumu", etiket: "Tümü" },
          ]}
          secili={suzgec}
          anahtar="suzgec"
          digerler={{ kapsam }}
        />
        <SuzgecGrubu
          etiket="Kayıtlar"
          secenekler={[
            { deger: "aktif", etiket: "Aktif" },
            { deger: "tumu", etiket: "İptaller dahil" },
          ]}
          secili={kapsam}
          anahtar="kapsam"
          digerler={{ suzgec }}
        />
      </Kart>

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

function SuzgecGrubu({
  etiket,
  secenekler,
  secili,
  anahtar,
  digerler,
}: {
  etiket: string;
  secenekler: { deger: string; etiket: string }[];
  secili: string;
  anahtar: string;
  digerler: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-500">{etiket}:</span>
      <div className="flex flex-wrap gap-1">
        {secenekler.map((secenek) => {
          const parametreler = new URLSearchParams({
            ...digerler,
            [anahtar]: secenek.deger,
          });

          return (
            <Link
              key={secenek.deger}
              href={`/koordinator/puanlamalar?${parametreler.toString()}`}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm",
                secili === secenek.deger
                  ? "bg-marka-50 font-medium text-marka-700"
                  : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              {secenek.etiket}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
