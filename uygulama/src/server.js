const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { oturumYukle } = require('./middlewares/authMiddleware');
const routes = require('./routes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Oturumu Redis'ten çekip req.kullanici ve res.locals'a bağla
app.use(oturumYukle);

app.use(routes);

// Genel hata yakalayıcı
app.use((err, req, res, next) => {
  console.error('Beklenmeyen sunucu hatası:', err);
  res.status(500).render('hata', {
    baslik: 'Sunucu Hatası',
    mesaj: 'Sunucu tarafında beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
  });
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Uygulama ${PORT} portunda dinliyor`);
});
