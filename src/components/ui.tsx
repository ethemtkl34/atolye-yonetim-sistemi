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
        "rounded-lg border border-zinc-200 bg-white",
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
        <h1 className="text-lg font-semibold text-zinc-900">{baslik}</h1>
        {aciklama ? (
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">{aciklama}</p>
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
    "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
  tehlike:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  sade: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
};

export function Buton({
  tur = "birincil",
  className,
  ...props
}: React.ComponentProps<"button"> & { tur?: ButonTuru }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        BUTON_STILLERI[tur],
        className,
      )}
      {...props}
    />
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
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-marka-600 focus:ring-2 focus:ring-marka-100 disabled:bg-zinc-50";

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
  const stiller = {
    notr: "bg-zinc-100 text-zinc-700",
    olumlu: "bg-emerald-50 text-emerald-700",
    uyari: "bg-amber-50 text-amber-700",
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
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
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
