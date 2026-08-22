import path from "node:path";
import {
  Circle,
  Defs,
  Document,
  Ellipse,
  Font,
  Image,
  Page,
  RadialGradient,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { KURUM_ADI } from "@/lib/kurallar";
import { tarihBicimle } from "@/lib/tarih";
import { KADEMELER, type BantBilgisi, type Kademe } from "@/lib/rapor-bantlari";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";

/**
 * §11.5 — Rapor PDF'i, ikinci sürüm; kurum şablonuna göre dizilmiş hâli.
 *
 * TASARIM KAYNAĞI: public/marka/referans-rapor.pdf. Her sayfada antet
 * (TÜZDER solda, TEM sağda) ve tam genişlik alt bant; bölüm başlığı açık
 * mavi şerit; içerik kutuları dönüşümlü şeftali/lavanta zeminli ve sol
 * kenarında 90° döndürülmüş etiket taşıyor.
 *
 * GRAFİKLER: şablondaki çubuk grafikler elle çiziliyor (harici grafik
 * kütüphanesi @react-pdf içinde çalışmaz). Gövde veliye ham puan taşımadığı
 * için eksen üç kademelik: çubuğun yüksekliği (1–3 birim) ve rengi kademeyi
 * birlikte anlatır, çubuğun altında kademe adı yazar. Böylece kademenin iki
 * kanaldan (renk + yükseklik/segment) okunması özelliği siyah-beyaz
 * baskıda da korunur; sayı basılmaz.
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
  Font.registerHyphenationCallback((kelime) => [kelime]);
  fontKayitli = true;
}

const MARKA = path.join(process.cwd(), "public", "marka");

// Şablon renkleri — referans PDF'ten ölçüldü.
const SERIT_MAVI = "#DDEBF7";
const SEFTALI = "#FCE4D6";
const LAVANTA = "#D9E1F2";
const GRAFIK_KIRMIZI = "#C00000";
const METIN = "#27272a";

// A4 genişliği 595,28pt; altbant 1654×279px → tam genişlikte ~100pt yüksek.
const ALTBANT_YUKSEKLIK = 100;

const stil = StyleSheet.create({
  sayfa: {
    fontFamily: "NotoSans",
    fontSize: 9.5,
    lineHeight: 1.5,
    color: METIN,
    paddingTop: 122,
    paddingBottom: ALTBANT_YUKSEKLIK + 16,
    paddingHorizontal: 46,
  },
  kapakSayfa: {
    fontFamily: "NotoSans",
    color: METIN,
    paddingTop: 122,
    paddingBottom: ALTBANT_YUKSEKLIK + 16,
    paddingHorizontal: 60,
  },

  antet: {
    position: "absolute",
    top: 30,
    left: 46,
    right: 46,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  antetTuzder: { width: 157, height: 30, objectFit: "contain" },
  antetTem: { width: 86, height: 30, objectFit: "contain" },

  bolumSeridi: {
    position: "absolute",
    top: 86,
    left: 46,
    right: 46,
    backgroundColor: SERIT_MAVI,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  bolumSeridiMetin: {
    fontSize: 10.5,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1f2937",
  },

  altBant: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    width: "100%",
    height: ALTBANT_YUKSEKLIK,
  },
  altBilgi: {
    position: "absolute",
    bottom: ALTBANT_YUKSEKLIK + 2,
    right: 46,
    fontSize: 6.5,
    color: "#a1a1aa",
  },

  // Kapak
  kapakBlok: { marginTop: 60 },
  kapakBaslikSatiri: {
    fontSize: 17,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 1.55,
  },
  kapakRapor: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 90,
  },
  kapakAlanlar: { marginTop: 70, paddingHorizontal: 30 },
  kapakAlan: { flexDirection: "row", marginBottom: 8 },
  kapakEtiket: { width: 92, fontSize: 11 },
  kapakDeger: { fontSize: 11, fontWeight: "bold", flex: 1 },
  kapakGrup: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 80,
  },

  paragraf: { marginBottom: 7, textAlign: "justify" },

  // Dikey etiketli içerik kutusu
  kutu: {
    position: "relative",
    marginBottom: 12,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 40,
    paddingRight: 14,
  },
  kutuEtiketSutunu: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  kutuEtiketMetni: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#3f3f46",
    textAlign: "center",
    lineHeight: 1.25,
  },

  // Notlar kutusu (sayfa 2)
  notlarBaslik: {
    backgroundColor: SEFTALI,
    paddingVertical: 3,
    marginBottom: 2,
  },
  notlarBaslikMetin: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
  },
  notSatiri: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBF3EE",
    marginBottom: 2,
  },
  notNumara: {
    width: 20,
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "center",
    paddingVertical: 3,
    backgroundColor: SEFTALI,
  },
  notMetin: { flex: 1, fontSize: 8, paddingVertical: 3, paddingHorizontal: 6 },

  // Grafik
  grafikKutu: {
    borderWidth: 0.8,
    borderColor: "#d4d4d8",
    padding: 12,
    marginBottom: 12,
  },
  grafikBaslik: {
    fontSize: 10,
    fontWeight: "bold",
    color: GRAFIK_KIRMIZI,
    textAlign: "center",
    marginBottom: 12,
  },
  eksenSutunu: { width: 50, position: "relative" },
  eksenYazisi: {
    position: "absolute",
    right: 6,
    fontSize: 6,
    color: "#71717a",
    textAlign: "right",
    width: 44,
  },
  cizgi: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 0.7,
    backgroundColor: "#e4e4e7",
  },
  cubukAltEtiket: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
  },
  cubukAdi: {
    fontSize: 6,
    color: "#3f3f46",
    textAlign: "center",
    lineHeight: 1.2,
    marginTop: 2,
  },

  // Kademe skalası (alan kutularında): beyaz şerit içinde üç küre; sonuç
  // olan kademe halkalı ve renkli şerit etiketli, diğerleri soluk.
  skalaSatiri: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  skalaKutusu: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 0.8,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 10,
  },
  skalaSutunu: { width: 64, alignItems: "center" },
  skalaKureHucresi: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kademeSeridi: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 3,
  },
  skalaSolukEtiket: {
    fontSize: 8,
    color: "#a1a1aa",
    paddingVertical: 2,
  },
  madde: { fontSize: 8.5, marginBottom: 2, paddingLeft: 8, lineHeight: 1.4 },
  kucuk: { fontSize: 8.5, color: "#52525b" },

  // "Atölyelerde Gelişim" — öğrenciye özel atölye paragrafı + küre skalası.
  // Onaylanan taslağın ölçüleri; ilgi/merak göstergeleri atölye kutusunun
  // DIŞINDA ayrı kutuda durur (kullanıcı kararı).
  atolyeGirisi: { fontSize: 9, color: "#52525b", marginBottom: 10 },
  atolyeKutu: {
    flexDirection: "row",
    backgroundColor: SEFTALI,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  atolyeSol: { flex: 1 },
  atolyeAd: { fontSize: 10.5, fontWeight: "bold", marginBottom: 4 },
  atolyeMetin: { fontSize: 8.8, lineHeight: 1.55, textAlign: "justify" },
  atolyeSag: { width: 176, alignItems: "center", justifyContent: "center" },
  atolyeSagBaslik: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#3f3f46",
    letterSpacing: 0.6,
    marginBottom: 5,
    textAlign: "center",
    width: 176,
  },
  atolyeKatilimNotu: {
    fontSize: 7,
    color: "#71717a",
    marginTop: 5,
    textAlign: "center",
    width: 176,
  },
  darSkalaKutusu: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 0.8,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 4,
  },
  darSkalaSutunu: { width: 50, alignItems: "center" },
  ilgiKutu: { backgroundColor: LAVANTA, borderRadius: 6, padding: 12, marginBottom: 12 },
  ilgiBaslik: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  ilgiAciklama: { fontSize: 8, color: "#52525b", marginBottom: 8 },
  ilgiSatir: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ilgiHucre: {
    width: 92,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  ilgiAtolyeAdi: {
    fontSize: 7,
    textAlign: "center",
    lineHeight: 1.2,
    marginBottom: 5,
    minHeight: 16,
  },
  ilgiEtiket: { fontSize: 7.5, fontWeight: "bold", marginTop: 4 },
});

// ---------------------------------------------------------------------------
// Sayfa iskeleti
// ---------------------------------------------------------------------------

/** Her sayfada tekrarlanan antet, bölüm şeridi ve alt bant. */
function SayfaCercevesi({
  bolumBasligi,
  altBilgi,
}: {
  bolumBasligi?: string;
  altBilgi: string;
}) {
  return (
    <>
      <View style={stil.antet} fixed>
        <Image src={path.join(MARKA, "tuzder.png")} style={stil.antetTuzder} />
        <Image src={path.join(MARKA, "tem.png")} style={stil.antetTem} />
      </View>
      {bolumBasligi ? (
        <View style={stil.bolumSeridi} fixed>
          <Text style={stil.bolumSeridiMetin}>{bolumBasligi}</Text>
        </View>
      ) : null}
      <Text style={stil.altBilgi} fixed>
        {altBilgi}
      </Text>
      <Image
        src={path.join(MARKA, "altbant.png")}
        style={stil.altBant}
        fixed
      />
    </>
  );
}

/**
 * Şablonun içerik kutusu: renkli zemin, sol kenarda 90° döndürülmüş etiket.
 *
 * Döndürülmüş metnin yerleşim kutusu yatay ölçülür; konteyner ortalayıp
 * merkez etrafında çevirdiği için görsel yükseklik = metin genişliği olur.
 * `etiketGenisligi` bu yüzden kutunun beklenen yüksekliğinden küçük
 * seçilmeli; uzun etiketler `minHeight` ile güvenceye alınır.
 */
function DikeyEtiketKutu({
  etiket,
  zemin,
  etiketGenisligi = 130,
  minYukseklik = 0,
  cocuklar,
}: {
  etiket: string;
  zemin: string;
  etiketGenisligi?: number;
  minYukseklik?: number;
  cocuklar: React.ReactNode;
}) {
  return (
    <View
      style={[stil.kutu, { backgroundColor: zemin, minHeight: minYukseklik }]}
      wrap={false}
    >
      <View style={stil.kutuEtiketSutunu}>
        <Text
          style={[
            stil.kutuEtiketMetni,
            { width: etiketGenisligi, transform: "rotate(-90deg)" },
          ]}
        >
          {etiket}
        </Text>
      </View>
      {cocuklar}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Kademe göstergeleri
// ---------------------------------------------------------------------------

/**
 * Kademelerin PDF'e özgü görünümü — kurumun "Uyum Tablosu" malzemesindeki
 * parlak küre diline uyarlandı: yeşil büyük küre Yüksek, altın orta küre
 * Ortalama, kırmızı küçük küre Düşük.
 *
 * Renk paleti burada yerel; `rapor-bantlari.ts`'teki renkler ekran (web)
 * gösterimini besliyor ve o dosya korunuyor. Kademe yine iki kanaldan
 * okunur: kürenin ÇAPI kademeyle büyür ve etiket metni her zaman yazılır —
 * siyah-beyaz baskıda renk kaybolsa da bilgi ayakta kalır.
 */
const KADEME_GORUNUMU: Record<
  Kademe,
  { acik: string; orta: string; koyu: string; cap: number }
> = {
  YUKSEK: { acik: "#8fe39a", orta: "#1f9d3a", koyu: "#0d6b22", cap: 24 },
  ORTALAMA: { acik: "#ffdf8a", orta: "#eda800", koyu: "#a86f00", cap: 18 },
  DUSUK: { acik: "#ff9e8e", orta: "#d81e10", koyu: "#8f0e05", cap: 12 },
};

/** Parlak küre — radyal geçiş + sol üstte ışık lekesi. `soluk` seçilmemiş
 *  kademeler için: aynı küre, iyice şeffaflaştırılmış. */
function KademeTopu({
  kademe,
  cap,
  soluk = false,
}: {
  kademe: Kademe;
  cap: number;
  soluk?: boolean;
}) {
  const gorunum = KADEME_GORUNUMU[kademe];
  // Gradyan kimliği kademe + durum bazlı benzersiz; tanımlar çakışmasın.
  const kimlik = `top-${kademe}-${soluk ? "s" : "n"}`;

  return (
    <Svg width={cap} height={cap} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={kimlik} cx="38%" cy="32%" r="80%">
          <Stop offset="0%" stopColor={gorunum.acik} />
          <Stop offset="55%" stopColor={gorunum.orta} />
          <Stop offset="100%" stopColor={gorunum.koyu} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="46" fill={`url(#${kimlik})`} fillOpacity={soluk ? 0.18 : 1} />
      <Ellipse
        cx="36"
        cy="27"
        rx="17"
        ry="11"
        fill="#ffffff"
        fillOpacity={soluk ? 0.25 : 0.5}
      />
    </Svg>
  );
}

/** "4,4" — puanların rapora basılış biçimi (bir ondalık, virgüllü). */
function puanBicimle(deger: number): string {
  return deger.toFixed(1).replace(".", ",");
}

/** Skaladaki soldan sağa sıra: gelişim yönünde Düşük → Yüksek. */
const SKALA_SIRASI: Kademe[] = ["DUSUK", "ORTALAMA", "YUKSEK"];

/**
 * Alan kutularındaki gösterge: üç kürelik skala, beyaz yuvarlak bir şerit
 * içinde kutunun ortasında. Üç kademe de görünür; sonuç olan kademe tam
 * renkli, halkalı ve altında renkli şerit etiketiyle işaretli, diğerleri
 * soluk. İşaret üç kanaldan okunur — halka, etiket şeridi ve soluk/dolu
 * farkı — bu yüzden siyah-beyaz baskıda da kaybolmaz.
 */
function KademeSkalasi({
  bant,
  dar = false,
}: {
  bant: BantBilgisi | null;
  /** Atölye kutusunun sağ sütununa sığan sıkışık ölçüler. */
  dar?: boolean;
}) {
  return (
    <View style={dar ? undefined : stil.skalaSatiri}>
      <View style={dar ? stil.darSkalaKutusu : stil.skalaKutusu}>
        {SKALA_SIRASI.map((kademe) => {
          const gorunum = KADEME_GORUNUMU[kademe];
          const secili = bant?.kademe === kademe;

          return (
            <View key={kademe} style={dar ? stil.darSkalaSutunu : stil.skalaSutunu}>
              {/* Küre hücresi sabit yükseklikte; halka yalnızca seçilende. */}
              <View
                style={
                  secili
                    ? [
                        stil.skalaKureHucresi,
                        {
                          borderWidth: 1.6,
                          borderColor: gorunum.koyu,
                          borderRadius: 17,
                          backgroundColor: "#ffffff",
                        },
                      ]
                    : stil.skalaKureHucresi
                }
              >
                <KademeTopu kademe={kademe} cap={gorunum.cap} soluk={!secili} />
              </View>
              {secili ? (
                <Text style={[stil.kademeSeridi, { backgroundColor: gorunum.orta }]}>
                  {KADEMELER[kademe].etiket}
                </Text>
              ) : (
                <Text style={stil.skalaSolukEtiket}>{KADEMELER[kademe].etiket}</Text>
              )}
            </View>
          );
        })}
      </View>
      {!bant ? (
        <Text style={[stil.kucuk, { marginLeft: 10 }]}>Değerlendirilmedi</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Çubuk grafik
// ---------------------------------------------------------------------------

const ADIM = 30; // bir kademe basamağının yüksekliği (pt)
const PLOT = ADIM * 3;

type GrafikSutunu = {
  ad: string;
  /** Tek çubuk için bir, kıyaslama için iki bant. */
  bantlar: (BantBilgisi | null)[];
};

/**
 * Şablondaki çubuk grafiklerin el çizimi karşılığı.
 *
 * Kıyaslama grafiğinde birinci seri dolu, ikinci seri beyaz zeminli
 * çerçeveli çizilir; iki seri renk dışında bir kanalla da ayrışır ve
 * gri tonlamalı baskıda okunur kalır.
 */
function KademeGrafigi({
  baslik,
  sutunlar,
  seriAdlari,
}: {
  baslik: string;
  sutunlar: GrafikSutunu[];
  seriAdlari?: [string, string];
}) {
  const kademeCizgileri = [
    { yukseklik: ADIM, ad: "Düşük" },
    { yukseklik: ADIM * 2, ad: "Ortalama" },
    { yukseklik: ADIM * 3, ad: "Yüksek" },
  ];

  return (
    <View style={stil.grafikKutu} wrap={false}>
      <Text style={stil.grafikBaslik}>{baslik}</Text>

      <View style={{ flexDirection: "row" }}>
        <View style={[stil.eksenSutunu, { height: PLOT }]}>
          {kademeCizgileri.map((cizgi) => (
            <Text
              key={cizgi.ad}
              style={[stil.eksenYazisi, { bottom: cizgi.yukseklik - 3 }]}
            >
              {cizgi.ad}
            </Text>
          ))}
        </View>

        <View style={{ flex: 1, height: PLOT, position: "relative" }}>
          <View style={[stil.cizgi, { bottom: 0, backgroundColor: "#a1a1aa" }]} />
          {kademeCizgileri.map((cizgi) => (
            <View key={cizgi.ad} style={[stil.cizgi, { bottom: cizgi.yukseklik }]} />
          ))}

          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              flexDirection: "row",
            }}
          >
            {sutunlar.map((sutun) => (
              <View
                key={sutun.ad}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                {sutun.bantlar.map((bant, seriSira) => (
                  <View
                    key={seriSira}
                    style={
                      bant
                        ? {
                            width: 16,
                            marginHorizontal: 2,
                            height: bant.dolu * ADIM,
                            backgroundColor:
                              seriSira === 0
                                ? KADEME_GORUNUMU[bant.kademe].orta
                                : "#ffffff",
                            borderWidth: seriSira === 0 ? 0 : 1.4,
                            borderColor: KADEME_GORUNUMU[bant.kademe].orta,
                          }
                        : {
                            width: 16,
                            marginHorizontal: 2,
                            height: 1.5,
                            backgroundColor: "#a1a1aa",
                          }
                    }
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", marginLeft: 50 }}>
        {sutunlar.map((sutun) => (
          <View key={sutun.ad} style={{ flex: 1, paddingHorizontal: 2 }}>
            {/* Etiket rengi kademeyi izler: yeşil çubuğun altında yeşil
                "Yüksek". Kıyaslama grafiğinde iki etiket yan yana, her biri
                kendi kademesinin renginde. */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                flexWrap: "wrap",
                marginTop: 3,
              }}
            >
              {sutun.bantlar.map((bant, seriSira) => (
                <Text
                  key={seriSira}
                  style={[
                    stil.cubukAltEtiket,
                    {
                      color: bant ? KADEME_GORUNUMU[bant.kademe].koyu : "#71717a",
                    },
                  ]}
                >
                  {seriSira > 0 ? " / " : ""}
                  {bant?.etiket ?? "—"}
                </Text>
              ))}
            </View>
            <Text style={stil.cubukAdi}>
              {sutun.ad.toLocaleUpperCase("tr-TR")}
            </Text>
          </View>
        ))}
      </View>

      {seriAdlari ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <View style={{ width: 10, height: 10, backgroundColor: "#52525b", marginRight: 3 }} />
          <Text style={{ fontSize: 7, marginRight: 12 }}>{seriAdlari[0]} (dolu)</Text>
          <View
            style={{
              width: 10,
              height: 10,
              borderWidth: 1.4,
              borderColor: "#52525b",
              backgroundColor: "#ffffff",
              marginRight: 3,
            }}
          />
          <Text style={{ fontSize: 7 }}>{seriAdlari[1]} (çerçeveli)</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 5'lik puan grafiği
// ---------------------------------------------------------------------------

const PUAN_ADIMI = 22; // 1 puanlık basamağın yüksekliği (pt)
const PUAN_PLOT = PUAN_ADIMI * 5;

// Örnek raporun beceriler grafiğindeki seri renkleri (öğrenci / grup).
const OGRENCI_MAVI = "#4472C4";
const GRUP_TURUNCU = "#ED7D31";

type PuanSutunu = {
  ad: string;
  /** Sütundaki çubuklar; iki serili grafikte [öğrenci, grup] ya da
   *  [ilgi, başarı]. null değer çubuk çizdirmez, "—" basılır. */
  degerler: (number | null)[];
  /** Kademe renkli grafiklerde çubuğun rengini veren bantlar. */
  bantlar?: (BantBilgisi | null)[];
};

/**
 * Şablondaki 5 puanlık çubuk grafik: eksen 0–5, değer etiketi çubuğun
 * altında kırmızı ve bir ondalıklı (NOTLAR kutusundaki "5 puan üzerinden"
 * açıklamasının karşılığı).
 *
 * İki kip:
 * - `seriRenkleri` verilirse çubuklar o sabit renklerle çizilir (örnekteki
 *   öğrenci/grup kıyası) ve değer etiketleri seri rengini alır.
 * - Verilmezse çubuk rengini kademe paleti belirler; `cerceveliIkinci`
 *   ikinci seriyi beyaz zeminli çerçeveli çizer (ilgi/başarı kıyası) ki
 *   seriler gri baskıda da ayrışsın. Sayı etiketi her zaman ikinci kanaldır.
 */
function PuanGrafigi({
  baslik,
  sutunlar,
  seriRenkleri,
  seriAdlari,
  cerceveliIkinci = false,
}: {
  baslik: string;
  sutunlar: PuanSutunu[];
  seriRenkleri?: string[];
  seriAdlari?: string[];
  cerceveliIkinci?: boolean;
}) {
  const cubukRengi = (sutun: PuanSutunu, seri: number): string =>
    seriRenkleri?.[seri] ??
    (sutun.bantlar?.[seri] ? KADEME_GORUNUMU[sutun.bantlar[seri]!.kademe].orta : "#a1a1aa");

  return (
    <View style={stil.grafikKutu} wrap={false}>
      <Text style={stil.grafikBaslik}>{baslik}</Text>

      <View style={{ flexDirection: "row" }}>
        <View style={[stil.eksenSutunu, { height: PUAN_PLOT }]}>
          {[1, 2, 3, 4, 5].map((puan) => (
            <Text
              key={puan}
              style={[stil.eksenYazisi, { bottom: puan * PUAN_ADIMI - 3 }]}
            >
              {puan},00
            </Text>
          ))}
        </View>

        <View style={{ flex: 1, height: PUAN_PLOT, position: "relative" }}>
          <View style={[stil.cizgi, { bottom: 0, backgroundColor: "#a1a1aa" }]} />
          {[1, 2, 3, 4, 5].map((puan) => (
            <View key={puan} style={[stil.cizgi, { bottom: puan * PUAN_ADIMI }]} />
          ))}

          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              flexDirection: "row",
            }}
          >
            {sutunlar.map((sutun) => (
              <View
                key={sutun.ad}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                {sutun.degerler.map((deger, seri) =>
                  deger === null ? (
                    <View
                      key={seri}
                      style={{
                        width: 15,
                        marginHorizontal: 2,
                        height: 1.5,
                        backgroundColor: "#a1a1aa",
                      }}
                    />
                  ) : (
                    <View
                      key={seri}
                      style={{
                        width: 15,
                        marginHorizontal: 2,
                        height: Math.max(2, (Math.min(deger, 5) / 5) * PUAN_PLOT),
                        backgroundColor:
                          cerceveliIkinci && seri > 0 ? "#ffffff" : cubukRengi(sutun, seri),
                        borderWidth: cerceveliIkinci && seri > 0 ? 1.4 : 0,
                        borderColor: cubukRengi(sutun, seri),
                      }}
                    />
                  ),
                )}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", marginLeft: 50 }}>
        {sutunlar.map((sutun) => (
          <View key={sutun.ad} style={{ flex: 1, paddingHorizontal: 2 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                flexWrap: "wrap",
                marginTop: 3,
              }}
            >
              {sutun.degerler.map((deger, seri) => (
                <Text
                  key={seri}
                  style={[
                    stil.cubukAltEtiket,
                    {
                      color: seriRenkleri?.[seri] ?? GRAFIK_KIRMIZI,
                    },
                  ]}
                >
                  {seri > 0 ? "  " : ""}
                  {deger === null ? "—" : puanBicimle(deger)}
                </Text>
              ))}
            </View>
            <Text style={stil.cubukAdi}>{sutun.ad.toLocaleUpperCase("tr-TR")}</Text>
          </View>
        ))}
      </View>

      {seriAdlari ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          {seriAdlari.map((ad, seri) => (
            <View
              key={ad}
              style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 6 }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  marginRight: 3,
                  backgroundColor:
                    cerceveliIkinci && seri > 0
                      ? "#ffffff"
                      : (seriRenkleri?.[seri] ?? "#52525b"),
                  borderWidth: cerceveliIkinci && seri > 0 ? 1.4 : 0,
                  borderColor: "#52525b",
                }}
              />
              <Text style={{ fontSize: 7 }}>{ad}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sabit metinler — örnek rapordan alınmış kurumsal açıklamalar.
// ---------------------------------------------------------------------------

// Örnek rapordan birebir alınmış sabit giriş metni.
const BECERILER_GENEL_BILGI = [
  "Çocukları bir bütün olarak ele almaya çalıştığımız atölye sistematiğimizde; sadece ilgi ve yetenek bazlı çalışma ve değerlendirmelerin, çocuğu tanımada ve gelişiminde yeterli olmayacağını biliyoruz. Bundan dolayı gerek atölye içeriklerini düzenlerken gerekse çocukları atölye içerisinde değerlendirirken her yönüyle ele alıyor ve bu kısmı önemsiyoruz.",
  "Çocuğu atölye içerisindeki çalışmalara katılırken; beden dili, jest mimiği, içinde bulunduğu duygu ve sergilediği davranışlarla bütüncül olarak gözlemleyip raporumuzu bu kriterleri de esas alarak hazırladık.",
  "Bundan dolayı değerlendirme aşamamızın ilk kısmında çocuğunuzun duygusal, sosyal ve bilişsel becerilerinin değerlendirmesini sizlerle paylaşıyoruz.",
  "Bu değerlendirmede çocuğunuzun her beceri alanında çeşitli kazanım başlıklarında hem bireysel hem de kendi yaş grubunda bulunan akranları ile karşılaştırmalı durumunu göreceksiniz.",
  "Bu değerlendirme ile her alanın detaylarını, ilgili başlıkta verilen kazanımların durumunu görmüş olacaksınız.",
  "Bu aşamadaki değerlendirmelerin çıktı olan netice puan ve karşılığının atölyeye katılan grupla beraber o yaş grubunun kabul gören genel ortalaması esas alınarak sonuç yazılmıştır.",
];

const BECERILER_NOT =
  "Grafikte bulunan alanlar ile ilgili açıklama ve öğrencinin değerlendirme neticesi, her alan özelinde aşağıda ayrı ayrı sunulmuştur.";

const ILGI_BASARI_GENEL_BILGI = [
  "Atölye dönemi boyunca yapılan gözlemler doğrultusunda; eğitmen ve yardımcı eğitmenlerden alınan veriler, çapraz teyitle karnelendirme programında puanlama grafiğine dönüştürülmüştür. Bu grafikler, çocuğunuzun atölyede katıldığı programlara karşı olan ilgi düzeyleri ile bu atölyelerde sergilediği performans doğrultusunda sağladığı başarıyı yansıtmaktadır.",
  "Bu grafikler ayrı ayrı değerlendirildiğinde;",
  "– Atölye ilgi düzeyi grafiği; çocuğun gördüğü farklı başlıktaki atölyelerden her birine gösterdiği ilgiyi yansıtmaktadır. Bununla beraber eş zamanlı her atölyenin birbirine mukayeseli ilgi düzeylerini de göstermektedir.",
  "– Atölye başarı düzeyi grafiği; atölye kazanımları ön plana alındığında, her bir atölye için hedeflenen kazanımlara ne derece ulaşabildiği ve çocuğun bu kazanımları ne derece edindiği ile alakalı verileri sunmaktadır.",
];

const ILGI_YORUMU =
  "Her çocuk özeldir ve özel ilgi alanları vardır. İlgi alanları, çocuğu dinlendirir, eğlendirir ve zamanını kaliteli hale getirir ve çocuğun sağlıklı ruhsal gelişimi için gereklidir. Aynı zamanda ileriki yaşlarda arkadaş seçimi, kariyer, meslek tercihi gibi dönüm noktalarında yol gösterici olmaktadır. Bunları tespit etmenin en önemli yolu gözlem yapmaktır. Yukarıdaki grafik, öğrencinin atölye müddetince katıldığı dersleri ve o derslere olan ilgisinin düzeyini göstermektedir. Değerlendirme her öğrenci özelinde sadece öğrencinin kendi ilgi düzeyini göstermekte olup akran grubu veya sınıf içi kıyaslamayı kapsamamaktadır.";

const BASARI_YORUMU =
  "Çocuğun becerilerini geliştirebilmek adına yaptığı her şey başarıdır. Yukarıdaki grafik, öğrencinin atölyelerde başarılı olduğu alanların dağılımını göstermektedir. Atölye kapsamında öğrencinin başarısı, bir etkinliği belirli bir sürede, doğru bir şekilde gerçekleştirebilme kapasitesine göre değerlendirilmiştir. Değerlendirme her öğrenci özelinde sadece öğrencinin kendi başarı düzeyini göstermekte olup akran grubu veya sınıf içi kıyaslamayı kapsamamaktadır.";

/** Kutulu (grafiksiz) atölye sayfasının yorum girişi — grafik diline atıf
 *  yapmaz; grafikli eski snapshot sayfaları ASIMETRI_GIRISI ile basılmayı
 *  sürdürür. */
const ASIMETRI_GIRISI_KUTULU =
  "Her bir atölye özelinde ilgi ve başarı düzeylerinin birlikte okunması, gelişimin bütüncül değerlendirilmesi açısından fayda sağlayacaktır. Bir atölye özelinde ilgi ve başarı düzeyleri arasında asimetrik bir değişim varsa bunun bu dönemki değerlendirmesi şu şekildedir:";

const ASIMETRI_GIRISI =
  "Her bir atölye özelinde bakıldığında, grafikte meydana gelmiş farklılıkları anlamlandırmak adına ilgi ve başarı düzeylerinin birlikte okunması fayda sağlayacaktır. Bir atölye özelinde ilgi ve başarı grafikleri arasında asimetrik bir değişim varsa bunun bu dönemki değerlendirmesi şu şekildedir:";

const ASIMETRI_YOK =
  "Bu dönem yapılan değerlendirmede öğrencinin ilgi ve başarı düzeyleri arasında belirgin bir asimetri gözlenmemiştir; iki düzey atölyeler genelinde birbirini destekler görünümdedir.";

// ---------------------------------------------------------------------------
// Belge
// ---------------------------------------------------------------------------

/** "Duygusal Gelişim Alanları" → "DUYGUSAL ALAN" (grafik sütunu adı). */
function alanKisaAdi(ad: string): string {
  return ad.replace(/\s*Gelişim Alanları\s*/i, " ").trim() + " Alan";
}

/** "Duygusal Gelişim Alanları" → "DUYGUSAL BECERİLER ALANI" (kutu etiketi). */
function alanKutuEtiketi(ad: string): string {
  const kok = ad.replace(/\s*Gelişim Alanları\s*/i, "").trim();
  return `${kok} Beceriler Alanı`.toLocaleUpperCase("tr-TR");
}

export function RaporBelgesiV2({
  govde,
  uretimZamani,
}: {
  govde: RaporGovdesiV2;
  uretimZamani: Date;
}) {
  fontuKaydet();

  const programAdi = govde.kapsam[0]?.programAdi ?? "atölye";
  const altBilgi = `${KURUM_ADI} · ${govde.ogrenci.adSoyad} · ${tarihBicimle(uretimZamani)}`;
  const grupAdi = govde.kapsam.map((k) => k.grupAdi).join(" · ");

  const katilmayanlar = govde.atolyeKademeleri.filter(
    (a) => a.katilmadigiOturumSayisi > 0,
  );

  // "10 hafta" ifadeleri dönem raporlarına ait; birkaç günlük kulüp
  // raporunda aynı iddia veliye yanlış bilgi olurdu.
  const donemMi = govde.kapsam.some((k) => k.tur === "Dönem");

  // Ham ortalama taşıyan (yeni) snapshot'larda 5'lik puan grafikleri çizilir;
  // eski snapshot'lar kademe eksenli grafiklerle basılmaya devam eder.
  const sayisalAtolyeVerisiVar = govde.atolyeKademeleri.some(
    (a) =>
      typeof a.ilgiOrtalamasi === "number" ||
      typeof a.basariOrtalamasi === "number",
  );
  // Öğrenciye özel atölye paragrafı taşıyan (en yeni) snapshot'larda atölye
  // bölümü kutulu "Atölyelerde Gelişim" tasarımıyla basılır; grafikli eski
  // sayfalar yalnızca metinsiz eski snapshot'lar için kalır (§13.17).
  const atolyeMetinleriVar = govde.atolyeKademeleri.some(
    (a) => typeof a.metin === "string" && a.metin.length > 0,
  );

  const sayisalVeriVar =
    sayisalAtolyeVerisiVar ||
    govde.gelisimAlanlari.some(
      (alan) => typeof alan.ogrenciOrtalamasi === "number",
    );

  return (
    <Document
      title={`${govde.ogrenci.adSoyad} — Öğrenci Değerlendirme Raporu`}
      author={KURUM_ADI}
      language="tr"
    >
      {/* ------------------------------------------------ Kapak */}
      <Page size="A4" style={stil.kapakSayfa}>
        <SayfaCercevesi altBilgi={altBilgi} />

        <View style={stil.kapakBlok}>
          <Text style={stil.kapakBaslikSatiri}>
            {govde.egitimYili ? `${govde.egitimYili} EĞİTİM YILI\n` : ""}
            {programAdi.toLocaleUpperCase("tr-TR")}
            {"\n"}ATÖLYE ÇALIŞMALARI
          </Text>

          <Text style={stil.kapakRapor}>ÖĞRENCİ DEĞERLENDİRME RAPORU</Text>

          <View style={stil.kapakAlanlar}>
            <View style={stil.kapakAlan}>
              <Text style={stil.kapakEtiket}>Öğrenci Adı:</Text>
              <Text style={stil.kapakDeger}>{govde.ogrenci.adSoyad}</Text>
            </View>
            {/* Şablon gereği satır her raporda durur; sınıf girilmemişse boş
                kalır (örnek raporla birebir). */}
            <View style={stil.kapakAlan}>
              <Text style={stil.kapakEtiket}>Sınıfı:</Text>
              <Text style={stil.kapakDeger}>{govde.ogrenci.sinif ?? ""}</Text>
            </View>
          </View>

          <Text style={stil.kapakGrup}>
            {(govde.subeAdi ?? grupAdi).toLocaleUpperCase("tr-TR")}
          </Text>
        </View>
      </Page>

      {/* ------------------------------------------------ Genel bilgilendirme */}
      <Page size="A4" style={stil.sayfa}>
        <SayfaCercevesi
          bolumBasligi="DEĞERLENDİRME RAPORU HAKKINDA GENEL BİLGİLENDİRME"
          altBilgi={altBilgi}
        />

        {/* Bu sayfanın tamamı kurumun örnek raporundan birebir alınmış sabit
            metindir; yalnızca eğitim yılı ve program adı raporun verisinden
            gelir. Değişiklik isteği örnek raporla birlikte gelmeli. */}
        <Text style={stil.paragraf}>Değerli velimiz;</Text>
        <Text style={stil.paragraf}>
          Elinizde bulunan bu raporun, çocuğunuzun
          {govde.egitimYili ? ` ${govde.egitimYili} Eğitim Öğretim Yılı` : ""}{" "}
          TÜZDER {programAdi} atölye çalışmaları neticesinde; eğitmen, psikolog
          ile yardımcı eğitmen gözlemleri ve görüşleri göz önüne alınarak
          hazırlandığını hatırlatmak isteriz.
        </Text>
        <Text style={stil.paragraf}>
          Rapor, çocuğunuzun atölyeye katılmış olduğu
          {donemMi ? " 10 haftalık " : " "}süreçte, katıldığı her bir atölyede
          sergilediği performansa göre oluşturulmuştur. Çocuğunuzun katıldığı her bir atölye ve etkinlikte
          gerek öğretmeni gerekse arkadaşları ile etkileşimi takip edilip
          gözlemlenerek oluşturulan bu raporda, sizlere neler sunulduğunu ve bu
          raporu okurken bahsedilen mevzuları nasıl anlamlandırmanız gerektiği
          ile alakalı yapılan açıklamaları dikkatlice okuyarak raporu buna
          bağlı değerlendirmenizi tavsiye ederiz.
        </Text>
        <Text style={stil.paragraf}>
          Unutulmamalıdır ki bu rapor; TÜZDER uzmanları tarafından uzunca
          süredir tecrübe edilen ve TEM&apos;in (TÜZDER Eğitim Metodu) bir parçası
          olan özel bir raporlama programı ile hazırlanmış olup oluşabilecek
          kişisel (eğitmen, psikolog, yardımcı eğitmen gibi) hataları en aza
          indirmek üzere çapraz kontrol ile oluşturulmuştur. Her ne kadar
          raporun sistematik kontrole sahip olması hataları en aza indirgese
          de bu gözlem sürecinin yoğun okul dönemi içerisinde devam ettiği
          ve{donemMi ? " 10 hafta gibi" : ""} sınırlı bir süre içerisinde
          yürütülüyor olmasının rapora olabilecek etkileri unutulmamalıdır.
        </Text>
        <Text style={stil.paragraf}>
          Bu rapor; atölye sürecini özetleyen, çocuğunuzun bu atölye sürecinde
          neler yaptığını ve nasıl etkilendiğini gösteren gözlemleri ve bu
          gözlemlere bağlı olarak gerek bireysel gerekse yaş grubunda yer alan
          ilgili başlıklardaki gelişimlerini sunmaktadır.
        </Text>
        <Text style={stil.paragraf}>
          En nihayetinde rapordan maksadımız; geçirilen süreçte çocuklarımızın
          duygusal, sosyal, bilişsel becerilerinin gözlemlenerek hem bireysel
          hem de grup içindeki gelişiminin ortaya konulması, bununla beraber
          bu süreçte, her atölye özelinde verilmek istenen kazanımların ne
          kadarının hangi düzeyde sağlanabildiğini göstermektir.
        </Text>
        <Text style={stil.paragraf}>
          Bu rapor; çocuğunuzun atölyede elde ettiği verimi, mutluluğu ve
          faydayı görmeniz açısından sizler için bir değerlendirme
          niteliğindedir. Çocuğunuzun atölyelerin her birine olan ilgi ve merak
          düzeyini, atölyelerde sergilediği başarıyı ve bunların yanında
          duygusal, sosyal ve bilişsel gelişimine olan katkısını sizlere
          sunmaktadır.
        </Text>
        <Text style={stil.paragraf}>
          Sizlerle bir dönemi başarıyla tamamlamanın ve çocuklarımıza bu
          süreçte sağlamaya gayret ettiğimiz faydaların gerçekleşmiş olmasının
          mutluğu ile ileriki yaşantılarınızda çocuklarınız ve sizlerin
          sağlıklı ve güzel günlerde kalmanızı dileriz.
        </Text>
        <Text style={stil.paragraf}>Saygılarımızla…</Text>
        <Text style={[stil.paragraf, { fontWeight: "bold" }]}>{KURUM_ADI}</Text>

        <View style={{ marginTop: 18 }} wrap={false}>
          <View style={stil.notlarBaslik}>
            <Text style={stil.notlarBaslikMetin}>NOTLAR:</Text>
          </View>
          {/* Eski snapshot'lar kademe eksenli grafik basar; "5 puan
              üzerinden" notu orada belgeyle çelişirdi. Not yalnızca sayısal
              grafik basılacaksa görünür (Not 2'deki desenle aynı). */}
          {sayisalVeriVar ? (
            <View style={stil.notSatiri}>
              <Text style={stil.notNumara}>1</Text>
              <Text style={stil.notMetin}>
                Grafiklerin değerlendirmesi 5 (beş) puan üzerinden yapılmıştır.
                (1: Desteklenmeli, 5: İleri Düzey)
              </Text>
            </View>
          ) : null}
          {govde.grupOgrenciSayisi ? (
            <View style={stil.notSatiri}>
              <Text style={stil.notNumara}>2</Text>
              <Text style={stil.notMetin}>
                Bu raporlamada ilgili yaş düzeyinde değerlendirilen grubun
                öğrenci sayısı
              </Text>
              <Text
                style={{
                  fontSize: 8.5,
                  fontWeight: "bold",
                  paddingHorizontal: 10,
                }}
              >
                {govde.grupOgrenciSayisi}
              </Text>
            </View>
          ) : null}
        </View>
      </Page>

      {/* ------------------------------------------------ Atölyeler ve içerikleri */}
      {govde.atolyeIcerikleri.length > 0 ? (
        <Page size="A4" style={stil.sayfa}>
          <SayfaCercevesi
            bolumBasligi="ATÖLYELER VE İÇERİKLERİ HAKKINDA"
            altBilgi={altBilgi}
          />
          {govde.atolyeIcerikleri.map((atolye, sira) => (
            <DikeyEtiketKutu
              key={atolye.atolyeAdi}
              etiket={atolye.atolyeAdi.toLocaleUpperCase("tr-TR")}
              zemin={sira % 2 === 0 ? SEFTALI : LAVANTA}
              minYukseklik={110}
              etiketGenisligi={100}
              cocuklar={<Text style={{ fontSize: 9 }}>{atolye.metin}</Text>}
            />
          ))}
        </Page>
      ) : null}

      {/* ------------------------------------------------ Beceriler: giriş + grafik */}
      {govde.gelisimAlanlari.length > 0 ? (
        <>
          <Page size="A4" style={stil.sayfa}>
            <SayfaCercevesi
              bolumBasligi="ATÖLYELERDEKİ SOSYAL - DUYGUSAL VE BİLİŞSEL BECERİLER RAPORU"
              altBilgi={altBilgi}
            />

            <DikeyEtiketKutu
              etiket="BU KISIM HAKKINDA GENEL BİLGİ"
              zemin={SEFTALI}
              etiketGenisligi={150}
              minYukseklik={160}
              cocuklar={
                <>
                  {BECERILER_GENEL_BILGI.map((paragraf) => (
                    <Text key={paragraf.slice(0, 24)} style={[stil.paragraf, { fontSize: 8.5 }]}>
                      {paragraf}
                    </Text>
                  ))}
                </>
              }
            />

            <View style={{ marginTop: 10 }}>
              {/* Ham ortalama taşıyan raporlarda örnekteki 5'lik öğrenci-grup
                  kıyas grafiği; taşımayan eski snapshot'larda kademe ekseni. */}
              {govde.gelisimAlanlari.some(
                (alan) => typeof alan.ogrenciOrtalamasi === "number",
              ) ? (
                <PuanGrafigi
                  baslik="DUYGUSAL - SOSYAL - BİLİŞSEL BECERİLER GRAFİĞİ"
                  sutunlar={govde.gelisimAlanlari.map((alan) => ({
                    ad: alanKisaAdi(alan.ad),
                    degerler: [
                      alan.ogrenciOrtalamasi ?? null,
                      alan.grupOrtalamasi ?? null,
                    ],
                  }))}
                  seriRenkleri={[OGRENCI_MAVI, GRUP_TURUNCU]}
                  seriAdlari={["Öğrenci Ortalaması", "Grup Ortalaması"]}
                />
              ) : (
                <KademeGrafigi
                  baslik="DUYGUSAL - SOSYAL - BİLİŞSEL BECERİLER GRAFİĞİ"
                  sutunlar={govde.gelisimAlanlari.map((alan) => ({
                    ad: alanKisaAdi(alan.ad),
                    bantlar: [alan.bant],
                  }))}
                />
              )}
            </View>

            <DikeyEtiketKutu
              etiket="NOT"
              zemin={LAVANTA}
              etiketGenisligi={30}
              minYukseklik={40}
              cocuklar={<Text style={{ fontSize: 8.5 }}>{BECERILER_NOT}</Text>}
            />
          </Page>

          {/* ------------------------------------------------ Beceriler: alan kutuları */}
          <Page size="A4" style={stil.sayfa}>
            <SayfaCercevesi
              bolumBasligi="ATÖLYELERDEKİ SOSYAL - DUYGUSAL VE BİLİŞSEL BECERİLER RAPORU"
              altBilgi={altBilgi}
            />
            {govde.gelisimAlanlari.map((alan, sira) => (
              <DikeyEtiketKutu
                key={alan.ad}
                etiket={alanKutuEtiketi(alan.ad)}
                zemin={sira % 2 === 0 ? LAVANTA : SEFTALI}
                etiketGenisligi={150}
                minYukseklik={165}
                cocuklar={
                  <>
                    <Text style={[stil.kucuk, { marginBottom: 3 }]}>
                      Bu rapor kapsamında bu alan içerisinde ele alınan
                      kazanımlar şunlardır:
                    </Text>
                    {alan.kazanimlar.map((kazanim) => (
                      <Text key={kazanim} style={stil.madde}>
                        – {kazanim}
                      </Text>
                    ))}
                    <Text style={[stil.kucuk, { marginTop: 5 }]}>
                      Bu kazanımlar çerçevesinde çocuğunuzun almış olduğu
                      değerlendirme şu şekildedir:
                    </Text>
                    <KademeSkalasi bant={alan.bant} />
                    {alan.cumle ? (
                      <Text style={{ fontSize: 8.5, marginTop: 6, textAlign: "justify" }}>
                        {alan.cumle}
                      </Text>
                    ) : null}
                  </>
                }
              />
            ))}
          </Page>
        </>
      ) : null}

      {/* ------------------------------------------------ İlgi ve başarı */}
      {govde.atolyeKademeleri.length > 0 && atolyeMetinleriVar ? (
        <Page size="A4" style={stil.sayfa}>
          <SayfaCercevesi
            bolumBasligi="ATÖLYELERDE GELİŞİM"
            altBilgi={altBilgi}
          />

          <Text style={stil.atolyeGirisi}>
            Bu bölümde öğrencinizin her atölyedeki durumu, dönem boyunca
            eğitmen değerlendirmelerinden elde edilen puanlamalara dayanılarak
            özetlenmiştir. Kazanımlara ulaşma düzeyi üç kademeli skalada
            gösterilir; değerlendirme akran kıyaslaması içermez.
          </Text>

          {govde.atolyeKademeleri.map((atolye) => (
            <View key={atolye.atolyeAdi} style={stil.atolyeKutu} wrap={false}>
              <View style={stil.atolyeSol}>
                <Text style={stil.atolyeAd}>{atolye.atolyeAdi}</Text>
                {atolye.metin ? (
                  <Text style={stil.atolyeMetin}>{atolye.metin}</Text>
                ) : null}
              </View>
              <View style={stil.atolyeSag}>
                <Text style={stil.atolyeSagBaslik}>KAZANIMLARA ULAŞMA</Text>
                <KademeSkalasi bant={atolye.basari} dar />
                <Text style={stil.atolyeKatilimNotu}>
                  {atolye.katildigiOturumSayisi + atolye.katilmadigiOturumSayisi}
                  {" oturumun "}
                  {atolye.katildigiOturumSayisi}
                  {"'ine katıldı"}
                </Text>
              </View>
            </View>
          ))}

          <View style={stil.ilgiKutu} wrap={false}>
            <Text style={stil.ilgiBaslik}>İlgi ve Merak Alanları</Text>
            <Text style={stil.ilgiAciklama}>
              Öğrencinizin her atölyeye duyduğu ilgi ve merak düzeyi aşağıda
              özetlenmiştir.
            </Text>
            <View style={stil.ilgiSatir}>
              {govde.atolyeKademeleri.map((atolye) => {
                const kisaAd = atolye.atolyeAdi.replace(/ Atölyesi$/u, "");
                if (!atolye.ilgi) {
                  return (
                    <View key={atolye.atolyeAdi} style={stil.ilgiHucre}>
                      <Text style={stil.ilgiAtolyeAdi}>{kisaAd}</Text>
                      <Text style={stil.skalaSolukEtiket}>Değerlendirilmedi</Text>
                    </View>
                  );
                }
                const gorunum = KADEME_GORUNUMU[atolye.ilgi.kademe];
                return (
                  <View key={atolye.atolyeAdi} style={stil.ilgiHucre}>
                    <Text style={stil.ilgiAtolyeAdi}>{kisaAd}</Text>
                    <KademeTopu kademe={atolye.ilgi.kademe} cap={gorunum.cap} />
                    <Text style={[stil.ilgiEtiket, { color: gorunum.koyu }]}>
                      {atolye.ilgi.etiket}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <DikeyEtiketKutu
            etiket="EĞİTMENİN YORUMU"
            zemin={SEFTALI}
            etiketGenisligi={90}
            minYukseklik={90}
            cocuklar={
              <>
                <Text style={[stil.paragraf, { fontSize: 8.5 }]}>
                  {ASIMETRI_GIRISI_KUTULU}
                </Text>
                {govde.asimetriler.length > 0 ? (
                  govde.asimetriler.map((asimetri) => (
                    <Text
                      key={asimetri.atolyeAdi}
                      style={[stil.paragraf, { fontSize: 8.5 }]}
                    >
                      – {asimetri.cumle}
                    </Text>
                  ))
                ) : (
                  <Text style={[stil.paragraf, { fontSize: 8.5 }]}>
                    {ASIMETRI_YOK}
                  </Text>
                )}
                {katilmayanlar.map((atolye) => (
                  <Text key={atolye.atolyeAdi} style={[stil.kucuk, { fontSize: 7.5 }]}>
                    {atolye.atolyeAdi}: {atolye.katilmadigiOturumSayisi} oturuma
                    katılım sağlanmamış ve bu oturumlar değerlendirmeye dahil
                    edilmemiştir.
                  </Text>
                ))}
              </>
            }
          />
        </Page>
      ) : null}

      {govde.atolyeKademeleri.length > 0 && !atolyeMetinleriVar ? (
        <>
          <Page size="A4" style={stil.sayfa}>
            <SayfaCercevesi
              bolumBasligi="ATÖLYELERDEKİ İLGİ VE BAŞARI DÜZEYİ DEĞERLENDİRME RAPORU"
              altBilgi={altBilgi}
            />

            <DikeyEtiketKutu
              etiket="BU KISIM HAKKINDA GENEL BİLGİ"
              zemin={SEFTALI}
              etiketGenisligi={150}
              minYukseklik={160}
              cocuklar={
                <>
                  {ILGI_BASARI_GENEL_BILGI.map((paragraf) => (
                    <Text key={paragraf.slice(0, 24)} style={[stil.paragraf, { fontSize: 8.5 }]}>
                      {paragraf}
                    </Text>
                  ))}
                </>
              }
            />

            <View style={{ marginTop: 10 }}>
              {sayisalAtolyeVerisiVar ? (
                <PuanGrafigi
                  baslik="ÖĞRENCİNİN ATÖLYELERE OLAN İLGİ GRAFİĞİ"
                  sutunlar={govde.atolyeKademeleri.map((atolye) => ({
                    ad: atolye.atolyeAdi,
                    degerler: [atolye.ilgiOrtalamasi ?? null],
                    bantlar: [atolye.ilgi],
                  }))}
                />
              ) : (
                <KademeGrafigi
                  baslik="ÖĞRENCİNİN ATÖLYELERE OLAN İLGİ GRAFİĞİ"
                  sutunlar={govde.atolyeKademeleri.map((atolye) => ({
                    ad: atolye.atolyeAdi,
                    bantlar: [atolye.ilgi],
                  }))}
                />
              )}
            </View>

            <DikeyEtiketKutu
              etiket="EĞİTMENİN YORUMU"
              zemin={LAVANTA}
              etiketGenisligi={100}
              minYukseklik={110}
              cocuklar={
                <Text style={{ fontSize: 8.5, textAlign: "justify" }}>{ILGI_YORUMU}</Text>
              }
            />
          </Page>

          <Page size="A4" style={stil.sayfa}>
            <SayfaCercevesi
              bolumBasligi="ATÖLYELERDEKİ İLGİ VE BAŞARI DÜZEYİ DEĞERLENDİRME RAPORU"
              altBilgi={altBilgi}
            />

            {sayisalAtolyeVerisiVar ? (
              <PuanGrafigi
                baslik="ÖĞRENCİNİN ATÖLYELERDE SERGİLEDİĞİ BAŞARI GRAFİĞİ"
                sutunlar={govde.atolyeKademeleri.map((atolye) => ({
                  ad: atolye.atolyeAdi,
                  degerler: [atolye.basariOrtalamasi ?? null],
                  bantlar: [atolye.basari],
                }))}
              />
            ) : (
              <KademeGrafigi
                baslik="ÖĞRENCİNİN ATÖLYELERDE SERGİLEDİĞİ BAŞARI GRAFİĞİ"
                sutunlar={govde.atolyeKademeleri.map((atolye) => ({
                  ad: atolye.atolyeAdi,
                  bantlar: [atolye.basari],
                }))}
              />
            )}

            <DikeyEtiketKutu
              etiket="EĞİTMENİN YORUMU"
              zemin={LAVANTA}
              etiketGenisligi={90}
              minYukseklik={100}
              cocuklar={
                <Text style={{ fontSize: 8.5, textAlign: "justify" }}>{BASARI_YORUMU}</Text>
              }
            />

            {sayisalAtolyeVerisiVar ? (
              <PuanGrafigi
                baslik="ÖĞRENCİNİN ATÖLYELERE OLAN İLGİ VE ATÖLYELERDE SERGİLEDİĞİ BAŞARI DÜZEYİ KIYASLAMA GRAFİĞİ"
                sutunlar={govde.atolyeKademeleri.map((atolye) => ({
                  ad: atolye.atolyeAdi,
                  degerler: [
                    atolye.ilgiOrtalamasi ?? null,
                    atolye.basariOrtalamasi ?? null,
                  ],
                  bantlar: [atolye.ilgi, atolye.basari],
                }))}
                seriAdlari={["İlgi (dolu)", "Başarı (çerçeveli)"]}
                cerceveliIkinci
              />
            ) : (
              <KademeGrafigi
                baslik="ÖĞRENCİNİN ATÖLYELERE OLAN İLGİ VE ATÖLYELERDE SERGİLEDİĞİ BAŞARI DÜZEYİ KIYASLAMA GRAFİĞİ"
                sutunlar={govde.atolyeKademeleri.map((atolye) => ({
                  ad: atolye.atolyeAdi,
                  bantlar: [atolye.ilgi, atolye.basari],
                }))}
                seriAdlari={["İlgi", "Başarı"]}
              />
            )}

            <DikeyEtiketKutu
              etiket="EĞİTMENİN YORUMU"
              zemin={SEFTALI}
              etiketGenisligi={90}
              minYukseklik={100}
              cocuklar={
                <>
                  <Text style={[stil.paragraf, { fontSize: 8.5 }]}>{ASIMETRI_GIRISI}</Text>
                  {govde.asimetriler.length > 0 ? (
                    govde.asimetriler.map((asimetri) => (
                      <Text
                        key={asimetri.atolyeAdi}
                        style={[stil.paragraf, { fontSize: 8.5 }]}
                      >
                        – {asimetri.cumle}
                      </Text>
                    ))
                  ) : (
                    <Text style={[stil.paragraf, { fontSize: 8.5 }]}>{ASIMETRI_YOK}</Text>
                  )}
                  {katilmayanlar.map((atolye) => (
                    <Text key={atolye.atolyeAdi} style={[stil.kucuk, { fontSize: 7.5 }]}>
                      {atolye.atolyeAdi}: {atolye.katilmadigiOturumSayisi} oturuma
                      katılım sağlanmamış ve bu oturumlar değerlendirmeye dahil
                      edilmemiştir.
                    </Text>
                  ))}
                </>
              }
            />
          </Page>
        </>
      ) : null}

      {/* ------------------------------------------------ Gözlem raporu */}
      {govde.gozlem ? (
        <Page size="A4" style={stil.sayfa}>
          <SayfaCercevesi
            bolumBasligi="EĞİTMEN VE YARDIMCI EĞİTMEN GÖZLEM RAPORU"
            altBilgi={altBilgi}
          />

          <Text style={stil.paragraf}>{govde.gozlem.giris}</Text>
          <Text style={stil.paragraf}>{govde.gozlem.profil}</Text>

          {govde.gozlem.bloklar.map((blok, sira) => (
            <DikeyEtiketKutu
              key={blok.beceriAdi}
              etiket={blok.beceriAdi.toLocaleUpperCase("tr-TR")}
              zemin={sira % 2 === 0 ? SEFTALI : LAVANTA}
              etiketGenisligi={110}
              minYukseklik={120}
              cocuklar={
                <>
                  {blok.tanim ? (
                    <Text style={[stil.kucuk, { marginBottom: 4 }]}>{blok.tanim}</Text>
                  ) : null}
                  {blok.etkinlik ? (
                    <Text style={[stil.paragraf, { fontSize: 8.5 }]}>{blok.etkinlik}</Text>
                  ) : null}
                  <Text style={{ fontSize: 8.5, textAlign: "justify" }}>{blok.gozlem}</Text>
                </>
              }
            />
          ))}

          <DikeyEtiketKutu
            etiket="SONUÇ"
            zemin={LAVANTA}
            etiketGenisligi={50}
            minYukseklik={60}
            cocuklar={
              <Text style={{ fontSize: 8.5, textAlign: "justify" }}>
                {govde.gozlem.sonuc}
              </Text>
            }
          />

          <DikeyEtiketKutu
            etiket="EV ORTAMINDA ÖNERİLER"
            zemin={SEFTALI}
            etiketGenisligi={110}
            minYukseklik={120}
            cocuklar={
              <>
                <Text style={{ fontSize: 8.5, textAlign: "justify" }}>
                  {govde.gozlem.oneriler}
                </Text>
                {govde.gozlem.urunler.length > 0 ? (
                  <>
                    <Text style={[stil.kucuk, { marginTop: 5, marginBottom: 2 }]}>
                      Önerilen materyaller:
                    </Text>
                    {govde.gozlem.urunler.map((urun) => (
                      <Text key={urun.url} style={stil.madde}>
                        – {urun.ad}
                      </Text>
                    ))}
                  </>
                ) : null}
              </>
            }
          />
        </Page>
      ) : null}
    </Document>
  );
}
