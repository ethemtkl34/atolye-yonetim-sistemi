# Devir notu — 2 Ağustos 2026 (ek: 4 Eylül 2026)

Uzun bir çalışma oturumunun sonunda yazıldı. Amacı, yeni bir sohbetin
sıfırdan keşif yapmadan devam edebilmesi. Kararların gerekçeleri commit
mesajlarında ve kod yorumlarında duruyor; burada yalnızca **durum** ve
**tuzaklar** var.

## Nerede çalışıyoruz

**Her şey canlıda.** Yerelde dev sunucusu, Postgres kapsayıcısı ve Colima
kapalı; kullanıcı böyle istedi ("localde bir şey çalışmasın, test süreci de
dahil"). Doğrulama üretim üzerinde yapılıyor.

- Canlı: `atolye-yonetim-sistemi.vercel.app` (kalıcı adres; kendi alan
  adına taşıma planından vazgeçildi)
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

### Psikolog görüşmeleri ve profil sadeleştirme

Öğrencilerle yapılan psikolog/koordinatör görüşmeleri öğrenci kartında
tutuluyor (`CounselingSession`). Görüşmeci **serbest metin** (psikologlar
sistemde kullanıcı değil) + tür etiketi (`CounselorType`: PSIKOLOG /
KOORDINATOR — sayılabilsin diye). Kaydı kimin girdiği otomatik (`createdBy`,
SetNull). Gelecek tarih kabul edilmez: yapılmış görüşmenin kaydı, randevu
defteri değil. Düzenleme yok, sil + yeniden ekle (4 alanlık kayıt).

**GİZLİLİK: görüşmeler stajyerden TAMAMEN gizli** — sağlık bilgisi kuralının
aynısı, stajyer sorgularının select/include'una hiç girmez. Yeni sorgu
yazarken dikkat; `sube-sizinti` listelerine model ve ilişki eklendi.
Görüşmesi olan öğrenci silinemez (puanlama/rapor engeliyle aynı ilke).

Profil sayfası iki kata ayrıldı: üstte her zaman görünen operasyonel kat
(özet kartı + aktif kayıtlar + görüşmeler + raporlar), altta `<details>` ile
KAPALI başlayan arşiv katı (genel bilgiler, veliler, sağlık, geçmiş
kayıtlar, stajyer atamaları). Özet kartında veli telefonları `tel:`
bağlantısı. Eski "Geçmiş" kart bölümü kaldırıldı; `/gecmis` ve
`/puanlamalar` alt sayfaları duruyor, erişim Aktif kayıtlar başlığındaki
"Katılım geçmişi" / "Puanlamalar" bağlantılarından. `StajyerAtamalari`
artık çerçevesiz (Kart + başlık katlanır bölümden geliyor).

### Hafta içi dönemler ve çok günlü gruplar

Sistem "program yalnızca hafta sonu yapılır" (§2.3) varsayımıyla yazılmıştı ve
bu varsayım üç yerde şemaya kadar iniyordu: `Day` enum'unda yalnızca cumartesi
ve pazar vardı, `TermWeek.date` bir **cumartesi çapasıydı**, sihirbaz hafta içi
tarihi reddediyordu. Yaz programları hafta içi yapılıyor.

**Sezon etiketi (Sonbahar/İlkbahar/Yaz) eklenmedi** — dönem adı zaten serbest
metin, sezonu oradan okunuyor; etiket ikinci bir doğruluk kaynağı olur ve
hiçbir günü açmazdı. Bunun yerine dönem oluşturulurken **gün düzeni** soruluyor
(`Term.dayMode`: hafta içi / hafta sonu); takvimdeki hafta gösterimi ve grup
formundaki gün listesi buna göre daralıyor.

Üç yapısal değişiklik:

- **`Day` yedi güne çıktı.** Sıra takvim sırası (pazartesi → pazar) çünkü
  `orderBy` ve gün listeleri bu sıraya güveniyor. Enum'a değer eklemek kendi
  başına bir migration olmak zorunda (`ALTER TYPE … ADD VALUE` aynı
  transaction içinde kullanılamıyor) — depoda bunun bir kez yaşanmış notu var.
- **Hafta çapası cumartesiden PAZARTESİ'ye taşındı.** Eskiden pazar grubunun
  tarihi "çapa + 1" diye bulunuyordu; hafta içi günler bu hesaba sığmıyordu.
  Çapa haftanın başına alınınca yedi gün de aynı formülden çıkıyor:
  `çapa + günün sırası`. Migration mevcut çapaları 5 gün geri aldı; üretilmiş
  `Session` tarihleri gerçek toplanma günü olduğu için değişmedi.
- **Grup artık haftada birden çok gün toplanabiliyor** (`Group.day` →
  `days Day[]`, en az bir gün `Group_gun_dolu` CHECK kısıtıyla zorunlu). **Her
  toplanma gününde dönemin bütün atölyeleri yapılıyor**, yani oturum sayısı üç
  çarpanın çarpımı: hafta × gün × atölye. 10 hafta × 3 gün × 5 atölye = 150
  oturum ve öğrenci başına 150 puanlama formu — gün sayısı arttıkça stajyerin
  dolduracağı form da katlanıyor.

Bunun yan etkileri: çakışma uyarısı artık gün **kesişimine** bakıyor
(`days: { hasSome: … }`), zaman dilimi bütün günlerde ortak, kulüplerde gün
kulübün tarihlerinden türetiliyor ve hafta sonu kısıtı kalktı, dashboard'daki
"Yaklaşan hafta sonu" bölümü "Yaklaşan eğitim günleri" oldu ve pencere haftanın
tamamına açıldı.

`mevcutHaftaNumarasi` gün verilmediğinde artık haftanın SONUNU esas alıyor:
çapa (pazartesi) geçmiş olsa da o haftanın cumartesisi hâlâ yapılacak olabilir.

### İptal artık sebebiyle birlikte tutuluyor

İptal tek tıktı ve geriye hiçbir iz bırakmıyordu: bir çocuğun 4. haftada
taşındığı için mi yoksa devamsızlıktan mı düştüğü sonradan okunamıyordu.
`Enrollment`'a beş alan eklendi (`cancelReason`, `cancelNote`, `cancelledAt`,
`lastAttendedWeek`, `lastAttendedDate`) ve Kayıtlar ekranındaki düğme küçük
bir forma dönüştü: sebep etiketi + son katıldığı gün + açıklama.

- **Sebep etiket, serbest metin değil.** "Bu dönem kaç çocuk taşındığı için
  ayrıldı" sorusu ancak sayılabilir bir alandan cevaplanır. `DIGER` seçilince
  açıklama zorunlu.
- **Son katıldığı gün grubun KENDİ takviminden seçiliyor**, serbest tarih
  değil; hafta numarası da oradan okunuyor. Serbest tarihte hafta numarası
  tahmin edilmek zorunda kalır, telafi günleri de yanlış haftaya yazılırdı.
  İki alan birlikte üç durumu ayırıyor: ikisi de boş → hiç katılmadan ayrıldı,
  tarih dolu + hafta boş → telafi günü, ikisi de dolu → o hafta.
- **Tamamladığı / katılamadığı atölyeler SAKLANMIYOR, türetiliyor.** Bilgi
  zaten `Score` satırlarında; ikinci bir kopya iki kaynak ve çelişki demekti.
- **Toplu çıkarma sebepsiz kalıyor** (yalnızca `cancelledAt` yazılıyor): o bir
  düzeltme aracı, gerçek ayrılma değil. Gerçek ayrılmalar Kayıtlar ekranından
  tek tek giriliyor.

`Enrollment_iptal_alanlari` CHECK kısıtı bu alanların yalnızca `IPTAL`
kayıtta dolu olmasını veritabanı seviyesinde zorluyor. Sebebi: kayıt yeniden
etkinleştirildiğinde alanları temizlemeyi uygulama katmanının hatırlamasına
bırakırsak, unutulduğu gün "aktif ama 4. haftada ayrılmış" gibi kendisiyle
çelişen bir satır kalır. Üç yerde temizleniyor: `kayitYenidenEtkinlestir`,
paneldeki yeniden etkinleştirme ve elbette kısıtın kendisi.

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

**Rol katmanı temizlik deploy'u (1–2 hafta sonra, sistem canlıda doğrulanınca):**
çoklu role geçişte `User.role` sütunu geriye dönük uyumluluk için nullable
bırakıldı ve kod artık okumuyor/yazmıyor. Sistem yeni rollerle sorunsuz
çalıştığı doğrulanınca:

1. Yeni migration: `DROP INDEX "User_role_active_idx"`,
   `DROP INDEX "User_branchId_role_active_idx"`,
   `ALTER TABLE "User" DROP COLUMN "role"`,
   `CREATE INDEX "User_branchId_active_idx" ON "User"("branchId", "active")`.
2. `schema.prisma`'dan `role Role?` alanı ve iki eski indeks silinir.
3. `auth.config.ts` jwt callback'indeki eski-token shim'i (`token.role` dalı)
   ve `types/next-auth.d.ts`'teki opsiyonel `role` alanı silinir (12 saatlik
   eski belirteçler çoktan dolmuş olur).

**Rol mimarisi notları:** yetki matrisi `src/lib/yetkiler.ts` (tek kaynak);
guard deseni `yonetimZorunlu(modul, seviye)` — sayfa GORUNTULE/LISTE, mutasyon
action TAM ister. Ümraniye kadrosunun hesapları `prisma/hesaplar-umraniye.ts`
ile açılır (tek seferlik, yalnızca-create, geçici parolaları ekrana basar;
herkes ilk girişte `/parola-degistir`'den kendi parolasını koyar).

Bunun dışında **bilinen açık iş yok.** Eklenen her şey canlıda gerçek veriyle sınandı; çok
haftalı kulüp uçtan uca denendi (4 gün seçildi → 12 oturum, hafta numaraları
1–4) ve deneme verisi silindi. Mobil dokunma hedefleri ve şube sızıntısı
koruması da bitti (yukarıya bakın).

Kullanıcı **revize istekleriyle devam edecek** — sıradaki iş onun söyleyeceği
şey. Aşağıdakiler yalnızca o gelmezse geçerli olan öneriler:

- Gerçek kullanıma geçiş: `docs/YAYINA-ALMA.md` sırası — Neon yedeği →
  `db:temizlik` → `db:seed` → programların arayüzden kurulması.
- Stajyer puanlama akışının telefonda uçtan uca denenmesi (dokunma hedefleri
  ölçüldü, akışın kendisi mobilde baştan sona yürütülmedi).

---

# Ek — 4 Eylül 2026

Bu tarihte iki iş turu yapıldı ve ikisi de canlıya alındı. Ayrıntı
`PROGRESS.md` P19–P20'de, tanım `PROJECT_SPEC.md` §17'de, kararlar
`DECISIONS.md`'de; burada yalnız **durum** ve **sırada ne var**.

## Yapılanlar

**Bakım turu** (`f9485e8`) — Next 16.2.12 → 16.3.4 (üretim uyarısı 9 → 4),
veri katmanına ilk testler (376 → 446), öğrenci arama koşulunun saf bir
fonksiyona ayrılması, `panel.tuzder.org` planından vazgeçilmesi.

**Randevu Faz 1** (`b424a8b`, `2f30b32`, `0edf977`) — veli birinci sınıf kayıt
oldu, `Guardian` bağ tablosuna indi; hizmet kataloğu, uzman kadrosu,
yetkinlik, şube başına mesai ve izin geldi. Kurumun gerçek fiyatları (12
hizmet) canlıya yazıldı.

## Neyin nasıl doğrulandığı

Veli göçü 857 gerçek satırı yeniden düzenlediği için önce **üretimin tam bir
kopyasında** (Neon dalı) koşturuldu, sayıldı, dal silindi; aynı ölçütler
dağıtımdan sonra canlıda tekrar sayıldı ve birebir tuttu:

| Ölçüt | Sonuç |
|---|---|
| Guardian satırı | 857 → 857 |
| Veli kaydı | 798 (755 telefonlu + 43 telefonsuz) |
| Bağsız `veliId` / sahipsiz veli / şube uyuşmazlığı | 0 / 0 / 0 |
| Anne + baba tek veliye çökmüş | 0 |
| Öğrenci | 461 → 461 |
| SQL ↔ `normalizeArama` farkı | 0 / 798 ad |

**Kopyada bir veri kaybı yakalandı:** ilk sürüm velileri yalnız telefona göre
birleştiriyordu; beş numaranın ikisinde anne ile baba aynı telefonu
paylaşıyordu ve birleştirme babanın adını siliyordu. Anahtar telefon + ada
çevrildi.

## Tuzak — arayüzden denemeden gönderme

Yeni ekranlar tarayıcıdan gerçek kullanıcı gibi yürütüldü ve **tip denetimi,
476 test ve derlemenin yakalamadığı dört hata** çıktı:

1. Süre alanının `min=1` / `step=5` uyumsuzluğu yüzünden hizmet formu HİÇ
   kaydedilmiyordu (tarayıcı geçerli değerleri min'den sayıyor: 1, 6, 11 …
   116, 121 — katalogdaki 30/60/90/120 geçersizdi) ve doğrulama balonu da
   görünmediği için düğme ölü görünüyordu.
2. Pencere düğmeleri katlamanın altında kalıyordu.
3. Düzenleme penceresi kaydedince kapanmıyor, eski değeri göstermeye devam
   ediyordu.
4. Zod dışı doğrulama hatalarında girilenler kayboluyordu.

Ders eskisiyle aynı ([[arayuzu-yerelde-deneme-tarifi]] ile aynı yön): yeni bir
ekran canlıya gitmeden önce yerel postgres + `next dev` ile bir tur tıklanmalı.

## Sıradaki iş

**Faz 2 — randevu takvimi.** `Randevu` modeli; ücret randevuya kopyalanıyor
(zam geçmiş ciroyu değiştirmiyor); gün/hafta/ay görünümü; uzman, hizmet ve
danışan süzgeçleri; çakışma, mesai dışı ve izin ENGELLENİYOR (karar mantığı
saf ve testli bir modülde, `lib/kayit-kurallari.ts` deseni); danışmanlıklarda
haftalık tekrar; iptal edilen randevu silinmiyor, ayrı listede duruyor.

**Faz 3 — ciro raporu ve mesajlar.** Uzman bazında haftalık/aylık seans adedi
ve ciro (bugün Excel'de elle tutuluyor), hizmet türü kırılımı, dashboard
günlük kartı, dışa aktarım, WhatsApp hatırlatma/anket bağlantıları.

## Kullanıcı kararını bekleyenler

1. **Haftalık tekrar ne kadar ileri üretilsin?** Faz 2'yi doğrudan etkiliyor:
   tek sonraki randevu mu, n haftalık seri mi? Seri olursa iptalde "yalnız
   bunu / bundan sonrakileri" ayrımı gerekir.
2. **"Ergoterapi" ile "Duyu Bütünleme Programı" aynı hizmet mi?** İkisi de
   katalogda; aynıysa biri panelden pasife alınabilir.
3. **Geçmiş `CounselingSession` kayıtları randevuya bağlansın mı?**
   Bağlanmayacak varsayılıyor.

Bunların dışında kullanıcının **bilerek açık bıraktığı** maddeler var ve eksik
sayılmamalı: `LEAD_API_TOKEN` (CRM ucu canlıda 503), yedi `@tuzder.local` demo
hesabı, Sonbahar dönemindeki 60 sahipsiz müfredat girdisi, Neon ücretsiz
planının 6 saatlik kurtarma penceresi, hata izleme aracının olmaması.
