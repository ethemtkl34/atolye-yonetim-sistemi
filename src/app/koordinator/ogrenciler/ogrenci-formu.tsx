"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  Kart,
  butonStili,
  secimStili,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ProgramSecenegi } from "@/lib/kayit-secenekleri";
import type { EylemDurumu } from "./actions";

export type OgrenciVarsayilanlari = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  school?: string;
  grade?: string;
  notes?: string;
  anneAdi?: string;
  anneTelefon?: string;
  babaAdi?: string;
  babaTelefon?: string;
  alerji?: string;
  ilac?: string;
  ozelEgitim?: string;
  saglikNotu?: string;
  acilDurum?: string;
  stajyerUyarisi?: string;
};

function KaydetButonu({ etiket }: { etiket: string }) {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : etiket}
    </Buton>
  );
}

/**
 * §6.1 — Öğrenci kayıt formu. Ekleme ve düzenleme aynı bileşeni kullanır;
 * tek fark hangi işlemin bağlandığı ve varsayılan değerler.
 */
export function OgrenciFormu({
  eylem,
  varsayilanlar = {},
  kaydetEtiketi,
  iptalYolu,
  programlar,
}: {
  eylem: (
    oncekiDurum: EylemDurumu,
    formVerisi: FormData,
  ) => Promise<EylemDurumu>;
  varsayilanlar?: OgrenciVarsayilanlari;
  kaydetEtiketi: string;
  iptalYolu: string;
  /**
   * Verilirse form sonuna isteğe bağlı "Program kaydı" bölümü eklenir ve
   * öğrenci kaydedilirken seçilen gruba da yazılır. Yalnızca YENİ öğrenci
   * ekranında geçilir; düzenlemede kayıt açmak yanlış yer olurdu, oradaki
   * kayıtlar öğrenci profilinden yönetiliyor.
   */
  programlar?: ProgramSecenegi[];
}) {
  const [durum, formEylemi] = useActionState<EylemDurumu, FormData>(
    eylem,
    {},
  );
  const h = durum.alanHatalari;

  // React 19 form eylemi bitince kontrolsüz alanları sıfırlar — doğrulama
  // hatasında da. Eylem girilen değerleri geri döndürür; burada varsayılanların
  // önüne konur ki 16 alanlık formda kullanıcının yazdıkları kaybolmasın.
  const deger = (alan: keyof OgrenciVarsayilanlari) =>
    durum.degerler?.[alan] ?? varsayilanlar[alan];

  const [programId, setProgramId] = useState("");
  const [grupId, setGrupId] = useState("");

  const secilenProgram = useMemo(
    () => programlar?.find((program) => program.id === programId),
    [programlar, programId],
  );
  const secilenGrup = useMemo(
    () => secilenProgram?.gruplar.find((grup) => grup.id === grupId),
    [secilenProgram, grupId],
  );

  /**
   * Seçim kutuları form sıfırlandıktan sonra durumdan geri yazılıyor.
   * Kayıt sihirbazındaki sorunun aynısı: React eylem bitince `<select>`
   * öğelerinin DOM değerini ilk seçeneğe düşürüyor, gönderilen değer ise
   * gizli alandan gittiği için ekran ile veri ayrışıyordu.
   */
  const programSecimi = useRef<HTMLSelectElement>(null);
  const grupSecimi = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (programSecimi.current) programSecimi.current.value = programId;
    if (grupSecimi.current) grupSecimi.current.value = grupId;
  }, [durum, programId, grupId]);

  return (
    <form action={formEylemi} className="space-y-6">
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}

      {/* --- Öğrenci --- */}
      <Kart className="space-y-4 p-4">
        <h2 className="text-base font-semibold text-zinc-900">Öğrenci</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Ad" hata={h?.firstName}>
            <Girdi
              name="firstName"
              defaultValue={deger("firstName")}
              autoFocus
              required
            />
          </Alan>

          <Alan etiket="Soyad" hata={h?.lastName}>
            <Girdi
              name="lastName"
              defaultValue={deger("lastName")}
              required
            />
          </Alan>

          <Alan etiket="Doğum tarihi" ipucu="İsteğe bağlı." hata={h?.birthDate}>
            <Girdi
              name="birthDate"
              type="date"
              defaultValue={deger("birthDate")}
            />
          </Alan>

          <Alan etiket="Okul" ipucu="İsteğe bağlı." hata={h?.school}>
            <Girdi name="school" defaultValue={deger("school")} />
          </Alan>

          <Alan etiket="Sınıf" ipucu="İsteğe bağlı." hata={h?.grade}>
            <Girdi
              name="grade"
              defaultValue={deger("grade")}
              placeholder="Örn. 3. sınıf"
            />
          </Alan>
        </div>

        <Alan etiket="Genel notlar" ipucu="İsteğe bağlı." hata={h?.notes}>
          <CokSatirli name="notes" rows={2} defaultValue={deger("notes")} />
        </Alan>
      </Kart>

      {/* --- Veliler --- */}
      <Kart className="space-y-4 p-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Anne ve baba bilgileri
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            En az bir ebeveynin telefon numarası zorunludur. Diğer ebeveyn
            bilgisi boş bırakılabilir.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Anne ad soyad" hata={h?.anneAdi}>
            <Girdi name="anneAdi" defaultValue={deger("anneAdi")} />
          </Alan>

          <Alan etiket="Anne telefon" hata={h?.anneTelefon}>
            <Girdi
              name="anneTelefon"
              type="tel"
              inputMode="tel"
              placeholder="Örn. 0532 111 22 33"
              defaultValue={deger("anneTelefon")}
            />
          </Alan>

          <Alan etiket="Baba ad soyad" hata={h?.babaAdi}>
            <Girdi name="babaAdi" defaultValue={deger("babaAdi")} />
          </Alan>

          <Alan etiket="Baba telefon" hata={h?.babaTelefon}>
            <Girdi
              name="babaTelefon"
              type="tel"
              inputMode="tel"
              placeholder="Örn. 0533 444 55 66"
              defaultValue={deger("babaTelefon")}
            />
          </Alan>
        </div>
      </Kart>

      {/* --- Sağlık --- */}
      <Kart className="space-y-4 p-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Sağlık ve özel durum
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Bu bölümdeki bilgiler yalnızca koordinatörlere görünür. Stajyerler
            aşağıdaki son alandaki kısa uyarı dışında hiçbirini göremez.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Alerji bilgisi" hata={h?.alerji}>
            <CokSatirli name="alerji" rows={2} defaultValue={deger("alerji")} />
          </Alan>

          <Alan etiket="Düzenli kullanılan ilaç" hata={h?.ilac}>
            <CokSatirli name="ilac" rows={2} defaultValue={deger("ilac")} />
          </Alan>

          <Alan
            etiket="Özel eğitim veya destek ihtiyacı"
            hata={h?.ozelEgitim}
          >
            <CokSatirli
              name="ozelEgitim"
              rows={2}
              defaultValue={deger("ozelEgitim")}
            />
          </Alan>

          <Alan
            etiket="Kurumun bilmesi gereken sağlık durumu"
            hata={h?.saglikNotu}
          >
            <CokSatirli
              name="saglikNotu"
              rows={2}
              defaultValue={deger("saglikNotu")}
            />
          </Alan>
        </div>

        <Alan
          etiket="Acil durumda uygulanması gerekenler"
          hata={h?.acilDurum}
        >
          <CokSatirli
            name="acilDurum"
            rows={2}
            defaultValue={deger("acilDurum")}
          />
        </Alan>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <Alan
            etiket="Stajyere gösterilecek kısa güvenlik uyarısı"
            ipucu="Stajyerin göreceği TEK sağlık bilgisi budur. Kısa ve uygulanabilir yazın; teşhis veya ayrıntılı sağlık geçmişi yazmayın."
            hata={h?.stajyerUyarisi}
          >
            <CokSatirli
              name="stajyerUyarisi"
              rows={2}
              placeholder="Fındık alerjisi bulunmaktadır. Gıda içeren etkinlik öncesinde koordinatörle iletişime geçiniz."
              defaultValue={deger("stajyerUyarisi")}
            />
          </Alan>
        </div>
      </Kart>

      {/* --- Program kaydı (yalnızca yeni öğrenci) --- */}
      {programlar ? (
        <Kart className="space-y-4 p-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Program kaydı{" "}
              <span className="font-normal text-zinc-500">(isteğe bağlı)</span>
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Öğrenciyi kaydederken doğrudan bir dönem veya kulüp grubuna da
              yazabilirsiniz. Boş bırakılırsa öğrenci yalnızca eklenir; kayıt
              sonradan profilinden ya da dönem sayfasından açılabilir. Sorumlu
              stajyer burada sorulmuyor, atama dönem başlarken yapılıyor.
            </p>
          </div>

          {programlar.length === 0 ? (
            <Bildirim tur="bilgi">
              Şu anda kayıt alan program yok. Öğrenci yine de kaydedilir;
              kaydını dönem &quot;Kayıt alıyor&quot; olunca açabilirsiniz.
            </Bildirim>
          ) : (
            <>
              {/* Seçim gizli alandan gider; yukarıdaki nota bakın. */}
              <input type="hidden" name="groupId" value={grupId} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Alan etiket="Program">
                  <select
                    ref={programSecimi}
                    value={programId}
                    onChange={(e) => {
                      setProgramId(e.target.value);
                      setGrupId("");
                    }}
                    className={secimStili}
                  >
                    <option value="">Kayıt açılmayacak</option>
                    {programlar.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.tur}: {program.ad}
                      </option>
                    ))}
                  </select>
                </Alan>

                <Alan etiket="Grup" hata={h?.groupId}>
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
                        {grup.ad} · {grup.zaman} · {grup.doluluk}/
                        {grup.kapasite}
                        {grup.dolu ? " (dolu)" : ""}
                        {!grup.aktif ? " (kapalı)" : ""}
                      </option>
                    ))}
                  </select>
                </Alan>
              </div>

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

                  {secilenGrup.baslangicHaftasi > 1 ? (
                    <p className="mt-2 text-xs text-vurgu-700">
                      Bu grup dönem başladıktan sonra açıldı;{" "}
                      {secilenGrup.baslangicHaftasi}. haftadan itibaren
                      katılıyor ve önceki haftalar telafi edilmiyor.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </Kart>
      ) : null}

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex items-center gap-2">
        <KaydetButonu etiket={kaydetEtiketi} />
        <Link
          href={iptalYolu}
          className={butonStili("ikincil")}
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
