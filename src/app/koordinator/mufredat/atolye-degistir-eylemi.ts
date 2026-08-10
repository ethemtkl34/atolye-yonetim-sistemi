"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { takvimKilidiAl } from "@/lib/takvim-kilidi";
import { DONEM_DURUMLARI, KULUP_DURUMLARI } from "@/lib/durumlar";
import type { EylemDurumu } from "@/lib/formlar";
import type { MufredatHedefi } from "./actions";

/**
 * Programın bir atölyesini başka atölyeyle değiştirir.
 *
 * "Atölye çıkarma" bilerek yok: dönemde tam 5, kulüpte tam 3 atölye kuralı
 * (§13.3, §13.6) sayıyı sabit tutar; olabilecek tek şey DEĞİŞTİRMEKTİR.
 * Şemadaki uyarının kapandığı yer burası: eski atölyenin müfredat girdileri
 * ve rapor içerik paragrafı bu eylemde birlikte silinir, sahipsiz satır
 * kalmaz.
 *
 * Mevcut oturumlar yeni atölyeye TAŞINIR (tarih ve hafta korunur): gruplar
 * kurulmuş, takvim işliyor; oturumları silip yeniden üretmek kayıt ve telafi
 * geçmişini bozardı. PUANLANMIŞ ATÖLYE DEĞİŞTİRİLEMEZ — puan, eski atölyenin
 * sorularına verilmiş cevaplar taşır; oturumun türünü değiştirmek o cevapları
 * başka atölyenin formuna iliştirirdi. Kontrol ile yazma arasına puan kaydı
 * girmesin diye bütün gruplar takvim kilidi altına alınır (takvim-eylemleri
 * gerekçesi).
 *
 * Öğretmen adı sıfırlanır: ad atölyenin öğretmenine aitti, atölye değişti.
 */
export async function programAtolyesiniDegistir(
  hedef: MufredatHedefi,
  programAtolyeId: string,
  yeniAtolyeTipiId: string,
): Promise<EylemDurumu> {
  // Bu bir yapı değişikliği; müfredat yetkisi yetmez, programın modül
  // yetkisi gerekir.
  await yonetimZorunlu(hedef.tur === "donem" ? "donemler" : "kulupler", "TAM");

  const program = await programOku(hedef);
  if (!program) return { hata: "Program bulunamadı." };
  if (program.kilitSebebi) return { hata: program.kilitSebebi };

  const satir = program.atolyeler.find((a) => a.id === programAtolyeId);
  if (!satir) return { hata: "Atölye satırı bulunamadı." };

  if (program.atolyeler.some((a) => a.workshopTypeId === yeniAtolyeTipiId)) {
    return { hata: "Seçilen atölye bu programda zaten var." };
  }

  const yeniAtolye = await db.workshopType.findFirst({
    where: { id: yeniAtolyeTipiId, active: true },
    select: { name: true },
  });
  if (!yeniAtolye) {
    return { hata: "Seçilen atölye mevcut değil veya pasife alınmış." };
  }

  const grupIdleri = program.grupIdleri;

  const sonuc = await db.$transaction(async (tx) => {
    for (const grupId of grupIdleri) await takvimKilidiAl(tx, grupId);

    // şube-muaf: program iki şubede ortak; diğer şubenin puanlaması da
    // atölyeyi değiştirilmekten korumalı, sayım bilerek bütün grupları
    // kapsıyor.
    const puanlamaSayisi = await tx.score.count({
      where: {
        session: {
          groupId: { in: [...grupIdleri] },
          workshopTypeId: satir.workshopTypeId,
        },
      },
    });
    if (puanlamaSayisi > 0) {
      return {
        hata: `"${satir.ad}" atölyesinde ${puanlamaSayisi} puanlama girilmiş; atölye değiştirilemez. Değerlendirilmiş bir atölyenin geçmişi korunur.`,
      };
    }

    // şube-muaf: atölye değişikliği programın BÜTÜN gruplarının oturumlarına
    // uygulanır (iki şube aynı programı aynı atölyelerle işler).
    const oturumlar =
      grupIdleri.length > 0
        ? await tx.session.updateMany({
            where: {
              groupId: { in: [...grupIdleri] },
              workshopTypeId: satir.workshopTypeId,
            },
            data: { workshopTypeId: yeniAtolyeTipiId },
          })
        : { count: 0 };

    if (hedef.tur === "donem") {
      await tx.termWorkshop.update({
        where: { id: programAtolyeId },
        data: { workshopTypeId: yeniAtolyeTipiId, teacherName: null },
      });
    } else {
      await tx.clubWorkshop.update({
        where: { id: programAtolyeId },
        data: { workshopTypeId: yeniAtolyeTipiId, teacherName: null },
      });
    }

    // Eski atölyenin programa özgü içeriği: haftalık konular ve rapor
    // paragrafı yeni atölyeye ait olamaz, ikisi de silinir.
    const hedefAnahtari =
      hedef.tur === "donem"
        ? { termId: hedef.id }
        : { clubId: hedef.id };
    const mufredat = await tx.curriculumEntry.deleteMany({
      where: { ...hedefAnahtari, workshopTypeId: satir.workshopTypeId },
    });
    await tx.atolyeIcerigi.deleteMany({
      where: { ...hedefAnahtari, workshopTypeId: satir.workshopTypeId },
    });

    return { oturum: oturumlar.count, mufredat: mufredat.count };
  });

  if ("hata" in sonuc) return sonuc;

  const kok = hedef.tur === "donem" ? "donemler" : "kulupler";
  revalidatePath(`/koordinator/${kok}/${hedef.id}`);
  revalidatePath(`/koordinator/${kok}/${hedef.id}/mufredat`);
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator/puanlamalar");
  revalidatePath("/koordinator");

  const mufredatNotu =
    sonuc.mufredat > 0
      ? ` Eski atölyenin ${sonuc.mufredat} müfredat girdisi silindi.`
      : "";
  return {
    basari: `"${satir.ad}" → "${yeniAtolye.name}" olarak değiştirildi; ${sonuc.oturum} oturum yeni atölyeye taşındı.${mufredatNotu} Öğretmen adını müfredat sayfasından yeniden girin.`,
  };
}

type OkunanProgram = {
  atolyeler: { id: string; workshopTypeId: string; ad: string }[];
  grupIdleri: string[];
  kilitSebebi: string | null;
};

async function programOku(hedef: MufredatHedefi): Promise<OkunanProgram | null> {
  if (hedef.tur === "donem") {
    // şube-muaf: değişiklik programın bütün gruplarına uygulanacağı için
    // grup listesi bilerek süzgeçsiz (kilit ve toplu güncelleme kapsamı).
    const donem = await db.term.findUnique({
      where: { id: hedef.id },
      select: {
        status: true,
        workshops: {
          select: {
            id: true,
            workshopTypeId: true,
            workshopType: { select: { name: true } },
          },
        },
        // Kilit sırası tutarlı olsun diye gruplar hep aynı sırayla okunur.
        groups: { orderBy: { id: "asc" }, select: { id: true } },
      },
    });
    if (!donem) return null;
    return {
      atolyeler: donem.workshops.map((w) => ({
        id: w.id,
        workshopTypeId: w.workshopTypeId,
        ad: w.workshopType.name,
      })),
      grupIdleri: donem.groups.map((g) => g.id),
      kilitSebebi:
        donem.status === "TAMAMLANDI" || donem.status === "ARSIVLENDI"
          ? `Bu dönem "${DONEM_DURUMLARI[donem.status].etiket}" durumunda; atölyeleri değiştirilemez.`
          : null,
    };
  }

  // şube-muaf: değişiklik programın bütün gruplarına uygulanacağı için grup
  // listesi bilerek süzgeçsiz (kilit ve toplu güncelleme kapsamı).
  const kulup = await db.club.findUnique({
    where: { id: hedef.id },
    select: {
      status: true,
      workshops: {
        select: {
          id: true,
          workshopTypeId: true,
          workshopType: { select: { name: true } },
        },
      },
      groups: { orderBy: { id: "asc" }, select: { id: true } },
    },
  });
  if (!kulup) return null;
  return {
    atolyeler: kulup.workshops.map((w) => ({
      id: w.id,
      workshopTypeId: w.workshopTypeId,
      ad: w.workshopType.name,
    })),
    grupIdleri: kulup.groups.map((g) => g.id),
    kilitSebebi:
      kulup.status === "TASLAK" || kulup.status === "KAYIT_ALIYOR"
        ? null
        : `Bu kulüp "${KULUP_DURUMLARI[kulup.status].etiket}" durumunda; atölyeleri değiştirilemez.`,
  };
}
