"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { kontenjanDurumu } from "@/lib/scoring";
import { grupZamani } from "@/lib/tarih";

/** §7 — Öğrenci kayıt akışı ve stajyer ataması. */

export type EylemDurumu = {
  basari?: string;
  hata?: string;
  /**
   * §7.4 — Çakışma uyarısı. Uyarı işlemi ENGELLEMEZ; koordinatör gerekli
   * görürse `onaylandi` işaretiyle aynı formu tekrar gönderip devam eder.
  */
  uyari?: string;
  uyariGroupId?: string;
  alanHatalari?: Record<string, string>;
};

const kayitSemasi = z.object({
  studentId: z.string().min(1, "Öğrenci seçin"),
  groupId: z.string().min(1, "Grup seçin"),
  internId: z.string().min(1, "Sorumlu stajyer seçin"),
});

/**
 * "Kayıt almıyor" hatasını çıkmaza dönüştürmeden açıklar. Devam eden döneme
 * grup eklenebilir (§13.5) ama kayıt ancak dönem "Kayıt alıyor" durumundayken
 * açılır; koordinatöre bir sonraki adım söylenmezse bu bir çıkmaz gibi
 * görünüyordu.
 */
function kayitKapaliMesaji(term: { status: string } | null): string {
  if (term?.status === "DEVAM_EDIYOR") {
    return 'Dönem devam ediyor ancak yeni kayıt kapalı. Kayıt almak için dönem sayfasından durumu "Kayıt alıyor" yapın.';
  }
  return "Bu program şu anda kayıt almıyor.";
}

export async function kayitOlustur(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const cozumlenen = kayitSemasi.safeParse({
    studentId: formVerisi.get("studentId"),
    groupId: formVerisi.get("groupId"),
    internId: formVerisi.get("internId"),
  });

  if (!cozumlenen.success) {
    const hatalar: Record<string, string> = {};
    for (const sorun of cozumlenen.error.issues) {
      const alan = sorun.path.join(".");
      if (alan && !hatalar[alan]) hatalar[alan] = sorun.message;
    }
    return { alanHatalari: hatalar };
  }

  const { studentId, groupId, internId } = cozumlenen.data;
  const onaylandi = formVerisi.get("onaylandi") === "1";

  const grup = await db.group.findUnique({
    where: { id: groupId },
    include: {
      term: {
        select: {
          name: true,
          status: true,
          interns: { select: { userId: true } },
        },
      },
      club: { select: { name: true, status: true } },
      _count: { select: { enrollments: { where: { status: "AKTIF" } } } },
    },
  });

  if (!grup) return { hata: "Grup bulunamadı." };
  if (!grup.active) {
    return { hata: "Bu grup kapalı; yeni kayıt alınamaz." };
  }
  if (
    grup.term?.status !== "KAYIT_ALIYOR" &&
    grup.club?.status !== "KAYIT_ALIYOR"
  ) {
    return { hata: kayitKapaliMesaji(grup.term) };
  }

  // Aynı öğrenci aynı gruba iki kez kaydedilemez.
  const zatenKayitli = await db.enrollment.findUnique({
    where: { studentId_groupId: { studentId, groupId } },
    select: { status: true },
  });

  if (zatenKayitli) {
    return {
      hata:
        zatenKayitli.status === "AKTIF"
          ? "Bu öğrenci zaten bu gruba kayıtlı."
          : "Bu öğrencinin bu grupta iptal edilmiş bir kaydı var. Yeni kayıt yerine mevcut kaydı yeniden etkinleştirin.",
    };
  }

  /**
   * Kontenjan dolu grupta kayıt engelleniyor.
   *
   * Şartname bunu açıkça yasaklamıyor ama §2.3 kontenjan dolduğunda "yeni grup
   * açılabilir" diyor; aşılabilen bir kontenjanın anlamı kalmazdı. Engellerken
   * çözüm yolu da söyleniyor.
   */
  const kontenjan = kontenjanDurumu(grup.capacity, grup._count.enrollments);
  if (kontenjan.dolu) {
    return {
      hata: `"${grup.name}" grubunun kontenjanı dolu (${kontenjan.doluluk}/${kontenjan.kapasite}). Aynı programa yeni bir grup ekleyip oraya kaydedebilirsiniz.`,
    };
  }

  /**
   * §7.4 — Çakışma kontrolü.
   *
   * Aynı gün ve zaman diliminde başka aktif kaydı varsa koordinatöre uyarı
   * gösterilir. Sistem işlemi ENGELLEMEZ: koordinatör gerekli görürse devam
   * edebilir. Bu yüzden uyarı bir hata değil, onay isteyen bir duraktır.
   */
  if (!onaylandi) {
    const cakisanlar = await db.enrollment.findMany({
      where: {
        studentId,
        status: "AKTIF",
        group: { day: grup.day, timeSlot: grup.timeSlot },
      },
      include: {
        group: {
          include: {
            term: { select: { name: true } },
            club: { select: { name: true } },
          },
        },
      },
    });

    if (cakisanlar.length > 0) {
      const adlar = cakisanlar
        .map((kayit) => {
          const program =
            kayit.group.term?.name ?? kayit.group.club?.name ?? "Program";
          return `${program} — ${kayit.group.name}`;
        })
        .join(", ");

      return {
        uyari: `Bu öğrencinin ${grupZamani(grup.day, grup.timeSlot).toLocaleLowerCase("tr-TR")} zaman diliminde başka aktif kaydı var: ${adlar}. Devam etmek isterseniz kaydı yine de oluşturabilirsiniz.`,
        uyariGroupId: groupId,
      };
    }
  }

  const stajyer = await db.user.findUnique({
    where: { id: internId },
    select: { role: true, active: true },
  });

  if (!stajyer || stajyer.role !== "STAJYER" || !stajyer.active) {
    return { alanHatalari: { internId: "Geçerli bir stajyer seçin." } };
  }

  /**
   * Dönemin stajyer kadrosu tanımlıysa sorumlu stajyer kadrodan olmalı.
   * Kadro boşsa kısıt yok; kulüp kayıtlarında da kadro kavramı yok.
   */
  if (
    grup.term &&
    grup.term.interns.length > 0 &&
    !grup.term.interns.some((kadro) => kadro.userId === internId)
  ) {
    return {
      alanHatalari: {
        internId: `Bu stajyer "${grup.term.name}" döneminin kadrosunda değil. Önce dönem sayfasından kadroya ekleyin.`,
      },
    };
  }

  /**
   * Kontenjan kontrolü ile kayıt ekleme aynı kritik bölümde yapılır.
   *
   * İki koordinatör son boş yere aynı anda öğrenci eklerse, yalnızca
   * transaction kullanmak PostgreSQL'in varsayılan izolasyonunda yeterli
   * değildir: ikisi de eski sayacı okuyabilir. Grup kimliğine bağlı transaction
   * advisory lock aynı gruptaki kayıtları sıraya alır; farklı gruplar birbirini
   * bekletmez.
   */
  const sonuc = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${"kayit:" + groupId}))::text
        AS "kilit"
    `;

    const [guncelGrup, ogrenci, guncelStajyer, mevcutKayit] =
      await Promise.all([
        tx.group.findUnique({
          where: { id: groupId },
          include: {
            term: {
              select: {
                name: true,
                status: true,
                interns: { select: { userId: true } },
              },
            },
            club: { select: { status: true } },
            _count: {
              select: { enrollments: { where: { status: "AKTIF" } } },
            },
          },
        }),
        tx.student.findUnique({
          where: { id: studentId },
          select: { id: true },
        }),
        tx.user.findUnique({
          where: { id: internId },
          select: { role: true, active: true },
        }),
        tx.enrollment.findUnique({
          where: { studentId_groupId: { studentId, groupId } },
          select: { status: true },
        }),
      ]);

    if (!ogrenci) return { hata: "Öğrenci bulunamadı." };
    if (!guncelGrup) return { hata: "Grup bulunamadı." };
    if (!guncelGrup.active) {
      return { hata: "Bu grup kapalı; yeni kayıt alınamaz." };
    }
    if (
      guncelGrup.term?.status !== "KAYIT_ALIYOR" &&
      guncelGrup.club?.status !== "KAYIT_ALIYOR"
    ) {
      return { hata: kayitKapaliMesaji(guncelGrup.term) };
    }
    if (mevcutKayit) {
      return {
        hata:
          mevcutKayit.status === "AKTIF"
            ? "Bu öğrenci zaten bu gruba kayıtlı."
            : "Bu öğrencinin bu grupta iptal edilmiş bir kaydı var. Yeni kayıt yerine mevcut kaydı yeniden etkinleştirin.",
      };
    }
    if (
      !guncelStajyer ||
      guncelStajyer.role !== "STAJYER" ||
      !guncelStajyer.active
    ) {
      return { alanHatalari: { internId: "Geçerli bir stajyer seçin." } };
    }
    if (
      guncelGrup.term &&
      guncelGrup.term.interns.length > 0 &&
      !guncelGrup.term.interns.some((kadro) => kadro.userId === internId)
    ) {
      return {
        alanHatalari: {
          internId: `Bu stajyer "${guncelGrup.term.name}" döneminin kadrosunda değil. Önce dönem sayfasından kadroya ekleyin.`,
        },
      };
    }

    const guncelKontenjan = kontenjanDurumu(
      guncelGrup.capacity,
      guncelGrup._count.enrollments,
    );
    if (guncelKontenjan.dolu) {
      return {
        hata: `"${guncelGrup.name}" grubunun kontenjanı dolu (${guncelKontenjan.doluluk}/${guncelKontenjan.kapasite}). Aynı programa yeni bir grup ekleyip oraya kaydedebilirsiniz.`,
      };
    }

    await tx.enrollment.create({
      data: { studentId, groupId, internId },
    });
    return { olustu: true as const };
  });

  if (!("olustu" in sonuc)) return sonuc;

  revalidatePath("/koordinator/kayitlar");
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator/stajyerler");
  revalidatePath(`/koordinator/ogrenciler/${studentId}`);
  redirect(`/koordinator/ogrenciler/${studentId}`);
}

/**
 * §8 — Kayıt bazında stajyer değiştirme. Aynı öğrenci farklı kayıtlarda
 * farklı stajyerlere atanabilir; bir kayıt içinde ise yalnızca bir stajyere.
 *
 * Atama iki ekrandan da yapılabiliyor — öğrenci profilinde "bu kaydın
 * sorumlusu kim", stajyer sayfasında "bu stajyere hangi öğrenciler" — ve
 * ikisi de bu tek eylemi çağırıyor. Kural (özellikle dönem kadrosu kontrolü)
 * böylece tek yerde duruyor.
 */
export async function kayitStajyerDegistir(
  kayitId: string,
  internId: string,
): Promise<EylemDurumu> {
  await yonetimZorunlu();

  if (!internId) return { hata: "Stajyer seçin." };

  const stajyer = await db.user.findUnique({
    where: { id: internId },
    select: { role: true, active: true, name: true },
  });

  if (!stajyer || stajyer.role !== "STAJYER" || !stajyer.active) {
    return { hata: "Geçerli bir stajyer seçin." };
  }

  const kayit = await db.enrollment.findFirst({
    where: { id: kayitId, status: "AKTIF" },
    select: {
      studentId: true,
      group: {
        select: {
          term: {
            select: {
              name: true,
              interns: { select: { userId: true } },
            },
          },
        },
      },
    },
  });
  if (!kayit) return { hata: "Aktif kayıt bulunamadı." };

  // Kayıt bir döneme aitse ve dönemin kadrosu tanımlıysa, yeni sorumlu
  // stajyer de kadrodan olmalı (kayıt oluşturmadaki kuralla aynı).
  const donemKadrosu = kayit.group.term;
  if (
    donemKadrosu &&
    donemKadrosu.interns.length > 0 &&
    !donemKadrosu.interns.some((satir) => satir.userId === internId)
  ) {
    return {
      hata: `${stajyer.name} "${donemKadrosu.name}" döneminin kadrosunda değil. Önce dönem sayfasından kadroya ekleyin.`,
    };
  }

  await db.enrollment.update({
    where: { id: kayitId },
    data: { internId },
  });

  revalidatePath("/koordinator/kayitlar");
  revalidatePath("/koordinator/stajyerler");
  revalidatePath(`/koordinator/stajyerler/${internId}`);
  revalidatePath(`/koordinator/ogrenciler/${kayit.studentId}`);
  revalidatePath("/koordinator");
  return { basari: `Sorumlu stajyer ${stajyer.name} olarak güncellendi.` };
}

/**
 * Kayıt iptal edilir, silinmez: girilmiş puanlamalar ve katılım geçmişi
 * korunmalı. İptal edilen kayıt kontenjandan düşer.
 */
export async function kayitDurumDegistir(
  kayitId: string,
): Promise<EylemDurumu> {
  await yonetimZorunlu();

  const hedef = await db.enrollment.findUnique({
    where: { id: kayitId },
    select: { groupId: true },
  });
  if (!hedef) return { hata: "Kayıt bulunamadı." };

  const sonuc = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${"kayit:" + hedef.groupId}))::text
        AS "kilit"
    `;

    const kayit = await tx.enrollment.findUnique({
      where: { id: kayitId },
      include: {
        group: {
          include: {
            term: { select: { status: true } },
            club: { select: { status: true } },
            _count: {
              select: {
                enrollments: { where: { status: "AKTIF" } },
              },
            },
          },
        },
      },
    });
    if (!kayit) return { hata: "Kayıt bulunamadı." };

    if (kayit.status === "IPTAL") {
      if (
        kayit.group.term?.status !== "KAYIT_ALIYOR" &&
        kayit.group.club?.status !== "KAYIT_ALIYOR"
      ) {
        return {
          hata: `${kayitKapaliMesaji(kayit.group.term)} Kayıt yeniden etkinleştirilemez.`,
        };
      }

      const kontenjan = kontenjanDurumu(
        kayit.group.capacity,
        kayit.group._count.enrollments,
      );
      if (kontenjan.dolu) {
        return {
          hata: `"${kayit.group.name}" grubunun kontenjanı dolu; kayıt yeniden etkinleştirilemez.`,
        };
      }
    }

    await tx.enrollment.update({
      where: { id: kayitId },
      data: { status: kayit.status === "AKTIF" ? "IPTAL" : "AKTIF" },
    });

    return {
      degisti: true as const,
      oncekiDurum: kayit.status,
      studentId: kayit.studentId,
    };
  });

  if (!("degisti" in sonuc)) return sonuc;

  revalidatePath("/koordinator/kayitlar");
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator/stajyerler");
  revalidatePath(`/koordinator/ogrenciler/${sonuc.studentId}`);

  return {
    basari:
      sonuc.oncekiDurum === "AKTIF"
        ? "Kayıt iptal edildi. Girilmiş puanlamalar korundu."
        : "Kayıt yeniden etkinleştirildi.",
  };
}
