import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { OgrenciFormu } from "@/app/koordinator/ogrenciler/ogrenci-formu";
import { zekaTestiOgrencisiEkle } from "../ogrenci-eylemleri";
import { geriBaglantiStili } from "@/components/ui";

export const metadata: Metadata = {
  title: "Zeka testi için yeni öğrenci",
};

/**
 * Zeka testi için yeni öğrenci — Öğrenciler sayfasındaki kayıt formunun
 * AYNISI, yalnızca farklı bir yerden girilip farklı bir yere dönüyor.
 *
 * Neden burada: test uygulayıcısı sisteme hiç girmemiş bir çocuğun sonuç
 * belgesini yüklemek istediğinde Öğrenciler sayfasına gidip kaydı açmak,
 * dönüp Zeka testleri sayfasını yeniden süzmek zorunda kalıyordu. Buradaki
 * form kaydettikten sonra doğrudan Zeka testleri sayfasına, yeni öğrenci
 * süzgeçte seçili olarak dönüyor.
 *
 * Form bileşeni (`OgrenciFormu`) ortak: alanların kopyası çıkarılmadı, aynı
 * sorular aynı doğrulamayla soruluyor. `programlar` GEÇİLMİYOR — bu ekranda
 * atölye grubuna kayıt açılmaz (bkz. `zekaTestiOgrencisiEkle`).
 *
 * YETKİ: Sayfanın kapısı `zekaTestleri` TAM; öğrenci açmak ayrıca `ogrenciler`
 * TAM istiyor. İkincisi olmayan (tek başına Test Uygulayıcısı) hesap sayfayı
 * hiç açamaz — düğme de zaten çizilmiyor, ama asıl sınır burası.
 */
export default async function ZekaTestiOgrenciEkleSayfasi() {
  const kullanici = await yonetimZorunlu("zekaTestleri", "TAM");

  if (kullanici.yetkiler.ogrenciler !== "TAM") {
    redirect("/koordinator/zeka-testleri");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/koordinator/zeka-testleri" className={geriBaglantiStili}>
          ← Zeka testleri
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          Zeka testi için yeni öğrenci
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Testi uygulanan çocuk sistemde kayıtlı değilse buradan açabilirsiniz.
          Kaydedildiğinde Zeka testleri sayfasına dönersiniz ve öğrenci
          seçilmiş olarak gelir; belgeyi hemen yükleyebilirsiniz. Aynı öğrenci
          iki kez eklenmemeli — önce listeden aradığınızdan emin olun.
        </p>
      </div>

      <OgrenciFormu
        eylem={zekaTestiOgrencisiEkle}
        kaydetEtiketi="Öğrenciyi kaydet"
        iptalYolu="/koordinator/zeka-testleri"
      />
    </div>
  );
}
