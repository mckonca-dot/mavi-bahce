# 🫐 Mavi Bahçe - Organik Yaban Mersini E-Ticaret Sitesi

Bu proje, doğal ve organik yaban mersini ürünlerinin satışı için geliştirilmiş modern, responsive (mobil uyumlu) bir e-ticaret web uygulamasıdır. Kullanıcılar ürünleri inceleyip sepete ekleyebilir, üye olabilir ve sipariş verebilirler. Yöneticiler ise gelişmiş admin paneli üzerinden tüm süreci yönetebilir.

![Proje Önizlemesi](https://via.placeholder.com/1000x500?text=Mavi+Bahce+Ekran+Goruntusu)

<img width="1919" height="910" alt="Mavi Bahce" src="https://github.com/user-attachments/assets/50ccb3c0-596b-464a-9c0c-8d954773d959" />

## 🚀 Özellikler

### 👤 Kullanıcı Arayüzü (Frontend)
* **Modern Tasarım:** HTML5 ve CSS3 ile hazırlanmış şık ve duyarlı arayüz.
* **Üyelik Sistemi:** Firebase Authentication ile güvenli Kayıt Ol / Giriş Yap işlemleri.
* **Dinamik Sepet:** Ürünleri sepete ekleme, adet güncelleme ve anlık fiyat hesaplama.
* **İletişim Formu:** FormSubmit altyapısı ile çalışan, admin paneline entegre iletişim formu.
* **Kupon Sistemi:** Sepet aşamasında indirim kodu kullanabilme.

### 🛠️ Yönetici Paneli (Admin Dashboard)
* **Dashboard:** Toplam ciro, sipariş sayısı ve bekleyen işlemlerin istatistiksel özeti.
* **Ürün Yönetimi:** Yeni ürün ekleme, fiyat/stok güncelleme, ürün silme ve fotoğraf yönetimi.
* **Sipariş Takibi:** Gelen siparişleri görüntüleme, "Kargolandı" olarak işaretleme ve kargo takip no girme.
* **Kupon Yönetimi:** İndirim kuponları oluşturma ve silme.
* **Site Ayarları:** Site başlığı, Instagram/WhatsApp linkleri ve iletişim mailini kod yazmadan panelden değiştirme.

## 💻 Teknolojiler

Bu proje aşağıdaki teknolojiler kullanılarak geliştirilmiştir:

* **HTML5 & CSS3** (Önyüz Tasarımı)
* **JavaScript (ES6+)** (Tüm mantıksal işlemler)
* **Firebase Firestore** (Gerçek zamanlı Veritabanı)
* **Firebase Authentication** (Kullanıcı Kimlik Doğrulama)

## ⚙️ Kurulum ve Çalıştırma

Bu proje güvenlik nedeniyle API anahtarlarını barındırmaz. Projeyi kendi bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

1.  **Projeyi Klonlayın:**
    ```bash
    git clone [https://github.com/KULLANICI_ADINIZ/mavi-bahce.git](https://github.com/KULLANICI_ADINIZ/mavi-bahce.git)
    cd mavi-bahce
    ```

2.  **Config Dosyasını Oluşturun:**
    Proje ana dizininde `config.js` adında bir dosya oluşturun.

3.  **Firebase Ayarlarını Girin:**
    `config.js` dosyasının içine kendi Firebase proje bilgilerinizi aşağıdaki formatta yapıştırın:
    ```javascript
    const firebaseConfig = {
      apiKey: "SENIN_API_KEY_BURAYA",
      authDomain: "SENIN_PROJE_ID.firebaseapp.com",
      projectId: "SENIN_PROJE_ID",
      storageBucket: "SENIN_PROJE_ID.firebasestorage.app",
      messagingSenderId: "SENDER_ID",
      appId: "APP_ID",
      measurementId: "G-XYZ"
    };
    ```

4.  **Çalıştırın:**
    `index.html` dosyasını tarayıcınızda açın. Hepsi bu kadar!

## 🔐 Admin Girişi
Admin paneline erişmek için tarayıcıda `admin.html` sayfasına gidin.
*(Varsayılan admin yetkisi sadece veritabanında tanımlı e-posta adresine aittir.)*

---
*Geliştirici: Muhammet KONCA
