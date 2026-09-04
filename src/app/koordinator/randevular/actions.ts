"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { alanHatalari, formDegerleri } from "@/lib/formlar";
import type { EylemDurumu } from "@/lib/formlar";
import { tarihCozumle, zamanMetni } from "@/lib/tarih";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";
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
import { liradanKurusa, saatiDakikayaCevir } from "../uzmanlar/sema";
import { RANDEVU_FORM_ALANLARI, randevuSemasi } from "./sema";

/**
 * §17.4 — Randevu yazma işlemleri.
 *
 * YETKİ: `randevular` modülünde TAM. Danışma masası dahil, panelin randevu
 * gören herkesi randevu açabiliyor — modülün asıl kullanıcısı telefonun
 * başındaki kişi.
 *
 * ŞUBE: randevu oturumdaki AKTİF ŞUBEYE açılır. Takvim okuması şubeler arası
 * (§17.7) ama yazma değil: seansın hangi binada verildiği ciro raporunun
 * kırılımı ve başka şubenin takvimine kayıt düşmek kimsenin istediği şey
 * olmazdı.
 */

function tazele(): void {
  revalidatePath("/koordinator/randevular");
  revalidatePath("/koordinator");
}

/**
 * Uzmanın verilen günlerdeki engellerini tek seferde okur.
 *
 * Seri açılırken 8–26 tarih kontrol ediliyor; her biri için ayrı sorgu
 * atmak yerine aralığın tamamı bir kez okunup karar saf modüle bırakılıyor
 * (bkz. lib/randevu/cakisma.ts).
 */
async function uzmanBaglami(args: {
  uzmanId: string;
  subeId: string;
  ilk: Date;
  son: Date;
  haricId?: string;
}) {
  const { uzmanId, subeId, ilk, son, haricId } = args;

  // şube-muaf: mesai sorgusu `subeId` taşıyor; randevu ve izin uzmana ait
  // (uzman çok şubeli, bkz. lib/sube-sizinti.ts gerekçesi).
  const [mesailer, izinler, mevcutlar] = await Promise.all([
    db.uzmanMesai.findMany({
      where: { uzmanId, subeId },
      select: { gun: true, baslangicDk: true, bitisDk: true },
    }),
    db.izin.findMany({
      where: { uzmanId, bitis: { gt: ilk }, baslangic: { lt: son } },
      select: { baslangic: true, bitis: true },
    }),
    db.randevu.findMany({
      where: {
        uzmanId,
        bitis: { gt: ilk },
        baslangic: { lt: son },
        ...(haricId ? { NOT: { id: haricId } } : {}),
      },
      select: { id: true, baslangic: true, bitis: true, durum: true },
    }),
  ]);

  return {
    mesailer,
    izinler,
    mevcutlar: mevcutlar.map((randevu) => ({
      id: randevu.id,
      baslangic: randevu.baslangic,
      bitis: randevu.bitis,
      iptal: randevu.durum === "IPTAL",
    })),
  };
}

function formuOku(formVerisi: FormData) {
  return Object.fromEntries(
    RANDEVU_FORM_ALANLARI.map((alan) => [alan, formVerisi.get(alan) ?? ""]),
  );
}

/**
 * Danışan veliyi çözer: kayıtlı veli seçildiyse onu, yeni veli girildiyse
 * (şube + telefon + ad) eşleşmesini arar, yoksa açar.
 *
 * Eşleştirme kuralı `lib/veli.ts` ile AYNI olmak zorunda — iki farklı kural,
 * aynı velinin iki kayda bölünmesi demek.
 */
async function veliyiCoz(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  args: { subeId: string; veliId: string | null; ad: string | null; telefon: string | null },
): Promise<string | { hata: string }> {
  if (args.veliId) {
    // şube-muaf: seçilen velinin bu şubeye ait olduğu doğrulanıyor.
    const veli = await tx.veli.findFirst({
      where: { id: args.veliId, branchId: args.subeId },
      select: { id: true },
    });
    return veli ? veli.id : { hata: "Seçilen veli bu şubede bulunamadı." };
  }

  if (!args.ad) return { hata: "Veli adı gerekli." };

  const searchPhone = args.telefon ? normalizeTelefon(args.telefon) : null;
  const searchName = normalizeArama(args.ad);

  // şube-muaf: veli okuma ve yazımı `branchId: subeId` taşıyor.
  const eslesen = searchPhone
    ? await tx.veli.findFirst({
        where: { branchId: args.subeId, searchPhone, searchName },
        select: { id: true },
      })
    : null;

  if (eslesen) return eslesen.id;

  const yeni = await tx.veli.create({
    data: {
      branchId: args.subeId,
      fullName: args.ad,
      phone: args.telefon,
      searchPhone,
      searchName,
    },
    select: { id: true },
  });
  return yeni.id;
}

export async function randevuEkle(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("randevular", "TAM");
  const subeId = kullanici.aktifSubeId;

  const cozumlenen = randevuSemasi.safeParse(formuOku(formVerisi));
  if (!cozumlenen.success) {
    return {
      alanHatalari: alanHatalari(cozumlenen.error),
      degerler: formDegerleri(formVerisi, RANDEVU_FORM_ALANLARI),
    };
  }

  const veri = cozumlenen.data;
  const girilenler = formDegerleri(formVerisi, RANDEVU_FORM_ALANLARI);

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
        select: { ad: true, aktif: true, sureDk: true, ucretKurus: true, tekrarli: true },
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

  const indirimKurus = liradanKurusa(veri.indirimLira);
  if (indirimKurus > yetkinlik.hizmet.ucretKurus) {
    return {
      alanHatalari: { indirimLira: "İndirim, hizmetin ücretini aşamaz." },
      degerler: girilenler,
    };
  }

  // Tekrar YALNIZ tekrarlı hizmetlerde; zekâ testleri her seferinde elle.
  const haftaSayisi = yetkinlik.hizmet.tekrarli ? veri.haftaSayisi : 1;
  const tarihler = tekrarTarihleri(baslangic, haftaSayisi);
  const araliklar: Aralik[] = tarihler.map((tarih) =>
    randevuAraligi(tarih, yetkinlik.hizmet.sureDk),
  );

  const baglam = await uzmanBaglami({
    uzmanId: veri.uzmanId,
    subeId,
    ilk: araliklar[0].baslangic,
    son: araliklar[araliklar.length - 1].bitis,
  });

  /**
   * Serinin BİR tarihi bile engelliyse tamamı reddediliyor.
   *
   * Kısmi seri sessizce eksik bir program üretirdi: koordinatör 8 hafta
   * istedi, 6 tanesi açıldı ve bunu ancak takvime bakınca fark ederdi.
   * Hangi hafta ve neden engellendiği mesajda yazılı.
   */
  for (const [sira, aralik] of araliklar.entries()) {
    const engel = randevuEngeli({ randevu: aralik, ...baglam });
    if (!engel) continue;

    const nerede =
      araliklar.length === 1
        ? ""
        : ` (${sira + 1}. hafta — ${zamanMetni(aralik.baslangic)})`;
    return { hata: `${engel.mesaj}${nerede}`, degerler: girilenler };
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

    if (veri.ogrenciId) {
      // şube-muaf: öğrencinin bu şubeye ait olduğu doğrulanıyor.
      const ogrenci = await tx.student.findFirst({
        where: { id: veri.ogrenciId, branchId: subeId },
        select: { id: true },
      });
      if (!ogrenci) return { hata: "Seçilen öğrenci bu şubede bulunamadı." };
    }

    await tx.randevu.createMany({
      data: araliklar.map((aralik) => ({
        branchId: subeId,
        uzmanId: veri.uzmanId,
        hizmetId: veri.hizmetId,
        veliId: veli,
        ogrenciId: veri.ogrenciId,
        baslangic: aralik.baslangic,
        bitis: aralik.bitis,
        // Ücret açılış anında KOPYALANIYOR: katalogdaki zam bu randevuyu
        // ve geçmiş haftaların cirosunu değiştirmemeli (§17.4).
        ucretKurus: yetkinlik.hizmet.ucretKurus,
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

  tazele();
  return {
    basari:
      araliklar.length === 1
        ? `Randevu açıldı: ${zamanMetni(baslangic)}.`
        : `${araliklar.length} haftalık seri açıldı; ilki ${zamanMetni(baslangic)}.`,
  };
}

/** Randevunun sonucunu işaretler: gerçekleşti / gelmedi / planlandı. */
export async function randevuDurumDegistir(
  randevuId: string,
  durum: "PLANLANDI" | "GERCEKLESTI" | "GELMEDI",
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("randevular", "TAM");

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
  const kullanici = await yonetimZorunlu("randevular", "TAM");

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
