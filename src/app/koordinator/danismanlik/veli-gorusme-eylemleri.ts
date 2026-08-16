"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { bugun, tarihBicimle, tarihCozumle, yasYil } from "@/lib/tarih";
import { formCoklulari, formDegerleri } from "@/lib/formlar";
import {
  EN_BUYUK_YAS,
  EN_KUCUK_YAS,
  GOZLEM_ALANLARI,
  veliBriefiUret,
  yasBandiSec,
  type GozlemCevabi,
  type IsaretliMadde,
  type VeliBriefi,
  type VeliGorusmeFormu,
  type VeliGorusmeSecimleri,
} from "@/lib/veli-gorusmesi";
import {
  GENEL_OZELLIKLER,
  GUCLU_YONLER,
  ZORLANMA_ALANLARI,
  bandinZorlanmaAnahtarlari,
  type YasBandi,
} from "@/lib/veli-gorusmesi-icerik";
import {
  YONLENDIRME_TURLERI,
  yonlendirmeTuruMu,
  type YonlendirmeTuru,
} from "@/lib/yonlendirme-turleri";
import { veliBriefGirdisiHazirla } from "@/lib/veli-gorusmesi-verisi";
import type { EylemDurumu } from "@/lib/formlar";

/**
 * Veli görüşmeleri — brief önizleme, kayıt, not ve silme.
 *
 * Bütün yazma işlemleri Danışmanlık sayfasından yapılır; öğrenci profili bu
 * kayıtları yalnızca gösterir. Öğrenci bu yüzden bind ile değil formdaki
 * seçiciden gelir ve şube kapısından geçirilir.
 *
 * GİZLİLİK: Veli görüşmeleri de terapi görüşmeleri gibi stajyerden tamamen
 * gizlidir; bu eylemler ve okuma sorgusu yalnızca koordinatör ekranlarından
 * çağrılır (`yonetimZorunlu`).
 *
 * ŞUBE: Öğrenci ve görüşme id'leri istemciden geliyor; her işlem
 * `branchId`/`student.branchId` ile aktif şubeye kilitli doğrulanır.
 *
 * ÖNİZLEME ↔ KAYIT: Brief metni deterministik üretiliyor (`veli-gorusmesi.ts`);
 * kayıt eylemi önizlenen metni istemciden geri almak yerine aynı girdiden
 * SUNUCUDA yeniden üretir. Arada yeni puanlama girildiyse brief daha güncel
 * veriyle değişebilir — kabul edilen davranış. P13'te metin AI'a geçince bu
 * varsayım bozulur; o gün önizlenen metnin kendisi saklanmalı.
 */

export type VeliGorusmesiEylemDurumu = EylemDurumu & {
  /** Önizleme sonucu — form kaydedilmeden formun altında gösterilir. */
  brief?: VeliBriefi;
  /**
   * İşaretli çoklu kutular (`degerler`in çoklu karşılığı). React 19 form
   * eylemi bitince kutuları da sıfırlıyor; form bunları `defaultChecked`
   * olarak geri yazar.
   */
  coklular?: Record<string, string[]>;
};

/** Gözlem alanı puanının form adı: `cevap-dikkat-surdurme` gibi. */
const cevapAlani = (anahtar: string) => `cevap-${anahtar}`;
/** Yönlendirme gerekçesinin form adı: `yonlendirmeNot-ERGOTERAPI` gibi. */
const yonlendirmeNotAlani = (tur: string) => `yonlendirmeNot-${tur}`;

/** Bölüm 3'te en fazla kaç atölye satırı okunur — form kadar, artı pay. */
const EN_FAZLA_ATOLYE = 20;

const COKLU_ALANLAR = ["genel", "guclu", "zorlanma", "yonlendirme"] as const;

const VELI_FORM_ALANLARI = [
  "ogrenciId",
  "tarih",
  "gorusmeciAdi",
  "yas",
  "gozlemNotu",
  "gucluOzeti",
  ...GOZLEM_ALANLARI.map((alan) => cevapAlani(alan.anahtar)),
  ...YONLENDIRME_TURLERI.map((tur) => yonlendirmeNotAlani(tur.deger)),
  ...Array.from({ length: EN_FAZLA_ATOLYE }, (_, i) => `atolyeNot-${i}`),
  ...Array.from({ length: EN_FAZLA_ATOLYE }, (_, i) => `atolyeAd-${i}`),
] as const;

const veliGorusmesiSemasi = z.object({
  ogrenciId: z.string().min(1, "Öğrenci seçin"),
  /** Boş bırakılabilir — o zaman bugün sayılır (terapi görüşmesi deseni). */
  tarih: z.string().trim(),
  gorusmeciAdi: z
    .string()
    .trim()
    .min(1, "Görüşmeyi yapacak kişinin adını yazın")
    .max(100, "Ad en fazla 100 karakter olabilir"),
});

type CozumlenmisForm = {
  ogrenciId: string;
  tarih: Date;
  gorusmeciAdi: string;
  cevaplar: GozlemCevabi[];
  /** Doğum tarihi yoksa formdan elle seçilen yaş; varsa yok sayılır. */
  elleYas: number | null;
  gozlemNotu: string | null;
  gucluOzeti: string | null;
  atolyeNotlari: { atolye: string; not: string }[];
  /** Ham işaretler — geçerlilikleri bant belli olduktan sonra süzülür. */
  isaretler: Record<string, string[]>;
  yonlendirmeNotlari: Record<string, string>;
};

/** Serbest metin: kırpar, boşsa null, sınırı aşarsa kırpılmış hâli döner. */
function serbestMetin(ham: FormDataEntryValue | null, sinir: number) {
  const metin = typeof ham === "string" ? ham.trim() : "";
  return metin === "" ? null : metin.slice(0, sinir);
}

/**
 * Formu çözer; hata varsa girilenlerle birlikte durum döner. Önizleme ve
 * kayıt aynı doğrulamadan geçer — iki ayrı kural seti olsaydı önizlenebilen
 * ama kaydedilemeyen form oluşurdu.
 *
 * İşaretler burada YALNIZCA toplanır, doğrulanmaz: hangi anahtarın geçerli
 * olduğu yaş bandına bağlı ve bant öğrencinin doğum tarihinden çıkıyor, yani
 * veritabanı okunmadan bilinmiyor.
 */
function formuCozumle(
  formVerisi: FormData,
): { veri: CozumlenmisForm } | { durum: VeliGorusmesiEylemDurumu } {
  const girilenler = formDegerleri(formVerisi, VELI_FORM_ALANLARI);
  const isaretler = formCoklulari(formVerisi, COKLU_ALANLAR);
  const alanHatalari: Record<string, string> = {};

  const cozumlenen = veliGorusmesiSemasi.safeParse({
    ogrenciId: formVerisi.get("ogrenciId"),
    tarih: formVerisi.get("tarih"),
    gorusmeciAdi: formVerisi.get("gorusmeciAdi"),
  });

  if (!cozumlenen.success) {
    for (const sorun of cozumlenen.error.issues) {
      const alan = sorun.path.join(".");
      if (alan && !alanHatalari[alan]) alanHatalari[alan] = sorun.message;
    }
  }

  // Puanlar radio gruplarından geliyor; boş bırakılan alan işaretlenir. Alan
  // adı ve cümlesi puanla birlikte saklanır (snapshot ilkesi): liste sonradan
  // değişse de geçmiş kayıt o günkü hâlini gösterir.
  const cevaplar: GozlemCevabi[] = [];
  for (const alan of GOZLEM_ALANLARI) {
    const ham = formVerisi.get(cevapAlani(alan.anahtar));
    const deger = typeof ham === "string" ? Number(ham) : NaN;
    if (!Number.isInteger(deger) || deger < 1 || deger > 5) {
      alanHatalari[cevapAlani(alan.anahtar)] = "Bu alanı puanlayın.";
      continue;
    }
    cevaplar.push({
      anahtar: alan.anahtar,
      soruMetni: alan.metin,
      baslik: alan.baslik,
      deger,
    });
  }

  const hamYas = formVerisi.get("yas");
  const elleYas =
    typeof hamYas === "string" && hamYas !== "" ? Number(hamYas) : null;
  if (
    elleYas !== null &&
    (!Number.isInteger(elleYas) ||
      elleYas < EN_KUCUK_YAS ||
      elleYas > EN_BUYUK_YAS)
  ) {
    alanHatalari.yas = "Yaş seçin.";
  }

  if (Object.keys(alanHatalari).length > 0) {
    return {
      durum: { alanHatalari, degerler: girilenler, coklular: isaretler },
    };
  }

  const gorusmeciAdi = cozumlenen.success ? cozumlenen.data.gorusmeciAdi : "";
  const ogrenciId = cozumlenen.success ? cozumlenen.data.ogrenciId : "";
  const tarihMetni = cozumlenen.success ? cozumlenen.data.tarih : "";

  const tarih = tarihMetni ? tarihCozumle(tarihMetni) : bugun();
  if (!tarih) {
    return {
      durum: {
        alanHatalari: { tarih: "Geçerli bir tarih seçin." },
        degerler: girilenler,
        coklular: isaretler,
      },
    };
  }

  // Atölye satırları ad/not çifti olarak geliyor; adı istemciden alınıyor ama
  // yalnızca ETİKET olarak saklanıyor (bir karar veya bağ değil), o yüzden
  // sunucuda yeniden çözülmesi gerekmiyor. Notu boş satır atlanır.
  const atolyeNotlari: { atolye: string; not: string }[] = [];
  for (let i = 0; i < EN_FAZLA_ATOLYE; i++) {
    const not = serbestMetin(formVerisi.get(`atolyeNot-${i}`), 1000);
    const ad = serbestMetin(formVerisi.get(`atolyeAd-${i}`), 120);
    if (not && ad) atolyeNotlari.push({ atolye: ad, not });
  }

  const yonlendirmeNotlari: Record<string, string> = {};
  for (const tur of YONLENDIRME_TURLERI) {
    const not = serbestMetin(
      formVerisi.get(yonlendirmeNotAlani(tur.deger)),
      500,
    );
    if (not) yonlendirmeNotlari[tur.deger] = not;
  }

  // Gelecek tarih BİLİNÇLİ olarak serbest (terapi görüşmesinin tersi):
  // kayıt görüşmeden önce, brief hazırlamak için açılıyor — randevu gibi
  // ileri tarihli olması işin doğası. Atölye özeti o tarihe kadarki
  // oturumları kapsar.
  return {
    veri: {
      ogrenciId,
      tarih,
      gorusmeciAdi,
      cevaplar,
      elleYas,
      gozlemNotu: serbestMetin(formVerisi.get("gozlemNotu"), 2000),
      gucluOzeti: serbestMetin(formVerisi.get("gucluOzeti"), 2000),
      atolyeNotlari,
      isaretler,
      yonlendirmeNotlari,
    },
  };
}

/** Öğrenciyi aktif şubeye kilitli doğrular; yaş ve brief için adını da alır. */
async function ogrenciyiBul(ogrenciId: string, subeId: string) {
  return db.student.findFirst({
    where: { id: ogrenciId, branchId: subeId },
    select: { id: true, firstName: true, birthDate: true },
  });
}

/**
 * İşaretlenen anahtarları o bandın sözlüğüne göre süzer ve başlıklarını
 * dondurur.
 *
 * Süzme güvenlik değil TUTARLILIK meselesi: istemci bandı tarihe göre yeniden
 * hesaplıyor, kullanıcı tarihi değiştirdiğinde banda özel bir madde
 * (ör. "Ayrılma Kaygısı") işaretli kalmış olabilir. Sözlükte karşılığı olmayan
 * anahtar sessizce düşer — kaydedilseydi detay penceresinde başlıksız,
 * anlamsız bir satır olurdu.
 */
function isaretleriDondur(
  anahtarlar: readonly string[],
  gecerliler: readonly string[],
  baslikBul: (anahtar: string) => string | undefined,
): IsaretliMadde[] {
  const secili = new Set(anahtarlar);
  return gecerliler
    .filter((anahtar) => secili.has(anahtar))
    .map((anahtar) => ({ anahtar, baslik: baslikBul(anahtar) ?? anahtar }));
}

/** Formun ham işaretlerinden bandın geçerli seçimlerini çıkarır. */
function secimleriCikar(
  band: YasBandi,
  isaretler: Record<string, string[]>,
  yonlendirmeNotlari: Record<string, string>,
) {
  const genel = isaretleriDondur(
    isaretler.genel ?? [],
    Object.keys(GENEL_OZELLIKLER[band]),
    (anahtar) => GENEL_OZELLIKLER[band][anahtar]?.baslik,
  );
  const guclu = isaretleriDondur(
    isaretler.guclu ?? [],
    Object.keys(GUCLU_YONLER[band]),
    (anahtar) => GUCLU_YONLER[band][anahtar]?.baslik,
  );
  const zorlanma = isaretleriDondur(
    isaretler.zorlanma ?? [],
    bandinZorlanmaAnahtarlari(band),
    (anahtar) => ZORLANMA_ALANLARI[band][anahtar]?.baslik,
  );

  // Yönlendirmeler kurumun hizmet listesinin sırasıyla; tanınmayan değer düşer.
  const secili = new Set(
    (isaretler.yonlendirme ?? []).filter(yonlendirmeTuruMu),
  );
  const yonlendirmeler = YONLENDIRME_TURLERI.filter((tur) =>
    secili.has(tur.deger),
  ).map((tur) => ({
    tur: tur.deger as YonlendirmeTuru,
    etiket: tur.etiket,
    not: yonlendirmeNotlari[tur.deger] ?? null,
  }));

  return { genel, guclu, zorlanma, yonlendirmeler };
}

/**
 * Formun tek gönderme eylemi. Niyet, tıklanan düğmenin `name="niyet"`
 * değerinden okunur:
 *
 *   - "onizleme": HİÇBİR ŞEY YAZMAZ — brief üretilir ve önizleme döner.
 *   - "kaydet":   görüşme, brief aynı girdiden yeniden üretilerek saklanır.
 *
 * İki ayrı eylem yerine tek eylem: form alanları her iki dönüşte de aynı
 * durumdan (`degerler`) geri doldurulur; iki `useActionState` olsaydı hangi
 * durumun güncel olduğu istemcide takip edilmek zorunda kalırdı.
 */
export async function veliGorusmesiGonder(
  _oncekiDurum: VeliGorusmesiEylemDurumu,
  formVerisi: FormData,
): Promise<VeliGorusmesiEylemDurumu> {
  const kullanici = await yonetimZorunlu("danismanlik", "TAM");
  const subeId = kullanici.aktifSubeId;

  const sonuc = formuCozumle(formVerisi);
  if ("durum" in sonuc) return sonuc.durum;

  const ogrenciId = sonuc.veri.ogrenciId;
  const ogrenci = await ogrenciyiBul(ogrenciId, subeId);
  if (!ogrenci) return { hata: "Öğrenci bulunamadı." };

  // Yaş DOĞUM TARİHİNDEN, görüşme gününe göre hesaplanır — formdan gelen değer
  // yalnızca doğum tarihi hiç girilmemişse kullanılır. Yaş bandı hangi metin
  // sözlüğünün kullanılacağını belirlediği için istemciye bırakılmaz.
  const yas =
    ogrenci.birthDate !== null
      ? yasYil(ogrenci.birthDate, sonuc.veri.tarih)
      : sonuc.veri.elleYas;
  if (yas === null) {
    return {
      alanHatalari: { yas: "Öğrencinin doğum tarihi yok; yaşını seçin." },
      degerler: formDegerleri(formVerisi, VELI_FORM_ALANLARI),
      coklular: formCoklulari(formVerisi, COKLU_ALANLAR),
    };
  }

  const { band, bandDisi } = yasBandiSec(yas);
  const { genel, guclu, zorlanma, yonlendirmeler } = secimleriCikar(
    band,
    sonuc.veri.isaretler,
    sonuc.veri.yonlendirmeNotlari,
  );

  const secimler: VeliGorusmeSecimleri = {
    band,
    genelAnahtarlari: genel.map((m) => m.anahtar),
    gucluAnahtarlari: guclu.map((m) => m.anahtar),
    zorlanmaAnahtarlari: zorlanma.map((m) => m.anahtar),
    yonlendirmeler,
  };

  const raporGirdisi = await veliBriefGirdisiHazirla(
    ogrenciId,
    subeId,
    sonuc.veri.tarih,
  );

  const brief = veliBriefiUret({
    ogrenciIlkAdi: ogrenci.firstName,
    cevaplar: sonuc.veri.cevaplar,
    secimler,
    raporGirdisi,
  });

  if (formVerisi.get("niyet") !== "kaydet") {
    return {
      brief,
      degerler: formDegerleri(formVerisi, VELI_FORM_ALANLARI),
      coklular: formCoklulari(formVerisi, COKLU_ALANLAR),
    };
  }

  const form: VeliGorusmeFormu = {
    yas,
    band,
    bandDisi,
    genel,
    guclu,
    zorlanma,
    gozlemNotu: sonuc.veri.gozlemNotu,
    gucluOzeti: sonuc.veri.gucluOzeti,
    atolyeNotlari: sonuc.veri.atolyeNotlari,
  };

  // Görüşme ve yönlendirme kararları TEK işlemde: yönlendirmeler yazılmadan
  // görüşme kaydedilirse brief'in "bu dönem şuna yönlendirildi" cümlesiyle
  // kaydın kendisi çelişirdi.
  await db.parentMeeting.create({
    data: {
      studentId: ogrenciId,
      date: sonuc.veri.tarih,
      interviewerName: sonuc.veri.gorusmeciAdi,
      answersJson: sonuc.veri.cevaplar as unknown as object,
      briefJson: brief as unknown as object,
      formJson: form as unknown as object,
      createdByUserId: kullanici.id,
      referrals: {
        create: yonlendirmeler.map((y) => ({
          studentId: ogrenciId,
          kind: y.tur,
          label: y.etiket,
          note: y.not,
        })),
      },
    },
  });

  gorusmeleriTazele(ogrenciId);
  return { basari: "Veli görüşmesi ve brief kaydedildi." };
}

/** Görüşme değişince iki ekran birden tazelenir: Danışmanlık ve profil. */
function gorusmeleriTazele(ogrenciId: string) {
  revalidatePath("/koordinator/danismanlik");
  revalidatePath(`/koordinator/ogrenciler/${ogrenciId}`);
}

/**
 * Görüşme SONRASI serbest not — kayıt görüşmeden önce açıldığı için not
 * sonradan gelir; "sil + yeniden ekle" burada uymaz (brief ve test cevapları
 * da kaybolurdu). Üzerine yazmak serbest, `noteUpdatedAt` damgalanır.
 */
export async function veliGorusmesiNotuKaydet(
  gorusmeId: string,
  _oncekiDurum: VeliGorusmesiEylemDurumu,
  formVerisi: FormData,
): Promise<VeliGorusmesiEylemDurumu> {
  const kullanici = await yonetimZorunlu("danismanlik", "TAM");
  const subeId = kullanici.aktifSubeId;

  const ham = formVerisi.get("not");
  const not = typeof ham === "string" ? ham.trim() : "";
  if (!not) {
    return { alanHatalari: { not: "Görüşme notu boş olamaz." } };
  }
  if (not.length > 5000) {
    return {
      alanHatalari: { not: "Not en fazla 5000 karakter olabilir." },
      degerler: { not },
    };
  }

  const gorusme = await db.parentMeeting.findFirst({
    where: { id: gorusmeId, student: { branchId: subeId } },
    select: { id: true, studentId: true },
  });
  if (!gorusme) return { hata: "Görüşme bulunamadı." };

  await db.parentMeeting.update({
    where: { id: gorusme.id },
    data: { note: not, noteUpdatedAt: new Date() },
  });

  gorusmeleriTazele(gorusme.studentId);
  return { basari: "Görüşme notu kaydedildi." };
}

/**
 * Yanlış girilen görüşme silinir; kayıt alanları için düzenleme yok (yalnızca
 * not güncellenebilir). Onay istemcide soruluyor (window.confirm).
 */
export async function veliGorusmesiSil(
  gorusmeId: string,
): Promise<VeliGorusmesiEylemDurumu> {
  const kullanici = await yonetimZorunlu("danismanlik", "TAM");
  const subeId = kullanici.aktifSubeId;

  const gorusme = await db.parentMeeting.findFirst({
    where: { id: gorusmeId, student: { branchId: subeId } },
    select: { id: true, studentId: true, date: true },
  });
  if (!gorusme) return { hata: "Görüşme bulunamadı." };

  await db.parentMeeting.delete({ where: { id: gorusme.id } });

  gorusmeleriTazele(gorusme.studentId);
  return {
    basari: `${tarihBicimle(gorusme.date)} tarihli veli görüşmesi silindi.`,
  };
}
