"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { atolyeIcerigiUret } from "@/lib/ai/atolye-icerigi";
import { db } from "@/lib/db";
import type { EylemDurumu } from "@/lib/formlar";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import type { MufredatHedefi } from "./actions";

/**
 * "Atölyeler ve İçerikleri Hakkında" paragraflarının yönetimi — §11.2.
 *
 * Bu metin öğrenciye özel DEĞİL, programa ait: bir düzenleme o programdaki
 * bütün öğrencilerin raporunu etkiler. Bu yüzden rapor penceresinde değil
 * müfredat sayfasında duruyor — kaynağı olan haftalık konuların yanında ve
 * kazara tek bir öğrenci için değiştirilemeyecek bir yerde.
 *
 * Her işlem `yonetimZorunlu("mufredat", "TAM")` ile başlar: sayfa kapısı
 * yetmez, Server Action doğrudan çağrılabilir.
 */

const metinSemasi = z.object({
  metin: z
    .string()
    .trim()
    .min(40, "Paragraf en az 40 karakter olmalı")
    .max(3000, "Paragraf en fazla 3000 karakter olabilir"),
});

function kok(hedef: MufredatHedefi) {
  return hedef.tur === "donem" ? "donemler" : "kulupler";
}

function tazele(hedef: MufredatHedefi) {
  revalidatePath(`/koordinator/${kok(hedef)}/${hedef.id}/mufredat`);
}

/** Hedefin dönem mi kulüp mü olduğuna göre `where`/`create` anahtarı. */
function hedefAnahtari(hedef: MufredatHedefi) {
  return hedef.tur === "donem"
    ? { termId: hedef.id, clubId: null }
    : { clubId: hedef.id, termId: null };
}

export type AtolyeIcerikKaydi = {
  atolyeTipiId: string;
  metin: string;
  kaynak: string;
  kilitli: boolean;
  guncellemeZamani: Date;
};

export async function atolyeIcerikleriniOku(
  hedef: MufredatHedefi,
): Promise<AtolyeIcerikKaydi[]> {
  await yonetimZorunlu("mufredat");

  const kayitlar = await db.atolyeIcerigi.findMany({
    where: hedefAnahtari(hedef),
    select: {
      workshopTypeId: true,
      metin: true,
      kaynak: true,
      kilitli: true,
      updatedAt: true,
    },
  });

  return kayitlar.map((kayit) => ({
    atolyeTipiId: kayit.workshopTypeId,
    metin: kayit.metin,
    kaynak: kayit.kaynak,
    kilitli: kayit.kilitli,
    guncellemeZamani: kayit.updatedAt,
  }));
}

/**
 * Bir atölyenin içerik paragrafını yapay zekâyla üretir.
 *
 * Girdi tamamen kurumun kendi verisi: o programın o atölyesine ait haftalık
 * müfredat maddeleri ve atölyenin puanlama sorularının başlıkları.
 *
 * Kilitli kayıt üzerine yazılmaz — koordinatör metni onayladıktan sonra bir
 * "yeniden üret" tıklamasıyla kaybolmamalı.
 */
export async function atolyeIcerigiUretEylem(
  hedef: MufredatHedefi,
  atolyeTipiId: string,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("mufredat", "TAM");

  const mevcut = await db.atolyeIcerigi.findFirst({
    where: { ...hedefAnahtari(hedef), workshopTypeId: atolyeTipiId },
    select: { id: true, kilitli: true },
  });

  if (mevcut?.kilitli) {
    return { hata: "Bu metin kilitli. Yeniden üretmek için önce kilidi açın." };
  }

  const atolye = await db.workshopType.findUnique({
    where: { id: atolyeTipiId },
    select: {
      name: true,
      description: true,
      questions: {
        where: { active: true, title: { not: null } },
        orderBy: { sortOrder: "asc" },
        select: { title: true },
      },
    },
  });

  if (!atolye) return { hata: "Atölye bulunamadı." };

  const haftalar = await db.curriculumEntry.findMany({
    where: { ...hedefAnahtari(hedef), workshopTypeId: atolyeTipiId },
    orderBy: { weekNumber: "asc" },
    select: { weekNumber: true, title: true, description: true },
  });

  const sonuc = await atolyeIcerigiUret({
    atolyeAdi: atolye.name,
    atolyeAciklamasi: atolye.description,
    haftalar: haftalar.map((hafta) => ({
      hafta: hafta.weekNumber,
      baslik: hafta.title,
      aciklama: hafta.description,
    })),
    beceriBasliklari: atolye.questions
      .map((soru) => soru.title)
      .filter((baslik): baslik is string => baslik !== null),
  });

  if (sonuc.durum === "mufredat-yetersiz") {
    return {
      hata: "Bu atölyenin müfredatı paragraf üretmeye yetmiyor. En az üç haftanın konusu girilmeli.",
    };
  }
  if (sonuc.durum === "anahtar-yok") {
    return {
      hata: "Yapay zekâ anahtarı tanımlı değil. Metni elle yazabilirsiniz.",
    };
  }
  if (sonuc.durum === "hata") return { hata: sonuc.mesaj };

  await db.atolyeIcerigi.upsert({
    where: mevcut
      ? { id: mevcut.id }
      : hedef.tur === "donem"
        ? { termId_workshopTypeId: { termId: hedef.id, workshopTypeId: atolyeTipiId } }
        : { clubId_workshopTypeId: { clubId: hedef.id, workshopTypeId: atolyeTipiId } },
    create: {
      ...hedefAnahtari(hedef),
      workshopTypeId: atolyeTipiId,
      metin: sonuc.metin,
      kaynak: "ai",
      uretenUserId: kullanici.id,
    },
    update: {
      metin: sonuc.metin,
      kaynak: "ai",
      uretenUserId: kullanici.id,
    },
  });

  tazele(hedef);
  return { basari: `${atolye.name} içeriği üretildi.` };
}

/** Koordinatörün elle düzenlediği metni kaydeder. */
export async function atolyeIcerigiKaydet(
  hedef: MufredatHedefi,
  atolyeTipiId: string,
  _onceki: EylemDurumu,
  form: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("mufredat", "TAM");

  const cozum = metinSemasi.safeParse({ metin: form.get("metin") });
  if (!cozum.success) {
    return { hata: cozum.error.issues[0]?.message ?? "Metin geçersiz." };
  }

  await db.atolyeIcerigi.upsert({
    where:
      hedef.tur === "donem"
        ? { termId_workshopTypeId: { termId: hedef.id, workshopTypeId: atolyeTipiId } }
        : { clubId_workshopTypeId: { clubId: hedef.id, workshopTypeId: atolyeTipiId } },
    create: {
      ...hedefAnahtari(hedef),
      workshopTypeId: atolyeTipiId,
      metin: cozum.data.metin,
      kaynak: "elle",
      uretenUserId: kullanici.id,
    },
    update: { metin: cozum.data.metin, kaynak: "elle", uretenUserId: kullanici.id },
  });

  tazele(hedef);
  return { basari: "Metin kaydedildi." };
}

/**
 * Kilit, metni toplu yeniden üretimden korur. Onaylanmış bir metnin kazara
 * üzerine yazılması, o programdaki bütün raporları etkilerdi.
 */
export async function atolyeIcerigiKilidiDegistir(
  hedef: MufredatHedefi,
  atolyeTipiId: string,
  kilitli: boolean,
): Promise<EylemDurumu> {
  await yonetimZorunlu("mufredat", "TAM");

  const kayit = await db.atolyeIcerigi.findFirst({
    where: { ...hedefAnahtari(hedef), workshopTypeId: atolyeTipiId },
    select: { id: true },
  });

  if (!kayit) return { hata: "Önce bir metin üretin veya yazın." };

  await db.atolyeIcerigi.update({ where: { id: kayit.id }, data: { kilitli } });

  tazele(hedef);
  return { basari: kilitli ? "Metin kilitlendi." : "Kilit açıldı." };
}
