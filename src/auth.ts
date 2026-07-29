import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";

/**
 * Giriş formunun doğrulama şeması. Hata metinleri kullanıcıya gösterilir.
 *
 * Alan e-posta biçimini zorunlu kılmıyor: kurum kısa kullanıcı adlarıyla
 * (örn. `admin`) girmek istedi. `User.email` sütunu tekil bir metin olduğu
 * için ikisi de aynı sütunda tutulabiliyor.
 */
export const girisSemasi = z.object({
  email: z.string().trim().min(1, "E-posta veya kullanıcı adı gerekli"),
  password: z.string().min(1, "Parola gerekli"),
});

/**
 * Kullanıcı bulunamadığında da bcrypt karşılaştırması yapılabilsin diye
 * kullanılan sahte hash. Aksi halde "kullanıcı yok" durumu belirgin şekilde
 * daha hızlı yanıt döner ve hangi e-postaların kayıtlı olduğu cevap süresinden
 * anlaşılabilir.
 */
const SAHTE_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Parola", type: "password" },
      },
      async authorize(credentials) {
        const cozumlenen = girisSemasi.safeParse(credentials);
        if (!cozumlenen.success) return null;

        const { email, password } = cozumlenen.data;

        // Kimlik yerelden bağımsız küçültülür. `toLocaleLowerCase("tr-TR")`
        // kullanılıyordu ve bu bir hataydı: Türkçe yerelde "I" harfi noktasız
        // "ı"ya dönüşüyor, yani "ADMIN" → "admın" olup hiçbir kayıtla
        // eşleşmiyordu. Telefon klavyeleri ilk harfi büyütmeye eğilimli
        // olduğu için bu, gerçek bir giriş engeli.
        const kullanici = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        const parolaDogru = await compare(
          password,
          kullanici?.passwordHash ?? SAHTE_HASH,
        );

        // Pasife alınmış hesap doğru parolayla bile giriş yapamaz.
        if (!kullanici || !kullanici.active || !parolaDogru) return null;

        return {
          id: kullanici.id,
          email: kullanici.email,
          name: kullanici.name,
          role: kullanici.role,
        };
      },
    }),
  ],
});
