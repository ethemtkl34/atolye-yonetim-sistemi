"use client";

import { useActionState, useState } from "react";
import { Bildirim, Buton, Kart, Rozet } from "@/components/ui";
import {
  DEGERLENDIRILEMEDI,
  PUANLAMA_DURUM_ETIKETLERI,
  type FormSatiri,
  type PuanlamaDurumu,
} from "@/lib/puanlama";
import {
  DEGERLENDIRILEMEDI_ACIKLAMA,
  PUAN_ACIKLAMALARI,
  ortalamaBicimle,
} from "@/lib/puan-hesaplari";
import { cn } from "@/lib/utils";
import { DOKUNMA_HEDEFI, PuanSecici } from "@/components/puan-secici";
import { puanlamaKaydet, type PuanlamaEylemDurumu } from "@/app/stajyer/puanlama/actions";

/**
 * §10 — Tek bir atölye oturumunun değerlendirme formu.
 *
 * Her atölyenin kendi formu ve kendi kaydet düğmesi var (§10.1): stajyer beş
 * atölyeyi tek tek doldurur, birini kaydetmek diğerlerini beklemez.
 *
 * Katılmadı seçilince sorular gizlenir (§10.2). Katıldı seçiliyken bütün
 * sorular zorunludur (§10.3); zorunluluk hem burada `required` ile hem de
 * sunucuda ayrıca doğrulanır — istemciye güvenilmez.
 */

export type PuanlamaFormuVerisi = {
  oturumId: string;
  atolyeAdi: string;
  durum: PuanlamaDurumu;
  attended: boolean | null;
  ortalama: number | null;
  satirlar: FormSatiri[];
  puanlanabilir: boolean;
  puanlayan: string | null;
  /** §11.2 — Stajyerin bu oturuma dair serbest gözlem notu. */
  gozlemNotu: string | null;
};

export function PuanlamaFormu({
  kayitId,
  form,
  duzenlenebilir,
}: {
  kayitId: string;
  form: PuanlamaFormuVerisi;
  duzenlenebilir: boolean;
}) {
  const [durum, eylem, bekliyor] = useActionState<
    PuanlamaEylemDurumu,
    FormData
  >(puanlamaKaydet, {});

  const [katilim, setKatilim] = useState<string>(
    form.attended === null ? "" : form.attended ? "katildi" : "katilmadi",
  );

  /**
   * Boş bırakılan soruları GÖNDERMEDEN ÖNCE yakalar.
   *
   * Radyo düğmelerindeki `required` işi tarayıcıya bırakıyordu ve telefonda
   * sessiz bir duvara dönüşüyordu: tarayıcı ilk eksik alana odaklanmaya
   * çalışıyor ama o alan `sr-only` 1×1 pikselik bir kutu, ekranda hiçbir şey
   * görünmüyor. Stajyer "kaydet'e bastım, bir şey olmadı" durumunda kalıyordu.
   *
   * Sunucu zaten eksikleri `eksikSatirlar` ile döndürüyordu; bu kontrol aynı
   * işaretlemeyi ağa hiç çıkmadan yapıyor.
   */
  const [istemciEksikleri, setIstemciEksikleri] = useState<string[]>([]);
  /** Katılım hiç seçilmeden kaydete basıldığında gösterilir. */
  const [katilimEksik, setKatilimEksik] = useState(false);

  function gonder(formVerisi: FormData) {
    // Katılım da `required` ile tarayıcıya bırakılmıştı; doğrulama buraya
    // taşınınca onun da karşılığı gerekti, yoksa kaydet düğmesi sessiz kalıyor.
    if (!katilim) {
      setKatilimEksik(true);
      setIstemciEksikleri([]);
      return;
    }
    setKatilimEksik(false);

    if (katilim === "katildi") {
      const eksik = form.satirlar
        .filter((satir) => !formVerisi.get(`cevap:${satir.anahtar}`))
        .map((satir) => satir.anahtar);

      if (eksik.length > 0) {
        setIstemciEksikleri(eksik);

        /*
          İlk eksik soruya götür: 10 soruluk formda hangisinin boş kaldığını
          aramak telefonda en yorucu iş.

          Kaydırma bir sonraki kareye ERTELENİYOR. Doğrudan çağrıldığında
          çalışmıyordu: React hemen ardından kutuları kırmızıya boyayıp uyarı
          satırını ekliyor, sayfa uzuyor ve başlamış kaydırma yarıda kalıyor.
          `smooth` de bu yüzden kaldırıldı — uzun mesafede animasyon
          kesilmeye açık, anlık kaydırma hedefi şaşırmıyor.
        */
        requestAnimationFrame(() => {
          document
            .getElementById(soruAlanId(form.oturumId, eksik[0]))
            ?.scrollIntoView({ block: "center" });
        });
        return;
      }
    }

    setIstemciEksikleri([]);
    eylem(formVerisi);
  }

  const rozet = PUANLAMA_DURUM_ETIKETLERI[form.durum];
  const eksikler = new Set([
    ...(durum.eksikSatirlar ?? []),
    ...istemciEksikleri,
  ]);
  const kilitli = !duzenlenebilir || !form.puanlanabilir;

  return (
    <Kart className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            {form.atolyeAdi}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {form.attended === true
              ? `Ortalama ${ortalamaBicimle(form.ortalama)}`
              : form.attended === false
                ? "Ortalamaya dahil edilmez"
                : "Form henüz doldurulmadı"}
            {form.puanlayan ? ` · Son giren: ${form.puanlayan}` : ""}
          </p>
        </div>
        <Rozet tur={rozet.rozet}>{rozet.etiket}</Rozet>
      </div>

      {!form.puanlanabilir ? (
        <p className="mt-3 rounded-md bg-yuzey-50 px-3 py-2 text-sm text-zinc-600">
          Bu atölye henüz yapılmadı. Form, oturum günü geldiğinde açılır.
        </p>
      ) : (
        // `noValidate`: doğrulama tarayıcıdan alınıp `gonder`e verildi.
        // Tarayıcının baloncuğu görünmez bir kutuya bağlanıyordu (yukarıdaki
        // nota bakın); eksikler artık soru kutusunun kendisinde kırmızıyla
        // gösteriliyor.
        <form action={gonder} noValidate className="mt-4 space-y-4">
          <input type="hidden" name="oturumId" value={form.oturumId} />
          <input type="hidden" name="kayitId" value={kayitId} />

          <fieldset
            disabled={kilitli || bekliyor}
            className={cn(
              "rounded-md",
              katilimEksik && "border border-red-300 bg-red-50 px-3 py-2",
            )}
          >
            <legend className="text-sm font-medium text-zinc-700">
              Katılım durumu
            </legend>
            {/*
              Telefonda iki seçenek satırı paylaşıyor: parmakla vurulacak
              hedef ekran genişliğinin yarısı kadar oluyor. Masaüstünde
              içeriğe göre daralıyorlar.
            */}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {[
                { deger: "katildi", etiket: "Katıldı" },
                { deger: "katilmadi", etiket: "Katılmadı" },
              ].map((secenek) => (
                <label
                  key={secenek.deger}
                  className={cn(
                    DOKUNMA_HEDEFI,
                    "cursor-pointer rounded-md border text-sm",
                    katilim === secenek.deger
                      ? "border-marka-600 bg-marka-50 font-medium text-marka-700"
                      : "border-yuzey-200 bg-white text-zinc-700 hover:bg-marka-50",
                  )}
                >
                  <input
                    type="radio"
                    name="attended"
                    value={secenek.deger}
                    checked={katilim === secenek.deger}
                    onChange={(olay) => {
                      setKatilim(olay.target.value);
                      setKatilimEksik(false);
                    }}
                    className="sr-only"
                    required
                  />
                  {secenek.etiket}
                </label>
              ))}
            </div>
          </fieldset>

          {katilim === "katilmadi" ? (
            <p className="rounded-md bg-yuzey-50 px-3 py-2 text-sm text-zinc-600">
              Katılmadı işaretlenen atölyede puanlama soruları doldurulmaz ve
              bu oturum hiçbir ortalamaya dahil edilmez.
            </p>
          ) : null}

          {katilim === "katildi" ? (
            <fieldset
              disabled={kilitli || bekliyor}
              className="space-y-3 border-t border-yuzey-100 pt-4"
            >
              <legend className="sr-only">Değerlendirme soruları</legend>

              {form.satirlar.map((satir, sira) => {
                // Konu başlığı değiştiğinde araya bölüm başlığı girer;
                // numaralama bölümden bağımsız 1'den devam eder (eksik soruya
                // kaydırma mantığı satır sırasına bağlı).
                const oncekiKategori =
                  sira > 0 ? form.satirlar[sira - 1].kategori : null;
                const kategoriBasligi =
                  satir.kategori && satir.kategori !== oncekiKategori
                    ? satir.kategori
                    : null;

                return (
                  <div key={satir.anahtar} className="space-y-3">
                    {kategoriBasligi ? (
                      <h4 className="pt-1 text-xs font-semibold tracking-wide text-marka-700 uppercase">
                        {kategoriBasligi}
                      </h4>
                    ) : null}
                    <SoruSatiri
                      alanId={soruAlanId(form.oturumId, satir.anahtar)}
                      satir={satir}
                      sira={sira + 1}
                      eksik={eksikler.has(satir.anahtar)}
                    />
                  </div>
                );
              })}
            </fieldset>
          ) : null}

          <div className="border-t border-yuzey-100 pt-4">
            <label
              htmlFor={`gozlem-${form.oturumId}`}
              className="block text-sm font-medium"
            >
              Gözlem notu{" "}
              <span className="font-normal text-zinc-500">(isteğe bağlı)</span>
            </label>
            {/*
              Rapordaki beceri bloklarının tek somut kaynağı burası: puan
              1–5 arası bir sayıdır, hangi davranışın gözlendiğini taşımaz.
              Buraya yazılmayan bir davranış rapora da giremez.
            */}
            <p className="mt-0.5 mb-2 text-xs text-zinc-500">
              Bugün dikkatinizi çeken somut bir davranış, söz ya da tepki
              varsa yazın. Rapordaki gözlem bölümü yalnızca buraya
              yazılanlardan üretilir.
            </p>
            <textarea
              id={`gozlem-${form.oturumId}`}
              name="gozlemNotu"
              rows={3}
              maxLength={2000}
              defaultValue={form.gozlemNotu ?? ""}
              disabled={kilitli || bekliyor}
              placeholder="Örn: “Uydular ne yapar?” sorusuna “interneti çektirir” dedi, izlediği videodan bağlantı kurdu."
              className="w-full rounded-lg border border-yuzey-200 p-3 text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600 disabled:bg-yuzey-50"
            />
          </div>

          {katilimEksik ? (
            <Bildirim tur="hata">
              Önce katılım durumunu seçin: öğrenci bu atölyeye katıldı mı?
            </Bildirim>
          ) : null}

          {istemciEksikleri.length > 0 ? (
            <Bildirim tur="hata">
              {istemciEksikleri.length} soru boş kaldı. Kırmızı işaretli
              soruları doldurun; puan veremiyorsanız
              “Değerlendirilemedi” seçin.
            </Bildirim>
          ) : null}

          {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
          {durum.basari ? (
            <Bildirim tur="basari">{durum.basari}</Bildirim>
          ) : null}

          {kilitli ? (
            // Bu dala tek yoldan düşülür: kayıt iptal edilmiştir (puanlanabilir
            // olmayan form yukarıda erken döner, çağıran taraflar
            // `duzenlenebilir`i kayıt durumundan türetir). Metin sebebi
            // söylemeli; "yetkiniz yok" demek yanlış yönlendiriyordu.
            <p className="text-xs text-zinc-500">
              Bu kayıt iptal edildiği için form salt okunur. Girilmiş puanlar
              korunuyor.
            </p>
          ) : (
            <Buton type="submit" disabled={bekliyor}>
              {bekliyor ? "Kaydediliyor…" : "Formu kaydet"}
            </Buton>
          )}
        </form>
      )}
    </Kart>
  );
}

/** Eksik soruya kaydırabilmek için kararlı bir kimlik. */
function soruAlanId(oturumId: string, anahtar: string): string {
  return `soru-${oturumId}-${anahtar}`;
}

function SoruSatiri({
  alanId,
  satir,
  sira,
  eksik,
}: {
  alanId: string;
  satir: FormSatiri;
  sira: number;
  eksik: boolean;
}) {
  const alanAdi = `cevap:${satir.anahtar}`;

  /**
   * Seçim denetimli tutuluyor ki seçilen puanın ANLAMI soru kutusunun içinde
   * yazılabilsin.
   *
   * Düğmeler yalnızca rakam gösteriyordu; "3 neydi" sorusunun cevabı sayfanın
   * en üstündeki ölçek kartındaydı ve telefonda oraya dönmek 11 soruluk bir
   * formda gerçek bir maliyet. Artık cevap seçildiği anda satırın altında
   * duruyor.
   */
  const [secim, setSecim] = useState<string>(() =>
    satir.mevcutDeger !== null
      ? String(satir.mevcutDeger)
      : satir.cevaplandi
        ? DEGERLENDIRILEMEDI
        : "",
  );

  return (
    <fieldset
      id={alanId}
      className={cn(
        "scroll-mt-4 rounded-md border px-3 py-3",
        eksik ? "border-red-300 bg-red-50" : "border-yuzey-200",
      )}
    >
      <legend className="px-1 text-sm text-zinc-800">
        <span className="text-zinc-400">{sira}.</span>{" "}
        {satir.baslik ? (
          <span className="font-medium">{satir.baslik}</span>
        ) : (
          satir.metin
        )}
        {!satir.aktif ? (
          <span className="ml-2 text-xs text-zinc-500">
            (soru pasife alındı, geçmiş cevap korunuyor)
          </span>
        ) : null}
      </legend>

      {/* Başlıklı soruda soru cümlesi başlığın altında açıklama olarak durur. */}
      {satir.baslik ? (
        <p className="mt-1 text-sm text-zinc-600">{satir.metin}</p>
      ) : null}

      {satir.guncelMetin ? (
        <p className="mt-1 text-xs text-zinc-500">
          Soru metni sonradan güncellendi: “{satir.guncelMetin}”. Bu
          değerlendirme o günkü metinle kayıtlı kalır.
        </p>
      ) : null}

      <PuanSecici alanAdi={alanAdi} secim={secim} onSecim={setSecim} />
    </fieldset>
  );
}

/**
 * §10.4 — Puan açıklamaları.
 *
 * Katlanabilir: tablo telefonda 400 pikselden fazla yer kaplıyordu ve her gün
 * ekranının en üstünde duruyordu — stajyer forma ulaşmak için her seferinde
 * onu geçiyordu. Puanların anlamı artık seçildiği anda sorunun altında da
 * yazdığı için bu tablo ikincil bir başvuru kaynağı; kapalı başlıyor.
 */
export function PuanlamaOlcegi() {
  return (
    <Kart className="p-4">
      <details className="group">
        <summary className="flex min-h-[2.75rem] cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-900 sm:min-h-0">
          Puanlama ölçeği
          <span className="text-xs font-normal text-zinc-500 group-open:hidden">
            Göster
          </span>
          <span className="hidden text-xs font-normal text-zinc-500 group-open:inline">
            Gizle
          </span>
        </summary>
        <dl className="mt-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-36 shrink-0 text-zinc-500">Değerlendirilemedi</dt>
          <dd className="text-zinc-700">{DEGERLENDIRILEMEDI_ACIKLAMA}</dd>
        </div>
        {[1, 2, 3, 4, 5].map((puan) => (
          <div key={puan} className="flex gap-2">
            <dt className="w-36 shrink-0 text-zinc-500">{puan}</dt>
            <dd className="text-zinc-700">{PUAN_ACIKLAMALARI[puan]}</dd>
          </div>
          ))}
        </dl>
      </details>
    </Kart>
  );
}
