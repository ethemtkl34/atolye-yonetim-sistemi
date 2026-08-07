"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { GonderButonu } from "@/components/ui-istemci";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  Kart,
  Rozet,
} from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import {
  soruDurumDegistir,
  soruEkle,
  soruGuncelle,
  soruSil,
  soruSiraDegistir,
} from "../actions";

export type SoruSatiri = {
  id: string;
  text: string;
  title: string | null;
  category: string | null;
  active: boolean;
  sortOrder: number;
  kullanimSayisi: number;
};

/** Kategori girdisinin önerdiği standart konu başlıkları. */
const STANDART_KATEGORILER = [
  "Dersin İlgi ve Merak Alanları",
  "Dersin Yetenek Gelişim Alanları",
];

/**
 * §9.2 — Bir atölyenin değerlendirme soru setinin yönetimi.
 *
 * Tek bir bildirim alanı kullanılıyor: silme işleminin sonucu koordinatöre
 * mutlaka açıklanmalı, çünkü kullanılmış bir soru silinmek yerine pasife
 * alınıyor ve bunun sebebi görünmezse davranış hata gibi algılanır.
 */
export function SoruYonetimi({
  atolyeId,
  sorular,
}: {
  atolyeId: string;
  sorular: SoruSatiri[];
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [bekliyor, basla] = useTransition();
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);

  // Öneri listesi: standart başlıklar + bu atölyede zaten kullanılanlar.
  const kategoriSecenekleri = [
    ...new Set([
      ...STANDART_KATEGORILER,
      ...sorular
        .map((soru) => soru.category)
        .filter((kategori): kategori is string => kategori !== null),
    ]),
  ];

  function calistir(eylem: () => Promise<EylemDurumu>) {
    basla(async () => setMesaj(await eylem()));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-zinc-900">
          Değerlendirme soruları
        </h2>
        <span className="text-xs text-zinc-500">
          {sorular.filter((s) => s.active).length} aktif / {sorular.length}{" "}
          toplam
        </span>
      </div>

      {mesaj?.basari ? (
        <Bildirim tur="bilgi">{mesaj.basari}</Bildirim>
      ) : null}
      {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

      {sorular.length === 0 ? (
        <Kart className="border-dashed p-6 text-center">
          <p className="text-sm text-zinc-600">
            Bu atölyenin henüz sorusu yok.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Puanlama yapılabilmesi için en az bir soru gerekir.
          </p>
        </Kart>
      ) : (
        <ol className="space-y-2">
          {sorular.map((soru, sira) => (
            <li key={soru.id}>
              <Kart className="p-3">
                {duzenlenenId === soru.id ? (
                  <SoruDuzenleFormu
                    soru={soru}
                    kategoriler={kategoriSecenekleri}
                    kapat={() => setDuzenlenenId(null)}
                  />
                ) : (
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="mt-0.5 w-6 shrink-0 text-sm tabular-nums text-zinc-400">
                      {sira + 1}.
                    </span>

                    <div className="min-w-0 flex-1">
                      {soru.title ? (
                        <p
                          className={
                            soru.active
                              ? "text-sm font-medium text-zinc-900"
                              : "text-sm font-medium text-zinc-400 line-through"
                          }
                        >
                          {soru.title}
                        </p>
                      ) : null}
                      <p
                        className={
                          soru.active
                            ? "text-sm text-zinc-900"
                            : "text-sm text-zinc-400 line-through"
                        }
                      >
                        {soru.text}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {soru.category ? (
                          <Rozet tur="notr">{soru.category}</Rozet>
                        ) : null}
                        {soru.active ? null : <Rozet tur="pasif">Pasif</Rozet>}
                        {soru.kullanimSayisi > 0 ? (
                          <span className="text-xs text-zinc-500">
                            {soru.kullanimSayisi} değerlendirmede kullanıldı
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">
                            Henüz kullanılmadı
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                      <Buton
                        tur="sade"
                        className="px-2"
                        title="Yukarı taşı"
                        aria-label="Yukarı taşı"
                        disabled={bekliyor || sira === 0}
                        onClick={() =>
                          calistir(
                            soruSiraDegistir.bind(null, soru.id, "yukari"),
                          )
                        }
                      >
                        ↑
                      </Buton>
                      <Buton
                        tur="sade"
                        className="px-2"
                        title="Aşağı taşı"
                        aria-label="Aşağı taşı"
                        disabled={bekliyor || sira === sorular.length - 1}
                        onClick={() =>
                          calistir(
                            soruSiraDegistir.bind(null, soru.id, "asagi"),
                          )
                        }
                      >
                        ↓
                      </Buton>
                      <Buton
                        tur="sade"
                        disabled={bekliyor}
                        onClick={() => setDuzenlenenId(soru.id)}
                      >
                        Düzenle
                      </Buton>
                      <Buton
                        tur="sade"
                        disabled={bekliyor}
                        onClick={() =>
                          calistir(soruDurumDegistir.bind(null, soru.id))
                        }
                      >
                        {soru.active ? "Pasife al" : "Aktifleştir"}
                      </Buton>
                      <Buton
                        tur="tehlike"
                        disabled={bekliyor}
                        onClick={() => {
                          const onay =
                            soru.kullanimSayisi > 0
                              ? `Bu soru ${soru.kullanimSayisi} değerlendirmede kullanılmış. Geçmiş kayıtlar korunacağı için silinmeyecek, pasife alınacak. Devam edilsin mi?`
                              : "Soru silinecek. Devam edilsin mi?";
                          if (window.confirm(onay)) {
                            calistir(soruSil.bind(null, soru.id));
                          }
                        }}
                      >
                        Sil
                      </Buton>
                    </div>
                  </div>
                )}
              </Kart>
            </li>
          ))}
        </ol>
      )}

      <SoruEkleFormu atolyeId={atolyeId} kategoriler={kategoriSecenekleri} />
    </div>
  );
}

/**
 * Başlık ve kategori girdileri — ekleme ve düzenleme formlarının ortak bloğu.
 * Kategori serbest metin; `<datalist>` standart başlıkları ve atölyede zaten
 * kullanılan kategorileri önerir.
 */
function SoruEkAlanlari({
  listeId,
  kategoriler,
  durum,
  varsayilan,
}: {
  listeId: string;
  kategoriler: string[];
  durum: EylemDurumu;
  varsayilan?: { title: string | null; category: string | null };
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Alan
          etiket="Kısa başlık (isteğe bağlı)"
          hata={durum.alanHatalari?.title}
        >
          <Girdi
            name="title"
            placeholder="Örnek: Duygu Düzenleme"
            defaultValue={varsayilan?.title ?? ""}
          />
        </Alan>
        <Alan etiket="Kategori (isteğe bağlı)" hata={durum.alanHatalari?.category}>
          <Girdi
            name="category"
            list={listeId}
            placeholder="Örnek: Dersin İlgi ve Merak Alanları"
            defaultValue={varsayilan?.category ?? ""}
          />
        </Alan>
      </div>
      <datalist id={listeId}>
        {kategoriler.map((kategori) => (
          <option key={kategori} value={kategori} />
        ))}
      </datalist>
    </>
  );
}

function SoruEkleFormu({
  atolyeId,
  kategoriler,
}: {
  atolyeId: string;
  kategoriler: string[];
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    soruEkle.bind(null, atolyeId),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (durum.basari) formRef.current?.reset();
  }, [durum.basari]);

  return (
    <Kart className="p-4">
      <form ref={formRef} action={eylem} className="space-y-3">
        <Alan etiket="Yeni soru" hata={durum.alanHatalari?.text}>
          <CokSatirli
            name="text"
            rows={2}
            placeholder="Örnek: Atölye ve etkinliklere ilgi gösterir."
            required
          />
        </Alan>
        <SoruEkAlanlari
          listeId="kategori-listesi-ekle"
          kategoriler={kategoriler}
          durum={durum}
        />
        <GonderButonu>Soru ekle</GonderButonu>
      </form>
    </Kart>
  );
}

function SoruDuzenleFormu({
  soru,
  kategoriler,
  kapat,
}: {
  soru: SoruSatiri;
  kategoriler: string[];
  kapat: () => void;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    soruGuncelle.bind(null, soru.id),
    {},
  );

  useEffect(() => {
    if (durum.basari) kapat();
  }, [durum.basari, kapat]);

  return (
    <form action={eylem} className="space-y-3">
      <Alan etiket="Soru metni" hata={durum.alanHatalari?.text}>
        <CokSatirli name="text" rows={2} defaultValue={soru.text} autoFocus />
      </Alan>

      <SoruEkAlanlari
        listeId={`kategori-listesi-${soru.id}`}
        kategoriler={kategoriler}
        durum={durum}
        varsayilan={{ title: soru.title, category: soru.category }}
      />

      {soru.kullanimSayisi > 0 ? (
        <p className="text-xs text-zinc-500">
          Bu soru {soru.kullanimSayisi} değerlendirmede kullanılmış. Metni
          değiştirmek geçmiş değerlendirmeleri etkilemez; onlar o gün sorulan
          metni gösterir.
        </p>
      ) : null}

      <div className="flex gap-2">
        <GonderButonu>Kaydet</GonderButonu>
        <Buton type="button" tur="ikincil" onClick={kapat}>
          Vazgeç
        </Buton>
      </div>
    </form>
  );
}
