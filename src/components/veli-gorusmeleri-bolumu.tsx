"use client";

import { useState } from "react";
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import {
  BolumUstu,
  DetaySatiri,
  PencereAltBilgisi,
  SilDugmesi,
  useEklemePaneli,
  useSunucuIslemi,
} from "@/components/bolum-iskeleti";
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
import { cn } from "@/lib/utils";
import { tarihBicimle } from "@/lib/tarih";
import { PUAN_ACIKLAMALARI } from "@/lib/puan-hesaplari";
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
} from "@/app/koordinator/danismanlik/veli-gorusme-eylemleri";

/**
 * Veli görüşmeleri bölümü.
 *
 * İki modda çalışır:
 *   - "yonetim": Danışmanlık sayfası — mini test + brief hazırlama, kayıt,
 *     not ekleme ve silme; öğrenci formdaki seçiciden gelir.
 *   - "okuma":  Öğrenci profili — yalnızca o öğrencinin listesi ve detay
 *     penceresi (brief ve not okunur); bütün yazma işlemleri Danışmanlık
 *     sayfasına yönlendirilir.
 *
 * GİZLİLİK: Her iki mod da yalnızca koordinatör ekranlarında kullanılır;
 * veli görüşmesi verisi stajyer ekranlarının hiçbirine gitmez.
 *
 * Akış (yönetim): koordinatör öğrenci + tarih + görüşmeci + 3 soruluk mini
 * testi doldurur, "Cevapla" ile brief ÖNİZLEMESİ formun altında açılır
 * (hiçbir şey yazılmaz), "Kaydet" görüşmeyi brief'iyle birlikte saklar.
 * Görüşme yapıldıktan sonra serbest not detay penceresinden eklenir; not
 * gelene kadar satır "Not bekliyor" rozetiyle durur.
 *
 * Tek form, iki gönderme düğmesi: ikisi de aynı server action'a gider,
 * niyet düğmenin `name="niyet"` değerinden okunur.
 */

export type VeliGorusmesiSatiri = {
  id: string;
  ogrenciAdi: string;
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Önizleme isteğe bağlı bir ara adım: brief hazırlanmadan da
          kaydedilebilir, kayıt brief'i zaten sunucuda üretiyor. */}
      <GonderButonu
        name="niyet"
        value="onizleme"
        tur="ikincil"
        bekleyenEtiket="Hazırlanıyor…"
      >
        Cevapla — brief hazırla
      </GonderButonu>
      <GonderButonu name="niyet" value="kaydet">
        {"Görüşmeyi ve brief'i kaydet"}
      </GonderButonu>
      <Buton type="button" tur="sade" onClick={vazgec}>
        Vazgeç
      </Buton>
    </div>
  );
}

/**
 * Mini testin bir sorusu — stajyer puanlama formundaki `SoruSatiri` deseninin
 * yerel kopyası (o bileşen dışa açık değil ve kendi form tipine bağlı).
 *
 * Radio'lar bilinçli olarak DENETİMSİZ (`defaultChecked`): React 19 form
 * sıfırlaması denetimli radio'yu bile DOM'da boşaltıyor (canlıda görüldü —
 * önizleme dönüşünde işaretler kayboluyor, sonrasında kaydet boş cevapla
 * giderdi). Metin alanlarındaki `degerler` + `defaultValue` deseninin aynısı
 * burada `defaultChecked` ile kurulu: sıfırlama anında React güncel
 * varsayılanı uygular, cevaplar geri gelir. `secim` yalnızca puanın anlamını
 * satır altında yazmak için tutulur.
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
              defaultChecked={varsayilan === deger}
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
  mod,
  gorusmeler,
  ogrenciSecenekleri = [],
  bugunMetni = "",
  suzgecEtkin = false,
}: {
  mod: "yonetim" | "okuma";
  /** Gösterilecek görüşmeler — süzme SAYFADA yapılır (adres tabanlı süzgeçler). */
  gorusmeler: VeliGorusmesiSatiri[];
  /** Yalnızca yönetim modunda: ekleme formundaki öğrenciler. */
  ogrenciSecenekleri?: { id: string; ad: string }[];
  /** Formun varsayılan tarihi (YYYY-AA-GG) — sunucudan gelir, saat dilimi kaymaz. */
  bugunMetni?: string;
  /** Sayfadaki süzgeçlerden en az biri etkin mi — boş listenin metnini seçer. */
  suzgecEtkin?: boolean;
}) {
  const yonetim = mod === "yonetim";

  // Ekleme paneli + form durumu iskeletten; mini test cevapları `degerler`
  // üzerinden `defaultChecked` ile geri gelir (aşağıdaki MiniTestSatiri notu).
  const { acik, setAcik, durum, eylem, deger } =
    useEklemePaneli<VeliGorusmesiEylemDurumu>(veliGorusmesiGonder);

  // Tek işlem durumu hem silmeyi hem not kaydetmeyi taşır (ikisi de pencerede).
  const islem = useSunucuIslemi<VeliGorusmesiEylemDurumu>();

  const [secili, setSecili] = useState<VeliGorusmesiSatiri | null>(null);

  function sil(gorusme: VeliGorusmesiSatiri) {
    islem.calistir(() => veliGorusmesiSil(gorusme.id), {
      onay: `${tarihBicimle(gorusme.tarih)} tarihli veli görüşmesi (${gorusme.ogrenciAdi} · ${gorusme.gorusmeciAdi}) brief'i ve notuyla birlikte silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
      basarida: () => setSecili(null),
    });
  }

  const bosDurum = suzgecEtkin ? (
    <BosDurum
      baslik="Süzgece uyan veli görüşmesi yok."
      aciklama="Üstteki süzgeçleri değiştirin."
    />
  ) : (
    <BosDurum
      baslik="Henüz veli görüşmesi kaydı yok."
      aciklama={
        yonetim
          ? "Görüşmeden önce mini testi doldurup brief hazırlayabilir, görüşme sonrası notunu ekleyebilirsiniz. Kayıtlar stajyerlere görünmez."
          : "Veli görüşmeleri Danışmanlık sayfasından eklenir."
      }
    />
  );

  // Not kaydı silmeyle aynı desende (useTransition + doğrudan çağrı): eylemin
  // hedefi o an açık olan görüşme, `useActionState`e önceden bağlanamıyor.
  function notKaydet(formVerisi: FormData) {
    const gorusme = secili;
    if (!gorusme) return;
    // Başarıda pencere kapanır; liste tazelenince rozet "Tamamlandı" olur.
    islem.calistir(() => veliGorusmesiNotuKaydet(gorusme.id, {}, formVerisi), {
      basarida: () => setSecili(null),
    });
  }

  return (
    <div className="space-y-3">
      <BolumUstu
        baslik="Veli görüşmeleri"
        adet={gorusmeler.length}
        adetEtiketi="görüşme"
        aksiyon={
          yonetim && !acik ? (
            <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
              + Veli görüşmesi ekle
            </Buton>
          ) : !yonetim ? (
            <Link href="/koordinator/danismanlik" className={baglantiStili}>
              Danışmanlık sayfasında yönetilir
            </Link>
          ) : null
        }
      />

      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {islem.durum.basari ? (
        <Bildirim tur="basari">{islem.durum.basari}</Bildirim>
      ) : null}
      {islem.durum.hata ? (
        <Bildirim tur="hata">{islem.durum.hata}</Bildirim>
      ) : null}

      {yonetim && acik ? (
        <Kart className="space-y-4 p-4">
          <p className="text-sm text-zinc-600">
            Mini testi görüşmeyi yapacak kişi doldurur; sistem cevaplardan ve
            öğrencinin görüşme tarihine kadarki atölye puanlamalarından bir
            görüşme brief&apos;i hazırlar. Veli görüşmeleri stajyerlere
            görünmez.
          </p>

          <form action={eylem} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
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
        bosDurum
      ) : (
        <div className="space-y-2">
          {gorusmeler.map((gorusme) => (
            <DetaySatiri key={gorusme.id} onClick={() => setSecili(gorusme)}>
              <span className="font-medium text-zinc-900">
                {tarihBicimle(gorusme.tarih)}
              </span>
              {yonetim ? (
                <span className="font-medium text-zinc-900">
                  {gorusme.ogrenciAdi}
                </span>
              ) : null}
              <Rozet tur={gorusme.not ? "olumlu" : "notr"}>
                {gorusme.not ? "Tamamlandı" : "Not bekliyor"}
              </Rozet>
              <span className="truncate text-sm text-zinc-600">
                {gorusme.gorusmeciAdi}
              </span>
            </DetaySatiri>
          ))}
        </div>
      )}

      {/* --- Detay penceresi --- */}
      <Pencere
        acik={Boolean(secili)}
        onKapat={() => setSecili(null)}
        genislik="38rem"
        govdeSinifi="space-y-5 overflow-y-auto p-4"
        baslik={
          secili ? (
            <>
              <h3 className="text-base font-semibold text-zinc-900">
                {tarihBicimle(secili.tarih)}
              </h3>
              <Rozet tur={secili.not ? "olumlu" : "notr"}>
                {secili.not ? "Tamamlandı" : "Not bekliyor"}
              </Rozet>
            </>
          ) : null
        }
        altBaslik={
          secili
            ? `${secili.ogrenciAdi} · Görüşmeyi yapan: ${secili.gorusmeciAdi}`
            : null
        }
        altKisim={
          secili ? (
            <PencereAltBilgisi
              bilgi={
                <>
                  Ekleyen: {secili.ekleyen ?? "—"} ·{" "}
                  {tarihBicimle(secili.eklenmeTarihi)}
                </>
              }
              silmeDugmesi={
                yonetim ? (
                  <SilDugmesi
                    calisiyor={islem.calisiyor}
                    calisiyorEtiketi="İşleniyor…"
                    onClick={() => sil(secili)}
                  />
                ) : undefined
              }
            />
          ) : null
        }
      >
        {secili ? (
          <>
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
              ) : !yonetim ? (
                <p className="mt-1 text-sm text-zinc-500">
                  Henüz not eklenmedi.
                </p>
              ) : null}

              {/* Not görüşmeden SONRA yazılır; varsa da üzerine yazılabilir
                  (kaydın kendisi düzenlenmez, yalnızca not). Okuma modunda
                  form yok — not Danışmanlık sayfasından girilir. */}
              {yonetim ? (
                <form action={notKaydet} className="mt-2 space-y-2">
                  <CokSatirli
                    name="not"
                    rows={3}
                    defaultValue={secili.not ?? ""}
                    placeholder="Görüşmede konuşulanlar, velinin ilettikleri, kararlar…"
                  />
                  {islem.durum.alanHatalari?.not ? (
                    <p className="text-xs text-red-600">
                      {islem.durum.alanHatalari.not}
                    </p>
                  ) : null}
                  <Buton type="submit" tur="ikincil" disabled={islem.calisiyor}>
                    {islem.calisiyor
                      ? "Kaydediliyor…"
                      : secili.not
                        ? "Notu güncelle"
                        : "Notu kaydet"}
                  </Buton>
                </form>
              ) : null}
            </div>
          </>
        ) : null}
      </Pencere>
    </div>
  );
}
