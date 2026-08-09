import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rapor PDF'i fontları ve marka görsellerini çalışma anında dosya
  // sisteminden okur (path.join + process.cwd()); Vercel'in dosya izlemesi
  // bunları her koşulda pakete alsın diye açıkça bildiriliyor.
  outputFileTracingIncludes: {
    "/api/rapor-pdf/*": ["./public/fonts/**/*", "./public/marka/**/*"],
  },
  experimental: {
    serverActions: {
      // Zeka testi belge yüklemesi (4MB dosya + multipart üst verisi) için.
      // Vercel'in istek gövdesi sınırı ~4,5MB — bunun üstüne çıkılamaz;
      // daha büyük dosyalar gerekirse nesne deposuna geçilmeli.
      bodySizeLimit: "4500kb",
    },
  },
};

export default nextConfig;
