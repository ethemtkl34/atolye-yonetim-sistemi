# Atölye Yönetim Sistemi — Ürün Gereksinimleri

## 1. Projenin amacı

Bu ürün; çocuklara hafta sonları atölye ve kulüp programları sunan bir kurumun kurum içi operasyonlarını tek bir web dashboard üzerinden yönetmesini sağlar.

Sistemin temel amaçları:

- Dönem ve kulüp programlarını oluşturmak,
- Öğrencileri ve veli bilgilerini kayıt altında tutmak,
- Öğrencileri dönem veya kulüp programlarına kaydetmek,
- Kontenjan dolduğunda yeni gruplar açmak,
- Öğrencileri stajyerlere atamak,
- Her atölyeden sonra öğrenci bazlı puanlama yapmak,
- Öğrencinin geçmiş katılım ve değerlendirmelerini kolayca bulmak,
- Puanlamalardan atölye bazlı ve genel öğrenci raporları üretmek,
- Raporları PDF olarak dışarı aktarmaktır.

Bu doküman ürünün işleyişini tanımlar. Teknik mimari, yazılım altyapısı, veritabanı teknolojisi veya kod organizasyonu bu dokümanın kapsamı dışındadır.

---

## 2. Temel kavramlar

### 2.1 Atölye çeşidi

Kurumun tekrar kullanabildiği ana atölye tanımıdır.

Başlangıç atölye envanteri:

1. Bilim Atölyesi
2. Robotik ve Kodlama Atölyesi
3. Astronomi Atölyesi
4. Zekâ ve Akıl Oyunları Atölyesi
5. Hayal Tasarım Atölyesi
6. Sosyal Duygusal Beceriler Atölyesi (Drama)

Koordinatör yeni atölye çeşidi ekleyebilir, mevcut atölyeyi düzenleyebilir veya pasife alabilir.

### 2.2 Dönem

Kurumun 10 eğitim haftasından oluşan ana programıdır.

Dönem oluşturulurken:

- Dönem adı,
- Eğitim yapılacak 10 tarih,
- Tatil veya boş geçilecek haftalar,
- Kullanılacak 5 atölye çeşidi,
- İlk grup,
- Grup günü ve zaman dilimi,
- Grup kontenjanı

belirlenir.

Dönem her zaman 10 eğitim haftası içerir. Tatil haftaları seçilmediği için takvim süresi 11 veya 12 haftaya uzayabilir.

### 2.3 Grup

Bir döneme veya kulübe kayıtlı öğrenci topluluğudur.

Grup aşağıdaki zaman bilgilerinden biriyle tanımlanır:

- Cumartesi öğleden önce
- Cumartesi öğleden sonra
- Pazar öğleden önce
- Pazar öğleden sonra

Bir dönemin kontenjanı dolduğunda aynı döneme bağlı yeni bir grup açılabilir. Aynı dönemdeki bütün gruplar aynı 5 atölyeyi ve aynı eğitim haftalarını kullanır. Grupların farkı zaman dilimidir.

Dönem başladıktan sonra açılan yeni grup, dönemin mevcut haftasından programa dahil olur. Önceki haftalar telafi edilmez. Sistem öğrencinin gerçekten katılabildiği oturumları esas alır.

### 2.4 Atölye oturumu

Belirli bir eğitim gününde gerçekleştirilen tek bir atölyedir.

Bir dönem grubunda her eğitim gününde 5 farklı atölye oturumu bulunur. Atölyelerin tam saati ve kendi aralarındaki sırası sistemde tutulmaz.

### 2.5 Kulüp

Kulüp, dönemden bağımsız olarak açılan hazır bir yarım günlük programdır.

Kulüp özellikleri:

- Koordinatör tarafından önceden oluşturulur.
- Tek yarım gün sürer.
- 3 farklı atölye içerir.
- Kendine ait grup ve kontenjana sahiptir.
- Kulüp öğrencileri dönem gruplarına dahil edilmez.
- Kontenjan dolduğunda kulüp için yeni grup açılabilir.

### 2.6 Kayıt

Öğrencinin bir dönem veya kulüp programına dahil edilmesidir.

İki kayıt türü bulunur:

- Dönem kaydı
- Kulüp kaydı

Aynı öğrenci:

- Aynı anda bir dönem ve bir kulübe,
- Birden fazla kulübe,
- Farklı yıllardaki dönemlere

kayıt olabilir.

---

## 3. Kullanıcı rolleri ve yetkiler

Rol seti kodda sabittir; yönetici kişilere rol atar. Bir kullanıcı birden çok
rol taşıyabilir (örn. Atölye Psikoloğu + Test Uygulayıcısı) ve etkin yetkisi
rollerinin birleşimidir. Modül bazlı yetki matrisi `src/lib/yetkiler.ts`
dosyasında tanımlıdır; seviyeler YOK < LİSTE < GÖRÜNTÜLE < TAM.

## 3.1 Yetki matrisi

| Modül | Kurum Yöneticisi | Atölye Koordinatörü | Atölye Psikoloğu | Test Uygulayıcısı | Danışma Görevlisi |
|---|---|---|---|---|---|
| Dönemler | TAM | TAM | TAM | — | GÖRÜNTÜLE |
| Kulüpler | TAM | TAM | TAM | — | GÖRÜNTÜLE |
| Gruplar | TAM | TAM | TAM | — | GÖRÜNTÜLE |
| Atölye çeşitleri | TAM | TAM | TAM | — | — |
| Değerlendirme soruları | TAM | TAM | TAM | — | — |
| Öğrenciler (sağlık dahil) | TAM | TAM | TAM | — | TAM |
| Öğrenci kayıtları | TAM | TAM | TAM | — | TAM |
| Stajyerler | TAM | TAM | TAM | — | — |
| Danışmanlık (görüşmeler) | TAM | TAM | TAM | — | — (tamamen gizli) |
| Zeka testleri | TAM | GÖRÜNTÜLE | GÖRÜNTÜLE | TAM | LİSTE |
| Puanlamalar | TAM | TAM | TAM | — | — |
| Raporlar | TAM | TAM | TAM | — | — |
| Arşiv | TAM | TAM | TAM | — | — |
| Kullanıcılar | TAM | — | — | — | — |
| Şube değiştirme | ✓ | — | — | — | — |

- Kurum Yöneticisi şubesizdir; üst şeritten şube seçerek çalışır ve başka
  rolle birleşemez. Diğer bütün roller bir şubeye bağlıdır.
- "LİSTE" yalnızca zeka testlerinde anlamlıdır: danışma görevlisi hangi
  öğrenciye hangi tarihte hangi testin yapıldığını görür, belge içeriğini
  açamaz ve indiremez (indirme rotası da reddeder).
- Test Uygulayıcısı unvanı tek başına yalnızca zeka testi sonuçlarını
  yükleme/silme yetkisi verir; pratikte psikolog rolüyle birlikte kullanılır.

## 3.2 Stajyer

Stajyerin erişimi yalnızca puanlama görevleriyle sınırlıdır ve kendi paneli
(`/stajyer`) üzerinden çalışır; başka rolle birleşemez.

Stajyer şunları yapabilir:

- Kendisine atanmış öğrencileri görme,
- Öğrencinin ilgili kayıt ve atölye görevlerini görme,
- Öğrenci bazlı puanlama ekranına girme,
- Her atölye için ayrı değerlendirme formu doldurma,
- İlgili atölyeyi `Katılmadı` olarak işaretleme,
- Daha önce girdiği puanlamaları düzenleme.

Stajyer şunları göremez veya yapamaz:

- Başka stajyerlere atanmış öğrenciler,
- Anne ve baba telefon numaraları,
- Detaylı sağlık açıklamaları,
- Veli ve terapi görüşmeleri, zeka testi sonuçları,
- Dönem, grup ve kulüp oluşturma,
- Öğrenci kaydı oluşturma,
- Atölye veya soru yönetimi,
- Genel kurum raporları,
- Başka stajyerlerin değerlendirmeleri.

Öğrencinin güvenliği açısından gerekli kritik bir sağlık uyarısı varsa stajyere yalnızca kısa ve uygulanabilir bir uyarı gösterilebilir.

Örnek:

> Fındık alerjisi bulunmaktadır. Gıda içeren etkinlik öncesinde koordinatörle iletişime geçiniz.

---

## 4. Dönem yönetimi

### 4.1 Dönem oluşturma

Koordinatör yeni dönem oluştururken aşağıdaki bilgileri girmelidir:

- Dönem adı
- Açıklama (isteğe bağlı)
- Eğitim yapılacak 10 tarih
- Dönemde uygulanacak 5 atölye çeşidi
- İlk grubun adı
- İlk grubun günü
- İlk grubun zaman dilimi
- İlk grubun kontenjanı

Haftalar takvim üzerinden tek tek seçilebilmelidir. Tatil, resmî tatil veya kurumun ara vermek istediği haftalar seçilmez.

### 4.2 Grup açma

Koordinatör aynı döneme yeni grup ekleyebilir.

Yeni grup için:

- Grup adı
- Gün
- Zaman dilimi
- Kontenjan

belirlenir.

Yeni grup dönem başladıktan sonra da açılabilir. Bu grup dönemin mevcut haftasından devam eder ve geçmiş haftaları telafi etmez.

### 4.3 Dönem durumu

Dönem aşağıdaki durumlardan birinde olabilir:

- Taslak
- Kayıt alıyor
- Devam ediyor
- Tamamlandı
- Arşivlendi

---

## 5. Kulüp yönetimi

### 5.1 Kulüp oluşturma

Koordinatör aşağıdaki bilgilerle hazır kulüp programı oluşturur:

- Kulüp adı
- Kulüp tarihi
- Gün ve zaman dilimi
- Kulüpte yapılacak 3 atölye çeşidi
- Grup adı
- Kontenjan
- Açıklama (isteğe bağlı)

### 5.2 Kulüp grupları

Kulüp kontenjanı dolduğunda aynı kulübe yeni grup eklenebilir.

Her kulüp grubu:

- Aynı 3 atölyeyi kullanır,
- Kendi kontenjanına sahiptir,
- Kendi gün ve zaman dilimiyle tanımlanır.

### 5.3 Kulüp durumu

Kulüp aşağıdaki durumlardan birinde olabilir:

- Taslak
- Kayıt alıyor
- Tamamlandı
- İptal edildi
- Arşivlendi

---

## 6. Öğrenci yönetimi

### 6.1 Öğrenci bilgileri

Öğrenci kayıt ekranında aşağıdaki bilgiler bulunmalıdır:

#### Öğrenci

- Ad
- Soyad
- Doğum tarihi
- Okul
- Sınıf
- Genel notlar

#### Anne

- Ad soyad
- Telefon numarası

#### Baba

- Ad soyad
- Telefon numarası

#### Sağlık ve özel durum

- Alerji bilgisi
- Düzenli kullanılan ilaç
- Özel eğitim veya destek ihtiyacı
- Kurumun bilmesi gereken sağlık durumu
- Acil durumda uygulanması gereken bilgiler
- Stajyere gösterilecek kısa güvenlik uyarısı

En az bir ebeveyne ait telefon numarası zorunlu olmalıdır. Diğer ebeveyn bilgisi isteğe bağlı bırakılabilir.

### 6.2 Öğrenci arama

Koordinatör öğrenciyi aşağıdaki bilgilerle arayabilmelidir:

- Ad
- Soyad
- Tam ad
- Anne telefon numarası
- Baba telefon numarası

Arama sonuçlarında aynı isimli öğrencileri ayırmak için doğum tarihi, okul veya sınıf gibi yardımcı bilgiler gösterilmelidir.

### 6.3 Öğrenci profili

Öğrenci profili aşağıdaki bölümleri içermelidir:

1. Genel bilgiler
2. Anne ve baba bilgileri
3. Sağlık ve özel durum bilgileri
4. Aktif kayıtlar
5. Geçmiş kayıtlar
6. Stajyer atamaları
7. Atölye katılım geçmişi
8. Puanlama geçmişi
9. Atölye bazlı raporlar
10. Genel raporlar
11. PDF rapor geçmişi

### 6.4 Öğrenci geçmişi

Koordinatör öğrencinin ne zaman, hangi program kapsamında ve hangi atölyeye katıldığını görebilmelidir.

Her kayıt satırında en az şu bilgiler yer almalıdır:

- Tarih
- Kayıt türü
- Dönem veya kulüp adı
- Grup adı
- Atölye çeşidi
- Katılım durumu
- Ortalama puan
- Sorumlu stajyer

Geçmiş aşağıdaki filtrelerle daraltılabilmelidir:

- Dönem
- Kulüp
- Kayıt türü
- Atölye çeşidi
- Tarih aralığı
- Katıldı / katılmadı

---

## 7. Öğrenci kayıt akışı

### 7.1 Yeni öğrenci kaydı

1. Koordinatör öğrenci araması yapar.
2. Öğrenci daha önce kayıtlı değilse yeni öğrenci profili oluşturur.
3. Öğrenci ve ebeveyn bilgilerini girer.
4. Sağlık ve özel durum bilgilerini girer.
5. Kayıt türünü seçer.

### 7.2 Dönem kaydı

Koordinatör:

1. Dönemi seçer.
2. Döneme bağlı grubu seçer.
3. Kontenjan durumunu görür.
4. Sorumlu stajyeri seçer.
5. Kaydı tamamlar.

### 7.3 Kulüp kaydı

Koordinatör:

1. Hazır kulüp programını seçer.
2. Kulüp grubunu seçer.
3. Kontenjan durumunu görür.
4. Sorumlu stajyeri seçer.
5. Kaydı tamamlar.

### 7.4 Birden fazla kayıt

Sistem öğrencinin başka bir kayıt sahibi olmasını engellemez. Ancak aynı gün ve zaman diliminde çakışan iki kayıt varsa koordinatöre uyarı gösterir. Koordinatör gerekli görürse işleme devam edebilir.

---

## 8. Stajyer atama yönetimi

- Stajyer ataması kayıt bazında yapılır.
- Aynı öğrenci dönem kaydında bir stajyere, kulüp kaydında başka bir stajyere atanabilir.
- Aynı kayıt içerisinde öğrenci yalnızca bir stajyere atanabilir.
- Dönem boyunca öğrenciye atanmış stajyer sabit kalır.
- Koordinatör stajyer başına atanacak öğrenci sayısını kendisi belirler.
- Sistem stajyerin mevcut öğrenci sayısını gösterir ancak sabit bir üst sınır uygulamaz.

Örnek:

- Ayşe Yılmaz — 8 aktif öğrenci
- Mehmet Kaya — 13 aktif öğrenci

---

## 9. Değerlendirme soru yönetimi

### 9.1 Genel kural

Her atölye çeşidinin kendine ait değerlendirme soru seti bulunur.

Başlangıçta bütün atölyelere aynı örnek soru seti atanabilir. Koordinatör daha sonra her atölyenin sorularını bağımsız şekilde düzenleyebilir.

### 9.2 Koordinatör işlemleri

Koordinatör:

- Soru ekleyebilir,
- Soru metnini düzenleyebilir,
- Soruyu aktif veya pasif yapabilir,
- Soruyu silebilir,
- Soru sırasını değiştirebilir,
- Her atölye için farklı soru seti oluşturabilir.

Kullanılmış bir soru sonradan değiştirilirse geçmiş değerlendirmelerde o gün kullanılan eski soru metni korunmalıdır.

### 9.3 Başlangıç örnek soruları

1. Atölye ve etkinliklere ilgi gösterir.
2. Atölye ve etkinliklere katılım sağlar ve etkileşim kurar.
3. Yeni şeyler öğrenmeye yönelik merak ve keşif isteği gösterir.
4. Atölye veya etkinlik sırasında sorulan sorulara cevap verir.
5. İnce motor becerilerini etkin şekilde kullanır.
6. Özgün tasarımlar oluşturabilir.
7. Zamanı doğru ve etkin kullanır.
8. Oran-orantı, uyum ve ahenk ilişkisine dikkat eder.
9. Çalışmalarını özenle ve estetik duyarlılıkla gerçekleştirir.
10. Etkinliğe sebatla devam eder ve çalışmasını tamamlar.

Bu sorular başlangıç verisidir; sabit ve değiştirilemez kabul edilmemelidir.

---

## 10. Puanlama sistemi

### 10.1 Puanlama akışı

Puanlama öğrenci bazlı ilerler.

Örnek:

1. Stajyer kendisine atanmış öğrencilerden Tuana Yılmaz’ı seçer.
2. İlgili program gününü seçer.
3. O gün yapılan 5 atölyeyi görür.
4. Bilim Atölyesi formunu doldurur.
5. Robotik ve Kodlama Atölyesi formunu doldurur.
6. Diğer atölyeler için aynı işlemi tekrarlar.

Her atölye için ayrı değerlendirme formu bulunur.

### 10.2 Katılım durumu

Her atölye için iki temel durum bulunur:

- Katıldı
- Katılmadı

Öğrenci bir gün içindeki bazı atölyelere katılıp bazılarına katılmamış olabilir. Bu nedenle katılım her atölye için ayrı işaretlenir.

`Katılmadı` seçildiğinde puanlama soruları doldurulmaz ve ilgili oturum puan ortalamalarına dahil edilmez.

### 10.3 Cevap zorunluluğu

Öğrenci `Katıldı` olarak işaretlendiyse formdaki bütün soruların cevaplanması zorunludur.

Her soru için seçenekler:

- Değerlendirilemedi
- 1
- 2
- 3
- 4
- 5

### 10.4 Puan açıklamaları

- **Değerlendirilemedi:** İlgili davranış bu atölyede gözlemlenemedi. Ortalamaya dahil edilmez.
- **1:** Davranışı henüz gerçekleştiremedi.
- **2:** Yoğun yönlendirmeyle gerçekleştirdi.
- **3:** Kısmen veya zaman zaman gerçekleştirdi.
- **4:** Büyük ölçüde bağımsız gerçekleştirdi.
- **5:** Sürekli ve bağımsız gerçekleştirdi.

### 10.5 Düzenleme

- Stajyer kendi girdiği puanlamaları sonradan düzenleyebilir.
- Koordinatör bütün puanlamaları görüntüleyebilir ve düzenleyebilir.
- Puanlama için son tarih bulunmaz.
- Formda yazılı stajyer gözlem notu alanı bulunmaz.

---

## 11. Raporlama

### 11.1 Rapor oluşturma zamanı

Koordinatör öğrencinin raporunu istediği anda oluşturabilir. Dönemin veya kulübün tamamlanması beklenmez.

Rapor, oluşturulduğu anda mevcut olan katılım ve puanlama verilerini kullanır.

### 11.2 Rapor bölümleri

Rapor iki ana bölümden oluşur:

#### A. Atölye bazlı sonuçlar

Her atölye için:

- Atölye adı
- Katıldığı oturum sayısı
- Katılmadığı oturum sayısı
- Değerlendirilen soru sayısı
- Soru bazlı ortalamalar
- Genel atölye ortalaması
- Puanlardan oluşturulan kısa yazılı değerlendirme

#### B. Genel öğrenci raporu

Öğrencinin bütün atölyelerdeki puanları birlikte değerlendirilerek genel bir paragraf oluşturulur.

Genel rapor şu alanlara odaklanabilir:

- Atölyelere ilgi
- Katılım ve etkileşim
- Öğrenme merakı
- Yönerge ve soru takibi
- Görev tamamlama
- Bağımsız çalışma
- Sosyal uyum
- Güçlü yönler
- Desteklenebilecek alanlar

#### C. Gelişim ölçümleri ve kademeler

Öğrencinin duygusal, sosyal ve bilişsel becerileri dönem içinde iki kez
ölçülür (dönem ortası ve dönem sonu). Rapor:

- Dönem sonu ölçümünü grubun ortalamasıyla karşılaştırarak kademe belirler.
- Dönem ortası ile dönem sonu ölçümünü karşılaştırarak öğrencinin kendi
  yönünü yazar (ilerleme / düzeyini koruma / dalgalanma). Bu karşılaştırma
  akranla değil, öğrencinin kendisiyle yapılır.
- İki ölçümden biri yoksa yön yazılmaz; eksik, koordinatörün panelindeki
  uyarı listesinde belirtilir.

Puanların kademeye çevrilme ölçütleri kurum tarafından yönetilir (bkz.
§11.7): eşikler, akran kıyası için gereken asgari grup büyüklüğü ve
kademelerin veliye yazılan adları.

### 11.3 Rapor üretim ilkeleri

- Metin yalnızca mevcut puanlardan çıkarılabilecek sonuçları içermelidir.
- Sistemde bulunmayan bir davranış veya özellik uydurulmamalıdır.
- Tek bir düşük puandan kesin ve ağır bir kişilik yargısı üretilmemelidir.
- Az sayıda değerlendirme varsa metin ihtiyatlı olmalıdır.
- `Değerlendirilemedi` cevapları olumsuz puan gibi yorumlanmamalıdır.
- Katılmadığı atölyeler ortalamaya dahil edilmemelidir.
- Rapor dili profesyonel, gelişim odaklı ve veliye sunulabilir olmalıdır.
- Metin tekrarlarından kaçınılmalıdır.

Önerilen yaklaşım:

1. Sistem puanlardan güçlü, dengeli ve desteklenebilecek alanları belirler.
2. Belirlenen sonuçlar kontrollü kurallar çerçevesinde rapor girdisine dönüştürülür.
3. Yapay zekâ yalnızca bu girdileri doğal ve tutarlı bir metne çevirir.

### 11.4 Rapor düzenleme ve güncellik

- Koordinatör otomatik oluşturulan raporu düzenleyebilir. Düzenlenen her
  metnin üretimdeki özgün hâli saklanır; koordinatör tek tıkla ona
  dönebilir ve hangi metinlerin elle yazıldığı raporda görünür.
- Rapor oluşturulduktan sonra puanlar değiştirilebilir.
- Puan değişikliği olduğunda mevcut rapor `Güncel değil` olarak işaretlenir.
- Koordinatör yeni puanlarla raporu yeniden oluşturabilir.
- Yeniden oluşturma, daha önce kaydedilmiş PDF raporları silmez.
- Raporda elle düzenlenmiş metin varsa yeniden oluşturmadan önce bunların
  yeni rapora taşınıp taşınmayacağı sorulur. Taşınanlar elle düzenlenmiş
  olarak işaretli kalır; karşılığı bu kez üretilmeyen metinler taşınmaz ve
  ismen bildirilir.

### 11.5 PDF rapor

Koordinatör raporu PDF olarak oluşturabilir.

PDF en az şu bilgileri içermelidir:

- Öğrenci adı soyadı
- Rapor tarihi
- Kapsanan dönem veya kulüp kayıtları
- Atölye bazlı sonuçlar
- Genel öğrenci raporu
- Kurum adı

Her oluşturulan PDF öğrencinin rapor geçmişinde saklanır.

Koordinatör, PDF üretmeden önce raporun belge hâlini önizleyebilir.
Önizleme rapor geçmişine kayıt eklemez ve raporun o anki hâlini gösterir;
veliye verilecek belge yalnızca "PDF oluştur" ile üretilir.

### 11.6 Rapordaki bağlam

Rapor penceresinde, öğrencinin zekâ testi belgeleri ve veli görüşmesi
kayıtlarının varlığı koordinatöre gösterilir. Bu bilgi veliye giden belgeye
BASILMAZ: veli görüşmesi kayıtları uzmanın kendi çerçeveleme notlarını
içerir, zekâ testi sonuçları ise sağlık bilgisi sınıfındadır.

### 11.7 Rapor ayarları

Raporun puanları kademeye çevirirken kullandığı ölçütler kurum genelinde tek
yerden yönetilir; şube başına ayrı değer tutulmaz.

Yönetilebilen ölçütler:

- Atölye ilgi/başarı kademelerinin yüksek ve düşük eşiği.
- Akran kıyasında "belirgin fark" sayılan puan farkı.
- Dönem ortası → dönem sonu değişiminde "belirgin ilerleme" sayılan fark.
- Akran kıyasının yapılabilmesi için grupta değerlendirilmiş asgari öğrenci
  sayısı; altında kalınırsa kıyas yapılmaz ve rapora sebebi yazılır.
- Kademelerin veliye yazılan adları.

Ayar değişikliği yalnızca bundan sonra üretilecek raporlara işler. Üretilmiş
bir raporun içeriği dondurulmuştur (§13.17); eskisini yeni ölçütlerle görmek
için rapor yeniden üretilmelidir.

---

## 11.8 Veli görüşmesi formu

Görüşme formu doldurulurken sistem, stajyerin girdiği atölye puanlamalarından
ve gelişim testinden yararlanır:

- Dokuz gözlem alanı için 1–5 puan **önerilir**; öneri forma yazılmaz, uzman
  dayanağını görüp tek tek ya da toplu kabul eder.
- Zorlanma alanları için öneri listesi gösterilir; kutular kendiliğinden
  işaretlenmez.
- Sistemde ölçümü olmayan alanlar (kaygı, duyu hassasiyeti,
  mükemmeliyetçilik, içe kapanıklık, görsel algı) hiçbir koşulda önerilmez.
- İşaretlenen zorlanma alanları için katalogdan yaşa uygun gerçek ürünler
  bağlantılarıyla listelenir.
- Öğrencinin yüklü zekâ testi belgeleri Bölüm 2'de bağlanır; işaretler test
  skorundan türetilmez.
- Önceki dönemlerde alınmış yönlendirme kararları hem formda hem öğrenci
  profilinde özetlenir.

---

## 12. Dashboard ve ana ekranlar

### 12.1 Koordinatör dashboardu

Ana dashboardda en az şu özetler bulunmalıdır:

- Aktif dönemler
- Aktif kulüpler
- Aktif gruplar
- Toplam aktif öğrenci
- Kontenjanı dolan gruplar
- Eksik puanlamalar
- Güncelliğini yitirmiş raporlar
- Son oluşturulan raporlar

### 12.2 Ana modüller

1. Dashboard
2. Dönemler
3. Gruplar
4. Kulüpler
5. Atölye çeşitleri
6. Değerlendirme soruları
7. Öğrenciler
8. Öğrenci kayıtları
9. Stajyerler
10. Stajyer atamaları
11. Puanlamalar
12. Raporlar
13. Arşiv

### 12.3 Stajyer dashboardu

Stajyer ana ekranında:

- Kendisine atanmış öğrenciler
- Aktif dönem ve kulüp kayıtları
- Tarihe göre atölye puanlama görevleri
- Doldurulmamış formlar
- Daha önce doldurduğu formlar

bulunmalıdır.

---

## 13. Temel iş kuralları

1. Bir dönem tam olarak 10 eğitim haftasına sahiptir.
2. Bir dönem grubunda her eğitim gününde 5 atölye yapılır.
3. Aynı dönemin bütün grupları aynı atölyeleri kullanır.
4. Dönem başladıktan sonra yeni grup açılabilir.
5. Sonradan açılan grup geçmiş haftaları telafi etmez.
6. Bir kulüp tek yarım gün sürer ve 3 atölye içerir.
7. Kulüp öğrencisi dönem grubuna eklenmez.
8. Öğrenci birden fazla dönem ve kulüp kaydına sahip olabilir.
9. Her kayıt için ayrı grup ve stajyer atanır.
10. Bir öğrenci aynı kayıt içerisinde yalnızca bir stajyere atanabilir.
11. Her atölye için ayrı katılım ve puanlama kaydı oluşturulur.
12. Katılmayan öğrenciye puan verilmez.
13. Katıldığı atölyede bütün sorular cevaplanmalıdır.
14. Kullanılmış bir sorunun geçmiş metni korunur.
15. Stajyer kendi puanlamalarını sonradan değiştirebilir.
16. Puanlar değiştiğinde ilgili rapor güncelliğini yitirir.
17. Eski PDF raporları silinmez.
18. Öğrencinin bütün katılım ve rapor geçmişi isimle aranarak bulunabilir.

---

## 14. İlk sürüm kapsamı dışında kalanlar

Aşağıdaki özellikler mevcut gereksinimlerde zorunlu değildir:

- Atölyelerin dakika bazlı saat planı
- Atölyelerin yarım gün içindeki sıralaması
- Haftalık müfredat içeriği yönetimi
- Ödeme, taksit ve muhasebe takibi
- Veli paneli
- Online veli kaydı
- WhatsApp veya e-posta gönderimi
- Stajyer serbest metin gözlem notu
- Otomatik stajyer kapasite sınırı

Bu özellikler daha sonra ayrı kapsam olarak değerlendirilebilir.

---

## 15. Kabul ölçütleri

Ürünün temel sürümü aşağıdaki işlemler uçtan uca yapılabiliyorsa işlevsel kabul edilir:

1. Koordinatör 10 haftalık dönem oluşturabilir.
2. Döneme 5 atölye seçebilir.
3. Döneme birden fazla grup ekleyebilir.
4. Üç atölyelik yarım günlük kulüp oluşturabilir.
5. Öğrenci ve anne-baba bilgilerini kaydedebilir.
6. Öğrenciyi dönem veya kulüp grubuna kaydedebilir.
7. Kayıt için stajyer atayabilir.
8. Stajyer kendisine atanmış öğrencileri görebilir.
9. Stajyer her atölye için ayrı puanlama yapabilir.
10. Stajyer öğrenciyi belirli bir atölyede katılmadı olarak işaretleyebilir.
11. Koordinatör öğrenciyi ismiyle arayabilir.
12. Koordinatör öğrencinin bütün atölye geçmişini görebilir.
13. Sistem atölye bazlı sonuçlar üretebilir.
14. Sistem genel öğrenci raporu oluşturabilir.
15. Koordinatör raporu PDF olarak dışarı aktarabilir.
16. Puanlar değiştiğinde raporun güncel olmadığı görülebilir.

---

## 16. Aday yönetimi (CRM)

Kurum, kayda dönüşmemiş ilgiyi (lead) bu modülden önce dış bir araçta
(Workiom/Bitrix) yürütüyordu. Süreç panele taşındı: aday ile öğrenci aynı
sistemde durunca "bu çocuk nereden geldi" ve "reklam bütçesi ne getirdi"
soruları tek yerden cevaplanabiliyor.

### 16.1 Kaynaklar

| Kaynak | Nasıl girer |
|---|---|
| `META` | Meta (Facebook/Instagram) reklam formu → entegratör (Pabbly/Make) → `POST /api/crm/aday` |
| `WEB_SITESI` | tuzder.org form işleyicisi → aynı uç (sunucudan sunucuya) |
| `TELEFON` | Danışman elle açar |
| `YOLDAN_GECEN` | Şubeye gelen veli; danışman elle açar |
| `DIGER` | Elle |

`META` ve `WEB_SITESI` yalnızca API'den yazılır; elle açma formunda
sunulmaz — sunulsaydı kaynak raporundaki reklam getirisi elle şişirilebilirdi.

Meta ile doğrudan webhook yerine entegratör tercih edildi: App Review, imza
doğrulama ve sayfa jetonu yenileme yükü kuruma gelmiyor. Uç, ileride doğrudan
webhook'a geçilmek istenirse aynı sözleşmeyi karşılar.

### 16.2 Boru hattı

`YENI → ULASILDI → RANDEVU_VERILDI → GORUSME_YAPILDI → KAZANILDI / KAYBEDILDI`

- İzinli geçişlerin tek kaynağı `src/lib/aday-durumlari.ts` içindeki
  `ADAY_ASAMA_GECISLERI` (dönem/kulüp durumlarındaki desen).
- `KAZANILDI` her açık aşamadan erişilir (yoldan gelen aile aynı gün kayıt
  olabilir) ama YALNIZCA dönüşüm akışıyla yazılır ve terminaldir.
- `KAYBEDILDI` her açık aşamadan; tek adımla (`YENI`) geri açılabilir.
- **"Ulaşılamadı" bir aşama DEĞİLDİR:** `ULASILAMADI` etkinliği + ardışık
  deneme sayacı (`unreachableCount`). Sayaç `ULASILDI`'ya geçişte sıfırlanır.
  Kapanış, danışmanın kararıyla `KAYBEDILDI + ULASILAMADI` sebebiyle olur.

### 16.3 Etkinlik günlüğü

Her aday için `LeadActivity` satırları: `ARAMA`, `ULASILAMADI`, `WHATSAPP`,
`NOT` (insan yazar) ve `ASAMA_DEGISIMI`, `SISTEM` (yalnız kod yazar).
Görüşme kayıtları ilkesi geçerli: satır silinmez ve düzenlenmez; yanlış not
yeni notla düzeltilir. Aşama değişimi ile etkinlik satırı aynı transaction'da
yazılır.

### 16.4 Kayıp sebepleri

`ULASILAMADI, FIYAT, UZAKLIK, PROGRAM_UYGUN_DEGIL, VAZGECTI, YANLIS_KAYIT,
DIGER`. Serbest metin yerine etiket (`CancelReason` ilkesi): "bu ay kaç aday
fiyattan kaybedildi" ancak sayılabilir bir alandan cevaplanır. `DIGER`
seçilirse açıklama zorunlu (uygulamada ve CHECK ile).

### 16.5 Dış giriş ucu

`POST /api/crm/aday`, `Authorization: Bearer <LEAD_API_TOKEN>`.

- CORS başlığı ve OPTIONS işleyicisi bilerek YOK: jeton tarayıcıya inmemeli.
- Gövde sınırı 10 KB; bal küpü (`website`) alanı doluysa sessizce 200 döner.
- Şube `subeKodu` alanından ÇÖZÜLÜR ama aktif `Branch.code` allowlist'ine
  karşı doğrulanır. Çözülemezse başvuru DÜŞÜRÜLMEZ: varsayılan şubeye
  (aktif + en düşük `sortOrder`) `ingestStatus: ESLEME_YOK` işaretiyle yazılır
  ve listede yönetici uyarısı üretir.
- Telefon ve e-posta ikisi de yoksa `EKSIK_VERI` işareti — aday yine açılır.
- `disKimlik` (Meta leadgen kimliği) idempotency anahtarıdır: teslim tekrarı
  hiçbir şey yazmaz.
- Kaynak başına saatlik 100 yazım tavanı; aşılırsa 429.
- Veritabanı erişilemezse 500 döner ve entegratörün yeniden denemesine
  güvenilir.

### 16.6 Ekranlar

- **Liste** (`/koordinator/adaylar`): kapsam çipleri (Açık · Bugün aranacak ·
  Gecikmiş · Tümü) danışmanın günlük iş kuyruğudur. Sıralama en geciken takip
  en üstte. Kart satırında ad, aşama rozeti, kaynak, deneme sayısı, takip
  tarihi ve `tel:`/`wa.me` düğmeleri.
- **Ayrıntı** (`/koordinator/adaylar/[id]`): tam sayfa (pencere değil —
  `tel:` gidiş dönüşünü adres atlatır). Aşama açılır listeyle değil AÇIK
  EYLEM DÜĞMELERİYLE değişir; "Arandı — ulaşılamadı" tek dokunuşta sayacı
  artırır ve takip tarihini yarına alır (davranış ekranda yazılı, tarih
  hemen altta düzeltilebilir).
- **Takip**: `nextActionDate` + sorumlu danışman (`assignedToUserId`).
  Sahiplik görünürlüğü KISITLAMAZ — küçük ekip, herkes her adayı görür.
- **Dashboard**: "Aranacak aday" ve "Dokunulmamış yeni aday" kartları;
  gecikmişler ayrı kart değil alt bilgi (aynı iş iki kez sayılmasın).

### 16.7 Kaynak raporu

`/koordinator/adaylar/rapor` — dönem çipleri (bu ay / geçen ay / son 3 ay /
tümü), kaynak başına toplam-kazanılan-kaybedilen-oran ve kayıp sebebi
dağılımı. Eksen `createdAt` (kohort): "bu ay GELEN adayların kaçı kazanıldı".
Dönüşüm anına göre saymak ayrı bir sorudur ve V1'de yok.

### 16.8 Mükerrer kaydı

Anahtar normalize telefon, hep aynı şube içinde:

1. Telefon yoksa aday açılır (karşılaştıracak anahtar yok).
2. API'den gelen aday, aynı telefonla AÇIK bir aday varken yeni satır
   AÇMAZ: mevcut adaya sistem notu düşer ve takip tarihi bugüne çekilir.
   10 dakika içindeki tekrar not bile düşürmez.
3. Elle girişte aynı durum ENGEL değil UYARIDIR — kardeşler aynı veli
   telefonunu paylaşır; danışman "Yine de kaydet" ile geçer ve karar
   etkinliğe yazılır.
4. Kapanmış bir adayla veya kayıtlı bir veliyle eşleşme yeni aday açar
   (geri dönen aile, kardeş) ve nota bağlanır.

### 16.9 Dönüşüm ve sonraki adım

"Öğrenciye dönüştür" iki karar sorar:

1. **Öğrenci modu** — "Yeni öğrenci kaydı aç" (mevcut öğrenci formuna
   `?aday=<id>` ile geçilir, alanlar adaydan ön-dolar) veya "Zaten kayıtlı"
   (öğrenci seçilip eşleştirilir). Aşama ancak öğrenci GERÇEKTEN
   kaydedildiğinde `KAZANILDI` olur; kullanıcı formu yarıda bırakırsa adaya
   hiçbir şey olmaz.
2. **Sonraki adım hedefi** — görüşmede verilen karar:

| Hedef | Öğrenci kaydedilince gidilen yer |
|---|---|
| Dönem/kulüp kaydı | `/koordinator/kayitlar/yeni?studentId=…` |
| Zekâ testi | Öğrenci profili (zekâ testi bölümü) |
| Danışmanlık | Öğrenci profili + etkinliğe not (danışmanlık yetkisi Danışma Görevlisi'nde YOK) |
| Şimdilik yok | Öğrenci profili |

Hedef aday etkinliğine yazılır: "kazanılanların kaçı kayda gitti" buradan
okunur.

### 16.10 Yetkiler

`adaylar` modülü: ADMIN, SUBE_YONETICISI, KOORDINATOR, ATOLYE_PSIKOLOGU ve
**DANISMA_GOREVLISI** TAM; TEST_UYGULAYICISI ve STAJYER YOK. Modülün asıl
kullanıcısı Danışma Görevlisi'dir — aday verisi sağlık/görüşme mahremiyeti
sınıfında değil, kayıt masası verisidir.

### 16.11 Kapsam dışı (V1)

Bitrix/Workiom veri aktarımı, ödeme, randevu takvimi, e-posta/SMS gönderimi,
doğrudan Meta webhook'u, dönüşmeyen adaylar için otomatik saklama süresi
temizliği.

---

## 17. Randevu yönetimi

Kurumun ikinci iş kolu: zekâ testleri ve bireysel danışmanlık seansları.
Bugüne kadar dış bir CRM'de yürüyordu, haftalık ciro Excel'de elle tutuluyordu.
§14 bu modülü "ilk sürüm kapsamı dışında" saymıştı; bu bölüm o kararı
kaldırıyor.

Modül üç fazda teslim edilir: (1) tanımlar — veli, uzman, hizmet, izin;
(2) randevu takvimi; (3) ciro raporu ve mesaj düğmeleri. Aşağıdaki tanım
tamamını kapsar, hangi fazda geldiği belirtilmiştir.

### 17.1 Veli (Faz 1)

Veli artık öğrencinin altındaki bir satır değil, ADI, TELEFONU VE GEÇMİŞİ
OLAN bir kayıttır. Randevu doğrudan veliye açılır: ödeyen, arayan ve
hatırlatma mesajını alan taraf odur.

- Veli bir şubeye aittir (öğrenciyle aynı gerekçe, §6.1).
- Kimlik anahtarı **şube + telefon + ad**. Yalnız telefon YETMEZ: aynı
  numarayı paylaşan anne ve baba iki ayrı kişidir.
- Aynı veli birden çok çocuğa bağlanabilir; kardeş kaydında ikinci bir veli
  açılmaz. Velinin adını bir çocuğun formundan düzeltmek diğerinde de düzeltir.
- Telefonu olmayan veli eşleştirilemez; her biri kendi kaydıdır.

### 17.2 Hizmet kataloğu (Faz 1)

Randevuda seçilebilecek hizmetler. Sabit liste değil, panelden yönetilir.

| Alan | Not |
|---|---|
| Ad, grup | Grup: zekâ testi / danışmanlık / atölye görüşmesi |
| Süre (dk) | Randevunun bitiş saati bundan hesaplanır |
| Ücret | Kuruş cinsinden tamsayı; ücretsiz hizmet 0 |
| Yaş aralığı | İsteğe bağlı; uyarı üretir, engellemez |
| Danışan türü | Çocuk / veli — aile danışmanlığında danışan velinin kendisi |
| Haftalık tekrar | Danışmanlıklar açık, zekâ testleri kapalı |

Başlangıç kataloğu kurumun 2026 fiyat listesidir. **Fiyat değişikliği geçmişe
işlemez** (§17.4). Hizmet SİLİNMEZ, pasife alınır: geçmiş randevular ona bağlı.

### 17.3 Uzman (Faz 1)

Seansı veren kişi. Panel kullanıcısı (`User`) DEĞİL, ayrı bir kayıt: uzmanların
çoğu panele girmiyor ve bir uzman iki şubede birden çalışabiliyor (kullanıcı
hesabı tek şubeye bağlıdır). Panele giren uzmanın hesabı isteğe bağlı olarak
bağlanır.

- **Renk**: takvimde ayrım için, sabit paletten. Renk tek başına yeterli
  değildir; uzmanın adı her zaman renkle birlikte yazılır.
- **Yetkinlik**: uygulayabildiği hizmetler. Randevu formu yalnız bu listeyi
  gösterir ve sunucu da aynı listeye karşı doğrular.
- **Mesai**: haftalık çalışma saatleri, ŞUBE BAŞINA ayrı.
- **İzin**: başlangıç–bitiş aralığı (yarım gün olabilir). İzin bir seans
  değildir; seans sayısı ve ciro raporlarına karışmaz.
- Uzman SİLİNMEZ, pasife alınır: geçmiş randevuları ve cirosu ona bağlı.

### 17.4 Randevu (Faz 2)

Belirli bir uzmana, belirli bir hizmet için, belirli bir saatte açılan kayıt.
Danışanı velidir; çocuk seçimi isteğe bağlıdır.

- **Ücret randevuya KOPYALANIR.** Katalogdaki zam geçmiş randevuyu ve geçmiş
  haftaların cirosunu değiştirmez. Randevu bazında elle indirim girilebilir.
  Tahsilat takibi kapsam dışı.
- **Çakışma, mesai dışı ve izin ENGELLENİR** (uyarı değil).
- **Haftalık tekrar**: tekrarlı hizmetlerde seans bir sonraki haftaya aynı gün
  ve saate eklenir. Zekâ testleri bu otomasyonun dışındadır.
- **İptal edilen randevu silinmez**: takvimden düşer, ayrı bir listede
  geçmişiyle görünür.
- Randevu, ilgili görüşme veya zekâ testi kaydına isteğe bağlı olarak bağlanır;
  o kayıtlar (§11, danışmanlık ve zekâ testleri) yerinde kalır.

### 17.5 Raporlama (Faz 3)

Seçilen hafta veya ay için uzman bazında seans adedi ve toplam ciro. Yalnız
gerçekleşen randevular ciroya girer; iptal ve gelmedi ayrı gösterilir. Hizmet
türü kırılımı ve dışa aktarım bulunur. Mevcut Excel raporlamasının yerini alır.

### 17.6 Mesajlar (Faz 3)

Hatırlatma ve anket mesajları, veli numarasına WhatsApp bağlantısı olarak
hazırlanır; gönder tuşuna kullanıcı basar. Otomatik SMS/e-posta gönderimi
kapsam dışıdır.

### 17.7 Şube görünürlüğü

Randevu takvimi ve uzman müsaitliği ŞUBELER ARASI görünür — uzmanlar iki
şubede birden çalışabildiği için çakışma ancak böyle önlenir. Öğrenci ve veli
kişisel verisi, sağlık bilgisi ve görüşme notları eskisi gibi şubeye kilitli
kalır.

### 17.8 Yetkiler

`randevular` modülü: ADMIN, SUBE_YONETICISI, KOORDINATOR, ATOLYE_PSIKOLOGU ve
DANISMA_GOREVLISI TAM; TEST_UYGULAYICISI ve STAJYER YOK. Ciro için ayrı bir
yetki yoktur — modülü gören ücreti de görür.

`uzmanlar` modülü (kadro + hizmet kataloğu): ADMIN ve SUBE_YONETICISI TAM;
koordinatör, psikolog ve danışma masası GÖRÜNTÜLE. Kadro ve fiyat listesi
`kullanicilar` ile aynı sınıfta bir yönetici işidir.
