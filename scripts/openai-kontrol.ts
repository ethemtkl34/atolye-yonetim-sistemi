/**
 * OpenAI anahtarını ve model erişimini sınar.
 *
 *   OPENAI_API_KEY="$(pbpaste | tr -d '\n')" npx tsx scripts/openai-kontrol.ts
 *
 * NEDEN AYRI BİR BETİK: Vercel'e "Sensitive" olarak yazılan değişkenler geri
 * okunamıyor (`vercel env pull` gerçek değer yerine `[SENSITIVE]` döndürüyor).
 * Anahtarın geçerli olduğu ancak ilk gerçek çağrıda anlaşılıyor; bu betik o
 * çağrıyı raporun içine gömmeden, tek başına yapmayı sağlıyor.
 *
 * Model erişimi hesap kademesine göre değişiyor: rapor motorunun seçtiği
 * modeller her hesapta açık olmayabilir, o yüzden varlıkları tek tek
 * doğrulanıyor.
 */

/** Rapor motorunun kullanmayı planladığı modeller. */
const HEDEF_MODELLER = [
  { id: "gpt-5.6-sol", is: "Öğrenci metinleri (gözlem raporu, genel değerlendirme)" },
  { id: "gpt-5.6-terra", is: "Atölye içerik paragrafları" },
  { id: "gpt-5.5", is: "Yedek — sol yoksa" },
  { id: "gpt-5", is: "Yedek — daha ucuz" },
  { id: "gpt-5-mini", is: "Yedek — en ucuz" },
];

async function main() {
  const anahtar = process.env.OPENAI_API_KEY;

  if (!anahtar) {
    console.error("OPENAI_API_KEY tanımlı değil.");
    console.error('Kullanım: OPENAI_API_KEY="$(pbpaste | tr -d \'\\n\')" npx tsx scripts/openai-kontrol.ts');
    process.exit(1);
  }

  // Anahtarın kendisi hiçbir yere yazdırılmaz; yalnızca biçimi bildirilir.
  console.log(`Anahtar okundu: ${anahtar.length} karakter, "${anahtar.slice(0, 7)}…" ile başlıyor`);
  if (anahtar.length < 40) {
    console.error(
      "\nUYARI: anahtar beklenenden çok kısa. Panoya anahtar yerine başka bir şey kopyalanmış olabilir.",
    );
  }

  const cevap = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${anahtar}` },
  });

  if (!cevap.ok) {
    const govde = (await cevap.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    console.error(`\nHATA ${cevap.status}: ${govde?.error?.message ?? cevap.statusText}`);
    process.exit(1);
  }

  const veri = (await cevap.json()) as { data: { id: string }[] };
  const kimlikler = new Set(veri.data.map((model) => model.id));

  console.log(`\nAnahtar geçerli. Hesapta ${kimlikler.size} model görünüyor.\n`);

  let eksikVar = false;
  for (const model of HEDEF_MODELLER) {
    const varMi = kimlikler.has(model.id);
    if (!varMi) eksikVar = true;
    console.log(`  ${varMi ? "VAR" : "YOK"}  ${model.id.padEnd(16)} ${model.is}`);
  }

  if (eksikVar) {
    console.log("\nErişilebilen gpt-5 ailesi modelleri:");
    for (const id of [...kimlikler].filter((k) => k.startsWith("gpt-5")).sort()) {
      console.log(`  ${id}`);
    }
  }
}

main().catch((hata) => {
  console.error(hata);
  process.exit(1);
});
