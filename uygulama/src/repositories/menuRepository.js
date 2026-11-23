const { yazma, okuma } = require('../db');
const redis = require('../redis');

// Tarih değerini YYYY-MM-DD biçimine çevirir
function tarihFormatla(tarih) {
  if (!tarih) return '';
  if (tarih instanceof Date) {
    const yil = tarih.getFullYear();
    const ay = String(tarih.getMonth() + 1).padStart(2, '0');
    const gun = String(tarih.getDate()).padStart(2, '0');
    return `${yil}-${ay}-${gun}`;
  }
  return String(tarih).slice(0, 10);
}

// Günün sonuna kadar kalan saniyeyi hesaplar
function gunSonunaKalanSaniye(tarihStr) {
  const hedef = new Date(tarihStr ? `${tarihStr}T23:59:59` : Date.now());
  if (isNaN(hedef.getTime())) {
    return 3600; // Varsayılan 1 saat
  }
  const fark = Math.floor((hedef.getTime() - Date.now()) / 1000);
  return fark > 0 ? fark : 3600;
}

// Günün menüsünü getir:
// Sabit menü verisi (yemek listesi, kalori, alerjen, fiyat) Redis önbelleğinden okunur;
// canlı değişen veriler (boş kontenjan, doluluk, değerlendirme puanı) her zaman replikadan taze okunur.
async function gununMenusu(yemekhaneId, tarih, ogunId) {
  const tarihStr = tarihFormatla(tarih);
  const redisAnahtar = `menu:${yemekhaneId}:${tarihStr}:${ogunId}`;

  let sabitMenu = null;

  try {
    const onbellek = await redis.get(redisAnahtar);
    if (onbellek) {
      console.log(`[REDIS ÖNBELLEK HIT] ${redisAnahtar}`);
      sabitMenu = JSON.parse(onbellek);
    }
  } catch (err) {
    console.warn('Redis okuma hatası, DB kullanılıyor:', err.message);
  }

  if (!sabitMenu) {
    console.log(`[DB OKUMA] ${redisAnahtar} replikadan çekiliyor...`);
    const [satirlar] = await okuma.query(
      `SELECT * FROM v_menu_detay
       WHERE yemekhane_id = ? AND tarih = ? AND ogun_id = ?
       ORDER BY kategori_sira, yemek`,
      [yemekhaneId, tarihStr, ogunId]
    );

    if (!satirlar || satirlar.length === 0) {
      return null;
    }

    const ilk = satirlar[0];
    const yemekler = [];
    let toplamKalori = 0;
    let tumuVejetaryen = true;
    const alerjenSet = new Set();

    for (const satir of satirlar) {
      if (satir.yemek_id) {
        yemekler.push({
          id: satir.yemek_id,
          ad: satir.yemek,
          kategori: satir.kategori,
          kalori: satir.kalori,
          vejetaryen: satir.vejetaryen === 1,
          alerjenler: satir.alerjenler ? satir.alerjenler.split(', ') : [],
          alerjen_idler: satir.alerjen_idler ? satir.alerjen_idler.split(',').map(Number) : [],
        });
        toplamKalori += Number(satir.kalori || 0);
        if (satir.vejetaryen !== 1) tumuVejetaryen = false;
        if (satir.alerjenler) {
          satir.alerjenler.split(', ').forEach((a) => alerjenSet.add(a));
        }
      }
    }

    sabitMenu = {
      id: ilk.menu_id,
      yemekhane_id: ilk.yemekhane_id,
      yemekhane: ilk.yemekhane,
      tarih: tarihFormatla(ilk.tarih),
      ogun_id: ilk.ogun_id,
      ogun: ilk.ogun,
      rezervasyon_son: ilk.rezervasyon_son,
      ogrenci_fiyati: Number(ilk.ogrenci_fiyati),
      personel_fiyati: Number(ilk.personel_fiyati),
      toplamKalori,
      vejetaryen: tumuVejetaryen,
      alerjenler: Array.from(alerjenSet),
      yemekler,
    };

    // Yalnızca sabit menü bilgisini Redis'e kaydet (doluluk/puan önbelleğe alınmaz)
    try {
      const ttl = gunSonunaKalanSaniye(tarihStr);
      await redis.set(redisAnahtar, JSON.stringify(sabitMenu), 'EX', ttl);
      console.log(`[REDIS KAYIT] ${redisAnahtar} TTL: ${ttl} sn`);
    } catch (err) {
      console.warn('Redis yazma hatası:', err.message);
    }
  }

  // Canlı doluluk, son saat kontrolü ve puan bilgilerini her istekte replikadan taze çek
  const [[doluluk]] = await okuma.query(
    `SELECT kapasite, rezerve, bos_yer, doluluk_yuzde, (rezervasyon_son <= NOW()) AS sure_gecti
     FROM v_menu_doluluk WHERE menu_id = ?`,
    [sabitMenu.id]
  );
  const [[puanBilgi]] = await okuma.query(
    `SELECT oy_sayisi, ortalama_puan FROM v_menu_puan WHERE menu_id = ?`,
    [sabitMenu.id]
  );

  return {
    ...sabitMenu,
    kapasite: doluluk ? doluluk.kapasite : null,
    rezerve: doluluk ? doluluk.rezerve : 0,
    bos_yer: doluluk ? doluluk.bos_yer : 0,
    doluluk_yuzde: doluluk ? doluluk.doluluk_yuzde : 0,
    sure_gecti: doluluk ? Boolean(doluluk.sure_gecti) : false,
    oy_sayisi: puanBilgi ? puanBilgi.oy_sayisi : 0,
    ortalama_puan: puanBilgi && puanBilgi.ortalama_puan ? Number(puanBilgi.ortalama_puan) : null,
  };
}

// Haftalık menüleri doluluk ve puan bilgileriyle getirme (replikadan)
async function haftalikMenuler(yemekhaneId, baslangicTarihi, bitisTarihi) {
  const [menuler] = await okuma.query(
    `SELECT
       d.menu_id,
       d.tarih,
       d.yemekhane_id,
       d.yemekhane,
       d.ogun_id,
       d.ogun,
       d.kapasite,
       d.rezerve,
       d.bos_yer,
       d.doluluk_yuzde,
       d.rezervasyon_son,
       (d.rezervasyon_son <= NOW()) AS gecmis,
       m.ogrenci_fiyati,
       m.personel_fiyati,
       p.oy_sayisi,
       p.ortalama_puan
     FROM v_menu_doluluk d
     JOIN menuler m ON m.id = d.menu_id
     LEFT JOIN v_menu_puan p ON p.menu_id = d.menu_id
     WHERE d.yemekhane_id = ?
       AND d.tarih BETWEEN ? AND ?
     ORDER BY d.tarih ASC, d.ogun_id ASC`,
    [yemekhaneId, baslangicTarihi, bitisTarihi]
  );

  for (const m of menuler) {
    const [yemekler] = await okuma.query(
      `SELECT y.ad, y.kalori, y.vejetaryen
       FROM menu_yemekleri my
       JOIN yemekler y ON y.id = my.yemek_id
       JOIN yemek_kategorileri k ON k.id = y.kategori_id
       WHERE my.menu_id = ?
       ORDER BY k.sira ASC`,
      [m.menu_id]
    );
    m.tarih = tarihFormatla(m.tarih);
    m.yemekler = yemekler;
    m.gecmis = Boolean(m.gecmis);
  }

  return menuler;
}

// Yönetici paneli için planlanmış menüleri doluluk ve puanlarıyla getir (replikadan)
async function yoneticiMenuleriniGetir(yemekhaneId, limit = 30) {
  const [menuler] = await okuma.query(
    `SELECT
       d.menu_id,
       d.tarih,
       d.yemekhane_id,
       d.yemekhane,
       d.ogun_id,
       d.ogun,
       d.kapasite,
       d.rezerve,
       d.bos_yer,
       d.doluluk_yuzde,
       d.rezervasyon_son,
       (d.rezervasyon_son <= NOW()) AS gecmis,
       m.ogrenci_fiyati,
       m.personel_fiyati,
       p.oy_sayisi,
       p.ortalama_puan
     FROM v_menu_doluluk d
     JOIN menuler m ON m.id = d.menu_id
     LEFT JOIN v_menu_puan p ON p.menu_id = d.menu_id
     WHERE d.yemekhane_id = ?
     ORDER BY d.tarih DESC, d.ogun_id ASC
     LIMIT ?`,
    [yemekhaneId, limit]
  );
  for (const m of menuler) {
    m.tarih = tarihFormatla(m.tarih);
  }
  return menuler;
}

// Menü kimliğine göre detay getirme (düzenleme formu ve detay için - replikadan)
async function menuDetayGetir(menuId) {
  const [[menuSatir]] = await okuma.query(
    `SELECT id, yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati
     FROM menuler WHERE id = ? LIMIT 1`,
    [menuId]
  );
  if (!menuSatir) return null;

  const [yemekSatirlari] = await okuma.query(
    `SELECT yemek_id FROM menu_yemekleri WHERE menu_id = ?`,
    [menuId]
  );

  return {
    id: menuSatir.id,
    yemekhane_id: menuSatir.yemekhane_id,
    tarih: tarihFormatla(menuSatir.tarih),
    ogun_id: menuSatir.ogun_id,
    ogrenci_fiyati: Number(menuSatir.ogrenci_fiyati),
    personel_fiyati: Number(menuSatir.personel_fiyati),
    yemek_idler: yemekSatirlari.map((y) => y.yemek_id),
  };
}

// Yemekhaneler listesi (replikadan)
async function yemekhaneleriGetir() {
  const [satirlar] = await okuma.query('SELECT * FROM yemekhaneler ORDER BY id ASC');
  return satirlar;
}

// Öğünler listesi (replikadan)
async function ogunleriGetir() {
  const [satirlar] = await okuma.query('SELECT * FROM ogunler ORDER BY sira ASC');
  return satirlar;
}

// Tüm yemekler (kategoriye göre sıralı - replikadan)
async function tumYemekleriGetir() {
  const [satirlar] = await okuma.query(
    `SELECT y.id, y.ad, y.kalori, y.vejetaryen, k.ad AS kategori
     FROM yemekler y
     JOIN yemek_kategorileri k ON k.id = y.kategori_id
     ORDER BY k.sira ASC, y.ad ASC`
  );
  return satirlar;
}

// Önbellek geçersizleştirme (yönetici menüyü eklediğinde, güncellediğinde veya sildiğinde çağrılır)
async function onbellekTemizle(yemekhaneId, tarih, ogunId) {
  const anahtar = `menu:${yemekhaneId}:${tarihFormatla(tarih)}:${ogunId}`;
  try {
    await redis.del(anahtar);
    console.log(`[REDIS ÖNBELLEK SİLİNDİ] ${anahtar}`);
  } catch (err) {
    console.warn('Redis silme hatası:', err.message);
  }
}

// Yeni menü ekleme (kaynak sunucuya yazılır)
async function menuEkle({ yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idler }) {
  const baglanti = await yazma.getConnection();
  try {
    await baglanti.beginTransaction();

    const [ekleSonuc] = await baglanti.query(
      `INSERT INTO menuler (yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati)
       VALUES (?, ?, ?, ?, ?)`,
      [yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati]
    );
    const yeniMenuId = ekleSonuc.insertId;

    if (Array.isArray(yemek_idler) && yemek_idler.length > 0) {
      for (const yId of yemek_idler) {
        await baglanti.query(
          `INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES (?, ?)`,
          [yeniMenuId, yId]
        );
      }
    }

    await baglanti.commit();

    // Önbellek temizle
    await onbellekTemizle(yemekhane_id, tarih, ogun_id);

    return yeniMenuId;
  } catch (err) {
    await baglanti.rollback();
    throw err;
  } finally {
    baglanti.release();
  }
}

// Menü güncelleme (kaynak sunucu) + eski ve yeni önbellek anahtarlarını temizleme
async function menuGuncelle({ menu_id, yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idler }) {
  const baglanti = await yazma.getConnection();
  try {
    await baglanti.beginTransaction();

    const [eskiSatirlar] = await baglanti.query(
      'SELECT yemekhane_id, tarih, ogun_id FROM menuler WHERE id = ? FOR UPDATE',
      [menu_id]
    );
    if (!eskiSatirlar || eskiSatirlar.length === 0) {
      await baglanti.rollback();
      return false;
    }
    const eski = eskiSatirlar[0];

    await baglanti.query(
      `UPDATE menuler
       SET yemekhane_id = ?, tarih = ?, ogun_id = ?, ogrenci_fiyati = ?, personel_fiyati = ?
       WHERE id = ?`,
      [yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, menu_id]
    );

    await baglanti.query('DELETE FROM menu_yemekleri WHERE menu_id = ?', [menu_id]);

    if (Array.isArray(yemek_idler) && yemek_idler.length > 0) {
      for (const yId of yemek_idler) {
        await baglanti.query(
          `INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES (?, ?)`,
          [menu_id, yId]
        );
      }
    }

    await baglanti.commit();

    // Eski ve yeni anahtarları Redis önbelleğinden sil
    await onbellekTemizle(eski.yemekhane_id, eski.tarih, eski.ogun_id);
    if (
      Number(eski.yemekhane_id) !== Number(yemekhane_id) ||
      tarihFormatla(eski.tarih) !== tarihFormatla(tarih) ||
      Number(eski.ogun_id) !== Number(ogun_id)
    ) {
      await onbellekTemizle(yemekhane_id, tarih, ogun_id);
    }

    return true;
  } catch (err) {
    await baglanti.rollback();
    throw err;
  } finally {
    baglanti.release();
  }
}

// Menü silme (kaynak sunucu)
async function menuSil(menuId) {
  const [mevcut] = await yazma.query('SELECT yemekhane_id, tarih, ogun_id FROM menuler WHERE id = ?', [menuId]);
  if (mevcut.length > 0) {
    await yazma.query('DELETE FROM menuler WHERE id = ?', [menuId]);
    await onbellekTemizle(mevcut[0].yemekhane_id, mevcut[0].tarih, mevcut[0].ogun_id);
  }
}

module.exports = {
  gununMenusu,
  haftalikMenuler,
  yoneticiMenuleriniGetir,
  menuDetayGetir,
  yemekhaneleriGetir,
  ogunleriGetir,
  tumYemekleriGetir,
  onbellekTemizle,
  menuEkle,
  menuGuncelle,
  menuSil,
};
