<div align="center">

# 🔒 KasaOS v7.0
### *Next-Generation Zero-Knowledge Password Vault*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-v11-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

**KasaOS**, şifrelerinizi askeri düzeyde şifreleme ile görünmez bir kaleye hapseder.
<br>
*Modern arayüz • Sıfır sızıntı • Tam kontrol*

---

</div>

## 🛠️ Teknolojik Altyapı

| Katman | Teknoloji | Görev |
| :--- | :--- | :--- |
| **Framework** | `Next.js 15` | Modern Web Altyapısı |
| **Database** | `Firebase` | Gerçek Zamanlı Bulut Veritabanı |
| **Security** | `AES-256` | Uçtan Uca Şifreleme |

---

## 🚀 Hızlı Kurulum Rehberi

Tüm kurulumu tek seferde kopyalayıp sırasıyla uygulayabilirsiniz:

```bash
# 1️⃣ Projeyi Hazırlayın
git clone [https://github.com/zenta06/kasaos-v7.git](https://github.com/zenta06/kasaos-v7.git)
cd kasaos-v7

# 2️⃣ Bağımlılıkları Yükleyin
npm install
npm install --save-dev @types/crypto-js

# 3️⃣ Ortam Değişkenlerini Tanımlayın
# Ana dizinde bir .env.local dosyası oluşturun ve içine şunları ekleyin:
# NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAnL5...
# NEXT_PUBLIC_FIREBASE_PROJECT_ID=password-archive-41099
# NEXT_PUBLIC_VAULT_KEY=senin_gizli_anahtarin_2026

# 4️⃣ Geliştirme Sunucusunu Başlatın
npm run dev

---

## 📂 Proje Ağaç Yapısı (Folder Structure)

kasaos-v7/
├── src/
│   ├── app/              # Next.js Sayfaları ve API'ler
│   ├── components/       # UI Bileşenleri (Kartlar, Butonlar)
│   └── lib/              # Firebase ve Şifreleme Ayarları
├── public/               # İkonlar ve Görseller
└── .env.local.example    # Örnek Güvenlik Anahtarları
