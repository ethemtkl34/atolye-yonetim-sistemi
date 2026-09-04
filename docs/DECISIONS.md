# Kesinleşen Ürün Kararları

## Roller

Rol seti KODDA sabittir (dinamik rol oluşturucu yok); yönetici yalnızca
kişilere rol atar. Bir kullanıcı birden çok rol taşıyabilir (`User.roles`,
örn. "Atölye Psikoloğu / Test Uygulayıcısı"); etkin yetki rollerin
birleşimidir ve modül bazlı yetki matrisi `src/lib/yetkiler.ts` içindedir.
Yetki seviyeleri sıralıdır: YOK < LISTE < GORUNTULE < TAM ("LISTE" yalnızca
zeka testlerinde anlamlı: üstveri görünür, belge içeriği açılamaz).

1. **Kurum Yöneticisi** (`ADMIN`) — her şey + kullanıcı yönetimi; şubesizdir,
   üst şeritten şube seçerek bütün şubelerde çalışır. Başka rolle birleşemez.
2. **Şube Yöneticisi** (`SUBE_YONETICISI`) — koordinatörün bütün yetkileri
   ARTI kullanıcı yönetimi, ama YALNIZCA kendi şubesinde. Kurum
   Yöneticisi'nden farkı şubeye bağlı olması; koordinatörden farkı kullanıcı
   yönetimini taşıması. Kurum Yöneticisi yetkisi veremez, başka şubenin
   hesabına dokunamaz. Diğer şubeli rollerle birleşebilir.
3. **Atölye Koordinatörü** (`KOORDINATOR`) — koordinatör panelinin tamamı tam
   yetki; tek istisna zeka testleri (yalnız görüntüler, yükleyemez).
4. **Atölye Psikoloğu** (`ATOLYE_PSIKOLOGU`) — koordinatörle birebir aynı
   yetki, ayrı unvan.
5. **Test Uygulayıcısı** (`TEST_UYGULAYICISI`) — zeka testi sonuç belgelerini
   yükler/siler; tek başına başka yetkisi yok, pratikte psikologla birleşir.
6. **Danışma Görevlisi** (`DANISMA_GOREVLISI`) — öğrenci ve kayıt işlemleri
   tam; dönem/kulüp/grup salt görüntüleme; zeka testlerinde yalnız liste;
   görüşmeler (danışmanlık) TAMAMEN gizli (stajyer kuralı); puanlama, rapor,
   arşiv ve müfredat yönetimi kapalı.
7. **Stajyer** (`STAJYER`) — yalnızca kendisine atanmış öğrencilerin puanlama
   görevleri (kendi paneli); başka rolle birleşemez.

Karar gerekçeleri:
- Enum'da eski değerler (`ADMIN`, `KOORDINATOR`) korunmuştur — üretim
  veritabanında enum yeniden adlandırmak gereksiz risk; görünen unvanlar
  `ROL_ADLARI`'ndan gelir.
- Çoklu rol `Role[]` dizisidir (`Group.days` deseni); join tablosu yok çünkü
  role bağlı ek veri yok.
- Yetki matrisi ŞUBEYE BAKMAZ: "ne yapabilir" sorusunun cevabı
  `yetkiler.ts`'te, "kimin üzerinde" sorusununki şube bağlamındadır. Şube
  Yöneticisi bu yüzden matriste Kurum Yöneticisi'ne yakın durur ama kullanıcı
  ekranında kendi şubesine kilitlidir (`roller.ts kullaniciYonetimiKapsami`).
- Dashboard modülsüzdür: panele girebilen herkes özeti görür.
- Randevu yönetimi bilinçli olarak kapsam dışı bırakıldı (ileride ayrı iş).
- Yeni açılan ve parolası sıfırlanan hesaplar ilk girişte parola değiştirmeye
  zorlanır (`mustChangePassword` + `/parola-degistir`).

## Dönem

- Her dönem 10 eğitim haftasından oluşur.
- Tatil veya ara haftaları atlanabilir; dönem takvim üzerinde 11–12 haftaya uzayabilir.
- Bir dönemde 5 atölye çeşidi seçilir.
- Aynı 5 atölye, 10 eğitim haftasının tamamında uygulanır.
- Atölyelerin saatleri ve yarım gün içindeki sırası tutulmaz.
- Her yarım günlük programda 5 farklı atölye yapılır.

## Grup

- Her dönem bir veya daha fazla gruba sahip olabilir.
- Grup, gün ve zaman dilimiyle tanımlanır: cumartesi/pazar ve öğleden önce/öğleden sonra.
- Kontenjan dolduğunda aynı dönemde yeni grup açılabilir.
- Sonradan açılan grup, dönemin mevcut haftasından devam eder.
- Geçmiş haftalar telafi edilmez.
- Aynı dönemdeki bütün gruplar aynı 5 atölyeyi ve aynı dönem takvimini kullanır.

## Kulüp

- Kulüp, koordinatör tarafından önceden oluşturulan hazır programdır.
- Kulüp bir yarım gün sürer.
- Kulüp programında 3 farklı atölye bulunur.
- Kulüp öğrencileri dönem gruplarına dahil olmaz.
- Kulüplerin kendi grupları ve kontenjanları bulunur.

## Öğrenci kaydı

- Öğrenci sisteme bir kez eklenir.
- Aynı öğrenci farklı dönemlere ve kulüplere birden fazla kez kayıt olabilir.
- Kayıt türü `Dönem Kaydı` veya `Kulüp Kaydı`dır.
- Her kayıt için grup ve sorumlu stajyer seçilir.
- Stajyer ataması öğrenci profiline değil, ilgili kayda bağlıdır.

## Puanlama

- Her atölyeden sonra öğrenci için ayrı form doldurulur.
- Puanlama öğrenci bazlı ilerler.
- Formdaki bütün kriterlerin cevaplanması zorunludur.
- Öğrenci atölyeye katılmadıysa form `Katılmadı` olarak işaretlenir ve puan verilmez.
- Stajyer için doldurma son tarihi yoktur.
- Yazılı stajyer gözlem notu bulunmaz.

## Rapor

- Rapor istenildiği anda mevcut puanlardan oluşturulabilir.
- Raporda atölye bazlı sonuçlar ve genel öğrenci değerlendirmesi bulunur.
- Rapor PDF olarak dışarı aktarılır.
- Puanlar rapor oluşturulduktan sonra değiştirilebilir.
- Puan değiştiğinde mevcut rapor güncelliğini yitirmiş olarak işaretlenir; koordinatör yeni rapor oluşturabilir.
- Daha önce oluşturulmuş PDF raporlar geçmişte saklanır.

## Adlandırma standardı (Ağustos 2026 revizyonu)

- **Dosya adları ve tanımlayıcılar Türkçedir.** İngilizce adlı `lib` dosyaları
  bu revizyonda çevrildi: `scoring.ts` → `puan-hesaplari.ts`,
  `report-engine.ts` → `rapor-motoru.ts`, `session-generator.ts` →
  `oturum-uretici.ts`, `auth-guard.ts` → `yetki-kapisi.ts`.
- **Prisma modelleri ve alanları İngilizce kalır** (`Score`, `Enrollment`,
  `branchId`). Üretim veritabanında tablo/enum yeniden adlandırmak gereksiz
  risk; Türkçe↔İngilizce eşleme `lib/sube.ts` başındaki tabloda belgeli.
- **Server Action dosyaları:** rota klasörünün ana eylem dosyası `actions.ts`
  (Next.js geleneği), konuya adanmış ek dosyalar `<konu>-eylemleri.ts`
  (örn. `takvim-eylemleri.ts`, `rapor-eylemleri.ts`). `takvim-actions.ts`
  melezdi, bu revizyonda `takvim-eylemleri.ts` oldu.
- **Teknik kısa adlar** (`db.ts`, `env.ts`, `utils.ts`, `ui.tsx`) oldukları
  gibi kalır; bunlar ekosistem terimleridir, çevirisi okunurluğu düşürür.
- `puan-hesaplari.ts` yalnızca saf ortalama/biçimleme hesapları içerir:
  kontenjan `kayit-kurallari.ts`'e, rapor güncelliği `rapor-motoru.ts`'a
  taşındı — dosya adı içeriğini anlatmak zorunda.

## Geçmiş veri aktarımı (Ağustos 2026)

- Panel açılmadan önce yaşanmış dönemler ve o dönemlerin PDF raporları
  sisteme aktarıldı. Amaç **yalnızca geçmişi takip**: öğrencinin profilinde
  hangi dönemde hangi sınıfta olduğu ve o dönemin raporu görünsün.
- Aktarılan dönem ve kulüpler `gecmisVerisi = true` işaretlidir. Bu programlar
  için sistem **rapor üretemez**: puanlaması ve müfredatı hiç girilmedi, boş
  bir puan kümesinden üretilecek rapor gerçek arşiv belgesinin yanında ikinci
  ve yanlış bir belge olurdu. Bayrak dört yeri birden kapatır — rapor kapsam
  listesi, rapor üretme eylemi, puanlama listesi, gelişim testi listesi.
- `status = ARSIVLENDI` bu işin yerine geçmez: arşiv geri alınabilir bir
  görünürlük ayarı (`ARSIVLENDI → TAMAMLANDI` geçişi var), oysa bu dönemlerin
  puanı hiçbir zaman gelmeyecek. İkisi birlikte kullanılıyor.
- Geçmiş raporlar `Report`/`ReportPdf` değil, ayrı bir `LegacyReport`
  tablosunda durur. Sebep: o modellerin `bodyJson`/`snapshotJson` alanları
  zorunlu ve bu belgelerin öyle bir gövdesi yok. Belge ikili veri olarak
  veritabanında (`IntelligenceTest` ile aynı gerekçe ve desen).
- Aktarılan dönemlerin `TermWeek`, `Session` ve `Score` satırları
  **üretilmedi**. Uydurulmuş oturum, geçmişi olduğundan zengin gösterirdi;
  geçmişin kanıtı arşivdeki PDF'in kendisi.
- Aktarım iki aşamalı: `scripts/gecmis-veri/hazirla.py` kaynakları okuyup
  denetlenebilir bir JSON + denetim raporu üretir (DB'ye dokunmaz),
  `aktar.ts` onu yazar. Yazılan her satırın kimliği `manifest.json`'a düşer;
  `geri-al.ts` yalnızca o listeye dokunur.

## Aday (CRM) modülü — Ağustos 2026

- Modül slug'ı **`adaylar`**, "crm" değil. Adlandırma standardı gereği panel
  dili Türkçe; "aday öğrenci / aday veli" kurumun kendi kullandığı sözcük ve
  `ogrenciler`/`danismanlik` gibi tek kelimelik slug'larla aynı kalıpta.
- **Meta ile doğrudan webhook kurulmadı; entegratör (Pabbly/Make) tercih
  edildi.** Doğrudan bağlanmak Meta App Review (Advanced Access + Business
  Verification, haftalar sürer), `X-Hub-Signature-256` doğrulaması ve sayfa
  jetonu yenileme yükünü kuruma yıkıyordu. Entegratör Meta'dan alıp panelin
  tek ucuna POST ediyor. Uç sözleşmesi ileride doğrudan webhook'a geçmeye
  hazır; değişecek olan yalnız çağıran.
- **Yeni rol açılmadı.** Modülün asıl kullanıcısı mevcut `DANISMA_GOREVLISI`
  (kayıt masası) ve yetkisi TAM. Aday verisi sağlık/görüşme mahremiyeti
  sınıfında değil; `ogrenciler`/`kayitlar` TAM ile tutarlı. CRM'e özel bir
  "Danışman" rolü ileride istenirse `Role` enum'una değer eklemek kendi
  migration'ını gerektirir (Postgres kuralı) — ayrı iş.
- **"Ulaşılamadı" aşama değil, sayaç.** Aşama yapılsaydı boru hattı gerçekte
  olmayan bir ilerleme gösterirdi; oysa ulaşılamamak denemenin sonucu.
  `ULASILAMADI` etkinliği + `unreachableCount`, aşamaya dokunmadan.
- **`KAZANILDI` terminaldir** ve yalnız dönüşüm akışıyla yazılır: karşılığında
  bir öğrenci kaydı var, geri almak bilinçli bir yönetici işi olmalı.
  `KAYBEDILDI` ise tek adımla geri açılabilir (yanlışlıkla kapatma telafisi).
- **Aşama açılır listeyle değil açık düğmelerle değişiyor** (`DurumSecici`
  kullanılmadı). Aşama ilerletmek bu modülün asıl fiili, iki arama arasında
  tek elle yapılıyor; ayrıca geçişlerin üçü zorunlu veri taşıyor (randevu
  tarihi, kayıp sebebi, öğrenci bağlantısı) ve seçici zaten arkasından bir
  pencere açtıracaktı.
- **Şube kodu çözülemeyen başvuru düşürülmez**, varsayılan şubeye
  `ESLEME_YOK` işaretiyle yazılır ve listede uyarı üretir. Gerçek bir ailenin
  başvurusunu eski bir form değeri yüzünden kaybetmek, yanlış şubede duran ve
  görünür şekilde işaretli bir kayıttan çok daha kötü.
- **Mükerrer kaydı elle girişte engellenmez, uyarılır**: kardeşler aynı veli
  telefonunu paylaşıyor. API girişinde ise aynı telefonla açık aday varken
  yeni satır açılmaz, mevcut aday kuyruğa geri çekilir.
- **Sorumlu (`assignedToUserId`) görünürlüğü kısıtlamaz.** Ekip küçük; herkes
  her adayı görür, alan yalnız iş bölümü ve süzgeç için.
- **Oran sınırlama bilinçli olarak asgari**: kaynak başına saatlik 100 yazım
  tavanı (jeton sızıntısının patlama yarıçapı). Vercel'de kalıcı sayaç yok;
  daha sıkı bir sınır isteniyorsa Cloudflare tarafında kural yazılmalı.
- **`LeadActivity` şube-sızıntı tarayıcısının `SUBELI_ILISKI` listesine
  EKLENMEDİ** (`leads` eklendi). Ölçüt "şubesiz bir kapıdan şubeli veriye
  geçiriyor mu": `activities`in tek üst modeli `Lead` ve o zaten `SUBEYE_AIT`,
  yani sorgusu kurallardan geçmeden yazılamıyor. Listeye eklenseydi etkinlik
  yazan her eylem gereksiz bir `// şube-muaf` yorumu taşır, tarayıcı gürültüye
  dönerdi. Şubesiz bir modele `activities` ilişkisi eklenirse karar yeniden
  gözden geçirilmeli.
- V1 kapsamı dışında: Bitrix/Workiom veri aktarımı, ödeme, randevu takvimi,
  e-posta/SMS gönderimi, dönüşmeyen adayların otomatik temizliği (KVKK
  saklama süresi kurum kararı bekliyor).

## Randevu yönetimi (§17)

- **Veli birinci sınıf kayıt oldu.** Randevu veliye açılıyor; veli öğrencinin
  altında bir satır kaldığı sürece aynı anne-baba her çocuğu için ayrı bir
  satırdı (canlıda 857 satır, 750 telefon) ve randevu geçmişi çocuklar
  arasında bölünürdü. Kimlik `Veli`ye taşındı, `Guardian` bağ tablosuna indi.
- **Veli kimlik anahtarı telefon + AD.** Yalnız telefon denendi ve canlı
  verinin kopyasında yanlış çıktı: beş numaranın ikisinde anne ile baba aynı
  telefonu paylaşıyordu, birleştirme babanın adını siliyordu. Bedeli, aynı
  kişinin iki farklı yazımının (Burhan/Burhanettin) ayrı kalması — kozmetik
  bir mükerrer, silinen bir ad geri gelmez.
- **Uzman `User` DEĞİL, ayrı tablo.** Uzmanların çoğu panele girmiyor
  (hesap açmak gereksiz güvenlik yüzeyi) ve bir uzman iki şubede birden
  çalışabiliyor — kullanıcı hesabı tek şubeye bağlı (veritabanı CHECK'i).
  Panele giren uzman için `userId` doldurulur.
- **Hizmet kataloğu enum değil tablo** (`IntelligenceTestType` deseni).
  Kurumun hizmet adları kod sürümünden bağımsız değişiyor: "Ergoterapi" bir
  dönem "Duyu Bütünleme Programı" olarak anılmaya başladı ve bu tek başına
  bir migration'a değmez. Mevcut `TherapyType` enum'ı KALDIRILMADI — eski
  görüşme kayıtları ona bağlı, ikisi `lib/terapi-turleri.ts` ile eşleşiyor.
- **Para kuruş cinsinden `Int`.** `Float` ondalık tutarları tam temsil
  etmiyor ve ciro toplamı kuruş kaydırıyor.
- **Ücret randevuya kopyalanır.** Katalogdaki zam geçmiş haftaların cirosunu
  değiştirmemeli; §13.17'nin "alınmış belge değişmez" ilkesinin para karşılığı.
  Tahsilat takibi bilinçli olarak kapsam dışı — muhasebe sınırı.
- **İzin sahte hizmet değil, kendi tablosu.** Eski CRM izni ₺0 / 0 dakikalık
  bir hizmet satırı olarak tutuyordu; o modelde izin her seans ve ciro
  raporunda ayrıca dışlanmayı gerektirir ve bir gün biri dışlamayı unuturdu.
- **Çakışma ENGELLENİR, uyarılmaz.** Kayıt çakışmasından farkı: orada
  koordinatör bilinçli olarak devam edebiliyor, burada aynı uzman aynı anda
  iki yerde olamaz.
- **Takvim şubeler arası görünür, kişisel veri değil.** Uzman iki şubede
  çalışabildiği için çakışma ancak böyle önlenir; öğrenci/veri mahremiyeti
  eskisi gibi şubeye kilitli.
- **Ciro için ayrı yetki yok**; `randevular` modülünü gören ücreti de görür.
  `uzmanlar` (kadro + fiyat listesi) ise `kullanicilar` ile aynı sınıfta bir
  yönetici işi: Kurum ve Şube Yöneticisi TAM, diğerleri GÖRÜNTÜLE.
- **Mesajlar WhatsApp bağlantısıyla**, otomatik gönderim yok: SMS servisi
  abonelik, API kurulumu ve KVKK aydınlatması demek; mevcut `waBaglantisi`
  deseni bugün çalışıyor.
- **Alan adı**: `panel.tuzder.org` planından vazgeçildi; sistem
  `atolye-yonetim-sistemi.vercel.app` adresinde kalıyor.
