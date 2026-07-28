import type { Role } from "@/generated/prisma/enums";
import type { DefaultSession } from "next-auth";

/**
 * Auth.js'in varsayılan tiplerine kurumun alanlarını ekler; böylece
 * `session.user.role` ve `token.role` her yerde tip güvenli okunur.
 *
 * JWT arayüzü için `@auth/core/jwt` hedeflenir: `next-auth/jwt` yalnızca
 * yeniden dışa aktarım yapıyor, arayüzü kendisi tanımlamıyor. Yeniden dışa
 * aktaran modülü genişletmek özgün arayüzle birleşmez.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
