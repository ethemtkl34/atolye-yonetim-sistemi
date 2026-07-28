"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Bildirim, Buton, Kart } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { KapsamKaydi } from "@/lib/rapor-verisi";
import { raporOlustur, type EylemDurumu } from "../actions";

function UretButonu({ etkin }: { etkin: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending || !etkin}>
      {pending ? "Üretiliyor…" : "Raporu oluştur"}
    </Buton>
  );
}

/**
 * §11.1 — Raporun kapsamı seçilir.
 *
 * Varsayılan olarak puanlaması bulunan bütün kayıtlar işaretli gelir: rapor
 * çoğunlukla öğrencinin tamamını kapsar. Hiç puanlaması olmayan kayıt da
 * seçilebilir ama sonucun boş olacağı yazılır — sessizce gizlemek yerine
 * neden boş çıkacağını söylemek daha anlaşılır.
 */
export function RaporFormu({
  ogrenciId,
  kayitlar,
}: {
  ogrenciId: string;
  kayitlar: KapsamKaydi[];
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    raporOlustur.bind(null, ogrenciId),
    {},
  );

  const [secilenler, setSecilenler] = useState<string[]>(() =>
    kayitlar
      .filter((kayit) => kayit.puanlanmisOturumSayisi > 0)
      .map((kayit) => kayit.id),
  );

  function degistir(id: string) {
    setSecilenler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((k) => k !== id)
        : [...oncekiler, id],
    );
  }

  return (
    <form action={eylem} className="space-y-4">
      {secilenler.map((id) => (
        <input key={id} type="hidden" name="kayitlar" value={id} />
      ))}

      <Kart className="space-y-3 p-4">
        <h2 className="text-base font-semibold text-zinc-900">Rapor kapsamı</h2>
        <p className="text-sm text-zinc-600">
          Rapor, seçilen kayıtlardaki puanlamalardan üretilir. Aynı atölye
          birden fazla kayıtta geçiyorsa raporda tek bölüm olarak birleşir.
        </p>

        <ul className="space-y-1">
          {kayitlar.map((kayit) => {
            const secili = secilenler.includes(kayit.id);

            return (
              <li key={kayit.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm",
                    secili ? "bg-marka-50" : "hover:bg-marka-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={secili}
                    onChange={() => degistir(kayit.id)}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    <span className="font-medium text-zinc-800">
                      {kayit.programAdi} · {kayit.grupAdi}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {kayit.tur} · {kayit.aktif ? "Aktif kayıt" : "İptal kayıt"}{" "}
                      ·{" "}
                      {kayit.puanlanmisOturumSayisi > 0
                        ? `${kayit.puanlanmisOturumSayisi} doldurulmuş form`
                        : "Doldurulmuş form yok — bu kayıt rapora içerik katmaz"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Kart>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex items-center gap-3">
        <UretButonu etkin={secilenler.length > 0} />
        <span className="text-sm text-zinc-500">
          {secilenler.length} kayıt seçili
        </span>
      </div>
    </form>
  );
}
