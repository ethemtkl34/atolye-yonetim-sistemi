"use client";

import { useState } from "react";
import {
  GonderButonu,
  Pencere,
  SekmePaneli,
  Sekmeler,
} from "@/components/ui-istemci";
import {
  BolumUstu,
  DetaySatiri,
  PencereAltBilgisi,
  SilDugmesi,
  useEklemePaneli,
  useSunucuIslemi,
} from "@/components/bolum-iskeleti";
import {
  Alan,
  Bildirim,
  BosDurum,
  Buton,
  CokSatirli,
  Girdi,
  secimStili,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { tarihBicimle, tarihCozumle, yasYil } from "@/lib/tarih";
import { PUAN_ACIKLAMALARI } from "@/lib/puan-hesaplari";
import {
  GENEL_OZELLIKLER,
  GENEL_OZELLIK_GRUPLARI,
  GUCLU_YONLER,
  GUCLU_YON_ANAHTARLARI,
  YAS_CERCEVELERI,
  ZORLANMA_ALANLARI,
  ZORLANMA_GRUPLARI,
  BANDA_OZEL_ZORLANMA,
} from "@/lib/veli-gorusmesi-icerik";
import {
  EN_BUYUK_YAS,
  EN_KUCUK_YAS,
  GOZLEM_ALANLARI,
  gorusmeCercevesiUret,
  yasBandiSec,
  type GozlemCevabi,
  type VeliBriefi,
  type VeliGorusmeFormu,
} from "@/lib/veli-gorusmesi";
import {
  YONLENDIRME_TURLERI,
  yonlendirmeKayitYolu,
  type YonlendirmeTuru,
} from "@/lib/yonlendirme-turleri";
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
 *   - "yonetim": ekleme, not ve silme açık. Öğrenci profilinde `sabitOgrenci`
 *     ile öğrenci baştan bellidir — seçici yerine gizli alan, satırlarda da
 *     öğrenci adı tekrarlanmaz (sayfanın tamamı zaten o öğrencinin).
 *   - "okuma":  yalnızca liste ve detay penceresi — danışmanlık yetkisi
 *     OKUMA olan kullanıcı için; yazma hiçbir ekranda açılmaz.
 *
 * VELİ GÖRÜŞMESİNİN TEK ADRESİ ÖĞRENCİ PROFİLİ: Danışmanlık sayfasından veli
 * sekmesi kaldırıldı, bileşen artık yalnızca profilde kullanılıyor. Çok
 * öğrencili yol (`ogrenciSecenekleri` ile öğrenci seçici, satırlarda öğrenci
 * sütunu) veli listesi çok öğrencili bir ekrana geri dönerse diye duruyor.
 *
 * GİZLİLİK: Her iki mod da yalnızca koordinatör ekranlarında kullanılır;
 * veli görüşmesi verisi stajyer ekranlarının hiçbirine gitmez.
 *
 * FORM: Kurumun beş bölümlü görüşme formu SEKMELİ bir pencerede doldurulur
 * (yaklaşık 60 kutu; satır içi panele sığmıyordu). Yaş öğrencinin doğum
 * tarihinden hesaplanır ve hangi metin sözlüğünün kullanılacağını belirler;
 * 4–10 dışındaki yaşlar en yakın banda düşer ve uyarı gösterilir.
 *
 * Tek form, iki gönderme düğmesi: ikisi de aynı server action'a gider,
 * niyet düğmenin `name="niyet"` değerinden okunur.
 */

export type VeliGorusmesiSatiri = {
  id: string;
  ogrenciAdi: string;
  tarih: Date;
  gorusmeciAdi: string;
  cevaplar: GozlemCevabi[];
  brief: VeliBriefi;
  /** 2026 Ağustos öncesi kayıtlarda form yok — yalnızca mini test vardı. */
  form: VeliGorusmeFormu | null;
  yonlendirmeler: { tur: string; etiket: string; not: string | null }[];
  not: string | null;
  notGuncellemeZamani: Date | null;
  ekleyen: string | null;
  eklenmeTarihi: Date;
};

/** `puanlama-formu.tsx` ile aynı ölçü: telefonda 44px hedef. */
const DOKUNMA_HEDEFI =
  "flex min-h-[2.75rem] items-center justify-center px-3 " +
  "sm:inline-flex sm:min-h-0 sm:py-1.5";

const SEKMELER = [
  { deger: "genel", etiket: "Genel izlenim" },
  { deger: "guclu", etiket: "Güçlü yönler" },
  { deger: "atolye", etiket: "Atölye süreci" },
  { deger: "zorlanma", etiket: "Zorlanma alanları" },
  { deger: "yonlendirme", etiket: "Yönlendirme" },
  { deger: "cerceve", etiket: "Çerçeve" },
] as const;

/**
 * Denetimsiz kutu grubunun yankisı.
 *
 * Kutular bilinçli olarak DENETİMSİZ (`defaultChecked`) — React 19 form
 * sıfırlaması denetimli kutuyu bile DOM'da boşaltıyor (aşağıdaki
 * `PuanSatiri` notu). Ama canlı görüşme çerçevesi neyin işaretli olduğunu
 * bilmek zorunda; bu kanca işaretleri yalnızca GÖSTERİM için yankilar.
 * Gönderilen değer her zaman DOM'daki gerçek kutulardan gider.
 */
function useIsaretYankisi(baslangic: string[] | undefined) {
  const [secili, setSecili] = useState<Set<string>>(
    () => new Set(baslangic ?? []),
  );

  // Önizleme dönüşünde sunucu işaretleri geri yolluyor; yankı da tazelenmeli
  // ("adjust state during render" deseni, `useEklemePaneli` ile aynı).
  const [gorulen, setGorulen] = useState(baslangic);
  if (baslangic !== gorulen) {
    setGorulen(baslangic);
    setSecili(new Set(baslangic ?? []));
  }

  function degistir(anahtar: string, isaretli: boolean) {
    setSecili((onceki) => {
      const yeni = new Set(onceki);
      if (isaretli) yeni.add(anahtar);
      else yeni.delete(anahtar);
      return yeni;
    });
  }

  return { secili, degistir };
}

/** Formdaki tek onay kutusu — grubun adını `name` olarak paylaşır. */
function IsaretKutusu({
  ad,
  deger,
  etiket,
  varsayilan,
  onDegisim,
  ipucu,
}: {
  ad: string;
  deger: string;
  etiket: string;
  varsayilan: boolean;
  onDegisim: (isaretli: boolean) => void;
  ipucu?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-zinc-700">
      <input
        type="checkbox"
        name={ad}
        value={deger}
        defaultChecked={varsayilan}
        onChange={(olay) => onDegisim(olay.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-marka-600"
      />
      <span>
        {etiket}
        {ipucu ? (
          <span className="ml-1.5 text-xs text-zinc-500">{ipucu}</span>
        ) : null}
      </span>
    </label>
  );
}

/**
 * Bir gözlem alanının 1–5 puan satırı.
 *
 * Radio'lar bilinçli olarak DENETİMSİZ (`defaultChecked`): React 19 form
 * sıfırlaması denetimli radio'yu bile DOM'da boşaltıyor (canlıda görüldü —
 * önizleme dönüşünde işaretler kayboluyor, sonrasında kaydet boş cevapla
 * giderdi). Metin alanlarındaki `degerler` + `defaultValue` deseninin aynısı
 * burada `defaultChecked` ile kurulu: sıfırlama anında React güncel
 * varsayılanı uygular, cevaplar geri gelir. `secim` yalnızca puanın anlamını
 * satır altında yazmak için tutulur.
 */
function PuanSatiri({
  anahtar,
  baslik,
  metin,
  sira,
  hata,
  varsayilan,
}: {
  anahtar: string;
  baslik: string;
  metin: string;
  sira: number;
  hata?: string;
  varsayilan?: string;
}) {
  const [secim, setSecim] = useState<string>(varsayilan ?? "");

  return (
    <fieldset
      className={cn(
        "px-3 py-3",
        // Kartın içindeki soru kutusu gömük durur; hatalı soru rengiyle
        // kendini ayırır (kil kuralı: iç içe iki kabartma olmaz).
        hata ? "rounded-md border border-red-300 bg-red-50" : "kil-oyuk",
      )}
    >
      <legend className="px-1 text-sm text-zinc-800">
        <span className="text-zinc-400">{sira}.</span>{" "}
        <span className="font-medium">{baslik}</span>{" "}
        <span className="text-zinc-500">— {metin}</span>
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
                "kil-satir text-sm text-zinc-700",
                // Seçili puan zemine GÖMÜLÜ durur (kil kuralı: basılı olan
                // içeri gider), seçilmeyen kabarık kalır.
                "peer-checked:bg-[#efe5eb] peer-checked:font-semibold peer-checked:text-marka-700 peer-checked:shadow-[var(--kil-ic)]",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marka-600",
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

/** Brief'in üç bölümü — önizlemede ve detay penceresinde aynı görünüm. */
function BriefGorunumu({ brief }: { brief: VeliBriefi }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-zinc-900">Gözlem yorumu</h4>
        <div className="mt-1 space-y-1.5">
          {brief.gozlemParagraflari.map((paragraf, sira) => (
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
      {brief.cerceve.length > 0 ? (
        <CerceveGorunumu bolumler={brief.cerceve} />
      ) : null}
    </div>
  );
}

/**
 * "Görüşmede söylenecekler" çerçevesi. Kesin ifadeler değil, esnek rehber
 * cümleler — görüşme sırasında ailenin bağlamına uyarlanmak üzere.
 */
function CerceveGorunumu({
  bolumler,
}: {
  bolumler: { etiket: string; metin: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-zinc-900">Görüşme çerçevesi</h4>
      <div className="kil-oyuk mt-1 space-y-3 p-3.5">
        {bolumler.map((bolum, sira) => (
          <p key={sira} className="text-sm leading-relaxed text-zinc-700">
            <span className="block text-[11px] font-bold tracking-wide text-marka-700">
              {bolum.etiket}
            </span>
            {bolum.metin}
          </p>
        ))}
      </div>
    </div>
  );
}

export function VeliGorusmeleriBolumu({
  mod,
  gorusmeler,
  ogrenciSecenekleri = [],
  sabitOgrenci,
  bugunMetni = "",
  dogumTarihiMetni = null,
  atolyeler = [],
  suzgecEtkin = false,
}: {
  mod: "yonetim" | "okuma";
  /** Gösterilecek görüşmeler — süzme SAYFADA yapılır (adres tabanlı süzgeçler). */
  gorusmeler: VeliGorusmesiSatiri[];
  /** Yalnızca yönetim modunda: ekleme formundaki öğrenciler. */
  ogrenciSecenekleri?: { id: string; ad: string }[];
  /**
   * Öğrenci profili gibi tek öğrenciye bağlı ekranlarda: seçici çizilmez,
   * kayıt doğrudan bu öğrenciye açılır. Verilmezse `ogrenciSecenekleri`
   * kullanılır.
   */
  sabitOgrenci?: { id: string; ad: string };
  /** Formun varsayılan tarihi (YYYY-AA-GG) — sunucudan gelir, saat dilimi kaymaz. */
  bugunMetni?: string;
  /**
   * Öğrencinin doğum tarihi (YYYY-AA-GG). Yaş ve metin bandı bundan çıkar;
   * null ise form yaşı elle sordurur.
   */
  dogumTarihiMetni?: string | null;
  /** Öğrencinin kayıtlı olduğu atölyeler — Bölüm 3'ün gözlem satırları. */
  atolyeler?: { id: string; ad: string }[];
  /** Sayfadaki süzgeçlerden en az biri etkin mi — boş listenin metnini seçer. */
  suzgecEtkin?: boolean;
}) {
  const yonetim = mod === "yonetim";
  // Öğrenci sütunu yalnızca çok öğrencili listede anlamlı.
  const ogrenciSutunu = yonetim && !sabitOgrenci;

  // Ekleme paneli + form durumu iskeletten; işaretler `coklular`, metin
  // alanları `degerler` üzerinden geri gelir (yukarıdaki `PuanSatiri` notu).
  const { acik, setAcik, durum, eylem, deger } =
    useEklemePaneli<VeliGorusmesiEylemDurumu>(veliGorusmesiGonder);

  // Tek işlem durumu hem silmeyi hem not kaydetmeyi taşır (ikisi de pencerede).
  const islem = useSunucuIslemi<VeliGorusmesiEylemDurumu>();

  const [secili, setSecili] = useState<VeliGorusmesiSatiri | null>(null);

  function sil(gorusme: VeliGorusmesiSatiri) {
    islem.calistir(() => veliGorusmesiSil(gorusme.id), {
      onay: `${tarihBicimle(gorusme.tarih)} tarihli veli görüşmesi (${gorusme.ogrenciAdi} · ${gorusme.gorusmeciAdi}) brief'i, formu ve yönlendirme kararlarıyla birlikte silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
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
          ? "Görüşmeden önce formu doldurup brief hazırlayabilir, görüşme sonrası notunu ekleyebilirsiniz. Kayıtlar stajyerlere görünmez."
          : "Veli görüşmesi eklemek için danışmanlık yetkiniz yeterli değil."
      }
    />
  );

  // Not kaydı silmeyle aynı desende (useTransition + doğrudan çağrı): eylemin
  // hedefi o an açık olan görüşme, `useActionState`e önceden bağlanamıyor.
  function notKaydet(formVerisi: FormData) {
    const gorusme = secili;
    if (!gorusme) return;
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
          // Okuma modunda yönlendirilecek bir yer yok: veli görüşmesi yalnızca
          // bu kutudan (TAM yetkiyle) yönetiliyor.
          yonetim && !acik ? (
            <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
              + Veli görüşmesi ekle
            </Buton>
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

      {yonetim ? (
        <GorusmeFormuPenceresi
          acik={acik}
          onKapat={() => setAcik(false)}
          durum={durum}
          eylem={eylem}
          deger={deger}
          sabitOgrenci={sabitOgrenci}
          ogrenciSecenekleri={ogrenciSecenekleri}
          bugunMetni={bugunMetni}
          dogumTarihiMetni={dogumTarihiMetni}
          atolyeler={atolyeler}
        />
      ) : null}

      {gorusmeler.length === 0 ? (
        bosDurum
      ) : (
        <div className="space-y-2">
          {gorusmeler.map((gorusme) => (
            <DetaySatiri key={gorusme.id} onClick={() => setSecili(gorusme)}>
              <span className="font-medium text-zinc-900">
                {tarihBicimle(gorusme.tarih)}
              </span>
              {ogrenciSutunu ? (
                <span className="font-medium text-zinc-900">
                  {gorusme.ogrenciAdi}
                </span>
              ) : null}
              <span className="truncate text-sm text-zinc-600">
                {gorusme.gorusmeciAdi}
              </span>
              {gorusme.yonlendirmeler.length > 0 ? (
                <span className="kil-cip px-2 py-0.5 text-xs text-marka-700">
                  {gorusme.yonlendirmeler.length} yönlendirme
                </span>
              ) : null}
            </DetaySatiri>
          ))}
        </div>
      )}

      {/* --- Detay penceresi --- */}
      <Pencere
        acik={Boolean(secili)}
        onKapat={() => setSecili(null)}
        genislik="42rem"
        govdeSinifi="space-y-5 overflow-y-auto p-4"
        baslik={
          secili ? (
            <h3 className="text-base font-semibold text-zinc-900">
              {tarihBicimle(secili.tarih)}
            </h3>
          ) : null
        }
        altBaslik={
          secili
            ? `${secili.ogrenciAdi} · Görüşmeyi yapan: ${secili.gorusmeciAdi}` +
              (secili.form
                ? ` · ${secili.form.yas} yaş (${secili.form.band} bandı)`
                : "")
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
          <GorusmeDetayi
            gorusme={secili}
            yonetim={yonetim}
            islem={islem}
            onNotKaydet={notKaydet}
          />
        ) : null}
      </Pencere>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ekleme formu
// ---------------------------------------------------------------------------

function GorusmeFormuPenceresi({
  acik,
  onKapat,
  durum,
  eylem,
  deger,
  sabitOgrenci,
  ogrenciSecenekleri,
  bugunMetni,
  dogumTarihiMetni,
  atolyeler,
}: {
  acik: boolean;
  onKapat: () => void;
  durum: VeliGorusmesiEylemDurumu;
  eylem: (formVerisi: FormData) => void;
  deger: (alan: string) => string | undefined;
  sabitOgrenci?: { id: string; ad: string };
  ogrenciSecenekleri: { id: string; ad: string }[];
  bugunMetni: string;
  dogumTarihiMetni: string | null;
  atolyeler: { id: string; ad: string }[];
}) {
  const [sekme, setSekme] = useState<string>("genel");

  // Tarih değişince yaş ve dolayısıyla metin bandı değişebilir; bu yüzden
  // tarih burada izleniyor. Sunucu da aynı hesabı yapıyor (yasYil), yani
  // ekranda görülen bant kaydedilen bantla aynı.
  const [tarihMetni, setTarihMetni] = useState(deger("tarih") ?? bugunMetni);
  const [elleYas, setElleYas] = useState(deger("yas") ?? "");

  const dogum = dogumTarihiMetni ? tarihCozumle(dogumTarihiMetni) : null;
  const gorusmeTarihi = tarihCozumle(tarihMetni);
  const hesaplananYas =
    dogum && gorusmeTarihi ? yasYil(dogum, gorusmeTarihi) : null;
  const yas = hesaplananYas ?? (elleYas ? Number(elleYas) : null);
  const { band, bandDisi } = yasBandiSec(yas ?? EN_KUCUK_YAS);
  const yasBelli = yas !== null;

  const genel = useIsaretYankisi(durum.coklular?.genel);
  const guclu = useIsaretYankisi(durum.coklular?.guclu);
  const zorlanma = useIsaretYankisi(durum.coklular?.zorlanma);
  const yonlendirme = useIsaretYankisi(durum.coklular?.yonlendirme);
  const [yonlendirmeNotlari, setYonlendirmeNotlari] = useState<
    Record<string, string>
  >({});

  const bandaOzel = BANDA_OZEL_ZORLANMA[band];

  // Canlı çerçeve: motorun aynı fonksiyonu, kaydedilecek metnin ta kendisi.
  const cerceve = yasBelli
    ? gorusmeCercevesiUret({
        band,
        genelAnahtarlari: [...genel.secili],
        gucluAnahtarlari: [...guclu.secili],
        zorlanmaAnahtarlari: [...zorlanma.secili],
        yonlendirmeler: YONLENDIRME_TURLERI.filter((tur) =>
          yonlendirme.secili.has(tur.deger),
        ).map((tur) => ({
          tur: tur.deger as YonlendirmeTuru,
          etiket: tur.etiket,
          not: yonlendirmeNotlari[tur.deger]?.trim() || null,
        })),
      })
    : [];

  const sekmeler = SEKMELER.map((s) => ({
    ...s,
    rozet:
      s.deger === "genel"
        ? genel.secili.size
        : s.deger === "guclu"
          ? guclu.secili.size
          : s.deger === "zorlanma"
            ? zorlanma.secili.size
            : s.deger === "yonlendirme"
              ? yonlendirme.secili.size
              : s.deger === "cerceve"
                ? cerceve.length
                : undefined,
  }));

  return (
    <Pencere
      acik={acik}
      onKapat={onKapat}
      genislik="64rem"
      govdeSinifi="overflow-y-auto px-4 pb-0 pt-1"
      baslik={
        <h3 className="text-base font-semibold text-zinc-900">
          Yeni veli görüşmesi
        </h3>
      }
      altBaslik={
        sabitOgrenci
          ? `${sabitOgrenci.ad} · Kayıtlar stajyerlere görünmez`
          : "Kayıtlar stajyerlere görünmez"
      }
    >
      <form action={eylem} className="space-y-4">
        {sabitOgrenci ? (
          <input type="hidden" name="ogrenciId" value={sabitOgrenci.id} />
        ) : null}

        <div
          className={cn(
            "grid gap-4",
            sabitOgrenci ? "sm:grid-cols-2" : "sm:grid-cols-3",
          )}
        >
          {sabitOgrenci ? null : (
            <Alan etiket="Öğrenci" hata={durum.alanHatalari?.ogrenciId}>
              <select
                name="ogrenciId"
                defaultValue={deger("ogrenciId") ?? ""}
                className={secimStili}
              >
                <option value="">Öğrenci seçin…</option>
                {ogrenciSecenekleri.map((ogrenci) => (
                  <option key={ogrenci.id} value={ogrenci.id}>
                    {ogrenci.ad}
                  </option>
                ))}
              </select>
            </Alan>
          )}

          <Alan
            etiket="Görüşme tarihi"
            ipucu="İleri bir tarih seçilebilir — brief o tarihe kadarki puanlamaları özetler."
            hata={durum.alanHatalari?.tarih}
          >
            <Girdi
              name="tarih"
              type="date"
              value={tarihMetni}
              onChange={(olay) => setTarihMetni(olay.target.value)}
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

        <YasSeridi
          yas={yas}
          hesaplananYas={hesaplananYas}
          elleYas={elleYas}
          onElleYas={setElleYas}
          band={band}
          bandDisi={bandDisi}
          hata={durum.alanHatalari?.yas}
        />

        {yasBelli ? (
          <>
            <Sekmeler
              sekmeler={sekmeler}
              etkin={sekme}
              onSecim={setSekme}
              etiket="Görüşme formu bölümleri"
            />

            {/*
              Pasif sekmeler DOM'da KALIR (`hidden`), unmount edilmez —
              edilseydi o sekmedeki alanlar gönderime hiç girmez ve uzman
              farkında olmadan yarım kayıt üretirdi.
            */}
            <SekmePaneli deger="genel" etkin={sekme}>
              <GenelSekmesi band={band} yankı={genel} deger={deger} />
            </SekmePaneli>

            <SekmePaneli deger="guclu" etkin={sekme}>
              <GucluSekmesi band={band} yankı={guclu} deger={deger} />
            </SekmePaneli>

            <SekmePaneli deger="atolye" etkin={sekme}>
              <AtolyeSekmesi
                atolyeler={atolyeler}
                deger={deger}
                alanHatalari={durum.alanHatalari}
              />
            </SekmePaneli>

            <SekmePaneli deger="zorlanma" etkin={sekme}>
              <ZorlanmaSekmesi
                band={band}
                bandaOzel={bandaOzel}
                yankı={zorlanma}
              />
            </SekmePaneli>

            <SekmePaneli deger="yonlendirme" etkin={sekme}>
              <YonlendirmeSekmesi
                yankı={yonlendirme}
                notlar={yonlendirmeNotlari}
                onNot={(tur, metin) =>
                  setYonlendirmeNotlari((onceki) => ({
                    ...onceki,
                    [tur]: metin,
                  }))
                }
                deger={deger}
              />
            </SekmePaneli>

            <SekmePaneli deger="cerceve" etkin={sekme}>
              {cerceve.length > 0 ? (
                <CerceveGorunumu bolumler={cerceve} />
              ) : (
                <p className="py-6 text-center text-sm text-zinc-500">
                  Yukarıdaki bölümlerde seçim yaptıkça görüşme çerçevesi burada
                  oluşur.
                </p>
              )}
              {durum.brief ? (
                <div className="kil-oyuk p-4">
                  <p className="mb-3 text-xs font-bold tracking-wide text-marka-700">
                    BRIEF ÖNİZLEMESİ — HENÜZ KAYDEDİLMEDİ
                  </p>
                  <BriefGorunumu brief={durum.brief} />
                </div>
              ) : null}
            </SekmePaneli>
          </>
        ) : null}

        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        {/* Kaydırılan gövdenin dibine yapışır: 6 sekmelik formda düğmeleri
            aramak için en alta inmek gerekmesin. */}
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-white/70 bg-[var(--kil-zemin,#f6eef2)] px-4 py-3 shadow-[inset_0_1px_0_var(--kil-golge)]">
          <GonderButonu
            name="niyet"
            value="onizleme"
            tur="ikincil"
            bekleyenEtiket="Hazırlanıyor…"
            disabled={!yasBelli}
          >
            Brief hazırla
          </GonderButonu>
          <GonderButonu name="niyet" value="kaydet" disabled={!yasBelli}>
            {"Görüşmeyi ve brief'i kaydet"}
          </GonderButonu>
          <Buton type="button" tur="sade" onClick={onKapat}>
            Vazgeç
          </Buton>
        </div>
      </form>
    </Pencere>
  );
}

/** Yaş şeridi: hesaplanan yaş + bant, doğum tarihi yoksa elle seçim. */
function YasSeridi({
  yas,
  hesaplananYas,
  elleYas,
  onElleYas,
  band,
  bandDisi,
  hata,
}: {
  /** Kullanılacak yaş (hesaplanan ya da elle seçilen); bilinmiyorsa null. */
  yas: number | null;
  hesaplananYas: number | null;
  elleYas: string;
  onElleYas: (deger: string) => void;
  band: string;
  bandDisi: boolean;
  hata?: string;
}) {
  // Gelişimsel çerçeve TAM YAŞ için yazıldı, bant için değil — 8 ile 10 yaşın
  // çerçevesi aynı bantta olsa da farklı. Aralık dışı yaş en yakına kıstırılır.
  const cerceveYasi =
    yas === null ? null : Math.min(Math.max(yas, EN_KUCUK_YAS), EN_BUYUK_YAS);
  const cerceve = cerceveYasi === null ? null : YAS_CERCEVELERI[cerceveYasi];

  return (
    <div className="kil-oyuk space-y-2 p-3.5">
      {hesaplananYas !== null ? (
        <p className="text-sm text-zinc-700">
          <span className="font-semibold">{hesaplananYas} yaş</span> · görüşme
          tarihine göre hesaplandı ·{" "}
          <span className="kil-cip px-2 py-0.5 text-xs text-marka-700">
            {band} bandı
          </span>
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-zinc-700">
            Öğrencinin doğum tarihi kayıtlı değil — yaşını seçin
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: EN_BUYUK_YAS - EN_KUCUK_YAS + 1 }, (_, i) =>
              String(EN_KUCUK_YAS + i),
            ).map((y) => (
              <label key={y} className="cursor-pointer">
                <input
                  type="radio"
                  name="yas"
                  value={y}
                  checked={elleYas === y}
                  onChange={(olay) => onElleYas(olay.target.value)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    DOKUNMA_HEDEFI,
                    "kil-satir text-sm text-zinc-700",
                    "peer-checked:bg-[#efe5eb] peer-checked:font-semibold peer-checked:text-marka-700 peer-checked:shadow-[var(--kil-ic)]",
                  )}
                >
                  {y}
                </span>
              </label>
            ))}
          </div>
          {hata ? <p className="text-xs text-red-600">{hata}</p> : null}
        </>
      )}

      {yas !== null && bandDisi ? (
        <p className="kil-uyari rounded-md px-3 py-2 text-xs text-zinc-800">
          Bu öğrencinin yaşı formun yazıldığı {EN_KUCUK_YAS}–{EN_BUYUK_YAS} yaş
          aralığının dışında. Metinler en yakın banttan ({band}) gösteriliyor;
          yorumları bu payı gözeterek kullanın.
        </p>
      ) : null}

      {cerceve ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-marka-700">
            {cerceveYasi} yaş gelişimsel çerçevesi
          </summary>
          <p className="mt-2 text-zinc-700">{cerceve.ozet}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <CerceveListesi
              baslik="Bakılması gerekenler"
              maddeler={cerceve.bilissel}
            />
            <CerceveListesi baslik="Grup ortamında" maddeler={cerceve.grup} />
            <CerceveListesi
              baslik="Dikkat edilecekler"
              maddeler={cerceve.dikkat}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function CerceveListesi({
  baslik,
  maddeler,
}: {
  baslik: string;
  maddeler: readonly string[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-700">{baslik}</p>
      <ul className="mt-1 list-disc pl-4 text-xs text-zinc-600">
        {maddeler.map((madde, sira) => (
          <li key={sira}>{madde}</li>
        ))}
      </ul>
    </div>
  );
}

type Yanki = ReturnType<typeof useIsaretYankisi>;

function GenelSekmesi({
  band,
  yankı,
  deger,
}: {
  band: string;
  yankı: Yanki;
  deger: (alan: string) => string | undefined;
}) {
  const sozluk = GENEL_OZELLIKLER[band as keyof typeof GENEL_OZELLIKLER];

  return (
    <>
      <p className="text-sm text-zinc-600">
        Öğrenciyi genel olarak nasıl tanımlarsınız? Bu özellikler mizaç ve
        kişilik örüntüsüne dair ilk izlenimi yansıtır, etiketleme amacı taşımaz.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GENEL_OZELLIK_GRUPLARI.map((grup) => (
          <div key={grup.baslik} className="kil-oyuk space-y-2 p-3">
            <p className="text-sm font-semibold text-marka-700">
              {grup.simge} {grup.baslik}
            </p>
            {grup.anahtarlar.map((anahtar) => (
              <IsaretKutusu
                key={anahtar}
                ad="genel"
                deger={anahtar}
                etiket={sozluk[anahtar]?.baslik ?? anahtar}
                varsayilan={yankı.secili.has(anahtar)}
                onDegisim={(isaretli) => yankı.degistir(anahtar, isaretli)}
              />
            ))}
          </div>
        ))}
      </div>

      <SecilenlerinYorumu
        anahtarlar={[...yankı.secili]}
        cikar={(anahtar) => {
          const d = sozluk[anahtar];
          return d
            ? { baslik: d.baslik, yorum: d.yorum, oneriler: [d.oneri] }
            : null;
        }}
      />

      <Alan etiket="Uzman gözlem notu (serbest alan)">
        <CokSatirli
          name="gozlemNotu"
          rows={3}
          defaultValue={deger("gozlemNotu")}
          placeholder="Kutuların kapsamadığı nüanslar, dikkat çeken davranış örnekleri…"
        />
      </Alan>
    </>
  );
}

function GucluSekmesi({
  band,
  yankı,
  deger,
}: {
  band: string;
  yankı: Yanki;
  deger: (alan: string) => string | undefined;
}) {
  const sozluk = GUCLU_YONLER[band as keyof typeof GUCLU_YONLER];

  return (
    <>
      <p className="text-sm text-zinc-600">
        Atölye gözlemlerinde öne çıkan bilişsel güçlü yönler. CAS (PASS kuramı;
        Das, Naglieri &amp; Kirby, 1994) ve WISC-IV (Wechsler, 2003) alt test
        alanlarına dayalıdır. Bu bir test skoru yorumu değil, gözleme dayalı güç
        profilini yapılandıran bir rehber çerçevedir.
      </p>
      <div className="kil-oyuk grid gap-2 p-3 sm:grid-cols-2">
        {GUCLU_YON_ANAHTARLARI.map((anahtar) => (
          <IsaretKutusu
            key={anahtar}
            ad="guclu"
            deger={anahtar}
            etiket={sozluk[anahtar]?.baslik ?? anahtar}
            ipucu={sozluk[anahtar]?.kaynak}
            varsayilan={yankı.secili.has(anahtar)}
            onDegisim={(isaretli) => yankı.degistir(anahtar, isaretli)}
          />
        ))}
      </div>

      <SecilenlerinYorumu
        anahtarlar={[...yankı.secili]}
        cikar={(anahtar) => {
          const d = sozluk[anahtar];
          return d
            ? { baslik: d.baslik, yorum: d.cumle, oneriler: d.oneriler }
            : null;
        }}
      />

      <Alan etiket="Genel özet / ek notlar">
        <CokSatirli
          name="gucluOzeti"
          rows={3}
          defaultValue={deger("gucluOzeti")}
          placeholder="Yukarıdaki cümlelerden derleyerek yazabilirsiniz…"
        />
      </Alan>
    </>
  );
}

function AtolyeSekmesi({
  atolyeler,
  deger,
  alanHatalari,
}: {
  atolyeler: { id: string; ad: string }[];
  deger: (alan: string) => string | undefined;
  alanHatalari?: Record<string, string>;
}) {
  return (
    <>
      <p className="text-sm text-zinc-600">
        Dokuz gözlem alanını 1–5 arasında puanlayın (1 düşük · 5 yüksek).
        Puanlar brief&apos;in gözlem yorumunu üretir.
      </p>
      <div className="space-y-3">
        {GOZLEM_ALANLARI.map((alan, sira) => (
          <PuanSatiri
            key={alan.anahtar}
            anahtar={alan.anahtar}
            baslik={alan.baslik}
            metin={alan.metin}
            sira={sira + 1}
            hata={alanHatalari?.[`cevap-${alan.anahtar}`]}
            varsayilan={deger(`cevap-${alan.anahtar}`)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-zinc-700">
          Atölyelere göre gözlemler
        </p>
        {atolyeler.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Öğrencinin kayıtlı olduğu atölye bulunmuyor.
          </p>
        ) : (
          atolyeler.map((atolye, sira) => (
            <div key={atolye.id}>
              {/* Atölye adı yalnızca ETİKET olarak saklanıyor (bir bağ değil),
                  o yüzden gizli alanla taşınıyor. */}
              <input
                type="hidden"
                name={`atolyeAd-${sira}`}
                value={atolye.ad}
              />
              <Alan etiket={atolye.ad}>
                <Girdi
                  name={`atolyeNot-${sira}`}
                  defaultValue={deger(`atolyeNot-${sira}`)}
                  placeholder="Bu atölyedeki gözlem…"
                />
              </Alan>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function ZorlanmaSekmesi({
  band,
  bandaOzel,
  yankı,
}: {
  band: string;
  bandaOzel: { anahtar: string; sutun: string; etiket: string };
  yankı: Yanki;
}) {
  const sozluk = ZORLANMA_ALANLARI[band as keyof typeof ZORLANMA_ALANLARI];

  return (
    <>
      <p className="text-sm text-zinc-600">
        Zorlandığı alanları işaretleyin — yaşa göre yorum ve öneriler aşağıda
        oluşur.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {ZORLANMA_GRUPLARI.map((grup) => (
          <div key={grup.sutun} className="kil-oyuk space-y-2 p-3">
            <p className="text-sm font-semibold text-marka-700">
              {grup.simge} {grup.sutun}
            </p>
            {grup.anahtarlar.map((anahtar) => (
              <IsaretKutusu
                key={anahtar}
                ad="zorlanma"
                deger={anahtar}
                etiket={sozluk[anahtar]?.baslik ?? anahtar}
                varsayilan={yankı.secili.has(anahtar)}
                onDegisim={(isaretli) => yankı.degistir(anahtar, isaretli)}
              />
            ))}
            {grup.sutun === bandaOzel.sutun ? (
              <IsaretKutusu
                ad="zorlanma"
                deger={bandaOzel.anahtar}
                etiket={bandaOzel.etiket}
                ipucu="(bu yaş grubuna özel)"
                varsayilan={yankı.secili.has(bandaOzel.anahtar)}
                onDegisim={(isaretli) =>
                  yankı.degistir(bandaOzel.anahtar, isaretli)
                }
              />
            ) : null}
          </div>
        ))}
      </div>

      <SecilenlerinYorumu
        anahtarlar={[...yankı.secili]}
        cikar={(anahtar) => {
          const d = sozluk[anahtar];
          return d
            ? {
                baslik: `${d.baslik} · ${d.alan}`,
                yorum: d.yorum,
                oneriler: d.oneriler,
                aile: d.aile,
              }
            : null;
        }}
      />

      <p className="border-t border-dashed border-zinc-200 pt-2 text-xs italic text-zinc-500">
        Bilişsel alan önerileri zekaveakiloyunlari.com (ZetZeka) sitesindeki
        gelişim alanı ve yaş aralığı kategorilerine dayanmaktadır.
        Sosyal/duygusal alanlardaki yönlendirme önerileri genel değerlendirme
        çerçeveleridir; tanı niteliği taşımaz. Zorlanma yoğun, sürekli veya
        günlük işleyişi belirgin biçimde etkiliyorsa ilgili uzmana yönlendirme
        önerilir.
      </p>
    </>
  );
}

function YonlendirmeSekmesi({
  yankı,
  notlar,
  onNot,
  deger,
}: {
  yankı: Yanki;
  notlar: Record<string, string>;
  onNot: (tur: string, metin: string) => void;
  deger: (alan: string) => string | undefined;
}) {
  return (
    <>
      <p className="text-sm text-zinc-600">
        Bu bölüm, öğrenci bir sonraki döneme geldiğinde ekibin &ldquo;ne
        konuşulmuş, ne önerilmiş&rdquo; bilgisine hızlıca ulaşabilmesi için
        tutulur. İşaretlemek kaydı KENDİLİĞİNDEN açmaz — ilgili ekranın
        bağlantısı gösterilir.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {YONLENDIRME_TURLERI.map((tur) => {
          const isaretli = yankı.secili.has(tur.deger);
          const yol = yonlendirmeKayitYolu(tur.deger as YonlendirmeTuru);
          return (
            <div
              key={tur.deger}
              className={cn(
                "space-y-2 rounded-lg p-3",
                isaretli ? "kil-oyuk" : "kil-yuzey",
              )}
            >
              <IsaretKutusu
                ad="yonlendirme"
                deger={tur.deger}
                etiket={`${tur.simge} ${tur.etiket}`}
                varsayilan={isaretli}
                onDegisim={(secildi) => yankı.degistir(tur.deger, secildi)}
              />
              {isaretli ? (
                <>
                  <Girdi
                    name={`yonlendirmeNot-${tur.deger}`}
                    defaultValue={
                      notlar[tur.deger] ?? deger(`yonlendirmeNot-${tur.deger}`)
                    }
                    onChange={(olay) => onNot(tur.deger, olay.target.value)}
                    placeholder={tur.ipucu}
                  />
                  {yol ? (
                    <a
                      href={yol}
                      className="inline-block text-xs text-marka-700 underline"
                    >
                      Kaydı ilgili ekrandan açın →
                    </a>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** İşaretlenen maddelerin sözlükten gelen yorum ve önerileri. */
function SecilenlerinYorumu({
  anahtarlar,
  cikar,
}: {
  anahtarlar: string[];
  cikar: (anahtar: string) => {
    baslik: string;
    yorum: string;
    oneriler: readonly string[];
    aile?: readonly string[];
  } | null;
}) {
  const maddeler = anahtarlar
    .map((anahtar) => ({ anahtar, veri: cikar(anahtar) }))
    .filter(
      (
        m,
      ): m is {
        anahtar: string;
        veri: NonNullable<ReturnType<typeof cikar>>;
      } => Boolean(m.veri),
    );

  if (maddeler.length === 0) return null;

  return (
    <div className="space-y-2">
      {maddeler.map(({ anahtar, veri }) => (
        <div key={anahtar} className="kil-yuzey rounded-lg p-3">
          <p className="text-sm font-semibold text-marka-700">{veri.baslik}</p>
          <p className="mt-1 text-sm text-zinc-700">{veri.yorum}</p>
          {veri.oneriler.length > 0 ? (
            <>
              <p className="mt-2 text-xs font-semibold text-zinc-700">Öneri:</p>
              <ul className="list-disc pl-4 text-xs text-zinc-600">
                {veri.oneriler.map((oneri, sira) => (
                  <li key={sira}>{oneri}</li>
                ))}
              </ul>
            </>
          ) : null}
          {veri.aile && veri.aile.length > 0 ? (
            <>
              <p className="mt-2 text-xs font-semibold text-zinc-700">
                Ailelerle paylaşılabilecek öneriler:
              </p>
              <ul className="list-disc pl-4 text-xs text-zinc-600">
                {veri.aile.map((oneri, sira) => (
                  <li key={sira}>{oneri}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detay penceresi
// ---------------------------------------------------------------------------

function GorusmeDetayi({
  gorusme,
  yonetim,
  islem,
  onNotKaydet,
}: {
  gorusme: VeliGorusmesiSatiri;
  yonetim: boolean;
  islem: ReturnType<typeof useSunucuIslemi<VeliGorusmesiEylemDurumu>>;
  onNotKaydet: (formVerisi: FormData) => void;
}) {
  return (
    <>
      <BriefGorunumu brief={gorusme.brief} />

      <div>
        <h4 className="text-sm font-semibold text-zinc-900">Gözlem puanları</h4>
        <ul className="mt-1 space-y-1">
          {gorusme.cevaplar.map((cevap) => (
            <li
              key={cevap.anahtar}
              className="flex items-baseline justify-between gap-3 text-sm text-zinc-700"
            >
              <span>{cevap.baslik ?? cevap.soruMetni}</span>
              <span className="shrink-0 font-medium text-zinc-900">
                {cevap.deger}/5
              </span>
            </li>
          ))}
        </ul>
      </div>

      {gorusme.form ? <FormOzeti form={gorusme.form} /> : null}

      {gorusme.yonlendirmeler.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-zinc-900">
            Yönlendirme kararları
          </h4>
          <ul className="mt-1 space-y-1 text-sm text-zinc-700">
            {gorusme.yonlendirmeler.map((y) => (
              <li key={y.tur}>
                <span className="font-medium">{y.etiket}</span>
                {y.not ? (
                  <span className="text-zinc-600"> — {y.not}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h4 className="text-sm font-semibold text-zinc-900">Görüşme notu</h4>
        {gorusme.not ? (
          <>
            {/* Not gövdesi "içine bir şey konan" alan: gömük yüzey. */}
            <p className="kil-oyuk mt-1 whitespace-pre-wrap p-3.5 text-sm leading-relaxed text-zinc-700">
              {gorusme.not}
            </p>
            {gorusme.notGuncellemeZamani ? (
              <p className="mt-1 text-xs text-zinc-500">
                Not güncellemesi: {tarihBicimle(gorusme.notGuncellemeZamani)}
              </p>
            ) : null}
          </>
        ) : !yonetim ? (
          <p className="mt-1 text-sm text-zinc-500">Henüz not eklenmedi.</p>
        ) : null}

        {/* Not görüşmeden SONRA yazılır; varsa da üzerine yazılabilir
            (kaydın kendisi düzenlenmez, yalnızca not). */}
        {yonetim ? (
          <form action={onNotKaydet} className="mt-2 space-y-2">
            <CokSatirli
              name="not"
              rows={3}
              defaultValue={gorusme.not ?? ""}
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
                : gorusme.not
                  ? "Notu güncelle"
                  : "Notu kaydet"}
            </Buton>
          </form>
        ) : null}
      </div>
    </>
  );
}

/** Kaydedilen formun işaretleri — başlıklar kayıt anındaki hâliyle. */
function FormOzeti({ form }: { form: VeliGorusmeFormu }) {
  const bloklar = [
    { baslik: "Genel izlenim", maddeler: form.genel },
    { baslik: "Bilişsel güçlü yönler", maddeler: form.guclu },
    { baslik: "Zorlandığı alanlar", maddeler: form.zorlanma },
  ].filter((blok) => blok.maddeler.length > 0);

  if (
    bloklar.length === 0 &&
    !form.gozlemNotu &&
    !form.gucluOzeti &&
    form.atolyeNotlari.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-3">
      {bloklar.map((blok) => (
        <div key={blok.baslik}>
          <h4 className="text-sm font-semibold text-zinc-900">{blok.baslik}</h4>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {blok.maddeler.map((madde) => (
              <span
                key={madde.anahtar}
                className="kil-cip px-2 py-0.5 text-xs text-marka-700"
              >
                {madde.baslik}
              </span>
            ))}
          </p>
        </div>
      ))}

      {form.atolyeNotlari.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-zinc-900">
            Atölye gözlemleri
          </h4>
          <ul className="mt-1 space-y-1 text-sm text-zinc-700">
            {form.atolyeNotlari.map((satir) => (
              <li key={satir.atolye}>
                <span className="font-medium">{satir.atolye}:</span> {satir.not}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {form.gozlemNotu ? (
        <div>
          <h4 className="text-sm font-semibold text-zinc-900">
            Uzman gözlem notu
          </h4>
          <p className="kil-oyuk mt-1 whitespace-pre-wrap p-3.5 text-sm text-zinc-700">
            {form.gozlemNotu}
          </p>
        </div>
      ) : null}

      {form.gucluOzeti ? (
        <div>
          <h4 className="text-sm font-semibold text-zinc-900">
            Güçlü yönler özeti
          </h4>
          <p className="kil-oyuk mt-1 whitespace-pre-wrap p-3.5 text-sm text-zinc-700">
            {form.gucluOzeti}
          </p>
        </div>
      ) : null}
    </div>
  );
}
