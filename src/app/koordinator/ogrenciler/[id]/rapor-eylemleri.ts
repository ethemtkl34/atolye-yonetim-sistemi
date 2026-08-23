"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  gecmisProgramHatasi,
  gecmisProgramKaydi,
} from "@/lib/gecmis-veri";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { yetkiYeter } from "@/lib/yetkiler";
import { raporGovdesiV2Uret } from "@/lib/rapor-govdesi-verisi";
import {
  pdfGecmisi,
  raporDetayi,
  raporGovdesiUret,
  type PdfKaydi,
  type RaporDetayi,
} from "@/lib/rapor-verisi";
import type { RaporGovdesi } from "@/lib/rapor-motoru";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";
import {
  alanAnahtari,
  duzenlemeIsle,
  duzenlemeSil,
  duzenlemeleriTasi,
  metniOku,
  metniYaz,
  type DuzenlenebilirAlan,
} from "@/lib/rapor-duzenleme";
import type { EylemDurumu as TemelEylemDurumu } from "@/lib/formlar";

/**
 * §11 — Rapor oluşturma, yeniden üretme, metin düzenleme ve PDF üretimi.
 *
 * Bu eylemler eskiden `/koordinator/raporlar` altındaydı ve iş bitince o
 * sayfaya `redirect` ediyorlardı. Raporlar artık öğrenci profilindeki
 * pencerede yönetildiği için hiçbiri yönlendirme yapmıyor; bunun yerine
 * oluşan raporun kimliğini döndürüyorlar ve pencere kendini o rapora
 * güncelliyor. Kullanıcı böylece öğrencinin sayfasından hiç çıkmıyor.
 *
 * ŞUBE: Rapor id'leri istemciden geliyor, hepsi doğrulanmalı. Bütün okumalar
 * `student.branchId` üzerinden aktif şubeye kilitli; başka şubenin rapor id'si
 * gönderilirse eylem "bulunamadı" der.
 */

export type EylemDurumu = TemelEylemDurumu & {
  /** Yeni üretilen rapor — pencere bu rapora geçer. */
  raporId?: string;
  /** Üretilen PDF'in indirme adresi — pencere indirme düğmesi gösterir. */
  pdfAdresi?: string;
};

/**
 * §11.1 — Rapor istenilen anda, o anki puanlarla üretilir; dönemin bitmesi
 * beklenmez. Kapsam koordinatörün seçtiği kayıtlardır.
 */
export async function raporOlustur(
  ogrenciId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");
  const subeId = kullanici.aktifSubeId;

  const kayitIdleri = formVerisi.getAll("kayitlar").map(String).filter(Boolean);

  if (kayitIdleri.length === 0) {
    return { hata: "Raporun kapsayacağı en az bir kayıt seçin." };
  }

  // Seçilen kayıtların gerçekten bu öğrenciye ve bu şubeye ait olduğu
  // sunucuda doğrulanır.
  const gecerliKayitlar = await db.enrollment.findMany({
    where: {
      id: { in: kayitIdleri },
      studentId: ogrenciId,
      group: { branchId: subeId },
    },
    select: {
      id: true,
      internId: true,
      group: {
        select: {
          name: true,
          term: { select: { name: true, gecmisVerisi: true } },
          club: { select: { name: true, gecmisVerisi: true } },
        },
      },
    },
  });

  if (gecerliKayitlar.length !== kayitIdleri.length) {
    return { hata: "Seçilen kayıtlardan biri bu öğrenciye ait değil." };
  }

  // Kapsam listesi geçmiş kayıtları zaten göstermiyor (`raporKapsamSecenekleri`),
  // ama liste istemcide çiziliyor; kapı burada da duruyor.
  const gecmisKayitlar = gecerliKayitlar.filter(gecmisProgramKaydi);
  if (gecmisKayitlar.length > 0) {
    return { hata: gecmisProgramHatasi(gecmisKayitlar) };
  }

  // Rapor, stajyerin puanlama ve gözlemlerinden doğar; stajyeri atanmamış
  // bir kayıtta bu veriler var olamaz. Boş bölümlü bir belge üretmek yerine
  // eksik açıkça söylenir (§11.1).
  const stajyersiz = gecerliKayitlar.filter((kayit) => !kayit.internId);
  if (stajyersiz.length > 0) {
    const adlar = stajyersiz
      .map(
        (kayit) =>
          `${kayit.group.term?.name ?? kayit.group.club?.name ?? "Program"} · ${kayit.group.name}`,
      )
      .join(", ");
    return {
      hata: `Şu kayıtlara stajyer atanmadan rapor üretilemez: ${adlar}. Atamayı öğrenci profilindeki "Stajyer atamaları" bölümünden yapabilirsiniz.`,
    };
  }

  // Üretim zamanı puanlar okunmadan ÖNCE alınır. Varsayılan now() kullanılsa
  // puan okuma ile kayıt arasındaki aralıkta değişen bir puan raporda yokken
  // rapor yine "Güncel" görünürdü (§13.16 karşılaştırması generatedAt ile
  // yapılıyor).
  const uretimZamani = new Date();
  // §11.2 — İkinci sürüm gövde denenir; kurulmamış bir programda (atölye
  // içeriği veya gelişim değerlendirmesi yoksa) yine üretilir, eksik
  // bölümler basılmaz. Yalnızca öğrenci ya da kayıt bulunamazsa birinci
  // sürüme düşülür.
  const uretim = await govdeUret(
    async () =>
      (await raporGovdesiV2Uret(ogrenciId, kayitIdleri, subeId, new Date())) ??
      (await raporGovdesiUret(ogrenciId, kayitIdleri, subeId)),
  );
  if ("hata" in uretim) return uretim;
  const govde = uretim.govde;
  if (!govde) return { hata: "Öğrenci bulunamadı." };

  const rapor = await db.report.create({
    data: {
      studentId: ogrenciId,
      generatedAt: uretimZamani,
      bodyJson: govde as unknown as object,
      enrollmentLinks: {
        create: kayitIdleri.map((kayitId) => ({ enrollmentId: kayitId })),
      },
    },
    select: { id: true },
  });

  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
  revalidatePath("/koordinator");
  return {
    basari: `Rapor oluşturuldu.${uyariNotu(govde)}`,
    raporId: rapor.id,
  };
}

/**
 * Gövde üretimini sarar: beklenmeyen bir çıkış kullanıcıya okunur bir
 * mesajla döner.
 *
 * Yapay zekâ katmanı kendi hatalarını zaten `uyarilar` olarak taşıyor;
 * buradaki güvenlik ağı veritabanı ve kod hatalarını kapsıyor. Sarmalanmasa
 * eylem reddediliyor ve pencerede sebepsiz bir çökme görünüyordu.
 */
async function govdeUret<T>(
  uret: () => Promise<T>,
): Promise<{ govde: T } | { hata: string }> {
  try {
    return { govde: await uret() };
  } catch (hata) {
    const detay = hata instanceof Error ? hata.message : String(hata);
    console.error("Rapor gövdesi üretilemedi:", hata);
    return {
      hata: `Rapor üretilemedi: ${detay}. Sorun sürerse ekran görüntüsüyle birlikte sistem yöneticisine iletin.`,
    };
  }
}

/**
 * Üretim sonucuna eklenen eksiklik notu.
 *
 * Rapor eksik veriyle de üretilebiliyor; "Rapor oluşturuldu." yazıp susmak,
 * eksiği ancak veliye gönderdikten sonra fark ettiriyordu. Ayrıntı listesi
 * raporun kendi penceresinde duruyor, burada yalnızca sayı verilir.
 */
function uyariNotu(govde: unknown): string {
  const sayi = (govde as { uyarilar?: unknown[] })?.uyarilar?.length ?? 0;
  return sayi > 0
    ? ` Ancak ${sayi} bölüm eksik üretildi; sebepleri raporun üstünde listelendi.`
    : "";
}

/**
 * §11.4 — Puanlar değiştiyse rapor yeniden üretilebilir.
 *
 * Yeni bir rapor satırı açılır; eski rapor ve ona bağlı PDF'ler yerinde kalır
 * (§13.17). Böylece "hangi rapor hangi PDF'in kaynağıydı" sorusu her zaman
 * cevaplanabilir.
 */
export async function raporYenidenUret(
  raporId: string,
  /**
   * Elle düzenlenmiş metinler yeni rapora taşınsın mı? Arayüz düzenleme
   * varsa soruyor. Varsayılan taşımak: emek harcanmış bir veli metnini
   * sessizce kaybetmek, hiç sormamaktan da kötüydü.
   */
  duzenlemeleriKoru = true,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");
  const subeId = kullanici.aktifSubeId;

  const eski = await db.report.findFirst({
    where: { id: raporId, student: { branchId: subeId } },
    select: {
      studentId: true,
      bodyJson: true,
      enrollmentLinks: {
        select: {
          enrollment: {
            select: {
              id: true,
              internId: true,
              group: {
                select: {
                  name: true,
                  term: { select: { name: true, gecmisVerisi: true } },
                  club: { select: { name: true, gecmisVerisi: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!eski) return { hata: "Rapor bulunamadı." };

  // Aktarımdan önce üretilmiş bir rapor sonradan geçmiş bir programa
  // bağlanmış olabilir; yeniden üretim orada da durur.
  const gecmisBaglar = eski.enrollmentLinks
    .map((bag) => bag.enrollment)
    .filter(gecmisProgramKaydi);
  if (gecmisBaglar.length > 0) {
    return { hata: gecmisProgramHatasi(gecmisBaglar) };
  }

  // Yeni üretim de stajyer kuralına tabi: atama sonradan kaldırıldıysa
  // güncel puanlarla üretim, kaynağı olmayan bir rapor doğurmamalı.
  const stajyersizYeniden = eski.enrollmentLinks.filter(
    (bag) => !bag.enrollment.internId,
  );
  if (stajyersizYeniden.length > 0) {
    const adlar = stajyersizYeniden
      .map(
        (bag) =>
          `${bag.enrollment.group.term?.name ?? bag.enrollment.group.club?.name ?? "Program"} · ${bag.enrollment.group.name}`,
      )
      .join(", ");
    return {
      hata: `Şu kayıtlara stajyer atanmadan rapor yeniden üretilemez: ${adlar}.`,
    };
  }

  const kayitIdleri = eski.enrollmentLinks.map((bag) => bag.enrollment.id);
  // Zaman damgası puanlar okunmadan önce — raporOlustur'daki açıklamaya bakın.
  const uretimZamani = new Date();
  const uretim = await govdeUret(
    async () =>
      (await raporGovdesiV2Uret(
        eski.studentId,
        kayitIdleri,
        subeId,
        new Date(),
      )) ?? (await raporGovdesiUret(eski.studentId, kayitIdleri, subeId)),
  );
  if ("hata" in uretim) return uretim;
  const govde = uretim.govde;
  if (!govde) return { hata: "Rapor verisi hazırlanamadı." };

  // §11.4 — Elle yazılmış metinleri yeni gövdeye taşı. Taşınamayanlar
  // (bölümü bu kez hiç üretilmemiş olanlar) kullanıcıya ismen bildirilir;
  // "korundu" deyip sessizce düşürmek en kötü davranış olurdu.
  const eskiGovde = eski.bodyJson as unknown as RaporGovdesiV2 & {
    surum?: number;
  };
  const tasima =
    duzenlemeleriKoru &&
    eskiGovde?.surum === 2 &&
    (govde as { surum?: number })?.surum === 2
      ? duzenlemeleriTasi(
          eskiGovde,
          govde as unknown as RaporGovdesiV2,
          uretimZamani,
        )
      : { tasinan: [], tasinamayan: [] };

  const yeni = await db.report.create({
    data: {
      studentId: eski.studentId,
      generatedAt: uretimZamani,
      bodyJson: govde as unknown as object,
      // Taşınan metinler elle yazılmış sayılır: rozet ve "özgüne dön"
      // düğmesi yeni raporda da çalışsın diye düzenleme damgası taşınıyor.
      ...(tasima.tasinan.length > 0
        ? { editedByUserId: kullanici.id, editedAt: uretimZamani }
        : {}),
      enrollmentLinks: {
        create: kayitIdleri.map((kayitId) => ({ enrollmentId: kayitId })),
      },
    },
    select: { id: true },
  });

  revalidatePath(`/koordinator/ogrenciler/${eski.studentId}`);
  revalidatePath("/koordinator");
  return {
    basari: `Güncel puanlarla yeni rapor üretildi. Eski rapor geçmişte kaldı.${tasimaNotu(tasima)}${uyariNotu(govde)}`,
    raporId: yeni.id,
  };
}

/** Yeniden üretimde düzenlemelere ne olduğunu anlatan cümle. */
function tasimaNotu(tasima: {
  tasinan: string[];
  tasinamayan: string[];
}): string {
  const parcalar: string[] = [];
  if (tasima.tasinan.length > 0) {
    parcalar.push(
      ` Elle düzenlenmiş ${tasima.tasinan.length} metin yeni rapora taşındı; puanlar değiştiyse bu metinleri gözden geçirin.`,
    );
  }
  if (tasima.tasinamayan.length > 0) {
    parcalar.push(
      ` Şu düzenlemeler taşınamadı çünkü karşılıkları bu kez üretilmedi: ${tasima.tasinamayan.join(", ")}.`,
    );
  }
  return parcalar.join("");
}

/**
 * §11.5 — Raporun o anki hâlinden PDF üretir.
 *
 * PDF ikili verisi saklanmaz; üretim anındaki rapor gövdesi `snapshotJson`
 * içine kopyalanır ve belge indirilirken bu kopyadan çizilir. Rapor sonradan
 * düzenlense bile eski PDF'in içeriği değişmez (§13.17).
 */
export async function pdfOlustur(raporId: string): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");

  const rapor = await db.report.findFirst({
    where: { id: raporId, student: { branchId: kullanici.aktifSubeId } },
    select: {
      id: true,
      studentId: true,
      bodyJson: true,
      student: { select: { firstName: true, lastName: true } },
      enrollmentLinks: {
        select: {
          enrollment: {
            select: {
              group: {
                select: {
                  name: true,
                  term: { select: { name: true } },
                  club: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!rapor) return { hata: "Rapor bulunamadı." };

  // v2 gövde öğrenci adını ve kapsamı kendi içinde taşıyor; v1 (arşiv)
  // gövde taşımıyordu ve rota bunları CANLI tablodan okuyordu — öğrenci adı
  // sonradan düzeltilince alınmış belge de değişiyordu (§13.17 ihlali).
  // Yeni üretilen her v1 PDF'te bu değerler üretim anında snapshot'a
  // dondurulur; eski v1 snapshot'lar için rota canlı okumaya devam eder.
  const surumlu = rapor.bodyJson as { surum?: number };
  const arsivEki =
    surumlu?.surum === 2
      ? {}
      : {
          arsivOgrenciAdi: `${rapor.student.firstName} ${rapor.student.lastName}`,
          arsivKapsam: rapor.enrollmentLinks.map(
            (bag) =>
              `${bag.enrollment.group.term?.name ?? bag.enrollment.group.club?.name ?? "Program"} · ${bag.enrollment.group.name}`,
          ),
        };

  // İki adım tek transaction'da: satır oluşturma ile adresin yazılması
  // arasında bir hata olursa, silinemeyen (onDelete: Restrict) ama adressiz
  // bir PDF kaydı kalıcı olarak ortada kalırdı.
  const pdfAdresi = await db.$transaction(async (tx) => {
    const pdf = await tx.reportPdf.create({
      data: {
        reportId: rapor.id,
        // Adres kaydın kendisinden türetiliyor; nesne deposuna geçilirse
        // yalnızca burası değişir.
        fileUrl: "",
        snapshotJson: {
          ...(rapor.bodyJson as unknown as object),
          ...arsivEki,
        },
      },
      select: { id: true },
    });

    const adres = `/api/rapor-pdf/${pdf.id}`;
    await tx.reportPdf.update({
      where: { id: pdf.id },
      data: { fileUrl: adres },
    });
    return adres;
  });

  revalidatePath(`/koordinator/ogrenciler/${rapor.studentId}`);

  return { basari: "PDF oluşturuldu ve rapor geçmişine eklendi.", pdfAdresi };
}

/**
 * §11.4 — Koordinatör otomatik üretilen metni düzenleyebilir.
 *
 * Yalnızca metin katmanı değişir; analiz çıktısı olduğu gibi korunur.
 * Böylece rapor hangi puanlardan çıktığını kaybetmez ve P13'te aynı analizle
 * yeniden metin üretilebilir.
 */
export async function raporMetniDuzenle(
  raporId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");

  const rapor = await db.report.findFirst({
    where: { id: raporId, student: { branchId: kullanici.aktifSubeId } },
    select: { bodyJson: true, studentId: true },
  });

  if (!rapor) return { hata: "Rapor bulunamadı." };

  // v2 gövdede `metin` alanı yok; arayüz bu eylemi v2'de göstermiyor ama
  // bayat bir sekmeden çağrılırsa okunur bir hata dönmeli, çökme değil.
  if ((rapor.bodyJson as { surum?: number })?.surum === 2) {
    return {
      hata: "Bu rapor yeni biçimde; metinleri kutuların üzerindeki kalemle düzenleyin.",
    };
  }

  const govde = rapor.bodyJson as unknown as RaporGovdesi;

  const yeniAtolyeler = govde.metin.atolyeler.map((atolye, sira) => {
    const girilen = formVerisi.get(`atolye-${sira}`);
    return {
      atolyeAdi: atolye.atolyeAdi,
      paragraf:
        typeof girilen === "string" && girilen.trim()
          ? girilen.trim()
          : atolye.paragraf,
    };
  });

  const genelMetin = formVerisi.get("genel");
  const yeniGenel =
    typeof genelMetin === "string" && genelMetin.trim()
      ? genelMetin
          .split(/\n{2,}/)
          .map((paragraf) => paragraf.trim())
          .filter(Boolean)
      : govde.metin.genelParagraflar;

  await db.report.update({
    where: { id: raporId },
    data: {
      bodyJson: {
        ...govde,
        metin: { atolyeler: yeniAtolyeler, genelParagraflar: yeniGenel },
      } as unknown as object,
      editedByUserId: kullanici.id,
      editedAt: new Date(),
    },
  });

  revalidatePath(`/koordinator/ogrenciler/${rapor.studentId}`);

  return { basari: "Rapor metni güncellendi.", raporId };
}

/**
 * İkinci sürüm raporda yerinde düzenlenebilen metin alanları.
 *
 * Tanım `lib/rapor-duzenleme.ts`'te (saf katman); burada yalnızca yeniden
 * dışa aktarılıyor ki istemci bileşenleri tipi kendi eylem dosyasından
 * almayı sürdürsün — "use server" dosyasından yalnızca tip dışa
 * aktarılabildiği için bu güvenli.
 */
export type { DuzenlenebilirAlan };

/**
 * §11.4 — İkinci sürüm raporda tek bir metin kutusunun yerinde düzenlenmesi.
 *
 * Eski toplu düzenleme ekranının kutucuk bazlı karşılığı: koordinatör
 * penceredeki kutunun kalemine basar, yalnızca o metin değişir. Analiz
 * çıktısı (kademeler, ortalamalar) ve diğer metinler olduğu gibi kalır;
 * düzenleyen kişi ve zaman rapora işlenir. Daha önce alınmış PDF'ler kendi
 * snapshot'larından basılmaya devam eder (§13.17).
 */
export async function raporBolumunuDuzenle(
  raporId: string,
  alan: DuzenlenebilirAlan,
  metin: string,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");

  const yeniMetin = metin.trim();
  if (!yeniMetin) return { hata: "Metin boş bırakılamaz." };

  const rapor = await db.report.findFirst({
    where: { id: raporId, student: { branchId: kullanici.aktifSubeId } },
    select: { bodyJson: true, studentId: true },
  });
  if (!rapor) return { hata: "Rapor bulunamadı." };

  const govde = rapor.bodyJson as unknown as RaporGovdesiV2 & { surum?: number };
  if (govde?.surum !== 2) {
    return { hata: "Bu rapor eski biçimde; alttaki düzenleme ekranını kullanın." };
  }

  // Alan adları istemciden geliyor; hedef bulunamazsa sessizce hiçbir şeyi
  // değiştirmeden dönmek yerine hata verilir.
  const ozgunMetin = metniOku(govde, alan);
  if (ozgunMetin === null || !metniYaz(govde, alan, yeniMetin)) {
    return { hata: "Düzenlenecek metin bu raporda bulunamadı." };
  }

  // Defter, üretimin yazdığı metni saklıyor: koordinatör vazgeçebilsin ve
  // rapor yeniden üretilince düzenleme sessizce kaybolmasın (§11.4).
  duzenlemeIsle(govde, alan, ozgunMetin, kullanici.name, new Date());

  await db.report.update({
    where: { id: raporId },
    data: {
      bodyJson: govde as unknown as object,
      editedByUserId: kullanici.id,
      editedAt: new Date(),
    },
  });

  revalidatePath(`/koordinator/ogrenciler/${rapor.studentId}`);
  return { basari: "Metin güncellendi.", raporId };
}

/**
 * §11.4 — Elle düzenlenmiş bir metni üretimin yazdığı hâline döndürür.
 *
 * Düzenleme yerinde ve tek tıkla yapılıyor; geri dönüşü olmayan bir düzenleme
 * koordinatörü "yanlış kutuyu düzelttim, özgün cümle neydi" durumunda
 * bırakıyordu. Özgün metin ilk düzenlemede deftere yazıldığı için burada
 * yeniden üretmeye gerek yok.
 */
export async function raporBolumunuGeriAl(
  raporId: string,
  alan: DuzenlenebilirAlan,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");

  const rapor = await db.report.findFirst({
    where: { id: raporId, student: { branchId: kullanici.aktifSubeId } },
    select: { bodyJson: true, studentId: true },
  });
  if (!rapor) return { hata: "Rapor bulunamadı." };

  const govde = rapor.bodyJson as unknown as RaporGovdesiV2 & { surum?: number };
  if (govde?.surum !== 2) return { hata: "Bu rapor eski biçimde." };

  const anahtar = alanAnahtari(alan);
  const kayit = govde.duzenlemeler?.find((k) => k.anahtar === anahtar);
  if (!kayit) {
    return { hata: "Bu metnin özgün hâli kayıtlı değil; geri alınamaz." };
  }

  if (!metniYaz(govde, alan, kayit.ozgunMetin)) {
    return { hata: "Geri alınacak metin bu raporda bulunamadı." };
  }
  duzenlemeSil(govde, alan);

  await db.report.update({
    where: { id: raporId },
    data: {
      bodyJson: govde as unknown as object,
      editedByUserId: kullanici.id,
      editedAt: new Date(),
    },
  });

  revalidatePath(`/koordinator/ogrenciler/${rapor.studentId}`);
  return { basari: "Metin üretimin yazdığı hâline döndürüldü.", raporId };
}

/**
 * Raporu ve ona bağlı PDF kayıtlarını kalıcı siler.
 *
 * YETKİ: raporlar modülünde TAM seviye (Kurum Yöneticisi, Koordinatör,
 * Atölye Psikoloğu). Danışma görevlisi ve stajyer bu pencereyi zaten açamaz.
 *
 * PDF kayıtları şemada Restrict ile korunur (yanlışlıkla kaybolmasınlar);
 * silme bilinçli bir işlem olduğu için önce PDF'ler sonra rapor aynı
 * transaction içinde kaldırılır. Verilmiş PDF bağlantıları bundan sonra
 * çalışmaz — onay metni bunu açıkça söyler.
 */
export async function raporSil(raporId: string): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");

  const rapor = await db.report.findFirst({
    where: { id: raporId, student: { branchId: kullanici.aktifSubeId } },
    select: { id: true, studentId: true },
  });
  if (!rapor) return { hata: "Rapor bulunamadı." };

  await db.$transaction([
    db.reportPdf.deleteMany({ where: { reportId: rapor.id } }),
    db.report.delete({ where: { id: rapor.id } }),
  ]);

  revalidatePath(`/koordinator/ogrenciler/${rapor.studentId}`);
  revalidatePath("/koordinator");
  return { basari: "Rapor ve PDF'leri silindi." };
}

/**
 * §11 — Raporun yanında duran, RAPORA GİRMEYEN bağlam.
 *
 * Koordinatör raporu gözden geçirirken öğrencinin zekâ testi dosyası ya da
 * veli görüşmesi kaydı olduğunu bilmiyordu; ikisi de aynı sayfada başka
 * kutularda duruyor ama rapor penceresi açıkken görünmüyorlar.
 *
 * VELİYE GİTMEZ: bu bilgi yalnızca panelde. Veli görüşmesi kayıtları uzmanın
 * kendine yazdığı çerçeveleme notlarını içeriyor ("görüşmede nazikçe
 * çerçevelenecek"), zekâ testi de sağlık bilgisi sınıfında; ikisini de
 * veliye giden belgeye taşımak gizlilik sınıflarını değiştirirdi.
 */
export type RaporBaglami = {
  zekaTestleri: { id: string; testAdi: string; tarih: Date }[];
  /** Yalnızca sayı ve son tarih: kayıtların içeriği bu pencerede işimiz değil. */
  veliGorusmesiSayisi: number;
  sonVeliGorusmesi: Date | null;
};

export type RaporPenceresiVerisi = {
  detay: RaporDetayi;
  pdfler: PdfKaydi[];
  baglam: RaporBaglami;
};

/**
 * Pencere açıldığında raporun tam gövdesini getirir.
 *
 * Gövdeler (analiz + metin JSON'u) profil sayfasında peşinen yüklenmiyor:
 * bir öğrencinin onlarca raporu olabilir ve hepsinin tamamını her profil
 * açılışında taşımak gereksiz. Pencere hangi rapora bakılacağını bildiği anda
 * yalnızca onu çeker.
 */
export async function raporPenceresiVerisi(
  raporId: string,
): Promise<RaporPenceresiVerisi | null> {
  const kullanici = await yonetimZorunlu("raporlar", "TAM");
  const subeId = kullanici.aktifSubeId;

  const [detay, pdfler] = await Promise.all([
    raporDetayi(raporId, subeId),
    pdfGecmisi({ subeId, raporId }),
  ]);

  if (!detay) return null;

  // Bağlam yetkiye göre süzülür: raporu görebilen herkesin zekâ testi ya da
  // danışmanlık yetkisi olmak zorunda değil (matriste bugün öyle bir rol yok
  // ama süzgeç arayüzde değil burada durmalı).
  const zekaGorebilir = yetkiYeter(kullanici.roller, "zekaTestleri", "LISTE");
  const gorusmeGorebilir = yetkiYeter(
    kullanici.roller,
    "danismanlik",
    "GORUNTULE",
  );

  const [zekaTestleri, gorusmeler] = await Promise.all([
    zekaGorebilir
      ? db.intelligenceTest.findMany({
          where: {
            studentId: detay.ozet.ogrenciId,
            student: { branchId: subeId },
          },
          orderBy: { date: "desc" },
          // `fileData` SEÇİLMEZ (bkz. `IntelligenceTest` şema notu).
          select: { id: true, testName: true, date: true },
        })
      : [],
    gorusmeGorebilir
      ? db.parentMeeting.findMany({
          where: {
            studentId: detay.ozet.ogrenciId,
            student: { branchId: subeId },
          },
          orderBy: { date: "desc" },
          // İçerik değil yalnızca varlık: tarih yeter.
          select: { date: true },
        })
      : [],
  ]);

  return {
    detay,
    pdfler,
    baglam: {
      zekaTestleri: zekaTestleri.map((test) => ({
        id: test.id,
        testAdi: test.testName,
        tarih: test.date,
      })),
      veliGorusmesiSayisi: gorusmeler.length,
      sonVeliGorusmesi: gorusmeler[0]?.date ?? null,
    },
  };
}
