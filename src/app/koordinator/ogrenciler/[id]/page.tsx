import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { SayfaBasligi, baglantiStili, butonStili, geriBaglantiStili } from "@/components/ui";
import {
  Bilgi,
  ProfilKayitListesi,
  VeliHucresi,
} from "./profil-kartlari";
import type { CikisGunu } from "@/components/kayit-cikar-butonu";
import { ProfilKutusu } from "./profil-kutulari";
import {
  raporKapsamSecenekleri,
  raporOzetleri,
} from "@/lib/rapor-verisi";
import { RaporBolumu } from "./rapor-bolumu";
import { GelisimBolumu } from "@/components/gelisim-bolumu";
import { gelisimListesi } from "@/lib/gelisim-verisi";
import { StajyerAtamalari, type AtamaKaydi } from "./stajyer-atamalari";
import {
  TerapiGorusmeleriBolumu,
  type TerapiGorusmesiSatiri,
} from "@/components/terapi-gorusmeleri-bolumu";
import {
  VeliGorusmeleriBolumu,
  type VeliGorusmesiSatiri,
} from "@/components/veli-gorusmeleri-bolumu";
import type { MiniTestCevabi, VeliBriefi } from "@/lib/veli-gorusmesi";
import {
  ZekaTestleriBolumu,
  type ZekaTestiSatiri,
} from "@/components/zeka-testleri-bolumu";
import {
  AKTIF_DONEM_DURUMLARI,
  AKTIF_KULUP_DURUMLARI,
} from "@/lib/durumlar";
import { bugun, tarihBicimle, tarihMetni, yasBicimle } from "@/lib/tarih";

export async function generateMetadata(
  props: PageProps<"/koordinator/ogrenciler/[id]">,
): Promise<Metadata> {
  // Sekme başlığı da şubeye kapalı: başka şubenin öğrenci id'si yapıştırılınca
  // sayfa 404 verirken başlıkta çocuğun adının görünmesi sızıntıdır.
  // `yonetimZorunlu` istek başına önbellekli, ek sorgu maliyeti yok.
  const kullanici = await yonetimZorunlu("ogrenciler");
  const { id } = await props.params;
  const ogrenci = await db.student.findFirst({
    where: { id, branchId: kullanici.aktifSubeId },
    select: { firstName: true, lastName: true },
  });
  return {
    title: ogrenci ? `${ogrenci.firstName} ${ogrenci.lastName}` : "Öğrenci",
  };
}

/**
 * §6.3 — Öğrenci profili.
 *
 * Sayfa iki kata ayrıldı: üstte HER ZAMAN görünen operasyonel kat (özet
 * kartı, aktif kayıtlar, görüşmeler, raporlar), altta KAPALI başlayan arşiv
 * katı (genel bilgiler, veliler, sağlık, geçmiş kayıtlar, stajyer atamaları).
 * Önceki düzende sekiz bölüm alt alta ~5 ekran boyu tutuyordu ve koordinatör
 * her seferinde aynı uzun sayfayı kaydırıyordu; oysa günlük iş ilk kattaki
 * dört bölümde geçiyor.
 */
export default async function OgrenciProfilSayfasi(
  props: PageProps<"/koordinator/ogrenciler/[id]">,
) {
  const kullanici = await yonetimZorunlu("ogrenciler");
  const subeId = kullanici.aktifSubeId;
  const { id } = await props.params;

  // SORGU DİSİPLİNİ (stajyer gizliliğindeki kuralın aynısı): yetkisi olmayan
  // bölümün verisi arayüzde gizlenmez, SORGUSU HİÇ ATILMAZ. Danışma görevlisi
  // bu sayfayı açabilir (öğrenciler TAM) ama görüşmeler, raporlar ve zeka
  // testi belgeleri onun için select/include listesine hiç girmez.
  const gorusmeGorebilir = kullanici.yetkiler.danismanlik !== "YOK";
  // Veli görüşmesi bu sayfadan da eklenebiliyor; ekleme formu yazma yetkisi
  // olmayana çizilmez (sunucu eylemi ayrıca `TAM` istiyor).
  const gorusmeYazabilir = kullanici.yetkiler.danismanlik === "TAM";
  const raporGorebilir = kullanici.yetkiler.raporlar !== "YOK";
  const zekaTestiYetkisi = kullanici.yetkiler.zekaTestleri;
  const puanlamaGorebilir = kullanici.yetkiler.puanlamalar !== "YOK";
  // Programdan çıkarma düğmesi burada yaşıyor (ayrı "Öğrenci kayıtları" ekranı
  // menüden kaldırıldı). Yetki kaydın kendi modülünden okunur; düğme yoksa
  // sunucu eylemi de zaten `kayitlar: TAM` istiyor.
  const kayitCikarabilir = kullanici.yetkiler.kayitlar === "TAM";

  // `?rapor=<id>` veya `?rapor=yeni` ile rapor penceresi doğrudan açılabilir;
  // dashboard'dan ve eski rapor adreslerinden gelen bağlantılar bunu kullanır.
  const parametreler = await props.searchParams;
  const acilisRaporu =
    typeof parametreler.rapor === "string" ? parametreler.rapor : undefined;

  const ogrenci = await db.student.findFirst({
    where: { id, branchId: subeId },
    include: {
      guardians: true,
      healthInfo: true,
      enrollments: {
        orderBy: { createdAt: "desc" },
        include: {
          intern: { select: { name: true, active: true } },
          // İptal özetindeki atölye sayıları buradan türetiliyor; iptal anında
          // ayrıca saklanmıyor (bkz. `atolyeOzeti`).
          _count: { select: { scores: { where: { attended: true } } } },
          group: {
            include: {
              _count: { select: { sessions: true } },
              term: {
                select: {
                  name: true,
                  status: true,
                  // Dönem kadrosu: atama seçenekleri buna göre süzülür.
                  // Dönem iki şubede ortak olduğu için kadro da iki şubenin
                  // stajyerlerini birlikte tutuyor; kendi şubemizinkiler
                  // ayıklanmazsa diğer şubenin stajyeri atanabilir hâle gelir.
                  interns: {
                    where: { user: { branchId: subeId } },
                    select: { userId: true },
                  },
                },
              },
              club: { select: { name: true, status: true, date: true } },
            },
          },
        },
      },
    },
  });

  if (!ogrenci) notFound();

  const [
    raporlar,
    kapsamKayitlari,
    aktifStajyerler,
    gorusmeKayitlari,
    veliGorusmeKayitlari,
    zekaTestiKayitlari,
    gelisimKayitlari,
    oturumGunleri,
  ] = await Promise.all([
      raporGorebilir ? raporOzetleri({ subeId, ogrenciId: id }) : [],
      // Yeni rapor penceresinin kapsam seçenekleri; küçük bir liste olduğu için
      // pencere açılmasa da peşinen okunuyor.
      raporGorebilir ? raporKapsamSecenekleri(id, subeId) : [],
      db.user.findMany({
        where: { roles: { has: "STAJYER" }, active: true, branchId: subeId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      // GİZLİLİK: görüşmeler stajyerden VE danışmanlık yetkisi olmayan
      // rollerden gizlidir; yetki yoksa sorgu hiç atılmaz.
      gorusmeGorebilir
        ? db.counselingSession.findMany({
            where: { studentId: id, student: { branchId: subeId } },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            include: { createdBy: { select: { name: true } } },
          })
        : [],
      // GİZLİLİK: veli görüşmeleri de aynı kurala tabidir.
      gorusmeGorebilir
        ? db.parentMeeting.findMany({
            where: { studentId: id, student: { branchId: subeId } },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            include: { createdBy: { select: { name: true } } },
          })
        : [],
      // GİZLİLİK: zeka testleri de sağlık bilgisi kuralına tabi. `fileData`
      // seçilmiyor — belge yalnızca indirme rotasından okunur.
      zekaTestiYetkisi !== "YOK"
        ? db.intelligenceTest.findMany({
            where: { studentId: id, student: { branchId: subeId } },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              studentId: true,
              date: true,
              testName: true,
              notes: true,
              fileName: true,
              mimeType: true,
              fileSize: true,
              createdAt: true,
              createdBy: { select: { name: true } },
            },
          })
        : [],
      // Gelişim testleri puanlama yetkisine tabi; iptal kayıtlar da dahil —
      // doldurulmuş bir test kayıt iptal edildi diye görünmez olmamalı.
      puanlamaGorebilir ? gelisimListesi({ subeId, studentId: id }) : [],
      // "Son katıldığı gün" listesi grubun KENDİ takviminden gelir; serbest
      // tarih kabul edilseydi hafta numarası tahmin edilmek zorunda kalırdı.
      // Çıkarma yetkisi yoksa düğme çizilmiyor, sorgu da hiç atılmıyor.
      kayitCikarabilir && ogrenci.enrollments.length > 0
        ? db.session.findMany({
            where: {
              groupId: {
                in: [...new Set(ogrenci.enrollments.map((k) => k.groupId))],
              },
              group: { branchId: subeId },
            },
            distinct: ["groupId", "date"],
            orderBy: { date: "asc" },
            select: { groupId: true, date: true, weekNumber: true },
          })
        : [],
    ]);

  /** Grup id → grubun eğitim günleri. Kayıt başına sorgu açmamak için tek seferde. */
  const gruplarinGunleri = new Map<string, CikisGunu[]>();
  for (const oturum of oturumGunleri) {
    const liste = gruplarinGunleri.get(oturum.groupId) ?? [];
    liste.push({
      deger: tarihMetni(oturum.date),
      etiket:
        oturum.weekNumber === null
          ? `Telafi günü · ${tarihBicimle(oturum.date)}`
          : `${oturum.weekNumber}. hafta · ${tarihBicimle(oturum.date)}`,
    });
    gruplarinGunleri.set(oturum.groupId, liste);
  }

  const ogrenciAdi = `${ogrenci.firstName} ${ogrenci.lastName}`;

  const gorusmeler: TerapiGorusmesiSatiri[] = gorusmeKayitlari.map(
    (gorusme) => ({
      id: gorusme.id,
      ogrenciAdi,
      tarih: gorusme.date,
      gorusmeciAdi: gorusme.counselorName,
      tur: gorusme.counselorType,
      terapiTuru: gorusme.therapyType,
      not: gorusme.notes,
      ekleyen: gorusme.createdBy?.name ?? null,
      eklenmeTarihi: gorusme.createdAt,
    }),
  );

  const veliGorusmeleri: VeliGorusmesiSatiri[] = veliGorusmeKayitlari.map(
    (gorusme) => ({
      id: gorusme.id,
      ogrenciAdi,
      tarih: gorusme.date,
      gorusmeciAdi: gorusme.interviewerName,
      cevaplar: gorusme.answersJson as unknown as MiniTestCevabi[],
      brief: gorusme.briefJson as unknown as VeliBriefi,
      not: gorusme.note,
      notGuncellemeZamani: gorusme.noteUpdatedAt,
      ekleyen: gorusme.createdBy?.name ?? null,
      eklenmeTarihi: gorusme.createdAt,
    }),
  );

  const zekaTestleri: ZekaTestiSatiri[] = zekaTestiKayitlari.map((test) => ({
    id: test.id,
    ogrenciAdi,
    tarih: test.date,
    testAdi: test.testName,
    not: test.notes,
    dosyaAdi: test.fileName,
    mime: test.mimeType,
    boyut: test.fileSize,
    ekleyen: test.createdBy?.name ?? null,
    eklenmeTarihi: test.createdAt,
  }));

  /**
   * §8 — Atama satırları. Dönem kadrosu tanımlıysa seçenekler kadroyla
   * sınırlanır; sunucu eylemi de aynı kuralı uyguladığı için burada
   * gösterilmeyen bir stajyer zaten atanamaz.
   */
  const atamaKayitlari: AtamaKaydi[] = ogrenci.enrollments.map((kayit) => {
    const kadro = kayit.group.term?.interns ?? [];
    const kadroluMu = kadro.length > 0;
    const secenekler = kadroluMu
      ? aktifStajyerler.filter((stajyer) =>
          kadro.some((satir) => satir.userId === stajyer.id),
        )
      : aktifStajyerler;

    return {
      kayitId: kayit.id,
      programAdi:
        kayit.group.term?.name ?? kayit.group.club?.name ?? "Program",
      grupAdi: kayit.group.name,
      aktif: kayit.status === "AKTIF",
      stajyerId: kayit.internId,
      stajyerAdi: kayit.intern?.name ?? null,
      stajyerPasif: Boolean(kayit.intern && !kayit.intern.active),
      secenekler: secenekler.map((stajyer) => ({
        id: stajyer.id,
        ad: stajyer.name,
      })),
      kadroUyarisi:
        kadroluMu && secenekler.length === 0
          ? `"${kayit.group.term?.name}" döneminin kadrosunda aktif stajyer yok. Stajyerin sayfasından bu döneme ekleyin.`
          : null,
    };
  });

  const anne = ogrenci.guardians.find((v) => v.type === "ANNE");
  const baba = ogrenci.guardians.find((v) => v.type === "BABA");
  const saglik = ogrenci.healthInfo;

  const saglikSatirlari = [
    { etiket: "Alerji", deger: saglik?.allergies },
    { etiket: "Düzenli kullanılan ilaç", deger: saglik?.medications },
    { etiket: "Özel eğitim / destek", deger: saglik?.specialEducation },
    { etiket: "Sağlık durumu", deger: saglik?.healthNotes },
    { etiket: "Acil durum", deger: saglik?.emergencyInfo },
  ].filter((satir) => satir.deger);

  // Aktiflik ölçütü dashboard ve liste ekranlarıyla aynı yerden okunur;
  // burada ikinci bir tanım yazılsaydı zamanla ayrışırdı (P11).
  const aktifKayitlar = ogrenci.enrollments.filter(
    (kayit) =>
      kayit.status === "AKTIF" &&
      (kayit.group.term
        ? AKTIF_DONEM_DURUMLARI.includes(kayit.group.term.status)
        : kayit.group.club
          ? AKTIF_KULUP_DURUMLARI.includes(kayit.group.club.status)
          : false),
  );
  const gecmisKayitlar = ogrenci.enrollments.filter(
    (kayit) => !aktifKayitlar.includes(kayit),
  );

  // Kutu altyazıları: kutu açılmadan "içeride ne var" sorusuna cevap veren
  // tek satır. Tarihler en yeni kayıttan geliyor (listeler zaten tarih desc).
  // Veli görüşmesi formunun varsayılan tarihi — sunucuda üretilir ki
  // istemcinin saat dilimi günü kaydırmasın (Danışmanlık sayfasıyla aynı).
  const bugunMetni = tarihMetni(bugun());

  const sonTerapi = gorusmeler[0]?.tarih;
  const sonVeliGorusmesi = veliGorusmeleri[0]?.tarih;
  const sonZekaTesti = zekaTestleri[0]?.tarih;
  const aktifAtamaSayisi = atamaKayitlari.filter(
    (a) => a.aktif && a.stajyerId,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/koordinator/ogrenciler"
          className={geriBaglantiStili}
        >
          ← Öğrenciler
        </Link>
        <div className="mt-2">
          <SayfaBasligi
            baslik={`${ogrenci.firstName} ${ogrenci.lastName}`}
            aksiyon={
              <Link
                href={`/koordinator/ogrenciler/${ogrenci.id}/duzenle`}
                className={butonStili("ikincil")}
              >
                Bilgileri düzenle
              </Link>
            }
          />
        </div>

        {/* Özet çipleri: eski özet kartının yerine — aramadan görülmesi
            gereken bilgi. Veli telefonları tıklanabilir, koordinatör en çok
            aileyi arıyor. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ogrenci.birthDate ? (
            <span className="kil-cip px-3.5 py-1.5 text-xs font-semibold text-zinc-700">
              {yasBicimle(ogrenci.birthDate, bugun())}
            </span>
          ) : null}
          {ogrenci.school || ogrenci.grade ? (
            <span className="kil-cip px-3.5 py-1.5 text-xs font-semibold text-zinc-700">
              {[ogrenci.school, ogrenci.grade].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          {[
            { etiket: "Anne", veli: anne },
            { etiket: "Baba", veli: baba },
          ].map(({ etiket, veli }) =>
            veli ? (
              <span
                key={etiket}
                className="kil-cip px-3.5 py-1.5 text-xs font-semibold text-zinc-700"
              >
                {etiket}: {veli.fullName}
                {veli.phone ? (
                  <>
                    {" · "}
                    <a
                      href={`tel:${veli.phone}`}
                      className="text-marka-700 hover:underline"
                    >
                      {veli.phone}
                    </a>
                  </>
                ) : null}
              </span>
            ) : null,
          )}
        </div>

        {saglik?.internSafetyNote ? (
          <div className="kil-uyari mt-4 max-w-2xl px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase">
              Güvenlik uyarısı (stajyerler de görür)
            </p>
            <p className="mt-0.5 text-sm text-amber-900">
              {saglik.internSafetyNote}
            </p>
          </div>
        ) : null}
      </div>

      {/* --- Kutu ızgarası: her bölüm bir kutu, ayrıntı pencerede. Yetki
          kuralları aynen sürüyor: yetkisiz bölümün kutusu HİÇ çizilmez
          (sorgusu da yukarıda hiç atılmıyor). --- */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <ProfilKutusu
          renk="kayit"
          baslik="Aktif kayıtlar"
          altyazi={
            aktifKayitlar.length > 0
              ? `${aktifKayitlar.length} program devam ediyor`
              : "Aktif kayıt yok"
          }
          adet={aktifKayitlar.length}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link
                href={`/koordinator/kayitlar/yeni?studentId=${ogrenci.id}`}
                className={baglantiStili}
              >
                + Yeni kayıt
              </Link>
              <Link
                href={`/koordinator/ogrenciler/${ogrenci.id}/gecmis`}
                className={baglantiStili}
              >
                Katılım geçmişi
              </Link>
              {puanlamaGorebilir ? (
                <Link
                  href={`/koordinator/ogrenciler/${ogrenci.id}/puanlamalar`}
                  className={baglantiStili}
                >
                  Puanlamalar
                </Link>
              ) : null}
            </div>
            <ProfilKayitListesi
              kayitlar={aktifKayitlar}
              bosAciklama="Öğrencinin kayıt alan veya devam eden bir programda aktif kaydı yok."
              cikarilabilir={kayitCikarabilir}
              gruplarinGunleri={gruplarinGunleri}
            />
          </div>
        </ProfilKutusu>

        {/* Görüşme kutuları danışmanlık yetkisine tabi. Veli görüşmesi bu
            kutudan da açılabilir (öğrenci zaten belli, seçici çizilmez);
            terapi görüşmeleri salt okunur, Danışmanlık sayfasından girilir. */}
        {gorusmeGorebilir ? (
          <>
            <ProfilKutusu
              renk="veli"
              baslik="Veli görüşmeleri"
              altyazi={
                sonVeliGorusmesi
                  ? `Son: ${tarihBicimle(sonVeliGorusmesi)}`
                  : "Henüz kayıt yok"
              }
              adet={veliGorusmeleri.length}
            >
              <VeliGorusmeleriBolumu
                mod={gorusmeYazabilir ? "yonetim" : "okuma"}
                gorusmeler={veliGorusmeleri}
                sabitOgrenci={{ id: ogrenci.id, ad: ogrenciAdi }}
                bugunMetni={bugunMetni}
              />
            </ProfilKutusu>
            <ProfilKutusu
              renk="terapi"
              baslik="Terapi görüşmeleri"
              altyazi={
                sonTerapi ? `Son: ${tarihBicimle(sonTerapi)}` : "Henüz kayıt yok"
              }
              adet={gorusmeler.length}
            >
              <TerapiGorusmeleriBolumu mod="okuma" gorusmeler={gorusmeler} />
            </ProfilKutusu>
          </>
        ) : null}

        {zekaTestiYetkisi !== "YOK" ? (
          <ProfilKutusu
            renk="zeka"
            baslik="Zeka testleri"
            altyazi={
              sonZekaTesti
                ? `Son: ${tarihBicimle(sonZekaTesti)}`
                : "Belge yüklenmedi"
            }
            adet={zekaTestleri.length}
          >
            <ZekaTestleriBolumu
              mod={zekaTestiYetkisi === "LISTE" ? "liste" : "okuma"}
              testler={zekaTestleri}
            />
          </ProfilKutusu>
        ) : null}

        {raporGorebilir ? (
          <ProfilKutusu
            renk="rapor"
            baslik="Raporlar"
            altyazi={
              raporlar.length > 0
                ? `${raporlar.length} rapor`
                : "Henüz rapor yok"
            }
            adet={raporlar.length}
            // `?rapor=` derin bağlantısı: rapor penceresi bu kutunun içinde
            // açıldığı için önce kutunun kendisi açılmalı.
            baslangictaAcik={Boolean(acilisRaporu)}
          >
            <RaporBolumu
              ogrenciId={ogrenci.id}
              ogrenciAdi={`${ogrenci.firstName} ${ogrenci.lastName}`}
              raporlar={raporlar}
              kapsamKayitlari={kapsamKayitlari}
              acilisParametresi={acilisRaporu}
            />
          </ProfilKutusu>
        ) : null}

        {puanlamaGorebilir ? (
          <ProfilKutusu
            renk="gelisim"
            baslik="Gelişim testleri"
            altyazi={
              gelisimKayitlari.length > 0
                ? `${gelisimKayitlari.length} kayıt`
                : "Henüz form yok"
            }
            adet={gelisimKayitlari.length}
          >
            <GelisimBolumu kayitlar={gelisimKayitlari} />
          </ProfilKutusu>
        ) : null}

        <ProfilKutusu
          renk="genel"
          baslik="Genel bilgiler"
          altyazi="Okul · sınıf · veliler"
        >
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Bilgi
                etiket="Doğum tarihi"
                deger={
                  ogrenci.birthDate ? tarihBicimle(ogrenci.birthDate) : null
                }
              />
              <Bilgi etiket="Okul" deger={ogrenci.school} />
              <Bilgi etiket="Sınıf" deger={ogrenci.grade} />
            </dl>
            <dl className="grid gap-3 sm:grid-cols-2">
              <VeliHucresi etiket="Anne" veli={anne} />
              <VeliHucresi etiket="Baba" veli={baba} />
            </dl>
            {ogrenci.notes ? (
              <div>
                <p className="text-sm text-zinc-500">Notlar</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-800">
                  {ogrenci.notes}
                </p>
              </div>
            ) : null}
          </div>
        </ProfilKutusu>

        <ProfilKutusu
          renk="saglik"
          baslik="Sağlık · özel durum"
          altyazi="Stajyerlere kapalı"
        >
          {saglikSatirlari.length === 0 ? (
            <p className="text-sm text-zinc-500">Kayıtlı sağlık bilgisi yok.</p>
          ) : (
            <dl className="space-y-3">
              {saglikSatirlari.map((satir) => (
                <div key={satir.etiket}>
                  <dt className="text-sm text-zinc-500">{satir.etiket}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-800">
                    {satir.deger}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </ProfilKutusu>

        <ProfilKutusu
          renk="gecmis"
          baslik="Geçmiş kayıtlar"
          altyazi={
            gecmisKayitlar.length > 0
              ? "Tamamlanan ve ayrılan kayıtlar"
              : "Geçmiş kayıt yok"
          }
          adet={gecmisKayitlar.length}
        >
          <ProfilKayitListesi
            kayitlar={gecmisKayitlar}
            bosAciklama="Tamamlanmış veya ayrılınmış kayıt yok."
            cikarilabilir={kayitCikarabilir}
            gruplarinGunleri={gruplarinGunleri}
          />
        </ProfilKutusu>

        <ProfilKutusu
          renk="stajyer"
          baslik="Stajyer atamaları"
          altyazi={
            aktifAtamaSayisi > 0
              ? `${aktifAtamaSayisi} aktif atama`
              : "Atama yok"
          }
        >
          <StajyerAtamalari kayitlar={atamaKayitlari} />
        </ProfilKutusu>
      </div>
    </div>
  );
}
