const mysql = require('mysql2/promise');

function havuzOlustur(host) {
  return mysql.createPool({
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_KULLANICI,
    password: process.env.DB_SIFRE,
    database: process.env.DB_ADI,
    charset: 'utf8mb4',
    timezone: '+03:00',
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  });
}

// Yazma: kaynak sunucu. Okuma: replika.
const yazma = havuzOlustur(process.env.DB_YAZMA_HOST);
const okuma = havuzOlustur(process.env.DB_OKUMA_HOST);

module.exports = { yazma, okuma };
