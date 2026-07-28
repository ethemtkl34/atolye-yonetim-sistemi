import type { Metadata } from "next";
import Link from "next/link";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { OgrenciFormu } from "../ogrenci-formu";
import { ogrenciEkle } from "../actions";

export const metadata: Metadata = {
  title: "Yeni öğrenci",
};

/**
 * §7.1 — Yeni öğrenci kaydı. Akışın ilk adımı olan arama, öğrenci listesi
 * sayfasında yapılıyor; buraya "aradım, bulamadım" diyerek gelinir.
 */
export default async function YeniOgrenciSayfasi() {
  await koordinatorZorunlu();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/koordinator/ogrenciler"
          className="text-sm text-zinc-500 hover:text-zinc-900"
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
      />
    </div>
  );
}
