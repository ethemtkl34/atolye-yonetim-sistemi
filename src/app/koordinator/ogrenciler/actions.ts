"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";
import { tarihCozumle } from "@/lib/tarih";
import { formDegerleri } from "@/lib/formlar";
import {
  OGRENCI_FORM_ALANLARI,
  formdanOku,
  ogrenciSemasi,
  type OgrenciGirdisi,
} from "./sema";

export type EylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
  /** Doğrulama hatasında girilen değerler — form sıfırlanınca geri yazılır. */
  degerler?: Record<string, string>;
};

function alanHatalari(hata: ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path.join(".");
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message;
  }
  return sonuc;
}

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

export async function ogrenciEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const cozumlenen = ogrenciSemasi.safeParse(formdanOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, OGRENCI_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;

  const ogrenci = await db.student.create({
    data: {
      ...ogrenciAlanlari(veri),
      guardians: { create: veliSatirlari(veri) },
      healthInfo: { create: saglikAlanlari(veri) },
    },
  });

  revalidatePath("/koordinator/ogrenciler");
  redirect(`/koordinator/ogrenciler/${ogrenci.id}`);
}

export async function ogrenciGuncelle(
  ogrenciId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const cozumlenen = ogrenciSemasi.safeParse(formdanOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, OGRENCI_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const veliler = veliSatirlari(veri);

  await db.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: ogrenciId },
      data: ogrenciAlanlari(veri),
    });

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
  });

  revalidatePath("/koordinator/ogrenciler");
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
  return { basari: "Öğrenci bilgileri güncellendi." };
}
