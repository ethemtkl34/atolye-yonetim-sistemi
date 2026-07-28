import Link from "next/link";
import { cikisYap } from "@/app/cikis/actions";
import { rolAdi, type OturumKullanicisi } from "@/lib/auth-guard";
import type { MenuOgesi } from "@/lib/navigasyon";
import { YanMenu } from "./yan-menu";

/**
 * Koordinatör ve stajyer panellerinin ortak çerçevesi: sol menü, üst şerit,
 * kullanıcı bilgisi ve çıkış. İki panel de aynı kabuğu kullanır; farkları
 * yalnızca menü içeriği ve başlıktır.
 */
export function PanelKabuk({
  kullanici,
  menu,
  baslik,
  children,
}: {
  kullanici: OturumKullanicisi;
  menu: readonly MenuOgesi[];
  baslik: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white md:flex md:flex-col">
        <div className="border-b border-zinc-200 px-5 py-4">
          <Link href="/" className="block">
            <span className="text-sm font-semibold text-zinc-900">
              Atölye Yönetim
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">{baslik}</span>
          </Link>
        </div>

        <YanMenu menu={menu} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">
              {kullanici.name}
            </p>
            <p className="text-xs text-zinc-500">{rolAdi(kullanici.role)}</p>
          </div>

          <form action={cikisYap}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Çıkış
            </button>
          </form>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
