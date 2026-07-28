import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { Kart, Rozet, SayfaBasligi, butonStili } from "@/components/ui";
import { pdfGecmisi, raporDetayi } from "@/lib/rapor-verisi";
import { ortalamaBicimle } from "@/lib/scoring";
import { tarihBicimle } from "@/lib/tarih";
import { RaporDuzenleyici } from "./rapor-duzenleyici";

export const metadata: Metadata = {
  title: "Rapor",
};

/** §11.2 — Atölye bazlı sonuçlar + genel öğrenci raporu. */
export default async function RaporSayfasi(
  props: PageProps<"/koordinator/raporlar/[id]">,
) {
  await koordinatorZorunlu();
  const { id } = await props.params;

  const [rapor, pdfler] = await Promise.all([
    raporDetayi(id),
    pdfGecmisi({ raporId: id }),
  ]);
  if (!rapor) notFound();

  const { ozet, govde } = rapor;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/raporlar"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Raporlar
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={`${ozet.ogrenciAdi} — Öğrenci Raporu`}
            aciklama={`${tarihBicimle(ozet.uretimZamani)} · ${ozet.kapsam.join(" · ")}`}
            aksiyon={
              <Link
                href={`/koordinator/ogrenciler/${ozet.ogrenciId}`}
                className={butonStili("ikincil")}
              >
                Öğrenci profili
              </Link>
            }
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Rozet tur={ozet.guncel ? "olumlu" : "uyari"}>
            {ozet.guncel ? "Güncel" : "Güncel değil"}
          </Rozet>
          {ozet.duzenlemeZamani ? (
            <span className="text-xs text-zinc-500">
              {tarihBicimle(ozet.duzenlemeZamani)} tarihinde{" "}
              {ozet.duzenleyen ?? "koordinatör"} tarafından düzenlendi
            </span>
          ) : null}
        </div>
      </div>

      {!ozet.guncel ? (
        <Kart className="bg-vurgu-50 p-3">
          <p className="text-sm text-vurgu-800">
            Bu rapor üretildikten sonra puanlarda değişiklik yapıldı. Aşağıdaki
            “Güncel puanlarla yeniden üret” düğmesiyle yeni bir rapor
            oluşturabilirsiniz; bu rapor geçmişte kalır.
          </p>
        </Kart>
      ) : null}

      {/* --- A. Atölye bazlı sonuçlar --- */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Atölye bazlı sonuçlar
        </h2>

        {govde.analiz.atolyeler.map((atolye, sira) => {
          const paragraf = govde.metin.atolyeler[sira]?.paragraf ?? "";

          return (
            <Kart key={atolye.atolyeAdi} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-zinc-900">
                  {atolye.atolyeAdi}
                </h3>
                <span className="text-sm text-zinc-600">
                  Ortalama {ortalamaBicimle(atolye.genelOrtalama)}
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-500">
                {atolye.katildigiOturumSayisi} katıldığı ·{" "}
                {atolye.katilmadigiOturumSayisi} katılmadığı oturum ·{" "}
                {atolye.degerlendirilenSoruSayisi} değerlendirilen soru
              </p>

              {atolye.soruOrtalamalari.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {atolye.soruOrtalamalari.map((soru) => (
                    <li
                      key={soru.anahtar}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span className="text-zinc-700">{soru.soruMetni}</span>
                      <span className="shrink-0 tabular-nums text-zinc-600">
                        {ortalamaBicimle(soru.ortalama)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-800">
                {paragraf}
              </p>
            </Kart>
          );
        })}
      </div>

      {/* --- B. Genel öğrenci raporu --- */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Genel öğrenci değerlendirmesi
        </h2>
        <Kart className="space-y-3 p-4">
          {govde.metin.genelParagraflar.map((paragraf, sira) => (
            <p key={sira} className="text-sm text-zinc-800">
              {paragraf}
            </p>
          ))}
        </Kart>
      </div>

      <RaporDuzenleyici
        raporId={ozet.id}
        metin={govde.metin}
        guncel={ozet.guncel}
      />

      {/* §11.5 + §13.17 — Bu rapordan üretilmiş PDF'ler */}
      {pdfler.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900">
            Bu rapordan üretilen PDF’ler
          </h2>
          <Kart className="divide-y divide-yuzey-100">
            {pdfler.map((pdf) => (
              <div
                key={pdf.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <p className="text-sm text-zinc-700">
                  {tarihBicimle(pdf.olusturmaZamani)} tarihinde oluşturuldu
                </p>
                <a
                  href={pdf.adres}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-marka-700 hover:underline"
                >
                  PDF’i aç
                </a>
              </div>
            ))}
          </Kart>
          <p className="text-xs text-zinc-500">
            Üretilmiş PDF’ler silinmez; içerikleri üretildikleri andaki hâliyle
            kalır.
          </p>
        </div>
      ) : null}
    </div>
  );
}
