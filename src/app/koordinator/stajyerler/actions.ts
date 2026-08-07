"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import {
  alanHatalari,
  formDegerleri,
  type EylemDurumu,
} from "@/lib/formlar";

/**
 * §3.2 ve §8 — Stajyer hesaplarının yönetimi.
 *
 * Stajyer ayrı bir tablo değil, `role = STAJYER` olan bir kullanıcı: puanlamayı
 * kendisi girdiği için giriş yapabilmesi gerekiyor. Hesabı koordinatör açar,
 * kendi kaydını açan kullanıcı yok.
 */

const stajyerSemasi = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı")
    .max(120, "Ad soyad en fazla 120 karakter olabilir"),
  email: z
    .string()
    .trim()
    .min(1, "E-posta gerekli")
    .email("Geçerli bir e-posta adresi girin"),
  password: z
    .string()
    .min(8, "Parola en az 8 karakter olmalı")
    .max(100, "Parola en fazla 100 karakter olabilir"),
});

export async function stajyerEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("stajyerler", "TAM");

  const cozumlenen = stajyerSemasi.safeParse({
    name: formVerisi.get("name"),
    email: formVerisi.get("email"),
    password: formVerisi.get("password"),
  });

  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      // Parola bilerek geri gönderilmiyor.
      degerler: formDegerleri(formVerisi, ["name", "email"]),
    };
  }

  // Giriş sırasında e-posta yerelden bağımsız küçültülerek aranıyor
  // (auth.ts'teki açıklamaya bakın: Türkçe yerelde "I" noktasız "ı"ya
  // dönüşüyor ve kayıt ile giriş birbirini bulamıyordu). Kayıt da aynı
  // biçimde yapılmalı ki eşleşsin.
  const email = cozumlenen.data.email.toLowerCase();

  // şube-muaf: e-posta bütün sistemde tekil. Yalnızca kendi şubesine bakmak,
  // diğer şubede var olan bir e-postayla ikinci hesap açılmasına izin verirdi.
  const mevcut = await db.user.findUnique({ where: { email } });
  if (mevcut) {
    return {
      alanHatalari: { email: "Bu e-posta zaten kullanılıyor." },
      degerler: formDegerleri(formVerisi, ["name", "email"]),
    };
  }

  await db.user.create({
    data: {
      name: cozumlenen.data.name,
      email,
      passwordHash: await hash(cozumlenen.data.password, 12),
      roles: ["STAJYER"],
      // Yeni stajyer her zaman ekleyenin şubesine yazılır; form şube alanı
      // içermiyor ve içermemeli (`lib/sube.ts`).
      branchId: kullanici.aktifSubeId,
    },
  });

  revalidatePath("/koordinator/stajyerler");
  return {
    basari: `${cozumlenen.data.name} eklendi. Giriş bilgilerini stajyere iletin ve ilk girişten sonra parolayı değiştirmesini isteyin.`,
  };
}

export async function stajyerAdiGuncelle(
  stajyerId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("stajyerler", "TAM");

  const ad = String(formVerisi.get("name") ?? "").trim();
  if (ad.length < 2) {
    return { alanHatalari: { name: "Ad soyad en az 2 karakter olmalı" } };
  }
  if (ad.length > 120) {
    return { alanHatalari: { name: "Ad soyad en fazla 120 karakter olabilir" } };
  }

  // `role: "STAJYER"` predicate'i bu eylemi zaten koordinatör hesaplarından
  // koruyordu; `branchId` eklenince aynı desen şubeler arası sızıntıyı da
  // kapatıyor.
  const sonuc = await db.user.updateMany({
    where: { id: stajyerId, roles: { has: "STAJYER" }, branchId: kullanici.aktifSubeId },
    data: { name: ad },
  });
  if (sonuc.count === 0) return { hata: "Stajyer bulunamadı." };

  revalidatePath("/koordinator/stajyerler");
  return { basari: "Stajyer bilgisi güncellendi." };
}

/**
 * Pasife alınan stajyer giriş yapamaz ama geçmiş atamaları ve girdiği
 * puanlamalar olduğu gibi kalır — dönem ortasında ayrılan bir stajyerin
 * verisi silinmemeli.
 */
export async function stajyerDurumDegistir(
  stajyerId: string,
): Promise<EylemDurumu> {
  const koordinator = await yonetimZorunlu("stajyerler", "TAM");

  if (stajyerId === koordinator.id) {
    return { hata: "Kendi hesabınızı pasife alamazsınız." };
  }

  const stajyer = await db.user.findFirst({
    where: { id: stajyerId, branchId: koordinator.aktifSubeId },
    select: { active: true, name: true, roles: true },
  });

  if (!stajyer) return { hata: "Stajyer bulunamadı." };
  if (!stajyer.roles.includes("STAJYER")) {
    return { hata: "Bu hesap bir stajyer hesabı değil." };
  }

  await db.user.update({
    where: { id: stajyerId },
    data: { active: !stajyer.active },
  });

  revalidatePath("/koordinator/stajyerler");
  return {
    basari: stajyer.active
      ? `${stajyer.name} pasife alındı; artık giriş yapamaz. Geçmiş puanlamaları korundu.`
      : `${stajyer.name} yeniden aktif.`,
  };
}

/**
 * §8 — Stajyeri bir dönemin kadrosuna alır ya da kadrodan çıkarır.
 *
 * Aynı işi dönem sayfasındaki kadro formu da yapıyor (`donemStajyerleriniGuncelle`),
 * ama o form bütün kadroyu birden yazar. Burada stajyer merkezli tek bir
 * geçiş var: koordinatör stajyerin sayfasında "bu dönemde çalışacak" deyip
 * hemen öğrenci atamasına geçebiliyor. Kurallar iki tarafta da aynı:
 * pasif hesap kadroya alınamaz, dönemde aktif kaydı olan kadrodan çıkarılamaz.
 */
export async function stajyerKadroDurumuDegistir(
  donemId: string,
  stajyerId: string,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("stajyerler", "TAM");
  const subeId = kullanici.aktifSubeId;

  // Dönem ortak olduğu için süzülmez; stajyer ve kayıtlar şubeye kapalı.
  const [donem, stajyer, mevcutKadro] = await Promise.all([
    db.term.findUnique({ where: { id: donemId }, select: { name: true } }),
    db.user.findFirst({
      where: { id: stajyerId, branchId: subeId },
      select: { roles: true, active: true, name: true },
    }),
    db.termIntern.findUnique({
      where: { termId_userId: { termId: donemId, userId: stajyerId } },
      select: { id: true },
    }),
  ]);

  if (!donem) return { hata: "Dönem bulunamadı." };
  if (!stajyer || !stajyer.roles.includes("STAJYER")) {
    return { hata: "Stajyer bulunamadı." };
  }

  if (mevcutKadro) {
    // Çıkarma: bu dönemde aktif kaydı varsa engellenir, yoksa o kayıtların
    // sorumlusu kadro dışında kalırdı.
    const aktifKayitSayisi = await db.enrollment.count({
      where: {
        status: "AKTIF",
        internId: stajyerId,
        group: { termId: donemId, branchId: subeId },
      },
    });

    if (aktifKayitSayisi > 0) {
      return {
        hata: `${stajyer.name} bu dönemde ${aktifKayitSayisi} aktif kayıttan sorumlu; kadrodan çıkarılamaz. Önce bu kayıtları başka stajyere devredin.`,
      };
    }

    await db.termIntern.delete({ where: { id: mevcutKadro.id } });
  } else {
    if (!stajyer.active) {
      return { hata: "Pasif hesap dönem kadrosuna eklenemez." };
    }
    await db.termIntern.create({ data: { termId: donemId, userId: stajyerId } });
  }

  revalidatePath(`/koordinator/stajyerler/${stajyerId}`);
  revalidatePath(`/koordinator/donemler/${donemId}`);
  revalidatePath("/koordinator/kayitlar/yeni");

  return {
    basari: mevcutKadro
      ? `${stajyer.name} "${donem.name}" kadrosundan çıkarıldı.`
      : `${stajyer.name} "${donem.name}" kadrosuna eklendi.`,
  };
}

/** Parola sıfırlama — stajyer parolasını unuttuğunda koordinatör yeniler. */
export async function stajyerParolaSifirla(
  stajyerId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("stajyerler", "TAM");

  const parola = String(formVerisi.get("password") ?? "");
  if (parola.length < 8) {
    return { alanHatalari: { password: "Parola en az 8 karakter olmalı" } };
  }
  if (parola.length > 100) {
    return { alanHatalari: { password: "Parola en fazla 100 karakter olabilir" } };
  }

  const sonuc = await db.user.updateMany({
    where: { id: stajyerId, roles: { has: "STAJYER" }, branchId: kullanici.aktifSubeId },
    data: { passwordHash: await hash(parola, 12) },
  });
  if (sonuc.count === 0) return { hata: "Stajyer bulunamadı." };

  revalidatePath("/koordinator/stajyerler");
  return { basari: "Parola yenilendi. Yeni parolayı stajyere iletin." };
}
