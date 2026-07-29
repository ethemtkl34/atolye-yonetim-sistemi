# Yayına Alma (Vercel + Neon)

Uygulamayı internete açma adımları. Sıra önemli: veritabanı önce hazır olmalı,
yoksa ilk derleme migration adımında durur.

## Neden bu ikili

| Katman | Seçim | Gerekçe |
|---|---|---|
| Uygulama | **Vercel** | Next.js'i yapan şirket; bu sürüm için ayar gerektirmiyor |
| Veritabanı | **Neon** (Postgres) | Vercel'in önerdiği ve Vercel Postgres'in altında çalıştırdığı servis |
| Adres | `*.vercel.app` | Ücretsiz ve anında gelir |

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
| `AUTH_URL` | `https://<proje-adı>.vercel.app` |
| `NEXT_PUBLIC_KURUM_ADI` | `TÜZDER` |

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

`https://<proje-adı>.vercel.app` adresine gidip `koordinator@tuzder.local`
ve bir önceki adımda gösterilen parolayla girin.

Gerçek kullanıma geçmeden önce kurumun kendi hesapları açılmalı ve bu üç
başlangıç hesabı pasife alınmalı. Koordinatör panelindeki **Stajyerler**
ekranı stajyer hesaplarını yönetiyor; koordinatör hesabı için parola değişimi
henüz arayüzde yok (bkz. Bilinen eksikler).

## 6. Kendi alan adınız (isteğe bağlı)

Kurumun **tuzder.org** alan adı zaten var; bir alt alan adı ek ücret
istemez ve `vercel.app` adresinden çok daha kurumsal görünür:

1. Vercel → proje → **Settings → Domains** → `atolye.tuzder.org` ekleyin.
2. Vercel bir CNAME kaydı verir; bunu alan adı sağlayıcınızın DNS panelinde
   tanımlayın.
3. Sertifika kendiliğinden gelir.
4. **`AUTH_URL`'i yeni adrese güncellemeyi unutmayın**, yoksa giriş sonrası
   yönlendirme eski adrese gider.

---

## Bilinen eksikler

Yayına almadan önce bilinmesi gerekenler. Hiçbiri engelleyici değil ama
kurum gerçekten kullanmaya başlamadan kapatılmalı:

- **Koordinatör parolası arayüzden değiştirilemiyor.** Şu an yalnızca
  veritabanından veya seed üzerinden değişiyor.
- **Yedekleme yok.** Neon'un ücretsiz planı belli bir süre geriye dönük
  kurtarma veriyor; kurumun kendi yedek politikası ayrıca düşünülmeli.
- **`npm audit` üretim bağımlılıklarında 4 uyarı veriyor** (3 yüksek,
  1 orta). Üçü de Next.js'in içindeki `sharp` ve `postcss` paketlerinden
  geliyor ve Next.js'in en güncel sürümünde (16.2.12) henüz düzeltilmiş
  değil — `npm audit fix --force` Next'i 9.3.3'e düşürmeyi öneriyor, ki bu
  yapılamaz. `sharp` yalnızca `next/image` ile çalışır, bu uygulama görsel
  optimizasyonu kullanmıyor; `postcss` derleme anında çalışıyor, çalışma
  anında değil. Next.js yama yayınladığında sürüm yükseltilmeli.
- **Hobby planının ticari kullanım kısıtı** yukarıda anlatıldı.
