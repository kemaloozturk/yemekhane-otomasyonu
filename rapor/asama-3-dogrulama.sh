#!/usr/bin/env bash
# Aşama 3 doğrulama betiği: Redis menü önbelleği, güncellemede geçersizleştirme ve oturum yönetimi
set -e

TARIH=$(date +%Y-%m-%d)
YEMEKHANE_ID=1
OGUN_ID=2
ANAHTAR="menu:${YEMEKHANE_ID}:${TARIH}:${OGUN_ID}"
BASE="http://localhost:8080"
COOKIE_ADMIN="/tmp/asama3-admin.cookie"
COOKIE_OGR="/tmp/asama3-ogr.cookie"
rm -f "$COOKIE_ADMIN" "$COOKIE_OGR"

echo "=== 1. Redis Bağlantı Kontrolü ==="
echo "\$ docker compose exec -T redis redis-cli PING"
docker compose exec -T redis redis-cli PING

echo
echo "=== 2. Menü Önbelleği: İlk İstek (Cache MISS -> DB Okuma -> Redis Kayıt) ==="
docker compose exec -T redis redis-cli DEL "$ANAHTAR" >/dev/null
ZAMAN_BAS=$(date -Iseconds)
echo "\$ curl -s -o /dev/null -w '%{http_code}' '${BASE}/menu/gunun?yemekhane_id=${YEMEKHANE_ID}&tarih=${TARIH}&ogun_id=${OGUN_ID}'"
KOD1=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/menu/gunun?yemekhane_id=${YEMEKHANE_ID}&tarih=${TARIH}&ogun_id=${OGUN_ID}")
echo "HTTP Durum: $KOD1"
sleep 1
echo "\$ docker compose logs --since='$ZAMAN_BAS' uygulama"
docker compose logs --no-log-prefix --since="$ZAMAN_BAS" uygulama | grep -E "DB OKUMA|REDIS" || true

echo
echo "=== 3. Redis Anahtar, TTL ve Sabit Veri Doğrulaması (bos_yer/ortalama_puan önbellekte yok) ==="
echo "\$ docker compose exec -T redis redis-cli KEYS 'menu:*'"
docker compose exec -T redis redis-cli KEYS "menu:*"
echo "\$ docker compose exec -T redis redis-cli TTL '$ANAHTAR'"
docker compose exec -T redis redis-cli TTL "$ANAHTAR"
echo "\$ Redis değerinde dinamik alan (bos_yer / ortalama_puan) kontrolü:"
DEGER=$(docker compose exec -T redis redis-cli GET "$ANAHTAR")
echo "$DEGER" | head -c 260
echo "..."
if echo "$DEGER" | grep -qE '"bos_yer"|"ortalama_puan"'; then
  echo "UYARI: Önbellekte dinamik alan bulundu!"
else
  echo "OK: Yalnızca sabit menü verisi önbellekte (doluluk ve puan her istekte replikadan taze okunur)."
fi

echo
echo "=== 4. Menü Önbelleği: İkinci İstek (Cache HIT -> DB'ye Gitmeden Redis'ten Okuma) ==="
ZAMAN_HIT=$(date -Iseconds)
KOD2=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/menu/gunun?yemekhane_id=${YEMEKHANE_ID}&tarih=${TARIH}&ogun_id=${OGUN_ID}")
echo "HTTP Durum: $KOD2"
sleep 1
echo "\$ docker compose logs --since='$ZAMAN_HIT' uygulama"
docker compose logs --no-log-prefix --since="$ZAMAN_HIT" uygulama | grep -E "DB OKUMA|REDIS" || true

echo
echo "=== 5. Yönetici Menüyü Güncelleyince Eski Önbellek Kaydının Silinmesi (Cache Invalidation) ==="
# Bugünkü menünün ID'sini ve mevcut yemeklerini al
MENU_ID=$(docker compose exec -T mysql-replica mysql -N -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT id FROM menuler WHERE yemekhane_id=${YEMEKHANE_ID} AND tarih='${TARIH}' AND ogun_id=${OGUN_ID} LIMIT 1;" 2>/dev/null | tr -d '\r')
YEMEK_PARAMS=$(docker compose exec -T mysql-replica mysql -N -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT yemek_id FROM menu_yemekleri WHERE menu_id=${MENU_ID};" 2>/dev/null | tr -d '\r' | awk '{printf "&yemek_idler=%s", $1}')
OGR_FIYAT=$(docker compose exec -T mysql-replica mysql -N -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT ogrenci_fiyati FROM menuler WHERE id=${MENU_ID};" 2>/dev/null | tr -d '\r')
PER_FIYAT=$(docker compose exec -T mysql-replica mysql -N -uyemekhane_app -pUyg_2026 yemekhane \
  -e "SELECT personel_fiyati FROM menuler WHERE id=${MENU_ID};" 2>/dev/null | tr -d '\r')

curl -s -c "$COOKIE_ADMIN" -d "eposta=leyla.arslan%40kampus.edu.tr&sifre=Yemek2026%21" -o /dev/null "${BASE}/giris"
ZAMAN_INV=$(date -Iseconds)
echo "\$ POST /yonetici/menu/${MENU_ID}/duzenle (yönetici güncellemesi)"
KOD_UPD=$(curl -s -b "$COOKIE_ADMIN" -o /dev/null -w "%{http_code}" \
  -d "yemekhane_id=${YEMEKHANE_ID}&tarih=${TARIH}&ogun_id=${OGUN_ID}&ogrenci_fiyati=${OGR_FIYAT}&personel_fiyati=${PER_FIYAT}${YEMEK_PARAMS}" \
  "${BASE}/yonetici/menu/${MENU_ID}/duzenle")
echo "HTTP Durum: $KOD_UPD"
sleep 1
echo "\$ docker compose logs --since='$ZAMAN_INV' uygulama"
docker compose logs --no-log-prefix --since="$ZAMAN_INV" uygulama | grep -E "ÖNBELLEK SİLİNDİ|REDIS" || true
echo "\$ docker compose exec -T redis redis-cli EXISTS '$ANAHTAR' (0 beklenir)"
docker compose exec -T redis redis-cli EXISTS "$ANAHTAR"

# Yönetici çıkış
curl -s -b "$COOKIE_ADMIN" -X POST -o /dev/null "${BASE}/cikis"

echo
echo "=== 6. Redis Oturum Yönetimi: Giriş, 30 dk TTL, Sliding Expiration ve Çıkış ==="
curl -s -c "$COOKIE_OGR" -d "eposta=mehmet.yildiz%40ogr.kampus.edu.tr&sifre=Yemek2026%21" -o /dev/null "${BASE}/giris"
TOKEN=$(awk '$6=="oturum" {print $7}' "$COOKIE_OGR" | tr -d '\r')
OTURUM_ANAHTAR="oturum:${TOKEN}"
echo "Oluşan oturum anahtarı: ${OTURUM_ANAHTAR:0:22}... (kısaltıldı)"
echo "\$ docker compose exec -T redis redis-cli TTL 'oturum:<token>' (giriş anı, ~1800 sn)"
TTL1=$(docker compose exec -T redis redis-cli TTL "$OTURUM_ANAHTAR" | tr -d '\r')
echo "$TTL1"
echo "(4 saniye bekleniyor...)"
sleep 4
TTL_BEKLEME=$(docker compose exec -T redis redis-cli TTL "$OTURUM_ANAHTAR" | tr -d '\r')
echo "Bekleme sonrası TTL: $TTL_BEKLEME"
echo "\$ Yeni istek: GET /bakiye (her istekte TTL yenilenmeli)"
curl -s -b "$COOKIE_OGR" -o /dev/null "${BASE}/bakiye"
TTL2=$(docker compose exec -T redis redis-cli TTL "$OTURUM_ANAHTAR" | tr -d '\r')
echo "İstek sonrası yenilenen TTL: $TTL2"

echo
echo "=== 7. Uygulama Container'ı Yeniden Başlasa Da Oturum Düşmüyor ==="
echo "\$ docker compose restart uygulama"
docker compose restart uygulama >/dev/null 2>&1
sleep 3
echo "\$ Restart sonrası aynı çerezle GET /bakiye (200 OK ve kullanıcı adı beklenir)"
HTTP_SONRA=$(curl -s -b "$COOKIE_OGR" -o /tmp/asama3-bakiye.html -w "%{http_code}" "${BASE}/bakiye")
KULLANICI_VAR=$(grep -c "Mehmet" /tmp/asama3-bakiye.html || true)
echo "HTTP Durum: ${HTTP_SONRA} (oturum korunuyor, sayfada kullanıcı eşleşmesi: ${KULLANICI_VAR})"
echo "\$ docker compose exec -T redis redis-cli EXISTS 'oturum:<token>' (1 beklenir)"
docker compose exec -T redis redis-cli EXISTS "$OTURUM_ANAHTAR"
rm -f /tmp/asama3-bakiye.html

echo
echo "\$ POST /cikis (oturum anahtarı Redis'ten silinmeli)"
curl -s -b "$COOKIE_OGR" -X POST -o /dev/null "${BASE}/cikis"
echo "\$ docker compose exec -T redis redis-cli EXISTS 'oturum:<token>' (0 beklenir)"
docker compose exec -T redis redis-cli EXISTS "$OTURUM_ANAHTAR"

rm -f "$COOKIE_ADMIN" "$COOKIE_OGR"
echo
echo "=== Aşama 3 Doğrulaması Başarıyla Tamamlandı ==="
