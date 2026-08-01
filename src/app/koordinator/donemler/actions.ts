"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import {
  bugun,
  haftaCapasi,
  tarihCozumle,
  tarihMetni,
} from "@/lib/tarih";
import {
  donemOturumlariniUret,
  mevcutHaftaNumarasi,
} from "@/lib/session-generator";
import { DONEM_ATOLYE_SAYISI, HAFTA_SAYISI } from "@/lib/kurallar";
import { alanHatalari, formDegerleri, GRUP_SEMASI } from "@/lib/formlar";
import { DONEM_DURUMLARI, DONEM_DURUM_GECISLERI } from "@/lib/durumlar";

/** §4 — Dönem ve grup işlemleri. */

export type EylemDurumu = {
  basari?: string;
  hata?: string;
  alanHatalari?: Record<string, string>;
  /** Doğrulama hatasında girilen değerler — form sıfırlanınca geri yazılır. */
  degerler?: Record<string, string>;
};

/** Dönem sihirbazının metin/seçim alanları (hafta ve atölye seçimi hariç). */
const DONEM_FORM_ALANLARI = [
  "name",
  "description",
  "grupAdi",
  "grupGunu",
  "grupZamanDilimi",
  "grupKontenjani",
] as const;

const GRUP_FORM_ALANLARI = ["name", "day", "timeSlot", "capacity"] as const;

/** Grup şeması dönem ve kulüpte ortak — tek kaynak `lib/formlar.ts`. */
const grupSemasi = GRUP_SEMASI;

const donemSemasi = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Dönem adı en az 2 karakter olmalı")
    .max(100, "Dönem adı en fazla 100 karakter olabilir"),
  description: z
    .string()
    .trim()
    .max(500, "Açıklama en fazla 500 karakter olabilir")
    .optional()
    .transform((d) => (d ? d : null)),
});

/**
 * Formdan gelen 10 tarihi doğrular ve hafta çapalarına çevirir.
 *
 * §4.1 — Haftalar takvimden tek tek seçilir; tatil haftaları seçilmez, bu
 * yüzden takvim 11–12 haftaya uzayabilir ve tarihler ardışık olmak zorunda
 * değildir. Zorunlu olan: tam 10 adet, hepsi hafta sonu, hepsi ayrı hafta.
 */
function haftalariDogrula(
  tarihMetinleri: string[],
): { hata: string } | { haftalar: Date[] } {
  if (tarihMetinleri.length !== HAFTA_SAYISI) {
    return {
      hata: `Tam ${HAFTA_SAYISI} eğitim haftası seçilmeli. Şu an ${tarihMetinleri.length} hafta seçili.`,
    };
  }

  const capalar: Date[] = [];

  for (const metin of tarihMetinleri) {
    const tarih = tarihCozumle(metin);
    if (!tarih) return { hata: `Geçersiz tarih: ${metin}` };

    const capa = haftaCapasi(tarih);
    if (!capa) {
      return {
        hata: `${metin} bir hafta sonu değil. Atölyeler yalnızca cumartesi ve pazar yapılır.`,
      };
    }

    capalar.push(capa);
  }

  const benzersiz = new Set(capalar.map(tarihMetni));
  if (benzersiz.size !== HAFTA_SAYISI) {
    return {
      hata: "Aynı hafta sonu birden fazla kez seçilmiş. Her hafta yalnızca bir kez seçilebilir.",
    };
  }

  capalar.sort((a, b) => a.getTime() - b.getTime());
  return { haftalar: capalar };
}

/** Dönemin 5 atölyesini doğrular. */
async function atolyeleriDogrula(
  atolyeIdleri: string[],
): Promise<{ hata: string } | { idler: string[] }> {
  if (atolyeIdleri.length !== DONEM_ATOLYE_SAYISI) {
    return {
      hata: `Tam ${DONEM_ATOLYE_SAYISI} atölye seçilmeli. Şu an ${atolyeIdleri.length} atölye seçili.`,
    };
  }

  if (new Set(atolyeIdleri).size !== atolyeIdleri.length) {
    return { hata: "Aynı atölye birden fazla kez seçilmiş." };
  }

  const bulunan = await db.workshopType.count({
    where: { id: { in: atolyeIdleri }, active: true },
  });

  if (bulunan !== atolyeIdleri.length) {
    return {
      hata: "Seçilen atölyelerden biri artık mevcut değil veya pasife alınmış.",
    };
  }

  return { idler: atolyeIdleri };
}

/**
 * Dönem kadrosuna seçilen stajyerleri doğrular.
 *
 * Kadro isteğe bağlıdır (boş liste geçerli): dönem stajyerler belli olmadan
 * da açılabilmeli. Dolu geldiğinde ise her satırın gerçekten aktif bir
 * stajyer hesabı olduğu doğrulanır; pasif hesap kadroya alınırsa kayıt
 * ekranında hiç listelenmeyen bir "hayalet" stajyer oluşurdu.
 */
async function stajyerleriDogrula(
  stajyerIdleri: string[],
): Promise<{ hata: string } | { idler: string[] }> {
  if (stajyerIdleri.length === 0) return { idler: [] };

  if (new Set(stajyerIdleri).size !== stajyerIdleri.length) {
    return { hata: "Aynı stajyer birden fazla kez seçilmiş." };
  }

  const bulunan = await db.user.count({
    where: { id: { in: stajyerIdleri }, role: "STAJYER", active: true },
  });

  if (bulunan !== stajyerIdleri.length) {
    return {
      hata: "Seçilen stajyerlerden biri artık mevcut değil veya pasife alınmış.",
    };
  }

  return { idler: stajyerIdleri };
}

// ---------------------------------------------------------------------------
// Dönem oluşturma
// ---------------------------------------------------------------------------

export async function donemOlustur(
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const donem = donemSemasi.safeParse({
    name: formVerisi.get("name"),
    description: formVerisi.get("description"),
  });

  const grup = grupSemasi.safeParse({
    name: formVerisi.get("grupAdi"),
    day: formVerisi.get("grupGunu"),
    timeSlot: formVerisi.get("grupZamanDilimi"),
    capacity: formVerisi.get("grupKontenjani"),
  });

  const girilenler = formDegerleri(formVerisi, DONEM_FORM_ALANLARI);

  const hatalar: Record<string, string> = {};
  if (!donem.success) Object.assign(hatalar, alanHatalari(donem.error));
  if (!grup.success) {
    for (const [alan, mesaj] of Object.entries(alanHatalari(grup.error))) {
      hatalar[`grup.${alan}`] = mesaj;
    }
  }
  if (Object.keys(hatalar).length > 0) {
    return { alanHatalari: hatalar, degerler: girilenler };
  }
  if (!donem.success || !grup.success) return { hata: "Form doğrulanamadı." };

  const haftaSonucu = haftalariDogrula(
    formVerisi.getAll("tarihler").map(String).filter(Boolean),
  );
  if ("hata" in haftaSonucu) {
    return { hata: haftaSonucu.hata, degerler: girilenler };
  }

  const atolyeSonucu = await atolyeleriDogrula(
    formVerisi.getAll("atolyeler").map(String).filter(Boolean),
  );
  if ("hata" in atolyeSonucu) {
    return { hata: atolyeSonucu.hata, degerler: girilenler };
  }

  const stajyerSonucu = await stajyerleriDogrula(
    formVerisi.getAll("stajyerler").map(String).filter(Boolean),
  );
  if ("hata" in stajyerSonucu) {
    return { hata: stajyerSonucu.hata, degerler: girilenler };
  }

  // Dönem, haftaları, atölyeleri, ilk grubu ve grubun 50 oturumu tek işlemde
  // yazılır. Araya bir hata girerse yarım kalmış bir dönem oluşmamalı.
  const yeniDonem = await db.$transaction(async (tx) => {
    const olusturulan = await tx.term.create({
      data: {
        name: donem.data.name,
        description: donem.data.description,
        status: "KAYIT_ALIYOR",
        workshops: {
          create: atolyeSonucu.idler.map((atolyeId, sira) => ({
            workshopTypeId: atolyeId,
            sortOrder: sira,
          })),
        },
        weeks: {
          create: haftaSonucu.haftalar.map((tarih, sira) => ({
            weekNumber: sira + 1,
            date: tarih,
          })),
        },
        interns: {
          create: stajyerSonucu.idler.map((userId) => ({ userId })),
        },
      },
      include: { weeks: true },
    });

    const ilkGrup = await tx.group.create({
      data: {
        termId: olusturulan.id,
        name: grup.data.name,
        day: grup.data.day,
        timeSlot: grup.data.timeSlot,
        capacity: grup.data.capacity,
        startWeekNumber: 1,
      },
    });

    const oturumlar = donemOturumlariniUret({
      haftalar: olusturulan.weeks,
      atolyeIdleri: atolyeSonucu.idler,
      grupGunu: grup.data.day,
      baslangicHaftasi: 1,
    });

    await tx.session.createMany({
      data: oturumlar.map((oturum) => ({ ...oturum, groupId: ilkGrup.id })),
    });

    return olusturulan;
  });

  revalidatePath("/koordinator/donemler");
  revalidatePath("/koordinator/gruplar");
  redirect(`/koordinator/donemler/${yeniDonem.id}`);
}

// ---------------------------------------------------------------------------
// Dönem durumu
// ---------------------------------------------------------------------------

const DURUMLAR = [
  "TASLAK",
  "KAYIT_ALIYOR",
  "DEVAM_EDIYOR",
  "TAMAMLANDI",
  "ARSIVLENDI",
] as const;

export async function donemDurumDegistir(
  donemId: string,
  yeniDurum: (typeof DURUMLAR)[number],
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  if (!DURUMLAR.includes(yeniDurum)) {
    return { hata: "Geçersiz dönem durumu." };
  }

  const donem = await db.term.findUnique({
    where: { id: donemId },
    select: { status: true },
  });
  if (!donem) return { hata: "Dönem bulunamadı." };
  if (donem.status === yeniDurum) return { basari: "Dönem zaten bu durumda." };

  // Her durumdan her duruma geçilemez; izinli geçişler tek kaynaktan okunur.
  if (!DONEM_DURUM_GECISLERI[donem.status].includes(yeniDurum)) {
    return {
      hata: `"${DONEM_DURUMLARI[donem.status].etiket}" durumundan "${DONEM_DURUMLARI[yeniDurum].etiket}" durumuna doğrudan geçilemez.`,
    };
  }

  await db.term.update({
    where: { id: donemId },
    data: { status: yeniDurum },
  });

  revalidatePath("/koordinator/donemler");
  revalidatePath(`/koordinator/donemler/${donemId}`);
  // Durum değişince dönem aktif listelerden arşive (ya da tersine) geçebilir.
  revalidatePath("/koordinator/arsiv");
  revalidatePath("/koordinator/gruplar");
  revalidatePath("/koordinator");
  return { basari: "Dönem durumu güncellendi." };
}

// ---------------------------------------------------------------------------
// Gruba ekleme
// ---------------------------------------------------------------------------

/**
 * §4.2 — Döneme yeni grup ekler.
 *
 * §13.5 — Dönem başladıysa grup, geçmiş haftaları telafi etmeden mevcut
 * haftadan devam eder. Başlangıç haftası bugüne göre otomatik belirlenir;
 * koordinatöre kaç oturum üretildiği açıkça söylenir.
 */
export async function grupEkle(
  donemId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const grup = grupSemasi.safeParse({
    name: formVerisi.get("name"),
    day: formVerisi.get("day"),
    timeSlot: formVerisi.get("timeSlot"),
    capacity: formVerisi.get("capacity"),
  });

  if (!grup.success) {
    return {
      alanHatalari: alanHatalari(grup.error),
      degerler: formDegerleri(formVerisi, GRUP_FORM_ALANLARI),
    };
  }

  const donem = await db.term.findUnique({
    where: { id: donemId },
    include: {
      weeks: { orderBy: { weekNumber: "asc" } },
      workshops: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!donem) return { hata: "Dönem bulunamadı." };

  // Tamamlanmış veya arşivlenmiş döneme grup açılamaz — açılsaydı hiçbir
  // kayıt alamayacak, listelerde de görünmeyecek bir grup oluşurdu.
  if (donem.status === "TAMAMLANDI" || donem.status === "ARSIVLENDI") {
    return {
      hata: `Bu dönem "${DONEM_DURUMLARI[donem.status].etiket}" durumunda; yeni grup eklenemez.`,
    };
  }

  // Hafta, grubun gerçek toplanma gününe göre hesaplanır: pazar günü açılan
  // bir pazar grubunun o haftaki oturumu henüz yapılmamıştır.
  const baslangicHaftasi = mevcutHaftaNumarasi(
    donem.weeks,
    bugun(),
    grup.data.day,
  );

  if (baslangicHaftasi === null) {
    return {
      hata: "Bu dönemin bütün eğitim haftaları geçmiş. Yeni grup açılsa da hiç oturumu olmaz.",
    };
  }

  const atolyeIdleri = donem.workshops.map((w) => w.workshopTypeId);

  const oturumlar = donemOturumlariniUret({
    haftalar: donem.weeks,
    atolyeIdleri,
    grupGunu: grup.data.day,
    baslangicHaftasi,
  });

  await db.$transaction(async (tx) => {
    const yeniGrup = await tx.group.create({
      data: {
        termId: donemId,
        name: grup.data.name,
        day: grup.data.day,
        timeSlot: grup.data.timeSlot,
        capacity: grup.data.capacity,
        startWeekNumber: baslangicHaftasi,
      },
    });

    await tx.session.createMany({
      data: oturumlar.map((oturum) => ({ ...oturum, groupId: yeniGrup.id })),
    });
  });

  revalidatePath(`/koordinator/donemler/${donemId}`);
  revalidatePath("/koordinator/gruplar");

  const atlananHafta = baslangicHaftasi - 1;

  return {
    basari:
      atlananHafta > 0
        ? `"${grup.data.name}" eklendi. Dönem başladığı için grup ${baslangicHaftasi}. haftadan devam ediyor; ilk ${atlananHafta} hafta telafi edilmiyor. ${oturumlar.length} atölye oturumu oluşturuldu.`
        : `"${grup.data.name}" eklendi. ${oturumlar.length} atölye oturumu oluşturuldu.`,
  };
}

// ---------------------------------------------------------------------------
// Dönem stajyer kadrosu
// ---------------------------------------------------------------------------

/**
 * Dönemin stajyer kadrosunu formdaki seçimle eşitler.
 *
 * Kadrodan çıkarma korumalı: bu dönemin gruplarında hâlâ aktif kaydı olan
 * bir stajyer listeden çıkarılamaz. Çıkarılabilseydi o kayıtlar görünürde
 * "görevli olmayan" bir stajyerin üzerinde kalır, Atamalar ekranı da yeni
 * stajyeri kadro süzgeci yüzünden seçtirmezdi. Önce kayıtlar devredilmeli.
 */
export async function donemStajyerleriniGuncelle(
  donemId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const secilenIdler = formVerisi.getAll("stajyerler").map(String).filter(Boolean);
  if (new Set(secilenIdler).size !== secilenIdler.length) {
    return { hata: "Aynı stajyer birden fazla kez seçilmiş." };
  }

  const donem = await db.term.findUnique({
    where: { id: donemId },
    select: {
      interns: { select: { userId: true, user: { select: { name: true } } } },
    },
  });
  if (!donem) return { hata: "Dönem bulunamadı." };

  // Aktiflik şartı yalnızca yeni eklenenlere uygulanır: kadroda dururken
  // pasife alınmış bir stajyer, kadroda TUTULABİLMELİ (geçmişi oradadır) ama
  // kadroya yeni pasif hesap alınamamalı.
  const mevcutIdler = new Set(donem.interns.map((kadro) => kadro.userId));
  const stajyerSonucu = await stajyerleriDogrula(
    secilenIdler.filter((id) => !mevcutIdler.has(id)),
  );
  if ("hata" in stajyerSonucu) return { hata: stajyerSonucu.hata };

  const yeniIdler = new Set(secilenIdler);
  const cikarilanlar = donem.interns.filter(
    (kadro) => !yeniIdler.has(kadro.userId),
  );

  if (cikarilanlar.length > 0) {
    // Çıkarılmak istenen stajyerlerin bu dönemdeki aktif kayıt sayıları.
    const aktifKayitlar = await db.enrollment.groupBy({
      by: ["internId"],
      where: {
        status: "AKTIF",
        internId: { in: cikarilanlar.map((kadro) => kadro.userId) },
        group: { termId: donemId },
      },
      _count: true,
    });

    if (aktifKayitlar.length > 0) {
      const adlar = aktifKayitlar
        .map((satir) => {
          const kadro = cikarilanlar.find(
            (aday) => aday.userId === satir.internId,
          );
          return `${kadro?.user.name ?? "Stajyer"} (${satir._count} aktif kayıt)`;
        })
        .join(", ");
      return {
        hata: `Bu dönemde aktif kaydı olan stajyer kadrodan çıkarılamaz: ${adlar}. Önce Atamalar ekranından kayıtları başka stajyere devredin.`,
      };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.termIntern.deleteMany({
      where: { termId: donemId, userId: { notIn: secilenIdler } },
    });
    if (secilenIdler.length > 0) {
      await tx.termIntern.createMany({
        data: secilenIdler.map((userId) => ({
          termId: donemId,
          userId,
        })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath(`/koordinator/donemler/${donemId}`);
  revalidatePath("/koordinator/donemler");
  revalidatePath("/koordinator/atamalar");
  revalidatePath("/koordinator/kayitlar/yeni");

  return {
    basari:
      secilenIdler.length === 0
        ? "Kadro boşaltıldı. Bu dönemin kayıtlarında bütün aktif stajyerler seçilebilir."
        : `Dönem kadrosu güncellendi: ${secilenIdler.length} stajyer.`,
  };
}

export async function grupDurumDegistir(
  grupId: string,
): Promise<EylemDurumu> {
  await koordinatorZorunlu();

  const grup = await db.group.findUnique({
    where: { id: grupId },
    select: { active: true, name: true, termId: true },
  });

  if (!grup) return { hata: "Grup bulunamadı." };

  await db.group.update({
    where: { id: grupId },
    data: { active: !grup.active },
  });

  if (grup.termId) revalidatePath(`/koordinator/donemler/${grup.termId}`);
  revalidatePath("/koordinator/gruplar");

  return {
    basari: grup.active
      ? `"${grup.name}" kapatıldı; yeni kayıt alınamaz.`
      : `"${grup.name}" yeniden açıldı.`,
  };
}
