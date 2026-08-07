"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { bugun, tarihBicimle, tarihCozumle } from "@/lib/tarih";
import { formDegerleri } from "@/lib/formlar";
import {
  MINI_TEST_SORULARI,
  veliBriefiUret,
  type MiniTestCevabi,
  type VeliBriefi,
} from "@/lib/veli-gorusmesi";
import { veliBriefGirdisiHazirla } from "@/lib/veli-gorusmesi-verisi";
import type { EylemDurumu } from "@/lib/formlar";

/**
 * Veli görüşmeleri — brief önizleme, kayıt, not ve silme.
 *
 * Bütün yazma işlemleri Danışmanlık sayfasından yapılır; öğrenci profili bu
 * kayıtları yalnızca gösterir. Öğrenci bu yüzden bind ile değil formdaki
 * seçiciden gelir ve şube kapısından geçirilir.
 *
 * GİZLİLİK: Veli görüşmeleri de terapi görüşmeleri gibi stajyerden tamamen
 * gizlidir; bu eylemler ve okuma sorgusu yalnızca koordinatör ekranlarından
 * çağrılır (`yonetimZorunlu`).
 *
 * ŞUBE: Öğrenci ve görüşme id'leri istemciden geliyor; her işlem
 * `branchId`/`student.branchId` ile aktif şubeye kilitli doğrulanır.
 *
 * ÖNİZLEME ↔ KAYIT: Brief metni deterministik üretiliyor (`veli-gorusmesi.ts`);
 * kayıt eylemi önizlenen metni istemciden geri almak yerine aynı girdiden
 * SUNUCUDA yeniden üretir. Arada yeni puanlama girildiyse brief daha güncel
 * veriyle değişebilir — kabul edilen davranış. P13'te metin AI'a geçince bu
 * varsayım bozulur; o gün önizlenen metnin kendisi saklanmalı.
 */

export type VeliGorusmesiEylemDurumu = EylemDurumu & {
  /** Önizleme sonucu — form kaydedilmeden formun altında gösterilir. */
  brief?: VeliBriefi;
};

/** Mini test cevap alanının form adı: `cevap-sosyallik` gibi. */
const cevapAlani = (anahtar: string) => `cevap-${anahtar}`;

const VELI_FORM_ALANLARI = [
  "ogrenciId",
  "tarih",
  "gorusmeciAdi",
  ...MINI_TEST_SORULARI.map((soru) => cevapAlani(soru.anahtar)),
] as const;

const veliGorusmesiSemasi = z.object({
  ogrenciId: z.string().min(1, "Öğrenci seçin"),
  /** Boş bırakılabilir — o zaman bugün sayılır (terapi görüşmesi deseni). */
  tarih: z.string().trim(),
  gorusmeciAdi: z
    .string()
    .trim()
    .min(1, "Görüşmeyi yapacak kişinin adını yazın")
    .max(100, "Ad en fazla 100 karakter olabilir"),
});

type CozumlenmisForm = {
  ogrenciId: string;
  tarih: Date;
  gorusmeciAdi: string;
  cevaplar: MiniTestCevabi[];
};

/**
 * Tarih + görüşmeci + mini test cevaplarını çözer; hata varsa girilenlerle
 * birlikte durum döner. Önizleme ve kayıt aynı doğrulamadan geçer — iki ayrı
 * kural seti olsaydı önizlenebilen ama kaydedilemeyen form oluşurdu.
 */
function formuCozumle(
  formVerisi: FormData,
): { veri: CozumlenmisForm } | { durum: VeliGorusmesiEylemDurumu } {
  const girilenler = formDegerleri(formVerisi, VELI_FORM_ALANLARI);
  const alanHatalari: Record<string, string> = {};

  const cozumlenen = veliGorusmesiSemasi.safeParse({
    ogrenciId: formVerisi.get("ogrenciId"),
    tarih: formVerisi.get("tarih"),
    gorusmeciAdi: formVerisi.get("gorusmeciAdi"),
  });

  if (!cozumlenen.success) {
    for (const sorun of cozumlenen.error.issues) {
      const alan = sorun.path.join(".");
      if (alan && !alanHatalari[alan]) alanHatalari[alan] = sorun.message;
    }
  }

  // Cevaplar radio gruplarından geliyor; boş bırakılan soru işaretlenir.
  // Soru metni cevapla birlikte saklanır (snapshot ilkesi): sorular sonradan
  // değişse de geçmiş kayıt o günkü metni gösterir.
  const cevaplar: MiniTestCevabi[] = [];
  for (const soru of MINI_TEST_SORULARI) {
    const ham = formVerisi.get(cevapAlani(soru.anahtar));
    const deger = typeof ham === "string" ? Number(ham) : NaN;
    if (!Number.isInteger(deger) || deger < 1 || deger > 5) {
      alanHatalari[cevapAlani(soru.anahtar)] = "Bu soruyu cevaplayın.";
      continue;
    }
    cevaplar.push({ anahtar: soru.anahtar, soruMetni: soru.metin, deger });
  }

  if (Object.keys(alanHatalari).length > 0) {
    return { durum: { alanHatalari, degerler: girilenler } };
  }

  const gorusmeciAdi = cozumlenen.success ? cozumlenen.data.gorusmeciAdi : "";
  const ogrenciId = cozumlenen.success ? cozumlenen.data.ogrenciId : "";
  const tarihMetni = cozumlenen.success ? cozumlenen.data.tarih : "";

  const tarih = tarihMetni ? tarihCozumle(tarihMetni) : bugun();
  if (!tarih) {
    return {
      durum: {
        alanHatalari: { tarih: "Geçerli bir tarih seçin." },
        degerler: girilenler,
      },
    };
  }

  // Gelecek tarih BİLİNÇLİ olarak serbest (terapi görüşmesinin tersi):
  // kayıt görüşmeden önce, brief hazırlamak için açılıyor — randevu gibi
  // ileri tarihli olması işin doğası. Atölye özeti o tarihe kadarki
  // oturumları kapsar.
  return { veri: { ogrenciId, tarih, gorusmeciAdi, cevaplar } };
}

/** Öğrenciyi aktif şubeye kilitli doğrular; brief girdisi için adını da alır. */
async function ogrenciyiBul(ogrenciId: string, subeId: string) {
  return db.student.findFirst({
    where: { id: ogrenciId, branchId: subeId },
    select: { id: true, firstName: true },
  });
}

/**
 * Formun tek gönderme eylemi. Niyet, tıklanan düğmenin `name="niyet"`
 * değerinden okunur:
 *
 *   - "onizleme": HİÇBİR ŞEY YAZMAZ — brief üretilir ve önizleme döner.
 *   - "kaydet":   görüşme, brief aynı girdiden yeniden üretilerek saklanır.
 *
 * İki ayrı eylem yerine tek eylem: form alanları her iki dönüşte de aynı
 * durumdan (`degerler`) geri doldurulur; iki `useActionState` olsaydı hangi
 * durumun güncel olduğu istemcide takip edilmek zorunda kalırdı.
 */
export async function veliGorusmesiGonder(
  _oncekiDurum: VeliGorusmesiEylemDurumu,
  formVerisi: FormData,
): Promise<VeliGorusmesiEylemDurumu> {
  const kullanici = await yonetimZorunlu("danismanlik", "TAM");
  const subeId = kullanici.aktifSubeId;

  const sonuc = formuCozumle(formVerisi);
  if ("durum" in sonuc) return sonuc.durum;

  const ogrenciId = sonuc.veri.ogrenciId;
  const ogrenci = await ogrenciyiBul(ogrenciId, subeId);
  if (!ogrenci) return { hata: "Öğrenci bulunamadı." };

  const raporGirdisi = await veliBriefGirdisiHazirla(
    ogrenciId,
    subeId,
    sonuc.veri.tarih,
  );

  const brief = veliBriefiUret({
    ogrenciIlkAdi: ogrenci.firstName,
    cevaplar: sonuc.veri.cevaplar,
    raporGirdisi,
  });

  if (formVerisi.get("niyet") !== "kaydet") {
    return {
      brief,
      degerler: formDegerleri(formVerisi, VELI_FORM_ALANLARI),
    };
  }

  await db.parentMeeting.create({
    data: {
      studentId: ogrenciId,
      date: sonuc.veri.tarih,
      interviewerName: sonuc.veri.gorusmeciAdi,
      answersJson: sonuc.veri.cevaplar as unknown as object,
      briefJson: brief as unknown as object,
      createdByUserId: kullanici.id,
    },
  });

  gorusmeleriTazele(ogrenciId);
  return { basari: "Veli görüşmesi ve brief kaydedildi." };
}

/** Görüşme değişince iki ekran birden tazelenir: Danışmanlık ve profil. */
function gorusmeleriTazele(ogrenciId: string) {
  revalidatePath("/koordinator/danismanlik");
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
}

/**
 * Görüşme SONRASI serbest not — kayıt görüşmeden önce açıldığı için not
 * sonradan gelir; "sil + yeniden ekle" burada uymaz (brief ve test cevapları
 * da kaybolurdu). Üzerine yazmak serbest, `noteUpdatedAt` damgalanır.
 */
export async function veliGorusmesiNotuKaydet(
  gorusmeId: string,
  _oncekiDurum: VeliGorusmesiEylemDurumu,
  formVerisi: FormData,
): Promise<VeliGorusmesiEylemDurumu> {
  const kullanici = await yonetimZorunlu("danismanlik", "TAM");
  const subeId = kullanici.aktifSubeId;

  const ham = formVerisi.get("not");
  const not = typeof ham === "string" ? ham.trim() : "";
  if (!not) {
    return { alanHatalari: { not: "Görüşme notu boş olamaz." } };
  }
  if (not.length > 5000) {
    return {
      alanHatalari: { not: "Not en fazla 5000 karakter olabilir." },
      degerler: { not },
    };
  }

  const gorusme = await db.parentMeeting.findFirst({
    where: { id: gorusmeId, student: { branchId: subeId } },
    select: { id: true, studentId: true },
  });
  if (!gorusme) return { hata: "Görüşme bulunamadı." };

  await db.parentMeeting.update({
    where: { id: gorusme.id },
    data: { note: not, noteUpdatedAt: new Date() },
  });

  gorusmeleriTazele(gorusme.studentId);
  return { basari: "Görüşme notu kaydedildi." };
}

/**
 * Yanlış girilen görüşme silinir; kayıt alanları için düzenleme yok (yalnızca
 * not güncellenebilir). Onay istemcide soruluyor (window.confirm).
 */
export async function veliGorusmesiSil(
  gorusmeId: string,
): Promise<VeliGorusmesiEylemDurumu> {
  const kullanici = await yonetimZorunlu("danismanlik", "TAM");
  const subeId = kullanici.aktifSubeId;

  const gorusme = await db.parentMeeting.findFirst({
    where: { id: gorusmeId, student: { branchId: subeId } },
    select: { id: true, studentId: true, date: true },
  });
  if (!gorusme) return { hata: "Görüşme bulunamadı." };

  await db.parentMeeting.delete({ where: { id: gorusme.id } });

  gorusmeleriTazele(gorusme.studentId);
  return {
    basari: `${tarihBicimle(gorusme.date)} tarihli veli görüşmesi silindi.`,
  };
}
