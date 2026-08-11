"use client";

import { useState } from "react";
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
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import {
  BolumUstu,
  DetaySatiri,
  PencereAltBilgisi,
  SilDugmesi,
  useEklemePaneli,
  useSunucuIslemi,
} from "@/components/bolum-iskeleti";
import { tarihBicimle } from "@/lib/tarih";
import {
  TERAPI_TURLERI,
  TERAPI_TURU_ETIKETLERI,
  type TerapiTuru,
} from "@/lib/terapi-turleri";
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
 *   - "yonetim": Danışmanlık sayfası — ekleme ve silme; öğrenci formdaki
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
 * İskelet (panel/pencere/silme durumu) `bolum-iskeleti.tsx`'ten gelir.
 */

export type TerapiGorusmesiSatiri = {
  id: string;
  ogrenciAdi: string;
  tarih: Date;
  gorusmeciAdi: string;
  tur: "PSIKOLOG" | "KOORDINATOR";
  terapiTuru: TerapiTuru;
  not: string;
  ekleyen: string | null;
  eklenmeTarihi: Date;
};

const TUR_ETIKETLERI: Record<TerapiGorusmesiSatiri["tur"], string> = {
  PSIKOLOG: "Psikolog",
  KOORDINATOR: "Koordinatör",
};

export function TerapiGorusmeleriBolumu({
  mod,
  gorusmeler,
  ogrenciSecenekleri = [],
  bugunMetni = "",
  suzgecEtkin = false,
}: {
  mod: "yonetim" | "okuma";
  /** Gösterilecek görüşmeler — süzme SAYFADA yapılır (adres tabanlı süzgeçler). */
  gorusmeler: TerapiGorusmesiSatiri[];
  /** Yalnızca yönetim modunda: ekleme formundaki öğrenciler. */
  ogrenciSecenekleri?: { id: string; ad: string }[];
  /** Formun varsayılan tarihi (YYYY-AA-GG) — sunucudan gelir, saat dilimi kaymaz. */
  bugunMetni?: string;
  /** Sayfadaki süzgeçlerden en az biri etkin mi — boş listenin metnini seçer. */
  suzgecEtkin?: boolean;
}) {
  const yonetim = mod === "yonetim";

  const { acik, setAcik, durum, eylem, deger } =
    useEklemePaneli<GorusmeEylemDurumu>(terapiGorusmesiEkle);
  const silme = useSunucuIslemi<GorusmeEylemDurumu>();

  /**
   * Detay penceresi. Kapalıyken içerik render edilmez; `secili` hem pencerenin
   * açık olup olmadığını hem gösterilen görüşmeyi taşır.
   */
  const [secili, setSecili] = useState<TerapiGorusmesiSatiri | null>(null);

  const bosDurum = suzgecEtkin ? (
    <BosDurum
      baslik="Süzgece uyan terapi görüşmesi yok."
      aciklama="Üstteki süzgeçleri değiştirin."
    />
  ) : (
    <BosDurum
      baslik="Henüz terapi görüşmesi kaydı yok."
      aciklama={
        yonetim
          ? "Oyun ve danışan terapisi görüşmelerini buradan ekleyebilirsiniz. Notlar stajyerlere görünmez."
          : "Terapi görüşmeleri Danışmanlık sayfasından eklenir."
      }
    />
  );

  function sil(gorusme: TerapiGorusmesiSatiri) {
    silme.calistir(() => terapiGorusmesiSil(gorusme.id), {
      onay: `${tarihBicimle(gorusme.tarih)} tarihli görüşme (${gorusme.ogrenciAdi} · ${gorusme.gorusmeciAdi}) silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
      // Silme pencereden yapılıyor; kayıt gittiyse pencere açık kalamaz.
      basarida: () => setSecili(null),
    });
  }

  return (
    <div className="space-y-3">
      <BolumUstu
        baslik="Terapi görüşmeleri"
        adet={gorusmeler.length}
        adetEtiketi="görüşme"
        aksiyon={
          yonetim && !acik ? (
            <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
              + Terapi görüşmesi ekle
            </Buton>
          ) : !yonetim ? (
            <Link href="/koordinator/danismanlik" className={baglantiStili}>
              Danışmanlık sayfasında yönetilir
            </Link>
          ) : null
        }
      />

      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {silme.durum.basari ? (
        <Bildirim tur="basari">{silme.durum.basari}</Bildirim>
      ) : null}
      {silme.durum.hata ? (
        <Bildirim tur="hata">{silme.durum.hata}</Bildirim>
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
                  defaultValue={deger("terapiTuru") ?? TERAPI_TURLERI[0].deger}
                  className={secimStili}
                >
                  {TERAPI_TURLERI.map((terapiTuru) => (
                    <option key={terapiTuru.deger} value={terapiTuru.deger}>
                      {terapiTuru.etiket}
                    </option>
                  ))}
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
              <GonderButonu>Görüşmeyi kaydet</GonderButonu>
              <Buton type="button" tur="sade" onClick={() => setAcik(false)}>
                Vazgeç
              </Buton>
            </div>
          </form>
        </Kart>
      ) : null}

      {gorusmeler.length === 0 && !acik ? (
        bosDurum
      ) : (
        <div className="space-y-2">
          {/* Satırda yalnızca kimlik bilgisi; notun tamamı pencerede. */}
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
              {/* Tür ayrımını etiketin kendisi taşır; altı türe renk kodu
                  vermek hem palete sığmaz hem de olmayan bir öncelik sırası
                  ima ederdi. */}
              <Rozet>{TERAPI_TURU_ETIKETLERI[gorusme.terapiTuru]}</Rozet>
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
        baslik={
          secili ? (
            <>
              <h3 className="text-base font-semibold text-zinc-900">
                {tarihBicimle(secili.tarih)}
              </h3>
              <Rozet>{TERAPI_TURU_ETIKETLERI[secili.terapiTuru]}</Rozet>
            </>
          ) : null
        }
        altBaslik={
          secili
            ? `${secili.ogrenciAdi} · ${secili.gorusmeciAdi} (${TUR_ETIKETLERI[secili.tur]})`
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
                    calisiyor={silme.calisiyor}
                    onClick={() => sil(secili)}
                  />
                ) : undefined
              }
            />
          ) : null
        }
      >
        {/* Not tam metin: koordinatör okumak için giriyor, kırpılmaz.
            Satır sonları korunur; uzun not pencere içinde kayar. Gövde gömük
            yüzeyde durur — "içine bir şey konan" alan. */}
        {secili ? (
          <p className="kil-oyuk whitespace-pre-wrap p-3.5 text-sm leading-relaxed text-zinc-700">
            {secili.not}
          </p>
        ) : null}
      </Pencere>
    </div>
  );
}
