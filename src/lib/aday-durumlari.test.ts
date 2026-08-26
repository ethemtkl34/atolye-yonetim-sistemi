import { describe, expect, it } from "vitest";
import type { LeadStage } from "@/generated/prisma/enums";
import {
  ACIK_ASAMALAR,
  ADAY_ASAMALARI,
  ADAY_ASAMA_GECISLERI,
  ADAY_KAYNAKLARI,
  ELLE_KAYNAKLAR,
  acikAdayKosulu,
  adayAralikKosulu,
  bugunAranacakKosulu,
  dokunulmamisAdayKosulu,
  gecikmisAdayKosulu,
} from "./aday-durumlari";

const ASAMALAR = Object.keys(ADAY_ASAMALARI) as LeadStage[];

describe("ADAY_ASAMA_GECISLERI", () => {
  it("her aşamanın bir geçiş listesi vardır", () => {
    for (const asama of ASAMALAR) {
      expect(ADAY_ASAMA_GECISLERI[asama]).toBeDefined();
    }
  });

  it("hedefler tanımlı aşamalardır ve aşama kendine geçmez", () => {
    for (const asama of ASAMALAR) {
      for (const hedef of ADAY_ASAMA_GECISLERI[asama]) {
        expect(ASAMALAR).toContain(hedef);
        expect(hedef).not.toBe(asama);
      }
    }
  });

  it("KAZANILDI terminaldir — öğrenci oluştuktan sonra geri dönüş yok", () => {
    expect(ADAY_ASAMA_GECISLERI.KAZANILDI).toEqual([]);
  });

  it("her açık aşamadan kazanma ve kaybetme yolu vardır", () => {
    // Yoldan gelen aile aynı gün kayıt olabilir; dönüşümü aşama tırmanışına
    // zorlamak amaca ters.
    for (const asama of ACIK_ASAMALAR) {
      expect(ADAY_ASAMA_GECISLERI[asama]).toContain("KAZANILDI");
      expect(ADAY_ASAMA_GECISLERI[asama]).toContain("KAYBEDILDI");
    }
  });

  it("kaybedilen aday yeniden açılabilir", () => {
    expect(ADAY_ASAMA_GECISLERI.KAYBEDILDI).toEqual(["YENI"]);
  });

  it("kapalı aşamalar ACIK_ASAMALAR listesinde değildir", () => {
    expect(ACIK_ASAMALAR).not.toContain("KAZANILDI");
    expect(ACIK_ASAMALAR).not.toContain("KAYBEDILDI");
  });
});

describe("ELLE_KAYNAKLAR", () => {
  it("makine kaynaklarını dışarıda bırakır", () => {
    // META/WEB_SITESI elle seçilebilseydi reklam getirisi sayısı elle
    // şişirilebilirdi.
    expect(ELLE_KAYNAKLAR).not.toContain("META");
    expect(ELLE_KAYNAKLAR).not.toContain("WEB_SITESI");
  });

  it("her kaynağın görünen etiketi vardır", () => {
    for (const kaynak of ELLE_KAYNAKLAR) {
      expect(ADAY_KAYNAKLARI[kaynak]).toBeTruthy();
    }
  });
});

describe("sorgu koşulları", () => {
  const SUBE = "sube-1";
  const GUN = new Date("2026-08-26T00:00:00.000Z");

  it("hepsi şubeyi koşula yazar", () => {
    const kosullar = [
      acikAdayKosulu(SUBE),
      bugunAranacakKosulu(SUBE, GUN),
      gecikmisAdayKosulu(SUBE, GUN),
      dokunulmamisAdayKosulu(SUBE),
      adayAralikKosulu(SUBE),
    ];
    for (const kosul of kosullar) {
      expect(kosul.branchId).toBe(SUBE);
    }
  });

  it("bugün aranacaklar gecikmişleri de kapsar (lte)", () => {
    // Kuyruk tek karttan okunur; geciken iş ikinci kez sayılmaz.
    expect(bugunAranacakKosulu(SUBE, GUN).nextActionDate).toEqual({ lte: GUN });
    expect(gecikmisAdayKosulu(SUBE, GUN).nextActionDate).toEqual({ lt: GUN });
  });

  it("takip kuyrukları yalnız açık adayları sayar", () => {
    expect(bugunAranacakKosulu(SUBE, GUN).stage).toEqual({
      in: ACIK_ASAMALAR,
    });
  });

  it("dokunulmamış aday sistem satırlarını dokunma saymaz", () => {
    const kosul = dokunulmamisAdayKosulu(SUBE);
    expect(kosul.stage).toBe("YENI");
    expect(kosul.activities).toEqual({
      none: { createdByUserId: { not: null } },
    });
  });

  it("aralık verilmezse tarih süzgeci eklemez", () => {
    expect(adayAralikKosulu(SUBE).createdAt).toBeUndefined();
  });

  it("yalnız başlangıç verilirse üst sınır yazmaz", () => {
    const baslangic = new Date("2026-08-01T00:00:00.000Z");
    expect(adayAralikKosulu(SUBE, baslangic).createdAt).toEqual({
      gte: baslangic,
    });
  });
});
