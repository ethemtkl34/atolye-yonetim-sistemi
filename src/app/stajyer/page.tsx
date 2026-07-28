import type { Metadata } from "next";
import Link from "next/link";
import { stajyerZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi } from "@/components/ui";
import { IlerlemeCubugu } from "@/components/puanlama-ekranlari";
import {
  doldurulmusFormlar,
  kayitIlerlemeleri,
  type KayitIlerlemesi,
} from "@/lib/puanlama-verisi";
import { ortalamaBicimle } from "@/lib/scoring";
import { tarihBicimle, tarihGunleBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Görevlerim",
};

/**
 * §12.3 — Stajyer ana ekranı.
 *
 * Görevler tarihe göre gruplanır çünkü stajyer bir günü baştan sona doldurur:
 * aynı gün aynı öğrencinin beş atölyesi ardışık gelir. Öğrenci bazlı liste
 * "Öğrencilerim" ekranında ayrıca duruyor.
 */
export default async function StajyerPaneli() {
  const kullanici = await stajyerZorunlu();

  const [ilerlemeler, sonFormlar] = await Promise.all([
    kayitIlerlemeleri({ internId: kullanici.id, yalnizcaAktif: true }),
    doldurulmusFormlar({ internId: kullanici.id, enFazla: 5 }),
  ]);

  const gunler = bekleyenGunleriGrupla(ilerlemeler);
  const toplamBekleyen = ilerlemeler.reduce(
    (toplam, ilerleme) => toplam + ilerleme.ozet.bekleyen,
    0,
  );

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik={`Hoş geldiniz, ${kullanici.name}`}
        aciklama={
          ilerlemeler.length === 0
            ? "Size henüz öğrenci atanmadı."
            : toplamBekleyen === 0
              ? "Bekleyen puanlama formunuz yok."
              : `${ilerlemeler.length} öğrenci · ${toplamBekleyen} form bekliyor.`
        }
      />

      {ilerlemeler.length === 0 ? (
        <BosDurum
          baslik="Henüz size atanmış öğrenci yok."
          aciklama="Koordinatör kayıt oluşturup atama yaptığında görevleriniz burada görünecek."
        />
      ) : gunler.length === 0 ? (
        <BosDurum
          baslik="Bekleyen form yok."
          aciklama="Yapılmış bütün atölyelerin formlarını doldurdunuz. Yeni oturum günü geldiğinde görevler burada belirir."
        />
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Doldurulmamış formlar
          </h2>
          {gunler.map((gun) => (
            <div key={gun.tarihAnahtari} className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-700">
                {tarihGunleBicimle(gun.tarih)}
              </h3>
              {gun.satirlar.map((satir) => (
                <Kart key={satir.kayitId} className="p-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_16rem] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/stajyer/puanlama/${satir.kayitId}/${gun.tarihAnahtari}`}
                          className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                        >
                          {satir.ogrenciAdi}
                        </Link>
                        <Rozet tur="uyari">
                          {satir.bekleyen} form bekliyor
                        </Rozet>
                      </div>
                      <p className="mt-1 text-sm text-zinc-600">
                        {satir.program} · {satir.grupAdi}
                      </p>
                    </div>
                    <IlerlemeCubugu ozet={satir.ozet} />
                  </div>
                </Kart>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">
            Son doldurduğunuz formlar
          </h2>
          <Link
            href="/stajyer/formlarim"
            className="text-sm text-marka-700 hover:underline"
          >
            Tümü
          </Link>
        </div>

        {sonFormlar.length === 0 ? (
          <BosDurum baslik="Henüz form doldurmadınız." />
        ) : (
          <Kart className="divide-y divide-yuzey-100">
            {sonFormlar.map((form) => (
              <div
                key={`${form.kayitId}-${form.oturumId}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {form.ogrenciAdi} · {form.atolyeAdi}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {tarihBicimle(form.tarih)} · {form.program}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {form.attended ? (
                    <span className="text-sm text-zinc-700">
                      Ortalama {ortalamaBicimle(form.ortalama)}
                    </span>
                  ) : (
                    <Rozet tur="pasif">Katılmadı</Rozet>
                  )}
                  <Link
                    href={`/stajyer/puanlama/${form.kayitId}/${form.tarihAnahtari}`}
                    className="text-sm text-marka-700 hover:underline"
                  >
                    Düzenle
                  </Link>
                </div>
              </div>
            ))}
          </Kart>
        )}
      </div>
    </div>
  );
}

type GorevGunu = {
  tarih: Date;
  tarihAnahtari: string;
  satirlar: {
    kayitId: string;
    ogrenciAdi: string;
    program: string;
    grupAdi: string;
    bekleyen: number;
    ozet: KayitIlerlemesi["ozet"];
  }[];
};

/**
 * Bekleyen formları güne göre gruplar. En yeni gün başta: stajyer genellikle
 * en son yapılan atölyenin formunu doldurur.
 */
function bekleyenGunleriGrupla(ilerlemeler: KayitIlerlemesi[]): GorevGunu[] {
  const gunler = new Map<string, GorevGunu>();

  for (const ilerleme of ilerlemeler) {
    for (const gun of ilerleme.gunler) {
      if (gun.ozet.bekleyen === 0) continue;

      const mevcut = gunler.get(gun.tarihAnahtari) ?? {
        tarih: gun.tarih,
        tarihAnahtari: gun.tarihAnahtari,
        satirlar: [],
      };

      mevcut.satirlar.push({
        kayitId: ilerleme.kayit.id,
        ogrenciAdi: ilerleme.kayit.ogrenciAdi,
        program: ilerleme.kayit.program,
        grupAdi: ilerleme.kayit.grupAdi,
        bekleyen: gun.ozet.bekleyen,
        ozet: gun.ozet,
      });

      gunler.set(gun.tarihAnahtari, mevcut);
    }
  }

  return [...gunler.values()].sort(
    (a, b) => b.tarih.getTime() - a.tarih.getTime(),
  );
}
