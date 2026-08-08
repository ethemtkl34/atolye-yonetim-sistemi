import { renderToBuffer } from "@react-pdf/renderer";
import { belgeYetkisi } from "@/lib/yetki-kapisi";
import { db } from "@/lib/db";
import { RaporBelgesi } from "@/lib/pdf/rapor-belgesi";
import { RaporBelgesiV2 } from "@/lib/pdf/rapor-belgesi-v2";
import type { RaporGovdesi } from "@/lib/rapor-motoru";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";
import { tarihMetni } from "@/lib/tarih";
import { normalizeArama } from "@/lib/turkce";

/**
 * §11.5 — Üretilmiş bir PDF raporunun indirilmesi.
 *
 * PDF ikili verisi saklanmıyor; `ReportPdf.snapshotJson` içinde üretim
 * anındaki rapor içeriğinin tam kopyası duruyor ve belge her istekte bu
 * kopyadan yeniden çiziliyor. Sonuç aynı: §13.17 gereği eski PDF'in içeriği
 * hiç değişmiyor — rapor sonradan düzenlense bile bu adres o günkü metni
 * veriyor. Dosya deposu bağımlılığı olmadığı için sistem yerelde de üretimde
 * de aynı şekilde çalışıyor; P12'de nesne deposuna geçilmek istenirse
 * yalnızca `fileUrl` değişir.
 *
 * YETKİ: `belgeYetkisi` — raporu görebilen herkes PDF'ini de indirebilir;
 * sabit rol listesi yerine yetki matrisi (danışma görevlisi ve stajyerde
 * raporlar YOK → 403). Önceden yalnızca belirteçteki role bakılıyordu; id
 * tahmin edilebilirse başka şubenin raporu indirilebilirdi.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const yetki = await belgeYetkisi("raporlar", "GORUNTULE");
  if (yetki instanceof Response) return yetki;

  const { id } = await params;

  const pdf = await db.reportPdf.findFirst({
    where: {
      id,
      ...(yetki.subeId
        ? { report: { student: { branchId: yetki.subeId } } }
        : {}),
    },
    select: {
      createdAt: true,
      snapshotJson: true,
      report: {
        select: {
          generatedAt: true,
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
      },
    },
  });

  if (!pdf) return new Response("Rapor bulunamadı.", { status: 404 });

  const ogrenciAdi = `${pdf.report.student.firstName} ${pdf.report.student.lastName}`;
  const kapsam = pdf.report.enrollmentLinks.map(
    (bag) =>
      `${bag.enrollment.group.term?.name ?? bag.enrollment.group.club?.name ?? "Program"} · ${bag.enrollment.group.name}`,
  );

  // §13.17 — Gövde biçimi zamanla değişti; belge snapshot'ın sürümüne göre
  // seçilir. Sürüm alanı taşımayan arşiv kayıtları eski düzeniyle basılmaya
  // devam eder: alınmış bir belge yeniden indirildiğinde başka bir şey
  // göstermemeli. V2 gövdesi öğrenci adını ve kapsamı kendi içinde taşıdığı
  // için ayrıca geçirilmez.
  const snapshot = pdf.snapshotJson as unknown as { surum?: number };

  const belge = await renderToBuffer(
    snapshot?.surum === 2
      ? RaporBelgesiV2({
          govde: pdf.snapshotJson as unknown as RaporGovdesiV2,
          uretimZamani: pdf.report.generatedAt,
        })
      : RaporBelgesi({
          govde: pdf.snapshotJson as unknown as RaporGovdesi,
          ogrenciAdi,
          kapsam,
          uretimZamani: pdf.report.generatedAt,
        }),
  );

  // Dosya adı Türkçe karakter içermesin: bazı tarayıcı ve işletim sistemleri
  // indirilen dosya adında bozuk karakter üretiyor.
  const dosyaAdi = `${normalizeArama(ogrenciAdi).replace(/\s+/g, "-")}-rapor-${tarihMetni(pdf.createdAt)}.pdf`;

  return new Response(new Uint8Array(belge), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${dosyaAdi}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
