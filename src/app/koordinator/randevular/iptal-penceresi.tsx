"use client";

import { useState } from "react";
import { Pencere } from "@/components/ui-istemci";
import { Alan, Buton, CokSatirli } from "@/components/ui";
import { saatAraligiMetni, tarihGunleBicimle } from "@/lib/tarih";
import type { TekrarKapsami } from "@/lib/randevu/tekrar";
import type { RandevuSatiri } from "./takvim";

/**
 * §17.4 — Randevu iptali.
 *
 * SİLME DEĞİL: iptal edilen randevu takvimden düşer ama geçmişiyle "İptaller"
 * listesinde durur. Bu yüzden pencere "silinecek" demiyor.
 *
 * Seriden açılmış randevuda KAPSAM sorulur. Sormamak iki yanlıştan birine
 * götürürdü: ya haftalık danışmanlığı bırakan bir aile için koordinatör 8
 * randevuyu tek tek iptal ederdi, ya da tek bir hastalık haftası bütün seriyi
 * götürürdü.
 */
export function IptalPenceresi({
  randevu,
  onKapat,
  onOnayla,
}: {
  randevu: RandevuSatiri | null;
  onKapat: () => void;
  onOnayla: (kapsam: TekrarKapsami, not: string | null) => void;
}) {
  const [kapsam, setKapsam] = useState<TekrarKapsami>("yalniz-bu");
  const [not, setNot] = useState("");

  if (!randevu) return null;

  const kapat = () => {
    setKapsam("yalniz-bu");
    setNot("");
    onKapat();
  };

  return (
    <Pencere
      acik
      onKapat={kapat}
      baslik="Randevuyu iptal et"
      altBaslik={`${tarihGunleBicimle(randevu.baslangic)} · ${saatAraligiMetni(
        randevu.baslangic,
        randevu.bitis,
      )} · ${randevu.hizmetAdi}`}
      genislik="32rem"
    >
      <p className="text-sm text-zinc-600">
        {randevu.veliAdi}
        {randevu.ogrenciAdi ? ` · ${randevu.ogrenciAdi}` : ""} ·{" "}
        {randevu.uzmanAdi}
      </p>

      {randevu.seriDeMi ? (
        <fieldset className="kil-oyuk space-y-2 p-3">
          <legend className="px-1 text-sm font-semibold text-zinc-700">
            Bu randevu haftalık bir serinin parçası
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="kapsam"
              className="mt-1 size-4"
              checked={kapsam === "yalniz-bu"}
              onChange={() => setKapsam("yalniz-bu")}
            />
            <span>
              Yalnız bu randevu
              <span className="block text-xs text-zinc-500">
                Sonraki haftalar yerinde kalır.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="kapsam"
              className="mt-1 size-4"
              checked={kapsam === "bu-ve-sonrakiler"}
              onChange={() => setKapsam("bu-ve-sonrakiler")}
            />
            <span>
              Bu ve sonraki haftalar
              <span className="block text-xs text-zinc-500">
                Geçmiş randevulara dokunulmaz.
              </span>
            </span>
          </label>
        </fieldset>
      ) : null}

      <Alan etiket="İptal notu (isteğe bağlı)">
        <CokSatirli
          rows={2}
          maxLength={500}
          value={not}
          onChange={(olay) => setNot(olay.target.value)}
          placeholder="Veli erteledi, hasta…"
        />
      </Alan>

      <div className="flex justify-end gap-2 pt-1">
        <Buton type="button" tur="sade" onClick={kapat}>
          Vazgeç
        </Buton>
        <Buton
          type="button"
          tur="tehlike"
          onClick={() => onOnayla(kapsam, not.trim() || null)}
        >
          {kapsam === "bu-ve-sonrakiler" && randevu.seriDeMi
            ? "Bu ve sonrakileri iptal et"
            : "Randevuyu iptal et"}
        </Buton>
      </div>
    </Pencere>
  );
}
