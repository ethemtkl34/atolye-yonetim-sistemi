"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { veliBaglariniYaz } from "@/lib/veli";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";
import { tarihCozumle } from "@/lib/tarih";
import { alanHatalari, formDegerleri, type EylemDurumu } from "@/lib/formlar";
import {
  DANISAN_FORM_ALANLARI,
  danisanFormdanOku,
  danisanSemasi,
  type DanisanGirdisi,
} from "./danisan-sema";

/**
 * Danışan başvurusu — atölyeye bağlı olmayan terapi kaydı.
 *
 * İki giriş: çocuk sistemde yoksa öğrenci ve başvuru TEK işlemde açılır
 * ("yeni"); zaten kayıtlıysa yalnızca başvuru yazılır ("mevcut"). İkincisi
 * atölyeden terapiye geçen çocuğun yolu — kimlik bilgileri sorulmaz, çünkü
 * onlar öğrenci kaydında zaten var ve orada güncellenir.
 *
 * Başvuru öğrenci başına TEKTİR (`studentId @unique`) ve üzerine yazılabilir:
 * terapi dosyasının kapağı, seans kaydı değil. Aynı eylem hem ilk kaydı hem
 * güncellemeyi yapar (upsert) — form da tek.
 *
 * GİZLİLİK: sağlık bilgisi kuralı — `danismanlik` modülü TAM ister; stajyer ve
 * danışma görevlisi bu eyleme hiçbir ekrandan ulaşamaz. Yeni öğrenci açmak
 * ayrıca `ogrenciler` yetkisi istiyor: başvuru penceresi bir öğrenci kayıt
 * kapısına dönüşmemeli.
 */

export type DanisanEylemDurumu = EylemDurumu;

/** Başvurunun kendi alanları — öğrenciden bağımsız kısım. */
function basvuruAlanlari(veri: DanisanGirdisi) {
  return {
    therapyType: veri.terapiTuru,
    reason: veri.basvuruNedeni,
    referredBy: veri.yonlendiren,
    previousSupport: veri.oncekiDestek,
    diagnosis: veri.tani,
    siblings: veri.kardesler,
    livesWith: veri.birlikteYasadiklari,
    parentStatus: veri.ebeveynDurumu,
    familyHistory: veri.ailedeRuhsalOyku,
    motherEducation: veri.anneEgitim,
    motherOccupation: veri.anneMeslek,
    fatherEducation: veri.babaEgitim,
    fatherOccupation: veri.babaMeslek,
  };
}

/** Girilen ebeveynleri satır listesine çevirir (öğrenci formundaki desen). */
function veliGirdileri(veri: DanisanGirdisi) {
  const veliler: {
    type: "ANNE" | "BABA";
    fullName: string;
    phone: string | null;
    searchPhone: string | null;
  }[] = [];

  if (veri.anneAdi) {
    veliler.push({
      type: "ANNE",
      fullName: veri.anneAdi,
      phone: veri.anneTelefon,
      searchPhone: veri.anneTelefon ? normalizeTelefon(veri.anneTelefon) : null,
    });
  }
  if (veri.babaAdi) {
    veliler.push({
      type: "BABA",
      fullName: veri.babaAdi,
      phone: veri.babaTelefon,
      searchPhone: veri.babaTelefon ? normalizeTelefon(veri.babaTelefon) : null,
    });
  }

  return veliler;
}

function tazele(ogrenciId: string) {
  revalidatePath("/koordinator/danismanlik");
  revalidatePath("/koordinator/ogrenciler");
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
}

export async function danisanBasvurusuKaydet(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("danismanlik", "TAM");
  const subeId = kullanici.aktifSubeId;

  const cozumlenen = danisanSemasi.safeParse(danisanFormdanOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, DANISAN_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const girilenler = formDegerleri(formVerisi, DANISAN_FORM_ALANLARI);

  // İlaç bilgisi başvuruda değil sağlık kaydında yaşıyor: aynı bilgi öğrenci
  // düzenleme ekranında da sorulan alan, iki yerde tutulursa ayrışır.
  const ilacGirildi = veri.ilac !== null;

  if (veri.mod === "mevcut") {
    const ogrenci = await db.student.findFirst({
      where: { id: veri.ogrenciId ?? "", branchId: subeId },
      select: { id: true },
    });
    if (!ogrenci) return { hata: "Öğrenci bulunamadı." };

    await db.$transaction(async (tx) => {
      await tx.therapyIntake.upsert({
        where: { studentId: ogrenci.id },
        update: basvuruAlanlari(veri),
        create: {
          studentId: ogrenci.id,
          ...basvuruAlanlari(veri),
          createdByUserId: kullanici.id,
        },
      });

      // Boş bırakılan ilaç alanı mevcut sağlık kaydını SİLMEZ: başvuruyu
      // dolduran kişi sağlık sekmesini görmüyor, boş bırakması "ilaç yok"
      // demek değil "bilmiyorum" demek olabilir.
      if (ilacGirildi) {
        await tx.healthInfo.upsert({
          where: { studentId: ogrenci.id },
          update: { medications: veri.ilac },
          create: { studentId: ogrenci.id, medications: veri.ilac },
        });
      }
    });

    tazele(ogrenci.id);
    return { basari: "Danışan başvurusu kaydedildi." };
  }

  // --- "yeni" modu: öğrenci + başvuru tek işlemde ---
  if (kullanici.yetkiler.ogrenciler !== "TAM") {
    return {
      hata: "Yeni öğrenci açma yetkiniz yok; kayıtlı bir öğrenci seçin.",
      degerler: girilenler,
    };
  }

  // Öğrenci, başvuru ve veli bağları tek işlemde (bkz. lib/veli.ts).
  const ogrenci = await db.$transaction(async (tx) => {
    const kayit = await tx.student.create({
      data: {
        firstName: veri.firstName ?? "",
        lastName: veri.lastName ?? "",
        birthDate: veri.birthDate ? tarihCozumle(veri.birthDate) : null,
        school: veri.school,
        grade: veri.grade,
        searchName: normalizeArama(`${veri.firstName} ${veri.lastName}`),
        // şube-muaf: öğrenci oturumdaki şubeye açılıyor.
        branchId: subeId,
        ...(ilacGirildi
          ? { healthInfo: { create: { medications: veri.ilac } } }
          : {}),
        therapyIntake: {
          create: { ...basvuruAlanlari(veri), createdByUserId: kullanici.id },
        },
      },
      select: { id: true },
    });

    await veliBaglariniYaz(tx, {
      subeId,
      ogrenciId: kayit.id,
      girdiler: veliGirdileri(veri),
    });

    return kayit;
  });

  tazele(ogrenci.id);
  return { basari: "Danışan öğrenci ve başvurusu kaydedildi." };
}
