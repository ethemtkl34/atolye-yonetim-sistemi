import { z } from "zod";
import { DONUSUM_HEDEFLERI } from "@/lib/aday/donusum";
import { tarihCozumle } from "@/lib/tarih";

/**
 * §16 — Aday formlarının doğrulama şemaları.
 *
 * Ayrı dosyada çünkü hem `"use server"` eylemleri hem istemci form bileşeni
 * kullanıyor; `"use server"` dosyaları fonksiyon dışında bir şey dışa
 * aktaramıyor (üretimde 500'e düşüren tuzak).
 */

const bosuNullYap = (deger: unknown) =>
  typeof deger === "string" && deger.trim() === "" ? null : deger;

const isteğeBagliMetin = (enFazla: number, alanAdi: string) =>
  z.preprocess(
    bosuNullYap,
    z
      .string()
      .trim()
      .max(enFazla, `${alanAdi} en fazla ${enFazla} karakter olabilir`)
      .nullable(),
  );

const isteğeBagliTarih = (mesaj: string) =>
  z.preprocess(
    bosuNullYap,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, mesaj)
      // Biçimi doğru ama var olmayan tarih (31 Şubat) burada yakalanır;
      // yakalanmasaydı kayıt "başarılı" görünür, tarih sessizce boş kalırdı.
      .refine((deger) => tarihCozumle(deger) !== null, { message: mesaj })
      .nullable(),
  );

/**
 * Elle aday açma/düzenleme.
 *
 * Zorunlu alan yalnız veli adı ve telefon: danışman çoğu zaman TELEFON
 * KONUŞMASININ ORTASINDA kaydı açıyor; zorunlu her alan konuşmayı kesiyor.
 * Kalan her şey sonradan doldurulabilir.
 */
export const adaySemasi = z.object({
  parentName: z
    .string()
    .trim()
    .min(2, "Veli adı en az 2 karakter olmalı")
    .max(120, "Veli adı en fazla 120 karakter olabilir"),
  phone: z
    .string()
    .trim()
    .min(1, "Telefon gerekli")
    .max(40, "Telefon en fazla 40 karakter olabilir"),
  childName: isteğeBagliMetin(120, "Öğrenci adı"),
  childAge: z.preprocess(
    bosuNullYap,
    z.coerce
      .number()
      .int("Yaş tam sayı olmalı")
      .min(1, "Yaş 1 ile 25 arasında olmalı")
      .max(25, "Yaş 1 ile 25 arasında olmalı")
      .nullable(),
  ),
  email: z.preprocess(
    bosuNullYap,
    z.email("Geçerli bir e-posta girin").max(200).nullable(),
  ),
  // Makine kaynakları (META/WEB_SITESI) bilerek yok: elle seçilebilseydi
  // kaynak raporundaki reklam getirisi elle şişirilebilirdi.
  source: z.enum(["TELEFON", "YOLDAN_GECEN", "DIGER"], {
    message: "Kaynak seçin",
  }),
  interestedProgram: isteğeBagliMetin(200, "İlgilenilen program"),
  nextActionDate: isteğeBagliTarih("Geçerli bir tarih girin"),
  not: isteğeBagliMetin(2000, "Not"),
  /**
   * §16.11 — KVKK açık rızası.
   *
   * Kurumun aday verisini saklama dayanağı bu onay; kaydedilemezse dayanak
   * da kayıtsız kalır. Web formu ve entegratör onayı payload'da gönderiyor
   * (`POST /api/crm/aday`), telefonla arayan ve şubeye gelen veli için ise
   * ONU ALAN KİŞİ işaretliyor.
   *
   * ZORUNLU DEĞİL: onay vermeyen bir veliyi kayıt dışı bırakmak, telefonu
   * açan kişiyi kaydı hiç açmamaya iter ve aday kaybolur. Onaysız kayıt
   * listede işaretli görünür.
   */
  kvkkOnay: z.preprocess((deger) => deger === "on" || deger === true, z.boolean()),
});

/**
 * Düzenleme — `source` HARİÇ aynı alanlar.
 *
 * Kaynak düzenlemede sorulmaz: Meta'dan gelen bir aday elle "Telefon"a
 * çevrilebilseydi kaynak raporu geçmişe dönük bozulurdu. Alanı forma gizli
 * girdiyle geri göndermek de işe yaramaz — makine kaynakları elle şemanın
 * enum'unda yok ve doğrulama takılırdı.
 */
export const adayDuzenlemeSemasi = adaySemasi.omit({ source: true });

export const ADAY_FORM_ALANLARI = [
  "parentName",
  "phone",
  "childName",
  "childAge",
  "email",
  "source",
  "interestedProgram",
  "nextActionDate",
  "not",
  "kvkkOnay",
] as const;

export function adayFormundanOku(formVerisi: FormData): Record<string, unknown> {
  return Object.fromEntries(
    ADAY_FORM_ALANLARI.map((alan) => [alan, formVerisi.get(alan)]),
  );
}

/** Kayıp kaydı — sebep zorunlu, DIGER'de açıklama da zorunlu (CHECK ile aynı). */
export const kayipSemasi = z
  .object({
    lossReason: z.enum(
      [
        "ULASILAMADI",
        "FIYAT",
        "UZAKLIK",
        "PROGRAM_UYGUN_DEGIL",
        "VAZGECTI",
        "YANLIS_KAYIT",
        "DIGER",
      ],
      { message: "Kayıp sebebi seçin" },
    ),
    lossNote: isteğeBagliMetin(1000, "Açıklama"),
  })
  .refine((veri) => veri.lossReason !== "DIGER" || Boolean(veri.lossNote), {
    message: "“Diğer” seçtiyseniz kısa bir açıklama yazın.",
    path: ["lossNote"],
  });

export const KAYIP_FORM_ALANLARI = ["lossReason", "lossNote"] as const;

/** Randevu kaydı — tarih zorunlu, saat isteğe bağlı (aile "öğleden sonra" der). */
export const randevuSemasi = z.object({
  tarih: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir randevu tarihi girin")
    .refine((deger) => tarihCozumle(deger) !== null, {
      message: "Geçerli bir randevu tarihi girin",
    }),
  saat: z.preprocess(
    bosuNullYap,
    z
      .string()
      // Saat ve dakika aralığı da kısıtlı: `\d{2}` "99:99"u geçirirdi ve
      // sunucu tarayıcının `type="time"` kısıtına güvenmemeli.
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saati SS:DD biçiminde girin")
      .nullable(),
  ),
  not: isteğeBagliMetin(500, "Not"),
});

export const RANDEVU_FORM_ALANLARI = ["tarih", "saat", "not"] as const;

/** Etkinlik (arama/whatsapp/not) — insan eliyle yazılabilen türler. */
export const etkinlikSemasi = z.object({
  type: z.enum(["ARAMA", "ULASILAMADI", "WHATSAPP", "NOT"], {
    message: "Etkinlik türü seçin",
  }),
  note: isteğeBagliMetin(2000, "Not"),
  /** Etkinlikle birlikte sonraki arama tarihini de güncelleyebilir. */
  nextActionDate: isteğeBagliTarih("Geçerli bir tarih girin"),
});

export const ETKINLIK_FORM_ALANLARI = [
  "type",
  "note",
  "nextActionDate",
] as const;

/** Takip tarihi ve sorumlu ataması. */
export const takipSemasi = z.object({
  nextActionDate: isteğeBagliTarih("Geçerli bir tarih girin"),
  nextActionNote: isteğeBagliMetin(300, "Takip notu"),
});

export const TAKIP_FORM_ALANLARI = [
  "nextActionDate",
  "nextActionNote",
] as const;

/**
 * Dönüşümün "sonraki adım" hedefi (§16.9). Değerlerin tek kaynağı
 * `lib/aday/donusum.ts` — yazma ve yönlendirme oradan okuyor.
 *
 * `catch("yok")`: tanınmayan hedef dönüşümü ENGELLEMEZ. Öğrenci zaten
 * açılıyor; bozuk bir sorgu parametresi yüzünden kaydı reddetmek, kullanıcıyı
 * formu yeniden doldurmaya zorlardı.
 */
export const donusumHedefiSemasi = z.enum(DONUSUM_HEDEFLERI).catch("yok");

/** Mevcut öğrenciyle eşleştirerek kazanma. */
export const eslestirmeSemasi = z.object({
  ogrenciId: z.string().trim().min(1, "Öğrenci seçin"),
  hedef: donusumHedefiSemasi,
});
