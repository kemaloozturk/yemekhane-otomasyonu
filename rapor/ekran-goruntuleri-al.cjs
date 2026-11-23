const fs = require('fs');
const path = require('path');
const puppeteer = require('/tmp/pp/node_modules/puppeteer-core');

const DIR = path.join(__dirname, 'gorseller');
fs.mkdirSync(DIR, { recursive: true });

const BASE = 'http://localhost:8080';
const CHROME_PATH = '/usr/bin/google-chrome';

const tasmaSonuclari = [];

async function cek(page, ad, url) {
  await page.setViewport({ width: 1280, height: 900 });
  if (url) {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  }
  await page.screenshot({ path: path.join(DIR, `${ad}-desktop.jpg`), type: 'jpeg', quality: 75, fullPage: true });

  await page.setViewport({ width: 400, height: 844 });
  await new Promise((r) => setTimeout(r, 150));
  const olcum = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const tasma = olcum.scrollWidth > olcum.clientWidth;
  tasmaSonuclari.push({ ad, ...olcum, tasma });
  await page.screenshot({ path: path.join(DIR, `${ad}-mobil.jpg`), type: 'jpeg', quality: 75, fullPage: true });
  console.log(`📸 ${ad}: desktop+mobil OK | 400px: scroll=${olcum.scrollWidth}px / client=${olcum.clientWidth}px ${tasma ? '⚠️ TAŞMA' : '✅'}`);
}

async function girisYap(page, eposta, sifre) {
  await page.goto(`${BASE}/giris`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[name="eposta"]', { timeout: 10000 });
  await page.type('input[name="eposta"]', eposta);
  await page.type('input[name="sifre"]', sifre);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]'),
  ]);
}

async function cikisYap(page) {
  await page.evaluate(async () => {
    await fetch('/cikis', { method: 'POST', credentials: 'same-origin' });
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await cek(page, '01-giris-ekrani', `${BASE}/giris`);

  await girisYap(page, 'mehmet.yildiz@ogr.kampus.edu.tr', 'Yemek2026!');

  const yarin = new Date(Date.now() + 86400000);
  const yarinStr = `${yarin.getFullYear()}-${String(yarin.getMonth() + 1).padStart(2, '0')}-${String(yarin.getDate()).padStart(2, '0')}`;

  await cek(page, '02-gunun-menusu', `${BASE}/menu/gunun?yemekhane_id=1&tarih=${yarinStr}&ogun_id=2`);
  await cek(page, '03-haftalik-menu', `${BASE}/menu/haftalik`);
  await cek(page, '04-rezervasyonlarim', `${BASE}/rezervasyonlarim`);
  await cek(page, '05-bakiye-islemleri', `${BASE}/bakiye`);
  await cek(page, '06-menu-degerlendirme', `${BASE}/degerlendirme`);
  await cek(page, '09-alerjen-tercihleri', `${BASE}/profil/alerjenler`);
  await cikisYap(page);

  await girisYap(page, 'leyla.arslan@kampus.edu.tr', 'Yemek2026!');
  await cek(page, '07-yonetici-paneli', `${BASE}/yonetici`);

  const duzenleHref = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/yonetici/menu/"][href$="/duzenle"]');
    return a ? a.getAttribute('href') : null;
  });
  if (duzenleHref) {
    await cek(page, '08-menu-duzenle', `${BASE}${duzenleHref}`);
  }
  await cikisYap(page);

  await girisYap(page, 'ayse.demir@ogr.kampus.edu.tr', 'Yemek2026!');
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/menu/gunun?yemekhane_id=1&tarih=${yarinStr}&ogun_id=2`, { waitUntil: 'networkidle0' });
  const rezBtn = await page.$('form[action="/rezervasyon/yap"] button[type="submit"]');
  if (rezBtn) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      rezBtn.click(),
    ]);
  }
  await cek(page, '10-bakiye-yetersiz-hata', null);
  await cikisYap(page);

  await browser.close();

  const tasanlar = tasmaSonuclari.filter((x) => x.tasma);
  console.log(`\nToplam ${tasmaSonuclari.length * 2} görsel kaydedildi. 400px yatay taşma sayısı: ${tasanlar.length}`);
})().catch((err) => {
  console.error('❌ Hata:', err);
  process.exit(1);
});
