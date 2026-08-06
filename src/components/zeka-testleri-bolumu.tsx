"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Alan,
  Bildirim,
  BosDurum,
  Buton,
  CokSatirli,
  Girdi,
  Kart,
  Rozet,
  baglantiStili,
  butonStili,
  secimStili,
} from "@/components/ui";
import { tarihBicimle } from "@/lib/tarih";
import {
  zekaTestiEkle,
  zekaTestiSil,
  type ZekaTestiEylemDurumu,
} from "@/app/koordinator/zeka-testleri/zeka-testi-eylemleri";

/**
 * Zeka testleri bölümü — yüklenen sonuç belgeleri (PDF/görsel).
 *
 * İki modda çalışır (görüşme bölümleriyle aynı desen):
 *   - "yonetim": Zeka testleri sayfası — yükleme, silme, süzme; öğrenci
 *     formdaki seçiciden gelir ve satırlarda öğrenci adı görünür.
 *   - "okuma":  Öğrenci profili — yalnızca o öğrencinin listesi ve önizleme
 *     penceresi; yükleme/silme Zeka testleri sayfasına yönlendirilir.
 *
 * GİZLİLİK: Test sonuçları sağlık bilgisi gibi hassastır; bu bileşen yalnızca
 * koordinatör ekranlarında kullanılır, stajyer ekranlarına hiç gitmez.
 *
 * Önizleme detay penceresinde: belge `/api/zeka-testi/[id]` rotasından
 * `inline` olarak servis edilir — PDF `<iframe>`, görsel `<img>` ile
 * gösterilir. Pencere kapalıyken hiçbir belge yüklenmez.
 */

export type ZekaTestiSatiri = {
  id: string;
  ogrenciId: string;
  ogrenciAdi: string;
  tarih: Date;
  testAdi: string;
  not: string | null;
  dosyaAdi: string;
  mime: string;
  boyut: number;
  ekleyen: string | null;
  eklenmeTarihi: Date;
};

/** "1,2 MB" / "640 KB" — liste ve pencere için okunur boyut. */
function boyutBicimle(bayt: number): string {
  if (bayt >= 1024 * 1024) {
    return `${(bayt / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bayt / 1024))} KB`;
}

function YukleButonu() {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Yükleniyor…" : "Belgeyi kaydet"}
    </Buton>
  );
}

export function ZekaTestleriBolumu({
  mod,
  testler,
  ogrenciSecenekleri = [],
  testAdiSecenekleri = [],
  bugunMetni = "",
}: {
  mod: "yonetim" | "okuma";
  testler: ZekaTestiSatiri[];
  /** Yalnızca yönetim modunda: yükleme formundaki ve süzgeçteki öğrenciler. */
  ogrenciSecenekleri?: { id: string; ad: string }[];
  /** Yalnızca yönetim modunda: "Testin adı" açılır listesi (katalogdan). */
  testAdiSecenekleri?: string[];
  /** Formun varsayılan tarihi (YYYY-AA-GG) — sunucudan gelir, saat dilimi kaymaz. */
  bugunMetni?: string;
}) {
  const yonetim = mod === "yonetim";

  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<ZekaTestiEylemDurumu, FormData>(
    zekaTestiEkle,
    {},
  );

  // Başarıdan sonra form kapanır (görüşme bölümlerindeki desen).
  const [gorulenBasari, setGorulenBasari] = useState(durum.basari);
  if (durum.basari !== gorulenBasari) {
    setGorulenBasari(durum.basari);
    if (durum.basari) setAcik(false);
  }

  // React 19, eylem bitince formu sıfırlıyor; metin alanları `degerler`den
  // geri gelir. Dosya seçimi tarayıcı güvenliği gereği geri yüklenemez —
  // hata mesajı bunu söyler, kullanıcı dosyayı yeniden seçer.
  const deger = (alan: string) => durum.degerler?.[alan];

  const [silmeDurumu, setSilmeDurumu] = useState<ZekaTestiEylemDurumu>({});
  const [siliniyor, silmeyeBasla] = useTransition();

  // Süzgeç yalnızca yönetim modunda; istemcide süzülüyor (görüşme
  // bölümlerindeki gerekçeyle aynı).
  const [ogrenciSuzgeci, setOgrenciSuzgeci] = useState("");
  const suzulmus = testler.filter(
    (test) => !ogrenciSuzgeci || test.ogrenciId === ogrenciSuzgeci,
  );

  const [secili, setSecili] = useState<ZekaTestiSatiri | null>(null);
  const pencereRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const pencere = pencereRef.current;
    if (!pencere) return;
    if (secili && !pencere.open) pencere.showModal();
    if (!secili && pencere.open) pencere.close();
  }, [secili]);

  function sil(test: ZekaTestiSatiri) {
    if (
      !window.confirm(
        `${tarihBicimle(test.tarih)} tarihli "${test.testAdi}" belgesi (${test.ogrenciAdi}) silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
      )
    ) {
      return;
    }
    silmeyeBasla(async () => {
      const sonuc = await zekaTestiSil(test.id);
      setSilmeDurumu(sonuc);
      if (sonuc.basari) setSecili(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Zeka testleri
          {testler.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {testler.length} belge
            </span>
          ) : null}
        </h2>
        {yonetim && !acik ? (
          <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
            + Test belgesi yükle
          </Buton>
        ) : null}
        {!yonetim ? (
          <Link href="/koordinator/zeka-testleri" className={baglantiStili}>
            Zeka testleri sayfasında yönetilir
          </Link>
        ) : null}
      </div>

      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {silmeDurumu.basari ? (
        <Bildirim tur="basari">{silmeDurumu.basari}</Bildirim>
      ) : null}
      {silmeDurumu.hata ? (
        <Bildirim tur="hata">{silmeDurumu.hata}</Bildirim>
      ) : null}

      {yonetim && acik ? (
        <Kart className="space-y-4 p-4">
          <p className="text-sm text-zinc-600">
            Test sonuç belgesi PDF, JPG veya PNG olabilir; en fazla 4MB.
            Belgeler yalnızca koordinatörlere görünür; stajyerler bu bölümü
            hiçbir ekranda göremez.
          </p>

          <form action={eylem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Alan etiket="Öğrenci" hata={durum.alanHatalari?.ogrenciId}>
                <select
                  name="ogrenciId"
                  defaultValue={deger("ogrenciId") ?? ""}
                  className={secimStili}
                  autoFocus
                >
                  <option value="">Öğrenci seçin…</option>
                  {ogrenciSecenekleri.map((ogrenci) => (
                    <option key={ogrenci.id} value={ogrenci.id}>
                      {ogrenci.ad}
                    </option>
                  ))}
                </select>
              </Alan>

              <Alan
                etiket="Test tarihi"
                ipucu="Bugün için olduğu gibi bırakın."
                hata={durum.alanHatalari?.tarih}
              >
                <Girdi
                  name="tarih"
                  type="date"
                  defaultValue={deger("tarih") ?? bugunMetni}
                />
              </Alan>

              <Alan etiket="Testin adı" hata={durum.alanHatalari?.testAdi}>
                {/* Katalogdan seçilir (IntelligenceTestType); kayda adın
                    kendisi yazılır, katalog sonradan değişse de geçmiş
                    kayıtlar bozulmaz. */}
                <select
                  name="testAdi"
                  defaultValue={deger("testAdi") ?? ""}
                  className={secimStili}
                >
                  <option value="">Test seçin…</option>
                  {testAdiSecenekleri.map((ad) => (
                    <option key={ad} value={ad}>
                      {ad}
                    </option>
                  ))}
                </select>
              </Alan>

              <Alan etiket="Sonuç belgesi" hata={durum.alanHatalari?.dosya}>
                {/* Dosya seçimi hata sonrası geri yüklenemez (tarayıcı
                    güvenliği); diğer alanlar korunur, yalnızca dosya
                    yeniden seçilir. */}
                <input
                  type="file"
                  name="dosya"
                  accept="application/pdf,image/jpeg,image/png"
                  className="block w-full min-h-[2.75rem] rounded-md border border-yuzey-200 bg-white px-3 py-2 text-base file:mr-3 file:rounded file:border-0 file:bg-marka-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-marka-700 sm:min-h-0 sm:text-sm"
                />
              </Alan>
            </div>

            <Alan
              etiket="Değerlendirme notu (isteğe bağlı)"
              hata={durum.alanHatalari?.not}
            >
              <CokSatirli
                name="not"
                rows={3}
                defaultValue={deger("not")}
                placeholder="Sonucun kısa özeti, dikkat çeken noktalar…"
              />
            </Alan>

            {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

            <div className="flex flex-wrap items-center gap-2">
              <YukleButonu />
              <Buton type="button" tur="sade" onClick={() => setAcik(false)}>
                Vazgeç
              </Buton>
            </div>
          </form>
        </Kart>
      ) : null}

      {yonetim && testler.length > 0 ? (
        <select
          value={ogrenciSuzgeci}
          onChange={(olay) => setOgrenciSuzgeci(olay.target.value)}
          className={`${secimStili} w-auto`}
          aria-label="Öğrenciye göre süz"
        >
          <option value="">Bütün öğrenciler</option>
          {ogrenciSecenekleri.map((ogrenci) => (
            <option key={ogrenci.id} value={ogrenci.id}>
              {ogrenci.ad}
            </option>
          ))}
        </select>
      ) : null}

      {testler.length === 0 && !acik ? (
        <BosDurum
          baslik="Henüz zeka testi belgesi yok."
          aciklama={
            yonetim
              ? "Uygulanan testlerin sonuç belgelerini (PDF/görsel) buradan yükleyebilirsiniz. Belgeler stajyerlere görünmez."
              : "Test belgeleri Zeka testleri sayfasından yüklenir."
          }
        />
      ) : testler.length > 0 && suzulmus.length === 0 ? (
        <BosDurum baslik="Süzgece uyan belge yok." />
      ) : (
        <div className="space-y-2">
          {suzulmus.map((test) => (
            <button
              key={test.id}
              type="button"
              onClick={() => setSecili(test)}
              className="group flex w-full items-center justify-between gap-3 rounded-lg border border-yuzey-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(91,16,53,0.04)] transition-colors hover:border-marka-200 hover:bg-marka-50"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900">
                  {tarihBicimle(test.tarih)}
                </span>
                {yonetim ? (
                  <span className="font-medium text-zinc-900">
                    {test.ogrenciAdi}
                  </span>
                ) : null}
                <span className="text-sm text-zinc-700">{test.testAdi}</span>
                <Rozet tur={test.mime === "application/pdf" ? "notr" : "pasif"}>
                  {test.mime === "application/pdf" ? "PDF" : "Görsel"}
                </Rozet>
                <span className="text-xs text-zinc-500">
                  {boyutBicimle(test.boyut)}
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

      {/* --- Detay ve önizleme penceresi --- */}
      <dialog
        ref={pencereRef}
        onClose={() => setSecili(null)}
        className="m-auto w-[min(46rem,calc(100vw-2rem))] rounded-lg bg-white p-0 shadow-2xl backdrop:bg-marka-950/50"
      >
        {secili ? (
          <div className="flex max-h-[90vh] flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-yuzey-100 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-zinc-900">
                    {secili.testAdi}
                  </h3>
                  <Rozet
                    tur={secili.mime === "application/pdf" ? "notr" : "pasif"}
                  >
                    {secili.mime === "application/pdf" ? "PDF" : "Görsel"}
                  </Rozet>
                </div>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {secili.ogrenciAdi} · {tarihBicimle(secili.tarih)} ·{" "}
                  {boyutBicimle(secili.boyut)}
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

            <div className="space-y-4 overflow-y-auto p-4">
              {/* Önizleme: belge inline servis ediliyor; PDF iframe'de,
                  görsel img'de. Pencere kapalıyken bu bölüm render edilmez,
                  belge boşuna indirilmez. */}
              {secili.mime === "application/pdf" ? (
                <iframe
                  src={`/api/zeka-testi/${secili.id}`}
                  title={`${secili.testAdi} önizlemesi`}
                  className="h-[60vh] w-full rounded-md border border-yuzey-200"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- dinamik, yetkili rotadan gelen belge; next/image optimizasyonuna girmemeli
                <img
                  src={`/api/zeka-testi/${secili.id}`}
                  alt={`${secili.testAdi} sonuç belgesi`}
                  className="max-h-[60vh] w-full rounded-md border border-yuzey-200 object-contain"
                />
              )}

              {secili.not ? (
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900">
                    Değerlendirme notu
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                    {secili.not}
                  </p>
                </div>
              ) : null}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-yuzey-100 p-4">
              <span className="text-xs text-zinc-500">
                Ekleyen: {secili.ekleyen ?? "—"} ·{" "}
                {tarihBicimle(secili.eklenmeTarihi)}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/zeka-testi/${secili.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={butonStili("ikincil")}
                >
                  Yeni sekmede aç
                </a>
                {yonetim ? (
                  <Buton
                    type="button"
                    tur="tehlike"
                    disabled={siliniyor}
                    onClick={() => sil(secili)}
                  >
                    {siliniyor ? "Siliniyor…" : "Sil"}
                  </Buton>
                ) : null}
              </span>
            </footer>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
