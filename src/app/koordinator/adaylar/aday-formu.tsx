"use client";

import Link from "next/link";

import { GonderButonu, Pencere } from "@/components/ui-istemci";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  secimStili,
} from "@/components/ui";
import { ADAY_KAYNAKLARI, ELLE_KAYNAKLAR } from "@/lib/aday-durumlari";
import { useEklemePaneli } from "@/components/bolum-iskeleti";
import { adayEkle, adayGuncelle, type AdayEylemDurumu } from "./actions";

/**
 * §16.6 — Elle aday açma formu.
 *
 * Zorunlu alan yalnız veli adı ve telefon: danışman çoğu zaman TELEFON
 * KONUŞMASININ ORTASINDA kaydı açıyor. Kalan alanlar sonradan doldurulur.
 *
 * Mükerrer uyarısı ENGEL değil: aynı telefon kardeş kaydında meşru olarak
 * tekrar eder. Sunucu benzer kaydı bulunca yazmaz ve uyarıyı buraya taşır;
 * kullanıcı isterse "Yine de kaydet" ile geçer (gizli `zorla` alanı).
 */

export type AdayVarsayilanlari = {
  parentName?: string;
  phone?: string;
  childName?: string;
  childAge?: string;
  email?: string;
  source?: string;
  interestedProgram?: string;
  nextActionDate?: string;
};

function AdayAlanlari({
  durum,
  varsayilanlar,
  yeniKayit,
}: {
  durum: AdayEylemDurumu;
  varsayilanlar: AdayVarsayilanlari;
  /**
   * Yalnız YENİ aday açarken sorulan alanlar: kaynak, ilk not ve sonraki
   * arama tarihi. Düzenlemede üçü de gizli — kaynak bilerek değiştirilemez
   * (`adayDuzenlemeSemasi`), not zaten geçmişe ayrı satır olarak yazılır ve
   * takip tarihinin tek sahibi detaydaki Takip kartıdır. Düzenlemede
   * gösterilseydi hep boş gelir, doldurulunca da `adayGuncelle` onu hiç
   * yazmadığı için sessizce yok sayılırdı — kullanıcı tarihi değiştirdiğini
   * sanırdı.
   */
  yeniKayit: boolean;
}) {
  const h = durum.alanHatalari;
  const deger = (alan: keyof AdayVarsayilanlari) =>
    durum.degerler?.[alan] ?? varsayilanlar[alan];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Alan etiket="Veli adı" hata={h?.parentName}>
          <Girdi
            name="parentName"
            autoFocus
            required
            placeholder="Ayşe Yılmaz"
            defaultValue={deger("parentName")}
          />
        </Alan>

        <Alan etiket="Telefon" hata={h?.phone}>
          <Girdi
            name="phone"
            type="tel"
            inputMode="tel"
            required
            placeholder="0532 111 22 33"
            defaultValue={deger("phone")}
          />
        </Alan>

        <Alan etiket="Öğrenci adı" hata={h?.childName}>
          <Girdi
            name="childName"
            placeholder="Kerem"
            defaultValue={deger("childName")}
          />
        </Alan>

        <Alan
          etiket="Yaş"
          ipucu="Doğum tarihi kayıt açılırken sorulur."
          hata={h?.childAge}
        >
          <Girdi
            name="childAge"
            inputMode="numeric"
            placeholder="7"
            defaultValue={deger("childAge")}
          />
        </Alan>

        {yeniKayit ? (
          <Alan etiket="Kaynak" hata={h?.source}>
            <select
              name="source"
              className={secimStili}
              defaultValue={deger("source") ?? "TELEFON"}
            >
              {ELLE_KAYNAKLAR.map((kaynak) => (
                <option key={kaynak} value={kaynak}>
                  {ADAY_KAYNAKLARI[kaynak]}
                </option>
              ))}
            </select>
          </Alan>
        ) : null}

        <Alan etiket="E-posta" hata={h?.email}>
          <Girdi
            name="email"
            type="email"
            placeholder="veli@ornek.com"
            defaultValue={deger("email")}
          />
        </Alan>

        <Alan etiket="İlgilendiği program" hata={h?.interestedProgram}>
          <Girdi
            name="interestedProgram"
            placeholder="Hafta sonu atölyesi"
            defaultValue={deger("interestedProgram")}
          />
        </Alan>

        {yeniKayit ? (
          <Alan
            etiket="Sonraki arama tarihi"
            ipucu="Boş bırakılırsa aday “bugün aranacaklar” kuyruğuna düşmez."
            hata={h?.nextActionDate}
          >
            <Girdi
              name="nextActionDate"
              type="date"
              defaultValue={deger("nextActionDate")}
            />
          </Alan>
        ) : null}
      </div>

      {yeniKayit ? (
        <Alan etiket="Not" hata={h?.not}>
          <CokSatirli
            name="not"
            rows={2}
            placeholder="Görüşmede konuşulanlar…"
            defaultValue={durum.degerler?.not}
          />
        </Alan>
      ) : null}
    </>
  );
}

/** Benzer kayıt uyarısı — engellemez, gösterir ve geçme yolu sunar. */
function BenzerUyarisi({ durum }: { durum: AdayEylemDurumu }) {
  if (!durum.benzer) return null;

  const yol =
    durum.benzer.tur === "aday"
      ? `/koordinator/adaylar/${durum.benzer.id}`
      : `/koordinator/ogrenciler/${durum.benzer.id}`;

  return (
    <div className="kil-uyari p-3.5 text-sm">
      Bu telefon zaten kayıtlı:{" "}
      <Link href={yol} className="font-semibold underline">
        {durum.benzer.ad}
      </Link>{" "}
      ({durum.benzer.tur === "aday" ? "açık aday" : "öğrenci velisi"}). Kardeş
      kaydı ya da yeni bir başvuruysa yine de ekleyebilirsiniz.
    </div>
  );
}

export function YeniAdayDugmesi() {
  const { acik, setAcik, durum, eylem } = useEklemePaneli<AdayEylemDurumu>(
    adayEkle,
  );

  return (
    <>
      <Buton type="button" onClick={() => setAcik(true)}>
        Yeni aday
      </Buton>

      <Pencere
        acik={acik}
        onKapat={() => setAcik(false)}
        baslik="Yeni aday"
        altBaslik="Telefonla arayan veya şubeye gelen veliyi kaydedin."
        genislik="42rem"
      >
        <form action={eylem} className="space-y-4">
          {/* Benzer kayıt uyarısı gösterildiyse ikinci gönderim onaylıdır. */}
          {durum.benzer ? <input type="hidden" name="zorla" value="1" /> : null}

          <AdayAlanlari durum={durum} varsayilanlar={{}} yeniKayit />
          <BenzerUyarisi durum={durum} />
          {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

          <div className="flex flex-wrap items-center gap-2">
            <GonderButonu bekleyenEtiket="Ekleniyor…">
              {durum.benzer ? "Yine de kaydet" : "Adayı kaydet"}
            </GonderButonu>
            <Buton type="button" tur="ikincil" onClick={() => setAcik(false)}>
              Vazgeç
            </Buton>
          </div>
        </form>
      </Pencere>
    </>
  );
}

/** Ayrıntı sayfasındaki "Düzenle" — aynı alanlar, aşamaya dokunmaz. */
export function AdayDuzenleDugmesi({
  adayId,
  varsayilanlar,
}: {
  adayId: string;
  varsayilanlar: AdayVarsayilanlari;
}) {
  // Panelin açık/kapalı durumu da kancadan: başarıyla kaydedilince pencere
  // kendiliğinden kapanır (ayrı bir useState bunu kaçırırdı).
  const { acik, setAcik, durum, eylem } = useEklemePaneli<AdayEylemDurumu>(
    adayGuncelle.bind(null, adayId),
  );

  return (
    <>
      <Buton type="button" tur="sade" onClick={() => setAcik(true)}>
        Düzenle
      </Buton>

      <Pencere
        acik={acik}
        onKapat={() => setAcik(false)}
        baslik="Aday bilgilerini düzenle"
        altBaslik="Kaynak ve aşama buradan değişmez."
        genislik="42rem"
      >
        <form action={eylem} className="space-y-4">
          <AdayAlanlari
            durum={durum}
            varsayilanlar={varsayilanlar}
            yeniKayit={false}
          />
          {durum.basari ? (
            <Bildirim tur="basari">{durum.basari}</Bildirim>
          ) : null}
          {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

          <div className="flex flex-wrap items-center gap-2">
            <GonderButonu>Kaydet</GonderButonu>
            <Buton type="button" tur="ikincil" onClick={() => setAcik(false)}>
              Kapat
            </Buton>
          </div>
        </form>
      </Pencere>
    </>
  );
}
