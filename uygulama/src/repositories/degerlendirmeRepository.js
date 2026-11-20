const { yazma, okuma } = require('../db');
const { kuralHatasi } = require('../utils/hataYardimcisi');

// Kullanıcının kullanılmış rezervasyonları ve varsa verdiği puanlar
async function degerlendirilebilirMenuler(kullaniciId) {
  const [satirlar] = await okuma.query(
    `SELECT
       r.id AS rezervasyon_id,
       r.menu_id,
       r.kullanma_zamani,
       m.tarih,
       yh.ad AS yemekhane,
       o.ad AS ogun,
       d.id AS degerlendirme_id,
       d.puan,
       d.yorum,
       d.olusturma AS degerlendirme_zamani
     FROM rezervasyonlar r
     JOIN menuler m ON m.id = r.menu_id
     JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
     JOIN ogunler o ON o.id = m.ogun_id
     LEFT JOIN degerlendirmeler d ON d.menu_id = r.menu_id AND d.kullanici_id = r.kullanici_id
     WHERE r.kullanici_id = ? AND r.durum = 'kullanildi'
     ORDER BY m.tarih DESC, o.sira DESC`,
    [kullaniciId]
  );
  return satirlar;
}

// Menüye ait tüm değerlendirmeleri getir (replikadan)
async function menuDegerlendirmeleri(menuId) {
  const [satirlar] = await okuma.query(
    `SELECT d.id, d.puan, d.yorum, d.olusturma, k.ad, k.soyad, k.rol
     FROM degerlendirmeler d
     JOIN kullanicilar k ON k.id = d.kullanici_id
     WHERE d.menu_id = ?
     ORDER BY d.olusturma DESC`,
    [menuId]
  );
  return satirlar;
}

// Yeni değerlendirme kaydet (kaynak sunucuya yazılır)
async function degerlendirmeKaydet(kullaniciId, menuId, puan, yorum) {
  const [rez] = await okuma.query(
    `SELECT id FROM rezervasyonlar WHERE kullanici_id = ? AND menu_id = ? AND durum = 'kullanildi' LIMIT 1`,
    [kullaniciId, menuId]
  );
  if (!rez || rez.length === 0) {
    throw kuralHatasi('Sadece kullanılmış (turnikeden geçilmiş) menülere değerlendirme yapabilirsiniz.');
  }

  const puanSayi = Number(puan);
  if (isNaN(puanSayi) || puanSayi < 1 || puanSayi > 5) {
    throw kuralHatasi('Puan 1 ile 5 arasında olmalıdır.');
  }

  const temizYorum = (yorum || '').trim();

  await yazma.query(
    `INSERT INTO degerlendirmeler (kullanici_id, menu_id, puan, yorum)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE puan = VALUES(puan), yorum = VALUES(yorum)`,
    [kullaniciId, menuId, puanSayi, temizYorum || null]
  );
}

module.exports = {
  degerlendirilebilirMenuler,
  menuDegerlendirmeleri,
  degerlendirmeKaydet,
};
