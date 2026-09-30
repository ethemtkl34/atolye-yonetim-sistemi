"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Girdi, Kart } from "@/components/ui";
import { hizliOgrenciAra } from "./ogrenci-hizli-arama-eylemi";

/**
 * §6.6 — Üst şeritteki hızlı öğrenci araması (30 Eylül 2026).
 *
 * Kurum en çok yaptığı şeyi en uzun yoldan yapıyordu: bir çocuğun profiline
 * bakmak için önce Öğrenciler ekranına gidip sonra aramak gerekiyordu. Üst
 * şerit her sayfada olduğu için arama da her sayfada.
 *
 * Sonuç tipi eylemin dönüşünden TÜRETİLİYOR: `"use server"` dosyası tip
 * dışa aktaramıyor (bkz. o dosyanın şerhi).
 */
type Sonuc = Awaited<ReturnType<typeof hizliOgrenciAra>>[number];

export function OgrenciHizliArama() {
  const router = useRouter();
  const [sorgu, setSorgu] = useState("");
  /**
   * Sonuçlar ARANAN SORGUYLA saklanıyor: yalnız listeyi tutsaydık kullanıcı
   * yazmayı sürdürürken bir önceki sorgunun sonuçları ekranda kalırdı
   * (`veli-secici.tsx`teki aynı desen).
   */
  const [sonuc, setSonuc] = useState<{ sorgu: string; liste: Sonuc[] }>({
    sorgu: "",
    liste: [],
  });
  const [odakli, setOdakli] = useState(false);
  const sonIstek = useRef(0);
  const kutuRef = useRef<HTMLDivElement>(null);

  const anahtar = sorgu.trim();
  const acik = odakli && anahtar.length >= 2;
  const guncelSonuclar = sonuc.sorgu === anahtar ? sonuc.liste : null;

  useEffect(() => {
    const aranan = sorgu.trim();
    if (aranan.length < 2) return;

    // Her tuşta sorgu atmamak için kısa gecikme; yarışı sıra numarası
    // çözüyor — geç dönen eski cevap yeniyi ezmemeli.
    const istek = ++sonIstek.current;
    const zamanlayici = setTimeout(async () => {
      const bulunan = await hizliOgrenciAra(aranan);
      if (istek === sonIstek.current) setSonuc({ sorgu: aranan, liste: bulunan });
    }, 250);

    return () => clearTimeout(zamanlayici);
  }, [sorgu]);

  // Dışarı tıklayınca kapansın; kutunun İÇİNE tıklamak (sonuç seçmek) kapatmaz.
  useEffect(() => {
    if (!odakli) return;
    function disaTikla(olay: MouseEvent) {
      if (!kutuRef.current?.contains(olay.target as Node)) setOdakli(false);
    }
    document.addEventListener("mousedown", disaTikla);
    return () => document.removeEventListener("mousedown", disaTikla);
  }, [odakli]);

  function ac(ogrenciId: string) {
    setSorgu("");
    setOdakli(false);
    router.push(`/koordinator/ogrenciler/${ogrenciId}`);
  }

  return (
    <div ref={kutuRef} className="relative w-full sm:w-64">
      <Girdi
        type="search"
        value={sorgu}
        onChange={(olay) => setSorgu(olay.target.value)}
        onFocus={() => setOdakli(true)}
        onKeyDown={(olay) => {
          if (olay.key === "Escape") setOdakli(false);
          // Enter tek sonuç varsa onu açar: ad yazıp Enter'a basmak, fare
          // gerektirmeyen en kısa yol.
          if (olay.key === "Enter" && guncelSonuclar?.length === 1) {
            olay.preventDefault();
            ac(guncelSonuclar[0].id);
          }
        }}
        placeholder="Öğrenci ara…"
        aria-label="Öğrenci ara"
        autoComplete="off"
        className="h-10 text-sm"
      />

      {acik ? (
        <Kart className="absolute right-0 top-full z-30 mt-1 max-h-72 w-full min-w-64 overflow-y-auto p-1">
          {guncelSonuclar === null ? (
            <p className="px-3 py-2 text-sm text-zinc-500">Aranıyor…</p>
          ) : guncelSonuclar.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-500">Eşleşen öğrenci yok.</p>
          ) : (
            guncelSonuclar.map((ogrenci) => (
              <button
                key={ogrenci.id}
                type="button"
                onClick={() => ac(ogrenci.id)}
                className="kil-satir block w-full px-3 py-2 text-left"
              >
                <span className="block truncate text-sm font-medium text-zinc-900">
                  {ogrenci.ad}
                </span>
                {ogrenci.ayrinti ? (
                  <span className="block truncate text-xs text-zinc-500">
                    {ogrenci.ayrinti}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </Kart>
      ) : null}
    </div>
  );
}
