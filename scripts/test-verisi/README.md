# Rapor deneme verisi

Rapor çıktısının uçtan uca denenebilmesi için canlı veritabanındaki eksik
verileri dolduran betikler. Ümraniye Tüzder / 2026 Sonbahar Dönemi'ne göre
yazıldı.

Buradaki hiçbir şey uygulama koduna dokunmaz; `src/` altında tek satır
değişiklik yok. Betikler yalnızca veri yazar ve yazdığı her satırın kimliğini
`manifest.json` dosyasına düşürür.

## Çalıştırma

```bash
npx tsx --env-file=.env.local scripts/test-verisi/uret.ts
npx tsx --env-file=.env.local scripts/test-verisi/mufredat-uret.ts
npx tsx --env-file=.env --env-file=.env.local scripts/test-verisi/rapor-dogrula.ts
```

`rapor-dogrula.ts` iki env dosyasını birden okur: `AUTH_SECRET` `.env` içinde
ve `lib/db` → `lib/env` zinciri onu doğrulamadan yüklenmiyor.

Betikler tekrar çalıştırılabilir: var olan satırı ezmez, eksik olanı tamamlar.
Puanlar tohumlu üreticiden çıktığı için ikinci çalıştırma aynı sonucu verir.

| Betik | Ne yapar |
| --- | --- |
| `uret.ts` | Eksik `ScoreAnswer`, `DevelopmentAssessment` (DONEM_SONU) ve gözlem notları |
| `mufredat-uret.ts` | Eksik `CurriculumEntry` haftaları + yapay zekâ ile `AtolyeIcerigi` |
| `rapor-dogrula.ts` | Dört öğrenci için rapor üretir, `cikti/` altına PDF ve gövde JSON'u yazar |
| `geri-al.ts` | Manifest'teki her şeyi geri alır |

## Geri alma

```bash
ONAY=EVET npx tsx --env-file=.env.local scripts/test-verisi/geri-al.ts
```

Onaysız çalıştırıldığında ne silineceğini yazar, hiçbir şeye dokunmaz.

Gözlem notları silinmez, **eski değerine döner**: `manifest.json` her not için
üstüne yazılan önceki metni (`oncekiDeger`) saklıyor. Üç notta bu değer dolu —
üretimde duran o üç not sıfat cümlelerinden oluşuyordu ve rapor motoruna
verecek somut davranış içermiyordu, bu yüzden değiştirildi.

## Veri neden elle yazıldı

`ogrenci-profilleri.ts` içindeki puan hedefleri, gelişim değerlendirmesi ve
gözlem notları tek bir karakter tarifinden türüyor. Üçü ayrı ayrı üretilseydi
rapor kendi içinde çelişirdi: robotikte "Düşük" kademe çıkan bir öğrencinin
gözlem metni robotiği parlatırsa, uydurma denetimi anlamını yitirir.

Hedef ortalamalar kademe eşiklerini üç banda yayacak biçimde seçildi — atölye
kademesi mutlak eşikle (≥4,0 Yüksek, <3,0 Düşük), gelişim kademesi grup
ortalamasına kıyasla (±0,25) çalışıyor. Bazı öğrencilerde ilgi ile başarı
kasten bir tam kademe ayrıldı ki `asimetriBul` bulgusu da çıktıda görünsün.
