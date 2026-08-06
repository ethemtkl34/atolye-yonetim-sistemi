"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  Alan,
  Bildirim,
  BosDurum,
  Buton,
  CokSatirli,
  Girdi,
  Kart,
  Rozet,
  secimStili,
} from "@/components/ui";
import { tarihBicimle } from "@/lib/tarih";
import {
  gorusmeEkle,
  gorusmeSil,
  type GorusmeEylemDurumu,
} from "./gorusme-eylemleri";

/**
 * Öğrenci görüşmeleri bölümü — psikolog (veya koordinatör) ile öğrenci
 * arasındaki görüşmelerin kaydı. Veli görüşmeleri ayrı bölümde
 * (`veli-gorusmeleri-bolumu.tsx`): akışları farklı, biri not defteri,
 * diğeri test + brief'li hazırlık aracı.
 *
 * GİZLİLİK: Bu bileşen yalnızca koordinatör profil sayfasında kullanılır;
 * görüşme verisi stajyer ekranlarının hiçbirine gitmez (sağlık bilgisi
 * kuralının aynısı).
 *
 * Ekleme satır içi açılır form; OKUMA ise açılır pencerede. Liste satırı
 * yalnızca tarih + tür + görüşmeci gösterir — not 5000 karaktere kadar
 * olabildiği için listede tam metin sayfayı şişiriyordu. Nota tıklayınca
 * native `<dialog>` açılır (rapor penceresindeki desenin sade hâli; URL
 * parametresi yok, derin bağlantı ihtiyacı yok).
 */

export type GorusmeSatiri = {
  id: string;
  tarih: Date;
  gorusmeciAdi: string;
  tur: "PSIKOLOG" | "KOORDINATOR";
  not: string;
  ekleyen: string | null;
  eklenmeTarihi: Date;
};

const TUR_ETIKETLERI: Record<GorusmeSatiri["tur"], string> = {
  PSIKOLOG: "Psikolog",
  KOORDINATOR: "Koordinatör",
};

function KaydetButonu() {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Görüşmeyi kaydet"}
    </Buton>
  );
}

export function OgrenciGorusmeleriBolumu({
  ogrenciId,
  gorusmeler,
  bugunMetni,
}: {
  ogrenciId: string;
  gorusmeler: GorusmeSatiri[];
  /** Formun varsayılan tarihi (YYYY-AA-GG) — sunucudan gelir, saat dilimi kaymaz. */
  bugunMetni: string;
}) {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<GorusmeEylemDurumu, FormData>(
    gorusmeEkle.bind(null, ogrenciId),
    {},
  );

  // Başarıdan sonra form kapanır (render sırasında durum ayarlamadan —
  // grup ekleme formundaki desenle aynı).
  const [gorulenBasari, setGorulenBasari] = useState(durum.basari);
  if (durum.basari !== gorulenBasari) {
    setGorulenBasari(durum.basari);
    if (durum.basari) setAcik(false);
  }

  // React 19, eylem bitince formu sıfırlıyor — doğrulama hatasında da.
  // Eylem girilenleri geri döndürüyor; alanlar buradan doldurulur ki uzun
  // bir görüşme notu tek eksik alan yüzünden kaybolmasın.
  const deger = (alan: string) => durum.degerler?.[alan];

  const [silmeDurumu, setSilmeDurumu] = useState<GorusmeEylemDurumu>({});
  const [siliniyor, silmeyeBasla] = useTransition();

  /**
   * Detay penceresi. Kapalıyken içerik render edilmez; `secili` hem pencerenin
   * açık olup olmadığını hem gösterilen görüşmeyi taşır.
   */
  const [secili, setSecili] = useState<GorusmeSatiri | null>(null);
  const pencereRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const pencere = pencereRef.current;
    if (!pencere) return;
    if (secili && !pencere.open) pencere.showModal();
    if (!secili && pencere.open) pencere.close();
  }, [secili]);

  function sil(gorusme: GorusmeSatiri) {
    if (
      !window.confirm(
        `${tarihBicimle(gorusme.tarih)} tarihli görüşme (${gorusme.gorusmeciAdi}) silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
      )
    ) {
      return;
    }
    silmeyeBasla(async () => {
      const sonuc = await gorusmeSil(gorusme.id);
      setSilmeDurumu(sonuc);
      // Silme pencereden yapılıyor; kayıt gittiyse pencere açık kalamaz.
      if (sonuc.basari) setSecili(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Öğrenci görüşmeleri
          {gorusmeler.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {gorusmeler.length} görüşme
            </span>
          ) : null}
        </h2>
        {!acik ? (
          <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
            + Görüşme ekle
          </Buton>
        ) : null}
      </div>

      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {silmeDurumu.basari ? (
        <Bildirim tur="basari">{silmeDurumu.basari}</Bildirim>
      ) : null}
      {silmeDurumu.hata ? (
        <Bildirim tur="hata">{silmeDurumu.hata}</Bildirim>
      ) : null}

      {acik ? (
        <Kart className="space-y-4 p-4">
          <p className="text-sm text-zinc-600">
            Görüşme notları yalnızca koordinatörlere görünür; stajyerler bu
            bölümü hiçbir ekranda göremez.
          </p>

          <form action={eylem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Alan
                etiket="Görüşme tarihi"
                ipucu="Bugün için olduğu gibi bırakın."
                hata={durum.alanHatalari?.tarih}
              >
                <Girdi
                  name="tarih"
                  type="date"
                  defaultValue={deger("tarih") ?? bugunMetni}
                />
              </Alan>

              <Alan
                etiket="Görüşmeyi yapan"
                hata={durum.alanHatalari?.gorusmeciAdi}
              >
                <Girdi
                  name="gorusmeciAdi"
                  defaultValue={deger("gorusmeciAdi")}
                  placeholder="Örn. Psk. Ayşe Yılmaz"
                  autoFocus
                />
              </Alan>

              <Alan etiket="Görüşmeci" hata={durum.alanHatalari?.tur}>
                <select
                  name="tur"
                  defaultValue={deger("tur") ?? "PSIKOLOG"}
                  className={secimStili}
                >
                  <option value="PSIKOLOG">Psikolog</option>
                  <option value="KOORDINATOR">Koordinatör</option>
                </select>
              </Alan>
            </div>

            <Alan etiket="Görüşme notu" hata={durum.alanHatalari?.not}>
              <CokSatirli
                name="not"
                rows={4}
                defaultValue={deger("not")}
                placeholder="Görüşmede konuşulanlar, gözlemler, öneriler…"
              />
            </Alan>

            {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

            <div className="flex flex-wrap items-center gap-2">
              <KaydetButonu />
              <Buton type="button" tur="sade" onClick={() => setAcik(false)}>
                Vazgeç
              </Buton>
            </div>
          </form>
        </Kart>
      ) : null}

      {gorusmeler.length === 0 && !acik ? (
        <BosDurum
          baslik="Henüz öğrenci görüşmesi kaydı yok."
          aciklama="Psikolog veya koordinatör görüşmelerini buradan ekleyebilirsiniz. Notlar stajyerlere görünmez."
        />
      ) : (
        <div className="space-y-2">
          {/* Satırda yalnızca kimlik bilgisi; notun tamamı pencerede.
              Satırın kendisi düğme — telefonda kartın neresine dokunulursa
              dokunulsun detay açılır. */}
          {gorusmeler.map((gorusme) => (
            <button
              key={gorusme.id}
              type="button"
              onClick={() => setSecili(gorusme)}
              className="group flex w-full items-center justify-between gap-3 rounded-lg border border-yuzey-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(91,16,53,0.04)] transition-colors hover:border-marka-200 hover:bg-marka-50"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900">
                  {tarihBicimle(gorusme.tarih)}
                </span>
                <Rozet tur={gorusme.tur === "PSIKOLOG" ? "notr" : "pasif"}>
                  {TUR_ETIKETLERI[gorusme.tur]}
                </Rozet>
                <span className="truncate text-sm text-zinc-600">
                  {gorusme.gorusmeciAdi}
                </span>
              </span>
              <span
                aria-hidden
                className="shrink-0 text-lg text-zinc-300 transition-colors group-hover:text-marka-600"
              >
                →
              </span>
            </button>
          ))}
        </div>
      )}

      {/* --- Detay penceresi --- */}
      <dialog
        ref={pencereRef}
        onClose={() => setSecili(null)}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-lg bg-white p-0 shadow-2xl backdrop:bg-marka-950/50"
      >
        {secili ? (
          <div className="flex max-h-[85vh] flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-yuzey-100 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-zinc-900">
                    {tarihBicimle(secili.tarih)}
                  </h3>
                  <Rozet tur={secili.tur === "PSIKOLOG" ? "notr" : "pasif"}>
                    {TUR_ETIKETLERI[secili.tur]}
                  </Rozet>
                </div>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {secili.gorusmeciAdi}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSecili(null)}
                aria-label="Pencereyi kapat"
                className="flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-md text-lg text-zinc-400 hover:bg-marka-50 hover:text-zinc-700 sm:min-h-0 sm:min-w-0 sm:px-2"
              >
                ×
              </button>
            </header>

            {/* Not tam metin: koordinatör okumak için giriyor, kırpılmaz.
                Satır sonları korunur; uzun not pencere içinde kayar. */}
            <div className="overflow-y-auto p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {secili.not}
              </p>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-yuzey-100 p-4">
              <span className="text-xs text-zinc-500">
                Ekleyen: {secili.ekleyen ?? "—"} ·{" "}
                {tarihBicimle(secili.eklenmeTarihi)}
              </span>
              <Buton
                type="button"
                tur="tehlike"
                disabled={siliniyor}
                onClick={() => sil(secili)}
              >
                {siliniyor ? "Siliniyor…" : "Sil"}
              </Buton>
            </footer>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
