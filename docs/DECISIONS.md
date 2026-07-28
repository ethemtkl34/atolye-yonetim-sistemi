# Kesinleşen Ürün Kararları

## Roller

Sistemde iki rol bulunur:

1. **Koordinatör**
   - Admin, eğitmen ve koordinatör aynı tam yetkili rol altında birleşir.
   - Dönem, grup, kulüp, öğrenci, kayıt, stajyer, atölye, soru ve rapor yönetimini yapar.

2. **Stajyer**
   - Yalnızca kendisine atanmış öğrencileri ve bu öğrencilere ait puanlama görevlerini görür.
   - Her atölye için ayrı değerlendirme formu doldurur.
   - Kendi girdiği puanları daha sonra düzenleyebilir.

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
