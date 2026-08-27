/**
 * Aday (CRM) modülü için tanıtım verisi.
 *
 * Modül canlıya boş çıktı; ekranların dolu hâlini görmek ve danışmanlara
 * göstermek için gerçekçi ama SAHTE adaylar yazar.
 *
 * Güvenlik kuralları — bu betik canlı veritabanında çalışıyor:
 *  - Veli adının sonunda "(örnek)" var: listede tek bakışta ayırt edilir.
 *  - Telefonlar 0500 ile başlıyor. Türkiye'de mobil önekler 053X/054X/055X;
 *    0500 hiçbir aboneye tahsis edilmemiş, yani yanlışlıkla aranan kimse
 *    gerçek bir insana ulaşmaz.
 *  - Yazdığı her satırın kimliği `manifest.json`a düşer, `geri-al.ts` yalnız
 *    o kimlikleri siler — gerçek adaylara asla dokunmaz.
 *  - Tekrar çalıştırılabilir: aynı telefon zaten varsa o aday atlanır.
 *  - Öğrenci/kayıt YARATMAZ. "Kazanıldı" örnekleri yalnız `convertedAt`
 *    damgası taşır (şema bunu ayrıca serbest bırakıyor: dönüştürülen öğrenci
 *    sonradan silinse de damga kalır).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import type {
  LeadActivityType,
  LeadLossReason,
  LeadSource,
  LeadStage,
} from "../../src/generated/prisma/enums";
import { normalizeArama, normalizeTelefon } from "../../src/lib/turkce";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type OrnekEtkinlik = {
  type: LeadActivityType;
  note?: string;
  fromStage?: LeadStage;
  toStage?: LeadStage;
  gunOnce: number;
};

type OrnekAday = {
  veli: string;
  cocuk: string;
  yas?: number;
  telefon: string;
  eposta?: string;
  kaynak: LeadSource;
  kaynakDetay?: string;
  ilgi?: string;
  mesaj?: string;
  asama: LeadStage;
  /** Bugüne göre gün farkı; eksi = gecikmiş, 0 = bugün, boş = kuyrukta değil. */
  takipGun?: number;
  takipNotu?: string;
  deneme?: number;
  randevuGun?: number;
  kayipSebebi?: LeadLossReason;
  kayipNotu?: string;
  sube: "umraniye" | "gunesli";
  etkinlikler?: OrnekEtkinlik[];
};

const ADAYLAR: OrnekAday[] = [
  {
    veli: "Ayşe Yıldırım (örnek)", cocuk: "Kerem", yas: 7,
    telefon: "0500 000 10 01", kaynak: "META",
    kaynakDetay: "Sonbahar atölye kampanyası", ilgi: "Hafta sonu atölyesi",
    asama: "YENI", takipGun: 0, sube: "umraniye",
  },
  {
    veli: "Murat Demir (örnek)", cocuk: "Elif", yas: 9,
    telefon: "0500 000 10 02", kaynak: "WEB_SITESI",
    kaynakDetay: "Ön kayıt formu", ilgi: "Zekâ testi",
    mesaj: "Kızım için zekâ testi randevusu almak istiyorum.",
    eposta: "ornek.veli@example.com",
    asama: "ULASILDI", takipGun: 1, takipNotu: "Akşam 18.00'den sonra aranacak",
    sube: "umraniye",
    etkinlikler: [
      { type: "ASAMA_DEGISIMI", fromStage: "YENI", toStage: "ULASILDI", gunOnce: 2 },
      { type: "ARAMA", note: "Anne ile konuşuldu, test süreci anlatıldı.", gunOnce: 2 },
    ],
  },
  {
    veli: "Hatice Kaya (örnek)", cocuk: "Poyraz", yas: 6,
    telefon: "0500 000 10 03", kaynak: "TELEFON", ilgi: "Hafta sonu atölyesi",
    asama: "RANDEVU_VERILDI", randevuGun: 3, takipGun: 3,
    takipNotu: "Randevu öncesi hatırlatma yapılacak", sube: "umraniye",
    etkinlikler: [
      { type: "ASAMA_DEGISIMI", fromStage: "YENI", toStage: "ULASILDI", gunOnce: 5 },
      { type: "ASAMA_DEGISIMI", fromStage: "ULASILDI", toStage: "RANDEVU_VERILDI", gunOnce: 4 },
      { type: "SISTEM", note: "Randevu verildi — şubede tanışma görüşmesi.", gunOnce: 4 },
    ],
  },
  {
    veli: "Emre Şahin (örnek)", cocuk: "Zeynep", yas: 8,
    telefon: "0500 000 10 04", kaynak: "YOLDAN_GECEN", ilgi: "Kulüp",
    asama: "GORUSME_YAPILDI", takipGun: -1,
    takipNotu: "Aile karar verecek, geri dönüş bekleniyor", sube: "umraniye",
    etkinlikler: [
      { type: "ASAMA_DEGISIMI", fromStage: "YENI", toStage: "ULASILDI", gunOnce: 8 },
      { type: "ASAMA_DEGISIMI", fromStage: "ULASILDI", toStage: "GORUSME_YAPILDI", gunOnce: 6 },
      { type: "NOT", note: "Şubede görüşüldü. Baba fiyat ve ulaşım konusunda düşünecek.", gunOnce: 6 },
    ],
  },
  {
    veli: "Selin Aydın (örnek)", cocuk: "Mert", yas: 10,
    telefon: "0500 000 10 05", kaynak: "META",
    kaynakDetay: "Instagram — kulüp tanıtımı",
    asama: "YENI", takipGun: -3, deneme: 3, sube: "umraniye",
    etkinlikler: [
      { type: "ULASILAMADI", gunOnce: 5 },
      { type: "ULASILAMADI", gunOnce: 4 },
      { type: "ULASILAMADI", note: "Üçüncü deneme, telesekreter.", gunOnce: 3 },
    ],
  },
  {
    veli: "Kadir Öztürk (örnek)", cocuk: "Nisa", yas: 5,
    telefon: "0500 000 10 06", kaynak: "WEB_SITESI", kaynakDetay: "İletişim formu",
    asama: "KAYBEDILDI", kayipSebebi: "UZAKLIK",
    kayipNotu: "Aile Ataşehir'de oturuyor, ulaşım zor geldi.", sube: "umraniye",
    etkinlikler: [
      { type: "ASAMA_DEGISIMI", fromStage: "YENI", toStage: "ULASILDI", gunOnce: 12 },
      { type: "ASAMA_DEGISIMI", fromStage: "ULASILDI", toStage: "KAYBEDILDI", gunOnce: 10 },
    ],
  },
  {
    veli: "Gülşah Arslan (örnek)", cocuk: "Ada", yas: 7,
    telefon: "0500 000 10 07", kaynak: "TELEFON",
    asama: "KAYBEDILDI", kayipSebebi: "ULASILAMADI",
    kayipNotu: "Beş denemede ulaşılamadı, kapatıldı.", deneme: 5, sube: "umraniye",
  },
  {
    veli: "Volkan Çetin (örnek)", cocuk: "Alp", yas: 9,
    telefon: "0500 000 10 08", kaynak: "META",
    kaynakDetay: "Sonbahar atölye kampanyası", ilgi: "Hafta sonu atölyesi",
    asama: "KAZANILDI", sube: "umraniye",
    etkinlikler: [
      { type: "ASAMA_DEGISIMI", fromStage: "YENI", toStage: "ULASILDI", gunOnce: 20 },
      { type: "ASAMA_DEGISIMI", fromStage: "ULASILDI", toStage: "GORUSME_YAPILDI", gunOnce: 16 },
      { type: "ASAMA_DEGISIMI", fromStage: "GORUSME_YAPILDI", toStage: "KAZANILDI", gunOnce: 14 },
    ],
  },
  {
    veli: "Nurten Polat (örnek)", cocuk: "Defne", yas: 6,
    telefon: "0500 000 20 01", kaynak: "WEB_SITESI", kaynakDetay: "Ön kayıt formu",
    ilgi: "Hafta sonu atölyesi",
    asama: "YENI", takipGun: 0, sube: "gunesli",
  },
  {
    veli: "Fatih Yalçın (örnek)", cocuk: "Ege", yas: 8,
    telefon: "0500 000 20 02", kaynak: "META", kaynakDetay: "Güneşli — kulüp reklamı",
    asama: "ULASILDI", takipGun: -2, deneme: 1, sube: "gunesli",
    etkinlikler: [
      { type: "ULASILAMADI", gunOnce: 4 },
      { type: "ASAMA_DEGISIMI", fromStage: "YENI", toStage: "ULASILDI", gunOnce: 3 },
      { type: "ARAMA", note: "Anne ile görüşüldü, hafta sonu grubu anlatıldı.", gunOnce: 3 },
    ],
  },
  {
    veli: "Yasemin Korkmaz (örnek)", cocuk: "Bulut", yas: 11,
    telefon: "0500 000 20 03", kaynak: "YOLDAN_GECEN", ilgi: "Danışmanlık",
    asama: "GORUSME_YAPILDI", takipGun: 2, sube: "gunesli",
    etkinlikler: [
      { type: "ASAMA_DEGISIMI", fromStage: "YENI", toStage: "GORUSME_YAPILDI", gunOnce: 3 },
      { type: "NOT", note: "Şubeye uğradılar, psikoloğa yönlendirme konuşuldu.", gunOnce: 3 },
    ],
  },
  {
    veli: "Serkan Aksu (örnek)", cocuk: "İpek", yas: 7,
    telefon: "0500 000 20 04", kaynak: "TELEFON",
    asama: "KAYBEDILDI", kayipSebebi: "FIYAT",
    kayipNotu: "Bütçesine uygun bulmadı.", sube: "gunesli",
  },
];

function gunEkle(gun: number): Date {
  const simdi = new Date();
  return new Date(simdi.getTime() + gun * 86_400_000);
}

/** Sadece gün (UTC gece yarısı) — `@db.Date` alanları için. */
function tarihGunu(gun: number): Date {
  const t = gunEkle(gun);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

/**
 * Etkinliği kime yazacağız.
 *
 * Arama/not satırları "Sistem" olarak görünürse tanıtım verisi yanlış hikâye
 * anlatır — o satırları gerçek bir danışman yazmış gibi durmalı. Şubenin
 * danışma görevlisi varsa o, yoksa şubenin herhangi bir aktif çalışanı
 * seçilir; hiç yoksa null kalır (yine "Sistem" görünür, kayıt yine yazılır).
 */
async function subeDanismani(subeId: string): Promise<string | null> {
  const danisma = await db.user.findFirst({
    where: { branchId: subeId, active: true, roles: { has: "DANISMA_GOREVLISI" } },
    select: { id: true },
  });
  if (danisma) return danisma.id;
  const herhangi = await db.user.findFirst({
    where: {
      branchId: subeId,
      active: true,
      NOT: { roles: { has: "STAJYER" } },
    },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  return herhangi?.id ?? null;
}

async function main() {
  const subeler = await db.branch.findMany({ orderBy: { sortOrder: "asc" } });
  const umraniye = subeler.find((s) => /ümraniye|umraniye/i.test(s.name));
  const gunesli = subeler.find((s) => /güneşli|gunesli/i.test(s.name));
  if (!umraniye) throw new Error("Ümraniye şubesi bulunamadı.");

  const yazilan: string[] = [];
  let atlanan = 0;
  const danismanCache = new Map<string, string | null>();

  for (const o of ADAYLAR) {
    const sube = o.sube === "gunesli" ? (gunesli ?? umraniye) : umraniye;
    const searchPhone = normalizeTelefon(o.telefon);

    if (!danismanCache.has(sube.id)) {
      danismanCache.set(sube.id, await subeDanismani(sube.id));
    }
    const danismanId = danismanCache.get(sube.id) ?? null;

    const mevcut = await db.lead.findFirst({
      where: { branchId: sube.id, searchPhone },
      select: { id: true },
    });
    if (mevcut) {
      atlanan++;
      continue;
    }

    const aday = await db.lead.create({
      data: {
        branchId: sube.id,
        parentName: o.veli,
        childName: o.cocuk,
        childAge: o.yas ?? null,
        phone: o.telefon,
        searchPhone,
        email: o.eposta ?? null,
        searchName: normalizeArama(`${o.veli} ${o.cocuk}`),
        interestedProgram: o.ilgi ?? null,
        message: o.mesaj ?? null,
        source: o.kaynak,
        sourceDetail: o.kaynakDetay ?? null,
        stage: o.asama,
        unreachableCount: o.deneme ?? 0,
        appointmentAt: o.randevuGun === undefined ? null : gunEkle(o.randevuGun),
        nextActionDate:
          o.takipGun === undefined || o.asama === "KAZANILDI" || o.asama === "KAYBEDILDI"
            ? null
            : tarihGunu(o.takipGun),
        nextActionNote: o.takipNotu ?? null,
        assignedToUserId: danismanId,
        lossReason: o.kayipSebebi ?? null,
        lossNote: o.kayipNotu ?? null,
        lostAt: o.asama === "KAYBEDILDI" ? gunEkle(-9) : null,
        convertedAt: o.asama === "KAZANILDI" ? gunEkle(-14) : null,
        createdAt: gunEkle(-Math.max(3, (o.etkinlikler?.length ?? 1) * 4)),
        activities: {
          create: [
            ...(o.etkinlikler ?? []).map((e) => ({
              type: e.type,
              note: e.note ?? null,
              fromStage: e.fromStage ?? null,
              toStage: e.toStage ?? null,
              // SISTEM satırını makine yazar; kalanı danışman yazmış gibi.
              createdByUserId: e.type === "SISTEM" ? null : danismanId,
              createdAt: gunEkle(-e.gunOnce),
            })),
            {
              type: "SISTEM" as const,
              note: "Örnek kayıt — tanıtım için eklendi, silinebilir.",
              createdAt: gunEkle(-30),
            },
          ],
        },
      },
      select: { id: true },
    });
    yazilan.push(aday.id);
  }

  // Manifest BİRİKİR, ezilmez: betik tekrar çalıştırıldığında yeni kayıt
  // yazılmasa bile önceki kimlikler durmalı. İlk sürümde ezildiği için ikinci
  // çalıştırma temizlik kaydını yok ediyordu — silinemeyen örnek veri kalırdı.
  const manifestYolu = join(import.meta.dirname, "manifest.json");
  let oncekiIds: string[] = [];
  try {
    oncekiIds = JSON.parse(readFileSync(manifestYolu, "utf8")).adayIds ?? [];
  } catch {
    oncekiIds = [];
  }
  const tumIds = [...new Set([...oncekiIds, ...yazilan])];

  writeFileSync(
    manifestYolu,
    `${JSON.stringify({ guncellendi: new Date().toISOString(), adayIds: tumIds }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Örnek aday yazıldı: ${yazilan.length}, atlanan (zaten vardı): ${atlanan}`);
  console.log(`Toplam aday (tüm şubeler): ${await db.lead.count()}`);
  await db.$disconnect();
}

main().catch((hata) => {
  console.error(hata);
  process.exit(1);
});
