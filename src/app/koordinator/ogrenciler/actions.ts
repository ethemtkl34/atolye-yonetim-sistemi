"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { kayitEngeli } from "@/lib/kayit-kurallari";
import { veliBaglariniYaz } from "@/lib/veli";
import { adayiKazanildiYap, donusumYolu } from "@/lib/aday/donusum";
import { donusumHedefiSemasi } from "../adaylar/sema";
import {
  alanHatalari,
  formDegerleri,
  type EylemDurumu,
} from "@/lib/formlar";
import {
  OGRENCI_FORM_ALANLARI,
  formdanOku,
  ogrenciSemasi,
} from "./sema";
import {
  ogrenciAlanlari,
  saglikAlanlari,
  veliGirdileri,
} from "./ogrenci-yazma";

/**
 * §7.1 — Yeni öğrenci. Form isteğe bağlı olarak bir program grubu da
 * taşıyabilir; o zaman öğrenci ve kaydı TEK işlemde açılır.
 *
 * Tek işlem olması önemli: önce öğrenciyi yazıp sonra kaydı denemek, kontenjan
 * dolduğunda ya da dönem kayıt almayı kapattığında ortada sahipsiz bir öğrenci
 * bırakırdı. Koordinatör de hata mesajını gördüğünde öğrencinin kaydedilip
 * kaydedilmediğini bilemezdi. Bu yüzden grup kontrolü başarısızsa hiçbir şey
 * yazılmıyor ve form girilen değerlerle geri geliyor.
 *
 * §16.9 — Form bir ADAYDAN geliyorsa (gizli `adayId`) dönüşüm de aynı
 * işlemde yapılır: aday KAZANILDI'ya taşınır ve öğrenciye bağlanır. Aşama
 * ancak öğrenci gerçekten yazıldığında değişir; kullanıcı formu yarıda
 * bırakırsa adaya hiçbir şey olmaz.
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

  // Aday bağlamı: yalnız `adaylar` yetkisi olan kullanıcı dönüştürebilir.
  // Yetkisi olmayan biri gizli alanı elle eklese bile dönüşüm yapılmaz,
  // öğrenci normal şekilde açılır.
  const adayId =
    kullanici.yetkiler.adaylar === "TAM"
      ? String(formVerisi.get("adayId") ?? "")
      : "";
  const hedef = donusumHedefiSemasi.parse(formVerisi.get("hedef"));
  const ogrenciAdi = `${veri.firstName} ${veri.lastName}`;

  // Veliler öğrenciyle BİRLİKTE değil, hemen ardından yazılıyor: veli artık
  // paylaşılan bir kayıt (§17.1) ve eşleştirme sorgu gerektiriyor, iç içe
  // `create` ile ifade edilemiyor. İkisi de aynı işlemin içinde.
  const ogrenciVerisi = {
    ...ogrenciAlanlari(veri),
    branchId: subeId,
    healthInfo: { create: saglikAlanlari(veri) },
  };
  const veliler = veliGirdileri(veri);

  if (!groupId) {
    const ogrenciId = await db.$transaction(async (tx) => {
      // şube-muaf: `ogrenciVerisi` içinde `branchId: subeId` yazılı; öğrenci
      // oturumdaki şubeye açılıyor.
      const ogrenci = await tx.student.create({ data: ogrenciVerisi });
      await veliBaglariniYaz(tx, {
        subeId,
        ogrenciId: ogrenci.id,
        girdiler: veliler,
      });

      if (adayId) {
        await adayiKazanildiYap(tx, {
          adayId,
          subeId,
          ogrenciId: ogrenci.id,
          ogrenciAdi,
          kullaniciId: kullanici.id,
          hedef,
        });
      }

      return ogrenci.id;
    });

    revalidatePath("/koordinator/ogrenciler");
    if (adayId) {
      revalidatePath("/koordinator/adaylar");
      revalidatePath(`/koordinator/adaylar/${adayId}`);
      revalidatePath("/koordinator");
    }
    redirect(
      donusumYolu(
        adayId ? hedef : "yok",
        ogrenciId,
        kullanici.yetkiler.danismanlik === "TAM",
      ),
    );
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
    await veliBaglariniYaz(tx, {
      subeId,
      ogrenciId: ogrenci.id,
      girdiler: veliler,
    });

    await tx.enrollment.create({
      data: { studentId: ogrenci.id, groupId },
    });

    if (adayId) {
      await adayiKazanildiYap(tx, {
        adayId,
        subeId,
        ogrenciId: ogrenci.id,
        ogrenciAdi,
        kullaniciId: kullanici.id,
        // Kayıt zaten bu formda açıldı; hedefe ayrıca yönlendirmeye gerek yok.
        hedef: "kayit",
      });
    }

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
  if (adayId) {
    revalidatePath("/koordinator/adaylar");
    revalidatePath(`/koordinator/adaylar/${adayId}`);
  }
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
  const veliler = veliGirdileri(veri);

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

    // Veli bağları silinip yeniden yazılmıyor, ÜZERİNE yazılıyor: telefonsuz
    // bir veli eşleştirilemediği için her düzenleme yeni bir `Veli` satırı
    // açar ve sahipsiz kayıtlar birikirdi (bkz. lib/veli.ts).
    await veliBaglariniYaz(tx, {
      subeId: kullanici.aktifSubeId,
      ogrenciId,
      girdiler: veliler,
    });

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
