"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { tarihBicimle, tarihCozumle } from "@/lib/tarih";

/**
 * Grup takvimi — bir grubun oturum günlerini taşıma, ekleme ve silme.
 *
 * NEDEN GRUP BAZINDA: takvim önceden programa aitti (`TermWeek`) ve grup
 * açılırken oturumlar ondan bir kez üretiliyordu; sonrasında hiçbir şey
 * değiştirilemiyordu. Gerçek hayat böyle işlemiyor — hoca hastalanıyor, bir
 * hafta atlanıyor, telafi için başka bir hafta hem cumartesi hem pazar
 * yapılıyor. Bunların hepsi TEK BİR GRUBU ilgilendiriyor, bütün programı
 * değil.
 *
 * Şema değişmedi çünkü gerekmiyordu: `Session` zaten gruba bağlı ve kendi
 * tarihini taşıyor. Eksik olan yalnızca bu tarihleri düzenleyecek eylemlerdi.
 *
 * PUANLAR KORUNUR: puanlama oturuma (`Score.sessionId`) bağlı, tarihe değil.
 * Bir gün ertelendiğinde girilmiş puanlamalar oturumla birlikte taşınır.
 * Silme ise puanlamayı da götürür; bu yüzden puanlanmış gün silinemiyor.
 */

export type TakvimDurumu = { basari?: string; hata?: string };

/** Grubu şubeye kapalı okur ve programının atölyelerini de getirir. */
async function grubuOku(grupId: string, subeId: string) {
  return db.group.findFirst({
    where: { id: grupId, branchId: subeId },
    select: {
      id: true,
      name: true,
      termId: true,
      clubId: true,
      term: {
        select: {
          id: true,
          workshops: {
            orderBy: { sortOrder: "asc" },
            select: { workshopTypeId: true },
          },
        },
      },
      club: {
        select: {
          id: true,
          workshops: {
            orderBy: { sortOrder: "asc" },
            select: { workshopTypeId: true },
          },
        },
      },
    },
  });
}

/** Değişiklik sonrası tazelenecek yollar — grup iki programdan birine ait. */
function yollariTazele(grup: { termId: string | null; clubId: string | null }) {
  if (grup.termId) revalidatePath(`/koordinator/donemler/${grup.termId}`);
  if (grup.clubId) revalidatePath(`/koordinator/kulupler/${grup.clubId}`);
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator/puanlamalar");
  revalidatePath("/koordinator");
}

function tarihiCoz(metin: string): Date | null {
  const tarih = tarihCozumle(metin);
  return tarih ?? null;
}

/**
 * Bir günü başka tarihe taşır.
 *
 * O gündeki bütün atölye oturumları birlikte taşınır — bir günün yarısını
 * ertelemek diye bir şey yok. Girilmiş puanlamalar oturuma bağlı olduğu için
 * onlarla beraber gelir.
 */
export async function grupGunuTasi(
  grupId: string,
  eskiTarihMetni: string,
  yeniTarihMetni: string,
): Promise<TakvimDurumu> {
  const kullanici = await yonetimZorunlu("gruplar", "TAM");

  const eski = tarihiCoz(eskiTarihMetni);
  const yeni = tarihiCoz(yeniTarihMetni);
  if (!eski || !yeni) return { hata: "Tarih okunamadı." };
  if (eski.getTime() === yeni.getTime()) {
    return { basari: "Tarih zaten aynı." };
  }

  const grup = await grubuOku(grupId, kullanici.aktifSubeId);
  if (!grup) return { hata: "Grup bulunamadı." };

  // Aynı gruba aynı tarihte iki gün konamaz: veritabanındaki
  // `@@unique([groupId, date, workshopTypeId])` zaten engelliyor ama hata
  // mesajı anlaşılır olsun diye önceden bakılıyor.
  const dolu = await db.session.count({
    where: { groupId: grupId, date: yeni },
  });
  if (dolu > 0) {
    return {
      hata: `${tarihBicimle(yeni)} bu grubun takviminde zaten var. Önce o günü taşıyın veya silin.`,
    };
  }

  const sonuc = await db.session.updateMany({
    where: { groupId: grupId, date: eski },
    data: { date: yeni },
  });

  if (sonuc.count === 0) return { hata: "Taşınacak oturum bulunamadı." };

  yollariTazele(grup);
  return {
    basari: `${tarihBicimle(eski)} → ${tarihBicimle(yeni)} taşındı (${sonuc.count} atölye).`,
  };
}

/**
 * Takvime yeni bir gün ekler — telafi günü.
 *
 * Programın bütün atölyeleri o güne yazılır: dönemde 5, kulüpte 3. Yarım gün
 * diye bir kavram yok; eksik atölyeli bir gün puanlama ekranında "eksik form"
 * olarak görünür ve koordinatörü boşuna uğraştırırdı.
 *
 * Eklenen gün hiçbir programa haftasına bağlanmıyor (`termWeekId: null`):
 * telafi günü dönemin 3. haftası değildir, arasına sıkışan fazladan bir
 * gündür. Puanlama ekranı hafta numarasını zaten boş geçebiliyor.
 */
export async function grupGunuEkle(
  grupId: string,
  tarihMetni: string,
): Promise<TakvimDurumu> {
  const kullanici = await yonetimZorunlu("gruplar", "TAM");

  const tarih = tarihiCoz(tarihMetni);
  if (!tarih) return { hata: "Tarih okunamadı." };

  const grup = await grubuOku(grupId, kullanici.aktifSubeId);
  if (!grup) return { hata: "Grup bulunamadı." };

  const atolyeler = (grup.term?.workshops ?? grup.club?.workshops ?? []).map(
    (a) => a.workshopTypeId,
  );
  if (atolyeler.length === 0) {
    return { hata: "Programın atölyeleri bulunamadı." };
  }

  const dolu = await db.session.count({ where: { groupId: grupId, date: tarih } });
  if (dolu > 0) {
    return { hata: `${tarihBicimle(tarih)} bu grubun takviminde zaten var.` };
  }

  await db.session.createMany({
    data: atolyeler.map((workshopTypeId) => ({
      groupId: grupId,
      workshopTypeId,
      termWeekId: null,
      date: tarih,
    })),
  });

  yollariTazele(grup);
  return {
    basari: `${tarihBicimle(tarih)} eklendi (${atolyeler.length} atölye).`,
  };
}

/**
 * Bir günü takvimden çıkarır.
 *
 * PUANLANMIŞ GÜN SİLİNEMEZ. `Score` oturuma `Cascade` ile bağlı; silme
 * girilmiş puanlamaları ve cevap satırlarını da götürürdü. Koordinatör
 * yanlış bir günü temizlemek isterken bir stajyerin doldurduğu formları
 * sessizce yok edebilirdi. Silmek isteyen önce puanlamaları temizlemeli.
 */
export async function grupGunuSil(
  grupId: string,
  tarihMetni: string,
): Promise<TakvimDurumu> {
  const kullanici = await yonetimZorunlu("gruplar", "TAM");

  const tarih = tarihiCoz(tarihMetni);
  if (!tarih) return { hata: "Tarih okunamadı." };

  const grup = await grubuOku(grupId, kullanici.aktifSubeId);
  if (!grup) return { hata: "Grup bulunamadı." };

  const puanlamaSayisi = await db.score.count({
    where: { session: { groupId: grupId, date: tarih } },
  });
  if (puanlamaSayisi > 0) {
    return {
      hata: `${tarihBicimle(tarih)} gününde ${puanlamaSayisi} puanlama var; gün silinemez. Silmek için önce o günün formlarını temizleyin.`,
    };
  }

  const sonuc = await db.session.deleteMany({ where: { groupId: grupId, date: tarih } });
  if (sonuc.count === 0) return { hata: "Silinecek oturum bulunamadı." };

  yollariTazele(grup);
  return {
    basari: `${tarihBicimle(tarih)} takvimden çıkarıldı (${sonuc.count} atölye).`,
  };
}
