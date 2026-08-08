import { MODELLER, metinUret } from "./openai-istemci";
import {
  gozlemYeterliMi,
  ogrenciMetniCozumle,
  ogrenciMetniGirdisiYaz,
  OGRENCI_METNI_TALIMATI,
  type OgrenciMetni,
  type OgrenciMetniGirdisi,
} from "./ogrenci-metni-istem";

/**
 * Öğrenci gözlem raporunun üretimi — §11.2.B.
 *
 * İstem metni, girdi biçimi ve çıktı çözümlemesi `ogrenci-metni-istem.ts`
 * içinde saf fonksiyonlar olarak duruyor; burada yalnızca ağ çağrısı var.
 */

export type OgrenciMetniSonucu =
  | { durum: "tamam"; metin: OgrenciMetni }
  | { durum: "gozlem-yok" }
  | { durum: "anahtar-yok" }
  | { durum: "hata"; mesaj: string };

export async function ogrenciMetniUret(
  girdi: OgrenciMetniGirdisi,
): Promise<OgrenciMetniSonucu> {
  if (!gozlemYeterliMi(girdi)) return { durum: "gozlem-yok" };

  const sonuc = await metinUret({
    model: MODELLER.ogrenciMetni,
    talimat: OGRENCI_METNI_TALIMATI,
    girdi: ogrenciMetniGirdisiYaz(girdi),
    // Beş bölüm + dört beceri bloğu; JSON yükü de var.
    enFazlaJeton: 4000,
  });

  if (sonuc.durum !== "tamam") return sonuc;

  const cozulen = ogrenciMetniCozumle(sonuc.metin);
  if (!cozulen) {
    return {
      durum: "hata",
      mesaj:
        "Yapay zekâ beklenen biçimde yanıt vermedi. Tekrar deneyebilirsiniz.",
    };
  }

  return { durum: "tamam", metin: cozulen };
}
