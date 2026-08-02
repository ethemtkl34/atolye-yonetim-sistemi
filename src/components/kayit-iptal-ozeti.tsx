import type { CancelReason } from "@/generated/prisma/enums";
import { Rozet } from "@/components/ui";
import {
  IPTAL_SEBEPLERI,
  atolyeOzeti,
  ayrilmaMetni,
} from "@/lib/kayit-iptal";

export type IptalBilgisi = {
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  lastAttendedWeek: number | null;
  lastAttendedDate: Date | null;
  /** Katılım işaretli puanlama sayısı. */
  tamamlananAtolye: number;
  /** Grubun toplam atölye oturumu sayısı. */
  toplamAtolye: number;
};

/**
 * İptal edilmiş kaydın özeti: neden, ne zaman ayrıldığı ve kaç atölyeyi
 * tamamlayabildiği.
 *
 * Kayıtlar listesinde ve öğrenci profilinde aynı blok görünüyor; iki yerde
 * ayrı yazılsaydı biri güncellenip diğeri geride kalırdı. Atölye sayıları
 * saklanmıyor, mevcut puanlamalardan türetiliyor (bkz. `atolyeOzeti`).
 */
export function KayitIptalOzeti({ kayit }: { kayit: IptalBilgisi }) {
  const ayrilma = kayit.cancelReason ? ayrilmaMetni(kayit) : null;

  return (
    <div className="mt-2 rounded-md border border-yuzey-200 bg-yuzey-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {kayit.cancelReason ? (
          <Rozet tur="uyari">{IPTAL_SEBEPLERI[kayit.cancelReason]}</Rozet>
        ) : (
          <Rozet tur="pasif">Sebep girilmemiş</Rozet>
        )}
        {ayrilma ? (
          <span className="text-sm text-zinc-700">{ayrilma}</span>
        ) : null}
      </div>

      {kayit.cancelNote ? (
        <p className="mt-1.5 text-sm text-zinc-600">{kayit.cancelNote}</p>
      ) : null}

      <p className="mt-1.5 text-xs text-zinc-600">
        {atolyeOzeti(kayit.tamamlananAtolye, kayit.toplamAtolye)}
      </p>
    </div>
  );
}
