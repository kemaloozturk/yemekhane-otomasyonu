const degerlendirmeRepository = require('../repositories/degerlendirmeRepository');
const { kullaniciHataMesaji } = require('../utils/hataYardimcisi');

// Değerlendirme sayfası
async function degerlendirmeSayfasi(req, res) {
  try {
    const kullanilmisMenuler = await degerlendirmeRepository.degerlendirilebilirMenuler(req.kullanici.id);

    res.render('degerlendirme/degerlendirme', {
      baslik: 'Menü Değerlendirme',
      kullanilmisMenuler,
      mesaj: req.query.mesaj || null,
      hata: req.query.hata || null,
    });
  } catch (err) {
    console.error('Değerlendirme sayfası hatası:', err);
    res.status(500).render('hata', {
      baslik: 'Hata',
      mesaj: 'Değerlendirme sayfası yüklenirken bir hata oluştu.',
    });
  }
}

// Değerlendirme kaydet
async function degerlendirmeGonder(req, res) {
  const menuId = Number(req.body.menu_id);
  const puan = Number(req.body.puan);
  const yorum = req.body.yorum || '';

  if (!menuId || !puan) {
    return res.redirect('/degerlendirme?hata=' + encodeURIComponent('Lütfen bir puan (1-5) seçin.'));
  }

  try {
    await degerlendirmeRepository.degerlendirmeKaydet(req.kullanici.id, menuId, puan, yorum);
    res.redirect('/degerlendirme?mesaj=' + encodeURIComponent('Değerlendirmeniz ve yorumunuz başarıyla kaydedildi.'));
  } catch (err) {
    console.error('Değerlendirme gönderme hatası:', err);
    const mesaj = kullaniciHataMesaji(err, 'Değerlendirme kaydedilirken bir hata oluştu.');
    res.redirect('/degerlendirme?hata=' + encodeURIComponent(mesaj));
  }
}

module.exports = {
  degerlendirmeSayfasi,
  degerlendirmeGonder,
};
