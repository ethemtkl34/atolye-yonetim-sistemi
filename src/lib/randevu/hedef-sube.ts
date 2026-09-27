import { db } from "@/lib/db";

/**
 * §17.4 — Randevu formunun üzerinde çalıştığı şube (Eylül 2026).
 *
 * Yeni randevu formunda artık şube seçilebiliyor: randevu ekranın aktif
 * şubesine değil, formda seçilen şubeye açılıyor. Bu seçim bir yerde değil
 * ÜÇ yerde birden geçerli olmalı ve hepsi aynı cevabı vermeli:
 *
 *  - `randevuEkle` — kaydın `branchId`si,
 *  - `veliAra` — danışan araması (başka şubenin velisi aksi hâlde hiç
 *    bulunamaz; seçici boş döner ve kullanıcı "veli kayıtlı değil" sanıp
 *    ikinci bir kopya açardı),
 *  - uzman/öğrenci doğrulamaları (`randevuEkle` içinde, aynı `subeId`).
 *
 * Kural ayrı bir dosyada çünkü `veli-arama.ts` bir `"use server"` dosyası ve
 * oradan async olmayan hiçbir şey dışa aktarılamıyor.
 *
 * YETKİ GENİŞLETMEZ: randevu ekranına erişen şubeli roller sağ üstteki
 * randevu şubesi seçicisiyle, yönetici de panel şubesiyle zaten her aktif
 * şubeye randevu açabiliyordu. Burada kaldırılan tek şey "önce bütün ekranı
 * öbür şubeye çevir" adımı. Yine de kimlik DOĞRULANIYOR: `null` dönüşü
 * "böyle bir aktif şube yok" demek ve çağıran taraf onu sessizce aktif
 * şubeye düşürmez — düşürseydi randevu kullanıcının görmediği bir takvime
 * yazılırdı.
 */
export async function randevuHedefSubesi(
  aktifSubeId: string,
  istenen: string | null | undefined,
): Promise<string | null> {
  if (!istenen || istenen === aktifSubeId) return aktifSubeId;

  const sube = await db.branch.findFirst({
    where: { id: istenen, active: true },
    select: { id: true },
  });
  return sube?.id ?? null;
}
