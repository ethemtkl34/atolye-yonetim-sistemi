# Yayına Alma (Vercel + Neon)

Uygulamayı internete açma adımları. Sıra önemli: veritabanı önce hazır olmalı,
yoksa ilk derleme migration adımında durur.

## Neden bu ikili

| Katman | Seçim | Gerekçe |
|---|---|---|
| Uygulama | **Vercel** | Next.js'i yapan şirket; bu sürüm için ayar gerektirmiyor |
| Veritabanı | **Neon** (Postgres) | Vercel'in önerdiği ve Vercel Postgres'in altında çalıştırdığı servis |
| Adres | **atolye-yonetim-sistemi.vercel.app** | Vercel'in verdiği kalıcı adres; kurum kendi alt alan adını istemedi (bkz. §6) |

**Bilinmesi gereken:** Vercel'in ücretsiz **Hobby** planı sözleşmesinde ticari
kullanıma kapalıdır — plan "kişisel, ticari olmayan" kullanım için tanımlanmış.
Kurum gelir getiren bir hizmeti buradan yürütmeye başlarsa Pro plana
(20 $/ay) geçmek gerekir. Deneme ve iç kullanım için ücretsiz plan yeterli.

---

## 1. Veritabanı (Neon)

1. [neon.tech](https://neon.tech) → GitHub ile giriş → **Create project**
2. Bölge: **AWS eu-central-1 (Frankfurt)** — Türkiye'ye en yakın olanı, gecikme
   en az burada olur.
3. Proje açılınca **Connection string** kutusundan **Pooled connection**
   seçeneğini kopyalayın. Havuzlu (pooled) adres şart: Vercel her istekte yeni
   bir sunucu örneği açabildiği için havuzsuz adres bağlantı sınırını doldurur.

Adres şuna benzer:

```
postgresql://kullanici:parola@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

## 2. Kodu GitHub'a gönderme

```bash
gh repo create atolye-yonetim-sistemi --private --source=. --push
```

Depo **private** olmalı: şema öğrenci sağlık bilgisi ve veli telefonu
alanlarını içeriyor, bunların yapısı bile dışarı açık durmamalı.

## 3. Vercel projesi

1. [vercel.com](https://vercel.com) → GitHub ile giriş → **Add New → Project**
2. `atolye-yonetim-sistemi` deposunu içe aktarın.
3. Framework kendiliğinden **Next.js** görünür; derleme ayarlarına dokunmayın.
   `package.json` içindeki `vercel-build` betiği zaten önce migration'ları
   uygulayıp sonra derliyor.
4. **Environment Variables** bölümüne şunları girin:

| Anahtar | Değer |
|---|---|
| `DATABASE_URL` | Neon'dan aldığınız **pooled** adres |
| `AUTH_SECRET` | `openssl rand -base64 32` çıktısı (aşağıya bakın) |
| `AUTH_URL` | `https://atolye-yonetim-sistemi.vercel.app` |
| `NEXT_PUBLIC_KURUM_ADI` | `TÜZDER` |
| `LEAD_API_TOKEN` | `openssl rand -base64 32` çıktısı — **Sensitive** işaretleyin |

`LEAD_API_TOKEN` aday (CRM) dış giriş ucunun jetonudur: Meta reklam
formlarını taşıyan entegratör ve tuzder.org başvuru formu bu jetonla yazar.
Kurulum adımları `docs/CRM-ENTEGRASYON.md` içinde. Değişkeni değiştirdikten
sonra **yeniden dağıtım gerekir**; jeton tanımsızken uç 503 döner (aday
yazılmaz, panel çalışmaya devam eder).

Yeni bir `AUTH_SECRET` üretmek için:

```bash
openssl rand -base64 32
```

Bu değer oturum çerezlerini şifreler. **Geliştirmedeki değeri kullanmayın**;
`.env` dosyasındaki anahtar depoda olmasa da geçici bir yer tutucudur.

5. **Deploy**.

İlk derleme sırasında `prisma migrate deploy` çalışır ve 18 tablo boş
veritabanında oluşur.

## 4. Başlangıç verisi

Derleme bittikten sonra atölyeler, sorular ve hesaplar henüz yok. Kendi
bilgisayarınızdan üretim veritabanına bir kez seed çalıştırın:

```bash
DATABASE_URL="<neon-pooled-adresi>" npm run db:seed
```

Bu 6 atölye, 60 soru ve 3 kullanıcı hesabı oluşturur. `db:seed` idempotenttir,
yanlışlıkla iki kez çalıştırmak kopya üretmez.

**Parola ekrana bir kez basılır — kaydedin.** Depo herkese açık olduğu için
`seed.ts` içindeki sabit parola yalnızca yerel veritabanında kullanılır.
Uzak bir adrese seed çalıştırıldığında betik rastgele bir parola üretip
gösterir:

```
──────────────────────────────────────────────────────────────
  Başlangıç hesaplarının parolası (rastgele üretildi):

      xK3n9-fQ2mRt7pLwZa4bVc

  Bu parola bir daha gösterilmeyecek. Şimdi kaydedin ve ilk
  girişten sonra kurumun kendi hesaplarını oluşturun.
──────────────────────────────────────────────────────────────
```

Kendi parolanızı belirlemek isterseniz:

```bash
DATABASE_URL="<neon-pooled-adresi>" SEED_PASSWORD="secdiginiz-parola" npm run db:seed
```

**`db:ornek-veri` üretimde çalıştırılamaz** — 18 uydurma öğrenci ve 1670
uydurma puan yazdığı için uzak veritabanı gördüğünde kendini durdurur.

## 5. İlk giriş

`https://atolye-yonetim-sistemi.vercel.app` adresine gidip
`koordinator@tuzder.local` ve bir önceki adımda gösterilen parolayla girin.

Gerçek kullanıma geçmeden önce kurumun kendi hesapları açılmalı ve bu üç
başlangıç hesabı pasife alınmalı. Koordinatör panelindeki **Stajyerler**
ekranı stajyer hesaplarını yönetiyor; koordinatör hesabı için parola değişimi
henüz arayüzde yok (bkz. Bilinen eksikler).

## 6. Alan adı

Sistem **Vercel'in verdiği adreste kalıyor**: `atolye-yonetim-sistemi.vercel.app`.

Bir dönem `panel.tuzder.org` alt alan adı düşünüldü ve Vercel tarafında
tanıtıldı; kurum kendi alan adına taşınmasını istemediği için Cloudflare'de
DNS kaydı hiç yazılmadı ve bu plandan vazgeçildi. `AUTH_URL` zaten vercel.app
adresini gösteriyor, yapılacak bir şey yok.

Adres ileride yine değiştirilmek istenirse üç yer birlikte güncellenmeli:
Vercel → Settings → Domains, `AUTH_URL` ortam değişkeni ve
`docs/CRM-ENTEGRASYON.md` içindeki uç adresi.

---

## Bilinen eksikler

Yayına almadan önce bilinmesi gerekenler. Hiçbiri engelleyici değil ama
kurum gerçekten kullanmaya başlamadan kapatılmalı:

- **Koordinatör parolası arayüzden değiştirilemiyor.** Şu an yalnızca
  veritabanından veya seed üzerinden değişiyor.
- **Yedekleme yok.** Neon'un ücretsiz planında geriye dönük kurtarma
  penceresi **6 saat** (`history_retention_seconds = 21600`); daha eski bir
  hata geri alınamaz. Kurumun kendi yedek politikası ayrıca düşünülmeli.
- **Veritabanı ücretsiz planın sınırına doğru büyüyor.** 4 Eylül 2026
  ölçümü: 162 MB / 512 MB, ve bunun 133 MB'ı `LegacyReport.fileData`
  (351 arşiv PDF'i, ortalama 389 KB). İkinci bir arşiv aktarımı sınırı
  zorlar; o noktada ya Neon planı yükseltilmeli ya PDF'ler nesne deposuna
  taşınmalı (bkz. `rapor-pdf` rotasının `fileUrl` notu).
- **`npm audit` üretim bağımlılıklarında 4 yüksek uyarı veriyor.** Dördü de
  `prisma` CLI'nın içindeki `mysql2` ve `deepmerge-ts` paketlerinden geliyor;
  `--force` düzeltmesi Prisma'yı 6'ya düşürüyor, o yüzden uygulanmadı. Bu
  uygulama MySQL sürücüsünü hiç çalıştırmıyor (bağlantı `@prisma/adapter-pg`
  üzerinden), `prisma` da yalnızca derleme/migration adımında koşuyor.
  Next.js kaynaklı `sharp` uyarıları 16.3.4 yükseltmesiyle kapandı.
- **Hobby planının ticari kullanım kısıtı** yukarıda anlatıldı.
