# Aday → Gerçek Randevu Entegrasyonu (uygulanmayı bekleyen plan)

> Bu dosya henüz UYGULANMAMIŞ bir tasarım planıdır — `docs/DECISIONS.md`'deki
> kesinleşmiş kararlardan farklı olarak, bu bir sonraki geliştirme turunun
> yol haritasıdır. Uygulandıktan sonra ilgili kararlar `DECISIONS.md`'ye
> taşınmalı ve bu dosya silinmeli/arşivlenmelidir.

## Bağlam

Şu an **Adaylar (CRM)** ve **Randevular** modülleri birbirinden tamamen kopuk. Bir adayın aşamasını "Randevu ver…" ile ilerletmek, sadece `Lead.appointmentAt` adında düz bir tarih alanını dolduruyor ve serbest metinli bir aktivite notu yazıyor — gerçek `Randevu` tablosuna hiçbir satır düşmüyor. Bu yüzden:

- Adaylar'dan verilen "randevu" gerçek takvimde (hangi hoca, hangi hizmet, çakışma var mı) hiç görünmüyor.
- Aynı bilgi iki kez, iki farklı biçimde tutulma riski taşıyor (biri düz metin, biri gerçek kayıt).
- Kullanıcının deyimiyle bu "mimari bir hata": aday boru hattındaki randevu verme eylemi ile asıl randevu sistemi (uzman/hizmet/veli/çakışma kontrolü olan) aynı gerçekliği paylaşmıyor.

Amaç: "Randevu ver…" butonuna basıldığında gerçek `Randevu` sistemine, gerçek bir kayıt olarak düşen, çakışma kontrolünden geçen, hem Randevular takviminde hem Adaylar sayfasında görünen TEK bir akış kurmak.

Kullanıcıyla netleşen tasarım kararları:
1. **Akış**: "Randevu ver…" → önce **hizmet** seçilir (Zeka Testi, Danışmanlık…) → sonra **haftalık ızgara** (gün sütunlu, hocalar renkli karışık — az önce yapılan `HaftaIzgarasi` görünümünün aynısı) açılır → boş bir güne/saate tıklanınca küçük bir onay formu açılır (gün/saat/hizmet zaten dolu, veli adaydan otomatik, kullanıcı sadece **hangi uzman** olduğunu seçip kaydeder) → sunucu çakışma kontrolünü yapar → pencereler kapanır.
2. **Tekrar yok**: bu akıştan açılan randevu her zaman TEK seferliktir (haftaSayisi=1). Seri gerekiyorsa sonradan Randevular ekranından normal yoldan açılır.
3. **Eski 3 alanlı pencere tamamen kaldırılıyor** — iki ayrı "randevu verme" yolu bırakılmayacak.

---

## Mimari yaklaşım

### 1. Şema: `Randevu.leadId` (yeni migration)

`prisma/schema.prisma` → `Randevu` modeline, `ogrenciId` ile aynı desende nullable bir alan:

```prisma
/// Bu randevunun aday boru hattından mı açıldığı. Nullable + SetNull:
/// aday silinirse randevu SİLİNMEZ — gerçek bir hizmet/ciro kaydı, aday
/// bağı yalnız köken bilgisi (convertedStudentId ile aynı ilke).
leadId String?
lead   Lead?   @relation(fields: [leadId], references: [id], onDelete: SetNull)
```
`@@index([leadId])` eklenir. `Lead` modeline karşılık ilişki: `randevular Randevu[]`.

Migration: `prisma/migrations/20260910120000_randevu_lead_baglantisi/migration.sql` (son migration `20260904160000_randevu` idi, tarih sırası korunuyor):
```sql
ALTER TABLE "Randevu" ADD COLUMN "leadId" TEXT;
CREATE INDEX "Randevu_leadId_idx" ON "Randevu"("leadId");
ALTER TABLE "Randevu" ADD CONSTRAINT "Randevu_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

`Lead.appointmentAt` alanı **korunuyor** (yeni randevunun `baslangic`'inden yazılmaya devam eder) — ucuz bir gösterim alanı olarak kalıyor; gerçek kaynak artık `Randevu.leadId` üzerinden erişilebilir linked kayıt. Aday detay sayfasındaki mevcut "Randevu" alanı değişmiyor, sadece kod yorumuyla bunun artık gerçek bir randevudan geldiği not düşülüyor.

### 2. Paylaşılan mantığın çıkarılması (tekrarsız, tek kaynak)

Bugün `randevuEkle` (`src/app/koordinator/randevular/actions.ts`) içindeki iki özel yardımcı **private** ve yalnız o dosyada yaşıyor. Yeni aday-tarafı eylemi de AYNI kurallara ihtiyaç duyduğu için ikisi paylaşılan bir yere taşınıyor (davranış değişmez, saf taşıma):

- **`veliyiCoz`** (satır ~105-144) → **`src/lib/randevu/veli.ts`** (yeni dosya; `src/lib/veli.ts` zaten var ama o öğrenci/Guardian tarafının FARKLI bir fonksiyonu — isim çakışması yok, ayrı dosya). `randevuEkle` bunu import eder, davranış birebir aynı kalır.
- **`uzmanBaglami`** (satır ~49-90) → **`src/lib/randevu/uzman-baglami.ts`** (yeni dosya; DB'ye dokunduğu için `cakisma.ts` gibi "SAF" değil, bu açıkça yorumla belirtilir). `randevuEngeli` (asıl karar fonksiyonu) zaten `src/lib/randevu/cakisma.ts`'te saf ve değişmeden kalıyor.

Bu ikisi taşınınca hem `randevuEkle` hem yeni aday eylemi **aynı** çakışma/veli kurallarını import eder — kural iki yerde ayrı ayrı yazılmaz.

### 3. Hafta ızgarası verisinin yeniden kullanılabilir hâle getirilmesi

`src/app/koordinator/randevular/page.tsx` içindeki randevu sorgusu + `satirlar` eşlemesi (branch'e göre PII gizleme dahil) bugün sayfaya gömülü. Yeni dosya **`src/lib/randevu/hafta-verisi.ts`**:

```ts
export async function randevuSatirlariGetir(args: {
  subeId: string; aralik: TakvimAraligi;
  uzmanSuzgeci?: string; hizmetSuzgeci?: string; iptalleriGoster?: boolean;
}): Promise<RandevuSatiri[]>   // page.tsx'teki sorgu + map, birebir taşınmış

export async function haftaRandevuVerisi(args: {
  subeId: string; capa: Date; uzmanSuzgeci?: string; hizmetSuzgeci?: string; iptalleriGoster?: boolean;
}): Promise<{ baslik: string; sutunlar: HaftaSutunu<RandevuSatiri>[]; eksen: IzgaraEkseni; toplam: number }>
```

`page.tsx` kendi randevu sorgusunu `randevuSatirlariGetir(...)` çağrısıyla değiştirir; `gunlereBol`/`haftaSutunlariniOlustur`/`haftaEkseni` bileşimini olduğu gibi kendi içinde tutmaya devam eder (davranış değişmez — bu SADECE regresyon riskini azaltan bir taşıma). `haftaRandevuVerisi()` yalnız yeni aday-akışı tarafından kullanılır.

**Yeni salt-okunur eylem** (hafta gezinme için, `src/app/koordinator/randevular/actions.ts`'e eklenir):
```ts
export async function haftaRandevuVerisiEylemi(tarih: string) {
  const kullanici = await yonetimZorunlu("randevular"); // GÖRÜNTÜLE yeter
  return haftaRandevuVerisi({ subeId: kullanici.aktifSubeId, capa: tarihCozumle(tarih) ?? bugun() });
}
```

### 4. Izgara gövdesinin paylaşılması (mevcut `HaftaIzgarasi` bozulmadan)

`hafta-izgarasi.tsx`'in bugünkü tüm dış API'si (`baslik/sutunlar/eksen/iptalleriGoster/yazabilir/kurumAdi/toplam/geriYolu/ileriYolu/bugunYolu/iptalYolu` — hepsi URL/`Link` tabanlı) **hiç değişmiyor**; Randevular sayfasındaki kullanım aynen kalır. Onun yerine ızgaranın GÖVDESİ (başlık satırı + saat çizgileri + gün sütunları + bloklar — mevcut dosyanın 117-243. satırları) yeni bir dosyaya çıkarılıyor:

**`src/app/koordinator/randevular/hafta-izgarasi-govde.tsx`**:
```tsx
export function HaftaIzgarasiGovdesi({
  sutunlar, eksen,
  bosAlanTiklanabilir = false,       // yalnız aday akışında true
  onBlokTikla,                        // mevcut davranış: detay penceresi
  onBosAlanaTikla,                    // (gun: Date, saat: string) => void — yeni
}: {...}) { /* aynı JSX; gün sütunu div'ine SADECE bosAlanTiklanabilir
               iken onClick eklenir: tıklama noktasının oranını al →
               orandanDakika → dakikayiSaateCevir → onBosAlanaTikla(gun, saat).
               Blok butonunun onClick'i her zamanki gibi
               olay.stopPropagation() yapar (izgara.tsx'teki aynı desen). */ }
```
`HaftaIzgarasi` kendi gövdesini bu bileşene devreder (`onBlokTikla={(r) => setDetay(r)}`, diğer ikisi verilmez → varsayılan `false`/`undefined`). Randevular sayfası için **hiçbir davranış değişmez**; yeni tıklama mantığı sadece bu paylaşılan bileşende, sadece aday akışı onu etkinleştirdiğinde çalışır.

### 5. Yeni sunucu eylemi: aday-farkında randevu oluşturma

`src/app/koordinator/adaylar/sema.ts`: eski `randevuSemasi`/`RANDEVU_FORM_ALANLARI` (yalnız tarih/saat/not) kaldırılır, yerine:
```ts
export const randevuVerSemasi = z.object({
  hizmetId: z.string().min(1, "Hizmet seçin"),
  uzmanId: z.string().min(1, "Uzman seçin"),
  tarih: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin"),
  saat: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saati SS:DD biçiminde girin"),
  not: /* mevcut ≤500/2000 karakter kalıbıyla, opsiyonel */,
});
export const RANDEVU_VER_FORM_ALANLARI = ["hizmetId", "uzmanId", "tarih", "saat", "not"] as const;
```
Dikkat: `veliId`/`yeniVeliAdi` YOK — veli kimliği hiçbir zaman formdan değil, doğrudan `Lead.parentName`/`Lead.phone`'dan okunur (kullanıcı tarafından değiştirilemez, adayın kendi kaydı esas alınır).

`src/app/koordinator/adaylar/actions.ts` → `randevuVer` **aynı isim ve imzayla** (çağrı yerleri, `.bind(null, adayId)` deseni değişmez) baştan yazılır:
1. `yonetimZorunlu("adaylar", "TAM")`.
2. `randevuVerSemasi.safeParse(...)`.
3. `db.lead.findFirst({ id, branchId })` → yoksa/kapalıysa hata; `parentName` boşsa "önce veli adını kaydedin" hatası.
4. `tarih+saat` → `baslangic` (Date).
5. `db.uzmanHizmet.findUnique({ uzmanId_hizmetId })` ile uzman/hizmet uygunluğu, aktiflik, şube kontrolü — **`randevuEkle`'deki aynı kontrol sırası**.
6. `randevuAraligi(baslangic, hizmet.sureDk)` (`lib/randevu/cakisma.ts`, tek aralık, seri yok) → `uzmanBaglami(...)` → `randevuEngeli({ randevu: aralik, ...baglam })`. Engel varsa mesajı aynen forma döner (kullanıcı başka gün/uzman dener).
7. `db.$transaction`: `veliyiCoz(tx, { subeId, veliId: null, ad: aday.parentName, telefon: aday.phone })` → `tx.randevu.create({ ..., leadId: adayId, ucretKurus: hizmet.ucretKurus })` → `tx.lead.updateMany({ where: {..., stage: aday.stage} , data: { stage: "RANDEVU_VERILDI", appointmentAt: aralik.baslangic, nextActionDate: gun, unreachableCount: 0, lastContactAt: now } })` (0 satır dönerse TÜM işlem geri alınır — "aday bu sırada değişti" hatası) → `LeadActivity` (gerekirse `ASAMA_DEGISIMI` + her zaman bir `SISTEM` notu: `"Randevu verildi: {hizmet.ad} · {uzman.ad} · {zamanMetni(baslangic)}"`).
8. `adayYollariniTazele(adayId)` (mevcut yardımcı) + `revalidatePath("/koordinator/randevular")` (yeni — artık o modülü de etkiliyor) → `{ basari: "Randevu kaydedildi." }`.

### 6. Yeni arayüz bileşenleri (`src/app/koordinator/adaylar/[id]/` altında)

- **`randevu-onay-formu.tsx`** → `RandevuOnayFormu`: `RandevuFormu`'nun (randevular modülü) KOPYASI/varyantı DEĞİL, ayrı ve küçük bir bileşen — çünkü seçim sırası ters (önce hizmet, burada uzman hizmete göre filtreleniyor), veli hiç sorulmuyor (salt okunur gösterim), `haftaSayisi`/indirim alanları yok. `useEklemePaneli(randevuVer.bind(null, adayId))` + `useBasaridaKapat` (aday modülünün KENDİ idiomu, `aday-asama-eylemleri.tsx`'teki `KayipPenceresi`/`DonusumPenceresi` ile aynı desen — `randevu-formu.tsx`'in `useActionState` idiomu değil). Alanlar: gizli `hizmetId`, salt-okunur veli kutusu, `uzmanId` seçici (yalnız o hizmeti yapabilen + bu şubede çalışan uzmanlar), `tarih`/`saat` (tıklanan hücreden dolu, düzenlenebilir), `not`.
- **`randevu-hafta-secici.tsx`** → `RandevuHaftaSecici`: sunucudan önceden gelen bu haftanın verisiyle başlar; "‹ Bugün ›" **buton + `useTransition`** ile (Link DEĞİL — modal içinde tam sayfa gezinme istemiyoruz) `haftaRandevuVerisiEylemi` çağırıp yeniden render eder; içeride `HaftaIzgarasiGovdesi` `bosAlanTiklanabilir` ile kullanılır.
- **`randevu-planlama.tsx`** → `RandevuPlanlamaPenceresi`: orkestratör. İki adım (`"hizmet" | "hafta"`) + tıklanan hücre state'i. Adım 1 penceresi (hizmet seç + "Devam"), adım 2 penceresi (geniş, `RandevuHaftaSecici`), hücre seçilince ÜÇÜNCÜ bir `Pencere` olarak `RandevuOnayFormu` üstüne açılır (native `<dialog>`'lar birlikte durabiliyor — `aday-asama-eylemleri.tsx` zaten aynı anda 3 ayrı `Pencere` barındırıyor). Onay formu başarıyla kapanınca TÜMÜ kapanıp sıfırlanır.

### 7. Bağlama

`src/components/aday-asama-eylemleri.tsx`: `RandevuPenceresi` fonksiyonu ve `randevuVer` importu **silinir**; `AdayAsamaEylemleri`'ye yeni prop'lar eklenir (`veli`, `hizmetler`, `uzmanlar`, `haftaVerisiBaslangic`), `RandevuPlanlamaPenceresi` bunlarla çağrılır.

`src/app/koordinator/adaylar/[id]/page.tsx`: `acikAday` hesaplaması `Promise.all`'dan ÖNCEye alınır (şu an sonra hesaplanıyor); `Promise.all` içine `yazabilir && acikAday` şartıyla `hizmetler`/`uzmanlar` (randevular/page.tsx'teki `formUzmanlari` ile birebir aynı sorgu şekli) ve `haftaRandevuVerisi({ subeId, capa: bugun() })` eklenir; bunlar `AdayAsamaEylemleri`'ye `veli={{ ad: aday.parentName ?? "İsimsiz aday", telefon: aday.phone }}` ile birlikte geçirilir.

---

## Kritik dosyalar

- `prisma/schema.prisma`, yeni migration klasörü
- `src/lib/randevu/veli.ts`, `src/lib/randevu/uzman-baglami.ts`, `src/lib/randevu/hafta-verisi.ts` (yeni)
- `src/app/koordinator/randevular/actions.ts` (iki yardımcı taşınır, yeni salt-okunur eylem eklenir)
- `src/app/koordinator/randevular/page.tsx` (sorgu → `randevuSatirlariGetir` çağrısına indirgenir)
- `src/app/koordinator/randevular/hafta-izgarasi.tsx` (gövde çıkarılır) + `hafta-izgarasi-govde.tsx` (yeni)
- `src/app/koordinator/adaylar/sema.ts`, `src/app/koordinator/adaylar/actions.ts` (`randevuVer` baştan yazılır)
- `src/components/aday-asama-eylemleri.tsx`, `src/app/koordinator/adaylar/[id]/page.tsx`
- Yeni: `src/app/koordinator/adaylar/[id]/randevu-planlama.tsx`, `randevu-hafta-secici.tsx`, `randevu-onay-formu.tsx`

## Doğrulama

1. `npm run db:up` → `npm run db:generate && npm run db:migrate` (yeni migration + `Randevu.leadId` tipi) → `npm run db:seed` → `npm run db:hizmetler`.
2. Test verisi elle eklenir (hiçbir seed script'i `Uzman`/`Veli`/`Lead` üretmiyor): en az 1 aktif `Uzman` + şube bağı + bir `Hizmet`e `UzmanHizmet` bağı + o gün için `UzmanMesai`; bir `Lead` (`parentName`/`phone` dolu, açık aşamada).
3. `.claude/launch.json`'daki `yerel-deneme` (port 3100) ile yerelde çalıştır, `/koordinator/adaylar/<test-id>`'e girip "Randevu ver…" → hizmet seç → hafta ızgarasında boş bir hücreye tıkla → uzman seç → kaydet. Kontrol edilecekler:
   - Yeni `Randevu` satırı `leadId` dolu şekilde oluşuyor (Prisma Studio ile bakılabilir).
   - `Lead.stage = RANDEVU_VERILDI`, `appointmentAt` doğru, yeni bir `LeadActivity` (SISTEM) uzman/hizmet/saat içeriyor.
   - Aynı uzman/saat için ikinci bir denemede `randevuEngeli` hatası formda (pencere kapanmadan) görünüyor.
   - `/koordinator/randevular` (hafta/program/liste/ay dört görünüm de) yeni randevuyu gösteriyor ve REFAKTÖR SONRASI hâlâ birebir eskisi gibi çalışıyor (bu, `page.tsx`/`HaftaIzgarasi` ayrıştırmasının regresyon kontrolü).
4. `npm run test -- --run` (581 test + varsa yeni saf mantık testleri) ve `npx tsc --noEmit`/`npx eslint` temiz olmalı. Repo'da hiç `*.test.tsx` (React bileşen testi) yok — modal/form/ızgara etkileşimi yalnız tarayıcıdan uçtan uca denenerek doğrulanır, bu konuda yeni bir test altyapısı kurulmuyor.
