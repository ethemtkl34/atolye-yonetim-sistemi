/**
 * OpenAI Responses API'sine ince bir sarmalayıcı — §11.2.
 *
 * SDK EKLENMEDİ: tek bir uç noktaya (`/v1/responses`) düz metin isteği
 * gönderiyoruz. Bir paket bağımlılığı, kendi sürüm döngüsünü ve derleme
 * boyutunu getirirdi; buradaki yüzey `fetch` ile birkaç satır.
 *
 * ANAHTAR YOKSA HATA DEĞİL: `metinUret` `null` döner ve çağıran şablon
 * metnine düşer. Rapor üretimi yapay zekâya bağımlı değil; yapay zekâ onu
 * iyileştiren bir katman (§11.2 — şablon yedek kalır).
 *
 * Bu dosya YALNIZCA sunucuda çalışır: anahtar istemciye hiç geçmez.
 */

/**
 * Rapor motorunun kullandığı modeller.
 *
 * Öğrenci metinleri veliye gidiyor ve Türkçe akıcılığı doğrudan kurumun
 * yüzü; oraya en iyi model konuluyor. Atölye içerik paragrafları ise
 * müfredat maddelerini özetleyen daha mekanik bir iş ve program başına bir
 * kez üretiliyor, orada daha ucuz model yeterli.
 *
 * Maliyet burada belirleyici değil: bir dönemin bütün öğrencileri ve
 * atölyeleri için toplam birkaç dolar.
 */
export const MODELLER = {
  ogrenciMetni: "gpt-5.6-sol",
  atolyeIcerigi: "gpt-5.6-terra",
} as const;

/**
 * Bir istek en fazla bu kadar bekler. Rapor penceresi kullanıcının önünde
 * açık duruyor; süresiz bekleyen bir çağrı, pencereyi kilitlenmiş gibi
 * gösterirdi.
 */
const ZAMAN_ASIMI_MS = 90_000;

export type UretimSonucu =
  | { durum: "tamam"; metin: string }
  | { durum: "anahtar-yok" }
  | { durum: "hata"; mesaj: string };

/**
 * Anahtarı ÇAĞRI ANINDA okur — `lib/env.ts` üzerinden değil.
 *
 * `env.ts` doğrulamayı modül yüklenirken yapıyor ve Next.js bu modülü
 * derleme sırasında da çalıştırıyor. Vercel'de "Sensitive" işaretli
 * değişkenler derlemede gerçek değerleriyle gelmediği için, doğrulanmış
 * nesne "anahtar yok" hâlinde donuyor ve çalışma anında gerçek değer
 * okunmuş olmuyordu. Bu yüzden anahtar burada, her çağrıda taze okunuyor.
 *
 * Boş metin tanımsız sayılır: aynı sebeple değişken boş gelebiliyor.
 */
function anahtariOku(): string | null {
  const ham = process.env.OPENAI_API_KEY?.trim();
  return ham ? ham : null;
}

/** Anahtar tanımlı mı — arayüz "Metin üret" düğmesini buna göre gösterir. */
export function yapayZekaAcikMi(): boolean {
  return anahtariOku() !== null;
}

/**
 * Modele bir talimat ve bir girdi verip düz metin ister.
 *
 * `talimat` sistem rolüne, `girdi` kullanıcı rolüne yazılır. İkisini ayrı
 * tutmak önemli: talimat raporun kurallarını taşıyor (uydurma yasağı, dil,
 * uzunluk), girdi ise o öğrenciye ait veriyi. Aynı metne karıştırılsalardı
 * veri içindeki bir cümle talimat gibi okunabilirdi.
 */
export async function metinUret({
  model,
  talimat,
  girdi,
  enFazlaJeton = 1500,
}: {
  model: string;
  talimat: string;
  girdi: string;
  enFazlaJeton?: number;
}): Promise<UretimSonucu> {
  const anahtar = anahtariOku();
  if (!anahtar) return { durum: "anahtar-yok" };

  const iptal = AbortSignal.timeout(ZAMAN_ASIMI_MS);

  let cevap: Response;
  try {
    cevap = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anahtar}`,
      },
      signal: iptal,
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: talimat },
          { role: "user", content: girdi },
        ],
        max_output_tokens: enFazlaJeton,
      }),
    });
  } catch (hata) {
    // Zaman aşımı ve ağ hatası aynı yere düşer; ikisi de kullanıcı için
    // "şimdi olmadı, tekrar dene" anlamına geliyor.
    const zamanAsimi = hata instanceof Error && hata.name === "TimeoutError";
    return {
      durum: "hata",
      mesaj: zamanAsimi
        ? "Metin üretimi zaman aşımına uğradı. Tekrar deneyebilirsiniz."
        : "OpenAI'a ulaşılamadı. Bağlantıyı kontrol edip tekrar deneyin.",
    };
  }

  if (!cevap.ok) {
    const govde = (await cevap.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    const detay = govde?.error?.message ?? cevap.statusText;

    // Anahtar ve kota hataları kurulum sorunudur; koordinatörün tekrar
    // denemesi bir işe yaramaz, bu yüzden ayrı ayrı adlandırılıyorlar.
    if (cevap.status === 401) {
      return {
        durum: "hata",
        mesaj: "OpenAI anahtarı geçersiz. Ortam değişkenini kontrol edin.",
      };
    }
    if (cevap.status === 429) {
      return {
        durum: "hata",
        mesaj: "OpenAI kota veya hız sınırına takıldı. Bir süre sonra deneyin.",
      };
    }
    return { durum: "hata", mesaj: `OpenAI hatası (${cevap.status}): ${detay}` };
  }

  const veri = (await cevap.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };

  const metin = metniCikar(veri);
  if (!metin) {
    return {
      durum: "hata",
      mesaj: "OpenAI boş yanıt döndürdü. Tekrar deneyebilirsiniz.",
    };
  }

  return { durum: "tamam", metin };
}

/**
 * Yanıttan düz metni çıkarır.
 *
 * `output_text` kolaylık alanı; her zaman gelmeyebiliyor (akış veya araç
 * kullanımı olan yanıtlarda). O yüzden `output` dizisindeki metin parçaları
 * yedek olarak birleştiriliyor.
 */
function metniCikar(veri: {
  output_text?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
}): string | null {
  if (veri.output_text?.trim()) return veri.output_text.trim();

  const parcalar =
    veri.output
      ?.flatMap((satir) => satir.content ?? [])
      .filter((parca) => parca.type !== "reasoning")
      .map((parca) => parca.text ?? "")
      .filter(Boolean) ?? [];

  const birlesik = parcalar.join("\n").trim();
  return birlesik.length > 0 ? birlesik : null;
}
