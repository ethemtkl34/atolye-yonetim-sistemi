"use client";

import { useEffect, useRef, useState } from "react";
import { Alan, Girdi, Rozet, secimStili } from "@/components/ui";
import { veliAra } from "./veli-arama";

/**
 * Arama sonucunun tipi eylemin dönüşünden TÜRETİLİYOR.
 *
 * `"use server"` dosyaları fonksiyon dışında bir şey dışa aktaramıyor — tip
 * bile. Oradan `export type` yapmak üretimde 500 veriyor ve tsc, test,
 * derleme üçü de yakalamıyor (bkz. ogrenciler/sema.ts şerhi).
 */
export type VeliAramaSonucu = Awaited<ReturnType<typeof veliAra>>[number];

export type VeliSecimi =
  | { tur: "yok" }
  | { tur: "kayitli"; veli: VeliAramaSonucu }
  | { tur: "yeni" };

/**
 * §17.4 — Randevunun danışanı: veli.
 *
 * İki yol var ve ikisi de gerekli:
 *
 *  - **Kayıtlı veli**: telefonla arayan çoğu kişi zaten sistemde (çocuğu
 *    atölyeye gidiyor). Arama ad VEYA telefonla; ikisi de `Veli` kaydının
 *    normalize sütunlarından.
 *  - **Yeni veli**: hiç kaydı olmayan biri için. Önce öğrenci kaydı
 *    açtırmak, telefonda randevu veren kişi için kabul edilemez bir
 *    sürtünme olurdu — çocuk bilgisi henüz yokken de randevu açılabilmeli.
 *
 * Çocuk seçimi, kayıtlı veli seçildiğinde onun çocukları arasından yapılıyor:
 * serbest bir öğrenci seçici, yanlış çocuğu yanlış veliye bağlamanın en kolay
 * yoluydu.
 */
export function VeliSecici({
  secim,
  onDegis,
  hata,
  cocukIsteniyor,
  degerler,
}: {
  secim: VeliSecimi;
  onDegis: (secim: VeliSecimi) => void;
  hata?: string;
  /** Hizmetin danışanı çocuksa çocuk seçimi öne çıkarılır. */
  cocukIsteniyor: boolean;
  /**
   * Doğrulama hatasında (ör. mesai onayı beklerken) React 19 "yeni veli"
   * alanlarını sıfırlıyor; sunucudan dönen değerler burada geri yazılır
   * (bkz. `formlar.ts` `degerler` şerhi).
   */
  degerler?: {
    yeniVeliAdi?: string;
    yeniVeliTelefon?: string;
    yeniOgrenciAdi?: string;
    yeniOgrenciSoyadi?: string;
    yeniOgrenciDogumTarihi?: string;
  };
}) {
  const [sorgu, setSorgu] = useState("");
  /**
   * Sonuçlar ARANAN SORGUYLA birlikte saklanıyor.
   *
   * Yalnız listeyi tutsaydık, kullanıcı yazmayı sürdürürken bir önceki
   * sorgunun sonuçları ekranda kalırdı; efektin içinde eşzamanlı olarak
   * temizlemek ise zincirleme render üretiyor (React Compiler bunu hata
   * sayıyor). Sorguyu yanına yazmak ikisini de çözüyor: eşleşmeyen sonuç
   * çizilmiyor.
   */
  const [sonuc, setSonuc] = useState<{ sorgu: string; liste: VeliAramaSonucu[] }>(
    { sorgu: "", liste: [] },
  );
  const sonIstek = useRef(0);

  const anahtar = sorgu.trim();
  const guncelSonuclar = sonuc.sorgu === anahtar ? sonuc.liste : null;

  useEffect(() => {
    const aranan = sorgu.trim();
    if (aranan.length < 2) return;

    // Her tuşta sorgu atmamak için kısa gecikme; yarışı sıra numarası
    // çözüyor — geç dönen eski cevap yeniyi ezmemeli.
    const istek = ++sonIstek.current;
    const zamanlayici = setTimeout(async () => {
      const bulunan = await veliAra(aranan);
      if (istek === sonIstek.current) {
        setSonuc({ sorgu: aranan, liste: bulunan });
      }
    }, 250);

    return () => clearTimeout(zamanlayici);
  }, [sorgu]);

  if (secim.tur === "kayitli") {
    const veli = secim.veli;
    return (
      <div className="kil-oyuk space-y-3 p-3">
        <input type="hidden" name="veliId" value={veli.id} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900">{veli.ad}</p>
            <p className="text-sm text-zinc-600">
              {veli.telefon ?? "telefon yok"}
              {veli.cocuklar.length > 0
                ? ` · ${veli.cocuklar.map((c) => c.ad).join(", ")}`
                : " · kayıtlı çocuğu yok"}
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-marka-700 hover:underline"
            onClick={() => {
              onDegis({ tur: "yok" });
              setSorgu("");
            }}
          >
            Değiştir
          </button>
        </div>

        <CocukSecimi
          cocuklar={veli.cocuklar}
          cocukIsteniyor={cocukIsteniyor}
          degerler={degerler}
        />
      </div>
    );
  }

  if (secim.tur === "yeni") {
    return (
      <div className="kil-oyuk space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-700">Yeni veli</span>
          <button
            type="button"
            className="text-sm font-semibold text-marka-700 hover:underline"
            onClick={() => onDegis({ tur: "yok" })}
          >
            Kayıtlı veli ara
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Alan etiket="Ad soyad" hata={hata}>
            <Girdi
              name="yeniVeliAdi"
              required
              autoFocus
              maxLength={120}
              defaultValue={degerler?.yeniVeliAdi}
            />
          </Alan>
          <Alan etiket="Telefon" ipucu="Aynı numara kayıtlıysa o veliyle eşleşir.">
            <Girdi
              name="yeniVeliTelefon"
              type="tel"
              maxLength={30}
              defaultValue={degerler?.yeniVeliTelefon}
            />
          </Alan>
        </div>
        <input type="hidden" name="veliId" value="" />

        <CocukSecimi cocuklar={[]} cocukIsteniyor={cocukIsteniyor} degerler={degerler} />
      </div>
    );
  }

  return (
    <div className="kil-oyuk space-y-2 p-3">
      <input type="hidden" name="veliId" value="" />
      <input type="hidden" name="ogrenciId" value="" />

      <Alan
        etiket="Danışan veli"
        hata={hata}
        ipucu="Ad veya telefonla arayın; kayıtlı değilse yeni veli açın."
      >
        <Girdi
          value={sorgu}
          onChange={(olay) => setSorgu(olay.target.value)}
          placeholder="Ayşe Yılmaz veya 0532…"
          autoComplete="off"
        />
      </Alan>

      {anahtar.length >= 2 ? (
        <div className="max-h-52 space-y-1 overflow-y-auto">
          {guncelSonuclar === null ? (
            <p className="px-1 py-2 text-sm text-zinc-500">Aranıyor…</p>
          ) : guncelSonuclar.length === 0 ? (
            <p className="px-1 py-2 text-sm text-zinc-500">
              Eşleşen veli yok.
            </p>
          ) : (
            guncelSonuclar.map((veli) => (
              <button
                key={veli.id}
                type="button"
                onClick={() => onDegis({ tur: "kayitli", veli })}
                className="kil-satir flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900">
                    {veli.ad}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {veli.telefon ?? "telefon yok"}
                    {veli.cocuklar.length > 0
                      ? ` · ${veli.cocuklar.map((c) => c.ad).join(", ")}`
                      : ""}
                  </span>
                </span>
                {veli.randevuSayisi > 0 ? (
                  <Rozet tur="notr">{veli.randevuSayisi} randevu</Rozet>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="text-sm font-semibold text-marka-700 hover:underline"
        onClick={() => onDegis({ tur: "yeni" })}
      >
        Kayıtlı değil, yeni veli aç
      </button>
    </div>
  );
}

/**
 * §17.4/§6.1 — Çocuk seçimi: kayıtlı çocuklardan biri YA DA yepyeni bir
 * öğrenci.
 *
 * "Yeni öğrenci ekle" hem kayıtlı velinin (aranan çocuk henüz sistemde değil)
 * hem yeni velinin (hiç kaydı olmayan aile) altında aynı şekilde çalışır —
 * bu yüzden `cocuklar` boş bir liste olarak da gelebilir.
 *
 * Kasıtlı olarak DAR: yalnız ad/soyad/doğum tarihi. Tam öğrenci formu
 * (okul, sağlık, veli bağı…) burada YOK — bkz. `sema.ts`'teki aynı gerekçe.
 * Öğrenci veli bağı (Guardian) olmadan açılır; eksikse sonradan Öğrenciler
 * ekranından tamamlanır.
 */
function CocukSecimi({
  cocuklar,
  cocukIsteniyor,
  degerler,
}: {
  cocuklar: { id: string; ad: string }[];
  cocukIsteniyor: boolean;
  degerler?: {
    yeniOgrenciAdi?: string;
    yeniOgrenciSoyadi?: string;
    yeniOgrenciDogumTarihi?: string;
  };
}) {
  // Doğrulama hatasıyla dönüşte panel açık kalsın diye başlangıç değeri
  // `degerler`den okunuyor — aksi hâlde yazılanlar görünür ama panel kapalı
  // görünürdü (bkz. `formlar.ts` `degerler` şerhi).
  const [yeniAcik, setYeniAcik] = useState(
    Boolean(degerler?.yeniOgrenciAdi || degerler?.yeniOgrenciSoyadi),
  );

  if (yeniAcik) {
    return (
      <div className="kil-oyuk space-y-3 p-3">
        <input type="hidden" name="ogrenciId" value="" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-700">Yeni öğrenci</span>
          {cocuklar.length > 0 ? (
            <button
              type="button"
              className="text-sm font-semibold text-marka-700 hover:underline"
              onClick={() => setYeniAcik(false)}
            >
              Kayıtlı çocuklardan seç
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Alan etiket="Öğrenci adı">
            <Girdi
              name="yeniOgrenciAdi"
              required
              maxLength={60}
              defaultValue={degerler?.yeniOgrenciAdi}
            />
          </Alan>
          <Alan etiket="Öğrenci soyadı">
            <Girdi
              name="yeniOgrenciSoyadi"
              required
              maxLength={60}
              defaultValue={degerler?.yeniOgrenciSoyadi}
            />
          </Alan>
        </div>
        <Alan etiket="Doğum tarihi (isteğe bağlı)">
          <Girdi
            name="yeniOgrenciDogumTarihi"
            type="date"
            defaultValue={degerler?.yeniOgrenciDogumTarihi}
          />
        </Alan>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {cocuklar.length > 0 ? (
        <Alan
          etiket={cocukIsteniyor ? "Seansa girecek çocuk" : "Çocuk (isteğe bağlı)"}
        >
          <select
            name="ogrenciId"
            className={secimStili}
            defaultValue={cocukIsteniyor && cocuklar.length === 1 ? cocuklar[0].id : ""}
          >
            <option value="">Seçilmedi</option>
            {cocuklar.map((cocuk) => (
              <option key={cocuk.id} value={cocuk.id}>
                {cocuk.ad}
              </option>
            ))}
          </select>
        </Alan>
      ) : (
        <input type="hidden" name="ogrenciId" value="" />
      )}
      <button
        type="button"
        className="text-sm font-semibold text-marka-700 hover:underline"
        onClick={() => setYeniAcik(true)}
      >
        + Yeni öğrenci ekle
      </button>
    </div>
  );
}
