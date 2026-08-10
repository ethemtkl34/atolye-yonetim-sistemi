"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { GonderButonu } from "@/components/ui-istemci";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  KatlanirBolum,
  Rozet,
} from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import { mufredatAnahtari } from "@/lib/mufredat";
import {
  mufredatKaydet,
  mufredatSil,
  ogretmenGuncelle,
  type MufredatHedefi,
} from "./actions";

export type MufredatAtolyesi = {
  /** TermWorkshop/ClubWorkshop satır kimliği — öğretmen adı buna yazılır. */
  programAtolyeId: string;
  atolyeTipiId: string;
  ad: string;
  ogretmenAdi: string | null;
};

export type MufredatHaftasi = {
  numara: number;
  /** "3. hafta · 20 Eylül" (dönem) ya da tarih (kulüp). */
  etiket: string;
};

/**
 * Programın hafta birimi. Dönem haftalara, kulüp günlere bölünür; rozet ve
 * onay metinleri bunu kullanır ki kulüpte "1/1 hafta" yazmasın.
 */
export type MufredatBirimi = "hafta" | "gün";

export type MufredatGirdiSatiri = {
  id: string;
  haftaNo: number;
  atolyeTipiId: string;
  baslik: string;
  aciklama: string | null;
};

/**
 * Haftalık müfredat editörü — dönem ve kulüp sayfaları aynı bileşeni kendi
 * verisiyle çağırır.
 *
 * Düzen atölye başına bir katlanır bölüm: "bir atölye = bir öğretmen = bir
 * konu listesi" zihinsel modeli bu ("satranç bu dönem ne işledi"). 10 hafta ×
 * 5 atölyelik bir ızgara tek sütunlu panel düzenine sığmazdı.
 *
 * Tek seferde bir satırın formu açık tutulur (soru-yonetimi.tsx etkileşimi):
 * istemci durumu tek anahtar, kaydedilmemiş yarım formlar birikmez.
 */
export function MufredatEditoru({
  hedef,
  atolyeler,
  haftalar,
  girdiler,
  duzenlenebilir,
  birim,
}: {
  hedef: MufredatHedefi;
  atolyeler: MufredatAtolyesi[];
  haftalar: MufredatHaftasi[];
  girdiler: MufredatGirdiSatiri[];
  duzenlenebilir: boolean;
  birim: MufredatBirimi;
}) {
  return (
    <div className="space-y-3">
      {atolyeler.map((atolye) => (
        <AtolyeBolumu
          key={atolye.programAtolyeId}
          hedef={hedef}
          atolye={atolye}
          haftalar={haftalar}
          girdiler={girdiler.filter(
            (girdi) => girdi.atolyeTipiId === atolye.atolyeTipiId,
          )}
          duzenlenebilir={duzenlenebilir}
          birim={birim}
        />
      ))}
    </div>
  );
}

function AtolyeBolumu({
  hedef,
  atolye,
  haftalar,
  girdiler,
  duzenlenebilir,
  birim,
}: {
  hedef: MufredatHedefi;
  atolye: MufredatAtolyesi;
  haftalar: MufredatHaftasi[];
  girdiler: MufredatGirdiSatiri[];
  duzenlenebilir: boolean;
  birim: MufredatBirimi;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [bekliyor, basla] = useTransition();
  const [acikHafta, setAcikHafta] = useState<number | null>(null);

  const konular = new Map(
    girdiler.map((girdi) => [
      mufredatAnahtari(girdi.haftaNo, girdi.atolyeTipiId),
      girdi,
    ]),
  );
  const doluHafta = haftalar.filter((hafta) =>
    konular.has(mufredatAnahtari(hafta.numara, atolye.atolyeTipiId)),
  ).length;

  return (
    <KatlanirBolum
      baslik={atolye.ad}
      etiket={
        <>
          <Rozet tur={doluHafta === haftalar.length ? "olumlu" : "notr"}>
            {doluHafta}/{haftalar.length} {birim}
          </Rozet>
          {atolye.ogretmenAdi ? (
            <span className="text-sm font-normal text-zinc-600">
              {atolye.ogretmenAdi}
            </span>
          ) : null}
        </>
      }
    >
      <div className="space-y-3">
        {duzenlenebilir ? (
          <OgretmenFormu hedef={hedef} atolye={atolye} />
        ) : (
          <p className="text-sm text-zinc-600">
            Öğretmen: {atolye.ogretmenAdi ?? "—"}
          </p>
        )}

        {mesaj?.basari ? <Bildirim tur="bilgi">{mesaj.basari}</Bildirim> : null}
        {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

        <ol className="divide-y divide-yuzey-100">
          {haftalar.map((hafta) => {
            const girdi =
              konular.get(
                mufredatAnahtari(hafta.numara, atolye.atolyeTipiId),
              ) ?? null;
            const acik = acikHafta === hafta.numara;

            return (
              <li key={hafta.numara} className="py-2.5">
                {acik ? (
                  <KonuFormu
                    hedef={hedef}
                    atolyeTipiId={atolye.atolyeTipiId}
                    hafta={hafta}
                    girdi={girdi}
                    kapat={() => setAcikHafta(null)}
                  />
                ) : (
                  // Telefonda dikey: etiket + konu + butonlar alt alta. Yatay
                  // düzende içerik sütununa ~60px kalıyordu ve başlık her
                  // kelimeyi ayrı satıra kırıp butonların altına giriyordu.
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                    <span className="text-xs text-zinc-500 sm:mt-0.5 sm:w-36 sm:shrink-0">
                      {hafta.etiket}
                    </span>

                    <div className="min-w-0 flex-1">
                      {girdi ? (
                        <>
                          <p className="text-sm font-medium text-zinc-900">
                            {girdi.baslik}
                          </p>
                          {girdi.aciklama ? (
                            <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-600">
                              {girdi.aciklama}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-zinc-400">Konu girilmedi</p>
                      )}
                    </div>

                    {duzenlenebilir ? (
                      <div className="-ml-3 flex shrink-0 items-center gap-1 sm:ml-0">
                        <Buton
                          tur="sade"
                          disabled={bekliyor}
                          onClick={() => setAcikHafta(hafta.numara)}
                        >
                          {girdi ? "Düzenle" : "Ekle"}
                        </Buton>
                        {girdi ? (
                          <Buton
                            tur="tehlike"
                            disabled={bekliyor}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `${hafta.numara}. ${birim === "hafta" ? "haftanın" : "günün"} "${girdi.baslik}" konusu silinecek. Devam edilsin mi?`,
                                )
                              ) {
                                basla(async () =>
                                  setMesaj(await mufredatSil(girdi.id)),
                                );
                              }
                            }}
                          >
                            Sil
                          </Buton>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </KatlanirBolum>
  );
}

function OgretmenFormu({
  hedef,
  atolye,
}: {
  hedef: MufredatHedefi;
  atolye: MufredatAtolyesi;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    ogretmenGuncelle.bind(null, hedef, atolye.programAtolyeId),
    {},
  );

  return (
    <form action={eylem} className="space-y-2">
      {/* Telefonda dikey: yan yana dizildiğinde ipucu metni iki satıra
          çıkıyor ve butonu alana göre kaydırıyordu. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:max-w-xs sm:flex-1">
          <Alan
            etiket="Öğretmen"
            hata={durum.alanHatalari?.ogretmenAdi}
            ipucu="Bu programda bu atölyeyi veren kişi; boş bırakılırsa silinir."
          >
            <Girdi
              name="ogretmenAdi"
              defaultValue={
                durum.degerler?.ogretmenAdi ?? atolye.ogretmenAdi ?? ""
              }
              placeholder="Ad Soyad"
            />
          </Alan>
        </div>
        <div className="sm:pb-6">
          <GonderButonu tur="ikincil">Kaydet</GonderButonu>
        </div>
      </div>
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
    </form>
  );
}

function KonuFormu({
  hedef,
  atolyeTipiId,
  hafta,
  girdi,
  kapat,
}: {
  hedef: MufredatHedefi;
  atolyeTipiId: string;
  hafta: MufredatHaftasi;
  girdi: MufredatGirdiSatiri | null;
  kapat: () => void;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    mufredatKaydet.bind(null, hedef, atolyeTipiId, hafta.numara),
    {},
  );

  useEffect(() => {
    if (durum.basari) kapat();
  }, [durum.basari, kapat]);

  return (
    <form action={eylem} className="space-y-3">
      <p className="text-xs font-medium text-zinc-500">{hafta.etiket}</p>

      <Alan etiket="Konu başlığı" hata={durum.alanHatalari?.baslik}>
        <Girdi
          name="baslik"
          defaultValue={durum.degerler?.baslik ?? girdi?.baslik ?? ""}
          placeholder="Örnek: Açılış ilkeleri ve merkez kontrolü"
          autoFocus
          required
        />
      </Alan>

      <Alan
        etiket="Açıklama"
        hata={durum.alanHatalari?.aciklama}
        ipucu="Zorunlu — o hafta işlenen müfredat içeriği: konular, etkinlikler, materyaller. Veli raporundaki atölye paragrafı bu metinlerden üretilir."
      >
        <CokSatirli
          name="aciklama"
          rows={5}
          required
          defaultValue={durum.degerler?.aciklama ?? girdi?.aciklama ?? ""}
        />
      </Alan>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex gap-2">
        <GonderButonu>Kaydet</GonderButonu>
        <Buton type="button" tur="ikincil" onClick={kapat}>
          Vazgeç
        </Buton>
      </div>
    </form>
  );
}
