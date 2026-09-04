"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { veliBaglariniYaz } from "@/lib/veli";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { alanHatalari, formDegerleri, type EylemDurumu } from "@/lib/formlar";
import {
  OGRENCI_FORM_ALANLARI,
  formdanOku,
  ogrenciSemasi,
} from "@/app/koordinator/ogrenciler/sema";
import {
  ogrenciAlanlari,
  saglikAlanlari,
  veliGirdileri,
} from "@/app/koordinator/ogrenciler/ogrenci-yazma";

/**
 * Zeka testi için yeni öğrenci — test uygulayıcısının kendi ekranından
 * çocuğu sisteme alması.
 *
 * NEDEN AYRI BİR EYLEM: Öğrenciler sayfasındaki `ogrenciEkle` kaydettikten
 * sonra öğrenci profiline `redirect` ediyor. Buradaki iş akışı ise "çocuğu
 * aç, hemen test belgesini yükle" — profile atılmak akışı kesiyordu. Bu eylem
 * Zeka testleri sayfasına, üstelik yeni öğrenci süzgeçte SEÇİLİ olarak
 * dönüyor; kullanıcı doğrudan belgeyi yükleyebiliyor.
 *
 * Program kaydı (öğrenciyi atölye grubuna yazma) bilerek YOK: bu ekranın işi
 * test dosyasının sahibini açmak. Kayıt gerekiyorsa öğrenci profilinden ya da
 * dönem sayfasından açılır — form da `programlar` almadan çiziliyor.
 *
 * YETKİ İKİ KAPILI: `zekaTestleri` TAM bu ekranın kapısı, `ogrenciler` TAM ise
 * öğrenci açmanın kendi kuralı (danışan başvurusundaki desenin aynısı). Tek
 * başına Test Uygulayıcısı rolünde `ogrenciler` YOK'tur — o hesap bu eylemi
 * çalıştıramaz; rol pratikte psikologla birlikte veriliyor.
 */
export async function zekaTestiOgrencisiEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("zekaTestleri", "TAM");
  const subeId = kullanici.aktifSubeId;

  const girilenler = formDegerleri(formVerisi, OGRENCI_FORM_ALANLARI);

  if (kullanici.yetkiler.ogrenciler !== "TAM") {
    return {
      hata: "Yeni öğrenci açma yetkiniz yok; öğrenciyi kayıt masası eklemeli.",
      degerler: girilenler,
    };
  }

  const cozumlenen = ogrenciSemasi.safeParse(formdanOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: girilenler,
    };
  }

  const veri = cozumlenen.data;

  // Öğrenci ve veli bağları TEK işlemde: veli artık paylaşılan bir kayıt
  // (§17.1) ve eşleştirmesi sorgu gerektiriyor — iç içe `create` ile
  // yazılamıyor. Yarıda kalması öğrenciyi telefonsuz bırakırdı.
  const ogrenci = await db.$transaction(async (tx) => {
    // şube-muaf: öğrenci oturumdaki şubeye açılıyor (`branchId: subeId`).
    const kayit = await tx.student.create({
      data: {
        ...ogrenciAlanlari(veri),
        branchId: subeId,
        healthInfo: { create: saglikAlanlari(veri) },
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

  revalidatePath("/koordinator/ogrenciler");
  revalidatePath("/koordinator/zeka-testleri");
  // Yeni öğrenci süzgeçte seçili dönülüyor: liste boş görünür ("bu öğrencinin
  // testi yok"), yükleme formundaki seçici de onu gösterir.
  redirect(`/koordinator/zeka-testleri?ogrenci=${ogrenci.id}`);
}
