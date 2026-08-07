"use client";

import { useActionState, useMemo, useState } from "react";
import { GonderButonu } from "@/components/ui-istemci";
import { Alan, Bildirim, CokSatirli, Girdi, Kart, secimStili } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  EN_AZ_HAFTA,
  EN_FAZLA_HAFTA,
  KULUP_ATOLYE_SAYISI,
} from "@/lib/kurallar";
import { bugun, gunEkle, tarihCozumle, tarihGunleBicimle, tarihMetni } from "@/lib/tarih";
import type { EylemDurumu } from "@/lib/formlar";
import { kulupOlustur } from "../actions";

export type AtolyeSecenegi = { id: string; name: string };

/**
 * Listede gösterilen hafta sayısı — seçilebilecek gün sayısının sınırı değil.
 * Dönem sihirbazındaki 26 haftalık pencerenin kulüp karşılığı.
 */
const GOSTERILEN_HAFTA = 26;

/** Verilen tarihten sonraki ilk cumartesi — varsayılan kulüp günü. */
function sonrakiCumartesi(tarih: Date): Date {
  const gun = tarih.getUTCDay();
  return gunEkle(tarih, (6 - gun + 7) % 7);
}

function KaydetButonu({
  etkin,
  engelSebebi,
}: {
  etkin: boolean;
  engelSebebi?: string;
}) {
  return (
    <GonderButonu
      bekleyenEtiket="Oluşturuluyor…"
      disabled={!etkin}
      engelSebebi={etkin ? undefined : engelSebebi}
    >
      Kulübü oluştur
    </GonderButonu>
  );
}

/**
 * §5.1 — Kulüp oluşturma.
 *
 * Grubun günü sorulmuyor: kulübün tek bir tarihi var, grup da o gün toplanıyor.
 * Seçilen tarihin hangi güne denk geldiği anında yazılıyor ki koordinatör
 * cumartesi mi pazar mı açtığını görmeden göndermesin.
 */
export function KulupSihirbazi({ atolyeler }: { atolyeler: AtolyeSecenegi[] }) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    kulupOlustur,
    {},
  );

  // Kulüp eskiden TEK yarım gündü ve formda tek tarih vardı. Artık haftalara
  // yayılabiliyor: liste dönem sihirbazındakiyle aynı biçimde, hafta sonlarını
  // işaretleyerek kuruluyor.
  const [baslangic, setBaslangic] = useState(() =>
    tarihMetni(sonrakiCumartesi(bugun())),
  );
  const [secilenGunler, setSecilenGunler] = useState<string[]>(() => [
    tarihMetni(sonrakiCumartesi(bugun())),
  ]);
  const [secilenAtolyeler, setSecilenAtolyeler] = useState<string[]>([]);

  const adaylar = useMemo(() => {
    const baslangicTarihi = tarihCozumle(baslangic);
    if (!baslangicTarihi) return [];
    const ilk = sonrakiCumartesi(baslangicTarihi);
    // Her hafta için cumartesi ve pazar ayrı aday: kulüp iki günden birinde
    // yapılabiliyor ve bir kulüp hafta hafta gün değiştirmiyor ama kurum
    // hangi günü kullanacağını burada seçiyor.
    return Array.from({ length: GOSTERILEN_HAFTA }, (_, i) => {
      const cumartesi = gunEkle(ilk, i * 7);
      return [cumartesi, gunEkle(cumartesi, 1)];
    }).flat();
  }, [baslangic]);

  function gunDegistir(metin: string) {
    setSecilenGunler((oncekiler) =>
      oncekiler.includes(metin)
        ? oncekiler.filter((g) => g !== metin)
        : [...oncekiler, metin],
    );
  }

  const gunTamam =
    secilenGunler.length >= EN_AZ_HAFTA &&
    secilenGunler.length <= EN_FAZLA_HAFTA;
  const atolyeTamam = secilenAtolyeler.length === KULUP_ATOLYE_SAYISI;

  // Dönem sihirbazıyla aynı biçim: eksik olan şey tek yerde hesaplanıp hem
  // butonun yanında hem üstüne gelince çıkan ipucunda kullanılıyor.
  const atolyeYetersiz = atolyeler.length < KULUP_ATOLYE_SAYISI;

  const eksikMetni = [
    gunTamam
      ? null
      : secilenGunler.length === 0
        ? "En az bir kulüp günü seçin"
        : `En fazla ${EN_FAZLA_HAFTA} gün seçilebilir`,
    atolyeTamam
      ? null
      : atolyeYetersiz
        ? "Önce yeterli sayıda aktif atölye çeşidi ekleyin"
        : `${KULUP_ATOLYE_SAYISI - secilenAtolyeler.length} atölye daha seçin`,
  ]
    .filter(Boolean)
    .join(" · ");

  function atolyeDegistir(id: string) {
    setSecilenAtolyeler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((a) => a !== id)
        : [...oncekiler, id],
    );
  }

  return (
    <form action={eylem} className="space-y-6">
      {/* --- Kulüp bilgileri --- */}
      <Kart className="space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Kulüp bilgileri
        </h2>

        <Alan etiket="Kulüp adı" hata={durum.alanHatalari?.name}>
          <Girdi
            name="name"
            placeholder="Örn. Bilim Kulübü"
            defaultValue={durum.degerler?.name}
            required
          />
        </Alan>

        <Alan
          etiket="Açıklama"
          ipucu="İsteğe bağlı."
          hata={durum.alanHatalari?.description}
        >
          <CokSatirli
            name="description"
            rows={2}
            defaultValue={durum.degerler?.description}
          />
        </Alan>

        <Alan
          etiket="Listeyi şu tarihten başlat"
          ipucu="Aşağıdaki liste bu tarihten sonraki hafta sonlarını gösterir."
        >
          <Girdi
            type="date"
            value={baslangic}
            onChange={(e) => setBaslangic(e.target.value)}
            className="max-w-xs"
          />
        </Alan>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-zinc-700">
              Kulüp günleri
            </span>
            <span className="text-sm font-medium text-zinc-600">
              {secilenGunler.length} gün seçildi
            </span>
          </div>
          <p className="text-sm text-zinc-600">
            Kulüp tek yarım gün de sürebilir, haftalara da yayılabilir — kaç
            gün süreceğine siz karar verirsiniz. Program açıldıktan sonra her
            grubun takvimi ayrı ayrı düzenlenebilir.
          </p>

          <div className="grid gap-1 sm:grid-cols-2">
            {adaylar.map((gun: Date) => {
              const metin = tarihMetni(gun);
              const secili = secilenGunler.includes(metin);
              return (
                <label
                  key={metin}
                  className={cn(
                    "flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded-md border px-3 text-sm sm:min-h-0 sm:py-2",
                    secili
                      ? "border-marka-600 bg-marka-50 text-marka-800"
                      : "border-yuzey-200 bg-white text-zinc-700 hover:bg-marka-50",
                  )}
                >
                  <input
                    type="checkbox"
                    name="tarihler"
                    value={metin}
                    checked={secili}
                    onChange={() => gunDegistir(metin)}
                    className="size-4 accent-marka-600"
                  />
                  {tarihGunleBicimle(gun)}
                </label>
              );
            })}
          </div>
        </div>

      </Kart>

      {/* --- Atölyeler --- */}
      <Kart className="space-y-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Atölyeler</h2>
          <span
            className={cn(
              "text-sm font-medium",
              atolyeTamam ? "text-emerald-700" : "text-vurgu-700",
            )}
          >
            {secilenAtolyeler.length} / {KULUP_ATOLYE_SAYISI} atölye seçildi
          </span>
        </div>

        <p className="text-sm text-zinc-600">
          Kulüpte tam {KULUP_ATOLYE_SAYISI} atölye yapılır. Aynı atölyeler
          kulübün bütün gruplarında uygulanır.
        </p>

        {atolyeler.length < KULUP_ATOLYE_SAYISI ? (
          <Bildirim tur="hata">
            Kulüp açmak için en az {KULUP_ATOLYE_SAYISI} aktif atölye çeşidi
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
                          : "text-zinc-700 hover:bg-marka-50",
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
          Kontenjan dolduğunda aynı kulübe yeni grup eklenebilir.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Grup adı" hata={durum.alanHatalari?.["grup.name"]}>
            <Girdi
              name="grupAdi"
              placeholder="Örn. Sabah Grubu"
              defaultValue={durum.degerler?.grupAdi ?? "1. Grup"}
              required
            />
          </Alan>

          <Alan etiket="Kontenjan" hata={durum.alanHatalari?.["grup.capacity"]}>
            <Girdi
              name="grupKontenjani"
              type="number"
              min={1}
              max={200}
              defaultValue={durum.degerler?.grupKontenjani ?? 12}
              required
            />
          </Alan>

          <Alan
            etiket="Zaman dilimi"
            hata={durum.alanHatalari?.["grup.timeSlot"]}
          >
            <select
              name="grupZamanDilimi"
              defaultValue={durum.degerler?.grupZamanDilimi ?? "OGLEDEN_ONCE"}
              className={secimStili}
            >
              <option value="OGLEDEN_ONCE">Öğleden önce</option>
              <option value="OGLEDEN_SONRA">Öğleden sonra</option>
            </select>
          </Alan>
        </div>
      </Kart>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex flex-wrap items-center gap-3">
        <KaydetButonu
          etkin={atolyeTamam && gunTamam}
          engelSebebi={eksikMetni}
        />
        {atolyeTamam && gunTamam ? (
          /*
            Gün sayısı artık serbest; kaydetmeden ÖNCE sayıyla teyit
            ettiriliyor. Yanlış sayıyla açılan bir kulübün oturumları
            üretildikten sonra düzeltmek tek tek gün taşımak demek.
          */
          <span className="text-sm text-zinc-700">
            <strong className="font-semibold">
              {secilenGunler.length} gün
            </strong>{" "}
            seçtiniz — müfredat buna göre mi? {secilenGunler.length} gün ×{" "}
            {KULUP_ATOLYE_SAYISI} atölye ={" "}
            {secilenGunler.length * KULUP_ATOLYE_SAYISI} atölye oturumu
            oluşturulacak.
          </span>
        ) : (
          /* Dönem sihirbazıyla aynı gerekçe: eksiğin ne olduğu sayıyla
             yazılmazsa kilitli buton bozuk sanılıyor. */
          <span className="text-sm font-medium text-vurgu-700">
            {eksikMetni}
          </span>
        )}
      </div>
    </form>
  );
}
