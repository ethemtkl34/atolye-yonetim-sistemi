import { PanelKabuk } from "@/components/panel-kabuk";
import { stajyerZorunlu } from "@/lib/auth-guard";
import { panelBasligi, panelMenusu } from "@/lib/navigasyon";

export default async function StajyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const kullanici = await stajyerZorunlu();

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
