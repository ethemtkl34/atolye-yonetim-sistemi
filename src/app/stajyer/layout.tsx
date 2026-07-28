import { PanelKabuk } from "@/components/panel-kabuk";
import { stajyerZorunlu } from "@/lib/auth-guard";
import { STAJYER_MENUSU } from "@/lib/navigasyon";

export default async function StajyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const kullanici = await stajyerZorunlu();

  return (
    <PanelKabuk
      kullanici={kullanici}
      menu={STAJYER_MENUSU}
      baslik="Stajyer paneli"
    >
      {children}
    </PanelKabuk>
  );
}
