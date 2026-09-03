import { describe, expect, it } from "vitest";
import {
  KOORDINATOR_MENUSU,
  STAJYER_MENUSU,
  panelBasligi,
  panelMenusu,
} from "./navigasyon";
import { MODULLER, etkinYetki } from "./yetkiler";
import type { Role } from "@/generated/prisma/enums";

const etiketler = (roller: Role[]) => panelMenusu(roller).map((o) => o.etiket);

const TUM_ROLLER: Role[] = [
  "ADMIN",
  "SUBE_YONETICISI",
  "KOORDINATOR",
  "ATOLYE_PSIKOLOGU",
  "TEST_UYGULAYICISI",
  "DANISMA_GOREVLISI",
  "STAJYER",
];

describe("panelMenusu", () => {
  it("stajyer koordinatör menüsünü hiç görmez", () => {
    // Stajyerin erişimi yetki matrisinden değil kendi panelinden geliyor;
    // roller birleşse bile koordinatör menüsüne düşmemeli.
    expect(panelMenusu(["STAJYER"])).toBe(STAJYER_MENUSU);
    expect(panelMenusu(["STAJYER", "KOORDINATOR"])).toBe(STAJYER_MENUSU);
  });

  it("koordinatör kullanıcı yönetimini görmez, şube yöneticisi görür", () => {
    // İki rolü ayıran TEK satır bu; menüde de ayrışmalı.
    expect(etiketler(["KOORDINATOR"])).not.toContain("Kullanıcılar");
    expect(etiketler(["SUBE_YONETICISI"])).toContain("Kullanıcılar");
  });

  it("danışma görevlisine kapalı modüller menüde çıkmaz", () => {
    const menu = etiketler(["DANISMA_GOREVLISI"]);

    // Görüşmeler sağlık mahremiyeti gereği tamamen gizli; puanlama, rapor,
    // arşiv ve müfredat bu masanın işi değil.
    expect(menu).not.toContain("Danışmanlık");
    expect(menu).not.toContain("Puanlamalar");
    expect(menu).not.toContain("Rapor ayarları");
    expect(menu).not.toContain("Arşiv");
    expect(menu).not.toContain("Atölye çeşitleri");
    expect(menu).not.toContain("Stajyerler");
    expect(menu).not.toContain("Kullanıcılar");
  });

  it("LISTE seviyesi maddeyi gösterir", () => {
    // Danışma görevlisi zeka testlerinin listesini görebiliyor (belgeyi
    // açamıyor); bağlantısı menüde olmalı — YOK olmayan her seviye gösterir.
    expect(etkinYetki(["DANISMA_GOREVLISI"], "zekaTestleri")).toBe("LISTE");
    expect(etiketler(["DANISMA_GOREVLISI"])).toContain("Zeka testleri");
  });

  it("modülsüz madde (dashboard) her rolde görünür", () => {
    for (const rol of TUM_ROLLER) {
      if (rol === "STAJYER") continue;
      expect(etiketler([rol])[0]).toBe("Dashboard");
    }
  });

  it("tek başına test uygulayıcısı yalnızca zeka testlerini görür", () => {
    expect(etiketler(["TEST_UYGULAYICISI"])).toEqual([
      "Dashboard",
      "Zeka testleri",
    ]);
  });

  it("roller birleşince menü de birleşir", () => {
    // Pratikte verilen ikili: psikolog + test uygulayıcısı. Birleşim
    // psikologun menüsünü daraltmamalı.
    const psikolog = etiketler(["ATOLYE_PSIKOLOGU"]);
    const birlesik = etiketler(["ATOLYE_PSIKOLOGU", "TEST_UYGULAYICISI"]);
    for (const madde of psikolog) expect(birlesik).toContain(madde);
  });

  it("yönetici bütün maddeleri görür", () => {
    expect(panelMenusu(["ADMIN"])).toHaveLength(KOORDINATOR_MENUSU.length);
  });

  it("her menü maddesi tam olarak yetkisi olan role görünür", () => {
    // Asıl kural bu; yukarıdaki örnekler onun tek tek okunan hâli. Menüye
    // yeni madde eklenince de geçerli kalsın diye matrisin tamamı taranıyor.
    for (const rol of TUM_ROLLER) {
      if (rol === "STAJYER") continue;
      const gorunen = new Set(etiketler([rol]));
      for (const oge of KOORDINATOR_MENUSU) {
        const beklenen = !oge.modul || etkinYetki([rol], oge.modul) !== "YOK";
        expect([rol, oge.etiket, gorunen.has(oge.etiket)]).toEqual([
          rol,
          oge.etiket,
          beklenen,
        ]);
      }
    }
  });

  it("menüsüz olduğu bilinen ikisi dışında her modül menüde", () => {
    // Yetki matrisine modül eklenip menüye bağlantı eklenmezse, o modülün
    // ekranına yalnızca adresi bilen ulaşır.
    //
    // İki muafiyet var, ikisi de bilinçli (bkz. navigasyon.ts yorumları):
    //   mufredat — kendi başına sayfası YOK; `app/koordinator/mufredat` bir
    //     rota değil, paylaşılan bileşen klasörü. Dönemin/kulübün içinden
    //     açılıyor.
    //   kayitlar — kaydın bütün işleri öğrencinin sayfasında yapılıyor; toplu
    //     liste ekranı duruyor ama menüde değil, dashboard kartından açılıyor.
    const MENUSUZ_MODULLER = new Set(["mufredat", "kayitlar"]);
    const menudekiModuller = new Set(
      KOORDINATOR_MENUSU.map((o) => o.modul).filter(Boolean),
    );
    for (const modul of MODULLER) {
      if (MENUSUZ_MODULLER.has(modul)) continue;
      expect([modul, menudekiModuller.has(modul)]).toEqual([modul, true]);
    }
  });
});

describe("panelBasligi", () => {
  it("stajyer başlığı diğer rollerin önüne geçer", () => {
    expect(panelBasligi(["STAJYER"])).toBe("Stajyer paneli");
  });

  it("her rol kendi başlığını alır", () => {
    expect(panelBasligi(["ADMIN"])).toBe("Yönetici paneli");
    expect(panelBasligi(["SUBE_YONETICISI"])).toBe("Şube yöneticisi paneli");
    expect(panelBasligi(["KOORDINATOR"])).toBe("Koordinatör paneli");
    expect(panelBasligi(["DANISMA_GOREVLISI"])).toBe("Koordinatör paneli");
  });

  it("yönetici şube yöneticisinden önce gelir", () => {
    expect(panelBasligi(["SUBE_YONETICISI", "ADMIN"])).toBe("Yönetici paneli");
  });
});
