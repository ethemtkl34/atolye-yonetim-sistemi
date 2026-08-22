import { renderToBuffer } from "@react-pdf/renderer";
import { belgeYetkisi } from "@/lib/yetki-kapisi";
import { db } from "@/lib/db";
import { RaporBelgesi } from "@/lib/pdf/rapor-belgesi";
import { RaporBelgesiV2 } from "@/lib/pdf/rapor-belgesi-v2";
import type { RaporGovdesi } from "@/lib/rapor-motoru";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";

/**
 * §11.5 — Raporun O ANKİ hâlinin PDF önizlemesi.
 *
 * `/api/rapor-pdf/[id]`den farkı: burada `[id]` RAPORUN kimliği ve hiçbir
 * kayıt açılmıyor. Belge her istekte raporun canlı gövdesinden çiziliyor;
 * rapor düzenlendikçe önizleme de değişiyor.
 *
 * Neden gerekti: koordinatör panelde raporun kutularını görüyordu ama
 * veliye giden BELGEYİ göremiyordu — kapak, "Bir Bakışta", grafikler ve
 * sayfa düzeni yalnızca PDF üretilip indirildikten sonra ortaya çıkıyordu.
 * Belgeyi görmek için PDF üretmek gerekmesi, her bakışta rapor geçmişine
 * silinemez bir kayıt daha eklemek demekti (§13.17: üretilmiş PDF silinmez).
 *
 * ÖNİZLEME ARŞİV DEĞİLDİR: `snapshotJson` yazılmadığı için §13.17'nin
 * "alınmış belge değişmez" güvencesi buraya uygulanmaz ve uygulanmamalı.
 * Bu adres bir belge vermez, bir görüntü verir; `no-store` da bunun için.
 *
 * YETKİ: `belgeYetkisi` — raporu görebilen herkes önizleyebilir; şube
 * süzgeci `student.branchId` üzerinden.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const yetki = await belgeYetkisi("raporlar", "GORUNTULE");
  if (yetki instanceof Response) return yetki;

  const { id } = await params;

  const rapor = await db.report.findFirst({
    where: {
      id,
      ...(yetki.subeId ? { student: { branchId: yetki.subeId } } : {}),
    },
    select: {
      generatedAt: true,
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

  if (!rapor) return new Response("Rapor bulunamadı.", { status: 404 });

  const surumlu = rapor.bodyJson as { surum?: number };

  // v1 gövde ad ve kapsamı kendi içinde taşımıyor; önizleme canlı tablodan
  // okur. Arşiv güvencesi burada gerekmiyor — bu zaten canlı bir görüntü.
  const belge = await renderToBuffer(
    surumlu?.surum === 2
      ? RaporBelgesiV2({
          govde: rapor.bodyJson as unknown as RaporGovdesiV2,
          uretimZamani: rapor.generatedAt,
        })
      : RaporBelgesi({
          govde: rapor.bodyJson as unknown as RaporGovdesi,
          ogrenciAdi: `${rapor.student.firstName} ${rapor.student.lastName}`,
          kapsam: rapor.enrollmentLinks.map(
            (bag) =>
              `${bag.enrollment.group.term?.name ?? bag.enrollment.group.club?.name ?? "Program"} · ${bag.enrollment.group.name}`,
          ),
          uretimZamani: rapor.generatedAt,
        }),
  );

  return new Response(new Uint8Array(belge), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"rapor-onizleme.pdf\"",
      // Rapor düzenlendikçe önizleme değişmeli; tarayıcı eski çizimi
      // göstermesin. İndirilen belgede durum tam tersi (§13.17) ve orada
      // bir saatlik özel önbellek kullanılıyor.
      "Cache-Control": "no-store",
    },
  });
}
