import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/auth-guard";
import { tarihMetni } from "@/lib/tarih";
import { OgrenciFormu } from "../../ogrenci-formu";
import { OgrenciSilButonu } from "../../ogrenci-sil-butonu";
import { ogrenciGuncelle } from "../../actions";
import { geriBaglantiStili } from "@/components/ui";

export const metadata: Metadata = {
  title: "Öğrenciyi düzenle",
};

export default async function OgrenciDuzenleSayfasi(
  props: PageProps<"/koordinator/ogrenciler/[id]/duzenle">,
) {
  const kullanici = await yonetimZorunlu();
  const { id } = await props.params;

  const ogrenci = await db.student.findFirst({
    where: { id, branchId: kullanici.aktifSubeId },
    include: {
      guardians: true,
      healthInfo: true,
      // Silme engelinin sebebi arayüzde de görünsün diye: puanlaması veya
      // raporu olan öğrenci silinemez (bkz. `ogrenciSil`).
      _count: { select: { reports: true } },
      enrollments: { select: { _count: { select: { scores: true } } } },
    },
  });

  if (!ogrenci) notFound();

  const puanlamaSayisi = ogrenci.enrollments.reduce(
    (toplam, kayit) => toplam + kayit._count.scores,
    0,
  );

  const silmeEngeli =
    puanlamaSayisi > 0
      ? `Bu öğrenci silinemez: ${puanlamaSayisi} puanlaması var ve bu geçmiş korunmalı. Programdan çıkarmak için kaydını iptal edin.`
      : ogrenci._count.reports > 0
        ? `Bu öğrenci silinemez: üretilmiş ${ogrenci._count.reports} raporu var.`
        : undefined;

  const anne = ogrenci.guardians.find((v) => v.type === "ANNE");
  const baba = ogrenci.guardians.find((v) => v.type === "BABA");
  const saglik = ogrenci.healthInfo;
  const profilYolu = `/koordinator/ogrenciler/${ogrenci.id}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={profilYolu} className={geriBaglantiStili}>
          ← {ogrenci.firstName} {ogrenci.lastName}
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          Öğrenci bilgilerini düzenle
        </h1>
      </div>

      <OgrenciFormu
        eylem={ogrenciGuncelle.bind(null, ogrenci.id)}
        kaydetEtiketi="Değişiklikleri kaydet"
        iptalYolu={profilYolu}
        varsayilanlar={{
          firstName: ogrenci.firstName,
          lastName: ogrenci.lastName,
          birthDate: ogrenci.birthDate
            ? tarihMetni(ogrenci.birthDate)
            : undefined,
          school: ogrenci.school ?? undefined,
          grade: ogrenci.grade ?? undefined,
          notes: ogrenci.notes ?? undefined,
          anneAdi: anne?.fullName,
          anneTelefon: anne?.phone ?? undefined,
          babaAdi: baba?.fullName,
          babaTelefon: baba?.phone ?? undefined,
          alerji: saglik?.allergies ?? undefined,
          ilac: saglik?.medications ?? undefined,
          ozelEgitim: saglik?.specialEducation ?? undefined,
          saglikNotu: saglik?.healthNotes ?? undefined,
          acilDurum: saglik?.emergencyInfo ?? undefined,
          stajyerUyarisi: saglik?.internSafetyNote ?? undefined,
        }}
      />

      <OgrenciSilButonu
        ogrenciId={ogrenci.id}
        ad={`${ogrenci.firstName} ${ogrenci.lastName}`}
        engelSebebi={silmeEngeli}
      />
    </div>
  );
}
