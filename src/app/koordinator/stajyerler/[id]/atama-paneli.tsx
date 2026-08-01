"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bildirim, Buton, Girdi, Kart, Rozet } from "@/components/ui";
import { normalizeArama } from "@/lib/turkce";
import { kayitStajyerDegistir } from "../../kayitlar/actions";
import { stajyerKadroDurumuDegistir } from "../actions";

export type AtanabilirKayit = {
  kayitId: string;
  ogrenciId: string;
  ogrenciAdi: string;
  grupAdi: string;
  grupZamani: string;
  /** Şu anki sorumlu; bu stajyerse `bende` true olur. */
  mevcutStajyerAdi: string | null;
  bende: boolean;
};

/**
 * §8 — Stajyer merkezli atama paneli.
 *
 * Seçilen programın aktif kayıtları listelenir; koordinatör satıra basarak
 * öğrenciyi bu stajyere atar. Aynı iş öğrenci profilinden de yapılabiliyor
 * (orada öğrenci sabit, stajyer seçiliyor); iki ekran da tek server action'ı
 * çağırdığı için kadro kuralı ayrışmıyor.
 */
export function AtamaPaneli({
  stajyerId,
  stajyerAdi,
  stajyerAktif,
  donemId,
  donemAdi,
  kadroda,
  kayitlar,
}: {
  stajyerId: string;
  stajyerAdi: string;
  stajyerAktif: boolean;
  /** Kulüp seçiliyse null — kulüplerde kadro kavramı yok. */
  donemId: string | null;
  donemAdi: string | null;
  /** Dönem kadrosu tanımlıysa bu stajyer kadroda mı; kadro yoksa null. */
  kadroda: boolean | null;
  kayitlar: AtanabilirKayit[];
}) {
  const router = useRouter();
  const [sonuc, setSonuc] = useState<{ basari?: string; hata?: string } | null>(
    null,
  );
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [kadroIslemde, kadroBasla] = useTransition();
  const [, basla] = useTransition();

  /**
   * Öğrenci adına göre süzme — kalabalık dönemlerde (16+ kayıt) aranan
   * öğrenciyi gözle bulmak zordu. Arama Türkçe karakterlere duyarsız:
   * "sule" yazınca "Şule" de bulunur (§6.2'deki öğrenci aramasıyla aynı
   * normalizasyon). Süzme istemcide yapılıyor; liste zaten burada.
   */
  const gosterilecekler = useMemo(() => {
    const anahtar = normalizeArama(arama);
    if (!anahtar) return kayitlar;
    return kayitlar.filter(
      (kayit) =>
        normalizeArama(kayit.ogrenciAdi).includes(anahtar) ||
        normalizeArama(kayit.grupAdi).includes(anahtar),
    );
  }, [arama, kayitlar]);

  function ata(kayitId: string) {
    setBekleyen(kayitId);
    setSonuc(null);
    basla(async () => {
      const cevap = await kayitStajyerDegistir(kayitId, stajyerId);
      setSonuc(cevap);
      setBekleyen(null);
      router.refresh();
    });
  }

  function kadroDegistir() {
    if (!donemId) return;
    setSonuc(null);
    kadroBasla(async () => {
      setSonuc(await stajyerKadroDurumuDegistir(donemId, stajyerId));
      router.refresh();
    });
  }

  // Kadro tanımlı ve stajyer dışarıdaysa atama sunucuda reddedilir; düğmeleri
  // baştan kilitleyip sebebini yazmak, tıklatıp hata göstermekten iyi.
  const kadroDisinda = kadroda === false;

  return (
    <div className="space-y-3">
      {donemId ? (
        <Kart className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-zinc-900">Dönem kadrosu</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {kadroda === null
                ? `"${donemAdi}" için kadro tanımlanmamış; dönemin kayıtlarında bütün aktif stajyerler seçilebiliyor.`
                : kadroda
                  ? `${stajyerAdi} bu dönemin kadrosunda.`
                  : `${stajyerAdi} bu dönemin kadrosunda değil; önce kadroya ekleyin.`}
            </p>
          </div>
          <Buton
            tur={kadroDisinda ? "birincil" : "ikincil"}
            disabled={kadroIslemde || (!stajyerAktif && !kadroda)}
            engelSebebi={
              !stajyerAktif && !kadroda
                ? "Pasif hesap dönem kadrosuna eklenemez."
                : undefined
            }
            onClick={kadroDegistir}
          >
            {kadroIslemde
              ? "Kaydediliyor…"
              : kadroda
                ? "Kadrodan çıkar"
                : "Kadroya ekle"}
          </Buton>
        </Kart>
      ) : null}

      {sonuc?.basari ? <Bildirim tur="basari">{sonuc.basari}</Bildirim> : null}
      {sonuc?.hata ? <Bildirim tur="hata">{sonuc.hata}</Bildirim> : null}

      {kayitlar.length === 0 ? (
        <p className="rounded-lg border border-dashed border-marka-200 bg-white p-6 text-center text-sm text-zinc-600">
          Bu programda aktif öğrenci kaydı yok.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Girdi
              type="search"
              value={arama}
              onChange={(olay) => setArama(olay.target.value)}
              placeholder="Öğrenci veya grup adıyla ara"
              aria-label="Öğrenci ara"
              className="max-w-xs"
            />
            <span className="text-xs text-zinc-500">
              {arama
                ? `${gosterilecekler.length} / ${kayitlar.length} kayıt`
                : `${kayitlar.length} kayıt`}
            </span>
            {arama ? (
              <Buton tur="sade" onClick={() => setArama("")}>
                Aramayı temizle
              </Buton>
            ) : null}
          </div>

          {gosterilecekler.length === 0 ? (
            <p className="rounded-lg border border-dashed border-marka-200 bg-white p-6 text-center text-sm text-zinc-600">
              “{arama}” ile eşleşen öğrenci yok. Aramayı temizleyerek bütün
              kayıtları görebilirsiniz.
            </p>
          ) : (
            <Kart className="divide-y divide-yuzey-100">
              {gosterilecekler.map((kayit) => (
                <div
                  key={kayit.kayitId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/koordinator/ogrenciler/${kayit.ogrenciId}`}
                        className="font-medium text-zinc-900 hover:text-marka-700 hover:underline"
                      >
                        {kayit.ogrenciAdi}
                      </Link>
                      {kayit.bende ? (
                        <Rozet tur="olumlu">Bu stajyerde</Rozet>
                      ) : kayit.mevcutStajyerAdi ? null : (
                        <Rozet tur="uyari">Atanmamış</Rozet>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {kayit.grupAdi} · {kayit.grupZamani}
                      {!kayit.bende && kayit.mevcutStajyerAdi
                        ? ` · Şu an: ${kayit.mevcutStajyerAdi}`
                        : ""}
                    </p>
                  </div>

                  {kayit.bende ? (
                    <span className="text-xs text-zinc-500">Atandı</span>
                  ) : (
                    <Buton
                      tur="ikincil"
                      disabled={bekleyen === kayit.kayitId || kadroDisinda}
                      engelSebebi={
                        kadroDisinda
                          ? `${stajyerAdi} bu dönemin kadrosunda değil. Önce yukarıdan kadroya ekleyin.`
                          : undefined
                      }
                      onClick={() => ata(kayit.kayitId)}
                    >
                      {bekleyen === kayit.kayitId
                        ? "Atanıyor…"
                        : kayit.mevcutStajyerAdi
                          ? "Bu stajyere devret"
                          : "Bu stajyere ata"}
                    </Buton>
                  )}
                </div>
              ))}
            </Kart>
          )}
        </>
      )}
    </div>
  );
}
