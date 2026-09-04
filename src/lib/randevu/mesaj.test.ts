import { describe, expect, it } from "vitest";
import {
  anketMetni,
  hatirlatmaMetni,
  whatsappMesajBaglantisi,
  type MesajBilgisi,
} from "./mesaj";

const temel: MesajBilgisi = {
  kurumAdi: "TÜZDER",
  veliAdi: "Ayşe Yılmaz",
  cocukAdi: "Zeynep",
  hizmetAdi: "Oyun Temelli Danışmanlık",
  uzmanAdi: "Büşra Kulaber",
  // 18 Ekim 2026 pazar, 14:30 (duvar saati, UTC'de saklanıyor).
  baslangic: new Date("2026-10-18T14:30:00.000Z"),
};

describe("hatirlatmaMetni", () => {
  it("gün adını ve saati birlikte yazar", () => {
    // Yalnız tarih yazan bir hatırlatma veliyi takvime bakmaya zorlar.
    const metin = hatirlatmaMetni(temel);
    expect(metin).toContain("18 Ekim 2026, Pazar");
    expect(metin).toContain("saat 14:30");
  });

  it("velinin ilk adıyla hitap eder", () => {
    // "Sayın Ayşe Yılmaz Hanım" gibi bir hitap çıkmasın; unvan da yok,
    // çünkü velinin cinsiyeti kayıtlı değil.
    expect(hatirlatmaMetni(temel).startsWith("Sayın Ayşe, merhaba.")).toBe(true);
  });

  it("uzman, hizmet ve kurum adı geçer", () => {
    const metin = hatirlatmaMetni(temel);
    expect(metin).toContain("Büşra Kulaber");
    expect(metin).toContain("Oyun Temelli Danışmanlık");
    expect(metin.endsWith("TÜZDER")).toBe(true);
  });

  it("çocuk adı varsa seansın kimin için olduğunu söyler", () => {
    expect(hatirlatmaMetni(temel)).toContain("Zeynep için");
  });

  it("çocuk yoksa 'için' kalıbı hiç çıkmaz", () => {
    // Aile danışmanlığında danışan velinin kendisi; "null için" gibi bir
    // metin veliye gitmemeli.
    const metin = hatirlatmaMetni({ ...temel, cocukAdi: null });
    expect(metin).not.toContain("için ");
    expect(metin).not.toContain("null");
    expect(metin).toContain("18 Ekim 2026, Pazar");
  });

  it("tek kelimelik veli adında da doğru hitap eder", () => {
    expect(
      hatirlatmaMetni({ ...temel, veliAdi: "Makbule" }).startsWith(
        "Sayın Makbule,",
      ),
    ).toBe(true);
  });

  it("baştaki boşluk hitabı bozmaz", () => {
    expect(
      hatirlatmaMetni({ ...temel, veliAdi: "  Ayşe Yılmaz " }).startsWith(
        "Sayın Ayşe,",
      ),
    ).toBe(true);
  });
});

describe("anketMetni", () => {
  it("geçmiş seansa atıfla yazılır", () => {
    const metin = anketMetni(temel);
    expect(metin).toContain("gerçekleşen");
    expect(metin).toContain("18 Ekim 2026, Pazar");
    expect(metin).toContain("Oyun Temelli Danışmanlık");
  });

  it("uydurma bir anket adresi İÇERMEZ", () => {
    // Kurumun anket bağlantısı sistemde tanımlı değil; olmayan bir adres
    // göndermek hiç göndermemekten kötü.
    const metin = anketMetni(temel);
    expect(metin).not.toMatch(/https?:\/\//);
  });

  it("kurum adıyla biter", () => {
    expect(anketMetni(temel).endsWith("TÜZDER")).toBe(true);
  });
});

describe("whatsappMesajBaglantisi", () => {
  it("tam numarada hazır metinli bağlantı üretir", () => {
    const baglanti = whatsappMesajBaglantisi("0532 111 22 33", "Merhaba dünya");
    expect(baglanti).toBe("https://wa.me/905321112233?text=Merhaba%20d%C3%BCnya");
  });

  it("satır sonlarını ve Türkçe karakterleri kaçışlar", () => {
    const baglanti = whatsappMesajBaglantisi("05321112233", "Sayın Ayşe,\nmerhaba");
    expect(baglanti).toContain("%0A");
    expect(baglanti).toContain("Say%C4%B1n");
  });

  it("numara yoksa veya eksikse bağlantı üretmez", () => {
    // Çalışmayan düğme, olmayan düğmeden kötüdür.
    expect(whatsappMesajBaglantisi(null, "x")).toBeNull();
    expect(whatsappMesajBaglantisi("0532", "x")).toBeNull();
    expect(whatsappMesajBaglantisi("", "x")).toBeNull();
  });

  it("gerçek hatırlatma metniyle çalışır", () => {
    const baglanti = whatsappMesajBaglantisi(
      "0532 111 22 33",
      hatirlatmaMetni(temel),
    );
    expect(baglanti).toContain("wa.me/905321112233?text=");
    expect(decodeURIComponent(baglanti!.split("?text=")[1])).toContain(
      "saat 14:30",
    );
  });
});
