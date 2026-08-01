"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Alan, Bildirim, Buton, Girdi, Kart, Rozet, secimStili } from "@/components/ui";
import { ROL_ADLARI } from "@/lib/roller";
import type { Role } from "@/generated/prisma/enums";
import {
  kullaniciAdiGuncelle,
  kullaniciDurumDegistir,
  kullaniciEkle,
  kullaniciParolaSifirla,
  kullaniciRolVeSubeGuncelle,
  type EylemDurumu,
} from "./actions";

export type SubeSecenegi = { id: string; ad: string };

export type KullaniciSatiri = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  subeId: string | null;
  subeAdi: string | null;
  aktifOgrenciSayisi: number;
  puanlamaSayisi: number;
};

const ROL_SECENEKLERI: readonly Role[] = ["ADMIN", "KOORDINATOR", "STAJYER"];

function GonderButonu({ etiket }: { etiket: string }) {
  const { pending } = useFormStatus();
  return (
    <Buton type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : etiket}
    </Buton>
  );
}

/** Rol rozetinin tonu: yönetici ayırt edilsin, pasif hesap geri çekilsin. */
function rolRozetTuru(role: Role): "notr" | "uyari" | "pasif" {
  if (role === "ADMIN") return "uyari";
  if (role === "KOORDINATOR") return "notr";
  return "pasif";
}

export function KullaniciYonetimi({
  kullanicilar,
  subeler,
  benimId,
}: {
  kullanicilar: KullaniciSatiri[];
  subeler: SubeSecenegi[];
  /** Oturumdaki yöneticinin kimliği — kendi satırında yıkıcı düğme çıkmaz. */
  benimId: string;
}) {
  const [mesaj, setMesaj] = useState<EylemDurumu | null>(null);
  const [bekliyor, basla] = useTransition();
  const [acikPanel, setAcikPanel] = useState<string | null>(null);

  const panelAc = (anahtar: string) =>
    setAcikPanel(acikPanel === anahtar ? null : anahtar);

  return (
    <div className="space-y-4">
      {mesaj?.basari ? <Bildirim tur="basari">{mesaj.basari}</Bildirim> : null}
      {mesaj?.hata ? <Bildirim tur="hata">{mesaj.hata}</Bildirim> : null}

      <KullaniciEkleFormu subeler={subeler} />

      <div className="space-y-2">
        {kullanicilar.map((kullanici) => {
          const benim = kullanici.id === benimId;

          return (
            <Kart key={kullanici.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">
                      {kullanici.name}
                    </span>
                    <Rozet tur={rolRozetTuru(kullanici.role)}>
                      {ROL_ADLARI[kullanici.role]}
                    </Rozet>
                    {/* Yöneticinin şubesi yok; boş rozet yerine ne olduğu
                        açıkça yazılıyor. */}
                    <Rozet tur="notr">
                      {kullanici.subeAdi ?? "Bütün şubeler"}
                    </Rozet>
                    {kullanici.active ? null : <Rozet tur="pasif">Pasif</Rozet>}
                    {benim ? <Rozet tur="olumlu">Siz</Rozet> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-600">
                    {kullanici.email}
                  </p>
                  {kullanici.role === "STAJYER" ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {kullanici.aktifOgrenciSayisi} aktif öğrenci ·{" "}
                      {kullanici.puanlamaSayisi} puanlama
                    </p>
                  ) : null}
                </div>

                {/* Telefonda düğmeler tam satıra iniyor: `shrink-0` yüzünden sıra
                    ekrandan taşıyor ve sayfa yana kayıyordu. */}
                <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:shrink-0">
                  <Buton
                    tur="sade"
                    disabled={bekliyor}
                    onClick={() => panelAc(`ad-${kullanici.id}`)}
                  >
                    Adı düzenle
                  </Buton>
                  <Buton
                    tur="sade"
                    disabled={bekliyor}
                    onClick={() => panelAc(`parola-${kullanici.id}`)}
                  >
                    Parola yenile
                  </Buton>
                  {/* Kendi rolünü ve durumunu değiştirmek kapalı: tek yönetici
                      kendini düşürüp paneli kilitleyebilirdi. Düğmeyi hiç
                      göstermemek, tıklayıp hata almaktan daha açık. */}
                  {benim ? null : (
                    <>
                      <Buton
                        tur="sade"
                        disabled={bekliyor}
                        onClick={() => panelAc(`rol-${kullanici.id}`)}
                      >
                        Rol ve şube
                      </Buton>
                      <Buton
                        tur="ikincil"
                        disabled={bekliyor}
                        onClick={() =>
                          basla(async () =>
                            setMesaj(await kullaniciDurumDegistir(kullanici.id)),
                          )
                        }
                      >
                        {kullanici.active ? "Pasife al" : "Aktifleştir"}
                      </Buton>
                    </>
                  )}
                </div>
              </div>

              {acikPanel === `ad-${kullanici.id}` ? (
                <div className="mt-4 border-t border-yuzey-100 pt-4">
                  <AdFormu
                    kullanici={kullanici}
                    kapat={() => setAcikPanel(null)}
                  />
                </div>
              ) : null}

              {acikPanel === `parola-${kullanici.id}` ? (
                <div className="mt-4 border-t border-yuzey-100 pt-4">
                  <ParolaFormu
                    kullaniciId={kullanici.id}
                    kapat={() => setAcikPanel(null)}
                  />
                </div>
              ) : null}

              {acikPanel === `rol-${kullanici.id}` ? (
                <div className="mt-4 border-t border-yuzey-100 pt-4">
                  <RolFormu
                    kullanici={kullanici}
                    subeler={subeler}
                    kapat={() => setAcikPanel(null)}
                  />
                </div>
              ) : null}
            </Kart>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Rol ve şube seçimi bir arada.
 *
 * Yönetici seçilince şube seçici gizleniyor — yöneticinin şubesi yok ve
 * seçilebilir bırakmak "yönetici + şube" gibi geçersiz bir kombinasyonu
 * mümkünmüş gibi gösterirdi. Sunucu tarafı da aynı kuralı uyguluyor.
 */
function RolSubeAlanlari({
  role,
  setRole,
  varsayilanSube,
  subeler,
  hatalar,
}: {
  role: Role;
  setRole: (yeni: Role) => void;
  varsayilanSube: string;
  subeler: SubeSecenegi[];
  hatalar?: Record<string, string>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Alan etiket="Rol" hata={hatalar?.role}>
        <select
          name="role"
          value={role}
          onChange={(olay) => setRole(olay.target.value as Role)}
          className={secimStili}
        >
          {ROL_SECENEKLERI.map((secenek) => (
            <option key={secenek} value={secenek}>
              {ROL_ADLARI[secenek]}
            </option>
          ))}
        </select>
      </Alan>

      {role === "ADMIN" ? (
        <Alan etiket="Şube">
          <p className="rounded-md border border-dashed border-yuzey-200 px-3 py-2 text-sm text-zinc-500">
            Yönetici bütün şubeleri görür; şube seçilmez.
          </p>
        </Alan>
      ) : (
        <Alan etiket="Şube" hata={hatalar?.branchId}>
          <select
            name="branchId"
            defaultValue={varsayilanSube}
            className={secimStili}
          >
            <option value="">Seçin…</option>
            {subeler.map((sube) => (
              <option key={sube.id} value={sube.id}>
                {sube.ad}
              </option>
            ))}
          </select>
        </Alan>
      )}
    </div>
  );
}

function KullaniciEkleFormu({ subeler }: { subeler: SubeSecenegi[] }) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    kullaniciEkle,
    {},
  );
  const [acik, setAcik] = useState(false);
  const [role, setRole] = useState<Role>("STAJYER");
  const [gorulen, setGorulen] = useState(durum.basari);

  // Başarılı kayıttan sonra form kapanır. React 19 form'u kendisi sıfırlıyor;
  // burada yalnızca panelin kapanması izleniyor (render sırasında durum
  // güncelleme deseni — efekt kullanmak derleyici kuralını ihlal ediyor).
  if (durum.basari !== gorulen) {
    setGorulen(durum.basari);
    if (durum.basari) setAcik(false);
  }

  if (!acik) {
    return (
      <div className="space-y-3">
        {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
        <Buton onClick={() => setAcik(true)}>Yeni kullanıcı ekle</Buton>
      </div>
    );
  }

  return (
    <Kart className="p-4">
      <form action={eylem} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Alan etiket="Ad soyad" hata={durum.alanHatalari?.name}>
            <Girdi
              name="name"
              defaultValue={durum.degerler?.name}
              autoFocus
              required
            />
          </Alan>

          <Alan etiket="E-posta" hata={durum.alanHatalari?.email}>
            <Girdi
              name="email"
              type="email"
              defaultValue={durum.degerler?.email}
              required
            />
          </Alan>
        </div>

        <RolSubeAlanlari
          role={role}
          setRole={setRole}
          varsayilanSube={durum.degerler?.branchId ?? ""}
          subeler={subeler}
          hatalar={durum.alanHatalari}
        />

        <Alan
          etiket="Başlangıç parolası"
          ipucu="En az 8 karakter. Kullanıcıya iletin ve ilk girişten sonra değiştirmesini isteyin."
          hata={durum.alanHatalari?.password}
        >
          <Girdi name="password" type="text" required minLength={8} />
        </Alan>

        {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}

        <div className="flex gap-2">
          <GonderButonu etiket="Kullanıcıyı ekle" />
          <Buton type="button" tur="ikincil" onClick={() => setAcik(false)}>
            Vazgeç
          </Buton>
        </div>
      </form>
    </Kart>
  );
}

function RolFormu({
  kullanici,
  subeler,
  kapat,
}: {
  kullanici: KullaniciSatiri;
  subeler: SubeSecenegi[];
  kapat: () => void;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    kullaniciRolVeSubeGuncelle.bind(null, kullanici.id),
    {},
  );
  const [role, setRole] = useState<Role>(kullanici.role);

  return (
    <form action={eylem} className="space-y-3">
      <RolSubeAlanlari
        role={role}
        setRole={setRole}
        varsayilanSube={kullanici.subeId ?? ""}
        subeler={subeler}
        hatalar={durum.alanHatalari}
      />
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      {durum.hata ? <Bildirim tur="hata">{durum.hata}</Bildirim> : null}
      <div className="flex gap-2">
        <GonderButonu etiket="Kaydet" />
        <Buton type="button" tur="ikincil" onClick={kapat}>
          Kapat
        </Buton>
      </div>
    </form>
  );
}

function AdFormu({
  kullanici,
  kapat,
}: {
  kullanici: KullaniciSatiri;
  kapat: () => void;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    kullaniciAdiGuncelle.bind(null, kullanici.id),
    {},
  );

  return (
    <form action={eylem} className="space-y-3">
      <Alan etiket="Ad soyad" hata={durum.alanHatalari?.name}>
        <Girdi name="name" defaultValue={kullanici.name} autoFocus />
      </Alan>
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      <div className="flex gap-2">
        <GonderButonu etiket="Kaydet" />
        <Buton type="button" tur="ikincil" onClick={kapat}>
          Kapat
        </Buton>
      </div>
    </form>
  );
}

function ParolaFormu({
  kullaniciId,
  kapat,
}: {
  kullaniciId: string;
  kapat: () => void;
}) {
  const [durum, eylem] = useActionState<EylemDurumu, FormData>(
    kullaniciParolaSifirla.bind(null, kullaniciId),
    {},
  );

  return (
    <form action={eylem} className="space-y-3">
      <Alan
        etiket="Yeni parola"
        ipucu="En az 8 karakter."
        hata={durum.alanHatalari?.password}
      >
        <Girdi name="password" type="text" autoFocus required minLength={8} />
      </Alan>
      {durum.basari ? <Bildirim tur="basari">{durum.basari}</Bildirim> : null}
      <div className="flex gap-2">
        <GonderButonu etiket="Parolayı yenile" />
        <Buton type="button" tur="ikincil" onClick={kapat}>
          Kapat
        </Buton>
      </div>
    </form>
  );
}
