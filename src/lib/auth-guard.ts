import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { anaSayfaYolu, yonetimRoluMu } from "@/lib/roller";
import {
  yetkiYeter,
  yetkileriHesapla,
  type Modul,
  type Seviye,
} from "@/lib/yetkiler";
import { aktifSubeyiCoz, secilenSubeCerezi } from "@/lib/sube";
import type { Role } from "@/generated/prisma/enums";

/**
 * Yetki kontrolünün asıl yeri burasıdır.
 *
 * `proxy.ts` yalnızca iyimser bir ön kontrol yapar (Next.js dokümanının kendi
 * uyarısı: proxy tam bir yetkilendirme çözümü değildir). Gerçek koruma her
 * sayfa ve her Server Action'ın kendi içinde bu fonksiyonları çağırmasıyla
 * sağlanır. Yeni bir sayfa veya işlem yazan herkes buradan başlamalı.
 *
 * Modül bazlı yetki deseni (bkz. lib/yetkiler.ts):
 *   sayfa               → yonetimZorunlu("donemler")            (GORUNTULE)
 *   mutasyon action'ı   → yonetimZorunlu("donemler", "TAM")
 *   zeka testi listesi  → yonetimZorunlu("zekaTestleri", "LISTE")
 * Parametresiz `yonetimZorunlu()` yalnızca panel kapısıdır (dashboard,
 * layout): herhangi bir yönetim rolü yeter, modül kontrolü yapılmaz.
 */

export type OturumKullanicisi = {
  id: string;
  name: string;
  email: string;
  /** Kullanıcının rolleri — yetki bunların birleşiminden hesaplanır. */
  roller: Role[];
  /** ADMIN'de null; diğer rollerde veritabanı CHECK'i gereği hep dolu. */
  subeId: string | null;
};

/** Şube bağlamı çözülmüş kullanıcı — panel sayfalarının ve eylemlerin tipi. */
export type SubeliKullanici = OturumKullanicisi & {
  /**
   * Üzerinde çalışılan şube: şubeli rollerde kendi şubesi, yöneticide
   * üst şeritten seçtiği şube. Asla null — bütün sorgu süzgeçleri bunu
   * kullanıyor, null olabilseydi her çağrı yerinde ayrıca kontrol gerekirdi.
   */
  aktifSubeId: string;
  aktifSubeAdi: string;
  /** Yalnızca yönetici şube değiştirebilir. */
  subeDegistirebilir: boolean;
  /** Üst şeritteki seçicinin listesi; yönetici dışında tek elemanlı. */
  secilebilirSubeler: readonly { id: string; ad: string }[];
  /**
   * Modül başına etkin yetki (rollerin birleşimi). Sayfalar arayüz modunu
   * buradan seçer: `kullanici.yetkiler.zekaTestleri === "TAM"` gibi.
   */
  yetkiler: Record<Modul, Seviye>;
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
      roles: true,
      active: true,
      mustChangePassword: true,
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
 * Ad, roller ve şube belirteçten değil veritabanından okunur; yöneticinin
 * yaptığı rol veya şube değişikliği yeni girişi beklemeden geçerli olur.
 *
 * Parola değişimi zorunluysa (`mustChangePassword`) hiçbir panel sayfası
 * açılmaz; kullanıcı önce `/parola-degistir`'den geçer. O sayfanın kendisi
 * bu fonksiyonu KULLANMAZ (döngü olurdu), oturumu kendi çözer.
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

  if (kullanici.mustChangePassword) {
    redirect("/parola-degistir");
  }

  return {
    id: kullanici.id,
    name: kullanici.name,
    email: kullanici.email,
    roller: kullanici.roles,
    subeId: kullanici.branchId,
  };
}

/**
 * Kullanıcıya şube bağlamını ekler.
 *
 * Şubeli rollerde şube kendi kaydından gelir; çerez okunmaz bile —
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

  const yonetici = kullanici.roller.includes("ADMIN");
  const cerez = yonetici ? await secilenSubeCerezi() : undefined;
  const aktifSubeId = aktifSubeyiCoz(
    yonetici,
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

  return {
    ...kullanici,
    aktifSubeId: aktifSube.id,
    aktifSubeAdi: aktifSube.name,
    subeDegistirebilir: yonetici,
    secilebilirSubeler: yonetici
      ? subeler.map((sube) => ({ id: sube.id, ad: sube.name }))
      : [{ id: aktifSube.id, ad: aktifSube.name }],
    yetkiler: yetkileriHesapla(kullanici.roller),
  };
}

/**
 * Rol ayrımı yapmadan şube bağlamı çözer.
 *
 * Hem stajyerin hem yönetim rollerinin kullandığı ortak eylemler için
 * (puanlama kaydetme gibi): orada rol kontrolü zaten eylemin kendi içinde
 * yapılıyor, eksik olan tek şey şubeydi.
 */
export async function subeliOturum(): Promise<SubeliKullanici> {
  return subeBaglamiEkle(await girisZorunlu());
}

/**
 * Koordinatör panelinin kapısı: STAJYER dışındaki herhangi bir rol.
 *
 * `modul` verildiğinde ayrıca yetki matrisi kontrolü yapılır: kullanıcının
 * rollerinin o modüldeki etkin yetkisi `gereken` seviyeye ulaşmıyorsa
 * panelin ana sayfasına yönlendirilir. Menüde görünmeyen bir adrese elle
 * giden (veya yetkisi sonradan daraltılan) kullanıcı böylece sayfayı hiç
 * açamaz — menüden gizlemek yetki değildir, asıl sınır burasıdır.
 */
export async function yonetimZorunlu(
  modul?: Modul,
  gereken: Seviye = "GORUNTULE",
): Promise<SubeliKullanici> {
  const kullanici = await girisZorunlu();

  if (!yonetimRoluMu(kullanici.roller)) {
    redirect(anaSayfaYolu(kullanici.roller));
  }

  if (modul && !yetkiYeter(kullanici.roller, modul, gereken)) {
    redirect("/koordinator");
  }

  return subeBaglamiEkle(kullanici);
}

/** Stajyer paneli için. Diğer roller kendi alanlarına yönlendirilir. */
export async function stajyerZorunlu(): Promise<SubeliKullanici> {
  const kullanici = await girisZorunlu();

  if (!kullanici.roller.includes("STAJYER")) {
    redirect(anaSayfaYolu(kullanici.roller));
  }

  return subeBaglamiEkle(kullanici);
}

/**
 * Yalnızca yönetici. Hesap ve rol yönetimi ekranları için — orası tek
 * şubeye değil bütün şubelere bakar, o yüzden şube bağlamı döndürmüyor.
 */
export async function adminZorunlu(): Promise<OturumKullanicisi> {
  const kullanici = await girisZorunlu();

  if (!kullanici.roller.includes("ADMIN")) {
    redirect(anaSayfaYolu(kullanici.roller));
  }

  return kullanici;
}

export { rolAdi, rolEtiketi, anaSayfaYolu } from "@/lib/roller";
