# Aday (CRM) dış giriş entegrasyonu

Bu belge, panelin dışından aday yazan iki kanalın kurulumunu anlatır:

1. **Meta reklam formları** → entegratör (Pabbly Connect / Make) → panel
2. **tuzder.org başvuru formu** → panel

İkisi de tek uca yazar: `POST https://atolye-yonetim-sistemi.vercel.app/api/crm/aday`

---

## 1. Uç sözleşmesi

### İstek

```
POST /api/crm/aday
Authorization: Bearer <LEAD_API_TOKEN>
Content-Type: application/json
```

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `kaynak` | **evet** | `META` veya `WEB_SITESI` |
| `subeKodu` | hayır* | Aktif `Branch.code` değeri (örn. `umraniye`). Yoksa/tanınmazsa varsayılan şubeye işaretli yazılır |
| `veliAdi` | hayır | En fazla 120 karakter |
| `telefon` | hayır* | Serbest yazım; panel normalize eder |
| `eposta` | hayır | |
| `cocukAdi` | hayır | |
| `yas` | hayır | 1–25; çözülemezse boş bırakılır |
| `ilgi` | hayır | İlgilenilen program |
| `mesaj` | hayır | Form mesajı; eşlenemeyen alanlar buraya |
| `kaynakDetay` | hayır | Kampanya/form adı — anlık kopya olarak saklanır |
| `disKimlik` | hayır* | Meta `leadgen_id`. **Tekrarları önleyen anahtar** |
| `kvkkOnay` | `WEB_SITESI`'nde **evet** | `true` olmalı |
| `website` | hayır | Bal küpü; doluysa istek sessizce yutulur |

\* Zorunlu değil ama **şiddetle önerilir**: `subeKodu` olmadan aday varsayılan
şubeye düşer, `telefon` olmadan aileye dönülemez, `disKimlik` olmadan
entegratörün yeniden denemesi mükerrer aday üretir.

### Yanıtlar

| Kod | Gövde | Anlamı |
|---|---|---|
| 200 | `{"durum":"tamam","sonuc":"olusturuldu"}` | Aday açıldı |
| 200 | `{"durum":"tamam","sonuc":"tekrar"}` | Aynı `disKimlik` daha önce geldi — yazılmadı |
| 200 | `{"durum":"tamam","sonuc":"mevcuda-eklendi"}` | Aynı telefonla açık aday vardı; ona not düştü |
| 400 | `{"durum":"gecersiz-json"}` | Gövde JSON değil |
| 401 | `{"durum":"yetkisiz"}` | Jeton yanlış/eksik |
| 413 | `{"durum":"govde-buyuk"}` | Gövde 10 KB'ı aştı |
| 422 | `{"durum":"hata","alanlar":{…}}` | Doğrulama hatası (pratikte yalnız `kaynak` ve KVKK) |
| 429 | `{"durum":"cok-istek"}` | Kaynak başına saatlik 100 yazım tavanı aşıldı |
| 500 | `{"durum":"sunucu-hatasi"}` | Veritabanı erişilemedi — **yeniden deneyin** |
| 503 | `{"durum":"kapali"}` | `LEAD_API_TOKEN` tanımsız (yapılandırma eksik) |

Uç **hiçbir veri döndürmez**; yanıt yalnız durum bildirir.

### Örnek

```bash
curl -X POST https://atolye-yonetim-sistemi.vercel.app/api/crm/aday \
  -H "Authorization: Bearer $LEAD_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kaynak": "META",
    "subeKodu": "umraniye",
    "veliAdi": "Ayşe Yılmaz",
    "telefon": "0532 111 22 33",
    "cocukAdi": "Kerem",
    "yas": 7,
    "ilgi": "Hafta sonu atölyesi",
    "kaynakDetay": "Sonbahar 2026 kampanyası",
    "disKimlik": "1234567890123456",
    "kvkkOnay": true
  }'
```

---

## 2. Jeton

`LEAD_API_TOKEN` — uzun rastgele bir değer:

```bash
openssl rand -base64 32
```

- Vercel → Project → Settings → Environment Variables → **Sensitive** işaretle.
- Değişiklikten sonra **yeniden dağıtım (redeploy) gerekir**.
- Jeton yalnızca sunucu tarafında yaşar: entegratör senaryosunda ve
  `wp-config.php` benzeri bir sunucu dosyasında. **Tarayıcı JS'ine asla
  gömülmez** — uçta CORS başlığı bilerek yok, tarayıcıdan çağrılamaz.
- Rotasyon: yeni değeri üret → Vercel'e yaz → redeploy → entegratör ve site
  yapılandırmasını güncelle. Eski jeton redeploy anında geçersiz olur, bu
  yüzden sıra önemli: önce panel, hemen ardından çağıranlar.

---

## 3. Meta → entegratör kurulumu (Pabbly Connect / Make)

1. **Tetikleyici**: "Facebook Lead Ads" → sayfayı ve lead formunu seç.
   (Entegratörün Meta hesabınıza bağlanması gerekir; reklamları bir ajans
   yönetiyorsa sayfa erişimini önceden netleştirin.)
2. **Eylem**: "HTTP / Webhook" modülü
   - Method: `POST`
   - URL: `https://atolye-yonetim-sistemi.vercel.app/api/crm/aday`
   - Header: `Authorization: Bearer <LEAD_API_TOKEN>`
   - Content-Type: `application/json`
3. **Alan eşlemesi** — Meta form soruları entegratörde şu alanlara bağlanır:

   | Panel alanı | Meta karşılığı |
   |---|---|
   | `kaynak` | sabit `META` |
   | `subeKodu` | sabit (form hangi şube içinse) veya formdaki şube sorusu |
   | `veliAdi` | `full_name` (ya da `first_name` + `last_name`) |
   | `telefon` | `phone_number` |
   | `eposta` | `email` |
   | `cocukAdi` / `yas` / `ilgi` | formun özel soruları |
   | `kaynakDetay` | kampanya veya form adı |
   | `disKimlik` | **`leadgen_id`** (zorunlu gibi davranın) |
   | `kvkkOnay` | sabit `true` (aydınlatma metni Meta formunun gizlilik alanından sunuluyorsa) |

4. **Şube ayrımı**: her şube için ayrı Meta formu varsa her birine ayrı
   senaryo kurup `subeKodu`'nu sabit verin — en sağlam yol.
5. **Hata davranışı**: entegratörde "başarısız çalıştırmayı yeniden dene"
   açık olmalı. Panel 500 dönerse tekrar denenmeli; `disKimlik` sayesinde
   tekrar mükerrer aday üretmez.

### Test

Meta'nın **Lead Ads Testing Tool**'u ile
(`developers.facebook.com/tools/lead-ads-testing`) test lead'i üretin; gerçek
akışın ucundan panele düştüğünü `/koordinator/adaylar` listesinde doğrulayın.

---

## 4. tuzder.org formu

Form işleyicisi **sunucudan sunucuya** çağırır. WordPress örneği:

```php
$cevap = wp_remote_post( 'https://atolye-yonetim-sistemi.vercel.app/api/crm/aday', array(
  'timeout' => 15,
  'headers' => array(
    'Authorization' => 'Bearer ' . LEAD_API_TOKEN, // wp-config.php'de tanımlı
    'Content-Type'  => 'application/json',
  ),
  'body' => wp_json_encode( array(
    'kaynak'    => 'WEB_SITESI',
    'subeKodu'  => 'umraniye',
    'veliAdi'   => $veli_adi,
    'telefon'   => $telefon,
    'cocukAdi'  => $cocuk_adi,
    'mesaj'     => $mesaj,
    'kvkkOnay'  => true,   // onay kutusu işaretli değilse form gönderilmemeli
    'website'   => $honeypot, // gizli alan; botlar doldurur
  ) ),
) );
```

Kurallar:

- **KVKK onay kutusu ve aydınlatma metni zorunlu.** `kvkkOnay` `true`
  değilse panel 422 döner — form onay kutusuz gönderim yapmamalı.
- **Bal küpü**: formda gizli, boş bir `website` alanı bulundurun ve olduğu
  gibi iletin.
- **Jeton tarayıcıya inmemeli.** Site tamamen statikse araya küçük bir
  Cloudflare Worker koyun; jeton Worker'da dursun.
- Ek koruma için Cloudflare'da form URL'sine oran sınırlama kuralı yazın.

---

## 5. Arıza kitabı

| Belirti | Sebep | Ne yapmalı |
|---|---|---|
| Listede günlerdir Meta adayı yok | Entegratör senaryosu durmuş, Meta bağlantısı kopmuş veya kota dolmuş | Entegratör panelinden son çalıştırmaları kontrol edin. Meta lead'leri **90 gün** saklar; Ads Manager'dan CSV indirip elle girilebilir |
| Adaylar "Eksik bilgi" rozetiyle geliyor | `subeKodu` tanınmadı veya telefon/e-posta yok | Entegratör alan eşlemesini düzeltin; mevcut kayıtları panelden tamamlayın |
| Hepsi yanlış şubede | `subeKodu` sabiti yanlış | Senaryoyu düzeltin; yönetici adayları doğru şubeye taşır |
| 401 | Jeton uyuşmuyor | Vercel'deki değeri ve entegratör/site yapılandırmasını karşılaştırın (redeploy yapıldı mı?) |
| 503 `kapali` | `LEAD_API_TOKEN` tanımsız | Vercel'e ekleyip redeploy edin |
| 429 | Saatlik tavan | Beklenmedikse jeton sızıntısından şüphelenin ve rotasyon yapın |
| 500 | Veritabanı erişilemiyor (Neon kesintisi) | Entegratörün yeniden denemesine bırakın; kesinti uzarsa Meta'dan CSV kurtarma yolu açık |

Panel logları: Vercel → Project → Logs; CRM satırları `[crm]` önekiyle
başlar. **Kişisel veri loglanmaz**, yalnız olayın kendisi.
