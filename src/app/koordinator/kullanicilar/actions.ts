"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminZorunlu } from "@/lib/auth-guard";
import { formDegerleri } from "@/lib/formlar";
import { ROL_ADLARI } from "@/lib/roller";
import type { Role } from "@/generated/prisma/enums";

/**
 * Yönetici hesap ve rol yönetimi.
 *
 * Koordinatörün stajyer ekranı yerinde duruyor ve kendi şubesiyle sınırlı;
 * burası ise bütün şubelere bakan tek ekran. İkisi ayrı çünkü yetkileri ayrı:
 * koordinatör yalnızca stajyer açıp kapatabilir, yönetici rol ve şube de
 * değiştirebilir.
 *
 * ROL–ŞUBE KURALI tek yerde: `subeyiCoz`. Yönetici hiçbir şubeye bağlı
 * değildir (null), koordinatör ve stajyer her zaman bir şubeye bağlıdır.
 * Aynı kural veritabanında CHECK ile de duruyor (`User_admin_sube_kurali`);
 * buradaki kontrol kullanıcıya anlaşılır bir hata vermek için, veritabanı
 * kısıtı ise son savunma hattı.
 */

export type EylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
  degerler?: Record<string, string>;
};

const ROLLER = ["ADMIN", "KOORDINATOR", "STAJYER"] as const;

const kullaniciSemasi = z.object({
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
  role: z.enum(ROLLER, { message: "Rol seçin" }),
  branchId: z.string().trim(),
});

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path.join(".");
    if (alan && !sonuc[alan]) sonuc[alan] = sorun.message;
  }
  return sonuc;
}

/**
 * Rolün gerektirdiği şubeyi çözer; uyuşmazlıkta alan hatası döner.
 *
 * Yöneticide form ne gönderirse göndersin şube null'a çekilir — ekranda
 * seçici gizli ama gizli bir alan elle doldurulabilir.
 */
async function subeyiCoz(
  role: Role,
  subeId: string,
): Promise<{ hata: Record<string, string> } | { branchId: string | null }> {
  if (role === "ADMIN") return { branchId: null };

  if (!subeId) {
    return { hata: { branchId: "Bu rol için şube seçmelisiniz." } };
  }

  const sube = await db.branch.findFirst({
    where: { id: subeId, active: true },
    select: { id: true },
  });

  if (!sube) {
    return { hata: { branchId: "Seçilen şube bulunamadı." } };
  }

  return { branchId: sube.id };
}

/**
 * "Sistemde en az bir aktif yönetici kalmalı" değişmezi.
 *
 * Yönetici sayısını azaltan İKİ yol var — pasife alma ve rolü düşürme — ve
 * ikisi de buradan geçiyor. Öz-koruma (kendi hesabına dokunamama) bugün zaten
 * sıfıra inmeyi engelliyor; bu kontrol o kuralın yanında ikinci hat: öz-koruma
 * ileride gevşetilirse (örneğin "hesabımı devret" gibi bir akış eklenirse)
 * panel kilitlenmesin. Kilitlenme geri dönüşü olan bir hata değil — kullanıcı
 * yönetimi ekranına yalnızca yönetici girebiliyor.
 */
async function sonYoneticiMi(kullaniciId: string): Promise<boolean> {
  const hedef = await db.user.findUnique({
    where: { id: kullaniciId },
    select: { role: true, active: true },
  });

  if (hedef?.role !== "ADMIN" || !hedef.active) return false;

  const kalan = await db.user.count({
    where: { role: "ADMIN", active: true, id: { not: kullaniciId } },
  });

  return kalan === 0;
}

const SON_YONETICI_HATASI =
  "Sistemdeki tek aktif yönetici bu hesap. Önce başka bir yönetici hesabı açın.";

export async function kullaniciEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await adminZorunlu();

  const girilenler = formDegerleri(formVerisi, [
    "name",
    "email",
    "role",
    "branchId",
  ]);

  const cozumlenen = kullaniciSemasi.safeParse({
    name: formVerisi.get("name"),
    email: formVerisi.get("email"),
    password: formVerisi.get("password"),
    role: formVerisi.get("role"),
    branchId: formVerisi.get("branchId") ?? "",
  });

  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: girilenler,
    };
  }

  const veri = cozumlenen.data;

  const sube = await subeyiCoz(veri.role, veri.branchId);
  if ("hata" in sube) {
    return { alanHatalari: sube.hata, degerler: girilenler };
  }

  // Giriş sırasında e-posta yerelden bağımsız küçültülerek aranıyor; kayıt da
  // aynı biçimde yapılmalı ki eşleşsin (bkz. auth.ts).
  const email = veri.email.toLowerCase();

  const mevcut = await db.user.findUnique({ where: { email } });
  if (mevcut) {
    return {
      alanHatalari: { email: "Bu e-posta zaten kullanılıyor." },
      degerler: girilenler,
    };
  }

  await db.user.create({
    data: {
      name: veri.name,
      email,
      passwordHash: await hash(veri.password, 12),
      role: veri.role,
      branchId: sube.branchId,
    },
  });

  revalidatePath("/koordinator/kullanicilar");
  revalidatePath("/koordinator/stajyerler");
  return {
    basari: `${veri.name} eklendi (${ROL_ADLARI[veri.role]}). Giriş bilgilerini iletin ve ilk girişten sonra parolayı değiştirmesini isteyin.`,
  };
}

/**
 * Rol ve şubeyi birlikte günceller.
 *
 * İkisi tek eylemde çünkü tek başlarına geçersiz bir ara duruma düşürüyorlar:
 * bir stajyeri önce yöneticiye çevirip sonra şubesini boşaltmak, arada CHECK
 * kısıtına takılırdı. Tek `update` ile geçiş atomik oluyor.
 */
export async function kullaniciRolVeSubeGuncelle(
  kullaniciId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const yonetici = await adminZorunlu();

  // Öz-koruma: yönetici kendi rolünü düşüremez. Düşürebilseydi tek yönetici
  // hesabı kendini koordinatöre çevirip sistemde hiç yönetici bırakmayabilir
  // ve kullanıcı yönetimi ekranına bir daha girilemezdi.
  if (kullaniciId === yonetici.id) {
    return { hata: "Kendi rolünüzü ve şubenizi değiştiremezsiniz." };
  }

  const rolDegeri = String(formVerisi.get("role") ?? "");
  if (!ROLLER.includes(rolDegeri as Role)) {
    return { hata: "Geçerli bir rol seçin." };
  }
  const role = rolDegeri as Role;

  const sube = await subeyiCoz(role, String(formVerisi.get("branchId") ?? ""));
  if ("hata" in sube) return { alanHatalari: sube.hata };

  const hedef = await db.user.findUnique({
    where: { id: kullaniciId },
    select: { name: true, role: true, branchId: true },
  });
  if (!hedef) return { hata: "Kullanıcı bulunamadı." };

  if (role !== "ADMIN" && (await sonYoneticiMi(kullaniciId))) {
    return { hata: SON_YONETICI_HATASI };
  }

  // Şube değiştiren bir stajyerin eski şubede aktif kaydı kalırsa o kayıtlar
  // sahipsizleşir: kayıt eski şubede kalır, stajyer artık orayı görmez ve
  // formlarını dolduramaz. Bu yüzden önce devir isteniyor.
  if (hedef.branchId && sube.branchId !== hedef.branchId) {
    const aktifKayitSayisi = await db.enrollment.count({
      where: {
        internId: kullaniciId,
        status: "AKTIF",
        group: { branchId: hedef.branchId },
      },
    });

    if (aktifKayitSayisi > 0) {
      return {
        hata: `${hedef.name} eski şubesinde ${aktifKayitSayisi} aktif kayıttan sorumlu. Şube değiştirmeden önce bu kayıtları o şubedeki başka bir stajyere devredin.`,
      };
    }
  }

  await db.user.update({
    where: { id: kullaniciId },
    data: { role, branchId: sube.branchId },
  });

  revalidatePath("/koordinator/kullanicilar");
  revalidatePath("/koordinator/stajyerler");
  return { basari: `${hedef.name} güncellendi: ${ROL_ADLARI[role]}.` };
}

export async function kullaniciAdiGuncelle(
  kullaniciId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await adminZorunlu();

  const ad = String(formVerisi.get("name") ?? "").trim();
  if (ad.length < 2) {
    return { alanHatalari: { name: "Ad soyad en az 2 karakter olmalı" } };
  }
  if (ad.length > 120) {
    return { alanHatalari: { name: "Ad soyad en fazla 120 karakter olabilir" } };
  }

  const sonuc = await db.user.updateMany({
    where: { id: kullaniciId },
    data: { name: ad },
  });
  if (sonuc.count === 0) return { hata: "Kullanıcı bulunamadı." };

  revalidatePath("/koordinator/kullanicilar");
  revalidatePath("/koordinator/stajyerler");
  return { basari: "Kullanıcı bilgisi güncellendi." };
}

/**
 * Hesabı pasife alır ya da geri açar.
 *
 * Silme yok: pasif hesabın girdiği puanlamalar, düzenlediği raporlar ve
 * atandığı kayıtlar yerinde kalıyor. Dönem ortasında ayrılan bir stajyerin
 * verisi kayboluyor olsaydı, o dönemin raporları "puanlayan" bilgisini
 * kaybederdi.
 */
export async function kullaniciDurumDegistir(
  kullaniciId: string,
): Promise<EylemDurumu> {
  const yonetici = await adminZorunlu();

  if (kullaniciId === yonetici.id) {
    return { hata: "Kendi hesabınızı pasife alamazsınız." };
  }

  const hedef = await db.user.findUnique({
    where: { id: kullaniciId },
    select: { active: true, name: true, role: true },
  });
  if (!hedef) return { hata: "Kullanıcı bulunamadı." };

  if (await sonYoneticiMi(kullaniciId)) {
    return { hata: SON_YONETICI_HATASI };
  }

  await db.user.update({
    where: { id: kullaniciId },
    data: { active: !hedef.active },
  });

  revalidatePath("/koordinator/kullanicilar");
  revalidatePath("/koordinator/stajyerler");
  return {
    basari: hedef.active
      ? `${hedef.name} pasife alındı; artık giriş yapamaz. Geçmiş kayıtları korundu.`
      : `${hedef.name} yeniden aktif.`,
  };
}

export async function kullaniciParolaSifirla(
  kullaniciId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await adminZorunlu();

  const parola = String(formVerisi.get("password") ?? "");
  if (parola.length < 8) {
    return { alanHatalari: { password: "Parola en az 8 karakter olmalı" } };
  }
  if (parola.length > 100) {
    return {
      alanHatalari: { password: "Parola en fazla 100 karakter olabilir" },
    };
  }

  const sonuc = await db.user.updateMany({
    where: { id: kullaniciId },
    data: { passwordHash: await hash(parola, 12) },
  });
  if (sonuc.count === 0) return { hata: "Kullanıcı bulunamadı." };

  revalidatePath("/koordinator/kullanicilar");
  return { basari: "Parola yenilendi. Yeni parolayı kullanıcıya iletin." };
}
