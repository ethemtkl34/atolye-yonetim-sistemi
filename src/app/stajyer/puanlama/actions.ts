"use server";

import { revalidatePath } from "next/cache";
import { subeliOturum } from "@/lib/yetki-kapisi";
import { db } from "@/lib/db";
import {
  cevapCozumle,
  formSatirlariOlustur,
  oturumPuanlanabilirMi,
} from "@/lib/puanlama";
import { takvimKilidiAl } from "@/lib/takvim-kilidi";
import { bugun, tarihBicimle, tarihMetni } from "@/lib/tarih";
import type { EylemDurumu } from "@/lib/formlar";

/**
 * §10 — Puanlama formunun kaydedilmesi.
 *
 * Tek eylem hem stajyerin hem koordinatörün formunu kaydeder; ikisi de aynı
 * kuralları geçer, fark yalnızca kimin hangi kaydı düzenleyebildiğidir
 * (§10.5: stajyer kendi öğrencilerini, koordinatör hepsini).
 *
 * Formdan gelen hiçbir bilgi doğru kabul edilmez: hangi soruların
 * cevaplanacağı istemcinin gönderdiği alanlardan değil, sunucunun kendi
 * okuduğu aktif soru listesinden çıkarılır. Aksi halde eksik form gönderip
 * §10.3'ü atlamak mümkün olurdu.
 */

export type PuanlamaEylemDurumu = EylemDurumu & {
  /** Cevaplanmadığı için işaretlenecek satır anahtarları. */
  eksikSatirlar?: string[];
};

export async function puanlamaKaydet(
  _oncekiDurum: PuanlamaEylemDurumu,
  formVerisi: FormData,
): Promise<PuanlamaEylemDurumu> {
  const kullanici = await subeliOturum();
  const subeId = kullanici.aktifSubeId;

  // §10.5 — Puan yazabilenler: stajyer (aşağıda ayrıca "bana atanmış mı"
  // süzgecinden geçer) ve puanlama modülünde TAM yetkisi olan yönetim
  // rolleri. Rol katmanı genişleyince bu kapı gerekli oldu: danışma
  // görevlisi de `subeliOturum`'dan geçebiliyor ama puan yazamamalı.
  const stajyerMi = kullanici.roller.includes("STAJYER");
  if (!stajyerMi && kullanici.yetkiler.puanlamalar !== "TAM") {
    return { hata: "Puanlama girme yetkiniz yok." };
  }

  const oturumId = String(formVerisi.get("oturumId") ?? "");
  const kayitId = String(formVerisi.get("kayitId") ?? "");
  if (!oturumId || !kayitId) return { hata: "Form eksik gönderildi." };

  // Kayıt ve oturum ikisi de şubeye kapalı okunuyor. Stajyer için altta
  // ayrıca "bana atanmış mı" kontrolü var; koordinatör içinse şube süzgeci
  // tek koruma — bu satır olmadan başka şubenin kaydına puan yazılabilirdi.
  const [kayit, oturum] = await Promise.all([
    db.enrollment.findFirst({
      where: { id: kayitId, group: { branchId: subeId } },
      select: {
        id: true,
        status: true,
        internId: true,
        groupId: true,
        studentId: true,
      },
    }),
    db.session.findFirst({
      where: { id: oturumId, group: { branchId: subeId } },
      select: {
        id: true,
        groupId: true,
        date: true,
        workshopType: {
          select: {
            name: true,
            questions: {
              where: { active: true },
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                text: true,
                title: true,
                category: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!kayit) return { hata: "Kayıt bulunamadı." };
  if (!oturum) return { hata: "Atölye oturumu bulunamadı." };

  // Oturum ile kayıt aynı gruba ait olmalı; başka bir grubun oturumuna puan
  // yazılamaz.
  if (oturum.groupId !== kayit.groupId) {
    return { hata: "Bu atölye oturumu bu kayda ait değil." };
  }

  // §3.2 — Stajyer yalnızca kendisine atanmış öğrencileri puanlar.
  if (stajyerMi && kayit.internId !== kullanici.id) {
    return { hata: "Bu öğrenci size atanmamış." };
  }

  if (kayit.status !== "AKTIF") {
    return {
      hata: "Bu kayıt iptal edilmiş; puanlama yapılamaz.",
    };
  }

  if (!oturumPuanlanabilirMi(oturum.date, bugun())) {
    return {
      hata: `Bu atölye ${tarihBicimle(oturum.date)} tarihinde yapılacak; henüz puanlanamaz.`,
    };
  }

  const katilim = formVerisi.get("attended");
  if (katilim !== "katildi" && katilim !== "katilmadi") {
    return { hata: "Katılım durumunu seçin." };
  }
  const katildi = katilim === "katildi";

  const mevcut = await db.score.findUnique({
    where: {
      sessionId_enrollmentId: { sessionId: oturumId, enrollmentId: kayitId },
    },
    select: {
      id: true,
      answers: {
        select: {
          id: true,
          questionId: true,
          questionTextSnapshot: true,
          titleSnapshot: true,
          categorySnapshot: true,
          value: true,
          sortOrder: true,
        },
      },
    },
  });

  /**
   * §10.2 — Katılmadı işaretlenirse cevap satırı tutulmaz.
   *
   * Satırlar silinir çünkü "satır var, değer null" bu üründe
   * "Değerlendirilemedi" demek; katılmayan öğrencinin formunda böyle bir
   * satırın kalması ortalamayı değil ama okumayı yanıltırdı.
   */
  if (!katildi) {
    const sonuc = await db.$transaction(async (tx) => {
      // Takvim kilidi: koordinatör aynı anda bu günü takvimden silmeye
      // çalışırsa iki yazma sıraya girer (bkz. lib/takvim-kilidi.ts).
      await takvimKilidiAl(tx, kayit.groupId);

      const oturumDuruyor = await tx.session.count({
        where: { id: oturumId },
      });
      if (oturumDuruyor === 0) {
        return { hata: "Bu gün az önce takvimden silindi; form kaydedilemez." };
      }

      const puanlama = await tx.score.upsert({
        where: {
          sessionId_enrollmentId: {
            sessionId: oturumId,
            enrollmentId: kayitId,
          },
        },
        create: {
          sessionId: oturumId,
          enrollmentId: kayitId,
          attended: false,
          scoredByUserId: kullanici.id,
        },
        update: { attended: false, scoredByUserId: kullanici.id },
        select: { id: true },
      });

      await tx.scoreAnswer.deleteMany({ where: { scoreId: puanlama.id } });
      return {};
    });

    if ("hata" in sonuc) return sonuc;

    ekranlariTazele(kayit.studentId, kayitId, oturum.date);
    return {
      basari: `${oturum.workshopType.name}: katılmadı olarak işaretlendi.`,
    };
  }

  // §10.3 — Katıldıysa bütün soruların cevaplanması zorunlu.
  const satirlar = formSatirlariOlustur(
    oturum.workshopType.questions,
    mevcut?.answers ?? [],
  );

  if (satirlar.length === 0) {
    return {
      hata: "Bu atölyenin aktif değerlendirme sorusu yok. Koordinatörden soru eklemesini isteyin.",
    };
  }

  const eksikSatirlar: string[] = [];
  const yazilacakCevaplar: {
    questionId: string | null;
    questionTextSnapshot: string;
    titleSnapshot: string | null;
    categorySnapshot: string | null;
    sortOrder: number;
    value: number | null;
  }[] = [];

  for (const satir of satirlar) {
    const cozum = cevapCozumle(formVerisi.get(`cevap:${satir.anahtar}`));

    if (!cozum.gecerli) {
      eksikSatirlar.push(satir.anahtar);
      continue;
    }

    yazilacakCevaplar.push({
      questionId: satir.questionId,
      // §13.14 — Zaten cevaplanmış satırın o günkü metni korunur.
      questionTextSnapshot: satir.kaydedilecekMetin,
      titleSnapshot: satir.kaydedilecekBaslik,
      categorySnapshot: satir.kaydedilecekKategori,
      sortOrder: satir.sortOrder,
      value: cozum.deger,
    });
  }

  if (eksikSatirlar.length > 0) {
    return {
      hata: `Katıldı işaretlenen formda bütün sorular cevaplanmalı. ${eksikSatirlar.length} soru eksik.`,
      eksikSatirlar,
    };
  }

  const sonuc = await db.$transaction(async (tx) => {
    // Takvim kilidi: koordinatör aynı anda bu günü takvimden silmeye
    // çalışırsa iki yazma sıraya girer (bkz. lib/takvim-kilidi.ts).
    await takvimKilidiAl(tx, kayit.groupId);

    const oturumDuruyor = await tx.session.count({ where: { id: oturumId } });
    if (oturumDuruyor === 0) {
      return { hata: "Bu gün az önce takvimden silindi; form kaydedilemez." };
    }

    const puanlama = await tx.score.upsert({
      where: {
        sessionId_enrollmentId: { sessionId: oturumId, enrollmentId: kayitId },
      },
      create: {
        sessionId: oturumId,
        enrollmentId: kayitId,
        attended: true,
        scoredByUserId: kullanici.id,
      },
      update: { attended: true, scoredByUserId: kullanici.id },
      select: { id: true },
    });

    // Cevaplar silinip yeniden yazılıyor: satır sayısı 10 civarında ve tek
    // transaction içinde. Tek tek upsert etmek aynı sonucu daha çok sorguyla
    // üretirdi.
    await tx.scoreAnswer.deleteMany({ where: { scoreId: puanlama.id } });
    await tx.scoreAnswer.createMany({
      data: yazilacakCevaplar.map((cevap) => ({
        scoreId: puanlama.id,
        ...cevap,
      })),
    });
    return {};
  });

  if ("hata" in sonuc) return sonuc;

  ekranlariTazele(kayit.studentId, kayitId, oturum.date);
  return { basari: `${oturum.workshopType.name} formu kaydedildi.` };
}

function ekranlariTazele(ogrenciId: string, kayitId: string, tarih: Date) {
  const gun = tarihMetni(tarih);

  revalidatePath("/stajyer");
  revalidatePath("/stajyer/ogrencilerim");
  revalidatePath("/stajyer/formlarim");
  revalidatePath(`/stajyer/puanlama/${kayitId}`);
  revalidatePath(`/stajyer/puanlama/${kayitId}/${gun}`);
  revalidatePath("/koordinator/puanlamalar");
  revalidatePath(`/koordinator/puanlamalar/${kayitId}`);
  revalidatePath(`/koordinator/puanlamalar/${kayitId}/${gun}`);
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
}
