/**
 * Kulüp takvimi planlayıcısı — bilerek bağımlılıksız (`mufredat.ts` deseni).
 *
 * Kulübün hafta kavramı, `Club.weekDates` dizisindeki 1 tabanlı SIRADIR;
 * müfredat girdileri ve oturumlar haftaya bu sırayla bağlanır. Takvimden gün
 * eklemek/silmek/taşımak bu sırayı değiştirir — şemadaki uyarının konusu:
 * müfredat tarihle değil sırayla kayar. Buradaki planlar o kaymayı GÖRÜNÜR ve
 * UYGULANABİLİR yapar: hangi haftanın hangi numaraya taşınacağı hesaplanır,
 * eylem katmanı oturumları ve müfredat girdilerini BİRLİKTE kaydırır; konu,
 * kendi gününü takip eder.
 *
 * Fonksiyonlar saf: tarih listesi alır, plan döner; veritabanı yok, test
 * `kulup-takvimi.test.ts`te.
 */

/** Bir haftanın numara değişimi: `eski` numaralı hafta `yeni` numara olur. */
export type HaftaKaymasi = { eski: number; yeni: number };

export type GunEklemePlani = {
  /** Yeni gün dahil, tarih sırasına dizilmiş yeni takvim. */
  yeniTarihler: Date[];
  /** Eklenen günün yeni takvimdeki hafta numarası. */
  haftaNo: number;
  /** Numarası değişen MEVCUT haftalar (eklenen gün hariç). */
  kaymalar: HaftaKaymasi[];
};

export type GunSilmePlani = {
  yeniTarihler: Date[];
  /** Silinen günün eski takvimdeki hafta numarası. */
  haftaNo: number;
  kaymalar: HaftaKaymasi[];
};

export type GunTasimaPlani = {
  yeniTarihler: Date[];
  /** Taşınan günün eski takvimdeki numarası. */
  eskiHaftaNo: number;
  /** Taşınan günün yeni takvimdeki numarası. */
  yeniHaftaNo: number;
  /** Numarası değişen DİĞER haftalar (taşınan gün hariç). */
  kaymalar: HaftaKaymasi[];
};

function sirala(tarihler: readonly Date[]): Date[] {
  return [...tarihler].sort((a, b) => a.getTime() - b.getTime());
}

function pozisyon(sirali: readonly Date[], tarih: Date): number {
  return sirali.findIndex((t) => t.getTime() === tarih.getTime()) + 1;
}

/**
 * Takvime gün ekleme planı. Sonrasındaki haftaların numarası bir artar;
 * araya giren gün mevcut müfredatı "sahiplenmez", boş bir hafta olarak açılır.
 */
export function gunEklemePlani(
  mevcut: readonly Date[],
  tarih: Date,
): { hata: string } | GunEklemePlani {
  const sirali = sirala(mevcut);
  if (pozisyon(sirali, tarih) > 0) {
    return { hata: "Bu tarih kulüp takviminde zaten var." };
  }

  const yeniTarihler = sirala([...sirali, tarih]);
  const haftaNo = pozisyon(yeniTarihler, tarih);

  const kaymalar: HaftaKaymasi[] = [];
  for (let no = haftaNo; no <= sirali.length; no += 1) {
    kaymalar.push({ eski: no, yeni: no + 1 });
  }

  return { yeniTarihler, haftaNo, kaymalar };
}

/**
 * Takvimden gün silme planı. Silinen haftanın müfredatı ve oturumları eylem
 * katmanında silinir; sonraki haftaların numarası bir azalır.
 */
export function gunSilmePlani(
  mevcut: readonly Date[],
  tarih: Date,
): { hata: string } | GunSilmePlani {
  const sirali = sirala(mevcut);
  const haftaNo = pozisyon(sirali, tarih);
  if (haftaNo === 0) {
    return { hata: "Bu tarih kulüp takviminde yok." };
  }
  if (sirali.length === 1) {
    return { hata: "Kulübün tek günü silinemez; önce yeni bir gün ekleyin." };
  }

  const yeniTarihler = sirali.filter(
    (t) => t.getTime() !== tarih.getTime(),
  );

  const kaymalar: HaftaKaymasi[] = [];
  for (let no = haftaNo + 1; no <= sirali.length; no += 1) {
    kaymalar.push({ eski: no, yeni: no - 1 });
  }

  return { yeniTarihler, haftaNo, kaymalar };
}

/**
 * Bir günü başka tarihe taşıma planı. Gün, tarih sırasında yer değiştirirse
 * aradaki haftalar bir kayar; haftanın müfredatı ve oturumları (puanlamalar
 * dahil) yeni numarasıyla BİRLİKTE gider — konu, kendi gününü takip eder.
 */
export function gunTasimaPlani(
  mevcut: readonly Date[],
  eski: Date,
  yeni: Date,
): { hata: string } | GunTasimaPlani {
  if (eski.getTime() === yeni.getTime()) {
    return { hata: "Tarih zaten aynı." };
  }

  const sirali = sirala(mevcut);
  const eskiHaftaNo = pozisyon(sirali, eski);
  if (eskiHaftaNo === 0) {
    return { hata: "Taşınacak tarih kulüp takviminde yok." };
  }
  if (pozisyon(sirali, yeni) > 0) {
    return { hata: "Hedef tarih kulüp takviminde zaten var." };
  }

  const yeniTarihler = sirala([
    ...sirali.filter((t) => t.getTime() !== eski.getTime()),
    yeni,
  ]);
  const yeniHaftaNo = pozisyon(yeniTarihler, yeni);

  // Taşınan gün dışındaki her tarihin eski ve yeni pozisyonu karşılaştırılır;
  // yalnızca gerçekten yer değiştirenler plana girer.
  const kaymalar: HaftaKaymasi[] = [];
  for (const tarih of sirali) {
    if (tarih.getTime() === eski.getTime()) continue;
    const eskiNo = pozisyon(sirali, tarih);
    const yeniNo = pozisyon(yeniTarihler, tarih);
    if (eskiNo !== yeniNo) kaymalar.push({ eski: eskiNo, yeni: yeniNo });
  }

  return { yeniTarihler, eskiHaftaNo, yeniHaftaNo, kaymalar };
}
