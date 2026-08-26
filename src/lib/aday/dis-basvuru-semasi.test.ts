import { describe, expect, it } from "vitest";
import { DIS_BASVURU_SEMASI } from "./dis-basvuru-semasi";

const META = { kaynak: "META" as const };
const WEB = { kaynak: "WEB_SITESI" as const, kvkkOnay: true };

describe("DIS_BASVURU_SEMASI", () => {
  it("kaynak dışında hiçbir alanı zorunlu tutmaz", () => {
    // Entegratör eşleme hatası yüzünden gerçek bir başvuru düşmemeli.
    const sonuc = DIS_BASVURU_SEMASI.safeParse(META);
    expect(sonuc.success).toBe(true);
  });

  it("tanınmayan kaynağı reddeder", () => {
    expect(DIS_BASVURU_SEMASI.safeParse({ kaynak: "TELEFON" }).success).toBe(
      false,
    );
    // Elle kaynaklar API'den yazılamaz: rapor sayıları elle şişirilemesin.
    expect(
      DIS_BASVURU_SEMASI.safeParse({ kaynak: "YOLDAN_GECEN" }).success,
    ).toBe(false);
  });

  it("web sitesi başvurusunda KVKK onayı zorunludur", () => {
    const onaysiz = DIS_BASVURU_SEMASI.safeParse({ kaynak: "WEB_SITESI" });
    expect(onaysiz.success).toBe(false);
    expect(DIS_BASVURU_SEMASI.safeParse(WEB).success).toBe(true);
  });

  it("Meta başvurusunda onay alanı zorunlu değildir", () => {
    // Aydınlatma metni Meta formunun kendi gizlilik alanından sunuluyor.
    expect(DIS_BASVURU_SEMASI.safeParse(META).success).toBe(true);
  });

  it("boş metinleri yok sayar", () => {
    const sonuc = DIS_BASVURU_SEMASI.parse({ ...META, veliAdi: "   " });
    expect(sonuc.veliAdi).toBeUndefined();
  });

  it("taşan alanı kırpar, başvuruyu düşürmez", () => {
    const sonuc = DIS_BASVURU_SEMASI.parse({
      ...META,
      mesaj: "a".repeat(5000),
    });
    expect(sonuc.mesaj).toHaveLength(2000);
  });

  it("yaşı sayıya çevirir, saçma değerde alanı boş bırakır", () => {
    expect(DIS_BASVURU_SEMASI.parse({ ...META, yas: "7" }).yas).toBe(7);
    expect(DIS_BASVURU_SEMASI.parse({ ...META, yas: "yedi" }).yas).toBeUndefined();
    expect(DIS_BASVURU_SEMASI.parse({ ...META, yas: 99 }).yas).toBeUndefined();
  });

  it("bal küpü alanını taşır — rota sessizce yutabilsin", () => {
    const sonuc = DIS_BASVURU_SEMASI.parse({ ...META, website: "spam.example" });
    expect(sonuc.website).toBe("spam.example");
  });

  it("telefon ve dış kimliği olduğu gibi taşır", () => {
    const sonuc = DIS_BASVURU_SEMASI.parse({
      ...META,
      telefon: " 0532 111 22 33 ",
      disKimlik: "1234567890",
    });
    expect(sonuc.telefon).toBe("0532 111 22 33");
    expect(sonuc.disKimlik).toBe("1234567890");
  });
});
