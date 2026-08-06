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
  secimStili,
} from "@/components/ui";
import { tarihBicimle } from "@/lib/tarih";
import {
  terapiGorusmesiEkle,
  terapiGorusmesiSil,
  type GorusmeEylemDurumu,
} from "@/app/koordinator/danismanlik/terapi-eylemleri";

/**
 * Terapi görüşmeleri bölümü — psikolog/koordinatör ile öğrenci arasındaki
 * oyun ve danışan terapisi kayıtları.
 *
 * İki modda çalışır:
 *   - "yonetim": Danışmanlık sayfası — ekleme, silme, süzme; öğrenci formdaki
 *     seçiciden gelir ve satırlarda öğrenci adı görünür.
 *   - "okuma":  Öğrenci profili — yalnızca o öğrencinin listesi ve detay
 *     penceresi; bütün yazma işlemleri Danışmanlık sayfasına yönlendirilir.
 *
 * GİZLİLİK: Her iki mod da yalnızca koordinatör ekranlarında kullanılır;
 * görüşme verisi stajyer ekranlarının hiçbirine gitmez (sağlık bilgisi
 * kuralının aynısı).
 *
 * Ekleme satır içi açılır form; OKUMA ise açılır pencerede (not 5000
 * karaktere kadar olabildiği için listede tam metin sayfayı şişirir).
 */

export type TerapiGorusmesiSatiri = {
  id: string;
  ogrenciId: string;
  ogrenciAdi: string;
  tarih: Date;
  gorusmeciAdi: string;
  tur: "PSIKOLOG" | "KOORDINATOR";
  terapiTuru: "OYUN_TERAPISI" | "DANISAN_TERAPISI";
  not: string;
  ekleyen: string | null;
  eklenmeTarihi: Date;
};

const TUR_ETIKETLERI: Record<TerapiGorusmesiSatiri["tur"], string> = {
  PSIKOLOG: "Psikolog",
  KOORDINATOR: "Koordinatör",
};

export const TERAPI_TURU_ETIKETLERI: Record<
  TerapiGorusmesiSatiri["terapiTuru"],
  string
> = {
  OYUN_TERAPISI: "Oyun terapisi",
  DANISAN_TERAPISI: "Danışan terapisi",
};

function KaydetButonu() {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Görüşmeyi kaydet"}
    </Buton>
  );
}

export function TerapiGorusmeleriBolumu({
  mod,
  gorusmeler,
  ogrenciSecenekleri = [],
  bugunMetni = "",
}: {
  mod: "yonetim" | "okuma";
  gorusmeler: TerapiGorusmesiSatiri[];
  /** Yalnızca yönetim modunda: ekleme formundaki ve süzgeçteki öğrenciler. */
  ogrenciSecenekleri?: { id: string; ad: string }[];
  /** Formun varsayılan tarihi (YYYY-AA-GG) — sunucudan gelir, saat dilimi kaymaz. */
  bugunMetni?: string;
}) {
  const yonetim = mod === "yonetim";

  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<GorusmeEylemDurumu, FormData>(
    terapiGorusmesiEkle,
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

  // Süzgeçler yalnızca yönetim modunda; liste küçük olduğu için istemcide
  // süzülüyor, adres satırına taşımaya değecek bir derin bağlantı ihtiyacı yok.
  const [ogrenciSuzgeci, setOgrenciSuzgeci] = useState("");
  const [turSuzgeci, setTurSuzgeci] = useState("");
  const suzulmus = gorusmeler.filter(
    (gorusme) =>
      (!ogrenciSuzgeci || gorusme.ogrenciId === ogrenciSuzgeci) &&
      (!turSuzgeci || gorusme.terapiTuru === turSuzgeci),
  );

  /**
   * Detay penceresi. Kapalıyken içerik render edilmez; `secili` hem pencerenin
   * açık olup olmadığını hem gösterilen görüşmeyi taşır.
   */
  const [secili, setSecili] = useState<TerapiGorusmesiSatiri | null>(null);
  const pencereRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const pencere = pencereRef.current;
    if (!pencere) return;
    if (secili && !pencere.open) pencere.showModal();
    if (!secili && pencere.open) pencere.close();
  }, [secili]);

  function sil(gorusme: TerapiGorusmesiSatiri) {
    if (
      !window.confirm(
        `${tarihBicimle(gorusme.tarih)} tarihli görüşme (${gorusme.ogrenciAdi} · ${gorusme.gorusmeciAdi}) silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
      )
    ) {
      return;
    }
    silmeyeBasla(async () => {
      const sonuc = await terapiGorusmesiSil(gorusme.id);
      setSilmeDurumu(sonuc);
      // Silme pencereden yapılıyor; kayıt gittiyse pencere açık kalamaz.
      if (sonuc.basari) setSecili(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Terapi görüşmeleri
          {gorusmeler.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {gorusmeler.length} görüşme
            </span>
          ) : null}
        </h2>
        {yonetim && !acik ? (
          <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
            + Terapi görüşmesi ekle
          </Buton>
        ) : null}
        {!yonetim ? (
          <Link href="/koordinator/danismanlik" className={baglantiStili}>
            Danışmanlık sayfasında yönetilir
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
            Görüşme notları yalnızca koordinatörlere görünür; stajyerler bu
            bölümü hiçbir ekranda göremez.
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

              <Alan etiket="Terapi türü" hata={durum.alanHatalari?.terapiTuru}>
                <select
                  name="terapiTuru"
                  defaultValue={deger("terapiTuru") ?? "OYUN_TERAPISI"}
                  className={secimStili}
                >
                  <option value="OYUN_TERAPISI">Oyun terapisi</option>
                  <option value="DANISAN_TERAPISI">Danışan terapisi</option>
                </select>
              </Alan>

              <Alan
                etiket="Görüşmeyi yapan"
                hata={durum.alanHatalari?.gorusmeciAdi}
              >
                <Girdi
                  name="gorusmeciAdi"
                  defaultValue={deger("gorusmeciAdi")}
                  placeholder="Örn. Psk. Ayşe Yılmaz"
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

      {yonetim && gorusmeler.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
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
          <select
            value={turSuzgeci}
            onChange={(olay) => setTurSuzgeci(olay.target.value)}
            className={`${secimStili} w-auto`}
            aria-label="Terapi türüne göre süz"
          >
            <option value="">Bütün türler</option>
            <option value="OYUN_TERAPISI">Oyun terapisi</option>
            <option value="DANISAN_TERAPISI">Danışan terapisi</option>
          </select>
        </div>
      ) : null}

      {gorusmeler.length === 0 && !acik ? (
        <BosDurum
          baslik="Henüz terapi görüşmesi kaydı yok."
          aciklama={
            yonetim
              ? "Oyun ve danışan terapisi görüşmelerini buradan ekleyebilirsiniz. Notlar stajyerlere görünmez."
              : "Terapi görüşmeleri Danışmanlık sayfasından eklenir."
          }
        />
      ) : gorusmeler.length > 0 && suzulmus.length === 0 ? (
        <BosDurum baslik="Süzgece uyan görüşme yok." />
      ) : (
        <div className="space-y-2">
          {/* Satırda yalnızca kimlik bilgisi; notun tamamı pencerede.
              Satırın kendisi düğme — telefonda kartın neresine dokunulursa
              dokunulsun detay açılır. */}
          {suzulmus.map((gorusme) => (
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
                {yonetim ? (
                  <span className="font-medium text-zinc-900">
                    {gorusme.ogrenciAdi}
                  </span>
                ) : null}
                <Rozet
                  tur={gorusme.terapiTuru === "OYUN_TERAPISI" ? "notr" : "pasif"}
                >
                  {TERAPI_TURU_ETIKETLERI[gorusme.terapiTuru]}
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
                  <Rozet
                    tur={
                      secili.terapiTuru === "OYUN_TERAPISI" ? "notr" : "pasif"
                    }
                  >
                    {TERAPI_TURU_ETIKETLERI[secili.terapiTuru]}
                  </Rozet>
                </div>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {secili.ogrenciAdi} · {secili.gorusmeciAdi} (
                  {TUR_ETIKETLERI[secili.tur]})
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
            </footer>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
