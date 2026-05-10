Bu proje, yapay zeka tarafından geliştirilmiş olup zenta06 tarafından düzenlemeler yapılmıştır.

🔒 KasaOS v7.0 | Advanced Password Vault Suite

KasaOS, modern web teknolojileriyle inşa edilmiş, ultra güvenli ve kullanıcı dostu bir şifre yönetim portalıdır. Verilerinizi yerel anahtarlarla şifreleyerek bulutta saklar, böylece güvenliğinizden ödün vermeden her yerden erişim sağlarsınız.

✨ Özellikler

🛡️ İki Katmanlı Güvenlik: Firebase Auth ile kimlik doğrulama ve AES-256 ile veritabanı seviyesinde şifreleme.

🧩 Akıllı Şifre Analizi: Şifrelerinizi gerçek zamanlı olarak analiz eder (Zayıf, Orta, Güçlü) ve görsel geri bildirim sağlar.

⚡ Modern UI/UX: Framer Motion ile güçlendirilmiş akışkan geçişler, Glassmorphism detaylar ve tamamen responsive tasarım.

☁️ Gerçek Zamanlı Senkronizasyon: Firestore altyapısı sayesinde eklediğiniz veriler tüm cihazlarınızda anında güncellenir.

🌑 Cyber-Dark Tema: Göz yormayan, kontrastı yüksek modern gece teması.

🔐 Güvenlik ve Şifreleme Mimarisi
KasaOS, "Sıfır Güven" (Zero-Knowledge) prensibiyle çalışır. Bu, servis sağlayıcının (Firebase) bile şifrelerinizi asla düz metin olarak göremediği anlamına gelir.

AES-256 Bit Şifreleme

Verileriniz henüz tarayıcınızdayken CryptoJS kütüphanesi kullanılarak askeri düzeyde şifreleme ile kilitlenir.

Şifreleme (Encryption): CryptoJS.AES.encrypt(raw_password, MASTER_KEY)

Şifre Çözme (Decryption): CryptoJS.AES.decrypt(encrypted_data, MASTER_KEY)

Veritabanına sızılsa bile, özel şifreleme anahtarınız (VAULT_KEY) olmadan verileriniz sadece anlamsız bir karakter yığınıdır.

Firestore Güvenlik Kuralları

Veritabanı erişimi sadece giriş yapmış kullanıcıya özeldir. Yazdığımız özel güvenlik kuralları sayesinde, her kullanıcı sadece kendi userId değeriyle eşleşen dökümanları okuyabilir, güncelleyebilir veya silebilir.

🚀 Kurulum Rehberi

Projeyi yerel bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

1. Depoyu Klonlayın

git clone https://github.com/zenta06/kasaos-v7.git
cd kasaos-v7

2. Bağımlılıkları Yükleyin

npm install
npm install --save-dev @types/crypto-js

3. Ortam Değişkenlerini Ayarlayın
   
Ana dizinde bir .env.local dosyası oluşturun ve Firebase bilgilerinizi ekleyin:

Plaintext
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_VAULT_KEY=your_secret_encryption_key

4. Geliştirme Sunucusunu Başlatın

- npm run dev

Tarayıcınızda http://localhost:3000 adresine gidin.

🛠️ Kullanılan Teknolojiler
Frontend: Next.js 15, React 19, Tailwind CSS

Animasyon: Framer Motion

Backend/DB: Firebase (Auth & Firestore)

Kriptografi: CryptoJS

İkon Seti: Lucide React

⚖️ Lisans
Bu proje kişisel kullanım ve eğitim amaçlı geliştirilmiştir. Tüm hakları saklıdır.
