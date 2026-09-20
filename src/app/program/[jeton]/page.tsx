import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Kart, Rozet, butonStili } from "@/components/ui";
import { ProgramIzgarasi } from "./program-izgarasi";
import { db } from "@/lib/db";
import { jetonBicimiTutuyorMu, programHaftasi } from "@/lib/randevu/program-linki";
import { programJetonununUzmani, programVerisi } from "@/lib/randevu/program-verisi";
import {
  GUN_ADLARI,
  bugun,
  gunEkle,
  gunundenGun,
  saatAraligiMetni,
  tarihBicimle,
  tarihMetni,
} from "@/lib/tarih";
import { uzmanRengi } from "@/lib/uzman-renkleri";

/**
 * §17.8 — Uzmanın giriş gerektirmeyen haftalık programı.
 *
 * Adresin KENDİSİ anahtar: `/program/<jeton>`. Parola yok, oturum yok —
 * uzmanların çoğunun panel hesabı yok ve kurum "linke bassın görsün"
 * istiyor. Sayfa `/koordinator` altında DEĞİL, çünkü o klasörün layout'u
 * `yonetimZorunlu()` çağırıyor; buradaki tek kapı jetonun kendisi.
 *
 * `proxy.ts` bu yola dokunmuyor: oturumsuz kullanıcıyı yalnız `/koordinator`
 * ve `/stajyer` altında girişe yolluyor, gerisini geçiriyor.
 *
 * ÖNBELLEK: `force-dynamic` ŞART. Next bu sayfayı (çerez okumadığı için)
 * statik sayabilir ve ilk açan uzmanın haftası herkese servis edilirdi —
 * başka bir uzmanın danışan listesi dahil.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Haftalık program",
  // Adres tek savunma; arama motoruna düşen bir jeton savunmanın sonu olur.
  robots: { index: false, follow: false, nocache: true },
};

export default async function ProgramSayfasi(
  props: PageProps<"/program/[jeton]">,
) {
  const { jeton } = await props.params;

  // Biçim tutmuyorsa veritabanına hiç gidilmiyor (bkz. `program-linki.ts`).
  if (!jetonBicimiTutuyorMu(jeton)) notFound();

  const uzman = await programJetonununUzmani(jeton);
  if (!uzman) notFound();

  const parametreler = await props.searchParams;
  const istenenHafta =
    typeof parametreler.hafta === "string" ? parametreler.hafta : undefined;
  const { capa, buHaftaMi } = programHaftasi(istenenHafta, bugun());

  const veri = await programVerisi({
    uzmanId: uzman.id,
    uzmanAdi: uzman.ad,
    uzmanRengi: uzman.renk,
    capa,
  });

  // Koordinatörün "bu link kullanılıyor mu" sorusu için. Sayfayı bloke
  // etmesin diye hatası yutuluyor: görüntüleme damgası yazılamadı diye
  // uzman programını görememeli.
  await db.uzman
    .update({
      where: { id: uzman.id },
      data: { programSonGoruntuleme: new Date() },
    })
    .catch(() => null);

  const ton = uzmanRengi(uzman.renk);
  const oncekiHafta = tarihMetni(gunEkle(capa, -7));
  const sonrakiHafta = tarihMetni(gunEkle(capa, 7));
  const doluGunler = veri.sutunlar.filter((sutun) => sutun.bloklar.length > 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-3 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: ton.blok }}
            aria-hidden
          />
          <h1 className="text-xl font-semibold text-zinc-900">{uzman.ad}</h1>
        </div>
        <p className="text-sm text-zinc-600">
          Haftalık seans programı · {veri.baslik}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {buHaftaMi ? null : (
          <Link
            href={`/program/${jeton}?hafta=${oncekiHafta}`}
            className={butonStili("sade")}
          >
            ‹ Önceki hafta
          </Link>
        )}
        {buHaftaMi ? null : (
          <Link href={`/program/${jeton}`} className={butonStili("sade")}>
            Bu hafta
          </Link>
        )}
        <Link
          href={`/program/${jeton}?hafta=${sonrakiHafta}`}
          className={butonStili("sade")}
        >
          Sonraki hafta ›
        </Link>
        <span className="ml-auto text-sm text-zinc-500">
          {veri.toplam === 0 ? "Seans yok" : `${veri.toplam} seans`}
        </span>
      </div>

      {veri.toplam === 0 ? (
        <Kart className="p-6 text-center text-sm text-zinc-600">
          Bu hafta planlanmış seansınız görünmüyor.
        </Kart>
      ) : (
        <>
          {/*
            İki görünüm, CSS ile değişiyor — istemci durumu YOK. Telefonda
            yedi sütunluk ızgara okunmuyor, listede gün gün okunuyor; geniş
            ekranda ızgara haftanın doluluğunu bir bakışta veriyor.
          */}
          <Kart className="hidden overflow-hidden p-0 md:block">
            <ProgramIzgarasi sutunlar={veri.sutunlar} eksen={veri.eksen} />
          </Kart>

          <div className="space-y-3 md:hidden">
            {doluGunler.map((sutun) => (
              <Kart key={sutun.gun.toISOString()} className="p-3">
                <p className="mb-2 text-sm font-semibold text-zinc-900">
                  {GUN_ADLARI[gunundenGun(sutun.gun)]} ·{" "}
                  <span className="font-normal text-zinc-600">
                    {tarihBicimle(sutun.gun)}
                  </span>
                </p>
                <ul className="space-y-2">
                  {sutun.bloklar.map(({ randevu }) => (
                    <li key={randevu.id} className="kil-oyuk p-2">
                      <p className="text-sm font-semibold tabular-nums text-zinc-900">
                        {saatAraligiMetni(randevu.baslangic, randevu.bitis)}
                      </p>
                      <p className="text-sm text-zinc-700">{randevu.hizmetAdi}</p>
                      <p className="text-sm font-medium text-zinc-900">
                        {randevu.danisanAdi}
                      </p>
                      <p className="mt-1">
                        <Rozet tur="notr">{randevu.subeAdi}</Rozet>
                      </p>
                    </li>
                  ))}
                </ul>
              </Kart>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-zinc-500">
        Bu adres size özeldir ve danışan bilgisi içerir; başkasıyla
        paylaşmayın. Değişiklik için koordinatörünüze başvurun.
      </p>
    </div>
  );
}
