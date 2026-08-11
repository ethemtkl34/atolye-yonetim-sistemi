# Tasarım dili — "kil" (soft clay)

Panelin görsel dili düz kartlardan **kil** yüzeylere geçti. Bu belge kuralı
tek yerde toplar; yeni ekran yazarken buraya bakılır. Sınıfların kendisi
`src/app/globals.css` içinde `@layer components` altındadır.

## Fiziksel model

Tek bir malzeme ve tek bir ışık kaynağı var. Bütün ekranlar buna uyar:

- **Işık sol üstten gelir.** Her kabartmanın açık kenarı sol-üstte, koyu
  gölgesi sağ-alttadır. Ters yönde gölge yazılan bir yüzey, sayfada ikinci
  bir ışık kaynağı varmış gibi görünür ve bütün ekranı bozar.
- **Kabarık yüzey = dokunulabilir ya da bir şeyi taşıyan şey.** Kart, buton,
  rozet. Yükseklik önemine göre üç kademe: `--kil-e1` (küçük parça),
  `--kil-e2` (kart), `--kil-e3` (pencere).
- **Gömük yüzey = içine bir şey yazılan ya da seçili olan şey.** Girdi, arama
  kutusu, basılı buton, seçili süzgeç, boş durum kutusu: `--kil-ic`.
- **İç içe iki kabartma olmaz.** Kartın içindeki ikincil kutu `kil-oyuk`
  olur. Kabartma üstüne kabartma "iki ayrı kart" gibi okunuyor.

Gölge renkleri sayfa zeminine (`--color-yuzey-50`) göre ayarlıdır. Zemin
değişirse `--kil-golge` de değişmeli, yoksa gölgeler kirli görünür.

## Sınıflar

| Sınıf | Nerede |
| --- | --- |
| `kil-yuzey` | Kart. `@/components/ui`'daki `Kart` bunu kullanır. |
| `kil-satir` | Tıklanabilir liste satırı — karttan az kabarır, basılınca gömülür. |
| `kil-kutu` | Tıklanabilir büyük kutu (öğrenci profilindeki bölüm kutuları). |
| `kil-oyuk` | Kartın içindeki ikincil kutu, önizleme alanı, metin gövdesi. |
| `kil-buton` + `kil-buton-birincil\|ikincil\|tehlike\|sade` | Buton. `Buton`/`butonStili` bunları kullanır. |
| `kil-girdi` | input / textarea / select. `Girdi`, `CokSatirli`, `secimStili` bunu kullanır. |
| `kil-cip` | Gömük bilgi çipi ve **seçili** süzgeç. |
| `kil-rozet` | Küçük kabarık hap: sayı rozeti, kapatma düğmesi, avatar. |
| `kil-bos` | Boş durum. `BosDurum` bunu kullanır. |
| `kil-uyari` | Sarı uyarı şeridi (güvenlik notu). |
| `kil-pencere` | `<dialog>`. `Pencere` bunu kullanır. |
| `kil-bolmeli` | Alt alta satırlar arasında oyuk ayraç (`divide-y` yerine). |
| `kil-ikon` | Renkli ikon plakası; rengi `--kil-renk` / `--kil-renk-koyu` ile gelir. |
| `kil-menu-aktif` / `kil-menu-oge` | Koyu sol menüde seçili / seçili olmayan satır. |
| `kil-koyu-yuzey` | Koyu mürdüm zeminde kabarık yüzey. |

## Kurallar

1. **Önce bileşen, sonra sınıf.** Yeni ekranda `Kart`, `Buton`, `Girdi`,
   `BosDurum`, `Pencere` kullanılır; kil sınıfları yalnızca bu bileşenlerin
   karşılamadığı yerlerde elle yazılır.
2. **Rozetler kabarmaz.** Bir kartta üç dört rozet yan yana duruyor; hepsi
   kabarınca yüzey kabarcık tarlasına dönüyor. Rozette kil hissi yalnızca üst
   kenardaki ışık çizgisinden gelir.
3. **Anlam rengi dokudan önce gelir.** Olumlu/uyarı/hata renkleri (emerald,
   vurgu, red) korunur; kil yalnızca yüzeyin dokusudur.
4. **Dokunma hedefleri küçülmez.** Telefonda buton ve girdi en az 44px
   (`min-h-[2.75rem]`), masaüstünde 36px'e iner.
5. **Hareket azaltma.** Kabartma geçişleri `prefers-reduced-motion` altında
   kapanır; bu globals.css'te bir kez tanımlıdır.
