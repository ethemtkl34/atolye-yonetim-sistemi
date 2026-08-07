"use client";

import { useActionState, useState } from "react";
import { GonderButonu } from "@/components/ui-istemci";
import { Alan, Bildirim, Buton, CokSatirli, Girdi } from "@/components/ui";
import { atolyeGuncelle, type EylemDurumu } from "../actions";

export function AtolyeDuzenleFormu({
  atolye,
}: {
  atolye: { id: string; name: string; description: string | null };
}) {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    atolyeGuncelle.bind(null, atolye.id),
    {},
  );
  const [gorulenBasari, setGorulenBasari] = useState(durum.basari);

  // Güncelleme başarılı olunca form kapanır ve başarı bildirimi görünür
  // (atolye-ekle-formu ile aynı desen). Bu olmadan bildirim yalnızca kapalı
  // dalda çizildiği için kullanıcı "Vazgeç"e basmadıkça hiç görünmüyordu.
  if (durum.basari !== gorulenBasari) {
    setGorulenBasari(durum.basari);
    if (durum.basari) setAcik(false);
  }

  if (!acik) {
    return (
      <div className="space-y-2">
        {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
        <Buton tur="ikincil" onClick={() => setAcik(true)}>
          Atölye bilgilerini düzenle
        </Buton>
      </div>
    );
  }

  return (
    <form action={eylem} className="space-y-4">
      {/* Genel hata (alan bazlı olmayan) da gösterilmeli; yoksa eylem
          başarısız olduğunda buton tıklanıyor ama hiçbir şey olmuyor gibi
          görünüyor. */}
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <Alan etiket="Atölye adı" hata={durum.alanHatalari?.name}>
        <Girdi
          name="name"
          defaultValue={durum.degerler?.name ?? atolye.name}
          autoFocus
          required
        />
      </Alan>

      <Alan
        etiket="Açıklama"
        ipucu="İsteğe bağlı."
        hata={durum.alanHatalari?.description}
      >
        <CokSatirli
          name="description"
          rows={2}
          defaultValue={durum.degerler?.description ?? atolye.description ?? ""}
        />
      </Alan>

      <div className="flex gap-2">
        <GonderButonu>Kaydet</GonderButonu>
        <Buton type="button" tur="ikincil" onClick={() => setAcik(false)}>
          Vazgeç
        </Buton>
      </div>
    </form>
  );
}
