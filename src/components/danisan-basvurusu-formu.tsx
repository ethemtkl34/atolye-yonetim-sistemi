"use client";

import { useState } from "react";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  secimStili,
} from "@/components/ui";
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import { useEklemePaneli } from "@/components/bolum-iskeleti";
import { TERAPI_TURLERI } from "@/lib/terapi-turleri";
import { cn } from "@/lib/utils";
import {
  danisanBasvurusuKaydet,
  type DanisanEylemDurumu,
} from "@/app/koordinator/danismanlik/danisan-eylemleri";
import { EBEVEYN_DURUMU_ETIKETLERI } from "@/app/koordinator/danismanlik/danisan-sema";

/**
 * Danışan başvurusu formu — açılır pencerede.
 *
 * Terapiye alınan çocuğun dosya kapağı: kim, hangi terapi için, niçin geldi;
 * daha önce destek aldı mı; ailesi nasıl bir tablo çiziyor. Atölye kaydından
 * bağımsız — psikolog atölyeye hiç girmeyecek çocuk da alıyor.
 *
 * ÇOCUK SİSTEME İKİ YOLDAN GELİR, form ikisini de karşılar:
 *   - "yeni":   sistemde kaydı yok. Kimlik ve veli bilgileri de burada alınır,
 *               öğrenci ile başvuru tek işlemde açılır.
 *   - "mevcut": zaten kayıtlı — tipik olarak atölyeden terapiye geçen çocuk.
 *               Kimlik sorulmaz (öğrenci kaydında var), yalnızca başvuru
 *               doldurulur.
 * Öğrenci profilinden açıldığında (`sabitOgrenci`) mod seçimi hiç çizilmez:
 * hangi çocuk olduğu zaten bellidir.
 *
 * Başvuru öğrenci başına tektir ve üzerine yazılır; `mevcutBasvuru` doluysa
 * form düzenleme kipindedir (alanlar dolu gelir, düğme "Güncelle" der).
 */

export type BasvuruDegerleri = {
  terapiTuru: string;
  basvuruNedeni: string;
  yonlendiren: string | null;
  oncekiDestek: string | null;
  tani: string | null;
  kardesler: string | null;
  birlikteYasadiklari: string | null;
  ebeveynDurumu: string | null;
  anneEgitim: string | null;
  anneMeslek: string | null;
  babaEgitim: string | null;
  babaMeslek: string | null;
  ailedeRuhsalOyku: string | null;
  ilac: string | null;
};

/** Form içindeki bölüm başlığı — uzun formu göz taranabilir tutar. */
function BolumBasligi({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="border-b border-yuzey-200 pb-1 text-sm font-semibold text-zinc-900">
      {children}
    </h4>
  );
}

export function DanisanBasvurusuFormu({
  ogrenciSecenekleri = [],
  sabitOgrenci,
  mevcutBasvuru,
  acilisEtiketi = "+ Danışan öğrenci ekle",
  acilisTuru = "ikincil",
}: {
  /** "mevcut" modundaki seçici — şubenin bütün öğrencileri. */
  ogrenciSecenekleri?: { id: string; ad: string }[];
  /** Öğrenci profilinden açılınca: mod seçimi ve seçici çizilmez. */
  sabitOgrenci?: { id: string; ad: string };
  /** Doluysa form düzenleme kipinde açılır. */
  mevcutBasvuru?: BasvuruDegerleri;
  acilisEtiketi?: string;
  acilisTuru?: "birincil" | "ikincil";
}) {
  const { acik, setAcik, durum, eylem, deger } =
    useEklemePaneli<DanisanEylemDurumu>(danisanBasvurusuKaydet);

  // Profilden açıldığında ya da düzenlemede öğrenci zaten belli.
  const [mod, setMod] = useState<"yeni" | "mevcut">(
    sabitOgrenci ? "mevcut" : "yeni",
  );
  const etkinMod = sabitOgrenci ? "mevcut" : mod;
  const duzenleme = Boolean(mevcutBasvuru);

  /**
   * Alanın gösterilecek değeri: doğrulama hatasından sonra kullanıcının
   * girdiği (`degerler`), yoksa kayıtlı başvuru, yoksa boş. Sıra önemli —
   * hata dönüşünde kayıtlı değer kullanıcının yazdığının üstüne yazmamalı.
   */
  const alanDegeri = (alan: keyof BasvuruDegerleri) =>
    deger(alan) ?? mevcutBasvuru?.[alan] ?? "";

  return (
    <>
      <Buton type="button" tur={acilisTuru} onClick={() => setAcik(true)}>
        {acilisEtiketi}
      </Buton>

      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}

      <Pencere
        acik={acik}
        onKapat={() => setAcik(false)}
        genislik="46rem"
        govdeSinifi="overflow-y-auto p-4"
        baslik={
          <h3 className="text-base font-semibold text-zinc-900">
            {duzenleme ? "Danışan başvurusunu düzenle" : "Danışan başvurusu"}
          </h3>
        }
        altBaslik={
          sabitOgrenci
            ? sabitOgrenci.ad
            : "Terapiye alınan çocuğun dosya kapağı. Atölye kaydı gerekmez."
        }
      >
        <form action={eylem} className="space-y-5">
          <input type="hidden" name="mod" value={etkinMod} />
          {sabitOgrenci ? (
            <input type="hidden" name="ogrenciId" value={sabitOgrenci.id} />
          ) : null}

          {/* --- Çocuk --- */}
          {!sabitOgrenci ? (
            <div className="space-y-3">
              <BolumBasligi>Çocuk</BolumBasligi>

              {/* Mod seçimi çip grubu: adres süzgeçlerindeki görsel dille
                  aynı, ama burada durum istemcide (form gönderilmeden
                  değişiyor). */}
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["yeni", "Sistemde kayıtlı değil"],
                    ["mevcut", "Zaten kayıtlı"],
                  ] as const
                ).map(([deger, etiket]) => (
                  <button
                    key={deger}
                    type="button"
                    onClick={() => setMod(deger)}
                    aria-pressed={etkinMod === deger}
                    className={cn(
                      // Seçili çip GÖMÜK durur (basılı düğme), seçilmeyen
                      // yüzeyde durmaz; hangisinin açık olduğu renkten önce
                      // dokudan okunur.
                      "kil-buton px-3 py-1.5 text-sm",
                      etkinMod === deger
                        ? "kil-oyuk text-marka-700"
                        : "kil-buton-sade",
                    )}
                  >
                    {etiket}
                  </button>
                ))}
              </div>

              {etkinMod === "mevcut" ? (
                <Alan
                  etiket="Öğrenci"
                  ipucu="Atölyeden gelen çocuklar da burada."
                  hata={durum.alanHatalari?.ogrenciId}
                >
                  <select
                    name="ogrenciId"
                    defaultValue={deger("ogrenciId") ?? ""}
                    className={secimStili}
                  >
                    <option value="">Öğrenci seçin…</option>
                    {ogrenciSecenekleri.map((ogrenci) => (
                      <option key={ogrenci.id} value={ogrenci.id}>
                        {ogrenci.ad}
                      </option>
                    ))}
                  </select>
                </Alan>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Alan etiket="Ad" hata={durum.alanHatalari?.firstName}>
                      <Girdi name="firstName" defaultValue={deger("firstName")} />
                    </Alan>
                    <Alan etiket="Soyad" hata={durum.alanHatalari?.lastName}>
                      <Girdi name="lastName" defaultValue={deger("lastName")} />
                    </Alan>
                    <Alan
                      etiket="Doğum tarihi"
                      hata={durum.alanHatalari?.birthDate}
                    >
                      <Girdi
                        name="birthDate"
                        type="date"
                        defaultValue={deger("birthDate")}
                      />
                    </Alan>
                    <Alan etiket="Okul" hata={durum.alanHatalari?.school}>
                      <Girdi name="school" defaultValue={deger("school")} />
                    </Alan>
                    <Alan etiket="Sınıf" hata={durum.alanHatalari?.grade}>
                      <Girdi name="grade" defaultValue={deger("grade")} />
                    </Alan>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Alan etiket="Anne adı" hata={durum.alanHatalari?.anneAdi}>
                      <Girdi name="anneAdi" defaultValue={deger("anneAdi")} />
                    </Alan>
                    <Alan
                      etiket="Anne telefonu"
                      hata={durum.alanHatalari?.anneTelefon}
                    >
                      <Girdi
                        name="anneTelefon"
                        type="tel"
                        defaultValue={deger("anneTelefon")}
                      />
                    </Alan>
                    <Alan etiket="Baba adı" hata={durum.alanHatalari?.babaAdi}>
                      <Girdi name="babaAdi" defaultValue={deger("babaAdi")} />
                    </Alan>
                    <Alan
                      etiket="Baba telefonu"
                      hata={durum.alanHatalari?.babaTelefon}
                    >
                      <Girdi
                        name="babaTelefon"
                        type="tel"
                        defaultValue={deger("babaTelefon")}
                      />
                    </Alan>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* --- Başvuru --- */}
          <div className="space-y-3">
            <BolumBasligi>Başvuru</BolumBasligi>
            <div className="grid gap-4 sm:grid-cols-2">
              <Alan etiket="Terapi türü" hata={durum.alanHatalari?.terapiTuru}>
                <select
                  name="terapiTuru"
                  defaultValue={alanDegeri("terapiTuru") || TERAPI_TURLERI[0].deger}
                  className={secimStili}
                >
                  {TERAPI_TURLERI.map((tur) => (
                    <option key={tur.deger} value={tur.deger}>
                      {tur.etiket}
                    </option>
                  ))}
                </select>
              </Alan>
              <Alan
                etiket="Yönlendiren"
                ipucu="Okul, hekim, kendi başvurusu…"
                hata={durum.alanHatalari?.yonlendiren}
              >
                <Girdi
                  name="yonlendiren"
                  defaultValue={alanDegeri("yonlendiren")}
                />
              </Alan>
            </div>
            <Alan
              etiket="Başvuru nedeni"
              ipucu="Ailenin veya çocuğun anlattığı şikayet, kendi cümleleriyle."
              hata={durum.alanHatalari?.basvuruNedeni}
            >
              <CokSatirli
                name="basvuruNedeni"
                rows={3}
                defaultValue={alanDegeri("basvuruNedeni")}
              />
            </Alan>
          </div>

          {/* --- Önceki destek --- */}
          <div className="space-y-3">
            <BolumBasligi>Önceki destek ve tanı</BolumBasligi>
            <Alan
              etiket="Daha önce alınan destek"
              ipucu="Nereden, ne kadar süre, neden sonlandı."
              hata={durum.alanHatalari?.oncekiDestek}
            >
              <CokSatirli
                name="oncekiDestek"
                rows={2}
                defaultValue={alanDegeri("oncekiDestek")}
              />
            </Alan>
            <div className="grid gap-4 sm:grid-cols-2">
              <Alan
                etiket="Konmuş tanı"
                ipucu="Varsa, kim tarafından konduğuyla."
                hata={durum.alanHatalari?.tani}
              >
                <Girdi name="tani" defaultValue={alanDegeri("tani")} />
              </Alan>
              <Alan
                etiket="Kullandığı ilaçlar"
                ipucu="Öğrencinin sağlık bilgisine yazılır."
                hata={durum.alanHatalari?.ilac}
              >
                <Girdi name="ilac" defaultValue={alanDegeri("ilac")} />
              </Alan>
            </div>
          </div>

          {/* --- Aile --- */}
          <div className="space-y-3">
            <BolumBasligi>Aile</BolumBasligi>
            <div className="grid gap-4 sm:grid-cols-2">
              <Alan
                etiket="Ebeveyn durumu"
                hata={durum.alanHatalari?.ebeveynDurumu}
              >
                <select
                  name="ebeveynDurumu"
                  defaultValue={alanDegeri("ebeveynDurumu")}
                  className={secimStili}
                >
                  <option value="">Belirtilmedi</option>
                  {Object.entries(EBEVEYN_DURUMU_ETIKETLERI).map(
                    ([deger, etiket]) => (
                      <option key={deger} value={deger}>
                        {etiket}
                      </option>
                    ),
                  )}
                </select>
              </Alan>
              <Alan
                etiket="Birlikte yaşadığı kişiler"
                hata={durum.alanHatalari?.birlikteYasadiklari}
              >
                <Girdi
                  name="birlikteYasadiklari"
                  defaultValue={alanDegeri("birlikteYasadiklari")}
                />
              </Alan>
              <Alan
                etiket="Kardeşleri"
                ipucu="Sayı ve yaşlar."
                hata={durum.alanHatalari?.kardesler}
              >
                <Girdi
                  name="kardesler"
                  defaultValue={alanDegeri("kardesler")}
                />
              </Alan>
              <Alan
                etiket="Anne öğrenim durumu"
                hata={durum.alanHatalari?.anneEgitim}
              >
                <Girdi
                  name="anneEgitim"
                  defaultValue={alanDegeri("anneEgitim")}
                />
              </Alan>
              <Alan etiket="Anne mesleği" hata={durum.alanHatalari?.anneMeslek}>
                <Girdi
                  name="anneMeslek"
                  defaultValue={alanDegeri("anneMeslek")}
                />
              </Alan>
              <Alan
                etiket="Baba öğrenim durumu"
                hata={durum.alanHatalari?.babaEgitim}
              >
                <Girdi
                  name="babaEgitim"
                  defaultValue={alanDegeri("babaEgitim")}
                />
              </Alan>
              <Alan etiket="Baba mesleği" hata={durum.alanHatalari?.babaMeslek}>
                <Girdi
                  name="babaMeslek"
                  defaultValue={alanDegeri("babaMeslek")}
                />
              </Alan>
            </div>
            <Alan
              etiket="Ailede ruhsal hastalık öyküsü"
              hata={durum.alanHatalari?.ailedeRuhsalOyku}
            >
              <CokSatirli
                name="ailedeRuhsalOyku"
                rows={2}
                defaultValue={alanDegeri("ailedeRuhsalOyku")}
              />
            </Alan>
          </div>

          {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-yuzey-200 pt-4">
            <GonderButonu>
              {duzenleme ? "Başvuruyu güncelle" : "Başvuruyu kaydet"}
            </GonderButonu>
            <Buton type="button" tur="sade" onClick={() => setAcik(false)}>
              Vazgeç
            </Buton>
          </div>
        </form>
      </Pencere>
    </>
  );
}
