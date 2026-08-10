"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { raporGovdesiV2Uret } from "@/lib/rapor-govdesi-verisi";
import {
  pdfGecmisi,
  raporDetayi,
  raporGovdesiUret,
  type PdfKaydi,
  type RaporDetayi,
} from "@/lib/rapor-verisi";
import type { RaporGovdesi } from "@/lib/rapor-motoru";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";
import type { EylemDurumu as TemelEylemDurumu } from "@/lib/formlar";

/**
 * §11 — Rapor oluşturma, yeniden üretme, metin düzenleme ve PDF üretimi.
 *
 * Bu eylemler eskiden `/koordinator/raporlar` altındaydı ve iş bitince o
 * sayfaya `redirect` ediyorlardı. Raporlar artık öğrenci profilindeki
 * pencerede yönetildiği için hiçbiri yönlendirme yapmıyor; bunun yerine
 * oluşan raporun kimliğini döndürüyorlar ve pencere kendini o rapora
 * güncelliyor. Kullanıcı böylece öğrencinin sayfasından hiç çıkmıyor.
 *
 * ŞUBE: Rapor id'leri istemciden geliyor, hepsi doğrulanmalı. Bütün okumalar
 * `student.branchId` üzerinden aktif şubeye kilitli; başka şubenin rapor id'si
 * gönderilirse eylem "bulunamadı" der.
 */

export type EylemDurumu = TemelEylemDurumu & {
  /** Yeni üretilen rapor — pencere bu rapora geçer. */
  raporId?: string;
  /** Üretilen PDF'in indirme adresi — pencere indirme düğmesi gösterir. */
  pdfAdresi?: string;
};

/**
 * §11.1 — Rapor istenilen anda, o anki puanlarla üretilir; dönemin bitmesi
 * beklenmez. Kapsam koordinatörün seçtiği kayıtlardır.
 */
export async function raporOlustur(
  ogrenciId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");
  const subeId = kullanici.aktifSubeId;

  const kayitIdleri = formVerisi.getAll("kayitlar").map(String).filter(Boolean);

  if (kayitIdleri.length === 0) {
    return { hata: "Raporun kapsayacağı en az bir kayıt seçin." };
  }

  // Seçilen kayıtların gerçekten bu öğrenciye ve bu şubeye ait olduğu
  // sunucuda doğrulanır.
  const gecerliKayitlar = await db.enrollment.findMany({
    where: {
      id: { in: kayitIdleri },
      studentId: ogrenciId,
      group: { branchId: subeId },
    },
    select: { id: true },
  });

  if (gecerliKayitlar.length !== kayitIdleri.length) {
    return { hata: "Seçilen kayıtlardan biri bu öğrenciye ait değil." };
  }

  // Üretim zamanı puanlar okunmadan ÖNCE alınır. Varsayılan now() kullanılsa
  // puan okuma ile kayıt arasındaki aralıkta değişen bir puan raporda yokken
  // rapor yine "Güncel" görünürdü (§13.16 karşılaştırması generatedAt ile
  // yapılıyor).
  const uretimZamani = new Date();
  // §11.2 — İkinci sürüm gövde denenir; kurulmamış bir programda (atölye
  // içeriği veya gelişim değerlendirmesi yoksa) yine üretilir, eksik
  // bölümler basılmaz. Yalnızca öğrenci ya da kayıt bulunamazsa birinci
  // sürüme düşülür.
  const govde =
    (await raporGovdesiV2Uret(ogrenciId, kayitIdleri, subeId, new Date())) ??
    (await raporGovdesiUret(ogrenciId, kayitIdleri, subeId));
  if (!govde) return { hata: "Öğrenci bulunamadı." };

  const rapor = await db.report.create({
    data: {
      studentId: ogrenciId,
      generatedAt: uretimZamani,
      bodyJson: govde as unknown as object,
      enrollmentLinks: {
        create: kayitIdleri.map((kayitId) => ({ enrollmentId: kayitId })),
      },
    },
    select: { id: true },
  });

  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
  revalidatePath("/koordinator");
  return { basari: "Rapor oluşturuldu.", raporId: rapor.id };
}

/**
 * §11.4 — Puanlar değiştiyse rapor yeniden üretilebilir.
 *
 * Yeni bir rapor satırı açılır; eski rapor ve ona bağlı PDF'ler yerinde kalır
 * (§13.17). Böylece "hangi rapor hangi PDF'in kaynağıydı" sorusu her zaman
 * cevaplanabilir.
 */
export async function raporYenidenUret(raporId: string): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");
  const subeId = kullanici.aktifSubeId;

  const eski = await db.report.findFirst({
    where: { id: raporId, student: { branchId: subeId } },
    select: {
      studentId: true,
      enrollmentLinks: { select: { enrollmentId: true } },
    },
  });

  if (!eski) return { hata: "Rapor bulunamadı." };

  const kayitIdleri = eski.enrollmentLinks.map((bag) => bag.enrollmentId);
  // Zaman damgası puanlar okunmadan önce — raporOlustur'daki açıklamaya bakın.
  const uretimZamani = new Date();
  const govde =
    (await raporGovdesiV2Uret(eski.studentId, kayitIdleri, subeId, new Date())) ??
    (await raporGovdesiUret(eski.studentId, kayitIdleri, subeId));
  if (!govde) return { hata: "Rapor verisi hazırlanamadı." };

  const yeni = await db.report.create({
    data: {
      studentId: eski.studentId,
      generatedAt: uretimZamani,
      bodyJson: govde as unknown as object,
      enrollmentLinks: {
        create: kayitIdleri.map((kayitId) => ({ enrollmentId: kayitId })),
      },
    },
    select: { id: true },
  });

  revalidatePath(`/koordinator/ogrenciler/${eski.studentId}`);
  revalidatePath("/koordinator");
  return {
    basari: "Güncel puanlarla yeni rapor üretildi. Eski rapor geçmişte kaldı.",
    raporId: yeni.id,
  };
}

/**
 * §11.5 — Raporun o anki hâlinden PDF üretir.
 *
 * PDF ikili verisi saklanmaz; üretim anındaki rapor gövdesi `snapshotJson`
 * içine kopyalanır ve belge indirilirken bu kopyadan çizilir. Rapor sonradan
 * düzenlense bile eski PDF'in içeriği değişmez (§13.17).
 */
export async function pdfOlustur(raporId: string): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");

  const rapor = await db.report.findFirst({
    where: { id: raporId, student: { branchId: kullanici.aktifSubeId } },
    select: { id: true, studentId: true, bodyJson: true },
  });

  if (!rapor) return { hata: "Rapor bulunamadı." };

  // İki adım tek transaction'da: satır oluşturma ile adresin yazılması
  // arasında bir hata olursa, silinemeyen (onDelete: Restrict) ama adressiz
  // bir PDF kaydı kalıcı olarak ortada kalırdı.
  const pdfAdresi = await db.$transaction(async (tx) => {
    const pdf = await tx.reportPdf.create({
      data: {
        reportId: rapor.id,
        // Adres kaydın kendisinden türetiliyor; nesne deposuna geçilirse
        // yalnızca burası değişir.
        fileUrl: "",
        snapshotJson: rapor.bodyJson as unknown as object,
      },
      select: { id: true },
    });

    const adres = `/api/rapor-pdf/${pdf.id}`;
    await tx.reportPdf.update({
      where: { id: pdf.id },
      data: { fileUrl: adres },
    });
    return adres;
  });

  revalidatePath(`/koordinator/ogrenciler/${rapor.studentId}`);

  return { basari: "PDF oluşturuldu ve rapor geçmişine eklendi.", pdfAdresi };
}

/**
 * §11.4 — Koordinatör otomatik üretilen metni düzenleyebilir.
 *
 * Yalnızca metin katmanı değişir; analiz çıktısı olduğu gibi korunur.
 * Böylece rapor hangi puanlardan çıktığını kaybetmez ve P13'te aynı analizle
 * yeniden metin üretilebilir.
 */
export async function raporMetniDuzenle(
  raporId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");

  const rapor = await db.report.findFirst({
    where: { id: raporId, student: { branchId: kullanici.aktifSubeId } },
    select: { bodyJson: true, studentId: true },
  });

  if (!rapor) return { hata: "Rapor bulunamadı." };

  const govde = rapor.bodyJson as unknown as RaporGovdesi;

  const yeniAtolyeler = govde.metin.atolyeler.map((atolye, sira) => {
    const girilen = formVerisi.get(`atolye-${sira}`);
    return {
      atolyeAdi: atolye.atolyeAdi,
      paragraf:
        typeof girilen === "string" && girilen.trim()
          ? girilen.trim()
          : atolye.paragraf,
    };
  });

  const genelMetin = formVerisi.get("genel");
  const yeniGenel =
    typeof genelMetin === "string" && genelMetin.trim()
      ? genelMetin
          .split(/\n{2,}/)
          .map((paragraf) => paragraf.trim())
          .filter(Boolean)
      : govde.metin.genelParagraflar;

  await db.report.update({
    where: { id: raporId },
    data: {
      bodyJson: {
        ...govde,
        metin: { atolyeler: yeniAtolyeler, genelParagraflar: yeniGenel },
      } as unknown as object,
      editedByUserId: kullanici.id,
      editedAt: new Date(),
    },
  });

  revalidatePath(`/koordinator/ogrenciler/${rapor.studentId}`);

  return { basari: "Rapor metni güncellendi.", raporId };
}

/** İkinci sürüm raporda yerinde düzenlenebilen metin alanları. */
export type DuzenlenebilirAlan =
  | { tur: "atolyeIcerik"; atolyeAdi: string }
  | { tur: "gelisimCumle"; alanAdi: string }
  | { tur: "asimetriCumle"; atolyeAdi: string }
  | { tur: "gozlem"; bolum: "giris" | "profil" | "sonuc" | "oneriler" }
  | { tur: "gozlemBlok"; beceriAdi: string };

/**
 * §11.4 — İkinci sürüm raporda tek bir metin kutusunun yerinde düzenlenmesi.
 *
 * Eski toplu düzenleme ekranının kutucuk bazlı karşılığı: koordinatör
 * penceredeki kutunun kalemine basar, yalnızca o metin değişir. Analiz
 * çıktısı (kademeler, ortalamalar) ve diğer metinler olduğu gibi kalır;
 * düzenleyen kişi ve zaman rapora işlenir. Daha önce alınmış PDF'ler kendi
 * snapshot'larından basılmaya devam eder (§13.17).
 */
export async function raporBolumunuDuzenle(
  raporId: string,
  alan: DuzenlenebilirAlan,
  metin: string,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");

  const yeniMetin = metin.trim();
  if (!yeniMetin) return { hata: "Metin boş bırakılamaz." };

  const rapor = await db.report.findFirst({
    where: { id: raporId, student: { branchId: kullanici.aktifSubeId } },
    select: { bodyJson: true, studentId: true },
  });
  if (!rapor) return { hata: "Rapor bulunamadı." };

  const govde = rapor.bodyJson as unknown as RaporGovdesiV2 & { surum?: number };
  if (govde?.surum !== 2) {
    return { hata: "Bu rapor eski biçimde; alttaki düzenleme ekranını kullanın." };
  }

  // Alan adları istemciden geliyor; hedef bulunamazsa sessizce hiçbir şeyi
  // değiştirmeden dönmek yerine hata verilir.
  switch (alan.tur) {
    case "atolyeIcerik": {
      const hedef = govde.atolyeIcerikleri.find(
        (a) => a.atolyeAdi === alan.atolyeAdi,
      );
      if (!hedef) return { hata: "Atölye içeriği bulunamadı." };
      hedef.metin = yeniMetin;
      break;
    }
    case "gelisimCumle": {
      const hedef = govde.gelisimAlanlari.find((a) => a.ad === alan.alanAdi);
      if (!hedef) return { hata: "Gelişim alanı bulunamadı." };
      hedef.cumle = yeniMetin;
      break;
    }
    case "asimetriCumle": {
      const hedef = govde.asimetriler.find(
        (a) => a.atolyeAdi === alan.atolyeAdi,
      );
      if (!hedef) return { hata: "Değerlendirme notu bulunamadı." };
      hedef.cumle = yeniMetin;
      break;
    }
    case "gozlem": {
      if (!govde.gozlem) return { hata: "Gözlem bölümü yok." };
      govde.gozlem[alan.bolum] = yeniMetin;
      break;
    }
    case "gozlemBlok": {
      const hedef = govde.gozlem?.bloklar.find(
        (b) => b.beceriAdi === alan.beceriAdi,
      );
      if (!hedef) return { hata: "Gözlem bloğu bulunamadı." };
      hedef.gozlem = yeniMetin;
      break;
    }
  }

  await db.report.update({
    where: { id: raporId },
    data: {
      bodyJson: govde as unknown as object,
      editedByUserId: kullanici.id,
      editedAt: new Date(),
    },
  });

  revalidatePath(`/koordinator/ogrenciler/${rapor.studentId}`);
  return { basari: "Metin güncellendi.", raporId };
}

export type RaporPenceresiVerisi = {
  detay: RaporDetayi;
  pdfler: PdfKaydi[];
};

/**
 * Pencere açıldığında raporun tam gövdesini getirir.
 *
 * Gövdeler (analiz + metin JSON'u) profil sayfasında peşinen yüklenmiyor:
 * bir öğrencinin onlarca raporu olabilir ve hepsinin tamamını her profil
 * açılışında taşımak gereksiz. Pencere hangi rapora bakılacağını bildiği anda
 * yalnızca onu çeker.
 */
export async function raporPenceresiVerisi(
  raporId: string,
): Promise<RaporPenceresiVerisi | null> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");
  const subeId = kullanici.aktifSubeId;

  const [detay, pdfler] = await Promise.all([
    raporDetayi(raporId, subeId),
    pdfGecmisi({ subeId, raporId }),
  ]);

  if (!detay) return null;
  return { detay, pdfler };
}
