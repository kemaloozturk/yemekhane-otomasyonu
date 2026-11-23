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

// Tüm alerjenler listesi (replikadan okuma)
async function tumAlerjenler() {
  const [satirlar] = await okuma.query('SELECT id, ad FROM alerjenler ORDER BY ad ASC');
  return satirlar;
}

// Kullanıcının kayıtlı alerjenleri (kayıt sonrası tutarlılık için kaynaktan da okunabilir)
async function kullaniciAlerjenleri(kullaniciId, kaynaktan = false) {
  const havuz = kaynaktan ? yazma : okuma;
  const [satirlar] = await havuz.query(
    'SELECT alerjen_id FROM kullanici_alerjenleri WHERE kullanici_id = ?',
    [kullaniciId]
  );
  return satirlar.map((s) => s.alerjen_id);
}

// Kullanıcının alerjen tercihlerini güncelleme (kaynak sunucu)
async function kullaniciAlerjenKaydet(kullaniciId, alerjenIdler) {
  const baglanti = await yazma.getConnection();
  try {
    await baglanti.beginTransaction();
    await baglanti.query('DELETE FROM kullanici_alerjenleri WHERE kullanici_id = ?', [kullaniciId]);
    if (Array.isArray(alerjenIdler) && alerjenIdler.length > 0) {
      for (const aId of alerjenIdler) {
        await baglanti.query(
          'INSERT INTO kullanici_alerjenleri (kullanici_id, alerjen_id) VALUES (?, ?)',
          [kullaniciId, aId]
        );
      }
    }
    await baglanti.commit();
  } catch (err) {
    await baglanti.rollback();
    throw err;
  } finally {
    baglanti.release();
  }
}

module.exports = {
  epostaIleGetir,
  idIleGetir,
  bakiyeGetirKaynaktan,
  bakiyeYukle,
  bakiyeHareketleriGetir,
  tumAlerjenler,
  kullaniciAlerjenleri,
  kullaniciAlerjenKaydet,
};
