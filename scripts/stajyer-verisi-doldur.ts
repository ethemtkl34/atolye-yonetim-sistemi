/**
 * Stajyerlerin doldurduğu test verisini tamamlar: dönem sonu gelişim
 * değerlendirmesi, kayıt gözlem notu ve oturum gözlem notları.
 *
 * Rapor kademeleri gruba kıyaslı çalıştığı için değerler öğrenciden
 * öğrenciye DEĞİŞMELİ — herkese aynı puan verilirse bütün öğrenciler
 * "Ortalama" çıkar ve rapor hiçbir şey ayırt etmez. Bu yüzden her kayda
 * kendi profili (güçlü/zayıf alan) atanıyor.
 *
 * Yazdığı her şey `filledByUserId` / `scoredByUserId` ile kaydı üstlenen
 * stajyere bağlanır: veri stajyer panelinden girilmiş gibi görünmeli.
 *
 * Idempotent — var olan kayda dokunmaz, yalnızca eksikleri tamamlar.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { GELISIM_SORULARI } from "../src/lib/gelisim-degerlendirmesi";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DONEM = "2026 Sonbahar Dönemi";

/**
 * Öğrenci profilleri: her biri bir alanda güçlü, birinde zayıf. Kademe
 * eşikleri grup ortalamasına göre hesaplandığı için bu dağılım olmadan
 * "Yüksek"/"Düşük" hiç üretilmez.
 */
const PROFILLER = [
  { ad: "duygusal-guclu", agirlik: { Duygusal: 1.1, Sosyal: 0, Bilişsel: -0.7 } },
  { ad: "sosyal-guclu", agirlik: { Duygusal: 0, Sosyal: 1.2, Bilişsel: -0.5 } },
  { ad: "bilissel-guclu", agirlik: { Duygusal: -0.6, Sosyal: -0.3, Bilişsel: 1.2 } },
  { ad: "dengeli-yuksek", agirlik: { Duygusal: 0.6, Sosyal: 0.5, Bilişsel: 0.6 } },
  { ad: "dengeli-dusuk", agirlik: { Duygusal: -0.8, Sosyal: -0.6, Bilişsel: -0.7 } },
  { ad: "orta", agirlik: { Duygusal: 0, Sosyal: 0.2, Bilişsel: -0.2 } },
] as const;

/** Kategorinin ilk kelimesi profil anahtarına denk geliyor. */
function alanAnahtari(kategori: string): "Duygusal" | "Sosyal" | "Bilişsel" {
  if (kategori.startsWith("Duygusal")) return "Duygusal";
  if (kategori.startsWith("Sosyal")) return "Sosyal";
  return "Bilişsel";
}

/** 1–5 aralığında, profile ve soru sırasına göre değişen değer. */
function deger(profilSira: number, soruSira: number, kategori: string): number {
  const profil = PROFILLER[profilSira % PROFILLER.length];
  const taban = 3.4 + profil.agirlik[alanAnahtari(kategori)];
  // Soru sırasına bağlı ufak salınım: aynı alandaki sorular da birbirinin
  // kopyası olmasın, aksi hâlde ortalama gerçekçi durmuyor.
  const salinim = ((soruSira * 7 + profilSira * 3) % 5) / 5 - 0.4;
  return Math.min(5, Math.max(1, Math.round(taban + salinim)));
}

const KAYIT_NOTLARI = [
  "Döneme çekingen başladı, üçüncü haftadan sonra arkadaşlarıyla rahat iletişim kurmaya başladı. Yönergeleri dikkatle dinliyor, anlamadığında sormaktan çekinmiyor.",
  "Atölye sürecine baştan itibaren istekli katıldı. Grup çalışmalarında hem fikir üretiyor hem arkadaşlarını dinliyor. Sırasını beklemekte zaman zaman zorlanıyor.",
  "Yönergeleri tek seferde kavrıyor ve işe hemen başlıyor. Çalışması beklediği gibi gitmediğinde çabuk vazgeçme eğilimi var, desteklendiğinde tekrar deniyor.",
  "Sessiz ama takipçi. Söz almayı tercih etmiyor, sorulduğunda düşünülmüş cevaplar veriyor. Küçük gruplarda büyük gruptakinden daha rahat.",
  "Enerjisi yüksek, her etkinliğe ilk atılan o oluyor. Uzun süren çalışmalarda dikkati dağılıyor; ara verilince toparlanıyor.",
  "Arkadaşlarına yardım etmeye istekli, malzeme paylaşımında cömert. Kendi çalışmasını bitirmeden başkasına yardım ettiği için zaman zaman geride kalıyor.",
];

/** Atölye adına göre oturum notu havuzu — not somut davranış içermeli. */
const OTURUM_NOTLARI: Record<string, string[]> = {
  Bilim: [
    "Deneyde sonucu önceden tahmin etti; tahmini tutmayınca \"neden böyle oldu?\" diye sordu ve ikinci denemede değişkeni kendisi değiştirdi.",
    "Devreyi kurarken kabloları iki kez ters bağladı, üçüncüde şemayı kontrol edip doğrusunu buldu. Çalıştığında arkadaşlarına gösterdi.",
    "Gruptaki ölçüm görevini üstlendi, sonuçları defterine tek tek yazdı. Ölçüm tutmayınca baştan ölçmeyi kendisi önerdi.",
  ],
  Robotik: [
    "Kod bloklarını sıralarken karakteri hedefe ulaştıramadı; blokları tek tek geri okuyup eksik komutu buldu ve yardım istemeden tamamladı.",
    "Döngü mantığını kavradıktan sonra aynı yapıyı kendi projesine uyguladı. Takılan arkadaşına bloğu göstererek anlattı.",
    "Robot istenen yönde dönmeyince motor yönünü değiştirmeyi denedi, olmayınca tekerlek bağlantısını kontrol etti.",
  ],
  Astronomi: [
    "Galaksi modelini incelerken \"hepsi aynı yöne mi dönüyor?\" diye sordu, aldığı cevabı arkadaşlarına kendi cümleleriyle anlattı.",
    "Gezegen sıralamasını ezberlemek yerine büyüklüklerine göre mantık kurmaya çalıştı. Anlatım sırasında dikkatini korudu.",
    "Teleskop maketini kurarken parçaları yönergesiz birleştirmeye çalıştı, eksik kalınca yönergeye döndü.",
  ],
  Zekâ: [
    "Strateji oyununda ilk turda kuralları karıştırdı; ikinci turda rakibinin hamlesini önceden tahmin edip alan kapattı. Kaybettiği turda üzüldü ama arkadaşını tebrik etti.",
    "Hamle yapmadan önce uzun düşündü, acele etmedi. Süre baskısı olunca hızlı karar vermekte zorlandı.",
    "Bulmacayı çözemeyince farklı bir yol denemek yerine aynı yolu tekrarladı; yönlendirilince yeni yaklaşımı kendi buldu.",
  ],
  Hayal: [
    "Kompozisyonda renkleri uzun uzun seçti, acele etmedi. Fırçayı kontrollü kullandı, taşırmamak için elini yavaşlattı.",
    "Tasarımını arkadaşınınkine benzetmek yerine kendi fikrinde ısrar etti. Sonucu beğenmeyince bir bölümü baştan yaptı.",
    "Makasla kesimde zorlandı, kâğıdı çevirerek kesmeyi kendi keşfetti. Çalışmasını bitirince masasını topladı.",
  ],
};

function oturumNotu(atolyeAdi: string, sira: number): string | null {
  const anahtar = Object.keys(OTURUM_NOTLARI).find((k) => atolyeAdi.includes(k));
  if (!anahtar) return null;
  const havuz = OTURUM_NOTLARI[anahtar];
  return havuz[sira % havuz.length];
}

async function main() {
  const kayitlar = await db.enrollment.findMany({
    where: { group: { term: { name: DONEM } } },
    select: {
      id: true,
      internId: true,
      gozlemNotu: true,
      student: { select: { firstName: true } },
      developmentAssessments: { where: { period: "DONEM_SONU" }, select: { id: true } },
      scores: {
        where: { attended: true },
        select: {
          id: true,
          gozlemNotu: true,
          session: { select: { workshopType: { select: { name: true } } } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  let gelisim = 0;
  let kayitNotu = 0;
  let oturum = 0;

  for (const [sira, kayit] of kayitlar.entries()) {
    if (kayit.developmentAssessments.length === 0) {
      await db.developmentAssessment.create({
        data: {
          enrollmentId: kayit.id,
          period: "DONEM_SONU",
          filledByUserId: kayit.internId,
          answersJson: GELISIM_SORULARI.map((soru, i) => ({
            anahtar: soru.anahtar,
            kategori: soru.kategori,
            baslik: soru.baslik,
            soruMetni: soru.metin,
            deger: deger(sira, i, soru.kategori),
          })),
        },
      });
      gelisim += 1;
    }

    if (!kayit.gozlemNotu) {
      await db.enrollment.update({
        where: { id: kayit.id },
        data: { gozlemNotu: KAYIT_NOTLARI[sira % KAYIT_NOTLARI.length] },
      });
      kayitNotu += 1;
    }

    for (const [i, puanlama] of kayit.scores.entries()) {
      if (puanlama.gozlemNotu) continue;
      const not = oturumNotu(puanlama.session.workshopType.name, sira + i);
      if (!not) continue;
      await db.score.update({
        where: { id: puanlama.id },
        data: {
          gozlemNotu: not,
          ...(kayit.internId ? { scoredByUserId: kayit.internId } : {}),
        },
      });
      oturum += 1;
    }
  }

  console.log(
    `kayıt: ${kayitlar.length} · gelişim: +${gelisim} · kayıt notu: +${kayitNotu} · oturum notu: +${oturum}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
