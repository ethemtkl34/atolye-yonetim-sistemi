import { describe, expect, it } from "vitest";
import { z } from "zod";
import { alanHatalari, formCoklulari, formDegerleri } from "./formlar";

const sema = z.object({
  ad: z.string().min(2, "Ad en az 2 karakter olmalı").max(4, "Ad çok uzun"),
  yas: z.number().int("Tam sayı olmalı"),
});

const hatasi = (girdi: unknown) => {
  const sonuc = sema.safeParse(girdi);
  if (sonuc.success) throw new Error("bu girdinin hata vermesi bekleniyordu");
  return sonuc.error;
};

describe("alanHatalari", () => {
  it("zod hatalarını alan adına göre sözlüğe çevirir", () => {
    expect(alanHatalari(hatasi({ ad: "a", yas: 1.5 }))).toEqual({
      ad: "Ad en az 2 karakter olmalı",
      yas: "Tam sayı olmalı",
    });
  });

  it("aynı alanın birden çok hatasında İLK mesajı tutar", () => {
    // Form alanın altında tek satır gösteriyor; sonraki mesajın öncekini
    // ezmesi, kullanıcıya en alakasız hatayı gösterirdi.
    const hata = new z.ZodError([
      { code: "custom", path: ["ad"], message: "ilk" },
      { code: "custom", path: ["ad"], message: "ikinci" },
    ]);
    expect(alanHatalari(hata)).toEqual({ ad: "ilk" });
  });

  it("iç içe alanları noktalı yolla anahtarlar", () => {
    const hata = new z.ZodError([
      { code: "custom", path: ["anne", "telefon"], message: "Numara hatalı" },
    ]);
    expect(alanHatalari(hata)).toEqual({ "anne.telefon": "Numara hatalı" });
  });

  it("forma bağlanamayan kök hatayı sözlüğe koymaz", () => {
    // `superRefine` bazı kuralları alan yerine forma yazıyor (yolu boş);
    // boş anahtar sözlüğe girseydi hiçbir alanın altında gösterilemezdi.
    const hata = new z.ZodError([
      { code: "custom", path: [], message: "En az bir telefon gerekli" },
    ]);
    expect(alanHatalari(hata)).toEqual({});
  });
});

describe("formDegerleri", () => {
  it("istenen alanları olduğu gibi geri verir", () => {
    const form = new FormData();
    form.set("ad", "Deniz");
    form.set("soyad", "Yıldız");
    form.set("gizli", "okunmasın");

    expect(formDegerleri(form, ["ad", "soyad"])).toEqual({
      ad: "Deniz",
      soyad: "Yıldız",
    });
  });

  it("boş bırakılan alanı boş metin olarak korur", () => {
    // Alan sözlükte hiç yer almazsa `defaultValue` eski değere döner ve
    // kullanıcının sildiği içerik geri gelirdi.
    const form = new FormData();
    form.set("ad", "");
    expect(formDegerleri(form, ["ad"])).toEqual({ ad: "" });
  });

  it("hiç gönderilmemiş alanı uydurmaz", () => {
    expect(formDegerleri(new FormData(), ["ad"])).toEqual({});
  });

  it("dosya alanını metin sanmaz", () => {
    const form = new FormData();
    form.set("belge", new File(["içerik"], "test.pdf"));
    expect(formDegerleri(form, ["belge"])).toEqual({});
  });
});

describe("formCoklulari", () => {
  it("aynı adı taşıyan kutuların HEPSİNİ toplar", () => {
    // `FormData.get` yalnızca ilkini döndürüyor; bu fonksiyonun varlık
    // sebebi tam olarak bu.
    const form = new FormData();
    form.append("beceri", "odaklanma");
    form.append("beceri", "empati");
    form.append("beceri", "iletisim");

    expect(formCoklulari(form, ["beceri"])).toEqual({
      beceri: ["odaklanma", "empati", "iletisim"],
    });
  });

  it("hiç işaretlenmemiş grubu boş dizi yapar", () => {
    // Anahtarın hiç olmaması ile boş dizi farklı: form "hepsi kaldırıldı"
    // durumunu boş diziden okuyor.
    expect(formCoklulari(new FormData(), ["beceri"])).toEqual({ beceri: [] });
  });
});
