const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const routes = require('./routes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(routes);

const PORT = 8000;
app.listen(PORT, () => console.log(`Uygulama ${PORT} portunda dinliyor`));
