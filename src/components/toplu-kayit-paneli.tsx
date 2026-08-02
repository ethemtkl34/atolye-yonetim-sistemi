"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alan, Bildirim, Buton, Girdi, Kart, Rozet, secimStili } from "@/components/ui";
import { normalizeArama } from "@/lib/turkce";
import { cn } from "@/lib/utils";
import {
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
  const { pending } = useFormStatus();
  return (
    <Buton
      type="submit"
      disabled={pending || sayi === 0 || Boolean(engel)}
      engelSebebi={engel ?? (sayi === 0 ? "Önce öğrenci seçin." : undefined)}
    >
      {pending
        ? "Ekleniyor…"
        : sayi === 0
          ? "Öğrenci ekle"
          : `${sayi} öğrenciyi ekle`}
    </Buton>
  );
}

/**
 * Dönem ve kulüp sayfasındaki "gruba öğrenci ekle" paneli.
 *
 * Kayıt akışının ters yönü: sihirbaz öğrenciden başlayıp programa gidiyor,
 * burada program bellidir ve öğrenciler şubenin listesinden seçilir. Tek
 * öğrenci de aynı panelden eklenir — ayrı bir "tekli" ekran açmak, aynı
 * kuralların ikinci bir kopyasını doğururdu.
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
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    topluKayitOlustur,
    {},
  );

  const acilabilirGruplar = gruplar.filter((grup) => grup.aktif);
  const [grupId, setGrupId] = useState(
    () => acilabilirGruplar.find((grup) => !grup.dolu)?.id ?? "",
  );
  const [arama, setArama] = useState("");
  const [secilenler, setSecilenler] = useState<string[]>([]);

  const secilenGrup = gruplar.find((grup) => grup.id === grupId);
  const kalanYer = secilenGrup
    ? Math.max(0, secilenGrup.kapasite - secilenGrup.doluluk)
    : 0;

  /** Seçili grupta zaten aktif kaydı olanlar. */
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

  /**
   * Ekranda geçerli sayılan seçim.
   *
   * Ham seçim listesi temizlenmiyor, süzülüyor: ekleme başarılı olunca sayfa
   * tazeleniyor ve eklenen öğrenciler artık "bu grupta" oluyor — buradan da
   * kendiliğinden düşüyorlar. Grup değiştiğinde de aynı süzgeç çalışıyor, geri
   * kalan seçim korunuyor (aynı listeyi başka bir gruba eklemek yaygın).
   */
  const gecerliSecim = useMemo(
    () => secilenler.filter((id) => !kayitliIdleri.has(id)),
    [secilenler, kayitliIdleri],
  );

  const aranan = normalizeArama(arama);
  const gorunenler = useMemo(
    () =>
      aranan
        ? ogrenciler.filter((ogrenci) => ogrenci.aramaAdi.includes(aranan))
        : ogrenciler,
    [ogrenciler, aranan],
  );

  function degistir(id: string) {
    setSecilenler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((secili) => secili !== id)
        : [...oncekiler, id],
    );
  }

  function gorunenleriSec() {
    const eklenebilir = gorunenler
      .filter((ogrenci) => !kayitliIdleri.has(ogrenci.id))
      .map((ogrenci) => ogrenci.id);
    setSecilenler((oncekiler) => [
      ...new Set([...oncekiler, ...eklenebilir]),
    ]);
  }

  /**
   * Kutular form sıfırlandıktan sonra durumdan geri yazılıyor — kayıt
   * formundaki ve stajyer kadrosundaki sorunun aynısı.
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
  }, [durum, gecerliSecim]);

  const grupEngeli = engelSebebi
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
          Gruba öğrenci ekle
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Şubenizin öğrenci listesinden seçip topluca kaydedin. Sorumlu stajyer
          burada sorulmuyor; atama {programAdi} başlarken Atamalar ekranından
          yapılıyor. Kontenjan yetmezse sığan öğrenciler eklenir, kalanlar
          adlarıyla bildirilir.
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
        <form ref={formRef} action={eylem} className="space-y-4">
          <input type="hidden" name="groupId" value={grupId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Alan etiket="Grup" hata={durum.alanHatalari?.groupId}>
              <select
                value={grupId}
                onChange={(e) => setGrupId(e.target.value)}
                className={secimStili}
                disabled={Boolean(engelSebebi)}
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-zinc-700">
              {gecerliSecim.length} öğrenci seçildi
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Buton
                type="button"
                tur="ikincil"
                onClick={gorunenleriSec}
                disabled={!grupId}
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

          <ul className="max-h-96 space-y-1 overflow-y-auto rounded-md border border-yuzey-200 p-1">
            {gorunenler.length === 0 ? (
              <li className="px-2 py-3 text-sm text-zinc-500">
                Aramaya uyan öğrenci yok.
              </li>
            ) : null}

            {gorunenler.map((ogrenci) => {
              const kayitli = kayitliIdleri.has(ogrenci.id);
              const secili = gecerliSecim.includes(ogrenci.id);
              // Bu programın BAŞKA bir grubundaki kayıtlar engel değil, bilgi:
              // aynı çocuk iki gruba yazılabilir, ama koordinatör bunu görerek
              // yapmalı.
              const digerGruplar = ogrenci.mevcutGruplar.filter(
                (grup) => grup.id !== grupId,
              );

              return (
                <li key={ogrenci.id}>
                  <label
                    title={
                      kayitli
                        ? `${ogrenci.ad} bu gruba zaten kayıtlı.`
                        : undefined
                    }
                    className={cn(
                      "flex min-h-[2.75rem] items-center gap-2 rounded px-2 py-2 text-sm sm:min-h-0 sm:py-1.5",
                      kayitli
                        ? "cursor-not-allowed text-zinc-400"
                        : secili
                          ? "cursor-pointer bg-marka-50 text-marka-700"
                          : "cursor-pointer text-zinc-700 hover:bg-marka-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="ogrenciler"
                      value={ogrenci.id}
                      checked={secili}
                      disabled={kayitli || !grupId}
                      onChange={() => degistir(ogrenci.id)}
                      className="size-4 shrink-0"
                    />
                    <span className="flex-1">{ogrenci.ad}</span>
                    {kayitli ? (
                      <Rozet tur="olumlu">Bu grupta</Rozet>
                    ) : digerGruplar.length > 0 ? (
                      <span className="text-xs text-zinc-500">
                        {digerGruplar.map((grup) => grup.ad).join(", ")}
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>

          {durum.basari ? (
            <Bildirim tur="basari">{durum.basari}</Bildirim>
          ) : null}
          {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

          {durum.ayrinti && durum.ayrinti.length > 0 ? (
            <div className="rounded-md border border-vurgu-200 bg-vurgu-50 p-3">
              <p className="text-sm font-medium text-vurgu-800">
                Dikkat edilmesi gerekenler
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-vurgu-700">
                {durum.ayrinti.map((satir) => (
                  <li key={satir}>• {satir}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <EkleButonu sayi={gecerliSecim.length} engel={grupEngeli} />
        </form>
      )}
    </Kart>
  );
}
