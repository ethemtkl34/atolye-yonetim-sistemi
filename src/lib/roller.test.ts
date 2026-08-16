import { describe, expect, it } from "vitest";
import { kullaniciYonetimiKapsami } from "./roller";

/**
 * Kapsam fonksiyonu kullanıcı yönetiminin TEK sınırı: hem ekranın sorgusu
 * hem de her eylemin hedef doğrulaması buradan dönen değeri kullanıyor.
 * `null` "süzgeç yok" demek — yanlışlıkla null dönmesi, şube yöneticisinin
 * bütün şubelerin hesaplarına açılması olurdu.
 */
describe("kullaniciYonetimiKapsami", () => {
  it("Kurum Yöneticisi bütün şubelere bakar", () => {
    expect(kullaniciYonetimiKapsami(["ADMIN"], null)).toEqual({
      kapsamSubeId: null,
    });
  });

  it("Şube Yöneticisi yalnızca kendi şubesine bakar", () => {
    expect(
      kullaniciYonetimiKapsami(["SUBE_YONETICISI"], "sube_gunesli"),
    ).toEqual({ kapsamSubeId: "sube_gunesli" });
  });

  it("şubesi boşalmış Şube Yöneticisi ekrana giremez", () => {
    // CHECK kısıtı bunu engelliyor ama veri elle bozulmuşsa kapsam null'a
    // düşerdi ve null "bütün şubeler" demek. Bu yüzden erişim tamamen kapanır.
    expect(kullaniciYonetimiKapsami(["SUBE_YONETICISI"], null)).toBeNull();
  });

  it("yöneticilik taşımayan roller ekrana giremez", () => {
    expect(kullaniciYonetimiKapsami(["KOORDINATOR"], "sube_umraniye")).toBeNull();
    expect(
      kullaniciYonetimiKapsami(["ATOLYE_PSIKOLOGU"], "sube_umraniye"),
    ).toBeNull();
    expect(kullaniciYonetimiKapsami(["STAJYER"], "sube_umraniye")).toBeNull();
    expect(kullaniciYonetimiKapsami([], null)).toBeNull();
  });

  it("rol birleşiminde şube yöneticiliği yeter", () => {
    // Şube yöneticisi + test uygulayıcısı: şubenin başındaki kişi aynı zamanda
    // zeka testi belgesi yüklüyor olabilir.
    expect(
      kullaniciYonetimiKapsami(
        ["SUBE_YONETICISI", "TEST_UYGULAYICISI"],
        "sube_gunesli",
      ),
    ).toEqual({ kapsamSubeId: "sube_gunesli" });
  });
});
