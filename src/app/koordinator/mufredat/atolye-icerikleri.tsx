"use client";

import { useState, useTransition } from "react";
import { Bildirim, Buton, CokSatirli, Kart, Rozet } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import type { MufredatHedefi } from "./actions";
import {
  atolyeIcerigiKaydet,
  atolyeIcerigiKilidiDegistir,
  atolyeIcerigiUretEylem,
  type AtolyeIcerikKaydi,
} from "./atolye-icerik-eylemleri";

/**
 * §11.2 — "Atölyeler ve İçerikleri Hakkında" paragrafları.
 *
 * Bu metinler öğrenciye özel DEĞİL: programın o atölyesinin dönem boyunca ne
 * işlediğini anlatırlar ve o programdaki bütün öğrencilerin raporunda aynen
 * görünürler. Uyarı bilerek görünür yerde duruyor — bir düzenlemenin tek bir
 * raporu değil hepsini etkilediği, tıklamadan önce bilinmeli.
 *
 * Her atölye kendi durumunu taşır: üretim biri için sürerken diğerleri
 * kullanılabilir kalır.
 */
export function AtolyeIcerikleri({
  hedef,
  atolyeler,
  kayitlar,
  duzenlenebilir,
}: {
  hedef: MufredatHedefi;
  atolyeler: { atolyeTipiId: string; ad: string }[];
  kayitlar: AtolyeIcerikKaydi[];
  duzenlenebilir: boolean;
}) {
  const haritalanan = new Map(kayitlar.map((k) => [k.atolyeTipiId, k]));

  return (
    <Kart className="p-4 sm:p-5">
      <h2 className="text-base font-semibold">Atölyeler ve içerikleri</h2>
      <p className="mt-0.5 mb-3 text-sm text-zinc-600">
        Raporun &quot;Atölyeler ve İçerikleri Hakkında&quot; bölümüne basılan
        paragraflar. Yukarıdaki haftalık müfredattan üretilirler.
      </p>

      <Bildirim tur="bilgi">
        Bu metinler bütün öğrencilerde aynıdır. Bir düzenleme, bu programdaki
        her öğrencinin raporunu etkiler.
      </Bildirim>

      <div className="mt-4 space-y-3">
        {atolyeler.map((atolye) => (
          <AtolyeSatiri
            key={atolye.atolyeTipiId}
            hedef={hedef}
            atolye={atolye}
            kayit={haritalanan.get(atolye.atolyeTipiId) ?? null}
            duzenlenebilir={duzenlenebilir}
          />
        ))}
      </div>
    </Kart>
  );
}

function AtolyeSatiri({
  hedef,
  atolye,
  kayit,
  duzenlenebilir,
}: {
  hedef: MufredatHedefi;
  atolye: { atolyeTipiId: string; ad: string };
  kayit: AtolyeIcerikKaydi | null;
  duzenlenebilir: boolean;
}) {
  const [durum, setDurum] = useState<EylemDurumu | null>(null);
  const [duzenleme, setDuzenleme] = useState(false);
  const [islemde, basla] = useTransition();

  // Üretim tamamlanınca sunucu bileşeni tazeleniyor ve `kayit` yeni metinle
  // geliyor; ayrı bir yerel kopya tutulmuyor ki ikisi ayrışmasın.
  const metin = kayit?.metin ?? "";

  function calistir(eylem: () => Promise<EylemDurumu>) {
    setDurum(null);
    basla(async () => {
      setDurum(await eylem());
    });
  }

  return (
    // Satır, kartın İÇİNDE duruyor: kabartma değil gömük yüzey.
    <div className="kil-oyuk p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{atolye.ad}</span>
          {kayit ? (
            <Rozet tur={kayit.kaynak === "elle" ? "olumlu" : "notr"}>
              {kayit.kaynak === "elle" ? "Elle düzenlendi" : "Yapay zekâ yazdı"}
            </Rozet>
          ) : (
            <Rozet tur="pasif">Metin yok</Rozet>
          )}
          {kayit?.kilitli ? <Rozet tur="uyari">Kilitli</Rozet> : null}
        </div>

        {duzenlenebilir ? (
          <div className="flex flex-wrap gap-2">
            <Buton
              tur="ikincil"
              disabled={islemde || kayit?.kilitli}
              onClick={() =>
                calistir(() =>
                  atolyeIcerigiUretEylem(hedef, atolye.atolyeTipiId),
                )
              }
            >
              {islemde ? "Üretiliyor…" : kayit ? "Yeniden üret" : "Metin üret"}
            </Buton>

            <Buton
              tur="ikincil"
              disabled={islemde}
              onClick={() => setDuzenleme((acik) => !acik)}
            >
              {duzenleme ? "Vazgeç" : "Düzenle"}
            </Buton>

            {kayit ? (
              <Buton
                tur="ikincil"
                disabled={islemde}
                onClick={() =>
                  calistir(() =>
                    atolyeIcerigiKilidiDegistir(
                      hedef,
                      atolye.atolyeTipiId,
                      !kayit.kilitli,
                    ),
                  )
                }
              >
                {kayit.kilitli ? "Kilidi aç" : "Kilitle"}
              </Buton>
            ) : null}
          </div>
        ) : null}
      </div>

      {durum?.hata ? (
        <div className="mt-3">
          <Bildirim tur="hata">{durum.hata}</Bildirim>
        </div>
      ) : null}
      {durum?.basari ? (
        <div className="mt-3">
          <Bildirim tur="basari">{durum.basari}</Bildirim>
        </div>
      ) : null}

      {duzenleme ? (
        <form
          action={async (form) => {
            setDurum(null);
            const sonuc = await atolyeIcerigiKaydet(
              hedef,
              atolye.atolyeTipiId,
              {},
              form,
            );
            setDurum(sonuc);
            if (sonuc.basari) setDuzenleme(false);
          }}
          className="mt-3 space-y-2"
        >
          <CokSatirli
            name="metin"
            defaultValue={metin}
            rows={8}
            className="leading-relaxed"
          />
          <Buton type="submit">Kaydet</Buton>
        </form>
      ) : metin ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">{metin}</p>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          Henüz metin yok. Haftalık müfredat girildikten sonra üretebilirsiniz.
        </p>
      )}
    </div>
  );
}
