const { yazma, okuma } = require('../db');

async function kaynakSayisi() {
  const [satirlar] = await yazma.query('SELECT COUNT(*) AS sayi FROM kullanicilar');
  return satirlar[0].sayi;
}

async function replikaSayisi() {
  const [satirlar] = await okuma.query('SELECT COUNT(*) AS sayi FROM kullanicilar');
  return satirlar[0].sayi;
}

module.exports = { kaynakSayisi, replikaSayisi };
