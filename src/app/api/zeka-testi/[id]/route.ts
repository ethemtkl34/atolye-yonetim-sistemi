import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tarihMetni } from "@/lib/tarih";
import { normalizeArama } from "@/lib/turkce";
import { yetkiYeter } from "@/lib/yetkiler";

/**
 * Zeka testi belgesinin indirilmesi / tarayıcıda önizlenmesi.
 *
 * Belgenin ikili verisi veritabanında duruyor (bkz. `IntelligenceTest`
 * şema notu); bu rota onu olduğu gibi verir. `inline` disposition ile
 * tarayıcı PDF ve görselleri indirme yerine pencerede gösterir — detay
 * penceresindeki önizleme de bu adresi kullanır.
 *
 * YETKİ: `rapor-pdf` rotasıyla aynı iki katmanlı kontrol — rol veritabanından
 * okunur (belirteç 12 saat bayat kalabilir) ve belgenin şubesi doğrulanır.
 * Test sonuçları sağlık bilgisi gibi hassastır: stajyer bu rotadan da veri
 * alamaz.
 */
export async function GET(
  _istek: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const oturum = await auth();
  if (!oturum?.user?.id) {
    return new Response("Bu belgeye erişim yetkiniz yok.", { status: 403 });
  }

  const kullanici = await db.user.findUnique({
    where: { id: oturum.user.id },
    select: { roles: true, active: true, branchId: true },
  });

  // Belge İÇERİĞİ için GORUNTULE gerekir; LISTE yetmez. Danışma görevlisi
  // liste sayfasını görür ama belgeyi bu rotadan da açamaz — "sadece liste"
  // sınırının asıl durduğu yer burası, arayüzdeki gizleme değil.
  if (
    !kullanici?.active ||
    !yetkiYeter(kullanici.roles, "zekaTestleri", "GORUNTULE")
  ) {
    return new Response("Bu belgeye erişim yetkiniz yok.", { status: 403 });
  }

  // Yönetici bütün şubeleri görüyor; diğerlerinin şubesi zorunlu. Şube null
  // gelirse belge verilmez — "süzgeç yok" hâline düşmek sızıntı olurdu.
  const yonetici = kullanici.roles.includes("ADMIN");
  if (!yonetici && !kullanici.branchId) {
    return new Response("Bu belgeye erişim yetkiniz yok.", { status: 403 });
  }

  const { id } = await params;

  const test = await db.intelligenceTest.findFirst({
    where: {
      id,
      ...(kullanici.branchId
        ? { student: { branchId: kullanici.branchId } }
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
