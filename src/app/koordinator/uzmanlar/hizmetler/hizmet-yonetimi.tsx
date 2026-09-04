"use client";

import { useActionState, useState, useTransition } from "react";
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import {
  Alan,
  Bildirim,
  BosDurum,
  Buton,
  Girdi,
  Kart,
  Rozet,
  secimStili,
} from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import {
  hizmetDurumDegistir,
  hizmetEkle,
  hizmetGuncelle,
} from "../actions";
import { kurustanLiraya, paraMetni, sureMetni } from "../sema";

export type HizmetSatiri = {
  id: string;
  ad: string;
  grup: "TEST" | "DANISMANLIK" | "ATOLYE";
  sureDk: number;
  ucretKurus: number;
  yasAlt: number | null;
  yasUst: number | null;
  danisanTuru: "COCUK" | "VELI";
  tekrarli: boolean;
  aktif: boolean;
  uzmanSayisi: number;
};

const GRUP_ADLARI = {
  TEST: "Zekâ testi",
  DANISMANLIK: "Danışmanlık",
  ATOLYE: "Atölye görüşmesi",
} as const;

export function HizmetYonetimi({
  hizmetler,
  duzenleyebilir,
}: {
  hizmetler: HizmetSatiri[];
  duzenleyebilir: boolean;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [bekliyor, basla] = useTransition();
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<HizmetSatiri | null>(null);

  const kapat = () => {
    setFormAcik(false);
    setDuzenlenen(null);
  };

  return (
    <div className="space-y-4">
      {mesaj?.basari ? <Bildirim tur="basari">{mesaj.basari}</Bildirim> : null}
      {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

      {duzenleyebilir ? (
        <Buton
          type="button"
          onClick={() => {
            setDuzenlenen(null);
            setFormAcik(true);
          }}
        >
          Hizmet ekle
        </Buton>
      ) : null}

      {hizmetler.length === 0 ? (
        <BosDurum
          baslik="Katalog boş"
          aciklama="Hizmetler eklendikçe randevu formunda seçilebilir olacak."
        />
      ) : (
        <div className="space-y-2">
          {hizmetler.map((hizmet) => (
            <Kart key={hizmet.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">
                      {hizmet.ad}
                    </span>
                    <Rozet tur="notr">{GRUP_ADLARI[hizmet.grup]}</Rozet>
                    {hizmet.tekrarli ? (
                      <Rozet tur="olumlu">Haftalık tekrar</Rozet>
                    ) : null}
                    {hizmet.danisanTuru === "VELI" ? (
                      <Rozet tur="notr">Danışan: veli</Rozet>
                    ) : null}
                    {hizmet.aktif ? null : <Rozet tur="pasif">Pasif</Rozet>}
                  </div>

                  <p className="mt-1 text-sm text-zinc-600">
                    {sureMetni(hizmet.sureDk)} ·{" "}
                    {hizmet.ucretKurus === 0
                      ? "Ücretsiz"
                      : paraMetni(hizmet.ucretKurus)}
                    {hizmet.yasAlt !== null || hizmet.yasUst !== null
                      ? ` · ${hizmet.yasAlt ?? 0}–${hizmet.yasUst ?? "…"} yaş`
                      : null}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {hizmet.uzmanSayisi === 0
                      ? // Yetkin uzmanı olmayan hizmet randevuda hiç seçilemez.
                        "Bu hizmeti yapabilen uzman atanmamış"
                      : `${hizmet.uzmanSayisi} uzman yapabiliyor`}
                  </p>
                </div>

                {duzenleyebilir ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Buton
                      type="button"
                      tur="ikincil"
                      onClick={() => {
                        setDuzenlenen(hizmet);
                        setFormAcik(true);
                      }}
                    >
                      Düzenle
                    </Buton>
                    <Buton
                      type="button"
                      tur={hizmet.aktif ? "tehlike" : "ikincil"}
                      disabled={bekliyor}
                      onClick={() =>
                        basla(async () =>
                          setMesaj(
                            await hizmetDurumDegistir(hizmet.id, !hizmet.aktif),
                          ),
                        )
                      }
                    >
                      {hizmet.aktif ? "Pasife al" : "Geri aç"}
                    </Buton>
                  </div>
                ) : null}
              </div>
            </Kart>
          ))}
        </div>
      )}

      <HizmetFormu
        acik={formAcik}
        hizmet={duzenlenen}
        onKapat={kapat}
      />
    </div>
  );
}

function HizmetFormu({
  acik,
  hizmet,
  onKapat,
}: {
  acik: boolean;
  hizmet: HizmetSatiri | null;
  onKapat: () => void;
}) {
  /**
   * Kayıt BAŞARILIYSA pencere kapanır (ekleme ve düzenleme, ikisi de).
   *
   * Düzenlemede pencere açık bırakılmıştı ve kaydeden kullanıcı hiçbir şey
   * göremiyordu: alanlar `defaultValue` ile açılış değerini gösterdiği için
   * pencere kaydedilmiş yeni fiyatı değil ESKİSİNİ yazmaya devam ediyordu.
   * Kaydettiğini anlamayan kullanıcı ikinci kez kaydediyor. Panelin başka
   * yerlerindeki karar da bu: pencereler kaydedince kapanır.
   */
  const [durum, gonder] = useActionState<EylemDurumu, FormData>(
    async (_onceki, veri) => {
      const sonuc = hizmet
        ? await hizmetGuncelle(hizmet.id, _onceki, veri)
        : await hizmetEkle(_onceki, veri);
      if (sonuc.basari) onKapat();
      return sonuc;
    },
    {},
  );

  if (!acik) return null;

  return (
    <Pencere
      acik={acik}
      onKapat={onKapat}
      baslik={hizmet ? hizmet.ad : "Yeni hizmet"}
      altBaslik="Fiyat değişikliği GEÇMİŞE İŞLEMEZ: randevu açılırken o günkü ücret kayda kopyalanıyor."
      genislik="38rem"
      /* Alt boşluk YOK: yapışkan eylem şeridi pencerenin dibine tam
         otursun diye. `p-4` bırakılsaydı şerit 16px yukarıda durur ve
         altından form içeriği görünürdü. */
      govdeSinifi="space-y-4 overflow-y-auto px-4 pt-4"
    >
      <form action={gonder} className="space-y-4">
        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        <Alan etiket="Hizmet adı" hata={durum.alanHatalari?.ad}>
          <Girdi
            name="ad"
            defaultValue={durum.degerler?.ad ?? hizmet?.ad ?? ""}
            required
            autoFocus
          />
        </Alan>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Grup" hata={durum.alanHatalari?.grup}>
            <select
              name="grup"
              className={secimStili}
              defaultValue={hizmet?.grup ?? "DANISMANLIK"}
            >
              <option value="TEST">Zekâ testi</option>
              <option value="DANISMANLIK">Danışmanlık</option>
              <option value="ATOLYE">Atölye görüşmesi</option>
            </select>
          </Alan>

          <Alan etiket="Danışan" hata={durum.alanHatalari?.danisanTuru}>
            <select
              name="danisanTuru"
              className={secimStili}
              defaultValue={hizmet?.danisanTuru ?? "COCUK"}
            >
              <option value="COCUK">Çocuk</option>
              <option value="VELI">Veli</option>
            </select>
          </Alan>

          <Alan
            etiket="Süre (dakika)"
            hata={durum.alanHatalari?.sureDk}
            ipucu="Randevunun bitiş saati bundan hesaplanır."
          >
            {/* `min` ve `step` UYUMLU OLMAK ZORUNDA: tarayıcı geçerli
                değerleri `min`den başlayarak sayıyor, yani min=1/step=5
                ikilisinde 120 GEÇERSİZ oluyor (1, 6, 11 … 116, 121) ve
                katalogdaki bütün süreler (30/60/90/120) reddediliyordu.
                Form sessizce gönderilmiyor, kullanıcıya da "düğme
                çalışmıyor" gibi görünüyordu. min=5 ile ikisi hizalandı. */}
            <Girdi
              name="sureDk"
              type="number"
              min={5}
              max={480}
              step={5}
              defaultValue={durum.degerler?.sureDk ?? hizmet?.sureDk ?? 60}
              required
            />
          </Alan>

          <Alan
            etiket="Ücret (₺)"
            hata={durum.alanHatalari?.ucretLira}
            ipucu="Ücretsiz hizmet için 0 yazın."
          >
            <Girdi
              name="ucretLira"
              type="number"
              min={0}
              step="0.01"
              defaultValue={
                durum.degerler?.ucretLira ??
                (hizmet ? kurustanLiraya(hizmet.ucretKurus) : 0)
              }
              required
            />
          </Alan>

          <Alan etiket="Alt yaş" hata={durum.alanHatalari?.yasAlt}>
            <Girdi
              name="yasAlt"
              type="number"
              min={0}
              max={120}
              defaultValue={durum.degerler?.yasAlt ?? hizmet?.yasAlt ?? ""}
            />
          </Alan>

          <Alan etiket="Üst yaş" hata={durum.alanHatalari?.yasUst}>
            <Girdi
              name="yasUst"
              type="number"
              min={0}
              max={120}
              defaultValue={durum.degerler?.yasUst ?? hizmet?.yasUst ?? ""}
            />
          </Alan>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="tekrarli"
            defaultChecked={hizmet?.tekrarli ?? false}
            className="size-4"
          />
          <span>
            Haftalık tekrara açık
            <span className="block text-xs text-zinc-500">
              Danışmanlık seansları bir sonraki haftaya kendiliğinden eklenir;
              zekâ testleri her seferinde elle girilir.
            </span>
          </span>
        </label>
        {/* Yapışkan eylem şeridi. 800×450'lik bir dizüstü ekranında form
            gövdesi pencereyi taşırıyor ve "Kaydet" katlamanın altında
            kalıyordu — kullanıcı kaydetmek için modal içinde kaydırmak
            zorundaydı. Düğmeler FORMUN İÇİNDE kalmak zorunda: `useFormStatus`
            yalnız form ağacında çalışıyor, alt şeride taşınsalardı
            "Kaydediliyor…" durumu ve çift gönderim kilidi kaybolurdu. */}
        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-white/70 bg-[var(--color-yuzey-50)] px-4 py-3">
          <Buton type="button" tur="sade" onClick={onKapat}>
            Vazgeç
          </Buton>
          <GonderButonu>{hizmet ? "Kaydet" : "Hizmeti ekle"}</GonderButonu>
        </div>
      </form>
    </Pencere>
  );
}
