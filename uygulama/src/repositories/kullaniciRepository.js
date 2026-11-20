const { yazma, okuma } = require('../db');

// Giriş için eposta ile kullanıcı bulma (replikadan okuma)
async function epostaIleGetir(eposta) {
  const [satirlar] = await okuma.query(
    'SELECT id, ad, soyad, eposta, sifre_hash, rol, ogrenci_no, bakiye, aktif FROM kullanicilar WHERE eposta = ? LIMIT 1',
    [eposta]
  );
  return satirlar[0] || null;
}

// Kullanıcı bilgilerini getirme (kaynaktan veya replikadan)
async function idIleGetir(id, kaynaktan = false) {
  const havuz = kaynaktan ? yazma : okuma;
  const [satirlar] = await havuz.query(
    'SELECT id, ad, soyad, eposta, rol, ogrenci_no, bakiye, aktif FROM kullanicilar WHERE id = ? LIMIT 1',
    [id]
  );
  return satirlar[0] || null;
}

// Bakiye sorgulama (ödev kuralı: rezervasyon veya işlem sonrası kaynaktan okunur)
async function bakiyeGetirKaynaktan(kullaniciId) {
  const [satirlar] = await yazma.query(
    'SELECT bakiye FROM kullanicilar WHERE id = ?',
    [kullaniciId]
  );
  return satirlar[0] ? Number(satirlar[0].bakiye) : 0;
}

// Bakiye yükleme (sp_bakiye_yukle - kaynak sunucu)
async function bakiyeYukle(kullaniciId, tutar) {
  const [sonuclar] = await yazma.query('CALL sp_bakiye_yukle(?, ?)', [kullaniciId, tutar]);
  // mysql2 CALL sonucu ilk eleman dönen satırlar dizisidir
  const satir = sonuclar[0] && sonuclar[0][0];
  return {
    hareketId: satir ? satir.hareket_id : null,
    yeniBakiye: satir ? Number(satir.bakiye) : null,
  };
}

// Bakiye hareket geçmişi (replikadan okuma)
async function bakiyeHareketleriGetir(kullaniciId) {
  const [satirlar] = await okuma.query(
    'SELECT id, tur, tutar, aciklama, olusturma FROM bakiye_hareketleri WHERE kullanici_id = ? ORDER BY id DESC',
    [kullaniciId]
  );
  return satirlar;
}

module.exports = {
  epostaIleGetir,
  idIleGetir,
  bakiyeGetirKaynaktan,
  bakiyeYukle,
  bakiyeHareketleriGetir,
};
