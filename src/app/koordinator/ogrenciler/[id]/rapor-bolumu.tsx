"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bildirim,
  Buton,
  DonenHalka,
  Rozet,
  butonStili,
} from "@/components/ui";
import { tarihBicimle } from "@/lib/tarih";
import type { KapsamKaydi, RaporOzeti } from "@/lib/rapor-verisi";
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
  raporSil,
  raporYenidenUret,
  type EylemDurumu,
  type RaporBaglami,
  type RaporPenceresiVerisi,
} from "./rapor-eylemleri";

/**
 * §11 — Öğrencinin raporları.
 *
 * Bölüm zaten kil temalı profil penceresinin İÇİNDE yaşıyor; o yüzden burada
 * ikinci bir `<dialog>` açılmaz. Liste, yeni rapor formu ve rapor detayı aynı
 * pencerede GÖRÜNÜM olarak yer değiştirir ("← Raporlar" geri oku listeye
 * döner) — pencere üstüne pencere binmez.
 *
 * Görünümler adres satırıyla da açılabilir (`?rapor=<id>` veya `?rapor=yeni`):
 * eski rapor bağlantıları ve dashboard'dan gelen adresler bu sayede
 * çalışmaya devam eder (dış pencereyi `baslangictaAcik` açar).
 */
export function RaporBolumu({
  ogrenciId,
  ogrenciAdi,
  raporlar,
  kapsamKayitlari,
  yalnizcaGecmisKayit = false,
  acilisParametresi,
}: {
  ogrenciId: string;
  ogrenciAdi: string;
  raporlar: RaporOzeti[];
  kapsamKayitlari: KapsamKaydi[];
  /**
   * Öğrencinin kaydı var ama hepsi geçmişten aktarılmış — puanlaması olmayan
   * dönemler. "Önce bir kayıt oluşturun" demek yanlış yönlendirir; kayıt
   * zaten var, üretilemeyen şey rapor.
   */
  yalnizcaGecmisKayit?: boolean;
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
  const [surenIslem, setSurenIslem] = useState<
    "pdf" | "yeniden" | "sil" | null
  >(null);
  // Elle düzenlenmiş metin varsa yeniden üretim doğrudan başlamaz: önce
  // "düzenlemeler taşınsın mı" sorulur (§11.4).
  const [yenidenOnayi, setYenidenOnayi] = useState(false);
  // Pencerede iki görünüm var: düzenlenebilir kutular ve veliye giden
  // belgenin kendisi. Anahtar, belge her tazelemede yeniden çizilsin diye.
  const [belgeGorunumu, setBelgeGorunumu] = useState(false);
  const [onizlemeAnahtari, setOnizlemeAnahtari] = useState(0);

  const veri =
    pencere?.mod === "detay" && veriKutusu?.raporId === pencere.raporId
      ? veriKutusu.veri
      : null;
  const yukleniyor =
    pencere?.mod === "detay" && veriKutusu?.raporId !== pencere.raporId;

  // Detay görünümü açıldığında raporun gövdesi çekilir.
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
    setYenidenOnayi(false);
    setBelgeGorunumu(false);
    setPencere(hedef);
  }

  function kapat() {
    setPencere(null);
    setDuzenleniyor(false);
    setYenidenOnayi(false);
    setBelgeGorunumu(false);
    setIslemSonucu(null);
    // Adresteki ?rapor= izi kalırsa pencere her tazelemede yeniden açılırdı.
    if (acilisParametresi) router.replace(pathname, { scroll: false });
  }

  /** Pencerede duran raporu ve arkadaki listeyi tazeler. */
  async function tazele(raporId: string) {
    setVeriKutusu({ raporId, veri: await raporPenceresiVerisi(raporId) });
    setOnizlemeAnahtari((sayac) => sayac + 1);
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

  function raporuSil() {
    if (pencere?.mod !== "detay") return;
    const raporId = pencere.raporId;
    const pdfSayisi = veri?.pdfler.length ?? 0;

    const uyari =
      pdfSayisi > 0
        ? `Bu rapor ve rapora bağlı ${pdfSayisi} PDF kaydı kalıcı olarak silinecek; daha önce paylaşılmış PDF bağlantıları açılmaz olur. Bu işlem geri alınamaz.\n\nDevam edilsin mi?`
        : "Bu rapor kalıcı olarak silinecek. Bu işlem geri alınamaz.\n\nDevam edilsin mi?";
    if (!window.confirm(uyari)) return;

    setSurenIslem("sil");
    basla(async () => {
      const sonuc = await raporSil(raporId);
      if (sonuc.hata) {
        setIslemSonucu(sonuc);
        return;
      }
      // Silinen raporun penceresi kapanır; arkadaki liste tazelenir.
      kapat();
      router.refresh();
    });
  }

  /** Raporun elle düzenlenmiş metinleri — yeniden üretimde sorulur. */
  const duzenlemeler =
    (
      veri?.detay.govde as unknown as {
        duzenlemeler?: { etiket: string }[];
      }
    )?.duzenlemeler ?? [];

  function yenidenUret() {
    // Düzenleme varsa önce seçim: koordinatörün yazdığı veli metni sessizce
    // kaybolmasın ama puanlar değiştiyse sıfırdan üretmek de bir seçenek.
    if (duzenlemeler.length > 0 && !yenidenOnayi) {
      setIslemSonucu(null);
      setYenidenOnayi(true);
      return;
    }
    uret(true);
  }

  function uret(duzenlemeleriKoru: boolean) {
    if (pencere?.mod !== "detay") return;
    const raporId = pencere.raporId;
    setYenidenOnayi(false);
    setSurenIslem("yeniden");
    basla(async () => {
      const sonuc = await raporYenidenUret(raporId, duzenlemeleriKoru);
      setIslemSonucu(sonuc);
      // Yeniden üretim yeni bir rapor açar; eskisi geçmişte kalır (§13.17).
      if (sonuc.raporId) {
        setPencere({ mod: "detay", raporId: sonuc.raporId });
        router.refresh();
      }
    });
  }

  // --- Liste görünümü: pencere hedefi yokken. ---
  if (!pencere) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-zinc-500">
            {raporlar.length > 0
              ? `${raporlar.length} rapor`
              : "Henüz rapor yok"}
          </span>
          <Buton
            tur="ikincil"
            onClick={() => ac({ mod: "yeni" })}
            disabled={kapsamKayitlari.length === 0}
            engelSebebi={
              kapsamKayitlari.length === 0
                ? yalnizcaGecmisKayit
                  ? "Bu öğrencinin kayıtları geçmişten aktarıldı; o dönemlerin puanlaması olmadığı için rapor üretilemez. Belgeleri “Arşiv raporları” bölümünde."
                  : "Rapor üretebilmek için önce bir dönem veya kulüp kaydı oluşturun."
                : undefined
            }
          >
            Yeni rapor oluştur
          </Buton>
        </div>

        {raporlar.length === 0 ? (
          <p className="kil-bos p-6 text-center text-sm text-zinc-600">
            {yalnizcaGecmisKayit
              ? "Bu öğrencinin sistemde puanlanmış kaydı yok. Geçmiş dönemlerden aktarılan raporları “Arşiv raporları” bölümünde."
              : "Henüz rapor üretilmemiş. Rapor, mevcut puanlamalardan istenildiği anda üretilebilir."}
          </p>
        ) : (
          <div className="space-y-2">
            {raporlar.map((rapor) => (
              <button
                key={rapor.id}
                type="button"
                onClick={() => ac({ mod: "detay", raporId: rapor.id })}
                className="kil-satir block w-full p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">
                    {tarihBicimle(rapor.uretimZamani)} raporu
                  </span>
                  <Rozet tur={rapor.guncel ? "olumlu" : "uyari"}>
                    {rapor.guncel ? "Güncel" : "Güncel değil"}
                  </Rozet>
                  {rapor.duzenlemeZamani ? (
                    <Rozet>Elle düzenlendi</Rozet>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {rapor.kapsam.join(" · ")} · {rapor.atolyeSayisi} atölye
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Form / detay görünümü: liste yerine aynı pencerede. ---
  return (
    <div className="space-y-4" aria-label={`${ogrenciAdi} raporu`}>
      <header className="space-y-1.5">
        <button
          type="button"
          onClick={kapat}
          className="-my-1 inline-block py-1 text-sm text-marka-700 hover:underline"
        >
          ← Raporlar
        </button>
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            {pencere.mod === "yeni"
              ? "Yeni rapor"
              : `${ogrenciAdi} — Öğrenci Raporu`}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {pencere.mod === "yeni"
              ? "Raporun kapsayacağı kayıtları seçin."
              : veri
                ? `${tarihBicimle(veri.detay.ozet.uretimZamani)} · ${veri.detay.ozet.kapsam.join(" · ")}`
                : "Yükleniyor…"}
          </p>
        </div>
      </header>

      {/* Gövdenin kendi yüzeyi yok: pencere (kil-pencere) zaten kabarık tek
          yüzey, rapor bölümleri onun içine tek tek gömülüyor. Buraya da bir
          zemin konsaydı gömük kutular gömük zemine karışırdı. */}
      {/* Raporun yanındaki bağlam — panelde kalır, veliye gitmez.
          Koordinatör metni onaylarken öğrencinin zekâ testi dosyası ya da
          veli görüşmesi kaydı olduğunu bilmiyordu; ikisi de aynı sayfanın
          başka kutularında ama rapor penceresi açıkken görünmüyorlar. */}
      {pencere.mod === "detay" && veri && !duzenleniyor ? (
        <RaporBaglamSeridi baglam={veri.baglam} />
      ) : null}

      {/* Düzenleme kutuları ile veliye giden belge arasında anahtar.
          Koordinatör eskiden belgeyi ancak PDF üretip indirdikten sonra
          görebiliyordu; her bakış rapor geçmişine silinemez bir kayıt
          bırakıyordu (§13.17). Önizleme kayıt açmaz. */}
      {pencere.mod === "detay" && veri && !duzenleniyor ? (
        <div className="flex flex-wrap items-center gap-2">
          <Buton
            tur={belgeGorunumu ? "sade" : "ikincil"}
            onClick={() => setBelgeGorunumu(false)}
            className="px-3 py-1.5 text-xs"
          >
            Düzenleme görünümü
          </Buton>
          <Buton
            tur={belgeGorunumu ? "ikincil" : "sade"}
            onClick={() => setBelgeGorunumu(true)}
            className="px-3 py-1.5 text-xs"
          >
            Velinin göreceği belge
          </Buton>
          {belgeGorunumu ? (
            <a
              href={`/api/rapor-onizleme/${pencere.raporId}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-marka-700 hover:underline"
            >
              Ayrı sekmede aç
            </a>
          ) : null}
        </div>
      ) : null}

      <div>
        {pencere.mod === "yeni" ? (
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
        ) : belgeGorunumu ? (
          <div className="space-y-2">
            <iframe
              // Anahtar tazelemede artıyor: rapor düzenlenince belge de
              // yeniden çizilmeli (rota `no-store` ama iframe kendi
              // kendine yeniden istek atmaz).
              key={onizlemeAnahtari}
              src={`/api/rapor-onizleme/${pencere.raporId}`}
              title="Rapor önizlemesi"
              className="kil-oyuk h-[70vh] min-h-[24rem] w-full"
            />
            <p className="text-xs text-zinc-500">
              Bu, raporun şu anki hâlinin belge görüntüsüdür; rapor
              geçmişine kayıt eklemez. Veliye vermek için “PDF oluştur”
              düğmesini kullanın — o belge alındığı günkü hâliyle saklanır.
            </p>
          </div>
        ) : (
          <RaporIcerigi
            veri={veri}
            raporId={pencere.raporId}
            onGuncellendi={() => tazele(pencere.raporId)}
          />
        )}
      </div>

      {pencere.mod === "detay" && veri && !duzenleniyor ? (
        <footer
          // Ayraç kil temasında çizgi değil kazıma: üstte ışık, altta gölge.
          className="space-y-3 border-t border-white/70 pt-4 shadow-[inset_0_1px_0_var(--kil-golge)]"
        >
          {islemSonucu?.basari ? (
            <Bildirim tur="basari">{islemSonucu.basari}</Bildirim>
          ) : null}
          {islemSonucu?.hata ? (
            <Bildirim tur="hata">{islemSonucu.hata}</Bildirim>
          ) : null}

          {yenidenOnayi ? (
            <div className="kil-uyari space-y-3 p-4">
              <div>
                <p className="text-sm font-semibold text-vurgu-900">
                  Bu raporda elle düzenlenmiş {duzenlemeler.length} metin var
                </p>
                <ul className="mt-1 list-inside list-disc text-xs text-vurgu-800">
                  {duzenlemeler.map((duzenleme) => (
                    <li key={duzenleme.etiket}>{duzenleme.etiket}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-vurgu-800">
                Taşırsanız yazdıklarınız yeni rapora aynen geçer; puanlar
                değiştiyse bu metinleri gözden geçirmeniz gerekir. Sıfırdan
                üretirseniz bütün metinler güncel puanlardan yeniden yazılır.
              </p>
              <div className="flex flex-wrap gap-2">
                <Buton onClick={() => uret(true)} disabled={islemde}>
                  Düzenlemeleri koruyarak üret
                </Buton>
                <Buton
                  tur="ikincil"
                  onClick={() => uret(false)}
                  disabled={islemde}
                >
                  Sıfırdan üret
                </Buton>
                <Buton
                  tur="sade"
                  onClick={() => setYenidenOnayi(false)}
                  disabled={islemde}
                >
                  Vazgeç
                </Buton>
              </div>
            </div>
          ) : null}

          {islemde && surenIslem === "yeniden" ? (
            <div
              role="status"
              className="kil-oyuk flex items-center gap-3 px-3 py-2.5 text-sm text-marka-700"
            >
              <DonenHalka />
              <span>
                Rapor güncel puanlarla yeniden üretiliyor; gözlem metni de
                yeniden yazıldığı için bu işlem bir dakikaya kadar sürebilir.
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
            {islemSonucu?.pdfAdresi ? (
              <a
                href={islemSonucu.pdfAdresi}
                target="_blank"
                rel="noreferrer"
                className={butonStili("ikincil")}
              >
                PDF&apos;i indir
              </a>
            ) : null}
            {/* v2 raporlar kutuların üzerindeki kalemle yerinde
                    düzenleniyor; toplu düzenleme ekranı yalnızca eski
                    biçimli (arşiv) raporlar için duruyor. */}
            {(veri.detay.govde as unknown as { surum?: number })?.surum ===
            2 ? null : (
              <Buton
                tur="ikincil"
                disabled={islemde}
                onClick={() => setDuzenleniyor(true)}
              >
                Metni düzenle
              </Buton>
            )}
            <Buton
              tur={veri.detay.ozet.guncel ? "sade" : "birincil"}
              disabled={islemde}
              onClick={yenidenUret}
            >
              {yenidenOnayi ? (
            <div className="kil-uyari space-y-3 p-4">
              <div>
                <p className="text-sm font-semibold text-vurgu-900">
                  Bu raporda elle düzenlenmiş {duzenlemeler.length} metin var
                </p>
                <ul className="mt-1 list-inside list-disc text-xs text-vurgu-800">
                  {duzenlemeler.map((duzenleme) => (
                    <li key={duzenleme.etiket}>{duzenleme.etiket}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-vurgu-800">
                Taşırsanız yazdıklarınız yeni rapora aynen geçer; puanlar
                değiştiyse bu metinleri gözden geçirmeniz gerekir. Sıfırdan
                üretirseniz bütün metinler güncel puanlardan yeniden yazılır.
              </p>
              <div className="flex flex-wrap gap-2">
                <Buton onClick={() => uret(true)} disabled={islemde}>
                  Düzenlemeleri koruyarak üret
                </Buton>
                <Buton
                  tur="ikincil"
                  onClick={() => uret(false)}
                  disabled={islemde}
                >
                  Sıfırdan üret
                </Buton>
                <Buton
                  tur="sade"
                  onClick={() => setYenidenOnayi(false)}
                  disabled={islemde}
                >
                  Vazgeç
                </Buton>
              </div>
            </div>
          ) : null}

          {islemde && surenIslem === "yeniden" ? (
                <span className="inline-flex items-center gap-2">
                  <DonenHalka />
                  Yeniden üretiliyor…
                </span>
              ) : (
                "Güncel puanlarla yeniden üret"
              )}
            </Buton>
            <Buton
              tur="tehlike"
              disabled={islemde}
              onClick={raporuSil}
              className="ml-auto"
            >
              {islemde && surenIslem === "sil" ? (
                <span className="inline-flex items-center gap-2">
                  <DonenHalka />
                  Siliniyor…
                </span>
              ) : (
                "Raporu sil"
              )}
            </Buton>
          </div>
          <p className="text-xs text-zinc-500">
            Yeniden üretim yeni bir rapor oluşturur; bu rapor ve varsa PDF’leri
            geçmişte kalır. Elle düzenlenmiş metinler varsa taşınıp
            taşınmayacağı sorulur.
          </p>
        </footer>
      ) : null}
    </div>
  );
}

/**
 * Raporun üstündeki bağlam şeridi.
 *
 * Bilinçli olarak KISA ve bağlantılı: burada bir özet üretmek, veli
 * görüşmesinin kendi kutusunu ikinci kez çizmek olurdu. Söylediği tek şey
 * "şu kayıtlar var, bakmak istersen buradalar".
 */
function RaporBaglamSeridi({ baglam }: { baglam: RaporBaglami }) {
  const bosMu =
    baglam.zekaTestleri.length === 0 && baglam.veliGorusmesiSayisi === 0;
  if (bosMu) return null;

  return (
    <div className="kil-oyuk flex flex-wrap items-center gap-x-4 gap-y-1.5 p-3 text-xs text-zinc-600">
      <span className="font-medium text-zinc-800">
        Bu öğrenciye ait diğer kayıtlar
      </span>

      {baglam.zekaTestleri.length > 0 ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <span>Zekâ testi:</span>
          {baglam.zekaTestleri.map((test) => (
            <a
              key={test.id}
              href={`/api/zeka-testi/${test.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-marka-700 hover:underline"
            >
              {test.testAdi} ({tarihBicimle(test.tarih)})
            </a>
          ))}
        </span>
      ) : null}

      {baglam.veliGorusmesiSayisi > 0 ? (
        <span>
          {baglam.veliGorusmesiSayisi} veli görüşmesi kaydı
          {baglam.sonVeliGorusmesi
            ? ` · son: ${tarihBicimle(baglam.sonVeliGorusmesi)}`
            : ""}{" "}
          — bu sayfadaki “Veli görüşmeleri” kutusunda.
        </span>
      ) : null}

      <span className="text-zinc-500">
        Bu satır yalnızca panelde; veliye giden belgeye basılmaz.
      </span>
    </div>
  );
}
