import Link from "next/link";
import { cikisYap } from "@/app/cikis/actions";
import { rolEtiketi, type SubeliKullanici } from "@/lib/yetki-kapisi";
import type { MenuOgesi } from "@/lib/navigasyon";
import { MobilMenu } from "./mobil-menu";
import { SubeGostergesi } from "./sube-gostergesi";
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
  children,
}: {
  kullanici: SubeliKullanici;
  menu: readonly MenuOgesi[];
  baslik: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 bg-marka-800 md:sticky md:top-0 md:flex md:h-svh md:flex-col">
        <div className="border-b border-marka-700 px-5 py-4">
          <Link href="/" className="block">
            <span className="text-sm font-semibold text-white">
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
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-yuzey-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
          {/* Ad, hesap sayfasına giden bağlantı: parola değiştirme buradan
              bulunuyor. Menüye ayrı madde eklenmedi — 13 modülün arasına
              karışmaması, kullanıcının kendi hesabına ait olması gerekiyor. */}
          <div className="flex min-w-0 items-center gap-1">
            {/* Dar ekranda sol menü gizli; buradaki düğme çekmeceyi açıyor. */}
            <MobilMenu menu={menu} baslik={baslik} />

            <Link
              href="/hesabim"
              className="-mx-2 flex min-w-0 items-center gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-marka-50"
            >
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-marka-100 text-xs font-semibold text-marka-700"
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

          <div className="flex shrink-0 items-center gap-3">
            <SubeGostergesi
              aktifSubeId={kullanici.aktifSubeId}
              subeler={kullanici.secilebilirSubeler}
              degistirebilir={kullanici.subeDegistirebilir}
            />

            <form action={cikisYap}>
              <button
                type="submit"
                className="min-h-[2.75rem] rounded-md border border-marka-200 px-3 py-1.5 text-sm font-medium text-marka-700 transition-colors hover:bg-marka-50 sm:min-h-0"
              >
                Çıkış
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
