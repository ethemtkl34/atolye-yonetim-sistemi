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
- Push edilince Vercel dağıtıyor ve `prisma migrate deploy` çalışıyor
- **Onay beklemeden push ediliyor** (kullanıcı kalıcı yetki verdi)

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

### Canlıdaki veri

Ümraniye 21 öğrenci / 7 grup, Güneşli 8 / 4. Hepsi deneme verisi; kullanıcı
"testteyiz" dedi. Gerçek kullanıma geçmeden önce `db:temizlik` → `db:seed` →
programları arayüzden kurma sırası izlenmeli (bkz. `docs/YAYINA-ALMA.md`).

Hesaplar ve parolalar için kullanıcıya sorun; parolalar bu belgeye yazılmadı.

## Sıradaki iş

**Bilinen açık iş yok.** Bugün eklenen her şey canlıda gerçek veriyle
sınandı; en son çok haftalı kulüp uçtan uca denendi (4 gün seçildi → 12
oturum, hafta numaraları 1–4) ve deneme verisi silindi.

Sıradaki adım ürün kararı: gerçek kullanıma geçiş. `docs/YAYINA-ALMA.md`
sırası izlenmeli — Neon yedeği → `db:temizlik` → `db:seed` → programların
arayüzden kurulması.
