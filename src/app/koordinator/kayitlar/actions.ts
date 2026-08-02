"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { kontenjanDurumu } from "@/lib/scoring";
import { grupZamani } from "@/lib/tarih";
import {
  kayitKapaliMesaji,
  kontenjanEngeli,
  programKayitEngeli,
} from "@/lib/kayit-kurallari";

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
  /**
   * Toplu eklemede tek tek anlatılması gereken sonuçlar: eklenemeyen öğrenciler
   * ve sebepleri, bir de yeni oluşan zaman çakışmaları. Tek satırlık bir başarı
   * mesajına sığmıyor, sığdırılırsa da hangi çocuğun dışarıda kaldığı kaybolur.
   */
  ayrinti?: string[];
};

const kayitSemasi = z.object({
  studentId: z.string().min(1, "Öğrenci seçin"),
  groupId: z.string().min(1, "Grup seçin"),
  /**
   * Boş bırakılabilir. Sorumlu stajyer kayıt anında değil, dönem başlarken
   * atanıyor; zorunlu tutmak kaydı gereksiz yere bekletiyordu. Atanmamış kayıt
   * zaten görünür: panodaki kart ve kayıtlar ekranındaki "Atanmamış" süzgeci
   * `atanmamisKayitKosulu` ile bunları sayıyor.
   */
  internId: z.string(),
});

export async function kayitOlustur(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

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

  const { studentId, groupId } = cozumlenen.data;
  const internId = cozumlenen.data.internId || null;
  const onaylandi = formVerisi.get("onaylandi") === "1";

  // Grup, öğrenci ve stajyerin ÜÇÜ de aynı şubeden olmalı. Grup şubeye
  // kilitlenince kayıt da o şubeye ait olur (kaydın şubesi gruptan türüyor);
  // öğrenci ve stajyer ayrıca kontrol edilmezse başka şubenin öğrencisi bu
  // şubenin grubuna kaydedilip iki şube birbirine karışırdı.
  const grup = await db.group.findFirst({
    where: { id: groupId, branchId: subeId },
    include: {
      term: {
        select: {
          name: true,
          status: true,
          // Dönem ortak; kadro iki şubenin stajyerlerini birlikte tutuyor.
          interns: {
            where: { user: { branchId: subeId } },
            select: { userId: true },
          },
        },
      },
      club: { select: { name: true, status: true } },
      _count: { select: { enrollments: { where: { status: "AKTIF" } } } },
    },
  });

  if (!grup) return { hata: "Grup bulunamadı." };

  const programEngeli = programKayitEngeli(grup);
  if (programEngeli) return { hata: programEngeli };

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

  const doluHatasi = kontenjanEngeli(grup);
  if (doluHatasi) return { hata: doluHatasi };

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
        group: { day: grup.day, timeSlot: grup.timeSlot, branchId: subeId },
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

  // Stajyer seçimi isteğe bağlı; seçildiyse kuralların tamamı geçerli.
  if (internId) {
    const stajyer = await db.user.findFirst({
      where: { id: internId, branchId: subeId },
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
        tx.group.findFirst({
          where: { id: groupId, branchId: subeId },
          include: {
            term: {
              select: {
                name: true,
                status: true,
                interns: {
                  where: { user: { branchId: subeId } },
                  select: { userId: true },
                },
              },
            },
            club: { select: { status: true } },
            _count: {
              select: { enrollments: { where: { status: "AKTIF" } } },
            },
          },
        }),
        tx.student.findFirst({
          where: { id: studentId, branchId: subeId },
          select: { id: true },
        }),
        internId
          ? tx.user.findFirst({
              where: { id: internId, branchId: subeId },
              select: { role: true, active: true },
            })
          : null,
        tx.enrollment.findUnique({
          where: { studentId_groupId: { studentId, groupId } },
          select: { status: true },
        }),
      ]);

    if (!ogrenci) return { hata: "Öğrenci bulunamadı." };
    if (!guncelGrup) return { hata: "Grup bulunamadı." };

    const guncelProgramEngeli = programKayitEngeli(guncelGrup);
    if (guncelProgramEngeli) return { hata: guncelProgramEngeli };

    if (mevcutKayit) {
      return {
        hata:
          mevcutKayit.status === "AKTIF"
            ? "Bu öğrenci zaten bu gruba kayıtlı."
            : "Bu öğrencinin bu grupta iptal edilmiş bir kaydı var. Yeni kayıt yerine mevcut kaydı yeniden etkinleştirin.",
      };
    }
    if (internId) {
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
    }

    const guncelDoluHatasi = kontenjanEngeli(guncelGrup);
    if (guncelDoluHatasi) return { hata: guncelDoluHatasi };

    // şube-muaf: kimliklerin hepsi aynı işlemin başında `branchId: subeId` ile
    // okundu (grup, öğrenci, seçildiyse stajyer); biri başka şubedense yukarıda
    // dönülüyor.
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
 * Dönem ve kulüp sayfasından bir gruba toplu öğrenci ekleme.
 *
 * Akış tersine dönüyor: tek kayıt sihirbazı "önce öğrenci, sonra program"
 * diye ilerliyor, buradaysa program bellidir ve öğrenciler listeden seçilir.
 * Sınıf mevcudunu bir defada geçirmenin tek pratik yolu buydu; tek tek ekleme
 * 20 öğrenci için 20 tur demekti.
 *
 * Kontenjan yetmezse işlem TÜMÜYLE reddedilmiyor: sığan öğrenciler eklenir,
 * kalanlar adlarıyla bildirilir. Koordinatörün bir sonraki adımı zaten yeni
 * grup açmak; seçimi baştan yaptırmanın kimseye faydası yok.
 *
 * Sorumlu stajyer burada hiç sorulmuyor — atama dönem başlarken, Atamalar
 * ekranından toplu yapılıyor. Atanmamış kayıtlar panoda ve kayıtlar
 * ekranındaki "Atanmamış" süzgecinde görünmeye devam ediyor.
 */
export async function topluKayitOlustur(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

  const groupId = String(formVerisi.get("groupId") ?? "");
  const secilenler = [
    ...new Set(
      formVerisi
        .getAll("ogrenciler")
        .map((deger) => String(deger))
        .filter(Boolean),
    ),
  ];

  if (!groupId) return { alanHatalari: { groupId: "Grup seçin." } };
  if (secilenler.length === 0) {
    return { hata: "Hiç öğrenci seçilmedi." };
  }

  /**
   * İşlemin dönüş türü açıkça yazılıyor: dallardan çıkarılan birleşim TypeScript
   * tarafında daraltılamıyordu ve başarı dalındaki alanlar "belki tanımsız"
   * görünüyordu.
   */
  type TopluSonuc =
    | { basarili: false; durum: EylemDurumu }
    | {
        basarili: true;
        grupAdi: string;
        termId: string | null;
        clubId: string | null;
        eklenenSayisi: number;
        ogrenciIdleri: string[];
        ayrinti: string[];
      };

  // Kontenjan okuma ile yazma arasında kaymasın diye tek kayıt akışıyla aynı
  // kilit: grup kimliğine bağlı transaction advisory lock.
  const sonuc = await db.$transaction(async (tx): Promise<TopluSonuc> => {
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

    if (!grup) {
      return { basarili: false, durum: { hata: "Grup bulunamadı." } };
    }

    const engel = programKayitEngeli(grup);
    if (engel) return { basarili: false, durum: { hata: engel } };

    // Kimlikler istemciden geliyor; şube süzgeci burada eleme yapıyor.
    // Sıralama ekrandaki listeyle aynı olsun diye ada göre: kontenjan
    // yetmediğinde kimin dışarıda kaldığı rastgele değil, öngörülebilir olmalı.
    const ogrenciler = await tx.student.findMany({
      where: { id: { in: secilenler }, branchId: subeId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    });

    const mevcutKayitlar = await tx.enrollment.findMany({
      where: { studentId: { in: secilenler }, group: { branchId: subeId } },
      select: {
        studentId: true,
        groupId: true,
        status: true,
        group: {
          select: {
            name: true,
            day: true,
            timeSlot: true,
            term: { select: { name: true } },
            club: { select: { name: true } },
          },
        },
      },
    });

    const buGruptakiler = new Map(
      mevcutKayitlar
        .filter((kayit) => kayit.groupId === groupId)
        .map((kayit) => [kayit.studentId, kayit.status]),
    );

    const kalanYer = Math.max(0, grup.capacity - grup._count.enrollments);
    const eklenecekler: { id: string; ad: string }[] = [];
    const atlananlar: string[] = [];

    for (const ogrenci of ogrenciler) {
      const ad = `${ogrenci.firstName} ${ogrenci.lastName}`;
      const mevcut = buGruptakiler.get(ogrenci.id);

      if (mevcut === "AKTIF") {
        atlananlar.push(`${ad} — zaten bu gruba kayıtlı`);
        continue;
      }
      if (mevcut === "IPTAL") {
        atlananlar.push(
          `${ad} — bu grupta iptal edilmiş kaydı var; Kayıtlar ekranından yeniden etkinleştirin`,
        );
        continue;
      }
      if (eklenecekler.length >= kalanYer) {
        atlananlar.push(`${ad} — kontenjan doldu`);
        continue;
      }

      eklenecekler.push({ id: ogrenci.id, ad });
    }

    const bulunamayan = secilenler.length - ogrenciler.length;
    if (bulunamayan > 0) {
      atlananlar.push(
        `${bulunamayan} seçim bu şubenin öğrencisi değil; atlandı`,
      );
    }

    if (eklenecekler.length === 0) {
      return {
        basarili: false,
        durum: { hata: "Hiçbir öğrenci eklenemedi.", ayrinti: atlananlar },
      };
    }

    // şube-muaf: grup ve öğrencilerin tamamı bu işlemin içinde
    // `branchId: subeId` ile okundu; listeye başka şubeden kimlik giremiyor.
    await tx.enrollment.createMany({
      data: eklenecekler.map((ogrenci) => ({
        studentId: ogrenci.id,
        groupId,
      })),
    });

    /**
     * §7.4 — Çakışma uyarısı toplu akışta engel değil, bildirim. Tek kayıtta
     * "uyarıya rağmen devam et" adımı var; 20 öğrencilik bir listede aynı adımı
     * tek tek yürütmek akışı kilitlerdi. Bunun yerine çakışan öğrenciler
     * eklendikten sonra adlarıyla sayılıyor.
     */
    const eklenenIdleri = new Set(eklenecekler.map((ogrenci) => ogrenci.id));
    const adlar = new Map(eklenecekler.map((ogrenci) => [ogrenci.id, ogrenci.ad]));
    const cakisanlar = mevcutKayitlar
      .filter(
        (kayit) =>
          kayit.status === "AKTIF" &&
          kayit.groupId !== groupId &&
          eklenenIdleri.has(kayit.studentId) &&
          kayit.group.day === grup.day &&
          kayit.group.timeSlot === grup.timeSlot,
      )
      .map((kayit) => {
        const program =
          kayit.group.term?.name ?? kayit.group.club?.name ?? "Program";
        return `${adlar.get(kayit.studentId)} — aynı zaman diliminde başka kaydı var: ${program} · ${kayit.group.name}`;
      });

    return {
      basarili: true,
      grupAdi: grup.name,
      termId: grup.termId,
      clubId: grup.clubId,
      eklenenSayisi: eklenecekler.length,
      ogrenciIdleri: eklenecekler.map((ogrenci) => ogrenci.id),
      ayrinti: [...atlananlar, ...cakisanlar],
    };
  });

  if (!sonuc.basarili) return sonuc.durum;

  revalidatePath("/koordinator/kayitlar");
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator/stajyerler");
  revalidatePath("/koordinator");
  if (sonuc.termId) revalidatePath(`/koordinator/donemler/${sonuc.termId}`);
  if (sonuc.clubId) revalidatePath(`/koordinator/kulupler/${sonuc.clubId}`);
  for (const ogrenciId of sonuc.ogrenciIdleri) {
    revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
  }

  return {
    basari: `${sonuc.eklenenSayisi} öğrenci "${sonuc.grupAdi}" grubuna kaydedildi. Sorumlu stajyer atanmadı; atamayı Atamalar ekranından yapabilirsiniz.`,
    ayrinti: sonuc.ayrinti,
  };
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
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

  if (!internId) return { hata: "Stajyer seçin." };

  const stajyer = await db.user.findFirst({
    where: { id: internId, branchId: subeId },
    select: { role: true, active: true, name: true },
  });

  if (!stajyer || stajyer.role !== "STAJYER" || !stajyer.active) {
    return { hata: "Geçerli bir stajyer seçin." };
  }

  const kayit = await db.enrollment.findFirst({
    where: { id: kayitId, status: "AKTIF", group: { branchId: subeId } },
    select: {
      studentId: true,
      group: {
        select: {
          term: {
            select: {
              name: true,
              interns: {
                where: { user: { branchId: subeId } },
                select: { userId: true },
              },
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
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

  const hedef = await db.enrollment.findFirst({
    where: { id: kayitId, group: { branchId: subeId } },
    select: { groupId: true },
  });
  if (!hedef) return { hata: "Kayıt bulunamadı." };

  const sonuc = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${"kayit:" + hedef.groupId}))::text
        AS "kilit"
    `;

    const kayit = await tx.enrollment.findFirst({
      where: { id: kayitId, group: { branchId: subeId } },
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
