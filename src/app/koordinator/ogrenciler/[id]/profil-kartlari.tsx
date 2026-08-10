import { BosDurum, Kart, Rozet, baglantiStili } from "@/components/ui";
import { KayitIptalOzeti } from "@/components/kayit-iptal-ozeti";
import { DONEM_DURUMLARI, KULUP_DURUMLARI } from "@/lib/durumlar";
import { grupZamani, tarihBicimle } from "@/lib/tarih";
import type {
  CancelReason,
  ClubStatus,
  Day,
  TermStatus,
} from "@/generated/prisma/enums";

/** Öğrenci profilinin kart bileşenleri — `page.tsx`'ten çıkarıldı. */

export type ProfilKaydi = {
  id: string;
  status: "AKTIF" | "IPTAL";
  createdAt: Date;
  intern: { name: string; active: boolean } | null;
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  lastAttendedWeek: number | null;
  lastAttendedDate: Date | null;
  _count: { scores: number };
  group: {
    name: string;
    days: Day[];
    timeSlot: "OGLEDEN_ONCE" | "OGLEDEN_SONRA";
    term: { name: string; status: TermStatus } | null;
    club: { name: string; status: ClubStatus; date: Date } | null;
    _count: { sessions: number };
  };
};

/** Veli adı + tıklanabilir telefon. Koordinatörün en sık işi aileyi aramak. */
export function VeliHucresi({
  etiket,
  veli,
}: {
  etiket: string;
  veli: { fullName: string; phone: string | null } | undefined;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{etiket}</dt>
      <dd className="mt-0.5 text-sm">
        {veli ? (
          <>
            {/* Ad kendi satırında: bağlantı stili `inline-block` olduğu için
                `block` eklemek çakışıyordu ve telefon ada yapışıyordu. */}
            <span className="block font-medium text-zinc-900">
              {veli.fullName}
            </span>
            {veli.phone ? (
              <a href={`tel:${veli.phone}`} className={baglantiStili}>
                {veli.phone}
              </a>
            ) : null}
          </>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </dd>
    </div>
  );
}

/**
 * Kayıt kartları — başlıksız; katlanır bölümün içinde de kullanılıyor.
 * (Puanlama ekranlarındaki `KayitListesi` ile karışmasın diye "Profil" önekli.)
 */
export function ProfilKayitListesi({
  kayitlar,
  bosAciklama,
}: {
  kayitlar: ProfilKaydi[];
  bosAciklama: string;
}) {
  if (kayitlar.length === 0) {
    return <BosDurum baslik={bosAciklama} />;
  }

  return (
    <div className="space-y-2">
      {kayitlar.map((kayit) => {
        // İki ayrı durum var ve karıştırılmamalı: kaydın kendi durumu
        // (aktif / iptal) ve programın durumu (tamamlandı, arşivlendi...).
        // Kayıt aktif olduğu hâlde program bittiyse bunu yazmak gerekiyor;
        // yoksa "Geçmiş kayıtlar" başlığı altındaki "Aktif" rozeti
        // çelişkili görünüyor.
        const programDurumu = kayit.group.term
          ? DONEM_DURUMLARI[kayit.group.term.status]
          : kayit.group.club
            ? KULUP_DURUMLARI[kayit.group.club.status]
            : null;

        return (
          <Kart key={kayit.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-zinc-900">
                {kayit.group.term?.name ??
                  kayit.group.club?.name ??
                  "Program bulunamadı"}
              </span>
              <Rozet>{kayit.group.term ? "Dönem" : "Kulüp"}</Rozet>
              <Rozet tur={kayit.status === "AKTIF" ? "olumlu" : "pasif"}>
                Kayıt: {kayit.status === "AKTIF" ? "Aktif" : "İptal"}
              </Rozet>
              {programDurumu ? (
                <Rozet tur={programDurumu.rozet}>
                  Program: {programDurumu.etiket}
                </Rozet>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-zinc-700">
              {kayit.group.name} ·{" "}
              {grupZamani(kayit.group.days, kayit.group.timeSlot)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Kayıt tarihi {tarihBicimle(kayit.createdAt)}
              {kayit.group.club
                ? ` · Kulüp tarihi ${tarihBicimle(kayit.group.club.date)}`
                : ""}
              {" · "}
              Sorumlu: {kayit.intern?.name ?? "Atanmamış"}
            </p>

            {kayit.status === "IPTAL" ? (
              <KayitIptalOzeti
                kayit={{
                  cancelReason: kayit.cancelReason,
                  cancelNote: kayit.cancelNote,
                  lastAttendedWeek: kayit.lastAttendedWeek,
                  lastAttendedDate: kayit.lastAttendedDate,
                  tamamlananAtolye: kayit._count.scores,
                  toplamAtolye: kayit.group._count.sessions,
                }}
              />
            ) : null}
          </Kart>
        );
      })}
    </div>
  );
}

/** Genel bilgiler bölümündeki etiket + değer satırı. */
export function Bilgi({
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
