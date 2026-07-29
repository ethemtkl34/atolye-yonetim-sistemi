"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  Kart,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { KULUP_ATOLYE_SAYISI } from "@/lib/kurallar";
import { bugun, gunEkle, tarihCozumle, tarihGunleBicimle, tarihMetni } from "@/lib/tarih";
import { kulupOlustur, type EylemDurumu } from "../actions";

export type AtolyeSecenegi = { id: string; name: string };

/** Verilen tarihten sonraki ilk cumartesi — varsayılan kulüp tarihi. */
function sonrakiCumartesi(tarih: Date): Date {
  const gun = tarih.getUTCDay();
  return gunEkle(tarih, (6 - gun + 7) % 7);
}

function KaydetButonu({ etkin }: { etkin: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending || !etkin}>
      {pending ? "Oluşturuluyor…" : "Kulübü oluştur"}
    </Buton>
  );
}

/**
 * §5.1 — Kulüp oluşturma.
 *
 * Grubun günü sorulmuyor: kulübün tek bir tarihi var, grup da o gün toplanıyor.
 * Seçilen tarihin hangi güne denk geldiği anında yazılıyor ki koordinatör
 * cumartesi mi pazar mı açtığını görmeden göndermesin.
 */
export function KulupSihirbazi({ atolyeler }: { atolyeler: AtolyeSecenegi[] }) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    kulupOlustur,
    {},
  );

  const [tarih, setTarih] = useState(() =>
    tarihMetni(sonrakiCumartesi(bugun())),
  );
  const [secilenAtolyeler, setSecilenAtolyeler] = useState<string[]>([]);

  const secilenTarih = tarihCozumle(tarih);
  const haftaSonu = secilenTarih
    ? [0, 6].includes(secilenTarih.getUTCDay())
    : false;
  const atolyeTamam = secilenAtolyeler.length === KULUP_ATOLYE_SAYISI;

  function atolyeDegistir(id: string) {
    setSecilenAtolyeler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((a) => a !== id)
        : [...oncekiler, id],
    );
  }

  return (
    <form action={eylem} className="space-y-6">
      {/* --- Kulüp bilgileri --- */}
      <Kart className="space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Kulüp bilgileri
        </h2>

        <Alan etiket="Kulüp adı" hata={durum.alanHatalari?.name}>
          <Girdi name="name" placeholder="Örn. Bilim Kulübü" required />
        </Alan>

        <Alan
          etiket="Kulüp tarihi"
          ipucu="Kulüp tek yarım gün sürer; grup bu tarihte toplanır."
        >
          <Girdi
            type="date"
            name="date"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            className="max-w-xs"
            required
          />
        </Alan>

        {secilenTarih ? (
          haftaSonu ? (
            <p className="text-sm text-zinc-600">
              Seçilen tarih: <strong>{tarihGunleBicimle(secilenTarih)}</strong>.
              Grup bu gün toplanır; ikinci bir grup açılırsa aynı gün, farklı
              zaman diliminde olur.
            </p>
          ) : (
            <Bildirim tur="hata">
              {tarihGunleBicimle(secilenTarih)} bir hafta sonu değil. Kulüpler
              yalnızca cumartesi veya pazar yapılır.
            </Bildirim>
          )
        ) : null}

        <Alan
          etiket="Açıklama"
          ipucu="İsteğe bağlı."
          hata={durum.alanHatalari?.description}
        >
          <CokSatirli name="description" rows={2} />
        </Alan>
      </Kart>

      {/* --- Atölyeler --- */}
      <Kart className="space-y-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Atölyeler</h2>
          <span
            className={cn(
              "text-sm font-medium",
              atolyeTamam ? "text-emerald-700" : "text-vurgu-700",
            )}
          >
            {secilenAtolyeler.length} / {KULUP_ATOLYE_SAYISI} atölye seçildi
          </span>
        </div>

        <p className="text-sm text-zinc-600">
          Kulüpte tam {KULUP_ATOLYE_SAYISI} atölye yapılır. Aynı atölyeler
          kulübün bütün gruplarında uygulanır.
        </p>

        {atolyeler.length < KULUP_ATOLYE_SAYISI ? (
          <Bildirim tur="hata">
            Kulüp açmak için en az {KULUP_ATOLYE_SAYISI} aktif atölye çeşidi
            gerekiyor; şu an {atolyeler.length} tane var.
          </Bildirim>
        ) : (
          <ul className="space-y-1">
            {atolyeler.map((atolye) => {
              const secili = secilenAtolyeler.includes(atolye.id);
              const kilitli = !secili && atolyeTamam;

              return (
                <li key={atolye.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm",
                      secili
                        ? "bg-marka-50 text-marka-700"
                        : kilitli
                          ? "cursor-not-allowed text-zinc-300"
                          : "text-zinc-700 hover:bg-marka-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="atolyeler"
                      value={atolye.id}
                      checked={secili}
                      disabled={kilitli}
                      onChange={() => atolyeDegistir(atolye.id)}
                      className="size-4"
                    />
                    {atolye.name}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Kart>

      {/* --- İlk grup --- */}
      <Kart className="space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">İlk grup</h2>
        <p className="text-sm text-zinc-600">
          Kontenjan dolduğunda aynı kulübe yeni grup eklenebilir.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Grup adı" hata={durum.alanHatalari?.["grup.name"]}>
            <Girdi
              name="grupAdi"
              placeholder="Örn. Sabah Grubu"
              defaultValue="1. Grup"
              required
            />
          </Alan>

          <Alan etiket="Kontenjan" hata={durum.alanHatalari?.["grup.capacity"]}>
            <Girdi
              name="grupKontenjani"
              type="number"
              min={1}
              max={200}
              defaultValue={12}
              required
            />
          </Alan>

          <Alan
            etiket="Zaman dilimi"
            hata={durum.alanHatalari?.["grup.timeSlot"]}
          >
            <select
              name="grupZamanDilimi"
              defaultValue="OGLEDEN_ONCE"
              className="w-full rounded-md border border-yuzey-200 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100"
            >
              <option value="OGLEDEN_ONCE">Öğleden önce</option>
              <option value="OGLEDEN_SONRA">Öğleden sonra</option>
            </select>
          </Alan>
        </div>
      </Kart>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex flex-wrap items-center gap-3">
        <KaydetButonu etkin={atolyeTamam && haftaSonu} />
        {atolyeTamam && haftaSonu ? (
          <span className="text-sm text-zinc-500">
            {KULUP_ATOLYE_SAYISI} atölye oturumu oluşturulacak.
          </span>
        ) : (
          /* Dönem sihirbazıyla aynı gerekçe: eksiğin ne olduğu sayıyla
             yazılmazsa kilitli buton bozuk sanılıyor. */
          <span className="text-sm font-medium text-vurgu-700">
            {!haftaSonu ? "Hafta sonuna denk gelen bir tarih seçin" : null}
            {!haftaSonu && !atolyeTamam ? " · " : null}
            {!atolyeTamam
              ? `${KULUP_ATOLYE_SAYISI - secilenAtolyeler.length} atölye daha seçin`
              : null}
          </span>
        )}
      </div>
    </form>
  );
}
