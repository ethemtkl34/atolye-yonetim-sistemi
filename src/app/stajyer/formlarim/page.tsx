import type { Metadata } from "next";
import Link from "next/link";
import { stajyerZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, baglantiStili } from "@/components/ui";
import { SuzgecCubugu, SuzgecSecici } from "@/components/suzgec";
import { turkceKarsilastir } from "@/lib/turkce";
import { doldurulmusFormlar } from "@/lib/puanlama-verisi";
import { ortalamaBicimle } from "@/lib/scoring";
import { tarihGunleBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Doldurduğum formlar",
};

/**
 * §12.3 — Stajyerin daha önce doldurduğu formlar.
 * §10.5 — Son tarih yok; her form buradan yeniden açılıp düzenlenebilir.
 */
export default async function FormlarimSayfasi(
  props: PageProps<"/stajyer/formlarim">,
) {
  const kullanici = await stajyerZorunlu();

  const parametreler = await props.searchParams;
  const ogrenciSuzgeci =
    typeof parametreler.ogrenci === "string" ? parametreler.ogrenci : "";

  const butunFormlar = await doldurulmusFormlar({
    subeId: kullanici.aktifSubeId,
    internId: kullanici.id,
    enFazla: 100,
  });

  // Süzgeç seçenekleri stajyerin gerçekten form doldurduğu öğrenciler;
  // liste zaten elimizde, ikinci bir sorguya gerek yok.
  const ogrenciSecenekleri = [
    ...new Set(butunFormlar.map((form) => form.ogrenciAdi)),
  ].sort(turkceKarsilastir);

  const formlar = ogrenciSuzgeci
    ? butunFormlar.filter((form) => form.ogrenciAdi === ogrenciSuzgeci)
    : butunFormlar;

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Doldurduğum formlar"
        aciklama="En son güncellenen form başta. Girdiğiniz puanlamaları istediğiniz zaman düzenleyebilirsiniz."
      />

      {ogrenciSecenekleri.length > 0 ? (
        <SuzgecCubugu>
          <SuzgecSecici
            etiket="Öğrenci"
            temelYol="/stajyer/formlarim"
            anahtar="ogrenci"
            secili={ogrenciSuzgeci}
            secenekler={ogrenciSecenekleri.map((ad) => ({
              deger: ad,
              etiket: ad,
            }))}
          />
        </SuzgecCubugu>
      ) : null}

      {formlar.length === 0 ? (
        ogrenciSuzgeci ? (
          <BosDurum
            baslik="Süzgece uyan form yok."
            aciklama="Üstteki süzgeci değiştirin."
          />
        ) : (
          <BosDurum
            baslik="Henüz doldurduğunuz form yok."
            aciklama="Bir atölye formunu kaydettiğinizde burada listelenir."
          />
        )
      ) : (
        <Kart className="divide-y divide-yuzey-100">
          {formlar.map((form) => (
            <div
              key={`${form.kayitId}-${form.oturumId}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-zinc-800">
                  {form.ogrenciAdi} · {form.atolyeAdi}
                </p>
                <p className="text-xs text-zinc-500">
                  {tarihGunleBicimle(form.tarih)} · {form.program}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {form.attended ? (
                  <span className="text-sm text-zinc-700">
                    Ortalama {ortalamaBicimle(form.ortalama)}
                  </span>
                ) : (
                  <Rozet tur="pasif">Katılmadı</Rozet>
                )}
                <Link
                  href={`/stajyer/puanlama/${form.kayitId}/${form.tarihAnahtari}`}
                  className={baglantiStili}
                >
                  Düzenle
                </Link>
              </div>
            </div>
          ))}
        </Kart>
      )}
    </div>
  );
}
