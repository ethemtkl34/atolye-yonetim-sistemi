import type { Metadata } from "next";
import Link from "next/link";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, butonStili } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { raporOzetleri, RAPOR_LISTE_SINIRI } from "@/lib/rapor-verisi";
import { tarihBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Raporlar",
};

const TEMEL_YOL = "/koordinator/raporlar";

/**
 * §11 — Üretilmiş bütün raporlar.
 *
 * "Güncel değil" rozeti saklanan bir alandan değil, okuma anında puanların
 * son güncelleme zamanıyla karşılaştırmadan çıkar (§13.16).
 */
export default async function RaporlarSayfasi(
  props: PageProps<"/koordinator/raporlar">,
) {
  await koordinatorZorunlu();

  const parametreler = await props.searchParams;
  const suzgec = parametreler.suzgec === "eski" ? "eski" : "tumu";

  const raporlar = await raporOzetleri({});
  const guncelOlmayanlar = raporlar.filter((rapor) => !rapor.guncel);
  const gosterilecek = suzgec === "eski" ? guncelOlmayanlar : raporlar;

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Raporlar"
        aciklama="Rapor istenildiği anda mevcut puanlardan üretilir. Puanlar sonradan değişirse rapor “Güncel değil” olarak işaretlenir; yeniden üretmek eski raporu ve PDF’lerini silmez."
        aksiyon={
          <Link href="/koordinator/raporlar/yeni" className={butonStili()}>
            Yeni rapor
          </Link>
        }
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Durum"
          temelYol={TEMEL_YOL}
          anahtar="suzgec"
          secenekler={[
            { deger: "tumu", etiket: `Tümü (${raporlar.length})` },
            {
              deger: "eski",
              etiket: `Güncelliğini yitirenler (${guncelOlmayanlar.length})`,
            },
          ]}
          secili={suzgec}
        />
      </SuzgecCubugu>

      {raporlar.length === RAPOR_LISTE_SINIRI ? (
        <p className="text-sm text-vurgu-700">
          En yeni {RAPOR_LISTE_SINIRI} rapor gösteriliyor. Daha eskileri
          öğrenci profilinden görebilirsiniz.
        </p>
      ) : null}

      {gosterilecek.length === 0 ? (
        <BosDurum
          baslik={
            suzgec === "eski"
              ? "Güncelliğini yitiren rapor yok."
              : "Henüz rapor üretilmemiş."
          }
          aciklama={
            suzgec === "eski"
              ? "Bütün raporlar üretildikleri günkü puanlarla uyumlu."
              : "“Yeni rapor” düğmesiyle veya öğrenci profilinden rapor üretebilirsiniz."
          }
        />
      ) : (
        <div className="space-y-2">
          {gosterilecek.map((rapor) => (
            <Kart key={rapor.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/koordinator/raporlar/${rapor.id}`}
                  className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                >
                  {rapor.ogrenciAdi}
                </Link>
                <Rozet tur={rapor.guncel ? "olumlu" : "uyari"}>
                  {rapor.guncel ? "Güncel" : "Güncel değil"}
                </Rozet>
                {rapor.duzenlemeZamani ? <Rozet>Elle düzenlendi</Rozet> : null}
              </div>

              <p className="mt-1 text-sm text-zinc-600">
                {rapor.kapsam.join(" · ")}
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                {tarihBicimle(rapor.uretimZamani)} tarihinde üretildi ·{" "}
                {rapor.atolyeSayisi} atölye
                {rapor.duzenleyen ? ` · Düzenleyen: ${rapor.duzenleyen}` : ""}
              </p>
            </Kart>
          ))}
        </div>
      )}
    </div>
  );
}
