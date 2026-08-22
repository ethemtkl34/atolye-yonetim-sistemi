"use client";

import { useActionState } from "react";
import { Alan, Bildirim, Girdi, Kart, kartBasligiStili } from "@/components/ui";
import { GonderButonu } from "@/components/ui-istemci";
import { KADEMELER } from "@/lib/rapor-bantlari";
import type { EylemDurumu } from "@/lib/formlar";
import type { RaporAyariGorunumu } from "@/lib/rapor-ayarlari";
import { raporAyariniKaydet } from "./actions";

/**
 * §11.2 — Rapor eşiklerinin formu.
 *
 * Her alanın altında NE YAPTIĞI değil, RAPORDA NEYİ DEĞİŞTİRDİĞİ yazıyor:
 * bu sayfayı açan kişi eşik hesabını değil, veliye giden cümleyi düşünüyor.
 *
 * Sayılar virgülle de nokta ile de girilebilir; eylem ikisini de kabul eder.
 */

/** Virgüllü gösterim — panelin geri kalanıyla aynı dil. */
function sayi(deger: number): string {
  return String(deger).replace(".", ",");
}

export function RaporAyarFormu({ ayar }: { ayar: RaporAyariGorunumu }) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    raporAyariniKaydet,
    {},
  );

  // Doğrulama hatasında kullanıcının yazdıkları geri yazılır; ilk açılışta
  // kayıtlı (ya da varsayılan) değerler görünür.
  const deger = (alan: string, mevcut: string) =>
    durum.degerler?.[alan] ?? mevcut;

  return (
    <form action={eylem} className="space-y-6">
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <Kart>
        <h2 className={kartBasligiStili}>Atölye ilgi ve başarı kademeleri</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Atölye düzeyleri akranla kıyaslanmaz; öğrencinin 1–5 ortalaması
          doğrudan bu eşiklere göre kademeye çevrilir.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Alan
            etiket="Yüksek eşiği"
            hata={durum.alanHatalari?.atolyeYuksek}
            ipucu="Bu ortalama ve üstü “Yüksek” sayılır. Yükseltirseniz raporlarda Yüksek kademesi seyrekleşir."
          >
            <Girdi
              name="atolyeYuksek"
              inputMode="decimal"
              defaultValue={deger("atolyeYuksek", sayi(ayar.atolyeYuksek))}
            />
          </Alan>
          <Alan
            etiket="Düşük eşiği"
            hata={durum.alanHatalari?.atolyeDusuk}
            ipucu="Bu ortalamanın altı en alt kademe sayılır; arada kalanlar ortadaki kademeye düşer."
          >
            <Girdi
              name="atolyeDusuk"
              inputMode="decimal"
              defaultValue={deger("atolyeDusuk", sayi(ayar.atolyeDusuk))}
            />
          </Alan>
        </div>
      </Kart>

      <Kart>
        <h2 className={kartBasligiStili}>Beceri alanlarında akran kıyası</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Duygusal, sosyal ve bilişsel beceriler grubun ortalamasıyla
          karşılaştırılır — raporda “yaşıtlarının üzerinde” diyen cümleyi bu
          bölüm belirler.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Alan
            etiket="Kıyas farkı"
            hata={durum.alanHatalari?.gelisimFark}
            ipucu="Öğrenci grubun bu kadar üstündeyse “yaşıtlarının üzerinde”, bu kadar altındaysa “desteklenmesi faydalı” yazılır. Küçültmek her iki uca da daha çok öğrenci taşır."
          >
            <Girdi
              name="gelisimFark"
              inputMode="decimal"
              defaultValue={deger("gelisimFark", sayi(ayar.gelisimFark))}
            />
          </Alan>
          <Alan
            etiket="Kıyas için asgari öğrenci"
            hata={durum.alanHatalari?.kiyasAsgariOgrenci}
            ipucu="Grupta dönem sonu formu dolu bu kadar öğrenci yoksa akran kıyası hiç yapılmaz; kademeler mutlak eşiklere düşer ve rapora bunun uyarısı yazılır. Öğrencinin kendisi de sayılır."
          >
            <Girdi
              name="kiyasAsgariOgrenci"
              inputMode="numeric"
              defaultValue={deger(
                "kiyasAsgariOgrenci",
                String(ayar.kiyasAsgariOgrenci),
              )}
            />
          </Alan>
        </div>
      </Kart>

      <Kart>
        <h2 className={kartBasligiStili}>İlgi–başarı asimetrisi</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Bir atölyede ilgi ile kazanımlara ulaşma düzeyi birbirinden bu kadar
          ayrışırsa rapora ayrı bir yorum kutusu eklenir.
        </p>
        <div className="mt-4 sm:max-w-xs">
          <Alan
            etiket="Asimetri eşiği"
            hata={durum.alanHatalari?.asimetri}
            ipucu="Düşürmek daha çok atölyede asimetri yorumu çıkarır; çok düşük değerler ölçüm gürültüsünü bulgu gibi gösterir."
          >
            <Girdi
              name="asimetri"
              inputMode="decimal"
              defaultValue={deger("asimetri", sayi(ayar.asimetri))}
            />
          </Alan>
        </div>
      </Kart>

      <Kart>
        <h2 className={kartBasligiStili}>Kademelerin veliye yazılan adları</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Bu adlar raporun kademe skalasında ve özet satırlarında geçer. Renk
          ve küre büyüklüğü değişmez; onlar kademenin ikinci okuma kanalı.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Alan
            etiket="En üst kademe"
            hata={durum.alanHatalari?.etiketYuksek}
            ipucu={`Varsayılan: ${KADEMELER.YUKSEK.etiket}`}
          >
            <Girdi
              name="etiketYuksek"
              defaultValue={deger("etiketYuksek", ayar.etiketler.YUKSEK)}
            />
          </Alan>
          <Alan
            etiket="Orta kademe"
            hata={durum.alanHatalari?.etiketOrtalama}
            ipucu={`Varsayılan: ${KADEMELER.ORTALAMA.etiket}`}
          >
            <Girdi
              name="etiketOrtalama"
              defaultValue={deger("etiketOrtalama", ayar.etiketler.ORTALAMA)}
            />
          </Alan>
          <Alan
            etiket="En alt kademe"
            hata={durum.alanHatalari?.etiketDusuk}
            ipucu={`Varsayılan: ${KADEMELER.DUSUK.etiket}. “Gelişmekte” gibi bir ad veliye daha yumuşak okunur.`}
          >
            <Girdi
              name="etiketDusuk"
              defaultValue={deger("etiketDusuk", ayar.etiketler.DUSUK)}
            />
          </Alan>
        </div>
      </Kart>

      <div className="flex flex-wrap items-center gap-3">
        <GonderButonu>Ayarları kaydet</GonderButonu>
        <p className="text-xs text-zinc-500">
          Kayıt yalnızca bundan sonra üretilecek raporlara işler.
        </p>
      </div>
    </form>
  );
}
