"use client";

import { useState, useTransition } from "react";
import { Bildirim, Buton, Kart } from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import { adaySil } from "../actions";

/**
 * §16.11 — KVKK silme talebi.
 *
 * Kurumun aday verisini saklama dayanağı velinin açık rızası; rıza geri
 * çekilirse kaydın gitmesi gerekiyor. Aşamayı `KAYBEDILDI` yapmak veriyi
 * saklamaya devam eder ve talebi karşılamaz — bu yüzden ayrı bir düğme var.
 *
 * Sayfanın SONUNDA, ayrı ve kırmızı çerçeveli bir bölümde: silme geri
 * alınamaz ve aşama düğmelerinin yanında dururken yanlışlıkla tıklanmaya çok
 * yakın olurdu (`OgrenciSilButonu` ile aynı gerekçe).
 *
 * Dönüşmüş adayı sunucu zaten reddediyor; buton o durumda en baştan kilitli
 * ve sebebi yazılı — nasılsa reddedilecek bir eylem için önce onay sorup
 * sonra reddetmek güven kaybettirir.
 */
export function AdaySilButonu({
  adayId,
  ad,
  engelSebebi,
}: {
  adayId: string;
  ad: string;
  engelSebebi?: string;
}) {
  const [durum, setDurum] = useState<EylemDurumu>({});
  const [bekliyor, basla] = useTransition();

  function sil() {
    if (
      !window.confirm(
        `${ad} ve bütün görüşme geçmişi KALICI olarak silinecek. Bu işlem ` +
          `geri alınamaz ve yalnızca velinin KVKK rızasını geri çekmesi ` +
          `hâlinde yapılmalıdır.\n\nDevam edilsin mi?`,
      )
    ) {
      return;
    }

    basla(async () => setDurum(await adaySil(adayId)));
  }

  return (
    <Kart className="space-y-3 border-red-200 p-4">
      <div>
        <h2 className="text-base font-semibold text-red-800">
          KVKK silme talebi
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {engelSebebi ??
            "Veli rızasını geri çektiyse adayı ve görüşme geçmişini kalıcı olarak siler. Aşamayı “kaybedildi” yapmak veriyi saklamaya devam eder; silme talebini yalnızca bu düğme karşılar."}
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
        {bekliyor ? "Siliniyor…" : "Adayı kalıcı olarak sil"}
      </Buton>
    </Kart>
  );
}
