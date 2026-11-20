const rezervasyonRepository = require('../repositories/rezervasyonRepository');
const kullaniciRepository = require('../repositories/kullaniciRepository');
const oturumRepository = require('../repositories/oturumRepository');
const { kullaniciHataMesaji } = require('../utils/hataYardimcisi');

// Open redirect koruması: yalnızca site içi göreli adreslere izin verir
function guvenliDonusUrl(url, varsayilan = '/menu/haftalik') {
  if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) {
    return url;
  }
  return varsayilan;
}

// Rezervasyon Yap (sp_rezervasyon_yap)
async function rezervasyonYap(req, res) {
  const menuId = Number(req.body.menu_id);
  const donusUrl = guvenliDonusUrl(req.body.donus_url, '/menu/haftalik');

  if (!menuId) {
    return res.redirect(donusUrl + (donusUrl.includes('?') ? '&' : '?') + 'hata=' + encodeURIComponent('Geçersiz menü seçimi.'));
  }

  try {
    const sonuc = await rezervasyonRepository.rezervasyonYap(req.kullanici.id, menuId);

    if (!sonuc.basarili) {
      return res.redirect(donusUrl + (donusUrl.includes('?') ? '&' : '?') + 'hata=' + encodeURIComponent(sonuc.hata));
    }

    // Rezervasyondan hemen sonra gösterilen bakiye kaynaktan (Primary) okunur
    const guncelBakiye = await kullaniciRepository.bakiyeGetirKaynaktan(req.kullanici.id);

    if (req.oturumToken) {
      await oturumRepository.oturumGuncelle(req.oturumToken, { bakiye: guncelBakiye });
    }

    const mesaj = `Rezervasyonunuz onaylandı. Çekilen tutar: ${sonuc.ucret.toFixed(2)} TL. Güncel bakiyeniz: ${guncelBakiye.toFixed(2)} TL`;
    res.redirect(donusUrl + (donusUrl.includes('?') ? '&' : '?') + 'mesaj=' + encodeURIComponent(mesaj));
  } catch (err) {
    console.error('Rezervasyon yapma hatası:', err);
    const mesaj = kullaniciHataMesaji(err, 'Rezervasyon işlemi sırasında bir hata oluştu.');
    res.redirect(donusUrl + (donusUrl.includes('?') ? '&' : '?') + 'hata=' + encodeURIComponent(mesaj));
  }
}

// Rezervasyon İptal (sp_rezervasyon_iptal)
async function rezervasyonIptal(req, res) {
  const rezervasyonId = Number(req.body.rezervasyon_id);

  if (!rezervasyonId) {
    return res.redirect('/rezervasyonlarim?hata=' + encodeURIComponent('Geçersiz rezervasyon.'));
  }

  try {
    const sonuc = await rezervasyonRepository.rezervasyonIptal(req.kullanici.id, rezervasyonId);

    if (!sonuc.basarili) {
      return res.redirect('/rezervasyonlarim?hata=' + encodeURIComponent(sonuc.hata));
    }

    const guncelBakiye = await kullaniciRepository.bakiyeGetirKaynaktan(req.kullanici.id);

    if (req.oturumToken) {
      await oturumRepository.oturumGuncelle(req.oturumToken, { bakiye: guncelBakiye });
    }

    const mesaj = `Rezervasyon iptal edildi. İade edilen tutar: ${sonuc.iade.toFixed(2)} TL. Güncel bakiyeniz: ${guncelBakiye.toFixed(2)} TL`;
    res.redirect('/rezervasyonlarim?mesaj=' + encodeURIComponent(mesaj));
  } catch (err) {
    console.error('Rezervasyon iptal hatası:', err);
    const mesaj = kullaniciHataMesaji(err, 'Rezervasyon iptal edilirken bir hata oluştu.');
    res.redirect('/rezervasyonlarim?hata=' + encodeURIComponent(mesaj));
  }
}

// Rezervasyonlarım listesi
async function rezervasyonlarim(req, res) {
  try {
    const rezervasyonlar = await rezervasyonRepository.kullaniciRezervasyonlari(req.kullanici.id);
    const guncelBakiye = await kullaniciRepository.bakiyeGetirKaynaktan(req.kullanici.id);

    res.render('rezervasyon/rezervasyonlarim', {
      baslik: 'Rezervasyonlarım',
      rezervasyonlar,
      bakiye: guncelBakiye,
      mesaj: req.query.mesaj || null,
      hata: req.query.hata || null,
    });
  } catch (err) {
    console.error('Rezervasyonlarım hatası:', err);
    res.status(500).render('hata', {
      baslik: 'Hata',
      mesaj: 'Rezervasyonlarınız yüklenirken bir hata oluştu.',
    });
  }
}

// Turnike geçiş (yalnızca yönetici yetkisiyle, zaman sunucu tarafından belirlenir)
async function turnikeGecisSimule(req, res) {
  const yemekhaneId = Number(req.body.yemekhane_id || 1);
  const hedefKullaniciId = Number(req.body.kullanici_id || req.kullanici.id);

  try {
    // Zaman parametresi kullanıcıdan alınmaz, sunucu tarafında NULL (NOW()) olarak iletilir
    const sonuc = await rezervasyonRepository.turnikeGecis(hedefKullaniciId, yemekhaneId, null);
    if (!sonuc.basarili) {
      return res.redirect('/rezervasyonlarim?hata=' + encodeURIComponent(sonuc.hata));
    }
    res.redirect('/rezervasyonlarim?mesaj=' + encodeURIComponent(`Turnikeden geçiş yapıldı! Rezervasyon #${sonuc.rezervasyonId} kullanıldı olarak işaretlendi.`));
  } catch (err) {
    console.error('Turnike geçiş hatası:', err);
    const mesaj = kullaniciHataMesaji(err, 'Turnike geçiş işlemi sırasında bir hata oluştu.');
    res.redirect('/rezervasyonlarim?hata=' + encodeURIComponent(mesaj));
  }
}

module.exports = {
  rezervasyonYap,
  rezervasyonIptal,
  rezervasyonlarim,
  turnikeGecisSimule,
};
