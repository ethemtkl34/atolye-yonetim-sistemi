import type { Metadata } from "next";
import Link from "next/link";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { kayitAlanProgramlar } from "@/lib/kayit-secenekleri";
import { ACIK_ASAMALAR } from "@/lib/aday-durumlari";
import { adiBol } from "@/lib/aday/donusum";
import { db } from "@/lib/db";
import { OgrenciFormu, type OgrenciVarsayilanlari } from "../ogrenci-formu";
import { ogrenciEkle } from "../actions";
import { Bildirim, geriBaglantiStili } from "@/components/ui";

export const metadata: Metadata = {
  title: "Yeni öğrenci",
};

/**
 * §7.1 — Yeni öğrenci kaydı. Akışın ilk adımı olan arama, öğrenci listesi
 * sayfasında yapılıyor; buraya "aradım, bulamadım" diyerek gelinir.
 *
 * §16.9 — `?aday=<id>` ile aday ekranından da gelinebilir: adayın bilgileri
 * forma ön-doldurulur ve kaydedildiğinde aday KAZANILDI'ya taşınır. Adres
 * yalnız KİMLİK taşır; kişisel veri sorgu dizesine yazılmaz, sunucuda okunur.
 */
export default async function YeniOgrenciSayfasi(
  props: PageProps<"/koordinator/ogrenciler/yeni">,
) {
  const kullanici = await yonetimZorunlu("ogrenciler", "TAM");
  const parametreler = await props.searchParams;

  const adayId =
    kullanici.yetkiler.adaylar !== "YOK" && typeof parametreler.aday === "string"
      ? parametreler.aday
      : "";
  const hedef = typeof parametreler.hedef === "string" ? parametreler.hedef : "";

  const aday = adayId
    ? await db.lead.findFirst({
        where: {
          id: adayId,
          branchId: kullanici.aktifSubeId,
          // Kapanmış aday yeniden dönüştürülemez; ön-dolum da yapılmaz.
          stage: { in: ACIK_ASAMALAR },
        },
        select: {
          id: true,
          parentName: true,
          childName: true,
          phone: true,
          interestedProgram: true,
          message: true,
        },
      })
    : null;

  const programlar = await kayitAlanProgramlar(kullanici.aktifSubeId);

  const cocuk = adiBol(aday?.childName ?? null);
  const varsayilanlar: OgrenciVarsayilanlari = aday
    ? {
        firstName: cocuk.firstName,
        lastName: cocuk.lastName,
        // Veli ANNE satırına yazılıyor: aday formunda ebeveyn türü
        // sorulmuyor ve arayanların çoğunluğu anne. Yanlışsa buradan
        // düzeltilebilir — alanlar ön-dolu, kilitli değil.
        anneAdi: aday.parentName ?? "",
        anneTelefon: aday.phone ?? "",
        notes: [
          aday.interestedProgram ? `İlgi: ${aday.interestedProgram}` : null,
          aday.message,
        ]
          .filter(Boolean)
          .join("\n"),
      }
    : {};

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={aday ? `/koordinator/adaylar/${aday.id}` : "/koordinator/ogrenciler"}
          className={geriBaglantiStili}
        >
          {aday ? "← Aday" : "← Öğrenciler"}
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">
          Yeni öğrenci
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Kaydetmeden önce öğrencinin sistemde olup olmadığını aramanız
          önerilir; aynı öğrenci iki kez eklenmemelidir.
        </p>
      </div>

      {adayId && !aday ? (
        <Bildirim tur="hata">
          Aday bulunamadı ya da zaten kapanmış. Form boş açıldı; kaydederseniz
          adaya bağlanmaz.
        </Bildirim>
      ) : null}

      {aday ? (
        <Bildirim tur="bilgi">
          <strong>{aday.parentName ?? "İsimsiz aday"}</strong> adlı adaydan
          dönüştürülüyor — alanlar adaydan dolduruldu, kontrol edip
          tamamlayın. Kaydedildiğinde aday “Kazanıldı” olarak kapanır.
        </Bildirim>
      ) : null}

      <OgrenciFormu
        eylem={ogrenciEkle}
        kaydetEtiketi={aday ? "Öğrenciyi kaydet ve adayı kapat" : "Öğrenciyi kaydet"}
        iptalYolu={
          aday ? `/koordinator/adaylar/${aday.id}` : "/koordinator/ogrenciler"
        }
        programlar={programlar}
        varsayilanlar={varsayilanlar}
        gizliAlanlar={
          aday ? { adayId: aday.id, ...(hedef ? { hedef } : {}) } : undefined
        }
      />
    </div>
  );
}
