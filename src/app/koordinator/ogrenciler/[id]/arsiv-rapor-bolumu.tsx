"use client";

import { useState } from "react";
import { Bildirim, BosDurum, Rozet, butonStili } from "@/components/ui";
import { Pencere } from "@/components/ui-istemci";
import { DetaySatiri } from "@/components/bolum-iskeleti";
import { tarihBicimle } from "@/lib/tarih";

/**
 * Geçmişten aktarılan (panel açılmadan önce dışarıda üretilmiş) öğrenci
 * değerlendirme raporları — YALNIZCA OKUMA.
 *
 * `RaporBolumu` ile ayrı duruyorlar çünkü farklı şeyler: oradaki raporlar
 * puanlardan üretiliyor, yeniden üretilebiliyor, düzenlenebiliyor. Bunlar
 * ise donmuş belgeler; ne kaynağı ne de gövdesi sistemde var. Aynı listeye
 * konsalardı "yeniden üret" düğmesi anlamsız görünürdü.
 */

export type ArsivRaporSatiri = {
  id: string;
  donemAdi: string;
  grupAdi: string | null;
  tarih: Date;
  dosyaAdi: string;
  boyut: number;
};

/** "1,2 MB" / "640 KB" — zeka testleri bölümündeki biçimin aynısı. */
function boyutBicimle(bayt: number): string {
  if (bayt >= 1024 * 1024) {
    return `${(bayt / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bayt / 1024))} KB`;
}

export function ArsivRaporBolumu({
  raporlar,
}: {
  raporlar: ArsivRaporSatiri[];
}) {
  const [secili, setSecili] = useState<ArsivRaporSatiri | null>(null);

  return (
    <div className="space-y-4">
      <Bildirim tur="bilgi">
        Bu belgeler panel kullanılmaya başlanmadan önce hazırlandı ve kütükle
        birlikte aktarıldı. Oldukları gibi saklanırlar: sistem bu dönemler için
        yeni rapor üretemez, çünkü o dönemlerin puanlaması girilmedi.
      </Bildirim>

      {raporlar.length === 0 ? (
        <BosDurum
          baslik="Arşiv raporu yok."
          aciklama="Bu öğrencinin geçmiş dönemlerden aktarılmış bir raporu bulunmuyor."
        />
      ) : (
        <div className="space-y-2">
          {raporlar.map((rapor) => (
            <DetaySatiri key={rapor.id} onClick={() => setSecili(rapor)}>
              <span className="font-medium text-zinc-900">
                {rapor.donemAdi}
              </span>
              {rapor.grupAdi ? (
                <Rozet tur="notr">{rapor.grupAdi}</Rozet>
              ) : null}
              <span className="text-sm text-zinc-700">
                {tarihBicimle(rapor.tarih)}
              </span>
              <span className="text-xs text-zinc-500">
                {boyutBicimle(rapor.boyut)}
              </span>
            </DetaySatiri>
          ))}
        </div>
      )}

      <Pencere
        acik={Boolean(secili)}
        onKapat={() => setSecili(null)}
        genislik="52rem"
        baslik={
          secili ? (
            <>
              <h3 className="text-base font-semibold text-zinc-900">
                {secili.donemAdi}
              </h3>
              <Rozet tur="pasif">Arşiv</Rozet>
            </>
          ) : null
        }
        altBaslik={
          secili
            ? [
                secili.grupAdi,
                tarihBicimle(secili.tarih),
                boyutBicimle(secili.boyut),
              ]
                .filter(Boolean)
                .join(" · ")
            : null
        }
      >
        {secili ? (
          <div className="space-y-3">
            {/* Belge ikili veri olarak veritabanında; rota onu `inline`
                verdiği için tarayıcı doğrudan gösterir. */}
            <iframe
              src={`/api/arsiv-rapor/${secili.id}`}
              title={`${secili.donemAdi} raporu`}
              className="kil-oyuk h-[60vh] w-full p-1.5"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">
                Kaynak dosya: {secili.dosyaAdi}
              </span>
              <a
                href={`/api/arsiv-rapor/${secili.id}`}
                target="_blank"
                rel="noreferrer"
                className={butonStili("ikincil")}
              >
                Yeni sekmede aç
              </a>
            </div>
          </div>
        ) : null}
      </Pencere>
    </div>
  );
}
