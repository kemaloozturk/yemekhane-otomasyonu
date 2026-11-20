const kullaniciRepository = require('../repositories/kullaniciRepository');
const oturumRepository = require('../repositories/oturumRepository');
const { kullaniciHataMesaji } = require('../utils/hataYardimcisi');

// Bakiye sayfası
async function bakiyeSayfasi(req, res) {
  try {
    const bakiye = await kullaniciRepository.bakiyeGetirKaynaktan(req.kullanici.id);
    const hareketler = await kullaniciRepository.bakiyeHareketleriGetir(req.kullanici.id);

    if (req.oturumToken) {
      await oturumRepository.oturumGuncelle(req.oturumToken, { bakiye });
    }

    res.render('bakiye/bakiye', {
      baslik: 'Bakiye İşlemleri',
      bakiye,
      hareketler,
      mesaj: req.query.mesaj || null,
      hata: req.query.hata || null,
    });
  } catch (err) {
    console.error('Bakiye sayfası hatası:', err);
    res.status(500).render('hata', {
      baslik: 'Hata',
      mesaj: 'Bakiye bilgileri yüklenirken bir hata oluştu.',
    });
  }
}

// Bakiye yükleme (sp_bakiye_yukle)
async function bakiyeYukle(req, res) {
  const tutar = Number(req.body.tutar);

  if (isNaN(tutar) || tutar < 10 || tutar > 1000) {
    return res.redirect('/bakiye?hata=' + encodeURIComponent('Yükleme tutarı 10 ile 1000 TL arasında olmalıdır.'));
  }

  try {
    const sonuc = await kullaniciRepository.bakiyeYukle(req.kullanici.id, tutar);

    if (req.oturumToken && sonuc.yeniBakiye !== null) {
      await oturumRepository.oturumGuncelle(req.oturumToken, { bakiye: sonuc.yeniBakiye });
    }

    res.redirect('/bakiye?mesaj=' + encodeURIComponent(`${tutar.toFixed(2)} TL bakiye yüklendi. Güncel bakiyeniz: ${sonuc.yeniBakiye.toFixed(2)} TL`));
  } catch (err) {
    console.error('Bakiye yükleme hatası:', err);
    const mesaj = kullaniciHataMesaji(err, 'Bakiye yükleme işlemi sırasında bir hata oluştu.');
    res.redirect('/bakiye?hata=' + encodeURIComponent(mesaj));
  }
}

module.exports = {
  bakiyeSayfasi,
  bakiyeYukle,
};
