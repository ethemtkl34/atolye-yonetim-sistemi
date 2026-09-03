import { describe, expect, it } from "vitest";
import {
  BECERI_ADLARI,
  BECERI_ETIKETLERI,
  ETIKET_ALANLARI,
  beceriEtiketiCikar,
} from "./beceri-etiketleri";

describe("beceriEtiketiCikar", () => {
  it("soru başlığındaki anahtar kelimeden etiketi bulur", () => {
    expect(beceriEtiketiCikar("Dikkatini toplayabiliyor mu?")).toBe("odaklanma");
    expect(beceriEtiketiCikar("Neden-sonuç ilişkisi kurabiliyor")).toBe(
      "akil-yurutme",
    );
    expect(beceriEtiketiCikar("Kodlama etkinliğini tamamladı")).toBe(
      "problem-cozme",
    );
    expect(beceriEtiketiCikar("El-göz koordinasyonu")).toBe("ince-motor");
  });

  it("eşleşmeyen başlıkta null döner", () => {
    // Etiketsiz soru rapora beceri olarak girmiyor; uydurma bir etiket
    // vermek yanlış gelişim alanına yazardı.
    expect(beceriEtiketiCikar("Bugün hava nasıldı?")).toBeNull();
    expect(beceriEtiketiCikar("")).toBeNull();
  });

  it("büyük İ ile yazılmış başlığı da eşler", () => {
    // Türkçe yerelde küçültme şart: düz `toLowerCase` "İ" harfini
    // birleşik noktayla ("i̇") üretir ve "iletişim" anahtarına HİÇ
    // eşleşmez. auth.ts'teki yerel hatasının tersi yönü.
    expect(beceriEtiketiCikar("İletişim Becerileri")).toBe("iletisim");
    expect(beceriEtiketiCikar("İLETİŞİM BECERİLERİ")).toBe("iletisim");
  });

  it("kelime başlığın ortasında da yakalanır", () => {
    expect(beceriEtiketiCikar("Çalışmasında yaratıcı bir yol buldu")).toBe(
      "sira-disi-dusunme",
    );
  });

  it("dar kelime geniş kelimeyi yener — liste sırası", () => {
    // Listenin sırası bilinçli: "işitsel" gibi dar kelimeler, "dikkat"
    // gibi geniş kelimelerin ÖNÜNDE duruyor. Sıra bozulursa işitsel
    // dikkat soruları odaklanmaya yazılır ve rapordaki beceri dağılımı
    // sessizce kayar.
    expect(beceriEtiketiCikar("İşitsel dikkat")).toBe("isitsel-dikkat");
    expect(beceriEtiketiCikar("Dikkat süresi")).toBe("odaklanma");
    // Aynı kural iletişim ↔ planlama çiftinde de geçerli.
    expect(beceriEtiketiCikar("İletişim ve planlama")).toBe("iletisim");
  });
});

describe("etiket tabloları", () => {
  it("her etiketin görünen adı ve gelişim alanı var", () => {
    for (const etiket of BECERI_ETIKETLERI) {
      expect(BECERI_ADLARI[etiket]).toBeTruthy();
      expect(ETIKET_ALANLARI[etiket]).toBeTruthy();
    }
  });

  it("çıkarılan her etiket tanımlı etiketlerden biri", () => {
    const bilinen = new Set<string>(BECERI_ETIKETLERI);
    const ornekler = [
      "Dikkat",
      "Empati kurabiliyor",
      "Sorumluluk aldı",
      "Mantık yürüttü",
      "Hız",
      "Motor beceri",
      "Strateji",
      "Hayal gücü",
    ];
    for (const baslik of ornekler) {
      const etiket = beceriEtiketiCikar(baslik);
      if (etiket) expect(bilinen.has(etiket)).toBe(true);
    }
  });
});
