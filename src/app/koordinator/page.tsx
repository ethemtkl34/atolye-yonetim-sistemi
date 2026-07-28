import type { Metadata } from "next";
import { db } from "@/lib/db";
import { koordinatorZorunlu } from "@/lib/auth-guard";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Koordinatör dashboardu. §12.1'deki özetlerin tamamı P11'de tamamlanacak;
 * şu an yalnızca veritabanına gerçekten bağlanıldığını gösteren katalog
 * sayıları var.
 */
export default async function KoordinatorDashboard() {
  const kullanici = await koordinatorZorunlu();

  const [atolyeSayisi, soruSayisi, stajyerSayisi] = await Promise.all([
    db.workshopType.count({ where: { active: true } }),
    db.question.count({ where: { active: true } }),
    db.user.count({ where: { role: "STAJYER", active: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">
          Hoş geldiniz, {kullanici.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Dönem, kulüp ve öğrenci modülleri sonraki paketlerde eklenecek.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <OzetKart baslik="Aktif atölye çeşidi" deger={atolyeSayisi} />
        <OzetKart baslik="Değerlendirme sorusu" deger={soruSayisi} />
        <OzetKart baslik="Aktif stajyer" deger={stajyerSayisi} />
      </div>
    </div>
  );
}

function OzetKart({ baslik, deger }: { baslik: string; deger: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-600">{baslik}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{deger}</p>
    </div>
  );
}
