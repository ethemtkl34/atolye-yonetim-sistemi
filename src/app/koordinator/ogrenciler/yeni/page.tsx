import type { Metadata } from "next";
import Link from "next/link";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { kayitAlanProgramlar } from "@/lib/kayit-secenekleri";
import { OgrenciFormu } from "../ogrenci-formu";
import { ogrenciEkle } from "../actions";
import { geriBaglantiStili } from "@/components/ui";

export const metadata: Metadata = {
  title: "Yeni öğrenci",
};

/**
 * §7.1 — Yeni öğrenci kaydı. Akışın ilk adımı olan arama, öğrenci listesi
 * sayfasında yapılıyor; buraya "aradım, bulamadım" diyerek gelinir.
 */
export default async function YeniOgrenciSayfasi() {
  const kullanici = await yonetimZorunlu("ogrenciler", "TAM");
  const programlar = await kayitAlanProgramlar(kullanici.aktifSubeId);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/koordinator/ogrenciler"
          className={geriBaglantiStili}
        >
          ← Öğrenciler
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          Yeni öğrenci
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Kaydetmeden önce öğrencinin sistemde olup olmadığını aramanız
          önerilir; aynı öğrenci iki kez eklenmemelidir.
        </p>
      </div>

      <OgrenciFormu
        eylem={ogrenciEkle}
        kaydetEtiketi="Öğrenciyi kaydet"
        iptalYolu="/koordinator/ogrenciler"
        programlar={programlar}
      />
    </div>
  );
}
