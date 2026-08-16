/**
 * Veli görüşmesi formunun yaşa göre uyarlanan metin sözlüğü.
 *
 * Kurumun hazırladığı interaktif görüşme formundan olduğu gibi taşındı;
 * cümleler uzmanlar tarafından yazıldığı için burada DEĞİŞTİRİLMEZ, yalnızca
 * yapılandırılır. Metinler kodda sabit durur (`GELISIM_SORULARI` ve
 * `GOZLEM_ALANLARI` deseni): kurum bunları panelden düzenlemiyor, ve kayıt
 * seçilen anahtarların yanında o günkü başlığı da sakladığı için
 * (`questionTextSnapshot` ilkesi) sözlüğü güncellemek geçmiş kayıtları bozmaz.
 *
 * Buradaki her şey SAF VERİ — fonksiyon, tarih, rastgelelik yok. Yorum üreten
 * fonksiyonlar `veli-gorusmesi.ts` içinde.
 */

/** Formun üç yaş bandı; 4 altı ve 10 üstü en yakın banda kıstırılır. */
export type YasBandi = "4-5" | "6-7" | "8-10";

export const YAS_BANTLARI: readonly YasBandi[] = ["4-5", "6-7", "8-10"];

/** Zorlanma alanlarının üç sütunu — renk ve yönlendirme dili buna bağlı. */
export type ZorlanmaSutunu = "Bilişsel" | "Sosyal" | "Duygusal";

// ---------------------------------------------------------------------------
// Yaşa göre gelişimsel çerçeve (form: AGE_DATA)
// ---------------------------------------------------------------------------

export type YasCercevesi = {
  /** Yaşın kısa gelişimsel tarifi. */
  ozet: string;
  /** Bilişsel/duygusal olarak bakılması gerekenler. */
  bilissel: readonly string[];
  /** Grup ortamında gözlemlenecekler. */
  grup: readonly string[];
  /** Dikkat edilecek noktalar (bayrak). */
  dikkat: readonly string[];
};

/** 4–10 yaş; band değil TAM YAŞ ile anahtarlanır — çerçeve her yaş için ayrı yazıldı. */
export const YAS_CERCEVELERI: Record<number, YasCercevesi> = {
  4: {
    ozet: "Hayal gücü zengin, sembolik oyuna yoğun ilgi vardır. Paylaşma ve sıra bekleme henüz gelişim aşamasındadır. Bağımsızlık isteği (“ben yaparım”) belirgindir.",
    bilissel: [
      "Sembolik/hayali oyunun zenginliği ve çeşitliliği",
      "Dürtü kontrolü ve bekleme becerisinin gelişim düzeyi",
      "Temel duyguları (mutlu/üzgün/kızgın) tanıma ve isimlendirme",
      "Bağımsızlık ile yetişkine bağımlılık arasındaki denge",
    ],
    grup: [
      "Akranlarla paralel mi yoksa ortak mı oynuyor?",
      "Grup içinde sırasını bekleyebiliyor mu?",
      "Yeni bir grup ortamına adaptasyon süresi ne kadar?",
      "Grup etkinliğinde yönergeyi takip edebiliyor mu?",
    ],
    dikkat: [
      "Öfke patlamalarının sıklığı ve yatıştırılabilirliği",
      "Akranla kısa süreli de olsa ortak oyun kurabiliyor mu",
      "Yetişkinden ayrılma kaygısı düzeyi",
    ],
  },
  5: {
    ozet: "Kurallı oyunlara ilgi artar. Kazanma-kaybetmeyi tolere etme becerisi gelişmektedir. Özgüven ve yeterlilik hissi (“ben bunu yapabilirim”) önem kazanır.",
    bilissel: [
      "Kurallı oyunları anlama ve uygulama becerisi",
      "Kazanma-kaybetmeyi tolere etme düzeyi",
      "Özgüven ve yeterlilik hissi (“ben yapabilirim”)",
      "Duygularını sözel olarak ifade edip düzenleyebilme",
    ],
    grup: [
      "Grup oyunlarında kurala uyuyor mu?",
      "Akranlarıyla işbirliği kurabiliyor mu?",
      "Kaybettiğinde grup içindeki tepkisi nasıl?",
      "Grup içinde liderlik mi takip mi ediyor?",
    ],
    dikkat: [
      "Kaybetmeye aşırı tepki (uzun ağlama, oyunu terk etme)",
      "Grup içinde dışlanma/izolasyon belirtileri",
      "Aşırı mükemmeliyetçi/öz eleştirel tutum",
    ],
  },
  6: {
    ozet: "Yapılandırılmış ortama (okul, masa başı etkinlik) uyum sağlama dönemidir. Sorumluluk alma isteği ve eleştiriye karşı hassasiyet birlikte görülebilir.",
    bilissel: [
      "Yapılandırılmış/kurallı etkinliklere uyum düzeyi",
      "Sorumluluk alma isteği ve tutarlılığı",
      "Eleştiri/hataya karşı tepki biçimi",
      "Dürtü kontrolü ve bekleme becerisi",
    ],
    grup: [
      "Grup kurallarına uyumu nasıl?",
      "Grup içi rolü (aktif katılımcı mı, izleyici mi)?",
      "Akran ilişkilerinde adil oyun anlayışı var mı?",
      "Grup önünde konuşma/paylaşım rahatlığı nasıl?",
    ],
    dikkat: [
      "Yapılandırılmış ortamda belirgin uyumsuzluk",
      "Dürtü kontrolünde yaşına göre gerilik",
      "Benlik saygısında kırılganlık (sürekli olumsuz öz değerlendirme)",
    ],
  },
  7: {
    ozet: "Mantıksal/sıralı düşünme belirginleşmeye başlar (somut işlemler dönemi). Akran onayına duyarlılık ve kendini başkalarıyla kıyaslama eğilimi artar.",
    bilissel: [
      "Mantıksal/sıralı düşünme becerisinin gelişim düzeyi",
      "Akran onayına duyarlılık",
      "Kendini başkalarıyla kıyaslama eğilimi",
      "Hata karşısında toparlanma (dayanıklılık) düzeyi",
    ],
    grup: [
      "Grup içinde akran onayı arayışı gözlemleniyor mu?",
      "Grup projesinde/görevinde rol alıyor mu?",
      "Kıyaslamacı ifadeler kullanıyor mu (“ondan daha iyiyim/kötüyüm”)?",
      "Grup tartışmasına/fikir alışverişine katkısı nasıl?",
    ],
    dikkat: [
      "Sosyal kıyaslamanın özgüveni belirgin biçimde düşürmesi",
      "Akran onayı arayışının aşırılaşması",
      "Yeni/zorlayıcı görevlerden kaçınma eğilimi",
    ],
  },
  8: {
    ozet: "Takım çalışması ve strateji gerektiren etkinliklere ilgi artar. “Yeterli miyim?” hissi (başarı/yetersizlik ekseni) bu dönemde belirginleşir.",
    bilissel: [
      "Takım çalışması ve strateji kurma becerisi",
      "“Yeterli miyim?” hissi (başarı/yetersizlik ekseni)",
      "Arkadaşlık seçiciliği",
      "Duygu düzenleme becerisinin olgunluk düzeyi",
    ],
    grup: [
      "Takım içindeki rolü (lider/destekleyici/pasif)?",
      "Grup başarısını nasıl karşılıyor (paylaşımcı mı, sahiplenici mi)?",
      "Akranlarıyla çatışma çözme biçimi nasıl?",
      "Grup içinde belirli kişilerle mi yoksa herkesle mi etkileşiyor?",
    ],
    dikkat: [
      "“Yetersizlik” hissinin yoğunlaşması, sürekli kendini eleştirme",
      "Grup içinde rol alamama veya sürekli pasif kalma",
      "Rekabetçi ortamlarda aşırı kaygı",
    ],
  },
  9: {
    ozet: "Soyut düşünme pekişir, bağımsız problem çözme becerisi güçlenir. Bir gruba/kulübe/takıma ait olma ihtiyacı (aidiyet) önem kazanır.",
    bilissel: [
      "Soyut düşünme ve bağımsız problem çözme becerisi",
      "Bir gruba/takıma aidiyet ihtiyacı",
      "Sosyal kıyaslamanın özgüvenine etkisi",
      "Sorumluluk alanının genişlemesine uyum",
    ],
    grup: [
      "Grup/takım aidiyeti güçlü mü, zayıf mı?",
      "Grup içinde belirli bir “rol”e mi yerleşiyor (şakacı, lider, sessiz)?",
      "Grup dışı kalma durumunda tepkisi nasıl?",
      "Ortak karar alma süreçlerine katkısı var mı?",
    ],
    dikkat: [
      "Grup dışında kalma/aidiyet kuramama",
      "Sosyal medyaya/akran kültürüne erken maruziyet belirtileri",
      "Aşırı bağımsızlık isteğiyle desteğe direnç arasında denge",
    ],
  },
  10: {
    ozet: "İlgi alanları ve güçlü yönler netleşmeye başlar. Akran grubunun etkisi artar; mahremiyet ihtiyacı ve öz-farkındalık gelişmektedir.",
    bilissel: [
      "Belirginleşen ilgi alanları ve yetenekler",
      "Akran grubunun davranışlarına etkisi",
      "Mahremiyet/özel alan ihtiyacının nasıl yönetildiği",
      "Öz farkındalık ve öz değerlendirme biçimi",
    ],
    grup: [
      "Akran grubu içindeki statüsü/konumu nasıl?",
      "Grup baskısına karşı duruşu (bağımsız mı, etkilenen mi)?",
      "Grup içinde mizah/ironi kullanımı gözlemleniyor mu?",
      "Farklı gruplarla (yaş/cinsiyet) etkileşimi ne kadar rahat?",
    ],
    dikkat: [
      "Akran baskısına karşı savunmasızlık",
      "Erken ergenlik belirtileriyle birlikte duygusal dalgalanma",
      "Aile ile paylaşımın azalması / içe kapanma",
    ],
  },
};

// ---------------------------------------------------------------------------
// Bölüm 1 — Genel izlenim / mizaç özellikleri (form: GENEL_DATA)
// ---------------------------------------------------------------------------

export type GenelOzellik = { baslik: string; yorum: string; oneri: string };

/** Formdaki dört sütun; sıra ekranda göründüğü sıradır. */
export const GENEL_OZELLIK_GRUPLARI: readonly {
  baslik: string;
  simge: string;
  anahtarlar: readonly string[];
}[] = [
  {
    baslik: "Sosyal Yönelim",
    simge: "🧭",
    anahtarlar: ["disadonuk", "icedonuk", "atilgan", "cekingen", "liderlikg"],
  },
  {
    baslik: "Yaklaşım / Öğrenme",
    simge: "🔎",
    anahtarlar: ["merakli", "arastirmaci", "yaratici", "gozlemci", "sistemli"],
  },
  {
    baslik: "Duygusal-Sosyal Stil",
    simge: "💭",
    anahtarlar: ["duyarli", "benmerkezci", "uyumlu", "kararli", "onayarayan"],
  },
  {
    baslik: "Çalışma Tarzı",
    simge: "⚙️",
    anahtarlar: ["dikkatlig", "azimli", "enerjik", "sorumluluk", "isbirlikci"],
  },
];

export const GENEL_OZELLIKLER: Record<
  YasBandi,
  Record<string, GenelOzellik>
> = {
  "4-5": {
    disadonuk: {
      baslik: "Dışa Dönük",
      yorum:
        "Yeni ortamlara ve kişilere kolay uyum sağlıyor, sosyal etkileşimden enerji alıyor gibi görünmektedir.",
      oneri:
        "Grup etkinliklerinde bu enerjisini yönlendirecek küçük roller verilebilir.",
    },
    icedonuk: {
      baslik: "İçe Dönük / Sessiz",
      yorum:
        "Yeni ortamda ısınma süresi daha uzun olabilir, gözlemlemeyi tercih ediyor.",
      oneri:
        "Isınma süresine saygı gösterilmeli, zorlanmadan katılım teşvik edilmelidir.",
    },
    atilgan: {
      baslik: "Atılgan",
      yorum: "Yeni etkinliklere çekinmeden, hızlıca dahil oluyor.",
      oneri: "Bu girişkenlik güvenli sınırlar içinde desteklenebilir.",
    },
    cekingen: {
      baslik: "Çekingen",
      yorum:
        "Yeni durumlarda temkinli yaklaşıyor, güven duyduğunda katılım gösteriyor.",
      oneri: "Zorlamadan, güven inşa edici küçük adımlarla desteklenebilir.",
    },
    liderlikg: {
      baslik: "Liderlik Eğilimi",
      yorum: "Oyunlarda yönlendirici bir rol üstlenme eğilimi gösteriyor.",
      oneri:
        "Dönüşümlü liderlik fırsatlarıyla paylaşımcı liderlik desteklenebilir.",
    },
    merakli: {
      baslik: "Meraklı",
      yorum: "Çevresini keşfetmeye, sorular sormaya istekli.",
      oneri: "Merakını besleyecek açık uçlu etkinlikler sunulabilir.",
    },
    arastirmaci: {
      baslik: "Araştırmacı",
      yorum: "Nesneleri/durumları inceleme, deneme eğilimi gösteriyor.",
      oneri: "Güvenli keşif fırsatları (duyusal oyunlar) sunulabilir.",
    },
    yaratici: {
      baslik: "Yaratıcı",
      yorum: "Hayal gücünü oyunlarına zengin biçimde yansıtıyor.",
      oneri: "Açık uçlu sanat/oyun materyalleri sunulabilir.",
    },
    gozlemci: {
      baslik: "Gözlemci",
      yorum: "Çevresindeki detayları fark etme eğilimi gösteriyor.",
      oneri:
        "Gözlem gücünü kullanan basit “bul-fark et” oyunları önerilebilir.",
    },
    sistemli: {
      baslik: "Sistemli / Düzenli",
      yorum:
        "Eşyalarını/oyuncaklarını belirli bir düzende tutmayı tercih ediyor.",
      oneri: "Basit düzen rutinleriyle bu eğilim desteklenebilir.",
    },
    duyarli: {
      baslik: "Duyarlı (Empatik)",
      yorum:
        "Başkalarının üzüldüğünü fark edip teselli etme girişiminde bulunuyor.",
      oneri:
        "Empati gösterdiği anlar fark edilip olumlu şekilde pekiştirilebilir.",
    },
    benmerkezci: {
      baslik: "Benmerkezci",
      yorum:
        "Bu yaşta dünyayı kendi bakış açısından değerlendirme (benmerkezcilik) gelişimsel olarak beklenen bir özelliktir.",
      oneri:
        "Paylaşma ve sıra bekleme deneyimleriyle kademeli olarak desteklenebilir.",
    },
    uyumlu: {
      baslik: "Uyumlu / Esnek",
      yorum: "Değişen durumlara/rutinlere kolay uyum sağlıyor.",
      oneri: "Bu esneklik yeni deneyimler sunularak desteklenebilir.",
    },
    kararli: {
      baslik: "Kararlı / İnatçı",
      yorum:
        "İstediği şeyde ısrarcı davranıyor; bu, gelişmekte olan özerklik ihtiyacının bir yansıması olabilir.",
      oneri:
        "Israrını uygun şekilde ifade etmesi (“hayır” yerine tercih sunma) desteklenebilir.",
    },
    onayarayan: {
      baslik: "Onay Arayan",
      yorum: "Yetişkin onayı arama davranışı bu yaşta sık görülür.",
      oneri: "Sonuç değil çaba odaklı geri bildirim verilmesi önerilir.",
    },
    dikkatlig: {
      baslik: "Dikkatli",
      yorum: "Yaşına göre detaylara dikkat eden bir yaklaşım sergiliyor.",
      oneri: "Dikkat gerektiren kısa görevlerle desteklenebilir.",
    },
    azimli: {
      baslik: "Azimli",
      yorum: "Zorlandığı bir görevde kolay pes etmiyor.",
      oneri: "Bu azim, küçük başarı deneyimleriyle pekiştirilebilir.",
    },
    enerjik: {
      baslik: "Enerjik",
      yorum: "Yüksek hareket ve enerji düzeyine sahip.",
      oneri: "Enerjisini yönlendirecek hareketli etkinlikler sunulabilir.",
    },
    sorumluluk: {
      baslik: "Sorumluluk Sahibi",
      yorum: "Kendine verilen küçük görevleri yerine getirmeye istekli.",
      oneri:
        "Yaşına uygun küçük sorumluluklar verilerek bu yön desteklenebilir.",
    },
    isbirlikci: {
      baslik: "İş birlikçi",
      yorum:
        "Paylaşma ve birlikte oynama konusunda olumlu bir eğilim gösteriyor.",
      oneri: "Kısa süreli ortak etkinliklerle desteklenebilir.",
    },
  },
  "6-7": {
    disadonuk: {
      baslik: "Dışa Dönük",
      yorum:
        "Akranlarıyla kolayca iletişim kuruyor, grup ortamlarında rahat davranıyor.",
      oneri: "Liderlik gerektiren küçük görevlerle bu yön desteklenebilir.",
    },
    icedonuk: {
      baslik: "İçe Dönük / Sessiz",
      yorum:
        "Grup içinde daha sakin kalmayı, gözlemlemeyi tercih ediyor; bu genellikle mizaçla ilişkilidir.",
      oneri: "Küçük gruplarda konuşma fırsatı tanınabilir.",
    },
    atilgan: {
      baslik: "Atılgan",
      yorum:
        "Fikirlerini çekinmeden paylaşıyor, yeni görevlere gönüllü oluyor.",
      oneri: "Sırasını beklemesi gereken durumlarda nazikçe yönlendirilebilir.",
    },
    cekingen: {
      baslik: "Çekingen",
      yorum: "Grup önünde girişim göstermekte temkinli davranıyor.",
      oneri: "Düşük riskli, kolay başarı deneyimleri sunulabilir.",
    },
    liderlikg: {
      baslik: "Liderlik Eğilimi",
      yorum:
        "Grup etkinliklerinde inisiyatif alma ve yönlendirme eğilimi gösteriyor.",
      oneri:
        "Liderlik rolü verilirken başkalarını dinleme de teşvik edilebilir.",
    },
    merakli: {
      baslik: "Meraklı",
      yorum: "Yeni bilgi ve deneyimlere karşı yüksek ilgi gösteriyor.",
      oneri: "Araştırma temelli küçük projelerle desteklenebilir.",
    },
    arastirmaci: {
      baslik: "Araştırmacı",
      yorum: "Bir konuyu anlamak için soru sorma ve deneme eğilimi gösteriyor.",
      oneri: "Basit deney/gözlem etkinlikleriyle desteklenebilir.",
    },
    yaratici: {
      baslik: "Yaratıcı",
      yorum:
        "Özgün fikirler üretme ve farklı çözümler deneme eğilimi gösteriyor.",
      oneri: "Serbest/açık uçlu proje görevleriyle desteklenebilir.",
    },
    gozlemci: {
      baslik: "Gözlemci",
      yorum: "Katılmadan önce izlemeyi, detayları fark etmeyi tercih ediyor.",
      oneri: "Gözlemlerini sözelleştirmesi teşvik edilebilir.",
    },
    sistemli: {
      baslik: "Sistemli / Düzenli",
      yorum: "Görevlerini düzenli, adım adım yapmayı tercih ediyor.",
      oneri: "Kontrol listeleri/rutinlerle desteklenebilir.",
    },
    duyarli: {
      baslik: "Duyarlı (Empatik)",
      yorum:
        "Arkadaşlarının duygularını fark etme ve buna göre davranma eğilimi gösteriyor.",
      oneri: "Empatik davranışları model alınarak pekiştirilebilir.",
    },
    benmerkezci: {
      baslik: "Benmerkezci",
      yorum:
        "Başkalarının bakış açısını dikkate almakta zaman zaman zorlanabiliyor; bu yaşta hâlâ gelişim aşamasındadır.",
      oneri:
        "“O şimdi ne hissediyor olabilir?” gibi sorularla perspektif alma desteklenebilir.",
    },
    uyumlu: {
      baslik: "Uyumlu / Esnek",
      yorum: "Beklenmedik değişikliklere kolay adapte oluyor.",
      oneri: "Farklı görevler/roller vererek bu yön beslenebilir.",
    },
    kararli: {
      baslik: "Kararlı / İnatçı",
      yorum: "Fikrini kolay değiştirmiyor, hedeflerinde ısrarcı davranıyor.",
      oneri:
        "Bu kararlılık, esnekliği de destekleyecek şekilde yönlendirilebilir.",
    },
    onayarayan: {
      baslik: "Onay Arayan",
      yorum:
        "Yaptıklarının doğruluğunu sık sık teyit etme ihtiyacı gösteriyor.",
      oneri:
        "Kendi değerlendirmesini yapması için alan tanınabilir (“sence nasıl gitti?”).",
    },
    dikkatlig: {
      baslik: "Dikkatli",
      yorum:
        "Görevlerini özenli ve dikkatli biçimde tamamlama eğilimi gösteriyor.",
      oneri: "Bu özen, biraz daha karmaşık görevlerle sınanabilir.",
    },
    azimli: {
      baslik: "Azimli",
      yorum: "Zorluklar karşısında denemeye devam etme eğilimi gösteriyor.",
      oneri: "Giderek zorlaşan görevlerle bu güç geliştirilebilir.",
    },
    enerjik: {
      baslik: "Enerjik",
      yorum: "Fiziksel olarak aktif, hareket etmeyi seven bir yapıya sahip.",
      oneri: "Hareketli görevlerle enerjisi olumlu yönde kullanılabilir.",
    },
    sorumluluk: {
      baslik: "Sorumluluk Sahibi",
      yorum:
        "Üstlendiği görevleri tamamlama konusunda güvenilir bir tutum sergiliyor.",
      oneri: "Sorumluluk alanı kademeli olarak genişletilebilir.",
    },
    isbirlikci: {
      baslik: "İş birlikçi",
      yorum: "Grup görevlerinde işbirliği yapmaya istekli davranıyor.",
      oneri: "Takım oyunlarıyla bu yön pekiştirilebilir.",
    },
  },
  "8-10": {
    disadonuk: {
      baslik: "Dışa Dönük",
      yorum:
        "Sosyal ortamlarda kendini rahat ifade ediyor, geniş çevre kurma eğilimi gösteriyor.",
      oneri:
        "Takım projelerinde koordinasyon rolü verilerek bu yön değerlendirilebilir.",
    },
    icedonuk: {
      baslik: "İçe Dönük / Sessiz",
      yorum:
        "Sosyal ortamlarda seçici davranıyor, yakın birkaç kişiyle derinlemesine etkileşimi tercih ediyor.",
      oneri: "Zorlanmadan, kendi hızında sosyalleşmesine alan tanınabilir.",
    },
    atilgan: {
      baslik: "Atılgan",
      yorum:
        "Karar alma ve girişim gösterme konusunda belirgin bir rahatlık sergiliyor.",
      oneri:
        "Bu yön liderlik deneyimleriyle beslenebilir; başkalarını dinleme pratiği de desteklenebilir.",
    },
    cekingen: {
      baslik: "Çekingen",
      yorum:
        "Özellikle yeni veya değerlendirilme içeren durumlarda çekingenlik gösteriyor.",
      oneri: "Küçük, güvenli başarı deneyimleriyle özgüveni desteklenebilir.",
    },
    liderlikg: {
      baslik: "Liderlik Eğilimi",
      yorum: "Takım içinde doğal bir yönlendirici rol üstleniyor.",
      oneri:
        "Bu yön, adil ve kapsayıcı liderlik pratikleriyle geliştirilebilir.",
    },
    merakli: {
      baslik: "Meraklı",
      yorum:
        "Derinlemesine bilgi edinmeye istekli, “neden/nasıl” sorularını sıkça soruyor.",
      oneri: "Bağımsız araştırma/proje fırsatları sunulabilir.",
    },
    arastirmaci: {
      baslik: "Araştırmacı",
      yorum: "Bilgiye kendi başına ulaşma ve sınama eğilimi gösteriyor.",
      oneri: "Bağımsız araştırma ödevleri/projelerle desteklenebilir.",
    },
    yaratici: {
      baslik: "Yaratıcı",
      yorum: "Alışılmadık, özgün fikirler üretme becerisi öne çıkıyor.",
      oneri: "Yaratıcı proje/tasarım görevleriyle desteklenebilir.",
    },
    gozlemci: {
      baslik: "Gözlemci",
      yorum:
        "İnce detayları fark etme ve bunları analiz etme eğilimi gösteriyor.",
      oneri: "Gözlem temelli bilimsel etkinliklerle desteklenebilir.",
    },
    sistemli: {
      baslik: "Sistemli / Düzenli",
      yorum: "Planlı, düzenli çalışma tarzını tercih ediyor.",
      oneri:
        "Kendi organizasyon sistemini (planlayıcı, liste) kurmasına rehberlik edilebilir.",
    },
    duyarli: {
      baslik: "Duyarlı (Empatik)",
      yorum:
        "Başkalarının bakış açısını anlama ve buna duyarlı davranma becerisi gelişmiştir.",
      oneri: "Akran destek/yardımlaşma rolleri verilebilir.",
    },
    benmerkezci: {
      baslik: "Benmerkezci",
      yorum:
        "Bu yaşta başkalarının bakış açısını dikkate almanın daha belirgin biçimde beklendiği, bu konuda desteklenmesi gereken bir eğilim gözlemlenmektedir.",
      oneri:
        "Grup projelerinde ortak karar alma deneyimleriyle desteklenebilir.",
    },
    uyumlu: {
      baslik: "Uyumlu / Esnek",
      yorum: "Değişen koşullara ve farklı görüşlere açık bir tutum sergiliyor.",
      oneri: "Karmaşık, değişken içeren proje görevleriyle desteklenebilir.",
    },
    kararli: {
      baslik: "Kararlı / İnatçı",
      yorum: "Hedeflerine ulaşmakta yüksek bir azim ve ısrar gösteriyor.",
      oneri:
        "Bu güç, uzun soluklu proje/hedeflerde olumlu yönde kullanılabilir.",
    },
    onayarayan: {
      baslik: "Onay Arayan",
      yorum:
        "Başarı ve onay arayışı akran/yetişkin onayına duyarlılıkla ilişkilenebilir.",
      oneri:
        "İçsel motivasyonu güçlendirecek, kendi standartlarını belirlemesine imkan tanıyan yaklaşım desteklenebilir.",
    },
    dikkatlig: {
      baslik: "Dikkatli",
      yorum:
        "Detaylara verdiği önem, işlerini titizlikle tamamlamasını sağlıyor.",
      oneri:
        "Titizliğinin yorucu/kaygı verici boyuta ulaşmadığından emin olunmalıdır.",
    },
    azimli: {
      baslik: "Azimli",
      yorum:
        "Hedefine ulaşana kadar çabasını sürdürme konusunda belirgin bir azim gösteriyor.",
      oneri: "Uzun soluklu proje/hedeflerle bu güç değerlendirilebilir.",
    },
    enerjik: {
      baslik: "Enerjik",
      yorum:
        "Yüksek enerjisini fiziksel ve zihinsel etkinliklere kanalize edebiliyor.",
      oneri: "Spor/hareket temelli hobiler önerilebilir.",
    },
    sorumluluk: {
      baslik: "Sorumluluk Sahibi",
      yorum:
        "Görev ve sorumluluklarını bağımsız biçimde yerine getirme eğilimi gösteriyor.",
      oneri:
        "Daha büyük sorumluluklar/roller verilerek bu yön desteklenebilir.",
    },
    isbirlikci: {
      baslik: "İş birlikçi",
      yorum:
        "Ortak hedefe yönelik çalışmalarda uyumlu ve destekleyici bir tutum sergiliyor.",
      oneri: "Takım projelerinde bu güç değerlendirilebilir.",
    },
  },
};

// ---------------------------------------------------------------------------
// Bölüm 2 — Bilişsel güçlü yönler (form: STRENGTH_DATA)
// ---------------------------------------------------------------------------

export type GucluYon = {
  /** CAS (PASS kuramı) veya WISC-IV alt test alanı. */
  kaynak: string;
  baslik: string;
  /** Güçlü yönü anlatan hazır cümle. */
  cumle: string;
  oneriler: readonly string[];
};

/** Ekrandaki sıra. */
export const GUCLU_YON_ANAHTARLARI: readonly string[] = [
  "planlama",
  "dikkatg",
  "butuncul",
  "sirali",
  "sozel",
  "gorselakil",
  "calismabellegi",
  "islemhizi",
];

export const GUCLU_YONLER: Record<YasBandi, Record<string, GucluYon>> = {
  "4-5": {
    planlama: {
      kaynak: "CAS — Planlama",
      baslik: "Planlama Becerisi",
      cumle:
        "Bu yaş için beklenenin ötesinde, basit oyunlarda bile önceden düşünüp adım atma eğilimi göstermektedir.",
      oneriler: [
        "Basit strateji içeren kutu oyunlarıyla (ör. sıra oyunları) desteklenebilir.",
        "Günlük küçük kararları (ör. hangi oyuncakla başlanacağı) önceden düşünmesi teşvik edilebilir.",
        "Akıl ve Zeka Oyunları atölyesinde bu yönü fark ettirecek küçük sorumluluklar verilebilir.",
      ],
    },
    dikkatg: {
      kaynak: "CAS — Dikkat",
      baslik: "Sürdürülen Dikkat",
      cumle:
        "Bu yaş için beklenenin üzerinde, kısa süreli görevlerde dikkatini iyi koruyabilmektedir.",
      oneriler: [
        "Kısa, oyunlaştırılmış dikkat oyunlarıyla desteklenebilir.",
        "Evde kısa süreli (5 dk) odaklanma oyunları oynanabilir.",
        "Astronomi ve Bilim atölyesindeki gözlem etkinliklerinde bu potansiyel desteklenebilir.",
      ],
    },
    butuncul: {
      kaynak: "CAS — Eş Zamanlı İşlemler",
      baslik: "Bütüncül Kavrayış",
      cumle:
        "Basit görsellerde parça-bütün ilişkisini fark etme konusunda yaşına göre güçlü bir eğilim göstermektedir.",
      oneriler: [
        "Büyük parçalı yapbozlarla desteklenebilir.",
        "Evde basit inşa/yapı oyunlarıyla pekiştirilebilir.",
        "Hayal Tasarım atölyesindeki görsel etkinliklerde bu güç fark edilebilir.",
      ],
    },
    sirali: {
      kaynak: "CAS — Ardıl İşlemler",
      baslik: "Sıralı İşlem Becerisi",
      cumle:
        "Basit, 2-3 adımlı sıralamalarda yaşına göre güçlü bir performans göstermektedir.",
      oneriler: [
        "Resimli sıralama oyunlarıyla desteklenebilir.",
        "Günlük rutinleri (giyinme, yemek) adım adım anlatması istenebilir.",
        "Robotik Kodlama atölyesindeki basit sıralı görevlerde bu yön desteklenebilir.",
      ],
    },
    sozel: {
      kaynak: "WISC-IV — Sözel Kavrama",
      baslik: "Sözel İfade / Kavrama",
      cumle:
        "Yaşına göre zengin bir kelime dağarcığı ve kendini sözel ifade etme konusunda güçlü bir eğilim göstermektedir.",
      oneriler: [
        "Hikâye kitapları ve günlük sohbetlerle desteklenebilir.",
        "Yeni öğrendiği kelimeleri cümle içinde kullanması teşvik edilebilir.",
        "Drama atölyesindeki karakter canlandırma etkinlikleri bu gücü besler.",
      ],
    },
    gorselakil: {
      kaynak: "WISC-IV — Algısal Akıl Yürütme",
      baslik: "Görsel-Uzamsal Akıl Yürütme",
      cumle:
        "Basit şekil ve örüntüleri tanıma konusunda yaşına göre güçlü bir potansiyel göstermektedir.",
      oneriler: [
        "Şekil eşleştirme oyunlarıyla desteklenebilir.",
        "Farklı boyut/renklerde nesneleri gruplandırma oyunları oynanabilir.",
        "Hayal Tasarım atölyesindeki çizim/tasarım etkinlikleri desteklenebilir.",
      ],
    },
    calismabellegi: {
      kaynak: "WISC-IV — Çalışma Belleği",
      baslik: "Çalışma Belleği",
      cumle:
        "Kısa yönergeleri hatırlama ve uygulama konusunda yaşına göre güçlü bir eğilim göstermektedir.",
      oneriler: [
        "Kısa hafıza oyunlarıyla desteklenebilir.",
        "2-3 adımlı basit yönergeler verilip tekrarlatılabilir.",
        "Akıl ve Zeka Oyunları atölyesindeki kısa hafıza oyunlarıyla pekiştirilebilir.",
      ],
    },
    islemhizi: {
      kaynak: "WISC-IV — İşlemleme Hızı",
      baslik: "İşlem Hızı",
      cumle:
        "Basit görevlerde hız ve doğruluk konusunda yaşına göre güçlü bir eğilim göstermektedir.",
      oneriler: [
        "Zamanlı, eğlenceli eşleştirme oyunlarıyla desteklenebilir.",
        "Basit “kim daha hızlı bulacak” oyunları oynanabilir.",
        "Robotik Kodlama atölyesindeki hızlı tepki gerektiren görevlerde bu güç fark edilebilir.",
      ],
    },
  },
  "6-7": {
    planlama: {
      kaynak: "CAS — Planlama",
      baslik: "Planlama Becerisi",
      cumle:
        "Göreve başlamadan önce strateji kurma ve adımlarını planlama becerisinde yaşıtlarına göre güçlü bir profil sergilemektedir.",
      oneriler: [
        "Strateji gerektiren akıl oyunlarıyla desteklenebilir.",
        "Basit görevlerde plan yapmasına (ör. ödev sırası) fırsat tanınabilir.",
        "Haftalık küçük bir hedef belirleyip takip etmesi istenebilir.",
        "Robotik Kodlama atölyesindeki basit proje görevlerinde bu yön desteklenebilir.",
      ],
    },
    dikkatg: {
      kaynak: "CAS — Dikkat",
      baslik: "Sürdürülen Dikkat",
      cumle:
        "Görevlere odaklanma ve dikkatini sürdürme konusunda yaşıtlarına göre güçlü bir performans göstermektedir.",
      oneriler: [
        "Orta süreli, hedefe yönelik oyunlarla desteklenebilir.",
        "Ev ödevlerinde kısa hedefli çalışma blokları uygulanabilir.",
        "Astronomi ve Bilim atölyesindeki gözlem/deney etkinlikleri bu potansiyeli besler.",
      ],
    },
    butuncul: {
      kaynak: "CAS — Eş Zamanlı İşlemler",
      baslik: "Bütüncül Kavrayış",
      cumle:
        "Görsel ilişkileri ve örüntüleri kavrama konusunda güçlü bir performans sergilemektedir.",
      oneriler: [
        "Orta karmaşıklıkta yapboz ve inşa oyunlarıyla desteklenebilir.",
        "Harita/plan okuma gibi günlük etkinliklere dahil edilebilir.",
        "Hayal Tasarım atölyesindeki kompozisyon çalışmaları desteklenebilir.",
      ],
    },
    sirali: {
      kaynak: "CAS — Ardıl İşlemler",
      baslik: "Sıralı İşlem Becerisi",
      cumle:
        "Yönergeleri sırasıyla uygulama ve adım adım işlem yapma becerisinde güçlü bir profil sergilemektedir.",
      oneriler: [
        "Basit kodlama mantıklı oyunlarla desteklenebilir.",
        "Basit bir tarifi adım adım uygulaması istenebilir.",
        "Robotik Kodlama atölyesindeki sıralı komut görevleriyle pekiştirilebilir.",
      ],
    },
    sozel: {
      kaynak: "WISC-IV — Sözel Kavrama",
      baslik: "Sözel İfade / Kavrama",
      cumle:
        "Kelime dağarcığını etkin kullanma ve basit sözel akıl yürütme konusunda güçlü bir performans sergilemektedir.",
      oneriler: [
        "Hikâye anlatma ve drama etkinlikleriyle desteklenebilir.",
        "Okuduğu bir hikâyeyi kendi cümleleriyle özetlemesi istenebilir.",
        "Drama atölyesindeki grup canlandırmaları desteklenebilir.",
      ],
    },
    gorselakil: {
      kaynak: "WISC-IV — Algısal Akıl Yürütme",
      baslik: "Görsel-Uzamsal Akıl Yürütme",
      cumle:
        "Şekiller ve örüntüler üzerinde akıl yürütme konusunda güçlü bir performans sergilemektedir.",
      oneriler: [
        "İnşa/yapı setleriyle desteklenebilir.",
        "Orta karmaşıklıkta lego/blok setleriyle model kopyalama yapılabilir.",
        "Hayal Tasarım atölyesindeki tasarım görevleri bu gücü besler.",
      ],
    },
    calismabellegi: {
      kaynak: "WISC-IV — Çalışma Belleği",
      baslik: "Çalışma Belleği",
      cumle:
        "Bilgiyi kısa süreli tutup kullanma becerisinde güçlü bir performans sergilemektedir.",
      oneriler: [
        "Çok adımlı yönergeler içeren oyunlarla desteklenebilir.",
        "Kısa alışveriş listelerini ezberleyip tekrarlaması istenebilir.",
        "Akıl ve Zeka Oyunları atölyesindeki hafıza oyunlarıyla desteklenebilir.",
      ],
    },
    islemhizi: {
      kaynak: "WISC-IV — İşlemleme Hızı",
      baslik: "İşlem Hızı",
      cumle:
        "Görevleri hızlı ve doğru tamamlama konusunda güçlü bir performans sergilemektedir.",
      oneriler: [
        "Hızlı tepki gerektiren oyunlarla desteklenebilir.",
        "Zamanlı basit görevlerle (ör. eşleştirme) pratik yapılabilir.",
        "Akıl ve Zeka Oyunları atölyesindeki hızlı tepki oyunlarında bu güç fark edilebilir.",
      ],
    },
  },
  "8-10": {
    planlama: {
      kaynak: "CAS — Planlama",
      baslik: "Planlama Becerisi",
      cumle:
        "Çok adımlı görevlerde stratejik planlama yapma ve hedefe yönelik ilerleme becerisinde belirgin bir güç göstermektedir.",
      oneriler: [
        "Proje temelli, çok adımlı etkinliklerle desteklenebilir.",
        "Kendi haftalık planını oluşturmasına rehberlik edilebilir.",
        "Kendi sorumluluklarını (ödev, eşya hazırlığı) planlamasına rehberlik edilebilir.",
        "Robotik Kodlama atölyesindeki çok adımlı proje görevlerinde bu yön belirginleşir.",
      ],
    },
    dikkatg: {
      kaynak: "CAS — Dikkat",
      baslik: "Sürdürülen Dikkat",
      cumle:
        "Uzun süreli ve çok adımlı görevlerde dikkatini koruma konusunda belirgin bir güç sergilemektedir.",
      oneriler: [
        "Dikkat gerektiren daha karmaşık görevler ve hobiler (satranç, model yapımı) önerilebilir.",
        "Uzun süreli bir hobi/proje (model yapımı, koleksiyon) desteklenebilir.",
        "Astronomi ve Bilim atölyesindeki uzun gözlem etkinlikleri bu potansiyeli besler.",
      ],
    },
    butuncul: {
      kaynak: "CAS — Eş Zamanlı İşlemler",
      baslik: "Bütüncül Kavrayış",
      cumle:
        "Karmaşık görsel bilgiyi bütüncül biçimde kavrama ve ilişkilendirme konusunda belirgin bir güç göstermektedir.",
      oneriler: [
        "Çok parçalı tasarım/inşa projeleriyle desteklenebilir.",
        "Karmaşık yapboz/model setleriyle desteklenebilir.",
        "Hayal Tasarım atölyesindeki büyük ölçekli tasarım projeleri bu gücü besler.",
      ],
    },
    sirali: {
      kaynak: "CAS — Ardıl İşlemler",
      baslik: "Sıralı İşlem Becerisi",
      cumle:
        "Çok adımlı, koşullu sıralamaları doğru uygulama konusunda belirgin bir güç göstermektedir.",
      oneriler: [
        "Robotik/kodlama gibi sıralı mantık gerektiren etkinliklerle desteklenebilir.",
        "Basit bir algoritma/akış şeması oluşturması istenebilir.",
        "Robotik Kodlama atölyesindeki kodlama görevleri bu yönü doğrudan besler.",
      ],
    },
    sozel: {
      kaynak: "WISC-IV — Sözel Kavrama",
      baslik: "Sözel İfade / Kavrama",
      cumle:
        "Soyut kavramları sözel olarak ifade etme ve sözel akıl yürütme konusunda belirgin bir güç göstermektedir.",
      oneriler: [
        "Tartışma temelli etkinlikler ve ileri düzey okuma materyalleriyle desteklenebilir.",
        "Bir konuda kısa bir sunum hazırlaması teşvik edilebilir.",
        "Drama atölyesindeki doğaçlama ve tartışma etkinlikleri desteklenebilir.",
      ],
    },
    gorselakil: {
      kaynak: "WISC-IV — Algısal Akıl Yürütme",
      baslik: "Görsel-Uzamsal Akıl Yürütme",
      cumle:
        "Karmaşık uzamsal ilişkiler ve geometrik örüntüler üzerinde akıl yürütme konusunda belirgin bir güç göstermektedir.",
      oneriler: [
        "Geometrik bulmacalar ve tasarım temelli projelerle desteklenebilir.",
        "3 boyutlu model/maket yapımı etkinlikleriyle desteklenebilir.",
        "Astronomi atölyesindeki uzamsal kavramlar (gezegen konumları vb.) bu gücü besler.",
      ],
    },
    calismabellegi: {
      kaynak: "WISC-IV — Çalışma Belleği",
      baslik: "Çalışma Belleği",
      cumle:
        "Karmaşık bilgiyi zihninde tutup aynı anda işleme (zihinsel manipülasyon) konusunda belirgin bir güç göstermektedir.",
      oneriler: [
        "Zihinden hesaplama ve strateji oyunlarıyla desteklenebilir.",
        "Çok adımlı zihinden hesaplama alıştırmaları yapılabilir.",
        "Akıl ve Zeka Oyunları atölyesindeki strateji oyunlarıyla pekiştirilebilir.",
      ],
    },
    islemhizi: {
      kaynak: "WISC-IV — İşlemleme Hızı",
      baslik: "İşlem Hızı",
      cumle:
        "Karmaşık görevlerde hızlı ve doğru karar verme konusunda belirgin bir güç göstermektedir.",
      oneriler: [
        "Zamanlı görsel tarama oyunları ve el-göz koordinasyonu etkinlikleriyle desteklenebilir.",
        "Zamanlı, karmaşık görsel tarama oyunlarıyla desteklenebilir.",
        "Robotik Kodlama atölyesindeki hızlı problem çözme görevlerinde bu güç fark edilebilir.",
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Bölüm 4 — Zorlandığı alanlar (form: STRUGGLE_DATA + EXTRAS)
// ---------------------------------------------------------------------------

export type ZorlanmaAlani = {
  alan: ZorlanmaSutunu;
  baslik: string;
  /** Zorlanmanın yaşa göre gelişimsel yorumu. */
  yorum: string;
  /** Uzmana: önerilen destek / oyun / yönlendirme. */
  oneriler: readonly string[];
  /** Veliyle paylaşılabilecek, Türk aile bağlamı gözetilerek yazılmış öneriler. */
  aile: readonly string[];
};

/** Her sütunda hangi maddeler var — banda özel madde buna EK olarak gelir. */
export const ZORLANMA_GRUPLARI: readonly {
  sutun: ZorlanmaSutunu;
  simge: string;
  anahtarlar: readonly string[];
}[] = [
  {
    sutun: "Bilişsel",
    simge: "🧠",
    anahtarlar: ["dikkat", "hafiza", "problem", "mantik", "sirali", "gorsel"],
  },
  {
    sutun: "Sosyal",
    simge: "🤝",
    anahtarlar: ["iletisim", "grup", "paylasma", "liderlik"],
  },
  {
    sutun: "Duygusal",
    simge: "💛",
    anahtarlar: [
      "duyguduzenleme",
      "ozguven",
      "kaygi",
      "bagimsizlik",
      "duyuhassasiyeti",
      "mukemmeliyetcilik",
      "icekapaniklik",
    ],
  },
];

export const ZORLANMA_ALANLARI: Record<
  YasBandi,
  Record<string, ZorlanmaAlani>
> = {
  "4-5": {
    dikkat: {
      alan: "Bilişsel",
      baslik: "Dikkat / Konsantrasyon",
      yorum:
        "Bu yaşta dikkat süresi doğal olarak kısadır (5-15 dk); kısa, oyunlaştırılmış görevler daha etkilidir.",
      oneriler: [
        "ZetZeka'nın “3-6 Yaş Oyunları” / “Dikkat ve Konsantrasyon” kategorisi (örn. RENKKAT Dikkat ve Zeka Oyunu)",
        "Evde: 2-3 dakikalık kısa “bul-bul” oyunları",
      ],
      aile: [
        "Ev ortamında dikkat dağıtıcıları (TV, ekran) azaltarak kısa görevler için sakin bir köşe oluşturabilirsiniz.",
      ],
    },
    hafiza: {
      alan: "Bilişsel",
      baslik: "Hafıza",
      yorum:
        "Kısa süreli hafıza henüz gelişim aşamasındadır; basit eşleştirme oyunları uygundur.",
      oneriler: [
        "ZetZeka'nın “3-6 Yaş Oyunları” / “Hafıza Güçlendirme” kategorisi",
        "Evde: 3-4 kartlık basit hafıza oyunu",
      ],
      aile: [
        "Günlük rutinleri (sabah, akşam) sürekli aynı sırayla tekrarlayarak hafızasını doğal yoldan güçlendirebilirsiniz.",
      ],
    },
    problem: {
      alan: "Bilişsel",
      baslik: "Problem Çözme",
      yorum:
        "Problem çözme henüz somut ve deneme-yanılma ağırlıklıdır; tek adımlı bulmacalar uygundur.",
      oneriler: [
        "ZetZeka'nın “3-6 Yaş Oyunları” / “Problem Çözme” kategorisi",
        "Evde: Büyük parçalı, basit yapbozlar",
      ],
      aile: [
        "Basit bir sorunla karşılaştığında hemen çözmek yerine “sen ne yapardın?” diye sorup düşünme fırsatı tanıyabilirsiniz.",
      ],
    },
    mantik: {
      alan: "Bilişsel",
      baslik: "Mantık Yürütme",
      yorum: "Mantık yürütme henüz çok somut nesnelerle desteklenmelidir.",
      oneriler: [
        "ZetZeka'nın “3-6 Yaş Oyunları” / “Mantık Yürütme” kategorisi",
        "Evde: Renk/şekil sıralama oyunları",
      ],
      aile: [
        "Günlük hayatta “bu neden oldu dersin?” gibi basit nedensellik soruları sorabilirsiniz.",
      ],
    },
    sirali: {
      alan: "Bilişsel",
      baslik: "Sıralı Düşünme",
      yorum:
        "Sıralama becerisi henüz gelişmektedir; 2-3 adımlı basit sıralamalar uygundur.",
      oneriler: [
        "ZetZeka'nın “3-6 Yaş Oyunları” / “Sıralı Düşünme” kategorisi",
        "Evde: Sabah rutinini resimlerle sıralatma",
      ],
      aile: [
        "Sabah rutinini resimli bir çizelgeyle görselleştirip adımları birlikte takip edebilirsiniz.",
      ],
    },
    gorsel: {
      alan: "Bilişsel",
      baslik: "Görsel Algı",
      yorum: "Görsel algı büyük parçalı, basit yapbozlarla desteklenir.",
      oneriler: [
        "ZetZeka'nın “3-6 Yaş Oyunları” / “Görsel Algı” kategorisi",
        "Evde: Büyük parçalı yapbozlar",
      ],
      aile: [
        "Evde basit yapboz ve inşa oyunlarına birlikte düzenli zaman ayırabilirsiniz.",
      ],
    },
    iletisim: {
      alan: "Sosyal",
      baslik: "İletişim / Kendini İfade",
      yorum:
        "Bu yaşta iletişim büyük ölçüde yetişkin desteğiyle şekillenir; kısa, somut sorularla ifade teşvik edilir.",
      oneriler: [
        "Kısa, somut sorularla (“ne oldu, sonra ne oldu”) ifade desteklenebilir",
        "Kalıcı/yaygınsa: oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Günlük olaylarını kesmeden dinleyip “sonra ne oldu?” diye merakla sorular sorabilirsiniz.",
      ],
    },
    grup: {
      alan: "Sosyal",
      baslik: "Grup Çalışması / İş birliği",
      yorum:
        "Paralel oyundan işbirlikli oyuna geçiş sürecindedir; kısa süreli ortak etkinlikler uygundur.",
      oneriler: [
        "Kısa süreli, 2 kişilik ortak etkinliklerle başlanabilir",
        "Kalıcı/yaygınsa: oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: ["Kardeş/akranlarla kısa süreli ortak oyunlar planlayabilirsiniz."],
    },
    paylasma: {
      alan: "Sosyal",
      baslik: "Paylaşma / Sıra Bekleme",
      yorum:
        "Paylaşma ve sıra bekleme bu yaşta henüz gelişmekte olan bir beceridir, sabırla desteklenmelidir.",
      oneriler: [
        "Kısa süreli, net sıralı oyunlarla pratik edilebilir",
        "Dürtü kontrolü belirginse: ergoterapi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Evde basit kutu oyunlarıyla sırasını beklemeyi pratik ettirebilirsiniz.",
      ],
    },
    liderlik: {
      alan: "Sosyal",
      baslik: "Liderlik / Takip Etme Dengesi",
      yorum:
        "Bu yaşta liderlik/takip dengesi henüz belirgin değildir, oyun içinde doğal olarak şekillenir.",
      oneriler: ["Dönüşümlü roller içeren basit oyunlarla pratik edilebilir"],
      aile: ["Oyunlarda sırayla “lider” olma fırsatı tanıyabilirsiniz."],
    },
    duyguduzenleme: {
      alan: "Duygusal",
      baslik: "Duygu Düzenleme",
      yorum:
        "Öfke nöbetleri bu yaşta gelişimsel olarak beklenir; sakinleştirme stratejileri erken yaşta öğretilebilir.",
      oneriler: [
        "Oyun terapisi değerlendirmesi düşünülebilir",
        "Aile danışmanlığıyla tutarlı sakinleştirme stratejileri desteklenebilir",
      ],
      aile: [
        "Öfkelendiğinde önce siz sakin kalıp, sonra birlikte nefes alma gibi basit sakinleşme yöntemleri deneyebilirsiniz.",
      ],
    },
    ozguven: {
      alan: "Duygusal",
      baslik: "Özgüven",
      yorum:
        "Özgüven bu yaşta küçük başarı deneyimleriyle şekillenmeye başlar.",
      oneriler: [
        "Bağımsız tamamlanabilir küçük görevler verilmesi önerilebilir",
        "Kalıcıysa: oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Küçük başarılarını fark edip somut şekilde (“bunu kendin yaptın!”) övebilirsiniz.",
      ],
    },
    kaygi: {
      alan: "Duygusal",
      baslik: "Kaygı",
      yorum:
        "Ayrılma kaygısı bu yaşta sık görülür; kademeli ve öngörülebilir geçişler kaygıyı azaltır.",
      oneriler: [
        "Oyun terapisi değerlendirmesi düşünülebilir",
        "Yoğun/sürekliyse: çocuk psikiyatrisi değerlendirmesi önerilir",
      ],
      aile: [
        "Yeni/değişen durumları önceden, sakin bir dille anlatarak hazırlayabilirsiniz.",
      ],
    },
    bagimsizlik: {
      alan: "Duygusal",
      baslik: "Bağımsızlık / Ayrılma",
      yorum:
        "Bağımsızlık isteği (“ben yaparım”) bu yaşta belirgindir; güvenli sınırlar içinde desteklenmelidir.",
      oneriler: [
        "Kademeli, güvenli bağımsızlık fırsatları tanınabilir",
        "Aile danışmanlığı önerilebilir",
      ],
      aile: [
        "Kısa süreli ayrılıkları önceden haber vererek ve tutarlı biçimde uygulayarak güven inşa edebilirsiniz.",
      ],
    },
    ayrilmakaygisi: {
      alan: "Duygusal",
      baslik: "Ayrılma Kaygısı",
      yorum:
        "Yetişkinden ayrılırken yoğun ağlama/huzursuzluk bu yaşta gelişimsel olarak beklenebilir; kademeli ayrılma deneyimleri kaygıyı azaltır.",
      oneriler: [
        "Kısa süreli, önceden haber verilen ayrılıklarla güven inşa edilebilir",
        "Yoğun/sürekliyse: oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Ayrılık öncesi kısa bir “veda ritüeli” oluşturup her seferinde aynı şekilde uygulayabilirsiniz.",
      ],
    },
    duyuhassasiyeti: {
      alan: "Duygusal",
      baslik: "Duyu Hassasiyeti",
      yorum:
        "Belirli seslere, dokulara veya ışığa aşırı tepki, bu yaşta duyusal sistemin gelişim sürecinin doğal bir parçası olabilir.",
      oneriler: [
        "Ergoterapi değerlendirmesi düşünülebilir",
        "Ortamdaki ani duyusal uyaranların azaltılması faydalı olabilir",
      ],
      aile: [
        "Yoğun sesli/kalabalık ortamlara geçişi kademeli ve önceden haber vererek yapabilirsiniz.",
      ],
    },
    mukemmeliyetcilik: {
      alan: "Duygusal",
      baslik: "Mükemmeliyetçilik",
      yorum:
        "Aşırı silme/tekrar yapma ve küçük hatada yıkılma, bu yaşta yüksek özeleştiri eğilimine işaret edebilir.",
      oneriler: ["Oyun terapisi değerlendirmesi düşünülebilir"],
      aile: [
        "“Hata yapmak öğrenmenin bir parçası” mesajını sık ve tutarlı şekilde vermeye çalışabilirsiniz.",
      ],
    },
    icekapaniklik: {
      alan: "Duygusal",
      baslik: "İçe Kapanıklık / Sosyal Çekilme",
      yorum:
        "Yeni ortamlarda sessiz kalma, gözlemlemeyi tercih etme bu yaşta mizaçla ilişkili olabilir; zamanla azalıyorsa kaygı verici değildir.",
      oneriler: [
        "Isınma süresine önem verilebilir; zorlanma sürüyorsa oyun terapisi düşünülebilir",
      ],
      aile: [
        "Yeni ortamlara girmeden önce ne olacağını anlatıp hazırlık süresi tanıyabilirsiniz.",
      ],
    },
  },
  "6-7": {
    dikkat: {
      alan: "Bilişsel",
      baslik: "Dikkat / Konsantrasyon",
      yorum:
        "Dikkat süresi uzamaya başlar (15-25 dk); kurallı, hedefe yönelik oyunlar dikkati daha uzun tutmaya yardımcı olur.",
      oneriler: [
        "ZetZeka'nın “6-9 Yaş Oyunları” / “Dikkat ve Konsantrasyon” kategorisi (örn. VIZ VIZ Dikkat ve Zeka Oyunu)",
        "Evde: Zamanlayıcıyla kısa görev-mola döngüleri",
      ],
      aile: [
        "Ödev/görev öncesi kısa bir “hazır mısın?” rutiniyle odaklanmaya geçişi kolaylaştırabilirsiniz.",
      ],
    },
    hafiza: {
      alan: "Bilişsel",
      baslik: "Hafıza",
      yorum:
        "Hafıza kapasitesi artar; biraz daha karmaşık eşleştirme ve sıralama oyunları uygundur.",
      oneriler: [
        "ZetZeka'nın “6-9 Yaş Oyunları” / “Hafıza Güçlendirme” kategorisi",
        "Evde: Kısa bir listeyi (4-5 madde) tekrar ettirme",
      ],
      aile: [
        "Okul çantasını/eşyalarını kontrol listesiyle birlikte hazırlamasını isteyebilirsiniz.",
      ],
    },
    problem: {
      alan: "Bilişsel",
      baslik: "Problem Çözme",
      yorum:
        "Çok adımlı olmayan ama planlama gerektiren bulmacalarla problem çözme desteklenebilir.",
      oneriler: [
        "ZetZeka'nın “6-9 Yaş Oyunları” / “Problem Çözme” kategorisi (örn. GO Ahşap Zeka ve Akıl Oyunu)",
        "Evde: Basit labirent kitapları",
      ],
      aile: [
        "Ona hemen cevap vermek yerine ipucu vererek kendi çözümünü bulmasına alan açabilirsiniz.",
      ],
    },
    mantik: {
      alan: "Bilişsel",
      baslik: "Mantık Yürütme",
      yorum:
        "Basit neden-sonuç ilişkileri kurmaya yönelik oyunlar bu yaşta etkilidir.",
      oneriler: [
        "ZetZeka'nın “6-9 Yaş Oyunları” / “Mantık Yürütme” kategorisi (örn. 9 Taş & 3 Taş Ahşap Zeka Oyunu)",
        "Evde: “Bu neden oldu?” soruları",
      ],
      aile: [
        "Basit bilmece ve tahmin oyunlarını aile içinde bir oyun gecesi rutinine dönüştürebilirsiniz.",
      ],
    },
    sirali: {
      alan: "Bilişsel",
      baslik: "Sıralı Düşünme",
      yorum:
        "3-4 adımlı sıralı görevler ve basit kodlama mantığı bu yaşta desteklenebilir.",
      oneriler: [
        "ZetZeka'nın “6-9 Yaş Oyunları” / “Sıralı Düşünme” kategorisi (örn. SMART CODE Kodlama Oyunu)",
      ],
      aile: [
        "Basit bir tarifi veya küçük bir işi birlikte, adım adım yapabilirsiniz.",
      ],
    },
    gorsel: {
      alan: "Bilişsel",
      baslik: "Görsel Algı",
      yorum:
        "Orta karmaşıklıkta inşa/yapı oyunları görsel-mekânsal algıyı destekler.",
      oneriler: [
        "ZetZeka'nın “6-9 Yaş Oyunları” / “Görsel ve Mekânsal Algı” kategorisi (örn. İSTİF Ahşap Zeka Oyunu)",
      ],
      aile: [
        "Lego benzeri yapı setleriyle model kopyalama etkinlikleri yapabilirsiniz.",
      ],
    },
    iletisim: {
      alan: "Sosyal",
      baslik: "İletişim / Kendini İfade",
      yorum:
        "Akranlarla sözel etkileşim artar; küçük gruplarda konuşma fırsatı iletişimi destekler.",
      oneriler: [
        "Küçük gruplu sohbet/paylaşım fırsatları önerilebilir",
        "Kalıcı/yaygınsa: oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Evde küçük “bugün ne öğrendin” sohbetleriyle anlatma pratiği yaptırabilirsiniz.",
      ],
    },
    grup: {
      alan: "Sosyal",
      baslik: "Grup Çalışması / İş birliği",
      yorum:
        "Kurallı grup oyunlarına katılım artar; net rollü küçük grup etkinlikleri işbirliğini destekler.",
      oneriler: [
        "Net kurallı, küçük grup etkinlikleri önerilebilir",
        "Kalıcı/yaygınsa: oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Ev içinde basit görevleri (sofra kurma gibi) birlikte, paylaşarak yapmasını sağlayabilirsiniz.",
      ],
    },
    paylasma: {
      alan: "Sosyal",
      baslik: "Paylaşma / Sıra Bekleme",
      yorum:
        "Kazanma-kaybetmeyi tolere etme ile birlikte paylaşma becerisi de olgunlaşır.",
      oneriler: [
        "Kurallı oyunlarla sıra bekleme pratik edilebilir",
        "Dürtü kontrolü belirginse: ergoterapi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Kart/masa oyunlarında kurala uymayı siz de model olarak gösterebilirsiniz.",
      ],
    },
    liderlik: {
      alan: "Sosyal",
      baslik: "Liderlik / Takip Etme Dengesi",
      yorum:
        "Grup içinde rol alma isteği artar; dönüşümlü liderlik fırsatları dengeyi destekler.",
      oneriler: ["Sırayla “lider” olunan grup etkinlikleri önerilebilir"],
      aile: [
        "Ev içi küçük kararlarda (ör. bugün ne oynayalım) ona da söz hakkı verebilirsiniz.",
      ],
    },
    duyguduzenleme: {
      alan: "Duygusal",
      baslik: "Duygu Düzenleme",
      yorum:
        "Öz düzenleme gelişmekte olsa da hâlâ yetişkin desteğine ihtiyaç duyulur.",
      oneriler: [
        "Oyun terapisi değerlendirmesi düşünülebilir",
        "Aile danışmanlığı önerilebilir",
      ],
      aile: [
        "Duygularını isimlendirmesine yardımcı olup “kızgın görünüyorsun, ne oldu?” diye yaklaşabilirsiniz.",
      ],
    },
    ozguven: {
      alan: "Duygusal",
      baslik: "Özgüven",
      yorum:
        "Yeterlilik hissi okula/yapılandırılmış ortama uyumla yakından ilişkilidir.",
      oneriler: [
        "Çaba odaklı geri bildirim önerilebilir",
        "Kalıcıysa: oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Sonuçtan çok çabasını takdir eden bir dil kullanabilirsiniz (“çok uğraştın” gibi).",
      ],
    },
    kaygi: {
      alan: "Duygusal",
      baslik: "Kaygı",
      yorum:
        "Performans kaygısı (hata yapma korkusu) bu yaşta belirginleşebilir.",
      oneriler: [
        "Oyun terapisi değerlendirmesi düşünülebilir",
        "Yoğun/sürekliyse: çocuk psikiyatrisi değerlendirmesi önerilir",
      ],
      aile: [
        "Endişelerini yargılamadan dinleyip “bu normal, birlikte düşünelim” diyebilirsiniz.",
      ],
    },
    bagimsizlik: {
      alan: "Duygusal",
      baslik: "Bağımsızlık / Ayrılma",
      yorum:
        "Okula/yapılandırılmış ortama uyum sürecinde bağımsızlık ihtiyacı artar.",
      oneriler: ["Kısa süreli bağımsız görevlerle güven inşa edilebilir"],
      aile: [
        "Bağımsız yapabileceği küçük görevlerde (giyinme, hazırlanma) müdahaleyi azaltabilirsiniz.",
      ],
    },
    kurallarauyum: {
      alan: "Sosyal",
      baslik: "Kurallara Uyum",
      yorum:
        "Okula/yapılandırılmış ortama geçiş sürecinde kurallara uyumda geçici zorlanmalar görülebilir.",
      oneriler: [
        "Kuralların basit ve tutarlı şekilde hatırlatılması önerilebilir",
        "Kalıcıysa: davranışsal destek/danışmanlık değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Ev kurallarını da net ve tutarlı tutarak okuldaki düzenle uyumlu bir çerçeve sunabilirsiniz.",
      ],
    },
    duyuhassasiyeti: {
      alan: "Duygusal",
      baslik: "Duyu Hassasiyeti",
      yorum:
        "Duyusal hassasiyet, okul/atölye ortamındaki yoğun uyaranlarla (gürültü, kalabalık) daha belirgin hale gelebilir.",
      oneriler: [
        "Ergoterapi değerlendirmesi düşünülebilir",
        "Kısa molalarla duyusal yüklenmeyi azaltmak faydalı olabilir",
      ],
      aile: [
        "Evde sakin bir “dinlenme köşesi” oluşturup yoğunluk hissettiğinde kullanmasını önerebilirsiniz.",
      ],
    },
    mukemmeliyetcilik: {
      alan: "Duygusal",
      baslik: "Mükemmeliyetçilik",
      yorum:
        "Okula başlangıçla birlikte “doğru yapma” baskısı artabilir, mükemmeliyetçi eğilimler belirginleşebilir.",
      oneriler: ["Oyun terapisi değerlendirmesi düşünülebilir"],
      aile: [
        "Kendi hatalarınızı da paylaşarak hatanın normal olduğunu modelleyebilirsiniz.",
      ],
    },
    icekapaniklik: {
      alan: "Duygusal",
      baslik: "İçe Kapanıklık / Sosyal Çekilme",
      yorum:
        "Akranlarla etkileşimden kaçınma, grup ortamlarında sessiz kalma bu yaşta izlenmesi gereken bir örüntüdür.",
      oneriler: ["Oyun terapisi değerlendirmesi düşünülebilir"],
      aile: [
        "Küçük, güvenli sosyal ortamlarda (1-2 kişilik) etkileşimi kolaylaştırabilirsiniz.",
      ],
    },
  },
  "8-10": {
    dikkat: {
      alan: "Bilişsel",
      baslik: "Dikkat / Konsantrasyon",
      yorum:
        "Bu yaşta dikkat süresi 25-40 dakikaya kadar uzayabilir; çok adımlı görevler dikkati sınayarak geliştirir.",
      oneriler: [
        "ZetZeka'nın “9-12 Yaş Oyunları” / “Dikkat ve Konsantrasyon” kategorisi",
        "Evde: Uzun bir görevi alt adımlara bölüp kontrol listesiyle takip ettirme",
      ],
      aile: [
        "Uzun görevleri birlikte küçük adımlara bölüp bir kontrol listesi oluşturmasına yardımcı olabilirsiniz.",
      ],
    },
    hafiza: {
      alan: "Bilişsel",
      baslik: "Hafıza",
      yorum:
        "Hafıza stratejileri (gruplama, ilişkilendirme) bu yaşta öğretilebilir hale gelir.",
      oneriler: [
        "ZetZeka'nın “9-12 Yaş Oyunları” / “Hafıza Güçlendirme” kategorisi",
        "Evde: Bilgiyi kategori/gruplara ayırarak ezberletme",
      ],
      aile: [
        "Ders çalışırken bilgiyi kendi cümleleriyle özetletmesini isteyebilirsiniz — hatırlamayı güçlendirir.",
      ],
    },
    problem: {
      alan: "Bilişsel",
      baslik: "Problem Çözme",
      yorum:
        "Çok adımlı, stratejik problem çözme görevleri bu yaşta daha anlamlı hale gelir.",
      oneriler: [
        "ZetZeka'nın “9-12 Yaş Oyunları” / “Problem Çözme” kategorisi (örn. Resfebe Zeka ve Akıl Oyunu)",
        "Evde: Gerçek bir problem için birlikte çözüm listesi çıkarma",
      ],
      aile: [
        "Gerçek hayattaki küçük bir problemi (ör. oda düzeni) planlamasına alan tanıyabilirsiniz.",
      ],
    },
    mantik: {
      alan: "Bilişsel",
      baslik: "Mantık Yürütme",
      yorum:
        "Soyut, sayısal-stratejik mantık yürütme bu yaşta daha anlamlı olur.",
      oneriler: [
        "ZetZeka'nın “9-12 Yaş Oyunları” / “Mantık Yürütme” kategorisi (örn. Sayıların Savaşı Zeka ve Akıl Oyunu)",
      ],
      aile: [
        "Bir karar alırken artı-eksileri birlikte listeleyip mantık yürütmesine model olabilirsiniz.",
      ],
    },
    sirali: {
      alan: "Bilişsel",
      baslik: "Sıralı Düşünme",
      yorum:
        "Çok adımlı, koşullu sıralamalar (“eğer - o zaman” mantığı) bu yaşta anlamlı hale gelir.",
      oneriler: [
        "ZetZeka'nın “9-12 Yaş Oyunları” / “Sıralı Düşünme” kategorisi",
      ],
      aile: [
        "Haftalık planını (ödev, etkinlik) kendisinin sıralamasına rehberlik edebilirsiniz.",
      ],
    },
    gorsel: {
      alan: "Bilişsel",
      baslik: "Görsel Algı",
      yorum:
        "Daha karmaşık, çok parçalı inşa ve tasarım etkinlikleri bu yaşta uygundur.",
      oneriler: [
        "ZetZeka'nın “9-12 Yaş Oyunları” / “Görsel ve Mekânsal Algı” kategorisi (örn. Designer Blocks Ahşap Yapı Seti)",
      ],
      aile: [
        "Harita okuma, yön bulma gibi günlük hayat etkinliklerine dahil edebilirsiniz.",
      ],
    },
    iletisim: {
      alan: "Sosyal",
      baslik: "İletişim / Kendini İfade",
      yorum:
        "Akran onayına duyarlılık arttığından, iletişim güçlüğü sosyal kaygıyla iç içe geçebilir.",
      oneriler: [
        "Grup içi sunum/paylaşım fırsatları kademeli artırılabilir",
        "Kalıcı/yaygınsa: oyun terapisi veya bireysel danışmanlık değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Aile sohbetlerinde ona söz hakkı tanıyıp fikrini sormayı alışkanlık haline getirebilirsiniz.",
      ],
    },
    grup: {
      alan: "Sosyal",
      baslik: "Grup Çalışması / İş birliği",
      yorum:
        "Takım çalışması ve ortak strateji üretme becerisi bu yaşta önem kazanır.",
      oneriler: [
        "Takım temelli görev/proje çalışmaları önerilebilir",
        "Kalıcı/yaygınsa: sosyal beceri grubu veya oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Aile içi küçük projelerde (ör. hafta sonu planı) ona da görev vererek takım çalışmasını destekleyebilirsiniz.",
      ],
    },
    paylasma: {
      alan: "Sosyal",
      baslik: "Paylaşma / Sıra Bekleme",
      yorum:
        "Bu yaşta paylaşma güçlüğü daha çok adil oyun/kural anlayışıyla ilişkilendirilir.",
      oneriler: [
        "Takım oyunlarında adil oyun kuralları vurgulanabilir",
        "Kalıcıysa: sosyal beceri çalışması veya oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Takım sporlarına veya kulüp etkinliklerine yönlendirerek adil oyun deneyimi kazandırabilirsiniz.",
      ],
    },
    liderlik: {
      alan: "Sosyal",
      baslik: "Liderlik / Takip Etme Dengesi",
      yorum:
        "Takım içi rol ve statü farkındalığı belirginleşir; adil rol dağılımı önem kazanır.",
      oneriler: [
        "Takım projelerinde rol dağılımı açıkça planlanabilir",
        "Kalıcıysa: sosyal beceri çalışması değerlendirilebilir",
      ],
      aile: [
        "Aile etkinliklerini planlarken ona da belirli bir sorumluluk/rol verebilirsiniz.",
      ],
    },
    duyguduzenleme: {
      alan: "Duygusal",
      baslik: "Duygu Düzenleme",
      yorum:
        "Bu yaşta duygu düzenleme güçlüğü genellikle akademik/sosyal baskı ile ilişkilenir.",
      oneriler: [
        "Oyun terapisi veya bireysel danışmanlık değerlendirmesi düşünülebilir",
        "Aile danışmanlığı önerilebilir",
      ],
      aile: [
        "Zor bir an yaşadığında hemen çözüm sunmak yerine önce duygusunu duyduğunuzu hissettirebilirsiniz.",
      ],
    },
    ozguven: {
      alan: "Duygusal",
      baslik: "Özgüven",
      yorum:
        "Bu yaşta özgüven akademik ve sosyal başarıyla daha yakından ilişkilenir.",
      oneriler: [
        "Bireysel danışmanlık veya oyun terapisi değerlendirmesi düşünülebilir",
        "Aile danışmanlığıyla evde çaba-odaklı dil desteklenebilir",
      ],
      aile: [
        "Kıyaslamadan kaçınıp kendi ilerlemesine odaklanan bir geri bildirim dili kurabilirsiniz.",
      ],
    },
    kaygi: {
      alan: "Duygusal",
      baslik: "Kaygı",
      yorum:
        "Akran onayı ve başarı kaygısı bu yaşta kaygının önemli bir kaynağı olabilir.",
      oneriler: [
        "Oyun terapisi veya bireysel danışmanlık değerlendirmesi düşünülebilir",
        "Yoğun/sürekliyse: çocuk psikiyatrisi değerlendirmesi önerilir",
      ],
      aile: [
        "Kaygı yaratan durumlar öncesinde birlikte küçük bir plan yaparak kontrol hissini artırabilirsiniz.",
      ],
    },
    bagimsizlik: {
      alan: "Duygusal",
      baslik: "Bağımsızlık / Ayrılma",
      yorum:
        "Bu yaşta bağımsızlık isteğiyle desteğe direnç arasında bir denge kurulması gerekebilir.",
      oneriler: [
        "Sorumluluk alanı kademeli genişletilebilir",
        "Aile danışmanlığı önerilebilir",
      ],
      aile: [
        "Sorumluluk alanını kademeli genişletip ona güvendiğinizi sözle de ifade edebilirsiniz.",
      ],
    },
    akranyetersizlik: {
      alan: "Duygusal",
      baslik: "Akran Kıyaslaması / Yetersizlik Hissi",
      yorum:
        "Bu yaşta kendini akranlarla kıyaslama belirginleşir; sürekli “yetersiz” hissetme özgüveni ciddi biçimde etkileyebilir.",
      oneriler: [
        "Bireysel danışmanlık veya oyun terapisi değerlendirmesi düşünülebilir",
        "Aile danışmanlığıyla kıyaslayıcı dilden kaçınılması desteklenebilir",
      ],
      aile: [
        "Başkalarıyla kıyaslamak yerine kendi gelişimine odaklanan cümleler kurabilirsiniz (“geçen aya göre çok ilerledin”).",
      ],
    },
    duyuhassasiyeti: {
      alan: "Duygusal",
      baslik: "Duyu Hassasiyeti",
      yorum:
        "Bu yaşta duyusal hassasiyet fark edilip sözelleştirilebilir hale gelir; çocuğun kendi tetikleyicilerini tanımasına yardımcı olunabilir.",
      oneriler: ["Ergoterapi değerlendirmesi düşünülebilir"],
      aile: [
        "Hangi ortamların/seslerin rahatsız ettiğini birlikte konuşup küçük çözümler (kulaklık, mola vb.) üretebilirsiniz.",
      ],
    },
    mukemmeliyetcilik: {
      alan: "Duygusal",
      baslik: "Mükemmeliyetçilik",
      yorum:
        "Akademik/sosyal karşılaştırmanın arttığı bu dönemde mükemmeliyetçilik kaygıyla birlikte yoğunlaşabilir.",
      oneriler: [
        "Bireysel danışmanlık veya oyun terapisi değerlendirmesi düşünülebilir",
      ],
      aile: [
        "Sonuç yerine süreci ve çabayı öne çıkaran bir geri bildirim dili kurabilirsiniz.",
      ],
    },
    icekapaniklik: {
      alan: "Duygusal",
      baslik: "İçe Kapanıklık / Sosyal Çekilme",
      yorum:
        "Bu yaşta sürekli içe kapanma, akran ilişkilerinden kaçınma daha dikkatle değerlendirilmesi gereken bir işarettir.",
      oneriler: [
        "Bireysel danışmanlık veya oyun terapisi değerlendirmesi düşünülebilir",
        "Yaygın ve sürekliyse: çocuk psikiyatrisi değerlendirmesi önerilir",
      ],
      aile: [
        "Yargılamadan, baskı yapmadan sosyal ortamlara katılım için küçük adımlar önerebilirsiniz.",
      ],
    },
  },
};

/**
 * Yalnızca o bantta sorulan ek madde — kendi sütununun sonuna eklenir.
 * Anahtarı `ZORLANMA_ALANLARI` içinde zaten tanımlı.
 */
export type BandaOzelZorlanma = {
  anahtar: string;
  sutun: ZorlanmaSutunu;
  etiket: string;
};

export const BANDA_OZEL_ZORLANMA: Record<YasBandi, BandaOzelZorlanma> = {
  "4-5": {
    anahtar: "ayrilmakaygisi",
    sutun: "Duygusal",
    etiket: "Ayrılma Kaygısı",
  },
  "6-7": {
    anahtar: "kurallarauyum",
    sutun: "Sosyal",
    etiket: "Kurallara Uyum",
  },
  "8-10": {
    anahtar: "akranyetersizlik",
    sutun: "Duygusal",
    etiket: "Akran Kıyaslaması / Yetersizlik Hissi",
  },
};

/** Bir bantta işaretlenebilecek tüm zorlanma anahtarları, sütun sırasıyla. */
export function bandinZorlanmaAnahtarlari(band: YasBandi): string[] {
  const ozel = BANDA_OZEL_ZORLANMA[band];
  return ZORLANMA_GRUPLARI.flatMap((grup) =>
    grup.sutun === ozel.sutun
      ? [...grup.anahtarlar, ozel.anahtar]
      : [...grup.anahtarlar],
  );
}
