const bcrypt = require('bcryptjs');
const kullaniciRepository = require('../repositories/kullaniciRepository');
const oturumRepository = require('../repositories/oturumRepository');

function girisSayfasi(req, res) {
  if (req.kullanici) {
    return res.redirect('/');
  }
  res.render('auth/login', {
    hata: req.query.hata || null,
    basari: req.query.basari || null,
    eposta: req.query.eposta || '',
  });
}

async function girisYap(req, res) {
  const { eposta, sifre } = req.body;

  if (!eposta || !sifre) {
    return res.render('auth/login', {
      hata: 'Lütfen e-posta adresinizi ve şifrenizi girin.',
      basari: null,
      eposta: eposta || '',
    });
  }

  try {
    const kullanici = await kullaniciRepository.epostaIleGetir(eposta.trim());
    if (!kullanici) {
      return res.render('auth/login', {
        hata: 'E-posta veya şifre hatalı.',
        basari: null,
        eposta,
      });
    }

    const sifreUyusuyor = await bcrypt.compare(sifre, kullanici.sifre_hash);
    if (!sifreUyusuyor || kullanici.aktif !== 1) {
      return res.render('auth/login', {
        hata: 'E-posta veya şifre hatalı.',
        basari: null,
        eposta,
      });
    }

    // Başarılı giriş: Redis'te oturum oluştur
    const token = await oturumRepository.oturumOlustur(kullanici);

    // Cookie olarak ayarla (30 dk)
    res.cookie('oturum', token, {
      httpOnly: true,
      maxAge: 1800 * 1000,
      sameSite: 'lax',
    });

    res.redirect('/');
  } catch (err) {
    console.error('Giriş işlemi hatası:', err);
    res.render('auth/login', {
      hata: 'Giriş işlemi sırasında bir sistem hatası oluştu. Lütfen tekrar deneyin.',
      basari: null,
      eposta,
    });
  }
}

async function cikisYap(req, res) {
  try {
    const token = req.cookies.oturum;
    if (token) {
      await oturumRepository.oturumSil(token);
    }
  } catch (err) {
    console.error('Çıkış hatası:', err);
  }
  res.clearCookie('oturum');
  res.redirect('/giris?basari=' + encodeURIComponent('Oturumunuz başarıyla kapatıldı.'));
}

module.exports = {
  girisSayfasi,
  girisYap,
  cikisYap,
};
