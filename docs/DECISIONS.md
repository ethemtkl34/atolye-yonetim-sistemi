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
2. **Atölye Koordinatörü** (`KOORDINATOR`) — koordinatör panelinin tamamı tam
   yetki; tek istisna zeka testleri (yalnız görüntüler, yükleyemez).
3. **Atölye Psikoloğu** (`ATOLYE_PSIKOLOGU`) — koordinatörle birebir aynı
   yetki, ayrı unvan.
4. **Test Uygulayıcısı** (`TEST_UYGULAYICISI`) — zeka testi sonuç belgelerini
   yükler/siler; tek başına başka yetkisi yok, pratikte psikologla birleşir.
5. **Danışma Görevlisi** (`DANISMA_GOREVLISI`) — öğrenci ve kayıt işlemleri
   tam; dönem/kulüp/grup salt görüntüleme; zeka testlerinde yalnız liste;
   görüşmeler (danışmanlık) TAMAMEN gizli (stajyer kuralı); puanlama, rapor,
   arşiv ve müfredat yönetimi kapalı.
6. **Stajyer** (`STAJYER`) — yalnızca kendisine atanmış öğrencilerin puanlama
   görevleri (kendi paneli); başka rolle birleşemez.

Karar gerekçeleri:
- Enum'da eski değerler (`ADMIN`, `KOORDINATOR`) korunmuştur — üretim
  veritabanında enum yeniden adlandırmak gereksiz risk; görünen unvanlar
  `ROL_ADLARI`'ndan gelir.
- Çoklu rol `Role[]` dizisidir (`Group.days` deseni); join tablosu yok çünkü
  role bağlı ek veri yok.
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
