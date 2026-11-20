const durumRepository = require('../repositories/durumRepository');

async function goster(req, res) {
  try {
    const kaynak = await durumRepository.kaynakSayisi();
    const replika = await durumRepository.replikaSayisi();
    res.render('durum', { kaynak, replika, hata: null });
  } catch (err) {
    console.error(err);
    console.error('Durum kontrol hatası:', err);
    res.status(500).render('durum', { kaynak: null, replika: null, hata: 'Veritabanı bağlantı kontrolü başarısız oldu.' });
  }
}

module.exports = { goster };
