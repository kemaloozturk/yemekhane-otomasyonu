const kullaniciRepository = require('../repositories/kullaniciRepository');

// Profil / Alerjen Tercihleri Sayfası
async function alerjenSayfasi(req, res) {
  try {
    const tumAlerjenler = await kullaniciRepository.tumAlerjenler();
    // Kayıt sonrası replikasyon gecikmesini önlemek için kaynaktan okunur
    const kayitliAlerjenler = await kullaniciRepository.kullaniciAlerjenleri(req.kullanici.id, true);

    res.render('profil/alerjenler', {
      baslik: 'Alerjen Tercihlerim',
      tumAlerjenler,
      kayitliAlerjenler,
      mesaj: req.query.mesaj || null,
      hata: req.query.hata || null,
    });
  } catch (err) {
    console.error('Alerjen sayfası hatası:', err);
    res.status(500).render('hata', {
      baslik: 'Hata',
      mesaj: 'Alerjen tercihleri yüklenirken bir hata oluştu.',
    });
  }
}

// Alerjen Tercihlerini Kaydet
async function alerjenKaydet(req, res) {
  try {
    let alerjen_idler = req.body.alerjen_idler || [];
    if (!Array.isArray(alerjen_idler)) {
      alerjen_idler = [alerjen_idler];
    }
    const idler = alerjen_idler.map(Number).filter((n) => !isNaN(n) && n > 0);

    await kullaniciRepository.kullaniciAlerjenKaydet(req.kullanici.id, idler);

    res.redirect('/profil/alerjenler?mesaj=' + encodeURIComponent('Alerjen tercihleriniz güncellendi. Menülerde bu alerjenler uyarı ile gösterilecektir.'));
  } catch (err) {
    console.error('Alerjen kaydetme hatası:', err);
    res.redirect('/profil/alerjenler?hata=' + encodeURIComponent('Alerjen tercihleri kaydedilirken bir hata oluştu.'));
  }
}

module.exports = {
  alerjenSayfasi,
  alerjenKaydet,
};
