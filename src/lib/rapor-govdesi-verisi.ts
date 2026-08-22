import { ogrenciMetniUret } from "./ai/ogrenci-metni";
import { beceriEtiketiCikar } from "./beceri-etiketleri";
import { db } from "./db";
import {
  gelisimAlanOrtalamalari,
  gelisimCevaplariCozumle,
  GELISIM_SORULARI,
} from "./gelisim-degerlendirmesi";
import { atolyeOzetiHesapla } from "./puan-hesaplari";
import { raporEsikleriOku } from "./rapor-ayarlari";
import {
  asimetriBul,
  atolyeKademesiCikar,
  atolyeMetniUret,
  gelisimAlanlariCikar,
  type RaporGovdesiV2,
  type RaporUyarisi,
} from "./rapor-govdesi";
import { grupGelisimOrtalamalari } from "./rapor-verisi";
import { urunOnerileriSec, type OneriAdayi } from "./urun-onerileri";

/**
 * §11 — İkinci sürüm rapor gövdesini veritabanından kurar.
 *
 * Motor katmanı saf; bu dosya ona girdiyi hazırlıyor. Sıralama önemli:
 * önce puanlardan kademeler, sonra gözlem notlarından yapay zekâ metni.
 * Yapay zekâ çağrısı en sonda ve BAŞARISIZ OLABİLİR — o durumda gövde
 * gözlem bölümü olmadan üretilir, rapor yine de alınabilir (§11.2).
 *
 * ŞUBE: öğrenci ve kayıtlar şube süzgecinden geçirilir; başka şubenin
 * kimliği yapıştırılırsa sorgu boş döner.
 */

/** Kazanım başlıklarının alan bazlı listesi — cümlelere gömülür. */
function kazanimHaritasi(): Map<string, string[]> {
  const harita = new Map<string, string[]>();
  for (const soru of GELISIM_SORULARI) {
    const mevcut = harita.get(soru.kategori);
    if (mevcut) mevcut.push(soru.baslik);
    else harita.set(soru.kategori, [soru.baslik]);
  }
  return harita;
}

/** Doğum tarihinden tam yaş; tarih yoksa null. */
function yasHesapla(dogumTarihi: Date | null, bugun: Date): number | null {
  if (!dogumTarihi) return null;
  let yas = bugun.getFullYear() - dogumTarihi.getFullYear();
  const ayFarki = bugun.getMonth() - dogumTarihi.getMonth();
  if (ayFarki < 0 || (ayFarki === 0 && bugun.getDate() < dogumTarihi.getDate())) {
    yas -= 1;
  }
  return yas >= 0 && yas < 120 ? yas : null;
}

export async function raporGovdesiV2Uret(
  ogrenciId: string,
  kayitIdleri: readonly string[],
  subeId: string,
  bugun: Date,
): Promise<RaporGovdesiV2 | null> {
  const ogrenci = await db.student.findFirst({
    where: { id: ogrenciId, branchId: subeId },
    select: {
      firstName: true,
      lastName: true,
      grade: true,
      birthDate: true,
      branch: { select: { name: true } },
    },
  });
  if (!ogrenci) return null;

  const kayitlar = await db.enrollment.findMany({
    where: {
      id: { in: [...kayitIdleri] },
      studentId: ogrenciId,
      group: { branchId: subeId },
    },
    select: {
      id: true,
      groupId: true,
      gozlemNotu: true,
      group: {
        select: {
          name: true,
          term: {
            select: { id: true, name: true, egitimYili: true, _count: { select: { weeks: true } } },
          },
          club: { select: { id: true, name: true } },
        },
      },
      scores: {
        select: {
          attended: true,
          gozlemNotu: true,
          session: {
            select: {
              weekNumber: true,
              workshopType: { select: { id: true, name: true, sortOrder: true } },
            },
          },
          answers: {
            orderBy: { sortOrder: "asc" },
            select: {
              questionId: true,
              questionTextSnapshot: true,
              titleSnapshot: true,
              categorySnapshot: true,
              value: true,
              sortOrder: true,
              // Anlık görüntü alanları sonradan eklendi; onlardan önce
              // girilmiş puanlamalarda boşlar. Soru hâlâ duruyorsa
              // kategorisini oradan okumak, kademeyi hiç hesaplayamamaktan
              // iyidir — kademe yoksa rapor "Değerlendirilmedi" basar ve
              // dolu bir puanlama boşmuş gibi görünür.
              question: { select: { title: true, category: true } },
            },
          },
        },
      },
      // İKİ dönem noktası da çekilir. Dönem sonu kademeyi belirler, dönem
      // ortası ilerleme kıyasını besler; rapor uzun süre yalnızca ikincisini
      // okuyup elde duran ilk ölçümü hiç kullanmıyordu.
      developmentAssessments: {
        select: { period: true, answersJson: true },
      },
    },
  });

  if (kayitlar.length === 0) return null;

  // Kademe eşikleri, kıyas kuralı ve kademe adları kurumun ayarından gelir;
  // tablo boşsa koddaki varsayılanlar. Tek kez okunur ve bütün hesaplara
  // aynı küme geçirilir — rapor içinde iki farklı ölçüt olamaz.
  const esikler = await raporEsikleriOku();

  // "İlk kayıt" birçok şeyi belirliyor (kıyas grubu, eğitim yılı, program
  // adı, YZ istemindeki hafta sayısı) ama id-in sorgusunda satır sırası
  // tanımsızdı: dönem + kulüp kapsayan raporda asıl grup rastgele
  // seçilebiliyordu. Sıra artık deterministik — dönem kayıtları önce.
  kayitlar.sort(
    (a, b) =>
      (a.group.term ? 0 : 1) - (b.group.term ? 0 : 1) ||
      a.id.localeCompare(b.id),
  );

  // Eksik üretilen her bölüm buraya sebebiyle yazılır; rapor penceresi bu
  // listeyi gösterir. Sessizce eksik basmak, koordinatörün eksiği ancak
  // veliye gönderdikten sonra fark etmesi demekti.
  const uyarilar: RaporUyarisi[] = [];

  // --- Atölye kademeleri -------------------------------------------------
  type CevapSatiri = {
    questionId: string | null;
    questionTextSnapshot: string;
    titleSnapshot: string | null;
    categorySnapshot: string | null;
    value: number | null;
    sortOrder: number;
  };

  const atolyeHavuzu = new Map<
    string,
    {
      ad: string;
      sira: number;
      puanlamalar: { attended: boolean; answers: CevapSatiri[] }[];
    }
  >();

  for (const kayit of kayitlar) {
    for (const puanlama of kayit.scores) {
      const atolye = puanlama.session.workshopType;
      const mevcut = atolyeHavuzu.get(atolye.id);
      const satir = {
        attended: puanlama.attended,
        answers: puanlama.answers.map((cevap) => ({
          ...cevap,
          titleSnapshot: cevap.titleSnapshot ?? cevap.question?.title ?? null,
          categorySnapshot:
            cevap.categorySnapshot ?? cevap.question?.category ?? null,
        })),
      };
      if (mevcut) mevcut.puanlamalar.push(satir);
      else
        atolyeHavuzu.set(atolye.id, {
          ad: atolye.name,
          sira: atolye.sortOrder,
          puanlamalar: [satir],
        });
    }
  }

  const atolyeKademeleri = [...atolyeHavuzu.entries()]
    .sort((a, b) => a[1].sira - b[1].sira)
    .map(([, atolye]) => {
      const ozet = atolyeOzetiHesapla(atolye.puanlamalar);
      const kademe = atolyeKademesiCikar(
        {
          atolyeAdi: atolye.ad,
          soruOrtalamalari: ozet.soruOrtalamalari,
          katildigiOturumSayisi: ozet.katildigiOturumSayisi,
          katilmadigiOturumSayisi: ozet.katilmadigiOturumSayisi,
        },
        esikler,
      );
      // Öğrenciye özel atölye paragrafı — kademeyle aynı veriden, kural
      // tabanlı. Snapshot'a gömülür; PDF ve panel yeniden hesaplamaz.
      return {
        ...kademe,
        metin: atolyeMetniUret({
          ilkAd: ogrenci.firstName,
          soruOrtalamalari: ozet.soruOrtalamalari,
          basari: kademe.basari,
          katildigiOturumSayisi: ozet.katildigiOturumSayisi,
          katilmadigiOturumSayisi: ozet.katilmadigiOturumSayisi,
        }),
      };
    });

  // --- Gelişim alanları --------------------------------------------------
  const donemCevaplari = (donem: "DONEM_ORTASI" | "DONEM_SONU") =>
    kayitlar.flatMap((kayit) =>
      kayit.developmentAssessments
        .filter((d) => d.period === donem)
        .flatMap((d) => gelisimCevaplariCozumle(d.answersJson)),
    );

  const gelisimCevaplari = donemCevaplari("DONEM_SONU");
  const ortaCevaplari = donemCevaplari("DONEM_ORTASI");

  // Dönem ortası ortalamaları alan adına göre; cevaplanmamış alan haritaya
  // hiç girmez ve o alanda değişim yorumu yazılmaz.
  const ortaOrtalamalari = new Map(
    gelisimAlanOrtalamalari(ortaCevaplari)
      .filter((alan): alan is typeof alan & { ortalama: number } =>
        alan.ortalama !== null,
      )
      .map((alan) => [alan.kategori, alan.ortalama] as const),
  );

  // Kıyas grubu ilk kaydın grubu: rapor tek bir programın raporu, birden
  // fazla kayıt kapsandığında da öğrencinin asıl grubu ilkidir.
  const grupOrtalamalari = await grupGelisimOrtalamalari(
    kayitlar[0].groupId,
    "DONEM_SONU",
  );

  // Kapak notundaki "değerlendirilen grubun öğrenci sayısı": kıyas grubunda
  // dönem sonu değerlendirmesi girilmiş farklı öğrencilerin sayısı — grup
  // ortalamasını besleyen kümenin ta kendisi.
  const grupDegerlendirmeleri = await db.developmentAssessment.findMany({
    where: {
      period: "DONEM_SONU",
      // İptal edilen kayıtların formları kıyasa girmez; ortalama sorgusuyla
      // (grupGelisimOrtalamalari) aynı kümeyi saymak zorunda.
      enrollment: { groupId: kayitlar[0].groupId, status: "AKTIF" },
    },
    select: { enrollment: { select: { studentId: true } } },
  });
  const grupOgrenciSayisi =
    new Set(grupDegerlendirmeleri.map((d) => d.enrollment.studentId)).size || null;

  // Grup ortalaması öğrencinin kendisini de içeriyor; değerlendirilmiş tek
  // öğrenci raporun öğrencisiyse "kıyas" kendine karşı yapılır ve fark hep 0
  // çıkardı — bütün cevaplar 5 olsa bile "yaşıtlarıyla benzer düzeyde"
  // yazılırdı. Kıyas ancak grupta yeterince değerlendirilmiş öğrenci varsa
  // yapılır; yoksa boş harita geçirilir ve gelisimBandi'nin mutlak eşikli
  // dalı ile "grup kıyası yapılamadı" uyarısı devreye girer.
  //
  // Asgari sayı ayarlanabilir (varsayılan 3, raporun öğrencisi dahil): iki
  // kişilik bir kümede tek bir arkadaşın puanı "yaşıtlarının üzerinde"
  // hükmünü tek başına belirliyordu.
  const kiyasOrtalamalari =
    grupOgrenciSayisi !== null &&
    grupOgrenciSayisi >= esikler.kiyasAsgariOgrenci
      ? grupOrtalamalari
      : new Map<string, number>();

  const gelisimAlanlari = gelisimAlanlariCikar(
    gelisimAlanOrtalamalari(gelisimCevaplari),
    kiyasOrtalamalari,
    kazanimHaritasi(),
    esikler,
    ortaOrtalamalari,
  );

  if (gelisimCevaplari.length === 0) {
    uyarilar.push({
      bolum: "gelisim",
      mesaj:
        "Duygusal, sosyal ve bilişsel beceriler bölümü boş: bu öğrenci için dönem sonu gelişim değerlendirmesi girilmemiş.",
      cozum:
        "Öğrencinin profilindeki “Gelişim değerlendirmesi” bölümünden dönem sonu formunu doldurup raporu yeniden üretin.",
    });
  } else if (ortaOrtalamalari.size === 0) {
    // Dönem ortası formu raporun ZORUNLU parçası değil: yokluğunda rapor
    // eksiksiz basılır, yalnızca ilerleme kıyası yapılamaz. Yine de sessiz
    // kalmıyor — koordinatör bu formun doldurulmadığını rapordan öğrenir.
    uyarilar.push({
      bolum: "gelisim",
      mesaj:
        "Dönem ortasına göre ilerleme yazılamadı: bu öğrenci için dönem ortası gelişim değerlendirmesi girilmemiş. Beceri grafiğinde tek ölçüm görünür.",
      cozum:
        "Dönem ortası formu geç de olsa doldurulabilir (son tarih yok); doldurulduktan sonra raporu yeniden üretin.",
    });
  }

  if (gelisimCevaplari.length > 0 && kiyasOrtalamalari.size === 0) {
    uyarilar.push({
      bolum: "gelisim",
      mesaj: `Beceriler grafiğinde grup ortalaması çizilemedi: akran kıyası için grupta dönem sonu değerlendirmesi girilmiş en az ${esikler.kiyasAsgariOgrenci} öğrenci gerekiyor, ${grupOgrenciSayisi ?? 0} öğrenci var. Kademeler bu yüzden mutlak eşiklere göre belirlendi.`,
      cozum:
        "Gruptaki diğer öğrencilerin dönem sonu formları doldurulduktan sonra raporu yeniden üretin; kıyas o zaman yapılabilir. Asgari sayıyı “Rapor ayarları” sayfasından değiştirebilirsiniz.",
    });
  }

  // Havuz tamamen boşsa (seçilen kayıtlarda puanlanmış tek oturum bile yok)
  // aşağıdaki iki uyarı da tetiklenemez: kademe süzgeci boş listede çalışmaz,
  // içerik sorgusu boş atölye kümesiyle boş döner. Bu en eksik rapor hâli
  // en sessiz hâl olurdu — kapsayıcı uyarı burada üretilir.
  if (atolyeHavuzu.size === 0) {
    uyarilar.push({
      bolum: "kademe",
      mesaj:
        "Atölye bölümleri boş: seçilen kayıtlarda puanlanmış hiçbir oturum yok. İlgi ve başarı kademeleri ile atölye içerik paragrafları bu yüzden rapora giremedi.",
      cozum:
        "Puanlamalar sayfasından bu öğrencinin oturum formlarını doldurun ve raporu yeniden üretin.",
    });
  }

  const kademesizAtolyeler = atolyeKademeleri
    .filter((a) => !a.ilgi || !a.basari)
    .map((a) => a.atolyeAdi);
  if (kademesizAtolyeler.length > 0) {
    uyarilar.push({
      bolum: "kademe",
      mesaj: `İlgi veya başarı düzeyi hesaplanamayan atölyeler: ${kademesizAtolyeler.join(", ")}. Bu atölyelerde puanlanmış oturum bulunmuyor ya da puanlama soruları ilgi/yetenek başlıkları altında değil.`,
      cozum:
        "İlgili oturumların puanlama formlarının doldurulduğunu ve atölyenin soru başlıklarının “ilgi” ile “yetenek” kategorilerini içerdiğini kontrol edin.",
    });
  }

  // --- Atölye içerik paragrafları ---------------------------------------
  const donemIdleri = kayitlar
    .map((k) => k.group.term?.id)
    .filter((id): id is string => Boolean(id));
  const kulupIdleri = kayitlar
    .map((k) => k.group.club?.id)
    .filter((id): id is string => Boolean(id));

  const icerikKayitlari = await db.atolyeIcerigi.findMany({
    where: {
      OR: [
        ...(donemIdleri.length ? [{ termId: { in: donemIdleri } }] : []),
        ...(kulupIdleri.length ? [{ clubId: { in: kulupIdleri } }] : []),
      ],
      workshopTypeId: { in: [...atolyeHavuzu.keys()] },
    },
    select: { metin: true, workshopType: { select: { name: true, sortOrder: true } } },
  });

  const atolyeIcerikleri = icerikKayitlari
    .sort((a, b) => a.workshopType.sortOrder - b.workshopType.sortOrder)
    .map((kayit) => ({ atolyeAdi: kayit.workshopType.name, metin: kayit.metin }));

  // İçerik paragrafı program × atölye başına bir kez üretiliyor; üretilmemiş
  // olan atölye raporda tamamen boş kalır ve bu fark edilmeyebilir.
  const icerigiOlanlar = new Set(atolyeIcerikleri.map((i) => i.atolyeAdi));
  const icerigiOlmayanlar = [...atolyeHavuzu.values()]
    .map((atolye) => atolye.ad)
    .filter((ad) => !icerigiOlanlar.has(ad));
  if (icerigiOlmayanlar.length > 0) {
    uyarilar.push({
      bolum: "atolyeIcerik",
      mesaj: `“Atölyeler ve içerikleri” bölümünde şu atölyeler yok: ${icerigiOlmayanlar.join(", ")}. Bu program için içerik paragrafları üretilmemiş.`,
      cozum:
        "Müfredat sayfasında ilgili programı açıp bu atölyelerin haftalık müfredatını girin ve “İçerik üret” adımını çalıştırın; sonra raporu yeniden üretin.",
    });
  }

  // --- Gözlem bölümü (yapay zekâ) ---------------------------------------
  const beceriler = await db.beceriTanimi.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { ad: true, tanim: true },
  });

  const yas = yasHesapla(ogrenci.birthDate, bugun);

  // Ürün adayları: öğrencinin desteklenecek ve güçlü alanları, ilgi duyduğu
  // atölyeler. Adaylar sistem tarafından süzülür; yapay zekâ yalnızca bu
  // listeden seçebilir.
  const desteklenecek = atolyeKademeleri
    .filter((a) => a.basari?.kademe === "DUSUK")
    .map((a) => a.atolyeAdi);
  const guclu = atolyeKademeleri
    .filter((a) => a.basari?.kademe === "YUKSEK")
    .map((a) => a.atolyeAdi);

  const ilgiliAtolyeIdleri = [...atolyeHavuzu.entries()]
    .filter(([, atolye]) =>
      atolyeKademeleri.find(
        (k) => k.atolyeAdi === atolye.ad && k.ilgi?.kademe === "YUKSEK",
      ),
    )
    .map(([id]) => id);

  const urunAdaylari: OneriAdayi[] = await db.oneriUrunu.findMany({
    where: { active: true },
    select: {
      id: true,
      ad: true,
      url: true,
      kategori: true,
      yasMin: true,
      yasMax: true,
      alanlar: true,
      beceriler: true,
      workshopTypeId: true,
    },
  });

  const secilenUrunler = urunOnerileriSec(urunAdaylari, {
    yas,
    desteklenecekBasliklar: desteklenecek,
    gucluBasliklar: guclu,
    ilgiliAtolyeIdleri,
  });

  const gozlemNotlari = kayitlar.flatMap((kayit) =>
    kayit.scores
      .filter((puanlama) => puanlama.gozlemNotu?.trim())
      .map((puanlama) => ({
        atolyeAdi: puanlama.session.workshopType.name,
        hafta: puanlama.session.weekNumber,
        konu: null as string | null,
        not: puanlama.gozlemNotu!.trim(),
      })),
  );

  const genelGozlem =
    kayitlar
      .map((kayit) => kayit.gozlemNotu?.trim())
      .filter(Boolean)
      .join("\n") || null;

  const ilkKayit = kayitlar[0];
  const programAdi =
    ilkKayit.group.term?.name ?? ilkKayit.group.club?.name ?? "Program";

  // Programın (grubun) tam atölye listesi — öğrencinin puanlanmış atölyeleri
  // programın tamamı olmayabilir (geç kayıt, devamsızlık); model programı
  // öğrencinin verisinden değil buradan tanıtır.
  const programOturumAtolyeleri = await db.session.findMany({
    where: { groupId: kayitlar[0].groupId },
    select: { workshopType: { select: { name: true, sortOrder: true } } },
    distinct: ["workshopTypeId"],
  });
  const programAtolyeleri = programOturumAtolyeleri
    .sort((a, b) => a.workshopType.sortOrder - b.workshopType.sortOrder)
    .map((oturum) => oturum.workshopType.name);

  const metinSonucu = await ogrenciMetniUret({
    ilkAd: ogrenci.firstName,
    programAdi,
    haftaSayisi: ilkKayit.group.term?._count.weeks ?? null,
    atolyeSayisi: atolyeKademeleri.length,
    programAtolyeleri,
    katilim: atolyeKademeleri.map((a) => ({
      atolyeAdi: a.atolyeAdi,
      katildi: a.katildigiOturumSayisi,
      kapsam: a.katildigiOturumSayisi + a.katilmadigiOturumSayisi,
    })),
    atolyeler: atolyeKademeleri.map((a) => ({
      ad: a.atolyeAdi,
      ilgi: a.ilgi?.etiket ?? null,
      basari: a.basari?.etiket ?? null,
    })),
    gelisimAlanlari: gelisimAlanlari.map((a) => ({
      ad: a.ad,
      kademe: a.bant?.etiket ?? null,
    })),
    gozlemler: gozlemNotlari,
    genelGozlem,
    beceriler,
    urunler: secilenUrunler.map((secim) => ({
      ad: secim.urun.ad,
      url: secim.urun.url,
      gerekce: secim.gerekce,
    })),
  });

  const beceriTanimHaritasi = new Map(beceriler.map((b) => [b.ad, b.tanim]));

  const gozlem =
    metinSonucu.durum === "tamam"
      ? {
          giris: metinSonucu.metin.giris,
          profil: metinSonucu.metin.profil,
          bloklar: metinSonucu.metin.bloklar.map((blok) => ({
            beceriAdi: blok.beceriAdi,
            // Tanım sözlükten alınır, modelin yazdığından değil: bu metin
            // kurumun sabit tanımı ve her raporda aynı olmalı.
            tanim: beceriTanimHaritasi.get(blok.beceriAdi) ?? "",
            etkinlik: blok.etkinlik || null,
            gozlem: blok.gozlem,
          })),
          sonuc: metinSonucu.metin.sonuc,
          oneriler: metinSonucu.metin.oneriler,
          urunler: secilenUrunler.map((secim) => ({
            ad: secim.urun.ad,
            url: secim.urun.url,
          })),
        }
      : null;

  // Gözlem bölümü üretilemediyse sebebi yazılır: dördü de çok farklı işler
  // ("not yok" kurumsal bir eksik, "anahtar yok" kurulum hatası, "hata"
  // geçici bir arıza) ve çözümleri de farklı.
  if (!gozlem) {
    switch (metinSonucu.durum) {
      case "gozlem-yok":
        uyarilar.push({
          bolum: "gozlem",
          mesaj:
            "Eğitmen gözlem raporu yazılmadı: bu öğrenci için puanlama formlarına yeterli gözlem notu girilmemiş.",
          cozum:
            "Stajyerlerin oturum puanlama formlarındaki “gözlem notu” alanlarını doldurmasını isteyin; notlar girildikten sonra raporu yeniden üretin.",
        });
        break;
      case "anahtar-yok":
        uyarilar.push({
          bolum: "gozlem",
          mesaj:
            "Eğitmen gözlem raporu yazılmadı: yapay zekâ bağlantısı kurulu değil (OPENAI_API_KEY tanımsız).",
          cozum:
            "Sunucu ortam değişkenlerine geçerli bir OPENAI_API_KEY ekleyin; raporun kalan bölümleri bu ayardan etkilenmez.",
        });
        break;
      case "hata":
        uyarilar.push({
          bolum: "gozlem",
          mesaj: `Eğitmen gözlem raporu yazılamadı: ${metinSonucu.mesaj}`,
          cozum:
            "“Güncel puanlarla yeniden üret” ile tekrar deneyin; hata sürerse yapay zekâ servisinin durumunu kontrol edin.",
        });
        break;
    }
  }

  return {
    surum: 2,
    ogrenci: {
      adSoyad: `${ogrenci.firstName} ${ogrenci.lastName}`,
      ilkAd: ogrenci.firstName,
      sinif: ogrenci.grade,
    },
    egitimYili: ilkKayit.group.term?.egitimYili ?? null,
    subeAdi: ogrenci.branch?.name ?? null,
    grupOgrenciSayisi,
    kapsam: kayitlar.map((kayit) => ({
      programAdi: kayit.group.term?.name ?? kayit.group.club?.name ?? "Program",
      grupAdi: kayit.group.name,
      tur: kayit.group.term ? ("Dönem" as const) : ("Kulüp" as const),
    })),
    atolyeIcerikleri,
    gelisimAlanlari,
    atolyeKademeleri,
    kademeEtiketleri: esikler.etiketler,
    atolyeEsikleri: { yuksek: esikler.atolyeYuksek, dusuk: esikler.atolyeDusuk },
    asimetriler: asimetriBul(
      atolyeKademeleri.map((a) => ({
        atolyeAdi: a.atolyeAdi,
        // Ham ortalamalarla: kademe temsilcisi (4,5/3,5/2,5) kullanılınca
        // eşiğin iki yanındaki 0,01'lik fark "belirgin asimetri" diye
        // basılıyor, aynı kademede kalan 0,9'luk fark hiç görünmüyordu.
        ilgi: a.ilgiOrtalamasi ?? null,
        basari: a.basariOrtalamasi ?? null,
      })),
      esikler,
    ),
    gozlem,
    uyarilar,
    metinKaynagi: gozlem ? "ai" : "sablon",
  };
}

export { beceriEtiketiCikar };
