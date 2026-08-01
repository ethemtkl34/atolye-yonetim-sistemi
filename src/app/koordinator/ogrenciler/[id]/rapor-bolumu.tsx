"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bildirim, Buton, CokSatirli, Kart, Rozet, baglantiStili } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ortalamaBicimle } from "@/lib/scoring";
import { tarihBicimle } from "@/lib/tarih";
import type { KapsamKaydi, PdfKaydi, RaporOzeti } from "@/lib/rapor-verisi";
import type { RaporMetni } from "@/lib/report-engine";
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
    basla(async () => {
      const sonuc = await pdfOlustur(raporId);
      setIslemSonucu(sonuc);
      if (sonuc.basari) await tazele(raporId);
    });
  }

  function yenidenUret() {
    if (pencere?.mod !== "detay") return;
    const raporId = pencere.raporId;
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
                    className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline"
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
        className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-lg bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-marka-950/50"
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

              <div className="flex flex-wrap gap-2">
                <Buton disabled={islemde} onClick={pdfUret}>
                  {islemde ? "İşleniyor…" : "PDF oluştur"}
                </Buton>
                <Buton tur="ikincil" onClick={() => setDuzenleniyor(true)}>
                  Metni düzenle
                </Buton>
                <Buton
                  tur={veri.detay.ozet.guncel ? "sade" : "birincil"}
                  disabled={islemde}
                  onClick={yenidenUret}
                >
                  Güncel puanlarla yeniden üret
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

/** §11.2 — Atölye bazlı sonuçlar + genel değerlendirme. */
function RaporIcerigi({ veri }: { veri: RaporPenceresiVerisi }) {
  const { ozet, govde } = veri.detay;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Rozet tur={ozet.guncel ? "olumlu" : "uyari"}>
          {ozet.guncel ? "Güncel" : "Güncel değil"}
        </Rozet>
        {ozet.duzenlemeZamani ? (
          <span className="text-xs text-zinc-500">
            {tarihBicimle(ozet.duzenlemeZamani)} tarihinde{" "}
            {ozet.duzenleyen ?? "koordinatör"} tarafından düzenlendi
          </span>
        ) : null}
      </div>

      {!ozet.guncel ? (
        <Kart className="bg-vurgu-50 p-3">
          <p className="text-sm text-vurgu-800">
            Bu rapor üretildikten sonra puanlarda değişiklik yapıldı. Aşağıdaki
            “Güncel puanlarla yeniden üret” düğmesiyle yeni bir rapor
            oluşturabilirsiniz; bu rapor geçmişte kalır.
          </p>
        </Kart>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900">
          Atölye bazlı sonuçlar
        </h3>

        {govde.analiz.atolyeler.map((atolye, sira) => (
          <Kart key={atolye.atolyeAdi} className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-medium text-zinc-900">{atolye.atolyeAdi}</h4>
              <span className="text-sm text-zinc-600">
                Ortalama {ortalamaBicimle(atolye.genelOrtalama)}
              </span>
            </div>

            <p className="mt-1 text-xs text-zinc-500">
              {atolye.katildigiOturumSayisi} katıldığı ·{" "}
              {atolye.katilmadigiOturumSayisi} katılmadığı oturum ·{" "}
              {atolye.degerlendirilenSoruSayisi} değerlendirilen soru
            </p>

            {atolye.soruOrtalamalari.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {atolye.soruOrtalamalari.map((soru) => (
                  <li
                    key={soru.anahtar}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <span className="text-zinc-700">{soru.soruMetni}</span>
                    <span className="shrink-0 tabular-nums text-zinc-600">
                      {ortalamaBicimle(soru.ortalama)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-800">
              {govde.metin.atolyeler[sira]?.paragraf ?? ""}
            </p>
          </Kart>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900">
          Genel öğrenci değerlendirmesi
        </h3>
        <Kart className="space-y-3 p-4">
          {govde.metin.genelParagraflar.map((paragraf, sira) => (
            <p key={sira} className="text-sm text-zinc-800">
              {paragraf}
            </p>
          ))}
        </Kart>
      </section>

      {/* §11.5 + §13.17 — Bu rapordan üretilmiş PDF'ler */}
      {veri.pdfler.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-900">
            Bu rapordan üretilen PDF’ler
          </h3>
          <Kart className="divide-y divide-yuzey-100">
            {veri.pdfler.map((pdf) => (
              <div
                key={pdf.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <p className="text-sm text-zinc-700">
                  {tarihBicimle(pdf.olusturmaZamani)} tarihinde oluşturuldu
                </p>
                <a
                  href={pdf.adres}
                  target="_blank"
                  rel="noreferrer"
                  className={baglantiStili}
                >
                  PDF’i aç
                </a>
              </div>
            ))}
          </Kart>
        </section>
      ) : null}
    </div>
  );
}

/**
 * §11.4 — Metin düzenleme. Yalnızca metin katmanı değişir; analiz çıktısı
 * (hangi puanlardan hangi sonuç çıktığı) olduğu gibi kalır.
 */
function MetinDuzenleme({
  metin,
  durum,
  eylem,
  onVazgec,
}: {
  metin: RaporMetni;
  durum: EylemDurumu;
  eylem: (formVerisi: FormData) => void;
  onVazgec: () => void;
}) {
  return (
    <form action={eylem} className="space-y-3">
      {metin.atolyeler.map((atolye, sira) => (
        <Kart key={atolye.atolyeAdi} className="p-4">
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

      <Kart className="p-4">
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
        <Buton type="button" tur="ikincil" onClick={onVazgec}>
          Vazgeç
        </Buton>
      </div>
    </form>
  );
}

/**
 * §11.1 — Raporun kapsamı seçilir.
 *
 * Varsayılan olarak puanlaması bulunan bütün kayıtlar işaretli gelir: rapor
 * çoğunlukla öğrencinin tamamını kapsar. Hiç puanlaması olmayan kayıt da
 * seçilebilir ama sonucun boş olacağı yazılır — sessizce gizlemek yerine
 * neden boş çıkacağını söylemek daha anlaşılır.
 */
function YeniRaporFormu({
  kayitlar,
  durum,
  eylem,
}: {
  kayitlar: KapsamKaydi[];
  durum: EylemDurumu;
  eylem: (formVerisi: FormData) => void;
}) {
  const [secilenler, setSecilenler] = useState<string[]>(() =>
    kayitlar
      .filter((kayit) => kayit.puanlanmisOturumSayisi > 0)
      .map((kayit) => kayit.id),
  );

  function degistir(id: string) {
    setSecilenler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((k) => k !== id)
        : [...oncekiler, id],
    );
  }

  return (
    <form action={eylem} className="space-y-3">
      {secilenler.map((id) => (
        <input key={id} type="hidden" name="kayitlar" value={id} />
      ))}

      <p className="text-sm text-zinc-600">
        Rapor, seçilen kayıtlardaki puanlamalardan üretilir. Aynı atölye birden
        fazla kayıtta geçiyorsa raporda tek bölüm olarak birleşir.
      </p>

      <Kart className="p-3">
        <ul className="space-y-1">
          {kayitlar.map((kayit) => {
            const secili = secilenler.includes(kayit.id);

            return (
              <li key={kayit.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm",
                    secili ? "bg-marka-50" : "hover:bg-marka-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={secili}
                    onChange={() => degistir(kayit.id)}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    <span className="font-medium text-zinc-800">
                      {kayit.programAdi} · {kayit.grupAdi}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {kayit.tur} · {kayit.aktif ? "Aktif kayıt" : "İptal kayıt"}{" "}
                      ·{" "}
                      {kayit.puanlanmisOturumSayisi > 0
                        ? `${kayit.puanlanmisOturumSayisi} doldurulmuş form`
                        : "Doldurulmuş form yok — bu kayıt rapora içerik katmaz"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Kart>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex items-center gap-3">
        <Buton type="submit" disabled={secilenler.length === 0}>
          Raporu oluştur
        </Buton>
        <span className="text-sm text-zinc-500">
          {secilenler.length} kayıt seçili
        </span>
      </div>
    </form>
  );
}
