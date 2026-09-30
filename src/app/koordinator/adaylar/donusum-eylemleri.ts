"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adayiKazanildiYap, donusumYolu } from "@/lib/aday/donusum";
import { db } from "@/lib/db";
import { alanHatalari, type EylemDurumu } from "@/lib/formlar";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { eslestirmeSemasi } from "./sema";

/**
 * §16.9 — Adayı ZATEN KAYITLI bir öğrenciyle eşleştirerek kazanma.
 *
 * Dönüşümün ikinci kapısı; birincisi yeni öğrenci formu (`ogrenciEkle`,
 * adayı gizli alanla taşır). Kardeşi kayıtlı olan ya da daha önce başka
 * programa gelmiş çocuk için yeni öğrenci açmak mükerrer kayıt üretirdi.
 *
 * Çift kapı: `adaylar: TAM` yetmiyor, `ogrenciler` da en az GORUNTULE olmalı —
 * eşleştirme ekranı şubenin bütün öğrenci adlarını listeliyor.
 */
export async function mevcutOgrenciyeEsle(
  adayId: string,
  _oncekiDurum: EylemDurumu,
  formVerisi: FormData,
): Promise<EylemDurumu> {
  const kullanici = await yonetimZorunlu("adaylar", "TAM");
  if (kullanici.yetkiler.ogrenciler === "YOK") {
    return { hata: "Öğrenci kayıtlarını görme yetkiniz yok." };
  }

  const cozumlenen = eslestirmeSemasi.safeParse({
    ogrenciId: formVerisi.get("ogrenciId"),
    hedef: formVerisi.get("hedef"),
  });
  if (!cozumlenen.success) {
    return { alanHatalari: alanHatalari(cozumlenen.error) };
  }

  const { ogrenciId, hedef } = cozumlenen.data;
  const subeId = kullanici.aktifSubeId;

  // Öğrenciler ortak havuzda (Eylül 2026): aday bu şubenin, öğrenci
  // herhangi bir şubenin olabilir.
  const ogrenci = await db.student.findFirst({
    where: { id: ogrenciId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!ogrenci) return { hata: "Öğrenci bulunamadı." };

  // Bir öğrenci en fazla bir adaydan dönüşür (`convertedStudentId` tekil,
  // şubeden bağımsız). Kontrol İKİ şubeye bakıyor ki diğer şubenin adayına
  // bağlı öğrencide de kullanıcı ham veritabanı hatası yerine anlaşılır bir
  // cümle görsün.
  // şube-muaf: tekillik kuralı şubeler arası; yalnız varlık okunuyor.
  const bagliAday = await db.lead.findFirst({
    where: { convertedStudentId: ogrenciId },
    select: { branch: { select: { id: true, name: true } } },
  });
  if (bagliAday) {
    return {
      hata:
        bagliAday.branch.id === subeId
          ? "Bu öğrenci zaten başka bir adaya bağlı."
          : `Bu öğrenci zaten ${bagliAday.branch.name} şubesindeki bir adaya bağlı.`,
    };
  }

  const oldu = await db.$transaction((tx) =>
    adayiKazanildiYap(tx, {
      adayId,
      subeId,
      ogrenciId: ogrenci.id,
      ogrenciAdi: `${ogrenci.firstName} ${ogrenci.lastName}`,
      kullaniciId: kullanici.id,
      hedef,
    }),
  );

  if (!oldu) {
    return { hata: "Aday bulunamadı ya da bu arada kapandı." };
  }

  revalidatePath("/koordinator/adaylar");
  revalidatePath(`/koordinator/adaylar/${adayId}`);
  revalidatePath(`/koordinator/ogrenciler/${ogrenci.id}`);
  revalidatePath("/koordinator");
  redirect(
    donusumYolu(hedef, ogrenci.id, kullanici.yetkiler.danismanlik === "TAM"),
  );
}
