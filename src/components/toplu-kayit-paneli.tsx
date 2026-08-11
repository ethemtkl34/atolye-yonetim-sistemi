"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { GonderButonu } from "@/components/ui-istemci";
import { Alan, Bildirim, Buton, Girdi, Kart, secimStili } from "@/components/ui";
import { normalizeArama } from "@/lib/turkce";
import { cn } from "@/lib/utils";
import {
  topluKayitCikar,
  topluKayitOlustur,
  type EylemDurumu,
} from "@/app/koordinator/kayitlar/actions";

export type PanelGrubu = {
  id: string;
  ad: string;
  zaman: string;
  kapasite: number;
  doluluk: number;
  dolu: boolean;
  aktif: boolean;
};

export type PanelOgrencisi = {
  id: string;
  ad: string;
  /** Türkçe duyarsız arama için normalize edilmiş ad (`Student.searchName`). */
  aramaAdi: string;
  /** Bu programın hangi gruplarında AKTİF kaydı var. */
  mevcutGruplar: { id: string; ad: string }[];
};

function EkleButonu({ sayi, engel }: { sayi: number; engel?: string }) {
  return (
    <GonderButonu
      bekleyenEtiket="Ekleniyor…"
      disabled={sayi === 0 || Boolean(engel)}
      engelSebebi={engel ?? (sayi === 0 ? "Önce öğrenci seçin." : undefined)}
    >
      {sayi === 0 ? "Öğrenci ekle" : `${sayi} öğrenciyi ekle`}
    </GonderButonu>
  );
}

/** Ekleme ve çıkarma listelerinin ortak satır görünümü. */
function OgrenciSatiri({
  ad,
  secili,
  not,
  alan,
  onChange,
}: {
  ad: string;
  secili: boolean;
  not?: string;
  /** Formda gönderilen alan adı; çıkarma listesi form kullanmıyor. */
  alan?: { ad: string; deger: string };
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-[2.75rem] items-center gap-2 rounded-[var(--kil-r-md)] px-2 py-2 text-sm sm:min-h-0 sm:py-1.5",
        // Seçili satır zemine GÖMÜLÜ: liste kutusunun kendisi de oyuk olduğu
        // için seçim rengi değil doku değişikliğiyle okunuyor.
        secili
          ? "kil-oyuk cursor-pointer text-marka-700"
          : "cursor-pointer text-zinc-700 hover:bg-white/70",
      )}
    >
      <input
        type="checkbox"
        name={alan?.ad}
        value={alan?.deger}
        checked={secili}
        onChange={onChange}
        className="size-4 shrink-0"
      />
      <span className="flex-1">{ad}</span>
      {not ? <span className="text-xs text-zinc-500">{not}</span> : null}
    </label>
  );
}

/**
 * Dönem ve kulüp sayfasındaki grup öğrenci paneli.
 *
 * Kayıt akışının ters yönü: sihirbaz öğrenciden başlayıp programa gidiyor,
 * burada program bellidir ve öğrenciler şubenin listesinden seçilir. Tek
 * öğrenci de aynı panelden eklenip çıkarılır — ayrı bir "tekli" ekran açmak,
 * aynı kuralların ikinci bir kopyasını doğururdu.
 *
 * İki liste tek grup seçicisini paylaşıyor: üstte grubun mevcut öğrencileri
 * (çıkarma), altta eklenebilecekler. Çıkarma kaydı silmez, iptal eder;
 * geri eklenince kayıt puanlamalarıyla birlikte yeniden etkinleşir.
 *
 * Sorumlu stajyer burada hiç sorulmuyor; atama dönem başlarken Atamalar
 * ekranından yapılıyor.
 */
export function TopluKayitPaneli({
  gruplar,
  ogrenciler,
  programAdi,
  engelSebebi,
}: {
  gruplar: PanelGrubu[];
  ogrenciler: PanelOgrencisi[];
  /** "dönem" ya da "kulüp" — metinlerde geçiyor. */
  programAdi: "dönem" | "kulüp";
  /** Doluysa panel kilitli ve sebep gösteriliyor (durum kayıt almıyor gibi). */
  engelSebebi?: string;
}) {
  const [ekleDurumu, ekleEylemi] = useActionState<EylemDurumu, FormData>(
    topluKayitOlustur,
    {},
  );
  const [cikarDurumu, setCikarDurumu] = useState<EylemDurumu>({});
  const [cikariliyor, cikarmaBasla] = useTransition();

  const [grupId, setGrupId] = useState(
    () => gruplar.find((grup) => grup.aktif && !grup.dolu)?.id ?? "",
  );
  const [arama, setArama] = useState("");
  const [secilenler, setSecilenler] = useState<string[]>([]);
  const [cikarilacaklar, setCikarilacaklar] = useState<string[]>([]);

  const secilenGrup = gruplar.find((grup) => grup.id === grupId);
  const kalanYer = secilenGrup
    ? Math.max(0, secilenGrup.kapasite - secilenGrup.doluluk)
    : 0;

  /** Seçili grupta aktif kaydı olanlar. */
  const kayitliIdleri = useMemo(
    () =>
      new Set(
        ogrenciler
          .filter((ogrenci) =>
            ogrenci.mevcutGruplar.some((grup) => grup.id === grupId),
          )
          .map((ogrenci) => ogrenci.id),
      ),
    [ogrenciler, grupId],
  );

  const aranan = normalizeArama(arama);
  const suzulmus = useMemo(
    () =>
      aranan
        ? ogrenciler.filter((ogrenci) => ogrenci.aramaAdi.includes(aranan))
        : ogrenciler,
    [ogrenciler, aranan],
  );

  const gruptakiler = suzulmus.filter((ogrenci) =>
    kayitliIdleri.has(ogrenci.id),
  );
  const eklenebilirler = suzulmus.filter(
    (ogrenci) => !kayitliIdleri.has(ogrenci.id),
  );

  /**
   * Ekranda geçerli sayılan seçimler: karşı listeye geçmiş kimlikler süzülür.
   *
   * Seçim işlem bitince ayrıca sıfırlanıyor (aşağıya bakın); bu süzgeç
   * sıfırlama ile sunucudan gelen taze verinin arasındaki anı kapsıyor —
   * o aralıkta seçim sayacı bir an yanlış görünüyordu.
   */
  const gecerliSecim = useMemo(
    () => secilenler.filter((id) => !kayitliIdleri.has(id)),
    [secilenler, kayitliIdleri],
  );
  const gecerliCikarma = useMemo(
    () => cikarilacaklar.filter((id) => kayitliIdleri.has(id)),
    [cikarilacaklar, kayitliIdleri],
  );

  function degistir(
    ayarla: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
  ) {
    ayarla((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((secili) => secili !== id)
        : [...oncekiler, id],
    );
  }

  function gorunenleriSec() {
    setSecilenler((oncekiler) => [
      ...new Set([...oncekiler, ...eklenebilirler.map((o) => o.id)]),
    ]);
  }

  function cikar() {
    const adlar = gruptakiler
      .filter((ogrenci) => gecerliCikarma.includes(ogrenci.id))
      .map((ogrenci) => ogrenci.ad)
      .join(", ");

    if (
      !window.confirm(
        `${gecerliCikarma.length} öğrenci "${secilenGrup?.ad}" grubundan çıkarılacak: ${adlar}.\n\nKayıtları iptal edilir, girilmiş puanlamalar korunur. Devam edilsin mi?`,
      )
    ) {
      return;
    }

    cikarmaBasla(async () => {
      setCikarDurumu(await topluKayitCikar(grupId, gecerliCikarma));
      // Seçim İŞLEM BİTİNCE sıfırlanıyor, süzgece bırakılmıyor. Süzgeç
      // "artık bu grupta olmayanlar" diye çalıştığı için çıkarılan öğrenci
      // geri eklendiğinde seçimi de geri geliyordu: yeni eklenen öğrenci
      // "çıkarılmak üzere işaretli" görünüyordu.
      setCikarilacaklar([]);
      setSecilenler([]);
    });
  }

  /**
   * Ekleme formu gönderilirken seçimler sıfırlanıyor.
   *
   * `FormData` bu noktada zaten toplanmış durumda, dolayısıyla gönderilen
   * veri etkilenmiyor; amaç aynı simetrik hata: eklenen öğrenci sonradan
   * çıkarılınca ekleme seçimi de geri gelirdi.
   */
  function ekleGonder(formVerisi: FormData) {
    setSecilenler([]);
    setCikarilacaklar([]);
    ekleEylemi(formVerisi);
  }

  /**
   * Ekleme formunun kutuları form sıfırlandıktan sonra durumdan geri
   * yazılıyor — kayıt formundaki ve stajyer kadrosundaki sorunun aynısı.
   */
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const kutu of form.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="ogrenciler"]',
    )) {
      kutu.checked = gecerliSecim.includes(kutu.value);
    }
  }, [ekleDurumu, gecerliSecim]);

  const ekleEngeli = engelSebebi
    ? engelSebebi
    : gruplar.length === 0
      ? `Bu ${programAdi} sayfasında henüz grup yok; önce grup ekleyin.`
      : !grupId
        ? "Grup seçin."
        : undefined;

  return (
    <Kart className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">
          Grubun öğrencileri
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Şubenizin öğrenci listesinden seçip topluca ekleyin ya da gruptan
          çıkarın. Sorumlu stajyer burada sorulmuyor; atama {programAdi}{" "}
          başlarken Atamalar ekranından yapılıyor. Kontenjan yetmezse sığan
          öğrenciler eklenir, kalanlar adlarıyla bildirilir.
        </p>
      </div>

      {engelSebebi ? <Bildirim tur="bilgi">{engelSebebi}</Bildirim> : null}

      {gruplar.length === 0 ? (
        <Bildirim tur="bilgi">
          Bu {programAdi} sayfasında henüz grup yok. Öğrenci ekleyebilmek için
          önce bir grup açın.
        </Bildirim>
      ) : ogrenciler.length === 0 ? (
        <Bildirim tur="bilgi">
          Bu şubede kayıtlı öğrenci yok. Önce Öğrenciler ekranından öğrenci
          ekleyin.
        </Bildirim>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Alan etiket="Grup" hata={ekleDurumu.alanHatalari?.groupId}>
              <select
                value={grupId}
                onChange={(e) => setGrupId(e.target.value)}
                className={secimStili}
              >
                <option value="">Seçin…</option>
                {gruplar.map((grup) => (
                  <option key={grup.id} value={grup.id} disabled={!grup.aktif}>
                    {grup.ad} · {grup.zaman} · {grup.doluluk}/{grup.kapasite}
                    {grup.dolu ? " (dolu)" : ""}
                    {!grup.aktif ? " (kapalı)" : ""}
                  </option>
                ))}
              </select>
            </Alan>

            <Alan etiket="Öğrenci ara" ipucu="Ad veya soyadın bir kısmı yeter.">
              <Girdi
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="Örn. kerem"
                type="search"
              />
            </Alan>
          </div>

          {secilenGrup ? (
            <p className="text-sm text-zinc-600">
              {secilenGrup.doluluk} / {secilenGrup.kapasite} öğrenci ·{" "}
              <span
                className={cn(
                  kalanYer === 0 ? "text-vurgu-700" : "text-zinc-600",
                )}
              >
                {kalanYer} yer kaldı
              </span>
            </p>
          ) : null}

          {/* --- Gruptakiler: çıkarma --- */}
          {grupId ? (
            <div className="kil-oyuk space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Bu gruptakiler ({kayitliIdleri.size})
                </h3>
                {gecerliCikarma.length > 0 ? (
                  <span className="text-sm text-zinc-600">
                    {gecerliCikarma.length} seçildi
                  </span>
                ) : null}
              </div>

              {gruptakiler.length === 0 ? (
                <p className="px-2 py-2 text-sm text-zinc-500">
                  {kayitliIdleri.size === 0
                    ? "Bu grupta henüz öğrenci yok."
                    : "Aramaya uyan öğrenci yok."}
                </p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {gruptakiler.map((ogrenci) => (
                    <li key={ogrenci.id}>
                      <OgrenciSatiri
                        ad={ogrenci.ad}
                        secili={gecerliCikarma.includes(ogrenci.id)}
                        onChange={() => degistir(setCikarilacaklar, ogrenci.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {cikarDurumu.basari ? (
                <Bildirim tur="basari">{cikarDurumu.basari}</Bildirim>
              ) : null}
              {cikarDurumu.hata ? (
                <Bildirim tur="hata">{cikarDurumu.hata}</Bildirim>
              ) : null}
              {cikarDurumu.ayrinti && cikarDurumu.ayrinti.length > 0 ? (
                <ul className="space-y-0.5 text-sm text-zinc-600">
                  {cikarDurumu.ayrinti.map((satir) => (
                    <li key={satir}>• {satir}</li>
                  ))}
                </ul>
              ) : null}

              <Buton
                type="button"
                tur="tehlike"
                onClick={cikar}
                disabled={cikariliyor || gecerliCikarma.length === 0}
                engelSebebi={
                  gecerliCikarma.length === 0
                    ? "Önce çıkarılacak öğrencileri seçin."
                    : undefined
                }
              >
                {cikariliyor
                  ? "Çıkarılıyor…"
                  : gecerliCikarma.length === 0
                    ? "Gruptan çıkar"
                    : `${gecerliCikarma.length} öğrenciyi çıkar`}
              </Buton>
            </div>
          ) : null}

          {/* --- Eklenebilecekler --- */}
          <form ref={formRef} action={ekleGonder} className="space-y-3">
            <input type="hidden" name="groupId" value={grupId} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">
                Eklenebilecek öğrenciler
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-zinc-600">
                  {gecerliSecim.length} seçildi
                </span>
                <Buton
                  type="button"
                  tur="ikincil"
                  onClick={gorunenleriSec}
                  disabled={!grupId || eklenebilirler.length === 0}
                >
                  Görünenleri seç
                </Buton>
                <Buton
                  type="button"
                  tur="sade"
                  onClick={() => setSecilenler([])}
                  disabled={gecerliSecim.length === 0}
                >
                  Seçimi temizle
                </Buton>
              </div>
            </div>

            <ul className="kil-oyuk max-h-96 space-y-1 overflow-y-auto p-1">
              {eklenebilirler.length === 0 ? (
                <li className="px-2 py-3 text-sm text-zinc-500">
                  Eklenebilecek öğrenci yok.
                </li>
              ) : null}

              {eklenebilirler.map((ogrenci) => (
                <li key={ogrenci.id}>
                  <OgrenciSatiri
                    ad={ogrenci.ad}
                    secili={gecerliSecim.includes(ogrenci.id)}
                    alan={{ ad: "ogrenciler", deger: ogrenci.id }}
                    // Bu programın BAŞKA bir grubundaki kayıt engel değil,
                    // bilgi: aynı çocuk iki gruba yazılabilir ama koordinatör
                    // bunu görerek yapmalı.
                    not={ogrenci.mevcutGruplar
                      .map((grup) => grup.ad)
                      .join(", ")}
                    onChange={() => degistir(setSecilenler, ogrenci.id)}
                  />
                </li>
              ))}
            </ul>

            {ekleDurumu.basari ? (
              <Bildirim tur="basari">{ekleDurumu.basari}</Bildirim>
            ) : null}
            {ekleDurumu.hata ? (
              <Bildirim tur="hata">{ekleDurumu.hata}</Bildirim>
            ) : null}

            {ekleDurumu.ayrinti && ekleDurumu.ayrinti.length > 0 ? (
              <div className="kil-uyari p-3">
                <p className="text-sm font-medium text-vurgu-800">
                  Dikkat edilmesi gerekenler
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-vurgu-700">
                  {ekleDurumu.ayrinti.map((satir) => (
                    <li key={satir}>• {satir}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <EkleButonu sayi={gecerliSecim.length} engel={ekleEngeli} />
          </form>
        </>
      )}
    </Kart>
  );
}
