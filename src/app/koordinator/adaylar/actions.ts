"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LeadStage } from "@/generated/prisma/enums";
import { ACIK_ASAMALAR, ADAY_ASAMA_GECISLERI } from "@/lib/aday-durumlari";
import { adayYaz } from "@/lib/aday/aday-kaydi";
import type { BenzerKayit } from "@/lib/aday/mukerrer";
import { db } from "@/lib/db";
import {
  alanHatalari,
  formDegerleri,
  type EylemDurumu,
} from "@/lib/formlar";
import { tarihCozumle, zamanMetni } from "@/lib/tarih";
import { randevuAraligi, randevuEngeli } from "@/lib/randevu/cakisma";
import { uzmanBaglami } from "@/lib/randevu/uzman-baglami";
import { veliyiCoz } from "@/lib/randevu/veli";
import { saatiDakikayaCevir } from "../uzmanlar/sema";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import {
  ADAY_FORM_ALANLARI,
  ETKINLIK_FORM_ALANLARI,
  KAYIP_FORM_ALANLARI,
  RANDEVU_VER_FORM_ALANLARI,
  TAKIP_FORM_ALANLARI,
  adayDuzenlemeSemasi,
  adayFormundanOku,
  adaySemasi,
  etkinlikSemasi,
  kayipSemasi,
  randevuVerSemasi,
  takipSemasi,
} from "./sema";

/**
 * §16 — Aday (CRM) eylemleri.
 *
 * Ortak kurallar:
 *  - Her eylem `yonetimZorunlu("adaylar", "TAM")` ile başlar; şube oturumdan
 *    gelir, asla formdan.
 *  - Aşama değiştiren her eylem `updateMany({ where: { id, branchId, stage } })`
 *    + sayı kontrolü deseniyle yazar: hem şube sınırını hem de "bu arada
 *    başkası aşamayı değiştirdi mi" yarışını tek sorguda kapatır.
 *  - Aşama değişimi ve etkinlik satırı AYNI transaction'da yazılır: günlük,
 *    olmuş bir değişikliği kaçırmamalı.
 */

/** Ayrıntı sayfasının ve listenin önbelleğini birlikte tazeler. */
function adayYollariniTazele(adayId?: string) {
  revalidatePath("/koordinator/adaylar");
  if (adayId) revalidatePath(`/koordinator/adaylar/${adayId}`);
  revalidatePath("/koordinator");
}

/** Elle aday ekleme — mükerrer bulunursa yazmaz, uyarıyı forma taşır. */
export type AdayEylemDurumu = EylemDurumu & { benzer?: BenzerKayit };

export async function adayEkle(
  _oncekiDurum: AdayEylemDurumu,
  formVerisi: FormData,
): Promise<AdayEylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  const cozumlenen = adaySemasi.safeParse(adayFormundanOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, ADAY_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const sonuc = await adayYaz({
    subeId: kullanici.aktifSubeId,
    kanal: "elle",
    kaynak: veri.source,
    zorla: formVerisi.get("zorla") === "1",
    girdi: {
      parentName: veri.parentName,
      childName: veri.childName,
      childAge: veri.childAge,
      phone: veri.phone,
      email: veri.email,
      interestedProgram: veri.interestedProgram,
      message: veri.not,
      nextActionDate: veri.nextActionDate
        ? tarihCozumle(veri.nextActionDate)
        : null,
    },
    // KVKK açık rızası — saklama dayanağı (§16.11). Elle girişte onu alan
    // kişi işaretliyor; `adayYaz` `consentAt` damgasını kendisi basıyor.
    kvkkConsent: veri.kvkkOnay,
    createdByUserId: kullanici.id,
    // Elle açan kişi adayın sorumlusudur: telefonu o açtı, takibi o yürütür.
    // Kurum Yöneticisi istisna — şubesiz olduğu için şubenin sorumlu
    // listesinde hiç görünmez; atanırsa seçici kendi değerini gösteremez ve
    // aday "atanmamış" gibi okunur. O yüzden yalnız şubenin kadrosu atanır.
    assignedToUserId:
      kullanici.subeId === kullanici.aktifSubeId ? kullanici.id : null,
  });

  if (sonuc.sonuc === "benzer") {
    return {
      benzer: sonuc.benzer,
      degerler: formDegerleri(formVerisi, ADAY_FORM_ALANLARI),
    };
  }

  adayYollariniTazele();
  return { basari: `${veri.parentName} aday listesine eklendi.` };
}

/** Aday bilgilerini düzenleme — aşamaya ve boru hattı alanlarına dokunmaz. */
export async function adayGuncelle(
  adayId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  const cozumlenen = adayDuzenlemeSemasi.safeParse(
    adayFormundanOku(formVerisi),
  );
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, ADAY_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;

  /**
   * §16.11 — Onay damgası yalnız ONAY YOKKEN VERİLİRSE basılıyor.
   *
   * Her düzenlemede tazelenseydi "veli ne zaman rıza verdi" sorusu son
   * düzenleme tarihine dönerdi; onay geri çekilirse damga da siliniyor.
   */
  const mevcut = await db.lead.findFirst({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
    select: { kvkkConsent: true, consentAt: true },
  });

  const sonuc = await db.lead.updateMany({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
    data: {
      kvkkConsent: veri.kvkkOnay,
      consentAt: veri.kvkkOnay
        ? (mevcut?.kvkkConsent ? mevcut.consentAt : new Date())
        : null,
      parentName: veri.parentName,
      childName: veri.childName,
      childAge: veri.childAge,
      phone: veri.phone,
      searchPhone: normalizeTelefon(veri.phone) || null,
      searchName: normalizeArama(
        [veri.parentName, veri.childName].filter(Boolean).join(" "),
      ),
      email: veri.email,
      interestedProgram: veri.interestedProgram,
      // Kaynak DEĞİŞTİRİLMEZ: makine kaynağı elle kaynağa çevrilebilseydi
      // kaynak raporu geçmişe dönük bozulurdu.
    },
  });

  if (sonuc.count === 0) return { hata: "Aday bulunamadı." };

  adayYollariniTazele(adayId);
  return { basari: "Aday bilgileri güncellendi." };
}

/**
 * Aşama ilerletme — yalnız yük taşımayan geçişler (Ulaşıldı, Görüşme yapıldı).
 *
 * KAZANILDI ve KAYBEDILDI bu kapıdan GEÇMEZ: ikisi de zorunlu veri taşıyor
 * (öğrenci bağlantısı / kayıp sebebi) ve kendi eylemleri var. Randevu da
 * tarih istediği için ayrı.
 */
export async function asamaDegistir(
  adayId: string,
  hedef: LeadStage,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  if (hedef === "KAZANILDI" || hedef === "KAYBEDILDI") {
    return { hata: "Bu aşama kendi ekranından değiştirilir." };
  }

  const aday = await db.lead.findFirst({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
    select: { id: true, stage: true },
  });
  if (!aday) return { hata: "Aday bulunamadı." };

  if (!ADAY_ASAMA_GECISLERI[aday.stage].includes(hedef)) {
    return { hata: "Bu aşama geçişi yapılamaz." };
  }

  await db.$transaction(async (tx) => {
    const sonuc = await tx.lead.updateMany({
      // Aşama da koşulda: okuma ile yazma arasında başkası ilerlettiyse
      // bu güncelleme hiçbir satıra dokunmaz ve günlük çift satır yazmaz.
      where: { id: adayId, branchId: kullanici.aktifSubeId, stage: aday.stage },
      data: {
        stage: hedef,
        // Ulaşıldığı an sayaç sıfırlanır: "3 deneme" rozeti ancak ardışık
        // başarısızlıkları göstermeli.
        ...(hedef === "ULASILDI"
          ? { unreachableCount: 0, lastContactAt: new Date() }
          : {}),
      },
    });
    if (sonuc.count === 0) return;

    await tx.leadActivity.create({
      data: {
        leadId: adayId,
        type: "ASAMA_DEGISIMI",
        fromStage: aday.stage,
        toStage: hedef,
        createdByUserId: kullanici.id,
      },
    });
  });

  adayYollariniTazele(adayId);
  return { basari: "Aşama güncellendi." };
}

/**
 * Randevu verildi — hizmet + uzman + haftalık ızgaradan seçilen gün/saat
 * alır, GERÇEK bir `Randevu` açar ve aşamayı ilerletir.
 *
 * Veli formdan gelmez: adayın kendi `parentName`/`phone` alanından
 * `veliyiCoz` ile çözülür (mevcut veliyle eşleşir ya da açar) — `randevuEkle`
 * (randevular modülü) ile AYNI kural, aynı `lib/randevu` yardımcıları.
 * Çakışma kontrolü de aynı sıradan geçer: izin → mesai → çakışma.
 */
export async function randevuVer(
  adayId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");
  const subeId = kullanici.aktifSubeId;

  const cozumlenen = randevuVerSemasi.safeParse(
    Object.fromEntries(
      RANDEVU_VER_FORM_ALANLARI.map((alan) => [alan, formVerisi.get(alan) ?? ""]),
    ),
  );
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, RANDEVU_VER_FORM_ALANLARI),
    };
  }

  const { tarih, saat, not, hizmetId, uzmanId } = cozumlenen.data;
  // Her erken dönüşte geri yazılıyor: aksi hâlde React 19 kontrolsüz
  // alanları (uzman seçimi, not) sıfırlar ve `mesaiZorla` ile otomatik
  // yeniden gönderilen form BOŞ bir zorunlu alanda sessizce takılır (bkz.
  // randevu-formu.tsx'teki aynı gerekçe).
  const girilenler = formDegerleri(formVerisi, RANDEVU_VER_FORM_ALANLARI);

  const gun = tarihCozumle(tarih);
  if (!gun) return { hata: "Randevu zamanı çözümlenemedi.", degerler: girilenler };
  const baslangic = new Date(gun.getTime() + saatiDakikayaCevir(saat)! * 60_000);

  const aday = await db.lead.findFirst({
    where: { id: adayId, branchId: subeId },
    select: { id: true, stage: true, parentName: true, phone: true },
  });
  if (!aday) return { hata: "Aday bulunamadı.", degerler: girilenler };
  if (!ACIK_ASAMALAR.includes(aday.stage)) {
    return { hata: "Kapanmış adaya randevu verilemez.", degerler: girilenler };
  }
  if (!aday.parentName) {
    return { hata: "Önce veli adını kaydedin.", degerler: girilenler };
  }

  // Uzman bu hizmeti yapabiliyor mu — `randevuEkle`'deki aynı kontrol sırası.
  const yetkinlik = await db.uzmanHizmet.findUnique({
    where: { uzmanId_hizmetId: { uzmanId, hizmetId } },
    select: {
      uzman: {
        select: {
          ad: true,
          aktif: true,
          subeler: { where: { subeId }, select: { subeId: true } },
        },
      },
      hizmet: { select: { ad: true, aktif: true, sureDk: true, ucretKurus: true } },
    },
  });
  if (!yetkinlik) {
    return {
      alanHatalari: { hizmetId: "Bu uzman seçilen hizmeti uygulamıyor." },
      degerler: girilenler,
    };
  }
  if (!yetkinlik.uzman.aktif || !yetkinlik.hizmet.aktif) {
    return { hata: "Pasif uzman veya hizmetle randevu açılamaz.", degerler: girilenler };
  }
  if (yetkinlik.uzman.subeler.length === 0) {
    return {
      alanHatalari: { uzmanId: "Bu uzman bu şubede çalışmıyor." },
      degerler: girilenler,
    };
  }

  const aralik = randevuAraligi(baslangic, yetkinlik.hizmet.sureDk);
  const baglam = await uzmanBaglami({
    uzmanId,
    subeId,
    ilk: aralik.baslangic,
    son: aralik.bitis,
  });
  // Mesai dışı TEK istisna: kesin ret yerine onay istenir, form EVET'te
  // `mesaiZorla=1` ile geri gelir (bkz. `randevuEkle`/cakisma.ts). İzin ve
  // çakışma her zaman kesin ret.
  const mesaiZorla = formVerisi.get("mesaiZorla") === "1";
  const engel = randevuEngeli({ randevu: aralik, ...baglam, mesaiyiYokSay: mesaiZorla });
  if (engel) {
    if (engel.tur === "mesai") {
      return { onayGerekli: engel.mesaj, degerler: girilenler };
    }
    return { hata: engel.mesaj, degerler: girilenler };
  }

  const sonuc = await db.$transaction(async (tx) => {
    // Veli ÖNCE çözülüyor: bundan sonraki hiçbir adım henüz bir şey
    // yazmadı, bu yüzden burada başarısız olmak "geri dönmeye" değil
    // sadece "hiç başlamamaya" denk düşüyor (randevuEkle'deki aynı sıra).
    const veli = await veliyiCoz(tx, {
      subeId,
      veliId: null,
      ad: aday.parentName,
      telefon: aday.phone,
    });
    if (typeof veli !== "string") return veli;

    const guncellenen = await tx.lead.updateMany({
      where: { id: adayId, branchId: subeId, stage: aday.stage },
      data: {
        stage: "RANDEVU_VERILDI",
        appointmentAt: aralik.baslangic,
        unreachableCount: 0,
        lastContactAt: new Date(),
        // Randevu günü kuyruğa düşsün: aile o gün aranıp hatırlatılır.
        nextActionDate: gun,
      },
    });
    if (guncellenen.count === 0) {
      return { hata: "Aday bu sırada değişti; sayfayı yenileyip tekrar deneyin." };
    }

    await tx.randevu.create({
      data: {
        branchId: subeId,
        uzmanId,
        hizmetId,
        veliId: veli,
        leadId: adayId,
        baslangic: aralik.baslangic,
        bitis: aralik.bitis,
        ucretKurus: yetkinlik.hizmet.ucretKurus,
        not,
        createdByUserId: kullanici.id,
      },
    });

    if (aday.stage !== "RANDEVU_VERILDI") {
      await tx.leadActivity.create({
        data: {
          leadId: adayId,
          type: "ASAMA_DEGISIMI",
          fromStage: aday.stage,
          toStage: "RANDEVU_VERILDI",
          createdByUserId: kullanici.id,
        },
      });
    }

    await tx.leadActivity.create({
      data: {
        leadId: adayId,
        type: "SISTEM",
        note: `Randevu verildi: ${yetkinlik.hizmet.ad} · ${yetkinlik.uzman.ad} · ${zamanMetni(baslangic)}`,
        createdByUserId: kullanici.id,
      },
    });
    return null;
  });

  if (sonuc) return { ...sonuc, degerler: girilenler };

  adayYollariniTazele(adayId);
  revalidatePath("/koordinator/randevular");
  return { basari: "Randevu kaydedildi." };
}

/** Kaybedildi — sebep zorunlu; boru hattı alanları temizlenir. */
export async function adayiKaybet(
  adayId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  const cozumlenen = kayipSemasi.safeParse({
    lossReason: formVerisi.get("lossReason"),
    lossNote: formVerisi.get("lossNote"),
  });
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, KAYIP_FORM_ALANLARI),
    };
  }

  const aday = await db.lead.findFirst({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
    select: { id: true, stage: true },
  });
  if (!aday) return { hata: "Aday bulunamadı." };
  if (!ACIK_ASAMALAR.includes(aday.stage)) {
    return { hata: "Bu aday zaten kapanmış." };
  }

  await db.$transaction(async (tx) => {
    const sonuc = await tx.lead.updateMany({
      where: { id: adayId, branchId: kullanici.aktifSubeId, stage: aday.stage },
      data: {
        stage: "KAYBEDILDI",
        lossReason: cozumlenen.data.lossReason,
        lossNote: cozumlenen.data.lossNote,
        lostAt: new Date(),
        // Kapanan aday kuyrukta iş üretmemeli.
        nextActionDate: null,
        nextActionNote: null,
      },
    });
    if (sonuc.count === 0) return;

    await tx.leadActivity.create({
      data: {
        leadId: adayId,
        type: "ASAMA_DEGISIMI",
        fromStage: aday.stage,
        toStage: "KAYBEDILDI",
        createdByUserId: kullanici.id,
      },
    });
  });

  adayYollariniTazele(adayId);
  return { basari: "Aday kaybedildi olarak işaretlendi." };
}

/** Yanlışlıkla kapatılan adayı geri açar; kayıp alanları temizlenir. */
export async function adayiYenidenAc(adayId: string): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  const sonuc = await db.$transaction(async (tx) => {
    const guncelleme = await tx.lead.updateMany({
      where: {
        id: adayId,
        branchId: kullanici.aktifSubeId,
        stage: "KAYBEDILDI",
      },
      data: {
        stage: "YENI",
        lossReason: null,
        lossNote: null,
        lostAt: null,
      },
    });
    if (guncelleme.count === 0) return 0;

    await tx.leadActivity.create({
      data: {
        leadId: adayId,
        type: "ASAMA_DEGISIMI",
        fromStage: "KAYBEDILDI",
        toStage: "YENI",
        createdByUserId: kullanici.id,
      },
    });
    return guncelleme.count;
  });

  if (sonuc === 0) return { hata: "Yalnızca kaybedilmiş aday yeniden açılır." };

  adayYollariniTazele(adayId);
  return { basari: "Aday yeniden açıldı." };
}

/**
 * Etkinlik günlüğü — arama, ulaşılamadı, WhatsApp, not.
 *
 * "Ulaşılamadı" tek dokunuşla çalışan asıl düğme: sayaç artar ve takip
 * tarihi verilmemişse yarına alınır (aday kuyrukta kalsın). Aşamaya
 * dokunulmaz — ulaşılamamak bir aşama değil, denemenin sonucudur.
 */
export async function etkinlikEkle(
  adayId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  const cozumlenen = etkinlikSemasi.safeParse({
    type: formVerisi.get("type"),
    note: formVerisi.get("note"),
    nextActionDate: formVerisi.get("nextActionDate"),
  });
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, ETKINLIK_FORM_ALANLARI),
    };
  }

  const { type, note, nextActionDate } = cozumlenen.data;
  if (type === "NOT" && !note) {
    return { alanHatalari: { note: "Not metni gerekli." } };
  }

  const aday = await db.lead.findFirst({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
    select: { id: true, stage: true },
  });
  if (!aday) return { hata: "Aday bulunamadı." };

  const secilenTarih = nextActionDate ? tarihCozumle(nextActionDate) : null;
  const yarin = new Date();
  yarin.setUTCHours(0, 0, 0, 0);
  yarin.setUTCDate(yarin.getUTCDate() + 1);

  await db.$transaction(async (tx) => {
    await tx.leadActivity.create({
      data: {
        leadId: adayId,
        type,
        note,
        createdByUserId: kullanici.id,
      },
    });

    await tx.lead.updateMany({
      where: { id: adayId, branchId: kullanici.aktifSubeId },
      data: {
        ...(type === "ULASILAMADI"
          ? {
              unreachableCount: { increment: 1 },
              // Ulaşılamayan aday kuyruktan düşmemeli: tarih verilmediyse
              // yarına alınır. Sihirli davranış, arayüzde açıkça yazılıyor.
              nextActionDate: secilenTarih ?? yarin,
            }
          : {
              lastContactAt: new Date(),
              ...(secilenTarih ? { nextActionDate: secilenTarih } : {}),
            }),
      },
    });
  });

  adayYollariniTazele(adayId);
  return {
    basari:
      type === "ULASILAMADI"
        ? secilenTarih
          ? "Ulaşılamadı kaydedildi."
          : "Ulaşılamadı kaydedildi · sonraki arama yarına alındı."
        : "Kaydedildi.",
  };
}

/**
 * "Arandı — ulaşılamadı" tek dokunuşu.
 *
 * Ekrandaki en sık basılan düğme; form açtırmak akışı kesiyordu. Sayaç artar
 * ve aday yarına ertelenir — davranış sihirli görünmesin diye arayüz bunu
 * açıkça yazıyor ve tarih alanı hemen altta düzeltilebilir duruyor.
 */
export async function ulasilamadiKaydet(
  adayId: string,
): Promise<EylemDurumu> {
  const formVerisi = new FormData();
  formVerisi.set("type", "ULASILAMADI");
  return etkinlikEkle(adayId, {}, formVerisi);
}

/** Takip tarihi ve notu. */
export async function takipTarihiAta(
  adayId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  const cozumlenen = takipSemasi.safeParse({
    nextActionDate: formVerisi.get("nextActionDate"),
    nextActionNote: formVerisi.get("nextActionNote"),
  });
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, TAKIP_FORM_ALANLARI),
    };
  }

  const { nextActionDate, nextActionNote } = cozumlenen.data;
  const sonuc = await db.lead.updateMany({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
    data: {
      nextActionDate: nextActionDate ? tarihCozumle(nextActionDate) : null,
      nextActionNote,
    },
  });
  if (sonuc.count === 0) return { hata: "Aday bulunamadı." };

  adayYollariniTazele(adayId);
  return { basari: "Takip bilgisi kaydedildi." };
}

/** Sorumlu danışman ataması — boş değer sorumluyu kaldırır. */
export async function sorumluAta(
  adayId: string,
  kullaniciId: string,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  if (kullaniciId) {
    // Sorumlu aynı şubenin kadrosundan olmalı: başka şubenin kullanıcısı
    // adayı kendi ekranında zaten göremezdi.
    const hedef = await db.user.findFirst({
      where: {
        id: kullaniciId,
        branchId: kullanici.aktifSubeId,
        active: true,
      },
      select: { id: true },
    });
    if (!hedef) return { hata: "Kullanıcı bu şubede bulunamadı." };
  }

  const sonuc = await db.lead.updateMany({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
    data: { assignedToUserId: kullaniciId || null },
  });
  if (sonuc.count === 0) return { hata: "Aday bulunamadı." };

  adayYollariniTazele(adayId);
  return { basari: "Sorumlu güncellendi." };
}

/**
 * §16.11 — Adayı KALICI olarak siler (KVKK silme talebi).
 *
 * Kurumun aday verisini saklama dayanağı velinin açık rızası; rıza geri
 * çekildiğinde kaydın gitmesi gerekiyor. Bu yüzden aday, panelin başka hiçbir
 * yerinde olmayan bir şeye sahip: gerçek silme. Kayıp sebebiyle kapatmak
 * (`KAYBEDILDI`) veriyi saklamaya devam eder ve silme talebini karşılamaz.
 *
 * ÖĞRENCİYE DÖNÜŞMÜŞ ADAY SİLİNMEZ. O verinin dayanağı artık rıza değil,
 * kurulan hizmet ilişkisi; kaydın kendisi de öğrenci profilinde duruyor.
 * Silme talebi gelirse öğrenci kaydı üzerinden yürütülmeli — mesaj bunu
 * söylüyor, sessizce reddetmiyor.
 *
 * Etkinlik satırları şemadaki Cascade ile birlikte düşüyor: aday silinince
 * onun görüşme geçmişinin ayakta kalmasının bir anlamı yok.
 */
export async function adaySil(adayId: string): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  const aday = await db.lead.findFirst({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
    select: {
      parentName: true,
      convertedStudentId: true,
      _count: { select: { activities: true } },
    },
  });

  if (!aday) return { hata: "Aday bulunamadı." };

  const ad = aday.parentName ?? "Aday";

  if (aday.convertedStudentId) {
    return {
      hata:
        `${ad} silinemez: bu aday öğrenciye dönüştü ve verisinin dayanağı ` +
        `artık kurulan hizmet ilişkisi. Silme talebi öğrenci kaydı üzerinden ` +
        `yürütülmeli.`,
    };
  }

  await db.lead.deleteMany({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
  });

  revalidatePath("/koordinator/adaylar");
  revalidatePath("/koordinator");

  /**
   * LİSTEYE YÖNLENDİR (`ogrenciSil` deseni). Eylem burada bir mesajla
   * dönseydi kullanıcı silinen kaydın sayfasında kalırdı ve o sayfa artık
   * 404 — silmeyi yapan kişiye hata ekranı göstermek olurdu.
   */
  redirect(
    `/koordinator/adaylar?silinen=${encodeURIComponent(ad)}&etkinlik=${aday._count.activities}`,
  );
}
