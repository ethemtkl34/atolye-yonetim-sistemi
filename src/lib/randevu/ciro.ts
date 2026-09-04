/**
 * §17.5 — Uzman bazında seans ve ciro özeti.
 *
 * Bugün Excel'de elle tutulan tablonun karşılığı: kurumun her hafta tek tek
 * girdiği satırlar burada randevu kayıtlarından türetiliyor. Belgedeki
 * 17–23 Ağustos 2026 örneği (46 seans, ₺177.930) bu fonksiyonun testinde
 * sabit veri olarak duruyor.
 *
 * SAF: veritabanına gitmiyor. Aynı hesap hem ekranda hem CSV çıktısında
 * kullanılıyor; iki yerde ayrı toplanırsa rakamlar sessizce ayrışır.
 *
 * SAYIM KURALI — yalnız GERÇEKLEŞEN seans ciroya girer.
 *  - `PLANLANDI` henüz olmamış bir seanstır; ciroya yazmak, olmamış bir işi
 *    gelir saymak olurdu.
 *  - `GELMEDI` takvimde yer tuttu ama seans olmadı: ciroya girmez, AYRI
 *    sayılır ki "kaç randevu boşa gitti" sorusu cevaplanabilsin.
 *  - `IPTAL` hiç olmamış sayılır, yalnız sayısı raporlanır.
 *
 * Ciro `ucretKurus - indirimKurus`: indirim gerçekten alınmayan paradır.
 */

export type RandevuDurumu = "PLANLANDI" | "GERCEKLESTI" | "GELMEDI" | "IPTAL";
export type HizmetGrubu = "TEST" | "DANISMANLIK" | "ATOLYE";

export type CiroGirdisi = {
  uzmanId: string;
  uzmanAdi: string;
  hizmetId: string;
  hizmetAdi: string;
  hizmetGrubu: HizmetGrubu;
  durum: RandevuDurumu;
  ucretKurus: number;
  indirimKurus: number;
};

export type UzmanOzeti = {
  uzmanId: string;
  uzmanAdi: string;
  seansSayisi: number;
  ciroKurus: number;
  gelmedi: number;
  iptal: number;
  planlanan: number;
};

export type HizmetOzeti = {
  hizmetId: string;
  hizmetAdi: string;
  grup: HizmetGrubu;
  seansSayisi: number;
  ciroKurus: number;
};

export type CiroRaporu = {
  uzmanlar: UzmanOzeti[];
  hizmetler: HizmetOzeti[];
  toplamSeans: number;
  toplamCiro: number;
  toplamGelmedi: number;
  toplamIptal: number;
  toplamPlanlanan: number;
};

/** Bir randevunun ciroya yazılan tutarı; gerçekleşmediyse sıfır. */
export function randevuCirosu(girdi: CiroGirdisi): number {
  if (girdi.durum !== "GERCEKLESTI") return 0;
  return Math.max(0, girdi.ucretKurus - girdi.indirimKurus);
}

/**
 * Uzman sıralaması: önce SEANS SAYISI, eşitse CİRO — ikisi de azalan.
 *
 * Kurumun Excel tablosundaki sıra bu; rapor onun yerine geçtiği için aynı
 * sırayı vermek zorunda, yoksa iki tablo yan yana konduğunda karşılaştırma
 * yapılamaz. Ad sıralaması son ayraç: iki uzmanın hem seansı hem cirosu
 * eşitse sıra en azından kararlı olsun.
 */
function uzmanSirala(a: UzmanOzeti, b: UzmanOzeti): number {
  if (b.seansSayisi !== a.seansSayisi) return b.seansSayisi - a.seansSayisi;
  if (b.ciroKurus !== a.ciroKurus) return b.ciroKurus - a.ciroKurus;
  return a.uzmanAdi.localeCompare(b.uzmanAdi, "tr");
}

export function ciroRaporu(girdiler: readonly CiroGirdisi[]): CiroRaporu {
  const uzmanlar = new Map<string, UzmanOzeti>();
  const hizmetler = new Map<string, HizmetOzeti>();

  for (const girdi of girdiler) {
    const tutar = randevuCirosu(girdi);
    const gerceklesti = girdi.durum === "GERCEKLESTI";

    const uzman = uzmanlar.get(girdi.uzmanId) ?? {
      uzmanId: girdi.uzmanId,
      uzmanAdi: girdi.uzmanAdi,
      seansSayisi: 0,
      ciroKurus: 0,
      gelmedi: 0,
      iptal: 0,
      planlanan: 0,
    };
    if (gerceklesti) {
      uzman.seansSayisi += 1;
      uzman.ciroKurus += tutar;
    } else if (girdi.durum === "GELMEDI") uzman.gelmedi += 1;
    else if (girdi.durum === "IPTAL") uzman.iptal += 1;
    else uzman.planlanan += 1;
    uzmanlar.set(girdi.uzmanId, uzman);

    // Hizmet kırılımına yalnız gerçekleşenler giriyor: "hangi hizmetten kaç
    // seans yapıldı" sorusunun cevabı iptalleri içeremez.
    if (!gerceklesti) continue;

    const hizmet = hizmetler.get(girdi.hizmetId) ?? {
      hizmetId: girdi.hizmetId,
      hizmetAdi: girdi.hizmetAdi,
      grup: girdi.hizmetGrubu,
      seansSayisi: 0,
      ciroKurus: 0,
    };
    hizmet.seansSayisi += 1;
    hizmet.ciroKurus += tutar;
    hizmetler.set(girdi.hizmetId, hizmet);
  }

  const uzmanListesi = [...uzmanlar.values()].sort(uzmanSirala);
  const hizmetListesi = [...hizmetler.values()].sort(
    (a, b) => b.ciroKurus - a.ciroKurus || b.seansSayisi - a.seansSayisi,
  );

  return {
    uzmanlar: uzmanListesi,
    hizmetler: hizmetListesi,
    toplamSeans: uzmanListesi.reduce((t, u) => t + u.seansSayisi, 0),
    toplamCiro: uzmanListesi.reduce((t, u) => t + u.ciroKurus, 0),
    toplamGelmedi: uzmanListesi.reduce((t, u) => t + u.gelmedi, 0),
    toplamIptal: uzmanListesi.reduce((t, u) => t + u.iptal, 0),
    toplamPlanlanan: uzmanListesi.reduce((t, u) => t + u.planlanan, 0),
  };
}

/**
 * Raporun CSV karşılığı.
 *
 * Excel'in Türkçe yerelde beklediği AYIRAÇ NOKTALI VİRGÜL: virgülle
 * ayrılmış dosyada "1.234,50" gibi bir tutar iki hücreye bölünür. Tutar da
 * bu yüzden ondalık virgülle yazılıyor — Excel'in kendi biçimi.
 *
 * BOM (﻿) şart: Excel BOM'suz UTF-8 dosyayı Windows-1254 sanıyor ve
 * "Büşra" adı "BÃ¼ÅŸra" olarak açılıyor.
 */
export function ciroCsv(
  rapor: CiroRaporu,
  baslik: { aralik: string; sube: string },
): string {
  const kurusMetni = (kurus: number) =>
    (kurus / 100).toFixed(2).replace(".", ",");

  // Alan içinde noktalı virgül veya tırnak varsa kaçış gerekir; uzman
  // adları serbest metin.
  const alan = (deger: string) =>
    /[";\n]/.test(deger) ? `"${deger.replace(/"/g, '""')}"` : deger;

  const satirlar = [
    [`Randevu ciro raporu`],
    [`Şube`, baslik.sube],
    [`Aralık`, baslik.aralik],
    [],
    ["Uzman", "Seans", "Ciro (₺)", "Gelmedi", "İptal", "Planlanan"],
    ...rapor.uzmanlar.map((uzman) => [
      uzman.uzmanAdi,
      String(uzman.seansSayisi),
      kurusMetni(uzman.ciroKurus),
      String(uzman.gelmedi),
      String(uzman.iptal),
      String(uzman.planlanan),
    ]),
    [
      "TOPLAM",
      String(rapor.toplamSeans),
      kurusMetni(rapor.toplamCiro),
      String(rapor.toplamGelmedi),
      String(rapor.toplamIptal),
      String(rapor.toplamPlanlanan),
    ],
    [],
    ["Hizmet", "Seans", "Ciro (₺)"],
    ...rapor.hizmetler.map((hizmet) => [
      hizmet.hizmetAdi,
      String(hizmet.seansSayisi),
      kurusMetni(hizmet.ciroKurus),
    ]),
  ];

  return (
    "﻿" + satirlar.map((satir) => satir.map(alan).join(";")).join("\r\n")
  );
}
