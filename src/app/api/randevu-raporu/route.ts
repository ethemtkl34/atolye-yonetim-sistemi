import { belgeSubesi } from "@/lib/yetki-kapisi";
import { bugun, tarihCozumle, tarihMetni } from "@/lib/tarih";
import { ciroCsv } from "@/lib/randevu/ciro";
import {
  raporAraligi,
  raporKapsamiMi,
  subeCiroRaporu,
} from "@/lib/randevu/rapor-verisi";
import { normalizeArama } from "@/lib/turkce";

/**
 * §17.5 — Ciro raporunun Excel çıktısı.
 *
 * Rapor motoru PDF üretiyor ama bu tablo PDF DEĞİL: kurum rakamları
 * kendi tablosuna taşıyor, sıralıyor, kendi hesabını ekliyor. PDF bunu
 * imkânsız kılardı; CSV Excel'de doğrudan açılıyor.
 *
 * YETKİ: `belgeSubesi("randevular", "GORUNTULE")` — rapor ekranını gören
 * çıktıyı da alabilir. Ayrı bir para yetkisi yok (§17.8), ama modülü
 * görmeyen (stajyer, test uygulayıcısı) buradan da veri alamaz.
 *
 * `belgeYetkisi` DEĞİL `belgeSubesi`: birincisi yöneticide "bütün şubeler"
 * anlamına gelen `null` döndürüyor ve rapor şubeye kilitli olduğu için
 * yönetici ekranı görüp yanındaki dışa aktarma düğmesinden hata alıyordu.
 *
 * Sayılar EKRANLA AYNI yerden geliyor (`subeCiroRaporu`); iki ayrı sorgu
 * yazılsaydı çıktı ile ekran sessizce ayrışırdı.
 */
export async function GET(istek: Request): Promise<Response> {
  const yetki = await belgeSubesi("randevular", "GORUNTULE");
  if (yetki instanceof Response) return yetki;

  const adres = new URL(istek.url);
  const kapsamParametresi = adres.searchParams.get("kapsam");
  const kapsam = raporKapsamiMi(kapsamParametresi) ? kapsamParametresi : "hafta";
  const capa = tarihCozumle(adres.searchParams.get("tarih") ?? "") ?? bugun();

  const aralik = raporAraligi(kapsam, capa);

  const rapor = await subeCiroRaporu(yetki.subeId, aralik);

  const csv = ciroCsv(rapor, {
    aralik: aralik.etiket,
    sube: yetki.subeAdi,
  });

  // Dosya adı Türkçe karakter içermesin (rapor-pdf rotasındaki kural):
  // bazı istemciler indirme başlığındaki UTF-8'i bozuyor.
  const dosyaAdi = `randevu-ciro-${normalizeArama(yetki.subeAdi).replace(
    /\s+/g,
    "-",
  )}-${tarihMetni(aralik.ilk)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dosyaAdi}"`,
      // Rapor her istekte taze hesaplanıyor; ara bellek eski rakam gösterirdi.
      "Cache-Control": "no-store",
    },
  });
}
