import { cn } from "@/lib/utils";

/**
 * Panelin küçük arayüz parçaları.
 *
 * Hazır bir bileşen kütüphanesi yerine bu dosya tutuldu: ihtiyaç duyulan set
 * küçük ve tekdüze (buton, girdi, kart, boş durum), dışarıdan gelen bir
 * kütüphanenin kurulum ve sürüm yükü buna değmiyor. Yeni bir ekran yazarken
 * Tailwind sınıflarını tekrar yazmak yerine buradaki parçalar kullanılmalı.
 */

export function Kart({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    // Kil yüzey: derinlik artık renk farkından değil, zeminden kabarmış
    // olmasından geliyor (bkz. globals.css "KİL TEMASI").
    <div className={cn("kil-yuzey", className)} {...props} />
  );
}

export function SayfaBasligi({
  baslik,
  aciklama,
  aksiyon,
  ustBilgi,
}: {
  baslik: string;
  aciklama?: string;
  aksiyon?: React.ReactNode;
  /**
   * Başlığın ÜSTÜNDE duran küçük bağlam etiketi. Şubeli yapıda ortak
   * ekranları (atölye kataloğu, dönem, kulüp) işaretlemek için kullanılıyor:
   * o ekranlarda yapılan değişiklik iki şubeyi birden etkiliyor ve bunun
   * başlığı okumadan ÖNCE görünmesi gerekiyor.
   */
  ustBilgi?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {ustBilgi ? <div className="mb-1.5">{ustBilgi}</div> : null}
        {/* Kil yüzeyler yumuşak; başlık da inceyse ekran tamamen dağılıyor.
            Tipografi bilerek bir tık daha kalın ve sıkı. */}
        <h1 className="text-[1.375rem] leading-tight font-bold tracking-tight text-zinc-900">
          {baslik}
        </h1>
        {aciklama ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-600">
            {aciklama}
          </p>
        ) : null}
      </div>
      {aksiyon}
    </div>
  );
}

/**
 * Satır içi bağlantılar ("Aç", "Tümü", "Düzenle", "← geri").
 *
 * Bunlar 18–20px yüksekliğinde metin bağlantılarıydı; telefonda parmakla
 * vurmak zordu. Dokunma alanı `py` ile büyütülüp `-my` ile geri alınıyor:
 * hedef büyür ama satır yüksekliği ve görsel ritim değişmez. Genişletme
 * yalnızca telefonda — yoğun listelerde masaüstünde komşu satırların
 * alanlarıyla çakışmasın.
 */
export const baglantiStili =
  "-my-2.5 inline-block py-2.5 text-sm text-marka-700 hover:underline sm:my-0 sm:py-0";

/** Aynı desenin sayfa başındaki "← geri" bağlantısı için sessiz tonu. */
export const geriBaglantiStili =
  "-my-2.5 inline-block py-2.5 text-sm text-zinc-500 hover:text-zinc-900 sm:my-0 sm:py-0";

/**
 * Liste kartlarındaki ad bağlantısı ("Kerem Aksoy", "Ayşe Yılmaz").
 *
 * Kartın asıl hedefi bu ve 21–24px yüksekliğindeydi. Aynı `py`/`-my` numarası:
 * telefonda alan büyür, satır yüksekliği aynı kalır.
 */
export const kartBasligiStili =
  "-my-2.5 inline-block py-2.5 font-medium text-zinc-900 hover:text-marka-700 hover:underline sm:my-0 sm:py-0";

type ButonTuru = "birincil" | "ikincil" | "tehlike" | "sade";

// Görünüm globals.css'teki kil sınıflarında; burada yalnızca hangi türün
// hangi sınıfa karşılık geldiği duruyor. Renk ve gölge tek yerde tanımlı
// kalsın diye Tailwind sınıfı yazılmıyor.
const BUTON_STILLERI: Record<ButonTuru, string> = {
  birincil: "kil-buton-birincil",
  ikincil: "kil-buton-ikincil",
  tehlike: "kil-buton-tehlike",
  sade: "kil-buton-sade",
};

// `min-h` telefonda 44px: butonlar 36px'ti ve iOS 44pt / Android 48dp
// önerisinin altındaydı. Masaüstünde eski ölçüye dönüyor — orada imleçle
// vuruluyor ve yoğun ekranlarda dikey yer kazanmak daha değerli.
const BUTON_TEMELI =
  "kil-buton inline-flex min-h-[2.75rem] items-center justify-center px-3.5 py-2 text-sm disabled:cursor-not-allowed sm:min-h-[2.25rem]";

/**
 * Buton görünümünün sınıf dizisi.
 *
 * `<Link>` bir buton bileşeni kabul etmediği için buton gibi görünen
 * bağlantılar bunu kullanır. Sınıfları her sayfada elle yazmak renk
 * değiştiğinde bazılarının geride kalmasına yol açıyordu.
 */
export function butonStili(tur: ButonTuru = "birincil", ekSinif?: string) {
  return cn(BUTON_TEMELI, BUTON_STILLERI[tur], ekSinif);
}

/**
 * Dönen yükleme halkası. Uzun süren eylemlerde (rapor üretimi, PDF çizimi)
 * metnin yanında gösterilir; salt metin değişimi "takıldı" hissi veriyordu.
 * `currentColor` kullandığı için durduğu yerin metin rengine uyar.
 */
export function DonenHalka({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function Buton({
  tur = "birincil",
  className,
  engelSebebi,
  ...props
}: React.ComponentProps<"button"> & {
  tur?: ButonTuru;
  /**
   * Buton neden kilitli — üzerine gelindiğinde ipucu olarak gösterilir.
   *
   * Devre dışı bir `<button>` fare olayı almadığı için `title` doğrudan
   * butona konsa görünmez; bu yüzden saran `<span>` üzerine yazılıyor.
   * Ekran okuyucular için de `aria-describedby` yerine görünür ipucu
   * metniyle birlikte kullanılması gerekir (sihirbazlarda öyle yapılıyor).
   */
  engelSebebi?: string;
}) {
  const buton = <button className={butonStili(tur, className)} {...props} />;

  if (!engelSebebi || !props.disabled) return buton;

  return (
    <span title={engelSebebi} className="inline-flex cursor-not-allowed">
      {buton}
    </span>
  );
}

export function Alan({
  etiket,
  hata,
  ipucu,
  children,
}: {
  etiket: string;
  hata?: string;
  ipucu?: string;
  children: React.ReactNode;
}) {
  return (
    // Sarmalayıcılar <div> değil <span className="block">: <label> yalnızca
    // metin içeriği (phrasing content) alabiliyor, <div> geçersiz iç içe
    // geçme oluşturuyordu. Tarayıcılar tolere ediyor ama erişilebilirlik
    // ağacı bozuluyor. `block` sınıfıyla görünüm birebir aynı kalıyor.
    <label className="block">
      <span className="block text-sm font-semibold text-zinc-700">{etiket}</span>
      <span className="mt-1 block">{children}</span>
      {ipucu && !hata ? (
        <span className="mt-1 block text-xs text-zinc-500">{ipucu}</span>
      ) : null}
      {hata ? (
        <span className="mt-1 block text-xs text-red-600">{hata}</span>
      ) : null}
    </label>
  );
}

/**
 * `text-base` telefonda ZORUNLU, süs değil.
 *
 * iOS Safari, yazı boyutu 16px'in altında olan bir alana dokunulduğunda
 * sayfayı otomatik yakınlaştırıyor ve geri döndürmüyor: kullanıcı öğrenci
 * formunda tek bir alana dokunduktan sonra ekranın kalanını elle uzaklaştırmak
 * zorunda kalıyordu. 14px (`text-sm`) tam da o eşiğin altında.
 *
 * `min-h` de aynı sebeple: alanlar 38px'ti, parmakla vurulacak asgari ölçünün
 * altında. Masaüstünde ikisi de eski değerine dönüyor.
 */
const GIRDI_STILI =
  "kil-girdi w-full min-h-[2.75rem] text-base text-zinc-900 outline-none sm:min-h-[2.25rem] sm:text-sm";

export function Girdi({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(GIRDI_STILI, className)} {...props} />;
}

export function CokSatirli({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return <textarea className={cn(GIRDI_STILI, className)} {...props} />;
}

/**
 * `<select>` görünümü — `Girdi` ile aynı kurallar geçerli.
 *
 * Üç ekranda birbirinin kopyası olarak duruyordu ve hepsi 14px'ti; iOS
 * dokunulduğunda sayfayı yakınlaştırıyordu (bkz. `GIRDI_STILI`).
 */
export const secimStili = GIRDI_STILI;

export function Rozet({
  tur = "notr",
  children,
}: {
  tur?: "notr" | "olumlu" | "uyari" | "pasif";
  children: React.ReactNode;
}) {
  // Anlam korunuyor, tonlar kurumsal palete çekildi: "uyarı" artık kurumun
  // turuncusu — sitede de dikkat çeken düğmeler bu renk. "Olumlu" yeşil
  // kalıyor, çünkü olumlu/olumsuz ayrımı marka renginden önce gelir.
  //
  // Rozetler bilerek KABARMIYOR: bir kartın içinde üç dört rozet yan yana
  // duruyor, hepsi kabarınca yüzey kabarcık tarlasına dönüyordu. Kil hissi
  // burada yalnızca üst kenardaki ışık çizgisiyle veriliyor.
  const stiller = {
    notr: "bg-marka-50 text-marka-700 ring-marka-100",
    olumlu: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    uyari: "bg-vurgu-50 text-vurgu-800 ring-vurgu-100",
    pasif: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-inset",
        stiller[tur],
      )}
    >
      {children}
    </span>
  );
}

export function BosDurum({
  baslik,
  aciklama,
}: {
  baslik: string;
  aciklama?: string;
}) {
  return (
    // Boş durum "içine bir şey konmamış oyuk": kabartma değil gömük yüzey.
    <div className="kil-bos p-8 text-center">
      <p className="text-sm font-medium text-zinc-600">{baslik}</p>
      {aciklama ? (
        <p className="mt-1 text-xs text-zinc-500">{aciklama}</p>
      ) : null}
    </div>
  );
}

/**
 * Kapalı başlayan bölüm çerçevesi.
 *
 * Native `<details>`: JS gerektirmediği için sunucu bileşeninde çalışıyor ve
 * içindeki istemci bileşenleri (stajyer atamaları gibi) etkilenmiyor. Özet
 * satırı telefonda 44px dokunma hedefi; masaüstünde sıkı ölçüye dönüyor.
 */
export function KatlanirBolum({
  baslik,
  etiket,
  children,
}: {
  baslik: string;
  etiket?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Kart className="p-4">
      <details className="group">
        <summary className="flex min-h-[2.75rem] cursor-pointer list-none items-center justify-between gap-2 sm:min-h-0">
          <span className="flex flex-wrap items-center gap-2 text-base font-bold tracking-tight text-zinc-900">
            {baslik}
            {etiket}
          </span>
          {/* Aç/kapa göstergesi kabarık bir hap: bölümün tıklanabilir olduğu
              metinden değil, kabartmadan anlaşılsın. */}
          <span className="kil-rozet shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-600 group-open:hidden">
            Göster
          </span>
          <span className="kil-rozet hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-600 group-open:inline">
            Gizle
          </span>
        </summary>
        <div className="mt-3">{children}</div>
      </details>
    </Kart>
  );
}

/** `<dl>` içinde etiket + değer hücresi; boş değer tire olarak çıkar. */
export function OzetHucresi({
  etiket,
  deger,
}: {
  etiket: string;
  deger: string | null;
}) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold tracking-wide text-zinc-500 uppercase">
        {etiket}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-zinc-900">
        {deger ?? <span className="font-normal text-zinc-400">—</span>}
      </dd>
    </div>
  );
}

/** İşlem sonucu bildirimi — Server Action dönüşlerini göstermek için. */
export function Bildirim({
  tur,
  children,
}: {
  tur: "basari" | "hata" | "bilgi";
  children: React.ReactNode;
}) {
  const stiller = {
    basari: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    hata: "bg-red-50 text-red-700 ring-red-100",
    bilgi: "bg-marka-50 text-marka-700 ring-marka-100",
  };

  return (
    <p
      role={tur === "hata" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--kil-r-md)] px-3.5 py-2.5 text-sm font-medium ring-1 ring-inset",
        stiller[tur],
      )}
    >
      {children}
    </p>
  );
}
