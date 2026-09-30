import Link from "next/link";
import { cikisYap } from "@/app/cikis/actions";
import {
  rolEtiketi,
  type RandevuSubeSecimi,
  type SubeliKullanici,
} from "@/lib/yetki-kapisi";
import type { MenuOgesi } from "@/lib/navigasyon";
import { MobilMenu } from "./mobil-menu";
import { SubeGostergesi } from "./sube-gostergesi";
import { OgrenciHizliArama } from "./ogrenci-hizli-arama";
import { YanMenu } from "./yan-menu";

/** Ad soyaddan avatar baş harfleri: "Kurum Koordinatörü" → "KK". */
function basHarfler(ad: string): string {
  const parcalar = ad.trim().split(/\s+/).filter(Boolean);
  if (parcalar.length === 0) return "?";
  const ilk = parcalar[0][0] ?? "";
  const son = parcalar.length > 1 ? (parcalar.at(-1)?.[0] ?? "") : "";
  return (ilk + son).toLocaleUpperCase("tr-TR");
}

/**
 * Koordinatör ve stajyer panellerinin ortak çerçevesi: sol menü, üst şerit,
 * kullanıcı bilgisi ve çıkış. İki panel de aynı kabuğu kullanır; farkları
 * yalnızca menü içeriği ve başlıktır.
 *
 * Sol menü kurumsal mürdüm zemin üzerinde: kurumun sitesinde de üst şerit
 * bu renk. Renk yalnızca kabukta yoğun; içerik alanı açık kalıyor ki
 * puanlama tablolarında ve rapor metinlerinde okuma yorulmasın.
 *
 * Menü ve üst şerit yapışkan (sticky): uzun listelerde aşağı inildiğinde
 * gezinme ve çıkış her an erişilebilir kalır.
 *
 * Üst şeritte üç şey var ve sırası bilinçli: KİM (hesap), NEREDE (şube),
 * ÇIKIŞ. Şube göstergesi sabit — sistem iki şubede kullanılıyor ve ekranlar
 * birbirine benziyor; hangi şubede olduğunu söyleyen kalıcı bir işaret
 * olmadan yanlış şubede iş yapmak sessizce mümkün olurdu.
 */
export function PanelKabuk({
  kullanici,
  menu,
  baslik,
  randevuSubesi = null,
  children,
}: {
  kullanici: SubeliKullanici;
  menu: readonly MenuOgesi[];
  baslik: string;
  /** Randevu ekranlarında şube kutusunun seçeceği randevu şubesi. */
  randevuSubesi?: RandevuSubeSecimi | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      {/* Menü zemini üstten aydınlık, alta doğru koyulaşan bir mürdüm yüzey:
          içerik alanındaki kil ışık modeli (sol üstten ışık) burada da
          sürüyor, panel tek bir malzemeden yapılmış gibi duruyor. */}
      <aside className="hidden w-64 shrink-0 bg-gradient-to-b from-marka-700 to-marka-900 md:sticky md:top-0 md:flex md:h-svh md:flex-col">
        <div className="px-5 py-4 shadow-[inset_0_-1px_0_var(--kil-koyu-golge)]">
          <Link href="/" className="block">
            <span className="text-sm font-bold tracking-tight text-white">
              Atölye Yönetim
            </span>
            <span className="mt-0.5 block text-xs text-marka-200">
              {baslik}
            </span>
          </Link>
        </div>

        <YanMenu menu={menu} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Üst şerit sayfanın zemininden bir tık kabarık: altındaki içerik
            kaydıkça şeridin sabit durduğu gölgesinden anlaşılıyor. */}
        {/*
          Telefonda İKİ SATIR (Eylül 2026 mobil turu): üstte menü + hesap +
          çıkış, altında tam genişlikte şube kutusu. Tek satıra sığmadığı için
          şube kutusu avatarın üstüne biniyordu. `order-*` sınıfları
          masaüstündeki sırayı (hesap · şube · çıkış) koruyor.
        */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 bg-[linear-gradient(180deg,#fdfbfc,#f6f0f3)] px-4 py-2.5 shadow-[0_6px_16px_-8px_var(--kil-golge),inset_0_1px_0_#fff] sm:flex-nowrap sm:justify-between sm:px-6">
          {/* Ad, hesap sayfasına giden bağlantı: parola değiştirme buradan
              bulunuyor. Menüye ayrı madde eklenmedi — 13 modülün arasına
              karışmaması, kullanıcının kendi hesabına ait olması gerekiyor. */}
          <div className="order-1 flex min-w-0 flex-1 items-center gap-1">
            {/* Dar ekranda sol menü gizli; buradaki düğme çekmeceyi açıyor. */}
            <MobilMenu menu={menu} baslik={baslik} />

            <Link
              href="/hesabim"
              className="kil-buton kil-buton-sade -mx-2 flex min-w-0 items-center gap-2.5 px-2 py-1"
            >
              <span
                aria-hidden
                className="kil-rozet grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-marka-700"
              >
                {basHarfler(kullanici.name)}
              </span>
              {/* Dar ekranda yalnızca avatar kalıyor: üst şeritte üç şeye
                  birden yer yok ve NEREDE olduğunu bilmek KİM olduğunu
                  bilmekten daha kritik. Ad hesap sayfasında tam duruyor. */}
              <span className="hidden min-w-0 sm:block">
                <span className="block truncate text-sm font-medium text-zinc-900">
                  {kullanici.name}
                </span>
                <span className="block whitespace-nowrap text-xs text-zinc-500">
                  {rolEtiketi(kullanici.roller)} · Hesabım
                </span>
              </span>
            </Link>
          </div>

          {/* §6.6 — Hızlı öğrenci araması. En sık yapılan iş en uzun yoldan
              yapılıyordu: bir çocuğun profiline bakmak için önce Öğrenciler
              ekranına gidip sonra aramak gerekiyordu. Üst şerit her sayfada
              olduğu için arama da her sayfada. Öğrenci listesini göremeyen
              rolde hiç çizilmez. */}
          {kullanici.yetkiler.ogrenciler !== "YOK" ? (
            <div className="order-4 w-full shrink-0 sm:order-2 sm:w-auto">
              <OgrenciHizliArama />
            </div>
          ) : null}

          <div className="order-3 w-full shrink-0 sm:order-3 sm:w-auto">
            <SubeGostergesi
              aktifSubeId={kullanici.aktifSubeId}
              subeler={kullanici.secilebilirSubeler}
              degistirebilir={kullanici.subeDegistirebilir}
              randevuSubesi={randevuSubesi}
            />
          </div>

          <form action={cikisYap} className="order-2 shrink-0 sm:order-4 sm:ml-3">
            <button
              type="submit"
              className="kil-buton kil-buton-ikincil min-h-[2.75rem] px-3.5 py-1.5 text-sm sm:min-h-[2.25rem]"
            >
              Çıkış
            </button>
          </form>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
