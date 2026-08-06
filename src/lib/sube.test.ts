import { describe, expect, it } from "vitest";
import { aktifSubeyiCoz } from "./sube";

const SUBELER = [{ id: "sube_umraniye" }, { id: "sube_gunesli" }];

describe("aktifSubeyiCoz", () => {
  it("şubeli kullanıcı kendi şubesinde çalışır", () => {
    expect(aktifSubeyiCoz(false, "sube_gunesli", undefined, SUBELER)).toBe(
      "sube_gunesli",
    );
  });

  it("şubeli kullanıcının çerezi YOK SAYILIR", () => {
    // Güvenlik kuralı: istemcinin elindeki bir değer görüş alanını
    // genişletemez. Koordinatör çerezi elle "diğer şube" yapsa bile kendi
    // şubesinde kalır.
    expect(
      aktifSubeyiCoz(false, "sube_umraniye", "sube_gunesli", SUBELER),
    ).toBe("sube_umraniye");
  });

  it("yönetici çerezdeki şubede çalışır", () => {
    expect(aktifSubeyiCoz(true, null, "sube_gunesli", SUBELER)).toBe(
      "sube_gunesli",
    );
  });

  it("yöneticinin çerezi yoksa ilk şubeye düşer", () => {
    expect(aktifSubeyiCoz(true, null, undefined, SUBELER)).toBe(
      "sube_umraniye",
    );
  });

  it("yöneticinin çerezi tanınmayan bir şubeyse ilk şubeye düşer", () => {
    // Çerez bozuk olabilir ya da şube pasife alınmış olabilir. Hata vermek
    // yerine ilk şubeye düşmek paneli kilitlenmekten kurtarıyor.
    expect(aktifSubeyiCoz(true, null, "silinmis-sube", SUBELER)).toBe(
      "sube_umraniye",
    );
  });

  it("hiç aktif şube yoksa yönetici için null döner", () => {
    expect(aktifSubeyiCoz(true, null, "sube_umraniye", [])).toBeNull();
  });

  it("şubesi olmayan şubeli kullanıcı için null döner", () => {
    // Veritabanı CHECK'i bunu engelliyor; veri elle bozulmuşsa çağıran
    // taraf kullanıcıyı panele sokmamalı.
    expect(aktifSubeyiCoz(false, null, undefined, SUBELER)).toBeNull();
  });
});
