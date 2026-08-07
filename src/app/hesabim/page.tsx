import type { Metadata } from "next";
import { rolEtiketi, subeliOturum } from "@/lib/yetki-kapisi";
import { Kart, SayfaBasligi } from "@/components/ui";
import { PanelKabuk } from "@/components/panel-kabuk";
import { panelBasligi, panelMenusu } from "@/lib/navigasyon";
import { ParolaFormu } from "./parola-formu";

export const metadata: Metadata = {
  title: "Hesabım",
};

/**
 * Kullanıcının kendi hesabı.
 *
 * Hem koordinatör hem stajyer aynı sayfayı kullanıyor: yapılan tek iş kendi
 * parolasını değiştirmek ve bu ikisi için de aynı. Sayfa, kullanıcının rolüne
 * uyan panel kabuğu İÇİNDE çizilir — önceden kabuğun dışındaydı ve buraya
 * gelen kullanıcı menüsüz, bağlamsız bir ara sayfaya düşmüş gibi oluyordu.
 */
export default async function HesabimSayfasi() {
  const kullanici = await subeliOturum();

  return (
    <PanelKabuk
      kullanici={kullanici}
      menu={panelMenusu(kullanici.roller)}
      baslik={panelBasligi(kullanici.roller)}
    >
      <div className="mx-auto w-full max-w-lg">
        <SayfaBasligi
          baslik="Hesabım"
          aciklama="Parolanızı buradan değiştirebilirsiniz."
        />

        <Kart className="mt-6 p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-500">Ad</dt>
              <dd className="mt-0.5 text-sm text-zinc-800">{kullanici.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Rol</dt>
              <dd className="mt-0.5 text-sm text-zinc-800">
                {rolEtiketi(kullanici.roller)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Şube</dt>
              <dd className="mt-0.5 text-sm text-zinc-800">
                {/* Yöneticinin şubesi yok; burada yazan, o an ÇALIŞTIĞI
                    şubedir. İkisi karışmasın diye ifade ayrı. */}
                {kullanici.roller.includes("ADMIN")
                  ? `Bütün şubeler (şu an ${kullanici.aktifSubeAdi})`
                  : kullanici.aktifSubeAdi}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-zinc-500">Kullanıcı adı</dt>
              <dd className="mt-0.5 text-sm text-zinc-800">
                {kullanici.email}
              </dd>
            </div>
          </dl>
        </Kart>

        <Kart className="mt-4 p-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Parola değiştir
          </h2>
          <div className="mt-3">
            <ParolaFormu />
          </div>
        </Kart>
      </div>
    </PanelKabuk>
  );
}
