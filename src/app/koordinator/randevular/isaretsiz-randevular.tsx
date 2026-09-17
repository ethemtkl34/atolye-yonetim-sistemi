"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bildirim, Buton } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import { saatAraligiMetni, tarihGunleBicimle, tarihMetni } from "@/lib/tarih";
import { uzmanRengi } from "@/lib/uzman-renkleri";
import { randevuDurumDegistir } from "./actions";

export type IsaretsizRandevu = {
  id: string;
  baslangic: Date;
  bitis: Date;
  uzmanAdi: string;
  uzmanRengi: string;
  hizmetAdi: string;
  veliAdi: string;
  ogrenciAdi: string | null;
};

/**
 * Durumu işaretlenmemiş geçmiş randevular (Eylül 2026).
 *
 * Günü bitmiş ama hâlâ "Planlandı" duran randevu ciroya girmiyor ve "kaç
 * seans boşa gitti" sorusunu yanıltıyor. Takvimde hafta hafta gezip bulmak
 * yerine hepsi tek listede; her satır tek tıkla kapanıyor ve kapanan satır
 * sayfa tazelenince listeden düşüyor.
 *
 * Varsayılan KAPALI bir şerit: takvim ekranın asıl işi, liste yalnız "şu
 * kadar bekleyen var" diye hatırlatıyor. İşaretleme geçmiş kilidine tabi
 * değil — danışma masası da kapatabiliyor.
 */
export function IsaretsizRandevular({
  randevular,
  toplam,
}: {
  randevular: IsaretsizRandevu[];
  /** Listede gösterilenden fazla olabilir (liste sınırlı). */
  toplam: number;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [bekliyor, basla] = useTransition();

  if (toplam === 0) return null;

  const isaretle = (id: string, durum: "GERCEKLESTI" | "GELMEDI") =>
    basla(async () => {
      setMesaj(await randevuDurumDegistir(id, durum));
    });

  return (
    <details className="kil-uyari group px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-amber-900">
          Durumu işaretlenmemiş geçmiş randevular ({toplam})
        </span>
        <span className="text-xs text-amber-800 group-open:hidden">Göster</span>
        <span className="hidden text-xs text-amber-800 group-open:inline">Gizle</span>
      </summary>

      <div className="mt-3 space-y-2">
        <p className="text-xs text-amber-900">
          Günü geçmiş ama hâlâ &ldquo;Planlandı&rdquo; duran randevular ciroya girmez.
          Seansın sonucunu işaretleyin.
        </p>

        {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

        <ul className="space-y-1.5">
          {randevular.map((randevu) => {
            const ton = uzmanRengi(randevu.uzmanRengi);
            return (
              <li
                key={randevu.id}
                className="kil-satir flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <Link
                    href={`/koordinator/randevular?gorunum=gun&tarih=${tarihMetni(randevu.baslangic)}`}
                    className="font-semibold text-zinc-900 hover:underline"
                  >
                    {tarihGunleBicimle(randevu.baslangic)} ·{" "}
                    {saatAraligiMetni(randevu.baslangic, randevu.bitis)}
                  </Link>
                  <span className="block text-zinc-600">
                    {randevu.hizmetAdi} ·{" "}
                    <span style={{ color: ton.metin }}>{randevu.uzmanAdi}</span> ·{" "}
                    {randevu.ogrenciAdi
                      ? `${randevu.ogrenciAdi} (${randevu.veliAdi})`
                      : randevu.veliAdi}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Buton
                    type="button"
                    tur="ikincil"
                    disabled={bekliyor}
                    onClick={() => isaretle(randevu.id, "GERCEKLESTI")}
                  >
                    Gerçekleşti
                  </Buton>
                  <Buton
                    type="button"
                    tur="sade"
                    disabled={bekliyor}
                    onClick={() => isaretle(randevu.id, "GELMEDI")}
                  >
                    Gelmedi
                  </Buton>
                </span>
              </li>
            );
          })}
        </ul>

        {toplam > randevular.length ? (
          <p className="text-xs text-amber-900">
            İlk {randevular.length} randevu gösteriliyor; işaretledikçe sıradakiler gelir.
          </p>
        ) : null}
      </div>
    </details>
  );
}
