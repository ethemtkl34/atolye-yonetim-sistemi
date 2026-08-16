import { describe, expect, it } from "vitest";
import {
  DUZEYLER,
  DUZEY_MERDIVENI,
  duzeyCikar,
  duzeyDegisimi,
} from "./rapor-duzeyleri";

describe("duzeyCikar", () => {
  it("puan yoksa düzey uydurmaz", () => {
    // Kart basılmasın diye null: hiç puanlanmamış bir kategoriye "Desteklenmeli"
    // demek, çocuğu görmediğimiz bir davranıştan aşağı çekmek olurdu.
    expect(duzeyCikar(null)).toBeNull();
    expect(duzeyCikar(Number.NaN)).toBeNull();
  });

  it("tam puanları kendi basamağına koyar", () => {
    expect(duzeyCikar(1)?.etiket).toBe("Destekle");
    expect(duzeyCikar(2)?.etiket).toBe("Gelişiyor");
    expect(duzeyCikar(3)?.etiket).toBe("Bağımsız");
    expect(duzeyCikar(4)?.etiket).toBe("Belirgin");
    expect(duzeyCikar(5)?.etiket).toBe("İleri düzey");
  });

  it("en yakın basamağa yuvarlar", () => {
    expect(duzeyCikar(3.4)?.duzey).toBe("BAGIMSIZ");
    expect(duzeyCikar(3.5)?.duzey).toBe("BELIRGIN");
    expect(duzeyCikar(4.49)?.duzey).toBe("BELIRGIN");
    expect(duzeyCikar(4.5)?.duzey).toBe("ILERI");
  });

  it("ölçek dışı değerleri uçlara kırpar", () => {
    // Bozuk veri raporu çökertmemeli; 0 ya da 7 gelirse merdivenin ucuna oturur.
    expect(duzeyCikar(0)?.basamak).toBe(1);
    expect(duzeyCikar(-3)?.basamak).toBe(1);
    expect(duzeyCikar(7)?.basamak).toBe(5);
  });

  it("basamak arttıkça küre büyür — renk okunamasa da düzey görünür", () => {
    const caplar = DUZEY_MERDIVENI.map((d) => d.cap);
    expect(caplar).toEqual([...caplar].sort((a, b) => a - b));
    expect(new Set(caplar).size).toBe(caplar.length);
  });

  it("merdiven basamak sırasını korur", () => {
    expect(DUZEY_MERDIVENI.map((d) => d.basamak)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("duzeyDegisimi", () => {
  it("yönü bildirir", () => {
    expect(duzeyDegisimi(DUZEYLER.BAGIMSIZ, DUZEYLER.BELIRGIN)).toBe("YUKSELDI");
    expect(duzeyDegisimi(DUZEYLER.BELIRGIN, DUZEYLER.BAGIMSIZ)).toBe("GERILEDI");
    expect(duzeyDegisimi(DUZEYLER.BAGIMSIZ, DUZEYLER.BAGIMSIZ)).toBe("AYNI");
  });

  it("uçlardan biri yoksa değişim iddia etmez", () => {
    expect(duzeyDegisimi(null, DUZEYLER.BELIRGIN)).toBeNull();
    expect(duzeyDegisimi(DUZEYLER.BELIRGIN, null)).toBeNull();
  });
});
