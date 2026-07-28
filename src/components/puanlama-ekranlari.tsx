import Link from "next/link";
import { BosDurum, Kart, Rozet } from "@/components/ui";
import {
  PuanlamaFormu,
  PuanlamaOlcegi,
} from "@/app/stajyer/puanlama/puanlama-formu";
import type {
  GunFormlari,
  KayitIlerlemesi,
  PuanlamaKaydi,
} from "@/lib/puanlama-verisi";
import type { GorevOzeti } from "@/lib/puanlama";
import { grupZamani, tarihGunleBicimle } from "@/lib/tarih";

/**
 * Puanlama ekranlarının ortak parçaları.
 *
 * Stajyer paneli ile koordinatörün puanlama modülü aynı ekranları gösterir;
 * fark yalnızca hangi kayıtların listelendiği ve formun düzenlenebilir olup
 * olmadığıdır. Bu yüzden görünüm burada tek yerde durur, iki panel de aynı
 * bileşenleri kendi verisiyle çağırır.
 */

export function IlerlemeCubugu({ ozet }: { ozet: GorevOzeti }) {
  const tamamlanan = ozet.dolduruldu + ozet.katilmadi;
  const yuzde = ozet.toplam > 0 ? (tamamlanan / ozet.toplam) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {tamamlanan}/{ozet.toplam} form
        </span>
        {ozet.bekleyen > 0 ? (
          <span className="font-medium text-amber-700">
            {ozet.bekleyen} bekliyor
          </span>
        ) : ozet.toplam > 0 ? (
          <span className="font-medium text-emerald-700">Tamam</span>
        ) : (
          <span>Yapılmış oturum yok</span>
        )}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={ozet.bekleyen > 0 ? "h-full bg-amber-500" : "h-full bg-emerald-500"}
          style={{ width: `${yuzde}%` }}
        />
      </div>
    </div>
  );
}

/** Kayıt listesi — stajyerin öğrencileri ve koordinatörün puanlama listesi. */
export function KayitListesi({
  ilerlemeler,
  temelYol,
  ogrenciYolu,
}: {
  ilerlemeler: KayitIlerlemesi[];
  /** Kayıt detayının kök yolu: "/stajyer/puanlama" veya "/koordinator/puanlamalar". */
  temelYol: string;
  /** Koordinatörde öğrenci profiline bağlantı verilir; stajyerde verilmez. */
  ogrenciYolu?: string;
}) {
  return (
    <div className="space-y-2">
      {ilerlemeler.map((ilerleme) => (
        <Kart key={ilerleme.kayit.id} className="p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_16rem] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`${temelYol}/${ilerleme.kayit.id}`}
                  className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                >
                  {ilerleme.kayit.ogrenciAdi}
                </Link>
                <Rozet>{ilerleme.kayit.programTuru}</Rozet>
                {!ilerleme.kayit.aktif ? <Rozet tur="pasif">İptal</Rozet> : null}
                {ilerleme.ozet.bekleyen > 0 ? (
                  <Rozet tur="uyari">
                    {ilerleme.ozet.bekleyen} form bekliyor
                  </Rozet>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                {ilerleme.kayit.program} · {ilerleme.kayit.grupAdi} ·{" "}
                {grupZamani(ilerleme.kayit.gun, ilerleme.kayit.zamanDilimi)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Sorumlu stajyer: {ilerleme.kayit.stajyerAdi ?? "Atanmamış"}
                {ogrenciYolu ? (
                  <>
                    {" · "}
                    <Link
                      href={`${ogrenciYolu}/${ilerleme.kayit.ogrenciId}`}
                      className="text-marka-700 hover:underline"
                    >
                      Öğrenci profili
                    </Link>
                  </>
                ) : null}
              </p>
            </div>

            <div className="space-y-2">
              <IlerlemeCubugu ozet={ilerleme.ozet} />
              {ilerleme.bekleyenGun ? (
                <Link
                  href={`${temelYol}/${ilerleme.kayit.id}/${ilerleme.bekleyenGun.tarihAnahtari}`}
                  className="inline-flex text-sm text-marka-700 hover:underline"
                >
                  {tarihGunleBicimle(ilerleme.bekleyenGun.tarih)} gününü doldur →
                </Link>
              ) : null}
            </div>
          </div>
        </Kart>
      ))}
    </div>
  );
}

/** Bir kaydın günleri — hangi gün kaç form bekliyor. */
export function GunListesi({
  gunler,
  temelYol,
}: {
  gunler: GunFormlari[];
  /** "/stajyer/puanlama/<kayitId>" gibi. */
  temelYol: string;
}) {
  if (gunler.length === 0) {
    return (
      <BosDurum
        baslik="Bu kayda ait oturum yok."
        aciklama="Grup açıldığında oturumlar otomatik üretilir."
      />
    );
  }

  return (
    <div className="space-y-2">
      {gunler.map((gun) => (
        <Kart key={gun.tarihAnahtari} className="p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_16rem] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {gun.puanlanabilir ? (
                  <Link
                    href={`${temelYol}/${gun.tarihAnahtari}`}
                    className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                  >
                    {tarihGunleBicimle(gun.tarih)}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-500">
                    {tarihGunleBicimle(gun.tarih)}
                  </span>
                )}
                {gun.haftaNumarasi ? (
                  <Rozet>{gun.haftaNumarasi}. hafta</Rozet>
                ) : null}
                {!gun.puanlanabilir ? <Rozet tur="pasif">Yaklaşan</Rozet> : null}
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                {gun.formlar.map((form) => form.atolyeAdi).join(" · ")}
              </p>
            </div>

            {gun.puanlanabilir ? (
              <IlerlemeCubugu ozet={gun.ozet} />
            ) : (
              <p className="text-xs text-zinc-500">
                Oturum günü geldiğinde formlar açılır.
              </p>
            )}
          </div>
        </Kart>
      ))}
    </div>
  );
}

/** §10.1 — Bir günün bütün atölye formları alt alta. */
export function GunFormEkrani({
  kayit,
  gun,
  duzenlenebilir,
  guvenlikUyarisiniGoster,
}: {
  kayit: PuanlamaKaydi;
  gun: GunFormlari;
  duzenlenebilir: boolean;
  /** §3.2 — Stajyere yalnızca kısa güvenlik uyarısı gösterilir. */
  guvenlikUyarisiniGoster: boolean;
}) {
  return (
    <div className="space-y-4">
      {guvenlikUyarisiniGoster && kayit.guvenlikUyarisi ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">Güvenlik uyarısı</p>
          <p className="mt-1 text-sm text-amber-900">{kayit.guvenlikUyarisi}</p>
        </div>
      ) : null}

      {!kayit.aktif ? (
        <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
          Bu kayıt iptal edilmiş. Girilmiş puanlamalar korunur ama yeni
          puanlama yapılamaz.
        </div>
      ) : null}

      <PuanlamaOlcegi />

      {gun.formlar.map((form) => (
        <PuanlamaFormu
          key={form.oturumId}
          kayitId={kayit.id}
          form={{
            oturumId: form.oturumId,
            atolyeAdi: form.atolyeAdi,
            durum: form.durum,
            attended: form.attended,
            ortalama: form.ortalama,
            satirlar: form.satirlar,
            puanlanabilir: form.puanlanabilir,
            puanlayan: form.puanlayan,
          }}
          duzenlenebilir={duzenlenebilir && kayit.aktif}
        />
      ))}
    </div>
  );
}
