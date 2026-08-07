import { belgeYetkisi } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { tarihMetni } from "@/lib/tarih";
import { normalizeArama } from "@/lib/turkce";

/**
 * Zeka testi belgesinin indirilmesi / tarayıcıda önizlenmesi.
 *
 * Belgenin ikili verisi veritabanında duruyor (bkz. `IntelligenceTest`
 * şema notu); bu rota onu olduğu gibi verir. `inline` disposition ile
 * tarayıcı PDF ve görselleri indirme yerine pencerede gösterir — detay
 * penceresindeki önizleme de bu adresi kullanır.
 *
 * YETKİ: `belgeYetkisi` (rapor-pdf rotasıyla ortak). Belge İÇERİĞİ için
 * GORUNTULE gerekir; LISTE yetmez. Danışma görevlisi liste sayfasını görür
 * ama belgeyi bu rotadan da açamaz — "sadece liste" sınırının asıl durduğu
 * yer burası, arayüzdeki gizleme değil. Test sonuçları sağlık bilgisi gibi
 * hassastır: stajyer bu rotadan da veri alamaz.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const yetki = await belgeYetkisi("zekaTestleri", "GORUNTULE");
  if (yetki instanceof Response) return yetki;

  const { id } = await params;

  const test = await db.intelligenceTest.findFirst({
    where: {
      id,
      ...(yetki.subeId
        ? { student: { branchId: yetki.subeId } }
        : {}),
    },
    select: {
      date: true,
      testName: true,
      mimeType: true,
      fileData: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });

  if (!test) return new Response("Belge bulunamadı.", { status: 404 });

  // Dosya adı Türkçe karakter içermesin (rapor-pdf rotasındaki kural);
  // uzantı yüklemedeki addan değil, doğrulanmış mime türünden türetilir.
  const uzanti =
    test.mimeType === "application/pdf"
      ? "pdf"
      : test.mimeType === "image/png"
        ? "png"
        : "jpg";
  const ogrenciAdi = `${test.student.firstName} ${test.student.lastName}`;
  const dosyaAdi = `${normalizeArama(`${ogrenciAdi} ${test.testName}`).replace(/\s+/g, "-")}-${tarihMetni(test.date)}.${uzanti}`;

  return new Response(new Uint8Array(test.fileData), {
    headers: {
      "Content-Type": test.mimeType,
      "Content-Disposition": `inline; filename="${dosyaAdi}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
