"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randevuZorunlu, yonetimZorunlu } from "@/lib/yetki-kapisi";
import { RANDEVU_SUBE_CEREZI, SUBE_CEREZ_OMRU } from "@/lib/sube";
import { alanHatalari, formDegerleri } from "@/lib/formlar";
import type { EylemDurumu } from "@/lib/formlar";
import { bugun, tarihCozumle, zamanMetni } from "@/lib/tarih";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";
import { engelMesaji, uzmanBaglami } from "@/lib/randevu/uzman-baglami";
import { veliyiCoz } from "@/lib/randevu/veli";
import {
  randevuAraligi,
  randevuEngeli,
  type Aralik,
} from "@/lib/randevu/cakisma";
import {
  kapsamdakiRandevular,
  tekrarTarihleri,
  type TekrarKapsami,
} from "@/lib/randevu/tekrar";
import { saatiDakikayaCevir } from "../uzmanlar/sema";
import { MEVCUT_INDIRIM, yuzdeIndirimi } from "@/lib/randevu/indirim";
import {
  RANDEVU_DUZENLE_FORM_ALANLARI,
  RANDEVU_FORM_ALANLARI,
  randevuDuzenleSemasi,
  randevuSemasi,
} from "./sema";
import { haftaRandevuVerisi } from "@/lib/randevu/hafta-verisi";
import { randevuGecmisMi } from "@/lib/randevu/gecmis-kilidi";
import { randevuHedefSubesi } from "@/lib/randevu/hedef-sube";
import {
  duzenlemeBrutUcreti,
  KAYITLI_TARIFE,
  tarifeUcreti,
} from "@/lib/randevu/tarife";

/**
 * §17.4 — Randevu yazma işlemleri.
 *
 * YETKİ: `randevular` modülünde TAM. Danışma masası dahil, panelin randevu
 * gören herkesi randevu açabiliyor — modülün asıl kullanıcısı telefonun
 * başındaki kişi.
 *
 * ŞUBE: randevu oturumdaki AKTİF ŞUBEYE açılır — danışma görevlisinde bu,
 * randevular ekranında seçtiği şubedir (`randevuZorunlu`). Takvim okuması şubeler arası
 * (§17.7) ama yazma değil: seansın hangi binada verildiği ciro raporunun
 * kırılımı ve başka şubenin takvimine kayıt düşmek kimsenin istediği şey
 * olmazdı.
 */

function tazele(): void {
  revalidatePath("/koordinator/randevular");
  revalidatePath("/koordinator");
}

/**
 * Randevu ekranlarında çalışılan şubeyi değiştirir — sağ üstteki şube kutusu
 * (Eylül 2026 kararı, bkz. `randevuSubeSecimi`).
 *
 * Yalnız randevu ekranlarını etkiler: ayrı bir çerez yazılıyor ve onu
 * yalnız randevu kapısı okuyor. Yöneticinin genel şube seçimine
 * (`app/sube/actions.ts`) dokunmaz. Değer yazılmadan önce aktif şube olduğu
 * doğrulanıyor; okuma tarafı da tanımadığı değeri kendi şubesine düşürüyor.
 */
export async function randevuSubesiDegistir(subeId: string): Promise<void> {
  const kullanici = await randevuZorunlu();
  if (!kullanici.randevuSubesiSecebilir) return;

  const sube = await db.branch.findFirst({
    where: { id: subeId, active: true },
    select: { id: true },
  });
  if (!sube) return;

  (await cookies()).set(RANDEVU_SUBE_CEREZI, sube.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SUBE_CEREZ_OMRU,
  });

  // Panel çerçevesi (sağ üstteki kutu) ve ciro raporu da bu seçimle
  // çiziliyor: koordinatör alanının tamamı tazelenmeli.
  revalidatePath("/koordinator", "layout");
}

/**
 * Aday penceresinin sayfadan ayrılmadan hafta değiştirmesi için salt-okunur veri.
 *
 * `randevuZorunlu` DEĞİL: aday akışı adayın şubesinde çalışır, danışma
 * görevlisinin randevular ekranındaki şube seçimi buraya taşınmamalı.
 */
export async function haftaRandevuVerisiEylemi(tarih: string) {
  const kullanici = await yonetimZorunlu("randevular");
  return haftaRandevuVerisi({ subeId: kullanici.aktifSubeId, capa: tarihCozumle(tarih) ?? bugun() });
}

/**
 * Seansın dakika cinsinden süresi.
 *
 * Bitiş saati verilmişse aradaki fark, verilmemişse hizmetin katalog süresi.
 * Şema bitişin başlangıçtan sonra olduğunu zaten doğruluyor (`seansKurallari`);
 * buradaki `> 0` denetimi yalnız son bir güvenlik — süresi sıfır ya da eksi
 * bir aralık çakışma hesabını sessizce bozardı.
 */
function seansSuresi(
  saat: string,
  bitisSaati: string | null,
  katalogSuresiDk: number,
): number {
  if (!bitisSaati) return katalogSuresiDk;
  const basla = saatiDakikayaCevir(saat);
  const bit = saatiDakikayaCevir(bitisSaati);
  if (basla === null || bit === null || bit <= basla) return katalogSuresiDk;
  return bit - basla;
}

function formuOku(formVerisi: FormData) {
  return Object.fromEntries(
    RANDEVU_FORM_ALANLARI.map((alan) => [alan, formVerisi.get(alan) ?? ""]),
  );
}

/**
 * Randevunun çocuğunu çözer: "yeni öğrenci ekle" doluysa öğrenciyi açar,
 * yoksa seçilen `ogrenciId`nin var olduğunu doğrular. Öğrenciler ortak
 * havuzda (Eylül 2026): randevu hangi şubede açılırsa açılsın çocuk iki
 * şubeden de seçilebilir; YENİ açılan öğrencinin kayıt şubesi randevunun
 * şubesidir.
 *
 * "Yeni öğrenci" var olan `ogrenciId`nin ÖNÜNE geçer: arayüz ikisini aynı
 * anda göstermiyor, ama iki değer de gelirse yeni açma niyeti (kullanıcının
 * SON tıkladığı şey) esas alınır. `randevuEkle` ve `randevuDuzenle` aynı
 * kuralı paylaşsın diye tek yerde.
 */
async function ogrenciyiCoz(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  args: {
    subeId: string;
    ogrenciId: string | null;
    yeniAd: string | null;
    yeniSoyad: string | null;
    yeniDogumTarihi: string | null;
  },
): Promise<{ ogrenciId: string | null; yeniAcildi: boolean } | { hata: string }> {
  if (args.yeniAd && args.yeniSoyad) {
    const yeniOgrenci = await tx.student.create({
      data: {
        firstName: args.yeniAd,
        lastName: args.yeniSoyad,
        birthDate: args.yeniDogumTarihi ? tarihCozumle(args.yeniDogumTarihi) : null,
        branchId: args.subeId,
        searchName: normalizeArama(`${args.yeniAd} ${args.yeniSoyad}`),
      },
      select: { id: true },
    });
    return { ogrenciId: yeniOgrenci.id, yeniAcildi: true };
  }
  if (args.ogrenciId) {
    const ogrenci = await tx.student.findFirst({
      where: { id: args.ogrenciId },
      select: { id: true },
    });
    if (!ogrenci) return { hata: "Seçilen öğrenci bulunamadı." };
  }
  return { ogrenciId: args.ogrenciId, yeniAcildi: false };
}

export async function randevuEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await randevuZorunlu("TAM");

  const cozumlenen = randevuSemasi.safeParse(formuOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, RANDEVU_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const girilenler = formDegerleri(formVerisi, RANDEVU_FORM_ALANLARI);

  /**
   * Randevunun yazılacağı şube (Eylül 2026): formdan geliyorsa o, yoksa
   * ekranın aktif şubesi.
   *
   * YETKİ GENİŞLEMESİ DEĞİL: randevu ekranına erişen şubeli roller sağ
   * üstteki randevu şubesi seçicisiyle, yönetici de panel şubesiyle zaten
   * her aktif şubeye randevu açabiliyordu. Kaldırılan tek şey "önce bütün
   * ekranı öbür şubeye çevir" adımı. Yine de kimlik DOĞRULANIYOR: aktif
   * şubeler arasında değilse kesin ret — sessizce aktif şubeye düşmek
   * randevuyu kullanıcının görmediği bir takvime yazardı.
   */
  const subeId = await randevuHedefSubesi(kullanici.aktifSubeId, veri.subeId);
  if (!subeId) {
    return {
      alanHatalari: { subeId: "Seçilen şube bulunamadı." },
      degerler: girilenler,
    };
  }

  const gun = tarihCozumle(veri.tarih);
  if (!gun) {
    return { alanHatalari: { tarih: "Tarih seçilmeli." }, degerler: girilenler };
  }
  const baslangic = new Date(gun.getTime() + saatiDakikayaCevir(veri.saat)! * 60_000);

  // Uzman bu hizmeti yapabiliyor mu — arayüz zaten süzüyor, asıl sınır burası.
  // şube-muaf: yetkinlik ve hizmet şubeden bağımsız (bkz. sube-sizinti.ts).
  const yetkinlik = await db.uzmanHizmet.findUnique({
    where: {
      uzmanId_hizmetId: { uzmanId: veri.uzmanId, hizmetId: veri.hizmetId },
    },
    select: {
      uzman: {
        select: {
          ad: true,
          aktif: true,
          subeler: { where: { subeId }, select: { subeId: true } },
        },
      },
      hizmet: {
        select: {
          ad: true,
          aktif: true,
          sureDk: true,
          ucretKurus: true,
          eskiDanisanUcretKurus: true,
          tekrarli: true,
        },
      },
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

  // "Mevcut indirim" yalnız düzenlemede anlamlı; yeni randevuda yok.
  if (veri.indirimYuzde === MEVCUT_INDIRIM) {
    return { alanHatalari: { indirimYuzde: "Listeden bir indirim seçin." }, degerler: girilenler };
  }
  /**
   * §17.9 — Randevunun ücreti SEÇİLEN tarifeden. "kayitli" yeni randevuda
   * anlamsız (korunacak bir kayıt yok); "eski" seçilmiş ama hizmetin ikinci
   * ücreti yoksa kesin ret — sessizce güncel ücrete düşmek, eski danışan
   * fiyatı uygulandığını sanan kullanıcıya tam fiyattan randevu açardı.
   */
  if (veri.tarife === KAYITLI_TARIFE) {
    return { alanHatalari: { tarife: "Listeden bir tarife seçin." }, degerler: girilenler };
  }
  const brutUcret = tarifeUcreti(yetkinlik.hizmet, veri.tarife);
  if (brutUcret === null) {
    return {
      alanHatalari: { tarife: "Bu hizmette eski danışan ücreti tanımlı değil." },
      degerler: girilenler,
    };
  }

  // İndirim SEÇİLEN tarifenin üzerinden; hep güncel ücretten hesaplamak eski
  // danışanda yanlış tutar üretirdi.
  const indirimKurus = yuzdeIndirimi(brutUcret, veri.indirimYuzde);

  /**
   * Seansın süresi: form bitiş saati verdiyse ondan, vermediyse katalogdan
   * (28 Eylül 2026). Ücret her hâlükârda katalogdan — süre uzadı diye fiyat
   * değişmiyor. Seride her hafta AYNI süre kullanılıyor.
   */
  const sureDk = seansSuresi(veri.saat, veri.bitisSaati, yetkinlik.hizmet.sureDk);

  // Tekrar YALNIZ tekrarlı hizmetlerde; zekâ testleri her seferinde elle.
  const haftaSayisi = yetkinlik.hizmet.tekrarli ? veri.haftaSayisi : 1;
  const tarihler = tekrarTarihleri(baslangic, haftaSayisi);
  const araliklar: Aralik[] = tarihler.map((tarih) => randevuAraligi(tarih, sureDk));

  const baglam = await uzmanBaglami({
    uzmanId: veri.uzmanId,
    subeId,
    ilk: araliklar[0].baslangic,
    son: araliklar[araliklar.length - 1].bitis,
  });

  // Kullanıcı "mesai dışı, yine de kaydet" onayını ZATEN verdiyse form bunu
  // gizli bir alanla tekrar gönderir (bkz. randevu-formu.tsx). Sunucu bunu
  // hiçbir zaman kendiliğinden varsaymaz.
  const mesaiZorla = formVerisi.get("mesaiZorla") === "1";

  /**
   * Serinin BİR tarihi bile engelliyse tamamı reddediliyor.
   *
   * Kısmi seri sessizce eksik bir program üretirdi: koordinatör 8 hafta
   * istedi, 6 tanesi açıldı ve bunu ancak takvime bakınca fark ederdi.
   * Hangi hafta ve neden engellendiği mesajda yazılı.
   *
   * Mesai engeli TEK istisna: kesin ret yerine `onayGerekli` döner, form bir
   * kez sorar ve EVET'te `mesaiZorla=1` ile buraya geri gelir — o turda
   * `randevuEngeli` mesaiyi hiç bildirmediği için bu dal bir daha çalışmaz.
   * İzin ve çakışma her zaman kesin ret (§17.4).
   */
  for (const [sira, aralik] of araliklar.entries()) {
    const engel = randevuEngeli({
      randevu: aralik,
      ...baglam,
      mesaiyiYokSay: mesaiZorla,
    });
    if (!engel) continue;

    const nerede =
      araliklar.length === 1
        ? ""
        : ` (${sira + 1}. hafta — ${zamanMetni(aralik.baslangic)})`;
    const mesaj = `${engelMesaji(engel, baglam, subeId)}${nerede}`;
    if (engel.tur === "mesai") {
      return { onayGerekli: mesaj, degerler: girilenler };
    }
    return { hata: mesaj, degerler: girilenler };
  }

  const seriId = araliklar.length > 1 ? randomUUID() : null;

  const sonuc = await db.$transaction(async (tx) => {
    const veli = await veliyiCoz(tx, {
      subeId,
      veliId: veri.veliId,
      ad: veri.yeniVeliAdi,
      telefon: veri.yeniVeliTelefon,
    });
    if (typeof veli !== "string") return veli;

    const ogrenci = await ogrenciyiCoz(tx, {
      subeId,
      ogrenciId: veri.ogrenciId,
      yeniAd: veri.yeniOgrenciAdi,
      yeniSoyad: veri.yeniOgrenciSoyadi,
      yeniDogumTarihi: veri.yeniOgrenciDogumTarihi,
    });
    if ("hata" in ogrenci) return ogrenci;
    const ogrenciId = ogrenci.ogrenciId;

    await tx.randevu.createMany({
      data: araliklar.map((aralik) => ({
        branchId: subeId,
        uzmanId: veri.uzmanId,
        hizmetId: veri.hizmetId,
        veliId: veli,
        ogrenciId,
        baslangic: aralik.baslangic,
        bitis: aralik.bitis,
        // Ücret açılış anında KOPYALANIYOR: katalogdaki zam bu randevuyu
        // ve geçmiş haftaların cirosunu değiştirmemeli (§17.4).
        ucretKurus: brutUcret,
        indirimKurus,
        indirimNotu: veri.indirimNotu,
        seriId,
        not: veri.not,
        createdByUserId: kullanici.id,
      })),
    });

    return null;
  });

  if (sonuc) return { ...sonuc, degerler: girilenler };

  if (veri.yeniOgrenciAdi) revalidatePath("/koordinator/ogrenciler");
  tazele();
  return {
    basari:
      araliklar.length === 1
        ? `Randevu açıldı: ${zamanMetni(baslangic)}.`
        : `${araliklar.length} haftalık seri açıldı; ilki ${zamanMetni(baslangic)}.`,
  };
}

/**
 * §17.4 revizyonu — var olan bir randevuyu düzenler (uzman/hizmet/tarih/
 * saat/indirim/not). Danışan tarafı `danisanIslemi`ne göre: "degistir"
 * randevuyu başka veliye/çocuğa bağlar, "guncelle" mevcut veli ve öğrenci
 * KAYDINI düzeltir, "koru" dokunmaz — bkz. `sema.ts` şerhi. Randevu tarafı
 * seriyi etkilemez (tek satır); kayıt düzeltmesi ise o kişinin bütün
 * randevularında görünür, çünkü kayıt tektir.
 *
 * `randevuEkle` ile AYNI çakışma/mesai kuralları uygulanır; tek fark
 * `uzmanBaglami`ya `haricId` verilmesi — randevu kendi eski hâliyle
 * çakışıyor sayılmasın diye (bir randevu kendisiyle asla çakışmaz).
 */
export async function randevuDuzenle(
  randevuId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await randevuZorunlu("TAM");
  const subeId = kullanici.aktifSubeId;

  const mevcut = await db.randevu.findFirst({
    where: { id: randevuId, branchId: subeId },
    select: {
      id: true,
      durum: true,
      baslangic: true,
      ucretKurus: true,
      indirimKurus: true,
    },
  });
  if (!mevcut) return { hata: "Randevu bulunamadı." };
  if (mevcut.durum === "IPTAL") {
    return { hata: "İptal edilmiş randevu düzenlenemez." };
  }

  const cozumlenen = randevuDuzenleSemasi.safeParse(
    Object.fromEntries(
      RANDEVU_DUZENLE_FORM_ALANLARI.map((alan) => [alan, formVerisi.get(alan) ?? ""]),
    ),
  );
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, RANDEVU_DUZENLE_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const girilenler = formDegerleri(formVerisi, RANDEVU_DUZENLE_FORM_ALANLARI);

  const gun = tarihCozumle(veri.tarih);
  if (!gun) {
    return { alanHatalari: { tarih: "Tarih seçilmeli." }, degerler: girilenler };
  }
  const baslangic = new Date(gun.getTime() + saatiDakikayaCevir(veri.saat)! * 60_000);

  const yetkinlik = await db.uzmanHizmet.findUnique({
    where: {
      uzmanId_hizmetId: { uzmanId: veri.uzmanId, hizmetId: veri.hizmetId },
    },
    select: {
      uzman: {
        select: {
          aktif: true,
          subeler: { where: { subeId }, select: { subeId: true } },
        },
      },
      hizmet: {
        select: {
          aktif: true,
          sureDk: true,
          ucretKurus: true,
          eskiDanisanUcretKurus: true,
        },
      },
    },
  });

  if (!yetkinlik) {
    return {
      alanHatalari: { hizmetId: "Bu uzman seçilen hizmeti uygulamıyor." },
      degerler: girilenler,
    };
  }
  if (!yetkinlik.uzman.aktif || !yetkinlik.hizmet.aktif) {
    return { hata: "Pasif uzman veya hizmetle randevu düzenlenemez.", degerler: girilenler };
  }
  if (yetkinlik.uzman.subeler.length === 0) {
    return {
      alanHatalari: { uzmanId: "Bu uzman bu şubede çalışmıyor." },
      degerler: girilenler,
    };
  }

  /**
   * §17.9 — Düzenlemede ücret SEÇİLEN tarifeden; "kayitli" kayda yazılmış
   * BRÜT tutarı korur (`ucretKurus` net tutulduğu için indirim geri
   * ekleniyor). Varsayılan "kayitli": formu açıp yalnız notu değiştiren
   * kullanıcı, katalog o arada zamlandıysa ücreti farkında olmadan
   * güncellememeli.
   */
  const brutUcret = duzenlemeBrutUcreti(
    veri.tarife,
    mevcut.ucretKurus,
    yetkinlik.hizmet,
  );
  if (brutUcret === null) {
    return {
      alanHatalari: { tarife: "Bu hizmette eski danışan ücreti tanımlı değil." },
      degerler: girilenler,
    };
  }

  // Listede olmayan eski indirim ("mevcut") tutarıyla korunur; tarife ya da
  // hizmet değiştiyse yeni ücreti aşmamalı. Yüzde seçildiyse SEÇİLEN
  // tarifenin ücretinden hesap.
  const indirimKurus =
    veri.indirimYuzde === MEVCUT_INDIRIM
      ? mevcut.indirimKurus
      : yuzdeIndirimi(brutUcret, veri.indirimYuzde);
  if (indirimKurus > brutUcret) {
    return {
      alanHatalari: {
        indirimYuzde: "Mevcut indirim yeni hizmetin ücretini aşıyor; bir yüzde seçin.",
      },
      degerler: girilenler,
    };
  }

  const aralik = randevuAraligi(
    baslangic,
    seansSuresi(veri.saat, veri.bitisSaati, yetkinlik.hizmet.sureDk),
  );

  const baglam = await uzmanBaglami({
    uzmanId: veri.uzmanId,
    subeId,
    ilk: aralik.baslangic,
    son: aralik.bitis,
    haricId: randevuId,
  });

  const mesaiZorla = formVerisi.get("mesaiZorla") === "1";
  const engel = randevuEngeli({ randevu: aralik, ...baglam, mesaiyiYokSay: mesaiZorla });
  if (engel) {
    if (engel.tur === "mesai") return { onayGerekli: engel.mesaj, degerler: girilenler };
    return { hata: engelMesaji(engel, baglam, subeId), degerler: girilenler };
  }

  const seansVerisi = {
    uzmanId: veri.uzmanId,
    hizmetId: veri.hizmetId,
    baslangic: aralik.baslangic,
    bitis: aralik.bitis,
    ucretKurus: brutUcret,
    indirimKurus,
    indirimNotu: veri.indirimNotu,
    not: veri.not,
  };

  if (veri.danisanIslemi === "koru") {
    await db.randevu.update({ where: { id: randevuId }, data: seansVerisi });
    tazele();
    return { basari: `Randevu güncellendi: ${zamanMetni(baslangic)}.` };
  }

  if (veri.danisanIslemi === "guncelle") {
    // Danışan aynı, kaydı düzeltiliyor: veli + öğrenci + randevu tek işlemde.
    // Öğrencisi olan randevuda ad/soyad boş bırakılamaz — öğrenci kaydı yarım
    // adla kalmasın; öğrencisiz randevuda ad/soyad girildiyse öğrenci açılır,
    // boşsa öğrenci tarafı atlanır.
    const sonuc = await db.$transaction(async (tx) => {
      const sahip = await tx.randevu.findUniqueOrThrow({
        where: { id: randevuId },
        select: { veliId: true, ogrenciId: true },
      });

      await tx.veli.update({
        where: { id: sahip.veliId },
        data: {
          fullName: veri.veliAdi!,
          phone: veri.veliTelefon,
          searchPhone: veri.veliTelefon ? normalizeTelefon(veri.veliTelefon) || null : null,
          searchName: normalizeArama(veri.veliAdi!),
        },
      });

      const ogrenciAlanlari =
        veri.ogrenciAd && veri.ogrenciSoyad
          ? {
              firstName: veri.ogrenciAd,
              lastName: veri.ogrenciSoyad,
              birthDate: veri.ogrenciDogumTarihi ? tarihCozumle(veri.ogrenciDogumTarihi) : null,
              searchName: normalizeArama(`${veri.ogrenciAd} ${veri.ogrenciSoyad}`),
            }
          : null;

      if (sahip.ogrenciId) {
        if (!ogrenciAlanlari) {
          return { alanHatalari: { ogrenciAd: "Öğrencinin adı ve soyadı gerekli." } };
        }
        await tx.student.update({ where: { id: sahip.ogrenciId }, data: ogrenciAlanlari });
        await tx.randevu.update({ where: { id: randevuId }, data: seansVerisi });
        return null;
      }

      // Randevuya bağlı öğrenci yok (canlıda planlı randevuların çoğu böyle:
      // masa çocuğun adını veli alanına yazmış). Ad/soyad girildiyse öğrenci
      // kaydı BURADA açılır ve bu randevuya bağlanır — `ogrenciyiCoz`'daki
      // "yeni öğrenci" ile aynı darlıkta: yalnız ad/soyad/doğum tarihi.
      if (!ogrenciAlanlari) {
        await tx.randevu.update({ where: { id: randevuId }, data: seansVerisi });
        return null;
      }
      const yeniOgrenci = await tx.student.create({
        data: { ...ogrenciAlanlari, branchId: subeId },
        select: { id: true },
      });
      await tx.randevu.update({
        where: { id: randevuId },
        data: { ...seansVerisi, ogrenciId: yeniOgrenci.id },
      });
      return null;
    });

    if (sonuc) return { ...sonuc, degerler: girilenler };
    revalidatePath("/koordinator/ogrenciler");
    tazele();
    return { basari: `Randevu ve danışan bilgileri güncellendi: ${zamanMetni(baslangic)}.` };
  }

  // "degistir": veli/öğrenci çözümü ve güncelleme TEK işlemde — yeni veli
  // açılıp randevu güncellenemezse sahipsiz veli kalmasın.
  const sonuc = await db.$transaction(async (tx) => {
    const veli = await veliyiCoz(tx, {
      subeId,
      veliId: veri.veliId,
      ad: veri.yeniVeliAdi,
      telefon: veri.yeniVeliTelefon,
    });
    if (typeof veli !== "string") return veli;

    const ogrenci = await ogrenciyiCoz(tx, {
      subeId,
      ogrenciId: veri.ogrenciId,
      yeniAd: veri.yeniOgrenciAdi,
      yeniSoyad: veri.yeniOgrenciSoyadi,
      yeniDogumTarihi: veri.yeniOgrenciDogumTarihi,
    });
    if ("hata" in ogrenci) return ogrenci;

    await tx.randevu.update({
      where: { id: randevuId },
      data: { ...seansVerisi, veliId: veli, ogrenciId: ogrenci.ogrenciId },
    });
    return ogrenci.yeniAcildi ? { yeniOgrenci: true } : null;
  });

  if (sonuc && "hata" in sonuc) return { ...sonuc, degerler: girilenler };
  if (sonuc?.yeniOgrenci) revalidatePath("/koordinator/ogrenciler");

  tazele();
  return { basari: `Randevu ve danışanı güncellendi: ${zamanMetni(baslangic)}.` };
}

/**
 * Randevunun sonucunu işaretler: gerçekleşti / gelmedi / planlandı.
 *
 * Geçmiş kilidine TABİ DEĞİL (Eylül 2026 kararı): seansın sonucu çoğu zaman
 * ertesi gün işaretleniyor ve "işaretlenmemiş geçmiş randevular" listesini
 * danışma masası kapatıyor.
 */
export async function randevuDurumDegistir(
  randevuId: string,
  durum: "PLANLANDI" | "GERCEKLESTI" | "GELMEDI",
): Promise<EylemDurumu> {
  const kullanici = await randevuZorunlu("TAM");

  // İptal edilmiş randevu geri açılmıyor: iptal kaydın geçmişi, durum değil.
  const sonuc = await db.randevu.updateMany({
    where: {
      id: randevuId,
      branchId: kullanici.aktifSubeId,
      durum: { not: "IPTAL" },
    },
    data: { durum },
  });

  if (sonuc.count === 0) {
    return { hata: "Randevu bulunamadı ya da iptal edilmiş." };
  }

  tazele();
  return {
    basari:
      durum === "GERCEKLESTI"
        ? "Randevu gerçekleşti olarak işaretlendi."
        : durum === "GELMEDI"
          ? "Randevu 'gelmedi' olarak işaretlendi."
          : "Randevu yeniden planlandı durumuna alındı.",
  };
}

/**
 * Randevuyu KALICI olarak siler (Eylül 2026 kararı) — yanlış girilmiş kaydın
 * yolu. Asıl akış iptaldir: iptal iz bırakır, silme bırakmaz.
 *
 * Yalnız bugünkü ve gelecek randevu silinir, yöneticide de: günü geçmiş
 * seans ciroya ve raporlara girmiş olabilir, o iptal edilir. Yetki
 * düzenlemeyle aynı (`randevular` TAM). Seride kapsam iptaldeki gibi
 * sorulur; "bu ve sonrakiler" geçmiş haftalara hiç dokunmaz.
 */
export async function randevuSil(
  randevuId: string,
  kapsam: TekrarKapsami,
): Promise<EylemDurumu> {
  const kullanici = await randevuZorunlu("TAM");

  const randevu = await db.randevu.findFirst({
    where: { id: randevuId, branchId: kullanici.aktifSubeId },
    select: { id: true, baslangic: true, seriId: true },
  });
  if (!randevu) return { hata: "Randevu bulunamadı." };
  if (randevuGecmisMi(randevu.baslangic)) {
    return { hata: "Günü geçmiş randevu silinemez; iptal edebilirsiniz." };
  }

  const seridekiler =
    randevu.seriId && kapsam === "bu-ve-sonrakiler"
      ? await db.randevu.findMany({
          where: { seriId: randevu.seriId, branchId: kullanici.aktifSubeId },
          select: { id: true, baslangic: true },
        })
      : [{ id: randevu.id, baslangic: randevu.baslangic }];

  const hedefler = kapsamdakiRandevular(seridekiler, randevu, kapsam).filter(
    (hedef) => !randevuGecmisMi(hedef.baslangic),
  );

  const sonuc = await db.randevu.deleteMany({
    where: {
      id: { in: hedefler.map((hedef) => hedef.id) },
      branchId: kullanici.aktifSubeId,
    },
  });

  tazele();
  return {
    basari: sonuc.count === 1 ? "Randevu silindi." : `${sonuc.count} randevu silindi.`,
  };
}

/**
 * Randevuyu iptal eder. SİLMEZ — iptal edilen randevu takvimden düşer ama
 * geçmişiyle ayrı listede durur (§17.4).
 *
 * Seriden açılmış bir randevuda kapsam sorulur: yalnız bu, ya da bu ve
 * sonrakiler. Geçmişe hiçbir kapsam dokunmaz.
 */
export async function randevuIptalEt(
  randevuId: string,
  kapsam: TekrarKapsami,
  not: string | null,
): Promise<EylemDurumu> {
  const kullanici = await randevuZorunlu("TAM");

  const randevu = await db.randevu.findFirst({
    where: { id: randevuId, branchId: kullanici.aktifSubeId },
    select: { id: true, baslangic: true, seriId: true, durum: true },
  });

  if (!randevu) return { hata: "Randevu bulunamadı." };
  if (randevu.durum === "IPTAL") return { hata: "Randevu zaten iptal edilmiş." };

  const seridekiler =
    randevu.seriId && kapsam === "bu-ve-sonrakiler"
      ? await db.randevu.findMany({
          where: {
            seriId: randevu.seriId,
            branchId: kullanici.aktifSubeId,
            durum: { not: "IPTAL" },
          },
          select: { id: true, baslangic: true },
        })
      : [{ id: randevu.id, baslangic: randevu.baslangic }];

  const hedefler = kapsamdakiRandevular(seridekiler, randevu, kapsam);

  const sonuc = await db.randevu.updateMany({
    where: {
      id: { in: hedefler.map((hedef) => hedef.id) },
      branchId: kullanici.aktifSubeId,
      durum: { not: "IPTAL" },
    },
    data: {
      durum: "IPTAL",
      iptalNotu: not,
      iptalEdenUserId: kullanici.id,
      iptalAt: new Date(),
    },
  });

  tazele();
  return {
    basari:
      sonuc.count === 1
        ? "Randevu iptal edildi."
        : `${sonuc.count} randevu iptal edildi.`,
  };
}
