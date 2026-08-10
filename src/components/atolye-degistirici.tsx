"use client";

import { useState, useTransition } from "react";
import { Bildirim, Buton, secimStili } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import { programAtolyesiniDegistir } from "@/app/koordinator/mufredat/atolye-degistir-eylemi";
import type { MufredatHedefi } from "@/app/koordinator/mufredat/actions";

export type DegistirilebilirAtolye = {
  /** TermWorkshop/ClubWorkshop satır kimliği. */
  programAtolyeId: string;
  ad: string;
  ogretmenAdi: string | null;
};

/**
 * Program detayındaki atölye listesi + atölye değiştirme.
 *
 * Sayı sabit (dönemde 5, kulüpte 3), bu yüzden çıkarma/ekleme yok; bir satır
 * ancak başka bir atölyeyle DEĞİŞTİRİLİR. Eylem eski atölyenin müfredatını ve
 * rapor paragrafını da sildiği, puanlanmış atölyeyi reddettiği için onay
 * penceresi sonuçları açıkça sayar.
 *
 * Tek seferde bir satırın seçimi açık tutulur (mufredat-editoru deseni).
 */
export function AtolyeDegistirici({
  hedef,
  atolyeler,
  secenekler,
  duzenlenebilir,
}: {
  hedef: MufredatHedefi;
  atolyeler: DegistirilebilirAtolye[];
  /** Aktif atölye çeşitleri; programda olanlar sayfada elenmiş gelir. */
  secenekler: { id: string; ad: string }[];
  duzenlenebilir: boolean;
}) {
  const [bekliyor, basla] = useTransition();
  const [durum, setDurum] = useState<EylemDurumu | null>(null);
  const [acikSatir, setAcikSatir] = useState<string | null>(null);
  const [secilen, setSecilen] = useState("");

  const degistirilebilir = duzenlenebilir && secenekler.length > 0;

  return (
    <div className="mt-3 space-y-3">
      {durum?.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {durum?.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <ol className="space-y-1">
        {atolyeler.map((atolye, sira) => (
          <li key={atolye.programAtolyeId} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 tabular-nums text-zinc-400">
                {sira + 1}.
              </span>
              <span className="min-w-0 flex-1 text-zinc-700">
                {atolye.ad}
                {atolye.ogretmenAdi ? (
                  <span className="text-zinc-500"> · {atolye.ogretmenAdi}</span>
                ) : null}
              </span>
              {degistirilebilir ? (
                <Buton
                  tur="sade"
                  disabled={bekliyor}
                  onClick={() => {
                    setDurum(null);
                    setSecilen("");
                    setAcikSatir(
                      acikSatir === atolye.programAtolyeId
                        ? null
                        : atolye.programAtolyeId,
                    );
                  }}
                >
                  Değiştir
                </Buton>
              ) : null}
            </div>

            {acikSatir === atolye.programAtolyeId ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                <select
                  className={`${secimStili} sm:w-72`}
                  value={secilen}
                  onChange={(olay) => setSecilen(olay.target.value)}
                  autoFocus
                >
                  <option value="">Yeni atölyeyi seçin…</option>
                  {secenekler.map((secenek) => (
                    <option key={secenek.id} value={secenek.id}>
                      {secenek.ad}
                    </option>
                  ))}
                </select>
                <Buton
                  type="button"
                  disabled={bekliyor || !secilen}
                  onClick={() => {
                    const yeniAd =
                      secenekler.find((s) => s.id === secilen)?.ad ?? "";
                    if (
                      window.confirm(
                        `"${atolye.ad}" atölyesi "${yeniAd}" ile değiştirilecek. Mevcut oturumlar yeni atölyeye taşınır; eski atölyenin müfredat konuları ve rapor paragrafı silinir, öğretmen adı sıfırlanır. Devam edilsin mi?`,
                      )
                    ) {
                      basla(async () => {
                        const sonuc = await programAtolyesiniDegistir(
                          hedef,
                          atolye.programAtolyeId,
                          secilen,
                        );
                        setDurum(sonuc);
                        if (sonuc.basari) setAcikSatir(null);
                      });
                    }
                  }}
                >
                  {bekliyor ? "Değiştiriliyor…" : "Değiştir"}
                </Buton>
                <Buton
                  type="button"
                  tur="ikincil"
                  disabled={bekliyor}
                  onClick={() => setAcikSatir(null)}
                >
                  Vazgeç
                </Buton>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
