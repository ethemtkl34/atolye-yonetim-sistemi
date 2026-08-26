import type { Metadata } from "next";
import Link from "next/link";
import type { LeadSource, LeadStage } from "@/generated/prisma/enums";
import { Sayfalama, sayfaNumarasiCoz } from "@/components/sayfalama";
import { SuzgecCubugu, SuzgecGrubu, SuzgecSecici } from "@/components/suzgec";
import {
  BosDurum,
  Girdi,
  Kart,
  Rozet,
  SayfaBasligi,
  baglantiStili,
  butonStili,
} from "@/components/ui";
import { ADAY_ASAMALARI, ADAY_KAYNAKLARI } from "@/lib/aday-durumlari";
import {
  adayAra,
  adayKapsamSayilari,
  adayKapsamiCoz,
  adaySorumlulari,
  sorunluAdaySayisi,
} from "@/lib/aday/aday-listesi";
import { bugun, tarihBicimle } from "@/lib/tarih";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { IletisimDugmeleri } from "@/components/iletisim-eylemleri";
import { YeniAdayDugmesi } from "./aday-formu";

export const metadata: Metadata = {
  title: "Adaylar",
};

const TEMEL_YOL = "/koordinator/adaylar";
const SAYFA_BOYUTU = 25;

/**
 * §16.6 — Aday listesi: danışmanın günlük çalışma kuyruğu.
 *
 * Varsayılan görünüm "Açık" değil de kuyruk mantığıyla sıralanmış açık
 * adaylar: en geciken takip en üstte. Süzgeçler sıradan GET bağlantıları
 * (öğrenci listesiyle aynı sözleşme): adres paylaşılabilir, geri tuşu
 * çalışır ve telefon görüşmesinden dönüldüğünde aynı dilim açılır.
 */
export default async function AdaylarSayfasi(
  props: PageProps<"/koordinator/adaylar">,
) {
  const kullanici = await yonetimZorunlu("adaylar");
  const subeId = kullanici.aktifSubeId;
  const yazabilir = kullanici.yetkiler.adaylar === "TAM";

  const parametreler = await props.searchParams;
  const sorgu = typeof parametreler.q === "string" ? parametreler.q : "";
  const kapsam = adayKapsamiCoz(parametreler.kapsam);
  const asama =
    typeof parametreler.asama === "string" &&
    parametreler.asama in ADAY_ASAMALARI
      ? (parametreler.asama as LeadStage)
      : "";
  const kaynak =
    typeof parametreler.kaynak === "string" &&
    parametreler.kaynak in ADAY_KAYNAKLARI
      ? (parametreler.kaynak as LeadSource)
      : "";
  const sorumluId =
    typeof parametreler.sorumlu === "string" ? parametreler.sorumlu : "";

  const istenenSayfa = sayfaNumarasiCoz(parametreler.sayfa);

  const ara = (sayfa: number) =>
    adayAra({
      subeId,
      kapsam,
      sorgu,
      asama,
      kaynak,
      sorumluId,
      enFazla: SAYFA_BOYUTU,
      atla: (sayfa - 1) * SAYFA_BOYUTU,
    });

  const [ilkSonuc, sayilar, sorunlu] = await Promise.all([
    ara(istenenSayfa),
    adayKapsamSayilari(subeId),
    sorunluAdaySayisi(subeId),
  ]);

  const sayfaSayisi = Math.max(1, Math.ceil(ilkSonuc.toplam / SAYFA_BOYUTU));
  // Yer imine alınmış sayfa numarası artık yoksa boş liste yerine son sayfa.
  const sayfa = Math.min(istenenSayfa, sayfaSayisi);
  const kaydiTasti = istenenSayfa > sayfaSayisi;
  const { adaylar, toplam } = kaydiTasti ? await ara(sayfa) : ilkSonuc;

  // Sorumlu süzgeci yalnız şubede birden çok ilgili kullanıcı varsa anlamlı.
  const kadro = await adaySorumlulari(subeId);

  const suzgecler: Record<string, string> = {
    ...(sorgu ? { q: sorgu } : {}),
    ...(kapsam !== "acik" ? { kapsam } : {}),
    ...(asama ? { asama } : {}),
    ...(kaynak ? { kaynak } : {}),
    ...(sorumluId ? { sorumlu: sorumluId } : {}),
  };

  /** Bir süzgeç kutusunun kendi anahtarı hariç korunacak diğerleri. */
  const digerleri = (haric: string) =>
    Object.fromEntries(
      Object.entries(suzgecler).filter(([anahtar]) => anahtar !== haric),
    );

  const gun = bugun();
  const ilkSira = toplam === 0 ? 0 : (sayfa - 1) * SAYFA_BOYUTU + 1;
  const sonSira = (sayfa - 1) * SAYFA_BOYUTU + adaylar.length;

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Adaylar"
        aciklama="Reklamdan, web sitesinden ve telefondan gelen veli başvuruları burada aranır ve takip edilir."
        aksiyon={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`${TEMEL_YOL}/rapor`} className={butonStili("ikincil")}>
              Rapor
            </Link>
            {yazabilir ? <YeniAdayDugmesi /> : null}
          </div>
        }
      />

      {sorunlu > 0 ? (
        <div className="kil-uyari p-3.5 text-sm">
          <strong>{sorunlu} aday</strong> eksik bilgiyle geldi (şube kodu
          çözülemedi ya da iletişim bilgisi yok). Kartlarında “Eksik bilgi”
          etiketi var; kontrol edip tamamlayın.
        </div>
      ) : null}

      <form method="get" className="flex max-w-lg gap-2">
        {Object.entries(digerleri("q")).map(([ad, deger]) => (
          <input key={ad} type="hidden" name={ad} value={deger} />
        ))}
        <Girdi
          name="q"
          type="search"
          defaultValue={sorgu}
          placeholder="Veli adı, öğrenci adı veya telefon"
          aria-label="Aday ara"
        />
        <button type="submit" className={butonStili("ikincil", "shrink-0")}>
          Ara
        </button>
      </form>

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Kapsam"
          temelYol={TEMEL_YOL}
          anahtar="kapsam"
          secenekler={[
            { deger: "acik", etiket: `Açık (${sayilar.acik})` },
            { deger: "bugun", etiket: `Bugün aranacak (${sayilar.bugun})` },
            { deger: "gecikmis", etiket: `Gecikmiş (${sayilar.gecikmis})` },
            { deger: "tumu", etiket: `Tümü (${sayilar.tumu})` },
          ]}
          secili={kapsam}
          digerler={digerleri("kapsam")}
        />
        <SuzgecSecici
          etiket="Aşama"
          temelYol={TEMEL_YOL}
          anahtar="asama"
          secenekler={Object.entries(ADAY_ASAMALARI).map(([deger, bilgi]) => ({
            deger,
            etiket: bilgi.etiket,
          }))}
          secili={asama}
          digerler={digerleri("asama")}
        />
        <SuzgecSecici
          etiket="Kaynak"
          temelYol={TEMEL_YOL}
          anahtar="kaynak"
          secenekler={Object.entries(ADAY_KAYNAKLARI).map(
            ([deger, etiket]) => ({ deger, etiket }),
          )}
          secili={kaynak}
          digerler={digerleri("kaynak")}
        />
        {kadro.length > 1 ? (
          <SuzgecSecici
            etiket="Sorumlu"
            temelYol={TEMEL_YOL}
            anahtar="sorumlu"
            secenekler={[
              ...kadro.map((kisi) => ({ deger: kisi.id, etiket: kisi.name })),
              { deger: "yok", etiket: "Atanmamış" },
            ]}
            secili={sorumluId}
            digerler={digerleri("sorumlu")}
          />
        ) : null}
      </SuzgecCubugu>

      {toplam > 0 ? (
        <p className="text-sm text-zinc-600">
          <span className="font-medium">{toplam}</span> aday
          {sayfaSayisi > 1 ? ` · ${ilkSira}-${sonSira} arası gösteriliyor` : ""}
          {sorgu ? (
            <>
              {" · "}
              <Link
                href={`${TEMEL_YOL}?${new URLSearchParams(digerleri("q")).toString()}`}
                className={baglantiStili}
              >
                aramayı temizle
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {kaydiTasti ? (
        <p className="text-sm text-vurgu-700">
          İstenen sayfa artık yok; son sayfa gösteriliyor.
        </p>
      ) : null}

      {adaylar.length === 0 ? (
        <BosDurum
          baslik={
            sorgu
              ? `"${sorgu}" için sonuç bulunamadı.`
              : kapsam === "bugun"
                ? "Bugün aranacak aday yok."
                : kapsam === "gecikmis"
                  ? "Gecikmiş takip yok."
                  : kapsam === "acik"
                    ? "Açık aday yok."
                    : "Henüz aday kaydı yok."
          }
          aciklama={
            sorgu
              ? "Farklı bir yazım deneyin veya süzgeçleri gevşetin."
              : kapsam === "bugun"
                ? "Takip tarihi bugüne ayarlı açık aday kalmadı."
                : kapsam === "gecikmis"
                  ? "Bütün açık adayların araması zamanında."
                  : "Telefonla arayan veya şubeye gelen velileri “Yeni aday” ile ekleyin. Reklam ve web sitesi başvuruları kendiliğinden düşer."
          }
        />
      ) : (
        <div className="space-y-2">
          {adaylar.map((aday) => {
            const ad = aday.parentName ?? "İsimsiz aday";
            const asamaBilgisi = ADAY_ASAMALARI[aday.stage];
            const gecikti =
              aday.nextActionDate !== null && aday.nextActionDate < gun;
            const bugunMu =
              aday.nextActionDate !== null &&
              aday.nextActionDate.getTime() === gun.getTime();

            const meta = [
              aday.childName ? `${aday.childName} için` : null,
              ADAY_KAYNAKLARI[aday.source],
              aday.unreachableCount > 0
                ? `${aday.unreachableCount}. deneme`
                : null,
              aday.assignedTo?.name ?? null,
            ].filter(Boolean);

            return (
              // `relative` + `after:inset-0`: kartın tamamı adayı açar.
              // Sağdaki ara/WhatsApp düğmeleri `z-10` ile kaplamanın üstünde
              // duruyor — listeden arama bu modülün ASIL işi, kartı açmadan
              // telefona geçebilmek gerekiyor.
              <Kart key={aday.id} className="relative p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`${TEMEL_YOL}/${aday.id}`}
                        className="font-medium text-zinc-900 after:absolute after:inset-0 hover:text-marka-700 hover:underline"
                      >
                        {ad}
                      </Link>
                      <Rozet tur={asamaBilgisi.rozet}>
                        {asamaBilgisi.etiket}
                      </Rozet>
                      {aday.ingestStatus !== "TAMAM" ? (
                        <Rozet tur="uyari">Eksik bilgi</Rozet>
                      ) : null}
                    </div>

                    {meta.length > 0 ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        {meta.join(" · ")}
                      </p>
                    ) : null}

                    {aday.nextActionDate ? (
                      <p
                        className={
                          gecikti
                            ? "mt-1 text-xs font-semibold text-vurgu-700"
                            : "mt-1 text-xs text-zinc-500"
                        }
                      >
                        {gecikti
                          ? `Gecikmiş: ${tarihBicimle(aday.nextActionDate)} — aranacaktı`
                          : bugunMu
                            ? "Bugün aranacak"
                            : `Sonraki arama: ${tarihBicimle(aday.nextActionDate)}`}
                      </p>
                    ) : aday.convertedStudentId ? (
                      <p className="mt-1 text-xs text-emerald-700">
                        Öğrenciye dönüştürüldü
                      </p>
                    ) : null}
                  </div>

                  {aday.phone ? (
                    <div className="relative z-10 shrink-0">
                      <IletisimDugmeleri telefon={aday.phone} boyut="kucuk" />
                    </div>
                  ) : null}
                </div>
              </Kart>
            );
          })}
        </div>
      )}

      <Sayfalama
        temelYol={TEMEL_YOL}
        sayfa={sayfa}
        sayfaSayisi={sayfaSayisi}
        digerler={suzgecler}
      />
    </div>
  );
}

