import type { Metadata } from "next";
import Link from "next/link";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { BosDurum, Kart, Rozet, SayfaBasligi, baglantiStili } from "@/components/ui";
import { dashboardVerisi } from "@/lib/dashboard-verisi";
import { grupZamani, tarihBicimle, tarihGunleBicimle } from "@/lib/tarih";
import { BolumBasligi, DurumOgesi, IsKarti } from "./dashboard-kartlari";

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
 * Sayıların nasıl üretildiği `lib/dashboard-verisi.ts`'te; bu dosya yalnızca
 * çizer. Kart bileşenleri `dashboard-kartlari.tsx`'te.
 */
export default async function KoordinatorDashboard() {
  const kullanici = await yonetimZorunlu();

  // Dashboard'un kendisi modülsüz (panele giren herkes açar) ama içindeki
  // kartlar modüllere bağlı: yetkisi olmayan modülün görev kartı gösterilmez
  // ve SORGUSU HİÇ ATILMAZ (danışma görevlisi puanlama/rapor verisi çekmez).
  // Tıklanınca guard'a çarpıp geri atılan bir kart, görev değil tuzaktır.
  const puanlamaGorebilir = kullanici.yetkiler.puanlamalar !== "YOK";
  const raporGorebilir = kullanici.yetkiler.raporlar !== "YOK";
  const adayGorebilir = kullanici.yetkiler.adaylar !== "YOK";

  const {
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
  } = await dashboardVerisi({
    subeId: kullanici.aktifSubeId,
    puanlamaGorebilir,
    raporGorebilir,
    adayGorebilir,
  });

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
          {/* §16.6 — Danışmanın günlük kuyruğu; masanın ilk işi bu.
              Gecikmişler ayrı KART değil alt bilgi: ikisi de aynı kuyruğun
              parçası, ayrı kart aynı işi iki kez saydırırdı. */}
          {adayGorebilir ? (
            <>
              <IsKarti
                baslik="Aranacak aday"
                deger={aranacakAdaySayisi}
                birim="aday"
                altBilgi={
                  aranacakAdaySayisi > 0
                    ? gecikmisAdaySayisi > 0
                      ? `${gecikmisAdaySayisi} tanesi gecikmiş.`
                      : "Bugüne ayarlı takipler."
                    : "Bugünün aramaları tamam."
                }
                yol="/koordinator/adaylar?kapsam=bugun"
              />
              <IsKarti
                baslik="Dokunulmamış yeni aday"
                deger={dokunulmamisAdaySayisi}
                birim="aday"
                altBilgi={
                  dokunulmamisAdaySayisi > 0
                    ? "Reklamdan gelen aday ilk gün aranmalı."
                    : "Bütün yeni adaylara dokunuldu."
                }
                yol="/koordinator/adaylar?asama=YENI"
              />
            </>
          ) : null}
          {puanlamaGorebilir ? (
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
          ) : null}
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
          {raporGorebilir ? (
            <IsKarti
              baslik="Güncelliğini yitiren rapor"
              deger={guncelOlmayanRaporlar.length}
              birim="rapor"
              altBilgi={
                guncelOlmayanRaporlar.length > 0
                  ? "Rapor üretildikten sonra puanlar değişti."
                  : "Bütün raporlar güncel."
              }
              // Raporların ayrı bir listesi yok — rapor öğrenciye ait bir
              // belge ve öğrencinin sayfasında yönetiliyor. Bu yüzden kart
              // aşağıdaki bölüme iniyor; iş yoksa gidilecek yer de yok.
              yol={
                guncelOlmayanRaporlar.length > 0 ? "#eski-raporlar" : undefined
              }
            />
          ) : null}
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
                      className="kil-satir flex h-full flex-col gap-1 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600"
                    >
                      <span className="text-sm font-medium text-zinc-900">
                        {grup.programAdi} · {grup.ad}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {grupZamani(grup.gunler, grup.zamanDilimi)} ·{" "}
                        {grup.atolyeSayisi} atölye · {grup.ogrenciSayisi}/
                        {grup.kapasite} öğrenci
                      </span>
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
          {/* Görev değil bağlam: huninin üst ucu ne kadar dolu. */}
          {adayGorebilir ? (
            <DurumOgesi
              baslik="Açık aday"
              deger={acikAdaySayisi}
              yol="/koordinator/adaylar"
            />
          ) : null}
          {/* Raporların tek listesi yok; sayı bağlam bilgisi olarak duruyor. */}
          {raporGorebilir ? (
            <DurumOgesi baslik="Toplam rapor" deger={toplamRaporSayisi} />
          ) : null}
        </Kart>
      </section>

      {/* --- Eksik puanlamalar --- */}
      {puanlamaGorebilir ? (
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
      ) : null}

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
      {raporGorebilir ? (
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
      ) : null}
    </div>
  );
}
