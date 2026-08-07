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
  butonStili,
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
  zekaTestiEkle,
  zekaTestiSil,
  type ZekaTestiEylemDurumu,
} from "@/app/koordinator/zeka-testleri/zeka-testi-eylemleri";

/**
 * Zeka testleri bölümü — yüklenen sonuç belgeleri (PDF/görsel).
 *
 * Üç modda çalışır (görüşme bölümleriyle aynı desen, + yetki katmanının
 * LISTE seviyesi):
 *   - "yonetim": tam yetki — yükleme, silme, süzme, önizleme; öğrenci
 *     formdaki seçiciden gelir ve satırlarda öğrenci adı görünür.
 *   - "okuma":  görüntüleme — önizleme var, yükleme/silme yok (öğrenci
 *     profili ve zeka testlerinde yalnızca GORUNTULE yetkisi olan roller).
 *   - "liste":  yalnızca üstveri — hangi öğrenciye hangi tarihte hangi test;
 *     satır TIKLANAMAZ, önizleme ve indirme bağlantısı hiç render edilmez
 *     (danışma görevlisi). Asıl sınır arayüz değil: `/api/zeka-testi/[id]`
 *     rotası GORUNTULE ister ve adres elle yazılsa da 403 döner.
 *
 * GİZLİLİK: Test sonuçları sağlık bilgisi gibi hassastır; bu bileşen stajyer
 * ekranlarına hiç gitmez.
 *
 * Önizleme detay penceresinde: belge `/api/zeka-testi/[id]` rotasından
 * `inline` olarak servis edilir — PDF `<iframe>`, görsel `<img>` ile
 * gösterilir. Pencere kapalıyken hiçbir belge yüklenmez.
 * İskelet (panel/pencere/silme durumu) `bolum-iskeleti.tsx`'ten gelir.
 */

export type ZekaTestiSatiri = {
  id: string;
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

export function ZekaTestleriBolumu({
  mod,
  baglam = "profil",
  testler,
  ogrenciSecenekleri = [],
  testAdiSecenekleri = [],
  bugunMetni = "",
  suzgecEtkin = false,
}: {
  /** Yetki kademesi: yonetim = yükle/sil, okuma = önizle, liste = üstveri. */
  mod: "yonetim" | "okuma" | "liste";
  /**
   * Nerede çizildiği: "sayfa" = Zeka testleri sayfası (öğrenci adı sütunu ve
   * öğrenci süzgeci var), "profil" = öğrenci profilindeki gömülü bölüm
   * (öğrenci zaten belli). Yetkiden bağımsız bir eksen: koordinatör sayfada
   * okuma modundadır ama öğrenci adlarını görmelidir.
   */
  baglam?: "sayfa" | "profil";
  testler: ZekaTestiSatiri[];
  /** Sayfa bağlamında: yükleme formundaki öğrenciler. */
  ogrenciSecenekleri?: { id: string; ad: string }[];
  /** Yalnızca yönetim modunda: "Testin adı" açılır listesi (katalogdan). */
  testAdiSecenekleri?: string[];
  /** Formun varsayılan tarihi (YYYY-AA-GG) — sunucudan gelir, saat dilimi kaymaz. */
  bugunMetni?: string;
  /** Sayfadaki süzgeçlerden en az biri etkin mi — boş listenin metnini seçer. */
  suzgecEtkin?: boolean;
}) {
  const yonetim = mod === "yonetim";
  const sayfada = baglam === "sayfa";
  // Belge içeriği açılabilir mi — LISTE seviyesinin çizgisi tam burası.
  const belgeAcilabilir = mod !== "liste";

  const { acik, setAcik, durum, eylem, deger } =
    useEklemePaneli<ZekaTestiEylemDurumu>(zekaTestiEkle);
  const silme = useSunucuIslemi<ZekaTestiEylemDurumu>();

  const [secili, setSecili] = useState<ZekaTestiSatiri | null>(null);

  function sil(test: ZekaTestiSatiri) {
    silme.calistir(() => zekaTestiSil(test.id), {
      onay: `${tarihBicimle(test.tarih)} tarihli "${test.testAdi}" belgesi (${test.ogrenciAdi}) silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
      basarida: () => setSecili(null),
    });
  }

  return (
    <div className="space-y-3">
      <BolumUstu
        baslik="Zeka testleri"
        adet={testler.length}
        adetEtiketi="belge"
        aksiyon={
          yonetim && !acik ? (
            <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
              + Test belgesi yükle
            </Buton>
          ) : !sayfada && belgeAcilabilir ? (
            <Link href="/koordinator/zeka-testleri" className={baglantiStili}>
              Zeka testleri sayfasında yönetilir
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
              <GonderButonu bekleyenEtiket="Yükleniyor…">
                Belgeyi kaydet
              </GonderButonu>
              <Buton type="button" tur="sade" onClick={() => setAcik(false)}>
                Vazgeç
              </Buton>
            </div>
          </form>
        </Kart>
      ) : null}

      {testler.length === 0 && !acik ? (
        suzgecEtkin ? (
          <BosDurum
            baslik="Süzgece uyan belge yok."
            aciklama="Üstteki süzgeci değiştirin."
          />
        ) : (
          <BosDurum
            baslik="Henüz zeka testi belgesi yok."
            aciklama={
              yonetim
                ? "Uygulanan testlerin sonuç belgelerini (PDF/görsel) buradan yükleyebilirsiniz. Belgeler stajyerlere görünmez."
                : "Test belgeleri Test Uygulayıcısı tarafından yüklenir."
            }
          />
        )
      ) : (
        <div className="space-y-2">
          {/* LISTE seviyesinde satır tıklanamaz: önizleme penceresi ve
              belge adresi hiç render edilmez. */}
          {testler.map((test) => (
            <DetaySatiri
              key={test.id}
              onClick={belgeAcilabilir ? () => setSecili(test) : undefined}
            >
              <span className="font-medium text-zinc-900">
                {tarihBicimle(test.tarih)}
              </span>
              {sayfada ? (
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
            </DetaySatiri>
          ))}
        </div>
      )}

      {/* --- Detay ve önizleme penceresi --- */}
      <Pencere
        acik={Boolean(secili)}
        onKapat={() => setSecili(null)}
        genislik="46rem"
        baslik={
          secili ? (
            <>
              <h3 className="text-base font-semibold text-zinc-900">
                {secili.testAdi}
              </h3>
              <Rozet
                tur={secili.mime === "application/pdf" ? "notr" : "pasif"}
              >
                {secili.mime === "application/pdf" ? "PDF" : "Görsel"}
              </Rozet>
            </>
          ) : null
        }
        altBaslik={
          secili
            ? `${secili.ogrenciAdi} · ${tarihBicimle(secili.tarih)} · ${boyutBicimle(secili.boyut)}`
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
                    <SilDugmesi
                      calisiyor={silme.calisiyor}
                      onClick={() => sil(secili)}
                    />
                  ) : null}
                </span>
              }
            />
          ) : null
        }
      >
        {secili ? (
          <>
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
          </>
        ) : null}
      </Pencere>
    </div>
  );
}
