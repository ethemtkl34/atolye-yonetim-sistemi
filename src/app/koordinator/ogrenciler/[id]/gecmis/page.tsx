import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { BosDurum, Buton, Girdi, Kart, Rozet, SayfaBasligi, butonStili, geriBaglantiStili, kartBasligiStili } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu, SuzgecSecici } from "@/components/suzgec";
import { ortalamaBicimle, puanlamaOrtalamasi } from "@/lib/scoring";
import { tarihCozumle, tarihGunleBicimle, tarihMetni } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Atölye geçmişi",
};

/**
 * §6.4 — Öğrencinin bütün atölye geçmişi, filtrelerle.
 *
 * Süzgeçler diğer liste ekranlarıyla aynı sözleşmede (`SuzgecCubugu`):
 * seçim adres satırında durur, sonuç paylaşılabilir ve geri tuşu beklendiği
 * gibi çalışır. Tarih aralığı serbest girdi olduğu için küçük bir GET formu
 * olarak aynı çubukta durur.
 */
export default async function OgrenciGecmisiSayfasi(
  props: PageProps<"/koordinator/ogrenciler/[id]/gecmis">,
) {
  const kullanici = await yonetimZorunlu("ogrenciler");
  const subeId = kullanici.aktifSubeId;
  const { id } = await props.params;
  const parametreler = await props.searchParams;

  const tekDeger = (ad: string) => {
    const deger = parametreler[ad];
    return typeof deger === "string" && deger ? deger : "";
  };

  const program = tekDeger("program");
  const turHam = tekDeger("tur");
  const tur = turHam === "donem" || turHam === "kulup" ? turHam : "tumu";
  const atolye = tekDeger("atolye");
  const katilimHam = tekDeger("katilim");
  const katilim =
    katilimHam === "katildi" || katilimHam === "katilmadi"
      ? katilimHam
      : "tumu";
  const baslangic = tekDeger("baslangic");
  const bitis = tekDeger("bitis");

  /** Adreste korunan süzgeçler — varsayılanlar adrese yazılmaz. */
  const korunanlar: Record<string, string> = {
    ...(tur !== "tumu" ? { tur } : {}),
    ...(katilim !== "tumu" ? { katilim } : {}),
    ...(program ? { program } : {}),
    ...(atolye ? { atolye } : {}),
    ...(baslangic ? { baslangic } : {}),
    ...(bitis ? { bitis } : {}),
  };
  const korunanlarHaric = (...haric: string[]) =>
    Object.fromEntries(
      Object.entries(korunanlar).filter(([anahtar]) => !haric.includes(anahtar)),
    );

  const baslangicTarihi = baslangic ? tarihCozumle(baslangic) : null;
  const bitisTarihi = bitis ? tarihCozumle(bitis) : null;

  const ogrenci = await db.student.findFirst({
    where: { id, branchId: subeId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!ogrenci) notFound();

  const puanlamalar = await db.score.findMany({
    where: {
      enrollment: {
        studentId: id,
        group: { branchId: subeId },
        // Program ve tür koşulları aynı `group` anahtarına yazılamaz — nesne
        // literalinde sonraki anahtar öncekini ezer ve program filtresi
        // sessizce kaybolurdu. İkisi AND altında birleştiriliyor.
        ...(program || tur === "donem" || tur === "kulup"
          ? {
              group: {
                AND: [
                  ...(program
                    ? [{ OR: [{ termId: program }, { clubId: program }] }]
                    : []),
                  ...(tur === "donem" ? [{ termId: { not: null } }] : []),
                  ...(tur === "kulup" ? [{ clubId: { not: null } }] : []),
                ],
              },
            }
          : {}),
      },
      ...(katilim === "katildi" ? { attended: true } : {}),
      ...(katilim === "katilmadi" ? { attended: false } : {}),
      // Atölye ve tarih koşulları da aynı sebepten tek `session` nesnesinde.
      ...(atolye || baslangicTarihi || bitisTarihi
        ? {
            session: {
              ...(atolye ? { workshopTypeId: atolye } : {}),
              ...(baslangicTarihi || bitisTarihi
                ? {
                    date: {
                      ...(baslangicTarihi ? { gte: baslangicTarihi } : {}),
                      ...(bitisTarihi ? { lte: bitisTarihi } : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
    orderBy: { session: { date: "desc" } },
    select: {
      id: true,
      attended: true,
      session: {
        select: {
          date: true,
          workshopType: { select: { name: true } },
        },
      },
      enrollment: {
        select: {
          id: true,
          intern: { select: { name: true } },
          group: {
            select: {
              name: true,
              term: { select: { name: true } },
              club: { select: { name: true } },
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          questionTextSnapshot: true,
          value: true,
          sortOrder: true,
        },
      },
    },
  });

  // Filtre seçenekleri yalnızca bu öğrencinin gerçekten ilişkili olduğu
  // programlar ve atölyelerden oluşur; boş sonuç veren seçenek gösterilmez.
  const [kayitlar, atolyeler] = await Promise.all([
    db.enrollment.findMany({
      where: { studentId: id, group: { branchId: subeId } },
      select: {
        group: {
          select: {
            term: { select: { id: true, name: true } },
            club: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.workshopType.findMany({
      where: {
        sessions: {
          some: {
            scores: {
              some: {
                enrollment: { studentId: id, group: { branchId: subeId } },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const programlar = [
    ...new Map(
      kayitlar.map((kayit) => {
        const kaynak = kayit.group.term ?? kayit.group.club;
        return [
          kaynak?.id ?? "",
          {
            id: kaynak?.id ?? "",
            ad: kaynak?.name ?? "Program",
            tur: kayit.group.term ? "Dönem" : "Kulüp",
          },
        ];
      }),
    ).values(),
  ].filter((secenek) => secenek.id);

  const filtreliMi = Object.keys(korunanlar).length > 0;
  const temelYol = `/koordinator/ogrenciler/${ogrenci.id}/gecmis`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/koordinator/ogrenciler/${ogrenci.id}`}
          className={geriBaglantiStili}
        >
          ← {ogrenci.firstName} {ogrenci.lastName}
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik="Atölye geçmişi"
            aciklama="Öğrencinin ne zaman, hangi program kapsamında ve hangi atölyeye katıldığı. Katılmadığı oturumlar da listede kalır; ortalamaya girmezler."
          />
        </div>
      </div>

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Kayıt türü"
          temelYol={temelYol}
          anahtar="tur"
          secili={tur}
          digerler={korunanlarHaric("tur")}
          secenekler={[
            { deger: "tumu", etiket: "Tümü" },
            { deger: "donem", etiket: "Dönem" },
            { deger: "kulup", etiket: "Kulüp" },
          ]}
        />
        <SuzgecGrubu
          etiket="Katılım"
          temelYol={temelYol}
          anahtar="katilim"
          secili={katilim}
          digerler={korunanlarHaric("katilim")}
          secenekler={[
            { deger: "tumu", etiket: "Tümü" },
            { deger: "katildi", etiket: "Katıldı" },
            { deger: "katilmadi", etiket: "Katılmadı" },
          ]}
        />
        <SuzgecSecici
          etiket="Program"
          temelYol={temelYol}
          anahtar="program"
          secili={program}
          digerler={korunanlarHaric("program")}
          secenekler={programlar.map((secenek) => ({
            deger: secenek.id,
            etiket: `${secenek.tur}: ${secenek.ad}`,
          }))}
        />
        <SuzgecSecici
          etiket="Atölye"
          temelYol={temelYol}
          anahtar="atolye"
          secili={atolye}
          digerler={korunanlarHaric("atolye")}
          secenekler={atolyeler.map((secenek) => ({
            deger: secenek.id,
            etiket: secenek.name,
          }))}
        />

        {/* Tarih aralığı serbest girdi: çip/seçici modeline sığmaz, küçük bir
            GET formu olarak aynı çubukta durur. Gizli alanlar diğer süzgeçleri
            taşır (ogrenciler sayfasındaki arama formu deseni). */}
        <form method="get" className="flex flex-wrap items-center gap-2">
          {Object.entries(korunanlarHaric("baslangic", "bitis")).map(
            ([anahtar, deger]) => (
              <input key={anahtar} type="hidden" name={anahtar} value={deger} />
            ),
          )}
          <span className="text-sm text-zinc-500">Tarih:</span>
          <Girdi
            type="date"
            name="baslangic"
            defaultValue={baslangic}
            aria-label="Başlangıç tarihi"
            className="w-auto"
          />
          <span className="text-sm text-zinc-400">–</span>
          <Girdi
            type="date"
            name="bitis"
            defaultValue={bitis}
            aria-label="Bitiş tarihi"
            className="w-auto"
          />
          <Buton type="submit" tur="ikincil">
            Uygula
          </Buton>
          {filtreliMi ? (
            <Link href={temelYol} className={butonStili("sade")}>
              Temizle
            </Link>
          ) : null}
        </form>
      </SuzgecCubugu>

      {puanlamalar.length === 0 ? (
        <BosDurum
          baslik={
            filtreliMi
              ? "Bu filtrelerle kayıt bulunamadı."
              : "Henüz doldurulmuş atölye formu yok."
          }
          aciklama={
            filtreliMi
              ? "Filtreleri temizleyerek bütün geçmişi görebilirsiniz."
              : "Stajyer bir form kaydettiğinde geçmiş burada oluşur."
          }
        />
      ) : (
        <Kart className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-yuzey-200 bg-yuzey-50 text-left text-xs font-medium text-marka-800">
              <tr>
                <th className="px-4 py-2 font-medium">Tarih</th>
                <th className="px-4 py-2 font-medium">Tür</th>
                <th className="px-4 py-2 font-medium">Program / Grup</th>
                <th className="px-4 py-2 font-medium">Atölye</th>
                <th className="px-4 py-2 font-medium">Katılım</th>
                <th className="px-4 py-2 font-medium">Ortalama</th>
                <th className="px-4 py-2 font-medium">Stajyer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yuzey-100">
              {puanlamalar.map((puanlama) => {
                const grup = puanlama.enrollment.group;
                const ortalama = puanlamaOrtalamasi({
                  attended: puanlama.attended,
                  answers: puanlama.answers,
                });

                return (
                  <tr key={puanlama.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-700">
                      <Link
                        href={`/koordinator/puanlamalar/${puanlama.enrollment.id}/${tarihMetni(puanlama.session.date)}`}
                        className={kartBasligiStili}
                      >
                        {tarihGunleBicimle(puanlama.session.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <Rozet>{grup.term ? "Dönem" : "Kulüp"}</Rozet>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {grup.term?.name ?? grup.club?.name ?? "Program"}
                      <span className="text-zinc-400"> · {grup.name}</span>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {puanlama.session.workshopType.name}
                    </td>
                    <td className="px-4 py-2">
                      <Rozet tur={puanlama.attended ? "olumlu" : "pasif"}>
                        {puanlama.attended ? "Katıldı" : "Katılmadı"}
                      </Rozet>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-zinc-700">
                      {ortalamaBicimle(ortalama)}
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {puanlama.enrollment.intern?.name ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Kart>
      )}

      {puanlamalar.length > 0 ? (
        <p className="text-xs text-zinc-500">
          {puanlamalar.length} kayıt listeleniyor.
        </p>
      ) : null}
    </div>
  );
}
