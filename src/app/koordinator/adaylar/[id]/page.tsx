import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdayAsamaEylemleri } from "@/components/aday-asama-eylemleri";
import { AdayZamanCizelgesi } from "@/components/aday-zaman-cizelgesi";
import { IletisimDugmeleri } from "@/components/iletisim-eylemleri";
import {
  Kart,
  OzetHucresi,
  Rozet,
  SayfaBasligi,
  baglantiStili,
  geriBaglantiStili,
} from "@/components/ui";
import {
  ACIK_ASAMALAR,
  ADAY_ASAMALARI,
  ADAY_ASAMA_GECISLERI,
  ADAY_KAYIP_SEBEPLERI,
  ADAY_KAYNAKLARI,
} from "@/lib/aday-durumlari";
import { adaySorumlulari } from "@/lib/aday/aday-listesi";
import { db } from "@/lib/db";
import { tarihBicimle, tarihMetni, zamanMetni } from "@/lib/tarih";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import {
  adayiYenidenAc,
  asamaDegistir,
  ulasilamadiKaydet,
} from "../actions";
import { AdayDuzenleDugmesi } from "../aday-formu";
import { AdayTakipKarti } from "./takip-karti";

export const metadata: Metadata = {
  title: "Aday",
};

/**
 * §16.6 — Aday ayrıntısı: danışmanın çalışma tezgâhı.
 *
 * Pencere değil TAM SAYFA. Gerekçe: `tel:` bağlantısı telefon uygulamasına
 * geçip geri dönüyor ve bir adres bu gidiş dönüşü atlatır, pencere durumu
 * atlatmayabilir. Ayrıca dashboard ve liste buraya derin bağlantı veriyor.
 */
export default async function AdayAyrintiSayfasi(
  props: PageProps<"/koordinator/adaylar/[id]">,
) {
  const kullanici = await yonetimZorunlu("adaylar");
  const subeId = kullanici.aktifSubeId;
  const yazabilir = kullanici.yetkiler.adaylar === "TAM";
  const { id } = await props.params;

  const aday = await db.lead.findFirst({
    where: { id, branchId: subeId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      convertedStudent: {
        select: { id: true, firstName: true, lastName: true },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!aday) notFound();

  // Dönüştürme penceresindeki "zaten kayıtlı" seçeneği için; öğrenci
  // yetkisi olmayan kullanıcıya dönüştürme hiç sunulmuyor, listesi de
  // çekilmiyor.
  const donusturebilir =
    yazabilir && kullanici.yetkiler.ogrenciler !== "YOK";

  const [kadro, ogrenciler] = await Promise.all([
    yazabilir ? adaySorumlulari(subeId) : Promise.resolve([]),
    donusturebilir
      ? db.student.findMany({
          where: { branchId: subeId },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
  ]);

  const ad = aday.parentName ?? "İsimsiz aday";
  const asamaBilgisi = ADAY_ASAMALARI[aday.stage];

  /**
   * Kapanmış adayda (kazanıldı/kaybedildi) takip kartı GÖSTERİLMEZ.
   * "Bugün aranacaklar" kuyruğu yalnız açık aşamaları okuyor
   * (`bugunAranacakKosulu`), yani kapalı bir adaya tarih yazmak hiçbir yerde
   * görünmezdi — kullanıcı arama planladığını sanırdı. Aday yeniden açılınca
   * kart geri gelir.
   */
  const acikAday = ACIK_ASAMALAR.includes(aday.stage);

  const ustBilgi = [
    aday.childName ? `${aday.childName} için` : null,
    ADAY_KAYNAKLARI[aday.source],
    aday.sourceDetail,
    `eklendi ${tarihBicimle(aday.createdAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/koordinator/adaylar" className={geriBaglantiStili}>
          ← Adaylar
        </Link>
      </div>

      <SayfaBasligi
        baslik={ad}
        aciklama={ustBilgi}
        aksiyon={
          yazabilir ? (
            <AdayDuzenleDugmesi
              adayId={aday.id}
              varsayilanlar={{
                parentName: aday.parentName ?? "",
                phone: aday.phone ?? "",
                childName: aday.childName ?? "",
                childAge: aday.childAge?.toString() ?? "",
                email: aday.email ?? "",
                interestedProgram: aday.interestedProgram ?? "",
              }}
            />
          ) : null
        }
        ustBilgi={
          <span className="flex flex-wrap items-center gap-2">
            <Rozet tur={asamaBilgisi.rozet}>{asamaBilgisi.etiket}</Rozet>
            {aday.ingestStatus !== "TAMAM" ? (
              <Rozet tur="uyari">Eksik bilgi</Rozet>
            ) : null}
          </span>
        }
      />

      {aday.ingestNote ? (
        <div className="kil-uyari p-3.5 text-sm">{aday.ingestNote}</div>
      ) : null}

      {aday.convertedStudent ? (
        <Kart className="p-4">
          <p className="text-sm text-zinc-600">
            Bu aday öğrenciye dönüştürüldü
            {aday.convertedAt ? ` · ${tarihBicimle(aday.convertedAt)}` : ""}
          </p>
          <Link
            href={`/koordinator/ogrenciler/${aday.convertedStudent.id}`}
            className={`${baglantiStili} font-medium`}
          >
            {aday.convertedStudent.firstName} {aday.convertedStudent.lastName} →
          </Link>
        </Kart>
      ) : null}

      {aday.phone ? (
        <IletisimDugmeleri telefon={aday.phone} />
      ) : (
        <Kart className="p-4 text-sm text-zinc-600">
          Bu adayda telefon numarası yok; arama ve WhatsApp bağlantısı
          üretilemiyor. Numarayı “Düzenle” ile ekleyebilirsiniz.
        </Kart>
      )}

      {yazabilir ? (
        <AdayAsamaEylemleri
          adayId={aday.id}
          asama={aday.stage}
          izinliGecisler={ADAY_ASAMA_GECISLERI[aday.stage]}
          denemeSayisi={aday.unreachableCount}
          donusturebilir={donusturebilir}
          ogrenciSecenekleri={ogrenciler.map((ogrenci) => ({
            id: ogrenci.id,
            ad: `${ogrenci.firstName} ${ogrenci.lastName}`,
          }))}
          asamaDegistir={asamaDegistir}
          ulasilamadiKaydet={ulasilamadiKaydet}
          adayiYenidenAc={adayiYenidenAc}
        />
      ) : null}

      {yazabilir && acikAday ? (
        <AdayTakipKarti
          adayId={aday.id}
          nextActionDate={
            aday.nextActionDate ? tarihMetni(aday.nextActionDate) : ""
          }
          nextActionNote={aday.nextActionNote ?? ""}
          sorumluId={aday.assignedTo?.id ?? ""}
          kadro={kadro}
        />
      ) : null}

      <Kart className="p-4">
        <h2 className="text-base font-bold tracking-tight text-zinc-900">
          Bilgiler
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <OzetHucresi etiket="Veli" deger={aday.parentName} />
          <OzetHucresi etiket="Telefon" deger={aday.phone} />
          <OzetHucresi etiket="E-posta" deger={aday.email} />
          <OzetHucresi etiket="Öğrenci" deger={aday.childName} />
          <OzetHucresi
            etiket="Yaş"
            deger={aday.childAge ? `${aday.childAge}` : null}
          />
          <OzetHucresi
            etiket="İlgilendiği program"
            deger={aday.interestedProgram}
          />
          <OzetHucresi etiket="Kaynak" deger={ADAY_KAYNAKLARI[aday.source]} />
          <OzetHucresi
            etiket="Sorumlu"
            deger={aday.assignedTo?.name ?? null}
          />
          <OzetHucresi
            etiket="Randevu"
            deger={aday.appointmentAt ? zamanMetni(aday.appointmentAt) : null}
          />
          <OzetHucresi
            etiket="Ulaşılamayan deneme"
            deger={
              aday.unreachableCount > 0 ? `${aday.unreachableCount}` : null
            }
          />
          {aday.lossReason ? (
            <OzetHucresi
              etiket="Kayıp sebebi"
              deger={ADAY_KAYIP_SEBEPLERI[aday.lossReason]}
            />
          ) : null}
          {aday.lossNote ? (
            <OzetHucresi etiket="Kayıp açıklaması" deger={aday.lossNote} />
          ) : null}
        </dl>

        {aday.message ? (
          <div className="kil-oyuk mt-4 p-3 text-sm whitespace-pre-line text-zinc-700">
            {aday.message}
          </div>
        ) : null}
      </Kart>

      <AdayZamanCizelgesi
        adayId={aday.id}
        yazabilir={yazabilir}
        etkinlikler={aday.activities.map((etkinlik) => ({
          id: etkinlik.id,
          type: etkinlik.type,
          note: etkinlik.note,
          fromStage: etkinlik.fromStage,
          toStage: etkinlik.toStage,
          kisi: etkinlik.createdBy?.name ?? null,
          zaman: zamanMetni(etkinlik.createdAt),
        }))}
      />
    </div>
  );
}
