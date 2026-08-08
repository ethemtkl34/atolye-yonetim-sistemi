/**
 * 2026 Sonbahar Dönemi'nde müfredatı eksik olan atölyelerin 10 haftalık
 * konuları.
 *
 * Neden yeniden yazıldı: bu dört atölyenin veritabanındaki tek müfredatı
 * "3. hafta uygulaması — … etkinlik ve gözlem konuları" biçiminde yer
 * tutucuydu. `mufredatYeterliMi` bu satırları saymıyor (haklı olarak: onlardan
 * üretilecek paragraf hiçbir şey söylemeyen bir metin olurdu), dolayısıyla
 * içerik üretimi de çalışmıyordu.
 *
 * Başlık ve açıklama biçimi mevcut Bilim/Drama müfredatıyla aynı: başlık
 * konunun adı, açıklama o hafta ne yapıldığını edilgen ve geçmiş zamanla
 * anlatan tek cümle. Yapay zekâ paragrafı YALNIZCA buradan besleniyor —
 * burada olmayan bir etkinlik rapora giremez.
 */

export type HaftaKonusu = {
  hafta: number;
  baslik: string;
  aciklama: string;
};

export type AtolyeMufredati = {
  atolyeId: string;
  atolyeAdi: string;
  haftalar: HaftaKonusu[];
};

export const EKSIK_MUFREDATLAR: AtolyeMufredati[] = [
  {
    atolyeId: "atl_stem",
    atolyeAdi: "STEM Maker Atölyesi",
    haftalar: [
      {
        hafta: 1,
        baslik: "Tasarım süreci ve atölye güvenliği",
        aciklama:
          "Maker çalışmalarının adımları (sor, tasarla, yap, dene, geliştir) tanıtılır; el aletlerinin güvenli kullanımı uygulamalı olarak gösterilir.",
      },
      {
        hafta: 2,
        baslik: "Köprü mühendisliği — yük ve dayanıklılık",
        aciklama:
          "Çubuk ve karton malzemeyle köprü modelleri kurulur; taşıdıkları yük ölçülerek üçgen desteklerin dayanıklılığa etkisi karşılaştırılır.",
      },
      {
        hafta: 3,
        baslik: "Basit makineler — kaldıraç ve makara",
        aciklama:
          "Kaldıraç ve makara düzenekleri kurularak kuvvetten kazanç deneyle gösterilir; destek noktasının yeri değiştirilerek sonuçlar kaydedilir.",
      },
      {
        hafta: 4,
        baslik: "Rüzgâr enerjisiyle çalışan pervane",
        aciklama:
          "Farklı kanat sayısı ve açılarına sahip pervaneler yapılır; hangi tasarımın daha hızlı döndüğü ölçülerek karşılaştırılır.",
      },
      {
        hafta: 5,
        baslik: "Su geçirmez malzeme tasarımı",
        aciklama:
          "Malzemelerin su geçirgenliği test edilir; öğrenciler elde ettikleri sonuçlara göre bir barınak modeli için malzeme seçimi yapar.",
      },
      {
        hafta: 6,
        baslik: "Geri dönüşüm malzemesiyle mekanizma kurma",
        aciklama:
          "Kutu, kapak ve şişe gibi atık malzemelerden hareketli bir mekanizma tasarlanır; dişli ve manivela ilişkisi uygulamalı olarak ele alınır.",
      },
      {
        hafta: 7,
        baslik: "Ölçme, çizim ve ölçekli maket",
        aciklama:
          "Cetvel ve şablonla ölçüm alınır; gerçek bir nesnenin ölçekli maketi çizilerek kartondan üretilir.",
      },
      {
        hafta: 8,
        baslik: "Basit elektrik devresi ve anahtar",
        aciklama:
          "Pil, kablo ve ampulle kapalı devre kurulur; kendi yaptıkları anahtarla devreyi açıp kapatma denenir.",
      },
      {
        hafta: 9,
        baslik: "Prototipi geliştirme ve hata ayıklama",
        aciklama:
          "Önceki haftalarda yapılan modellerden biri seçilerek çalışmayan yanı tespit edilir; değişiklik yapılıp yeniden test edilir.",
      },
      {
        hafta: 10,
        baslik: "Tasarım sergisi ve sunum",
        aciklama:
          "Dönem boyunca üretilen modeller sergilenir; her öğrenci tasarımının nasıl çalıştığını ve karşılaştığı zorluğu grupla paylaşır.",
      },
    ],
  },

  {
    atolyeId: "atl_gastronomi",
    atolyeAdi: "Gastronomi Atölyesi",
    haftalar: [
      {
        hafta: 1,
        baslik: "Mutfak hijyeni ve güvenli çalışma",
        aciklama:
          "El yıkama, tezgâh temizliği ve malzemelerin güvenli kullanımı uygulamalı olarak ele alınır; atölye kuralları birlikte belirlenir.",
      },
      {
        hafta: 2,
        baslik: "Ölçü birimleri ve tarif okuma",
        aciklama:
          "Gram, mililitre, su bardağı ve yemek kaşığı karşılıkları terazi ve ölçekle çalışılır; basit bir tarif adım adım okunarak sıraya dizilir.",
      },
      {
        hafta: 3,
        baslik: "Duyularla tanıma — tat, koku ve doku",
        aciklama:
          "Tuzlu, tatlı, ekşi ve acı tatlar gözü kapalı denemelerle ayırt edilir; baharatlar kokularından tanınmaya çalışılır.",
      },
      {
        hafta: 4,
        baslik: "Mevsim sebzeleri ve tarladan sofraya",
        aciklama:
          "Sebze ve meyvelerin hangi mevsimde yetiştiği takvim üzerinde işaretlenir; mevsiminde toplanan ürünlerle bir salata hazırlanır.",
      },
      {
        hafta: 5,
        baslik: "Hamur işi — maya ve kabarma",
        aciklama:
          "Mayalı ve mayasız hamur birlikte yoğrulur; bekleme sürecinde ikisinin hacmi karşılaştırılarak mayanın etkisi gözlemlenir.",
      },
      {
        hafta: 6,
        baslik: "Isının besinlere etkisi",
        aciklama:
          "Aynı malzemenin çiğ, haşlanmış ve fırınlanmış hâlleri karşılaştırılır; renk, doku ve tat değişimi tabloya kaydedilir.",
      },
      {
        hafta: 7,
        baslik: "Dengeli tabak ve besin grupları",
        aciklama:
          "Besin grupları tanıtılır; öğrenciler kendi öğün tabaklarını gruplar arasında denge kuracak biçimde planlar.",
      },
      {
        hafta: 8,
        baslik: "Yöresel mutfaklar",
        aciklama:
          "Farklı yörelerin tanınmış yemekleri harita üzerinde eşleştirilir; seçilen bir yöresel tarif grupça hazırlanır.",
      },
      {
        hafta: 9,
        baslik: "Sunum ve tabak düzeni",
        aciklama:
          "Aynı yemek farklı biçimlerde tabağa yerleştirilerek sunumun algıya etkisi tartışılır; öğrenciler kendi sunumlarını hazırlar.",
      },
      {
        hafta: 10,
        baslik: "Atölye menüsü — birlikte planlama ve üretim",
        aciklama:
          "Dönem boyunca öğrenilenlerden bir menü seçilir; görev dağılımı yapılarak menü grupça hazırlanır ve birlikte paylaşılır.",
      },
    ],
  },

  {
    atolyeId: "atl_masal",
    atolyeAdi: "Masal ve Hikâye Atölyesi",
    haftalar: [
      {
        hafta: 1,
        baslik: "Hikâyenin yapı taşları — kahraman, mekân, olay",
        aciklama:
          "Dinlenen kısa bir masal üzerinden kahraman, mekân ve olay örgüsü birlikte çözümlenir.",
      },
      {
        hafta: 2,
        baslik: "Masal kahramanı yaratma",
        aciklama:
          "Her öğrenci kendi kahramanını özellikleriyle tanımlar ve çizerek tanıtır; kahramanın istediği şey ile önündeki engel belirlenir.",
      },
      {
        hafta: 3,
        baslik: "Başlangıç, gelişme ve sonuç",
        aciklama:
          "Karışık sırayla verilen hikâye kartları doğru sıraya dizilir; ardından üç bölümlü kısa bir hikâye yazılır.",
      },
      {
        hafta: 4,
        baslik: "Sesli anlatım ve dinleyiciyle bağ kurma",
        aciklama:
          "Aynı cümle farklı vurgu ve tonlamalarla söylenerek etkisi karşılaştırılır; öğrenciler kendi hikâyelerinin bir bölümünü sesli okur.",
      },
      {
        hafta: 5,
        baslik: "Diyalog yazma",
        aciklama:
          "İki kahraman arasında geçen kısa konuşmalar yazılır; konuşma çizgisi ve karakterlere göre dil farkı üzerinde durulur.",
      },
      {
        hafta: 6,
        baslik: "Betimleme — beş duyuyla anlatma",
        aciklama:
          "Seçilen bir mekân görme, duyma, koklama, dokunma ve tatma yoluyla betimlenir; sıfat kullanımı örneklerle çalışılır.",
      },
      {
        hafta: 7,
        baslik: "Masalları yeniden yazma",
        aciklama:
          "Bilinen bir masalın sonu veya kahramanın bakış açısı değiştirilerek yeniden yazılır; değişikliğin olay örgüsüne etkisi tartışılır.",
      },
      {
        hafta: 8,
        baslik: "Resimli hikâye kitabı yapımı",
        aciklama:
          "Metin ve görsel birlikte planlanır; sayfa düzeni kurularak elle bir resimli hikâye kitabı üretilir.",
      },
      {
        hafta: 9,
        baslik: "Grup hikâyesi — zincirleme anlatı",
        aciklama:
          "Bir hikâye sırayla her öğrencinin eklediği bölümlerle büyütülür; anlatının tutarlı kalması için birbirinin bölümü dinlenir.",
      },
      {
        hafta: 10,
        baslik: "Hikâye dinletisi",
        aciklama:
          "Dönem boyunca yazılan hikâyeler seçilerek gruba okunur; dinleyiciler beğendikleri bölümü gerekçesiyle paylaşır.",
      },
    ],
  },

  {
    atolyeId: "atl_ahsap",
    atolyeAdi: "Ahşap Modelleme Atölyesi",
    haftalar: [
      {
        hafta: 1,
        baslik: "Ahşabı tanıma ve güvenli çalışma",
        aciklama:
          "Farklı ahşap türleri damar yapısı ve sertliğiyle incelenir; zımpara, mengene ve el testeresinin güvenli kullanımı gösterilir.",
      },
      {
        hafta: 2,
        baslik: "Ölçme, işaretleme ve düz kesim",
        aciklama:
          "Gönye ve metreyle ölçü alınıp işaretleme yapılır; işaretlenen çizgiden düz kesim uygulamalı olarak çalışılır.",
      },
      {
        hafta: 3,
        baslik: "Zımparalama ve yüzey hazırlığı",
        aciklama:
          "Kaba ve ince zımpara sırayla kullanılarak yüzey düzeltilir; işlem öncesi ve sonrası yüzeyler dokunarak karşılaştırılır.",
      },
      {
        hafta: 4,
        baslik: "Birleştirme teknikleri — tutkal ve çivi",
        aciklama:
          "İki parça hem tutkalla hem çiviyle birleştirilir; bağlantıların dayanıklılığı yük uygulanarak karşılaştırılır.",
      },
      {
        hafta: 5,
        baslik: "Kalemlik yapımı — ilk tam ürün",
        aciklama:
          "Ölçme, kesme, zımparalama ve birleştirme adımları tek bir üründe sırayla uygulanarak kalemlik tamamlanır.",
      },
      {
        hafta: 6,
        baslik: "Teknik çizimden modele",
        aciklama:
          "Basit bir nesnenin önden ve yandan görünüşü çizilir; çizim ölçülerine göre parçalar hazırlanır.",
      },
      {
        hafta: 7,
        baslik: "Ahşap oyuncak — hareketli parça",
        aciklama:
          "Döner veya sallanır bir parça içeren küçük bir oyuncak yapılır; eksen ve boşluk payı kavramları uygulamada ele alınır.",
      },
      {
        hafta: 8,
        baslik: "Mozaik ve ahşap süsleme",
        aciklama:
          "Küçük ahşap parçalar desen oluşturacak biçimde yerleştirilip yapıştırılır; renk ve yön tekrarıyla örüntü kurulur.",
      },
      {
        hafta: 9,
        baslik: "Yüzey koruma ve bitirme",
        aciklama:
          "Ahşabın neden korunduğu ele alınır; su bazlı vernik veya doğal yağ uygulanarak ürünler bitirilir.",
      },
      {
        hafta: 10,
        baslik: "Ürün sergisi ve değerlendirme",
        aciklama:
          "Dönem boyunca yapılan ahşap ürünler sergilenir; her öğrenci kendi ürününde en çok zorlandığı adımı anlatır.",
      },
    ],
  },
];

/** İçeriği üretilecek atölyeler — müfredatı zaten olan ikisi de dâhil. */
export const ICERIK_URETILECEK_ATOLYELER: { id: string; ad: string }[] = [
  { id: "atl_stem", ad: "STEM Maker Atölyesi" },
  { id: "atl_gastronomi", ad: "Gastronomi Atölyesi" },
  { id: "atl_masal", ad: "Masal ve Hikâye Atölyesi" },
  { id: "atl_ahsap", ad: "Ahşap Modelleme Atölyesi" },
  { id: "atl_dusunme", ad: "Düşünme Becerileri Atölyesi" },
  {
    id: "cms3x92pd001mkgguxigalyr6",
    ad: "Sosyal Duygusal Beceriler Atölyesi (Drama)",
  },
];
