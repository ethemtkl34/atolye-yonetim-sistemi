import type { Prisma } from "@/generated/prisma/client";
import { ACIK_ASAMALAR } from "@/lib/aday-durumlari";

/**
 * §16.9 — Aday → öğrenci dönüşümü.
 *
 * Dönüşüm iki kapıdan yapılabiliyor: yeni öğrenci formu (`ogrenciEkle`,
 * adayı gizli alanla taşır) ve mevcut öğrenciyle eşleştirme. İkisi de aynı
 * yazımı yapmalı — bu yüzden yazım burada, tek yerde.
 *
 * `"use server"` dosyasında duramaz (oradan yalnız async fonksiyon dışa
 * aktarılabilir) ve `tx` aldığı için çağıranın transaction'ına katılır:
 * öğrenci yazılıp aday güncellenemezse ikisi birden geri alınır.
 */

/**
 * Görüşmede verilen karara göre öğrenci oluştuktan SONRA gidilecek yer.
 * Aday etkinliğine de yazılır: "kazanılanların kaçı kayda gitti" sorusunun
 * cevabı buradan okunur.
 */
export const DONUSUM_HEDEFLERI = [
  "kayit",
  "zekaTesti",
  "danismanlik",
  "yok",
] as const;

export type DonusumHedefi = (typeof DONUSUM_HEDEFLERI)[number];

const HEDEF_ETIKETLERI: Record<DonusumHedefi, string> = {
  kayit: "dönem/kulüp kaydı",
  zekaTesti: "zekâ testi",
  danismanlik: "danışmanlık",
  yok: "belirtilmedi",
};

/**
 * Adaydaki tek parça çocuk adını ad/soyad olarak böler.
 *
 * Aday formu tek alan soruyor (telefonun ortasında iki alan doldurtmak
 * gereksiz sürtünme), öğrenci kaydı ikisini ayrı istiyor. Son kelime soyad
 * sayılır — Türkçede yaygın kalıp bu; tek kelimelik adda soyad boş kalır ve
 * kullanıcı öğrenci formunda düzeltir (alanlar ön-dolu ama kilitli değil).
 */
export function adiBol(tamAd: string | null): {
  firstName: string;
  lastName: string;
} {
  const parcalar = (tamAd ?? "").trim().split(/\s+/).filter(Boolean);
  if (parcalar.length === 0) return { firstName: "", lastName: "" };
  if (parcalar.length === 1) return { firstName: parcalar[0], lastName: "" };
  return {
    firstName: parcalar.slice(0, -1).join(" "),
    lastName: parcalar[parcalar.length - 1],
  };
}

export type DonusumArgs = {
  adayId: string;
  subeId: string;
  ogrenciId: string;
  ogrenciAdi: string;
  kullaniciId: string;
  hedef: DonusumHedefi;
};

/**
 * Adayı KAZANILDI'ya taşır ve öğrenciye bağlar.
 *
 * `false` dönerse aday bulunamadı ya da bu arada kapandı; çağıran ya işlemi
 * geri alır ya da dönüşümsüz devam eder (öğrenci yine de açılmıştır —
 * "öğrenci oluştu ama aday kapanmadı" sessiz kalmamalı).
 */
export async function adayiKazanildiYap(
  tx: Prisma.TransactionClient,
  args: DonusumArgs,
): Promise<boolean> {
  // Önceki aşama okunuyor çünkü günlük satırı GERÇEK geçişi yazmalı. Sabit
  // bir `fromStage` yazmak (ilk sürümde öyleydi) geçmişi yalan söyletiyordu:
  // yoldan gelen aile YENI'den doğrudan kazanılabiliyor, oysa günlükte
  // "görüşme yapıldı" diye görünüyordu.
  const aday = await tx.lead.findFirst({
    where: {
      id: args.adayId,
      branchId: args.subeId,
      stage: { in: ACIK_ASAMALAR },
    },
    select: { stage: true },
  });
  if (!aday) return false;

  const sonuc = await tx.lead.updateMany({
    // Aşama koşulda: kapanmış (kazanılmış/kaybedilmiş) aday yeniden
    // dönüştürülemez ve iki sekmeden aynı anda dönüşüm yarışı olmaz.
    where: {
      id: args.adayId,
      branchId: args.subeId,
      stage: aday.stage,
    },
    data: {
      stage: "KAZANILDI",
      convertedStudentId: args.ogrenciId,
      convertedAt: new Date(),
      // Kapanan aday kuyrukta iş üretmemeli.
      nextActionDate: null,
      nextActionNote: null,
    },
  });

  if (sonuc.count === 0) return false;

  await tx.leadActivity.create({
    data: {
      leadId: args.adayId,
      type: "ASAMA_DEGISIMI",
      fromStage: aday.stage,
      toStage: "KAZANILDI",
      note: `Öğrenciye dönüştürüldü → ${args.ogrenciAdi} · sonraki adım: ${HEDEF_ETIKETLERI[args.hedef]}`,
      createdByUserId: args.kullaniciId,
    },
  });

  return true;
}

/**
 * Dönüşümden sonra kullanıcının gideceği adres.
 *
 * `danismanlik` hedefi bilerek profile götürüyor: danışan başvurusunu açmak
 * `danismanlik: TAM` istiyor ve modülün asıl kullanıcısı olan Danışma
 * Görevlisi'nde o yetki YOK (sağlık mahremiyeti kuralı). Yetkisiz kullanıcıyı
 * guard'a çarpacak bir adrese göndermek tuzak olurdu; karar etkinlik
 * günlüğünde yazılı kalıyor ve danışmanlık ekibi kendi ekranından açıyor.
 */
export function donusumYolu(
  hedef: DonusumHedefi,
  ogrenciId: string,
  danismanlikYetkisi: boolean,
): string {
  const profil = `/koordinator/ogrenciler/${ogrenciId}`;

  switch (hedef) {
    case "kayit":
      return `/koordinator/kayitlar/yeni?studentId=${ogrenciId}`;
    case "zekaTesti":
      return `${profil}?bolum=zeka-testleri`;
    case "danismanlik":
      return danismanlikYetkisi
        ? `/koordinator/danismanlik?ogrenci=${ogrenciId}`
        : profil;
    default:
      return profil;
  }
}
