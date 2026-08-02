import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, baglantiStili } from "@/components/ui";
import {
  AKTIF_DONEM_KOSULU,
  AKTIF_KULUP_KOSULU,
  aktifGrupKosulu,
  aktifOgrenciKosulu,
  atanmamisKayitKosulu,
} from "@/lib/durumlar";
import { kayitIlerlemeleri } from "@/lib/puanlama-verisi";
import { raporOzetleri } from "@/lib/rapor-verisi";
import { kontenjanDurumu } from "@/lib/scoring";
import {
  bugun,
  gunEkle,
  grupZamani,
  haftaBasi,
  tarihBicimle,
  tarihGunleBicimle,
  tarihMetni,
} from "@/lib/tarih";
import { cn } from "@/lib/utils";
import type { Day, TimeSlot } from "@/generated/prisma/enums";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * §12.1 — Koordinatör dashboardu.
 *
 * Ekran üç kata ayrılmış durumda ve sıra bilinçli:
 *
 *   1. **Bekleyen işler** — koordinatörün bugün yapması gereken şeyler.
 *      Sağlıklı bir kurumda hepsi sıfırdır; sıfır olmayan her kart bir görev.
 *   2. **Yaklaşan eğitim günleri** — hangi grupların ne zaman toplandığı. Panelde
 *      başka hiçbir ekran "sırada ne var" sorusuna cevap vermiyordu.
 *   3. **Kurumun durumu** — aktif dönem/kulüp/grup/öğrenci sayıları. Bunlar
 *      haftalarca değişmeyen bağlam bilgisi; bu yüzden küçük ve altta.
 *
 * Önceki sürümde sekiz kart aynı boyutta yan yanaydı: "aktif dönem 1" ile
 * "eksik puanlama 12" eşit ağırlıkta görünüyordu, oysa biri neredeyse sabit
 * diğeri günlük işi belirliyor.
 *
 * Değişmeyen sözleşme: her sayı, tıklanınca açılan listenin kendi sorgusuyla
 * aynı koşuldan üretilir. Koşullar `lib/durumlar.ts` içinde tek yerde tanımlı;
 * kartta yazan sayı ile listenin uzunluğu birebir aynı kalır.
 *
 * Sözleşme şubeli yapıda da geçerli: bütün sayılar AKTİF ŞUBE içindir.
 * "Aktif dönem" ve "aktif kulüp" bunun istisnası — program tanımı iki şubede
 * ortak, sayı ikisinde de aynı görünür.
 */
export default async function KoordinatorDashboard() {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

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
    kayitIlerlemeleri({
      subeId,
      yalnizcaAktif: true,
      yalnizcaAktifProgram: true,
    }),
    raporOzetleri({ subeId }),
    // "Toplam rapor" listeden değil count'tan: raporOzetleri en yeni 200
    // satırla sınırlı, kart ise gerçek toplamı söylemeli.
    db.report.count({ where: { student: { branchId: subeId } } }),
    // Yaklaşan oturumlar grup ve gün bazında toplanır: bir grubun bir günde
    // 5 (dönem) veya 3 (kulüp) atölyesi var, satır satır çekmeye gerek yok.
    db.session.groupBy({
      by: ["date", "groupId"],
      where: { date: { gte: bugunkuTarih }, group: aktifGrupKosulu(subeId) },
      orderBy: [{ date: "asc" }],
      _count: { _all: true },
      take: 60,
    }),
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
    bekleyenFormSayisi,
    atanmamisKayitSayisi,
    dolanGruplar.length,
    guncelOlmayanRaporlar.length,
  ].filter((sayi) => sayi > 0).length;

  return (
    <div className="space-y-8">
      <SayfaBasligi
        baslik={`Hoş geldiniz, ${kullanici.name}`}
        aciklama={
          bekleyenBasliklar === 0
            ? "Bekleyen iş yok. Aşağıda yaklaşan eğitim günleri ve kurumun güncel durumu var."
            : `${bekleyenBasliklar} başlıkta işlem bekliyor. Her karta tıklayarak ilgili listeye gidebilirsiniz.`
        }
      />

      {/* --- 1. Bekleyen işler --- */}
      <section className="space-y-3">
        <BolumBasligi
          baslik="Bekleyen işler"
          aciklama="Sıfır olmayan her kart bir görev."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <IsKarti
            baslik="Eksik puanlama"
            deger={bekleyenFormSayisi}
            birim="form"
            altBilgi={
              eksikPuanlamalar.length > 0
                ? `${eksikPuanlamalar.length} kayıtta${
                    enEskiBekleyen
                      ? ` · en eskisi ${tarihBicimle(enEskiBekleyen)}`
                      : ""
                  }`
                : "Yapılmış bütün atölyelerin formu dolduruldu."
            }
            yol="/koordinator/puanlamalar?suzgec=eksik&kapsam=aktif"
          />
          <IsKarti
            baslik="Stajyeri atanmamış kayıt"
            deger={atanmamisKayitSayisi}
            birim="kayıt"
            altBilgi={
              atanmamisKayitSayisi > 0
                ? "Bu kayıtların formlarını kimse dolduramaz."
                : "Aktif kayıtların hepsinin sorumlusu var."
            }
            yol="/koordinator/kayitlar?suzgec=atanmamis"
          />
          <IsKarti
            baslik="Kontenjanı dolan grup"
            deger={dolanGruplar.length}
            birim="grup"
            altBilgi={
              dolanGruplar.length > 0
                ? "Yeni kayıt için grup açılmalı."
                : "Bütün gruplarda yer var."
            }
            yol="/koordinator/gruplar?kapsam=aktif&durum=dolu"
          />
          <IsKarti
            baslik="Güncelliğini yitiren rapor"
            deger={guncelOlmayanRaporlar.length}
            birim="rapor"
            altBilgi={
              guncelOlmayanRaporlar.length > 0
                ? "Rapor üretildikten sonra puanlar değişti."
                : "Bütün raporlar güncel."
            }
            // Raporların ayrı bir listesi yok — rapor öğrenciye ait bir belge
            // ve öğrencinin sayfasında yönetiliyor. Bu yüzden kart aşağıdaki
            // bölüme iniyor; iş yoksa gidilecek yer de yok.
            yol={
              guncelOlmayanRaporlar.length > 0 ? "#eski-raporlar" : undefined
            }
          />
        </div>
      </section>

      {/* --- 2. Yaklaşan eğitim günleri --- */}
      <section className="space-y-3">
        <BolumBasligi
          baslik="Yaklaşan eğitim günleri"
          aciklama={
            haftaSonu
              ? `${haftaSonu.gruplar.length} grup toplanıyor.`
              : undefined
          }
        />
        {!haftaSonu ? (
          <BosDurum
            baslik="Takvimde yaklaşan oturum yok."
            aciklama="Aktif bir dönem veya kulübün takvimi tanımlandığında sıradaki eğitim günleri burada görünür."
          />
        ) : (
          <div className="space-y-3">
            {haftaSonu.gunler.map((gun) => (
              <div key={gun.tarihAnahtari} className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-sm font-medium text-zinc-700">
                    {tarihGunleBicimle(gun.tarih)}
                  </h3>
                  {gun.bugunMu ? <Rozet tur="uyari">Bugün</Rozet> : null}
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {gun.gruplar.map((grup) => (
                    <Link
                      key={grup.id}
                      href={grup.yol}
                      className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600"
                    >
                      <Kart className="flex h-full flex-col gap-1 p-4 transition-colors hover:border-marka-300 hover:bg-marka-50/40">
                        <span className="text-sm font-medium text-zinc-900">
                          {grup.programAdi} · {grup.ad}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {grupZamani(grup.gunler, grup.zamanDilimi)} ·{" "}
                          {grup.atolyeSayisi} atölye · {grup.ogrenciSayisi}/
                          {grup.kapasite} öğrenci
                        </span>
                      </Kart>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- 3. Kurumun durumu --- */}
      <section className="space-y-3">
        <BolumBasligi baslik="Kurumun durumu" />
        <Kart className="grid grid-cols-2 divide-y divide-yuzey-100 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5">
          <DurumOgesi
            baslik="Aktif dönem"
            deger={aktifDonemSayisi}
            yol="/koordinator/donemler?kapsam=aktif"
          />
          <DurumOgesi
            baslik="Aktif kulüp"
            deger={aktifKulupSayisi}
            yol="/koordinator/kulupler?kapsam=aktif"
          />
          <DurumOgesi
            baslik="Aktif grup"
            deger={aktifGruplar.length}
            yol="/koordinator/gruplar?kapsam=aktif&durum=tumu"
          />
          <DurumOgesi
            baslik="Aktif öğrenci"
            deger={aktifOgrenciSayisi}
            yol="/koordinator/ogrenciler?kapsam=aktif"
          />
          {/* Raporların tek listesi yok; sayı bağlam bilgisi olarak duruyor. */}
          <DurumOgesi baslik="Toplam rapor" deger={toplamRaporSayisi} />
        </Kart>
      </section>

      {/* --- Eksik puanlamalar --- */}
      <section className="space-y-3">
        <BolumBasligi
          baslik="En çok gecikmiş puanlamalar"
          yol="/koordinator/puanlamalar?suzgec=eksik&kapsam=aktif"
        />
        {eksikPuanlamalar.length === 0 ? (
          <BosDurum
            baslik={
              aktifGruplar.length === 0
                ? "Aktif programda bekleyen form yok."
                : "Yapılmış bütün atölyelerin formları dolduruldu."
            }
          />
        ) : (
          <Kart className="divide-y divide-yuzey-100">
            {eksikPuanlamalar.slice(0, 5).map((ilerleme) => (
              <div
                key={ilerleme.kayit.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {ilerleme.kayit.ogrenciAdi}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {ilerleme.bekleyenGun
                      ? `${tarihBicimle(ilerleme.bekleyenGun.tarih)} · `
                      : ""}
                    {ilerleme.kayit.program} · {ilerleme.kayit.grupAdi} ·
                    Sorumlu: {ilerleme.kayit.stajyerAdi ?? "Atanmamış"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Rozet tur="uyari">{ilerleme.ozet.bekleyen} form</Rozet>
                  <Link
                    href={`/koordinator/puanlamalar/${ilerleme.kayit.id}`}
                    className={baglantiStili}
                  >
                    Aç
                  </Link>
                </div>
              </div>
            ))}
          </Kart>
        )}
      </section>

      {/* --- Kontenjanı dolan gruplar --- */}
      {dolanGruplar.length > 0 ? (
        <section className="space-y-3">
          <BolumBasligi baslik="Kontenjanı dolan gruplar" />
          <Kart className="divide-y divide-yuzey-100">
            {dolanGruplar.map((grup) => (
              <div
                key={grup.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {grup.term?.name ?? grup.club?.name} · {grup.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {grupZamani(grup.days, grup.timeSlot)} ·{" "}
                    {grup._count.enrollments}/{grup.capacity} öğrenci
                  </p>
                </div>
                <Link
                  href={
                    grup.term
                      ? `/koordinator/donemler/${grup.term.id}`
                      : `/koordinator/kulupler/${grup.club?.id}`
                  }
                  className={baglantiStili}
                >
                  Yeni grup ekle
                </Link>
              </div>
            ))}
          </Kart>
        </section>
      ) : null}

      {/* --- Güncelliğini yitiren raporlar --- */}
      {guncelOlmayanRaporlar.length > 0 ? (
        <section id="eski-raporlar" className="scroll-mt-20 space-y-3">
          <BolumBasligi
            baslik="Güncelliğini yitiren raporlar"
            aciklama="Rapor üretildikten sonra kapsamındaki puanlar değişti. Öğrencinin sayfasından yeniden üretebilirsiniz; eski rapor ve PDF'leri yerinde kalır."
          />
          <Kart className="divide-y divide-yuzey-100">
            {guncelOlmayanRaporlar.map((rapor) => (
              <div
                key={rapor.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {rapor.ogrenciAdi}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {tarihBicimle(rapor.uretimZamani)} ·{" "}
                    {rapor.kapsam.join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Rozet tur="uyari">Güncel değil</Rozet>
                  <Link
                    href={`/koordinator/ogrenciler/${rapor.ogrenciId}?rapor=${rapor.id}`}
                    className={baglantiStili}
                  >
                    Aç
                  </Link>
                </div>
              </div>
            ))}
          </Kart>
        </section>
      ) : null}

      {/* --- Son raporlar --- */}
      <section className="space-y-3">
        {/* Bütün raporların listesi yok: rapor öğrenciye ait bir belge ve
            öğrencinin sayfasında yönetiliyor. Eskiden buradaki "Tümü"
            bağlantısı kaldırılmış bir sayfaya gidip süzgeci düşürüyordu. */}
        <BolumBasligi baslik="Son oluşturulan raporlar" />
        {sonRaporlar.length === 0 ? (
          <BosDurum baslik="Henüz rapor üretilmemiş." />
        ) : (
          <Kart className="divide-y divide-yuzey-100">
            {sonRaporlar.map((rapor) => (
              <div
                key={rapor.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {rapor.ogrenciAdi}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {tarihBicimle(rapor.uretimZamani)} ·{" "}
                    {rapor.kapsam.join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Rozet tur={rapor.guncel ? "olumlu" : "uyari"}>
                    {rapor.guncel ? "Güncel" : "Güncel değil"}
                  </Rozet>
                  <Link
                    href={`/koordinator/ogrenciler/${rapor.ogrenciId}?rapor=${rapor.id}`}
                    className={baglantiStili}
                  >
                    Aç
                  </Link>
                </div>
              </div>
            ))}
          </Kart>
        )}
      </section>
    </div>
  );
}

/** Bölüm başlığı; sağdaki bağlantı verilirse "Tümü" olarak çıkar. */
function BolumBasligi({
  baslik,
  aciklama,
  yol,
}: {
  baslik: string;
  aciklama?: string;
  yol?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{baslik}</h2>
        {aciklama ? (
          <p className="mt-0.5 text-xs text-zinc-500">{aciklama}</p>
        ) : null}
      </div>
      {yol ? (
        <Link href={yol} className={baglantiStili}>
          Tümü
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Bekleyen iş kartı.
 *
 * Sıfır ile sıfır olmayan ayrımı kartın tamamında görünür: iş varsa turuncu
 * şerit, turuncu sayı ve turuncu zemin; yoksa kart sessizleşip yerinde kalır.
 * Kartı gizlemek daha temiz görünürdü ama "0 dolan grup" bilgisi de bir
 * cevaptır ve kartların yer değiştirmesi ekranı okunmaz hale getiriyordu.
 * Turuncu yalnızca şerit ve sayıda; küçük metin için beyaz üstünde kontrastı
 * yetmediğinden başlık ve alt bilgi nötr kalıyor.
 */
function IsKarti({
  baslik,
  deger,
  birim,
  altBilgi,
  yol,
}: {
  baslik: string;
  deger: number;
  birim: string;
  altBilgi: string;
  /**
   * Kartın açtığı liste. Verilmezse kart tıklanamaz olur.
   *
   * Ölü bağlantı vermektense tıklanamaz kart daha dürüst: "Güncelliğini
   * yitiren rapor" kartı bir süre `/koordinator/raporlar?suzgec=eski`
   * adresine gidiyordu ama o sayfa kaldırılmıştı; yönlendirme süzgeci
   * düşürüp kullanıcıyı öğrenci listesine atıyor, "hangi raporlar" sorusu
   * cevapsız kalıyordu.
   */
  yol?: string;
}) {
  const dikkat = deger > 0;

  const govde = (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          dikkat ? "bg-vurgu-600" : "bg-yuzey-200",
        )}
      />
      <p className="text-sm text-zinc-600">{baslik}</p>
      <p aria-hidden className="mt-1 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-3xl font-semibold tabular-nums",
            dikkat ? "text-vurgu-800" : "text-zinc-400",
          )}
        >
          {deger}
        </span>
        <span className="text-xs text-zinc-500">{birim}</span>
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{altBilgi}</p>
    </>
  );

  const temel = cn(
    "relative flex flex-col overflow-hidden rounded-lg border p-4 pl-5 shadow-[0_1px_2px_rgba(91,16,53,0.04)]",
    dikkat ? "border-vurgu-200 bg-vurgu-50" : "border-yuzey-200 bg-white",
  );

  if (!yol) {
    // Tıklanamaz kart imleç değiştirmiyor ve vurgu almıyor: tıklanabilir
    // görünüp hiçbir şey yapmamak, hiç tıklanabilir görünmemekten kötü.
    return (
      <div className={temel} aria-label={`${baslik}: ${deger} ${birim}`}>
        {govde}
      </div>
    );
  }

  return (
    <Link
      href={yol}
      aria-label={`${baslik}: ${deger} ${birim}`}
      className={cn(
        temel,
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600",
        dikkat ? "hover:bg-vurgu-100" : "hover:bg-marka-50",
      )}
    >
      {govde}
    </Link>
  );
}

/** Durum şeridinin tek hücresi — bağlam bilgisi, iş değil. */
function DurumOgesi({
  baslik,
  deger,
  yol,
}: {
  baslik: string;
  deger: number;
  /** Verilmezse hücre tıklanamaz olur — açılacak bir liste yoksa. */
  yol?: string;
}) {
  const govde = (
    <>
      <span className="block text-xs text-zinc-500">{baslik}</span>
      <span className="mt-0.5 block text-xl font-semibold tabular-nums text-marka-800">
        {deger}
      </span>
    </>
  );

  const yerlesim =
    "px-4 py-3 first:rounded-t-lg last:rounded-b-lg sm:first:rounded-l-lg sm:first:rounded-tr-none sm:last:rounded-r-lg sm:last:rounded-bl-none";

  if (!yol) {
    return (
      <div className={yerlesim} aria-label={`${baslik}: ${deger}`}>
        {govde}
      </div>
    );
  }

  return (
    <Link
      href={yol}
      aria-label={`${baslik}: ${deger}`}
      className={cn(
        yerlesim,
        "transition-colors hover:bg-marka-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600",
      )}
    >
      {govde}
    </Link>
  );
}

type HaftaSonuGrubu = {
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

type HaftaSonuGunu = {
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
 * Sıradaki eğitim haftasını bulur.
 *
 * Tek bir "en yakın tarih" yetmiyor: aynı hafta içinde birden çok gün
 * grupları ayrı tarihlerde toplanıyor, yalnızca en yakın tarihi göstermek
 * pazar gruplarını görünmez bırakırdı. Bu yüzden en yakın oturum tarihinin
 * hafta çapası (cumartesi) alınıp o çapa ile ertesi gün birlikte gösterilir.
 */
function yaklasanHaftaSonu(
  oturumlar: { date: Date; groupId: string; _count: { _all: number } }[],
  gruplar: AktifGrup[],
): { gunler: HaftaSonuGunu[]; gruplar: HaftaSonuGrubu[] } | null {
  if (oturumlar.length === 0) return null;

  const enYakin = oturumlar.reduce((a, b) =>
    a.date.getTime() <= b.date.getTime() ? a : b,
  ).date;

  // Yaklaşan eğitim günleri, en yakın oturumun HAFTASI boyunca gösteriliyor.
  // Eskiden yalnızca hafta sonuna (cumartesi + pazar) bakılıyordu; hafta içi
  // programlar gelince pencere haftanın tamamına açıldı — pazartesiden pazara.
  const capa = haftaBasi(enYakin);
  const sinir = gunEkle(capa, 6).getTime();

  const grupHaritasi = new Map(gruplar.map((grup) => [grup.id, grup]));
  const bugunAnahtari = tarihMetni(bugun());
  const gunHaritasi = new Map<string, HaftaSonuGunu>();
  const tumGruplar: HaftaSonuGrubu[] = [];

  for (const oturum of oturumlar) {
    const zaman = oturum.date.getTime();
    if (zaman < capa.getTime() || zaman > sinir) continue;

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
