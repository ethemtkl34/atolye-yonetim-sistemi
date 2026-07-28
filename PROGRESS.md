# İlerleme Takibi

Hangi pakette olduğumuzun tek kaynağı bu dosyadır. Her paket bittiğinde
işaretlenir ve "Şu an" satırı güncellenir.

**Şu an:** P3 — Atölye çeşitleri ve değerlendirme soruları

---

## Paketler

| # | Paket | Durum | Bitti sayılma ölçütü |
|---|---|---|---|
| P0 | Proje iskeleti | ✅ Tamam | `npm run dev` çalışır, yerel Postgres ayakta |
| P1 | Veri modeli ve seed | ✅ Tamam | 6 atölye + 60 soru veritabanında görünür |
| P2 | Kimlik doğrulama ve rol erişimi | ✅ Tamam | İki rolle giriş yapılır, stajyer koordinatör sayfasına giremez |
| P3 | Atölye çeşitleri ve sorular | 🔨 Devam | Bir atölyenin soruları diğerinden bağımsız düzenlenir |
| P4 | Dönem, takvim ve gruplar | ⬜ Bekliyor | 10 haftalık dönem + 2 grup; 4. haftada açılan grup 35 oturum alır |
| P5 | Öğrenci yönetimi | ⬜ Bekliyor | "sule" araması "Şule"yi bulur, telefonla arama çalışır |
| P6 | Kayıt ve stajyer ataması | ⬜ Bekliyor | Öğrenci gruba kaydedilir, kontenjan sayacı düşer |
| P7 | Puanlama | ⬜ Bekliyor | Kabul ölçütleri 1–12 uçtan uca çalışır |
| P8 | Kulüp yönetimi | ⬜ Bekliyor | 3 atölyelik kulüp açılır, stajyer 3 form doldurur |
| P9 | Raporlama | ⬜ Bekliyor | Rapor üretilir, puan değişince "Güncel değil" olur |
| P10 | PDF ve rapor geçmişi | ⬜ Bekliyor | PDF'te Türkçe karakterler doğru, eski PDF listede kalır |
| P11 | Dashboard ve arşiv | ⬜ Bekliyor | Dashboard sayıları listelerle birebir uyuşur |
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

---

## Geliştirme komutları

```bash
npm run db:up        # Yerel Postgres'i başlatır (Docker gerekir)
npm run dev          # Uygulamayı http://localhost:3000 adresinde açar
npm run db:migrate   # Şema değişikliğini veritabanına uygular
npm run db:seed      # Başlangıç verisini yükler
npm run db:studio    # Veritabanını tarayıcıda görüntüler
npm run typecheck    # Tip kontrolü
npm run test         # Testler
```

> Docker `colima` üzerinden çalışıyor. Bilgisayar yeniden başladıysa önce
> `colima start` çalıştırılmalı.
