# İlerleme Takibi

Hangi pakette olduğumuzun tek kaynağı bu dosyadır. Her paket bittiğinde
işaretlenir ve "Şu an" satırı güncellenir.

**Şu an:** P12 — Yayına alma *(canlıda; alan adı DNS kaydı bekliyor)*

---

## Paketler

| # | Paket | Durum | Bitti sayılma ölçütü |
|---|---|---|---|
| P0 | Proje iskeleti | ✅ Tamam | `npm run dev` çalışır, yerel Postgres ayakta |
| P1 | Veri modeli ve seed | ✅ Tamam | 6 atölye + 60 soru veritabanında görünür |
| P2 | Kimlik doğrulama ve rol erişimi | ✅ Tamam | İki rolle giriş yapılır, stajyer koordinatör sayfasına giremez |
| P3 | Atölye çeşitleri ve sorular | ✅ Tamam | Bir atölyenin soruları diğerinden bağımsız düzenlenir |
| P4 | Dönem, takvim ve gruplar | ✅ Tamam | 10 haftalık dönem + 2 grup; 4. haftada açılan grup 35 oturum alır |
| P5 | Öğrenci yönetimi | ✅ Tamam | "sule" araması "Şule"yi bulur, telefonla arama çalışır |
| P6 | Kayıt ve stajyer ataması | ✅ Tamam | Öğrenci gruba kaydedilir, kontenjan sayacı düşer |
| P7 | Puanlama | ✅ Tamam | Kabul ölçütleri 1–12 uçtan uca çalışır |
| P8 | Kulüp yönetimi | ✅ Tamam | 3 atölyelik kulüp açılır, stajyer 3 form doldurur |
| P9 | Raporlama | ✅ Tamam | Rapor üretilir, puan değişince "Güncel değil" olur |
| P10 | PDF ve rapor geçmişi | ✅ Tamam | PDF'te Türkçe karakterler doğru, eski PDF listede kalır |
| P11 | Dashboard ve arşiv | ✅ Tamam | Dashboard sayıları listelerle birebir uyuşur |
| P12 | Yayına alma | ⬜ Bekliyor | 16 kabul ölçütü gerçek ortamda doğrulanır |
| P13 | AI rapor metni *(sonraya bırakıldı)* | ⬜ Bekliyor | Metin katmanı Claude API ile üretilir, şablon yedek kalır |

---

## Tamamlananların notları

### P0 — Proje iskeleti ✅

Kurulan sürümler: **Next.js 16.2.12**, React 19.2.4, Tailwind v4, **Prisma 7.9.1**,
Auth.js v5 (beta), Zod 4, Vitest 4.

Bu sürümlerde planlarken varsayılandan sapan üç nokta:

1. **`middleware.ts` → `proxy.ts`.** Next 16'da middleware dosya adı `proxy`
   olarak değişti ve dışa aktarılan fonksiyon da `proxy` olmalı. Çalışma ortamı
   `nodejs`, `edge` desteklenmiyor. P2'deki rota koruması buna göre yazılacak.
2. **Prisma 7 `prisma.config.ts` kullanıyor.** Veritabanı adresi artık
   `schema.prisma` içindeki `datasource` bloğunda değil, bu dosyada. Üretilen
   istemci `src/generated/prisma` altına çıkıyor ve sürüm kontrolüne girmiyor.
3. **Turbopack varsayılan** oldu; `--turbopack` bayrağına gerek yok.

Yapılanlar:
- Markdown dokümanları `docs/` altına taşındı (silinmedi).
- Yerel Postgres `docker-compose.yml` ile **5433** portunda (5432'de başka bir
  Postgres varsa çakışmasın diye).
- `src/lib/env.ts` — ortam değişkenleri açılışta Zod ile doğrulanır.
- `src/lib/turkce.ts` — arama normalizasyonu ve Türkçe sıralama. Türkçe'nin
  `I/ı` ve `İ/i` tuzağı tek noktada çözüldü; 6 test bunu doğruluyor.
- Arayüz `lang="tr"`, Geist fontu `latin-ext` alt kümesiyle (ğ, ş, ı, İ için).

**Bilinen ve kabul edilen durum:** `npm audit` dev bağımlılıklarında (eslint,
postcss zinciri) yüksek önemde uyarı veriyor. Bunlar üretim paketine girmiyor;
düzeltmeleri eslint 10'a kırıcı geçiş gerektirdiği için P12'ye bırakıldı.

### P1 — Veri modeli ve seed ✅

18 tablo, 7 enum, ilk migration ve başlangıç verisi. Veritabanında doğrulandı:
**6 atölye çeşidi, 60 değerlendirme sorusu, 3 kullanıcı hesabı.** Seed
idempotent — ikinci çalıştırmada kopya üretmiyor ve kurumun düzenlediği
soruları geri getirmiyor.

Şemadaki kritik kararlar (gerekçeleriyle `prisma/schema.prisma` içinde yazılı):

- **Oturumlar materyalize ediliyor.** Dönem grubu 50, kulüp grubu 3 `Session`
  satırı alır. Puanlama görevleri, eksik puanlama ve katılım geçmişi tek
  sorguyla çıkar.
- **`Group.startWeekNumber`** — sonradan açılan grubun geçmiş haftaları telafi
  etmemesi (§13.5) bu tek alanla çözülüyor.
- **`ScoreAnswer.questionTextSnapshot`** — soru sonradan değişse veya silinse
  bile geçmiş değerlendirme o günkü metni gösteriyor (§13.14).
- **`value Int?`** — `null` "Değerlendirilemedi" demek; "satır yok" ise form
  eksik demek. İki durum kasten ayrı (§10.3).
- **Rapor güncelliği türetiliyor**, saklanmıyor — puan `updatedAt` ile rapor
  `generatedAt` karşılaştırılıyor (§13.16). Trigger veya arka plan işi yok.
- **`ReportPdf` → `onDelete: Restrict`** — eski PDF'lerin silinemezliği (§13.17)
  veritabanı seviyesinde zorlanıyor.

Prisma'nın ifade edemediği 5 kural migration'a elle CHECK kısıtı olarak
eklendi ve veritabanında doğrulandı: grup dönem XOR kulüp, kontenjan > 0,
hafta numarası 1–10, başlangıç haftası 1–10, puan 1–5 veya NULL.

`src/lib/scoring.ts` — ortalama, kontenjan ve rapor güncelliği hesaplarının
tek kaynağı. Saf fonksiyonlar, veritabanı bilmiyorlar. **23 test geçiyor**,
aralarında `docs/examples/sample-scorecard.md` dosyasındaki 4,3 ortalamasının
birebir üretildiği doğrulaması da var.

**Sürüm sürprizi:** Prisma 7 artık driver adapter zorunlu kılıyor —
`new PrismaClient()` tek başına bağlanmıyor, `@prisma/adapter-pg` üzerinden
bağlantı adresi açıkça veriliyor. `src/lib/db.ts` ve `prisma/seed.ts` buna
göre yazıldı.

### P2 — Kimlik doğrulama ve rol erişimi ✅

Auth.js v5 (Credentials + bcrypt), giriş/çıkış, iki panel kabuğu ve rol
bazlı erişim. Üretim derlemesi (`npm run build`) temiz geçiyor.

**Tarayıcıda uçtan uca doğrulandı:**

| Senaryo | Sonuç |
|---|---|
| Oturumsuz `/koordinator` | → `/giris` |
| Hatalı parola | "E-posta adresi veya parola hatalı." |
| Koordinatör girişi | → Dashboard, gerçek veriler (6 atölye / 60 soru / 2 stajyer) |
| Koordinatör `/stajyer` yazarsa | → `/koordinator` |
| Stajyer girişi | → Görevlerim |
| **Stajyer `/koordinator` yazarsa** | **→ `/stajyer` (engellendi)** |
| Çıkış | → `/giris` |

Yetki iki katmanlı kuruldu ve bu bilinçli bir tercih: Next.js dokümanı
proxy'nin tam bir yetkilendirme çözümü olarak kullanılmamasını söylüyor.

1. `src/proxy.ts` — iyimser ön kontrol, kullanıcıyı gereksiz sayfaya
   götürmemek için. Tek başına güvenlik dayanağı değil.
2. `src/lib/auth-guard.ts` — **asıl koruma.** Her sayfa ve her Server Action
   `koordinatorZorunlu()` / `stajyerZorunlu()` çağırır. Yeni sayfa yazan
   herkes buradan başlamalı.

Diğer kararlar:

- **Zamanlama sızıntısı kapatıldı.** Kullanıcı bulunamadığında da bcrypt
  karşılaştırması sahte bir hash'e karşı yapılıyor; aksi halde cevap
  süresinden hangi e-postaların kayıtlı olduğu anlaşılabilirdi.
- **Pasif hesap** doğru parolayla bile giremiyor.
- **Menüde 13 modülün tamamı görünüyor**, henüz yazılmamış olanlar tıklanamaz
  ve yanında hangi pakette geleceği yazıyor. Amaç ürünün bütününü baştan
  göstermek ve 404 vermemek.
- Oturum süresi 12 saat (bir çalışma günü).

**Sürüm sürprizi:** Auth.js tip genişletmesi `next-auth/jwt` yerine
`@auth/core/jwt` hedeflemeli — `next-auth/jwt` arayüzü kendisi tanımlamıyor,
yalnızca yeniden dışa aktarıyor ve yeniden dışa aktaran modülü genişletmek
özgün arayüzle birleşmiyor.

**Yapılmayan:** Planda P2'nin sonunda Vercel'e ilk yayın vardı. Yayın sizin
Vercel ve Supabase hesabınıza bağlanmayı gerektirdiği için yapılmadı —
hazır olduğunuzda söyleyin, P12'deki adımlarla birlikte kuralım. Uygulama
derleme olarak yayına hazır.

### P3 — Atölye çeşitleri ve değerlendirme soruları ✅

İki modül devreye girdi: **Atölye çeşitleri** ve **Değerlendirme soruları**.
Atölye ekleme/düzenleme/pasife alma, atölye başına soru ekleme, metin
düzenleme, sıralama, aktif/pasif ve silme çalışıyor.

**Tarayıcıda doğrulandı (kabul ölçütü):** Bilim Atölyesi'nde bir sorunun hem
sırası hem metni değiştirildi; Robotik ve Astronomi atölyelerinin setleri
hiç etkilenmedi. Soru setleri gerçekten bağımsız. (Test değişikliği sonrasında
geri alındı, başlangıç verisi orijinal halinde.)

Ürün kararları:

- **Atölye silinmiyor, pasife alınıyor.** §2.1 zaten silme demiyor; pasif
  atölye yeni programlarda seçilemez ama geçmiş oturum ve raporlarda kalır.
- **Soru silme akıllı davranıyor.** Hiç kullanılmamış soru gerçekten silinir.
  Puanlamada kullanılmış soru silinmez, pasife alınır ve koordinatöre sebebi
  açıkça yazılır: *"Bu soru N değerlendirmede kullanılmış. Geçmiş kayıtlar
  bozulmasın diye silinmedi, pasife alındı."* Onay kutusunda da aynı uyarı
  çıkar. Sessizce farklı davranmak hata gibi algılanırdı.
- **Her satırda kullanım sayısı görünüyor** ("Henüz kullanılmadı" / "N
  değerlendirmede kullanıldı"), böylece koordinatör silmeden önce ne olacağını
  biliyor.
- **Sıralama ok tuşlarıyla**, sürükle-bırak değil: komşu soruyla `sortOrder`
  takası tek işlemde (transaction) yapılıyor, sıra hiçbir an bozuk kalmıyor.
- **Aktif sorusu olmayan atölye uyarı veriyor** — o atölyede puanlama
  yapılamayacağı için.

**Karşılaşılan uyarı:** React derleyici kuralı, effect içinde `setState`
çağrısını zincirleme render sebebiyle reddetti. Panel kapatma mantığı React'in
önerdiği "render sırasında durum ayarlama" biçimine çevrildi; panel kapanınca
form zaten DOM'dan kalktığı için ayrıca temizlemeye de gerek kalmadı.

### P4 — Dönem, takvim ve gruplar ✅

Dönem sihirbazı, eğitim takvimi, grup ekleme ve oturum üretici. **Dönemler**
ve **Gruplar** modülleri devreye girdi.

**Kabul ölçütü veritabanında doğrulandı:**

| Grup | Gün | Başlangıç haftası | Oturum |
|---|---|---|---|
| 1. Grup | Cumartesi | 1 | **50** |
| 2. Grup (dönem başladıktan sonra açıldı) | Pazar | **4** | **35** |

Pazar grubunun ilk oturumu 2 Ağustos (4. haftanın pazarı), sonuncusu 13 Eylül.
Cumartesi grubunun bütün oturumları cumartesiye denk geliyor.

#### Şartnamedeki belirsizlik ve verilen karar

§2.2 dönemin "10 tarih"ten oluştuğunu, §2.3 ise grupların cumartesi **veya**
pazar toplandığını söylüyor. Bu ikisi doğrudan çelişiyor: dönem tek bir tarih
listesi tutarsa, cumartesi tarihine pazar grubu gelemez.

**Karar:** Dönem 10 **hafta** tutar, 10 gün değil. Her hafta o hafta sonunun
cumartesisiyle "çapalanır"; grubun gerçek toplanma tarihi kendi gününden
türetilir — cumartesi grubu çapada, pazar grubu ertesi gün. Koordinatör
takvimde cumartesiyi de pazarı da işaretlese aynı hafta kaydedilir. Arayüzde
haftalar "1–2 Ağustos 2026" biçiminde, yani hafta sonu olarak gösteriliyor.

Bu okuma §4.1'in kendi diliyle de uyumlu: orada "haftalar takvim üzerinden tek
tek seçilebilmelidir" deniyor, "günler" değil.

#### Diğer kararlar

- **Başlangıç haftası koordinatöre sorulmuyor**, tarihten kesin olarak
  türetiliyor. Elle girilseydi §13.5 kuralı yanlışlıkla delinebilirdi.
  Bunun yerine sonuç açıkça yazılıyor — grup eklenmeden önce *"4. haftadan
  başlar; geçmiş 3 hafta telafi edilmez ve 35 atölye oturumu oluşturulur"*,
  eklendikten sonra da grup kartında kalıcı uyarı olarak.
- **Haftalar ay ızgarası yerine hafta sonu listesi.** Kurum yalnızca hafta
  sonu çalışıyor; seçim birimi hafta. Tatil haftalarını atlayarak 10 kutu
  işaretlemek bu biçimde doğrudan yapılabiliyor.
- **10 hafta / 5 atölye kotası arayüzde canlı sayaç**, dolunca fazlası
  işaretlenemiyor ve gönder butonu kilitli kalıyor.
- **Dönem, haftaları, atölyeleri, ilk grubu ve 50 oturumu tek transaction
  içinde** yazılıyor; yarım kalmış dönem oluşamaz.
- **Tarih işlemlerinin tamamı UTC** üzerinden. `@db.Date` alanları UTC gece
  yarısı geliyor; yerel saatle işlem sunucunun bulunduğu yere göre bir gün
  kaydırabilirdi. Ay adları da yerel ayara bırakılmadan sabitlendi.

**Sürüm sürprizi:** `"use server"` işaretli dosya yalnızca async fonksiyon
dışa aktarabiliyor. `HAFTA_SAYISI` gibi sabitler `actions.ts` içindeyken
tip kontrolü ve lint temiz geçti ama **uygulama tarayıcıda derleme hatası
verdi**. Sabitler `src/lib/kurallar.ts` dosyasına taşındı. Bu, tarayıcıda
doğrulamanın neden gerekli olduğunun somut örneği — iki statik kontrol de
kaçırmıştı.

### P5 — Öğrenci yönetimi ✅

Öğrenci ekleme/düzenleme (öğrenci + anne/baba + sağlık), arama ve profil
sayfası. **Öğrenciler** modülü devrede.

**Kabul ölçütü doğrulandı** — 18 arama senaryosunun tamamı gerçek veritabanına
karşı çalıştırıldı:

| Yazım | Sonuç |
|---|---|
| `sule` · `SULE` · `Şule` · `ŞULE` | Şule Çınar |
| `cinar` · `ÇINAR` | Şule Çınar |
| `ipek` · `İPEK` · `İpek` | İpek Yıldız |
| `yildiz` · `YILDIZ` | İpek Yıldız |
| `0532` · `5321112233` · `0532 111 22 33` | Şule Çınar |
| `+90 533 444 55 66` · `533444` | İpek Yıldız |
| `zzz` | (sonuç yok) |

**Bulunan ve düzeltilen hata:** Kısmi telefon araması `0532` ile sonuç
vermiyordu. `normalizeTelefon` baştaki sıfırı yalnızca 11 haneli tam
numaralarda atıyordu; koordinatörün numarayı hatırladığı kadar yazması
tamamen doğal olduğu için sıfır artık uzunluğa bakılmaksızın atılıyor.
Ülke kodu ise hâlâ yalnızca tam numara uzunluğunda atılıyor — kısa bir
girdideki "90" numaranın ortasından bir kesit olabilir. Üç yeni test eklendi.

Kararlar:

- **Arama normalize edilmiş sütun üzerinden.** `Student.searchName` kaydederken
  üretiliyor ("Şule Çınar" → "sule cinar"), sorgu anında sütunu dönüştürmek
  indeksi devre dışı bırakırdı. Aynı yaklaşım veli telefonu için de geçerli.
- **Tek arama kutusu**, hem isim hem telefon. Hangisi olduğu girdiden
  anlaşılıyor; en az 3 rakam yoksa telefon araması hiç yapılmıyor.
- **Arama sıradan bir GET formu** — sorgu adres satırında duruyor, sonuç
  paylaşılabiliyor ve geri tuşu beklendiği gibi çalışıyor.
- **"En az bir ebeveyn telefonu" kuralı** form seviyesinde; tek alana bakarak
  doğrulanamıyor. Telefon girilip ad girilmemesi de engelleniyor.
- **Sağlık bölümünde stajyer uyarısı görsel olarak ayrılmış** ve yanına
  "Stajyerin göreceği TEK sağlık bilgisi budur" açıklaması konmuş; koordinatör
  oraya teşhis yazma eğilimine kapılmasın diye.
- **Profilde §6.3'ün 11 bölümü yerini koruyor**; 4–11 arası bölümler P6–P10'da
  dolacak, şimdilik ne geleceğini söyleyen bir boş durum var.

### P6 — Kayıt ve stajyer ataması ✅

Üç koordinatör modülü devreye girdi: **Öğrenci kayıtları**, **Stajyerler** ve
**Stajyer atamaları**. Öğrenci profilinden dönem/kulüp kaydı başlatma, grup ve
kontenjan görme, kayıt bazında stajyer seçme/değiştirme, kayıt iptali ve yeniden
etkinleştirme çalışıyor.

**Kabul ölçütü tarayıcıda ve veritabanında doğrulandı:**

| Adım | Sonuç |
|---|---|
| Şule Çınar → 2026 Sonbahar → 1. Grup | Kayıt oluşturuldu |
| Grup sayacı | **0/12 → 1/12** |
| Öğrenci profili | Aktif kayıt ve Ayşe Yılmaz ataması göründü |
| Atama yönetimi | Ayşe Yılmaz → Mehmet Kaya değiştirildi |
| Test temizliği | Test kaydı silindi, sayaç yeniden **0/12** |

Kararlar ve güvenlik önlemleri:

- **Kontenjan sunucuda yeniden kontrol edilir.** Formdaki sayaç yalnızca bilgi
  amaçlıdır; eski veya değiştirilmiş istemci verisiyle dolu gruba kayıt
  açılamaz.
- **Eşzamanlı son koltuk yarışı kapatıldı.** Aynı gruptaki kayıt oluşturma ve
  yeniden etkinleştirme işlemleri PostgreSQL transaction advisory lock ile
  sıraya alınır. Farklı gruplar birbirini bekletmez; aynı grubun iki isteği ise
  kontenjanı aşamaz.
- **Çakışma uyarısı engel değildir.** Aynı gün ve zaman dilimindeki başka
  aktif kayıt koordinatöre gösterilir; yalnızca uyarının üretildiği grup için
  ikinci gönderimde devam edilebilir. Uyarıdan sonra grup değiştirilirse eski
  onay taşınmaz.
- **Kayıt silinmez, iptal edilir.** Böylece gelecekte girilecek puanlama ve
  katılım geçmişi korunur. İptal edilen kayıt kontenjandan düşer; yeniden
  etkinleştirme sırasında kontenjan ve program durumu yeniden doğrulanır.
- **Stajyer hesabı kullanıcı tablosundadır.** Koordinatör hesap açabilir,
  ad/parola güncelleyebilir ve hesabı pasife alabilir. Sunucu eylemleri yalnızca
  `STAJYER` rolündeki hesapları değiştirebilir; gönderilen kimlikle koordinatör
  hesabı düzenlenemez.
- **Öğrenci profili genişletildi.** Aktif kayıtlar, geçmiş kayıtlar ve kayıt
  bazlı stajyer atamaları §6.3 sırasıyla görünür; P7–P10 bölümleri yerini korur.

**Tarayıcının yakaladığı çalışma zamanı ayrıntısı:** PostgreSQL
`pg_advisory_xact_lock` fonksiyonu `void` döndürür; Prisma bu sütunu doğrudan
serileştiremedi. Kilit sonucu sorguda `text` tipine çevrilerek hem kilit
davranışı korundu hem Prisma sürücü uyumu sağlandı.

### P7 — Puanlama ✅

Çekirdek zincir tamamlandı. Stajyer paneli (Görevlerim, Öğrencilerim,
Doldurduğum formlar) ve koordinatörün **Puanlamalar** modülü devrede;
öğrenci profiline katılım ve puanlama geçmişi bölümleri eklendi.

**Tarayıcıda ve veritabanında doğrulandı:**

| Senaryo | Sonuç |
|---|---|
| Bilim Atölyesi formu (örnek karttaki 10 puan) | Ortalama **4,3** — `sample-scorecard.md` ile birebir |
| Robotik "Katılmadı" | Cevap satırı yazılmadı, ortalamaya girmedi |
| Katıldı + 2 soru boş (istemci doğrulaması atlanarak) | Sunucu reddetti, **kayıt oluşmadı**, eksik satırlar kırmızı işaretlendi |
| Soru metni değiştirildi | Form o günkü metni gösterdi; yeniden kaydedince snapshot **değişmedi** (§13.14) |
| Koordinatör aynı formu düzenledi (5→4) | Ortalama 4,2, "Son giren: Kurum Koordinatörü" |
| Kayıt başka stajyere atandı | Eski stajyer aynı adresi yazınca **404**, görev listesi boşaldı |
| Stajyer sayfalarının HTML'i | Veli telefonu ve sağlık detayı **hiç geçmiyor**; yalnızca kısa güvenlik uyarısı var |
| Gelecek tarihli oturum | Form kilitli: "Bu atölye henüz yapılmadı" |

Kararlar:

- **Gelecek oturumun formu kilitli.** §10.5 son tarih koymuyor ama oturumlar
  10 hafta boyunca önden üretiliyor; gözlenmemiş davranış puanlanamayacağı
  için form oturum günü açılıyor. Bu yüzden ilerleme sayaçları da yalnızca
  yapılmış oturumları sayar — 3 hafta geçmişse "3/15", "3/50" değil. Gelecek
  haftalar "eksik puanlama" olarak raporlanmaz.
- **Form durumu soru kimliğiyle hesaplanır, sayıyla değil.** Koordinatör bir
  soruyu pasife alıp yerine yenisini eklerse sayı aynı kalır ama form gerçekte
  eksiktir; `puanlamaDurumu()` bunu yakalar ve form "Eksik"e düşer.
- **Cevabı olan satırın snapshot metni asla değişmez.** Soru sonradan
  düzenlenirse form o günkü metni gösterir, güncel metin yanına not olarak
  yazılır. Yeni açılan satırlar bugünkü metni alır. Pasife alınmış sorunun
  geçmiş cevabı formun sonunda korunur ve silinmez.
- **Zorunlu soru listesini sunucu kendisi çıkarır.** Hangi soruların
  cevaplanacağı formdan gelen alanlara değil, sunucunun okuduğu aktif soru
  setine bakılarak belirlenir; aksi halde eksik form gönderip §10.3 atlanabilirdi.
- **Tek eylem, iki rol.** `puanlamaKaydet` hem stajyerin hem koordinatörün
  formunu kaydeder; fark yalnızca yetki kontrolünde (stajyer yalnızca kendi
  kayıtları). İki ayrı form yazılmadı ki iki taraf aynı kuralları ve aynı
  ölçeği görsün.
- **İptal edilmiş kayda puanlama yapılamaz**, girilmiş puanlar korunur ve
  ekranda salt okunur görünür.
- **"Doldurduğum formlar" atama üzerinden süzülür**, puanı kimin girdiği
  üzerinden değil. Kayıt başka stajyere geçtiğinde eski stajyer o öğrenciyi
  hiçbir ekranda göremez (§3.2).

Kod yapısı: kurallar `src/lib/puanlama.ts` (saf, **19 yeni test**), sorgular
`src/lib/puanlama-verisi.ts`, ortak ekran parçaları
`src/components/puanlama-ekranlari.tsx`, sunucu eylemi
`src/app/stajyer/puanlama/actions.ts`. Ortalama hesabı yine tek yerden —
`scoring.ts` — okunuyor, ikinci kopyası yazılmadı.

**Veritabanında bırakılan örnek veri:** Şule Çınar'ın 1. Grup kaydı ve 25
Temmuz gününün 3 formu (Bilim 4,2 · Astronomi 3,0 · Robotik katılmadı) duruyor.
P9'daki rapor motorunu denemek için bilinçli olarak silinmedi.

### P8 — Kulüp yönetimi ✅

**Kulüpler** modülü devrede: kulüp oluşturma sihirbazı, kulüp detayı, kulübe
grup ekleme ve durum geçişleri (§5). Kayıt akışı P6'daki kod yolundan
yürüyor — kulüp için ayrı bir kayıt ekranı yazılmadı.

**Tarayıcıda uçtan uca doğrulandı:**

| Adım | Sonuç |
|---|---|
| "Yaz Bilim Kulübü" · 18 Temmuz 2026 · 3 atölye | Kulüp + 1. Grup + **3 oturum** oluştu |
| 2. grup (öğleden sonra, kontenjan 8) | Aynı gün, 3 oturum daha |
| Şule Çınar → kulüp 1. Grup → Mehmet Kaya | Çakışma uyarısı çıktı (dönem kaydıyla aynı gün/dilim), **onaylanıp devam edildi** |
| Öğrenci profili | Dönem kaydı Ayşe'de, kulüp kaydı Mehmet'te (§8) |
| Mehmet'in görev listesi | Yalnızca kulüp kaydı göründü, dönem kaydı görünmedi |
| Stajyer 3 formu doldurdu | 5,0 · 3,0 · Katılmadı |

#### Şartnamedeki belirsizlik ve verilen karar

§5.1 kulübün tek bir tarihi olduğunu, §5.2 ise her kulüp grubunun "kendi gün
ve zaman dilimiyle" tanımlandığını söylüyor. Kulübün tek tarihi varken grubun
günü serbest seçilemez.

**Karar:** Grubun günü kulüp tarihinden türetilir; formda sorulmaz. Kulüp
grupları birbirinden **zaman dilimiyle** ayrışır (sabah/öğleden sonra).
Seçilen tarihin hangi güne denk geldiği sihirbazda anında yazılır, hafta içi
bir tarih seçilirse gönderim kilitlenir.

#### Düzeltilen hata: uyarıdan sonra kayıt tamamlanamıyordu

Kulüp kaydı çoğu zaman dönem kaydıyla aynı gün ve zaman dilimine denk
geldiği için §7.4 uyarısı bu akışın normal bir parçası. Test sırasında
uyarıdan sonra "Uyarıya rağmen kaydı oluştur" düğmesinin *"Grup seçin"* hatası
verdiği görüldü.

Sebep: React, form eylemi tamamlanınca formu sıfırlıyor ve bu sıfırlama
`<select>` öğelerinin DOM değerini ilk seçeneğe düşürüyor. React'in kendi
durumu bozulmuyordu — ekranda kontenjan bilgisi doğru görünüyordu — ama
ikinci gönderimde alanlar boş gidiyordu. Yani §7.4'ün "koordinatör gerekli
görürse devam edebilir" kuralı pratikte kırıktı.

Çözüm iki adımlı: gönderilen değerler artık gizli alanlardan gidiyor (gizli
alanın sıfırlanması aynı değere döndüğü için zararsız) ve sıfırlamadan sonra
seçim kutuları durumdan geri yazılıyor. Bu, P6'dan kalan ve yalnızca uyarı
yolunda ortaya çıkan bir hataydı; çakışmasız kayıtta hiç görünmüyordu.

Diğer notlar:

- **Grup şeması artık tek yerde** (`src/lib/formlar.ts`). Dönem ve kulüp aynı
  şemayı kullanıyor; kulüp tarafı yalnızca `day` alanını çıkarıyor.
- **Oturum üretimi P4'teki üreticiden**: `kulupOturumlariniUret` — kulüp
  grubuna hafta kavramı taşınmıyor, `termWeekId` boş kalıyor.
- **`gunundenGun()`** tarih yardımcısı eklendi (2 test): bir tarihin cumartesi
  mi pazar mı olduğunu söyler, hafta içi için null döner.

### P9 — Raporlama (kural tabanlı) ✅

**Raporlar** modülü ve §6.4'ün filtreli atölye geçmişi ekranı devrede. Rapor
motoru planlandığı gibi iki katmanlı: analiz (JSON) + metin (şablon).

**Tarayıcıda uçtan uca doğrulandı:**

| Adım | Sonuç |
|---|---|
| Şule Çınar → dönem + kulüp kaydı seçili rapor üretimi | 3 atölye bölümü + genel değerlendirme |
| Bilim Atölyesi (iki kayıttan birleşen 2 oturum) | Ortalama **4,6**, soru bazlı ortalamalar listelendi |
| "Değerlendirilemedi" cevabı | Satır **—** göründü, ortalamaya girmedi, değerlendirilen soru sayısı 9 kaldı |
| Katılmadığı oturumlar | Sayıldı ama ortalamaya girmedi, metinde olumsuz yargı yok |
| Bir puan 4 → 2 yapıldı | Rapor listede anında **"Güncel değil"** |
| Güncel puanlarla yeniden üret | Yeni rapor "Güncel" (4,6 → 4,5); **eski rapor listede kaldı** |
| Metin düzenleme | Kaydedildi, "Elle düzenlendi · Düzenleyen: Kurum Koordinatörü" |
| Geçmiş ekranı `katilim=katilmadi` | Yalnızca 2 katılmadı satırı (biri dönem, biri kulüp) |

Kararlar:

- **Analiz ve metin katmanları ayrı** (`src/lib/report-engine.ts`). Analiz
  puanlardan hangi sonuçların çıkarılabileceğine karar verir ve yapılandırılmış
  veri üretir; metin katmanı yalnızca kendisine verilen bulguları yazar.
  P13'te Claude API bu ikinci katmanın yerine geçecek — analiz, veri modeli,
  arayüz ve PDF hiç değişmeyecek. Rapor gövdesinde `metinKaynagi: "sablon"`
  alanı bu geçişin izini tutuyor.
- **§11.3 kod seviyesinde uygulanıyor.** Bir soru güçlü ya da desteklenecek
  alan sayılmak için **en az iki kez** puanlanmış olmalı — tek düşük puandan
  ağır yargı üretilmez. Üç oturumdan az katılımda metin "ön gözlem
  niteliğindedir" diyerek ihtiyatlı yazılır. `Değerlendirilemedi` cevapları
  hiçbir hesaba katılmaz. Puanlaması olmayan öğrenci için metin uydurulmaz.
- **Metin tekrarı önleniyor** ama rastgelelik kullanılmıyor: cümle kalıpları
  atölye sırasına göre dönüşümlü seçiliyor, böylece aynı veriden her zaman
  aynı rapor çıkıyor (bir test bunu doğruluyor).
- **Türkçe ek uyumu** `tamlayanEkiyle()` ile: "Şule’nin", "Tuana’nın",
  "Bulut’un". Son ünlünün kalınlık/yuvarlaklığına bakılıyor, ünlüyle biten
  adlarda kaynaştırma "n"si giriyor. 2 test.
- **Yeniden üretim yeni satır açar**, mevcut raporu değiştirmez. §13.17 gereği
  eski rapor ve ona bağlı PDF'ler yerinde kalmalı; "hangi PDF hangi rapordan
  çıktı" sorusu her zaman cevaplanabiliyor.
- **Düzenleme yalnızca metni değiştirir**, analiz çıktısı korunur. Böylece
  koordinatör metni elle düzeltse bile raporun hangi puanlardan çıktığı
  kaybolmuyor.
- **Güncellik hâlâ türetiliyor** (§13.16): kapsamdaki kayıtların en yeni
  `Score.updatedAt` değeri tek `groupBy` sorgusuyla okunup `raporGuncelMi()`
  ile karşılaştırılıyor. Saklanan bayrak yok.
- **Geçmiş ekranının filtreleri GET formu** — seçim adres satırında duruyor,
  sonuç paylaşılabiliyor. Filtre seçenekleri yalnızca o öğrencinin gerçekten
  ilişkili olduğu program ve atölyelerden oluşuyor.

Rapor motorunun 13 testi var; toplam **91 test** geçiyor.

### P10 — PDF ve rapor geçmişi ✅

Rapor PDF olarak dışa aktarılıyor; üretilen her PDF öğrencinin rapor
geçmişinde kalıcı olarak duruyor.

**Doğrulandı:**

| Kontrol | Sonuç |
|---|---|
| Türkçe karakterler (gözle) | `Şule Çınar — Öğrenci Raporu`, `Değerlendirilen soru`, `Şule’nin` — hepsi doğru |
| Gömülü font | `WGHZXQ+NotoSans-Regular` ve `KRTFYO+NotoSans-Bold` alt kümeleri PDF içinde |
| Belge künyesi | Başlık ve yazar UTF-16 olarak doğru (`Ş` = U+015E) |
| PDF üretildikten sonra rapor metni değiştirildi | PDF yeniden indirildi, **bayt bayt aynı** (24.966) — içerik değişmedi |
| İkinci PDF üretimi | İki PDF de listede; eskisi silinmedi (§13.17) |
| Oturumsuz erişim | `403` — belge yalnızca koordinatöre açık |

Kararlar:

- **PDF ikili verisi saklanmıyor.** `ReportPdf.snapshotJson` üretim anındaki
  rapor gövdesinin tam kopyasını tutuyor ve belge her indirmede bu kopyadan
  yeniden çiziliyor. Sonuç §13.17 ile birebir aynı: rapor sonradan
  düzenlense bile eski PDF'in içeriği değişmiyor. Kazanç, dosya deposuna
  bağımlılığın kalkması — sistem yerelde ve üretimde aynı şekilde çalışıyor.
  P12'de nesne deposuna geçilmek istenirse yalnızca `fileUrl` değişir.
- **Font depoya dahil edildi.** `public/fonts/NotoSans-{Regular,Bold}.ttf`
  (SIL Open Font License). `@react-pdf/renderer` yalnızca standart PDF
  fontlarıyla geliyor ve bunlarda `ş, ğ, ı, İ` glifleri yok — gömülü font
  olmadan bu harfler PDF'ten düşerdi. Font çalışma anında indirilmiyor;
  yayın ortamında ağ erişimine bağımlılık istenmedi.
- **İndirme rotası Server Action değil**, `/api/rapor-pdf/[id]`. Bu yüzden
  yetki kontrolü rotanın içinde elle yapılıyor; koordinatör olmayan istek
  403 alıyor.
- **Dosya adı normalize ediliyor** (`sule-cinar-rapor-2026-07-28.pdf`) —
  bazı tarayıcı ve işletim sistemleri indirilen dosya adındaki Türkçe
  karakterleri bozuyor.
- **Türkçe kelimeler tirelenmiyor**: `Font.registerHyphenationCallback` ile
  satır sonu bölmesi kapatıldı.

**Bilinen sınır:** Görsel doğrulama PDF'in ilk sayfası üzerinden yapıldı
(macOS `qlmanage` yalnızca ilk sayfayı üretiyor). İkinci sayfanın varlığı ve
sayfa numarası altbilgisi belge yapısından doğrulandı, göz kontrolü
yapılmadı.

### P11 — Dashboard ve arşiv ✅

Koordinatör dashboardu (§12.1) ve **Arşiv** modülü devrede; 13 modülün
tamamı artık açık. Menüde tıklanamayan madde kalmadı.

**Kabul ölçütü — her kart tıklandı, açılan listeyle karşılaştırıldı:**

| Kart | Sayı | Açılan liste | Sonuç |
|---|---|---|---|
| Aktif dönem | 1 | `donemler?kapsam=aktif` | 1 dönem |
| Aktif kulüp | 1 | `kulupler?kapsam=aktif` | 1 kulüp |
| Aktif grup | 4 | `gruplar?kapsam=aktif` | 4 grup |
| Aktif öğrenci | 1 | `ogrenciler?kapsam=aktif` | 1 öğrenci (2 kaydı var, bir kez sayıldı) |
| Kontenjanı dolan grup | 0 | `gruplar?...&durum=dolu` | boş |
| Eksik puanlama | 12 (1 kayıtta) | `puanlamalar?suzgec=eksik` | 1 kayıt · 12 form |
| Güncelliğini yitiren rapor | 1 | `raporlar?suzgec=eski` | 1 rapor |
| Toplam rapor | 2 | `raporlar?suzgec=tumu` | 2 rapor |

**Arşiv uçtan uca doğrulandı** (kulüp ve dönem ayrı ayrı arşivlenip geri
alındı, veri başlangıç durumuna döndürüldü):

| Adım | Sonuç |
|---|---|
| Kulüp "Arşivlendi" yapıldı | Kulüpler listesinden çıktı, arşivde göründü |
| Dashboard | Aktif kulüp 1→0, aktif grup 4→2 (kulübün 2 grubu) |
| Yeni kayıt formu | Arşivlenmiş kulüp seçeneklerde yok |
| Öğrenci profili | Kulüp kaydı, puanlamalar, raporlar ve PDF'ler yerinde |
| İkisi de arşivlendi | Bütün kartlar 0; "Tümü" süzgeciyle 12 eksik form hâlâ erişilebilir |
| Durum geri alındı | Sayılar başlangıçtaki 1 / 1 / 4 / 1 değerlerine döndü |

Kararlar:

- **Sayı ile listenin aynı koşuldan çıkması sözle değil kodla garanti
  ediliyor.** `AKTIF_DONEM_KOSULU`, `AKTIF_GRUP_KOSULU`, `AKTIF_OGRENCI_KOSULU`
  gibi Prisma koşulları `lib/durumlar.ts` içinde tek yerde duruyor; hem kart
  hem liste aynı nesneyi okuyor. Koşulu iki yere ayrı yazmak kısa vadede
  çalışırdı ama biri değişince sessizce ayrışırdı. Öğrenci profilindeki
  "aktif kayıt" ayrımı da bu kaynağa bağlandı — orada elle yazılmış ikinci
  bir tanım vardı.
- **Her kart süzgeçli adrese gidiyor** (`?kapsam=aktif`, `?durum=dolu`,
  `?suzgec=eski`). Bunun için Dönemler, Kulüpler, Gruplar, Öğrenciler ve
  Raporlar ekranlarına GET süzgeçleri eklendi; seçim adres satırında duruyor,
  sonuç paylaşılabiliyor. Puanlamalar ekranındaki süzgeç bileşeni
  `components/suzgec.tsx` dosyasına çıkarılıp beşi tarafından paylaşıldı.
- **Arşiv, aktif listelerin tam tümleyeni.** Arşiv yalnızca "Arşivlendi"
  durumundakileri gösteriyor, Dönemler ve Kulüpler listeleri de tam olarak
  bunların dışını. Böylece her program tam olarak bir listede görünüyor;
  "hangisi nerede" sorusu ortaya çıkmıyor. Tamamlanmış ama arşivlenmemiş
  program aktif listede kalır — arşive taşımak koordinatörün kararı.
- **Arşivlemek silmek değil.** Kayıt, puanlama, rapor ve PDF'ler yerinde
  kalıyor, program sayfası açılmaya devam ediyor. Değişen tek şey yeni kayıt
  alınamaması (kayıt zaten yalnızca "Kayıt alıyor" durumundaki programa
  açılıyordu) ve günlük listeleri meşgul etmemesi.
- **Arşivlenen programın eksik formları dashboardu meşgul etmiyor.** Kayıt
  aktif olsa bile programı arşivlendiyse "Eksik puanlama" sayılmıyor; aksi
  hâlde dashboard aynı ekranda "aktif dönem 0" derken o dönemin 12 formunu
  sayıyordu. Formlar kaybolmuyor, Puanlamalar ekranının "İptal ve arşiv
  dahil" kapsamında duruyor.
- **Kesilen liste açıkça söyleniyor.** Öğrenci listesi 200, rapor listesi 200
  satırla sınırlı; sınıra dayanınca ekranda yazıyor. Kart gerçek sayıyı
  gösterdiği için sessiz kesme kartla çelişki gibi görünürdü.
- **Öğrenci profilinde iki durum ayrıldı.** Rozetler artık "Kayıt: Aktif" ve
  "Program: Arşivlendi" diye ayrı yazıyor; önceden "Geçmiş kayıtlar" başlığı
  altında yalnız başına duran "Aktif" rozeti çelişkili görünüyordu.

**Doğrulama notu:** Tarayıcı konsolunda görülen derleme hataları iki düzenleme
arasındaki yarım dosya durumundan kalmıştı; Turbopack günlüğü temizlenmediği
için sonraki sayfalarda da görünmeye devam etti. Güncel kaynak `npm run build`
ile uçtan uca temiz derleniyor — konsol geçmişi tek başına kanıt sayılmamalı.

---

## Arayüz teması (kurumsal renkler)

Panel Tailwind'in varsayılan mavisiyle ve her yeri beyaz duruyordu. Renkler
kurumun kendi sitesinden alındı — **tuzder.org** CSS'inde ana renk
`--e-global-color-primary: #A3185B` olarak tanımlı; turuncu **#E94D1A** sitede
çağrı düğmelerinde geçiyor. İkisi de `globals.css` içinde ölçekli olarak
tanımlandı (`marka-*`, `vurgu-*`), logodaki yeşil ve turkuaz da ileride
kullanılmak üzere duruyor.

| Renk | Kod | Nerede |
|---|---|---|
| Mürdüm (ana) | `#A3185B` | Sol menü, giriş ekranı, birincil buton, bağlantı, aktif süzgeç |
| Turuncu (vurgu) | `#E94D1A` | "İşlem bekliyor" sayıları, ilerleme çubukları, uyarı rozetleri |
| Yüzey | `#F6F0F3` | Sayfa zemini — kartlar beyaz kaldığı için derinlik bu farktan geliyor |

Kararlar:

- **Renk kabukta yoğun, içerikte seyrek.** Sol menü ve giriş ekranı tam
  mürdüm; çalışma alanı açık kalıyor. Puanlama formları ve rapor metinleri
  uzun süre okunuyor, zemini koyulaştırmak okumayı yorardı.
- **Kontrast ölçüldü.** Beyaz üstünde küçük metinde yalnızca `marka-600`
  (7,4:1) ve `vurgu-700` (5,2:1) kullanılıyor. Turuncu `vurgu-600` beyaz
  üstünde 3,8:1'de kaldığı için metin değil, yalnızca dolgu ve şerit olarak
  geçiyor.
- **Sağlık uyarısı bilerek palete alınmadı.** Panelde turuncu artık "işlem
  bekliyor" demek. Çocuğun alerjisini bildiren kutu sarı bırakıldı; bekleyen
  bir formla aynı renge girseydi gözden kaçabilirdi.
- **Buton sınıfları tekilleştirildi.** Aynı buton görünümü 15 yerde elle
  yazılmıştı ve `<Link>` buton bileşeni kabul etmediği için renk değişince
  bazıları geride kalıyordu. `butonStili()` yardımcısı eklendi.
- **Mobilde menü eklendi.** Sol menü `md` altında gizliydi ve yerine bir şey
  konmamıştı — dar ekranda panelde hiç gezinme yoktu. Menü artık üst şeride
  yatay kayan bir şerit olarak iniyor. Stajyer formlarının telefondan
  doldurulacağı düşünülürse bu bir görünüm değil, kullanılabilirlik eksiğiydi.

Doğrulandı: koordinatör ve stajyer panelleri, giriş ekranı, puanlama formu,
geçmiş tablosu ve mobil görünüm tarayıcıda gözden geçirildi; `npm run build`,
tip kontrolü ve eslint temiz, 91 test geçiyor.

---

## Günlük başlatma

Bilgisayar yeniden başladıktan sonra tek adım yeter:

```bash
npm run baslat
```

Aynı işi `baslat.command` dosyasına Finder'dan çift tıklayarak da yapabilirsiniz.
Betik Docker'ı açar, veritabanını hazır olana kadar bekler, uygulamayı başlatır
ve sunucu cevap verir vermez tarayıcıyı açar. Her adım "zaten çalışıyorsa geç"
mantığında; art arda çalıştırmak zarar vermez. Durdurmak için pencerede `Ctrl+C`.

Sunucu zaten çalışıyorsa betik ona dokunmaz, yalnızca tarayıcıyı açar. Kapatıp
baştan başlatmak için:

```bash
npm run baslat -- --yeniden
```

Bu ayrımın sebebi 3000 portunun çok yaygın olması. Betik portu tutan süreci
körlemesine öldürmüyor; önce sayfanın imzasına bakıp uygulamanın gerçekten bu
proje olduğunu doğruluyor, değilse ne olduğunu yazıp çekiliyor.

**Yazarken çıkan iki tuzak** (ikisi de tarayıcıda değil, betiği çalıştırırken
görüldü):

- `lsof -ti:3000` yalnızca sunucuyu değil, **porta bağlı istemcileri de**
  döndürüyor — listede açık duran tarayıcı da çıkıyordu. Bu listeyi kill etmek
  kullanıcının tarayıcısını kapatırdı. Çözüm: `-sTCP:LISTEN`.
- Sürecin çalışma dizinini proje klasörüyle karşılaştırma denendi ama `lsof`
  yolu kaçış dizisiyle yazıyor (`TÜZDER` → `TU\xcc\x88ZDER`, klasör adındaki
  Türkçe harf yüzünden) ve karşılaştırma hiçbir zaman tutmuyordu. Onun yerine
  sayfanın kendi imzasına bakılıyor.

Dört durum da çalıştırılarak doğrulandı: soğuk başlangıç, sunucu ayaktayken
normal çalıştırma, `--yeniden` ile yeniden başlatma (eski sunucu kapandı,
tarayıcı hayatta kaldı) ve 3000'i başka bir uygulamanın tuttuğu durum
(`--yeniden` ile bile öldürülmedi).

Giriş: `koordinator@tuzder.local` · `ayse@tuzder.local` · `mehmet@tuzder.local`,
üçünün de parolası `Atolye2026!` (yalnızca geliştirme verisi).

---

## P12 — Yayına alma (canlıda)

Uygulama **Vercel**'de, veritabanı **Neon**'da (Frankfurt, havuzlu bağlantı).
Adres: `atolye-yonetim-sistemi.vercel.app` — kurum kendi alan adına
taşınmasını istemediği için bu adres kalıcı.
Kod deposu: github.com/ethemtkl34/atolye-yonetim-sistemi (public).

### Üretimde doğrulanan kabul ölçütleri

| Test | Sonuç |
|---|---|
| Dashboard kartları ↔ veritabanı sayıları | 1 · 1 · 4 · 19 · 1 · 2 birebir |
| §6.2 Türkçe duyarsız arama (9 yazım) | `sule`/`SULE`/`Şule`/`cinar`/`ipek`/`İPEK`/`0532` hepsi doğru |
| §11 rapor üretimi (Server Action) | Ömer Şahin raporu üretildi, güçlü + desteklenecek alanlar çıktı |
| §11.5 PDF | 2 sayfa, `NotoSans` gömülü, Türkçe karakterler gözle doğrulandı |
| §13.16 rapor güncelliği | Puan değiştirildi → rapor anında "Güncel değil"e düştü |
| §3.2 rol izolasyonu | Stajyer `/koordinator` → 307 `/stajyer` |
| §3.2 gizlilik | Stajyerin gördüğü HTML'de veli telefonu ve sağlık detayı yok; yalnızca kısa güvenlik uyarısı var |
| Oturumsuz erişim | `/koordinator` → 307, PDF indirme → 403 |

### Yol boyunca çıkan dört sorun

- **İlk derleme `datasource.url` hatasıyla durdu.** `DATABASE_URL` daha
  girilmemişken deploy tetiklenmişti. Değişkenler girilip yeniden yayına
  alınınca geçti.
- **Vercel'in dağıtım koruması açıktı.** Site, Vercel hesabı olmayan hiç
  kimseye açılmıyordu — yani kurum personeli giremezdi. `ssoProtection`
  API'den kapatıldı.
- **Yerel veritabanı üretime kopyalanınca `User` tablosu da gitti** ve üretim,
  depoda açık yazan `Atolye2026!` parolasını devraldı. Depo public olduğu için
  bu ciddi bir açıktı; dört hesabın parolası rastgele bir değerle yenilendi ve
  eski parolanın artık çalışmadığı doğrulandı.
- **`DROP SCHEMA public` sonrası `search_path` boş kaldı.** Tablolar
  yerindeydi ama nitelendirilmemiş sorgular onları bulamıyordu. Prisma
  şemayı zaten nitelediği için uygulama etkilenmedi; yine de rol düzeyinde
  `search_path` geri yazıldı.

### Kalan işler

- Üretimdeki veri şu an **deneme verisi**. Kurum gerçekten kullanmaya
  başlamadan önce temizlenmeli.
- Koordinatör parolasının arayüzden değiştirilememesi (bkz. YAYINA-ALMA.md
  "Bilinen eksikler")

---

## Bakım — sistem analizi ve düzeltme turu (31 Temmuz 2026)

Bütün kod tabanı mantık hataları için tarandı; bulunan sorunlar düzeltildi ve
arayüz profesyonelleştirildi. `npm run build`, tip kontrolü ve eslint temiz;
**93 test** geçiyor (2 yeni). Öne çıkan düzeltmeler:

**Güvenlik / yetki:**
- Pasife alınan hesap artık ANINDA kilitleniyor: `girisZorunlu()` her istekte
  hesabın var ve aktif olduğunu veritabanından doğruluyor. Önceden 12 saatlik
  oturum belirteci pasif stajyeri mesai sonuna kadar içeride tutuyordu. Pasif
  hesap `/hesap-pasif` sayfasına düşer (proxy döngüsüne girmemek için `/giris`
  değil).
- Stajyer e-postası kayıtta `toLocaleLowerCase("tr-TR")` ile küçültülüyordu,
  girişte ise `toLowerCase()` ile aranıyordu — büyük "I" içeren e-posta
  (`IREM@...`) hiç giriş yapamıyordu. İki taraf eşitlendi.

**Mantık:**
- Pazar günü açılan pazar grubu o haftanın 5 oturumunu kaybediyordu
  (`mevcutHaftaNumarasi` cumartesi çapasıyla karşılaştırıyordu). Hafta artık
  grubun gerçek toplanma gününe göre hesaplanıyor; 2 yeni test.
- Dönem/kulüp durum geçişleri artık kurallı (`DONEM_DURUM_GECISLERI` /
  `KULUP_DURUM_GECISLERI`): "Arşivlendi → Kayıt alıyor" gibi tek hamlelik
  sessiz yeniden açılışlar kapandı; geri alma yolları korunuyor. Durum
  seçicileri yalnızca izinli geçişleri listeler.
- Tamamlanmış/arşivlenmiş programa grup eklenemez (eylem + arayüzde kilitli
  buton ve sebep). "Bu program kayıt almıyor" hatası artık çözüm yolunu da
  söylüyor.
- Rapor motoru atölyeler arası birleşimlerde ortalamaların ortalamasını
  alıyordu; `puanToplami` ile ağırlıklı ortalamaya geçildi (scoring.ts'teki
  genel ortalama kuralıyla aynı ilke).
- Öğrenci geçmiş filtresinde Program + Kayıt türü birlikte seçilince nesne
  literalinde son `group` anahtarı öncekini ezdiği için program filtresi
  sessizce kayboluyordu; koşullar AND altında birleştirildi.
- Stajyer görev listeleri koordinatör dashboard'uyla aynı kapsamı okuyor
  (`yalnizcaAktifProgram`): arşivlenen programın formları iki tarafta da
  görünmez.
- Grup aç/kapa eylemleri (P4'ten beri vardı, hiç çağrılmıyordu) arayüze
  bağlandı: dönem ve kulüp detayındaki grup kartlarında "Kayda kapat / aç".
- Rapor `generatedAt` damgası puanlar okunmadan önce alınıyor; PDF satırı tek
  transaction'da yazılıyor (adressiz kalıcı satır kalamaz); arşiv sayaçları
  yalnızca AKTIF kayıtları sayıyor; dashboard "Toplam rapor" 200 satırlık
  liste sınırından bağımsız gerçek `count()`.
- Geçersiz doğum tarihi (31 Şubat) artık alan hatası veriyor; önceden form
  "başarılı" görünüp tarihi sessizce boş yazıyordu.

**Formlar (React 19 sıfırlama sorunu):**
- Doğrulama hatasında formların içi boşalıyordu (React 19, eylem bitince
  kontrolsüz alanları sıfırlıyor). Eylemler artık girilen değerleri
  `degerler` olarak geri döndürüyor, formlar bunları `defaultValue` yapıyor —
  öğrenci formu (16 alan), sihirbazlar, grup ekleme, atölye ve stajyer
  formları, giriş ekranındaki e-posta.
- Dönem sihirbazında liste başlangıcı değişince pencere dışında kalan hafta
  seçimleri temizleniyor; önceden görünmez seçimler "10/10" sayacını doldurup
  formu kilitliyordu.
- Rapor metni düzenleyici ve atölye düzenleme formu başarıda kapanıp bildirim
  gösteriyor; önceden başarı mesajı hiç görünmüyordu.

**Gezinme / tutarlılık:**
- Raporlar sayfasına "Yeni rapor" düğmesi; `/koordinator/raporlar/yeni`
  öğrenci seçilmeden gelindiğinde kayıtlı öğrencileri listeliyor (çıkmaz
  kalktı).
- Hesabım sayfası panel kabuğunun içinde (menüsüz ara sayfa değil).
- Stajyerin gün formu, Görevlerim'den gelindiyse Görevlerim'e dönüyor
  (`?geri=gorevler`).
- Gruplar "Tümü" görünümü arşivlenmiş programların gruplarını göstermiyor
  (Dönemler/Kulüpler ile aynı sözleşme) ve gruplar program + ada göre
  sıralanıyor ("2. Grup" artık "1. Grup"un üstünde çıkmıyor).
- Oturum düşünce `devam` parametresi sorgu dizesini de taşıyor; süzgeçli
  ekrana dönülüyor.
- Atamalar ekranı aktif stajyer yokken listeyi gizlemiyor; satırlar salt
  okunur kalıyor.

**Tasarım:**
- Yan menü bölümlere ayrıldı (Programlar / Atölyeler / Kişiler /
  Değerlendirme) ve her maddeye çizgi ikon eklendi; 13 maddelik düz yığın
  taranabilir hale geldi.
- Menü ve üst şerit yapışkan; üst şeritte ad-soyad baş harfli avatar.
- İçerik alanı `max-w-6xl` ile ortalanıyor; sayfa başlıkları büyütüldü,
  butonlara odak halkası eklendi. "10. hafta" satır kırılması giderildi;
  dönem detayındaki mükerrer durum rozeti kaldırıldı.

---

## Revize — dönem stajyer kadrosu ve dönem kartları (1 Ağustos 2026)

**Dönem stajyer kadrosu.** Her dönemin kendi stajyerleri var: yeni `TermIntern`
tablosu (dönem ↔ stajyer, migration `20260801104033_donem_stajyerleri`).
Kayıt bazlı sorumluluk (`Enrollment.internId`) değişmedi; kadro yalnızca bu
dönemin kayıtlarında KİMİN seçilebileceğini sınırlar.

- **Kadro boşsa kısıt yok.** Eski dönemler ve kadro tanımlamak istemeyen
  kullanıcılar için bütün aktif stajyerler seçilebilir kalıyor; özellik
  kimseyi zorlamıyor.
- Kadro dönem sihirbazında (isteğe bağlı adım) ve dönem detayındaki
  "Stajyer kadrosu" kartından yönetiliyor.
- Kayıt formu, Atamalar satırları ve `kayitStajyerDegistir`/`kayitOlustur`
  eylemleri kadroyu hem arayüzde süzüyor hem sunucuda doğruluyor (arayüz
  süzgeci tek başına güvence değil).
- **Bu dönemde aktif kaydı olan stajyer kadrodan çıkarılamaz** — çıkarılsaydı
  kayıtlar "görevli olmayan" stajyerin üzerinde kalırdı. Kutu kilitli ve
  sebep üzerine gelince yazıyor; eylem de aynı kuralı uyguluyor.
- Kadroda dururken pasife alınan hesap kadroda TUTULABİLİR (Pasif rozetiyle
  görünür) ama kadroya yeni pasif hesap eklenemez.
- Kadro kartında React 19 form sıfırlama tuzağı yine çıktı (eylem bitince
  kutular görsel olarak boşalıyordu); kayıt formundaki çözümle aynı şekilde
  DOM eylem sonrası durumdan geri yazılıyor.

**Dönemler listesi kartları yenilendi.** Kartın tamamı tıklanabilir tek hedef;
içinde durum rozeti, tarih aralığı, hafta ilerleme çubuğu ("3/10 hafta
işlendi"), grup · öğrenci · atölye sayıları ve kadro rozetleri var. Liste
geniş ekranda iki sütun.

Doğrulama: tip kontrolü ve eslint temiz, 93 test geçiyor; kadro kaydetme,
kayıt formu süzmesi, Atamalar satır süzmesi (dönem satırı 2 seçenek, kulüp
satırı 3) ve sihirbaz adımı tarayıcıda uçtan uca denendi.

> **Yayına alma notu:** Bu iş migration içeriyor. `vercel-build` zaten
> `prisma migrate deploy && next build` çalıştırdığı için push sonrası Vercel
> derlemesi tabloyu Neon'a kendisi ekler; migration yalnızca tablo eklediği
> için mevcut koda da zararsız.

---

## Revize — gerçek karne soruları ve gelişim testi (8 Ağustos 2026)

Kurumun gerçekte kullandığı karne (C-1 Yaz Grubu 2025-2026 Excel'i) sisteme
iki parça hâlinde aktarıldı:

**1. Atölye soruları kategorili gerçek setlerle değiştirildi.**
`Question` modeline `category` (konu başlığı: "Dersin İlgi ve Merak
Alanları" / "Dersin Yetenek Gelişim Alanları") ve `title` (kısa başlık, örn.
"Duygu Düzenleme") eklendi; `ScoreAnswer` bu ikisinin snapshot'ını da taşıyor
(§13.14 ilkesinin genişletilmiş hâli). `soru_kategorileri` migration'ı 11
atölyeyi ada göre desenle eşleştirir (yoksa oluşturur: STEM Maker, Masal ve
Hikâye, Düşünme Becerileri, Gastronomi, Ahşap Modelleme yeni geldi), cevaplı
eski soruları pasife alır, cevapsızları siler, 110 gerçek soruyu sabit
kimliklerle yükler. Rapor düzyazısı artık soru cümlesi ("… gösteriyor mu?")
yerine kısa başlığı gömer; atölyeler arası bulgu havuzu da başlıkla
birleştirilir. Seed'deki `BASLANGIC_SORULARI` kaldırıldı — sorular artık
migration'dan gelir.

**2. Gelişim testi eklendi (yeni modül).** "Sosyal Duygusal Bilişsel
Beceriler" testi: stajyer, atanmış her dönem öğrencisi için 18 soruyu
(duygusal 7 / sosyal 5 / bilişsel 6) dönem ortasında ve dönem sonunda bir kez
doldurur. `DevelopmentAssessment` tablosu kayıt × dönem-noktası başına tek
satır tutar; cevaplar `answersJson` içinde soru metni snapshot'ıyla saklanır
(`ParentMeeting` deseni). Sorular kodda sabit
(`lib/gelisim-degerlendirmesi.ts`). Dönem ortası penceresi orta haftanın,
dönem sonu son haftanın gününde açılır; kapanış yok. Stajyer menüsüne
"Gelişim testleri" eklendi; koordinatör öğrenci profilindeki bölümden aynı
formu `puanlamalar TAM` yetkisiyle doldurup düzeltebilir.

**Bilinçli kapsam dışı:** Gelişim testi sonuçları henüz öğrenci raporuna ve
veli brifine BESLENMİYOR; rapor motoru yalnızca atölye puanlarını okumaya
devam ediyor. İstenirse ayrı bir iş olarak eklenecek.

---

## Revize — soru kategorisi zorunlu (11 Ağustos 2026)

Kurum kuralı: her değerlendirme sorusu bir kategoriye ait olmak zorunda ve
kategoriler sabit — **"İlgi ve Merak Alanları"** ve **"Yetenek Gelişim
Alanları"** ("Dersin" öneki kaldırıldı). Kategori formda artık serbest metin
değil zorunlu seçim kutusu; liste `lib/kurallar.ts` içindeki
`SORU_KATEGORILERI` sabitinde, Zod `z.enum` ve veritabanı CHECK kısıtı
(`Question_category_gecerli`) aynı listeyi zorluyor. Yeni kategori eklemek
ikisini birlikte güncellemeyi gerektirir.

- **Snapshot'lar da yeniden adlandırıldı** (migration
  `soru_kategorisi_zorunlu`): rapor kademeleri (ilgi/başarı) kategori adına
  göre gruplandığı için eski ad snapshot'ta kalsaydı aynı kategori raporda
  ikiye bölünürdü. §13.14 soru metnini dondurur; bu bir içerik değişikliği
  değil, aynı kategorinin adının değişmesi. `updatedAt` bilerek
  dokunulmadı ki raporlar "Güncel değil"e düşmesin.
- **Kategorisiz 50 pasif eski soru** ilk karnenin blok düzenine göre
  dolduruldu (sıra 0–3 ilgi, 4–9 yetenek). Kategorisiz dönemde doldurulmuş
  formların cevaplarındaki boş `categorySnapshot` bilerek boş bırakıldı;
  geriye dönük doldurmak geçmiş raporların sayılarını değiştirirdi.
- Canlıda doğrulandı (Neon, salt-okunur): 160 sorunun tamamı kategorili
  (110 aktif + 50 pasif), kısıt yerinde, 14.580 cevap snapshot'ı yeni
  adlarda, 2.780 eski cevap boş kaldı.

Aynı gün ikinci karar: **pasif soruların tamamı silindi ve "Değerlendirme
soruları" ekranı kaldırıldı** (sorular atölye detayından yönetiliyor; menü
maddesi ve `sorular` modülü yetki matrisinden çıktı). Silme geçmişi bozmaz:
`ScoreAnswer.questionId` `onDelete: SetNull` ile boşa düşer, geçmiş formlar
§13.14 snapshot'larından görüntülenir. Canlıda doğrulandı: pasif soru 0,
110 aktif soru duruyor, 17.360 cevabın tamamı yerinde (2.780'i bağı kopmuş
ama snapshot'lı). Bilinçli yan etki: bağı kopan eski cevaplar kategori
bilgisini soru satırından okuyordu; artık 8 Ağustos öncesindeki gibi
ilgi/başarı kademe ortalamalarının dışındalar.

## Örnek veri

```bash
npm run db:ornek-veri
```

`prisma/ornek-veri.ts` — denemek için gerçekçi bir dönem üretir: 18 öğrenci,
22 kayıt, 171 puanlama formu, 1670 cevap satırı, 3 stajyer. Başlangıç
verisinden (`db:seed`) ayrı tutuldu: seed kurumun kurulumda gerçekten
ihtiyaç duyduğu asgari veridir ve üretime de gider, bu dosya yalnızca
denemeye yarar.

Tekrar çalıştırılabilir: ürettiği öğrencileri adlarıyla tanıyıp siler ve
yeniden yazar, elle eklenenlere dokunmaz.

**Puanlar rastgele değil.** Her öğrencinin bir profili var ve puanlar bundan
türetiliyor. İki sebebi var: rapor motorunun kuralları ancak belirli
profillerle sınanabiliyor, ve tohumlu üretici kullanıldığı için betik her
çalıştığında aynı veriyi üretiyor.

| Öğrenci | Profil | Ne sınıyor |
|---|---|---|
| Ömer Şahin · Ayaz Demirtaş | Karma | Güçlü **ve** desteklenecek alanların ikisi birden çıkar |
| Nehir Balcı | Az veri | §11.3 — "ön gözlem niteliğindedir" ibaresi |
| Ada Türkmen | Gözlemlenemeyen | "Değerlendirilemedi" → raporda `—`, değerlendirilen soru 10 değil 9 |
| Mert Yalçın | Devamsız | Katılmadığı oturum sayılır, ortalamaya girmez |
| Yiğit Erdem | Eksik formlu | Dashboard "eksik puanlama" sayacı |
| Bulut · Duru · Alp · İnci | Puanlanmamış | Pazar grubu 4. haftada başlıyor; gelecek oturumlar eksik sayılmaz |
| Deniz · Masal · Çınar | Güçlü | Yüksek ortalama, güçlü yönler bölümü |
| Elif Naz · Poyraz | Gelişmekte | Düşük ortalama, olumsuz yargıya kaymamalı |

Veri üretirken düzeltilen üç şey — üçü de ancak üretilen rapor okununca
görüldü, sayılar tek başına doğru görünüyordu:

- **Dalgalanma payı dardı.** İlk sürümde bir öğrencinin 10 sorusunun 5
  atölyedeki bütün puanları 4,0 çıkıyordu. Puanlar yuvarlandığı için sapma
  payının en az ±0,8 olması gerekiyor; yoksa taban değerin kendisine
  çakılıyor. Hiçbir stajyer böyle puanlamaz.
- **"Değerlendirilemedi" raporda görünmüyordu.** Serpiştirilmiş boş cevaplar
  yetmiyor: aynı soru başka bir oturumda puanlanınca ortalama yine çıkıyor.
  `—` satırının görülebilmesi için sorunun o atölyedeki bütün oturumlarda
  boş kalması gerekiyor.
- **Devamsızlıklar üst üste binmişti.** Oturum sırası `gün × 5 + atölye`
  olduğu için seçilen indeksler aynı atölyeye denk geldi ve öğrenci bütün
  Robotik oturumlarını kaçırmış göründü. Farklı gün ve atölyelere yayıldı.

**Rapor metni hakkında:** Şablon katmanı soru cümlelerini olduğu gibi metne
gömüyor ("…atölye ve etkinliklere ilgi gösterir konularında güçlü…"). Anlam
doğru ama dil kurumsal bir rapor için hantal. Bu, P13'te Claude API metin
katmanıyla değiştirilecek olan katman; analiz, veri modeli ve PDF aynı kalacak.

---

## Geçmiş veri aktarımı (Ağustos 2026)

Panel açılmadan önce yaşanmış dönemler kütükten (Excel) ve PDF rapor
arşivinden sisteme aktarıldı. Amaç yalnızca geçmişi takip etmek: öğrencinin
profilinde hangi dönemde hangi sınıfta olduğu ve o dönemin raporu görünsün.

| | |
|---|---|
| Öğrenci | 431 |
| Kayıt | 599 |
| Arşiv raporu (PDF) | 351 · 133 MB |
| Dönem | Kış 1. Kur, Bahar 2. Kur, 2025 Yaz, 2026 Yaz |
| Kulüp | Drama 2026, Robotik Kodlama 2026 |
| Şube | Ümraniye |

Betikler `scripts/gecmis-veri/` altında; kullanımı oradaki `README.md`'de.
Kararların gerekçesi `docs/DECISIONS.md` → "Geçmiş veri aktarımı".

**Bu dönemler rapor üretemez.** `Term.gecmisVerisi` / `Club.gecmisVerisi`
bayrağı rapor kapsam listesini, rapor üretme eylemini, puanlama ve gelişim
testi listelerini birden kapatır — o dönemlerin puanlaması ve müfredatı hiç
girilmedi.

**Kütükte eksik kalanlar** (aktarım sırasında tespit edildi, denetim raporunda
tek tek listeli):

- 248 kaydın raporu bulunamadı. Büyük kısmı 2025 Yaz (85) — o yaz için hiç PDF
  yok. Liste: `scripts/gecmis-veri/cikti/raporsuz-ogrenciler.xlsx`.
- 4 öğrenci kütükte hiç yoktu, yalnız PDF kapağından oluşturuldu (velisiz):
  EMİR OĞUZ YÜCE, SERDEM DİNÇER, MİLAN BAŞKUT, FERİHA YILMAZ.
- 7 kayıt kütükte yoktu, öğrencinin o döneme ait raporundan türetildi.
- 9 telefon numarası bozuk olduğu için boş bırakıldı (`X`, `pu`, eksik hane).
- 8 PDF'te ad Excel'den farklı yazılmış; elle doğrulanmış eşleme tablosuyla
  bağlandı (`AD_ESLEMESI`).

**Açık soru — şube.** Bütün veri Ümraniye'ye yazıldı (351 PDF kapağının
hepsinde "ÜMRANİYE - DAHİ PARK" yazıyor). Ama Excel ana sayfasında satır
229'dan sonra "1.Kur - Ümraniye" etiketli ayrı bir blok var ve üst blok tek
başına Bahar için 211 kayıt üretiyor — elde tam 211 Bahar raporu var. Alt blok
eklendiğinde Bahar mevcudu 305'e çıkıyor ve 94 kayıt raporsuz kalıyor. İki
bloğun iki ayrı şube olması muhtemel. Karar değişirse
`hazirla.py` → `ALT_BLOK_SUBE = "gunesli"` yapılıp `geri-al` + `aktar`
yeniden koşulur.

---

## P18 — Aday (CRM) modülü

Kayda dönüşmemiş ilgi (lead) süreci dış CRM'den (Workiom/Bitrix) panele
taşındı. Kaynaklar: Meta reklam formları (entegratör üzerinden), tuzder.org
formu, telefonla arayan ve şubeye gelen veliler. Tanımın tamamı
`docs/PROJECT_SPEC.md` §16, kararlar `docs/DECISIONS.md`, dış kurulum
`docs/CRM-ENTEGRASYON.md`.

### Ne yapıldı

| Parça | Yer |
|---|---|
| Şema: `Lead`, `LeadActivity` + 5 enum + 7 CHECK | `prisma/schema.prisma`, iki migration (enum'lar ayrı dosyada) |
| Boru hattı ve paylaşılan sorgu koşulları | `src/lib/aday-durumlari.ts` (+ test) |
| Mükerrer kararı (saf, testli) | `src/lib/aday/mukerrer.ts` (+ test) |
| Ortak yazım kapısı | `src/lib/aday/aday-kaydi.ts` |
| Dış giriş ucu | `src/app/api/crm/aday/route.ts`, şema `dis-basvuru-semasi.ts` (+ test) |
| Liste / ayrıntı / rapor ekranları | `src/app/koordinator/adaylar/` |
| Aşama düğmeleri, zaman çizelgesi, iletişim düğmeleri | `src/components/aday-*.tsx`, `iletisim-eylemleri.tsx` |
| Dönüşüm (aday → öğrenci) | `src/lib/aday/donusum.ts` + `ogrenciEkle` genişletmesi |
| Dashboard kartları | `dashboard-verisi.ts`, `koordinator/page.tsx` |
| Yetki / menü / tarayıcı kaydı | `yetkiler.ts`, `navigasyon.ts`, `sube-sizinti.ts`, `yan-menu.tsx` |

### Kararlar (ayrıntı DECISIONS.md'de)

- Meta'ya doğrudan webhook yerine **entegratör** (Pabbly/Make): App Review,
  imza doğrulama ve jeton yenileme yükü kuruma gelmiyor.
- **Yeni rol açılmadı**; modülün asıl kullanıcısı mevcut `DANISMA_GOREVLISI`.
- **"Ulaşılamadı" aşama değil sayaç**; `KAZANILDI` terminal, `KAYBEDILDI`
  geri açılabilir.
- Aşama **açık düğmelerle** değişiyor (`DurumSecici` değil).
- Şube kodu çözülemeyen başvuru **düşürülmez**, işaretli olarak varsayılan
  şubeye yazılır.

### Dağıtımdan sonra yapılacaklar (kod dışı)

1. Vercel'e `LEAD_API_TOKEN` eklenip **Sensitive** işaretlenmeli, redeploy.
2. Entegratör senaryosu kurulmalı (Meta Lead Ads → HTTP POST), alan eşlemesi
   `docs/CRM-ENTEGRASYON.md` §3'teki tabloya göre.
3. tuzder.org form işleyicisine sunucudan sunucuya POST eklenmeli; KVKK onay
   kutusu ve bal küpü alanı zorunlu.
4. KVKK: dönüşmeyen adaylar için saklama süresi kurum kararı bekliyor;
   entegratör de kişisel veri işleyen bir hizmet olarak aydınlatma metnine
   eklenmeli.

---

## P19 — Bakım turu (4 Eylül 2026)

Yeni özellik yok; sistem taraması sonrası kapatılan borçlar.

### Next.js 16.2.12 → 16.3.4

`npm audit --omit=dev` 9 yüksek uyarı veriyordu; bunların çoğu Next'in
içindeki `sharp`/`libvips` zincirinden geliyordu ve YAYINA-ALMA.md'deki
"düzeltme Next'i 9.3.3'e düşürür" notu eskimişti. Yükseltme + kırıcı olmayan
`npm audit fix` (yalnızca `fast-uri` ve `nanoid`) uyarıyı **9 → 4**'e indirdi.
Kalan 4'ü `prisma` CLI'nın `mysql2`/`deepmerge-ts` bağımlılıkları; düzeltmesi
Prisma'yı 6'ya düşürdüğü için uygulanmadı ve bu uygulamada MySQL yolu hiç
çalışmıyor. Yükseltme sonrası tsc, 447 test ve `next build` temiz.

### Veri katmanına ilk testler (376 → 446 test)

Saf iş mantığı iyi test edilmişti, sorgu ve arayüz katmanı hiç test edilmemişti.
Testi yazılabilir olan altı dosya kapatıldı:

| Dosya | Neyi koruyor |
|---|---|
| `navigasyon.test.ts` | Menü maddesi yalnızca yetkisi olan role görünüyor; matrise modül eklenip menü unutulursa kırılır |
| `durumlar.test.ts` | Şube süzgecinin iç içe grup koşuluna da indiği; durum geçişlerinin kapalı programı tek hamlede açmadığı |
| `ogrenci-arama.test.ts` | Öğrencinin TEK giriş kapısında şube süzgeci — `sube-sizinti` tarayıcısının "şube-muaf" yazıp göremediği yer |
| `formlar.test.ts` | Doğrulama hatasında kullanıcının yazdıklarının kaybolmaması |
| `kayit-iptal.test.ts` | Ayrılma cümlesinin üç hâli; telafi fazlasında "-2 atölye" yazılmaması |
| `beceri-etiketleri.test.ts` | Anahtar kelime sırası (dar kelime geniş kelimeyi yener) ve Türkçe büyük İ |
| `kayit-secenekleri.test.ts` | Kontenjan/zaman metni; kontenjan üstü kaydın da dolu sayılması |

İki küçük değişiklik gerekti:

- `ogrenci-arama.ts`: `where` koşulu `ogrenciAramaKosulu()` adında saf bir
  fonksiyona ayrıldı. Davranış aynı; amacı koşulun testten okunabilmesi.
- `vitest.config.ts`: sahte `DATABASE_URL`/`AUTH_SECRET`. `lib/env.ts` modül
  yüklenirken doğruluyor ve `lib/db.ts` içeren dosyalar bu yüzden testten hiç
  import edilemiyordu. Değerler bilerek bağlanamaz.

**Testi yazılamayan dosyalar** (hepsi doğrudan Prisma sorgusu; birim testi
için veritabanı gerekir): `dashboard-verisi`, `rapor-verisi`,
`rapor-govdesi-verisi`, `puanlama-verisi`, `gelisim-verisi`,
`veli-gorusmesi-verisi`, `yetki-kapisi`, `parola`, `takvim-kilidi`. Şube
sızıntısı tarafından bunları `sube-sizinti` tarayıcısı zaten koruyor.

### Alan adı kararı

`panel.tuzder.org` planından **vazgeçildi**; sistem
`atolye-yonetim-sistemi.vercel.app` adresinde kalıyor. Cloudflare DNS kaydı
hiç yazılmadı, `AUTH_URL` zaten vercel.app adresini gösteriyor. Adres geçen
bütün belgeler güncellendi.

### Bilerek dokunulmayanlar

Sistem taramasında çıkan ama kullanıcı kararıyla **açık bırakılan** maddeler:

- `LEAD_API_TOKEN` Vercel'de yok → `POST /api/crm/aday` canlıda 503 döner
  (aday dış giriş ucu kapalı).
- 7 adet `@tuzder.local` tohum/demo hesabı canlıda aktif.
- Sonbahar döneminde programda olmayan 6 atölyeye ait 60 müfredat girdisi.
- 4 ayrı ADMIN hesabı; 12 kullanıcı henüz parola değiştirmemiş.
- Hata izleme aracı (Sentry vb.) yok.

---

## P20 — Randevu yönetimi, Faz 1 (tanımlar)

Kurumun ikinci iş kolu (zekâ testleri + bireysel danışmanlık) panele giriyor.
Tanımın tamamı `docs/PROJECT_SPEC.md` §17, kararlar `docs/DECISIONS.md`.
Bu faz takvimi DEĞİL, takvimin ön koşullarını getiriyor.

### Ne yapıldı

| Parça | Yer |
|---|---|
| Veli birinci sınıf kayıt; `Guardian` bağ tablosuna indi | `prisma/schema.prisma`, `migrations/20260904120000_veli_birinci_sinif` |
| Veli yazma/eşleştirme katmanı | `src/lib/veli.ts` |
| Hizmet kataloğu, uzman, yetkinlik, mesai, izin | `migrations/20260904120100_randevu_tanimlari` |
| Uzman renk paleti (+ test) | `src/lib/uzman-renkleri.ts` |
| Şema, para/saat çevrimleri (+ test) | `src/app/koordinator/uzmanlar/sema.ts` |
| Eylemler | `src/app/koordinator/uzmanlar/actions.ts` |
| Ekranlar: kadro, mesai/izin, hizmet kataloğu | `src/app/koordinator/uzmanlar/**` |
| Katalog ve kadroda ekle / düzenle / pasife al / **sil** | `actions.ts` (`hizmetSil`, `uzmanSil`) |
| Yetki / menü / sızıntı tarayıcısı | `yetkiler.ts`, `navigasyon.ts`, `sube-sizinti.ts` |
| Katalog tohumu (11 hizmet + atölye görüşmesi) | `prisma/seed.ts` |

### Veli göçü — canlı kopyada doğrulandı

Migration, üretimin bir Neon dalı üzerinde koşturuldu (`neonctl branches
create`), sonuçlar sayıldı, dal silindi:

| Ölçüt | Sonuç |
|---|---|
| Guardian satırı | 857 → 857 (değişmedi) |
| Veli kaydı | 798 = 755 telefonlu + 43 telefonsuz |
| `veliId` boş guardian | 0 |
| Sahipsiz veli | 0 |
| Şubesi tutmayan bağ | 0 |
| Anne+baba tek veliye çökmüş | 0 |
| `searchName` ↔ `normalizeArama` uyuşmazlığı | 798 adın hepsinde 0 |

**Anahtar seçimi bu doğrulamada değişti.** İlk sürüm yalnız telefona göre
birleştiriyordu; kopya üzerinde koşturunca beş numaranın iki farklı ada bağlı
olduğu, ikisinde de anne ile babanın aynı telefonu paylaştığı görüldü
(Derya/Eyüp, Zeynep/İhsan) — birleştirme babanın adını siliyordu. Anahtar
telefon + ada çevrildi.

### Arayüzden uçtan uca denendi (yerel postgres + `next dev`)

Tarayıcıdan gerçek kullanıcı gibi yürütüldü: uzman ekleme, mesai ekleme ve
çakışma reddi, izin ekleme, hizmet düzenleme, öğrenci açma, kardeş kaydı,
veli adı düzeltme, telefonla arama, koordinatör (salt görüntüleme) görünümü.
Çıkan ve düzeltilen dört gerçek hata:

1. **Hizmet formu hiç kaydedilmiyordu.** Süre alanı `min={1} step={5}`
   taşıyordu; tarayıcı geçerli değerleri min'den sayıyor (1, 6, 11 … 116,
   121), yani katalogdaki bütün süreler (30/60/90/120) geçersizdi. Doğrulama
   balonu da görünmediği için düğme "ölü" görünüyordu. `min={5}` ile hizalandı.
2. **Pencere düğmeleri katlamanın altında kalıyordu** (800×450 dizüstü).
   Yapışkan eylem şeridi eklendi; düğmeler formun İÇİNDE tutuldu, çünkü
   `useFormStatus` form dışında çalışmıyor ve çift gönderim kilidi kaybolurdu.
3. **Düzenleme penceresi kaydedince kapanmıyordu** ve `defaultValue` yüzünden
   ESKİ değeri göstermeye devam ediyordu — kullanıcı kaydettiğini anlamıyor,
   ikinci kez kaydediyordu. İki pencere de kaydedince kapanıyor.
4. **Zod dışındaki doğrulama hatalarında girilenler kayboluyordu**
   (yaş aralığı, ad tekrarı, şube seçimi). `degerler` bu dallara da eklendi.

### Sonraki fazlar

- **Faz 2** — `Randevu` modeli, gün/hafta/ay takvimi, çakışma/mesai/izin
  kontrolü (saf ve testli), haftalık tekrar, iptal arşivi.
- **Faz 3** — uzman bazında ciro raporu, dashboard günlük kartı, CSV çıktısı,
  WhatsApp hatırlatma/anket bağlantıları.

### Açık maddeler

1. Tekrar kaç hafta ileri üretilecek — tek sonraki randevu mu, n haftalık seri
   mi? Seri olursa iptalde "yalnız bunu / bundan sonrakileri" ayrımı gerekir.
2. "Ergoterapi" ile "Duyu Bütünleme Programı" aynı hizmet mi? İkisi de
   katalogda duruyor; kurum gerekmeyeni panelden pasife alabilir.
3. Geçmiş `CounselingSession` kayıtları randevuya geriye dönük bağlanmayacak.

---

## Geliştirme komutları

```bash
npm run baslat       # Docker + veritabanı + uygulama, tek adımda
npm run db:up        # Yerel Postgres'i başlatır (Docker gerekir)
npm run dev          # Uygulamayı http://localhost:3000 adresinde açar
npm run db:migrate   # Şema değişikliğini veritabanına uygular
npm run db:seed      # Başlangıç verisini yükler (atölyeler, sorular, hesaplar)
npm run db:ornek-veri # Denemek için gerçekçi öğrenci ve puanlama verisi
npm run db:studio    # Veritabanını tarayıcıda görüntüler
npm run typecheck    # Tip kontrolü
npm run test         # Testler
```

> Docker `colima` üzerinden çalışıyor. Bilgisayar yeniden başladıysa önce
> `colima start` çalıştırılmalı.
