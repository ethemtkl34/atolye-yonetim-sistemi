"use client";

import { useState, useTransition } from "react";
import { Alan, Bildirim, Buton, CokSatirli, secimStili } from "@/components/ui";
import { IPTAL_SEBEPLERI, IPTAL_SEBEP_SIRASI } from "@/lib/kayit-iptal";
import {
  kayitIptalEt,
  kayitYenidenEtkinlestir,
  type EylemDurumu,
} from "@/app/koordinator/kayitlar/actions";

export type CikisGunu = {
  /** `YYYY-AA-GG` — sunucu grubun takviminde bu günü arar. */
  deger: string;
  etiket: string;
};

/**
 * Öğrenciyi programdan çıkarma ve geri alma.
 *
 * Çıkarma tek tık değil, küçük bir form: sebep etiketi ve son katıldığı gün
 * alınıyor. Onay kutusu (`window.confirm`) yerine form açılıyor, çünkü sorulan
 * şey "emin misiniz" değil "ne oldu" — cevabı da veritabanına yazılıyor.
 *
 * Geri alma tek tık kalıyor: hiçbir bilgi istemiyor ve zaten geri alınabilir.
 *
 * Ekranda "iptal" değil "çıkarma" yazıyor: kayıt satırı silinmiyor, öğrenci
 * programdan ayrılıyor. Veritabanı alanları (`status: IPTAL`, `cancelReason`)
 * eski adlarıyla duruyor; değiştirmek şema göçü demekti.
 */
export function KayitCikarButonu({
  kayitId,
  aktif,
  gunler,
  programTuru,
}: {
  kayitId: string;
  aktif: boolean;
  /** Grubun eğitim günleri — son katıldığı gün buradan seçilir. */
  gunler: CikisGunu[];
  /** Etiket buna göre yazılır: kulüp kaydında "dönem" demek yanlış olurdu. */
  programTuru: "Dönem" | "Kulüp";
}) {
  const [durum, setDurum] = useState<EylemDurumu>({});
  const [bekliyor, basla] = useTransition();
  const [acik, setAcik] = useState(false);

  const [sebep, setSebep] = useState("");
  const [sonGun, setSonGun] = useState("");
  const [aciklama, setAciklama] = useState("");

  const cikarEtiketi =
    programTuru === "Kulüp" ? "Kulüpten çıkar" : "Dönemden çıkar";

  function cikar() {
    basla(async () => {
      const sonuc = await kayitIptalEt(kayitId, { sebep, aciklama, sonGun });
      setDurum(sonuc);
      // Form yalnızca başarıda kapanır; hata varsa girilenler ekranda kalır.
      if (sonuc.basari) setAcik(false);
    });
  }

  function geriAl() {
    basla(async () => setDurum(await kayitYenidenEtkinlestir(kayitId)));
  }

  if (!aktif) {
    return (
      <div className="space-y-2">
        <Buton type="button" tur="ikincil" disabled={bekliyor} onClick={geriAl}>
          {bekliyor ? "İşleniyor…" : "Çıkarmayı geri al"}
        </Buton>
        {durum.basari ? (
          <Bildirim tur="basari">{durum.basari}</Bildirim>
        ) : null}
        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
      </div>
    );
  }

  if (!acik) {
    return (
      <div className="space-y-2">
        <Buton type="button" tur="tehlike" onClick={() => setAcik(true)}>
          {cikarEtiketi}
        </Buton>
        {durum.basari ? (
          <Bildirim tur="basari">{durum.basari}</Bildirim>
        ) : null}
        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-red-200 bg-red-50/40 p-3 sm:w-80">
      <div>
        <p className="text-sm font-medium text-red-800">{cikarEtiketi}</p>
        <p className="mt-1 text-xs text-zinc-600">
          Kayıt silinmez; girilmiş puanlamalar ve katılım geçmişi korunur,
          kontenjandan bir yer boşalır.
        </p>
      </div>

      <Alan etiket="Ayrılma sebebi" hata={durum.alanHatalari?.sebep}>
        <select
          value={sebep}
          onChange={(e) => setSebep(e.target.value)}
          className={secimStili}
        >
          <option value="">Seçin…</option>
          {IPTAL_SEBEP_SIRASI.map((kod) => (
            <option key={kod} value={kod}>
              {IPTAL_SEBEPLERI[kod]}
            </option>
          ))}
        </select>
      </Alan>

      <Alan
        etiket="Son katıldığı gün"
        ipucu="Bu günden sonraki atölyelere katılamamış sayılır."
        hata={durum.alanHatalari?.sonGun}
      >
        <select
          value={sonGun}
          onChange={(e) => setSonGun(e.target.value)}
          className={secimStili}
        >
          <option value="">Hiç katılmadı</option>
          {gunler.map((gun) => (
            <option key={gun.deger} value={gun.deger}>
              {gun.etiket}
            </option>
          ))}
        </select>
      </Alan>

      <Alan
        etiket="Açıklama"
        ipucu={
          sebep === "DIGER"
            ? "“Diğer” seçtiğiniz için zorunlu."
            : "İsteğe bağlı — örn. şehir değiştirdiler."
        }
        hata={durum.alanHatalari?.aciklama}
      >
        <CokSatirli
          rows={2}
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="Örn. Aile Ankara'ya taşındı."
        />
      </Alan>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Buton
          type="button"
          tur="tehlike"
          disabled={bekliyor || !sebep}
          engelSebebi={!sebep ? "Önce ayrılma sebebini seçin." : undefined}
          onClick={cikar}
        >
          {bekliyor ? "Çıkarılıyor…" : cikarEtiketi}
        </Buton>
        <Buton
          type="button"
          tur="sade"
          disabled={bekliyor}
          onClick={() => setAcik(false)}
        >
          Vazgeç
        </Buton>
      </div>
    </div>
  );
}
