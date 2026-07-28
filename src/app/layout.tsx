import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// latin-ext alt kümesi Türkçe'ye özgü ğ, ş, ı, İ karakterleri için zorunlu;
// yalnızca "latin" seçilirse bu harfler yedek fontla farklı görünür.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Atölye Yönetim Sistemi",
    template: "%s · Atölye Yönetim Sistemi",
  },
  description:
    "Dönem, kulüp, öğrenci, stajyer, puanlama ve rapor yönetimi için kurum içi yönetim paneli.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}
