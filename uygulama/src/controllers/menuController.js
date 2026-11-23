const menuRepository = require('../repositories/menuRepository');
const rezervasyonRepository = require('../repositories/rezervasyonRepository');
const kullaniciRepository = require('../repositories/kullaniciRepository');

// Bugünün tarihini YYYY-MM-DD olarak döndürür
function bugununTarihi() {
  const d = new Date();
  const yil = d.getFullYear();
  const ay = String(d.getMonth() + 1).padStart(2, '0');
  const gun = String(d.getDate()).padStart(2, '0');
  return `${yil}-${ay}-${gun}`;
}

// Günün menüsü controller
async function gununMenusu(req, res) {
  try {
    const yemekhaneler = await menuRepository.yemekhaneleriGetir();
    const ogunler = await menuRepository.ogunleriGetir();

    const secilenYemekhaneId = Number(req.query.yemekhane_id || (yemekhaneler[0] ? yemekhaneler[0].id : 1));
    const secilenTarih = req.query.tarih || bugununTarihi();
    
    // Varsayılan öğün: saate göre öğle (2) veya akşam (3), yoksa 2
    let varsayilanOgun = 2;
    const saat = new Date().getHours();
    if (saat < 10) varsayilanOgun = 1; // kahvaltı
    else if (saat >= 15) varsayilanOgun = 3; // akşam
    const secilenOgunId = Number(req.query.ogun_id || varsayilanOgun);

    const menu = await menuRepository.gununMenusu(secilenYemekhaneId, secilenTarih, secilenOgunId);

    // Kullanıcı giriş yapmışsa bu menü için rezervasyonunu ve alerjenlerini kontrol et
    let kullaniciRezervasyonu = null;
    let kullaniciAlerjenleri = [];
    if (req.kullanici) {
      const aktifMenuIdleri = await rezervasyonRepository.kullaniciAktifMenuIdleri(req.kullanici.id);
      if (menu && aktifMenuIdleri[menu.id]) {
        kullaniciRezervasyonu = aktifMenuIdleri[menu.id];
      }
      kullaniciAlerjenleri = await kullaniciRepository.kullaniciAlerjenleri(req.kullanici.id);
    }

    res.render('menu/gunun', {
      baslik: 'Günün Menüsü',
      yemekhaneler,
      ogunler,
      secilenYemekhaneId,
      secilenTarih,
      secilenOgunId,
      menu,
      kullaniciRezervasyonu,
      kullaniciAlerjenleri,
      mesaj: req.query.mesaj || null,
      hata: req.query.hata || null,
    });
  } catch (err) {
    console.error('Günün menüsü hatası:', err);
    res.status(500).render('hata', { baslik: 'Hata', mesaj: 'Günün menüsü yüklenirken bir hata oluştu.' });
  }
}

// Haftalık menü controller
async function haftalikMenu(req, res) {
  try {
    const yemekhaneler = await menuRepository.yemekhaneleriGetir();
    const secilenYemekhaneId = Number(req.query.yemekhane_id || (yemekhaneler[0] ? yemekhaneler[0].id : 1));

    // Bugünden itibaren 7 gün
    const baslangic = new Date();
    const bitis = new Date();
    bitis.setDate(bitis.getDate() + 7);

    const baslangicStr = baslangic.toISOString().slice(0, 10);
    const bitisStr = bitis.toISOString().slice(0, 10);

    const menuler = await menuRepository.haftalikMenuler(secilenYemekhaneId, baslangicStr, bitisStr);

    let aktifMenuIdleri = {};
    if (req.kullanici) {
      aktifMenuIdleri = await rezervasyonRepository.kullaniciAktifMenuIdleri(req.kullanici.id);
    }

    res.render('menu/haftalik', {
      baslik: 'Haftalık Menü & Rezervasyon',
      yemekhaneler,
      secilenYemekhaneId,
      menuler,
      aktifMenuIdleri,
      mesaj: req.query.mesaj || null,
      hata: req.query.hata || null,
    });
  } catch (err) {
    console.error('Haftalık menü hatası:', err);
    res.status(500).render('hata', { baslik: 'Hata', mesaj: 'Haftalık menü yüklenirken bir hata oluştu.' });
  }
}

module.exports = {
  gununMenusu,
  haftalikMenu,
};
