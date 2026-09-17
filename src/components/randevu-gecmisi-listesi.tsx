import Link from "next/link";
import { Rozet } from "@/components/ui";
import { saatAraligiMetni, tarihGunleBicimle, tarihMetni } from "@/lib/tarih";
import { uzmanRengi } from "@/lib/uzman-renkleri";
import { gecmisOzeti, gecmisiAyir } from "@/lib/randevu/gecmis-ozeti";
import type { GecmisRandevuSatiri } from "@/lib/randevu/gecmis-verisi";
import { DURUM_ADLARI, DURUM_ROZETLERI } from "@/app/koordinator/randevular/sema";
import { paraMetni } from "@/app/koordinator/uzmanlar/sema";

/**
 * Kişi bazlı randevu geçmişi (Eylül 2026) — öğrenci kartında ve uzman
 * sayfasında aynı görünüm. Salt okunur: durum işaretleme, düzenleme ve
 * iptal Randevular ekranında; her satır o günün takvimine bağlanıyor.
 *
 * `kisi` hangi sütunun gösterileceğini seçer: öğrencinin geçmişinde "kimle"
 * (uzman), uzmanın geçmişinde "kiminle" (danışan) önemli.
 */
export function RandevuGecmisiListesi({
  satirlar,
  bugun,
  kisi,
  bosMetin,
  yaklasanlariAyir = true,
}: {
  satirlar: GecmisRandevuSatiri[];
  /** İstanbul'daki bugün, UTC gece yarısı çapası (`istanbulBugunu`). */
  bugun: Date;
  kisi: "uzman" | "danisan";
  bosMetin: string;
  /** Uzman sayfasında ay ay gezildiği için tek liste yeterli. */
  yaklasanlariAyir?: boolean;
}) {
  if (satirlar.length === 0) {
    return <p className="kil-oyuk px-3 py-2 text-sm text-zinc-500">{bosMetin}</p>;
  }

  const ozet = gecmisOzeti(satirlar, bugun);
  const { yaklasan, gecmis } = yaklasanlariAyir
    ? gecmisiAyir(satirlar, bugun)
    : { yaklasan: [], gecmis: satirlar };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Rozet tur="notr">{ozet.toplam} randevu</Rozet>
        <Rozet tur="olumlu">{ozet.gerceklesti} gerçekleşti</Rozet>
        {ozet.gelmedi > 0 ? <Rozet tur="uyari">{ozet.gelmedi} gelmedi</Rozet> : null}
        {ozet.iptal > 0 ? <Rozet tur="pasif">{ozet.iptal} iptal</Rozet> : null}
        {ozet.yaklasan > 0 ? <Rozet tur="notr">{ozet.yaklasan} yaklaşan</Rozet> : null}
        {ozet.isaretsiz > 0 ? (
          <Rozet tur="uyari">{ozet.isaretsiz} işaretlenmemiş</Rozet>
        ) : null}
        {ozet.ciroKurus > 0 ? (
          <Rozet tur="notr">Gerçekleşen: {paraMetni(ozet.ciroKurus)}</Rozet>
        ) : null}
      </div>

      {yaklasan.length > 0 ? (
        <Bolum baslik="Yaklaşan">
          {yaklasan.map((satir) => (
            <Satir key={satir.id} satir={satir} kisi={kisi} bugun={bugun} />
          ))}
        </Bolum>
      ) : null}

      {gecmis.length > 0 ? (
        <Bolum baslik={yaklasanlariAyir ? "Geçmiş ve iptaller" : "Randevular"}>
          {gecmis.map((satir) => (
            <Satir key={satir.id} satir={satir} kisi={kisi} bugun={bugun} />
          ))}
        </Bolum>
      ) : null}
    </div>
  );
}

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="px-1 text-sm font-semibold text-zinc-700">{baslik}</h3>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

function Satir({
  satir,
  kisi,
  bugun,
}: {
  satir: GecmisRandevuSatiri;
  kisi: "uzman" | "danisan";
  bugun: Date;
}) {
  const ton = uzmanRengi(satir.uzmanRengi);
  const isaretsiz =
    satir.durum === "PLANLANDI" && satir.baslangic.getTime() < bugun.getTime();

  return (
    <li
      className={`kil-satir flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm ${
        satir.durum === "IPTAL" ? "opacity-60" : ""
      }`}
    >
      <span className="min-w-0 space-y-0.5">
        <Link
          href={`/koordinator/randevular?gorunum=gun&tarih=${tarihMetni(satir.baslangic)}`}
          className="block font-semibold text-zinc-900 hover:underline"
        >
          {tarihGunleBicimle(satir.baslangic)} · {saatAraligiMetni(satir.baslangic, satir.bitis)}
        </Link>
        <span className="block text-zinc-600">
          {satir.hizmetAdi}
          {" · "}
          {kisi === "uzman" ? (
            <span style={{ color: ton.metin }}>{satir.uzmanAdi}</span>
          ) : satir.bizim ? (
            satir.danisanAdi
          ) : (
            <span className="text-zinc-500">diğer şube ({satir.subeAdi})</span>
          )}
        </span>
        {satir.not ? <span className="block text-xs text-zinc-500">{satir.not}</span> : null}
        {satir.iptalNotu ? (
          <span className="block text-xs text-zinc-500">İptal notu: {satir.iptalNotu}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Rozet tur={isaretsiz ? "uyari" : DURUM_ROZETLERI[satir.durum]}>
          {isaretsiz ? "İşaretlenmemiş" : DURUM_ADLARI[satir.durum]}
        </Rozet>
        {satir.netUcretKurus !== null && satir.netUcretKurus > 0 ? (
          <span className="text-xs tabular-nums text-zinc-500">
            {paraMetni(satir.netUcretKurus)}
          </span>
        ) : null}
      </span>
    </li>
  );
}
