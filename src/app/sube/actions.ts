"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { adminZorunlu } from "@/lib/yetki-kapisi";
import { SUBE_CEREZI, SUBE_CEREZ_OMRU } from "@/lib/sube";

/**
 * Yöneticinin çalıştığı şubeyi değiştirir.
 *
 * Yalnızca yönetici çağırabilir (`adminZorunlu`). Koordinatörün bu eylemi
 * çağırması bir işe yaramaz: `aktifSubeyiCoz` koordinatör için çerezi zaten
 * yok sayıyor. Yine de kapı burada da kapalı tutuluyor — iki katman, çünkü
 * ikisinden birinin ileride değişme ihtimali var.
 *
 * Seçim çerezde saklanıyor, oturum belirtecinde değil: belirteç 12 saat
 * yaşıyor ve içine yazılan şube, yönetici şube değiştirdiğinde bayatlardı.
 * Çerez `httpOnly` — istemci JavaScript'inin okumasına gerek yok, şubeyi
 * sunucu çözüyor.
 */
export async function subeDegistir(subeId: string): Promise<void> {
  await adminZorunlu();

  // Çerezdeki değer gelişigüzel olamaz: yazmadan önce şubenin var ve aktif
  // olduğu doğrulanır. Okuma tarafı (`aktifSubeyiCoz`) tanımadığı değeri ilk
  // şubeye düşürerek zaten koruyor, ama bozuk çerezi hiç yazmamak daha iyi.
  const sube = await db.branch.findFirst({
    where: { id: subeId, active: true },
    select: { id: true },
  });

  if (!sube) return;

  (await cookies()).set(SUBE_CEREZI, sube.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SUBE_CEREZ_OMRU,
  });

  // Bütün panel tazelenmeli: şube değişince menüdeki her ekranın verisi
  // değişiyor. Tek bir yolu tazelemek, kullanıcı geri tuşuyla döndüğünde
  // eski şubenin listesini gösterirdi.
  revalidatePath("/", "layout");
}
