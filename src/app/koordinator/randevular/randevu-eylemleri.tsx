"use client";

import { Buton, butonStili } from "@/components/ui";
import {
  anketMetni,
  hatirlatmaMetni,
  whatsappMesajBaglantisi,
} from "@/lib/randevu/mesaj";
import type { RandevuSatiri } from "./takvim";

/**
 * §17.4/§17.6 — Randevu üzerindeki eylemler: durum değiştirme, iptal,
 * WhatsApp hatırlatma/anket bağlantıları.
 *
 * `RandevuKarti` (liste görünümü) ve `Izgara` (Program görünümü, blok detay
 * penceresi) AYNI eylemleri gösterir — burada tek yerde tutulmazsa iki kopya
 * zamanla ayrışır (bir yerde eklenen bir düğme diğerinde unutulur).
 */
export function RandevuEylemleri({
  randevu,
  yazabilir,
  kurumAdi,
  bekliyor,
  onDurum,
  onIptal,
}: {
  randevu: RandevuSatiri;
  yazabilir: boolean;
  kurumAdi: string;
  bekliyor: boolean;
  onDurum: (durum: "PLANLANDI" | "GERCEKLESTI" | "GELMEDI") => void;
  onIptal: () => void;
}) {
  const iptalEdilmis = randevu.durum === "IPTAL";

  if (!yazabilir || !randevu.bizim || iptalEdilmis) return null;

  /**
   * Otomatik gönderim yok: bağlantı WhatsApp'ı hazır metinle açıyor, gönder
   * tuşuna kullanıcı basıyor. Numara tam değilse bağlantı `null` dönüyor ve
   * düğme HİÇ çizilmiyor — çalışmayan düğme, olmayan düğmeden kötüdür.
   *
   * Hatırlatma PLANLI randevuda, anket GERÇEKLEŞEN seansta anlamlı; ikisi
   * aynı anda çıkmıyor.
   */
  const mesajBilgisi = randevu.veliAdi
    ? {
        kurumAdi,
        veliAdi: randevu.veliAdi,
        cocukAdi: randevu.ogrenciAdi,
        hizmetAdi: randevu.hizmetAdi,
        uzmanAdi: randevu.uzmanAdi,
        baslangic: randevu.baslangic,
      }
    : null;

  const hatirlatmaYolu =
    mesajBilgisi && randevu.durum === "PLANLANDI"
      ? whatsappMesajBaglantisi(randevu.veliTelefon, hatirlatmaMetni(mesajBilgisi))
      : null;

  const anketYolu =
    mesajBilgisi && randevu.durum === "GERCEKLESTI"
      ? whatsappMesajBaglantisi(randevu.veliTelefon, anketMetni(mesajBilgisi))
      : null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {hatirlatmaYolu ? (
        <a
          href={hatirlatmaYolu}
          target="_blank"
          rel="noopener noreferrer"
          className={butonStili("sade")}
        >
          Hatırlat
        </a>
      ) : null}
      {anketYolu ? (
        <a
          href={anketYolu}
          target="_blank"
          rel="noopener noreferrer"
          className={butonStili("sade")}
        >
          Anket
        </a>
      ) : null}
      {randevu.durum === "GERCEKLESTI" ? null : (
        <Buton
          type="button"
          tur="ikincil"
          disabled={bekliyor}
          onClick={() => onDurum("GERCEKLESTI")}
        >
          Gerçekleşti
        </Buton>
      )}
      {randevu.durum === "GELMEDI" ? null : (
        <Buton
          type="button"
          tur="sade"
          disabled={bekliyor}
          onClick={() => onDurum("GELMEDI")}
        >
          Gelmedi
        </Buton>
      )}
      <Buton type="button" tur="tehlike" disabled={bekliyor} onClick={onIptal}>
        İptal
      </Buton>
    </div>
  );
}
