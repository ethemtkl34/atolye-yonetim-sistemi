"use client";

import { useActionState, useState } from "react";
import { GonderButonu } from "@/components/ui-istemci";
import { Alan, Bildirim, Buton, CokSatirli, Girdi, Kart } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import { atolyeEkle } from "./actions";

export function AtolyeEkleFormu() {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(atolyeEkle, {});
  const [acik, setAcik] = useState(false);
  const [gorulenBasari, setGorulenBasari] = useState(durum.basari);

  // Ekleme başarılı olunca panel kapanır. Bu, effect yerine render sırasında
  // yapılıyor: React'in önerdiği yol bu ve zincirleme render yaratmıyor.
  // Panel kapanınca form DOM'dan kalkar, bir sonraki açılışta boş gelir —
  // ayrıca temizlemeye gerek yok.
  if (durum.basari !== gorulenBasari) {
    setGorulenBasari(durum.basari);
    if (durum.basari) setAcik(false);
  }

  if (!acik) {
    return (
      <div className="space-y-3">
        {durum.basari ? (
          <Bildirim tur="basari">{durum.basari}</Bildirim>
        ) : null}
        <Buton onClick={() => setAcik(true)}>Yeni atölye ekle</Buton>
      </div>
    );
  }

  return (
    <Kart className="p-4">
      <form action={eylem} className="space-y-4">
        <Alan etiket="Atölye adı" hata={durum.alanHatalari?.name}>
          <Girdi name="name" defaultValue={durum.degerler?.name} autoFocus required />
        </Alan>

        <Alan
          etiket="Açıklama"
          ipucu="İsteğe bağlı."
          hata={durum.alanHatalari?.description}
        >
          <CokSatirli
            name="description"
            rows={2}
            defaultValue={durum.degerler?.description}
          />
        </Alan>

        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        <div className="flex gap-2">
          <GonderButonu bekleyenEtiket="Ekleniyor…">Atölye ekle</GonderButonu>
          <Buton type="button" tur="ikincil" onClick={() => setAcik(false)}>
            Vazgeç
          </Buton>
        </div>
      </form>
    </Kart>
  );
}
