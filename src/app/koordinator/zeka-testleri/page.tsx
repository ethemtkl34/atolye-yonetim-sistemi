import type { Metadata } from "next";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { SayfaBasligi } from "@/components/ui";
import { bugun, tarihMetni } from "@/lib/tarih";
import { tamAd, turkceKarsilastir } from "@/lib/turkce";
import {
  ZekaTestleriBolumu,
  type ZekaTestiSatiri,
} from "@/components/zeka-testleri-bolumu";

export const metadata: Metadata = {
  title: "Zeka testleri",
};

/**
 * Zeka testleri — uygulanan testlerin sonuç belgeleri (PDF/görsel) tek
 * yerden yüklenir, önizlenir ve yönetilir.
 *
 * Yükleme ve silmenin tek adresi burasıdır; öğrenci profili aynı belgeleri
 * yalnızca gösterir (Danışmanlık deseni).
 *
 * GİZLİLİK: Test sonuçları sağlık bilgisi kuralına tabidir — sayfa yalnızca
 * koordinatör/yönetici rolüne açıktır, stajyer sorgularına hiç girmez.
 */
export default async function ZekaTestleriSayfasi() {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

  const [ogrenciler, testKayitlari] = await Promise.all([
    // Yükleme formundaki öğrenci seçici — şubenin bütün öğrencileri.
    db.student.findMany({
      where: { branchId: subeId },
      select: { id: true, firstName: true, lastName: true },
    }),
    // `fileData` bilinçli olarak SEÇİLMİYOR: liste ekranı megabaytlarca
    // belge verisini taşımamalı, belge yalnızca indirme rotasından okunur.
    db.intelligenceTest.findMany({
      where: { student: { branchId: subeId } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        studentId: true,
        date: true,
        testName: true,
        notes: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
        student: { select: { firstName: true, lastName: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  // Prisma'nın sıralaması Türkçe harfleri bilmez; seçici listesi burada
  // sıralanır ("Çınar" C'den sonra gelsin).
  const ogrenciSecenekleri = ogrenciler
    .map((ogrenci) => ({
      id: ogrenci.id,
      ad: tamAd(ogrenci.firstName, ogrenci.lastName),
    }))
    .sort((a, b) => turkceKarsilastir(a.ad, b.ad));

  const testler: ZekaTestiSatiri[] = testKayitlari.map((test) => ({
    id: test.id,
    ogrenciId: test.studentId,
    ogrenciAdi: tamAd(test.student.firstName, test.student.lastName),
    tarih: test.date,
    testAdi: test.testName,
    not: test.notes,
    dosyaAdi: test.fileName,
    mime: test.mimeType,
    boyut: test.fileSize,
    ekleyen: test.createdBy?.name ?? null,
    eklenmeTarihi: test.createdAt,
  }));

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Zeka testleri"
        aciklama="Uygulanan testlerin sonuç belgeleri buradan yüklenir ve önizlenir; öğrenci profili belgeleri yalnızca gösterir. Bu bölüm stajyerlere hiçbir ekranda görünmez."
      />

      <ZekaTestleriBolumu
        mod="yonetim"
        testler={testler}
        ogrenciSecenekleri={ogrenciSecenekleri}
        bugunMetni={tarihMetni(bugun())}
      />
    </div>
  );
}
