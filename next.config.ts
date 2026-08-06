import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
