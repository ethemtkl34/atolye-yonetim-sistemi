"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Alan,
  Bildirim,
  Buton,
  CokSatirli,
  Girdi,
  Kart,
} from "@/components/ui";
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
}: {
  eylem: (
    oncekiDurum: EylemDurumu,
    formVerisi: FormData,
  ) => Promise<EylemDurumu>;
  varsayilanlar?: OgrenciVarsayilanlari;
  kaydetEtiketi: string;
  iptalYolu: string;
}) {
  const [durum, formEylemi] = useActionState<EylemDurumu, FormData>(
    eylem,
    {},
  );
  const h = durum.alanHatalari;

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
              defaultValue={varsayilanlar.firstName}
              autoFocus
              required
            />
          </Alan>

          <Alan etiket="Soyad" hata={h?.lastName}>
            <Girdi
              name="lastName"
              defaultValue={varsayilanlar.lastName}
              required
            />
          </Alan>

          <Alan etiket="Doğum tarihi" ipucu="İsteğe bağlı." hata={h?.birthDate}>
            <Girdi
              name="birthDate"
              type="date"
              defaultValue={varsayilanlar.birthDate}
            />
          </Alan>

          <Alan etiket="Okul" ipucu="İsteğe bağlı." hata={h?.school}>
            <Girdi name="school" defaultValue={varsayilanlar.school} />
          </Alan>

          <Alan etiket="Sınıf" ipucu="İsteğe bağlı." hata={h?.grade}>
            <Girdi
              name="grade"
              defaultValue={varsayilanlar.grade}
              placeholder="3. sınıf"
            />
          </Alan>
        </div>

        <Alan etiket="Genel notlar" ipucu="İsteğe bağlı." hata={h?.notes}>
          <CokSatirli name="notes" rows={2} defaultValue={varsayilanlar.notes} />
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
            <Girdi name="anneAdi" defaultValue={varsayilanlar.anneAdi} />
          </Alan>

          <Alan etiket="Anne telefon" hata={h?.anneTelefon}>
            <Girdi
              name="anneTelefon"
              type="tel"
              inputMode="tel"
              placeholder="0532 111 22 33"
              defaultValue={varsayilanlar.anneTelefon}
            />
          </Alan>

          <Alan etiket="Baba ad soyad" hata={h?.babaAdi}>
            <Girdi name="babaAdi" defaultValue={varsayilanlar.babaAdi} />
          </Alan>

          <Alan etiket="Baba telefon" hata={h?.babaTelefon}>
            <Girdi
              name="babaTelefon"
              type="tel"
              inputMode="tel"
              placeholder="0533 444 55 66"
              defaultValue={varsayilanlar.babaTelefon}
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
            <CokSatirli name="alerji" rows={2} defaultValue={varsayilanlar.alerji} />
          </Alan>

          <Alan etiket="Düzenli kullanılan ilaç" hata={h?.ilac}>
            <CokSatirli name="ilac" rows={2} defaultValue={varsayilanlar.ilac} />
          </Alan>

          <Alan
            etiket="Özel eğitim veya destek ihtiyacı"
            hata={h?.ozelEgitim}
          >
            <CokSatirli
              name="ozelEgitim"
              rows={2}
              defaultValue={varsayilanlar.ozelEgitim}
            />
          </Alan>

          <Alan
            etiket="Kurumun bilmesi gereken sağlık durumu"
            hata={h?.saglikNotu}
          >
            <CokSatirli
              name="saglikNotu"
              rows={2}
              defaultValue={varsayilanlar.saglikNotu}
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
            defaultValue={varsayilanlar.acilDurum}
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
              defaultValue={varsayilanlar.stajyerUyarisi}
            />
          </Alan>
        </div>
      </Kart>

      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

      <div className="flex items-center gap-2">
        <KaydetButonu etiket={kaydetEtiketi} />
        <Link
          href={iptalYolu}
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
