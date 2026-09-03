import { describe, expect, it } from "vitest";
import {
  AKTIF_DONEM_DURUMLARI,
  AKTIF_KULUP_DURUMLARI,
  DONEM_DURUMLARI,
  DONEM_DURUM_GECISLERI,
  KULUP_DURUMLARI,
  KULUP_DURUM_GECISLERI,
  aktifGrupKosulu,
  aktifOgrenciKosulu,
  atanmamisKayitKosulu,
} from "./durumlar";

const SUBE = "sube-umraniye";

describe("şube süzgeci taşıyan koşullar", () => {
  it("aktif grup koşulu şubeyi ve aktifliği birlikte zorlar", () => {
    expect(aktifGrupKosulu(SUBE)).toEqual({
      branchId: SUBE,
      active: true,
      OR: [
        { term: { status: { in: AKTIF_DONEM_DURUMLARI } } },
        { club: { status: { in: AKTIF_KULUP_DURUMLARI } } },
      ],
    });
  });

  it("öğrenci koşulu şubeyi HEM öğrencide HEM grupta süzer", () => {
    // Sızıntının gireceği yer tam olarak burası: öğrenci şubeye
    // süzülüp de iç içe grup koşulu süzülmezse, kendi şubesindeki bir
    // öğrenci başka şubenin grubundaki kaydı yüzünden aktif sayılır.
    const kosul = aktifOgrenciKosulu(SUBE);
    expect(kosul.branchId).toBe(SUBE);
    expect(kosul.enrollments).toEqual({
      some: { status: "AKTIF", group: aktifGrupKosulu(SUBE) },
    });
  });

  it("atanmamış kayıt koşulu grubu üzerinden şubeye bağlı", () => {
    // Kaydın kendi `branchId` sütunu yok; şubeye ancak grubu üzerinden
    // bağlanıyor. Grup koşulu düşerse kart bütün şubeleri sayardı.
    expect(atanmamisKayitKosulu(SUBE)).toEqual({
      status: "AKTIF",
      internId: null,
      group: aktifGrupKosulu(SUBE),
    });
  });

  it("koşul üreticileri şube almadan çağrılamıyor", () => {
    // Sabit nesne yerine fonksiyon olmalarının tek sebebi bu; iki farklı
    // şube iki farklı koşul üretmeli.
    expect(aktifGrupKosulu("a")).not.toEqual(aktifGrupKosulu("b"));
    expect(aktifOgrenciKosulu("a")).not.toEqual(aktifOgrenciKosulu("b"));
  });
});

describe("durum geçişleri", () => {
  it("her durumun bir etiketi ve geçiş listesi var", () => {
    for (const durum of Object.keys(DONEM_DURUM_GECISLERI)) {
      expect(DONEM_DURUMLARI).toHaveProperty(durum);
    }
    for (const durum of Object.keys(KULUP_DURUM_GECISLERI)) {
      expect(KULUP_DURUMLARI).toHaveProperty(durum);
    }
  });

  it("hiçbir durum kendine geçemez", () => {
    for (const [durum, hedefler] of Object.entries(DONEM_DURUM_GECISLERI)) {
      expect(hedefler).not.toContain(durum);
    }
    for (const [durum, hedefler] of Object.entries(KULUP_DURUM_GECISLERI)) {
      expect(hedefler).not.toContain(durum);
    }
  });

  it("geçiş hedefleri tanımlı durumlar", () => {
    for (const hedefler of Object.values(DONEM_DURUM_GECISLERI)) {
      for (const hedef of hedefler) expect(DONEM_DURUMLARI).toHaveProperty(hedef);
    }
    for (const hedefler of Object.values(KULUP_DURUM_GECISLERI)) {
      for (const hedef of hedefler) expect(KULUP_DURUMLARI).toHaveProperty(hedef);
    }
  });

  it("arşivden tek hamlede kayıt almaya dönülemez", () => {
    // Belgelenmiş kural: kapalı bir programı yeniden açmak en az iki
    // bilinçli adım istiyor.
    expect(DONEM_DURUM_GECISLERI.ARSIVLENDI).toEqual(["TAMAMLANDI"]);
    expect(KULUP_DURUM_GECISLERI.ARSIVLENDI).not.toContain("KAYIT_ALIYOR");
  });

  it("tamamlanmış dönem taslağa dönemez", () => {
    expect(DONEM_DURUM_GECISLERI.TAMAMLANDI).not.toContain("TASLAK");
    expect(KULUP_DURUM_GECISLERI.TAMAMLANDI).not.toContain("TASLAK");
  });

  it("her durumdan arşive gidilebilir", () => {
    // Arşiv listelerin tek boşaltma yolu; çıkışsız kalan bir durum
    // programı listede sonsuza kadar tutardı.
    for (const [durum, hedefler] of Object.entries(DONEM_DURUM_GECISLERI)) {
      if (durum === "ARSIVLENDI") continue;
      expect([durum, hedefler.includes("ARSIVLENDI")]).toEqual([durum, true]);
    }
    for (const [durum, hedefler] of Object.entries(KULUP_DURUM_GECISLERI)) {
      if (durum === "ARSIVLENDI") continue;
      expect([durum, hedefler.includes("ARSIVLENDI")]).toEqual([durum, true]);
    }
  });

  it("aktif sayılan durumlar tanımlı", () => {
    expect(AKTIF_DONEM_DURUMLARI).toEqual(["KAYIT_ALIYOR", "DEVAM_EDIYOR"]);
    // Kulüp tek yarım gün: "devam ediyor" karşılığı yok.
    expect(AKTIF_KULUP_DURUMLARI).toEqual(["KAYIT_ALIYOR"]);
  });
});
