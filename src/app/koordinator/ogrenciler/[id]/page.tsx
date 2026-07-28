import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";
import { BosDurum, Kart, SayfaBasligi } from "@/components/ui";
import { tarihBicimle } from "@/lib/tarih";

export async function generateMetadata(
  props: PageProps<"/koordinator/ogrenciler/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const ogrenci = await db.student.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  return {
    title: ogrenci ? `${ogrenci.firstName} ${ogrenci.lastName}` : "Öğrenci",
  };
}

/**
 * §6.3 — Öğrenci profili.
 *
 * Şu an genel bilgiler, veliler ve sağlık bölümleri dolu. Kayıtlar, stajyer
 * atamaları, katılım ve puanlama geçmişi, raporlar ve PDF geçmişi sonraki
 * paketlerde bu sayfaya eklenecek; bölümler yerlerini şimdiden koruyor ki
 * profilin bütünü görünsün.
 */
export default async function OgrenciProfilSayfasi(
  props: PageProps<"/koordinator/ogrenciler/[id]">,
) {
  await koordinatorZorunlu();
  const { id } = await props.params;

  const ogrenci = await db.student.findUnique({
    where: { id },
    include: {
      guardians: true,
      healthInfo: true,
    },
  });

  if (!ogrenci) notFound();

  const anne = ogrenci.guardians.find((v) => v.type === "ANNE");
  const baba = ogrenci.guardians.find((v) => v.type === "BABA");
  const saglik = ogrenci.healthInfo;

  const saglikSatirlari = [
    { etiket: "Alerji", deger: saglik?.allergies },
    { etiket: "Düzenli kullanılan ilaç", deger: saglik?.medications },
    { etiket: "Özel eğitim / destek", deger: saglik?.specialEducation },
    { etiket: "Sağlık durumu", deger: saglik?.healthNotes },
    { etiket: "Acil durum", deger: saglik?.emergencyInfo },
  ].filter((satir) => satir.deger);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/ogrenciler"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Öğrenciler
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={`${ogrenci.firstName} ${ogrenci.lastName}`}
            aksiyon={
              <Link
                href={`/koordinator/ogrenciler/${ogrenci.id}/duzenle`}
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Bilgileri düzenle
              </Link>
            }
          />
        </div>
      </div>

      {/* 1. Genel bilgiler */}
      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Genel bilgiler
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <Bilgi
            etiket="Doğum tarihi"
            deger={ogrenci.birthDate ? tarihBicimle(ogrenci.birthDate) : null}
          />
          <Bilgi etiket="Okul" deger={ogrenci.school} />
          <Bilgi etiket="Sınıf" deger={ogrenci.grade} />
        </dl>
        {ogrenci.notes ? (
          <div className="mt-3">
            <p className="text-sm text-zinc-500">Notlar</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-800">
              {ogrenci.notes}
            </p>
          </div>
        ) : null}
      </Kart>

      {/* 2. Anne ve baba */}
      <Kart className="p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Anne ve baba bilgileri
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Bilgi
            etiket="Anne"
            deger={
              anne
                ? `${anne.fullName}${anne.phone ? ` · ${anne.phone}` : ""}`
                : null
            }
          />
          <Bilgi
            etiket="Baba"
            deger={
              baba
                ? `${baba.fullName}${baba.phone ? ` · ${baba.phone}` : ""}`
                : null
            }
          />
        </dl>
      </Kart>

      {/* 3. Sağlık */}
      <Kart className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">
            Sağlık ve özel durum
          </h2>
          <span className="text-xs text-zinc-500">
            Stajyerlere kapalı
          </span>
        </div>

        {saglikSatirlari.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Kayıtlı sağlık bilgisi yok.
          </p>
        ) : (
          <dl className="mt-3 space-y-3">
            {saglikSatirlari.map((satir) => (
              <div key={satir.etiket}>
                <dt className="text-sm text-zinc-500">{satir.etiket}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-800">
                  {satir.deger}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {saglik?.internSafetyNote ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">
              Stajyerin gördüğü uyarı
            </p>
            <p className="mt-1 text-sm text-amber-900">
              {saglik.internSafetyNote}
            </p>
          </div>
        ) : null}
      </Kart>

      {/* 4–11. Sonraki paketlerde dolacak bölümler */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Kayıtlar ve geçmiş
        </h2>
        <BosDurum
          baslik="Bu öğrencinin henüz kaydı yok."
          aciklama="Dönem ve kulüp kayıtları, stajyer ataması, atölye katılım geçmişi, puanlamalar ve raporlar P6–P10 paketlerinde bu sayfada görünecek."
        />
      </div>
    </div>
  );
}

function Bilgi({
  etiket,
  deger,
}: {
  etiket: string;
  deger: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{etiket}</dt>
      <dd className="mt-0.5 text-sm text-zinc-800">
        {deger ?? <span className="text-zinc-400">—</span>}
      </dd>
    </div>
  );
}
