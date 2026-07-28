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
    <div
      className={cn(
        // Kart beyaz, sayfa zemini hafif mürdüm tonlu: derinlik renkten değil
        // bu iki yüzeyin farkından geliyor.
        "rounded-lg border border-yuzey-200 bg-white shadow-[0_1px_2px_rgba(91,16,53,0.04)]",
        className,
      )}
      {...props}
    />
  );
}

export function SayfaBasligi({
  baslik,
  aciklama,
  aksiyon,
}: {
  baslik: string;
  aciklama?: string;
  aksiyon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {/* Başlığın altındaki kısa mürdüm çizgi, uzun listelerde sayfanın
            nerede başladığını renkle işaretliyor. */}
        <h1 className="text-lg font-semibold text-zinc-900">{baslik}</h1>
        <span className="mt-1.5 block h-0.5 w-10 rounded-full bg-marka-600" />
        {aciklama ? (
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">{aciklama}</p>
        ) : null}
      </div>
      {aksiyon}
    </div>
  );
}

type ButonTuru = "birincil" | "ikincil" | "tehlike" | "sade";

const BUTON_STILLERI: Record<ButonTuru, string> = {
  birincil: "bg-marka-600 text-white hover:bg-marka-700",
  ikincil:
    "border border-marka-200 bg-white text-marka-700 hover:bg-marka-50",
  tehlike:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  sade: "text-zinc-600 hover:bg-marka-50 hover:text-marka-700",
};

const BUTON_TEMELI =
  "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

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

export function Buton({
  tur = "birincil",
  className,
  ...props
}: React.ComponentProps<"button"> & { tur?: ButonTuru }) {
  return <button className={butonStili(tur, className)} {...props} />;
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
    <label className="block">
      <span className="block text-sm font-medium text-zinc-700">{etiket}</span>
      <div className="mt-1">{children}</div>
      {ipucu && !hata ? (
        <span className="mt-1 block text-xs text-zinc-500">{ipucu}</span>
      ) : null}
      {hata ? (
        <span className="mt-1 block text-xs text-red-600">{hata}</span>
      ) : null}
    </label>
  );
}

const GIRDI_STILI =
  "w-full rounded-md border border-yuzey-200 bg-white px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100 disabled:bg-yuzey-50";

export function Girdi({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(GIRDI_STILI, className)} {...props} />;
}

export function CokSatirli({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return <textarea className={cn(GIRDI_STILI, className)} {...props} />;
}

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
  const stiller = {
    notr: "bg-marka-50 text-marka-700",
    olumlu: "bg-emerald-50 text-emerald-700",
    uyari: "bg-vurgu-50 text-vurgu-800",
    pasif: "bg-zinc-100 text-zinc-500",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
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
    <div className="rounded-lg border border-dashed border-marka-200 bg-white p-8 text-center">
      <p className="text-sm text-zinc-600">{baslik}</p>
      {aciklama ? (
        <p className="mt-1 text-xs text-zinc-500">{aciklama}</p>
      ) : null}
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
    basari: "bg-emerald-50 text-emerald-800",
    hata: "bg-red-50 text-red-700",
    bilgi: "bg-marka-50 text-marka-700",
  };

  return (
    <p
      role={tur === "hata" ? "alert" : "status"}
      className={cn("rounded-md px-3 py-2 text-sm", stiller[tur])}
    >
      {children}
    </p>
  );
}
