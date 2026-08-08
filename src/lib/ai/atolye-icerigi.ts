import { MODELLER, metinUret, type UretimSonucu } from "./openai-istemci";
import {
  atolyeIcerikGirdisiYaz,
  mufredatYeterliMi,
  TALIMAT,
  type AtolyeIcerikGirdisi,
} from "./atolye-icerigi-metni";

/**
 * Atölye içerik paragrafının üretimi — §11.2.
 *
 * İstem metni ve yeterlilik kontrolü `atolye-icerigi-metni.ts` içinde saf
 * fonksiyonlar olarak duruyor; burada yalnızca ağ çağrısı var.
 */

export type AtolyeIcerikSonucu = UretimSonucu | { durum: "mufredat-yetersiz" };

export async function atolyeIcerigiUret(
  girdi: AtolyeIcerikGirdisi,
): Promise<AtolyeIcerikSonucu> {
  if (!mufredatYeterliMi(girdi.haftalar)) {
    return { durum: "mufredat-yetersiz" };
  }

  return metinUret({
    model: MODELLER.atolyeIcerigi,
    talimat: TALIMAT,
    girdi: atolyeIcerikGirdisiYaz(girdi),
    // 150 kelimelik bir paragraf için fazlasıyla yeterli; model uzun
    // yazmaya kalkarsa da fatura kontrolde kalır.
    enFazlaJeton: 800,
  });
}
