import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { KURUM_ADI } from "@/lib/kurallar";
import { tarihBicimle } from "@/lib/tarih";
import type { BantBilgisi } from "@/lib/rapor-bantlari";
import type { RaporGovdesiV2 } from "@/lib/rapor-govdesi";

/**
 * §11.5 — Rapor PDF'i, ikinci sürüm.
 *
 * BİRİNCİ SÜRÜMDEN FARKI: veliye ham puan basılmıyor. Soru bazlı ortalama
 * listesi kalktı; yerine kademe göstergeleri, atölye içerik paragrafları ve
 * eğitmen gözlemi geldi.
 *
 * Kademe İKİ kanaldan gösteriliyor — renk ve dolu segment sayısı. Bu
 * belgenin siyah-beyaz basılacağı varsayılmalı; renk kaybolduğunda kademe
 * segmentlerden okunabiliyor.
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

const stil = StyleSheet.create({
  sayfa: {
    fontFamily: "NotoSans",
    fontSize: 10,
    lineHeight: 1.55,
    color: "#27272a",
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 46,
  },
  kapak: {
    fontFamily: "NotoSans",
    paddingTop: 150,
    paddingHorizontal: 60,
    color: "#27272a",
  },
  kapakKurum: {
    fontSize: 11,
    letterSpacing: 2,
    color: "#a3185b",
    marginBottom: 30,
    textAlign: "center",
  },
  kapakYil: { fontSize: 12, color: "#71717a", textAlign: "center", marginBottom: 6 },
  kapakProgram: {
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  kapakBaslik: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 1.3,
    marginTop: 26,
    marginBottom: 46,
  },
  kapakAlan: {
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    paddingTop: 12,
    marginBottom: 8,
    flexDirection: "row",
  },
  kapakEtiket: { width: 110, fontSize: 10, color: "#71717a" },
  kapakDeger: { fontSize: 11, fontWeight: "bold" },

  bolumBasligi: {
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 4,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#a3185b",
  },
  altBaslik: { fontSize: 11, fontWeight: "bold", marginTop: 12, marginBottom: 4 },
  paragraf: { marginBottom: 8, textAlign: "justify" },
  kucuk: { fontSize: 9, color: "#52525b" },

  kart: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 4,
  },
  satir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  segmentKutusu: { flexDirection: "row", alignItems: "center" },
  segment: { width: 11, height: 8, borderRadius: 1, marginRight: 2 },
  kademeEtiketi: {
    fontSize: 8,
    fontWeight: "bold",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 5,
  },
  madde: { fontSize: 9, marginBottom: 2, paddingLeft: 8 },

  altBilgi: {
    position: "absolute",
    bottom: 28,
    left: 46,
    right: 46,
    fontSize: 8,
    color: "#a1a1aa",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

/**
 * Kademe göstergesi: üç segment + etiket.
 *
 * Dolu segment sayısı kademeyle artıyor; renk okunamasa bile bilgi ayakta
 * kalıyor. Sayı basılmıyor — veliye "2,4" göstermek çocuğa yapıştırılmış
 * bir not gibi okunuyor.
 */
function Kademe({ bant }: { bant: BantBilgisi | null }) {
  if (!bant) {
    return (
      <View style={stil.segmentKutusu}>
        {[1, 2, 3].map((sira) => (
          <View key={sira} style={[stil.segment, { backgroundColor: "#f4f4f5" }]} />
        ))}
        <Text style={[stil.kademeEtiketi, { backgroundColor: "#f4f4f5", color: "#71717a" }]}>
          Değerlendirilmedi
        </Text>
      </View>
    );
  }

  return (
    <View style={stil.segmentKutusu}>
      {[1, 2, 3].map((sira) => (
        <View
          key={sira}
          style={[
            stil.segment,
            { backgroundColor: sira <= bant.dolu ? bant.renk : "#e4e4e7" },
          ]}
        />
      ))}
      <Text
        style={[stil.kademeEtiketi, { backgroundColor: bant.zemin, color: bant.renk }]}
      >
        {bant.etiket}
      </Text>
    </View>
  );
}

/** Veliye giden sabit bilgilendirme; her raporda aynı. */
function Bilgilendirme({ programAdi }: { programAdi: string }) {
  return (
    <>
      <Text style={stil.bolumBasligi}>
        Değerlendirme raporu hakkında genel bilgilendirme
      </Text>
      <Text style={stil.paragraf}>Değerli velimiz,</Text>
      <Text style={stil.paragraf}>
        Elinizdeki bu rapor, çocuğunuzun {programAdi} atölye çalışmaları
        neticesinde; eğitmen, psikolog ve yardımcı eğitmen gözlemleri göz önüne
        alınarak hazırlanmıştır. Rapor, çocuğunuzun katıldığı her bir atölyede
        sergilediği performansa göre oluşturulmuştur.
      </Text>
      <Text style={stil.paragraf}>
        Raporda çocuğunuzun atölyelere olan ilgi ve merak düzeyini, atölyelerde
        sergilediği başarıyı ve bunların yanında duygusal, sosyal ve bilişsel
        gelişimine olan katkısını bulacaksınız. Değerlendirmeler üç kademede
        sunulmuştur: Yüksek, Ortalama ve Düşük.
      </Text>
      <Text style={stil.paragraf}>
        Atölye sürecinin sınırlı bir zaman diliminde yürütüldüğü ve gözlemin bu
        süre içindeki davranışları kapsadığı unutulmamalıdır. Rapor bir tanı
        aracı değil, çocuğunuzun bu süreçte neler yaptığını ve nasıl
        etkilendiğini gösteren bir değerlendirmedir.
      </Text>
      <Text style={stil.paragraf}>Saygılarımızla…</Text>
      <Text style={[stil.paragraf, { fontWeight: "bold" }]}>{KURUM_ADI}</Text>
    </>
  );
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
  const altBilgi = (
    <View style={stil.altBilgi} fixed>
      <Text>
        {KURUM_ADI} · {govde.ogrenci.adSoyad} · {tarihBicimle(uretimZamani)}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );

  return (
    <Document
      title={`${govde.ogrenci.adSoyad} — Öğrenci Değerlendirme Raporu`}
      author={KURUM_ADI}
      language="tr"
    >
      {/* Kapak */}
      <Page size="A4" style={stil.kapak}>
        <Text style={stil.kapakKurum}>{KURUM_ADI}</Text>
        {govde.egitimYili ? (
          <Text style={stil.kapakYil}>{govde.egitimYili} EĞİTİM YILI</Text>
        ) : null}
        <Text style={stil.kapakProgram}>{programAdi.toLocaleUpperCase("tr-TR")}</Text>
        <Text style={stil.kapakBaslik}>
          ATÖLYE ÇALIŞMALARI{"\n"}ÖĞRENCİ DEĞERLENDİRME RAPORU
        </Text>

        <View style={stil.kapakAlan}>
          <Text style={stil.kapakEtiket}>Öğrenci adı</Text>
          <Text style={stil.kapakDeger}>{govde.ogrenci.adSoyad}</Text>
        </View>
        {govde.ogrenci.sinif ? (
          <View style={stil.kapakAlan}>
            <Text style={stil.kapakEtiket}>Sınıfı</Text>
            <Text style={stil.kapakDeger}>{govde.ogrenci.sinif}</Text>
          </View>
        ) : null}
        <View style={stil.kapakAlan}>
          <Text style={stil.kapakEtiket}>Grup</Text>
          <Text style={stil.kapakDeger}>
            {govde.kapsam.map((k) => k.grupAdi).join(" · ")}
          </Text>
        </View>
        <View style={stil.kapakAlan}>
          <Text style={stil.kapakEtiket}>Rapor tarihi</Text>
          <Text style={stil.kapakDeger}>{tarihBicimle(uretimZamani)}</Text>
        </View>
      </Page>

      {/* Bilgilendirme */}
      <Page size="A4" style={stil.sayfa}>
        <Bilgilendirme programAdi={programAdi} />
        {altBilgi}
      </Page>

      {/* Atölyeler ve içerikleri */}
      {govde.atolyeIcerikleri.length > 0 ? (
        <Page size="A4" style={stil.sayfa}>
          <Text style={stil.bolumBasligi}>Atölyeler ve içerikleri hakkında</Text>
          {govde.atolyeIcerikleri.map((atolye) => (
            <View key={atolye.atolyeAdi} wrap={false}>
              <Text style={stil.altBaslik}>{atolye.atolyeAdi}</Text>
              <Text style={stil.paragraf}>{atolye.metin}</Text>
            </View>
          ))}
          {altBilgi}
        </Page>
      ) : null}

      {/* Gelişim alanları + atölye kademeleri */}
      <Page size="A4" style={stil.sayfa}>
        <Text style={stil.bolumBasligi}>
          Atölyelerdeki sosyal, duygusal ve bilişsel beceriler
        </Text>

        {govde.gelisimAlanlari.map((alan) => (
          <View key={alan.ad} style={stil.kart} wrap={false}>
            <View style={stil.satir}>
              <Text style={{ fontWeight: "bold", fontSize: 11 }}>{alan.ad}</Text>
              <Kademe bant={alan.bant} />
            </View>
            {alan.kazanimlar.length > 0 ? (
              <>
                <Text style={[stil.kucuk, { marginTop: 4, marginBottom: 2 }]}>
                  Bu alanda ele alınan kazanımlar:
                </Text>
                {alan.kazanimlar.map((kazanim) => (
                  <Text key={kazanim} style={stil.madde}>
                    – {kazanim}
                  </Text>
                ))}
              </>
            ) : null}
            {alan.cumle ? (
              <Text style={[stil.paragraf, { marginTop: 6, marginBottom: 0 }]}>
                {alan.cumle}
              </Text>
            ) : null}
          </View>
        ))}

        <Text style={[stil.bolumBasligi, { marginTop: 14 }]}>
          Atölyelerdeki ilgi ve başarı düzeyi
        </Text>
        <Text style={[stil.kucuk, { marginBottom: 8 }]}>
          Bu değerlendirme her öğrenci özelinde yalnızca öğrencinin kendi ilgi ve
          başarı düzeyini gösterir; akran grubu veya sınıf içi kıyaslama
          içermez.
        </Text>

        {govde.atolyeKademeleri.map((atolye) => (
          <View key={atolye.atolyeAdi} style={stil.kart} wrap={false}>
            <Text style={{ fontWeight: "bold", fontSize: 11, marginBottom: 5 }}>
              {atolye.atolyeAdi}
            </Text>
            <View style={stil.satir}>
              <Text style={stil.kucuk}>İlgi ve merak düzeyi</Text>
              <Kademe bant={atolye.ilgi} />
            </View>
            <View style={[stil.satir, { marginBottom: 0 }]}>
              <Text style={stil.kucuk}>Kazanımlara ulaşma düzeyi</Text>
              <Kademe bant={atolye.basari} />
            </View>
            {atolye.katilmadigiOturumSayisi > 0 ? (
              <Text style={[stil.kucuk, { marginTop: 5 }]}>
                {atolye.katilmadigiOturumSayisi} oturuma katılım sağlanmamış ve
                bu oturumlar değerlendirmeye dahil edilmemiştir.
              </Text>
            ) : null}
          </View>
        ))}

        {govde.asimetriler.length > 0 ? (
          <>
            <Text style={stil.altBaslik}>Değerlendirme notu</Text>
            {govde.asimetriler.map((asimetri) => (
              <Text key={asimetri.atolyeAdi} style={stil.paragraf}>
                {asimetri.cumle}
              </Text>
            ))}
          </>
        ) : null}

        {altBilgi}
      </Page>

      {/* Gözlem raporu */}
      {govde.gozlem ? (
        <Page size="A4" style={stil.sayfa}>
          <Text style={stil.bolumBasligi}>
            Eğitmen ve yardımcı eğitmen gözlem raporu
          </Text>
          <Text style={stil.paragraf}>{govde.gozlem.giris}</Text>
          <Text style={stil.paragraf}>{govde.gozlem.profil}</Text>

          {govde.gozlem.bloklar.map((blok) => (
            <View key={blok.beceriAdi}>
              <Text style={stil.altBaslik}>{blok.beceriAdi}</Text>
              {blok.tanim ? (
                <Text style={[stil.paragraf, stil.kucuk]}>{blok.tanim}</Text>
              ) : null}
              {blok.etkinlik ? (
                <Text style={stil.paragraf}>{blok.etkinlik}</Text>
              ) : null}
              <Text style={stil.paragraf}>{blok.gozlem}</Text>
            </View>
          ))}

          <Text style={stil.altBaslik}>Sonuç</Text>
          <Text style={stil.paragraf}>{govde.gozlem.sonuc}</Text>

          <Text style={stil.altBaslik}>Ev ortamında öneriler</Text>
          <Text style={stil.paragraf}>{govde.gozlem.oneriler}</Text>

          {govde.gozlem.urunler.length > 0 ? (
            <>
              <Text style={[stil.kucuk, { marginTop: 4 }]}>
                Önerilen materyaller:
              </Text>
              {govde.gozlem.urunler.map((urun) => (
                <Text key={urun.url} style={stil.madde}>
                  – {urun.ad}
                </Text>
              ))}
            </>
          ) : null}

          {altBilgi}
        </Page>
      ) : null}
    </Document>
  );
}
