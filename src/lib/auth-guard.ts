import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { anaSayfaYolu, yonetimRoluMu } from "@/lib/roller";
import { aktifSubeyiCoz, secilenSubeCerezi } from "@/lib/sube";
import type { Role } from "@/generated/prisma/enums";

/**
 * Yetki kontrolünün asıl yeri burasıdır.
 *
 * `proxy.ts` yalnızca iyimser bir ön kontrol yapar (Next.js dokümanının kendi
 * uyarısı: proxy tam bir yetkilendirme çözümü değildir). Gerçek koruma her
 * sayfa ve her Server Action'ın kendi içinde bu fonksiyonları çağırmasıyla
 * sağlanır. Yeni bir sayfa veya işlem yazan herkes buradan başlamalı.
 */

export type OturumKullanicisi = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** ADMIN'de null; diğer rollerde veritabanı CHECK'i gereği hep dolu. */
  subeId: string | null;
};

/** Şube bağlamı çözülmüş kullanıcı — panel sayfalarının ve eylemlerin tipi. */
export type SubeliKullanici = OturumKullanicisi & {
  /**
   * Üzerinde çalışılan şube: koordinatör/stajyerde kendi şubesi, yöneticide
   * üst şeritten seçtiği şube. Asla null — bütün sorgu süzgeçleri bunu
   * kullanıyor, null olabilseydi her çağrı yerinde ayrıca kontrol gerekirdi.
   */
  aktifSubeId: string;
  aktifSubeAdi: string;
  /** Yalnızca yönetici şube değiştirebilir. */
  subeDegistirebilir: boolean;
  /** Üst şeritteki seçicinin listesi; yönetici dışında tek elemanlı. */
  secilebilirSubeler: readonly { id: string; ad: string }[];
};

/**
 * Kullanıcı satırını okur — `cache()` ile istek başına TEK sorgu.
 *
 * Layout ve sayfa aynı istekte ayrı ayrı `girisZorunlu()` çağırır; sarmalama
 * olmasaydı her gezinti aynı kullanıcıyı iki kez okurdu. Üretimde veritabanı
 * uzak olduğu için bu doğrudan sayfa gecikmesine dönüşüyor.
 */
const kullaniciyiOku = cache(async (kullaniciId: string) =>
  db.user.findUnique({
    where: { id: kullaniciId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      branchId: true,
      branch: { select: { id: true, name: true } },
    },
  }),
);

/** Aktif şubeler — üst şeritteki seçici ve yöneticinin şube doğrulaması için. */
const subeleriOku = cache(async () =>
  db.branch.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  }),
);

/**
 * Oturum açmış kullanıcıyı döner; yoksa giriş sayfasına yönlendirir.
 *
 * Oturum belirteci (JWT) 12 saat geçerli olduğu için hesabın hâlâ var ve
 * aktif olduğu her istekte veritabanından doğrulanır. Aksi hâlde pasife
 * alınan bir stajyer, elindeki belirteçle mesai sonuna kadar çalışmaya devam
 * edebilirdi. Pasif hesap `/giris`'e değil `/hesap-pasif`'e gider: proxy,
 * oturum çerezi duran kullanıcıyı `/giris`'ten kendi paneline geri yollar ve
 * bu bir yönlendirme döngüsü oluştururdu.
 *
 * Ad, rol ve şube belirteçten değil veritabanından okunur; yöneticinin
 * yaptığı rol veya şube değişikliği yeni girişi beklemeden geçerli olur.
 */
export async function girisZorunlu(): Promise<OturumKullanicisi> {
  const oturum = await auth();

  if (!oturum?.user?.id) {
    redirect("/giris");
  }

  const kullanici = await kullaniciyiOku(oturum.user.id);

  if (!kullanici || !kullanici.active) {
    redirect("/hesap-pasif");
  }

  return {
    id: kullanici.id,
    name: kullanici.name,
    email: kullanici.email,
    role: kullanici.role,
    subeId: kullanici.branchId,
  };
}

/**
 * Kullanıcıya şube bağlamını ekler.
 *
 * Koordinatör ve stajyerde şube kendi kaydından gelir; çerez okunmaz bile —
 * istemcinin elindeki bir değer hiçbir zaman görüş alanını genişletmemeli.
 * Yönetici içinse çerezdeki seçim veritabanına karşı doğrulanır.
 */
async function subeBaglamiEkle(
  kullanici: OturumKullanicisi,
): Promise<SubeliKullanici> {
  const subeler = await subeleriOku();

  if (subeler.length === 0) {
    // Şube tablosu boşsa panelde yapılabilecek hiçbir şey yok. Bu ancak
    // migration eksik çalıştıysa olur.
    throw new Error(
      "Sistemde tanımlı aktif şube yok. `npm run db:seed` çalıştırılmalı.",
    );
  }

  const cerez = kullanici.role === "ADMIN" ? await secilenSubeCerezi() : undefined;
  const aktifSubeId = aktifSubeyiCoz(
    kullanici.role,
    kullanici.subeId,
    cerez,
    subeler,
  );

  if (!aktifSubeId) {
    // Yönetici olmayan bir hesabın şubesi yoksa panelde iş yapamaz. CHECK
    // kısıtı bunu engelliyor ama veri elle bozulmuşsa buraya düşer.
    redirect("/hesap-pasif");
  }

  const aktifSube = subeler.find((sube) => sube.id === aktifSubeId)!;
  const yonetici = kullanici.role === "ADMIN";

  return {
    ...kullanici,
    aktifSubeId: aktifSube.id,
    aktifSubeAdi: aktifSube.name,
    subeDegistirebilir: yonetici,
    secilebilirSubeler: yonetici
      ? subeler.map((sube) => ({ id: sube.id, ad: sube.name }))
      : [{ id: aktifSube.id, ad: aktifSube.name }],
  };
}

/**
 * Rol ayrımı yapmadan şube bağlamı çözer.
 *
 * Hem stajyerin hem koordinatörün kullandığı ortak eylemler için (puanlama
 * kaydetme gibi): orada rol kontrolü zaten eylemin kendi içinde yapılıyor,
 * eksik olan tek şey şubeydi.
 */
export async function subeliOturum(): Promise<SubeliKullanici> {
  return subeBaglamiEkle(await girisZorunlu());
}

/**
 * Koordinatör panelinin kapısı: koordinatör VEYA yönetici.
 *
 * Yönetici aynı paneli kullanıyor — üst şeritten şube seçip o şubede
 * koordinatörün yaptığı her işi yapıyor. Bu yüzden fonksiyonun adı artık
 * `yonetimZorunlu`: "yonetimZorunlu" adı, koordinatör olmayan birini de
 * geçirdiği için yanıltıcı olurdu.
 *
 * Dönüş tipi şubeyi de taşıyor; sorgu süzgeçleri `kullanici.aktifSubeId`
 * okur, ayrıca bağlam çözmeye gerek kalmaz.
 */
export async function yonetimZorunlu(): Promise<SubeliKullanici> {
  const kullanici = await girisZorunlu();

  if (!yonetimRoluMu(kullanici.role)) {
    redirect(anaSayfaYolu(kullanici.role));
  }

  return subeBaglamiEkle(kullanici);
}

/** Stajyer paneli için. Diğer roller kendi alanlarına yönlendirilir. */
export async function stajyerZorunlu(): Promise<SubeliKullanici> {
  const kullanici = await girisZorunlu();

  if (kullanici.role !== "STAJYER") {
    redirect(anaSayfaYolu(kullanici.role));
  }

  return subeBaglamiEkle(kullanici);
}

/**
 * Yalnızca yönetici. Hesap ve rol yönetimi ekranları için — orası tek
 * şubeye değil bütün şubelere bakar, o yüzden şube bağlamı döndürmüyor.
 */
export async function adminZorunlu(): Promise<OturumKullanicisi> {
  const kullanici = await girisZorunlu();

  if (kullanici.role !== "ADMIN") {
    redirect(anaSayfaYolu(kullanici.role));
  }

  return kullanici;
}

export { rolAdi, anaSayfaYolu } from "@/lib/roller";
