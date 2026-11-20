const crypto = require('crypto');
const redis = require('../redis');

const OTURUM_SURESI_SANIYE = 1800; // 30 dakika

async function oturumOlustur(kullanici) {
  const token = crypto.randomUUID();
  const anahtar = `oturum:${token}`;
  // Güvenlik için şifre hash'ini oturumda saklamayalım
  const guvenliKullanici = {
    id: kullanici.id,
    ad: kullanici.ad,
    soyad: kullanici.soyad,
    eposta: kullanici.eposta,
    rol: kullanici.rol,
    ogrenci_no: kullanici.ogrenci_no,
    bakiye: Number(kullanici.bakiye),
  };
  await redis.set(anahtar, JSON.stringify(guvenliKullanici), 'EX', OTURUM_SURESI_SANIYE);
  return token;
}

async function oturumGetir(token) {
  if (!token) return null;
  const anahtar = `oturum:${token}`;
  const veri = await redis.get(anahtar);
  if (!veri) return null;
  // Her istekte süreyi 30 dakika yenile
  await redis.expire(anahtar, OTURUM_SURESI_SANIYE);
  return JSON.parse(veri);
}

async function oturumGuncelle(token, guncelBilgiler) {
  if (!token) return;
  const mevcut = await oturumGetir(token);
  if (!mevcut) return;
  const yeni = { ...mevcut, ...guncelBilgiler };
  const anahtar = `oturum:${token}`;
  await redis.set(anahtar, JSON.stringify(yeni), 'EX', OTURUM_SURESI_SANIYE);
}

async function oturumSil(token) {
  if (!token) return;
  await redis.del(`oturum:${token}`);
}

module.exports = {
  oturumOlustur,
  oturumGetir,
  oturumGuncelle,
  oturumSil,
};
