const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const menuController = require('../controllers/menuController');
const rezervasyonController = require('../controllers/rezervasyonController');
const bakiyeController = require('../controllers/bakiyeController');
const degerlendirmeController = require('../controllers/degerlendirmeController');
const yoneticiController = require('../controllers/yoneticiController');

const { girisGerekli, yoneticiGerekli } = require('../middlewares/authMiddleware');

// Ana sayfa: Günün Menüsüne yönlendir
router.get('/', (req, res) => {
  res.redirect('/menu/gunun');
});

// 1. Giriş ve Çıkış (Çıkış yalnızca POST ile yapılır)
router.get('/giris', authController.girisSayfasi);
router.post('/giris', authController.girisYap);
router.post('/cikis', authController.cikisYap);

// 2. Günün Menüsü
router.get('/menu/gunun', menuController.gununMenusu);

// 3. Haftalık Menü ve Rezervasyon
router.get('/menu/haftalik', menuController.haftalikMenu);

// 4. Rezervasyon İşlemleri
router.post('/rezervasyon/yap', girisGerekli, rezervasyonController.rezervasyonYap);
router.post('/rezervasyon/iptal', girisGerekli, rezervasyonController.rezervasyonIptal);
router.get('/rezervasyonlarim', girisGerekli, rezervasyonController.rezervasyonlarim);
router.post('/turnike/gecis', yoneticiGerekli, rezervasyonController.turnikeGecisSimule);

// 5. Bakiye
router.get('/bakiye', girisGerekli, bakiyeController.bakiyeSayfasi);
router.post('/bakiye/yukle', girisGerekli, bakiyeController.bakiyeYukle);

// 6. Değerlendirme
router.get('/degerlendirme', girisGerekli, degerlendirmeController.degerlendirmeSayfasi);
router.post('/degerlendirme/yap', girisGerekli, degerlendirmeController.degerlendirmeGonder);

// 7. Yönetici Paneli
router.get('/yonetici', yoneticiGerekli, yoneticiController.panel);
router.get('/yonetici/yeni-menu', yoneticiGerekli, yoneticiController.yeniMenuSayfasi);
router.post('/yonetici/menu-kaydet', yoneticiGerekli, yoneticiController.menuKaydet);
router.get('/yonetici/menu/:id/duzenle', yoneticiGerekli, yoneticiController.menuDuzenleSayfasi);
router.post('/yonetici/menu/:id/duzenle', yoneticiGerekli, yoneticiController.menuGuncelle);
router.post('/yonetici/menu-sil', yoneticiGerekli, yoneticiController.menuSil);

module.exports = router;
