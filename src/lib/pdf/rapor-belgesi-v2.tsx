import path from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { KURUM_ADI } from "@/lib/kurallar";
import { tarihBicimle } from "@/lib/tarih";
import type { BantBilgisi } from "@/lib/rapor-bantlari";
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
    color: GRAFIK_KIRMIZI,
    textAlign: "center",
    marginTop: 3,
  },
  cubukAdi: {
    fontSize: 6,
    color: "#3f3f46",
    textAlign: "center",
    lineHeight: 1.2,
    marginTop: 2,
  },

  // Kademe segmentleri (alan kutularında)
  segmentSatiri: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  segment: { width: 12, height: 8, marginRight: 2 },
  kademeEtiketi: {
    fontSize: 8,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  madde: { fontSize: 8.5, marginBottom: 2, paddingLeft: 8, lineHeight: 1.4 },
  kucuk: { fontSize: 8.5, color: "#52525b" },
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

/** Üç segment + etiket — alan kutularının içindeki satır gösterimi. */
function KademeSatiri({ bant }: { bant: BantBilgisi | null }) {
  if (!bant) {
    return (
      <View style={stil.segmentSatiri}>
        {[1, 2, 3].map((sira) => (
          <View key={sira} style={[stil.segment, { backgroundColor: "#ffffff" }]} />
        ))}
        <Text style={[stil.kademeEtiketi, { backgroundColor: "#ffffff", color: "#71717a" }]}>
          Değerlendirilmedi
        </Text>
      </View>
    );
  }
  return (
    <View style={stil.segmentSatiri}>
      {[1, 2, 3].map((sira) => (
        <View
          key={sira}
          style={[
            stil.segment,
            {
              backgroundColor: sira <= bant.dolu ? bant.renk : "#ffffff",
              borderWidth: 0.8,
              borderColor: bant.renk,
            },
          ]}
        />
      ))}
      <Text style={[stil.kademeEtiketi, { backgroundColor: bant.zemin, color: bant.renk }]}>
        {bant.etiket}
      </Text>
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
                            backgroundColor: seriSira === 0 ? bant.renk : "#ffffff",
                            borderWidth: seriSira === 0 ? 0 : 1.4,
                            borderColor: bant.renk,
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
            <Text style={stil.cubukAltEtiket}>
              {sutun.bantlar
                .map((bant) => bant?.etiket ?? "—")
                .join(" / ")}
            </Text>
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
// Sabit metinler — şablondaki kurumsal açıklamaların kademe diline uyarlanmış
// hâlleri. Puan/ondalık iddiası taşıyan ifadeler kullanılmaz; rapor veliye
// sayı göstermez.
// ---------------------------------------------------------------------------

const BECERILER_GENEL_BILGI = [
  "Çocukları bir bütün olarak ele almaya çalıştığımız atölye sistematiğimizde; sadece ilgi ve yetenek bazlı çalışma ve değerlendirmelerin, çocuğu tanımada ve gelişiminde yeterli olmayacağını biliyoruz. Bundan dolayı gerek atölye içeriklerini düzenlerken gerekse çocukları atölye içerisinde değerlendirirken her yönüyle ele alıyor ve bu kısmı önemsiyoruz.",
  "Çocuğunuzu atölye içerisindeki çalışmalara katılırken; beden dili, jest ve mimiği, içinde bulunduğu duygu ve sergilediği davranışlarla bütüncül olarak gözlemleyip raporumuzu bu kriterleri de esas alarak hazırladık.",
  "Bundan dolayı değerlendirme aşamamızın ilk kısmında çocuğunuzun duygusal, sosyal ve bilişsel becerilerinin değerlendirmesini sizlerle paylaşıyoruz.",
  "Aşağıdaki grafikte her alanın değerlendirmesi üç kademe (Düşük, Ortalama, Yüksek) üzerinden sunulmuştur; kademe, çubuğun yüksekliğinden ve renginden birlikte okunur. Değerlendirme, çocuğunuzun atölyeye katılan yaş grubuyla beraber o grubun genel ortalaması esas alınarak yapılmıştır.",
];

const BECERILER_NOT =
  "Grafikte bulunan alanlar ile ilgili açıklama ve öğrencinin değerlendirme neticesi, her alan özelinde aşağıda ayrı ayrı sunulmuştur.";

const ILGI_BASARI_GENEL_BILGI = [
  "Atölye dönemi boyunca yapılan gözlemler doğrultusunda; eğitmen ve yardımcı eğitmenlerden alınan veriler, çapraz teyitle kademe grafiğine dönüştürülmüştür. Bu grafikler, çocuğunuzun atölyede katıldığı programlara karşı olan ilgi düzeyleri ile bu atölyelerde sergilediği performans doğrultusunda sağladığı başarıyı yansıtmaktadır.",
  "Bu grafikler ayrı ayrı değerlendirildiğinde;",
  "– Atölye ilgi düzeyi grafiği; çocuğun gördüğü farklı başlıktaki atölyelerden her birine gösterdiği ilgiyi yansıtmaktadır. Bununla beraber eş zamanlı her atölyenin birbirine mukayeseli ilgi düzeylerini de göstermektedir.",
  "– Atölye başarı düzeyi grafiği; atölye kazanımları ön plana alındığında, her bir atölye için hedeflenen kazanımlara ne derece ulaşabildiği ve çocuğun bu kazanımları ne derece edindiği ile alakalı verileri sunmaktadır.",
];

const ILGI_YORUMU =
  "Her çocuk özeldir ve özel ilgi alanları vardır. İlgi alanları, çocuğu dinlendirir, eğlendirir ve zamanını kaliteli hale getirir ve çocuğun sağlıklı ruhsal gelişimi için gereklidir. Aynı zamanda ileriki yaşlarda arkadaş seçimi, kariyer, meslek tercihi gibi dönüm noktalarında yol gösterici olmaktadır. Bunları tespit etmenin en önemli yolu gözlem yapmaktır. Yukarıdaki grafik, öğrencinin atölye müddetince katıldığı dersleri ve o derslere olan ilgisinin düzeyini göstermektedir. Değerlendirme her öğrenci özelinde sadece öğrencinin kendi ilgi düzeyini göstermekte olup akran grubu veya sınıf içi kıyaslamayı kapsamamaktadır.";

const BASARI_YORUMU =
  "Çocuğun becerilerini geliştirebilmek adına yaptığı her şey başarıdır. Yukarıdaki grafik, öğrencinin atölyelerde başarılı olduğu alanların dağılımını göstermektedir. Atölye kapsamında öğrencinin başarısı, bir etkinliği belirli bir sürede, doğru bir şekilde gerçekleştirebilme kapasitesine göre değerlendirilmiştir. Değerlendirme her öğrenci özelinde sadece öğrencinin kendi başarı düzeyini göstermekte olup akran grubu veya sınıf içi kıyaslamayı kapsamamaktadır.";

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
            {govde.ogrenci.sinif ? (
              <View style={stil.kapakAlan}>
                <Text style={stil.kapakEtiket}>Sınıfı:</Text>
                <Text style={stil.kapakDeger}>{govde.ogrenci.sinif}</Text>
              </View>
            ) : null}
          </View>

          <Text style={stil.kapakGrup}>{grupAdi.toLocaleUpperCase("tr-TR")}</Text>
        </View>
      </Page>

      {/* ------------------------------------------------ Genel bilgilendirme */}
      <Page size="A4" style={stil.sayfa}>
        <SayfaCercevesi
          bolumBasligi="DEĞERLENDİRME RAPORU HAKKINDA GENEL BİLGİLENDİRME"
          altBilgi={altBilgi}
        />

        <Text style={stil.paragraf}>Değerli velimiz,</Text>
        <Text style={stil.paragraf}>
          Elinizdeki bu rapor, çocuğunuzun {programAdi} atölye çalışmaları
          neticesinde; eğitmen, psikolog ve yardımcı eğitmen gözlemleri göz
          önüne alınarak hazırlanmıştır. Rapor, çocuğunuzun katıldığı her bir
          atölyede sergilediği performansa göre oluşturulmuştur.
        </Text>
        <Text style={stil.paragraf}>
          Raporda çocuğunuzun atölyelere olan ilgi ve merak düzeyini,
          atölyelerde sergilediği başarıyı ve bunların yanında duygusal, sosyal
          ve bilişsel gelişimine olan katkısını bulacaksınız. Çocuğunuzun
          katıldığı her bir atölye ve etkinlikte gerek eğitmeni gerekse
          arkadaşları ile etkileşimi takip edilip gözlemlenerek oluşturulan bu
          raporda, sizlere neler sunulduğunu ve bu raporu okurken bahsedilen
          mevzuları nasıl anlamlandırmanız gerektiği ile alakalı yapılan
          açıklamaları dikkatlice okuyarak raporu buna bağlı değerlendirmenizi
          tavsiye ederiz.
        </Text>
        <Text style={stil.paragraf}>
          Atölye sürecinin sınırlı bir zaman diliminde yürütüldüğü ve gözlemin
          bu süre içindeki davranışları kapsadığı unutulmamalıdır. Rapor bir
          tanı aracı değil, çocuğunuzun bu süreçte neler yaptığını ve nasıl
          etkilendiğini gösteren bir değerlendirmedir.
        </Text>
        <Text style={stil.paragraf}>
          Sizlerle bir dönemi başarıyla tamamlamanın ve çocuklarımıza bu
          süreçte sağlamaya gayret ettiğimiz faydaların gerçekleşmiş olmasının
          mutluluğu ile ileriki yaşantılarınızda çocuklarınız ve sizlerin
          sağlıklı ve güzel günlerde kalmanızı dileriz.
        </Text>
        <Text style={stil.paragraf}>Saygılarımızla…</Text>
        <Text style={[stil.paragraf, { fontWeight: "bold" }]}>{KURUM_ADI}</Text>

        <View style={{ marginTop: 18 }} wrap={false}>
          <View style={stil.notlarBaslik}>
            <Text style={stil.notlarBaslikMetin}>NOTLAR:</Text>
          </View>
          <View style={stil.notSatiri}>
            <Text style={stil.notNumara}>1</Text>
            <Text style={stil.notMetin}>
              Değerlendirmeler üç kademe üzerinden sunulmuştur: Düşük, Ortalama
              ve Yüksek. Grafiklerde kademe hem çubuğun yüksekliğinden hem de
              renginden okunur; rapor veliye ham puan göstermez.
            </Text>
          </View>
          <View style={stil.notSatiri}>
            <Text style={stil.notNumara}>2</Text>
            <Text style={stil.notMetin}>
              Katılım sağlanmayan oturumlar değerlendirmeye dahil edilmemiştir.
            </Text>
          </View>
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
              <KademeGrafigi
                baslik="DUYGUSAL - SOSYAL - BİLİŞSEL BECERİLER GRAFİĞİ"
                sutunlar={govde.gelisimAlanlari.map((alan) => ({
                  ad: alanKisaAdi(alan.ad),
                  bantlar: [alan.bant],
                }))}
              />
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
                    <KademeSatiri bant={alan.bant} />
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
      {govde.atolyeKademeleri.length > 0 ? (
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
              <KademeGrafigi
                baslik="ÖĞRENCİNİN ATÖLYELERE OLAN İLGİ GRAFİĞİ"
                sutunlar={govde.atolyeKademeleri.map((atolye) => ({
                  ad: atolye.atolyeAdi,
                  bantlar: [atolye.ilgi],
                }))}
              />
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

            <KademeGrafigi
              baslik="ÖĞRENCİNİN ATÖLYELERDE SERGİLEDİĞİ BAŞARI GRAFİĞİ"
              sutunlar={govde.atolyeKademeleri.map((atolye) => ({
                ad: atolye.atolyeAdi,
                bantlar: [atolye.basari],
              }))}
            />

            <DikeyEtiketKutu
              etiket="EĞİTMENİN YORUMU"
              zemin={LAVANTA}
              etiketGenisligi={90}
              minYukseklik={100}
              cocuklar={
                <Text style={{ fontSize: 8.5, textAlign: "justify" }}>{BASARI_YORUMU}</Text>
              }
            />

            <KademeGrafigi
              baslik="ÖĞRENCİNİN ATÖLYELERE OLAN İLGİ VE ATÖLYELERDE SERGİLEDİĞİ BAŞARI DÜZEYİ KIYASLAMA GRAFİĞİ"
              sutunlar={govde.atolyeKademeleri.map((atolye) => ({
                ad: atolye.atolyeAdi,
                bantlar: [atolye.ilgi, atolye.basari],
              }))}
              seriAdlari={["İlgi", "Başarı"]}
            />

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
