"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bildirim, Buton, DonenHalka, Kart, Rozet, baglantiStili, geriBaglantiStili } from "@/components/ui";
import { tarihBicimle } from "@/lib/tarih";
import type { KapsamKaydi, PdfKaydi, RaporOzeti } from "@/lib/rapor-verisi";
import {
  MetinDuzenleme,
  RaporIcerigi,
  YeniRaporFormu,
} from "./rapor-pencereleri";
import {
  pdfOlustur,
  raporMetniDuzenle,
  raporOlustur,
  raporPenceresiVerisi,
  raporYenidenUret,
  type EylemDurumu,
  type RaporPenceresiVerisi,
} from "./rapor-eylemleri";

/**
 * §11 — Öğrencinin raporları.
 *
 * Raporun tamamı öğrenci profilinden çıkmadan yönetilir: liste burada, içerik
 * ve düzenleme ise bir pencerede (native `<dialog>`). Önceden her rapor ayrı
 * bir sayfaya götürüyordu ve koordinatör öğrenciyle rapor arasında sürekli
 * gidip geliyordu; rapor öğrenciye ait bir belge olduğu için yeri burası.
 *
 * Pencere adres satırıyla da açılabilir (`?rapor=<id>` veya `?rapor=yeni`):
 * eski rapor bağlantıları ve dashboard'dan gelen adresler bu sayede
 * çalışmaya devam eder.
 */
export function RaporBolumu({
  ogrenciId,
  ogrenciAdi,
  raporlar,
  kapsamKayitlari,
  pdfler,
  acilisParametresi,
}: {
  ogrenciId: string;
  ogrenciAdi: string;
  raporlar: RaporOzeti[];
  kapsamKayitlari: KapsamKaydi[];
  pdfler: PdfKaydi[];
  /** `?rapor=` değeri: "yeni", bir rapor kimliği ya da yok. */
  acilisParametresi?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  type Pencere = { mod: "yeni" } | { mod: "detay"; raporId: string } | null;

  const acilisPenceresi = (deger?: string): Pencere =>
    !deger
      ? null
      : deger === "yeni"
        ? { mod: "yeni" }
        : { mod: "detay", raporId: deger };

  // Adresten gelen açılış isteği (dashboard bağlantıları, paylaşılan adres)
  // ilk durumu belirler; sonradan değişirse aşağıdaki karşılaştırma yakalar.
  const [pencere, setPencere] = useState<Pencere>(() =>
    acilisPenceresi(acilisParametresi),
  );
  const [gorulenAcilis, setGorulenAcilis] = useState(acilisParametresi);
  if (acilisParametresi !== gorulenAcilis) {
    setGorulenAcilis(acilisParametresi);
    setPencere(acilisPenceresi(acilisParametresi));
  }

  // Yüklenen gövde hangi rapora ait olduğuyla birlikte tutuluyor: böylece
  // "yükleniyor" ve "veri hazır" durumları ayrı bayraklarla değil, render
  // sırasında karşılaştırmayla türetiliyor (effect içinde setState yok).
  const [veriKutusu, setVeriKutusu] = useState<{
    raporId: string;
    veri: RaporPenceresiVerisi | null;
  } | null>(null);
  const [duzenleniyor, setDuzenleniyor] = useState(false);
  const [islemSonucu, setIslemSonucu] = useState<EylemDurumu | null>(null);
  const [islemde, basla] = useTransition();
  // Hangi uzun işlemin sürdüğü — buton kendi spinner'ını gösterir, diğeri
  // yalnızca kilitlenir. `islemde` bitince kendiliğinden anlamsızlaşır.
  const [surenIslem, setSurenIslem] = useState<"pdf" | "yeniden" | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);

  const veri =
    pencere?.mod === "detay" && veriKutusu?.raporId === pencere.raporId
      ? veriKutusu.veri
      : null;
  const yukleniyor =
    pencere?.mod === "detay" && veriKutusu?.raporId !== pencere.raporId;

  // Pencere durumu ile <dialog> öğesini eşitler. Native dialog kullanılıyor:
  // odak tuzağı, ESC ile kapanma ve arka plan engeli tarayıcıdan geliyor.
  useEffect(() => {
    const kutu = dialogRef.current;
    if (!kutu) return;
    if (pencere && !kutu.open) kutu.showModal();
    if (!pencere && kutu.open) kutu.close();
  }, [pencere]);

  // Detay penceresi açıldığında raporun gövdesi çekilir.
  useEffect(() => {
    if (pencere?.mod !== "detay") return;
    const raporId = pencere.raporId;

    let iptal = false;
    raporPenceresiVerisi(raporId).then((sonuc) => {
      if (!iptal) setVeriKutusu({ raporId, veri: sonuc });
    });

    return () => {
      iptal = true;
    };
  }, [pencere]);

  function ac(hedef: { mod: "yeni" } | { mod: "detay"; raporId: string }) {
    setIslemSonucu(null);
    setDuzenleniyor(false);
    setPencere(hedef);
  }

  function kapat() {
    setPencere(null);
    setDuzenleniyor(false);
    setIslemSonucu(null);
    // Adresteki ?rapor= izi kalırsa pencere her tazelemede yeniden açılırdı.
    if (acilisParametresi) router.replace(pathname, { scroll: false });
  }

  /** Pencerede duran raporu ve arkadaki listeyi tazeler. */
  async function tazele(raporId: string) {
    setVeriKutusu({ raporId, veri: await raporPenceresiVerisi(raporId) });
    router.refresh();
  }

  const [olusturmaDurumu, olusturmaEylemi] = useActionState<
    EylemDurumu,
    FormData
  >(async (onceki, form) => {
    const sonuc = await raporOlustur(ogrenciId, onceki, form);
    // Üretilen rapor aynı pencerede açılır; kullanıcı hiçbir yere gitmez.
    if (sonuc.raporId) {
      setPencere({ mod: "detay", raporId: sonuc.raporId });
      setIslemSonucu({ basari: sonuc.basari });
      router.refresh();
    }
    return sonuc;
  }, {});

  const [duzenlemeDurumu, duzenlemeEylemi] = useActionState<
    EylemDurumu,
    FormData
  >(async (onceki, form) => {
    if (pencere?.mod !== "detay") return { hata: "Rapor bulunamadı." };
    const sonuc = await raporMetniDuzenle(pencere.raporId, onceki, form);
    if (sonuc.basari) {
      setDuzenleniyor(false);
      setIslemSonucu({ basari: sonuc.basari });
      await tazele(pencere.raporId);
    }
    return sonuc;
  }, {});

  function pdfUret() {
    if (pencere?.mod !== "detay") return;
    const raporId = pencere.raporId;
    setSurenIslem("pdf");
    basla(async () => {
      const sonuc = await pdfOlustur(raporId);
      setIslemSonucu(sonuc);
      if (sonuc.basari) await tazele(raporId);
    });
  }

  function yenidenUret() {
    if (pencere?.mod !== "detay") return;
    const raporId = pencere.raporId;
    setSurenIslem("yeniden");
    basla(async () => {
      const sonuc = await raporYenidenUret(raporId);
      setIslemSonucu(sonuc);
      // Yeniden üretim yeni bir rapor açar; eskisi geçmişte kalır (§13.17).
      if (sonuc.raporId) {
        setPencere({ mod: "detay", raporId: sonuc.raporId });
        router.refresh();
      }
    });
  }

  return (
    <>
      {/* --- Rapor listesi --- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Raporlar</h2>
          <Buton
            tur="ikincil"
            onClick={() => ac({ mod: "yeni" })}
            disabled={kapsamKayitlari.length === 0}
            engelSebebi={
              kapsamKayitlari.length === 0
                ? "Rapor üretebilmek için önce bir dönem veya kulüp kaydı oluşturun."
                : undefined
            }
          >
            Yeni rapor oluştur
          </Buton>
        </div>

        {raporlar.length === 0 ? (
          <p className="rounded-lg border border-dashed border-marka-200 bg-white p-6 text-center text-sm text-zinc-600">
            Henüz rapor üretilmemiş. Rapor, mevcut puanlamalardan istenildiği
            anda üretilebilir.
          </p>
        ) : (
          <div className="space-y-2">
            {raporlar.map((rapor) => (
              <button
                key={rapor.id}
                type="button"
                onClick={() => ac({ mod: "detay", raporId: rapor.id })}
                className="block w-full rounded-lg border border-yuzey-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(91,16,53,0.04)] transition-colors hover:border-marka-200 hover:bg-marka-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">
                    {tarihBicimle(rapor.uretimZamani)} raporu
                  </span>
                  <Rozet tur={rapor.guncel ? "olumlu" : "uyari"}>
                    {rapor.guncel ? "Güncel" : "Güncel değil"}
                  </Rozet>
                  {rapor.duzenlemeZamani ? <Rozet>Elle düzenlendi</Rozet> : null}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {rapor.kapsam.join(" · ")} · {rapor.atolyeSayisi} atölye
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* --- PDF geçmişi --- */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">
          PDF rapor geçmişi
        </h2>

        {pdfler.length === 0 ? (
          <p className="rounded-lg border border-dashed border-marka-200 bg-white p-6 text-center text-sm text-zinc-600">
            Henüz PDF oluşturulmamış. Bir raporu açıp “PDF oluştur” düğmesini
            kullanın; üretilen PDF’ler burada kalıcı olarak saklanır.
          </p>
        ) : (
          <Kart className="divide-y divide-yuzey-100">
            {pdfler.map((pdf) => (
              <div
                key={pdf.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm text-zinc-800">
                    {tarihBicimle(pdf.olusturmaZamani)} tarihli PDF
                  </p>
                  <p className="text-xs text-zinc-500">
                    {tarihBicimle(pdf.raporUretimZamani)} raporundan üretildi
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => ac({ mod: "detay", raporId: pdf.raporId })}
                    className={geriBaglantiStili}
                  >
                    Raporu gör
                  </button>
                  <a
                    href={pdf.adres}
                    target="_blank"
                    rel="noreferrer"
                    className={baglantiStili}
                  >
                    PDF’i aç
                  </a>
                </div>
              </div>
            ))}
          </Kart>
        )}
      </div>

      {/* --- Pencere --- */}
      <dialog
        ref={dialogRef}
        onClose={kapat}
        aria-label={`${ogrenciAdi} raporu`}
        className="m-auto w-[min(68rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-marka-950/40 backdrop:backdrop-blur-md"
      >
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-yuzey-200 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900">
                {pencere?.mod === "yeni"
                  ? "Yeni rapor"
                  : `${ogrenciAdi} — Öğrenci Raporu`}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {pencere?.mod === "yeni"
                  ? "Raporun kapsayacağı kayıtları seçin."
                  : veri
                    ? `${tarihBicimle(veri.detay.ozet.uretimZamani)} · ${veri.detay.ozet.kapsam.join(" · ")}`
                    : "Yükleniyor…"}
              </p>
            </div>
            <button
              type="button"
              onClick={kapat}
              aria-label="Pencereyi kapat"
              className="-mr-1 shrink-0 rounded-md px-2 py-1 text-xl leading-none text-zinc-400 transition-colors hover:bg-yuzey-50 hover:text-zinc-700"
            >
              ×
            </button>
          </header>

          {/* Pencere kapalıyken içerik hiç çizilmez: form durumu ve seçimler
              her açılışta sıfırdan başlasın. */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-yuzey-50 px-5 py-4">
            {!pencere ? null : pencere.mod === "yeni" ? (
              <YeniRaporFormu
                kayitlar={kapsamKayitlari}
                durum={olusturmaDurumu}
                eylem={olusturmaEylemi}
              />
            ) : yukleniyor || !veri ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                {yukleniyor ? "Rapor yükleniyor…" : "Rapor bulunamadı."}
              </p>
            ) : duzenleniyor ? (
              <MetinDuzenleme
                metin={veri.detay.govde.metin}
                durum={duzenlemeDurumu}
                eylem={duzenlemeEylemi}
                onVazgec={() => setDuzenleniyor(false)}
              />
            ) : (
              <RaporIcerigi veri={veri} />
            )}
          </div>

          {pencere?.mod === "detay" && veri && !duzenleniyor ? (
            <footer className="space-y-3 border-t border-yuzey-200 px-5 py-4">
              {islemSonucu?.basari ? (
                <Bildirim tur="basari">{islemSonucu.basari}</Bildirim>
              ) : null}
              {islemSonucu?.hata ? (
                <Bildirim tur="hata">{islemSonucu.hata}</Bildirim>
              ) : null}

              {islemde && surenIslem === "yeniden" ? (
                <div
                  role="status"
                  className="flex items-center gap-3 rounded-md bg-marka-50 px-3 py-2.5 text-sm text-marka-700"
                >
                  <DonenHalka />
                  <span>
                    Rapor güncel puanlarla yeniden üretiliyor; gözlem metni de
                    yeniden yazıldığı için bu işlem bir dakikaya kadar
                    sürebilir.
                  </span>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Buton disabled={islemde} onClick={pdfUret}>
                  {islemde && surenIslem === "pdf" ? (
                    <span className="inline-flex items-center gap-2">
                      <DonenHalka />
                      PDF hazırlanıyor…
                    </span>
                  ) : (
                    "PDF oluştur"
                  )}
                </Buton>
                <Buton
                  tur="ikincil"
                  disabled={islemde}
                  onClick={() => setDuzenleniyor(true)}
                >
                  Metni düzenle
                </Buton>
                <Buton
                  tur={veri.detay.ozet.guncel ? "sade" : "birincil"}
                  disabled={islemde}
                  onClick={yenidenUret}
                >
                  {islemde && surenIslem === "yeniden" ? (
                    <span className="inline-flex items-center gap-2">
                      <DonenHalka />
                      Yeniden üretiliyor…
                    </span>
                  ) : (
                    "Güncel puanlarla yeniden üret"
                  )}
                </Buton>
              </div>
              <p className="text-xs text-zinc-500">
                Yeniden üretim yeni bir rapor oluşturur; bu rapor ve varsa
                PDF’leri geçmişte kalır.
              </p>
            </footer>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
