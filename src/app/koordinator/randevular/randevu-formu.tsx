"use client";

import { IndirimSecici } from "./indirim-secici";
import { useActionState, useEffect, useRef, useState } from "react";
import { GonderButonu, Pencere } from "@/components/ui-istemci";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  secimStili,
} from "@/components/ui";
import type { EylemDurumu } from "@/lib/formlar";
import { VARSAYILAN_TEKRAR_HAFTASI, EN_FAZLA_TEKRAR_HAFTASI } from "@/lib/randevu/tekrar";
import { paraMetni, sureMetni } from "../uzmanlar/sema";
import { randevuEkle } from "./actions";
import { VeliSecici, type VeliSecimi } from "./veli-secici";

export type UzmanSecenegi = {
  id: string;
  ad: string;
  renk: string;
  /** Çalıştığı şubeler — seçilen şubede çalışmıyorsa listede çıkmaz. */
  subeIdleri: string[];
  hizmetIdleri: string[];
};

/** Randevunun açılabileceği şube. */
export type SubeSecenegi = { id: string; ad: string };

export type HizmetSecenegi = {
  id: string;
  ad: string;
  grup: "TEST" | "DANISMANLIK" | "ATOLYE";
  sureDk: number;
  ucretKurus: number;
  tekrarli: boolean;
  danisanTuru: "COCUK" | "VELI";
};

/**
 * §17.4 — Yeni randevu.
 *
 * Sıra bilinçli: önce UZMAN, sonra hizmet. Hizmet listesi seçilen uzmanın
 * yetkinliğine göre süzülüyor (belgedeki "hatalı atamaların önüne geçer"
 * kuralı); ters sırada kullanıcı hizmeti seçip sonra "bunu yapan uzman yok"
 * cevabını alırdı.
 *
 * Sunucu aynı kuralı ayrıca doğruluyor — buradaki süzme yalnız kurulamayacak
 * bir seçimi ekranda göstermemek için.
 */
export function RandevuFormuAcici({
  uzmanlar,
  hizmetler,
  subeler,
  varsayilanSubeId,
  varsayilanTarih,
  varsayilanUzmanId,
  varsayilanSaat,
  acik: acikDisarida,
  onAcikDegis,
}: {
  uzmanlar: UzmanSecenegi[];
  hizmetler: HizmetSecenegi[];
  /** Randevunun açılabileceği şubeler; tek elemanlıysa seçici çizilmez. */
  subeler: SubeSecenegi[];
  /** Ekranda çalışılan şube — seçicinin açılış değeri. */
  varsayilanSubeId: string;
  varsayilanTarih: string;
  /** Program (ızgara) hücresinden önerilen uzman — verilmezse ilk uygun uzman. */
  varsayilanUzmanId?: string;
  /** Program hücresinin dakikasından önerilen saat, "SS:DD". */
  varsayilanSaat?: string;
  /**
   * Açık/kapalı durumunu DIŞARIDAN kontrol etmek için (Program hücresi
   * tıklamasıyla açma gibi). Verilmezse bileşen kendi durumunu tutar ve
   * kendi "Randevu aç" düğmesini çizer — sayfa başlığındaki mevcut kullanım
   * bu yüzden hiç değişmeden çalışmaya devam eder.
   */
  acik?: boolean;
  onAcikDegis?: (acik: boolean) => void;
}) {
  const [icAcik, setIcAcik] = useState(false);
  const efektifAcik = acikDisarida ?? icAcik;
  const kapat = () => (onAcikDegis ? onAcikDegis(false) : setIcAcik(false));

  return (
    <>
      {onAcikDegis ? null : (
        <Buton type="button" onClick={() => setIcAcik(true)}>
          Randevu aç
        </Buton>
      )}
      {efektifAcik ? (
        <RandevuFormu
          uzmanlar={uzmanlar}
          hizmetler={hizmetler}
          subeler={subeler}
          varsayilanSubeId={varsayilanSubeId}
          varsayilanTarih={varsayilanTarih}
          varsayilanUzmanId={varsayilanUzmanId}
          varsayilanSaat={varsayilanSaat}
          onKapat={kapat}
        />
      ) : null}
    </>
  );
}

function RandevuFormu({
  uzmanlar,
  hizmetler,
  subeler,
  varsayilanSubeId,
  varsayilanTarih,
  varsayilanUzmanId,
  varsayilanSaat,
  onKapat,
}: {
  uzmanlar: UzmanSecenegi[];
  hizmetler: HizmetSecenegi[];
  subeler: SubeSecenegi[];
  varsayilanSubeId: string;
  varsayilanTarih: string;
  varsayilanUzmanId?: string;
  varsayilanSaat?: string;
  onKapat: () => void;
}) {
  // Takvimde hangi haftaya gidildiyse "Randevu aç" o günü önerir; geçmiş
  // hafta da dahil (geçmiş kilidi 25 Eylül 2026'da kaldırıldı).
  const onerilenTarih = varsayilanTarih;
  const [durum, gonder] = useActionState<EylemDurumu, FormData>(
    async (_onceki, veri) => {
      const sonuc = await randevuEkle(_onceki, veri);
      if (sonuc.basari) onKapat();
      return sonuc;
    },
    {},
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [mesaiZorla, setMesaiZorla] = useState(false);

  /**
   * `onayGerekli` (mesai dışı) sunucudan gelince bir kez sorar; EVET ise
   * gizli `mesaiZorla` alanını 1 yapıp AYNI formu yeniden gönderir — ikinci
   * turda `randevuEngeli` mesaiyi hiç bildirmediği için form normal
   * akışına döner. `[durum]` bilinçli: `durum.onayGerekli` metni aynı
   * kalsa bile (kullanıcı vazgeçip aynı saati tekrar denerse) her yeni
   * sunucu yanıtı YENİ bir nesne, bu yüzden efekt yine tetiklenir.
   */
  useEffect(() => {
    if (!durum.onayGerekli) return;
    const devamEt = window.confirm(
      `${durum.onayGerekli}\n\nYine de kaydetmek istiyor musunuz?`,
    );
    // `queueMicrotask`: `window.confirm` senkron olsa da, state güncellemesi
    // efektin GÖVDESİNDEN değil bir sonraki mikro görevden gelsin diye
    // (art arda render zincirini engelleyen kural, `react-hooks/set-state-in-effect`).
    if (devamEt) queueMicrotask(() => setMesaiZorla(true));
  }, [durum]);

  useEffect(() => {
    if (mesaiZorla) formRef.current?.requestSubmit();
  }, [mesaiZorla]);

  // React 19 form eylemi bitince kontrolsüz alanları sıfırlar (`onayGerekli`
  // dönüşü de dahil) — `mesaiZorla` ile otomatik yeniden gönderilen formun
  // native doğrulaması BOŞ bir zorunlu alanda (`yeniVeliAdi`) sessizce
  // takılıyordu; eylem girilen değerleri geri döndürüyor, burada
  // `defaultValue` olarak yazılıyor (bkz. `formlar.ts` `degerler` şerhi,
  // `ogrenci-formu.tsx`'teki aynı desen).
  const deger = (alan: string) => durum.degerler?.[alan];

  /**
   * Randevunun AÇILACAĞI şube (Eylül 2026). Eskiden sessizce ekranın aktif
   * şubesine açılıyordu; masa başka şubeye randevu girmek için önce bütün
   * ekranı o şubeye çevirmek zorundaydı. Şube değişince uzman listesi de
   * değişiyor — çift şubeli olmayan uzman öbür şubede randevu alamaz.
   */
  const [subeId, setSubeId] = useState(varsayilanSubeId);

  const secilebilirUzmanlar = uzmanlar.filter((uzman) =>
    uzman.subeIdleri.includes(subeId),
  );
  const [uzmanId, setUzmanId] = useState(
    varsayilanUzmanId ?? secilebilirUzmanlar[0]?.id ?? "",
  );
  const [hizmetId, setHizmetId] = useState("");
  const [veli, setVeli] = useState<VeliSecimi>({ tur: "yok" });

  /**
   * `ogrenci-formu.tsx`'teki aynı tuzak: React eylem bitince (başarısız
   * denemede de) bu `<select>`lerin DOM değerini ilk seçeneğe düşürüyor —
   * `value={uzmanId}`/`value={hizmetId}` React state'i DEĞİŞMEDİĞİ için
   * yeniden uygulanmıyor, ekran ile state ayrışıyor. Örneğin çakışma
   * hatasından sonra "Hizmet" görsel olarak seçili kalıyor ama gerçek DOM
   * değeri boşalıyor; kullanıcı aynı formu tekrar gönderince native
   * doğrulama sessizce takılıyor. İmparatif senkron bunu düzeltiyor.
   */
  const uzmanSecimi = useRef<HTMLSelectElement>(null);
  const hizmetSecimi = useRef<HTMLSelectElement>(null);
  const subeSecimi = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (uzmanSecimi.current) uzmanSecimi.current.value = uzmanId;
    if (hizmetSecimi.current) hizmetSecimi.current.value = hizmetId;
    if (subeSecimi.current) subeSecimi.current.value = subeId;
  }, [durum, uzmanId, hizmetId, subeId]);

  const secilenUzman = secilebilirUzmanlar.find((u) => u.id === uzmanId);
  // Elle `useMemo` YOK: React Compiler bunu kendisi belleğe alıyor ve elle
  // yazılan sarmalayıcı derleyicinin optimizasyonunu bozuyor (lint kuralı
  // `react-hooks/preserve-manual-memoization` bunu hata sayıyor).
  const uygunHizmetler = secilenUzman
    ? hizmetler.filter((hizmet) => secilenUzman.hizmetIdleri.includes(hizmet.id))
    : [];

  const secilenHizmet = uygunHizmetler.find((h) => h.id === hizmetId);

  return (
    <Pencere
      acik
      onKapat={onKapat}
      baslik="Yeni randevu"
      altBaslik="Danışan velidir; çocuk seçimi isteğe bağlı. Ücret açılış anında randevuya kopyalanır."
      genislik="42rem"
      govdeSinifi="space-y-4 overflow-y-auto px-4 pt-4"
    >
      <form ref={formRef} action={gonder} className="space-y-4">
        <input type="hidden" name="mesaiZorla" value={mesaiZorla ? "1" : ""} />
        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        {secilebilirUzmanlar.length === 0 ? (
          <Bildirim tur="hata">
            Bu şubede çalışan aktif uzman yok. Önce Uzmanlar ekranından kadro
            tanımlayın.
          </Bildirim>
        ) : null}

        {/* Tek şube varsa seçici çizmeye gerek yok; gizli alan yine gider ki
            sunucu her zaman açık bir şube kimliği görsün. */}
        {subeler.length > 1 ? (
          <Alan
            etiket="Şube"
            hata={durum.alanHatalari?.subeId}
            ipucu={
              subeId === varsayilanSubeId
                ? "Randevu bu şubenin takvimine ve cirosuna yazılır."
                : // Takvim ekranın şubesini gösterdiği için yeni kayıt burada
                  // ÇIKMAZ; uyarı olmasa kullanıcı kaydolmadı sanıp ikinci kez
                  // açardı.
                  `Randevu ${
                    subeler.find((sube) => sube.id === subeId)?.ad ?? "seçilen şube"
                  } takvimine yazılacak; bu ekranda görünmeyecek.`
            }
          >
            <select
              ref={subeSecimi}
              name="subeId"
              className={secimStili}
              defaultValue={subeId}
              onChange={(olay) => {
                setSubeId(olay.target.value);
                // Uzman kadrosu şubeye bağlı; eski seçim geçersiz olabilir.
                setUzmanId("");
                setHizmetId("");
              }}
              required
            >
              {subeler.map((sube) => (
                <option key={sube.id} value={sube.id}>
                  {sube.ad}
                </option>
              ))}
            </select>
          </Alan>
        ) : (
          <input type="hidden" name="subeId" value={subeId} />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Uzman" hata={durum.alanHatalari?.uzmanId}>
            <select
              ref={uzmanSecimi}
              name="uzmanId"
              className={secimStili}
              defaultValue={uzmanId}
              onChange={(olay) => {
                setUzmanId(olay.target.value);
                // Yetkinlik listesi değişti; eski hizmet seçimi geçersiz.
                setHizmetId("");
              }}
              required
            >
              {secilebilirUzmanlar.map((uzman) => (
                <option key={uzman.id} value={uzman.id}>
                  {uzman.ad}
                </option>
              ))}
            </select>
          </Alan>

          <Alan
            etiket="Hizmet"
            hata={durum.alanHatalari?.hizmetId}
            ipucu={
              secilenUzman && uygunHizmetler.length === 0
                ? "Bu uzmana yetkinlik atanmamış."
                : undefined
            }
          >
            <select
              ref={hizmetSecimi}
              name="hizmetId"
              className={secimStili}
              defaultValue={hizmetId}
              onChange={(olay) => setHizmetId(olay.target.value)}
              required
            >
              <option value="">Seçin…</option>
              {uygunHizmetler.map((hizmet) => (
                <option key={hizmet.id} value={hizmet.id}>
                  {hizmet.ad} · {sureMetni(hizmet.sureDk)} ·{" "}
                  {hizmet.ucretKurus === 0
                    ? "ücretsiz"
                    : paraMetni(hizmet.ucretKurus)}
                </option>
              ))}
            </select>
          </Alan>

          <Alan etiket="Tarih" hata={durum.alanHatalari?.tarih}>
            <Girdi
              name="tarih"
              type="date"
              defaultValue={deger("tarih") ?? onerilenTarih}
              required
            />
          </Alan>

          <Alan
            etiket="Saat"
            hata={durum.alanHatalari?.saat}
            ipucu={
              secilenHizmet
                ? `Seans ${sureMetni(secilenHizmet.sureDk)} sürer.`
                : undefined
            }
          >
            <Girdi
              name="saat"
              type="time"
              defaultValue={deger("saat") ?? varsayilanSaat ?? "10:00"}
              required
            />
          </Alan>
        </div>

        <VeliSecici
          secim={veli}
          onDegis={setVeli}
          hata={durum.alanHatalari?.veliId}
          cocukIsteniyor={secilenHizmet?.danisanTuru !== "VELI"}
          subeId={subeId}
          degerler={{
            yeniVeliAdi: deger("yeniVeliAdi"),
            yeniVeliTelefon: deger("yeniVeliTelefon"),
            yeniOgrenciAdi: deger("yeniOgrenciAdi"),
            yeniOgrenciSoyadi: deger("yeniOgrenciSoyadi"),
            yeniOgrenciDogumTarihi: deger("yeniOgrenciDogumTarihi"),
          }}
        />

        {secilenHizmet?.tekrarli ? (
          <Alan
            etiket="Kaç hafta tekrarlansın?"
            hata={durum.alanHatalari?.haftaSayisi}
            ipucu="Seans her hafta aynı gün ve saate açılır. 1 yazarsanız tek randevu olur."
          >
            <Girdi
              name="haftaSayisi"
              type="number"
              min={1}
              max={EN_FAZLA_TEKRAR_HAFTASI}
              defaultValue={VARSAYILAN_TEKRAR_HAFTASI}
            />
          </Alan>
        ) : (
          // Tekrarsız hizmette alan hiç çizilmiyor ama sunucu yine 1 kabul
          // ediyor; zekâ testleri her seferinde elle giriliyor (§17.4).
          <input type="hidden" name="haftaSayisi" value="1" />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <IndirimSecici
            varsayilan={deger("indirimYuzde") ?? "0"}
            ucretKurus={secilenHizmet?.ucretKurus}
            hata={durum.alanHatalari?.indirimYuzde}
            durum={durum}
          />

          <Alan etiket="İndirim notu" hata={durum.alanHatalari?.indirimNotu}>
            <Girdi
              name="indirimNotu"
              maxLength={200}
              placeholder="Kardeş indirimi"
              defaultValue={deger("indirimNotu")}
            />
          </Alan>
        </div>

        <Alan etiket="Not (isteğe bağlı)" hata={durum.alanHatalari?.not}>
          <CokSatirli name="not" rows={2} maxLength={2000} defaultValue={deger("not")} />
        </Alan>

        {/* Yapışkan eylem şeridi — uzman formundaki gerekçenin aynısı. */}
        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-white/70 bg-[var(--color-yuzey-50)] px-4 py-3">
          <Buton type="button" tur="sade" onClick={onKapat}>
            Vazgeç
          </Buton>
          <GonderButonu disabled={secilebilirUzmanlar.length === 0}>
            Randevuyu aç
          </GonderButonu>
        </div>
      </form>
    </Pencere>
  );
}
