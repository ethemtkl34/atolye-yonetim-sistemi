import type { Metadata } from "next";
import Link from "next/link";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { raporOzetleri } from "@/lib/rapor-verisi";
import { tarihBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Raporlar",
};

/**
 * §11 — Üretilmiş bütün raporlar.
 *
 * "Güncel değil" rozeti saklanan bir alandan değil, okuma anında puanların
 * son güncelleme zamanıyla karşılaştırmadan çıkar (§13.16).
 */
export default async function RaporlarSayfasi() {
  await koordinatorZorunlu();

  const raporlar = await raporOzetleri({});
  const guncelOlmayan = raporlar.filter((rapor) => !rapor.guncel).length;

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Raporlar"
        aciklama="Rapor istenildiği anda mevcut puanlardan üretilir. Puanlar sonradan değişirse rapor “Güncel değil” olarak işaretlenir; yeniden üretmek eski raporu ve PDF’lerini silmez."
      />

      {guncelOlmayan > 0 ? (
        <Kart className="bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            {guncelOlmayan} rapor, üretildikten sonra değişen puanlar yüzünden
            güncelliğini yitirdi.
          </p>
        </Kart>
      ) : null}

      {raporlar.length === 0 ? (
        <BosDurum
          baslik="Henüz rapor üretilmemiş."
          aciklama="Rapor, öğrenci profilindeki “Rapor oluştur” düğmesiyle üretilir."
        />
      ) : (
        <div className="space-y-2">
          {raporlar.map((rapor) => (
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
