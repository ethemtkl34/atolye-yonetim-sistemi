# Aday (CRM) tanıtım verisi

Aday modülü canlıya boş çıktı. Bu betikler ekranların dolu hâlini görmek ve
danışmanlara göstermek için **sahte** aday kaydı yazar.

```bash
# Yazmak
npx tsx --env-file=.env.local scripts/ornek-aday/uret.ts

# Geri almak (yalnız manifest.json'daki kayıtları siler)
npx tsx --env-file=.env.local scripts/ornek-aday/geri-al.ts
```

## Neden güvenli

- Veli adının sonunda **"(örnek)"** var — listede tek bakışta ayrılır.
- Telefonlar **0500** ile başlıyor. Türkiye'de mobil önekler 053X/054X/055X;
  0500 hiçbir aboneye tahsis edilmemiş, yanlışlıkla arayan gerçek birine
  ulaşmaz.
- Yazılan her satırın kimliği `manifest.json`a düşer; `geri-al.ts` yalnız o
  kimlikleri ve yalnız "(örnek)" işaretli satırları siler.
- Öğrenci, veli veya kayıt **yaratmaz**. "Kazanıldı" örneği yalnız
  `convertedAt` damgası taşır.
- Tekrar çalıştırılabilir: aynı telefon zaten varsa o aday atlanır.

## İçerik

12 aday, iki şubeye dağılmış; boru hattının bütün aşamaları, dört kaynak,
gecikmiş/bugün/ileri tarihli takipler, ulaşılamayan denemeler, kayıp sebepleri
ve etkinlik geçmişi. Kaynak raporunun ve "bugün aranacaklar" kuyruğunun dolu
görünmesi için yeterli.
