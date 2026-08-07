"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";
import { kayitEngeli } from "@/lib/kayit-kurallari";
import { tarihCozumle } from "@/lib/tarih";
import {
  alanHatalari,
  formDegerleri,
  type EylemDurumu,
} from "@/lib/formlar";
export type { EylemDurumu };
import {
  OGRENCI_FORM_ALANLARI,
  formdanOku,
  ogrenciSemasi,
  type OgrenciGirdisi,
} from "./sema";


/** Öğrencinin ana bilgilerini veritabanı biçimine çevirir. */
function ogrenciAlanlari(veri: OgrenciGirdisi) {
  return {
    firstName: veri.firstName,
    lastName: veri.lastName,
    birthDate: veri.birthDate ? tarihCozumle(veri.birthDate) : null,
    school: veri.school,
    grade: veri.grade,
    notes: veri.notes,
    // §6.2 — Arama bu sütun üzerinden yapılır; her yazımda tazelenir.
    searchName: normalizeArama(`${veri.firstName} ${veri.lastName}`),
  };
}

function saglikAlanlari(veri: OgrenciGirdisi) {
  return {
    allergies: veri.alerji,
    medications: veri.ilac,
    specialEducation: veri.ozelEgitim,
    healthNotes: veri.saglikNotu,
    emergencyInfo: veri.acilDurum,
    internSafetyNote: veri.stajyerUyarisi,
  };
}

/** Girilen ebeveynleri satır listesine çevirir; boş bırakılan ebeveyn yazılmaz. */
function veliSatirlari(veri: OgrenciGirdisi) {
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
      searchPhone: veri.anneTelefon
        ? normalizeTelefon(veri.anneTelefon)
        : null,
    });
  }

  if (veri.babaAdi) {
    veliler.push({
      type: "BABA",
      fullName: veri.babaAdi,
      phone: veri.babaTelefon,
      searchPhone: veri.babaTelefon
        ? normalizeTelefon(veri.babaTelefon)
        : null,
    });
  }

  return veliler;
}

/**
 * §7.1 — Yeni öğrenci. Form isteğe bağlı olarak bir program grubu da
 * taşıyabilir; o zaman öğrenci ve kaydı TEK işlemde açılır.
 *
 * Tek işlem olması önemli: önce öğrenciyi yazıp sonra kaydı denemek, kontenjan
 * dolduğunda ya da dönem kayıt almayı kapattığında ortada sahipsiz bir öğrenci
 * bırakırdı. Koordinatör de hata mesajını gördüğünde öğrencinin kaydedilip
 * kaydedilmediğini bilemezdi. Bu yüzden grup kontrolü başarısızsa hiçbir şey
 * yazılmıyor ve form girilen değerlerle geri geliyor.
 */
export async function ogrenciEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("ogrenciler", "TAM");
  const subeId = kullanici.aktifSubeId;

  const cozumlenen = ogrenciSemasi.safeParse(formdanOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, OGRENCI_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const groupId = String(formVerisi.get("groupId") ?? "");

  const ogrenciVerisi = {
    ...ogrenciAlanlari(veri),
    branchId: subeId,
    guardians: { create: veliSatirlari(veri) },
    healthInfo: { create: saglikAlanlari(veri) },
  };

  if (!groupId) {
    // şube-muaf: `ogrenciVerisi` içinde `branchId: subeId` yazılı; öğrenci
    // oturumdaki şubeye açılıyor.
    const ogrenci = await db.student.create({ data: ogrenciVerisi });

    revalidatePath("/koordinator/ogrenciler");
    redirect(`/koordinator/ogrenciler/${ogrenci.id}`);
  }

  // Kontenjan okuma ile yazma arasında kaymasın diye kayıt akışıyla aynı kilit.
  const sonuc = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${"kayit:" + groupId}))::text
        AS "kilit"
    `;

    const grup = await tx.group.findFirst({
      where: { id: groupId, branchId: subeId },
      include: {
        term: { select: { status: true } },
        club: { select: { status: true } },
        _count: { select: { enrollments: { where: { status: "AKTIF" } } } },
      },
    });

    if (!grup) return { alanHatalari: { groupId: "Grup bulunamadı." } };

    const engel = kayitEngeli(grup);
    if (engel) return { alanHatalari: { groupId: engel } };

    // şube-muaf: `ogrenciVerisi` içinde `branchId: subeId` yazılı.
    const ogrenci = await tx.student.create({ data: ogrenciVerisi });

    await tx.enrollment.create({
      data: { studentId: ogrenci.id, groupId },
    });

    return { ogrenciId: ogrenci.id, termId: grup.termId, clubId: grup.clubId };
  });

  if (!("ogrenciId" in sonuc)) {
    return {
      ...sonuc,
      degerler: formDegerleri(formVerisi, OGRENCI_FORM_ALANLARI),
    };
  }

  revalidatePath("/koordinator/ogrenciler");
  revalidatePath("/koordinator/kayitlar");
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator");
  if (sonuc.termId) revalidatePath(`/koordinator/donemler/${sonuc.termId}`);
  if (sonuc.clubId) revalidatePath(`/koordinator/kulupler/${sonuc.clubId}`);
  redirect(`/koordinator/ogrenciler/${sonuc.ogrenciId}`);
}

/**
 * Öğrenciyi kalıcı siler — yalnızca hiç iz bırakmamışsa.
 *
 * Sistem öğrenciyi silmek üzere tasarlanmadı: değerlendirme geçmişi çocuğa
 * bağlı ve geriye dönük okunabilir olmalı, PDF raporu olan bir öğrenci
 * veritabanı seviyesinde zaten silinemiyor (`ReportPdf` → `Restrict`).
 * Buna karşılık deneme aşamasında yanlış eklenen öğrenciyi temizlemenin bir
 * yolu yoktu ve elle veritabanına girmek gerekiyordu.
 *
 * Sınır bu yüzden veriye bakarak çiziliyor: puanlaması veya raporu olan
 * öğrenci silinmez, sebebi söylenir. Kalanlar (yeni eklenmiş, henüz
 * puanlanmamış öğrenci) veli ve sağlık satırlarıyla birlikte gider; varsa
 * kayıtları da düşer, çünkü puanlaması olmayan bir kaydın taşıdığı bilgi yok.
 *
 * Kontrol ile silme aynı işlemde: arada girilen bir puanlamanın sessizce
 * silinmesi bu ekranda kabul edilemez bir kayıp olurdu.
 */
export async function ogrenciSil(ogrenciId: string): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("ogrenciler", "TAM");
  const subeId = kullanici.aktifSubeId;

  type SilmeSonucu =
    | { silindi: false; hata: string }
    | { silindi: true; ad: string };

  const sonuc = await db.$transaction(async (tx): Promise<SilmeSonucu> => {
    const ogrenci = await tx.student.findFirst({
      where: { id: ogrenciId, branchId: subeId },
      select: {
        firstName: true,
        lastName: true,
        _count: {
          select: {
            reports: true,
            counselingSessions: true,
            parentMeetings: true,
            intelligenceTests: true,
          },
        },
        enrollments: { select: { _count: { select: { scores: true } } } },
      },
    });

    if (!ogrenci) return { silindi: false, hata: "Öğrenci bulunamadı." };

    const ad = `${ogrenci.firstName} ${ogrenci.lastName}`;
    const puanlamaSayisi = ogrenci.enrollments.reduce(
      (toplam, kayit) => toplam + kayit._count.scores,
      0,
    );

    if (puanlamaSayisi > 0) {
      return {
        silindi: false,
        hata: `${ad} silinemez: ${puanlamaSayisi} puanlaması var ve bu geçmiş korunmalı. Öğrenciyi programdan çıkarmak için kaydını iptal edin.`,
      };
    }

    if (ogrenci._count.reports > 0) {
      return {
        silindi: false,
        hata: `${ad} silinemez: üretilmiş ${ogrenci._count.reports} raporu var.`,
      };
    }

    // Görüşme notu da puanlama gibi korunması gereken geçmiş — hatta daha
    // hassas. Görüşmesi olan öğrenci "yanlışlıkla eklenmiş" olamaz.
    if (ogrenci._count.counselingSessions > 0) {
      return {
        silindi: false,
        hata: `${ad} silinemez: ${ogrenci._count.counselingSessions} görüşme kaydı var ve bu geçmiş korunmalı.`,
      };
    }

    if (ogrenci._count.parentMeetings > 0) {
      return {
        silindi: false,
        hata: `${ad} silinemez: ${ogrenci._count.parentMeetings} veli görüşmesi kaydı var ve bu geçmiş korunmalı.`,
      };
    }

    if (ogrenci._count.intelligenceTests > 0) {
      return {
        silindi: false,
        hata: `${ad} silinemez: ${ogrenci._count.intelligenceTests} zeka testi belgesi var ve bu geçmiş korunmalı.`,
      };
    }

    // Şube kontrolü silmenin KENDİ where'inde — `ogrenciGuncelle`deki desenle
    // aynı. Veli, sağlık ve kayıt satırları şemadaki Cascade ile düşüyor.
    const silinen = await tx.student.deleteMany({
      where: { id: ogrenciId, branchId: subeId },
    });

    if (silinen.count === 0) {
      return { silindi: false, hata: "Öğrenci bulunamadı." };
    }

    return { silindi: true, ad };
  });

  if (!sonuc.silindi) return { hata: sonuc.hata };

  revalidatePath("/koordinator/ogrenciler");
  revalidatePath("/koordinator/kayitlar");
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator/donemler");
  revalidatePath("/koordinator/kulupler");
  revalidatePath("/koordinator");
  redirect(`/koordinator/ogrenciler?silinen=${encodeURIComponent(sonuc.ad)}`);
}

export async function ogrenciGuncelle(
  ogrenciId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("ogrenciler", "TAM");

  const cozumlenen = ogrenciSemasi.safeParse(formdanOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, OGRENCI_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const veliler = veliSatirlari(veri);

  // Şube kontrolü güncellemenin KENDİ where'inde ve transaction'ın İÇİNDE:
  // `updateMany` + sayı kontrolü deseni, ayrı bir "önce oku sonra yaz"
  // adımının bıraktığı yarış koşulunu bırakmıyor. Sıfır satır güncellendiyse
  // öğrenci ya yok ya da başka şubenin — o hâlde veli ve sağlık satırlarına
  // da dokunulmadan işlem geri alınır.
  const bulundu = await db.$transaction(async (tx) => {
    const sonuc = await tx.student.updateMany({
      where: { id: ogrenciId, branchId: kullanici.aktifSubeId },
      data: ogrenciAlanlari(veri),
    });

    if (sonuc.count === 0) return false;

    // Veliler silinip yeniden yazılıyor: iki satırlık bir liste için tek tek
    // fark hesaplamaktan hem daha kısa hem daha az hata açık.
    await tx.guardian.deleteMany({ where: { studentId: ogrenciId } });
    if (veliler.length > 0) {
      await tx.guardian.createMany({
        data: veliler.map((veli) => ({ ...veli, studentId: ogrenciId })),
      });
    }

    await tx.healthInfo.upsert({
      where: { studentId: ogrenciId },
      update: saglikAlanlari(veri),
      create: { studentId: ogrenciId, ...saglikAlanlari(veri) },
    });

    return true;
  });

  if (!bulundu) return { hata: "Öğrenci bulunamadı." };

  revalidatePath("/koordinator/ogrenciler");
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
  return { basari: "Öğrenci bilgileri güncellendi." };
}
