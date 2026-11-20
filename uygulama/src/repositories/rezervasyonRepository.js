const { yazma, okuma } = require('../db');
const { kullaniciHataMesaji } = require('../utils/hataYardimcisi');

// Rezervasyon Yap (sp_rezervasyon_yap - kaynak sunucuda çalışır)
async function rezervasyonYap(kullaniciId, menuId) {
  try {
    const [sonuclar] = await yazma.query('CALL sp_rezervasyon_yap(?, ?)', [
      kullaniciId,
      menuId,
    ]);
    const satir = sonuclar[0] && sonuclar[0][0];
    return {
      basarili: true,
      rezervasyonId: satir ? satir.rezervasyon_id : null,
      ucret: satir ? Number(satir.ucret) : 0,
      bakiye: satir ? Number(satir.bakiye) : 0,
    };
  } catch (err) {
    console.error('sp_rezervasyon_yap hatası:', err);
    return {
      basarili: false,
      hata: kullaniciHataMesaji(err, 'Rezervasyon işlemi tamamlanamadı.'),
    };
  }
}

// Rezervasyon İptal Et (sp_rezervasyon_iptal - kaynak sunucuda çalışır)
async function rezervasyonIptal(kullaniciId, rezervasyonId) {
  try {
    const [sonuclar] = await yazma.query('CALL sp_rezervasyon_iptal(?, ?)', [kullaniciId, rezervasyonId]);
    const satir = sonuclar[0] && sonuclar[0][0];
    return {
      basarili: true,
      rezervasyonId: satir ? satir.rezervasyon_id : null,
      iade: satir ? Number(satir.iade) : 0,
      bakiye: satir ? Number(satir.bakiye) : 0,
    };
  } catch (err) {
    console.error('sp_rezervasyon_iptal hatası:', err);
    return {
      basarili: false,
      hata: kullaniciHataMesaji(err, 'Rezervasyon iptal edilemedi.'),
    };
  }
}

// Kullanıcının tüm rezervasyonları (replikadan okunur)
async function kullaniciRezervasyonlari(kullaniciId) {
  const [satirlar] = await okuma.query(
    `SELECT
       r.id,
       r.menu_id,
       r.durum,
       r.ucret,
       r.olusturma,
       r.iptal_zamani,
       r.kullanma_zamani,
       m.tarih,
       yh.ad AS yemekhane,
       o.ad AS ogun,
       TIMESTAMP(m.tarih, o.son_saat) AS rezervasyon_son,
       (TIMESTAMP(m.tarih, o.son_saat) > NOW()) AS iptal_edilebilir,
       d.puan AS degerlendirme_puan,
       d.yorum AS degerlendirme_yorum
     FROM rezervasyonlar r
     JOIN menuler m ON m.id = r.menu_id
     JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
     JOIN ogunler o ON o.id = m.ogun_id
     LEFT JOIN degerlendirmeler d ON d.menu_id = r.menu_id AND d.kullanici_id = r.kullanici_id
     WHERE r.kullanici_id = ?
     ORDER BY m.tarih DESC, o.sira DESC, r.id DESC`,
    [kullaniciId]
  );
  return satirlar;
}

// Kullanıcının rezerve ettiği aktif menü id'leri (haftalık ekranda kontrol için)
async function kullaniciAktifMenuIdleri(kullaniciId) {
  const [satirlar] = await okuma.query(
    `SELECT menu_id, durum FROM rezervasyonlar
     WHERE kullanici_id = ? AND durum IN ('aktif', 'kullanildi')`,
    [kullaniciId]
  );
  const harita = {};
  for (const s of satirlar) {
    harita[s.menu_id] = s.durum;
  }
  return harita;
}

// Turnike geçiş (sp_turnike_gecis - yalnızca yönetici yetkisiyle çağrılır)
async function turnikeGecis(kullaniciId, yemekhaneId, zaman = null) {
  try {
    const [sonuclar] = await yazma.query('CALL sp_turnike_gecis(?, ?, ?)', [kullaniciId, yemekhaneId, zaman]);
    const satir = sonuclar[0] && sonuclar[0][0];
    return {
      basarili: true,
      rezervasyonId: satir ? satir.rezervasyon_id : null,
      menuId: satir ? satir.menu_id : null,
      ogun: satir ? satir.ogun : null,
    };
  } catch (err) {
    console.error('sp_turnike_gecis hatası:', err);
    return {
      basarili: false,
      hata: kullaniciHataMesaji(err, 'Turnike geçişi işlenemedi.'),
    };
  }
}

module.exports = {
  rezervasyonYap,
  rezervasyonIptal,
  kullaniciRezervasyonlari,
  kullaniciAktifMenuIdleri,
  turnikeGecis,
};
