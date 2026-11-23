const menuRepository = require('../repositories/menuRepository');
const rezervasyonRepository = require('../repositories/rezervasyonRepository');
const kullaniciRepository = require('../repositories/kullaniciRepository');
const { rolFiyati, yarimPorsiyonFiyati } = require('../utils/fiyatYardimcisi');

// Verilen tarihi yerel saat dilimine göre YYYY-MM-DD olarak döndürür
// (toISOString UTC kullandığı için gece yarısı civarında bir gün kayabilir)
function bugununTarihi(d = new Date()) {
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

    // Kullanıcının rolüne göre gösterilecek fiyatlar (görünümde iş kuralı olmaması için burada hazırlanır)
    if (menu) {
      const rol = req.kullanici ? req.kullanici.rol : 'ogrenci';
      menu.kullanici_fiyati = rolFiyati(rol, menu.ogrenci_fiyati, menu.personel_fiyati);
      menu.yarim_fiyat = yarimPorsiyonFiyati(menu.kullanici_fiyati);
      menu.yarim_porsiyon_secilebilir = Number(menu.ogun_id) !== 1;
    }

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

    const baslangicStr = bugununTarihi(baslangic);
    const bitisStr = bugununTarihi(bitis);

    const menuler = await menuRepository.haftalikMenuler(secilenYemekhaneId, baslangicStr, bitisStr);

    // Rol bazlı fiyat ve yarım porsiyon uygunluğu (görünümde iş kuralı olmaması için)
    const rol = req.kullanici ? req.kullanici.rol : 'ogrenci';
    for (const m of menuler) {
      m.kullanici_fiyati = rolFiyati(rol, m.ogrenci_fiyati, m.personel_fiyati);
      m.yarim_porsiyon_secilebilir = Number(m.ogun_id) !== 1;
    }

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
