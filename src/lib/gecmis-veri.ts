/**
 * Geçmişten aktarılan program kuralı.
 *
 * `Term.gecmisVerisi` / `Club.gecmisVerisi` işaretli programlar panel
 * açılmadan önce yaşandı ve kütükten aktarıldı: haftası, oturumu ve puanı yok.
 * Bu yüzden rapor üretemezler — boş bir puan kümesinden çıkan rapor, gerçek
 * arşiv belgesinin yanında ikinci ve yanlış bir belge olurdu.
 *
 * Sorgu tarafındaki karşılığı `durumlar.ts` içindeki `GUNCEL_PROGRAM_GRUBU`;
 * burası okunmuş bir kaydı değerlendiren ve kullanıcıya sebebini söyleyen
 * taraf.
 */

export type GecmisProgramliKayit = {
  group: {
    name: string;
    term: { name: string; gecmisVerisi: boolean } | null;
    club: { name: string; gecmisVerisi: boolean } | null;
  };
};

/** Kayıt, geçmişten aktarılmış bir programa mı ait? */
export function gecmisProgramKaydi(kayit: GecmisProgramliKayit): boolean {
  return Boolean(
    kayit.group.term?.gecmisVerisi || kayit.group.club?.gecmisVerisi,
  );
}

/**
 * Reddetme metni. Program adları tekilleştirilir: bir öğrencinin aynı dönemde
 * iki grubu olabilir, aynı dönem adı iki kez yazılmasın.
 */
export function gecmisProgramHatasi(kayitlar: GecmisProgramliKayit[]): string {
  const adlar = [
    ...new Set(
      kayitlar.map(
        (kayit) => kayit.group.term?.name ?? kayit.group.club?.name ?? "Program",
      ),
    ),
  ].join(", ");
  return (
    `${adlar} geçmişten aktarıldı; puanlaması olmadığı için rapor ` +
    "üretilemez. O dönemin raporu öğrenci profilindeki “Arşiv raporları” " +
    "bölümünde duruyor."
  );
}
