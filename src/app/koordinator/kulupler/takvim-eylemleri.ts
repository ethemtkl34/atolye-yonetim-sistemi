"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { takvimKilidiAl } from "@/lib/takvim-kilidi";
import {
  gunEklemePlani,
  gunSilmePlani,
  gunTasimaPlani,
  type HaftaKaymasi,
} from "@/lib/kulup-takvimi";
import { EN_FAZLA_HAFTA } from "@/lib/kurallar";
import {
  gunleriSirala,
  gunundenGun,
  tarihBicimle,
  tarihCozumle,
} from "@/lib/tarih";
import { KULUP_DURUMLARI } from "@/lib/durumlar";
import type { EylemDurumu } from "@/lib/formlar";

/**
 * KULÜP takvimi — kulübün ortak gün listesini (`Club.weekDates`) düzenler.
 *
 * Grup takviminden (gruplar/takvim-eylemleri.ts) farkı kapsam: oradaki üç
 * işlem TEK grubun oturumlarına dokunur ve kulübün gün listesini değiştirmez;
 * buradakiler kulübün BÜTÜN gruplarına ve müfredatına birden uygulanır, yeni
 * açılacak grupların takvimini de belirler.
 *
 * Kulüpte hafta, `weekDates` dizisindeki 1 tabanlı SIRADIR ve müfredat o
 * sıraya bağlıdır (bkz. CurriculumEntry şema notu). Gün ekleme/silme/taşıma
 * sırayı değiştirdiğinde oturumların hafta numaraları ve müfredat girdileri
 * planla BİRLİKTE kaydırılır — konu kendi gününü takip eder, "müfredat
 * sessizce kayar" sorunu burada çözülür.
 *
 * PUANLAR KORUNUR: puanlama oturuma bağlı; taşınan haftanın puanları oturumla
 * gider, puanlanmış hafta silinemez. Bütün yazmalar kulübün her grubunun
 * takvim kilidi altında çalışır (gruplar/takvim-eylemleri.ts gerekçesi).
 */

/**
 * Hafta numarası kaydırmalarının geçici ofseti. İki fazlı uygulanır: önce
 * hedef numara + ofset yazılır (kaymalar zincirleme birbirini ezmesin ve
 * `CurriculumEntry` unique kısıdı ara adımda çakışmasın), sonra ofset tek
 * UPDATE ile düşülür. `EN_FAZLA_HAFTA`nın çok üstünde olduğu için gerçek
 * numaralarla çakışamaz.
 */
const HAFTA_OFSETI = 10_000;

async function kulubuOku(kulupId: string) {
  // şube-muaf: kulüp iki şubede ortak ve takvim işlemleri kulübün BÜTÜN
  // gruplarına uygulanır; grup listesi bilerek süzgeçsiz okunur (kilit ve
  // toplu güncelleme kapsamı). Yetki kapısı `kulupler: TAM`.
  return db.club.findUnique({
    where: { id: kulupId },
    select: {
      id: true,
      status: true,
      date: true,
      weekDates: true,
      workshops: {
        orderBy: { sortOrder: "asc" },
        select: { workshopTypeId: true },
      },
      // Kilit sırası tutarlı olsun diye gruplar hep aynı sırayla okunur.
      groups: { orderBy: { id: "asc" }, select: { id: true } },
    },
  });
}

type OkunanKulup = NonNullable<Awaited<ReturnType<typeof kulubuOku>>>;

function durumEngeli(kulup: OkunanKulup): string | null {
  if (kulup.status === "TASLAK" || kulup.status === "KAYIT_ALIYOR") return null;
  return `Bu kulüp "${KULUP_DURUMLARI[kulup.status].etiket}" durumunda; takvimi düzenlenemez.`;
}

/** Eski kulüplerde `weekDates` boş kalmış olabilir; tek günlük kulüp sayılır. */
function kulupGunleri(kulup: OkunanKulup): Date[] {
  return kulup.weekDates.length > 0 ? kulup.weekDates : [kulup.date];
}

function yollariTazele(kulupId: string): void {
  revalidatePath(`/koordinator/kulupler/${kulupId}`);
  revalidatePath(`/koordinator/kulupler/${kulupId}/mufredat`);
  revalidatePath("/koordinator/kulupler");
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator/puanlamalar");
  revalidatePath("/koordinator");
}

/**
 * Hafta numarası kaymalarını oturumlara ve müfredat girdilerine uygular.
 * Telafi günlerine (weekNumber = null) dokunmaz.
 */
async function kaymalariUygula(
  tx: Prisma.TransactionClient,
  kulupId: string,
  grupIdleri: readonly string[],
  kaymalar: readonly HaftaKaymasi[],
): Promise<void> {
  if (kaymalar.length === 0) return;

  for (const kayma of kaymalar) {
    if (grupIdleri.length > 0) {
      // şube-muaf: `grupIdleri` kulübün bütün grupları — hafta kayması iki
      // şubeye birden uygulanmazsa numaralar şubeler arasında ayrışırdı.
      await tx.session.updateMany({
        where: { groupId: { in: [...grupIdleri] }, weekNumber: kayma.eski },
        data: { weekNumber: kayma.yeni + HAFTA_OFSETI },
      });
    }
    await tx.curriculumEntry.updateMany({
      where: { clubId: kulupId, weekNumber: kayma.eski },
      data: { weekNumber: kayma.yeni + HAFTA_OFSETI },
    });
  }

  if (grupIdleri.length > 0) {
    await tx.$executeRaw`
      UPDATE "Session" SET "weekNumber" = "weekNumber" - ${HAFTA_OFSETI}
      WHERE "groupId" IN (${Prisma.join([...grupIdleri])})
        AND "weekNumber" > ${HAFTA_OFSETI}
    `;
  }
  await tx.$executeRaw`
    UPDATE "CurriculumEntry" SET "weekNumber" = "weekNumber" - ${HAFTA_OFSETI}
    WHERE "clubId" = ${kulupId} AND "weekNumber" > ${HAFTA_OFSETI}
  `;
}

/** Yeni gün listesini kulübe ve grupların gün alanına yazar. */
async function takvimiYaz(
  tx: Prisma.TransactionClient,
  kulupId: string,
  yeniTarihler: readonly Date[],
): Promise<void> {
  await tx.club.update({
    where: { id: kulupId },
    data: { date: yeniTarihler[0], weekDates: [...yeniTarihler] },
  });

  // Grubun gün listesi kulübün tarihlerinden türetilir (kulupOlustur deseni);
  // görünüm alanıdır, oturumlar kendi tarihlerini taşır.
  const gunler = gunleriSirala([
    ...new Set(yeniTarihler.map((tarih) => gunundenGun(tarih))),
  ]);
  // şube-muaf: kulübün takvimi bütün gruplarının ortak günüdür; iki şubenin
  // grupları birden güncellenir (yetki kapısı `kulupler: TAM`).
  await tx.group.updateMany({
    where: { clubId: kulupId },
    data: { days: gunler },
  });
}

/**
 * Kulüp takvimine gün ekler: kulübün BÜTÜN gruplarına o günün oturumları
 * yazılır, araya giriyorsa sonraki haftalar müfredatlarıyla birlikte kayar.
 */
export async function kulupGunuEkle(
  kulupId: string,
  tarihMetni: string,
): Promise<EylemDurumu> {
  await yonetimZorunlu("kulupler", "TAM");

  const tarih = tarihCozumle(tarihMetni);
  if (!tarih) return { hata: "Tarih okunamadı." };

  const kulup = await kulubuOku(kulupId);
  if (!kulup) return { hata: "Kulüp bulunamadı." };

  const engel = durumEngeli(kulup);
  if (engel) return { hata: engel };

  const mevcut = kulupGunleri(kulup);
  if (mevcut.length >= EN_FAZLA_HAFTA) {
    return { hata: `Kulüp en fazla ${EN_FAZLA_HAFTA} gün olabilir.` };
  }

  const plan = gunEklemePlani(mevcut, tarih);
  if ("hata" in plan) return { hata: plan.hata };

  const grupIdleri = kulup.groups.map((grup) => grup.id);
  const atolyeIdleri = kulup.workshops.map((atolye) => atolye.workshopTypeId);

  const sonuc = await db.$transaction(async (tx) => {
    for (const grupId of grupIdleri) await takvimKilidiAl(tx, grupId);

    // şube-muaf: bir grup o güne elle telafi günü açmış olabilir; oturum
    // çakışması (`groupId, date, workshopTypeId` unique) ham hata yerine
    // anlaşılır mesaja çevrilir. Gün bütün gruplara ekleneceği için kontrol
    // iki şubenin gruplarını da kapsamak zorunda.
    const cakisan = await tx.session.findFirst({
      where: { group: { clubId: kulupId }, date: tarih },
      select: { group: { select: { name: true } } },
    });
    if (cakisan) {
      return {
        hata: `${tarihBicimle(tarih)} tarihinde "${cakisan.group.name}" grubunun zaten oturumu var (telafi günü olabilir). Önce grup takviminden o günü taşıyın.`,
      };
    }

    await kaymalariUygula(tx, kulupId, grupIdleri, plan.kaymalar);

    // şube-muaf: yeni günün oturumları kulübün bütün gruplarına (iki şube)
    // yazılır — `kulupOlustur`daki üretimin devamı.
    await tx.session.createMany({
      data: grupIdleri.flatMap((grupId) =>
        atolyeIdleri.map((workshopTypeId) => ({
          groupId: grupId,
          workshopTypeId,
          termWeekId: null,
          weekNumber: plan.haftaNo,
          date: tarih,
        })),
      ),
    });

    await takvimiYaz(tx, kulupId, plan.yeniTarihler);
    return { oturum: grupIdleri.length * atolyeIdleri.length };
  });

  if ("hata" in sonuc) return sonuc;

  yollariTazele(kulupId);
  const kayma =
    plan.kaymalar.length > 0
      ? ` Sonraki ${plan.kaymalar.length} gün, müfredatıyla birlikte bir hafta kaydı.`
      : "";
  return {
    basari: `${tarihBicimle(tarih)} kulüp takvimine ${plan.haftaNo}. gün olarak eklendi (${grupIdleri.length} grupta ${sonuc.oturum} oturum).${kayma}`,
  };
}

/**
 * Kulüp takviminden gün siler. PUANLANMIŞ GÜN SİLİNEMEZ (grup takvimindeki
 * kuralın aynısı); o günün müfredat girdileri de silinir ve söylenir.
 */
export async function kulupGunuSil(
  kulupId: string,
  tarihMetni: string,
): Promise<EylemDurumu> {
  await yonetimZorunlu("kulupler", "TAM");

  const tarih = tarihCozumle(tarihMetni);
  if (!tarih) return { hata: "Tarih okunamadı." };

  const kulup = await kulubuOku(kulupId);
  if (!kulup) return { hata: "Kulüp bulunamadı." };

  const engel = durumEngeli(kulup);
  if (engel) return { hata: engel };

  const plan = gunSilmePlani(kulupGunleri(kulup), tarih);
  if ("hata" in plan) return { hata: plan.hata };

  const grupIdleri = kulup.groups.map((grup) => grup.id);

  const sonuc = await db.$transaction(async (tx) => {
    for (const grupId of grupIdleri) await takvimKilidiAl(tx, grupId);

    // şube-muaf: hafta, tarihle değil numarayla ve bütün gruplardan silinir;
    // diğer şubenin puanlaması da günü silinmekten korumalı, bu yüzden sayım
    // iki şubeyi kapsar.
    const puanlamaSayisi = await tx.score.count({
      where: {
        session: { group: { clubId: kulupId }, weekNumber: plan.haftaNo },
      },
    });
    if (puanlamaSayisi > 0) {
      return {
        hata: `${plan.haftaNo}. günde ${puanlamaSayisi} puanlama var; gün silinemez. Silmek için önce o günün formlarını temizleyin.`,
      };
    }

    // şube-muaf: silinen hafta kulübün bütün gruplarından kalkar; puanlama
    // koruması hemen üstte iki şubeyi kapsayarak alındı.
    const silinenOturum =
      grupIdleri.length > 0
        ? await tx.session.deleteMany({
            where: {
              groupId: { in: grupIdleri },
              weekNumber: plan.haftaNo,
            },
          })
        : { count: 0 };

    const silinenMufredat = await tx.curriculumEntry.deleteMany({
      where: { clubId: kulupId, weekNumber: plan.haftaNo },
    });

    await kaymalariUygula(tx, kulupId, grupIdleri, plan.kaymalar);
    await takvimiYaz(tx, kulupId, plan.yeniTarihler);

    return { oturum: silinenOturum.count, mufredat: silinenMufredat.count };
  });

  if ("hata" in sonuc) return sonuc;

  yollariTazele(kulupId);
  const mufredatNotu =
    sonuc.mufredat > 0
      ? ` ${sonuc.mufredat} müfredat girdisi de silindi.`
      : "";
  const kayma =
    plan.kaymalar.length > 0
      ? ` Sonraki günler müfredatıyla birlikte geri kaydı.`
      : "";
  return {
    basari: `${tarihBicimle(tarih)} kulüp takviminden çıkarıldı (${sonuc.oturum} oturum).${mufredatNotu}${kayma}`,
  };
}

/**
 * Kulüp gününü başka tarihe taşır. Gün sırada yer değiştirirse haftanın
 * oturumları, puanlamaları ve müfredat girdisi yeni numarasıyla birlikte
 * gider; aradaki haftalar da kayar.
 */
export async function kulupGununuTasi(
  kulupId: string,
  eskiTarihMetni: string,
  yeniTarihMetni: string,
): Promise<EylemDurumu> {
  await yonetimZorunlu("kulupler", "TAM");

  const eski = tarihCozumle(eskiTarihMetni);
  const yeni = tarihCozumle(yeniTarihMetni);
  if (!eski || !yeni) return { hata: "Tarih okunamadı." };

  const kulup = await kulubuOku(kulupId);
  if (!kulup) return { hata: "Kulüp bulunamadı." };

  const engel = durumEngeli(kulup);
  if (engel) return { hata: engel };

  const plan = gunTasimaPlani(kulupGunleri(kulup), eski, yeni);
  if ("hata" in plan) return { hata: plan.hata };

  const grupIdleri = kulup.groups.map((grup) => grup.id);

  const sonuc = await db.$transaction(async (tx) => {
    for (const grupId of grupIdleri) await takvimKilidiAl(tx, grupId);

    // şube-muaf: hedef tarihte taşınan haftaya ait OLMAYAN bir oturum varsa
    // (başka haftanın elle taşınmış günü ya da telafi) unique kısıdı
    // patlardı; taşıma bütün grupları etkilediği için kontrol iki şubeyi
    // kapsar.
    const cakisan = await tx.session.findFirst({
      where: {
        group: { clubId: kulupId },
        date: yeni,
        NOT: { weekNumber: plan.eskiHaftaNo },
      },
      select: { group: { select: { name: true } } },
    });
    if (cakisan) {
      return {
        hata: `${tarihBicimle(yeni)} tarihinde "${cakisan.group.name}" grubunun zaten oturumu var. Önce grup takviminden o günü taşıyın.`,
      };
    }

    if (grupIdleri.length > 0) {
      // şube-muaf: taşınan haftanın tarihi bütün gruplarda (iki şube)
      // kulübün yeni gününe çekilir — kulüp takvimi esas kaynaktır; grup
      // bazlı bir erteleme yapıldıysa bu işlem onu da yeni tarihe toplar.
      await tx.session.updateMany({
        where: {
          groupId: { in: grupIdleri },
          weekNumber: plan.eskiHaftaNo,
        },
        data: { date: yeni },
      });
    }

    await kaymalariUygula(tx, kulupId, grupIdleri, [
      ...plan.kaymalar,
      ...(plan.eskiHaftaNo !== plan.yeniHaftaNo
        ? [{ eski: plan.eskiHaftaNo, yeni: plan.yeniHaftaNo }]
        : []),
    ]);
    await takvimiYaz(tx, kulupId, plan.yeniTarihler);

    return {};
  });

  if ("hata" in sonuc) return sonuc;

  yollariTazele(kulupId);
  const siraNotu =
    plan.eskiHaftaNo !== plan.yeniHaftaNo
      ? ` Gün ${plan.eskiHaftaNo}. sıradan ${plan.yeniHaftaNo}. sıraya geçti; müfredatı ve puanlamaları birlikte taşındı.`
      : " Girilmiş puanlamalar oturumlarla birlikte taşındı.";
  return {
    basari: `${tarihBicimle(eski)} → ${tarihBicimle(yeni)} taşındı.${siraNotu}`,
  };
}
