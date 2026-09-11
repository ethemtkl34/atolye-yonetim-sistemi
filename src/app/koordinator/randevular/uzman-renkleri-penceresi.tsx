"use client";

import { useState, useTransition } from "react";
import { Bildirim, Buton, Kart } from "@/components/ui";
import { Pencere } from "@/components/ui-istemci";
import { UZMAN_RENKLERI, blokYazisi, uzmanRengi } from "@/lib/uzman-renkleri";
import type { EylemDurumu } from "@/lib/formlar";
import { uzmanRengiDegistir } from "../uzmanlar/actions";

type UzmanSatiri = { id: string; ad: string; renk: string };

/**
 * §17.3/§17.4 — Takvimdeki uzman renklerini randevu ekranından düzeltme.
 *
 * NEDEN BURADA: rengin yanlış olduğu yer takvim. "Bu iki uzmanın rengi
 * birbirine karışıyor" Uzmanlar ekranında değil, haftayı tararken fark
 * ediliyor; düzeltmek için modül değiştirip uzman formunu açmak gereksiz bir
 * yolculuktu. Kayıt yine uzman kaydına yazılıyor — iki ayrı renk kavramı YOK,
 * tek kaynak `Uzman.renk` (`uzmanRengiDegistir`).
 *
 * YETKİ: düğme yalnız `uzmanlar` TAM olanlara çiziliyor (pratikte danışma
 * masası ve yöneticiler); asıl sınır eylemin kendi `yonetimZorunlu`
 * kapısında — menüden gizlemek yetki değildir.
 */
export function UzmanRenkleriButonu({ uzmanlar }: { uzmanlar: UzmanSatiri[] }) {
  const [acik, setAcik] = useState(false);

  return (
    <>
      <Buton type="button" tur="ikincil" onClick={() => setAcik(true)}>
        Uzman renkleri
      </Buton>
      {acik ? (
        <UzmanRenkleriPenceresi uzmanlar={uzmanlar} onKapat={() => setAcik(false)} />
      ) : null}
    </>
  );
}

function UzmanRenkleriPenceresi({
  uzmanlar,
  onKapat,
}: {
  uzmanlar: UzmanSatiri[];
  onKapat: () => void;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [bekliyor, basla] = useTransition();
  /**
   * Seçim ANINDA ekranda: sunucu yanıtı gelene kadar eski renk kalsaydı
   * kullanıcı tıklamanın işleyip işlemediğini anlayamazdı. Sunucu reddederse
   * (`hata`) sayfa yenilenmesiyle gerçek renge dönülür.
   */
  const [secimler, setSecimler] = useState<Record<string, string>>({});

  function renkSec(uzmanId: string, renk: string) {
    setSecimler((onceki) => ({ ...onceki, [uzmanId]: renk }));
    basla(async () => setMesaj(await uzmanRengiDegistir(uzmanId, renk)));
  }

  return (
    <Pencere
      acik
      onKapat={onKapat}
      baslik="Uzman renkleri"
      altBaslik="Takvimde uzmanı ayırt eden renk. Değişiklik hemen kaydedilir."
      genislik="30rem"
      govdeSinifi="space-y-3 overflow-y-auto px-4 pt-4"
    >
      {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

      {uzmanlar.length === 0 ? (
        <p className="kil-oyuk px-3 py-2 text-sm text-zinc-500">
          Bu şubede çalışan aktif uzman yok.
        </p>
      ) : (
        <div className="space-y-2">
          {uzmanlar.map((uzman) => {
            const secili = secimler[uzman.id] ?? uzman.renk;
            const ton = uzmanRengi(secili);
            return (
              <Kart key={uzman.id} className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: ton.blok }}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-zinc-900">
                    {uzman.ad}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {UZMAN_RENKLERI.map((renk) => {
                    const seciliMi = renk.anahtar === secili;
                    return (
                      <button
                        key={renk.anahtar}
                        type="button"
                        disabled={bekliyor}
                        onClick={() => renkSec(uzman.id, renk.anahtar)}
                        aria-label={`${uzman.ad}: ${renk.etiket}`}
                        aria-pressed={seciliMi}
                        title={renk.etiket}
                        className="size-7 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 disabled:opacity-50"
                        style={{
                          // Çip TAKVİMDEKİ rengi gösterir (`blok`), açık
                          // zemini değil: kullanıcı seçtiği şeyin ekranda
                          // nasıl görüneceğini görmeli.
                          backgroundColor: renk.blok,
                          // Seçili halka: önce beyaz boşluk, sonra koyu çember
                          // — açık renklerde de kenar kayboluyor olmasın.
                          boxShadow: seciliMi
                            ? "0 0 0 2px #ffffff, 0 0 0 4px #18181b"
                            : undefined,
                        }}
                      >
                        {/* Renk körlüğünde tek başına renk yetmez: seçili olan
                            içindeki noktayla da işaretleniyor. */}
                        <span
                          className="mx-auto block size-2.5 rounded-full"
                          style={{
                            backgroundColor: seciliMi
                              ? blokYazisi(renk.blok)
                              : "transparent",
                          }}
                          aria-hidden
                        />
                      </button>
                    );
                  })}
                </div>
              </Kart>
            );
          })}
        </div>
      )}
    </Pencere>
  );
}
