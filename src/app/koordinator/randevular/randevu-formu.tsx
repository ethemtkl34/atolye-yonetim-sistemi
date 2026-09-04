"use client";

import { useActionState, useState } from "react";
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  secimStili,
} from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import { VARSAYILAN_TEKRAR_HAFTASI, EN_FAZLA_TEKRAR_HAFTASI } from "@/lib/randevu/tekrar";
import { paraMetni, sureMetni } from "../uzmanlar/sema";
import { randevuEkle } from "./actions";
import { VeliSecici, type VeliSecimi } from "./veli-secici";

export type UzmanSecenegi = {
  id: string;
  ad: string;
  renk: string;
  /** Bu şubede çalışıyor mu — çalışmıyorsa randevu açılamaz. */
  buSubede: boolean;
  hizmetIdleri: string[];
};

export type HizmetSecenegi = {
  id: string;
  ad: string;
  grup: "TEST" | "DANISMANLIK" | "ATOLYE";
  sureDk: number;
  ucretKurus: number;
  tekrarli: boolean;
  danisanTuru: "COCUK" | "VELI";
};

/**
 * §17.4 — Yeni randevu.
 *
 * Sıra bilinçli: önce UZMAN, sonra hizmet. Hizmet listesi seçilen uzmanın
 * yetkinliğine göre süzülüyor (belgedeki "hatalı atamaların önüne geçer"
 * kuralı); ters sırada kullanıcı hizmeti seçip sonra "bunu yapan uzman yok"
 * cevabını alırdı.
 *
 * Sunucu aynı kuralı ayrıca doğruluyor — buradaki süzme yalnız kurulamayacak
 * bir seçimi ekranda göstermemek için.
 */
export function RandevuFormuAcici({
  uzmanlar,
  hizmetler,
  varsayilanTarih,
}: {
  uzmanlar: UzmanSecenegi[];
  hizmetler: HizmetSecenegi[];
  varsayilanTarih: string;
}) {
  const [acik, setAcik] = useState(false);

  return (
    <>
      <Buton type="button" onClick={() => setAcik(true)}>
        Randevu aç
      </Buton>
      {acik ? (
        <RandevuFormu
          uzmanlar={uzmanlar}
          hizmetler={hizmetler}
          varsayilanTarih={varsayilanTarih}
          onKapat={() => setAcik(false)}
        />
      ) : null}
    </>
  );
}

function RandevuFormu({
  uzmanlar,
  hizmetler,
  varsayilanTarih,
  onKapat,
}: {
  uzmanlar: UzmanSecenegi[];
  hizmetler: HizmetSecenegi[];
  varsayilanTarih: string;
  onKapat: () => void;
}) {
  const [durum, gonder] = useActionState<EylemDurumu, FormData>(
    async (_onceki, veri) => {
      const sonuc = await randevuEkle(_onceki, veri);
      if (sonuc.basari) onKapat();
      return sonuc;
    },
    {},
  );

  const secilebilirUzmanlar = uzmanlar.filter((uzman) => uzman.buSubede);
  const [uzmanId, setUzmanId] = useState(secilebilirUzmanlar[0]?.id ?? "");
  const [hizmetId, setHizmetId] = useState("");
  const [veli, setVeli] = useState<VeliSecimi>({ tur: "yok" });

  const secilenUzman = secilebilirUzmanlar.find((u) => u.id === uzmanId);
  // Elle `useMemo` YOK: React Compiler bunu kendisi belleğe alıyor ve elle
  // yazılan sarmalayıcı derleyicinin optimizasyonunu bozuyor (lint kuralı
  // `react-hooks/preserve-manual-memoization` bunu hata sayıyor).
  const uygunHizmetler = secilenUzman
    ? hizmetler.filter((hizmet) => secilenUzman.hizmetIdleri.includes(hizmet.id))
    : [];

  const secilenHizmet = uygunHizmetler.find((h) => h.id === hizmetId);

  return (
    <Pencere
      acik
      onKapat={onKapat}
      baslik="Yeni randevu"
      altBaslik="Danışan velidir; çocuk seçimi isteğe bağlı. Ücret açılış anında randevuya kopyalanır."
      genislik="42rem"
      govdeSinifi="space-y-4 overflow-y-auto px-4 pt-4"
    >
      <form action={gonder} className="space-y-4">
        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        {secilebilirUzmanlar.length === 0 ? (
          <Bildirim tur="hata">
            Bu şubede çalışan aktif uzman yok. Önce Uzmanlar ekranından kadro
            tanımlayın.
          </Bildirim>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Uzman" hata={durum.alanHatalari?.uzmanId}>
            <select
              name="uzmanId"
              className={secimStili}
              value={uzmanId}
              onChange={(olay) => {
                setUzmanId(olay.target.value);
                // Yetkinlik listesi değişti; eski hizmet seçimi geçersiz.
                setHizmetId("");
              }}
              required
            >
              {secilebilirUzmanlar.map((uzman) => (
                <option key={uzman.id} value={uzman.id}>
                  {uzman.ad}
                </option>
              ))}
            </select>
          </Alan>

          <Alan
            etiket="Hizmet"
            hata={durum.alanHatalari?.hizmetId}
            ipucu={
              secilenUzman && uygunHizmetler.length === 0
                ? "Bu uzmana yetkinlik atanmamış."
                : undefined
            }
          >
            <select
              name="hizmetId"
              className={secimStili}
              value={hizmetId}
              onChange={(olay) => setHizmetId(olay.target.value)}
              required
            >
              <option value="">Seçin…</option>
              {uygunHizmetler.map((hizmet) => (
                <option key={hizmet.id} value={hizmet.id}>
                  {hizmet.ad} · {sureMetni(hizmet.sureDk)} ·{" "}
                  {hizmet.ucretKurus === 0
                    ? "ücretsiz"
                    : paraMetni(hizmet.ucretKurus)}
                </option>
              ))}
            </select>
          </Alan>

          <Alan etiket="Tarih" hata={durum.alanHatalari?.tarih}>
            <Girdi name="tarih" type="date" defaultValue={varsayilanTarih} required />
          </Alan>

          <Alan
            etiket="Saat"
            hata={durum.alanHatalari?.saat}
            ipucu={
              secilenHizmet
                ? `Seans ${sureMetni(secilenHizmet.sureDk)} sürer.`
                : undefined
            }
          >
            <Girdi name="saat" type="time" defaultValue="10:00" required />
          </Alan>
        </div>

        <VeliSecici
          secim={veli}
          onDegis={setVeli}
          hata={durum.alanHatalari?.veliId}
          cocukIsteniyor={secilenHizmet?.danisanTuru !== "VELI"}
        />

        {secilenHizmet?.tekrarli ? (
          <Alan
            etiket="Kaç hafta tekrarlansın?"
            hata={durum.alanHatalari?.haftaSayisi}
            ipucu="Seans her hafta aynı gün ve saate açılır. 1 yazarsanız tek randevu olur."
          >
            <Girdi
              name="haftaSayisi"
              type="number"
              min={1}
              max={EN_FAZLA_TEKRAR_HAFTASI}
              defaultValue={VARSAYILAN_TEKRAR_HAFTASI}
            />
          </Alan>
        ) : (
          // Tekrarsız hizmette alan hiç çizilmiyor ama sunucu yine 1 kabul
          // ediyor; zekâ testleri her seferinde elle giriliyor (§17.4).
          <input type="hidden" name="haftaSayisi" value="1" />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan
            etiket="İndirim (₺)"
            hata={durum.alanHatalari?.indirimLira}
            ipucu={
              secilenHizmet
                ? `Katalog ücreti ${paraMetni(secilenHizmet.ucretKurus)}.`
                : undefined
            }
          >
            <Girdi name="indirimLira" type="number" min={0} step="0.01" defaultValue={0} />
          </Alan>

          <Alan etiket="İndirim notu" hata={durum.alanHatalari?.indirimNotu}>
            <Girdi name="indirimNotu" maxLength={200} placeholder="Kardeş indirimi" />
          </Alan>
        </div>

        <Alan etiket="Not (isteğe bağlı)" hata={durum.alanHatalari?.not}>
          <CokSatirli name="not" rows={2} maxLength={2000} />
        </Alan>

        {/* Yapışkan eylem şeridi — uzman formundaki gerekçenin aynısı. */}
        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-white/70 bg-[var(--color-yuzey-50)] px-4 py-3">
          <Buton type="button" tur="sade" onClick={onKapat}>
            Vazgeç
          </Buton>
          <GonderButonu disabled={secilebilirUzmanlar.length === 0}>
            Randevuyu aç
          </GonderButonu>
        </div>
      </form>
    </Pencere>
  );
}
