"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { alanHatalari, formDegerleri } from "@/lib/formlar";
import type { EylemDurumu } from "@/lib/formlar";
import { tarihCozumle } from "@/lib/tarih";
import {
  hizmetSemasi,
  izinSemasi,
  liradanKurusa,
  mesaiSemasi,
  saatiDakikayaCevir,
  uzmanSemasi,
} from "./sema";

/**
 * §17.3 — Uzman kadrosu, mesai, izin ve hizmet kataloğu yazma işlemleri.
 *
 * YETKİ: hepsi `uzmanlar` modülünde TAM ister — yani Kurum Yöneticisi ve
 * Şube Yöneticisi. Koordinatör ve danışma masası bu ekranı GÖRÜNTÜLER ama
 * kadroyu ve fiyat listesini değiştiremez (yetkiler.ts "kadro yönetimi"
 * ayrımı).
 *
 * ŞUBE: uzman çok şubeli olduğu için tek bir `branchId` süzgeci yok; yazma
 * yetkisi olan iki rolden Şube Yöneticisi yalnız kendi şubesini işaretleyip
 * kaldırabilir. Bu kural `secilebilirSubeler` üzerinden zorlanıyor —
 * oturumun göremediği bir şube kimliği forma elle eklense bile düşürülür.
 */

const UZMAN_FORM_ALANLARI = ["ad", "renk", "calismaTipi", "userId"] as const;
const HIZMET_FORM_ALANLARI = [
  "ad",
  "grup",
  "sureDk",
  "ucretLira",
  "yasAlt",
  "yasUst",
  "danisanTuru",
] as const;

function tazele(uzmanId?: string) {
  revalidatePath("/koordinator/uzmanlar");
  revalidatePath("/koordinator/uzmanlar/hizmetler");
  if (uzmanId) revalidatePath(`/koordinator/uzmanlar/${uzmanId}`);
}

/**
 * Formdan gelen şube seçimini oturumun görebildiği şubelerle kesiştirir.
 *
 * Şube Yöneticisi başka şubenin kadrosuna dokunamaz; seçici zaten tek şube
 * gösteriyor ama asıl sınır burası (menüden gizlemek yetki değildir kuralı).
 */
function subeleriSuz(
  secilen: string[],
  secilebilir: readonly { id: string }[],
): string[] {
  const izinli = new Set(secilebilir.map((sube) => sube.id));
  return secilen.filter((id) => izinli.has(id));
}

function uzmanFormunuOku(formVerisi: FormData) {
  return {
    ad: formVerisi.get("ad"),
    renk: formVerisi.get("renk"),
    calismaTipi: formVerisi.get("calismaTipi"),
    subeIdleri: formVerisi.getAll("subeIdleri").map(String),
    hizmetIdleri: formVerisi.getAll("hizmetIdleri").map(String),
    userId: formVerisi.get("userId") ?? "",
  };
}

export async function uzmanEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("uzmanlar", "TAM");

  const cozumlenen = uzmanSemasi.safeParse(uzmanFormunuOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, UZMAN_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const subeIdleri = subeleriSuz(veri.subeIdleri, kullanici.secilebilirSubeler);
  if (subeIdleri.length === 0) {
    return {
      alanHatalari: { subeIdleri: "Yetkiniz olan bir şube seçin." },
      degerler: formDegerleri(formVerisi, UZMAN_FORM_ALANLARI),
    };
  }

  // şube-muaf: `Uzman` çok şubeli, kendi `branchId` sütunu yok; şube bağı
  // `UzmanSube` satırlarında ve yukarıda oturumun şubeleriyle kesiştirildi.
  const uzman = await db.uzman.create({
    data: {
      ad: veri.ad,
      renk: veri.renk,
      calismaTipi: veri.calismaTipi,
      userId: veri.userId,
      subeler: { create: subeIdleri.map((subeId) => ({ subeId })) },
      hizmetler: {
        create: veri.hizmetIdleri.map((hizmetId) => ({ hizmetId })),
      },
    },
    select: { id: true },
  });

  tazele(uzman.id);
  return { basari: `${veri.ad} kadroya eklendi.` };
}

export async function uzmanGuncelle(
  uzmanId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("uzmanlar", "TAM");

  const cozumlenen = uzmanSemasi.safeParse(uzmanFormunuOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, UZMAN_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const subeIdleri = subeleriSuz(veri.subeIdleri, kullanici.secilebilirSubeler);
  if (subeIdleri.length === 0) {
    return {
      alanHatalari: { subeIdleri: "Yetkiniz olan bir şube seçin." },
      degerler: formDegerleri(formVerisi, UZMAN_FORM_ALANLARI),
    };
  }

  await db.$transaction(async (tx) => {
    // şube-muaf: uzman çok şubeli (bkz. `uzmanEkle`).
    await tx.uzman.update({
      where: { id: uzmanId },
      data: {
        ad: veri.ad,
        renk: veri.renk,
        calismaTipi: veri.calismaTipi,
        userId: veri.userId,
      },
    });

    // Şube ve yetkinlik satırları silinip yeniden yazılıyor: iki kısa liste
    // için fark hesaplamak daha uzun ve daha hataya açık olurdu.
    //
    // Şube Yöneticisi yalnız KENDİ şubesinin satırını silebilir; başka
    // şubenin bağını silmek kadroyu o şubenin takviminden düşürürdü.
    await tx.uzmanSube.deleteMany({
      where: {
        uzmanId,
        subeId: { in: kullanici.secilebilirSubeler.map((sube) => sube.id) },
      },
    });
    await tx.uzmanSube.createMany({
      data: subeIdleri.map((subeId) => ({ uzmanId, subeId })),
      skipDuplicates: true,
    });

    await tx.uzmanHizmet.deleteMany({ where: { uzmanId } });
    if (veri.hizmetIdleri.length > 0) {
      await tx.uzmanHizmet.createMany({
        data: veri.hizmetIdleri.map((hizmetId) => ({ uzmanId, hizmetId })),
        skipDuplicates: true,
      });
    }
  });

  tazele(uzmanId);
  return { basari: "Uzman bilgileri güncellendi." };
}

/**
 * Uzmanı pasife alır veya geri açar.
 *
 * SİLME YOK: uzmanın geçmiş randevuları ve cirosu ona bağlı; kaydı silmek o
 * geçmişi de götürürdü. Pasif uzman randevu formunda seçilemez, takvimdeki
 * eski randevularında görünmeye devam eder.
 */
export async function uzmanDurumDegistir(
  uzmanId: string,
  aktif: boolean,
): Promise<EylemDurumu> {
  await yonetimZorunlu("uzmanlar", "TAM");

  // şube-muaf: uzman çok şubeli (bkz. `uzmanEkle`).
  const uzman = await db.uzman.update({
    where: { id: uzmanId },
    data: { aktif },
    select: { ad: true },
  });

  tazele(uzmanId);
  return {
    basari: aktif
      ? `${uzman.ad} yeniden kadroya alındı.`
      : `${uzman.ad} pasife alındı; yeni randevu açılamaz.`,
  };
}

// ---------------------------------------------------------------------------
// Mesai
// ---------------------------------------------------------------------------

export async function mesaiEkle(
  uzmanId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("uzmanlar", "TAM");

  const cozumlenen = mesaiSemasi.safeParse({
    gun: formVerisi.get("gun"),
    subeId: formVerisi.get("subeId"),
    baslangic: formVerisi.get("baslangic"),
    bitis: formVerisi.get("bitis"),
  });
  if (!cozumlenen.success) {
    return { alanHatalari: alanHatalari(cozumlenen.error) };
  }

  const veri = cozumlenen.data;
  const [subeId] = subeleriSuz([veri.subeId], kullanici.secilebilirSubeler);
  if (!subeId) {
    return { alanHatalari: { subeId: "Yetkiniz olan bir şube seçin." } };
  }

  const baslangicDk = saatiDakikayaCevir(veri.baslangic)!;
  const bitisDk = saatiDakikayaCevir(veri.bitis)!;

  // Uzmanın aynı gün ve şubede çakışan iki mesai aralığı olamaz: "bu saat
  // mesai içinde mi" sorusunun cevabı belirsizleşirdi.
  //
  // şube-muaf: sorgu `subeId` taşıyor ve o kimlik yukarıda oturumun
  // şubeleriyle kesiştirildi.
  const cakisan = await db.uzmanMesai.findFirst({
    where: {
      uzmanId,
      subeId,
      gun: veri.gun,
      baslangicDk: { lt: bitisDk },
      bitisDk: { gt: baslangicDk },
    },
    select: { id: true },
  });

  if (cakisan) {
    return {
      hata: "Bu gün ve şubede çakışan bir mesai aralığı zaten var.",
    };
  }

  await db.uzmanMesai.create({
    data: { uzmanId, subeId, gun: veri.gun, baslangicDk, bitisDk },
  });

  tazele(uzmanId);
  return { basari: "Mesai aralığı eklendi." };
}

export async function mesaiSil(
  uzmanId: string,
  mesaiId: string,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("uzmanlar", "TAM");

  // Şube Yöneticisi başka şubenin mesaisini silemez.
  const sonuc = await db.uzmanMesai.deleteMany({
    where: {
      id: mesaiId,
      uzmanId,
      subeId: { in: kullanici.secilebilirSubeler.map((sube) => sube.id) },
    },
  });

  if (sonuc.count === 0) return { hata: "Mesai aralığı bulunamadı." };

  tazele(uzmanId);
  return { basari: "Mesai aralığı kaldırıldı." };
}

// ---------------------------------------------------------------------------
// İzin
// ---------------------------------------------------------------------------

export async function izinEkle(
  uzmanId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("uzmanlar", "TAM");

  const cozumlenen = izinSemasi.safeParse({
    baslangicTarih: formVerisi.get("baslangicTarih"),
    bitisTarih: formVerisi.get("bitisTarih"),
    tamGun: formVerisi.get("tamGun") === "on",
    baslangicSaat: formVerisi.get("baslangicSaat") ?? "",
    bitisSaat: formVerisi.get("bitisSaat") ?? "",
    sebep: (formVerisi.get("sebep") as string)?.trim() || null,
  });
  if (!cozumlenen.success) {
    return { alanHatalari: alanHatalari(cozumlenen.error) };
  }

  const veri = cozumlenen.data;
  const baslangicGun = tarihCozumle(veri.baslangicTarih);
  const bitisGun = tarihCozumle(veri.bitisTarih);

  if (!baslangicGun || !bitisGun) {
    return { alanHatalari: { baslangicTarih: "Tarih GG.AA.YYYY seçilmeli." } };
  }

  /**
   * Aralık kapalı-açık (`baslangic` dahil, `bitis` hariç). Tam gün izinde
   * bitiş ERTESİ GÜNÜN başına taşınır: "1–3 Eylül izinli" denildiğinde
   * 3 Eylül'ün tamamı da izin sayılmalı.
   *
   * Saatler duvar saati olarak UTC'de saklanır — panelin `Lead.appointmentAt`
   * ile kurduğu sözleşmenin aynısı (bkz. lib/tarih.ts).
   */
  const baslangic = new Date(
    baslangicGun.getTime() +
      (veri.tamGun ? 0 : saatiDakikayaCevir(veri.baslangicSaat)! * 60_000),
  );
  const bitis = new Date(
    bitisGun.getTime() +
      (veri.tamGun
        ? 24 * 60 * 60_000
        : saatiDakikayaCevir(veri.bitisSaat)! * 60_000),
  );

  if (baslangic >= bitis) {
    return {
      alanHatalari: { bitisTarih: "Bitiş, başlangıçtan sonra olmalı." },
    };
  }

  await db.izin.create({
    data: {
      uzmanId,
      baslangic,
      bitis,
      sebep: veri.sebep,
      createdByUserId: kullanici.id,
    },
  });

  tazele(uzmanId);
  return { basari: "İzin kaydedildi." };
}

export async function izinSil(
  uzmanId: string,
  izinId: string,
): Promise<EylemDurumu> {
  await yonetimZorunlu("uzmanlar", "TAM");

  const sonuc = await db.izin.deleteMany({ where: { id: izinId, uzmanId } });
  if (sonuc.count === 0) return { hata: "İzin kaydı bulunamadı." };

  tazele(uzmanId);
  return { basari: "İzin kaldırıldı." };
}

// ---------------------------------------------------------------------------
// Hizmet kataloğu
// ---------------------------------------------------------------------------

function hizmetFormunuOku(formVerisi: FormData) {
  return {
    ad: formVerisi.get("ad"),
    grup: formVerisi.get("grup"),
    sureDk: formVerisi.get("sureDk"),
    ucretLira: formVerisi.get("ucretLira"),
    yasAlt: formVerisi.get("yasAlt") ?? "",
    yasUst: formVerisi.get("yasUst") ?? "",
    danisanTuru: formVerisi.get("danisanTuru"),
    tekrarli: formVerisi.get("tekrarli") === "on",
  };
}

export async function hizmetEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await yonetimZorunlu("uzmanlar", "TAM");

  const cozumlenen = hizmetSemasi.safeParse(hizmetFormunuOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, HIZMET_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  // Zod dışındaki kontrollerde de girilenler geri veriliyor: React 19 form
  // eylemi tamamlanınca alanları sıfırlıyor ve kullanıcı yazdıklarını
  // kaybediyor (bkz. lib/formlar.ts `formDegerleri`).
  const girilenler = formDegerleri(formVerisi, HIZMET_FORM_ALANLARI);

  if (veri.yasAlt !== null && veri.yasUst !== null && veri.yasAlt > veri.yasUst) {
    return {
      alanHatalari: { yasUst: "Üst yaş, alt yaştan küçük olamaz." },
      degerler: girilenler,
    };
  }

  const varOlan = await db.hizmet.findUnique({
    where: { ad: veri.ad },
    select: { id: true },
  });
  if (varOlan) {
    return {
      alanHatalari: { ad: "Bu adda bir hizmet zaten var." },
      degerler: girilenler,
    };
  }

  const sonSira = await db.hizmet.aggregate({ _max: { sortOrder: true } });

  await db.hizmet.create({
    data: {
      ad: veri.ad,
      grup: veri.grup,
      sureDk: veri.sureDk,
      ucretKurus: liradanKurusa(veri.ucretLira),
      yasAlt: veri.yasAlt,
      yasUst: veri.yasUst,
      danisanTuru: veri.danisanTuru,
      tekrarli: veri.tekrarli,
      sortOrder: (sonSira._max.sortOrder ?? 0) + 1,
    },
  });

  tazele();
  return { basari: `${veri.ad} kataloğa eklendi.` };
}

export async function hizmetGuncelle(
  hizmetId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await yonetimZorunlu("uzmanlar", "TAM");

  const cozumlenen = hizmetSemasi.safeParse(hizmetFormunuOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, HIZMET_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const girilenler = formDegerleri(formVerisi, HIZMET_FORM_ALANLARI);

  if (veri.yasAlt !== null && veri.yasUst !== null && veri.yasAlt > veri.yasUst) {
    return {
      alanHatalari: { yasUst: "Üst yaş, alt yaştan küçük olamaz." },
      degerler: girilenler,
    };
  }

  const adSahibi = await db.hizmet.findUnique({
    where: { ad: veri.ad },
    select: { id: true },
  });
  if (adSahibi && adSahibi.id !== hizmetId) {
    return {
      alanHatalari: { ad: "Bu adda başka bir hizmet var." },
      degerler: girilenler,
    };
  }

  /**
   * FİYAT GEÇMİŞE İŞLEMEZ: randevu açılırken ücret kaydın kendisine
   * kopyalanıyor (§17.4), bu yüzden buradaki zam yalnız bundan sonra
   * açılacak randevuları etkiler. Geçmiş haftaların cirosu sabit kalır.
   */
  await db.hizmet.update({
    where: { id: hizmetId },
    data: {
      ad: veri.ad,
      grup: veri.grup,
      sureDk: veri.sureDk,
      ucretKurus: liradanKurusa(veri.ucretLira),
      yasAlt: veri.yasAlt,
      yasUst: veri.yasUst,
      danisanTuru: veri.danisanTuru,
      tekrarli: veri.tekrarli,
    },
  });

  tazele();
  return { basari: "Hizmet güncellendi." };
}

/**
 * Hizmeti pasife alır veya geri açar.
 *
 * SİLME YOK: geçmiş randevular bu hizmete bağlı ve ciro raporu hizmet
 * kırılımını ondan okuyor. Pasif hizmet yeni randevuda seçilemez.
 */
export async function hizmetDurumDegistir(
  hizmetId: string,
  aktif: boolean,
): Promise<EylemDurumu> {
  await yonetimZorunlu("uzmanlar", "TAM");

  const hizmet = await db.hizmet.update({
    where: { id: hizmetId },
    data: { aktif },
    select: { ad: true },
  });

  tazele();
  return {
    basari: aktif
      ? `${hizmet.ad} yeniden açıldı.`
      : `${hizmet.ad} pasife alındı; yeni randevuda seçilemez.`,
  };
}
