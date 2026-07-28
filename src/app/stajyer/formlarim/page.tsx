import type { Metadata } from "next";
import Link from "next/link";
import { stajyerZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi } from "@/components/ui";
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
export default async function FormlarimSayfasi() {
  const kullanici = await stajyerZorunlu();
  const formlar = await doldurulmusFormlar({
    internId: kullanici.id,
    enFazla: 100,
  });

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Doldurduğum formlar"
        aciklama="En son güncellenen form başta. Girdiğiniz puanlamaları istediğiniz zaman düzenleyebilirsiniz."
      />

      {formlar.length === 0 ? (
        <BosDurum
          baslik="Henüz doldurduğunuz form yok."
          aciklama="Bir atölye formunu kaydettiğinizde burada listelenir."
        />
      ) : (
        <Kart className="divide-y divide-zinc-100">
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
                  className="text-sm text-marka-700 hover:underline"
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
