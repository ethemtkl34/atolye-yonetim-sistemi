import { db } from "@/lib/db";
import {
  acikAdayKosulu,
  bugunAranacakKosulu,
  dokunulmamisAdayKosulu,
  gecikmisAdayKosulu,
} from "@/lib/aday-durumlari";
import {
  AKTIF_DONEM_KOSULU,
  AKTIF_KULUP_KOSULU,
  aktifGrupKosulu,
  aktifOgrenciKosulu,
  atanmamisKayitKosulu,
} from "@/lib/durumlar";
import { kayitIlerlemeleri } from "@/lib/puanlama-verisi";
import { raporOzetleri } from "@/lib/rapor-verisi";
import { kontenjanDurumu } from "@/lib/kayit-kurallari";
import { bugun, gunEkle, tarihMetni } from "@/lib/tarih";
import type { Day, TimeSlot } from "@/generated/prisma/enums";

/**
 * §12.1 — Dashboard'un bütün verisi tek çağrıda.
 *
 * Sorgular sayfadan buraya taşındı: sayfa yalnızca render eder, sayılar
 * nasıl üretiliyor sorusunun tek cevabı bu dosyadır (`puanlama-verisi.ts`
 * ve `rapor-verisi.ts` desenlerinin devamı).
 *
 * Değişmeyen sözleşme: her sayı, tıklanınca açılan listenin kendi sorgusuyla
 * aynı koşuldan üretilir. Koşullar `lib/durumlar.ts` içinde tek yerde
 * tanımlı; kartta yazan sayı ile listenin uzunluğu birebir aynı kalır.
 * Sözleşme şubeli yapıda da geçerli: bütün sayılar AKTİF ŞUBE içindir
 * ("aktif dönem" ve "aktif kulüp" istisna — program tanımı iki şubede ortak).
 *
 * Yetki bayrakları sorguyu da kapatır: yetkisi olmayan modülün verisi HİÇ
 * ÇEKİLMEZ (danışma görevlisi puanlama/rapor verisi çekmez).
 */
export async function dashboardVerisi({
  subeId,
  puanlamaGorebilir,
  raporGorebilir,
  adayGorebilir,
}: {
  subeId: string;
  puanlamaGorebilir: boolean;
  raporGorebilir: boolean;
  adayGorebilir: boolean;
}) {
  const bugunkuTarih = bugun();

  const [
    aktifDonemSayisi,
    aktifKulupSayisi,
    aktifGruplar,
    aktifOgrenciSayisi,
    atanmamisKayitSayisi,
    ilerlemeler,
    raporlar,
    toplamRaporSayisi,
    yaklasanOturumlar,
    aranacakAdaySayisi,
    gecikmisAdaySayisi,
    dokunulmamisAdaySayisi,
    acikAdaySayisi,
  ] = await Promise.all([
    db.term.count({ where: AKTIF_DONEM_KOSULU }),
    db.club.count({ where: AKTIF_KULUP_KOSULU }),
    db.group.findMany({
      where: aktifGrupKosulu(subeId),
      select: {
        id: true,
        name: true,
        days: true,
        timeSlot: true,
        capacity: true,
        term: { select: { id: true, name: true } },
        club: { select: { id: true, name: true } },
        _count: { select: { enrollments: { where: { status: "AKTIF" } } } },
      },
    }),
    // §12.1 — "Toplam aktif öğrenci": aktif programlarda kaydı olan farklı
    // öğrenci sayısı. Aynı öğrencinin iki kaydı varsa bir kez sayılır.
    db.student.count({ where: aktifOgrenciKosulu(subeId) }),
    db.enrollment.count({ where: atanmamisKayitKosulu(subeId) }),
    puanlamaGorebilir
      ? kayitIlerlemeleri({
          subeId,
          yalnizcaAktif: true,
          yalnizcaAktifProgram: true,
        })
      : [],
    raporGorebilir ? raporOzetleri({ subeId }) : [],
    // "Toplam rapor" listeden değil count'tan: raporOzetleri en yeni 200
    // satırla sınırlı, kart ise gerçek toplamı söylemeli.
    raporGorebilir
      ? db.report.count({ where: { student: { branchId: subeId } } })
      : 0,
    // Yaklaşan oturumlar grup ve gün bazında toplanır: bir grubun bir günde
    // 5 (dönem) veya 3 (kulüp) atölyesi var, satır satır çekmeye gerek yok.
    db.session.groupBy({
      by: ["date", "groupId"],
      where: { date: { gte: bugunkuTarih }, group: aktifGrupKosulu(subeId) },
      orderBy: [{ date: "asc" }],
      _count: { _all: true },
      take: 60,
    }),
    // §16.6 — Aday kuyruğu. Koşullar `aday-durumlari.ts`'ten: kartta yazan
    // sayı, tıklanınca açılan listenin uzunluğuyla birebir aynı.
    adayGorebilir
      ? db.lead.count({ where: bugunAranacakKosulu(subeId, bugunkuTarih) })
      : 0,
    adayGorebilir
      ? db.lead.count({ where: gecikmisAdayKosulu(subeId, bugunkuTarih) })
      : 0,
    adayGorebilir
      ? db.lead.count({ where: dokunulmamisAdayKosulu(subeId) })
      : 0,
    adayGorebilir ? db.lead.count({ where: acikAdayKosulu(subeId) }) : 0,
  ]);

  const dolanGruplar = aktifGruplar.filter(
    (grup) => kontenjanDurumu(grup.capacity, grup._count.enrollments).dolu,
  );

  // En eski bekleyen gün başta: gecikmiş form, dün yapılmış atölyenin
  // formundan daha acil. Önceki sürüm kaydın oluşturulma tarihine göre
  // sıralıyordu — listenin başındaki satırın en acil olduğuna dair hiçbir
  // güvence yoktu.
  const eksikPuanlamalar = ilerlemeler
    .filter((ilerleme) => ilerleme.ozet.bekleyen > 0)
    .sort(
      (a, b) =>
        (a.bekleyenGun?.tarih.getTime() ?? 0) -
        (b.bekleyenGun?.tarih.getTime() ?? 0),
    );
  const bekleyenFormSayisi = eksikPuanlamalar.reduce(
    (toplam, ilerleme) => toplam + ilerleme.ozet.bekleyen,
    0,
  );
  const enEskiBekleyen = eksikPuanlamalar.at(0)?.bekleyenGun?.tarih ?? null;

  const guncelOlmayanRaporlar = raporlar.filter((rapor) => !rapor.guncel);
  const sonRaporlar = raporlar.slice(0, 5);

  const haftaSonu = yaklasanHaftaSonu(yaklasanOturumlar, aktifGruplar);

  const bekleyenBasliklar = [
    ...(puanlamaGorebilir ? [bekleyenFormSayisi] : []),
    atanmamisKayitSayisi,
    dolanGruplar.length,
    ...(raporGorebilir ? [guncelOlmayanRaporlar.length] : []),
    ...(adayGorebilir ? [aranacakAdaySayisi, dokunulmamisAdaySayisi] : []),
  ].filter((sayi) => sayi > 0).length;

  return {
    aktifDonemSayisi,
    aktifKulupSayisi,
    aktifGruplar,
    aktifOgrenciSayisi,
    atanmamisKayitSayisi,
    toplamRaporSayisi,
    dolanGruplar,
    eksikPuanlamalar,
    bekleyenFormSayisi,
    enEskiBekleyen,
    guncelOlmayanRaporlar,
    sonRaporlar,
    haftaSonu,
    bekleyenBasliklar,
    aranacakAdaySayisi,
    gecikmisAdaySayisi,
    dokunulmamisAdaySayisi,
    acikAdaySayisi,
  };
}

export type HaftaSonuGrubu = {
  id: string;
  ad: string;
  programAdi: string;
  gunler: Day[];
  zamanDilimi: TimeSlot;
  kapasite: number;
  ogrenciSayisi: number;
  atolyeSayisi: number;
  yol: string;
};

export type HaftaSonuGunu = {
  tarih: Date;
  tarihAnahtari: string;
  bugunMu: boolean;
  gruplar: HaftaSonuGrubu[];
};

type AktifGrup = {
  id: string;
  name: string;
  days: Day[];
  timeSlot: TimeSlot;
  capacity: number;
  term: { id: string; name: string } | null;
  club: { id: string; name: string } | null;
  _count: { enrollments: number };
};

/**
 * Yaklaşan eğitim günlerini bulur: en yakın oturumdan başlayan 7 günlük
 * pencere.
 *
 * Tek bir "en yakın tarih" yetmiyor: farklı gruplar farklı günlerde
 * toplanıyor, yalnızca en yakın tarihi göstermek diğerlerini görünmez
 * bırakırdı.
 *
 * Pencere TAKVİM HAFTASI değil, en yakın oturumdan itibaren 7 gün. Takvim
 * haftası denendi ve hafta içi programlarla birlikte şu tuhaflığı üretti:
 * pazar günü bakıldığında pencere o gün bitiyor ve ertesi sabah başlayan
 * dersler panelde hiç görünmüyordu. Panelin cevapladığı soru "sırada ne var",
 * "bu takvim haftasında ne vardı" değil.
 */
function yaklasanHaftaSonu(
  oturumlar: { date: Date; groupId: string; _count: { _all: number } }[],
  gruplar: AktifGrup[],
): { gunler: HaftaSonuGunu[]; gruplar: HaftaSonuGrubu[] } | null {
  if (oturumlar.length === 0) return null;

  const enYakin = oturumlar.reduce((a, b) =>
    a.date.getTime() <= b.date.getTime() ? a : b,
  ).date;

  // Sorgu zaten `date >= bugün` süzüyor, dolayısıyla en yakın oturum bugün ya
  // da sonrası. Pencere oradan başlayıp 7 günü kapsıyor.
  const baslangic = enYakin.getTime();
  const sinir = gunEkle(enYakin, 6).getTime();

  const grupHaritasi = new Map(gruplar.map((grup) => [grup.id, grup]));
  const bugunAnahtari = tarihMetni(bugun());
  const gunHaritasi = new Map<string, HaftaSonuGunu>();
  const tumGruplar: HaftaSonuGrubu[] = [];

  for (const oturum of oturumlar) {
    const zaman = oturum.date.getTime();
    if (zaman < baslangic || zaman > sinir) continue;

    const grup = grupHaritasi.get(oturum.groupId);
    if (!grup) continue;

    const satir: HaftaSonuGrubu = {
      id: grup.id,
      ad: grup.name,
      programAdi: grup.term?.name ?? grup.club?.name ?? "Program",
      gunler: grup.days,
      zamanDilimi: grup.timeSlot,
      kapasite: grup.capacity,
      ogrenciSayisi: grup._count.enrollments,
      atolyeSayisi: oturum._count._all,
      yol: grup.term
        ? `/koordinator/donemler/${grup.term.id}`
        : `/koordinator/kulupler/${grup.club?.id}`,
    };

    const anahtar = tarihMetni(oturum.date);
    const mevcut = gunHaritasi.get(anahtar);

    if (mevcut) {
      mevcut.gruplar.push(satir);
    } else {
      gunHaritasi.set(anahtar, {
        tarih: oturum.date,
        tarihAnahtari: anahtar,
        bugunMu: anahtar === bugunAnahtari,
        gruplar: [satir],
      });
    }

    tumGruplar.push(satir);
  }

  if (tumGruplar.length === 0) return null;

  const gunler = [...gunHaritasi.values()]
    .sort((a, b) => a.tarih.getTime() - b.tarih.getTime())
    .map((gun) => ({
      ...gun,
      gruplar: gun.gruplar.sort((a, b) =>
        `${a.programAdi} ${a.ad}`.localeCompare(
          `${b.programAdi} ${b.ad}`,
          "tr",
        ),
      ),
    }));

  return { gunler, gruplar: tumGruplar };
}
