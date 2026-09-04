import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { Rozet, SayfaBasligi, geriBaglantiStili } from "@/components/ui";
import { tarihBicimle } from "@/lib/tarih";
import { uzmanRengi } from "@/lib/uzman-renkleri";
import { dakikayiSaateCevir } from "../sema";
import {
  MesaiVeIzin,
  type IzinSatiri,
  type MesaiSatiri,
} from "./mesai-izin";

export const metadata: Metadata = {
  title: "Uzman",
};

/**
 * §17.3 — Uzmanın mesai ve izin sayfası.
 *
 * Kadro bilgisi (ad, renk, yetkinlik) liste ekranındaki pencerede
 * düzenleniyor; burada yalnız TAKVİMİ ilgilendiren iki şey var. Ayrı sayfa
 * olmasının sebebi: mesai yedi günlük bir tablo, izin ise büyüyen bir liste;
 * ikisi de pencereye sığmıyor.
 */

/** Saat taşıyan tarih metni — izin aralıkları için. */
function izinMetni(baslangic: Date, bitis: Date): string {
  const tamGunBaslangic =
    baslangic.getUTCHours() === 0 && baslangic.getUTCMinutes() === 0;
  const tamGunBitis = bitis.getUTCHours() === 0 && bitis.getUTCMinutes() === 0;

  // Aralık kapalı-açık saklanıyor: tam gün izinde bitiş ertesi günün başı.
  // Ekranda kullanıcının yazdığı son gün gösterilmeli.
  if (tamGunBaslangic && tamGunBitis) {
    const sonGun = new Date(bitis.getTime() - 24 * 60 * 60_000);
    return tarihBicimle(baslangic) === tarihBicimle(sonGun)
      ? tarihBicimle(baslangic)
      : `${tarihBicimle(baslangic)} – ${tarihBicimle(sonGun)}`;
  }

  const saat = (tarih: Date) =>
    `${String(tarih.getUTCHours()).padStart(2, "0")}:${String(
      tarih.getUTCMinutes(),
    ).padStart(2, "0")}`;

  return tarihBicimle(baslangic) === tarihBicimle(bitis)
    ? `${tarihBicimle(baslangic)} ${saat(baslangic)}–${saat(bitis)}`
    : `${tarihBicimle(baslangic)} ${saat(baslangic)} – ${tarihBicimle(bitis)} ${saat(bitis)}`;
}

export default async function UzmanSayfasi(
  props: PageProps<"/koordinator/uzmanlar/[id]">,
) {
  const kullanici = await yonetimZorunlu("uzmanlar");
  const { id } = await props.params;
  const duzenleyebilir = kullanici.yetkiler.uzmanlar === "TAM";

  // şube-muaf: uzman çok şubeli, kendi `branchId` sütunu yok; kadro
  // şubeler arası görünür (bkz. uzmanlar/page.tsx şerhi).
  const uzman = await db.uzman.findUnique({
    where: { id },
    select: {
      id: true,
      ad: true,
      renk: true,
      aktif: true,
      calismaTipi: true,
      subeler: {
        select: { subeId: true, sube: { select: { id: true, name: true } } },
      },
      mesailer: {
        orderBy: [{ gun: "asc" }, { baslangicDk: "asc" }],
        select: {
          id: true,
          gun: true,
          subeId: true,
          baslangicDk: true,
          bitisDk: true,
          sube: { select: { name: true } },
        },
      },
      izinler: {
        orderBy: { baslangic: "desc" },
        select: { id: true, baslangic: true, bitis: true, sebep: true },
      },
    },
  });

  if (!uzman) notFound();

  const simdi = new Date();
  const ton = uzmanRengi(uzman.renk);

  const mesailer: MesaiSatiri[] = uzman.mesailer.map((mesai) => ({
    id: mesai.id,
    gun: mesai.gun,
    subeId: mesai.subeId,
    subeAdi: mesai.sube.name,
    baslangic: dakikayiSaateCevir(mesai.baslangicDk),
    bitis: dakikayiSaateCevir(mesai.bitisDk),
  }));

  const izinler: IzinSatiri[] = uzman.izinler.map((izin) => ({
    id: izin.id,
    metin: izinMetni(izin.baslangic, izin.bitis),
    sebep: izin.sebep,
    gecmis: izin.bitis <= simdi,
  }));

  /**
   * Mesai formundaki şube seçenekleri UZMANIN şubeleriyle ve oturumun
   * yetkisiyle kesişiyor: çalışmadığı bir şubeye mesai girmek anlamsız,
   * başka şubeye girmek ise yetki dışı.
   */
  const izinliSubeIdleri = new Set(
    kullanici.secilebilirSubeler.map((sube) => sube.id),
  );
  const subeSecenekleri = uzman.subeler
    .filter((bag) => izinliSubeIdleri.has(bag.subeId))
    .map((bag) => ({ id: bag.sube.id, ad: bag.sube.name }));

  return (
    <div className="space-y-6">
      <Link href="/koordinator/uzmanlar" className={geriBaglantiStili}>
        Uzmanlar
      </Link>

      <SayfaBasligi
        baslik={uzman.ad}
        aciklama="Haftalık mesai ve izinler — randevu takviminin sınırlarını bunlar belirler."
        aksiyon={
          <div className="flex items-center gap-2">
            <span
              className="inline-block size-3 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: ton.metin }}
              aria-hidden
            />
            <Rozet tur="notr">
              {uzman.calismaTipi === "YARI_ZAMANLI"
                ? "Yarı zamanlı"
                : "Tam zamanlı"}
            </Rozet>
            {uzman.subeler.map((bag) => (
              <Rozet key={bag.subeId} tur="notr">
                {bag.sube.name}
              </Rozet>
            ))}
            {uzman.aktif ? null : <Rozet tur="pasif">Pasif</Rozet>}
          </div>
        }
      />

      <MesaiVeIzin
        uzmanId={uzman.id}
        mesailer={mesailer}
        izinler={izinler}
        subeler={subeSecenekleri}
        duzenleyebilir={duzenleyebilir && subeSecenekleri.length > 0}
      />
    </div>
  );
}
