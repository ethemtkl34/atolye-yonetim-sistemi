import type { Prisma } from "@/generated/prisma/client";
import type { LeadSource, LeadStage } from "@/generated/prisma/enums";
import {
  ACIK_ASAMALAR,
  acikAdayKosulu,
  bugunAranacakKosulu,
  gecikmisAdayKosulu,
} from "@/lib/aday-durumlari";
import { db } from "@/lib/db";
import { bugun } from "@/lib/tarih";
import { normalizeArama, normalizeTelefon } from "@/lib/turkce";

/**
 * §16.6 — Aday listesinin sorgusu.
 *
 * Kapsam çipleri danışmanın günlük iş kuyruğudur; koşulları
 * `aday-durumlari.ts`'ten okur, böylece dashboard kartı ile liste birebir
 * aynı sayıyı gösterir.
 */

export const ADAY_KAPSAMLARI = ["acik", "bugun", "gecikmis", "tumu"] as const;
export type AdayKapsami = (typeof ADAY_KAPSAMLARI)[number];

export function adayKapsamiCoz(deger: unknown): AdayKapsami {
  return typeof deger === "string" &&
    (ADAY_KAPSAMLARI as readonly string[]).includes(deger)
    ? (deger as AdayKapsami)
    : "acik";
}

function kapsamKosulu(kapsam: AdayKapsami, subeId: string): Prisma.LeadWhereInput {
  const gun = bugun();
  switch (kapsam) {
    case "bugun":
      return bugunAranacakKosulu(subeId, gun);
    case "gecikmis":
      return gecikmisAdayKosulu(subeId, gun);
    case "tumu":
      return { branchId: subeId };
    default:
      return acikAdayKosulu(subeId);
  }
}

/**
 * Arama: ad (Türkçe duyarsız) veya telefon. Öğrenci aramasıyla aynı ilke —
 * telefon en az 3 hane olmalı, yoksa "5" yazınca herkes dönerdi.
 */
function aramaKosulu(sorgu: string): Prisma.LeadWhereInput | null {
  const temiz = sorgu.trim();
  if (!temiz) return null;

  const ad = normalizeArama(temiz);
  const telefon = normalizeTelefon(temiz);

  const kosullar: Prisma.LeadWhereInput[] = [];
  if (ad) kosullar.push({ searchName: { contains: ad } });
  if (telefon.length >= 3) {
    kosullar.push({ searchPhone: { contains: telefon } });
  }

  return kosullar.length > 0 ? { OR: kosullar } : null;
}

export type AdaySuzgecleri = {
  subeId: string;
  kapsam: AdayKapsami;
  sorgu: string;
  asama: LeadStage | "";
  kaynak: LeadSource | "";
  sorumluId: string;
  enFazla: number;
  atla: number;
};

export async function adayAra(suzgecler: AdaySuzgecleri) {
  const arama = aramaKosulu(suzgecler.sorgu);

  const kosul: Prisma.LeadWhereInput = {
    ...kapsamKosulu(suzgecler.kapsam, suzgecler.subeId),
    ...(suzgecler.asama ? { stage: suzgecler.asama } : {}),
    ...(suzgecler.kaynak ? { source: suzgecler.kaynak } : {}),
    ...(suzgecler.sorumluId
      ? {
          assignedToUserId:
            suzgecler.sorumluId === "yok" ? null : suzgecler.sorumluId,
        }
      : {}),
    ...(arama ? arama : {}),
  };

  // `branchId` iki çağrıda da AYRICA yazılıyor. Kapsam koşulu zaten taşıyor
  // ama değişkene alınmış bir süzgeci şube-sızıntı tarayıcısı göremiyor
  // (kural: sınır çağrının kendisinde okunabilmeli). Tekrar bilinçli:
  // sorgunun şubeye bağlı olduğu, sorguya bakan herkes için görünür.
  const [adaylar, toplam] = await Promise.all([
    db.lead.findMany({
      where: { ...kosul, branchId: suzgecler.subeId },
      // Kuyruk sırası: en geciken önce, tarihsizler sona, eşitlikte en yeni.
      // Kararlı sıralama için son anahtar `id` — sayfalamanın doğruluğu buna
      // bağlı (aynı tarihli iki aday sayfalar arasında yer değiştirmemeli).
      orderBy: [
        { nextActionDate: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "asc" },
      ],
      take: suzgecler.enFazla,
      skip: suzgecler.atla,
      select: {
        id: true,
        parentName: true,
        childName: true,
        phone: true,
        stage: true,
        source: true,
        sourceDetail: true,
        ingestStatus: true,
        kvkkConsent: true,
        unreachableCount: true,
        nextActionDate: true,
        appointmentAt: true,
        createdAt: true,
        convertedStudentId: true,
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    db.lead.count({ where: { ...kosul, branchId: suzgecler.subeId } }),
  ]);

  return { adaylar, toplam };
}

/** Kapsam çiplerinin yanında yazan sayılar — kuyruğun büyüklüğü. */
export async function adayKapsamSayilari(subeId: string) {
  const gun = bugun();
  const [acik, bugunAranacak, gecikmis, tumu] = await Promise.all([
    db.lead.count({ where: acikAdayKosulu(subeId) }),
    db.lead.count({ where: bugunAranacakKosulu(subeId, gun) }),
    db.lead.count({ where: gecikmisAdayKosulu(subeId, gun) }),
    db.lead.count({ where: { branchId: subeId } }),
  ]);
  return { acik, bugun: bugunAranacak, gecikmis, tumu };
}

/**
 * Şubenin aday sorumlusu olabilecek aktif kadrosu.
 *
 * Stajyer hariç: aday verisi stajyer panelinde hiç görünmüyor, sorumlu
 * listesinde de yeri yok. Süzgeç ve sorumlu seçici aynı listeyi okur.
 */
export async function adaySorumlulari(subeId: string) {
  return db.user.findMany({
    where: {
      branchId: subeId,
      active: true,
      NOT: { roles: { has: "STAJYER" } },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/**
 * Yönetici uyarısı: API'den eksik/eşleşmemiş gelen açık adaylar.
 * Sessizce çürümesinler diye listenin başında şerit olarak gösterilir.
 */
export async function sorunluAdaySayisi(subeId: string): Promise<number> {
  return db.lead.count({
    where: {
      branchId: subeId,
      stage: { in: ACIK_ASAMALAR },
      ingestStatus: { not: "TAMAM" },
    },
  });
}
