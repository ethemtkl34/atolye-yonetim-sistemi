import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, Rozet, SayfaBasligi, baglantiStili, butonStili } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { AKTIF_DONEM_KOSULU, DONEM_DURUMLARI } from "@/lib/durumlar";
import { bugun, haftaBicimle } from "@/lib/tarih";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dönemler",
};

const TEMEL_YOL = "/koordinator/donemler";

/**
 * §4 — Dönem listesi.
 *
 * Arşivlenmiş dönemler burada değil, Arşiv ekranında durur; iki liste
 * birbirinin tamamlayıcısıdır. "Aktif" süzgeci dashboard kartıyla aynı
 * koşulu (`AKTIF_DONEM_KOSULU`) okur.
 *
 * Kartlar dönem detayına açılan tek büyük tıklama hedefidir: koordinatörün
 * bu listedeki tek işi bir dönemi açmak, bu yüzden kart içinde ikinci bir
 * bağlantı veya buton yok. Özet satırları (takvim ilerlemesi, doluluk,
 * kadro) detaya girmeden "hangi dönem ne durumda" sorusuna cevap verir.
 */
export default async function DonemlerSayfasi(
  props: PageProps<"/koordinator/donemler">,
) {
  const kullanici = await yonetimZorunlu();
  const subeId = kullanici.aktifSubeId;

  const parametreler = await props.searchParams;
  const kapsam = parametreler.kapsam === "aktif" ? "aktif" : "tumu";

  const [donemler, arsivSayisi] = await Promise.all([
    db.term.findMany({
      where:
        kapsam === "aktif"
          ? AKTIF_DONEM_KOSULU
          : { status: { not: "ARSIVLENDI" } },
      orderBy: { createdAt: "desc" },
      include: {
        weeks: { orderBy: { weekNumber: "asc" }, select: { date: true } },
        // Dönemin KENDİSİ ortak ama kadrosu ve grupları şubeye ait. Bu üç
        // süzgeç olmadan kart "8 grup, 28 öğrenci" yazar ve diğer şubenin
        // stajyer adlarını sıralardı — dashboard'la da çelişirdi.
        interns: {
          where: { user: { branchId: subeId } },
          orderBy: { user: { name: "asc" } },
          select: { userId: true, user: { select: { name: true } } },
        },
        // Öğrenci sayısı grupların aktif kayıtlarından toplanır; dönemle
        // kayıt arasında doğrudan bir bağ yok (kayıt gruba bağlı).
        groups: {
          where: { branchId: subeId },
          select: {
            _count: {
              select: { enrollments: { where: { status: "AKTIF" } } },
            },
          },
        },
        _count: {
          select: {
            groups: { where: { branchId: subeId } },
            workshops: true,
          },
        },
      },
    }),
    db.term.count({ where: { status: "ARSIVLENDI" } }),
  ]);

  const simdi = bugun().getTime();

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Dönemler"
        aciklama="Her dönem 10 eğitim haftasından ve 5 atölyeden oluşur. Dönemin takvimi ve atölyeleri iki şubede ortaktır; gruplar, kadro ve öğrenci sayıları yalnızca sizin şubenizindir."
        ustBilgi={<Rozet tur="notr">Takvim bütün şubelerde ortak</Rozet>}
        aksiyon={
          <Link
            href="/koordinator/donemler/yeni"
            className={butonStili()}
          >
            Yeni dönem
          </Link>
        }
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Kapsam"
          temelYol={TEMEL_YOL}
          anahtar="kapsam"
          secenekler={[
            { deger: "aktif", etiket: "Aktif" },
            { deger: "tumu", etiket: "Tümü" },
          ]}
          secili={kapsam}
        />
        {arsivSayisi > 0 ? (
          <Link
            href="/koordinator/arsiv"
            className={baglantiStili}
          >
            Arşivde {arsivSayisi} dönem
          </Link>
        ) : null}
      </SuzgecCubugu>

      {donemler.length === 0 ? (
        <BosDurum
          baslik={
            kapsam === "aktif"
              ? "Aktif dönem yok."
              : "Henüz dönem oluşturulmamış."
          }
          aciklama={
            kapsam === "aktif"
              ? "Kayıt alan veya devam eden dönem bulunmuyor. “Tümü” süzgeciyle taslak ve tamamlanmış dönemleri görebilirsiniz."
              : "Öğrenci kaydı alabilmek için önce bir dönem ve grup açın."
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {donemler.map((donem) => {
            const durum = DONEM_DURUMLARI[donem.status];
            const ilkHafta = donem.weeks.at(0);
            const sonHafta = donem.weeks.at(-1);

            const islenenHafta = donem.weeks.filter(
              (hafta) => hafta.date.getTime() < simdi,
            ).length;
            const toplamHafta = donem.weeks.length;
            const tamamlandi = toplamHafta > 0 && islenenHafta === toplamHafta;

            const ogrenciSayisi = donem.groups.reduce(
              (toplam, grup) => toplam + grup._count.enrollments,
              0,
            );

            const kadro = donem.interns.map((satir) => ({
              id: satir.userId,
              ad: satir.user.name,
            }));

            return (
              <Link
                key={donem.id}
                href={`/koordinator/donemler/${donem.id}`}
                className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marka-600"
              >
                <Kart className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-marka-300 hover:bg-marka-50/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 font-medium text-zinc-900">
                      {donem.name}
                    </span>
                    <Rozet tur={durum.rozet}>{durum.etiket}</Rozet>
                  </div>

                  {donem.description ? (
                    <p className="line-clamp-2 text-sm text-zinc-600">
                      {donem.description}
                    </p>
                  ) : null}

                  <p className="text-sm text-zinc-600">
                    {ilkHafta && sonHafta
                      ? `${haftaBicimle(ilkHafta.date, donem.dayMode)} → ${haftaBicimle(sonHafta.date, donem.dayMode)}`
                      : "Takvim tanımlı değil"}
                  </p>

                  {/* Takvim ilerlemesi — kaç eğitim haftası geride kaldı. */}
                  {toplamHafta > 0 ? (
                    <div>
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>
                          {islenenHafta === 0
                            ? "Henüz başlamadı"
                            : `${islenenHafta}/${toplamHafta} hafta işlendi`}
                        </span>
                        {tamamlandi ? (
                          <span className="font-medium text-emerald-700">
                            Takvim bitti
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-yuzey-200">
                        <div
                          className={cn(
                            "h-full",
                            tamamlandi ? "bg-emerald-500" : "bg-marka-600",
                          )}
                          style={{
                            width: `${(islenenHafta / toplamHafta) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Özet sayılar — kart altına yapışır ki iki sütunlu
                      ızgarada kısa kartlarla uzunlar aynı hizada bitsin. */}
                  <div className="mt-auto space-y-2 border-t border-yuzey-200 pt-3">
                    <p className="text-sm text-zinc-700">
                      {donem._count.groups} grup · {ogrenciSayisi} öğrenci ·{" "}
                      {donem._count.workshops} atölye
                    </p>

                    {kadro.length > 0 ? (
                      <p className="flex flex-wrap items-center gap-1.5">
                        {kadro.map((stajyer) => (
                          <span
                            key={stajyer.id}
                            className="inline-flex items-center rounded bg-yuzey-100 px-2 py-0.5 text-xs text-zinc-700"
                          >
                            {stajyer.ad}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-400">
                        Stajyer kadrosu tanımlı değil
                      </p>
                    )}
                  </div>
                </Kart>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
