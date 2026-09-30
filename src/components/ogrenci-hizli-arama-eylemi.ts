"use server";

import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { ogrenciAramaKosulu } from "@/lib/ogrenci-arama";
import { yasYil } from "@/lib/tarih";
import { subeEtiketi } from "@/lib/sube-etiketi";

/**
 * §6.6 — Üst şeritteki hızlı öğrenci araması (30 Eylül 2026).
 *
 * `"use server"` bir eylem dosyası: yalnızca async fonksiyon dışa aktarır —
 * TİP BİLE aktaramaz, oradan `export type` yapmak üretimde 500 veriyor ve
 * tsc/test/derleme üçü de yakalamıyor (bkz. `ogrenciler/sema.ts` şerhi).
 * Sonuç tipi bu yüzden bileşen içinde `Awaited<ReturnType<…>>` ile türetiliyor.
 *
 * YETKİ: `yonetimZorunlu("ogrenciler")` — listeyi görebilen arayabilir.
 * ŞUBE: öğrenciler iki şubede ortak havuzda (Eylül 2026) — arama iki
 * şubenin öğrencilerini birlikte bulur, satırda kayıt şubesi yazar.
 *
 * SONUÇ DAR: liste ekranının `ogrenciAra`sı veli bağlarını ve kayıt
 * sayılarını da çekiyor; açılır kutuda bunların hiçbiri görünmüyor, o yüzden
 * ayrı ve küçük bir sorgu.
 */

/** Açılır kutuda en fazla kaç satır — fazlası için liste ekranı var. */
const EN_FAZLA = 8;

export async function hizliOgrenciAra(sorgu: string) {
  const kullanici = await yonetimZorunlu("ogrenciler");

  const temiz = sorgu.trim();
  if (temiz.length < 2) return [];

  const ogrenciler = await db.student.findMany({
    where: ogrenciAramaKosulu(temiz, { subeId: kullanici.aktifSubeId }),
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: EN_FAZLA,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      school: true,
      branch: { select: { name: true } },
    },
  });

  const bugun = new Date();
  return ogrenciler.map((ogrenci) => ({
    id: ogrenci.id,
    ad: `${ogrenci.firstName} ${ogrenci.lastName}`,
    // Aynı adlı iki çocuğu ayırt etmenin en hızlı yolu yaş ve okul (§6.2);
    // ortak havuzda kayıt şubesi de.
    ayrinti:
      [
        ogrenci.birthDate ? `${yasYil(ogrenci.birthDate, bugun)} yaş` : null,
        ogrenci.school,
        subeEtiketi(ogrenci.branch),
      ]
        .filter(Boolean)
        .join(" · ") || null,
  }));
}
