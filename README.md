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

## 🚀 Özellikler (Highlights)

| 🛡️ Güvenlik | ⚡ Performans | 🎨 Tasarım |
| :--- | :--- | :--- |
| **AES-256 Şifreleme** ile uçtan uca veri koruması. | **Next.js 15** ile ultra hızlı sayfa geçişleri. | **Cyber-Dark** tema ile göz yormayan arayüz. |
| **Zero-Knowledge** mimarisi; anahtar sizde kalır. | **Firestore** ile anlık veri senkronizasyonu. | **Framer Motion** ile akıcı mikro etkileşimler. |
| **Firebase Auth** ile güvenli giriş protokolü. | **Zayıf Şifre Analizi** ile gerçek zamanlı uyarılar. | **Responsive** tam mobil uyumlu yapı. |

---

## 📂 Proje Yapısı (Architecture)

```text
kasaos-v7/
├── 📁 src/
│   ├── 📁 app/           # Sayfa yönlendirmeleri ve API rotaları
│   ├── 📁 components/    # UI kartları, formlar ve animasyonlar
│   └── 📁 lib/           # Firebase konfigürasyonu ve kripto mantığı
├── 📁 public/            # İkonlar, logolar ve statik varlıklar
├── 📄 .env.local         # Özel güvenlik anahtarları (Gizli)
└── 📄 tailwind.config.ts # Stil özelleştirmeleri

```bash
# 1. Depoyu Klonla ve Klasöre Gir
git clone [https://github.com/zenta06/kasaos-v7.git](https://github.com/zenta06/kasaos-v7.git)
cd kasaos-v7

# 2. Gerekli Kütüphaneleri Yükle
npm install
npm install --save-dev @types/crypto-js

# 3. Uygulamayı Başlat
npm run dev

[!TIP]
Uygulamanın çalışması için .env.local dosyanızda Firebase API bilgilerinin ve NEXT_PUBLIC_VAULT_KEY değişkeninin tanımlı olduğundan emin olun.
