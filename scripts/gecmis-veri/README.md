# Geçmiş veri aktarımı

Panel açılmadan önce yaşanmış dönemleri (2025-2026 Kış/Bahar, 2025 ve 2026 Yaz,
Drama ve Robotik kulüpleri) ve o dönemlerin PDF raporlarını sisteme aktarır.

Amaç **yalnızca geçmişi takip etmek**: öğrencinin profilinde hangi dönemde
hangi sınıfta olduğu ve o dönemin raporu görünsün. Bu dönemlerin puanlaması ve
müfredatı yok, dolayısıyla `Term.gecmisVerisi` / `Club.gecmisVerisi` ile
**rapor üretimine kapalıdırlar** — sistem bunlar için yeni rapor üretemez.

## Sıra

```bash
# 1) Kaynakları oku, temizle, eşleştir. Veritabanına DOKUNMAZ.
python3 scripts/gecmis-veri/hazirla.py

# 2) cikti/denetim.md'yi oku. Sayılar ve uyarılar beklendiği gibi mi?

# 3) Yaz.
npx tsx --env-file=.env.local scripts/gecmis-veri/aktar.ts

# Geri almak gerekirse:
ONAY=EVET npx tsx --env-file=.env.local scripts/gecmis-veri/geri-al.ts
```

## Çıktılar (`cikti/`)

| Dosya | Ne |
| --- | --- |
| `gecmis-veri.json` | 2. aşamanın girdisi — yazılacak her şey |
| `denetim.md` | Sayılar, uygulanan düzeltmeler, uyarıların tamamı |
| `raporsuz-ogrenciler.xlsx` | Kaydı olup raporu bulunamayan öğrenciler |
| `manifest.json` | Yazılan satırların kimlikleri — `geri-al.ts` bunu okur |

`cikti/` sürüm kontrolüne girmez (bkz. `.gitignore`): `gecmis-veri.json`
içinde velilerin telefon numaraları var.

## Kaynak dosyalar

`hazirla.py` başındaki `EXCEL` ve `PDF_KOK` sabitleri. Varsayılan:
`~/Downloads/atölye eski öğrenci dataları.xlsx` ve
`~/Downloads/sendgb-UOsCRqp6nQS/`.

## Şube kararı

`hazirla.py` içindeki `UST_BLOK_SUBE` / `ALT_BLOK_SUBE` sabitleri. Şu an ikisi
de `umraniye` — bütün PDF kapaklarında "ÜMRANİYE - DAHİ PARK" yazdığı için.

Not: Excel ana sayfasında satır 229'dan sonra "1.Kur - Ümraniye" etiketli ayrı
bir blok var. Üst blok tek başına Bahar için ~211 kayıt üretiyor ve elde tam
211 Bahar raporu var; alt blok eklendiğinde Bahar mevcudu artıyor ve raporsuz
kayıt sayısı büyüyor. Bu, iki bloğun aslında iki ayrı şube olabileceğine işaret
eder. Karar değişirse `ALT_BLOK_SUBE = "gunesli"` yapılıp `geri-al` + `aktar`
yeniden koşulur.
