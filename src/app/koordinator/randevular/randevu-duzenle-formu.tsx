"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import { Alan, Bildirim, Buton, CokSatirli, Girdi, Kart, secimStili } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import { saatMetni, tarihMetni } from "@/lib/tarih";
import { kurustanLiraya, paraMetni, sureMetni } from "../uzmanlar/sema";
import { randevuDuzenle } from "./actions";
import type { HizmetSecenegi, UzmanSecenegi } from "./randevu-formu";
import type { RandevuSatiri } from "./takvim";
import { VeliSecici, type VeliSecimi } from "./veli-secici";

/**
 * §17.4 revizyonu — var olan randevuyu düzenleme.
 *
 * `RandevuFormu`nun (yeni randevu) KOPYASI değil, kasıtlı olarak daha dar bir
 * form — bkz. `randevu-planlama.tsx`'teki `RandevuOnayFormu` şerhindeki aynı
 * gerekçe: seri yok, tek randevu.
 *
 * Danışan (veli/çocuk) varsayılan olarak yalnız GÖSTERİLİR; "Danışanı
 * değiştir" denirse yeni randevudaki aynı seçici açılır ve form
 * `danisanDegistir=1` ile gönderilir (Eylül 2026 kararı: masa yanlış veliye
 * açılan randevuyu silip yeniden açmak zorunda kalıyordu). Bayrak yoksa
 * sunucu danışan alanlarına hiç bakmaz (bkz. `sema.ts`).
 */
export function RandevuDuzenleFormu({
  randevu,
  uzmanlar,
  hizmetler,
  enErkenTarih,
  onKapat,
}: {
  randevu: RandevuSatiri | null;
  uzmanlar: UzmanSecenegi[];
  hizmetler: HizmetSecenegi[];
  /** Geçmiş kilidi: yönetici olmayan için bugün; randevu daha erkene taşınamaz. */
  enErkenTarih?: string;
  onKapat: () => void;
}) {
  if (!randevu) return null;
  return (
    <IcerikFormu
      key={randevu.id}
      randevu={randevu}
      uzmanlar={uzmanlar}
      hizmetler={hizmetler}
      enErkenTarih={enErkenTarih}
      onKapat={onKapat}
    />
  );
}

function IcerikFormu({
  randevu,
  uzmanlar,
  hizmetler,
  enErkenTarih,
  onKapat,
}: {
  randevu: RandevuSatiri;
  uzmanlar: UzmanSecenegi[];
  hizmetler: HizmetSecenegi[];
  enErkenTarih?: string;
  onKapat: () => void;
}) {
  const [durum, gonder] = useActionState<EylemDurumu, FormData>(
    async (_onceki, veri) => {
      const sonuc = await randevuDuzenle(randevu.id, _onceki, veri);
      if (sonuc.basari) onKapat();
      return sonuc;
    },
    {},
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [mesaiZorla, setMesaiZorla] = useState(false);

  // `randevu-formu.tsx`'teki aynı desen: mesai dışı tek istisna, bir kez
  // sorulur, EVET'te gizli alanla AYNI form yeniden gönderilir.
  useEffect(() => {
    if (!durum.onayGerekli) return;
    const devamEt = window.confirm(
      `${durum.onayGerekli}\n\nYine de kaydetmek istiyor musunuz?`,
    );
    if (devamEt) queueMicrotask(() => setMesaiZorla(true));
  }, [durum]);

  useEffect(() => {
    if (mesaiZorla) formRef.current?.requestSubmit();
  }, [mesaiZorla]);

  const deger = (alan: string) => durum.degerler?.[alan];

  const secilebilirUzmanlar = uzmanlar.filter((uzman) => uzman.buSubede);
  const [uzmanId, setUzmanId] = useState(randevu.uzmanId);
  const [hizmetId, setHizmetId] = useState(randevu.hizmetId);

  // `randevu-formu.tsx`'teki aynı tuzak: eylem bitince (mesai onayı ya da
  // doğrulama hatasıyla dönüşte de) React bu `<select>`lerin DOM değerini ilk
  // seçeneğe düşürüyor; state değişmediği için yeniden uygulanmıyor ve
  // "Hizmet" görünürde boşalıyor. İmparatif senkron bunu düzeltiyor.
  const uzmanSecimi = useRef<HTMLSelectElement>(null);
  const hizmetSecimi = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (uzmanSecimi.current) uzmanSecimi.current.value = uzmanId;
    if (hizmetSecimi.current) hizmetSecimi.current.value = hizmetId;
  }, [durum, uzmanId, hizmetId]);

  const secilenUzman = secilebilirUzmanlar.find((u) => u.id === uzmanId);
  const uygunHizmetler = secilenUzman
    ? hizmetler.filter((hizmet) => secilenUzman.hizmetIdleri.includes(hizmet.id))
    : [];
  const secilenHizmet = uygunHizmetler.find((h) => h.id === hizmetId);

  // Danışan değişikliği: doğrulama hatasıyla dönüşte (ör. mesai onayı
  // beklerken) seçici açık kalsın diye başlangıç değeri sunucudan dönen
  // bayraktan okunuyor (bkz. `formlar.ts` `degerler` şerhi).
  const [danisanDegistir, setDanisanDegistir] = useState(
    deger("danisanDegistir") === "1",
  );
  const [veli, setVeli] = useState<VeliSecimi>({ tur: "yok" });

  return (
    <Pencere
      acik
      onKapat={onKapat}
      baslik="Randevuyu düzenle"
      altBaslik="Uzman, hizmet, zaman ve ücret güncellenir; gerekirse danışan da değiştirilebilir."
      genislik="36rem"
      govdeSinifi="space-y-4 overflow-y-auto px-4 pt-4"
    >
      <form ref={formRef} action={gonder} className="space-y-4">
        <input type="hidden" name="mesaiZorla" value={mesaiZorla ? "1" : ""} />
        <input type="hidden" name="danisanDegistir" value={danisanDegistir ? "1" : ""} />
        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        {danisanDegistir ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-700">
                Yeni danışan
              </span>
              <button
                type="button"
                className="text-sm font-semibold text-marka-700 hover:underline"
                onClick={() => {
                  setDanisanDegistir(false);
                  setVeli({ tur: "yok" });
                }}
              >
                Mevcut danışanı koru
              </button>
            </div>
            <VeliSecici
              secim={veli}
              onDegis={setVeli}
              hata={durum.alanHatalari?.veliId}
              cocukIsteniyor={secilenHizmet?.danisanTuru !== "VELI"}
              degerler={{
                yeniVeliAdi: deger("yeniVeliAdi"),
                yeniVeliTelefon: deger("yeniVeliTelefon"),
                yeniOgrenciAdi: deger("yeniOgrenciAdi"),
                yeniOgrenciSoyadi: deger("yeniOgrenciSoyadi"),
                yeniOgrenciDogumTarihi: deger("yeniOgrenciDogumTarihi"),
              }}
            />
          </div>
        ) : (
          <Kart className="space-y-1 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p>
                <span className="font-semibold text-zinc-900">Danışan:</span>{" "}
                {randevu.veliAdi}
                {randevu.ogrenciAdi ? ` · ${randevu.ogrenciAdi}` : ""}
              </p>
              <button
                type="button"
                className="text-sm font-semibold text-marka-700 hover:underline"
                onClick={() => setDanisanDegistir(true)}
              >
                Danışanı değiştir
              </button>
            </div>
            {randevu.seriDeMi ? (
              <p className="text-xs text-zinc-500">
                Bu randevu bir serinin parçası; bu değişiklik yalnız bu haftayı
                etkiler, serinin diğer haftalarını değiştirmez.
              </p>
            ) : null}
          </Kart>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Uzman" hata={durum.alanHatalari?.uzmanId}>
            <select
              ref={uzmanSecimi}
              name="uzmanId"
              className={secimStili}
              value={uzmanId}
              onChange={(olay) => {
                setUzmanId(olay.target.value);
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
              ref={hizmetSecimi}
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
            <Girdi
              name="tarih"
              type="date"
              defaultValue={deger("tarih") ?? tarihMetni(randevu.baslangic)}
              min={enErkenTarih}
              required
            />
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
            <Girdi
              name="saat"
              type="time"
              defaultValue={deger("saat") ?? saatMetni(randevu.baslangic)}
              required
            />
          </Alan>
        </div>

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
            <Girdi
              name="indirimLira"
              type="number"
              min={0}
              step="0.01"
              defaultValue={
                deger("indirimLira") ?? String(kurustanLiraya(randevu.indirimKurus ?? 0))
              }
            />
          </Alan>

          <Alan etiket="İndirim notu" hata={durum.alanHatalari?.indirimNotu}>
            <Girdi
              name="indirimNotu"
              maxLength={200}
              placeholder="Kardeş indirimi"
              defaultValue={deger("indirimNotu") ?? randevu.indirimNotu ?? ""}
            />
          </Alan>
        </div>

        <Alan etiket="Not (isteğe bağlı)" hata={durum.alanHatalari?.not}>
          <CokSatirli
            name="not"
            rows={2}
            maxLength={2000}
            defaultValue={deger("not") ?? randevu.not ?? ""}
          />
        </Alan>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-white/70 bg-[var(--color-yuzey-50)] px-4 py-3">
          <Buton type="button" tur="sade" onClick={onKapat}>
            Vazgeç
          </Buton>
          <GonderButonu>Kaydet</GonderButonu>
        </div>
      </form>
    </Pencere>
  );
}
