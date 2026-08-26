import { MODELLER, metinUret } from "./openai-istemci";
import {
  bloklariCozumle,
  gozlemYeterliMi,
  ogrenciMetniCozumle,
  ogrenciMetniGirdisiYaz,
  BLOK_TALIMATI,
  PARAGRAF_TALIMATI,
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

  // Aynı veri bloğu iki isteme de gidiyor; yalnızca istenen çıktı farklı.
  const veri = ogrenciMetniGirdisiYaz(girdi);

  // PARALEL: iki çağrı arka arkaya yapılsaydı toplam süre yine tavanı
  // zorlardı. Birlikte gönderilince toplam, uzun olanın süresi kadar.
  const [paragrafSonucu, blokSonucu] = await Promise.all([
    metinUret({
      model: MODELLER.ogrenciMetni,
      talimat: PARAGRAF_TALIMATI,
      girdi: veri,
      // Dört düzyazı bölüm.
      enFazlaJeton: 2000,
    }),
    metinUret({
      model: MODELLER.ogrenciMetni,
      talimat: BLOK_TALIMATI,
      girdi: veri,
      // En fazla dört blok, her biri iki alanlı.
      enFazlaJeton: 2500,
    }),
  ]);

  // Paragraflar zorunlu: onlarsız gözlem bölümü kurulamaz.
  if (paragrafSonucu.durum !== "tamam") return paragrafSonucu;

  const paragraflar = ogrenciMetniCozumle(paragrafSonucu.metin);
  if (!paragraflar) {
    return {
      durum: "hata",
      mesaj:
        "Yapay zekâ beklenen biçimde yanıt vermedi. Tekrar deneyebilirsiniz.",
    };
  }

  // Bloklar İSTEĞE BAĞLI: blok çağrısı başarısız olsa da giriş, profil,
  // sonuç ve öneriler elde. Yarım bir bölüm, hiç bölüm olmamasından iyi ve
  // koordinatör düğmeye yeniden basarak blokları tamamlayabilir.
  const bloklar =
    blokSonucu.durum === "tamam" ? bloklariCozumle(blokSonucu.metin) : [];

  return { durum: "tamam", metin: { ...paragraflar, bloklar } };
}
