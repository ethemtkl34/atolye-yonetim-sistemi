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
import { tarihCozumle } from "@/lib/tarih";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import {
  ADAY_FORM_ALANLARI,
  ETKINLIK_FORM_ALANLARI,
  KAYIP_FORM_ALANLARI,
  RANDEVU_FORM_ALANLARI,
  TAKIP_FORM_ALANLARI,
  adayDuzenlemeSemasi,
  adayFormundanOku,
  adaySemasi,
  etkinlikSemasi,
  kayipSemasi,
  randevuSemasi,
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

/** Randevu verildi — tarih (ve varsa saat) alır, aşamayı ilerletir. */
export async function randevuVer(
  adayId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");

  const cozumlenen = randevuSemasi.safeParse({
    tarih: formVerisi.get("tarih"),
    saat: formVerisi.get("saat"),
    not: formVerisi.get("not"),
  });
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, RANDEVU_FORM_ALANLARI),
    };
  }

  const { tarih, saat, not } = cozumlenen.data;

  // Gün ve saat AYRI birleştiriliyor: `tarihCozumle` bilerek yalnız
  // "YYYY-MM-DD" kabul ediyor (31 Şubat gibi taşmaları yakalamak için) ve
  // "…T14:30" verilince null dönüyordu — ilk sürümde saat girilen her
  // randevu bu yüzden kaydedilemiyordu.
  const randevu = tarihCozumle(tarih);
  if (!randevu) return { hata: "Randevu zamanı çözümlenemedi." };
  if (saat) {
    const [saatKismi, dakikaKismi] = saat.split(":");
    randevu.setUTCHours(Number(saatKismi), Number(dakikaKismi), 0, 0);
  }

  const aday = await db.lead.findFirst({
    where: { id: adayId, branchId: kullanici.aktifSubeId },
    select: { id: true, stage: true },
  });
  if (!aday) return { hata: "Aday bulunamadı." };
  if (!ACIK_ASAMALAR.includes(aday.stage)) {
    return { hata: "Kapanmış adaya randevu verilemez." };
  }

  await db.$transaction(async (tx) => {
    const sonuc = await tx.lead.updateMany({
      where: { id: adayId, branchId: kullanici.aktifSubeId, stage: aday.stage },
      data: {
        stage: "RANDEVU_VERILDI",
        appointmentAt: randevu,
        unreachableCount: 0,
        lastContactAt: new Date(),
        // Randevu günü kuyruğa düşsün: aile o gün aranıp hatırlatılır.
        nextActionDate: tarihCozumle(tarih),
      },
    });
    if (sonuc.count === 0) return;

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
        note: `Randevu verildi: ${tarih}${saat ? ` ${saat}` : ""}${not ? ` — ${not}` : ""}`,
        createdByUserId: kullanici.id,
      },
    });
  });

  adayYollariniTazele(adayId);
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
