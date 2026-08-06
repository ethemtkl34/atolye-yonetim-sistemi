import type { Role } from "@/generated/prisma/enums";
import type { DefaultSession } from "next-auth";

/**
 * Auth.js'in varsayılan tiplerine kurumun alanlarını ekler; böylece
 * `session.user.roller` ve `token.roller` her yerde tip güvenli okunur.
 *
 * JWT arayüzü için `@auth/core/jwt` hedeflenir: `next-auth/jwt` yalnızca
 * yeniden dışa aktarım yapıyor, arayüzü kendisi tanımlamıyor. Yeniden dışa
 * aktaran modülü genişletmek özgün arayüzle birleşmez.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roller: Role[];
    } & DefaultSession["user"];
  }

  interface User {
    roller: Role[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    roller: Role[];
    /**
     * GEÇİŞ ARTIĞI — çoklu role geçiş deploy'undan önce kesilmiş 12 saatlik
     * belirteçler tek `role` taşıyor; jwt callback'i bunu `roller`'a çevirir.
     * Belirteç ömrü dolunca (temizlik deploy'unda) bu alan silinir.
     */
    role?: Role;
  }
}
