import { Rozet } from "@/components/ui";
import { tarihBicimle } from "@/lib/tarih";
import { TERAPI_TURU_ETIKETLERI, type TerapiTuru } from "@/lib/terapi-turleri";
import { EBEVEYN_DURUMU_ETIKETLERI } from "@/app/koordinator/danismanlik/danisan-sema";
import {
  DanisanBasvurusuFormu,
  type BasvuruDegerleri,
} from "@/components/danisan-basvurusu-formu";

/**
 * Öğrenci profilinde danışan başvurusunun özeti — terapi görüşmeleri kutusunun
 * başında durur.
 *
 * Neden ayrı bir kutu değil: başvuru, seansların üstünde duran dosya kapağı.
 * Terapi kutusunu açan kişi ilk bakışta çocuğun neden geldiğini ve başvurunun
 * doldurulmuş olup olmadığını görmeli — ayrı kutuda dursaydı seans eklerken
 * kimse bakmazdı.
 *
 * Başvurusu olmayan öğrencide bu blok bir HATIRLATMA'ya dönüşür ama görüşme
 * eklemeyi ENGELLEMEZ: psikolog seansı hemen kaydedip dosyayı sonra
 * tamamlayabilmeli.
 */

export type BasvuruOzeti = BasvuruDegerleri & {
  eklenmeTarihi: Date;
  guncellemeTarihi: Date;
};

function Satir({
  etiket,
  children,
}: {
  etiket: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="text-xs text-zinc-500 sm:text-sm">{etiket}</dt>
      <dd className="text-sm whitespace-pre-wrap text-zinc-800">{children}</dd>
    </div>
  );
}

export function DanisanBasvurusuOzeti({
  ogrenci,
  basvuru,
  yazabilir,
}: {
  ogrenci: { id: string; ad: string };
  /** null ise başvuru henüz doldurulmamış. */
  basvuru: BasvuruOzeti | null;
  yazabilir: boolean;
}) {
  if (!basvuru) {
    return (
      <div className="rounded-md border border-dashed border-yuzey-300 bg-yuzey-50 p-4">
        <p className="text-sm font-medium text-zinc-800">
          Danışan başvurusu doldurulmamış.
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Başvuru; çocuğun hangi terapi için, hangi şikayetle geldiğini ve aile
          bilgilerini tutar. Görüşme eklemek için zorunlu değil, ama dosyanın
          ilk sayfası budur.
        </p>
        {yazabilir ? (
          <div className="mt-3">
            <DanisanBasvurusuFormu
              sabitOgrenci={ogrenci}
              acilisEtiketi="Başvuru bilgilerini ekle"
            />
          </div>
        ) : null}
      </div>
    );
  }

  const doluAlanlar: [string, string | null][] = [
    ["Yönlendiren", basvuru.yonlendiren],
    ["Önceki destek", basvuru.oncekiDestek],
    ["Konmuş tanı", basvuru.tani],
    [
      "Ebeveyn durumu",
      basvuru.ebeveynDurumu
        ? (EBEVEYN_DURUMU_ETIKETLERI[
            basvuru.ebeveynDurumu as keyof typeof EBEVEYN_DURUMU_ETIKETLERI
          ] ?? null)
        : null,
    ],
    ["Birlikte yaşadığı", basvuru.birlikteYasadiklari],
    ["Kardeşleri", basvuru.kardesler],
    ["Anne", [basvuru.anneEgitim, basvuru.anneMeslek].filter(Boolean).join(" · ") || null],
    ["Baba", [basvuru.babaEgitim, basvuru.babaMeslek].filter(Boolean).join(" · ") || null],
    ["Ailede ruhsal öykü", basvuru.ailedeRuhsalOyku],
  ];

  return (
    <div className="rounded-md border border-yuzey-200 bg-yuzey-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-zinc-900">
            Danışan başvurusu
          </h4>
          <Rozet>
            {TERAPI_TURU_ETIKETLERI[basvuru.terapiTuru as TerapiTuru] ??
              basvuru.terapiTuru}
          </Rozet>
        </div>
        {yazabilir ? (
          <DanisanBasvurusuFormu
            sabitOgrenci={ogrenci}
            mevcutBasvuru={basvuru}
            acilisEtiketi="Başvuruyu düzenle"
          />
        ) : null}
      </div>

      <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-800">
        {basvuru.basvuruNedeni}
      </p>

      <dl className="mt-3 space-y-1.5">
        {doluAlanlar.map(([etiket, deger]) =>
          deger ? (
            <Satir key={etiket} etiket={etiket}>
              {deger}
            </Satir>
          ) : null,
        )}
      </dl>

      <p className="mt-3 text-xs text-zinc-500">
        Başvuru {tarihBicimle(basvuru.eklenmeTarihi)} tarihinde açıldı
        {basvuru.guncellemeTarihi > basvuru.eklenmeTarihi
          ? ` · son güncelleme ${tarihBicimle(basvuru.guncellemeTarihi)}`
          : ""}
        .
      </p>
    </div>
  );
}
