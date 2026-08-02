"use client";

import { useState, useTransition } from "react";
import { Bildirim, Buton, Kart } from "@/components/ui";
import { ogrenciSil, type EylemDurumu } from "./actions";

/**
 * Öğrenciyi kalıcı silme — düzenleme ekranının sonunda, ayrı bir bölümde.
 *
 * Profil sayfasında değil: silme geri alınamaz ve okuma ekranında yanlışlıkla
 * tıklanmaya çok yakın durur. Düzenleme ekranına geçmek zaten bilinçli bir
 * adım.
 *
 * Engel varsa buton en baştan kilitli ve sebep yazılı — eylem nasılsa
 * reddedecekken kullanıcıya önce onay sorup sonra reddetmek güven kaybettirir
 * (grup ekleme ve stajyer kadrosu formlarındaki ilkeyle aynı).
 */
export function OgrenciSilButonu({
  ogrenciId,
  ad,
  engelSebebi,
}: {
  ogrenciId: string;
  ad: string;
  engelSebebi?: string;
}) {
  const [durum, setDurum] = useState<EylemDurumu>({});
  const [bekliyor, basla] = useTransition();

  function sil() {
    if (
      !window.confirm(
        `${ad} kalıcı olarak silinecek. Veli ve sağlık bilgileri ile varsa program kayıtları da gider; bu işlem geri alınamaz.\n\nDevam edilsin mi?`,
      )
    ) {
      return;
    }

    basla(async () => setDurum(await ogrenciSil(ogrenciId)));
  }

  return (
    <Kart className="space-y-3 border-red-200 p-4">
      <div>
        <h2 className="text-base font-semibold text-red-800">Öğrenciyi sil</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {engelSebebi ??
            "Yanlışlıkla eklenmiş öğrenciyi kalıcı olarak siler. Veli ve sağlık bilgileri ile varsa program kayıtları da silinir; işlem geri alınamaz."}
        </p>
      </div>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <Buton
        type="button"
        tur="tehlike"
        onClick={sil}
        disabled={bekliyor || Boolean(engelSebebi)}
        engelSebebi={engelSebebi}
      >
        {bekliyor ? "Siliniyor…" : "Öğrenciyi kalıcı olarak sil"}
      </Buton>
    </Kart>
  );
}
