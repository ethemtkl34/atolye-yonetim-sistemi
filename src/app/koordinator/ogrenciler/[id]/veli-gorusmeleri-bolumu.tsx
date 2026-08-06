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
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { tarihBicimle } from "@/lib/tarih";
import { PUAN_ACIKLAMALARI } from "@/lib/scoring";
import {
  MINI_TEST_SORULARI,
  type MiniTestCevabi,
  type VeliBriefi,
} from "@/lib/veli-gorusmesi";
import {
  veliGorusmesiGonder,
  veliGorusmesiNotuKaydet,
  veliGorusmesiSil,
  type VeliGorusmesiEylemDurumu,
} from "./veli-gorusme-eylemleri";

/**
 * Veli görüşmeleri bölümü.
 *
 * GİZLİLİK: Öğrenci görüşmeleriyle aynı kural — bu bileşen yalnızca
 * koordinatör profil sayfasında kullanılır; veli görüşmesi verisi stajyer
 * ekranlarının hiçbirine gitmez.
 *
 * Akış: koordinatör tarih + görüşmeci + 3 soruluk mini testi doldurur,
 * "Cevapla" ile brief ÖNİZLEMESİ formun altında açılır (hiçbir şey
 * yazılmaz), "Kaydet" görüşmeyi brief'iyle birlikte saklar. Görüşme
 * yapıldıktan sonra serbest not detay penceresinden eklenir; not gelene
 * kadar satır "Not bekliyor" rozetiyle durur.
 *
 * Tek form, iki gönderme düğmesi: ikisi de aynı server action'a gider,
 * niyet düğmenin `name="niyet"` değerinden okunur. İki ayrı `useActionState`
 * kullanılsaydı alanların hangi durumdan geri doldurulacağı belirsizleşirdi.
 */

export type VeliGorusmesiSatiri = {
  id: string;
  tarih: Date;
  gorusmeciAdi: string;
  cevaplar: MiniTestCevabi[];
  brief: VeliBriefi;
  not: string | null;
  notGuncellemeZamani: Date | null;
  ekleyen: string | null;
  eklenmeTarihi: Date;
};

/** `puanlama-formu.tsx` ile aynı ölçü: telefonda 44px hedef. */
const DOKUNMA_HEDEFI =
  "flex min-h-[2.75rem] items-center justify-center px-3 " +
  "sm:inline-flex sm:min-h-0 sm:py-1.5";

function GondermeButonlari({ vazgec }: { vazgec: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Önizleme isteğe bağlı bir ara adım: brief hazırlanmadan da
          kaydedilebilir, kayıt brief'i zaten sunucuda üretiyor. */}
      <Buton
        type="submit"
        name="niyet"
        value="onizleme"
        tur="ikincil"
        disabled={pending}
      >
        {pending ? "Hazırlanıyor…" : "Cevapla — brief hazırla"}
      </Buton>
      <Buton type="submit" name="niyet" value="kaydet" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Görüşmeyi ve brief'i kaydet"}
      </Buton>
      <Buton type="button" tur="sade" onClick={vazgec}>
        Vazgeç
      </Buton>
    </div>
  );
}

/**
 * Mini testin bir sorusu — stajyer puanlama formundaki `SoruSatiri` deseninin
 * yerel kopyası (o bileşen dışa açık değil ve kendi form tipine bağlı).
 * Seçim denetimli: seçilen puanın anlamı satırın altında yazılır ve React 19
 * form sıfırlaması denetimli girdileri etkilemediği için önizleme dönüşünde
 * cevaplar yerinde kalır.
 */
function MiniTestSatiri({
  anahtar,
  metin,
  sira,
  hata,
  varsayilan,
}: {
  anahtar: string;
  metin: string;
  sira: number;
  hata?: string;
  varsayilan?: string;
}) {
  const [secim, setSecim] = useState<string>(varsayilan ?? "");

  return (
    <fieldset
      className={cn(
        "rounded-md border px-3 py-3",
        hata ? "border-red-300 bg-red-50" : "border-yuzey-200",
      )}
    >
      <legend className="px-1 text-sm text-zinc-800">
        <span className="text-zinc-400">{sira}.</span> {metin}
      </legend>

      <div className="mt-2 grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
        {["1", "2", "3", "4", "5"].map((deger) => (
          <label
            key={deger}
            title={PUAN_ACIKLAMALARI[Number(deger)]}
            className="cursor-pointer"
          >
            <input
              type="radio"
              name={`cevap-${anahtar}`}
              value={deger}
              checked={secim === deger}
              onChange={(olay) => setSecim(olay.target.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                DOKUNMA_HEDEFI,
                "rounded-md border border-yuzey-200 bg-white text-sm text-zinc-700",
                "hover:bg-marka-50 peer-checked:border-marka-600 peer-checked:bg-marka-50 peer-checked:font-medium peer-checked:text-marka-700",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-marka-100",
              )}
            >
              {deger}
            </span>
            <span className="sr-only">{PUAN_ACIKLAMALARI[Number(deger)]}</span>
          </label>
        ))}
      </div>

      {secim ? (
        <p className="mt-2 text-xs text-zinc-600">
          {secim} — {PUAN_ACIKLAMALARI[Number(secim)]}
        </p>
      ) : null}
      {hata ? <p className="mt-2 text-xs text-red-600">{hata}</p> : null}
    </fieldset>
  );
}

/** Brief'in iki bölümü — önizlemede ve detay penceresinde aynı görünüm. */
function BriefGorunumu({ brief }: { brief: VeliBriefi }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-zinc-900">
          Mini test yorumu
        </h4>
        <div className="mt-1 space-y-1.5">
          {brief.miniTestParagraflari.map((paragraf, sira) => (
            <p key={sira} className="text-sm leading-relaxed text-zinc-700">
              {paragraf}
            </p>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-zinc-900">
          Atölye özeti{" "}
          <span className="font-normal text-zinc-500">
            (görüşme tarihine kadar)
          </span>
        </h4>
        <div className="mt-1 space-y-1.5">
          {brief.atolyeParagraflari.map((paragraf, sira) => (
            <p key={sira} className="text-sm leading-relaxed text-zinc-700">
              {paragraf}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function VeliGorusmeleriBolumu({
  ogrenciId,
  gorusmeler,
  bugunMetni,
}: {
  ogrenciId: string;
  gorusmeler: VeliGorusmesiSatiri[];
  /** Formun varsayılan tarihi (YYYY-AA-GG) — sunucudan gelir, saat dilimi kaymaz. */
  bugunMetni: string;
}) {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<VeliGorusmesiEylemDurumu, FormData>(
    veliGorusmesiGonder.bind(null, ogrenciId),
    {},
  );

  // Başarıdan sonra form kapanır (öğrenci görüşmeleri bölümündeki desen).
  const [gorulenBasari, setGorulenBasari] = useState(durum.basari);
  if (durum.basari !== gorulenBasari) {
    setGorulenBasari(durum.basari);
    if (durum.basari) setAcik(false);
  }

  // React 19, eylem bitince formu sıfırlıyor — önizlemede de. Eylem
  // girilenleri geri döndürüyor; metin alanları buradan, mini test cevapları
  // ise denetimli oldukları için kendi durumlarından geri gelir.
  const deger = (alan: string) => durum.degerler?.[alan];

  const [islemDurumu, setIslemDurumu] = useState<VeliGorusmesiEylemDurumu>({});
  const [isleniyor, islemeBasla] = useTransition();

  const [secili, setSecili] = useState<VeliGorusmesiSatiri | null>(null);
  const pencereRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const pencere = pencereRef.current;
    if (!pencere) return;
    if (secili && !pencere.open) pencere.showModal();
    if (!secili && pencere.open) pencere.close();
  }, [secili]);

  function sil(gorusme: VeliGorusmesiSatiri) {
    if (
      !window.confirm(
        `${tarihBicimle(gorusme.tarih)} tarihli veli görüşmesi (${gorusme.gorusmeciAdi}) brief'i ve notuyla birlikte silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
      )
    ) {
      return;
    }
    islemeBasla(async () => {
      const sonuc = await veliGorusmesiSil(gorusme.id);
      setIslemDurumu(sonuc);
      if (sonuc.basari) setSecili(null);
    });
  }

  // Not kaydı silmeyle aynı desende (useTransition + doğrudan çağrı): eylemin
  // hedefi o an açık olan görüşme, `useActionState`e önceden bağlanamıyor.
  function notKaydet(formVerisi: FormData) {
    const gorusme = secili;
    if (!gorusme) return;
    islemeBasla(async () => {
      const sonuc = await veliGorusmesiNotuKaydet(gorusme.id, {}, formVerisi);
      setIslemDurumu(sonuc);
      // Başarıda pencere kapanır; liste tazelenince rozet "Tamamlandı" olur.
      if (sonuc.basari) setSecili(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Veli görüşmeleri
          {gorusmeler.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {gorusmeler.length} görüşme
            </span>
          ) : null}
        </h2>
        {!acik ? (
          <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
            + Veli görüşmesi ekle
          </Buton>
        ) : null}
      </div>

      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {islemDurumu.basari ? (
        <Bildirim tur="basari">{islemDurumu.basari}</Bildirim>
      ) : null}
      {islemDurumu.hata ? (
        <Bildirim tur="hata">{islemDurumu.hata}</Bildirim>
      ) : null}

      {acik ? (
        <Kart className="space-y-4 p-4">
          <p className="text-sm text-zinc-600">
            Mini testi görüşmeyi yapacak kişi doldurur; sistem cevaplardan ve
            öğrencinin görüşme tarihine kadarki atölye puanlamalarından bir
            görüşme brief&apos;i hazırlar. Veli görüşmeleri stajyerlere
            görünmez.
          </p>

          <form action={eylem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Alan
                etiket="Görüşme tarihi"
                ipucu="İleri bir tarih seçilebilir — brief o tarihe kadarki puanlamaları özetler."
                hata={durum.alanHatalari?.tarih}
              >
                <Girdi
                  name="tarih"
                  type="date"
                  defaultValue={deger("tarih") ?? bugunMetni}
                />
              </Alan>

              <Alan
                etiket="Görüşmeyi yapacak kişi"
                hata={durum.alanHatalari?.gorusmeciAdi}
              >
                <Girdi
                  name="gorusmeciAdi"
                  defaultValue={deger("gorusmeciAdi")}
                  placeholder="Örn. Ayşe Yılmaz"
                  autoFocus
                />
              </Alan>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-700">
                Mini test{" "}
                <span className="font-normal text-zinc-500">
                  · öğrencinin genel durumu (1 düşük · 5 yüksek)
                </span>
              </p>
              {MINI_TEST_SORULARI.map((soru, sira) => (
                <MiniTestSatiri
                  key={soru.anahtar}
                  anahtar={soru.anahtar}
                  metin={soru.metin}
                  sira={sira + 1}
                  hata={durum.alanHatalari?.[`cevap-${soru.anahtar}`]}
                  varsayilan={deger(`cevap-${soru.anahtar}`)}
                />
              ))}
            </div>

            {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

            <GondermeButonlari vazgec={() => setAcik(false)} />
          </form>

          {durum.brief ? (
            <div className="rounded-md border border-marka-200 bg-marka-50/50 p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-marka-700">
                Brief önizlemesi — henüz kaydedilmedi
              </p>
              <BriefGorunumu brief={durum.brief} />
            </div>
          ) : null}
        </Kart>
      ) : null}

      {gorusmeler.length === 0 && !acik ? (
        <BosDurum
          baslik="Henüz veli görüşmesi kaydı yok."
          aciklama="Görüşmeden önce mini testi doldurup brief hazırlayabilir, görüşme sonrası notunu ekleyebilirsiniz. Kayıtlar stajyerlere görünmez."
        />
      ) : (
        <div className="space-y-2">
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
                <Rozet tur={gorusme.not ? "olumlu" : "notr"}>
                  {gorusme.not ? "Tamamlandı" : "Not bekliyor"}
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
        className="m-auto w-[min(38rem,calc(100vw-2rem))] rounded-lg bg-white p-0 shadow-2xl backdrop:bg-marka-950/50"
      >
        {secili ? (
          <div className="flex max-h-[85vh] flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-yuzey-100 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-zinc-900">
                    {tarihBicimle(secili.tarih)}
                  </h3>
                  <Rozet tur={secili.not ? "olumlu" : "notr"}>
                    {secili.not ? "Tamamlandı" : "Not bekliyor"}
                  </Rozet>
                </div>
                <p className="mt-0.5 text-sm text-zinc-600">
                  Görüşmeyi yapan: {secili.gorusmeciAdi}
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

            <div className="space-y-5 overflow-y-auto p-4">
              <BriefGorunumu brief={secili.brief} />

              <div>
                <h4 className="text-sm font-semibold text-zinc-900">
                  Mini test cevapları
                </h4>
                <ul className="mt-1 space-y-1">
                  {secili.cevaplar.map((cevap) => (
                    <li
                      key={cevap.anahtar}
                      className="flex items-baseline justify-between gap-3 text-sm text-zinc-700"
                    >
                      <span>{cevap.soruMetni}</span>
                      <span className="shrink-0 font-medium text-zinc-900">
                        {cevap.deger}/5
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-zinc-900">
                  Görüşme notu
                </h4>
                {secili.not ? (
                  <>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                      {secili.not}
                    </p>
                    {secili.notGuncellemeZamani ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Not güncellemesi:{" "}
                        {tarihBicimle(secili.notGuncellemeZamani)}
                      </p>
                    ) : null}
                  </>
                ) : null}

                {/* Not görüşmeden SONRA yazılır; varsa da üzerine yazılabilir
                    (dört alanlık kaydın kendisi düzenlenmez, yalnızca not). */}
                <form action={notKaydet} className="mt-2 space-y-2">
                  <CokSatirli
                    name="not"
                    rows={3}
                    defaultValue={secili.not ?? ""}
                    placeholder="Görüşmede konuşulanlar, velinin ilettikleri, kararlar…"
                  />
                  {islemDurumu.alanHatalari?.not ? (
                    <p className="text-xs text-red-600">
                      {islemDurumu.alanHatalari.not}
                    </p>
                  ) : null}
                  <Buton type="submit" tur="ikincil" disabled={isleniyor}>
                    {isleniyor
                      ? "Kaydediliyor…"
                      : secili.not
                        ? "Notu güncelle"
                        : "Notu kaydet"}
                  </Buton>
                </form>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-yuzey-100 p-4">
              <span className="text-xs text-zinc-500">
                Ekleyen: {secili.ekleyen ?? "—"} ·{" "}
                {tarihBicimle(secili.eklenmeTarihi)}
              </span>
              <Buton
                type="button"
                tur="tehlike"
                disabled={isleniyor}
                onClick={() => sil(secili)}
              >
                {isleniyor ? "İşleniyor…" : "Sil"}
              </Buton>
            </footer>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
