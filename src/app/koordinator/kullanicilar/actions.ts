"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { kullaniciYonetimiZorunlu } from "@/lib/yetki-kapisi";
import {
  alanHatalari,
  formDegerleri,
  type EylemDurumu,
} from "@/lib/formlar";
import { rolEtiketi } from "@/lib/roller";
import type { Role } from "@/generated/prisma/enums";

/**
 * Hesap ve rol yönetimi.
 *
 * Koordinatörün stajyer ekranı yerinde duruyor ve yalnızca stajyer açıp
 * kapatabiliyor; burası rol ve şube de değiştiren ekran. İki rol giriyor:
 * Kurum Yöneticisi bütün şubelere bakar, Şube Yöneticisi yalnızca kendi
 * şubesine.
 *
 * KAPSAM her eylemin ilk satırında çözülür (`kullaniciYonetimiZorunlu`) ve
 * İKİ yerde birden kullanılır: yeni/güncellenen kaydın şubesi kapsama
 * çekilir (`rolleriCoz`) ve dokunulan satırın kapsamda olduğu doğrulanır
 * (`kapsamdaMi`). Yalnızca birincisi olsaydı şube yöneticisi başka şubenin
 * hesabını kendi şubesine taşıyarak devralabilirdi; yalnızca ikincisi
 * olsaydı kendi şubesinden çıkarıp erişimini kaybettiği bir hesap
 * bırakabilirdi.
 *
 * Bir kullanıcı birden çok rol taşıyabilir (örn. psikolog + test uygulayıcısı).
 * KOMBİNASYON KURALLARI tek yerde: `rolleriCoz`. ADMIN tek başınadır ve
 * şubesizdir, STAJYER tek başınadır, kalan roller birleşebilir ve şube
 * zorunludur. Aynı kurallar veritabanında CHECK ile de duruyor (migration
 * `coklu_rol`); buradaki kontrol kullanıcıya anlaşılır bir hata vermek için,
 * veritabanı kısıtı ise son savunma hattı.
 */

const ROLLER = [
  "ADMIN",
  "SUBE_YONETICISI",
  "KOORDINATOR",
  "ATOLYE_PSIKOLOGU",
  "TEST_UYGULAYICISI",
  "DANISMA_GOREVLISI",
  "STAJYER",
] as const;

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
  roles: z.array(z.enum(ROLLER)).min(1, "En az bir rol seçin"),
  branchId: z.string().trim(),
});

/** Formdaki çoklu rol seçimi — `getAll` bilinmeyen değerleri de getirir,
 *  şema doğrulaması onları eler. */
function formRolleri(formVerisi: FormData): string[] {
  return formVerisi.getAll("roles").map(String);
}

/**
 * Rol kombinasyonunu ve rolün gerektirdiği şubeyi çözer; uyuşmazlıkta alan
 * hatası döner.
 *
 * Yöneticide form ne gönderirse göndersin şube null'a çekilir — ekranda
 * seçici gizli ama gizli bir alan elle doldurulabilir. Aynı gerekçeyle şube
 * yöneticisinde formdaki şube seçimi HİÇ okunmaz: kapsam neyse o yazılır.
 * Şube yöneticisi kendi gibi bir şube yöneticisi atayabilir (kendi şubesinde
 * vekil bırakabilmeli) ama Kurum Yöneticisi atayamaz — o yetki şubeler üstü.
 */
async function rolleriCoz(
  roles: Role[],
  subeId: string,
  kapsamSubeId: string | null,
): Promise<
  { hata: Record<string, string> } | { roles: Role[]; branchId: string | null }
> {
  if (roles.includes("ADMIN") && roles.length > 1) {
    return {
      hata: { roles: "Kurum Yöneticisi başka bir rolle birleştirilemez." },
    };
  }

  if (roles.includes("STAJYER") && roles.length > 1) {
    return {
      hata: { roles: "Stajyer başka bir rolle birleştirilemez." },
    };
  }

  if (kapsamSubeId !== null) {
    if (roles.includes("ADMIN")) {
      return {
        hata: {
          roles:
            "Kurum Yöneticisi yetkisini yalnızca bir Kurum Yöneticisi verebilir.",
        },
      };
    }
    return { roles, branchId: kapsamSubeId };
  }

  if (roles.includes("ADMIN")) return { roles, branchId: null };

  if (!subeId) {
    return { hata: { branchId: "Bu roller için şube seçmelisiniz." } };
  }

  const sube = await db.branch.findFirst({
    where: { id: subeId, active: true },
    select: { id: true },
  });

  if (!sube) {
    return { hata: { branchId: "Seçilen şube bulunamadı." } };
  }

  return { roles, branchId: sube.id };
}

/**
 * Dokunulmak istenen satır çağıranın kapsamında mı.
 *
 * Kurum Yöneticisinde (kapsam null) her satır kapsamdadır. Şube
 * yöneticisinde şube EŞİT olmalı: şubesiz hesap (Kurum Yöneticisi) da,
 * diğer şubenin hesabı da dışarıda kalır. Kayıt hiç yoksa da `false` döner
 * — "bulunamadı" ile "yetkiniz yok" arasında bilerek ayrım yapılmıyor,
 * ikisi de aynı mesajı alır (var olan e-postaları taramaya yaramasın).
 */
async function kapsamdaMi(
  kullaniciId: string,
  kapsamSubeId: string | null,
): Promise<boolean> {
  if (kapsamSubeId === null) return true;

  const hedef = await db.user.count({
    where: { id: kullaniciId, branchId: kapsamSubeId },
  });
  return hedef > 0;
}

const KAPSAM_DISI_HATASI =
  "Bu hesap sizin şubenizde değil; yalnızca kendi şubenizin hesaplarını yönetebilirsiniz.";

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
  // şube-muaf: yönetici sayısı şubeler üstü bir değişmez. Buraya yalnızca
  // `adminZorunlu()` geçmiş eylemler giriyor.
  const hedef = await db.user.findUnique({
    where: { id: kullaniciId },
    select: { roles: true, active: true },
  });

  if (!hedef?.roles.includes("ADMIN") || !hedef.active) return false;

  // şube-muaf: aynı değişmez — sistemde kaç aktif yönetici kaldığı sorusunun
  // şubeye göre cevabı yok.
  const kalan = await db.user.count({
    where: {
      roles: { has: "ADMIN" },
      active: true,
      id: { not: kullaniciId },
    },
  });

  return kalan === 0;
}

const SON_YONETICI_HATASI =
  "Sistemdeki tek aktif Kurum Yöneticisi bu hesap. Önce başka bir yönetici hesabı açın.";

export async function kullaniciEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const { kapsamSubeId } = await kullaniciYonetimiZorunlu();

  const girilenler = formDegerleri(formVerisi, ["name", "email", "branchId"]);
  // Çoklu seçim `formDegerleri`nin tekil düzenine sığmıyor; hata durumunda
  // formun seçimleri geri yükleyebilmesi için virgüllü tek değer olarak taşınır.
  girilenler.roles = formRolleri(formVerisi).join(",");

  const cozumlenen = kullaniciSemasi.safeParse({
    name: formVerisi.get("name"),
    email: formVerisi.get("email"),
    password: formVerisi.get("password"),
    roles: formRolleri(formVerisi),
    branchId: formVerisi.get("branchId") ?? "",
  });

  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: girilenler,
    };
  }

  const veri = cozumlenen.data;

  const cozum = await rolleriCoz(veri.roles, veri.branchId, kapsamSubeId);
  if ("hata" in cozum) {
    return { alanHatalari: cozum.hata, degerler: girilenler };
  }

  // Giriş sırasında e-posta yerelden bağımsız küçültülerek aranıyor; kayıt da
  // aynı biçimde yapılmalı ki eşleşsin (bkz. auth.ts).
  const email = veri.email.toLowerCase();

  // şube-muaf: e-posta bütün sistemde tekil (`User.email @unique`), bu yüzden
  // arama da şubesiz olmak ZORUNDA. Kapsamla süzülseydi şube yöneticisi diğer
  // şubede kayıtlı bir e-postayı "boş" görüp kaydetmeye çalışır ve anlamsız
  // bir veritabanı hatasına düşerdi. Dönen satırdan yalnızca "var mı" bilgisi
  // okunuyor, hiçbir alanı ekrana çıkmıyor.
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
      roles: cozum.roles,
      branchId: cozum.branchId,
      // Başlangıç parolası yöneticinin elinden geçiyor; kullanıcı ilk
      // girişte kendi parolasını koymadan panele giremez.
      mustChangePassword: true,
    },
  });

  revalidatePath("/koordinator/kullanicilar");
  revalidatePath("/koordinator/stajyerler");
  return {
    basari: `${veri.name} eklendi (${rolEtiketi(cozum.roles)}). Giriş bilgilerini iletin; ilk girişte parolasını değiştirmesi istenecek.`,
  };
}

/**
 * Rolleri ve şubeyi birlikte günceller.
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
  const yonetici = await kullaniciYonetimiZorunlu();

  // Öz-koruma: yönetici kendi rolünü düşüremez. Düşürebilseydi tek yönetici
  // hesabı kendini koordinatöre çevirip sistemde hiç yönetici bırakmayabilir
  // ve kullanıcı yönetimi ekranına bir daha girilemezdi.
  if (kullaniciId === yonetici.id) {
    return { hata: "Kendi rollerinizi ve şubenizi değiştiremezsiniz." };
  }

  if (!(await kapsamdaMi(kullaniciId, yonetici.kapsamSubeId))) {
    return { hata: KAPSAM_DISI_HATASI };
  }

  const rolDegerleri = formRolleri(formVerisi);
  if (
    rolDegerleri.length === 0 ||
    !rolDegerleri.every((deger) => ROLLER.includes(deger as Role))
  ) {
    return { hata: "En az bir geçerli rol seçin." };
  }
  const roles = rolDegerleri as Role[];

  const cozum = await rolleriCoz(
    roles,
    String(formVerisi.get("branchId") ?? ""),
    yonetici.kapsamSubeId,
  );
  if ("hata" in cozum) return { alanHatalari: cozum.hata };

  const hedef = await db.user.findUnique({
    where: { id: kullaniciId },
    select: { name: true, roles: true, branchId: true },
  });
  if (!hedef) return { hata: "Kullanıcı bulunamadı." };

  if (!roles.includes("ADMIN") && (await sonYoneticiMi(kullaniciId))) {
    return { hata: SON_YONETICI_HATASI };
  }

  // Şube değiştiren bir stajyerin eski şubede aktif kaydı kalırsa o kayıtlar
  // sahipsizleşir: kayıt eski şubede kalır, stajyer artık orayı görmez ve
  // formlarını dolduramaz. Bu yüzden önce devir isteniyor.
  if (hedef.branchId && cozum.branchId !== hedef.branchId) {
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
    data: { roles: cozum.roles, branchId: cozum.branchId },
  });

  revalidatePath("/koordinator/kullanicilar");
  revalidatePath("/koordinator/stajyerler");
  return { basari: `${hedef.name} güncellendi: ${rolEtiketi(cozum.roles)}.` };
}

export async function kullaniciAdiGuncelle(
  kullaniciId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const { kapsamSubeId } = await kullaniciYonetimiZorunlu();

  const ad = String(formVerisi.get("name") ?? "").trim();
  if (ad.length < 2) {
    return { alanHatalari: { name: "Ad soyad en az 2 karakter olmalı" } };
  }
  if (ad.length > 120) {
    return { alanHatalari: { name: "Ad soyad en fazla 120 karakter olabilir" } };
  }

  if (!(await kapsamdaMi(kullaniciId, kapsamSubeId))) {
    return { hata: KAPSAM_DISI_HATASI };
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
  const yonetici = await kullaniciYonetimiZorunlu();

  if (kullaniciId === yonetici.id) {
    return { hata: "Kendi hesabınızı pasife alamazsınız." };
  }

  if (!(await kapsamdaMi(kullaniciId, yonetici.kapsamSubeId))) {
    return { hata: KAPSAM_DISI_HATASI };
  }

  const hedef = await db.user.findUnique({
    where: { id: kullaniciId },
    select: { active: true, name: true },
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
  const { kapsamSubeId } = await kullaniciYonetimiZorunlu();

  const parola = String(formVerisi.get("password") ?? "");
  if (parola.length < 8) {
    return { alanHatalari: { password: "Parola en az 8 karakter olmalı" } };
  }
  if (parola.length > 100) {
    return {
      alanHatalari: { password: "Parola en fazla 100 karakter olabilir" },
    };
  }

  if (!(await kapsamdaMi(kullaniciId, kapsamSubeId))) {
    return { hata: KAPSAM_DISI_HATASI };
  }

  const sonuc = await db.user.updateMany({
    where: { id: kullaniciId },
    // Geçici parola yöneticinin elinden geçiyor; kullanıcı ilk girişte
    // kendi parolasını koymadan panele giremez.
    data: { passwordHash: await hash(parola, 12), mustChangePassword: true },
  });
  if (sonuc.count === 0) return { hata: "Kullanıcı bulunamadı." };

  revalidatePath("/koordinator/kullanicilar");
  return {
    basari:
      "Parola yenilendi. Yeni parolayı kullanıcıya iletin; ilk girişte değiştirmesi istenecek.",
  };
}
