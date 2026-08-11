"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Bildirim, Buton, CokSatirli, DonenHalka, Rozet, baglantiStili } from "@/components/ui";
import { GonderButonu } from "@/components/ui-istemci";
import { cn } from "@/lib/utils";
import { ortalamaBicimle } from "@/lib/puan-hesaplari";
import { tarihBicimle } from "@/lib/tarih";
import type { KapsamKaydi } from "@/lib/rapor-verisi";
import type { RaporMetni } from "@/lib/rapor-motoru";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";
import { RaporIcerigiV2 } from "./rapor-icerigi-v2";
import type { EylemDurumu, RaporPenceresiVerisi } from "./rapor-eylemleri";

/**
 * Rapor penceresinin üç iç ekranı — `rapor-bolumu.tsx`'ten çıkarıldı.
 * Pencere durumu ve eylem bağlama orada; burası yalnızca görünüm + form.
 */

/** §11.2 — Atölye bazlı sonuçlar + genel değerlendirme. */
export function RaporIcerigi({
  veri,
  raporId,
  onGuncellendi,
}: {
  veri: RaporPenceresiVerisi;
  /** Verilirse v2 kutuları yerinde düzenlenebilir olur. */
  raporId?: string;
  onGuncellendi?: () => Promise<void> | void;
}) {
  const { ozet, govde } = veri.detay;

  // §11.2 — Gövde biçimi zamanla değişti. Sürüm alanı taşıyan raporlar yeni
  // düzenle, eskiler (alan yok) eski düzenle gösterilir; üretilmiş bir
  // raporun içeriği sonradan değişmemeli.
  const surumlu = govde as unknown as { surum?: number };
  if (surumlu?.surum === 2) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
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
        <RaporIcerigiV2
          govde={govde as unknown as RaporGovdesiV2}
          raporId={raporId}
          onGuncellendi={onGuncellendi}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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

      {/* Güncelliğini yitirmiş rapor uyarısı: kil temasının basılı uyarı
          şeridi; uyarı rengi metinde korunuyor. */}
      {!ozet.guncel ? (
        <div className="kil-uyari p-3">
          <p className="text-sm text-vurgu-800">
            Bu rapor üretildikten sonra puanlarda değişiklik yapıldı. Aşağıdaki
            “Güncel puanlarla yeniden üret” düğmesiyle yeni bir rapor
            oluşturabilirsiniz; bu rapor geçmişte kalır.
          </p>
        </div>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900">
          Atölye bazlı sonuçlar
        </h3>

        {govde.analiz.atolyeler.map((atolye, sira) => (
          <div key={atolye.atolyeAdi} className="kil-oyuk p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-medium text-zinc-900">{atolye.atolyeAdi}</h4>
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
                {atolye.soruOrtalamalari.map((soru, soruSira) => {
                  // Konu başlığı değişince araya bölüm başlığı girer. Eski
                  // raporların gövdesinde kategori alanı yok (bodyJson eski
                  // şekliyle saklanır); `?? null` o raporları düz liste bırakır.
                  const kategori = soru.kategori ?? null;
                  const oncekiKategori =
                    soruSira > 0
                      ? (atolye.soruOrtalamalari[soruSira - 1].kategori ?? null)
                      : null;
                  const kategoriBasligi =
                    kategori && kategori !== oncekiKategori ? kategori : null;

                  return (
                    <li key={soru.anahtar} className="text-sm">
                      {kategoriBasligi ? (
                        <p className="mt-2 mb-1 text-xs font-semibold tracking-wide text-marka-700 uppercase">
                          {kategoriBasligi}
                        </p>
                      ) : null}
                      <div className="flex justify-between gap-4">
                        <span
                          className="text-zinc-700"
                          title={soru.baslik ? soru.soruMetni : undefined}
                        >
                          {soru.baslik ?? soru.soruMetni}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-600">
                          {ortalamaBicimle(soru.ortalama)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-800">
              {govde.metin.atolyeler[sira]?.paragraf ?? ""}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900">
          Genel öğrenci değerlendirmesi
        </h3>
        <div className="kil-oyuk space-y-3 p-4">
          {govde.metin.genelParagraflar.map((paragraf, sira) => (
            <p key={sira} className="text-sm text-zinc-800">
              {paragraf}
            </p>
          ))}
        </div>
      </section>

      {/* §11.5 + §13.17 — Bu rapordan üretilmiş PDF'ler */}
      {veri.pdfler.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900">
            Bu rapordan üretilen PDF’ler
          </h3>
          <div className="kil-oyuk divide-y divide-white/70">
            {veri.pdfler.map((pdf) => (
              <div
                key={pdf.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <p className="text-sm text-zinc-700">
                  {tarihBicimle(pdf.olusturmaZamani)} tarihinde oluşturuldu
                </p>
                <a
                  href={pdf.adres}
                  target="_blank"
                  rel="noreferrer"
                  className={baglantiStili}
                >
                  PDF’i aç
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * §11.4 — Metin düzenleme. Yalnızca metin katmanı değişir; analiz çıktısı
 * (hangi puanlardan hangi sonuç çıktığı) olduğu gibi kalır.
 */
export function MetinDuzenleme({
  metin,
  durum,
  eylem,
  onVazgec,
}: {
  metin: RaporMetni;
  durum: EylemDurumu;
  eylem: (formVerisi: FormData) => void;
  onVazgec: () => void;
}) {
  return (
    <form action={eylem} className="space-y-3">
      {metin.atolyeler.map((atolye, sira) => (
        <div key={atolye.atolyeAdi} className="kil-oyuk p-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              {atolye.atolyeAdi}
            </span>
            <CokSatirli
              name={`atolye-${sira}`}
              defaultValue={atolye.paragraf}
              rows={4}
              className="mt-2"
            />
          </label>
        </div>
      ))}

      <div className="kil-oyuk p-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">
            Genel öğrenci değerlendirmesi
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Paragrafları boş satırla ayırın.
          </span>
          <CokSatirli
            name="genel"
            defaultValue={metin.genelParagraflar.join("\n\n")}
            rows={8}
            className="mt-2"
          />
        </label>
      </div>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex gap-2">
        <Buton type="submit">Değişiklikleri kaydet</Buton>
        <Buton type="button" tur="ikincil" onClick={onVazgec}>
          Vazgeç
        </Buton>
      </div>
    </form>
  );
}

/**
 * §11.1 — Raporun kapsamı seçilir.
 *
 * Varsayılan olarak puanlaması bulunan bütün kayıtlar işaretli gelir: rapor
 * çoğunlukla öğrencinin tamamını kapsar. Hiç puanlaması olmayan kayıt da
 * seçilebilir ama sonucun boş olacağı yazılır — sessizce gizlemek yerine
 * neden boş çıkacağını söylemek daha anlaşılır.
 */
export function YeniRaporFormu({
  kayitlar,
  durum,
  eylem,
}: {
  kayitlar: KapsamKaydi[];
  durum: EylemDurumu;
  eylem: (formVerisi: FormData) => void;
}) {
  const [secilenler, setSecilenler] = useState<string[]>(() =>
    kayitlar
      .filter((kayit) => kayit.puanlanmisOturumSayisi > 0)
      .map((kayit) => kayit.id),
  );

  function degistir(id: string) {
    setSecilenler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((k) => k !== id)
        : [...oncekiler, id],
    );
  }

  return (
    <form action={eylem} className="space-y-3">
      {secilenler.map((id) => (
        <input key={id} type="hidden" name="kayitlar" value={id} />
      ))}

      <p className="text-sm text-zinc-600">
        Rapor, seçilen kayıtlardaki puanlamalardan üretilir. Aynı atölye birden
        fazla kayıtta geçiyorsa raporda tek bölüm olarak birleşir.
      </p>

      {/* Kapsam listesi bir girdi: kart gibi kabarmaz, forma gömülür. */}
      <div className="kil-girdi p-3">
        <ul className="space-y-1">
          {kayitlar.map((kayit) => {
            const secili = secilenler.includes(kayit.id);

            return (
              <li key={kayit.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm",
                    secili ? "bg-marka-50" : "hover:bg-marka-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={secili}
                    onChange={() => degistir(kayit.id)}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    <span className="font-medium text-zinc-800">
                      {kayit.programAdi} · {kayit.grupAdi}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {kayit.tur} · {kayit.aktif ? "Aktif kayıt" : "İptal kayıt"}{" "}
                      ·{" "}
                      {kayit.puanlanmisOturumSayisi > 0
                        ? `${kayit.puanlanmisOturumSayisi} doldurulmuş form`
                        : "Doldurulmuş form yok — bu kayıt rapora içerik katmaz"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <UretimSurecKutusu />

      <div className="flex items-center gap-3">
        <GonderButonu
          bekleyenEtiket="Rapor üretiliyor…"
          disabled={secilenler.length === 0}
        >
          Raporu oluştur
        </GonderButonu>
        <span className="text-sm text-zinc-500">
          {secilenler.length} kayıt seçili
        </span>
      </div>
    </form>
  );
}

/**
 * Rapor üretimi sürerken formda görünen bilgi şeridi.
 *
 * Üretim yapay zekâ gözlem metnini de yazdığı için yarım dakikayı bulabiliyor;
 * yalnızca buton etiketi değişince süreç "takıldı" sanılıyordu. Şerit yalnızca
 * eylem çalışırken çizilir — `useFormStatus` en yakın üst formdan okur, bu
 * yüzden form İÇİNDE ayrı bir bileşen olmak zorunda.
 */
function UretimSurecKutusu() {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <div
      role="status"
      className="kil-oyuk flex items-center gap-3 px-3 py-2.5 text-sm text-marka-700"
    >
      <DonenHalka />
      <span>
        Rapor üretiliyor; puanlar değerlendiriliyor ve gözlem metni yazılıyor.
        Bu işlem bir dakikaya kadar sürebilir, lütfen pencereyi kapatmayın.
      </span>
    </div>
  );
}
