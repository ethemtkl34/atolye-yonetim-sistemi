import { PanelKabuk } from "@/components/panel-kabuk";
import { randevuSubeSecimi, yonetimZorunlu } from "@/lib/yetki-kapisi";
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
  // Randevu ekranlarında sağ üstteki şube kutusu randevu şubesini seçer.
  const randevuSubesi = await randevuSubeSecimi(kullanici);

  return (
    <PanelKabuk
      kullanici={kullanici}
      menu={panelMenusu(kullanici.roller)}
      baslik={panelBasligi(kullanici.roller)}
      randevuSubesi={randevuSubesi}
    >
      {children}
    </PanelKabuk>
  );
}
