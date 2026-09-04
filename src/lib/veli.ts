import type { Prisma } from "@/generated/prisma/client";
import type { GuardianType } from "@/generated/prisma/enums";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";

/**
 * §17.1 — Veli kayıtlarının yazılması.
 *
 * Veli artık öğrencinin altındaki bir satır değil, kendi kimliği olan bir
 * kayıt: `Veli` adı ve telefonu tutar, `Guardian` yalnızca "hangi veli, hangi
 * çocuğun annesi/babası" bağını. Bu, aynı anne-babanın her çocuğu için ayrı
 * bir satır olmasını bitiriyor (canlıda 58 telefon birden fazla çocuğa
 * bağlıydı) ve randevunun veliye açılabilmesini sağlıyor.
 *
 * BİRLEŞTİRMENİN GÖRÜNEN SONUCU: iki çocuğu olan bir velinin adını bir
 * çocuğun formundan düzeltmek, diğer çocuğun ekranında da değiştirir. Bu
 * bilinçli — tek kayıt olmasının anlamı bu. Eski davranışta iki kopya vardı
 * ve biri düzeltilince diğeri eski yazımıyla kalıyordu.
 *
 * Eşleştirme (şube, telefon, normalize ad) üçlüsüne göre yapılır. Yalnız
 * telefona bakmak DENENDİ ve yanlış çıktı: canlı verinin kopyasında iki
 * öğrencide anne ile baba aynı telefonu paylaşıyordu ve birleştirme babanın
 * adını siliyordu. Telefon bir cihaz, kimlik değil.
 */

export type VeliGirdisi = {
  type: GuardianType;
  fullName: string;
  phone: string | null;
};

/** `Veli` satırının yazılabilir alanları — ad ve telefon normalize edilir. */
function veliAlanlari(girdi: VeliGirdisi) {
  return {
    fullName: girdi.fullName,
    phone: girdi.phone,
    searchPhone: girdi.phone ? normalizeTelefon(girdi.phone) : null,
    searchName: normalizeArama(girdi.fullName),
  };
}

/**
 * Öğrencinin veli bağlarını girilen listeye eşitler.
 *
 * Hem yeni öğrencide hem düzenlemede aynı fonksiyon çalışır; düzenlemede
 * mevcut bağlar okunup ÜZERİNE yazılır, silinip yeniden açılmaz. Fark önemli:
 * telefonu olmayan bir veli eşleştirilemediği için her düzenlemede yeni bir
 * `Veli` satırı açılır ve sahipsiz kayıtlar birikirdi.
 *
 * SIRA ÖNEMLİ — üç durum bu sırayla deneniyor:
 *   1. Aynı kişi zaten kayıtlı mı (şube + telefon + ad)? → ona bağlan.
 *      Kardeş kaydı bu dalda velinin altında birleşiyor.
 *   2. Bu ebeveynin zaten bir bağı var mı? → o veliyi YERİNDE güncelle.
 *      Ad düzeltmesi bu dalda çalışıyor; sıra ters olsaydı "Ayşe" → "Ayşe
 *      Yılmaz" düzeltmesi eşleşme bulamayıp ikinci bir kayıt açardı.
 *   3. Hiçbiri değilse yeni veli aç.
 *
 * Listede olmayan ebeveynin bağı silinir; `Veli` kaydının kendisi SİLİNMEZ —
 * o velinin başka çocuğu ya da randevu geçmişi olabilir. Bağsız kalan veli
 * kayıtları veli listesinde görünmeye devam eder.
 *
 * `tx` zorunlu: öğrenci yazımıyla aynı işlemde olmalı, yarıda kalan bir veli
 * bağı öğrenciyi telefonsuz bırakırdı (§6.1 en az bir telefon kuralı).
 */
export async function veliBaglariniYaz(
  tx: Prisma.TransactionClient,
  args: { subeId: string; ogrenciId: string; girdiler: VeliGirdisi[] },
): Promise<void> {
  const { subeId, ogrenciId, girdiler } = args;

  const mevcutBaglar = await tx.guardian.findMany({
    where: { studentId: ogrenciId, student: { branchId: subeId } },
    select: { id: true, type: true, veliId: true },
  });

  const istenenTurler = new Set(girdiler.map((girdi) => girdi.type));

  // Formdan kaldırılan ebeveynin bağı düşer. `Veli` kaydı durur.
  const dusecekler = mevcutBaglar.filter((bag) => !istenenTurler.has(bag.type));
  if (dusecekler.length > 0) {
    await tx.guardian.deleteMany({
      where: { id: { in: dusecekler.map((bag) => bag.id) } },
    });
  }

  for (const girdi of girdiler) {
    const alanlar = veliAlanlari(girdi);
    const mevcutBag = mevcutBaglar.find((bag) => bag.type === girdi.type);

    // şube-muaf: `Veli` okumaları ve yazımlarının hepsi `branchId: subeId`
    // taşıyor; eşleştirme de şube içinde yapılıyor.
    const eslesen = alanlar.searchPhone
      ? await tx.veli.findFirst({
          where: {
            branchId: subeId,
            searchPhone: alanlar.searchPhone,
            searchName: alanlar.searchName,
          },
          select: { id: true },
        })
      : null;

    let veliId: string;

    if (eslesen) {
      veliId = eslesen.id;
      // Yazımı formdaki hâline tazele (telefon biçimi değişmiş olabilir).
      await tx.veli.update({ where: { id: eslesen.id }, data: alanlar });
    } else if (mevcutBag) {
      veliId = mevcutBag.veliId;
      await tx.veli.update({ where: { id: mevcutBag.veliId }, data: alanlar });
    } else {
      const yeni = await tx.veli.create({
        data: { branchId: subeId, ...alanlar },
        select: { id: true },
      });
      veliId = yeni.id;
    }

    await tx.guardian.upsert({
      where: { studentId_type: { studentId: ogrenciId, type: girdi.type } },
      update: { veliId },
      create: { studentId: ogrenciId, type: girdi.type, veliId },
    });
  }
}

/**
 * `guardians: { create: [...] }` içine konulacak iç içe bağ girdisi.
 *
 * `veliBaglariniYaz` bir işlem ve var olan bir öğrenci istiyor; tohum ve
 * aktarım betikleri ise öğrenciyi velileriyle birlikte tek `create` çağrısında
 * yazıyor. Telefonu olan veli `connectOrCreate` ile ŞUBE İÇİNDE tekilleşir
 * (aynı telefonlu kardeş kaydı ikinci bir veli açmaz); telefonsuz veli
 * eşleştirilemediği için doğrudan açılır.
 */
export function veliBagiIcIce(
  subeId: string,
  girdi: VeliGirdisi,
): Prisma.GuardianCreateWithoutStudentInput {
  const alanlar = veliAlanlari(girdi);

  // İç içe `create` ilişkiyi `branch: { connect }` ile bekliyor; düz
  // `branchId` yalnız üst düzey yazımda geçerli.
  const yeniVeli: Prisma.VeliCreateWithoutGuardiansInput = {
    ...alanlar,
    branch: { connect: { id: subeId } },
  };

  if (!alanlar.searchPhone) {
    return { type: girdi.type, veli: { create: yeniVeli } };
  }

  return {
    type: girdi.type,
    veli: {
      connectOrCreate: {
        where: {
          branchId_searchPhone_searchName: {
            branchId: subeId,
            searchPhone: alanlar.searchPhone,
            searchName: alanlar.searchName,
          },
        },
        create: yeniVeli,
      },
    },
  };
}
