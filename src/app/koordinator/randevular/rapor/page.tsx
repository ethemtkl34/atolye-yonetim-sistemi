import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import {
  BosDurum,
  Kart,
  Rozet,
  SayfaBasligi,
  butonStili,
  geriBaglantiStili,
  kartBasligiStili,
} from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { bugun, tarihCozumle, tarihMetni } from "@/lib/tarih";
import { uzmanRengi } from "@/lib/uzman-renkleri";
import {
  raporAraligi,
  raporKapsamiMi,
  raporKaydir,
  subeCiroRaporu,
} from "@/lib/randevu/rapor-verisi";
import { paraMetni } from "../../uzmanlar/sema";

export const metadata: Metadata = {
  title: "Ciro raporu",
};

const TEMEL_YOL = "/koordinator/randevular/rapor";

/**
 * §17.5 — Uzman bazında seans ve ciro raporu.
 *
 * Kurumun bugün Excel'de elle tuttuğu tablonun yerine geçiyor: her seans
 * zaten uzman, hizmet, tarih ve ücretle kayıtlı olduğu için ek veri girişi
 * gerekmiyor. Satır sırası da Excel'deki gibi — seans sayısı, eşitse ciro
 * (bkz. lib/randevu/ciro.ts); iki tablo yan yana konduğunda
 * karşılaştırılabilmeli.
 *
 * ŞUBE: takvimden farklı olarak şubeye KİLİTLİ. Ciro seansın hangi binada
 * verildiğinin karşılığı; iki şubeyi tek tabloda toplamak kurumun kendi
 * ayrımını bozardı.
 */
export default async function CiroRaporuSayfasi(
  props: PageProps<"/koordinator/randevular/rapor">,
) {
  const kullanici = await yonetimZorunlu("randevular");

  const parametreler = await props.searchParams;
  const kapsam = raporKapsamiMi(parametreler.kapsam) ? parametreler.kapsam : "hafta";
  const capa =
    (typeof parametreler.tarih === "string"
      ? tarihCozumle(parametreler.tarih)
      : null) ?? bugun();

  const aralik = raporAraligi(kapsam, capa);

  const [rapor, sube] = await Promise.all([
    subeCiroRaporu(kullanici.aktifSubeId, aralik),
    db.branch.findUnique({
      where: { id: kullanici.aktifSubeId },
      select: { name: true },
    }),
  ]);

  // Uzman renkleri çubuklar için; rapor sorgusu rengi taşımıyor.
  const renkler = await db.uzman.findMany({
    where: { id: { in: rapor.uzmanlar.map((uzman) => uzman.uzmanId) } },
    select: { id: true, renk: true },
  });
  const renkHaritasi = new Map(renkler.map((uzman) => [uzman.id, uzman.renk]));

  const adres = (ek: Record<string, string>) => {
    const p = new URLSearchParams({ kapsam, tarih: tarihMetni(capa), ...ek });
    return `${TEMEL_YOL}?${p.toString()}`;
  };

  const enYuksekCiro = Math.max(
    1,
    ...rapor.uzmanlar.map((uzman) => uzman.ciroKurus),
  );

  return (
    <div className="space-y-6">
      <Link href="/koordinator/randevular" className={geriBaglantiStili}>
        Randevular
      </Link>

      <SayfaBasligi
        ustBilgi={sube?.name}
        baslik="Ciro raporu"
        aciklama="Seçilen aralıkta uzman bazında seans sayısı ve ciro. Yalnız gerçekleşen seanslar ciroya girer."
        aksiyon={
          <Link
            href={`/api/randevu-raporu?kapsam=${kapsam}&tarih=${tarihMetni(capa)}`}
            className={butonStili("ikincil")}
            prefetch={false}
          >
            Excel’e aktar
          </Link>
        }
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Kapsam"
          temelYol={TEMEL_YOL}
          anahtar="kapsam"
          secili={kapsam}
          digerler={{ tarih: tarihMetni(capa) }}
          secenekler={[
            { deger: "hafta", etiket: "Hafta" },
            { deger: "ay", etiket: "Ay" },
          ]}
        />
      </SuzgecCubugu>

      <Kart className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <Link
            href={adres({ tarih: tarihMetni(raporKaydir(kapsam, capa, -1)) })}
            className={butonStili("ikincil")}
            aria-label="Önceki"
          >
            ‹
          </Link>
          <Link href={adres({ tarih: tarihMetni(bugun()) })} className={butonStili("sade")}>
            Bugün
          </Link>
          <Link
            href={adres({ tarih: tarihMetni(raporKaydir(kapsam, capa, 1)) })}
            className={butonStili("ikincil")}
            aria-label="Sonraki"
          >
            ›
          </Link>
          <span className="ml-1 font-semibold text-zinc-900">
            {aralik.etiket}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Rozet tur="olumlu">{rapor.toplamSeans} seans</Rozet>
          <span className="font-semibold tabular-nums text-zinc-900">
            {paraMetni(rapor.toplamCiro)}
          </span>
          {rapor.toplamPlanlanan > 0 ? (
            <Rozet tur="notr">{rapor.toplamPlanlanan} planlı</Rozet>
          ) : null}
          {rapor.toplamGelmedi > 0 ? (
            <Rozet tur="uyari">{rapor.toplamGelmedi} gelmedi</Rozet>
          ) : null}
          {rapor.toplamIptal > 0 ? (
            <Rozet tur="pasif">{rapor.toplamIptal} iptal</Rozet>
          ) : null}
        </div>
      </Kart>

      {rapor.uzmanlar.length === 0 ? (
        <BosDurum
          baslik="Bu aralıkta randevu yok"
          aciklama="Randevular eklendikçe rapor kendiliğinden dolar; ek veri girişi gerekmiyor."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Kart className="space-y-3 p-4">
            <h2 className={kartBasligiStili}>Uzman bazında</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="pb-2 pr-3 font-semibold">Uzman</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Seans</th>
                    <th className="pb-2 pr-3 text-right font-semibold">Ciro</th>
                    <th className="pb-2 text-right font-semibold">Gelmedi</th>
                  </tr>
                </thead>
                <tbody className="kil-bolmeli">
                  {rapor.uzmanlar.map((uzman) => {
                    const ton = uzmanRengi(
                      renkHaritasi.get(uzman.uzmanId) ?? "",
                    );
                    return (
                      <tr key={uzman.uzmanId}>
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: ton.metin }}
                              aria-hidden
                            />
                            <span className="font-medium text-zinc-900">
                              {uzman.uzmanAdi}
                            </span>
                          </span>
                          {/* Çubuk, tablodaki sayının görsel karşılığı —
                              en yüksek ciroya göre ölçekli. */}
                          <span className="mt-1 block h-1 rounded-full bg-zinc-100">
                            <span
                              className="block h-1 rounded-full"
                              style={{
                                width: `${Math.round(
                                  (uzman.ciroKurus / enYuksekCiro) * 100,
                                )}%`,
                                backgroundColor: ton.metin,
                              }}
                            />
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-zinc-700">
                          {uzman.seansSayisi}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums text-zinc-900">
                          {paraMetni(uzman.ciroKurus)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-zinc-500">
                          {uzman.gelmedi || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-zinc-300">
                    <td className="py-2 pr-3 font-bold text-zinc-900">TOPLAM</td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums">
                      {rapor.toplamSeans}
                    </td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums">
                      {paraMetni(rapor.toplamCiro)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-zinc-500">
                      {rapor.toplamGelmedi || "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Kart>

          <Kart className="space-y-3 p-4">
            <h2 className={kartBasligiStili}>Hizmet kırılımı</h2>
            {rapor.hizmetler.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Bu aralıkta gerçekleşen seans yok.
              </p>
            ) : (
              <ul className="kil-bolmeli">
                {rapor.hizmetler.map((hizmet) => (
                  <li
                    key={hizmet.hizmetId}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-zinc-800">
                        {hizmet.hizmetAdi}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {hizmet.seansSayisi} seans
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-zinc-900">
                      {paraMetni(hizmet.ciroKurus)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Kart>
        </div>
      )}
    </div>
  );
}
