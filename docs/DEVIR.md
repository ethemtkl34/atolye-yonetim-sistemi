# Devir notu — 2 Ağustos 2026

Uzun bir çalışma oturumunun sonunda yazıldı. Amacı, yeni bir sohbetin
sıfırdan keşif yapmadan devam edebilmesi. Kararların gerekçeleri commit
mesajlarında ve kod yorumlarında duruyor; burada yalnızca **durum** ve
**tuzaklar** var.

## Nerede çalışıyoruz

**Her şey canlıda.** Yerelde dev sunucusu, Postgres kapsayıcısı ve Colima
kapalı; kullanıcı böyle istedi ("localde bir şey çalışmasın, test süreci de
dahil"). Doğrulama üretim üzerinde yapılıyor.

- Canlı: `atolye-yonetim-sistemi.vercel.app` (ayrıca `panel.tuzder.org` —
  henüz devrede değil)
- Push edilince Vercel dağıtıyor: `prisma migrate deploy && vitest run &&
  next build`. Test kırılırsa dağıtım durur — yerelde test döngüsü olmadığı
  için tek gerçek kontrol noktası burası.
- **Onay beklemeden push ediliyor** (kullanıcı kalıcı yetki verdi)
- Kullanıcı sık sık **iki sohbette birden** çalışıyor: yalnızca kendi
  değiştirdiğiniz dosyaları `git add` edin, `git add -A` başkasının işini
  de gönderir.

### Üretim veritabanına erişim

`DATABASE_URL` Vercel'de **production** ortamında şifreli, okunamıyor. Ama
**development** ortamındaki aynı Neon veritabanını gösteriyor ve okunabiliyor:

```bash
npx vercel env pull /tmp/.env.dev --environment=development --yes
set -a; . /tmp/.env.dev; set +a
```

Kullandıktan sonra dosyayı silin.

### Tarayıcı

Kullanıcının oturumu **Chrome**'da. İki köprü var:

- `Control_Chrome`: yalnızca gezinme çalışıyor; okuma/JS macOS otomasyon
  izni olmadığı için başarısız.
- **`claude-in-chrome` uzantısı**: tam erişim — okuma, JS, gerçek fare.
  Doğrulama bununla yapılmalı.

Uygulama içindeki tarayıcı panelinin ayrı bir çerez kabı var, orada oturum
yok.

## Tuzaklar

**Migration havuzsuz bağlantıdan geçmeli.** `prisma migrate deploy` oturum
düzeyinde advisory kilit alıyor; pgbouncer üzerinden yarıda kesilirse kilit
havuzdaki bağlantıda asılı kalıyor ve sonraki bütün dağıtımlar düşüyor. Bir
kez yaşandı, elle düşürüldü. `prisma.config.ts` artık `-pooler` ekini
kaldırıyor. Uygulama çalışma zamanı havuzu kullanmaya devam ediyor.

**Ölçerken önce yöntemden şüphelen.** Bu oturumda iki kez araç davranışı
uygulama hatası sanıldı:
- Referansla tıklama öğeye hiç ulaşmıyordu (`click: 0` olay sayacıyla
  görüldü) — önce `scroll_to`, sonra gerçek koordinatla tıklamak gerekiyor.
- React'in denetimli onay kutularına JS ile art arda tıklamak tutmuyor.

Ekran görüntüsü ve sayfaya kurulan olay sayacı, tahminden hızlı sonuç
veriyor.

**Örnek veri betiği uzakta seçici davranıyor.** Ad çakışması olan şubeyi
atlıyor, silme yapmıyor, eksik stajyer hesaplarını kendisi açıyor
(`ORNEK_VERI_ONAY=evet` gerekli).

## Şu anki durum

Şube yapısı (Faz 1–5) tamamlandı ve canlıda doğrulandı: sorgu süzmesi, şube
göstergesi/seçici, yönetici kullanıcı yönetimi. İzolasyon canlıda sınandı —
başka şubenin id'si adres satırına yapıştırılınca 404.

### Kayıt akışının iki yeni kapısı

Kayıt eskiden TEK yoldan açılıyordu: öğrenci profili → "Yeni kayıt". Artık üç
yol var ve üçü de aynı kuralları `src/lib/kayit-kurallari.ts` üzerinden okuyor
(grup açık mı → program "Kayıt alıyor" mu → kontenjan). Kural üç ekrana
kopyalanmadı; kopyalansaydı hangisinin doğru olduğu ancak canlıda anlaşılırdı.

- **Yeni öğrenci formunda** isteğe bağlı "Program kaydı" bölümü: öğrenci ve
  kaydı TEK işlemde açılıyor. Tek işlem olması bilinçli — önce öğrenciyi yazıp
  sonra kaydı denemek, kontenjan dolduğunda ortada sahipsiz bir öğrenci
  bırakırdı.
- **Dönem ve kulüp sayfasında "Grubun öğrencileri"** paneli: tek grup
  seçicisini paylaşan iki liste — üstte gruptakiler (çıkar), altta
  eklenebilecekler (ekle). Kontenjan yetmezse işlem tümüyle reddedilmiyor;
  sığanlar ekleniyor, kalanlar adlarıyla bildiriliyor. Zaman çakışmaları da
  eklendikten sonra ad ad listeleniyor (tek kayıttaki "uyarıya rağmen devam et"
  adımı 20 kişilik listede akışı kilitlerdi).

**Çıkarma kaydı silmez, iptal eder** ve panelden geri eklenince kayıt eski
puanlamalarıyla birlikte yeniden etkinleşir. İlk sürüm iptal edilmiş kaydı
reddediyordu ("Kayıtlar ekranından yeniden etkinleştirin"); aynı panelde hem
çıkarma hem ekleme olunca bu bir çıkmaz oluyordu — yanlışlıkla çıkardığın
öğrenciyi geri koyamıyordun. Yeni kayıt açmak da doğru cevap değil, öğrencinin
puanlama geçmişini koparırdı. Kontenjan ikisini birlikte sayıyor.

### Öğrenci silme

Yoktu, eklendi: düzenleme ekranının sonunda ayrı bir bölüm. Profil sayfasına
konmadı — silme geri alınamaz ve okuma ekranında yanlışlıkla tıklanmaya çok
yakın durur.

Sınır veriye bakarak çiziliyor: **puanlaması veya raporu olan öğrenci
silinemez**, sebebi buton kilitliyken zaten yazılı. Kalanlar veli, sağlık ve
kayıt satırlarıyla birlikte gidiyor. Kontrol ile silme aynı işlemde: arada
girilen bir puanlamanın sessizce silinmesi kabul edilemez bir kayıp olurdu.
PDF raporu olan öğrenci veritabanı seviyesinde zaten silinemiyor
(`ReportPdf` → `Restrict`); uygulama katmanı bu sınırı daha erken çiziyor.

**Sorumlu stajyer artık kayıt anında zorunlu değil** — kullanıcı "dönem
başlarken atamasını yapıyor olacaklar" dedi. Kayıt sihirbazında "Sonra
atanacak" seçeneği var, toplu panelde stajyer hiç sorulmuyor. Atanmamış kayıt
zaten görünür: `atanmamisKayitKosulu` panodaki kartı ve kayıtlar ekranındaki
"Atanmamış" süzgecini besliyor.

Panelde iki ayrıntı önemli:

- **Seçim listesi temizlenmiyor, süzülüyor.** Ekleme başarılı olunca sayfa
  tazeleniyor ve eklenenler "bu grupta" oluyor; seçim o süzgeçten kendiliğinden
  düşüyor. Effect içinde `setState` çağırmak `react-hooks/set-state-in-effect`
  kuralına takılıyor — türetmek hem lint'i geçiyor hem de daha az durum.
- Grup değişince seçim korunuyor. Yeni grupta zaten kayıtlı olanların kutusu
  kilitli ve kilitli kutu formda gönderilmiyor, o yüzden taşımak güvenli.

Son eklenenler (hepsi canlıda doğrulandı):
- Grup takvimi: gün taşı / telafi günü ekle / gün sil, puanlanmış gün
  silinemez
- Grup adı düzenleme
- Hafta sayısı serbest (dönem ve kulüp), kaydetmeden önce sayıyla teyit
- Kulüp çok haftalı olabiliyor (`Club.weekDates`)

Mobil: dokunma hedefleri 44px, iOS yakınlaştırması giderildi, menü çekmecesi
(eski yatay şerit 8 ekranı erişilemez kılıyordu). Üst şeritteki hedefler de
canlıda ölçüldü; 40px altı kalmadı.

**Ölçüm yöntemi:** `claude-in-chrome` ile pencereyi küçültüp (`resize_window`
260×844 → görünüm ~485px) `header`/`main` içindeki `a, button, select, label`
yüksekliklerini saymak. Bir tur yalnızca `main`'i taradığı için üst şerit
gözden kaçmıştı — tarama her iki bölgeyi de kapsamalı.

İki ayrı yanılma kaynağı var, ölçüm ikisini de hesaba katmalı:

- **Gerilmiş bağlantı** (`after:absolute after:inset-0`) kartın tamamını
  kaplar; öğenin kendi kutusu 21px görünse de gerçek hedef ~122px. Ölçümde
  `getComputedStyle(e, '::after')` bakılıp bunlar elenmeli, yoksa öğrenci
  listesi 21 sahte bulgu üretir.
- **Toplu sınıf değiştirme tam dize eşleştirir.** `inline-flex ` öneki
  taşıyan ya da farklı ton kullanan yedi bağlantı ilk turda desene uymayıp
  16–20px kalmıştı; en kritiği stajyerin telefonda en çok dokunduğu
  "… gününü doldur →" idi. Bağlantılar artık `ui.tsx`'teki paylaşılan
  `baglantiStili` / `geriBaglantiStili` / `kartBasligiStili` üzerinden
  geçiyor; yeni bağlantı yazarken el yazımı sınıf kullanmayın.

Tarama `src` içinde `className="…hover:underline"` araması ile yapılabilir;
şu an yalnızca bilinçli gerilmiş bağlantı kalıyor. Ekranlar canlıda 606px
genişlikte yeniden ölçüldü — puanlamalar, öğrenciler, gruplar, kayıtlar,
öğrenci profili ve atölye geçmişi: 40px altı hedef yok, yatay taşma yok.

### Şube sızıntısı koruması

`src/lib/sube-sizinti.ts` kod tabanını TypeScript çözümleyicisiyle tarıyor ve
şube süzgeci taşımayan sorguları buluyor; `sube-sizinti.test.ts` bunu teste
bağlıyor. Sebep: şube süzmesi eklendikten **sonra** üç ekran hâlâ süzgeçsiz
okuyordu ve bu ancak canlıda gözle görüldü — eksik bir `where` geçerli
TypeScript'tir, tip denetimi göremez.

Kural sırayla: şubeli model ya da şubeli ilişkiye giren iç içe okuma mu →
`adminZorunlu()` mu (şubeler üstü, muaf) → süzgeç çağrının içinde mi →
gerekçeli `// şube-muaf:` yorumu var mı → tekil kayıt ya da doğrulanmış üst
kayda çapa mı. Hiçbiri değilse bulgu.

İki ayrıntı önemli:

- **İç içe okuma** (`term.findMany({ include: { groups: … } })`) ayrıca
  denetleniyor. Yaşanan üç sızıntının üçü de buydu: dış model şubesiz olduğu
  için yalnızca modele bakan bir kural görmezdi.
- **`{ notIn: […] }` çapa sayılmaz.** Veri kaybı hatası tam olarak buydu.
  Çapa, doğrulanmış tek bir üst kaydın kimliğidir; küme değildir.

Yeni bir sorgu süzgeci unutursa test kırılır. Bilerek süzgeçsizse çağrının
üstüne gerekçesi yazılır (`// şube-muaf: …`) — gerekçesiz muafiyet kabul
edilmiyor.

Testler artık **dağıtımda da çalışıyor** (`vercel-build`): yerelde test
döngüsü olmadığı için koruma ancak burada anlam taşıyor. Test kırılırsa
dağıtım durur, hatalı sürüm canlıya çıkmaz.

Tarayıcı bugün 193 sorgunun tamamını gezdi; 14'ü elle incelendi, **hiçbiri
sızıntı değildi** ve her birinin gerekçesi koda yazıldı.

### Canlıdaki veri

Ümraniye 21 öğrenci / 7 grup, Güneşli 8 / 4. Hepsi deneme verisi; kullanıcı
"testteyiz" dedi. Gerçek kullanıma geçmeden önce `db:temizlik` → `db:seed` →
programları arayüzden kurma sırası izlenmeli (bkz. `docs/YAYINA-ALMA.md`).

Hesaplar ve parolalar için kullanıcıya sorun; parolalar bu belgeye yazılmadı.

## Sıradaki iş

**Bilinen açık iş yok.** Eklenen her şey canlıda gerçek veriyle sınandı; çok
haftalı kulüp uçtan uca denendi (4 gün seçildi → 12 oturum, hafta numaraları
1–4) ve deneme verisi silindi. Mobil dokunma hedefleri ve şube sızıntısı
koruması da bitti (yukarıya bakın).

Kullanıcı **revize istekleriyle devam edecek** — sıradaki iş onun söyleyeceği
şey. Aşağıdakiler yalnızca o gelmezse geçerli olan öneriler:

- Gerçek kullanıma geçiş: `docs/YAYINA-ALMA.md` sırası — Neon yedeği →
  `db:temizlik` → `db:seed` → programların arayüzden kurulması →
  `panel.tuzder.org` alan adının devreye alınması.
- Stajyer puanlama akışının telefonda uçtan uca denenmesi (dokunma hedefleri
  ölçüldü, akışın kendisi mobilde baştan sona yürütülmedi).
