import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { KURUM_ADI } from "@/lib/kurallar";
import { ortalamaBicimle } from "@/lib/puan-hesaplari";
import { tarihBicimle } from "@/lib/tarih";
import type { RaporGovdesi } from "@/lib/rapor-motoru";

/**
 * §11.5 — Rapor PDF'i.
 *
 * TÜRKÇE KARAKTERLER: `@react-pdf/renderer` yalnızca standart PDF fontlarıyla
 * gelir ve bunlar `ş, ğ, ı, İ` glifini içermez — gömülü font olmadan bu
 * harfler PDF'te kaybolur. Bu yüzden Noto Sans (SIL Open Font License)
 * `public/fonts` altında depoya dahil edildi ve burada gömülüyor. Font
 * dosyası çalışma anında indirilmiyor; yayın ortamında ağ erişimine
 * bağımlılık istenmiyor.
 */

let fontKayitli = false;

function fontuKaydet() {
  if (fontKayitli) return;

  const klasor = path.join(process.cwd(), "public", "fonts");

  Font.register({
    family: "NotoSans",
    fonts: [
      { src: path.join(klasor, "NotoSans-Regular.ttf") },
      { src: path.join(klasor, "NotoSans-Bold.ttf"), fontWeight: "bold" },
    ],
  });

  // Türkçe kelimeler tirelenerek bölünmesin; satır sonunda kelime bütün kalır.
  Font.registerHyphenationCallback((kelime) => [kelime]);

  fontKayitli = true;
}

const stil = StyleSheet.create({
  sayfa: {
    fontFamily: "NotoSans",
    fontSize: 10,
    lineHeight: 1.5,
    color: "#27272a",
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
  },
  kurum: { fontSize: 9, color: "#71717a", marginBottom: 2 },
  // Başlık 16 punto; sayfa genelindeki 1.5 satır yüksekliği bu boyutta alt
  // satıra taşıyordu, bu yüzden kendi satır yüksekliği veriliyor.
  baslik: {
    fontSize: 16,
    fontWeight: "bold",
    lineHeight: 1.25,
    marginBottom: 4,
  },
  altBaslik: { fontSize: 9, color: "#52525b", marginBottom: 14 },
  bolumBasligi: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  atolyeKarti: {
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 4,
  },
  atolyeBasligi: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  kucukMetin: { fontSize: 8, color: "#71717a", marginBottom: 6 },
  // Soru listesi içindeki konu başlığı ("İlgi ve Merak Alanları") —
  // bolumBasligi'nin küçük varyantı.
  kategoriBasligi: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#52525b",
    marginTop: 4,
    marginBottom: 2,
  },
  satir: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  soru: { flex: 1, paddingRight: 10, fontSize: 9 },
  puan: { width: 34, textAlign: "right", fontSize: 9 },
  paragraf: { marginTop: 6, textAlign: "justify" },
  genelParagraf: { marginBottom: 8, textAlign: "justify" },
  altBilgi: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    fontSize: 8,
    color: "#a1a1aa",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export function RaporBelgesi({
  govde,
  ogrenciAdi,
  kapsam,
  uretimZamani,
}: {
  govde: RaporGovdesi;
  ogrenciAdi: string;
  kapsam: string[];
  uretimZamani: Date;
}) {
  fontuKaydet();

  return (
    <Document
      title={`${ogrenciAdi} — Öğrenci Raporu`}
      author={KURUM_ADI}
      language="tr"
    >
      <Page size="A4" style={stil.sayfa}>
        <Text style={stil.kurum}>{KURUM_ADI}</Text>
        <Text style={stil.baslik}>{ogrenciAdi} — Öğrenci Raporu</Text>
        <Text style={stil.altBaslik}>
          Rapor tarihi: {tarihBicimle(uretimZamani)}
          {kapsam.length > 0 ? ` · Kapsam: ${kapsam.join(" · ")}` : ""}
        </Text>

        <Text style={stil.bolumBasligi}>Atölye bazlı sonuçlar</Text>

        {govde.analiz.atolyeler.map((atolye, sira) => (
          <View key={atolye.atolyeAdi} style={stil.atolyeKarti} wrap={false}>
            <Text style={stil.atolyeBasligi}>{atolye.atolyeAdi}</Text>
            <Text style={stil.kucukMetin}>
              Katıldığı oturum: {atolye.katildigiOturumSayisi} · Katılmadığı
              oturum: {atolye.katilmadigiOturumSayisi} · Değerlendirilen soru:{" "}
              {atolye.degerlendirilenSoruSayisi} · Genel ortalama:{" "}
              {ortalamaBicimle(atolye.genelOrtalama)}
            </Text>

            {atolye.soruOrtalamalari.map((soru, soruSira) => {
              // Konu başlığı değişince ara başlık girer; eski raporların
              // gövdesinde kategori alanı yok, `?? null` onları düz bırakır.
              const kategori = soru.kategori ?? null;
              const oncekiKategori =
                soruSira > 0
                  ? (atolye.soruOrtalamalari[soruSira - 1].kategori ?? null)
                  : null;

              return (
                <View key={soru.anahtar}>
                  {kategori && kategori !== oncekiKategori ? (
                    <Text style={stil.kategoriBasligi}>{kategori}</Text>
                  ) : null}
                  <View style={stil.satir}>
                    <Text style={stil.soru}>{soru.baslik ?? soru.soruMetni}</Text>
                    <Text style={stil.puan}>
                      {ortalamaBicimle(soru.ortalama)}
                    </Text>
                  </View>
                </View>
              );
            })}

            <Text style={stil.paragraf}>
              {govde.metin.atolyeler[sira]?.paragraf ?? ""}
            </Text>
          </View>
        ))}

        <Text style={stil.bolumBasligi}>Genel öğrenci değerlendirmesi</Text>
        {govde.metin.genelParagraflar.map((paragraf, sira) => (
          <Text key={sira} style={stil.genelParagraf}>
            {paragraf}
          </Text>
        ))}

        <View style={stil.altBilgi} fixed>
          <Text>
            {KURUM_ADI} · {ogrenciAdi} · {tarihBicimle(uretimZamani)}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
