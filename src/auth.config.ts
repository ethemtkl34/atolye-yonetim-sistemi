import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * Auth.js'in hem sunucuda hem `proxy.ts` içinde paylaşılan yapılandırması.
 *
 * Sağlayıcı (provider) listesi burada boş bırakıldı: parola doğrulaması
 * bcrypt ve veritabanı gerektiriyor, `proxy.ts` ise her istekte çalışıyor.
 * Ağır bağımlılıkları oraya taşımamak için giriş mantığı `auth.ts` içinde,
 * yalnızca oturum çözümleme burada duruyor.
 */
export const authConfig = {
  pages: {
    signIn: "/giris",
  },
  session: {
    // Credentials sağlayıcısı yalnızca JWT oturumuyla çalışır.
    strategy: "jwt",
    // Kurum içi kullanım: bir çalışma günü. Süre dolunca yeniden giriş istenir.
    maxAge: 12 * 60 * 60,
  },
  callbacks: {
    /** Kullanıcının kimliği ve rolü token'a yazılır; her istekte veritabanına
     *  gitmeden rol kontrolü yapılabilsin diye. */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as Role;
      }
      return token;
    },
    /** Token'daki kimlik ve rol oturum nesnesine aktarılır. */
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
