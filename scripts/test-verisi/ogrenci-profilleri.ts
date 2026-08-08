/**
 * Ümraniye 2026 Sonbahar öğrencilerinin deneme profilleri — rapor çıktısını
 * uçtan uca sınamak için.
 *
 * NEDEN ELLE YAZILDI: puanlar, gelişim değerlendirmesi ve gözlem notları
 * BİRBİRİYLE TUTARLI olmak zorunda. Robotikte "Düşük" başarı kademesi çıkan
 * bir öğrencinin gözlem notunda robotiği parlatan bir cümle olursa rapor
 * kendi içinde çelişir ve uydurma denetimi anlamsızlaşır. Üçü de tek yerden,
 * aynı karakter tarifinden türesin diye bu dosyada duruyorlar.
 *
 * PROFİLLER ÇEŞİTLİ: kademe motoru ancak öğrenciler birbirinden ayrıştığında
 * sınanabilir. Atölye kademesi mutlak eşikle çalışıyor (>=4,0 Yüksek; <3,0
 * Düşük), gelişim kademesi ise grup ortalamasına kıyaslı (±0,25). Hedef
 * ortalamalar bu iki eşiği de üç banda yayacak biçimde seçildi; ayrıca
 * bazı öğrencilerde ilgi ile başarı kasten bir tam kademe ayrıldı ki
 * `asimetriBul` bulgusu da çıktıda görünsün.
 *
 * Gözlem notları SOMUT DAVRANIŞ anlatır, sıfat değil: yapay zekâ rapora
 * yalnızca burada yazanı taşıyabiliyor (§11.2), "başarılıydı" gibi bir not
 * boş bir paragraf üretir.
 */

/** Atölye kısa anahtarları — puan hedeflerinde ve not eşleşmesinde kullanılır. */
export const ATOLYE_ANAHTARLARI = {
  bilim: "Bilim Atölyesi",
  robotik: "Robotik ve Kodlama Atölyesi",
  astronomi: "Astronomi Atölyesi",
  zeka: "Zekâ ve Akıl Oyunları Atölyesi",
  hayal: "Hayal Tasarım Atölyesi",
} as const;

export type AtolyeAnahtari = keyof typeof ATOLYE_ANAHTARLARI;

/** [ilgi hedefi, yetenek hedefi] — 1–5 ölçeğinde ortalama. */
export type AtolyeHedefi = readonly [number, number];

export type OturumNotu = {
  atolye: AtolyeAnahtari;
  hafta: number;
  not: string;
};

export type OgrenciProfili = {
  /** Öğrencinin adı — kayıt eşleşmesi ad ve soyadla yapılır. */
  ad: string;
  soyad: string;
  atolyeler: Record<AtolyeAnahtari, AtolyeHedefi>;
  /** Gelişim alanı hedefleri: [duygusal, sosyal, bilişsel]. */
  gelisim: readonly [number, number, number];
  /** Kayıt geneli gözlem notu (Enrollment.gozlemNotu). */
  kayitNotu: string;
  /** Oturum bazlı gözlem notları (Score.gozlemNotu). */
  oturumNotlari: OturumNotu[];
};

export const PROFILLER: OgrenciProfili[] = [
  {
    ad: "Ada",
    soyad: "Türkmen",
    atolyeler: {
      bilim: [4.2, 3.8],
      robotik: [3.6, 2.7],
      astronomi: [4.4, 4.1],
      zeka: [3.4, 3.3],
      hayal: [4.6, 4.4],
    },
    gelisim: [4.3, 4.4, 3.9],
    kayitNotu:
      "Ada atölye gününe genellikle sınıfa ilk girenlerden biri olarak geliyor ve masasını kendisi hazırlıyor. Anlatım sırasında not tutuyor, anlamadığı bir yeri o an sormak yerine defterine yazıp anlatım bitince soruyor. Grup çalışmalarında malzeme dağıtımını üstleniyor; arkadaşları itiraz ettiğinde tartışmaya girmeden görevi bırakıp başka bir işe geçiyor. Elle yapılan tasarım işlerinde (maket, çizim, kolaj) ürünü bitirmeden bırakmıyor. Buna karşılık kablolu devre ve kod bloğu gerektiren çalışmalarda ilk denemesi tutmayınca yardım istemeden bekliyor; üç hafta boyunca robotik oturumlarında görevini tamamlamak için stajyerin yanına gelmesini bekledi. Yazılı yönergeyi tek okumada uygulayabiliyor, sözlü çoklu yönergede ikinci adımı atlıyor.",
    oturumNotlari: [
      {
        atolye: "hayal",
        hafta: 1,
        not: "Geri dönüşüm malzemesiyle 'gelecekteki ev' maketini yaparken çatının çökmesi üzerine kendi kendine karton üçgen destekler kesip yapıştırdı. Bittiğinde arkadaşlarına neden üçgen kullandığını anlattı: 'kare olsaydı yine yamulurdu' dedi.",
      },
      {
        atolye: "robotik",
        hafta: 2,
        not: "Motor kablolarını karta bağlarken artı ve eksi uçları iki kez ters taktı, motor dönmeyince durdu ve elini kaldırmadan yaklaşık beş dakika bekledi. Stajyer yanına gelip uçları gösterince doğru bağladı ama aynı hatayı sonraki görevde tekrarladı.",
      },
      {
        atolye: "astronomi",
        hafta: 2,
        not: "Ay'ın evreleri anlatılırken 'yeni ay olduğunda Ay yok mu oluyor?' diye sordu. Lambayla top modelinde karanlık yüzü kendisi bulup arkadaşına gösterdi.",
      },
      {
        atolye: "zeka",
        hafta: 3,
        not: "Tangram görevinde ilk iki şekli tamamladı, üçüncüde parçaları döndürmeyi denemeyip aynı yerleşimi üst üste dört kez tekrar etti. Süre dolunca 'ben bunu yapamıyorum' dedi ve kâğıdı kapattı.",
      },
      {
        atolye: "bilim",
        hafta: 3,
        not: "Yoğunluk deneyinde sıvıların sırasını tahmin etmeden önce her birinin şişesine bakıp not aldı. Bal ve yağın yerini doğru tahmin etti, tahmini tutmayan alkol için 'bunu yanlış yazmışım' diyip defterine düzeltme yazdı.",
      },
    ],
  },

  {
    ad: "Deniz",
    soyad: "Aydın",
    atolyeler: {
      bilim: [4.5, 4.3],
      robotik: [4.4, 4.2],
      astronomi: [4.1, 4.0],
      zeka: [4.3, 4.4],
      hayal: [3.8, 3.9],
    },
    gelisim: [4.4, 4.1, 4.5],
    kayitNotu:
      "Deniz yönergeyi dinledikten sonra işe başlamadan önce ne yapacağını sırayla söylüyor; bu alışkanlığı özellikle çok adımlı görevlerde işini hızlandırıyor. Bir deney tutmadığında sonucu silmiyor, 'neden olmadı' sorusunu kendi kendine sorup ikinci denemede değişkeni değiştiriyor. Grup içinde konuşma sırasını bekliyor ama fikri reddedildiğinde ısrarla aynı öneriyi tekrar ediyor; iki oturumda arkadaşıyla bu yüzden tartışma yaşandı. Serbest tasarım gibi doğru cevabı olmayan görevlerde ne yapacağına karar vermekte zorlanıyor, örnek gösterilene kadar başlamıyor. Malzemesini toplamayı hatırlatmaya gerek kalmadan yapıyor.",
    oturumNotlari: [
      {
        atolye: "bilim",
        hafta: 1,
        not: "Bitki büyütme deneyinde iki saksıya aynı anda su verilmesi gerektiğini fark edip 'ikisine de aynı gün bakmazsak hangisi yüzünden olduğunu bilemeyiz' dedi. Sulama takvimini kendisi çizdi.",
      },
      {
        atolye: "zeka",
        hafta: 2,
        not: "Mangala turnuvasında ilk üç hamlesini sessizce sayarak yaptı, rakibinin kuyu doldurma hamlesini tahmin edip taşlarını öne çekti. Turu kazanınca stratejisini arkadaşına adım adım anlattı.",
      },
      {
        atolye: "robotik",
        hafta: 2,
        not: "Çizgi izleyen robotun sensörü dönemeçte kaybedince kodda dönüş açısını 90'dan 45'e düşürmeyi kendisi önerdi ve denedi. İkinci denemede robot pisti tamamladı.",
      },
      {
        atolye: "hayal",
        hafta: 3,
        not: "Serbest tasarım görevinde on beş dakika kâğıda hiçbir şey çizmedi, 'ne yapacağımı bilmiyorum' dedi. Stajyer örnek gösterdikten sonra köprü çizip yapmaya başladı, kalan sürede bitirdi.",
      },
      {
        atolye: "astronomi",
        hafta: 3,
        not: "Gezegenlerin sırasını ezberden saydı. Ölçekli model yapılırken Jüpiter için ayrılan kâğıdın küçük geldiğini hesaplayıp 'bu oran yanlış, Dünya'nın on katı olmalı' dedi.",
      },
    ],
  },

  {
    ad: "Elif Naz",
    soyad: "Doğan",
    atolyeler: {
      bilim: [4.4, 3.4],
      robotik: [4.2, 3.2],
      astronomi: [4.5, 3.5],
      zeka: [3.9, 3.3],
      hayal: [4.3, 3.6],
    },
    gelisim: [3.6, 3.8, 3.4],
    kayitNotu:
      "Elif Naz her atölyeye istekli geliyor, anlatım kısmında en çok soru soran öğrencilerden biri. Konuyla ilgili evde izlediklerini veya okuduklarını sınıfa taşıyor. Uygulamaya geçildiğinde ise aynı hızı sürdüremiyor: adımları atlayarak ilerliyor, sonucu görmek için ölçüm ve kayıt kısımlarını es geçiyor ve ürün çoğu zaman yarım kalıyor. Yönerge kâğıdına dönmesi hatırlatıldığında dönüyor ama birkaç dakika sonra yine kendi sırasına geçiyor. Arkadaşlarıyla ilişkisi rahat, grup içinde sık sık anlatıcı rolünü üstleniyor. Sabır gerektiren ölçme ve tekrar aşamalarında desteklenmesi gerekiyor.",
    oturumNotlari: [
      {
        atolye: "astronomi",
        hafta: 1,
        not: "Kara delik anlatımında üst üste dört soru sordu ve evde izlediği belgeselden 'ışık bile kaçamıyormuş' bilgisini aktardı. Sonrasında yapılan ölçekli uzaklık çalışmasında adımları saymadan ipi rastgele işaretledi, ölçüm tablosunu boş bıraktı.",
      },
      {
        atolye: "bilim",
        hafta: 2,
        not: "Asit-baz deneyinde renk değişimini görür görmez 'oldu!' deyip sonraki tüpe geçti; ilk tüpün rengini kayıt kâğıdına yazmadı. Hatırlatılınca geri dönüp yazdı ama üçüncü tüpte aynısını tekrarladı.",
      },
      {
        atolye: "robotik",
        hafta: 2,
        not: "Robotun ne yapacağını arkadaşlarına heyecanla anlattı. Kod bloklarını sıraya dizerken bekleme bloğunu atlayınca robot komutları üst üste bindirdi; hatayı bulmak yerine baştan yeni bir sıra kurmayı denedi, iki denemede de aynı blok eksik kaldı.",
      },
      {
        atolye: "hayal",
        hafta: 3,
        not: "Afiş tasarımında konuyu hemen buldu ve taslağı hızlı çizdi. Boyama aşamasında sıkıldı, 'burası zaten anlaşılıyor' deyip alt yarısını boş bıraktı. Süre bitiminde ürün yarım teslim edildi.",
      },
    ],
  },

  {
    ad: "Kerem",
    soyad: "Aksoy",
    atolyeler: {
      bilim: [3.9, 4.2],
      robotik: [4.6, 4.7],
      astronomi: [3.7, 4.0],
      zeka: [4.4, 4.5],
      hayal: [2.9, 3.2],
    },
    gelisim: [3.2, 2.9, 4.4],
    kayitNotu:
      "Kerem teknik içerikli görevlerde grubun en hızlı ilerleyen öğrencilerinden biri; bir mekanizmanın nasıl çalıştığını sökerek anlamayı tercih ediyor ve genellikle doğru sonuca ulaşıyor. Eşli çalışmalarda ise sorun yaşıyor: görevi paylaşmak yerine tamamını kendisi yapıyor, arkadaşı müdahale ettiğinde malzemeyi geri alıyor. İki oturumda eşi çalışmayı bırakıp başka gruba geçti. Sırası gelmeden konuşuyor, kendi çözümü doğruyken arkadaşınınkinin 'yanlış' olduğunu yüksek sesle söylüyor. Resim, kolaj gibi açık uçlu tasarım çalışmalarına ilgi göstermiyor, bu oturumlarda görevi en kısa sürede bitirip başkasının işini izliyor. Duygularını sözle ifade etmek yerine masadan uzaklaşarak tepki veriyor.",
    oturumNotlari: [
      {
        atolye: "robotik",
        hafta: 1,
        not: "Verilen kod şablonunu tamamladıktan sonra kendi başına döngü bloğu ekleyip robotu kare çizdirdi. Nasıl yaptığını soran arkadaşına 'karışık, anlatamam' deyip devam etti.",
      },
      {
        atolye: "zeka",
        hafta: 2,
        not: "Sudoku benzeri mantık bulmacasını grupta ilk bitiren oldu. Eşi hâlâ uğraşırken kâğıdı elinden alıp iki kareyi kendisi doldurdu; eşi 'ben yapacaktım' deyince kâğıdı masaya bırakıp arkasını döndü.",
      },
      {
        atolye: "hayal",
        hafta: 2,
        not: "Kolaj çalışmasında iki dakikada üç parça yapıştırıp 'bitti' dedi. Süreyi doldurması istendiğinde ek bir şey yapmadı, kalan on beş dakika yan masayı izledi.",
      },
      {
        atolye: "bilim",
        hafta: 3,
        not: "Basit makineler deneyinde makaranın yükü hafiflettiğini fark edip ip sayısını artırınca ne olacağını sordu, sonra kendisi ikinci makarayı kurup denedi. Ölçüm sonucunu tabloya doğru yazdı.",
      },
    ],
  },

  {
    ad: "Masal",
    soyad: "Güneş",
    atolyeler: {
      bilim: [3.1, 2.6],
      robotik: [2.8, 2.4],
      astronomi: [3.3, 2.8],
      zeka: [2.9, 2.7],
      hayal: [3.6, 3.1],
    },
    gelisim: [3.1, 3.3, 2.7],
    kayitNotu:
      "Masal atölyeye geliyor ve oturuyor ama çalışmaya başlaması genellikle yönergenin bireysel olarak tekrar edilmesine bağlı. Sınıfa verilen ortak yönergeden sonra malzemeye dokunmadan bekliyor; stajyer yanına gelip ilk adımı birlikte yaptığında devam edebiliyor. Çok adımlı görevlerde ikinci adımdan sonra durup ne yapacağını soruyor. Yazma ve kayıt gerektiren bölümlerde harf ve sayıları yavaş yazdığı için tabloları yetiştiremiyor. Elle yapılan, sonucu görünür işlerde (boyama, yapıştırma, maket) daha uzun süre masada kalıyor ve ürünü tamamlıyor. Arkadaşlarıyla iyi geçiniyor, kendisine yöneltilen soruya kısa cevaplar veriyor. Süre baskısı olduğunda malzemeyi bırakıp geri çekiliyor.",
    oturumNotlari: [
      {
        atolye: "hayal",
        hafta: 1,
        not: "Kendi seçtiği renklerle deniz altı panosunu yaptı, süre bitene kadar masada kaldı ve balıkların pullarını tek tek yapıştırdı. Panoyu asarken 'benimki en renklisi' dedi.",
      },
      {
        atolye: "robotik",
        hafta: 2,
        not: "Sınıfa yönerge verildikten sonra parçalara dokunmadan yaklaşık yedi dakika bekledi. Stajyer ilk iki bloğu birlikte taktıktan sonra üçüncüyü kendisi ekledi, dördüncüde tekrar durdu ve 'sıradaki hangisi' diye sordu.",
      },
      {
        atolye: "bilim",
        hafta: 2,
        not: "Deney tablosunu doldururken ilk iki satırı yazdı, üçüncü ölçümde grup ilerlediği için yetişemedi ve kalan satırları boş bıraktı. Sonucu sözlü olarak sorulduğunda suyun ısındığını doğru söyledi.",
      },
      {
        atolye: "zeka",
        hafta: 3,
        not: "Eşleştirme oyununda ilk turda dört kart açıp hiçbirini hatırlayamadı. İkinci turda stajyer kartların yerini söyleyince iki eşi buldu. Üçüncü tura girmek istemedi, 'ben bakayım' deyip izledi.",
      },
    ],
  },

  {
    ad: "Mert",
    soyad: "Yalçın",
    atolyeler: {
      bilim: [3.5, 3.2],
      robotik: [4.1, 3.6],
      astronomi: [3.2, 3.0],
      zeka: [3.8, 3.5],
      hayal: [3.4, 3.3],
    },
    gelisim: [3.4, 3.1, 3.6],
    kayitNotu:
      "Mert dönem boyunca dört atölye oturumuna katılmadı (birinci hafta robotik, ikinci hafta bilim ve zekâ oyunları, üçüncü hafta astronomi) ve kaçırdığı konulara sonradan dönmedi; bu yüzden bazı çalışmalarda arkadaşlarının bir adım gerisinden başlıyor. Katıldığı oturumlarda ilk yarım saat verimli çalışıyor, sonrasında dikkati dağılıyor ve masasındaki malzemeyle oynamaya başlıyor. Kendi ilgi alanına giren konularda (motor, araç, mekanizma) süreyi tamamen kullanıyor. Grup çalışmalarında lider rolünü almıyor ama verilen parçayı zamanında getiriyor. Yaşça büyük olduğu için küçük arkadaşlarına malzeme taşımada yardım ediyor. Yönergeyi bir kez dinlediğinde anlıyor, tekrar istemiyor.",
    oturumNotlari: [
      {
        atolye: "robotik",
        hafta: 2,
        not: "Araç şasisini kurarken vidaların sıralamasını kendisi buldu ve tekerlek aksını iki kez söküp doğru hizaladı. Süre bitiminde aracı çalışır hâlde teslim etti.",
      },
      {
        atolye: "zeka",
        hafta: 3,
        not: "Strateji oyununun ilk yarısında rakibinin hamlelerini takip etti, ikinci yarıda masadaki kalemle oynamaya başlayıp iki hamlesini rakibi hatırlattıktan sonra yaptı. Oyunu berabere bitirdi.",
      },
      {
        atolye: "hayal",
        hafta: 3,
        not: "Grup panosunda kendisine düşen aracı çizdi ve zamanında getirdi. Panonun geri kalanına katkı vermedi, arkadaşları yerleştirirken izledi.",
      },
      {
        atolye: "bilim",
        hafta: 3,
        not: "Bir önceki hafta gelmediği için sürtünme konusunu bilmiyordu. Deneye arkadaşının anlatımıyla başladı; eğik düzlemde açıyı artırınca cismin hızlandığını gözlemleyip tabloya yazdı, nedenini açıklamakta zorlandı.",
      },
    ],
  },

  {
    ad: "Nehir",
    soyad: "Balcı",
    atolyeler: {
      bilim: [4.0, 3.4],
      robotik: [3.5, 3.0],
      astronomi: [4.2, 3.8],
      zeka: [3.6, 3.2],
      hayal: [4.5, 4.2],
    },
    gelisim: [4.5, 4.6, 3.5],
    kayitNotu:
      "Nehir gruba dönem içinde katıldı ve yalnızca bir atölye gününde bulundu; bu nedenle hakkındaki gözlemler tek oturumla sınırlı, kalıcı bir eğilim olarak okunmamalı. O gün sınıfa girdiğinde tanımadığı arkadaşlarının yanına kendisi oturdu ve adını sordu. Malzeme paylaşımında kendi payını arkadaşına verdi. Anlatım sırasında dinlediğini başıyla onaylıyor, soru sorulduğunda cevap vermeye istekli. Yazılı çalışmada elinin yavaş olduğu, tabloyu tamamlayamadığı görüldü.",
    oturumNotlari: [
      {
        atolye: "hayal",
        hafta: 1,
        not: "Boya kalemleri yetmeyince kendi setini masanın ortasına koyup 'hep beraber kullanalım' dedi. Kendi çizimini en son bitirdi ama tamamladı.",
      },
      {
        atolye: "astronomi",
        hafta: 1,
        not: "Yıldız haritasını incelerken 'benim burcum hangisi?' diye sordu, ardından takımyıldızların şekillerini arkadaşına parmağıyla gösterip anlattı.",
      },
      {
        atolye: "bilim",
        hafta: 1,
        not: "Mıknatıs deneyinde hangi cisimlerin çekileceğini tek tek tahmin etti, altı tahminin dördü tuttu. Tutmayanları 'bu neden olmadı' diye sordu.",
      },
      {
        atolye: "robotik",
        hafta: 1,
        not: "Blok kodlamada arayüzü ilk kez gördüğünü söyledi. Arkadaşının ekranını izleyerek ilk iki bloğu taktı, üçüncüde blokları sürükleyemedi ve yardım istedi.",
      },
    ],
  },

  {
    ad: "Poyraz",
    soyad: "Ünal",
    atolyeler: {
      bilim: [4.3, 3.4],
      robotik: [4.5, 3.6],
      astronomi: [3.8, 3.0],
      zeka: [4.0, 3.2],
      hayal: [4.1, 3.5],
    },
    gelisim: [2.9, 3.4, 3.0],
    kayitNotu:
      "Poyraz her yeni malzemeye ilk uzanan öğrenci; kutu açıldığında yerinden kalkıyor ve içindekileri sırasını beklemeden alıyor. Konuya ilgisi yüksek, anlatım bitmeden soru soruyor. Uygulamada ise bir görevi sonuna kadar götürmesi zor: ortalama on dakika sonra masadan kalkıyor, başka grubun işine bakıyor ve kendi ürününe döndüğünde kaldığı yeri hatırlamıyor. Beklemesi gereken durumlarda (sıra, kuruma süresi, ölçüm süresi) sesli itiraz ediyor. Uyarıldığında oturuyor ama birkaç dakika sonra tekrar kalkıyor. Kendi hatasıyla ürün bozulduğunda öfkeleniyor ve malzemeyi masaya bırakıyor; sakinleşmesi için kısa bir araya ihtiyaç duyuyor. Arkadaşlarına karşı kırıcı değil, dışlanma yaşamıyor.",
    oturumNotlari: [
      {
        atolye: "robotik",
        hafta: 1,
        not: "Kutu açılır açılmaz motorları alıp masasına götürdü, dağıtım beklenmesi söylenince geri getirdi. Kodlama kısmında ilk sekiz dakika ekrana odaklandı, sonra ayağa kalkıp iki kez yan masaya gitti; kendi ekranına döndüğünde 'ben nerede kalmıştım' diye sordu.",
      },
      {
        atolye: "bilim",
        hafta: 2,
        not: "Volkan deneyinde tepkimenin başlamasını beklerken 'daha olmadı mı' diye üst üste sordu ve karışıma erken kaşık soktu; köpük masaya taştı. Temizlemeye kendisi yardım etti.",
      },
      {
        atolye: "astronomi",
        hafta: 2,
        not: "Roket maketinde kanatları yapıştırdıktan sonra tutkalın kuruması gerektiği söylenince beklemeyip maketi kaldırdı, kanat düştü. Masaya vurup 'olmuyor bu' dedi, iki dakika dışarıda bekledikten sonra dönüp yeniden yapıştırdı.",
      },
      {
        atolye: "zeka",
        hafta: 3,
        not: "Labirent bulmacasında ilk çıkışı hızla buldu. İkinci bulmacada kalem sırası kendisine gelmeyince sıradan çıkıp başka masaya geçti, oyunu tamamlamadı.",
      },
    ],
  },

  {
    ad: "Yiğit",
    soyad: "Erdem",
    atolyeler: {
      bilim: [3.8, 4.1],
      robotik: [4.0, 4.4],
      astronomi: [4.2, 4.3],
      zeka: [4.5, 4.6],
      hayal: [3.2, 3.4],
    },
    gelisim: [3.7, 3.5, 4.6],
    kayitNotu:
      "Yiğit iki hafta katıldı, üçüncü haftadan itibaren gelmedi; gözlemler bu iki oturuma dayanıyor. Bulmaca ve mantık görevlerinde kural açıklandıktan sonra ek soru sormadan başlıyor ve genellikle ilk denemede doğru çözüme ulaşıyor. Çözüme nasıl vardığını anlatması istendiğinde adımları sırayla söyleyebiliyor. Açık uçlu, estetik tercih gerektiren görevlerde ise 'doğrusu ne' diye soruyor ve tek bir doğru olmadığı söylendiğinde işe başlaması gecikiyor. Sınıf içinde az konuşuyor, kendisine sorulmadan söz almıyor. Grup çalışmasında verilen görevi sessizce yapıyor, iş bölümü tartışmasına katılmıyor.",
    oturumNotlari: [
      {
        atolye: "zeka",
        hafta: 1,
        not: "Kule taşıma bulmacasını (üç çubuk, beş disk) yardım almadan bitirdi. Nasıl yaptığı sorulunca 'önce küçükleri yan çubuğa aldım, en büyüğü boş kalana koydum' diye adım adım anlattı.",
      },
      {
        atolye: "robotik",
        hafta: 1,
        not: "Robotun engele çarpması üzerine mesafe sensörünün eşik değerini 10'dan 25'e çıkardı ve tek denemede sorunu çözdü. Değişikliği neden yaptığını yazılı olarak da not etti.",
      },
      {
        atolye: "astronomi",
        hafta: 2,
        not: "Işık yılı hesabında verilen sayıyı kâğıtta çarpıp sonucu buldu, ardından 'yani gördüğümüz yıldız şimdi orada olmayabilir' diye kendi çıkarımını söyledi.",
      },
      {
        atolye: "hayal",
        hafta: 2,
        not: "Serbest afiş görevinde 'nasıl olması gerekiyor' diye üç kez sordu. Örnek olmadığı söylenince on dakika kâğıda bakıp bekledi, sonra düz bir çerçeve çizip içine başlık yazdı ve teslim etti.",
      },
    ],
  },

  {
    ad: "Zeynep",
    soyad: "Korkmaz",
    atolyeler: {
      bilim: [3.7, 3.6],
      robotik: [3.4, 3.5],
      astronomi: [3.8, 3.7],
      zeka: [3.5, 3.6],
      hayal: [3.9, 3.8],
    },
    gelisim: [3.8, 3.9, 3.7],
    kayitNotu:
      "Zeynep atölyelerin tamamına katıldı ve her oturumda görevini tamamladı. Çalışma temposu istikrarlı: ne erken bitirip boş kalıyor ne de süre yetişmiyor. Yönergeyi dinledikten sonra bir kez tekrar ediyor, emin olmadığında soruyor. Grup çalışmalarında arkadaşları arasında görev dağılımı yapıldığında kalan işi üstleniyor, itiraz etmiyor. Hata yaptığında düzeltiyor ama düzeltmeyi genellikle kendi başına değil, sonuç yanlış göründükten sonra yapıyor. Kendi ürünü hakkında konuşması istendiğinde kısa cevap veriyor, gönüllü olarak sunuma çıkmıyor. Belirgin bir güçlük alanı gözlenmedi.",
    oturumNotlari: [
      {
        atolye: "bilim",
        hafta: 1,
        not: "Süzme deneyinde filtreyi yönergedeki sırayla kurdu, ölçüm tablosunun tamamını doldurdu. Suyun bulanık kalması üzerine 'kum katmanı ince kaldı galiba' dedi ve ikinci denemede kalınlaştırdı.",
      },
      {
        atolye: "hayal",
        hafta: 2,
        not: "Grup panosunda kimse üstlenmeyince arka fon boyamayı aldı ve süre içinde bitirdi. Panoyu tanıtma sırası kendisine geldiğinde 'arkadaşım anlatsın' dedi.",
      },
      {
        atolye: "zeka",
        hafta: 2,
        not: "Örüntü tamamlama görevinde ilk cevabı yanlış verdi; tablo kontrol edilirken hatayı görüp kendisi sildi ve doğru şekli çizdi. Yanlışın nedenini 'renk sırasını atlamışım' diye açıkladı.",
      },
      {
        atolye: "robotik",
        hafta: 3,
        not: "Kod bloklarını yönergeye göre dizdi, robot çalıştı. Ek özellik eklemesi önerildiğinde denemedi, 'böyle iyi' deyip bekledi.",
      },
    ],
  },

  {
    ad: "Ömer",
    soyad: "Şahin",
    atolyeler: {
      bilim: [2.8, 3.0],
      robotik: [3.2, 3.3],
      astronomi: [2.7, 2.9],
      zeka: [3.4, 3.5],
      hayal: [3.0, 3.2],
    },
    gelisim: [2.8, 2.6, 3.3],
    kayitNotu:
      "Ömer atölyelere düzenli geldi ancak sürece katılımı sınırlı kaldı. Sınıfa girdiğinde köşedeki masayı seçiyor ve genellikle yalnız oturuyor; eşli çalışma kurulduğunda eş seçmiyor, stajyerin eşleştirmesini bekliyor. Kendisine doğrudan soru sorulduğunda tek kelimeyle cevap veriyor, gönüllü söz almadı. Görevi yapıyor fakat sonucu paylaşmıyor, ürününü masada bırakıp uzaklaşıyor. Mantık ve bulmaca içeren çalışmalarda diğer oturumlara göre daha uzun süre masada kalıyor ve daha az yönlendirme istiyor. Grup içinde bir çatışma yaşamadı; arkadaşları kendisine seslendiğinde karşılık veriyor ama etkileşimi kendisi başlatmıyor. Ev ve okul iş birliğiyle desteklenmesi öneriliyor.",
    oturumNotlari: [
      {
        atolye: "zeka",
        hafta: 1,
        not: "Kibrit çöpü bulmacasında süre boyunca masada kaldı ve iki bulmacayı çözdü. Çözümü göstermesi istendiğinde kâğıdı stajyere uzattı, sözlü açıklama yapmadı.",
      },
      {
        atolye: "astronomi",
        hafta: 2,
        not: "Grup teleskop maketi kurarken kendisine parça verilene kadar bekledi, verilen parçayı taktı ve durdu. Gezegen sıralaması sorulduğunda cevap vermedi, arkadaşı söyledikten sonra başıyla onayladı.",
      },
      {
        atolye: "bilim",
        hafta: 2,
        not: "Deney sırasında eş çalışması kurulduğunda kendi eşini seçmedi; eşleştirme yapılınca çalıştı. Ölçümü yaptı ama sonucu grup tablosuna yazmadı, kâğıdı masada bıraktı.",
      },
      {
        atolye: "hayal",
        hafta: 3,
        not: "Maketi tamamladı ve masaya koydu. Ürünler sergilenirken kendi maketini öne çıkarmadı, sunum sırası geldiğinde 'geçebilirim' dedi.",
      },
    ],
  },

  {
    ad: "Şule",
    soyad: "Çınar",
    atolyeler: {
      bilim: [3.9, 3.5],
      robotik: [3.6, 3.3],
      astronomi: [4.0, 3.6],
      zeka: [3.7, 3.4],
      hayal: [4.1, 3.8],
    },
    gelisim: [3.9, 4.0, 3.6],
    kayitNotu:
      "Şule kayıt işlemleri geç tamamlandığı için gruba üçüncü haftada katıldı ve yalnızca bir atölye gününde bulundu. Gözlem tek güne dayanıyor, genel bir değerlendirme için yeterli değil. Katıldığı gün sınıfa çekingen girdi, ilk yarım saat az konuştu; ikinci atölyede yanındaki arkadaşıyla konuşmaya başladı. Yönergeleri dinledi ve verilen görevleri tamamladı. Devamsızlığı sürerse dönem sonu değerlendirmesinin sınırlı veriye dayanacağı velisine iletilmelidir.",
    oturumNotlari: [
      {
        atolye: "astronomi",
        hafta: 3,
        not: "Sınıfa girdiğinde arka sıraya oturdu, ilk anlatımda soru sormadı. Gezegen kartlarını sıralama görevinde kartları doğru dizdi ve yanındaki arkadaşına Satürn'ün halkasını gösterip 'bunlar buz mu?' diye sordu.",
      },
      {
        atolye: "bilim",
        hafta: 3,
        not: "Kaldırma kuvveti deneyinde cisimleri suya tek tek bıraktı, batan ve yüzenleri ayırdı. Tahmin kâğıdını doldurdu; iki tahmini tutmadı, nedenini sormadı.",
      },
    ],
  },

  {
    ad: "Alp",
    soyad: "Kurt",
    atolyeler: {
      bilim: [3.5, 3.4],
      robotik: [3.5, 3.4],
      astronomi: [3.5, 3.4],
      zeka: [3.5, 3.4],
      hayal: [3.5, 3.4],
    },
    gelisim: [3.5, 3.4, 3.6],
    kayitNotu:
      "Alp 2. Grup kaydı dönem başında açıldı ancak grubun atölye günlerinde henüz puanlama girilmedi; bu kayıt için oturum gözlemi bulunmuyor. Kayıt görüşmesinde velisi, çocuğun okulda grup çalışmalarına isteyerek katıldığını ve el işlerine ilgi duyduğunu belirtti. Atölye içi gözlem, ilk puanlamalar girildikten sonra yazılacaktır.",
    oturumNotlari: [],
  },

  {
    ad: "Bulut",
    soyad: "Aslan",
    atolyeler: {
      bilim: [3.5, 3.4],
      robotik: [3.5, 3.4],
      astronomi: [3.5, 3.4],
      zeka: [3.5, 3.4],
      hayal: [3.5, 3.4],
    },
    gelisim: [3.4, 3.5, 3.5],
    kayitNotu:
      "Bulut 2. Grup kaydı dönem başında açıldı ancak grubun atölye günlerinde henüz puanlama girilmedi; bu kayıt için oturum gözlemi bulunmuyor. Kayıt görüşmesinde velisi, çocuğun yeni ortamlara alışmasının birkaç hafta sürdüğünü ve sayısal oyunlardan hoşlandığını belirtti. Atölye içi gözlem, ilk puanlamalar girildikten sonra yazılacaktır.",
    oturumNotlari: [],
  },
];
