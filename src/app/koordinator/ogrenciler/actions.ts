"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { kayitEngeli } from "@/lib/kayit-kurallari";
import { veliBaglariniYaz } from "@/lib/veli";
import { adayiKazanildiYap, donusumYolu } from "@/lib/aday/donusum";
import { normalizeArama } from "@/lib/turkce";
import { tarihBicimle } from "@/lib/tarih";
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
  kayitSubesiCoz,
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
 *
 * KAYIT ŞUBESİ (Eylül 2026): öğrenciler ortak havuzda; formdaki "Kayıt
 * şubesi" yalnız etiket, varsayılanı çalışılan şube. Program grubu ise
 * çalışılan şubenin grubu olmak zorunda — grup şubenin.
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

  const kayitSubesi = await kayitSubesiCoz(formVerisi, subeId);
  if (!kayitSubesi) {
    return {
      alanHatalari: { kayitSubesi: "Listeden bir şube seçin." },
      degerler: formDegerleri(formVerisi, OGRENCI_FORM_ALANLARI),
    };
  }

  // Mükerrer uyarısı (ortak havuz, Eylül 2026): aynı ad-soyadla bir öğrenci
  // iki şubeden birinde zaten varsa kullanıcıya bir kez sorulur. Engel
  // DEĞİL — aynı adlı iki çocuk gerçekten olabiliyor; form EVET derse aynı
  // eylemi `mukerrerOnay=1` ile yeniden çağırır.
  if (formVerisi.get("mukerrerOnay") !== "1") {
    const ayniAdlilar = await db.student.findMany({
      where: { searchName: normalizeArama(`${veri.firstName} ${veri.lastName}`) },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        birthDate: true,
        school: true,
        branch: { select: { name: true } },
      },
    });
    if (ayniAdlilar.length > 0) {
      const satirlar = ayniAdlilar
        .map(
          (ogrenci) =>
            "• " +
            [
              ogrenci.birthDate
                ? `doğum ${tarihBicimle(ogrenci.birthDate)}`
                : "doğum tarihi yok",
              ogrenci.school,
              ogrenci.branch.name,
            ]
              .filter(Boolean)
              .join(" · "),
        )
        .join("\n");
      return {
        onayGerekli: `"${veri.firstName} ${veri.lastName}" adıyla kayıtlı ${ayniAdlilar.length === 5 ? "en az 5" : ayniAdlilar.length} öğrenci var:\n${satirlar}\n\nAynı çocuksa yeni kayıt açmak yerine Öğrenciler listesinden onu bulun.`,
        degerler: formDegerleri(formVerisi, OGRENCI_FORM_ALANLARI),
      };
    }
  }

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
    branchId: kayitSubesi,
    healthInfo: { create: saglikAlanlari(veri) },
  };
  const veliler = veliGirdileri(veri);

  if (!groupId) {
    const ogrenciId = await db.$transaction(async (tx) => {
      const ogrenci = await tx.student.create({ data: ogrenciVerisi });
      // Veli, öğrencinin kayıt şubesinde eşleşir/açılır (§17.1).
      await veliBaglariniYaz(tx, {
        subeId: kayitSubesi,
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

    const ogrenci = await tx.student.create({ data: ogrenciVerisi });
    await veliBaglariniYaz(tx, {
      subeId: kayitSubesi,
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
 *
 * ORTAK HAVUZ (Eylül 2026): öğrenciyi yalnız KAYIT ŞUBESİNİN personeli ya
 * da kurum yöneticisi silebilir; diğer şubede kaydı olan öğrenci hiç
 * silinemez (grup o şubenin, kaydı sessizce düşürmek o şubenin verisini
 * silmek olurdu).
 */
export async function ogrenciSil(ogrenciId: string): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("ogrenciler", "TAM");
  const yonetici = kullanici.roller.includes("ADMIN");
  // Yönetici için "kendi şubesi" yok; herhangi bir öğrenciyi silebilir.
  const silebilecegiSube = yonetici ? undefined : kullanici.aktifSubeId;

  type SilmeSonucu =
    | { silindi: false; hata: string }
    | { silindi: true; ad: string };

  const sonuc = await db.$transaction(async (tx): Promise<SilmeSonucu> => {
    const ogrenci = await tx.student.findFirst({
      where: { id: ogrenciId },
      select: {
        firstName: true,
        lastName: true,
        branchId: true,
        branch: { select: { name: true } },
        _count: {
          select: {
            reports: true,
            counselingSessions: true,
            parentMeetings: true,
            intelligenceTests: true,
            randevular: true,
          },
        },
        enrollments: {
          select: {
            _count: { select: { scores: true } },
            group: {
              select: { branchId: true, branch: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!ogrenci) return { silindi: false, hata: "Öğrenci bulunamadı." };

    const ad = `${ogrenci.firstName} ${ogrenci.lastName}`;

    if (silebilecegiSube && ogrenci.branchId !== silebilecegiSube) {
      return {
        silindi: false,
        hata: `${ad} silinemez: öğrenciyi yalnızca kayıt şubesi (${ogrenci.branch.name}) ya da kurum yöneticisi silebilir.`,
      };
    }

    const baskaSubeKaydi = ogrenci.enrollments.find(
      (kayit) => kayit.group.branchId !== ogrenci.branchId,
    );
    if (baskaSubeKaydi) {
      return {
        silindi: false,
        hata: `${ad} silinemez: ${baskaSubeKaydi.group.branch.name} şubesinde program kaydı var.`,
      };
    }
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

    // §17.4 — Randevu bağı şemada RESTRICT: bu kontrol yazılmasaydı silme,
    // kullanıcıya hiçbir şey anlatmayan bir yabancı anahtar hatasıyla düşerdi.
    if (ogrenci._count.randevular > 0) {
      return {
        silindi: false,
        hata: `${ad} silinemez: ${ogrenci._count.randevular} randevu kaydı var ve bu geçmiş korunmalı.`,
      };
    }

    // Kayıt şubesi silmenin KENDİ where'inde de duruyor: kontrol ile silme
    // arasında şube değiştirilirse silme düşer. Veli, sağlık ve kayıt
    // satırları şemadaki Cascade ile gidiyor.
    const silinen = await tx.student.deleteMany({
      where: { id: ogrenciId, branchId: ogrenci.branchId },
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

  const kayitSubesi = await kayitSubesiCoz(formVerisi, kullanici.aktifSubeId);
  if (!kayitSubesi) {
    return {
      alanHatalari: { kayitSubesi: "Listeden bir şube seçin." },
      degerler: formDegerleri(formVerisi, OGRENCI_FORM_ALANLARI),
    };
  }

  // Öğrenciler ortak havuzda (Eylül 2026): iki şubenin personeli de her
  // öğrenciyi düzenler, kayıt şubesi (etiket) de buradan değişir.
  // `updateMany` + sayı kontrolü: sıfır satırsa öğrenci yok, veli ve sağlık
  // satırlarına da dokunulmadan işlem geri alınır.
  const bulundu = await db.$transaction(async (tx) => {
    const sonuc = await tx.student.updateMany({
      where: { id: ogrenciId },
      data: { ...ogrenciAlanlari(veri), branchId: kayitSubesi },
    });

    if (sonuc.count === 0) return false;

    // Veli bağları silinip yeniden yazılmıyor, ÜZERİNE yazılıyor: telefonsuz
    // bir veli eşleştirilemediği için her düzenleme yeni bir `Veli` satırı
    // açar ve sahipsiz kayıtlar birikirdi (bkz. lib/veli.ts). Veli
    // öğrencinin kayıt şubesinde eşleşir (§17.1).
    await veliBaglariniYaz(tx, {
      subeId: kayitSubesi,
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
