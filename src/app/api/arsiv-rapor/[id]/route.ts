import { belgeYetkisi } from "@/lib/yetki-kapisi";
import { db } from "@/lib/db";
import { tarihMetni } from "@/lib/tarih";
import { normalizeArama } from "@/lib/turkce";

/**
 * Arşiv raporunun (geçmişten aktarılan PDF) tarayıcıda açılması.
 *
 * Bu belgeler panel açılmadan önce dışarıda üretildi; rapor motoruyla yeniden
 * çizilemezler (`rapor-pdf` rotası snapshot'tan çizer, burada snapshot yok).
 * İkili veri veritabanında duruyor (bkz. `LegacyReport` şema notu), rota onu
 * olduğu gibi verir.
 *
 * YETKİ: `rapor-pdf` rotasıyla aynı kapı — belge İÇERİĞİ için `GORUNTULE`
 * gerekir, `LISTE` yetmez. Danışma görevlisi öğrenci profilini açabilir ama
 * belgeyi buradan da alamaz.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const yetki = await belgeYetkisi("raporlar", "GORUNTULE");
  if (yetki instanceof Response) return yetki;

  const { id } = await params;

  const rapor = await db.legacyReport.findFirst({
    where: {
      id,
      ...(yetki.subeId ? { student: { branchId: yetki.subeId } } : {}),
    },
    select: {
      termLabel: true,
      reportDate: true,
      fileData: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });

  if (!rapor) return new Response("Belge bulunamadı.", { status: 404 });

  // Dosya adı Türkçe karakter içermesin (rapor-pdf rotasındaki kural).
  // Orijinal dosya adı kullanılmıyor: kütükte "B2 Ö.Ö. MUSAB TAHA TUNÇxlsx.pdf"
  // gibi tutarsız adlar var, indirilen belge okunur bir ad taşımalı.
  const ogrenciAdi = `${rapor.student.firstName} ${rapor.student.lastName}`;
  const dosyaAdi = `${normalizeArama(`${ogrenciAdi} ${rapor.termLabel}`).replace(/\s+/g, "-")}-${tarihMetni(rapor.reportDate)}.pdf`;

  return new Response(new Uint8Array(rapor.fileData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${dosyaAdi}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
