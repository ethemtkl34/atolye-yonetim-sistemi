"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import {
  Alan,
  Bildirim,
  BosDurum,
  Buton,
  Girdi,
  Kart,
  Rozet,
  baglantiStili,
  butonStili,
  secimStili,
} from "@/components/ui";
import { UZMAN_RENKLERI, uzmanRengi } from "@/lib/uzman-renkleri";
import type { EylemDurumu } from "@/lib/formlar";
import { uzmanDurumDegistir, uzmanEkle, uzmanGuncelle } from "./actions";

export type HizmetSecenegi = { id: string; ad: string; grup: string };
export type SubeSecenegi = { id: string; ad: string };
export type HesapSecenegi = { id: string; ad: string; email: string };

export type UzmanSatiri = {
  id: string;
  ad: string;
  renk: string;
  calismaTipi: "TAM_ZAMANLI" | "YARI_ZAMANLI";
  aktif: boolean;
  userId: string | null;
  subeIdleri: string[];
  subeAdlari: string[];
  hizmetIdleri: string[];
  hizmetAdlari: string[];
  mesaiSayisi: number;
  izinSayisi: number;
};

const CALISMA_ADLARI = {
  TAM_ZAMANLI: "Tam zamanlı",
  YARI_ZAMANLI: "Yarı zamanlı",
} as const;

/** Renk noktası — takvimdeki ayrımın listedeki karşılığı. */
function RenkNoktasi({ renk }: { renk: string }) {
  const ton = uzmanRengi(renk);
  return (
    <span
      className="inline-block size-3 shrink-0 rounded-full ring-1 ring-black/10"
      style={{ backgroundColor: ton.metin }}
      aria-hidden
    />
  );
}

export function UzmanYonetimi({
  uzmanlar,
  subeler,
  hizmetler,
  hesaplar,
  duzenleyebilir,
}: {
  uzmanlar: UzmanSatiri[];
  subeler: SubeSecenegi[];
  hizmetler: HizmetSecenegi[];
  hesaplar: HesapSecenegi[];
  /**
   * `uzmanlar` modülünde TAM yetki var mı. Koordinatör ve danışma masası
   * kadroyu görür ama değiştiremez; asıl sınır eylemlerde (`yonetimZorunlu`),
   * burası yalnız çalışmayacak düğmeleri göstermemek için.
   */
  duzenleyebilir: boolean;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [bekliyor, basla] = useTransition();
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<UzmanSatiri | null>(null);

  const kapat = () => {
    setFormAcik(false);
    setDuzenlenen(null);
  };

  return (
    <div className="space-y-4">
      {mesaj?.basari ? <Bildirim tur="basari">{mesaj.basari}</Bildirim> : null}
      {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

      {duzenleyebilir ? (
        <div className="flex flex-wrap gap-2">
          <Buton
            type="button"
            onClick={() => {
              setDuzenlenen(null);
              setFormAcik(true);
            }}
          >
            Uzman ekle
          </Buton>
          <Link
            href="/koordinator/uzmanlar/hizmetler"
            className={butonStili("ikincil")}
          >
            Hizmet kataloğu
          </Link>
        </div>
      ) : (
        <Link
          href="/koordinator/uzmanlar/hizmetler"
          className={butonStili("ikincil")}
        >
          Hizmet kataloğu
        </Link>
      )}

      {uzmanlar.length === 0 ? (
        <BosDurum
          baslik="Henüz uzman yok"
          aciklama={
            duzenleyebilir
              ? "Seansları verecek uzmanları ekleyin; randevu takvimi bu kadroyu kullanacak."
              : "Kadroyu şube yöneticisi ekler."
          }
        />
      ) : (
        <div className="space-y-2">
          {uzmanlar.map((uzman) => (
            <Kart key={uzman.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <RenkNoktasi renk={uzman.renk} />
                    <span className="font-medium text-zinc-900">
                      {uzman.ad}
                    </span>
                    <Rozet
                      tur={
                        uzman.calismaTipi === "YARI_ZAMANLI" ? "pasif" : "notr"
                      }
                    >
                      {CALISMA_ADLARI[uzman.calismaTipi]}
                    </Rozet>
                    {uzman.subeAdlari.map((ad) => (
                      <Rozet key={ad} tur="notr">
                        {ad}
                      </Rozet>
                    ))}
                    {uzman.aktif ? null : <Rozet tur="pasif">Pasif</Rozet>}
                  </div>

                  <p className="mt-1 text-sm text-zinc-600">
                    {uzman.hizmetAdlari.length === 0 ? (
                      // Yetkinliği olmayan uzmana randevu açılamaz; bu, sessiz
                      // kalınacak bir eksik değil.
                      <span className="text-vurgu-700">
                        Yetkinlik atanmamış — randevu formunda seçilemez
                      </span>
                    ) : (
                      uzman.hizmetAdlari.join(" · ")
                    )}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {uzman.mesaiSayisi === 0
                      ? "Mesai tanımlı değil"
                      : `${uzman.mesaiSayisi} mesai aralığı`}
                    {" · "}
                    {uzman.izinSayisi === 0
                      ? "izin yok"
                      : `${uzman.izinSayisi} izin`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/koordinator/uzmanlar/${uzman.id}`}
                    className={baglantiStili}
                  >
                    Mesai ve izin
                  </Link>
                  {duzenleyebilir ? (
                    <>
                      <Buton
                        type="button"
                        tur="ikincil"
                        onClick={() => {
                          setDuzenlenen(uzman);
                          setFormAcik(true);
                        }}
                      >
                        Düzenle
                      </Buton>
                      <Buton
                        type="button"
                        tur={uzman.aktif ? "tehlike" : "ikincil"}
                        disabled={bekliyor}
                        onClick={() =>
                          basla(async () =>
                            setMesaj(
                              await uzmanDurumDegistir(uzman.id, !uzman.aktif),
                            ),
                          )
                        }
                      >
                        {uzman.aktif ? "Pasife al" : "Geri aç"}
                      </Buton>
                    </>
                  ) : null}
                </div>
              </div>
            </Kart>
          ))}
        </div>
      )}

      <UzmanFormu
        acik={formAcik}
        uzman={duzenlenen}
        subeler={subeler}
        hizmetler={hizmetler}
        hesaplar={hesaplar}
        onKapat={kapat}
      />
    </div>
  );
}

function UzmanFormu({
  acik,
  uzman,
  subeler,
  hizmetler,
  hesaplar,
  onKapat,
}: {
  acik: boolean;
  uzman: UzmanSatiri | null;
  subeler: SubeSecenegi[];
  hizmetler: HizmetSecenegi[];
  hesaplar: HesapSecenegi[];
  onKapat: () => void;
}) {
  /** Kayıt başarılıysa pencere kapanır — gerekçe hizmet formunda yazılı. */
  const [durum, gonder] = useActionState<EylemDurumu, FormData>(
    async (_onceki, veri) => {
      const sonuc = uzman
        ? await uzmanGuncelle(uzman.id, _onceki, veri)
        : await uzmanEkle(_onceki, veri);
      if (sonuc.basari) onKapat();
      return sonuc;
    },
    {},
  );

  // Pencere kapalıyken form DOM'da durmasın: `defaultValue` ile çalışan
  // alanlar yeniden açıldığında eski değeri gösterirdi.
  if (!acik) return null;

  return (
    <Pencere
      acik={acik}
      onKapat={onKapat}
      baslik={uzman ? uzman.ad : "Yeni uzman"}
      altBaslik="Renk takvimde ayrım için; yetkinlik randevu formunda hangi hizmetlerin seçilebileceğini belirler."
      genislik="40rem"
      /* Alt boşluk YOK: yapışkan eylem şeridi pencerenin dibine tam
         otursun diye. `p-4` bırakılsaydı şerit 16px yukarıda durur ve
         altından form içeriği görünürdü. */
      govdeSinifi="space-y-4 overflow-y-auto px-4 pt-4"
    >
      <form action={gonder} className="space-y-4">
        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
        {durum.basari ? (
          <Bildirim tur="basari">{durum.basari}</Bildirim>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Ad soyad" hata={durum.alanHatalari?.ad}>
            <Girdi
              name="ad"
              defaultValue={durum.degerler?.ad ?? uzman?.ad ?? ""}
              required
              autoFocus
            />
          </Alan>

          <Alan etiket="Çalışma tipi" hata={durum.alanHatalari?.calismaTipi}>
            <select
              name="calismaTipi"
              className={secimStili}
              defaultValue={uzman?.calismaTipi ?? "TAM_ZAMANLI"}
            >
              <option value="TAM_ZAMANLI">Tam zamanlı</option>
              <option value="YARI_ZAMANLI">Yarı zamanlı</option>
            </select>
          </Alan>
        </div>

        <Alan
          etiket="Takvim rengi"
          hata={durum.alanHatalari?.renk}
          ipucu="Takvimde uzmanları ayırt etmek için; ad her zaman renkle birlikte yazılır."
        >
          <div className="flex flex-wrap gap-2">
            {UZMAN_RENKLERI.map((renk, sira) => (
              <label
                key={renk.anahtar}
                className="cursor-pointer"
                title={renk.etiket}
              >
                <input
                  type="radio"
                  name="renk"
                  value={renk.anahtar}
                  defaultChecked={
                    uzman ? uzman.renk === renk.anahtar : sira === 0
                  }
                  className="peer sr-only"
                />
                <span
                  className="block size-8 rounded-full ring-2 ring-transparent ring-offset-2 peer-checked:ring-zinc-900 peer-focus-visible:ring-marka-600"
                  style={{ backgroundColor: renk.metin }}
                />
                <span className="sr-only">{renk.etiket}</span>
              </label>
            ))}
          </div>
        </Alan>

        <Alan
          etiket="Çalıştığı şubeler"
          hata={durum.alanHatalari?.subeIdleri}
          ipucu="Uzman iki şubede birden çalışabilir; mesai saatleri şube başına ayrı tanımlanır."
        >
          <div className="flex flex-wrap gap-3">
            {subeler.map((sube) => (
              <label key={sube.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="subeIdleri"
                  value={sube.id}
                  defaultChecked={uzman?.subeIdleri.includes(sube.id) ?? false}
                  className="size-4"
                />
                {sube.ad}
              </label>
            ))}
          </div>
        </Alan>

        <Alan
          etiket="Yapabildiği hizmetler"
          hata={durum.alanHatalari?.hizmetIdleri}
          ipucu="Randevu formu yalnız bu listeyi gösterir — hatalı atama böyle engelleniyor."
        >
          <div className="kil-oyuk max-h-56 space-y-1 overflow-y-auto p-3">
            {hizmetler.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Katalogda aktif hizmet yok.
              </p>
            ) : (
              hizmetler.map((hizmet) => (
                <label
                  key={hizmet.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="hizmetIdleri"
                    value={hizmet.id}
                    defaultChecked={
                      uzman?.hizmetIdleri.includes(hizmet.id) ?? false
                    }
                    className="size-4"
                  />
                  {hizmet.ad}
                </label>
              ))
            )}
          </div>
        </Alan>

        <Alan
          etiket="Panel hesabı"
          hata={durum.alanHatalari?.userId}
          ipucu="İsteğe bağlı — uzmanların çoğu panele girmiyor."
        >
          <select
            name="userId"
            className={secimStili}
            defaultValue={uzman?.userId ?? ""}
          >
            <option value="">Hesap bağlı değil</option>
            {hesaplar.map((hesap) => (
              <option key={hesap.id} value={hesap.id}>
                {hesap.ad} ({hesap.email})
              </option>
            ))}
          </select>
        </Alan>
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
          <GonderButonu>{uzman ? "Kaydet" : "Uzmanı ekle"}</GonderButonu>
        </div>
      </form>
    </Pencere>
  );
}
