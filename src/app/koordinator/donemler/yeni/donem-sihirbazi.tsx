"use client";

import { useActionState, useMemo, useState } from "react";
import { GonderButonu } from "@/components/ui-istemci";
import { Alan, Bildirim, CokSatirli, Girdi, Kart, secimStili } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  bugun,
  DUZEN_GUNLERI,
  GUN_ADLARI,
  GUN_DUZENI_ADLARI,
  gunEkle,
  haftaBasi,
  haftaBicimle,
  tarihCozumle,
  tarihMetni,
} from "@/lib/tarih";
import type { Day, DayMode } from "@/generated/prisma/enums";
import {
  DONEM_ATOLYE_SAYISI,
  EN_AZ_HAFTA,
  EN_FAZLA_HAFTA,
} from "@/lib/kurallar";
import type { EylemDurumu } from "@/lib/formlar";
import { donemOlustur } from "../actions";

export type AtolyeSecenegi = { id: string; name: string };

export type StajyerSecenegi = {
  id: string;
  name: string;
  aktifOgrenciSayisi: number;
};

/** Takvimde kaç hafta gösterilsin — 6 aya yakın bir aralık. */
const GOSTERILEN_HAFTA_SAYISI = 26;

function KaydetButonu({
  etkin,
  engelSebebi,
}: {
  etkin: boolean;
  engelSebebi?: string;
}) {
  return (
    <GonderButonu
      bekleyenEtiket="Oluşturuluyor…"
      disabled={!etkin}
      engelSebebi={etkin ? undefined : engelSebebi}
    >
      Dönemi oluştur
    </GonderButonu>
  );
}

/**
 * §4.1 — Dönem oluşturma.
 *
 * Haftalar bir ay ızgarası yerine hafta listesi olarak sunuluyor: seçim
 * birimi gün değil hafta. Liste hâlinde göstermek tatil haftalarını atlayarak
 * işaretlemeyi doğrudan yapılabilir kılıyor; ay ızgarasında tek tek günler
 * gereksiz gürültü olurdu.
 *
 * Gün düzeni (hafta içi / hafta sonu) EN BAŞTA soruluyor çünkü hem takvimdeki
 * hafta gösterimini hem de ilk grubun gün listesini belirliyor. Yaz programları
 * hafta içi yapıldığı için eklendi; sezon adı bu kararı vermiyor, dönem adı
 * zaten serbest metin.
 */
export function DonemSihirbazi({
  atolyeler,
  stajyerler,
}: {
  atolyeler: AtolyeSecenegi[];
  stajyerler: StajyerSecenegi[];
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    donemOlustur,
    {},
  );

  const [gunDuzeni, setGunDuzeni] = useState<DayMode>("HAFTA_SONU");
  const [grupGunleri, setGrupGunleri] = useState<Day[]>(["CUMARTESI"]);

  const [baslangic, setBaslangic] = useState(() =>
    tarihMetni(haftaBasi(bugun())),
  );

  function duzeniDegistir(yeni: DayMode) {
    setGunDuzeni(yeni);
    // Eski düzenin günleri taşınmaz: hafta sonu döneminde salı grubu
    // olamayacağı için sunucu zaten reddederdi.
    setGrupGunleri(yeni === "HAFTA_SONU" ? ["CUMARTESI"] : ["PAZARTESI"]);
  }

  function grupGunuDegistir(gun: Day) {
    setGrupGunleri((oncekiler) =>
      oncekiler.includes(gun)
        ? oncekiler.filter((g) => g !== gun)
        : [...oncekiler, gun],
    );
  }
  const [secilenHaftalar, setSecilenHaftalar] = useState<string[]>([]);
  const [secilenAtolyeler, setSecilenAtolyeler] = useState<string[]>([]);
  const [secilenStajyerler, setSecilenStajyerler] = useState<string[]>([]);

  const haftalar = useMemo(() => {
    const baslangicTarihi = tarihCozumle(baslangic);
    if (!baslangicTarihi) return [];

    const ilkHafta = haftaBasi(baslangicTarihi);
    return Array.from({ length: GOSTERILEN_HAFTA_SAYISI }, (_, i) =>
      gunEkle(ilkHafta, i * 7),
    );
  }, [baslangic]);

  function haftaDegistir(metin: string) {
    setSecilenHaftalar((oncekiler) =>
      oncekiler.includes(metin)
        ? oncekiler.filter((h) => h !== metin)
        : [...oncekiler, metin],
    );
  }

  /**
   * Liste başlangıcı değişince pencere dışında kalan seçimler bırakılır.
   * Bırakılmasaydı görünmeyen haftalar seçili (ve gizli girdiyle gönderilir)
   * kalıyordu: sayaç "10/10" derken ekranda tek işaretli kutu olmayabiliyor,
   * kalan kutular da kota dolu diye kilitleniyordu — kullanıcı düzeltemezdi.
   */
  function baslangiciDegistir(deger: string) {
    setBaslangic(deger);
    const tarih = tarihCozumle(deger);
    if (!tarih) return;

    const ilkHafta = haftaBasi(tarih);
    const gorunurler = new Set(
      Array.from({ length: GOSTERILEN_HAFTA_SAYISI }, (_, i) =>
        tarihMetni(gunEkle(ilkHafta, i * 7)),
      ),
    );
    setSecilenHaftalar((oncekiler) =>
      oncekiler.filter((hafta) => gorunurler.has(hafta)),
    );
  }

  function atolyeDegistir(id: string) {
    setSecilenAtolyeler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((a) => a !== id)
        : [...oncekiler, id],
    );
  }

  function stajyerDegistir(id: string) {
    setSecilenStajyerler((oncekiler) =>
      oncekiler.includes(id)
        ? oncekiler.filter((s) => s !== id)
        : [...oncekiler, id],
    );
  }

  // Hafta sayısı SABİT DEĞİL: kurum 6 haftalık da 30 haftalık da program
  // açıyor ve müfredat buna göre kuruluyor. Tek şart en az bir hafta.
  const haftaTamam =
    secilenHaftalar.length >= EN_AZ_HAFTA &&
    secilenHaftalar.length <= EN_FAZLA_HAFTA;
  const atolyeTamam = secilenAtolyeler.length === DONEM_ATOLYE_SAYISI;

  // Neyin eksik olduğu tek yerde hesaplanıyor: aynı metin hem butonun
  // yanındaki uyarıda hem butonun üstüne gelince çıkan ipucunda kullanılıyor.
  // Yeterli aktif atölye çeşidi yoksa "N atölye daha seçin" demek yanıltıcı
  // olur: liste hiç çizilmiyor, kullanıcının seçebileceği bir şey yok.
  const atolyeYetersiz = atolyeler.length < DONEM_ATOLYE_SAYISI;

  const eksikMetni = [
    haftaTamam
      ? null
      : secilenHaftalar.length === 0
        ? "En az bir eğitim haftası seçin"
        : `En fazla ${EN_FAZLA_HAFTA} hafta seçilebilir`,
    atolyeTamam
      ? null
      : atolyeYetersiz
        ? "Önce yeterli sayıda aktif atölye çeşidi ekleyin"
        : `${DONEM_ATOLYE_SAYISI - secilenAtolyeler.length} atölye daha seçin`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Seçilen haftalar tarih sırasına konur; kullanıcı hangi sırayla
  // işaretlerse işaretlesin 1. hafta takvimdeki ilk hafta olmalı.
  const siraliHaftalar = [...secilenHaftalar].sort();

  return (
    <form action={eylem} className="space-y-6">
      {/* --- Dönem bilgileri --- */}
      <Kart className="space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Dönem bilgileri
        </h2>

        <Alan etiket="Dönem adı" hata={durum.alanHatalari?.name}>
          <Girdi
            name="name"
            placeholder="Örn. 2026 Sonbahar Dönemi"
            defaultValue={durum.degerler?.name}
            required
          />
        </Alan>

        <Alan
          etiket="Gün düzeni"
          ipucu="Takvimdeki haftalar ve grup gün listesi buna göre gösterilir. Dönem oluşturulduktan sonra değişmez."
          hata={durum.alanHatalari?.dayMode}
        >
          <select
            name="dayMode"
            value={gunDuzeni}
            onChange={(e) => duzeniDegistir(e.target.value as DayMode)}
            className={secimStili}
          >
            <option value="HAFTA_SONU">
              {GUN_DUZENI_ADLARI.HAFTA_SONU} (cumartesi–pazar)
            </option>
            <option value="HAFTA_ICI">
              {GUN_DUZENI_ADLARI.HAFTA_ICI} (pazartesi–cuma)
            </option>
          </select>
        </Alan>

        <Alan
          etiket="Açıklama"
          ipucu="İsteğe bağlı."
          hata={durum.alanHatalari?.description}
        >
          <CokSatirli
            name="description"
            rows={2}
            defaultValue={durum.degerler?.description}
          />
        </Alan>
      </Kart>

      {/* --- Eğitim haftaları --- */}
      <Kart className="space-y-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">
            Eğitim haftaları
          </h2>
          <span
            className={cn(
              "text-sm font-medium",
              haftaTamam ? "text-emerald-700" : "text-vurgu-700",
            )}
          >
            {secilenHaftalar.length} hafta seçildi
          </span>
        </div>

        <p className="text-sm text-zinc-600">
          Kaç hafta süreceğine siz karar verirsiniz — müfredat neyi
          gerektiriyorsa. Tatil ve ara verilecek hafta sonlarını
          işaretlemeyin; atlanan haftalar yüzünden takvim daha uzun sürebilir.
          Program açıldıktan sonra her grubun takvimi ayrı ayrı düzenlenebilir.
        </p>

        <Alan etiket="Listeyi şu tarihten başlat">
          <Girdi
            type="date"
            value={baslangic}
            onChange={(e) => baslangiciDegistir(e.target.value)}
            className="max-w-xs"
          />
        </Alan>

        <ul className="kil-oyuk grid max-h-80 gap-1 overflow-y-auto p-2 sm:grid-cols-2">
          {haftalar.map((haftaninBasi) => {
            const metin = tarihMetni(haftaninBasi);
            const secili = secilenHaftalar.includes(metin);
            // Yalnızca ÜST SINIRA dayanınca kilitlenir; seçili olanlar her
            // zaman kaldırılabilir.
            //
            // Burada eskiden `haftaTamam` kullanılıyordu ve o zaman "tam 10
            // hafta" demekti. Hafta sayısı serbest bırakılınca `haftaTamam`
            // "en az bir hafta" anlamına geldi ve bu satır ilk seçimden sonra
            // bütün listeyi kilitledi: kullanıcı tek hafta seçebiliyordu.
            const kilitli = !secili && secilenHaftalar.length >= EN_FAZLA_HAFTA;

            return (
              <li key={metin}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-full px-2 py-1.5 text-sm",
                    // Seçili hafta kile gömülür; seçilmemiş olan düz kalır.
                    secili
                      ? "kil-cip text-marka-700"
                      : kilitli
                        ? "cursor-not-allowed text-zinc-300"
                        : "text-zinc-700 hover:bg-marka-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={secili}
                    disabled={kilitli}
                    onChange={() => haftaDegistir(metin)}
                    className="size-4"
                  />
                  {haftaBicimle(haftaninBasi, gunDuzeni)}
                </label>
              </li>
            );
          })}
        </ul>

        {siraliHaftalar.map((metin) => (
          <input key={metin} type="hidden" name="tarihler" value={metin} />
        ))}
      </Kart>

      {/* --- Atölyeler --- */}
      <Kart className="space-y-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Atölyeler</h2>
          <span
            className={cn(
              "text-sm font-medium",
              atolyeTamam ? "text-emerald-700" : "text-vurgu-700",
            )}
          >
            {secilenAtolyeler.length} / {DONEM_ATOLYE_SAYISI} atölye seçildi
          </span>
        </div>

        <p className="text-sm text-zinc-600">
          Seçilen {DONEM_ATOLYE_SAYISI} atölye, dönemin bütün gruplarında ve{" "}
          {secilenHaftalar.length > 0
            ? `${secilenHaftalar.length} haftanın`
            : "seçtiğiniz haftaların"}{" "}
          tamamında uygulanır.
        </p>

        {atolyeler.length < DONEM_ATOLYE_SAYISI ? (
          <Bildirim tur="hata">
            Dönem açmak için en az {DONEM_ATOLYE_SAYISI} aktif atölye çeşidi
            gerekiyor; şu an {atolyeler.length} tane var.
          </Bildirim>
        ) : (
          <ul className="space-y-1">
            {atolyeler.map((atolye) => {
              const secili = secilenAtolyeler.includes(atolye.id);
              const kilitli = !secili && atolyeTamam;

              return (
                <li key={atolye.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-full px-2 py-1.5 text-sm",
                      // Seçili atölye kile gömülür; seçilmemiş olan düz kalır.
                      secili
                        ? "kil-cip text-marka-700"
                        : kilitli
                          ? "cursor-not-allowed text-zinc-300"
                          : "text-zinc-700 hover:bg-marka-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="atolyeler"
                      value={atolye.id}
                      checked={secili}
                      disabled={kilitli}
                      onChange={() => atolyeDegistir(atolye.id)}
                      className="size-4"
                    />
                    {atolye.name}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Kart>

      {/* --- Stajyerler --- */}
      <Kart className="space-y-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Stajyerler</h2>
          <span className="text-sm font-medium text-zinc-500">
            {secilenStajyerler.length} stajyer seçildi
          </span>
        </div>

        <p className="text-sm text-zinc-600">
          Bu dönemde görev alacak stajyerler. Öğrenci kaydı açılırken sorumlu
          stajyer bu kadrodan seçilir. İsteğe bağlıdır ve dönem sayfasından
          sonradan değiştirilebilir; kadro boş bırakılırsa bütün aktif
          stajyerler seçilebilir kalır.
        </p>

        {stajyerler.length === 0 ? (
          <Bildirim tur="bilgi">
            Aktif stajyer yok. Dönemi stajyersiz oluşturabilir, stajyer
            ekledikten sonra dönem sayfasından kadroyu belirleyebilirsiniz.
          </Bildirim>
        ) : (
          <ul className="space-y-1">
            {stajyerler.map((stajyer) => {
              const secili = secilenStajyerler.includes(stajyer.id);

              return (
                <li key={stajyer.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-full px-2 py-1.5 text-sm",
                      // Seçili stajyer kile gömülür; seçilmemiş olan düz kalır.
                      secili
                        ? "kil-cip text-marka-700"
                        : "text-zinc-700 hover:bg-marka-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="stajyerler"
                      value={stajyer.id}
                      checked={secili}
                      onChange={() => stajyerDegistir(stajyer.id)}
                      className="size-4"
                    />
                    <span className="flex-1">{stajyer.name}</span>
                    <span className="text-xs text-zinc-500">
                      {stajyer.aktifOgrenciSayisi} aktif öğrenci
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Kart>

      {/* --- İlk grup --- */}
      <Kart className="space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">İlk grup</h2>
        <p className="text-sm text-zinc-600">
          Dönemin ilk grubu. Kontenjan dolduğunda aynı döneme yeni gruplar
          eklenebilir.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Grup adı" hata={durum.alanHatalari?.["grup.name"]}>
            <Girdi
              name="grupAdi"
              placeholder="Örn. Cumartesi Sabah"
              defaultValue={durum.degerler?.grupAdi ?? "1. Grup"}
              required
            />
          </Alan>

          <Alan
            etiket="Kontenjan"
            hata={durum.alanHatalari?.["grup.capacity"]}
          >
            <Girdi
              name="grupKontenjani"
              type="number"
              min={1}
              max={200}
              defaultValue={durum.degerler?.grupKontenjani ?? 12}
              required
            />
          </Alan>

          <Alan
            etiket="Toplanma günleri"
            ipucu="Grup her toplanma gününde dönemin bütün atölyelerini yapar."
            hata={durum.alanHatalari?.["grup.days"]}
          >
            <div className="flex flex-wrap gap-1">
              {DUZEN_GUNLERI[gunDuzeni].map((gun) => {
                const secili = grupGunleri.includes(gun);
                return (
                  <label
                    key={gun}
                    className={cn(
                      "flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded-full px-2 py-2 text-sm sm:min-h-0 sm:py-1.5",
                      // Seçili gün kile gömülür; seçilmemiş olan düz kalır.
                      secili
                        ? "kil-cip text-marka-700"
                        : "text-zinc-700 hover:bg-marka-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="grupGunleri"
                      value={gun}
                      checked={secili}
                      onChange={() => grupGunuDegistir(gun)}
                      className="size-4"
                    />
                    {GUN_ADLARI[gun]}
                  </label>
                );
              })}
            </div>
          </Alan>

          <Alan
            etiket="Zaman dilimi"
            hata={durum.alanHatalari?.["grup.timeSlot"]}
          >
            <select
              name="grupZamanDilimi"
              defaultValue={durum.degerler?.grupZamanDilimi ?? "OGLEDEN_ONCE"}
              className={secimStili}
            >
              <option value="OGLEDEN_ONCE">Öğleden önce</option>
              <option value="OGLEDEN_SONRA">Öğleden sonra</option>
            </select>
          </Alan>
        </div>
      </Kart>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex flex-wrap items-center gap-3">
        <KaydetButonu
          etkin={haftaTamam && atolyeTamam}
          engelSebebi={eksikMetni}
        />
        {haftaTamam && atolyeTamam ? (
          /*
            Hafta sayısı artık serbest olduğu için kaydetmeden ÖNCE sayıyla
            teyit ettiriliyor: "10 hafta" varsayılan değil, kullanıcının
            seçimi. Yanlış sayıyla açılan bir dönemin oturumları üretildikten
            sonra düzeltmek tek tek gün taşımak demek.
          */
          <span className="text-sm text-zinc-700">
            <strong className="font-semibold">
              {secilenHaftalar.length} hafta
            </strong>{" "}
            seçtiniz — müfredat buna göre mi? {secilenHaftalar.length} hafta ×{" "}
            {grupGunleri.length} gün × {DONEM_ATOLYE_SAYISI} atölye ={" "}
            {secilenHaftalar.length * grupGunleri.length * DONEM_ATOLYE_SAYISI}{" "}
            atölye oturumu oluşturulacak.
          </span>
        ) : (
          /* Buton eksik seçimde kilitli. Genel bir ipucu ("10 hafta ve 5
             atölye seçin") yetmiyordu: kullanıcı zaten seçtiğini sanıp butonu
             bozuk sayıyor. Kaç tane eksik olduğu sayıyla yazılıyor. */
          <span className="text-sm font-medium text-vurgu-700">
            {eksikMetni}
          </span>
        )}
      </div>
    </form>
  );
}
