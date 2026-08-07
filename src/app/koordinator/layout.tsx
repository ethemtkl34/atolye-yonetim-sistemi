import { PanelKabuk } from "@/components/panel-kabuk";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { panelBasligi, panelMenusu } from "@/lib/navigasyon";

/**
 * Koordinatör alanının ortak çerçevesi. Yetki kontrolü burada yapılır ama
 * tek dayanak değildir: alt sayfalar ve Server Action'lar da kendi
 * içlerinde `yonetimZorunlu()` çağırır.
 */
export default async function KoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const kullanici = await yonetimZorunlu();

  return (
    <PanelKabuk
      kullanici={kullanici}
      menu={panelMenusu(kullanici.roller)}
      baslik={panelBasligi(kullanici.roller)}
    >
      {children}
    </PanelKabuk>
  );
}
