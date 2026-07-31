"use client";

import { useActionState, useState, useTransition } from "react";
import { Bildirim, Buton, CokSatirli, Kart } from "@/components/ui";
import type { RaporMetni } from "@/lib/report-engine";
import {
  pdfOlustur,
  raporMetniDuzenle,
  raporYenidenUret,
  type EylemDurumu,
} from "../actions";

/**
 * §11.4 — Koordinatör otomatik üretilen metni düzenleyebilir.
 *
 * Düzenleme yalnızca metni değiştirir; raporun analiz çıktısı (hangi puanlardan
 * hangi sonuçların çıktığı) olduğu gibi kalır. Böylece rapor sonradan aynı
 * analizle yeniden yazılabilir.
 */
export function RaporDuzenleyici({
  raporId,
  metin,
  guncel,
}: {
  raporId: string;
  metin: RaporMetni;
  guncel: boolean;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    raporMetniDuzenle.bind(null, raporId),
    {},
  );
  const [duzenleniyor, setDuzenleniyor] = useState(false);
  const [yenidenUretiliyor, basla] = useTransition();
  const [pdfUretiliyor, pdfBasla] = useTransition();
  const [islemSonucu, setIslemSonucu] = useState<EylemDurumu | null>(null);
  const [gorulenBasari, setGorulenBasari] = useState(durum.basari);

  // Kaydetme başarılı olunca düzenleyici kapanır ve başarı bildirimi görünür.
  // Effect yerine render sırasında yapılıyor (atolye-ekle-formu ile aynı
  // desen). Bu satır olmadan başarı mesajı yalnızca kapalı dalda çizildiği
  // için hiç görünmüyordu; koordinatör uzun bir düzenlemeyi kaydediyor ve
  // hiçbir geri bildirim almıyordu.
  if (durum.basari !== gorulenBasari) {
    setGorulenBasari(durum.basari);
    if (durum.basari) setDuzenleniyor(false);
  }

  if (!duzenleniyor) {
    return (
      <div className="space-y-4">
        {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
        {islemSonucu?.hata ? (
          <Bildirim tur="hata">{islemSonucu.hata}</Bildirim>
        ) : null}
        {islemSonucu?.basari ? (
          <Bildirim tur="basari">{islemSonucu.basari}</Bildirim>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Buton
            disabled={pdfUretiliyor}
            onClick={() =>
              pdfBasla(async () => {
                setIslemSonucu(await pdfOlustur(raporId));
              })
            }
          >
            {pdfUretiliyor ? "PDF hazırlanıyor…" : "PDF oluştur"}
          </Buton>
          <Buton tur="ikincil" onClick={() => setDuzenleniyor(true)}>
            Metni düzenle
          </Buton>
          <Buton
            tur={guncel ? "ikincil" : "birincil"}
            disabled={yenidenUretiliyor}
            onClick={() =>
              basla(async () => {
                const sonuc = await raporYenidenUret(raporId);
                if (sonuc?.hata) setIslemSonucu(sonuc);
              })
            }
          >
            {yenidenUretiliyor
              ? "Üretiliyor…"
              : "Güncel puanlarla yeniden üret"}
          </Buton>
        </div>

        <p className="text-xs text-zinc-500">
          Yeniden üretim yeni bir rapor oluşturur; bu rapor ve varsa PDF’leri
          geçmişte kalır.
        </p>
      </div>
    );
  }

  return (
    <form action={eylem} className="space-y-4">
      {metin.atolyeler.map((atolye, sira) => (
        <Kart key={atolye.atolyeAdi} className="space-y-2 p-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              {atolye.atolyeAdi}
            </span>
            <CokSatirli
              name={`atolye-${sira}`}
              defaultValue={atolye.paragraf}
              rows={4}
              className="mt-2"
            />
          </label>
        </Kart>
      ))}

      <Kart className="space-y-2 p-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">
            Genel öğrenci değerlendirmesi
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Paragrafları boş satırla ayırın.
          </span>
          <CokSatirli
            name="genel"
            defaultValue={metin.genelParagraflar.join("\n\n")}
            rows={8}
            className="mt-2"
          />
        </label>
      </Kart>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex gap-2">
        <Buton type="submit">Değişiklikleri kaydet</Buton>
        <Buton
          type="button"
          tur="ikincil"
          onClick={() => setDuzenleniyor(false)}
        >
          Vazgeç
        </Buton>
      </div>
    </form>
  );
}
