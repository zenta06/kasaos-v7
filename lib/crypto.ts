import CryptoJS from 'crypto-js';

// Veriyi şifrele (Kasaya koymadan önce kilitler)
export const encryptData = (text: string, masterPassword: string) => {
  return CryptoJS.AES.encrypt(text, masterPassword).toString();
};

// Şifreyi çöz (Kasadan çıkarırken anahtarla açar)
export const decryptData = (ciphertext: string, masterPassword: string) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, masterPassword);
  return bytes.toString(CryptoJS.enc.Utf8);
};