"use client";

import Link from "next/link";
import { useState } from "react";
import type { LeadStage } from "@/generated/prisma/enums";
import {
  adayiKaybet,
  randevuVer,
} from "@/app/koordinator/adaylar/actions";
import { mevcutOgrenciyeEsle } from "@/app/koordinator/adaylar/donusum-eylemleri";
import { useEklemePaneli, useSunucuIslemi } from "@/components/bolum-iskeleti";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  butonStili,
  secimStili,
} from "@/components/ui";
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import { ADAY_KAYIP_SEBEPLERI } from "@/lib/aday-durumlari";
import { DONUSUM_HEDEFLERI, type DonusumHedefi } from "@/lib/aday/donusum";
import type { EylemDurumu } from "@/lib/formlar";
import { cn } from "@/lib/utils";

/**
 * §16.6 — Adayın "sonraki adım" şeridi.
 *
 * Aşama açılır listeyle DEĞİL, açık eylem düğmeleriyle değişiyor. Gerekçe:
 *  - Aşama ilerletmek bu modülün asıl fiili ve iki arama arasında, telefon
 *    elde, tek elle yapılıyor. `<select>` iki isabetli dokunuş demek.
 *  - Geçişlerin üçü zorunlu veri taşıyor (randevu tarihi, kayıp sebebi,
 *    öğrenci bağlantısı); seçici zaten arkasından bir pencere açtıracaktı.
 *  - "Ulaşılamadı" hiç aşama değil — seçici bunu ifade edemez, düğme eder.
 *
 * Hangi düğmenin çizileceğini sunucu söylüyor (`izinliGecisler`), izin
 * `ADAY_ASAMA_GECISLERI` haritasından geliyor ve eylemlerde YENİDEN
 * doğrulanıyor: buradaki liste kolaylık, güvenlik değil.
 */

export type OgrenciSecenegi = { id: string; ad: string };

const HEDEF_ETIKETLERI: Record<DonusumHedefi, string> = {
  kayit: "Dönem / kulüp kaydı aç",
  zekaTesti: "Zekâ testi yükle",
  danismanlik: "Danışmanlığa yönlendir",
  yok: "Şimdilik bir şey yapma",
};

export function AdayAsamaEylemleri({
  adayId,
  asama,
  izinliGecisler,
  denemeSayisi,
  donusturebilir,
  ogrenciSecenekleri,
  asamaDegistir,
  ulasilamadiKaydet,
  adayiYenidenAc,
}: {
  adayId: string;
  asama: LeadStage;
  izinliGecisler: LeadStage[];
  denemeSayisi: number;
  /** `ogrenciler` yetkisi olmayan kullanıcıya dönüştürme sunulmaz. */
  donusturebilir: boolean;
  ogrenciSecenekleri: OgrenciSecenegi[];
  asamaDegistir: (adayId: string, hedef: LeadStage) => Promise<EylemDurumu>;
  ulasilamadiKaydet: (adayId: string) => Promise<EylemDurumu>;
  adayiYenidenAc: (adayId: string) => Promise<EylemDurumu>;
}) {
  const { durum, calisiyor, calistir } = useSunucuIslemi();
  const [kayipAcik, setKayipAcik] = useState(false);
  const [randevuAcik, setRandevuAcik] = useState(false);
  const [donusumAcik, setDonusumAcik] = useState(false);

  const kapali = asama === "KAZANILDI" || asama === "KAYBEDILDI";

  return (
    <div className="space-y-3">
      {!kapali ? (
        <div className="flex flex-wrap gap-2">
          {/* En sık basılan düğme başta: aramaların çoğu cevapsız kalıyor. */}
          <Buton
            type="button"
            tur="ikincil"
            disabled={calisiyor}
            onClick={() => calistir(() => ulasilamadiKaydet(adayId))}
          >
            {denemeSayisi > 0
              ? `Ulaşılamadı (${denemeSayisi}. deneme)`
              : "Arandı — ulaşılamadı"}
          </Buton>

          {izinliGecisler.includes("ULASILDI") ? (
            <Buton
              type="button"
              tur="ikincil"
              disabled={calisiyor}
              onClick={() => calistir(() => asamaDegistir(adayId, "ULASILDI"))}
            >
              Ulaşıldı
            </Buton>
          ) : null}

          <Buton
            type="button"
            tur="ikincil"
            onClick={() => setRandevuAcik(true)}
          >
            Randevu ver…
          </Buton>

          {izinliGecisler.includes("GORUSME_YAPILDI") ? (
            <Buton
              type="button"
              tur="ikincil"
              disabled={calisiyor}
              onClick={() =>
                calistir(() => asamaDegistir(adayId, "GORUSME_YAPILDI"))
              }
            >
              Görüşme yapıldı
            </Buton>
          ) : null}

          {donusturebilir ? (
            <Buton
              type="button"
              tur={asama === "GORUSME_YAPILDI" ? "birincil" : "ikincil"}
              onClick={() => setDonusumAcik(true)}
            >
              Öğrenciye dönüştür
            </Buton>
          ) : null}

          {/* Kaybedildi "tehlike" DEĞİL: yıkıcı bir işlem değil, sürecin
              meşru sonlarından biri ve geri alınabiliyor. */}
          <Buton type="button" tur="sade" onClick={() => setKayipAcik(true)}>
            Kaybedildi…
          </Buton>
        </div>
      ) : null}

      {asama === "KAYBEDILDI" ? (
        <Buton
          type="button"
          tur="ikincil"
          disabled={calisiyor}
          onClick={() =>
            calistir(() => adayiYenidenAc(adayId), {
              onay: "Aday yeniden açılsın mı? Kayıp sebebi silinecek.",
            })
          }
        >
          Yeniden aç
        </Buton>
      ) : null}

      {durum.basari ? <Bildirim tur="bilgi">{durum.basari}</Bildirim> : null}
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <RandevuPenceresi
        acik={randevuAcik}
        onKapat={() => setRandevuAcik(false)}
        adayId={adayId}
      />
      <KayipPenceresi
        acik={kayipAcik}
        onKapat={() => setKayipAcik(false)}
        adayId={adayId}
      />
      <DonusumPenceresi
        acik={donusumAcik}
        onKapat={() => setDonusumAcik(false)}
        adayId={adayId}
        ogrenciSecenekleri={ogrenciSecenekleri}
      />
    </div>
  );
}

function RandevuPenceresi({
  acik,
  onKapat,
  adayId,
}: {
  acik: boolean;
  onKapat: () => void;
  adayId: string;
}) {
  const { durum, eylem } = useEklemePaneli(randevuVer.bind(null, adayId));
  const h = durum.alanHatalari;

  return (
    <Pencere
      acik={acik}
      onKapat={onKapat}
      baslik="Randevu ver"
      altBaslik="Randevu günü aday “bugün aranacaklar” listesine düşer."
      genislik="26rem"
    >
      <form action={eylem} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Tarih" hata={h?.tarih}>
            <Girdi name="tarih" type="date" required />
          </Alan>
          <Alan etiket="Saat" ipucu="İsteğe bağlı" hata={h?.saat}>
            <Girdi name="saat" type="time" />
          </Alan>
        </div>
        <Alan etiket="Not" hata={h?.not}>
          <Girdi name="not" placeholder="Şubede, 2. kat" />
        </Alan>
        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
        <div className="flex flex-wrap gap-2">
          <GonderButonu>Randevuyu kaydet</GonderButonu>
          <Buton type="button" tur="ikincil" onClick={onKapat}>
            Vazgeç
          </Buton>
        </div>
      </form>
    </Pencere>
  );
}

function KayipPenceresi({
  acik,
  onKapat,
  adayId,
}: {
  acik: boolean;
  onKapat: () => void;
  adayId: string;
}) {
  const { durum, eylem } = useEklemePaneli(adayiKaybet.bind(null, adayId));
  const h = durum.alanHatalari;

  return (
    <Pencere
      acik={acik}
      onKapat={onKapat}
      baslik="Kaybedildi olarak işaretle"
      altBaslik="Sebep zorunlu: “bu ay kaç aday fiyattan kaybedildi” ancak sayılabilir bir alandan cevaplanır."
      genislik="26rem"
    >
      <form action={eylem} className="space-y-4">
        <Alan etiket="Kayıp sebebi" hata={h?.lossReason}>
          <select name="lossReason" className={secimStili} defaultValue="">
            <option value="">Seçin…</option>
            {Object.entries(ADAY_KAYIP_SEBEPLERI).map(([deger, etiket]) => (
              <option key={deger} value={deger}>
                {etiket}
              </option>
            ))}
          </select>
        </Alan>
        <Alan
          etiket="Açıklama"
          ipucu="“Diğer” seçtiyseniz zorunlu."
          hata={h?.lossNote}
        >
          <CokSatirli name="lossNote" rows={2} />
        </Alan>
        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
        <div className="flex flex-wrap gap-2">
          <GonderButonu>Kaybedildi olarak işaretle</GonderButonu>
          <Buton type="button" tur="ikincil" onClick={onKapat}>
            Vazgeç
          </Buton>
        </div>
      </form>
    </Pencere>
  );
}

/**
 * Dönüşüm penceresi — iki karar: öğrenci modu ve sonraki adım.
 *
 * "Yeni öğrenci" seçeneği bir BAĞLANTI: öğrenci formu 16 alanlık ayrı bir
 * ekran, pencerede kopyalanmaz. Aday kimliği ve hedef adresle taşınır (yalnız
 * kimlik, kişisel veri değil) ve dönüşüm öğrenci gerçekten kaydedildiğinde
 * yazılır — kullanıcı formu yarıda bırakırsa adaya hiçbir şey olmaz.
 */
function DonusumPenceresi({
  acik,
  onKapat,
  adayId,
  ogrenciSecenekleri,
}: {
  acik: boolean;
  onKapat: () => void;
  adayId: string;
  ogrenciSecenekleri: OgrenciSecenegi[];
}) {
  const [mod, setMod] = useState<"yeni" | "mevcut">("yeni");
  const [hedef, setHedef] = useState<DonusumHedefi>("kayit");
  const { durum, eylem } = useEklemePaneli(
    mevcutOgrenciyeEsle.bind(null, adayId),
  );

  return (
    <Pencere
      acik={acik}
      onKapat={onKapat}
      baslik="Öğrenciye dönüştür"
      altBaslik="Aday “Kazanıldı” olarak kapanır ve öğrenci kaydına bağlanır."
      genislik="30rem"
    >
      <div className="space-y-4">
        {/* Mod çipleri: danışan başvurusundaki dille aynı — seçili olan
            GÖMÜK durur, hangisinin açık olduğu renkten önce dokudan okunur. */}
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["yeni", "Yeni öğrenci kaydı aç"],
              ["mevcut", "Zaten kayıtlı"],
            ] as const
          ).map(([deger, etiket]) => (
            <button
              key={deger}
              type="button"
              onClick={() => setMod(deger)}
              aria-pressed={mod === deger}
              className={cn(
                "kil-buton px-3 py-1.5 text-sm",
                mod === deger ? "kil-oyuk text-marka-700" : "kil-buton-sade",
              )}
            >
              {etiket}
            </button>
          ))}
        </div>

        <Alan
          etiket="Sonraki adım"
          ipucu="Görüşmede verilen karar. Öğrenci kaydedildikten sonra bu ekrana gidilir."
        >
          <select
            className={secimStili}
            value={hedef}
            onChange={(e) => setHedef(e.target.value as DonusumHedefi)}
          >
            {DONUSUM_HEDEFLERI.map((deger) => (
              <option key={deger} value={deger}>
                {HEDEF_ETIKETLERI[deger]}
              </option>
            ))}
          </select>
        </Alan>

        {mod === "yeni" ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/koordinator/ogrenciler/yeni?aday=${adayId}&hedef=${hedef}`}
              className={butonStili()}
            >
              Öğrenci formuna geç
            </Link>
            <Buton type="button" tur="ikincil" onClick={onKapat}>
              Vazgeç
            </Buton>
          </div>
        ) : (
          <form action={eylem} className="space-y-4">
            <input type="hidden" name="hedef" value={hedef} />
            <Alan
              etiket="Öğrenci"
              ipucu="Kardeşi kayıtlı ya da daha önce gelmiş çocuklar burada."
              hata={durum.alanHatalari?.ogrenciId}
            >
              <select name="ogrenciId" className={secimStili} defaultValue="">
                <option value="">Öğrenci seçin…</option>
                {ogrenciSecenekleri.map((ogrenci) => (
                  <option key={ogrenci.id} value={ogrenci.id}>
                    {ogrenci.ad}
                  </option>
                ))}
              </select>
            </Alan>
            {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
            <div className="flex flex-wrap gap-2">
              <GonderButonu>Eşleştir ve kazanıldı yap</GonderButonu>
              <Buton type="button" tur="ikincil" onClick={onKapat}>
                Vazgeç
              </Buton>
            </div>
          </form>
        )}
      </div>
    </Pencere>
  );
}
