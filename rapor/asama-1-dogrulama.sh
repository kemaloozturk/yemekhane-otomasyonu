#!/usr/bin/env bash
# Aşama 1 doğrulama betiği: çıktıları rapora girecek
calis() { echo; echo "\$ $*"; "$@" 2>&1 | grep -v "Using a password"; }
SORGU="SELECT id, bakiye FROM kullanicilar WHERE id = 7"

echo "=== 1. Servislerin durumu ==="
calis docker compose ps -a

echo; echo "=== 2. Replikasyon durumu ==="
echo; echo "\$ SHOW REPLICA STATUS (özet)"
docker compose exec mysql-replica mysql -uroot -pyemekhane_kok -e "SHOW REPLICA STATUS\G" 2>&1 | grep -E "Source_Host|Replica_IO_Running|Replica_SQL_Running|Last_Error"

echo; echo "=== 3. Kaynakta yüklenen bakiye replikada görünüyor ==="
calis docker compose exec mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane -e "$SORGU"
calis docker compose exec mysql-primary mysql -uyemekhane_app -pUyg_2026 yemekhane -e "CALL sp_bakiye_yukle(7, 100)"
sleep 2
calis docker compose exec mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane -e "$SORGU"

echo; echo "=== 4. Replikaya yazma denemesi reddedilir ==="
calis docker compose exec mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane -e "CALL sp_bakiye_yukle(7, 50)"

echo; echo "=== 5. Replika durdurulup başlatılınca değişiklikleri yakalar ==="
calis docker compose stop mysql-replica
calis docker compose exec mysql-primary mysql -uyemekhane_app -pUyg_2026 yemekhane -e "CALL sp_bakiye_yukle(7, 200)"
calis docker compose start mysql-replica
echo; echo "(replikanın hazır olması için 40 sn bekleniyor)"
sleep 40
calis docker compose exec mysql-replica mysql -uyemekhane_app -pUyg_2026 yemekhane -e "$SORGU"

echo; echo "=== 6. Redis ==="
calis docker compose exec redis redis-cli ping
