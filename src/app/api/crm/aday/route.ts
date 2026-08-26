import { adayYaz } from "@/lib/aday/aday-kaydi";
import { DIS_BASVURU_SEMASI } from "@/lib/aday/dis-basvuru-semasi";
import { adayApiJetonu, jetonGecerliMi } from "@/lib/aday/gizli";
import { db } from "@/lib/db";
import { alanHatalari } from "@/lib/formlar";

/**
 * §16.5 — Adayların dış giriş kapısı: `POST /api/crm/aday`.
 *
 * İki tüketici, tek uç:
 *  1. Entegratör (Pabbly/Make) — Meta reklam formlarını buraya aktarır.
 *     Meta'nın App Review, imza doğrulama ve jeton yenileme yükü böylece
 *     bize gelmiyor.
 *  2. tuzder.org form işleyicisi — SUNUCUDAN SUNUCUYA çağırır.
 *
 * Kimlik `Authorization: Bearer` ile. CORS başlığı ve OPTIONS işleyicisi
 * BİLEREK yok: jeton tarayıcıya inmemeli, uç tarayıcıdan çağrılamamalı.
 *
 * Uç hiçbir veri OKUTMAZ — yanıt yalnız durum bildirir. Sızan bir jetonla
 * yapılabilecek en kötü şey sahte aday yazmaktır; saatlik sayaç onu da
 * sınırlar.
 */

/** Ham gövde sınırı — bu boyutta bir başvuru gövdesi olamaz. */
const EN_BUYUK_GOVDE = 10_000;

/** Saatlik yazım tavanı (kaynak başına) — jeton sızıntısının patlama yarıçapı. */
const SAATLIK_TAVAN = 100;

function cevap(govde: Record<string, unknown>, durum: number): Response {
  return Response.json(govde, { status: durum });
}

export async function POST(istek: Request): Promise<Response> {
  const jeton = adayApiJetonu();
  if (!jeton) {
    // Yapılandırma eksikliği yetkisiz istek gibi maskelenmiyor: 401 görseydik
    // haftalarca "entegratör jetonu yanlış" diye aranırdı.
    console.error("[crm] LEAD_API_TOKEN tanımsız — uç kapalı.");
    return cevap({ durum: "kapali" }, 503);
  }

  if (!jetonGecerliMi(istek.headers.get("authorization"), jeton)) {
    return cevap({ durum: "yetkisiz" }, 401);
  }

  const ham = await istek.text();
  if (ham.length > EN_BUYUK_GOVDE) {
    return cevap({ durum: "govde-buyuk" }, 413);
  }

  let govde: unknown;
  try {
    govde = JSON.parse(ham);
  } catch {
    return cevap({ durum: "gecersiz-json" }, 400);
  }

  const cozumlenen = DIS_BASVURU_SEMASI.safeParse(govde);
  if (!cozumlenen.success) {
    return cevap(
      { durum: "hata", alanlar: alanHatalari(cozumlenen.error) },
      422,
    );
  }

  const veri = cozumlenen.data;

  // Bal küpü: gerçek formda gizli ve boş durur, botlar doldurur. Bota
  // "yakalandın" demiyoruz — sessizce başarı dönüp hiçbir şey yazmıyoruz.
  if (veri.website) return cevap({ durum: "tamam" }, 200);

  // Şube payload'dan çözülür ama ALLOWLIST'e karşı: istemci değeri
  // doğrulanmadan şube sınırını belirleyemez.
  const sube = veri.subeKodu
    ? await db.branch.findFirst({
        where: { code: veri.subeKodu, active: true },
        select: { id: true },
      })
    : null;

  // Şube çözülemezse başvuru DÜŞÜRÜLMEZ: gerçek bir ailenin başvurusunu
  // eski bir form değeri yüzünden kaybetmek, yanlış şubede duran ve panelde
  // işaretli görünen bir kayıttan çok daha kötü. Yönetici taşır.
  const varsayilanSube = sube
    ? null
    : await db.branch.findFirst({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });

  const subeId = sube?.id ?? varsayilanSube?.id;
  if (!subeId) {
    console.error("[crm] Aktif şube yok — aday yazılamadı.");
    return cevap({ durum: "sube-yok" }, 503);
  }

  const saatOnce = new Date(Date.now() - 60 * 60 * 1000);
  const sonSaat = await db.lead.count({
    where: {
      branchId: subeId,
      source: veri.kaynak,
      createdAt: { gte: saatOnce },
    },
  });
  if (sonSaat >= SAATLIK_TAVAN) {
    console.error(
      `[crm] Saatlik tavan aşıldı (${veri.kaynak}, şube ${subeId}).`,
    );
    return cevap({ durum: "cok-istek" }, 429);
  }

  try {
    const sonuc = await adayYaz({
      subeId,
      kanal: "api",
      kaynak: veri.kaynak,
      externalId: veri.disKimlik ?? null,
      rawJson: govde,
      // Şube kodu çözülemediyse kayıt işaretli düşer ve listede yönetici
      // uyarısı üretir; sessizce yanlış şubede durmaz.
      ...(sube
        ? {}
        : {
            ingestStatus: "ESLEME_YOK" as const,
            ingestNote: veri.subeKodu
              ? `Şube kodu tanınmadı: “${veri.subeKodu}”. Varsayılan şubeye yazıldı.`
              : "Başvuruda şube kodu yoktu. Varsayılan şubeye yazıldı.",
          }),
      kvkkConsent: veri.kvkkOnay === true,
      girdi: {
        parentName: veri.veliAdi ?? null,
        childName: veri.cocukAdi ?? null,
        childAge: veri.yas ?? null,
        phone: veri.telefon ?? null,
        email: veri.eposta ?? null,
        interestedProgram: veri.ilgi ?? null,
        message: veri.mesaj ?? null,
        sourceDetail: veri.kaynakDetay ?? null,
        // API'den gelen aday BUGÜN aranmalı: kuyruğa hemen düşsün.
        nextActionDate: new Date(),
      },
    });

    return cevap({ durum: "tamam", sonuc: sonuc.sonuc }, 200);
  } catch (hata) {
    // Veritabanı erişilemiyorsa 500: entegratör (Make/Pabbly) hata gören
    // çalıştırmayı yeniden dener, `externalId` tekrarı zararsız kılar.
    // Kişisel veri loglanmıyor — yalnız olayın kendisi.
    console.error("[crm] Aday yazılamadı:", hata);
    return cevap({ durum: "sunucu-hatasi" }, 500);
  }
}
