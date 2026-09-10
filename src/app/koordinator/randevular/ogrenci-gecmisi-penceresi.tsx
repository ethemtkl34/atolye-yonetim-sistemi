"use client";

import { useEffect, useRef, useState } from "react";
import { Buton, Girdi, Kart, Rozet } from "@/components/ui";
import { Pencere } from "@/components/ui-istemci";
import { saatAraligiMetni, tarihGunleBicimle } from "@/lib/tarih";
import { uzmanRengi } from "@/lib/uzman-renkleri";
import { DURUM_ADLARI, DURUM_ROZETLERI } from "./sema";
import { ogrenciAra, ogrenciRandevuGecmisi } from "./ogrenci-arama";

/**
 * Sonuç tipleri eylemin dönüşünden türetiliyor — `"use server"` dosyaları
 * fonksiyon dışında bir şey dışa aktaramıyor (bkz. `veli-secici.tsx`teki
 * aynı şerh).
 */
type OgrenciAramaSonucu = Awaited<ReturnType<typeof ogrenciAra>>[number];
type OgrenciGecmisi = NonNullable<Awaited<ReturnType<typeof ogrenciRandevuGecmisi>>>;

/**
 * §17.4 — "Bu çocuk hangi haftalarda, hangi hizmete geldi?" arama penceresi.
 *
 * Randevu OLUŞTURMAK için değil (bkz. `veli-secici.tsx`); var olan
 * randevuların GEÇMİŞİNE bakmak için — tarih aralığına bağlı değil, hafta/ay
 * görünümü gezmeden doğrudan öğrenci adıyla sorulur. Salt okunur: burada
 * iptal/durum değiştirme yok, o eylemler zaten Hafta/Program/Liste
 * görünümlerinde var.
 */
export function OgrenciGecmisiButonu() {
  const [acik, setAcik] = useState(false);

  return (
    <>
      <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
        Öğrenci geçmişi
      </Buton>
      {acik ? <OgrenciGecmisiPenceresi onKapat={() => setAcik(false)} /> : null}
    </>
  );
}

function OgrenciGecmisiPenceresi({ onKapat }: { onKapat: () => void }) {
  const [sorgu, setSorgu] = useState("");
  const [sonuc, setSonuc] = useState<{ sorgu: string; liste: OgrenciAramaSonucu[] }>({
    sorgu: "",
    liste: [],
  });
  const [secili, setSecili] = useState<OgrenciGecmisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const sonIstek = useRef(0);

  const anahtar = sorgu.trim();
  const guncelSonuclar = sonuc.sorgu === anahtar ? sonuc.liste : null;

  // `veli-secici.tsx`teki aynı desen: kısa gecikme + sıra numarasıyla yarış
  // koruması (geç dönen eski cevap yeniyi ezmesin).
  useEffect(() => {
    const aranan = sorgu.trim();
    if (aranan.length < 2) return;

    const istek = ++sonIstek.current;
    const zamanlayici = setTimeout(async () => {
      const bulunan = await ogrenciAra(aranan);
      if (istek === sonIstek.current) setSonuc({ sorgu: aranan, liste: bulunan });
    }, 250);

    return () => clearTimeout(zamanlayici);
  }, [sorgu]);

  async function ogrenciyiSec(ogrenciId: string) {
    setYukleniyor(true);
    const gecmis = await ogrenciRandevuGecmisi(ogrenciId);
    setYukleniyor(false);
    setSecili(gecmis);
  }

  return (
    <Pencere
      acik
      onKapat={onKapat}
      baslik={secili ? secili.ogrenci.ad : "Öğrenci geçmişi"}
      altBaslik={
        secili
          ? "Geçmiş ve gelecek tüm randevular, en yeniden eskiye."
          : "Öğrencinin adını yazın; hangi hizmete, hangi tarihte geldiğini görün."
      }
      genislik="32rem"
      govdeSinifi="space-y-3 overflow-y-auto px-4 pt-4"
    >
      {secili ? (
        <div className="space-y-3">
          <button
            type="button"
            className="text-sm font-semibold text-marka-700 hover:underline"
            onClick={() => setSecili(null)}
          >
            ‹ Başka öğrenci ara
          </button>

          {secili.randevular.length === 0 ? (
            <p className="kil-oyuk px-3 py-2 text-sm text-zinc-500">
              Bu öğrencinin hiç randevusu yok.
            </p>
          ) : (
            <div className="space-y-1.5">
              {secili.randevular.map((randevu) => {
                const ton = uzmanRengi(randevu.uzmanRengi);
                return (
                  <Kart key={randevu.id} className="space-y-1 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-900">
                        {tarihGunleBicimle(randevu.baslangic)} ·{" "}
                        {saatAraligiMetni(randevu.baslangic, randevu.bitis)}
                      </span>
                      <Rozet tur={DURUM_ROZETLERI[randevu.durum]}>
                        {DURUM_ADLARI[randevu.durum]}
                      </Rozet>
                    </div>
                    <p className="text-zinc-600">
                      {randevu.hizmetAdi} ·{" "}
                      <span style={{ color: ton.metin }}>{randevu.uzmanAdi}</span>
                    </p>
                    {randevu.not ? (
                      <p className="text-xs text-zinc-500">{randevu.not}</p>
                    ) : null}
                    {randevu.iptalNotu ? (
                      <p className="text-xs text-zinc-500">
                        İptal notu: {randevu.iptalNotu}
                      </p>
                    ) : null}
                  </Kart>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Girdi
            value={sorgu}
            onChange={(olay) => setSorgu(olay.target.value)}
            placeholder="Öğrencinin adı…"
            autoFocus
            autoComplete="off"
          />

          {anahtar.length >= 2 ? (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {yukleniyor ? (
                <p className="px-1 py-2 text-sm text-zinc-500">Yükleniyor…</p>
              ) : guncelSonuclar === null ? (
                <p className="px-1 py-2 text-sm text-zinc-500">Aranıyor…</p>
              ) : guncelSonuclar.length === 0 ? (
                <p className="px-1 py-2 text-sm text-zinc-500">Eşleşen öğrenci yok.</p>
              ) : (
                guncelSonuclar.map((ogrenci) => (
                  <button
                    key={ogrenci.id}
                    type="button"
                    onClick={() => ogrenciyiSec(ogrenci.id)}
                    className="kil-satir flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-900">
                        {ogrenci.ad}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {ogrenci.veliAdi ?? "veli yok"}
                      </span>
                    </span>
                    {ogrenci.randevuSayisi > 0 ? (
                      <Rozet tur="notr">{ogrenci.randevuSayisi} randevu</Rozet>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      )}
    </Pencere>
  );
}
