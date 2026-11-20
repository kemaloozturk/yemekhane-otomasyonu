const oturumRepository = require('../repositories/oturumRepository');

async function oturumYukle(req, res, next) {
  try {
    const token = req.cookies.oturum;
    if (token) {
      const kullanici = await oturumRepository.oturumGetir(token);
      if (kullanici) {
        req.kullanici = kullanici;
        req.oturumToken = token;
        res.locals.kullanici = kullanici;
      } else {
        res.clearCookie('oturum');
        res.locals.kullanici = null;
      }
    } else {
      res.locals.kullanici = null;
    }
  } catch (err) {
    console.error('Oturum yükleme hatası:', err.message);
    res.locals.kullanici = null;
  }
  next();
}

function girisGerekli(req, res, next) {
  if (!req.kullanici) {
    return res.redirect('/giris?hata=' + encodeURIComponent('Bu sayfayı görüntülemek için lütfen giriş yapın.'));
  }
  next();
}

function yoneticiGerekli(req, res, next) {
  if (!req.kullanici) {
    return res.redirect('/giris?hata=' + encodeURIComponent('Yönetici girişi gereklidir.'));
  }
  if (req.kullanici.rol !== 'yonetici') {
    return res.status(403).render('hata', {
      baslik: 'Yetkisiz Erişim',
      mesaj: 'Bu alana yalnızca yemekhane yöneticileri erişebilir.',
    });
  }
  next();
}

module.exports = {
  oturumYukle,
  girisGerekli,
  yoneticiGerekli,
};
