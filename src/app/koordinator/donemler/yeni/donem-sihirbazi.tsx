"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  Kart,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  bugun,
  gunEkle,
  haftaSonuBicimle,
  tarihCozumle,
  tarihMetni,
} from "@/lib/tarih";
import { DONEM_ATOLYE_SAYISI, HAFTA_SAYISI } from "@/lib/kurallar";
import { donemOlustur, type EylemDurumu } from "../actions";

export type AtolyeSecenegi = { id: string; name: string };

/** Takvimde kaç hafta sonu gösterilsin — 6 aya yakın bir aralık. */
const GOSTERILEN_HAFTA_SAYISI = 26;

/** Verilen tarihten sonraki ilk cumartesi. */
function sonrakiCumartesi(tarih: Date): Date {
  const gun = tarih.getUTCDay();
  const fark = (6 - gun + 7) % 7;
  return gunEkle(tarih, fark);
}

function KaydetButonu({ etkin }: { etkin: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending || !etkin}>
      {pending ? "Oluşturuluyor…" : "Dönemi oluştur"}
    </Buton>
  );
}

/**
 * §4.1 — Dönem oluşturma.
 *
 * Haftalar bir ay ızgarası yerine hafta sonu listesi olarak sunuluyor:
 * kurum yalnızca hafta sonu çalışıyor, seçim birimi de hafta. Liste hâlinde
 * göstermek tatil haftalarını atlayarak 10 hafta işaretlemeyi doğrudan
 * yapılabilir kılıyor; ay ızgarasında hafta içi günler gereksiz gürültü olurdu.
 */
export function DonemSihirbazi({ atolyeler }: { atolyeler: AtolyeSecenegi[] }) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    donemOlustur,
    {},
  );

  const [baslangic, setBaslangic] = useState(() =>
    tarihMetni(sonrakiCumartesi(bugun())),
  );
  const [secilenHaftalar, setSecilenHaftalar] = useState<string[]>([]);
  const [secilenAtolyeler, setSecilenAtolyeler] = useState<string[]>([]);

  const haftaSonlari = useMemo(() => {
    const baslangicTarihi = tarihCozumle(baslangic);
    if (!baslangicTarihi) return [];

    const ilkCumartesi = sonrakiCumartesi(baslangicTarihi);
    return Array.from({ length: GOSTERILEN_HAFTA_SAYISI }, (_, i) =>
      gunEkle(ilkCumartesi, i * 7),
    );
  }, [baslangic]);

  function haftaDegistir(metin: string) {
    setSecilenHaftalar((oncekiler) =>
      oncekiler.includes(metin)
        ? oncekiler.filter((h) => h !== metin)
        : [...oncekiler, metin],
    );
  }

  function atolyeDegistir(id: string) {
    setSecilenAtolyeler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((a) => a !== id)
        : [...oncekiler, id],
    );
  }

  const haftaTamam = secilenHaftalar.length === HAFTA_SAYISI;
  const atolyeTamam = secilenAtolyeler.length === DONEM_ATOLYE_SAYISI;

  // Seçilen haftalar tarih sırasına konur; kullanıcı hangi sırayla
  // işaretlerse işaretlesin 1. hafta takvimdeki ilk hafta olmalı.
  const siraliHaftalar = [...secilenHaftalar].sort();

  return (
    <form action={eylem} className="space-y-6">
      {/* --- Dönem bilgileri --- */}
      <Kart className="space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Dönem bilgileri
        </h2>

        <Alan etiket="Dönem adı" hata={durum.alanHatalari?.name}>
          <Girdi name="name" placeholder="2026 Sonbahar Dönemi" required />
        </Alan>

        <Alan
          etiket="Açıklama"
          ipucu="İsteğe bağlı."
          hata={durum.alanHatalari?.description}
        >
          <CokSatirli name="description" rows={2} />
        </Alan>
      </Kart>

      {/* --- Eğitim haftaları --- */}
      <Kart className="space-y-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">
            Eğitim haftaları
          </h2>
          <span
            className={cn(
              "text-sm font-medium",
              haftaTamam ? "text-emerald-700" : "text-amber-700",
            )}
          >
            {secilenHaftalar.length} / {HAFTA_SAYISI} hafta seçildi
          </span>
        </div>

        <p className="text-sm text-zinc-600">
          Tatil ve ara verilecek hafta sonlarını işaretlemeyin. Dönem her zaman{" "}
          {HAFTA_SAYISI} eğitim haftasıdır; atlanan haftalar yüzünden takvim
          daha uzun sürebilir.
        </p>

        <Alan etiket="Listeyi şu tarihten başlat">
          <Girdi
            type="date"
            value={baslangic}
            onChange={(e) => setBaslangic(e.target.value)}
            className="max-w-xs"
          />
        </Alan>

        <ul className="grid max-h-80 gap-1 overflow-y-auto rounded-md border border-zinc-200 p-2 sm:grid-cols-2">
          {haftaSonlari.map((cumartesi) => {
            const metin = tarihMetni(cumartesi);
            const secili = secilenHaftalar.includes(metin);
            // Kota dolduysa yeni hafta işaretlenemez; seçili olanlar
            // kaldırılabilir kalmalı.
            const kilitli = !secili && haftaTamam;

            return (
              <li key={metin}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm",
                    secili
                      ? "bg-marka-50 text-marka-700"
                      : kilitli
                        ? "cursor-not-allowed text-zinc-300"
                        : "text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={secili}
                    disabled={kilitli}
                    onChange={() => haftaDegistir(metin)}
                    className="size-4"
                  />
                  {haftaSonuBicimle(cumartesi)}
                </label>
              </li>
            );
          })}
        </ul>

        {siraliHaftalar.map((metin) => (
          <input key={metin} type="hidden" name="tarihler" value={metin} />
        ))}
      </Kart>

      {/* --- Atölyeler --- */}
      <Kart className="space-y-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Atölyeler</h2>
          <span
            className={cn(
              "text-sm font-medium",
              atolyeTamam ? "text-emerald-700" : "text-amber-700",
            )}
          >
            {secilenAtolyeler.length} / {DONEM_ATOLYE_SAYISI} atölye seçildi
          </span>
        </div>

        <p className="text-sm text-zinc-600">
          Seçilen {DONEM_ATOLYE_SAYISI} atölye, dönemin bütün gruplarında ve{" "}
          {HAFTA_SAYISI} haftanın tamamında uygulanır.
        </p>

        {atolyeler.length < DONEM_ATOLYE_SAYISI ? (
          <Bildirim tur="hata">
            Dönem açmak için en az {DONEM_ATOLYE_SAYISI} aktif atölye çeşidi
            gerekiyor; şu an {atolyeler.length} tane var.
          </Bildirim>
        ) : (
          <ul className="space-y-1">
            {atolyeler.map((atolye) => {
              const secili = secilenAtolyeler.includes(atolye.id);
              const kilitli = !secili && atolyeTamam;

              return (
                <li key={atolye.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm",
                      secili
                        ? "bg-marka-50 text-marka-700"
                        : kilitli
                          ? "cursor-not-allowed text-zinc-300"
                          : "text-zinc-700 hover:bg-zinc-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="atolyeler"
                      value={atolye.id}
                      checked={secili}
                      disabled={kilitli}
                      onChange={() => atolyeDegistir(atolye.id)}
                      className="size-4"
                    />
                    {atolye.name}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Kart>

      {/* --- İlk grup --- */}
      <Kart className="space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">İlk grup</h2>
        <p className="text-sm text-zinc-600">
          Dönemin ilk grubu. Kontenjan dolduğunda aynı döneme yeni gruplar
          eklenebilir.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Grup adı" hata={durum.alanHatalari?.["grup.name"]}>
            <Girdi
              name="grupAdi"
              placeholder="Cumartesi Sabah"
              defaultValue="1. Grup"
              required
            />
          </Alan>

          <Alan
            etiket="Kontenjan"
            hata={durum.alanHatalari?.["grup.capacity"]}
          >
            <Girdi
              name="grupKontenjani"
              type="number"
              min={1}
              max={200}
              defaultValue={12}
              required
            />
          </Alan>

          <Alan etiket="Gün" hata={durum.alanHatalari?.["grup.day"]}>
            <select
              name="grupGunu"
              defaultValue="CUMARTESI"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100"
            >
              <option value="CUMARTESI">Cumartesi</option>
              <option value="PAZAR">Pazar</option>
            </select>
          </Alan>

          <Alan
            etiket="Zaman dilimi"
            hata={durum.alanHatalari?.["grup.timeSlot"]}
          >
            <select
              name="grupZamanDilimi"
              defaultValue="OGLEDEN_ONCE"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100"
            >
              <option value="OGLEDEN_ONCE">Öğleden önce</option>
              <option value="OGLEDEN_SONRA">Öğleden sonra</option>
            </select>
          </Alan>
        </div>
      </Kart>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex flex-wrap items-center gap-3">
        <KaydetButonu etkin={haftaTamam && atolyeTamam} />
        {haftaTamam && atolyeTamam ? (
          <span className="text-sm text-zinc-500">
            {HAFTA_SAYISI} hafta × {DONEM_ATOLYE_SAYISI} atölye ={" "}
            {HAFTA_SAYISI * DONEM_ATOLYE_SAYISI} atölye oturumu oluşturulacak.
          </span>
        ) : (
          <span className="text-sm text-zinc-500">
            Devam etmek için {HAFTA_SAYISI} hafta ve {DONEM_ATOLYE_SAYISI}{" "}
            atölye seçin.
          </span>
        )}
      </div>
    </form>
  );
}
