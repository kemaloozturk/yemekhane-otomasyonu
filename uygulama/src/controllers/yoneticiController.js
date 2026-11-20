const menuRepository = require('../repositories/menuRepository');
const { kullaniciHataMesaji } = require('../utils/hataYardimcisi');

// Yemekleri kategorilerine göre gruplar
function yemekleriGrupla(yemekler) {
  const gruplu = {};
  for (const y of yemekler) {
    if (!gruplu[y.kategori]) {
      gruplu[y.kategori] = [];
    }
    gruplu[y.kategori].push(y);
  }
  return gruplu;
}

// Yönetici Ana Paneli
async function panel(req, res) {
  try {
    const yemekhaneler = await menuRepository.yemekhaneleriGetir();
    const secilenYemekhaneId = Number(req.query.yemekhane_id || (yemekhaneler[0] ? yemekhaneler[0].id : 1));
    const menuler = await menuRepository.yoneticiMenuleriniGetir(secilenYemekhaneId);

    res.render('yonetici/panel', {
      baslik: 'Yönetici Paneli',
      yemekhaneler,
      secilenYemekhaneId,
      menuler,
      mesaj: req.query.mesaj || null,
      hata: req.query.hata || null,
    });
  } catch (err) {
    console.error('Yönetici paneli hatası:', err);
    res.status(500).render('hata', {
      baslik: 'Hata',
      mesaj: 'Yönetici paneli yüklenirken bir hata oluştu.',
    });
  }
}

// Yeni Menü Oluşturma Formu
async function yeniMenuSayfasi(req, res) {
  try {
    const yemekhaneler = await menuRepository.yemekhaneleriGetir();
    const ogunler = await menuRepository.ogunleriGetir();
    const yemekler = await menuRepository.tumYemekleriGetir();

    res.render('yonetici/menuEkle', {
      baslik: 'Yeni Menü Oluştur',
      yemekhaneler,
      ogunler,
      grupluYemekler: yemekleriGrupla(yemekler),
      mesaj: req.query.mesaj || null,
      hata: req.query.hata || null,
    });
  } catch (err) {
    console.error('Menü oluşturma sayfası hatası:', err);
    res.status(500).render('hata', {
      baslik: 'Hata',
      mesaj: 'Menü oluşturma formu yüklenirken bir hata oluştu.',
    });
  }
}

// Yeni Menü Kaydet
async function menuKaydet(req, res) {
  try {
    const { yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati } = req.body;
    let yemek_idler = req.body.yemek_idler;

    if (!yemek_idler) {
      return res.redirect('/yonetici/yeni-menu?hata=' + encodeURIComponent('Lütfen en az bir yemek seçin.'));
    }
    if (!Array.isArray(yemek_idler)) {
      yemek_idler = [yemek_idler];
    }

    await menuRepository.menuEkle({
      yemekhane_id: Number(yemekhane_id),
      tarih,
      ogun_id: Number(ogun_id),
      ogrenci_fiyati: Number(ogrenci_fiyati),
      personel_fiyati: Number(personel_fiyati),
      yemek_idler: yemek_idler.map(Number),
    });

    res.redirect('/yonetici?mesaj=' + encodeURIComponent('Menü başarıyla oluşturuldu ve önbellek güncellendi.'));
  } catch (err) {
    console.error('Menü ekleme hatası:', err);
    const mesaj = kullaniciHataMesaji(err, 'Menü kaydedilirken bir hata oluştu.');
    res.redirect('/yonetici/yeni-menu?hata=' + encodeURIComponent(mesaj));
  }
}

// Menü Düzenleme Formu
async function menuDuzenleSayfasi(req, res) {
  try {
    const menuId = Number(req.params.id);
    if (!menuId) {
      return res.redirect('/yonetici?hata=' + encodeURIComponent('Geçersiz menü kimliği.'));
    }

    const menu = await menuRepository.menuDetayGetir(menuId);
    if (!menu) {
      return res.redirect('/yonetici?hata=' + encodeURIComponent('Düzenlenecek menü bulunamadı.'));
    }

    const yemekhaneler = await menuRepository.yemekhaneleriGetir();
    const ogunler = await menuRepository.ogunleriGetir();
    const yemekler = await menuRepository.tumYemekleriGetir();

    res.render('yonetici/menuDuzenle', {
      baslik: 'Menü Düzenle',
      menu,
      yemekhaneler,
      ogunler,
      grupluYemekler: yemekleriGrupla(yemekler),
      mesaj: req.query.mesaj || null,
      hata: req.query.hata || null,
    });
  } catch (err) {
    console.error('Menü düzenleme sayfası hatası:', err);
    res.status(500).render('hata', {
      baslik: 'Hata',
      mesaj: 'Menü düzenleme formu yüklenirken bir hata oluştu.',
    });
  }
}

// Menü Güncelle
async function menuGuncelle(req, res) {
  const menuId = Number(req.params.id);
  if (!menuId) {
    return res.redirect('/yonetici?hata=' + encodeURIComponent('Geçersiz menü kimliği.'));
  }

  try {
    const { yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati } = req.body;
    let yemek_idler = req.body.yemek_idler;

    if (!yemek_idler) {
      return res.redirect(`/yonetici/menu/${menuId}/duzenle?hata=` + encodeURIComponent('Lütfen en az bir yemek seçin.'));
    }
    if (!Array.isArray(yemek_idler)) {
      yemek_idler = [yemek_idler];
    }

    const guncellendi = await menuRepository.menuGuncelle({
      menu_id: menuId,
      yemekhane_id: Number(yemekhane_id),
      tarih,
      ogun_id: Number(ogun_id),
      ogrenci_fiyati: Number(ogrenci_fiyati),
      personel_fiyati: Number(personel_fiyati),
      yemek_idler: yemek_idler.map(Number),
    });

    if (!guncellendi) {
      return res.redirect('/yonetici?hata=' + encodeURIComponent('Güncellenecek menü bulunamadı.'));
    }

    res.redirect('/yonetici?mesaj=' + encodeURIComponent('Menü başarıyla güncellendi ve Redis önbelleği temizlendi.'));
  } catch (err) {
    console.error('Menü güncelleme hatası:', err);
    const mesaj = kullaniciHataMesaji(err, 'Menü güncellenirken bir hata oluştu.');
    res.redirect(`/yonetici/menu/${menuId}/duzenle?hata=` + encodeURIComponent(mesaj));
  }
}

// Menü Sil
async function menuSil(req, res) {
  try {
    const menuId = Number(req.body.menu_id);
    if (menuId) {
      await menuRepository.menuSil(menuId);
    }
    res.redirect('/yonetici?mesaj=' + encodeURIComponent('Menü silindi ve önbellek temizlendi.'));
  } catch (err) {
    console.error('Menü silme hatası:', err);
    const mesaj = kullaniciHataMesaji(err, 'Menü silinirken bir hata oluştu.');
    res.redirect('/yonetici?hata=' + encodeURIComponent(mesaj));
  }
}

module.exports = {
  panel,
  yeniMenuSayfasi,
  menuKaydet,
  menuDuzenleSayfasi,
  menuGuncelle,
  menuSil,
};
