// Arayüzde gösterilecek fiyatların hesaplanması (görünüm katmanında iş kuralı bulunmaması için).
// Not: Gerçek tahsil edilen ücret her zaman sp_rezervasyon_yap içinde veritabanında hesaplanır;
// buradaki değerler yalnızca kullanıcıya önizleme olarak gösterilir.

const YARIM_PORSIYON_ORANI = 0.60;

// Öğrenci öğrenci fiyatını, personel ve yönetici personel fiyatını öder.
function rolFiyati(rol, ogrenciFiyati, personelFiyati) {
  return Number(rol === 'ogrenci' ? ogrenciFiyati : personelFiyati);
}

function yarimPorsiyonFiyati(tamFiyat) {
  return Math.round(Number(tamFiyat) * YARIM_PORSIYON_ORANI * 100) / 100;
}

module.exports = {
  YARIM_PORSIYON_ORANI,
  rolFiyati,
  yarimPorsiyonFiyati,
};
