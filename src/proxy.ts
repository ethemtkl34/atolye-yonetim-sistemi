import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

/**
 * Rota koruması — Next.js 16'da bu dosyanın adı `middleware` değil `proxy`.
 *
 * Buradaki kontrol İYİMSER'dir: yalnızca oturum çerezine bakar ve yanlış
 * paneldeki kullanıcıyı doğru panele yönlendirir. Next.js dokümanı proxy'yi
 * tam bir yetkilendirme çözümü olarak kullanmamayı açıkça söylüyor; asıl
 * yetki kontrolü her sayfa ve Server Action içinde `lib/auth-guard.ts`
 * fonksiyonlarıyla yapılır. Buradaki katman kullanıcıyı gereksiz yere yüklenen
 * bir sayfaya götürmemek içindir, güvenliğin tek dayanağı değildir.
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth((istek) => {
  const { nextUrl } = istek;
  const oturum = istek.auth;
  const girisYapmis = Boolean(oturum?.user);
  const rol = oturum?.user?.role;

  const koordinatorAlani = nextUrl.pathname.startsWith("/koordinator");
  const stajyerAlani = nextUrl.pathname.startsWith("/stajyer");
  const girisSayfasi = nextUrl.pathname === "/giris";

  if (!girisYapmis) {
    if (koordinatorAlani || stajyerAlani) {
      // Giriş sonrası kullanıcının gitmek istediği sayfaya dönebilmesi için
      // hedef adres sorgu parametresinde taşınır.
      const girisAdresi = new URL("/giris", nextUrl);
      girisAdresi.searchParams.set("devam", nextUrl.pathname);
      return NextResponse.redirect(girisAdresi);
    }
    return NextResponse.next();
  }

  const kendiAlani = rol === "KOORDINATOR" ? "/koordinator" : "/stajyer";

  // Giriş yapmış kullanıcı giriş sayfasına dönerse kendi paneline gider.
  if (girisSayfasi) {
    return NextResponse.redirect(new URL(kendiAlani, nextUrl));
  }

  if (rol === "STAJYER" && koordinatorAlani) {
    return NextResponse.redirect(new URL("/stajyer", nextUrl));
  }

  if (rol === "KOORDINATOR" && stajyerAlani) {
    return NextResponse.redirect(new URL("/koordinator", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Statik dosyalar ve Auth.js'in kendi uçları dışındaki her istek.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
