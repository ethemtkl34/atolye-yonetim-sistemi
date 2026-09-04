import type { Metadata } from "next";
import Link from "next/link";
import { yonetimZorunlu } from "@/lib/yetki-kapisi";
import { ogrenciAra } from "@/lib/ogrenci-arama";
import { Bildirim, BosDurum, Girdi, Kart, SayfaBasligi, baglantiStili, butonStili } from "@/components/ui";
import { SuzgecCubugu, SuzgecGrubu } from "@/components/suzgec";
import { Sayfalama, sayfaNumarasiCoz } from "@/components/sayfalama";
import { tarihBicimle } from "@/lib/tarih";

export const metadata: Metadata = {
  title: "Öğrenciler",
};

const TEMEL_YOL = "/koordinator/ogrenciler";

/**
 * Bir sayfada gösterilen öğrenci sayısı.
 *
 * Liste eskiden 200'lük TEK bir dilimdi ve sınıra dayandığında "aramayı
 * daraltın" diyordu. Geçmiş veri aktarımıyla kurumun öğrenci sayısı o sınırı
 * aştı; 200 kartı tek sayfada çizmek hem telefonda okunmuyor hem de listenin
 * sonundaki öğrencilere hiç ulaşılamıyordu.
 */
const SAYFA_BOYUTU = 25;

/**
 * §6.2 — Öğrenci arama ve liste.
 *
 * Arama kutusu sıradan bir GET formu: sorgu adres satırında durur, sonuç
 * sayfası paylaşılabilir ve geri tuşu beklendiği gibi çalışır. Bunun için
 * istemci tarafında durum tutmaya gerek yok.
 */
export default async function OgrencilerSayfasi(
  props: PageProps<"/koordinator/ogrenciler">,
) {
  const kullanici = await yonetimZorunlu("ogrenciler");

  const parametreler = await props.searchParams;
  const sorgu = typeof parametreler.q === "string" ? parametreler.q : "";
  const kapsam = parametreler.kapsam === "aktif" ? "aktif" : "tumu";
  // Silme öğrencinin kendi sayfasında gerçekleşiyor ve oradan buraya
  // dönülüyor; sonucu söyleyecek başka bir yer kalmıyor.
  const silinen =
    typeof parametreler.silinen === "string" ? parametreler.silinen : "";

  const istenenSayfa = sayfaNumarasiCoz(parametreler.sayfa);

  const ara = (sayfa: number) =>
    ogrenciAra(sorgu, {
      subeId: kullanici.aktifSubeId,
      kapsam,
      enFazla: SAYFA_BOYUTU,
      atla: (sayfa - 1) * SAYFA_BOYUTU,
    });

  const ilkSonuc = await ara(istenenSayfa);
  const sayfaSayisi = Math.max(1, Math.ceil(ilkSonuc.toplam / SAYFA_BOYUTU));

  // Yer imine alınmış ya da elle yazılmış bir sayfa numarası artık var
  // olmayabilir (öğrenci silindi, arama daraldı). O sayfanın sorgusu boş
  // döner; boş liste göstermek yerine SON SAYFA yeniden çekilir. Ek sorgu
  // yalnızca bu nadir durumda çalışır.
  const sayfa = Math.min(istenenSayfa, sayfaSayisi);
  const kaydiTasti = istenenSayfa > sayfaSayisi;
  const { ogrenciler, toplam } = kaydiTasti ? await ara(sayfa) : ilkSonuc;

  // Sayfa bağlantılarında korunacak süzgeçler — `sayfa` bilerek YOK.
  const suzgecler: Record<string, string> = {
    ...(sorgu ? { q: sorgu } : {}),
    ...(kapsam === "aktif" ? { kapsam: "aktif" } : {}),
  };

  const ilkSira = toplam === 0 ? 0 : (sayfa - 1) * SAYFA_BOYUTU + 1;
  const sonSira = (sayfa - 1) * SAYFA_BOYUTU + ogrenciler.length;

  return (
    <div className="space-y-6">
      <SayfaBasligi
        baslik="Öğrenciler"
        aciklama="Öğrenciyi ad, soyad veya veli telefon numarasıyla arayabilirsiniz. Arama Türkçe karakterlere duyarsızdır."
        aksiyon={
          <Link
            href="/koordinator/ogrenciler/yeni"
            className={butonStili()}
          >
            Yeni öğrenci
          </Link>
        }
      />

      {silinen ? (
        <Bildirim tur="basari">{silinen} kalıcı olarak silindi.</Bildirim>
      ) : null}

      <form method="get" className="flex max-w-lg gap-2">
        {/* Süzgeç arama yapılınca kaybolmasın diye adresle birlikte taşınır. */}
        {kapsam === "aktif" ? (
          <input type="hidden" name="kapsam" value="aktif" />
        ) : null}
        <Girdi
          name="q"
          type="search"
          defaultValue={sorgu}
          placeholder="Ad, soyad veya veli telefonu"
          aria-label="Öğrenci ara"
        />
        <button
          type="submit"
          className={butonStili("ikincil", "shrink-0")}
        >
          Ara
        </button>
      </form>

      <SuzgecCubugu>
        <SuzgecGrubu
          etiket="Kapsam"
          temelYol={TEMEL_YOL}
          anahtar="kapsam"
          secenekler={[
            { deger: "aktif", etiket: "Aktif programlarda" },
            { deger: "tumu", etiket: "Tümü" },
          ]}
          secili={kapsam}
          digerler={sorgu ? { q: sorgu } : {}}
        />
      </SuzgecCubugu>

      {toplam > 0 ? (
        <p className="text-sm text-zinc-600">
          <span className="font-medium">{toplam}</span>{" "}
          {sorgu ? "sonuç" : "öğrenci"}
          {sayfaSayisi > 1 ? ` · ${ilkSira}-${sonSira} arası gösteriliyor` : ""}
          {sorgu ? (
            <>
              {" · "}
              <Link
                href={
                  kapsam === "aktif" ? `${TEMEL_YOL}?kapsam=aktif` : TEMEL_YOL
                }
                className={baglantiStili}
              >
                aramayı temizle
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {kaydiTasti ? (
        <p className="text-sm text-vurgu-700">
          İstenen sayfa artık yok; son sayfa gösteriliyor.
        </p>
      ) : null}

      {ogrenciler.length === 0 ? (
        <BosDurum
          baslik={
            sorgu
              ? `"${sorgu}" için sonuç bulunamadı.`
              : kapsam === "aktif"
                ? "Aktif programda kayıtlı öğrenci yok."
                : "Henüz öğrenci kaydı yok."
          }
          aciklama={
            sorgu
              ? "Farklı bir yazım deneyin veya yeni öğrenci ekleyin."
              : kapsam === "aktif"
                ? "“Tümü” süzgeciyle bütün öğrencileri görebilirsiniz."
                : "Dönem veya kulüp kaydı oluşturmak için önce öğrenci ekleyin."
          }
        />
      ) : (
        <div className="space-y-2">
          {ogrenciler.map((ogrenci) => {
            const anne = ogrenci.guardians.find((v) => v.type === "ANNE");
            const baba = ogrenci.guardians.find((v) => v.type === "BABA");

            // §6.2 — Aynı isimli öğrencileri ayırt etmeye yarayan bilgiler.
            const ayirtEdici = [
              ogrenci.birthDate ? tarihBicimle(ogrenci.birthDate) : null,
              ogrenci.school,
              ogrenci.grade,
            ].filter(Boolean);

            return (
              // `relative` + bağlantıdaki `after:inset-0`: kartın TAMAMI
              // tıklanabilir oluyor. Önceden yalnızca 21px'lik ad
              // bağlantısı hedefti, kartın kalanı ölü alandı — telefonda
              // listenin asıl işi olan "öğrenciyi aç" hareketi zordu.
              // Kartta başka bağlantı veya düğme yok, kaplama kimseyi
              // engellemiyor.
              <Kart key={ogrenci.id} className="relative p-4">
                <Link
                  href={`/koordinator/ogrenciler/${ogrenci.id}`}
                  className="font-medium text-zinc-900 after:absolute after:inset-0 hover:text-marka-700 hover:underline"
                >
                  {ogrenci.firstName} {ogrenci.lastName}
                </Link>

                {ayirtEdici.length > 0 ? (
                  <p className="mt-1 text-sm text-zinc-600">
                    {ayirtEdici.join(" · ")}
                  </p>
                ) : null}

                <p className="mt-1 text-xs text-zinc-500">
                  {anne ? `Anne: ${anne.veli.fullName}${anne.veli.phone ? ` (${anne.veli.phone})` : ""}` : null}
                  {anne && baba ? " · " : null}
                  {baba ? `Baba: ${baba.veli.fullName}${baba.veli.phone ? ` (${baba.veli.phone})` : ""}` : null}
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  {ogrenci._count.enrollments === 0
                    ? "Henüz kaydı yok"
                    : `${ogrenci._count.enrollments} kayıt`}
                </p>
              </Kart>
            );
          })}
        </div>
      )}

      <Sayfalama
        temelYol={TEMEL_YOL}
        sayfa={sayfa}
        sayfaSayisi={sayfaSayisi}
        digerler={suzgecler}
      />
    </div>
  );
}
