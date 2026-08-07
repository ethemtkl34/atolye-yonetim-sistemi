import type { Metadata } from "next";
import { db } from "@/lib/db";
import { adminZorunlu } from "@/lib/yetki-kapisi";
import type { Role } from "@/generated/prisma/enums";
import { BosDurum, SayfaBasligi } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import {
  KullaniciYonetimi,
  type KullaniciSatiri,
} from "./kullanici-yonetimi";

export const metadata: Metadata = {
  title: "Kullanıcılar",
};

const TEMEL_YOL = "/koordinator/kullanicilar";

/**
 * Yöneticinin hesap ve rol yönetimi.
 *
 * Panelin ŞUBEYE BAKMAYAN tek ekranı: yönetici burada bütün şubelerin
 * hesaplarını birlikte görür. Üst şeritteki şube seçimi bu listeyi
 * daraltmıyor — daraltsaydı "diğer şubeye koordinatör ata" işi için şube
 * değiştirip geri dönmek gerekirdi. Bunun yerine şube burada sıradan bir
 * süzgeç.
 *
 * Koordinatörün Stajyerler ekranı yerinde duruyor ve kendi şubesiyle sınırlı;
 * bu ekran onun yerine geçmiyor, üstüne biniyor.
 */
export default async function KullanicilarSayfasi(
  props: PageProps<"/koordinator/kullanicilar">,
) {
  const yonetici = await adminZorunlu();

  const parametreler = await props.searchParams;
  const subeSuzgeci =
    typeof parametreler.sube === "string" ? parametreler.sube : "tumu";
  const durumSuzgeci = parametreler.durum === "pasif" ? "pasif" : "aktif";

  const subeler = await db.branch.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const gecerliSube = subeler.some((sube) => sube.id === subeSuzgeci)
    ? subeSuzgeci
    : subeSuzgeci === "yonetici"
      ? "yonetici"
      : "tumu";

  const kullanicilar = await db.user.findMany({
    where: {
      ...(durumSuzgeci === "aktif" ? { active: true } : { active: false }),
      ...(gecerliSube === "tumu"
        ? {}
        : gecerliSube === "yonetici"
          ? { branchId: null }
          : { branchId: gecerliSube }),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      roles: true,
      active: true,
      branchId: true,
      branch: { select: { name: true } },
      _count: {
        select: {
          assignedEnrollments: { where: { status: "AKTIF" } },
          enteredScores: true,
        },
      },
    },
  });

  // Yetkiden aza doğru. Sıra veritabanına bırakılamıyor — enum'da sonradan
  // eklenen değerler listenin sonuna yazılır (`ALTER TYPE ... ADD VALUE`) ve
  // enum sırasına göre sıralamak yöneticiyi listenin dibine atıyordu.
  // Çoklu rolde satırın sırası EN YETKİLİ rolünden gelir.
  const ROL_SIRASI: Record<Role, number> = {
    ADMIN: 0,
    KOORDINATOR: 1,
    ATOLYE_PSIKOLOGU: 2,
    TEST_UYGULAYICISI: 3,
    DANISMA_GOREVLISI: 4,
    STAJYER: 5,
  };
  const satirSirasi = (roller: readonly Role[]) =>
    Math.min(...roller.map((rol) => ROL_SIRASI[rol]));

  const satirlar: KullaniciSatiri[] = kullanicilar
    .sort(
      (a, b) =>
        satirSirasi(a.roles) - satirSirasi(b.roles) ||
        a.name.localeCompare(b.name, "tr"),
    )
    .map((kullanici) => ({
      id: kullanici.id,
      name: kullanici.name,
      email: kullanici.email,
      roller: kullanici.roles,
      active: kullanici.active,
      subeId: kullanici.branchId,
      subeAdi: kullanici.branch?.name ?? null,
      aktifOgrenciSayisi: kullanici._count.assignedEnrollments,
      puanlamaSayisi: kullanici._count.enteredScores,
    }));

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Kullanıcılar"
        aciklama="Koordinatör, stajyer ve yönetici hesapları. Hesabın şubesi görüş alanını belirler: koordinatör ve stajyer yalnızca kendi şubesinin verisini görür. Hesaplar silinmez, pasife alınır — geçmiş puanlamalar ve raporlar korunur."
        ustBilgi={<span className="text-xs text-zinc-500">Bütün şubeler</span>}
      />

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Şube"
          temelYol={TEMEL_YOL}
          anahtar="sube"
          secili={gecerliSube}
          digerler={{ durum: durumSuzgeci }}
          secenekler={[
            { deger: "tumu", etiket: "Tümü" },
            ...subeler.map((sube) => ({ deger: sube.id, etiket: sube.name })),
            { deger: "yonetici", etiket: "Şubesiz (yönetici)" },
          ]}
        />
        <SuzgecGrubu
          etiket="Durum"
          temelYol={TEMEL_YOL}
          anahtar="durum"
          secili={durumSuzgeci}
          digerler={{ sube: gecerliSube }}
          secenekler={[
            { deger: "aktif", etiket: "Aktif" },
            { deger: "pasif", etiket: "Pasif" },
          ]}
        />
      </SuzgecCubugu>

      {satirlar.length === 0 ? (
        <BosDurum
          baslik="Bu süzgeçle eşleşen hesap yok."
          aciklama="Şube veya durum süzgecini değiştirin."
        />
      ) : null}

      <KullaniciYonetimi
        kullanicilar={satirlar}
        subeler={subeler.map((sube) => ({ id: sube.id, ad: sube.name }))}
        benimId={yonetici.id}
      />
    </div>
  );
}
