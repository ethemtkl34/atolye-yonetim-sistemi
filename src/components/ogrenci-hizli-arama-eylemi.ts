"use server";

import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { ogrenciAramaKosulu } from "@/lib/ogrenci-arama";
import { yasYil } from "@/lib/tarih";

/**
 * §6.6 — Üst şeritteki hızlı öğrenci araması (30 Eylül 2026).
 *
 * `"use server"` bir eylem dosyası: yalnızca async fonksiyon dışa aktarır —
 * TİP BİLE aktaramaz, oradan `export type` yapmak üretimde 500 veriyor ve
 * tsc/test/derleme üçü de yakalamıyor (bkz. `ogrenciler/sema.ts` şerhi).
 * Sonuç tipi bu yüzden bileşen içinde `Awaited<ReturnType<…>>` ile türetiliyor.
 *
 * YETKİ: `yonetimZorunlu("ogrenciler")` — listeyi görebilen arayabilir.
 * ŞUBE: koşul `ogrenciAramaKosulu` içinde ve oturumun aktif şubesinden
 * geliyor; üst şerit bütün panelde çizildiği için burada şube süzgecini
 * atlamak, her ekranda öbür şubenin çocuklarını aranabilir yapardı.
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

  // şube-muaf: süzgeç `ogrenciAramaKosulu` içinde (bkz. o fonksiyonun şerhi).
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
    },
  });

  const bugun = new Date();
  return ogrenciler.map((ogrenci) => ({
    id: ogrenci.id,
    ad: `${ogrenci.firstName} ${ogrenci.lastName}`,
    // Aynı adlı iki çocuğu ayırt etmenin en hızlı yolu yaş ve okul (§6.2).
    ayrinti:
      [
        ogrenci.birthDate ? `${yasYil(ogrenci.birthDate, bugun)} yaş` : null,
        ogrenci.school,
      ]
        .filter(Boolean)
        .join(" · ") || null,
  }));
}
