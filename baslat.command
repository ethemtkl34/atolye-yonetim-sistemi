#!/usr/bin/env bash
#
# Atölye Yönetim Sistemi — tek adımda başlatma.
#
# Finder'da çift tıklanabilir (.command uzantısı Terminal'de açar) ya da
# terminalden `npm run baslat` ile çalıştırılır.
#
# Üç işi sırayla yapar: Docker'ı açar, veritabanını ayağa kaldırır, uygulamayı
# başlatır ve hazır olunca tarayıcıyı açar. Her adım "zaten çalışıyorsa geç"
# mantığıyla yazıldı; art arda çalıştırmak zarar vermez.
#
#   npm run baslat                 çalışan sunucu varsa dokunmaz, tarayıcıyı açar
#   npm run baslat -- --yeniden    çalışan sunucuyu kapatıp yeniden başlatır

set -euo pipefail

# Çift tıklamayla açıldığında çalışma dizini ev klasörü oluyor; betiğin kendi
# klasörüne geçmek gerekiyor.
cd "$(dirname "$0")"

ADRES="http://localhost:3000"

YENIDEN="hayir"
for arg in "$@"; do
  case "$arg" in
    --yeniden|-y) YENIDEN="evet" ;;
  esac
done

# 3000 portunu DİNLEYEN süreçler.
#
# `-sTCP:LISTEN` şart: bu bayrak olmadan lsof porta bağlanmış istemcileri de
# döndürüyor ve listede açık duran tarayıcı da çıkıyor. O listeyi körlemesine
# kill etmek kullanıcının tarayıcısını kapatırdı.
dinleyen_pidler() {
  lsof -ti:3000 -sTCP:LISTEN 2>/dev/null || true
}

# Porttaki sunucu bizim uygulamamız mı?
#
# Süreç bilgisi yerine sayfanın kendisine bakılıyor: çalışma dizini
# karşılaştırması, klasör adındaki Türkçe harf yüzünden lsof'un yolu kaçış
# dizisiyle yazmasına takılıyor. Sayfa imzası hem basit hem kesin.
bizim_uygulama_mi() {
  local pid
  if curl -s --max-time 3 "$ADRES" | grep -q "Atölye Yönetim Sistemi"; then
    return 0
  fi
  # Sunucu takılmış olabilir (cevap vermiyor ama ayakta). Süreç adı Next.js
  # sunucusunu gösteriyorsa yine bizimdir.
  for pid in $(dinleyen_pidler); do
    if ps -o command= -p "$pid" 2>/dev/null | grep -q "next-server\|next dev"; then
      return 0
    fi
  done
  return 1
}

echo
echo "  Atölye Yönetim Sistemi başlatılıyor"
echo "  ──────────────────────────────────"
echo

# --- 1/3  Docker (Postgres bunun içinde çalışıyor) -------------------------
# colima'nın kendi günlüğü onlarca satır; ekranı boğmasın diye dosyaya
# yazılıyor ve yalnızca iş ters giderse gösteriliyor.
GUNLUK="$(mktemp -t atolye-baslat)"
trap 'rm -f "$GUNLUK"' EXIT

printf "  1/3  Docker... "
if colima status >/dev/null 2>&1; then
  echo "zaten açık."
else
  printf "başlatılıyor (yarım dakika sürebilir)... "
  if colima start >"$GUNLUK" 2>&1; then
    echo "hazır."
  else
    echo
    echo "  ✗ Docker başlatılamadı:"
    tail -20 "$GUNLUK"
    exit 1
  fi
fi

# --- 2/3  Veritabanı -------------------------------------------------------
printf "  2/3  Veritabanı... "
# --wait: kap "healthy" olana kadar bekler, yoksa uygulama boş veritabanına
# bağlanmaya çalışıp hata veriyor.
if docker compose up -d --wait >"$GUNLUK" 2>&1; then
  echo "hazır."
else
  echo
  echo "  ✗ Veritabanı başlatılamadı:"
  tail -20 "$GUNLUK"
  exit 1
fi

# --- 3/3  Uygulama ---------------------------------------------------------
printf "  3/3  Uygulama... "

PIDLER="$(dinleyen_pidler)"

if [ -n "$PIDLER" ]; then
  if ! bizim_uygulama_mi; then
    # 3000'i tutan şey bizim uygulamamız değil. Onu kapatmak bizim işimiz
    # değil; ne olduğunu söyleyip çekiliyoruz.
    echo
    echo "  ✗ 3000 portunu başka bir uygulama kullanıyor:"
    for pid in $PIDLER; do
      echo "      $(ps -o comm= -p "$pid" 2>/dev/null) (PID $pid)"
    done
    echo "    O uygulamayı kapatıp tekrar deneyin."
    exit 1
  fi

  if [ "$YENIDEN" != "evet" ]; then
    echo "zaten çalışıyor."
    echo
    echo "  Adres: $ADRES"
    echo "  Yeniden başlatmak için:  npm run baslat -- --yeniden"
    echo
    open "$ADRES"
    exit 0
  fi

  printf "çalışan sunucu kapatılıyor... "
  # shellcheck disable=SC2086
  kill $PIDLER 2>/dev/null || true
  for _ in $(seq 15); do
    [ -z "$(dinleyen_pidler)" ] && break
    sleep 1
  done
  # Kibarca kapanmadıysa zorla.
  KALAN="$(dinleyen_pidler)"
  if [ -n "$KALAN" ]; then
    # shellcheck disable=SC2086
    kill -9 $KALAN 2>/dev/null || true
    sleep 1
  fi
fi

echo "başlatılıyor."

# Sunucu cevap verir vermez tarayıcıyı aç. Arka planda beklediği için
# aşağıdaki `npm run dev` çıktısını engellemiyor. Uygulama hiç açılmazsa
# (derleme hatası vb.) 60 denemeden sonra vazgeçer; aksi hâlde bu döngü
# pencere kapanana kadar boşuna dönerdi.
(
  for _ in $(seq 60); do
    if curl -sfo /dev/null "$ADRES"; then open "$ADRES"; break; fi
    sleep 1
  done
) &

echo
echo "  Adres: $ADRES"
echo "  Giriş: koordinator@tuzder.local / Atolye2026!"
echo
echo "  Durdurmak için bu pencerede Ctrl+C."
echo "  ──────────────────────────────────"
echo

npm run dev
