import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import type { EylemDurumu } from "@/lib/formlar";

/**
 * Parola değiştirmenin ortak çekirdeği.
 *
 * İki ekran kullanır: hesabım (gönüllü değişim) ve zorunlu ilk değişim.
 * İkisi de aynı şemayı, aynı bcrypt akışını ve aynı `mustChangePassword`
 * temizliğini paylaşır; fark yalnızca metinler ve başarı davranışıdır
 * (mesaj vs yönlendirme) — onlar çağıran eylemde kalır. Önceden iki eylem
 * dosyası bu akışı satır satır kopyalıyordu.
 *
 * GÜVENLİK: hangi hesabın değiştirileceği hiçbir zaman formdan gelmez;
 * çağıran, kimliği OTURUMDAN çözüp buraya verir.
 */
export async function parolayiDogrulaVeDegistir({
  kullaniciId,
  mevcutHash,
  formVerisi,
  metinler,
}: {
  kullaniciId: string;
  /** Hesabın kayıtlı parola hash'i — çağıran kendi guard akışında okur. */
  mevcutHash: string;
  formVerisi: FormData;
  metinler: {
    /** "Mevcut parolanızı girin" / "Size iletilen geçici parolayı girin" */
    mevcutBos: string;
    /** "Yeni parola mevcut/geçici parolayla aynı olamaz" */
    mevcutAyni: string;
    /** "Mevcut parola hatalı." / "Geçici parola hatalı." */
    mevcutHatali: string;
  };
}): Promise<EylemDurumu | null> {
  const parolaSemasi = z
    .object({
      mevcut: z.string().min(1, metinler.mevcutBos),
      yeni: z
        .string()
        .min(8, "Yeni parola en az 8 karakter olmalı")
        .max(100, "Yeni parola en fazla 100 karakter olabilir"),
      tekrar: z.string().min(1, "Yeni parolayı tekrar girin"),
    })
    .refine((d) => d.yeni === d.tekrar, {
      path: ["tekrar"],
      message: "Parolalar birbiriyle aynı değil",
    })
    .refine((d) => d.yeni !== d.mevcut, {
      path: ["yeni"],
      message: metinler.mevcutAyni,
    });

  const cozumlenen = parolaSemasi.safeParse({
    mevcut: formVerisi.get("mevcut"),
    yeni: formVerisi.get("yeni"),
    tekrar: formVerisi.get("tekrar"),
  });

  if (!cozumlenen.success) {
    const alanlar = cozumlenen.error.flatten().fieldErrors;
    return {
      alanHatalari: {
        ...(alanlar.mevcut?.[0] ? { mevcut: alanlar.mevcut[0] } : {}),
        ...(alanlar.yeni?.[0] ? { yeni: alanlar.yeni[0] } : {}),
        ...(alanlar.tekrar?.[0] ? { tekrar: alanlar.tekrar[0] } : {}),
      },
    };
  }

  const mevcutDogru = await compare(cozumlenen.data.mevcut, mevcutHash);
  if (!mevcutDogru) {
    return { alanHatalari: { mevcut: metinler.mevcutHatali } };
  }

  // şube-muaf: kendi parolasını değiştiriyor; kimlik oturumdan geliyor.
  // Bayrak da temizlenir: kendi parolasını koyan kullanıcıdan bir daha
  // zorunlu değişim istenmez.
  await db.user.update({
    where: { id: kullaniciId },
    data: {
      passwordHash: await hash(cozumlenen.data.yeni, 12),
      mustChangePassword: false,
    },
  });

  return null;
}
