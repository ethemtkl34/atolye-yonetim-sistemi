"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { GonderButonu } from "@/components/ui-istemci";
import { Bildirim, Kart, Rozet } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { EylemDurumu } from "@/lib/formlar";
import { donemStajyerleriniGuncelle } from "../actions";

export type KadroStajyeri = {
  id: string;
  ad: string;
  /** Hesap pasifse kadroda tutulabilir ama kadroya yeni eklenemez. */
  aktif: boolean;
  /** Bu dönemin gruplarındaki aktif kayıt sayısı — kadrodan çıkarma engeli. */
  buDonemdekiKayitSayisi: number;
  kadroda: boolean;
};

function KaydetButonu({ degisti }: { degisti: boolean }) {
  return (
    <GonderButonu
      tur="ikincil"
      disabled={!degisti}
      engelSebebi={degisti ? undefined : "Kadroda değişiklik yapılmadı."}
    >
      Kadroyu kaydet
    </GonderButonu>
  );
}

/**
 * Dönemin stajyer kadrosu.
 *
 * Kadro bu dönemin kayıtlarında sorumlu stajyer seçimini sınırlar; boşsa
 * sınırlama yoktur. Bu dönemde aktif kaydı olan stajyerin kutusu kilitlidir:
 * eylem zaten reddedecekti, kullanıcıya formu doldurtup sonra reddetmek
 * yerine sebep en baştan gösteriliyor (grup ekleme formundaki ilkeyle aynı).
 */
export function StajyerYonetimi({
  donemId,
  stajyerler,
}: {
  donemId: string;
  stajyerler: KadroStajyeri[];
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    donemStajyerleriniGuncelle.bind(null, donemId),
    {},
  );

  const kadrodakiler = stajyerler
    .filter((stajyer) => stajyer.kadroda)
    .map((stajyer) => stajyer.id);
  const [secilenler, setSecilenler] = useState<string[]>(kadrodakiler);

  function degistir(id: string) {
    setSecilenler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((s) => s !== id)
        : [...oncekiler, id],
    );
  }

  const degisti =
    secilenler.length !== kadrodakiler.length ||
    !kadrodakiler.every((id) => secilenler.includes(id));

  /**
   * React 19, form eylemi tamamlanınca formu sıfırlıyor ve kutuların DOM
   * durumu `defaultChecked`e (boşa) düşüyor; React'in kendi durumu bozulmuyor
   * ama ekranda seçimler kaybolmuş görünüyordu. Kayıt formundaki çözümle aynı:
   * sıfırlamadan sonra DOM, durumdan geri yazılır.
   */
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const kutu of form.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="stajyerler"]',
    )) {
      kutu.checked = secilenler.includes(kutu.value);
    }
  }, [durum, secilenler]);

  return (
    <Kart className="space-y-4 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Stajyer kadrosu
        </h2>
        <span className="text-sm font-medium text-zinc-500">
          {secilenler.length} stajyer
        </span>
      </div>

      <p className="text-sm text-zinc-600">
        Bu dönemin kayıtlarında sorumlu stajyer bu kadrodan seçilir. Kadro boş
        bırakılırsa bütün aktif stajyerler seçilebilir kalır.
      </p>

      {stajyerler.length === 0 ? (
        <Bildirim tur="bilgi">
          Aktif stajyer yok. Önce Stajyerler ekranından stajyer ekleyin.
        </Bildirim>
      ) : (
        <form ref={formRef} action={eylem} className="space-y-4">
          <ul className="space-y-1">
            {stajyerler.map((stajyer) => {
              const secili = secilenler.includes(stajyer.id);
              // Bu dönemde aktif kaydı olan stajyer kadrodan çıkarılamaz;
              // kutu kilitli, sebep üzerine gelince yazıyor. Kilit yalnızca
              // KAYITLI kadro üyelerine uygulanır: henüz kaydedilmemiş taze
              // bir işaret serbestçe geri alınabilmeli.
              const cikarilamaz =
                stajyer.kadroda &&
                secili &&
                stajyer.buDonemdekiKayitSayisi > 0;

              return (
                <li key={stajyer.id}>
                  <label
                    title={
                      cikarilamaz
                        ? `${stajyer.ad} bu dönemde ${stajyer.buDonemdekiKayitSayisi} aktif kayıttan sorumlu; kadrodan çıkarmak için önce kayıtları Atamalar ekranından devredin.`
                        : undefined
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-full px-2 py-1.5 text-sm",
                      // Kadrodaki stajyer kile gömülür; kadro dışındaki düz kalır.
                      cikarilamaz
                        ? "kil-cip cursor-not-allowed text-marka-700"
                        : secili
                          ? "kil-cip cursor-pointer text-marka-700"
                          : "cursor-pointer text-zinc-700 hover:bg-marka-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="stajyerler"
                      value={stajyer.id}
                      checked={secili}
                      disabled={cikarilamaz}
                      onChange={() => degistir(stajyer.id)}
                      className="size-4"
                    />
                    {/* Kilitli kutu formda gönderilmez; kadro yanlışlıkla
                        boşalmasın diye değer gizli alandan taşınır. */}
                    {cikarilamaz ? (
                      <input
                        type="hidden"
                        name="stajyerler"
                        value={stajyer.id}
                      />
                    ) : null}
                    <span className="flex-1">{stajyer.ad}</span>
                    {stajyer.aktif ? null : <Rozet tur="pasif">Pasif</Rozet>}
                    <span className="text-xs text-zinc-500">
                      {stajyer.buDonemdekiKayitSayisi > 0
                        ? `bu dönemde ${stajyer.buDonemdekiKayitSayisi} kayıt`
                        : "bu dönemde kaydı yok"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {durum.basari ? (
            <Bildirim tur="basari">{durum.basari}</Bildirim>
          ) : null}
          {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

          <KaydetButonu degisti={degisti} />
        </form>
      )}
    </Kart>
  );
}
