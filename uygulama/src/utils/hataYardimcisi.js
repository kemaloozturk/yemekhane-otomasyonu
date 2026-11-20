// Stored procedure ve iş kuralı hatalarını kullanıcıya güvenli biçimde iletir.
// Ham SQL / sistem hata mesajları yalnızca sunucu günlüğüne yazılır, kullanıcıya gösterilmez.

function kullaniciHataMesaji(err, varsayilan = 'İşlem sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.') {
  if (!err) return varsayilan;

  // Stored procedure SIGNAL SQLSTATE '45000' (MySQL errno 1644)
  if (err.sqlState === '45000' || err.errno === 1644) {
    return err.sqlMessage || varsayilan;
  }

  // Uygulama içi açıkça işaretlenmiş iş kuralı hatası
  if (err.isKuralHatasi && err.message) {
    return err.message;
  }

  // Yinelenen kayıt (ör. aynı yemekhane, tarih ve öğün için ikinci menü)
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    return 'Bu yemekhane, tarih ve öğün için zaten bir menü kayıtlıdır.';
  }

  return varsayilan;
}

function kuralHatasi(mesaj) {
  const err = new Error(mesaj);
  err.isKuralHatasi = true;
  return err;
}

module.exports = {
  kullaniciHataMesaji,
  kuralHatasi,
};
