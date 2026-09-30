import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { subeleriOku, yonetimZorunlu } from "@/lib/yetki-kapisi";
import { tarihMetni } from "@/lib/tarih";
import { OgrenciFormu } from "../../ogrenci-formu";
import { OgrenciSilButonu } from "../../ogrenci-sil-butonu";
import { ogrenciGuncelle } from "../../actions";
import { geriBaglantiStili } from "@/components/ui";
import { SUBESIZ_DEGERI, subeEtiketi } from "@/lib/sube-etiketi";

export const metadata: Metadata = {
  title: "Öğrenciyi düzenle",
};

export default async function OgrenciDuzenleSayfasi(
  props: PageProps<"/koordinator/ogrenciler/[id]/duzenle">,
) {
  const kullanici = await yonetimZorunlu("ogrenciler", "TAM");
  const { id } = await props.params;

  // Öğrenciler ortak havuzda (Eylül 2026): iki şube de düzenler.
  const [ogrenci, subeler] = await Promise.all([
    db.student.findFirst({
      where: { id },
      include: {
        branch: { select: { name: true } },
        // Ad ve telefon `Veli` kaydında (§17.1); form onları oradan doldurur.
        guardians: { include: { veli: true } },
        healthInfo: true,
        // Silme engelinin sebebi arayüzde de görünsün diye: puanlaması, raporu
        // veya görüşme kaydı olan öğrenci silinemez (bkz. `ogrenciSil`).
        _count: {
          select: {
            reports: true,
            counselingSessions: true,
            parentMeetings: true,
            intelligenceTests: true,
          },
        },
        enrollments: {
          select: {
            _count: { select: { scores: true } },
            group: {
              select: { branchId: true, branch: { select: { name: true } } },
            },
          },
        },
      },
    }),
    subeleriOku(),
  ]);

  if (!ogrenci) notFound();

  // `ogrenciSil` ile aynı kurallar: yalnız kayıt şubesi ya da yönetici;
  // diğer şubede kaydı olan öğrenci hiç silinemez.
  const yonetici = kullanici.roller.includes("ADMIN");
  const baskaSubeKaydi = ogrenci.enrollments.find(
    (kayit) => kayit.group.branchId !== ogrenci.branchId,
  );

  const puanlamaSayisi = ogrenci.enrollments.reduce(
    (toplam, kayit) => toplam + kayit._count.scores,
    0,
  );

  const silmeEngeli =
    !yonetici &&
    ogrenci.branchId !== null &&
    ogrenci.branchId !== kullanici.aktifSubeId
      ? `Bu öğrenciyi yalnızca kayıt şubesi (${subeEtiketi(ogrenci.branch)}) ya da kurum yöneticisi silebilir.`
      : baskaSubeKaydi
        ? `Bu öğrenci silinemez: ${baskaSubeKaydi.group.branch.name} şubesinde program kaydı var.`
        : puanlamaSayisi > 0
      ? `Bu öğrenci silinemez: ${puanlamaSayisi} puanlaması var ve bu geçmiş korunmalı. Programdan çıkarmak için kaydını iptal edin.`
      : ogrenci._count.reports > 0
        ? `Bu öğrenci silinemez: üretilmiş ${ogrenci._count.reports} raporu var.`
        : ogrenci._count.counselingSessions > 0
          ? `Bu öğrenci silinemez: ${ogrenci._count.counselingSessions} görüşme kaydı var ve bu geçmiş korunmalı.`
          : ogrenci._count.parentMeetings > 0
            ? `Bu öğrenci silinemez: ${ogrenci._count.parentMeetings} veli görüşmesi kaydı var ve bu geçmiş korunmalı.`
            : ogrenci._count.intelligenceTests > 0
              ? `Bu öğrenci silinemez: ${ogrenci._count.intelligenceTests} zeka testi belgesi var ve bu geçmiş korunmalı.`
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
        subeler={subeler.map((sube) => ({ id: sube.id, ad: sube.name }))}
        varsayilanlar={{
          kayitSubesi: ogrenci.branchId ?? SUBESIZ_DEGERI,
          firstName: ogrenci.firstName,
          lastName: ogrenci.lastName,
          birthDate: ogrenci.birthDate
            ? tarihMetni(ogrenci.birthDate)
            : undefined,
          school: ogrenci.school ?? undefined,
          grade: ogrenci.grade ?? undefined,
          notes: ogrenci.notes ?? undefined,
          anneAdi: anne?.veli.fullName,
          anneTelefon: anne?.veli.phone ?? undefined,
          babaAdi: baba?.veli.fullName,
          babaTelefon: baba?.veli.phone ?? undefined,
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
