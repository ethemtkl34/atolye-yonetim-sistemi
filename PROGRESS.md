# İlerleme Takibi

Hangi pakette olduğumuzun tek kaynağı bu dosyadır. Her paket bittiğinde
işaretlenir ve "Şu an" satırı güncellenir.

**Şu an:** P1 — Prisma veri modeli ve seed

---

## Paketler

| # | Paket | Durum | Bitti sayılma ölçütü |
|---|---|---|---|
| P0 | Proje iskeleti | ✅ Tamam | `npm run dev` çalışır, yerel Postgres ayakta |
| P1 | Veri modeli ve seed | 🔨 Devam | 6 atölye + 60 soru veritabanında görünür |
| P2 | Kimlik doğrulama ve rol erişimi | ⬜ Bekliyor | İki rolle giriş yapılır, stajyer koordinatör sayfasına giremez |
| P3 | Atölye çeşitleri ve sorular | ⬜ Bekliyor | Bir atölyenin soruları diğerinden bağımsız düzenlenir |
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
