"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Alan, Bildirim, Buton, Kart, butonStili, secimStili } from "@/components/ui";
import { cn } from "@/lib/utils";
import { kayitOlustur, type EylemDurumu } from "../actions";

export type GrupSecenegi = {
  id: string;
  ad: string;
  zaman: string;
  kapasite: number;
  doluluk: number;
  dolu: boolean;
  aktif: boolean;
  oturumSayisi: number;
  baslangicHaftasi: number;
};

export type ProgramSecenegi = {
  id: string;
  ad: string;
  tur: "Dönem" | "Kulüp";
  gruplar: GrupSecenegi[];
  /** Dönemin stajyer kadrosu; `null` = kısıt yok (kulüpler ve kadrosuz dönemler). */
  stajyerIdleri: string[] | null;
};

export type StajyerSecenegi = {
  id: string;
  ad: string;
  aktifOgrenciSayisi: number;
};

function KaydetButonu({
  uyariVar,
  secimEksik,
}: {
  uyariVar: boolean;
  secimEksik: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending || secimEksik}>
      {pending
        ? "Kaydediliyor…"
        : uyariVar
          ? "Uyarıya rağmen kaydı oluştur"
          : "Kaydı tamamla"}
    </Buton>
  );
}

/**
 * §7.2 — Dönem kaydı akışı: program → grup → kontenjan → stajyer → tamamla.
 *
 * Kontenjan bilgisi sunucuya gitmeden görünüyor; gruplar ve doluluk sayıları
 * sayfa yüklenirken birlikte geliyor. Böylece koordinatör dolu bir grubu
 * seçip gönderdikten sonra reddedilmek yerine, seçerken görüyor.
 */
export function KayitFormu({
  ogrenci,
  programlar,
  stajyerler,
}: {
  ogrenci: { id: string; ad: string };
  programlar: ProgramSecenegi[];
  stajyerler: StajyerSecenegi[];
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    kayitOlustur,
    {},
  );

  const [programId, setProgramId] = useState("");
  const [grupId, setGrupId] = useState("");
  const [stajyerId, setStajyerId] = useState("");

  const secilenProgram = useMemo(
    () => programlar.find((p) => p.id === programId),
    [programlar, programId],
  );

  const secilenGrup = useMemo(
    () => secilenProgram?.gruplar.find((g) => g.id === grupId),
    [secilenProgram, grupId],
  );

  /**
   * Dönemin kadrosu varsa liste ona indirgenir. Kadrodaki pasif hesaplar
   * `stajyerler` içinde zaten yok (sayfa yalnızca aktifleri getiriyor), bu
   * yüzden kesişim boş kalabilir — o durum aşağıda ayrıca açıklanıyor.
   */
  const uygunStajyerler = useMemo(() => {
    const kadro = secilenProgram?.stajyerIdleri;
    if (!kadro) return stajyerler;
    return stajyerler.filter((stajyer) => kadro.includes(stajyer.id));
  }, [secilenProgram, stajyerler]);

  const kadroSuzuyor = Boolean(secilenProgram?.stajyerIdleri);

  // Uyarıdan sonra grup değiştirilirse önceki gruba verilmiş onay taşınmaz.
  const uyariVar =
    Boolean(durum.uyari) && durum.uyariGroupId === grupId;

  /**
   * React, form eylemi tamamlanınca formu sıfırlıyor ve bu sıfırlama
   * `<select>` öğelerinin DOM değerini ilk seçeneğe düşürüyor. React'in
   * kendi durumu bozulmuyor ama ekranda seçim kaybolmuş gibi görünüyor ve —
   * asıl sorun — bir sonraki gönderimde alanlar boş gidiyordu. §7.4'ün
   * "uyarıya rağmen devam et" adımı tam da ikinci gönderim olduğu için bu
   * akış kırılıyordu.
   *
   * İki önlem alınıyor:
   *   1. Gönderilen veri gizli alanlardan gidiyor (`groupId`, `internId`).
   *      Gizli alanın sıfırlanması aynı değere döndüğü için zararsız.
   *   2. Sıfırlamadan sonra seçim kutuları durumdan geri yazılıyor; böylece
   *      ekran ile gönderilecek veri aynı kalıyor.
   */
  const grupSecimi = useRef<HTMLSelectElement>(null);
  const stajyerSecimi = useRef<HTMLSelectElement>(null);
  const programSecimi = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (programSecimi.current) programSecimi.current.value = programId;
    if (grupSecimi.current) grupSecimi.current.value = grupId;
    if (stajyerSecimi.current) stajyerSecimi.current.value = stajyerId;
  }, [durum, programId, grupId, stajyerId]);

  return (
    <form action={eylem} className="space-y-6">
      <input type="hidden" name="studentId" value={ogrenci.id} />
      {/* Seçimler gizli alanlardan gider; yukarıdaki nota bakın. */}
      <input type="hidden" name="groupId" value={grupId} />
      <input type="hidden" name="internId" value={stajyerId} />
      {/* §7.4 — Uyarı gösterildikten sonraki gönderimde onay taşınır. */}
      {uyariVar ? <input type="hidden" name="onaylandi" value="1" /> : null}

      <Kart className="space-y-4 p-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Öğrenci</h2>
          <p className="mt-1 text-sm text-zinc-700">{ogrenci.ad}</p>
        </div>
      </Kart>

      <Kart className="space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">Program ve grup</h2>

        {programlar.length === 0 ? (
          <Bildirim tur="hata">
            Kayıt alan bir program yok. Önce dönem oluşturun ve durumunu
            &quot;Kayıt alıyor&quot; yapın.
          </Bildirim>
        ) : (
          <>
            <Alan etiket="Program">
              <select
                ref={programSecimi}
                value={programId}
                onChange={(e) => {
                  const yeniId = e.target.value;
                  setProgramId(yeniId);
                  setGrupId("");
                  // Yeni programın kadrosu seçili stajyeri kapsamıyorsa seçim
                  // taşınmaz; taşınsaydı gizli alandan kadro dışı bir stajyer
                  // gidip sunucuda reddedilirdi.
                  const yeniProgram = programlar.find((p) => p.id === yeniId);
                  if (
                    yeniProgram?.stajyerIdleri &&
                    stajyerId &&
                    !yeniProgram.stajyerIdleri.includes(stajyerId)
                  ) {
                    setStajyerId("");
                  }
                }}
                className={secimStili}
              >
                <option value="">Seçin…</option>
                {programlar.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.tur}: {program.ad}
                  </option>
                ))}
              </select>
            </Alan>

            <Alan etiket="Grup" hata={durum.alanHatalari?.groupId}>
              <select
                ref={grupSecimi}
                value={grupId}
                onChange={(e) => setGrupId(e.target.value)}
                disabled={!secilenProgram}
                className={secimStili}
              >
                <option value="">
                  {secilenProgram ? "Seçin…" : "Önce program seçin"}
                </option>
                {secilenProgram?.gruplar.map((grup) => (
                  <option
                    key={grup.id}
                    value={grup.id}
                    disabled={grup.dolu || !grup.aktif}
                  >
                    {grup.ad} · {grup.zaman} · {grup.doluluk}/{grup.kapasite}
                    {grup.dolu ? " (dolu)" : ""}
                    {!grup.aktif ? " (kapalı)" : ""}
                  </option>
                ))}
              </select>
            </Alan>

            {secilenGrup ? (
              <div className="rounded-md bg-yuzey-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-40 overflow-hidden rounded-full bg-yuzey-200">
                    <div
                      className={cn(
                        "h-full",
                        secilenGrup.dolu ? "bg-vurgu-600" : "bg-marka-600",
                      )}
                      style={{
                        width: `${Math.min(100, (secilenGrup.doluluk / secilenGrup.kapasite) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-zinc-700">
                    {secilenGrup.doluluk} / {secilenGrup.kapasite} öğrenci ·{" "}
                    {secilenGrup.kapasite - secilenGrup.doluluk} yer kaldı
                  </span>
                </div>

                <p className="mt-2 text-xs text-zinc-600">
                  Bu grupta {secilenGrup.oturumSayisi} atölye oturumu var.
                </p>

                {secilenGrup.baslangicHaftasi > 1 ? (
                  <p className="mt-1 text-xs text-vurgu-700">
                    Bu grup dönem başladıktan sonra açıldı;{" "}
                    {secilenGrup.baslangicHaftasi}. haftadan itibaren katılıyor
                    ve önceki haftalar telafi edilmiyor.
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </Kart>

      <Kart className="space-y-4 p-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Sorumlu stajyer
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Bu kayıt boyunca öğrenciyi bu stajyer puanlar. Öğrencinin başka
            kayıtlarında farklı bir stajyer görevli olabilir.
            {kadroSuzuyor
              ? " Seçilen dönemin stajyer kadrosu tanımlı; yalnızca kadrodaki stajyerler listeleniyor."
              : ""}
          </p>
        </div>

        {stajyerler.length === 0 ? (
          <Bildirim tur="hata">
            Aktif stajyer yok. Önce{" "}
            <Link href="/koordinator/stajyerler" className="underline">
              stajyer ekleyin
            </Link>
            .
          </Bildirim>
        ) : uygunStajyerler.length === 0 ? (
          <Bildirim tur="hata">
            Bu dönemin kadrosunda aktif stajyer kalmamış. Dönem sayfasındaki
            &quot;Stajyer kadrosu&quot; bölümünden kadroya aktif bir stajyer
            ekleyin.
          </Bildirim>
        ) : (
          <Alan etiket="Stajyer" hata={durum.alanHatalari?.internId}>
            <select
              ref={stajyerSecimi}
              value={stajyerId}
              onChange={(e) => setStajyerId(e.target.value)}
              className={secimStili}
            >
              <option value="">Seçin…</option>
              {uygunStajyerler.map((stajyer) => (
                <option key={stajyer.id} value={stajyer.id}>
                  {stajyer.ad} — {stajyer.aktifOgrenciSayisi} aktif öğrenci
                </option>
              ))}
            </select>
          </Alan>
        )}
      </Kart>

      {uyariVar ? (
        <div className="rounded-md border border-vurgu-200 bg-vurgu-50 p-3">
          <p className="text-sm font-medium text-vurgu-800">Çakışma uyarısı</p>
          <p className="mt-1 text-sm text-vurgu-700">{durum.uyari}</p>
        </div>
      ) : null}

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex items-center gap-2">
        <KaydetButonu
          uyariVar={uyariVar}
          secimEksik={!grupId || !stajyerId}
        />
        <Link
          href={`/koordinator/ogrenciler/${ogrenci.id}`}
          className={butonStili("ikincil")}
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
