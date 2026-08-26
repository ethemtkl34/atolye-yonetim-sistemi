import type {
  LeadIngestStatus,
  LeadSource,
} from "@/generated/prisma/enums";
import { ACIK_ASAMALAR } from "@/lib/aday-durumlari";
import { type BenzerKayit, mukerrerKarari } from "@/lib/aday/mukerrer";
import { db } from "@/lib/db";
import { bugun } from "@/lib/tarih";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";

/**
 * §16 — Aday yazımının ortak kapısı.
 *
 * Üç giriş yolu var (entegratör, web sitesi formu, panelde elle giriş) ve üçü
 * de buradan geçer: telefon normalizasyonu, mükerrer kararı ve yarış koruması
 * tek yerde yaşar. Kararın kendisi `mukerrer.ts` içindeki saf fonksiyonda —
 * bu dosya `db.ts`'i çektiği için birim testi orada yazılır.
 */

export type AdayGirdisi = {
  parentName?: string | null;
  childName?: string | null;
  childAge?: number | null;
  phone?: string | null;
  email?: string | null;
  interestedProgram?: string | null;
  message?: string | null;
  sourceDetail?: string | null;
  nextActionDate?: Date | null;
};

export type AdayYazArgs = {
  subeId: string;
  kanal: "api" | "elle";
  kaynak: LeadSource;
  girdi: AdayGirdisi;
  /** Meta leadgen kimliği — idempotency anahtarı (yalnız API). */
  externalId?: string | null;
  rawJson?: unknown;
  ingestStatus?: LeadIngestStatus;
  ingestNote?: string | null;
  kvkkConsent?: boolean;
  createdByUserId?: string | null;
  assignedToUserId?: string | null;
  zorla?: boolean;
};

export type AdayYazSonucu =
  | { sonuc: "olusturuldu"; adayId: string }
  /** Idempotent tekrar ya da sessiz pencere — hiçbir şey yazılmadı. */
  | { sonuc: "tekrar"; adayId: string }
  /** Yeni aday açılmadı; mevcut açık adaya not düştü, kuyruğa geri çekildi. */
  | { sonuc: "mevcuda-eklendi"; adayId: string }
  /** Yalnız elle giriş: benzer kayıt bulundu, yazılmadı — form uyarı gösterir. */
  | { sonuc: "benzer"; benzer: BenzerKayit };

export async function adayYaz(args: AdayYazArgs): Promise<AdayYazSonucu> {
  const telefonHam = args.girdi.phone?.trim() || null;
  const searchPhone = telefonHam ? normalizeTelefon(telefonHam) || null : null;
  const searchName = normalizeArama(
    [args.girdi.parentName, args.girdi.childName]
      .filter((deger): deger is string => Boolean(deger))
      .join(" "),
  );

  // Teslim tekrarı: aynı dış kimlik daha önce yazıldıysa hiçbir şey yapma.
  if (args.externalId) {
    // şube-muaf: externalId küresel tekil idempotency anahtarı — teslim
    // tekrarı, entegratör şube eşlemesi bu arada değişmiş olsa bile aynı
    // kaydı bulmalı; şube süzgeci tekrarı görünmez kılar ve mükerrer açardı.
    const mevcut = await db.lead.findUnique({
      where: { externalId: args.externalId },
      select: { id: true },
    });
    if (mevcut) return { sonuc: "tekrar", adayId: mevcut.id };
  }

  // API'den ulaşılabilir hiçbir kanal gelmediyse işaretle — aday yine açılır.
  const ingestStatus: LeadIngestStatus =
    args.ingestStatus ??
    (args.kanal === "api" && !searchPhone && !args.girdi.email?.trim()
      ? "EKSIK_VERI"
      : "TAMAM");
  const ingestNote =
    args.ingestNote ??
    (ingestStatus === "EKSIK_VERI"
      ? "Başvuruda telefon da e-posta da yok — aileye dönüş kanalı eksik."
      : null);

  const simdi = new Date();

  try {
    return await db.$transaction(async (tx) => {
      if (searchPhone) {
        // Aynı telefonla eşzamanlı iki yazım (çift webhook teslimi, iki
        // sekmede iki danışman) aynı kilidi bekler; mükerrer kararı yarışsız.
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`aday:${args.subeId}:${searchPhone}`}))::text
            AS "kilit"
        `;
      }

      const acikAday = searchPhone
        ? await tx.lead.findFirst({
            where: {
              branchId: args.subeId,
              searchPhone,
              stage: { in: ACIK_ASAMALAR },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true, parentName: true, createdAt: true },
          })
        : null;

      const veli = searchPhone
        ? await tx.guardian.findFirst({
            where: { searchPhone, student: { branchId: args.subeId } },
            select: {
              student: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          })
        : null;

      const karar = mukerrerKarari({
        kanal: args.kanal,
        zorla: args.zorla ?? false,
        telefonVar: Boolean(searchPhone),
        acikAday: acikAday
          ? {
              id: acikAday.id,
              ad: acikAday.parentName ?? "İsimsiz aday",
              kacDakikaOnce:
                (simdi.getTime() - acikAday.createdAt.getTime()) / 60_000,
            }
          : null,
        veliEslesmesi: veli
          ? {
              ogrenciId: veli.student.id,
              ogrenciAdi: `${veli.student.firstName} ${veli.student.lastName}`,
            }
          : null,
      });

      if (karar.tur === "sessiz") {
        return { sonuc: "tekrar", adayId: karar.adayId } as const;
      }

      if (karar.tur === "uyar") {
        return { sonuc: "benzer", benzer: karar.benzer } as const;
      }

      if (karar.tur === "mevcuda-not") {
        const kaynakEtiketi = args.girdi.sourceDetail
          ? ` (${args.girdi.sourceDetail})`
          : "";
        await tx.lead.update({
          where: { id: karar.adayId },
          data: {
            // Aday kuyruğa geri döner: aile yeniden başvurdu, bugün aranmalı.
            nextActionDate: bugun(),
            activities: {
              create: {
                type: "SISTEM",
                note: `Aynı telefondan yeni başvuru geldi: ${kaynakEtiketi ? args.kaynak + kaynakEtiketi : args.kaynak}. Takip tarihi bugüne çekildi.`,
              },
            },
          },
        });
        return { sonuc: "mevcuda-eklendi", adayId: karar.adayId } as const;
      }

      const aday = await tx.lead.create({
        data: {
          branchId: args.subeId,
          parentName: args.girdi.parentName?.trim() || null,
          childName: args.girdi.childName?.trim() || null,
          childAge: args.girdi.childAge ?? null,
          phone: telefonHam,
          searchPhone,
          email: args.girdi.email?.trim() || null,
          searchName,
          interestedProgram: args.girdi.interestedProgram?.trim() || null,
          message: args.girdi.message?.trim() || null,
          source: args.kaynak,
          sourceDetail: args.girdi.sourceDetail?.trim() || null,
          externalId: args.externalId ?? null,
          rawJson:
            args.rawJson === undefined
              ? undefined
              : JSON.parse(JSON.stringify(args.rawJson)),
          ingestStatus,
          ingestNote,
          kvkkConsent: args.kvkkConsent ?? false,
          consentAt: args.kvkkConsent ? simdi : null,
          nextActionDate: args.girdi.nextActionDate ?? null,
          assignedToUserId: args.assignedToUserId ?? null,
          createdByUserId: args.createdByUserId ?? null,
          ...(karar.tur === "olustur-notlu"
            ? {
                activities: {
                  create: { type: "SISTEM" as const, note: karar.not },
                },
              }
            : {}),
        },
        select: { id: true },
      });

      return { sonuc: "olusturuldu", adayId: aday.id } as const;
    });
  } catch (hata) {
    // Aynı dış kimlikle eşzamanlı iki teslim: kilit telefonsuz payload'ı
    // korumaz, tekil indeks son savunma. Kaybeden taraf tekrarı bildirir.
    if (
      args.externalId &&
      hata instanceof Error &&
      "code" in hata &&
      (hata as { code?: string }).code === "P2002"
    ) {
      // şube-muaf: yukarıdaki idempotency okumasıyla aynı gerekçe.
      const mevcut = await db.lead.findUnique({
        where: { externalId: args.externalId },
        select: { id: true },
      });
      if (mevcut) return { sonuc: "tekrar", adayId: mevcut.id };
    }
    throw hata;
  }
}
