#!/usr/bin/env bash
# Aşama 4 doğrulama betiği: Şema değişikliği replikasyonu, yarım porsiyon (%60) ve alerjen uyarıları
set -e

BASE="http://localhost:8080"
COOKIE="/tmp/asama4-ogr.cookie"
rm -f "$COOKIE"

echo "=== 1. Replika Şema Doğrulaması (04_degisiklik.sql yalnızca kaynağa uygulandı) ==="
echo "\$ SHOW COLUMNS FROM rezervasyonlar LIKE 'porsiyon' (mysql-replica)"
docker compose exec -T mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SHOW COLUMNS FROM rezervasyonlar LIKE 'porsiyon';" 2>&1 | grep -v "Using a password"

echo
echo "\$ DESCRIBE kullanici_alerjenleri (mysql-replica)"
docker compose exec -T mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane \
  -e "DESCRIBE kullanici_alerjenleri;" 2>&1 | grep -v "Using a password"

echo
echo "\$ Geçmiş rezervasyonların porsiyon dağılımı (hepsi 'tam' kalmış olmalı)"
docker compose exec -T mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT porsiyon, COUNT(*) AS adet FROM rezervasyonlar GROUP BY porsiyon;" 2>&1 | grep -v "Using a password"

echo
echo "=== 2. Yarım Porsiyon (%60 Fiyat) Rezervasyon Canlı Testi ==="
curl -s -c "$COOKIE" -d "eposta=mehmet.yildiz%40ogr.kampus.edu.tr&sifre=Yemek2026%21" -o /dev/null "${BASE}/giris"

# Yarının öğle menüsünü bul (ogun_id = 2)
YARIN=$(date -d "+1 day" +%Y-%m-%d)
OGLE_MENU=$(docker compose exec -T mysql-replica mysql -N -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT id, ogrenci_fiyati FROM menuler WHERE yemekhane_id=1 AND tarih='${YARIN}' AND ogun_id=2 LIMIT 1;" 2>/dev/null | tr -d '\r')
OGLE_ID=$(echo "$OGLE_MENU" | awk '{print $1}')
OGLE_FIYAT=$(echo "$OGLE_MENU" | awk '{print $2}')
echo "Seçilen Öğle Menüsü: id=${OGLE_ID}, tarih=${YARIN}, tam öğrenci fiyatı=${OGLE_FIYAT} TL (beklenen %60: $(awk "BEGIN{printf \"%.2f\", ${OGLE_FIYAT}*0.60}") TL)"

LOC_YARIM=$(curl -s -b "$COOKIE" -D - -o /dev/null \
  -d "menu_id=${OGLE_ID}&yarim_porsiyon=1&donus_url=/menu/haftalik" \
  "${BASE}/rezervasyon/yap" | grep -i "^location:" | tr -d '\r')
echo "Yönlendirme (decode): $(python3 -c "import urllib.parse, sys; print(urllib.parse.unquote(sys.argv[1]))" "$LOC_YARIM")"

sleep 1
echo "\$ Replikadan yeni yarım porsiyon rezervasyon kaydı:"
docker compose exec -T mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT id, menu_id, durum, porsiyon, ucret FROM rezervasyonlar WHERE menu_id=${OGLE_ID} AND porsiyon='yarim' ORDER BY id DESC LIMIT 1;" 2>&1 | grep -v "Using a password"

# Test rezervasyonunu temizlemek için iptal et
REZ_ID=$(docker compose exec -T mysql-replica mysql -N -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT id FROM rezervasyonlar WHERE menu_id=${OGLE_ID} AND porsiyon='yarim' AND durum='aktif' ORDER BY id DESC LIMIT 1;" 2>/dev/null | tr -d '\r')
if [ -n "$REZ_ID" ]; then
  curl -s -b "$COOKIE" -o /dev/null -d "rezervasyon_id=${REZ_ID}" "${BASE}/rezervasyon/iptal"
  echo "(Test rezervasyonu #${REZ_ID} temizlik amaçlı iptal edildi ve ücret iade edildi.)"
fi

echo
echo "=== 3. Kahvaltıda Yarım Porsiyon Engeli (SQLSTATE 45000) ==="
KAHVALTI_ID=$(docker compose exec -T mysql-replica mysql -N -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT id FROM menuler WHERE yemekhane_id=1 AND tarih='${YARIN}' AND ogun_id=1 LIMIT 1;" 2>/dev/null | tr -d '\r')
echo "Seçilen Kahvaltı Menüsü: id=${KAHVALTI_ID}, tarih=${YARIN}"
LOC_KAH=$(curl -s -b "$COOKIE" -D - -o /dev/null \
  -d "menu_id=${KAHVALTI_ID}&yarim_porsiyon=1&donus_url=/menu/haftalik" \
  "${BASE}/rezervasyon/yap" | grep -i "^location:" | tr -d '\r')
echo "Yönlendirme (decode): $(python3 -c "import urllib.parse, sys; print(urllib.parse.unquote(sys.argv[1]))" "$LOC_KAH")"

echo
echo "=== 4. Alerjen Tercihleri Kaydı ve Menüde Kişisel Uyarı Doğrulaması ==="
# Gluten (id=1) ve Süt (id=2) kaydet
curl -s -b "$COOKIE" -o /dev/null -d "alerjen_idler=1&alerjen_idler=2" "${BASE}/profil/alerjenler"
sleep 1
echo "\$ Replikadan kullanıcı alerjen tercihleri:"
docker compose exec -T mysql-replica mysql --default-character-set=utf8mb4 -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT ka.kullanici_id, a.ad AS alerjen FROM kullanici_alerjenleri ka JOIN alerjenler a ON a.id=ka.alerjen_id ORDER BY ka.kullanici_id, a.id;" 2>&1 | grep -v "Using a password"

UYARI_SAYISI=$(curl -s -b "$COOKIE" "${BASE}/menu/gunun?yemekhane_id=1&tarih=${YARIN}&ogun_id=2" | grep -c "Profilinizdeki Alerjen" || true)
echo "Günün menüsü sayfasında tespit edilen kişisel alerjen uyarısı sayısı: ${UYARI_SAYISI}"

# Çıkış
curl -s -b "$COOKIE" -X POST -o /dev/null "${BASE}/cikis"
rm -f "$COOKIE"

echo
echo "=== Aşama 4 Doğrulaması Başarıyla Tamamlandı ==="
