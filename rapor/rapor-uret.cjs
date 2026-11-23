const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAPOR_DIR = __dirname;
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const asama1 = fs.readFileSync(path.join(RAPOR_DIR, 'asama-1-ciktilar.txt'), 'utf8').trim();
const asama3 = fs.readFileSync(path.join(RAPOR_DIR, 'asama-3-ciktilar.txt'), 'utf8').trim();
const asama4 = fs.readFileSync(path.join(RAPOR_DIR, 'asama-4-ciktilar.txt'), 'utf8').trim();

function gorselCifti(baslik, prefix, aciklama) {
  return `
  <div class="ekran-blok">
    <h3>${baslik}</h3>
    ${aciklama ? `<p class="kucuk">${aciklama}</p>` : ''}
    <div class="gorsel-grid">
      <figure class="desktop">
        <img src="gorseller/${prefix}-desktop.jpg" alt="${baslik} Masaüstü">
        <figcaption>Masaüstü (1280px)</figcaption>
      </figure>
      <figure class="mobil">
        <img src="gorseller/${prefix}-mobil.jpg" alt="${baslik} Mobil">
        <figcaption>Mobil (400px · 0 taşma)</figcaption>
      </figure>
    </div>
  </div>`;
}

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Yemekhane Otomasyonu - Dönem Ödevi Raporu</title>
  <style>
    @page { size: A4; margin: 1.4cm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.45; color: #1f2a2e; background: #fff; margin: 0; }
    h1 { font-size: 19pt; color: #1B6B5A; border-bottom: 2.5px solid #1B6B5A; padding-bottom: 6px; margin-top: 0; }
    h2 { font-size: 13.5pt; color: #1B6B5A; border-bottom: 1px solid #cbd5d9; padding-bottom: 4px; margin-top: 1.3em; page-break-after: avoid; }
    h3 { font-size: 11pt; color: #244b43; margin: 0.9em 0 0.35em; page-break-after: avoid; }
    p { margin: 0 0 0.65em; }
    .kucuk { font-size: 9pt; color: #526369; }
    .meta-kutu { background: #f4f8f7; border-left: 4px solid #1B6B5A; padding: 10px 14px; margin: 10px 0 14px; border-radius: 4px; }
    .meta-kutu p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 9.2pt; }
    th, td { border: 1px solid #d0dbde; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eaf2f0; color: #1B6B5A; }
    code { font-family: Consolas, 'DejaVu Sans Mono', monospace; font-size: 8.8pt; background: #f1f4f5; padding: 1px 4px; border-radius: 3px; }
    pre { font-family: Consolas, 'DejaVu Sans Mono', monospace; font-size: 7.8pt; line-height: 1.35; background: #f6f8f9; border: 1px solid #d6dfe2; border-radius: 4px; padding: 8px 10px; white-space: pre-wrap; word-break: break-word; margin: 6px 0 12px; }
    .akis-kutu { background: #fbfcfc; border: 1px solid #cbd5d9; border-radius: 4px; padding: 10px 12px; margin: 8px 0 12px; }
    .ekran-blok { page-break-inside: avoid; margin-bottom: 14px; }
    .gorsel-grid { display: flex; gap: 10px; align-items: flex-start; }
    figure { margin: 0; border: 1px solid #d6dfe2; border-radius: 4px; padding: 4px; background: #fff; }
    figure.desktop { flex: 3; }
    figure.mobil { flex: 1.15; }
    figure img { width: 100%; height: auto; display: block; border-radius: 2px; max-height: 360px; object-fit: contain; object-position: top; }
    figcaption { font-size: 8pt; color: #526369; text-align: center; margin-top: 3px; }
    .sayfa-sonu { page-break-before: always; }
  </style>
</head>
<body>

<h1>Yemekhane Otomasyonu · Dönem Ödevi Raporu</h1>

<div class="meta-kutu">
  <p><strong>Ders:</strong> Web Teknolojileri (Dönem Ödevi)</p>
  <p><strong>Öğrenci / GitHub Deposu:</strong> kemaloozturk · https://github.com/kemaloozturk/yemekhane-otomasyonu</p>
  <p><strong>Seçilen Mimari Yol:</strong> <strong>MVC (Model–View–Controller)</strong> — Node.js + Express + EJS + Apache 2.4 (<code>-D MVC</code>)</p>
  <p><strong>Rapor Tarihi:</strong> 23 Kasım 2026</p>
</div>

<h2>Mimari Özet</h2>
<p>
  Uygulama <strong>MVC</strong> mimarisiyle geliştirilmiştir. Apache 2.4 (<code>frontend</code> servisi, <code>-D MVC</code> modu)
  yalnızca statik dosyaları (<code>/css/</code>, <code>/img/</code>, <code>/js/</code>, <code>/hata/</code>) sunar; diğer tüm HTTP
  isteklerini <code>uygulama:8000</code> adresindeki Node.js/Express uygulamasına ters vekil (reverse proxy) olarak iletir.
  Uygulama içerisinde katman ayrımı sıkı biçimde korunmuştur:
</p>
<ul>
  <li><strong>Rota Katmanı (<code>uygulama/src/routes/index.js</code>):</strong> URL eşlemeleri ve yetkilendirme ara yazılımları (<code>girisGerekli</code>, <code>yoneticiGerekli</code>).</li>
  <li><strong>Denetleyici Katmanı (<code>uygulama/src/controllers/</code>):</strong> İstek/yanıt akışı ve yönlendirmeler. Hiçbir controller içinde SQL sorgusu yoktur.</li>
  <li><strong>Veri Erişim Katmanı (<code>uygulama/src/repositories/</code>):</strong> Parametreli SQL sorguları, hazır view'lar, stored procedure çağrıları ve Redis işlemleri.</li>
  <li><strong>Görünüm Katmanı (<code>uygulama/src/views/</code>):</strong> EJS şablonları ile HTML5 + CSS3 üretim (kaçışlı çıktı, iş kuralı/tarih karşılaştırması içermez).</li>
</ul>

<table>
  <thead>
    <tr><th>Servis</th><th>Teknoloji</th><th>Görev ve Okuma/Yazma Rolü</th></tr>
  </thead>
  <tbody>
    <tr><td><code>frontend</code></td><td>Apache 2.4 (<code>-D MVC</code>)</td><td>Statik varlıklar + 8080 portundan uygulamaya ters vekil</td></tr>
    <tr><td><code>uygulama</code></td><td>Node.js 18 + Express + EJS</td><td>MVC uygulaması (8000 portu), ortam değişkenlerinden DB/Redis yapılandırması</td></tr>
    <tr><td><code>mysql-primary</code></td><td>MySQL 8.4</td><td>Yazma sunucusu (<code>INSERT/UPDATE/DELETE</code>, <code>CALL sp_*</code>, işlem sonrası bakiye)</td></tr>
    <tr><td><code>mysql-replica</code></td><td>MySQL 8.4 (read-only)</td><td>Okuma sunucusu (listelemeler, raporlar, <code>v_menu_*</code> view'ları)</td></tr>
    <tr><td><code>replica-setup</code></td><td>MySQL 8.4</td><td>İlk açılışta replikasyonu kurar ve <code>Exited (0)</code> ile sonlanır</td></tr>
    <tr><td><code>redis</code></td><td>Redis 7.4 (AOF)</td><td>Sabit menü önbelleği (<code>menu:*</code>) ve 30 dk kayan süreli oturum deposu (<code>oturum:*</code>)</td></tr>
  </tbody>
</table>

<h2>Aşama 1 · Altyapı ve Replikasyon Doğrulaması</h2>
<p>
  <code>rapor/asama-1-dogrulama.sh</code> betiği ile tüm servislerin sağlıklı ayağa kalktığı, kaynakta yapılan bakiye
  yüklemesinin replikaya aktığı, replikaya yazma denemesinin <code>ERROR 1290 (read-only)</code> ile reddedildiği,
  replika durdurulup başlatıldığında aradaki işlemleri yakaladığı ve Redis'in yanıt verdiği doğrulanmıştır:
</p>
<pre>${esc(asama1)}</pre>

<div class="sayfa-sonu"></div>
<h2>Aşama 2 · Uygulama Mimarisi, İstek Akışı ve Replikasyon Gecikmesi</h2>

<h3>Bir İsteğin Uygulama İçindeki Yolu (route → Controller → Veri Katmanı → Yanıt)</h3>
<div class="akis-kutu">
  <p><strong>Örnek İstek:</strong> <code>POST /rezervasyon/yap</code> (öğrencinin menü rezervasyonu yapması)</p>
  <ol style="margin: 4px 0 0; padding-left: 18px;">
    <li><strong>Ara Yazılım (<code>middlewares/authMiddleware.js</code>):</strong> <code>oturumYukle</code> çerezdeki token ile Redis'ten (<code>oturum:{token}</code>) kullanıcıyı yükler ve 30 dk TTL'i yeniler; <code>girisGerekli</code> oturum yoksa <code>/giris</code>'e yönlendirir.</li>
    <li><strong>Rota (<code>routes/index.js</code>):</strong> <code>router.post('/rezervasyon/yap', girisGerekli, rezervasyonController.rezervasyonYap)</code> isteği denetleyiciye iletir.</li>
    <li><strong>Controller (<code>controllers/rezervasyonController.js</code>):</strong> <code>menu_id</code>, <code>yarim_porsiyon</code> ve güvenli <code>donus_url</code> doğrulamasını yapar (open redirect koruması); doğrudan SQL çalıştırmadan <code>rezervasyonRepository.rezervasyonYap(...)</code> çağırır.</li>
    <li><strong>Veri Katmanı (<code>repositories/rezervasyonRepository.js</code>):</strong> Kaynak sunucu havuzu (<code>yazma</code>) üzerinden <code>CALL sp_rezervasyon_yap(?, ?, ?)</code> yordamını çağırır. Hata varsa <code>utils/hataYardimcisi.js</code> yalnızca <code>SQLSTATE 45000</code> (kod 1644) Türkçe mesajını döndürür, sistem/SQL hatalarını gizler.</li>
    <li><strong>İşlem Sonrası Bakiye &amp; Oturum Güncelleme:</strong> <code>kullaniciRepository.bakiyeGetirKaynaktan(kullaniciId)</code> ile güncel bakiye doğrudan <code>mysql-primary</code>'den okunur ve <code>oturumRepository.oturumGuncelle</code> ile Redis'teki oturuma yazılır.</li>
    <li><strong>Yanıt:</strong> Denetleyici, sonuç mesajıyla güvenli dönüş adresine <code>302 Redirect</code> döner; ilgili ekran (<code>views/menu/gunun.ejs</code> veya <code>haftalik.ejs</code>) güncellenmiş bakiye ve durumu HTML olarak sunar.</li>
  </ol>
</div>

<h3>Rezervasyondan Hemen Sonra Bakiyenin Kaynaktan Okunmasının Nedeni (Replikasyon Gecikmesi)</h3>
<p>
  MySQL kaynak-replika (source-replica) replikasyonu <strong>eşzamansız (asynchronous)</strong> çalışır:
  <code>sp_rezervasyon_yap</code> veya <code>sp_rezervasyon_iptal</code> yordamı <code>mysql-primary</code> üzerinde
  işlemi <code>COMMIT</code> ettiği anda yanıt uygulamaya döner, ancak binlog olayının ağ üzerinden <code>mysql-replica</code>'ya
  ulaşıp SQL iş parçacığı tarafından uygulanması milisaniyeler (yük altında daha uzun) sürebilir. Rezervasyondan hemen sonra
  kullanıcıya gösterilen bakiye replikadan okunsaydı, kullanıcı parasının henüz düşmediğini (bayat bakiye) görebilir ve
  tutarsız bir deneyim yaşayabilirdi. Bu <em>"read-your-own-writes"</em> tutarlılığını sağlamak için rezervasyon, iptal ve
  bakiye yükleme sonrasında bakiye her zaman <code>kullaniciRepository.bakiyeGetirKaynaktan</code> aracılığıyla doğrudan
  kaynak sunucudan (<code>yazma</code> havuzu) okunmakta ve Redis oturumu bu taze değerle güncellenmektedir. Benzer şekilde
  alerjen tercihi kaydedildikten hemen sonra profil sayfası da tercihleri kaynaktan okuyarak gecikme riskini ortadan kaldırır.
</p>

<h3>Güvenlik ve Hata Yönetimi</h3>
<ul>
  <li>Tüm sorgular parametrelidir (SQL injection yok); EJS çıktıları <code>&lt;%= ... %&gt;</code> ile kaçışlıdır (XSS yok).</li>
  <li>Son saat kontrolleri arayüzde değil veritabanında <code>(rezervasyon_son &lt;= NOW())</code> ile yapılır.</li>
  <li><code>utils/hataYardimcisi.js</code> yalnızca stored procedure'ün <code>SQLSTATE 45000</code> mesajlarını kullanıcıya iletir; ham SQL ve <code>CHECK</code> (3819) hataları yalnızca sunucu günlüğüne yazılır.</li>
  <li><code>/cikis</code> yalnızca <code>POST</code> kabul eder; <code>donus_url</code> site içi yollara kısıtlıdır; <code>/turnike/gecis</code> yalnızca <code>yonetici</code> rolüne açıktır ve sunucu zamanını kullanır; pasif hesaplarda tek tip giriş hatası döner.</li>
</ul>

<div class="sayfa-sonu"></div>
<h2>Aşama 2 · Ekran Görüntüleri (Masaüstü 1280px ve Mobil 400px)</h2>
<p>
  Aşağıdaki tüm ekranlar Puppeteer/Headless Chrome ile hem 1280px masaüstü hem 400px telefon genişliğinde otomatik
  doğrulanmış; tüm ekranlarda yatay taşma <strong>0 px</strong> (<code>scrollWidth = 400px</code>) olarak ölçülmüştür.
</p>

${gorselCifti('1. Giriş Ekranı (/giris)', '01-giris-ekrani', 'E-posta ve şifre ile bcrypt doğrulamalı giriş ekranı.')}
${gorselCifti('2. Günün Menüsü (/menu/gunun)', '02-gunun-menusu', 'Yemekhane/tarih/öğün seçimi, toplam kalori, vejetaryen/alerjen rozetleri, Aşama 4 yarım porsiyon ve kişisel alerjen uyarısı.')}
${gorselCifti('3. Haftalık Menü ve Rezervasyon (/menu/haftalik)', '03-haftalik-menu', 'Boş kontenjan, role göre fiyat, süresi dolan öğünlerde pasif düğme ve yarım porsiyon seçeneği.')}
${gorselCifti('4. Rezervasyonlarım (/rezervasyonlarim)', '04-rezervasyonlarim', 'Aktif, kullanıldı ve iptal durumları; tam/yarım porsiyon bilgisi ve süresi dolmamış aktif kayıtlar için iptal.')}
${gorselCifti('5. Bakiye İşlemleri (/bakiye)', '05-bakiye-islemleri', 'Kaynaktan okunan güncel bakiye, sp_bakiye_yukle ile 10–1000 TL yükleme ve replikadan okunan hareket geçmişi.')}
${gorselCifti('6. Menü Değerlendirme (/degerlendirme)', '06-menu-degerlendirme', 'Yalnızca kullanılmış (turnikeden geçilmiş) menüler için 1–5 puan ve yorum formu.')}
${gorselCifti('7. Yönetici Paneli (/yonetici)', '07-yonetici-paneli', 'v_menu_doluluk ve v_menu_puan raporları, yeni menü oluşturma, düzenleme ve silme işlemleri.')}
${gorselCifti('8. Menü Düzenleme Ekranı (/yonetici/menu/:id/duzenle)', '08-menu-duzenle', 'Yönetici bir menüyü güncellediğinde hem veritabanı hem de eski/yeni Redis önbellek anahtarı temizlenir.')}
${gorselCifti('9. Hata Mesajı İletimi ("Bakiye yetersiz.")', '10-bakiye-yetersiz-hata', 'ayse.demir@ogr.kampus.edu.tr (12,50 TL) ile pahalı menü rezervasyonunda SQLSTATE 45000 mesajının doğrudan arayüze iletilmesi.')}

<div class="sayfa-sonu"></div>
<h2>Aşama 3 · Redis Önbellek ve Oturum Yönetimi</h2>
<p>
  Redis iki görev için kullanılmaktadır: (1) Sabit menü verisi (yemek listesi, kalori, alerjen, fiyatlar)
  <code>menu:{yemekhane_id}:{tarih}:{ogun_id}</code> anahtarıyla gün sonuna kadar önbelleğe alınır; her rezervasyonda
  değişen <code>bos_yer</code>, <code>doluluk_yuzde</code> ve <code>ortalama_puan</code> alanları <strong>önbelleğe yazılmaz</strong>,
  her istekte replikadan taze okunur. (2) Kullanıcı oturumları <code>oturum:{token}</code> anahtarıyla 30 dakika (1800 sn)
  süreyle saklanır, her istekte yenilenir, uygulama konteyneri yeniden başlasa da korunur ve <code>POST /cikis</code> ile silinir.
</p>
<p><strong>Doğrulama Betiği ve Gerçek Çıktılar (<code>rapor/asama-3-dogrulama.sh</code>):</strong></p>
<pre>${esc(asama3)}</pre>

<div class="sayfa-sonu"></div>
<h2>Aşama 4 · Değişiklik Talebi (Migration, Yarım Porsiyon ve Alerjen Uyarısı)</h2>
<p>
  Değişiklik talebi tek bir idempotent migration dosyasında (<code>db/init/04_degisiklik.sql</code>) toplanmıştır.
  Dosya <code>db/init/</code> klasöründe olduğu için depoyu sıfırdan <code>docker compose up -d</code> ile kuran herkes
  değişikliği otomatik alır; çalışan sistemde ise yalnızca <code>mysql-primary</code> üzerine uygulanır ve replikasyonla
  <code>mysql-replica</code>'ya geçer.
</p>
<ul>
  <li><code>rezervasyonlar</code> tablosuna <code>porsiyon ENUM('tam','yarim') NOT NULL DEFAULT 'tam'</code> sütunu eklenir; mevcut kayıtlar otomatik olarak <code>'tam'</code> kalır.</li>
  <li><code>kullanici_alerjenleri (kullanici_id, alerjen_id)</code> tablosu oluşturulur.</li>
  <li><code>sp_rezervasyon_yap(p_kullanici_id, p_menu_id, p_yarim_porsiyon)</code> güncellenir: öğle/akşam yarım porsiyonda fiyat %60 olarak hesaplanır; kahvaltıda yarım porsiyon <code>SQLSTATE 45000</code> (<em>"Kahvaltıda yarım porsiyon seçilemez."</em>) ile engellenir.</li>
  <li>Migration sonrası Redis'teki eski yapıdaki <code>menu:*</code> anahtarları <code>redis-cli --scan --pattern 'menu:*' | xargs -r redis-cli DEL</code> ile temizlenir.</li>
</ul>

<p><strong>Doğrulama Betiği ve Gerçek Çıktılar (<code>rapor/asama-4-dogrulama.sh</code>):</strong></p>
<pre>${esc(asama4)}</pre>

${gorselCifti('Aşama 4 · Alerjen Tercihleri Ekranı (/profil/alerjenler)', '09-alerjen-tercihleri', 'Kullanıcının seçtiği alerjenler kullanici_alerjenleri tablosuna kaydedilir ve Günün Menüsü ekranında kırmızı uyarı rozetiyle gösterilir.')}

</body>
</html>`;

const htmlYol = path.join(RAPOR_DIR, 'rapor.html');
const pdfYol = path.join(RAPOR_DIR, 'yemekhane-otomasyonu-rapor.pdf');
const disPdfYol = '/home/kemal/Belgeler/yemekhane-odev/yemekhane-otomasyonu-rapor.pdf';

fs.writeFileSync(htmlYol, html, 'utf8');
console.log('✓ rapor.html üretildi.');

execSync(
  `google-chrome --headless=new --no-sandbox --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfYol}" "file://${htmlYol}"`,
  { stdio: 'inherit' }
);

fs.copyFileSync(pdfYol, disPdfYol);
const boyutKB = Math.round(fs.statSync(pdfYol).size / 1024);
console.log(`✓ PDF üretildi: ${pdfYol} (${boyutKB} KB) ve kopyalandı: ${disPdfYol}`);
