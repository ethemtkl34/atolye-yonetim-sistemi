"use server";

import { revalidatePath } from "next/cache";
import { subeliOturum } from "@/lib/yetki-kapisi";
import { db } from "@/lib/db";
import { cevapCozumle } from "@/lib/puanlama";
import { bugun, tarihBicimle } from "@/lib/tarih";
import {
  DONEM_ETIKETLERI,
  GELISIM_SORULARI,
  gelisimPencereleri,
  type GelisimCevabi,
} from "@/lib/gelisim-degerlendirmesi";
import type { AssessmentPeriod } from "@/generated/prisma/enums";
import type { EylemDurumu } from "@/lib/formlar";

/**
 * Gelişim testinin kaydedilmesi.
 *
 * `puanlamaKaydet` ile aynı güven modeli: hangi soruların cevaplanacağı
 * istemcinin gönderdiği alanlardan değil, sunucudaki sabit soru listesinden
 * çıkarılır; 18 sorunun tamamı zorunludur ("Değerlendirilemedi" de bir
 * cevaptır). Yetki de aynı kapıdan geçer: stajyer yalnızca kendisine atanmış
 * öğrenciyi, puanlama modülünde TAM yetkisi olan yönetim rolleri herkesi
 * doldurabilir (§10.5).
 */

export type GelisimEylemDurumu = EylemDurumu & {
  /** Cevaplanmadığı için işaretlenecek soru anahtarları. */
  eksikSatirlar?: string[];
};

export async function gelisimKaydet(
  _oncekiDurum: GelisimEylemDurumu,
  formVerisi: FormData,
): Promise<GelisimEylemDurumu> {
  const kullanici = await subeliOturum();
  const subeId = kullanici.aktifSubeId;

  const stajyerMi = kullanici.roller.includes("STAJYER");
  if (!stajyerMi && kullanici.yetkiler.puanlamalar !== "TAM") {
    return { hata: "Gelişim testi doldurma yetkiniz yok." };
  }

  const kayitId = String(formVerisi.get("kayitId") ?? "");
  const donemHam = String(formVerisi.get("donem") ?? "");
  if (!kayitId || (donemHam !== "DONEM_ORTASI" && donemHam !== "DONEM_SONU")) {
    return { hata: "Form eksik gönderildi." };
  }
  const donem = donemHam as AssessmentPeriod;

  // Kayıt şubeye kapalı okunur; test yalnızca dönem kayıtları için var.
  const kayit = await db.enrollment.findFirst({
    where: { id: kayitId, group: { branchId: subeId, termId: { not: null } } },
    select: {
      id: true,
      status: true,
      internId: true,
      studentId: true,
      group: {
        select: {
          term: {
            select: {
              weeks: {
                orderBy: { weekNumber: "asc" },
                select: { weekNumber: true, date: true },
              },
            },
          },
        },
      },
    },
  });

  if (!kayit) return { hata: "Kayıt bulunamadı." };

  // §3.2 — Stajyer yalnızca kendisine atanmış öğrenciyi değerlendirir.
  if (stajyerMi && kayit.internId !== kullanici.id) {
    return { hata: "Bu öğrenci size atanmamış." };
  }

  if (kayit.status !== "AKTIF") {
    return { hata: "Bu kayıt iptal edilmiş; gelişim testi doldurulamaz." };
  }

  // Zaman kapısı — gözlenmemiş dönem değerlendirilmez (oturum kilidi ilkesi).
  const pencere = gelisimPencereleri(
    kayit.group.term?.weeks ?? [],
    bugun(),
  )[donem];
  if (!pencere.acik) {
    return {
      hata: `${DONEM_ETIKETLERI[donem]} testi ${
        pencere.acilisTarihi ? tarihBicimle(pencere.acilisTarihi) : "ileride"
      } tarihinde açılır; henüz doldurulamaz.`,
    };
  }

  const eksikSatirlar: string[] = [];
  const cevaplar: GelisimCevabi[] = [];

  for (const soru of GELISIM_SORULARI) {
    const cozum = cevapCozumle(formVerisi.get(`cevap:${soru.anahtar}`));

    if (!cozum.gecerli) {
      eksikSatirlar.push(soru.anahtar);
      continue;
    }

    // Soru alanları o günkü hâliyle donar (questionTextSnapshot ilkesi).
    cevaplar.push({
      anahtar: soru.anahtar,
      kategori: soru.kategori,
      baslik: soru.baslik,
      soruMetni: soru.metin,
      deger: cozum.deger,
    });
  }

  if (eksikSatirlar.length > 0) {
    return {
      hata: `Bütün sorular cevaplanmalı. ${eksikSatirlar.length} soru eksik.`,
      eksikSatirlar,
    };
  }

  await db.developmentAssessment.upsert({
    where: { enrollmentId_period: { enrollmentId: kayitId, period: donem } },
    create: {
      enrollmentId: kayitId,
      period: donem,
      answersJson: cevaplar as unknown as object,
      filledByUserId: kullanici.id,
    },
    update: {
      answersJson: cevaplar as unknown as object,
      filledByUserId: kullanici.id,
    },
  });

  ekranlariTazele(kayit.studentId, kayitId, donem);
  return {
    basari: `${DONEM_ETIKETLERI[donem]} gelişim testi kaydedildi.`,
  };
}

function ekranlariTazele(
  ogrenciId: string,
  kayitId: string,
  donem: AssessmentPeriod,
) {
  revalidatePath("/stajyer/gelisim");
  revalidatePath(`/stajyer/gelisim/${kayitId}/${donem}`);
  revalidatePath(`/koordinator/gelisim/${kayitId}/${donem}`);
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
}
