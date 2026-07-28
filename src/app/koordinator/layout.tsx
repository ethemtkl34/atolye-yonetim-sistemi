import { PanelKabuk } from "@/components/panel-kabuk";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { KOORDINATOR_MENUSU } from "@/lib/navigasyon";

/**
 * Koordinatör alanının ortak çerçevesi. Yetki kontrolü burada yapılır ama
 * tek dayanak değildir: alt sayfalar ve Server Action'lar da kendi
 * içlerinde `koordinatorZorunlu()` çağırır.
 */
export default async function KoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const kullanici = await koordinatorZorunlu();

  return (
    <PanelKabuk
      kullanici={kullanici}
      menu={KOORDINATOR_MENUSU}
      baslik="Koordinatör paneli"
    >
      {children}
    </PanelKabuk>
  );
}
