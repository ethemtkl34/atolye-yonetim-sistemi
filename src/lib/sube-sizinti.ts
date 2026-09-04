/**
 * Şube sızıntısı tarayıcısı.
 *
 * Bu dosya uygulamada çalışmıyor; `sube-sizinti.test.ts` tarafından
 * kullanılıyor. Amacı, çok şubeli yapının kod tabanında elle korunmasını
 * bırakmak: bir sorgu şube süzgecini unutursa test kırılsın.
 *
 * Neden gerekti: şube süzmesi eklendikten SONRA üç ekran (dönem listesi,
 * kulüp listesi, arşiv) hâlâ süzgeçsiz okuyordu ve bu ancak canlıda gözle
 * fark edildi. Tip denetimi, lint ve 102 birim testinin hiçbiri göremezdi —
 * eksik bir `where` yan tümcesi geçerli TypeScript'tir.
 *
 * Ayrıştırma TypeScript'in kendi çözümleyicisiyle yapılıyor. Düzenli ifade
 * denendi ve yetmedi: "bu çağrı hangi fonksiyonun içinde" sorusunun cevabı
 * gerekiyor, o da metinden okunamıyor.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

/**
 * Şube sınırı yalnızca üç tabloda: `User`, `Group`, `Student` (şemada
 * `branchId` taşıyan tek üç model). Aşağıdakiler ise o sınırdan TÜRETİLİYOR —
 * kendi `branchId` sütunları yok ama bir ilişki üzerinden bir şubeye ait
 * oluyorlar, dolayısıyla süzgeçsiz okunduklarında sızdırırlar.
 */
const SUBEYE_AIT = new Set([
  "user",
  "group",
  "student",
  "enrollment",
  "session",
  "score",
  "scoreAnswer",
  "report",
  "reportEnrollment",
  "reportPdf",
  "guardian",
  "healthInfo",
  "termIntern",
  "counselingSession",
  "parentMeeting",
  "intelligenceTest",
  // Aday (CRM) tabloları: Lead şube sınırının dördüncü doğrudan tablosu,
  // etkinlikleri adayından şubelidir. API girişleri (oturumsuz rotalar) da
  // şubeyi payload'dan çözüp SORGUNUN İÇİNE literal yazar — muafiyet yok.
  "lead",
  "leadActivity",
  // §17.1 — Veli şube sınırının beşinci doğrudan tablosu: kendi `branchId`
  // sütununu taşıyor (öğrenciyle aynı gerekçe, §6.1).
  "veli",
  // §17.4 — Randevu altıncısı: seansın hangi binada verildiği ciro
  // raporunun kırılımı, uzmandan türetilemiyor (uzman çok şubeli).
  //
  // Takvim ekranı BİLEREK şubeler arası okuyor (§17.7) ve o sorgu gerekçeli
  // bir `// şube-muaf` taşıyor; kişisel veri orada şubeye göre ayıklanıyor.
  "randevu",
]);

/**
 * Şubeden bağımsız modeller: programlar ve müfredat iki şubede de ORTAK.
 * Bilinçli bir karar — aynı atölye tanımı, aynı sorular, aynı dönem her iki
 * şubede kullanılıyor; ayrışan şey gruplar ve öğrenciler.
 *
 * Bu küme belgeleme amaçlı: tarayıcı `SUBEYE_AIT` dışındaki her modeli zaten
 * atlıyor, ama "unutuldu mu, yoksa bilerek mi dışarıda" sorusunun cevabı
 * burada yazılı olsun diye model adları tek tek sayılıyor.
 */
export const SUBEDEN_BAGIMSIZ = new Set([
  "branch",
  "workshopType",
  "question",
  "term",
  "termWorkshop",
  "termWeek",
  "club",
  "clubWorkshop",
  "curriculumEntry",
  "intelligenceTestType",
  // §17 — Randevu tanımları.
  //
  // `hizmet` fiyat listesidir ve kurumun tamamı için tektir.
  //
  // `uzman` ve altındakiler şubesiz DEĞİL, ÇOK ŞUBELİ: bir uzman iki şubede
  // birden çalışabiliyor, dolayısıyla tek bir `branchId` sütunu taşıyamıyor.
  // Şube bağı `UzmanSube` üzerinden kurulur ve ekranlar uzmanı o tablodan
  // süzer. Tarayıcının aradığı "her sorguda görünür şube süzgeci" kuralı
  // burada anlamlı bir şey söylemezdi; kural yerine ekranların kendisi
  // `subeler: { some: { subeId } }` koşulunu taşır.
  "hizmet",
  "uzman",
  "uzmanSube",
  "uzmanHizmet",
  "uzmanMesai",
  "izin",
]);

/**
 * Şubeye ait kayıtlara iç içe okumadan ulaştıran ilişki adları.
 *
 * Bunlar kuralın en önemli parçası: geçmişteki üç sızıntının üçü de böyleydi.
 * Dış model şubesizdi (`Term`, `Club`) ama `include` içindeki `groups` ve
 * `interns` süzgeçsiz okunuyordu — yani şubesiz bir kapıdan şubeli veriye
 * geçiliyordu. Yalnızca dış modele bakan bir tarayıcı bunları göremezdi.
 *
 * `groups: true` biçimi de sayılıyor — `_count: { select: { groups: true } }`
 * tam olarak buydu: sayı şişiyordu, çünkü süzülemeyen bir sayım.
 *
 * `leads` listede, `activities` (LeadActivity) ise BİLEREK DEĞİL. Ölçüt şu:
 * ilişki, şubesiz bir kapıdan şubeli veriye geçiriyor mu? `Branch.leads`
 * geçiriyor (Branch şubeden bağımsız sayılır, altındaki adaylar değil).
 * `activities`in tek üst modeli `Lead` ve `Lead` zaten `SUBEYE_AIT` — o
 * sorgu 1–5. kurallardan geçmeden yazılamıyor, dolayısıyla iç içe etkinlik
 * yazımı ayrıca denetlenmiş oluyor. Listeye eklenseydi etkinlik yazan her
 * eylem (sekiz kadar) gereksiz bir `// şube-muaf` yorumu taşırdı ve tarayıcı
 * gürültüye dönerdi. Yeni bir şubesiz modele `activities` ilişkisi eklenirse
 * bu karar yeniden gözden geçirilmeli.
 */
const SUBELI_ILISKI =
  /\b(groups|interns|enrollments|sessions|scores|students|reports|guardians|counselingSessions|parentMeetings|intelligenceTests|leads|veliler|randevular)\s*:/;

/**
 * Şube süzgecinin varlığını gösteren belirteçler. `aktifSubeId` gibi bileşik
 * adlar da sayılıyor: şube kimliği bu kod tabanında hep bu adla dolaşıyor.
 */
const SUZGEC_IZI = /\bbranchId\b|[sS]ubeId\b|Kosulu\(/;

/**
 * Tek bir kaydı hedefleyen işlemler: birincil anahtar (`id: x`) ya da
 * Prisma'nın bileşik tekil anahtar sözdizimi (`studentId_groupId: {…}`).
 */
const TEKIL_ANAHTAR = /\bid:\s|\b\w+_\w+:\s*\{/;

/**
 * "Çapa": sorgu, şubeye ait bir üst kaydın kimliğine bağlanmış demektir.
 * `{ groupId: grupId }` gibi — o grup bu fonksiyonda zaten şube süzgecinden
 * geçirilerek okunmuş oluyor, dolayısıyla altındaki oturumlar da o şubenin.
 *
 * Skaler olması şart. `{ userId: { notIn: […] } }` çapa DEĞİLDİR: doğrulanmış
 * tek bir üst kayda değil, bir kümeye işaret eder. Fark önemli — bu oturumda
 * bulunan gerçek veri kaybı hatası tam olarak buydu (`termIntern.deleteMany`
 * `termId` + `userId: { notIn }` ile süzülüyor, diğer şubenin kadrosunu
 * siliyordu).
 */
const CAPA =
  /\b(user|group|student|enrollment|session|score|report|lead)Id:\s*(?!\{)[\w.]+/i;

/** Bilinçli muafiyet: çağrının hemen üstüne gerekçesiyle yazılır. */
const MUAFIYET = /\/\/\s*şube-muaf:\s*\S/;

export type Bulgu = {
  yol: string;
  satir: number;
  model: string;
  metot: string;
  gerekce: string;
};

function tsDosyalari(dizin: string): string[] {
  return readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) return tsDosyalari(yol);
    return /\.tsx?$/.test(ad) && !/\.test\.tsx?$/.test(ad) ? [yol] : [];
  });
}

/**
 * Çağrıyı çevreleyen EN DIŞTAKİ fonksiyon. İçteki değil: `db.$transaction`
 * geri çağrımının içindeki sorgular, şube kontrolünü işlemin dışında yapan
 * eylemlere ait — en içteki fonksiyona bakmak o kontrolü göremezdi.
 */
function endistakiFonksiyon(dugum: ts.Node): ts.Node | undefined {
  let bulunan: ts.Node | undefined;
  for (let n = dugum.parent; n; n = n.parent) {
    if (
      ts.isFunctionDeclaration(n) ||
      ts.isArrowFunction(n) ||
      ts.isFunctionExpression(n) ||
      ts.isMethodDeclaration(n)
    ) {
      bulunan = n;
    }
  }
  return bulunan;
}

/** Çağrıyı içeren en yakın deyim — muafiyet yorumu buranın önünde durur. */
function enYakinDeyim(dugum: ts.Node): ts.Node {
  for (let n: ts.Node = dugum; n.parent; n = n.parent) {
    if (ts.isStatement(n)) return n;
  }
  return dugum;
}

/**
 * Kod tabanını tarar ve şube süzgeci taşımayan sorguları döndürür.
 *
 * Kurallar (sırayla):
 * 1. Ne model şubeye ait ne de iç içe okuma şubeli bir ilişkiye giriyorsa —
 *    atlanır.
 * 2. Çevreleyen fonksiyon `adminZorunlu()` çağırıyorsa — atlanır. Kurum
 *    Yöneticisi şubeler üstü çalışır, süzgeç zaten olmamalı.
 *
 *    `kullaniciYonetimiZorunlu()` bilerek bu listede DEĞİL: o kapıdan Şube
 *    Yöneticisi de geçiyor ve onun görüşü kendi şubesiyle sınırlı. Kullanıcı
 *    yönetimi ekranındaki sorgular bu yüzden kapsamla süzülmek ya da tek tek
 *    gerekçelendirilmek zorunda.
 * 3. Çağrının kendisi şube süzgeci taşıyorsa — geçer.
 * 4. Üstünde `// şube-muaf: <gerekçe>` yorumu varsa — geçer.
 * 5. Tekil kayda ya da doğrulanmış bir üst kayda (çapa) bağlıysa VE fonksiyon
 *    bir yerde şubeyi süzmüşse — geçer. Yaygın deyim bu: önce
 *    `findFirst({ id, branchId })` ile kapıdan geçilir, sonra birincil
 *    anahtarla güncellenir.
 * 6. Değilse — bulgu.
 */
export function subeSizintisiTara(kok = "src"): Bulgu[] {
  return tsDosyalari(kok).flatMap((yol) =>
    metniTara(readFileSync(yol, "utf8"), relative(".", yol)),
  );
}

/**
 * Tek bir kaynak metnini tarar.
 *
 * Ayrı durmasının sebebi test edilebilirlik: geçmişte gerçekten yaşanmış
 * sızıntılar birer metin örneği olarak testte tutuluyor. Tarayıcının "hiçbir
 * bulgu yok" demesi, ancak bilinen sızıntıları yakaladığı gösterilebiliyorsa
 * bir şey ifade eder.
 */
export function metniTara(metin: string, yol = "bellek.ts"): Bulgu[] {
  const kaynak = ts.createSourceFile(yol, metin, ts.ScriptTarget.Latest, true);
  const bulgular: Bulgu[] = [];

  const gez = (dugum: ts.Node): void => {
    if (ts.isCallExpression(dugum)) {
      const bulgu = cagriyiDenetle(dugum, kaynak, metin, yol);
      if (bulgu) bulgular.push(bulgu);
    }
    ts.forEachChild(dugum, gez);
  };

  gez(kaynak);
  return bulgular;
}

function cagriyiDenetle(
  cagri: ts.CallExpression,
  kaynak: ts.SourceFile,
  metin: string,
  yol: string,
): Bulgu | undefined {
  // `db.model.metot(...)` ya da işlem içindeki `tx.model.metot(...)`.
  const metotErisimi = cagri.expression;
  if (!ts.isPropertyAccessExpression(metotErisimi)) return undefined;
  const modelErisimi = metotErisimi.expression;
  if (!ts.isPropertyAccessExpression(modelErisimi)) return undefined;
  const kok = modelErisimi.expression;
  if (!ts.isIdentifier(kok) || (kok.text !== "db" && kok.text !== "tx")) {
    return undefined;
  }

  const model = modelErisimi.name.text;
  const metot = metotErisimi.name.text;
  const argumanlar = cagri.arguments.map((a) => a.getText(kaynak)).join(" ");

  // 1 — şubeye ait model ya da şubeli bir ilişkiye giren iç içe okuma.
  const iliskiyleGiriyor = SUBELI_ILISKI.test(argumanlar);
  if (!SUBEYE_AIT.has(model) && !iliskiyleGiriyor) return undefined;

  const fonksiyon = endistakiFonksiyon(cagri);
  const fonksiyonMetni = fonksiyon ? fonksiyon.getText(kaynak) : metin;

  // 2 — yönetici ekranları şubeler üstü.
  if (/adminZorunlu\(/.test(fonksiyonMetni)) return undefined;

  // 3 — süzgeç çağrının kendisinde.
  if (SUZGEC_IZI.test(argumanlar)) return undefined;

  // 4 — bilinçli muafiyet: çağrının hemen üstündeki gerekçeli yorum.
  //
  // Yorum çağrının kendisine değil, onu içeren DEYİME bağlanır:
  // `const x = await db.y.findMany(…)` yazımında çağrının önünde yalnızca
  // "await " durur. Bu yüzden en yakın deyimin başına bakılıyor.
  const oncekiYorumlar =
    ts.getLeadingCommentRanges(metin, enYakinDeyim(cagri).getFullStart()) ?? [];
  const yorumMetni = oncekiYorumlar
    .map((y) => metin.slice(y.pos, y.end))
    .join("\n");
  if (MUAFIYET.test(yorumMetni)) return undefined;

  // 5 — tekil kayıt ya da doğrulanmış üst kayda çapalı, üstelik fonksiyon
  // şubeyi bir yerde süzmüş. İç içe okuma bu kapıdan geçemez: ilişkinin
  // kendi süzgeci olmadan üst kaydın şubeli olması yetmez.
  const gecerliKapsam =
    !iliskiyleGiriyor &&
    (TEKIL_ANAHTAR.test(argumanlar) || CAPA.test(argumanlar));
  if (gecerliKapsam && SUZGEC_IZI.test(fonksiyonMetni)) return undefined;

  const satir =
    kaynak.getLineAndCharacterOfPosition(cagri.getStart(kaynak)).line + 1;

  return {
    yol,
    satir,
    model,
    metot,
    gerekce: iliskiyleGiriyor
      ? "İç içe okuma şubeli bir ilişkiye süzgeçsiz giriyor: diğer şubenin kayıtları da listeye/sayıya karışır."
      : "Sorgu ne şube süzgeci ne de doğrulanmış bir üst kayda çapa taşıyor: diğer şubenin verisi dönebilir.",
  };
}
