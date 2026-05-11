"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ChevronRight, Loader2, ShieldCheck, AlertCircle, Phone, ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier
} from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState(''); // 2FA Kodu için
  const [isLogin, setIsLogin] = useState(true);
  const [showMfa, setShowMfa] = useState(false); // 2FA ekranını kontrol eder
  const [resolver, setResolver] = useState<any>(null); // MFA Resolver nesnesi
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  // --- BENİ HATIRLA: KONTROL ---
  useEffect(() => {
    const savedEmail = localStorage.getItem('kasaos_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // --- RECAPTCHA KURULUMU ---
  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          handleLoginSuccess();
        } catch (err: any) {
          // 2FA GEREKİYORSA BU HATA DÖNER
          if (err.code === 'auth/multi-factor-auth-required') {
            setupRecaptcha();
            const mfaResolver = getMultiFactorResolver(auth, err);
            const recaptchaVerifier = (window as any).recaptchaVerifier;
            
            // İlk telefon hintini al ve SMS gönder
            const phoneInfoOptions = {
              multiFactorHint: mfaResolver.hints[0],
              session: mfaResolver.session
            };
            const phoneAuthProvider = new PhoneAuthProvider(auth);
            const vId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, recaptchaVerifier);
            
            setVerificationId(vId);
            setResolver(mfaResolver);
            setShowMfa(true); // 2FA kod giriş ekranını aç
          } else {
            throw err;
          }
        }
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setIsLogin(true);
        setSuccess('Hesap oluşturuldu! Şimdi giriş yapın.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.code === 'auth/user-not-found' ? 'Kullanıcı bulunamadı.' : 'Kimlik bilgileri hatalı veya eksik.');
    } finally {
      setLoading(false);
    }
  };

  // --- 2FA KODUNU DOĞRULA ---
  const handleVerifyMfa = async () => {
    if (!mfaCode) return setError('Lütfen doğrulama kodunu girin.');
    setLoading(true);
    try {
      const cred = PhoneAuthProvider.credential(verificationId, mfaCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      await resolver.resolveSignIn(multiFactorAssertion);
      handleLoginSuccess();
    } catch (err: any) {
      setError('Doğrulama kodu hatalı.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    if (rememberMe) {
      localStorage.setItem('kasaos_remembered_email', email);
    } else {
      localStorage.removeItem('kasaos_remembered_email');
    }
    router.push('/dashboard');
  };

  const handleForgotPassword = async () => {
    if (!email) return setError('Lütfen önce e-posta adresinizi yazın.');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Şifre sıfırlama bağlantısı gönderildi. Maili göremezseniz spam kutunuzu kontrol etmeyi unutmayın.');
    } catch (err: any) {
      setError('Sıfırlama bağlantısı gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030712] flex items-center justify-center p-6 relative overflow-hidden">
      <div id="recaptcha-container"></div> {/* Görünmez Recaptcha Alanı */}
      
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo Bölümü */}
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            whileHover={{ rotate: 360 }}
            transition={{ duration: 1 }}
            className="w-20 h-20 bg-blue-600 rounded-[2.2rem] flex items-center justify-center shadow-2xl shadow-blue-600/20 mb-6 rotate-3"
          >
            <Lock className="text-white w-10 h-10" />
          </motion.div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter">
            Kasa<span className="text-blue-500">OS</span>
          </h1>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-bold mt-2">
            {showMfa ? "Security Verification" : "Master Suite Login"}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-3xl p-8 rounded-[3.5rem] shadow-3xl">
          
          <AnimatePresence mode="wait">
            {!showMfa ? (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {/* MODERN TOGGLE */}
                <div className="flex bg-black/40 p-1.5 rounded-3xl mb-8 relative">
                  <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest relative z-10 ${isLogin ? 'text-white' : 'text-slate-500'}`}>Giriş Yap</button>
                  <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest relative z-10 ${!isLogin ? 'text-white' : 'text-slate-500'}`}>Kayıt Ol</button>
                  <motion.div className="absolute top-1.5 bottom-1.5 left-1.5 bg-blue-600 rounded-[1.2rem]" animate={{ x: isLogin ? '0%' : '100%', width: 'calc(50% - 3px)' }} />
                </div>

                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500" size={20} />
                  <input type="email" placeholder="E-posta Adresi" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-14 pr-6 py-5 rounded-[1.8rem] bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500/50 text-sm" />
                </div>

                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500" size={20} />
                  <input type="password" placeholder="Master Şifre" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-14 pr-6 py-5 rounded-[1.8rem] bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500/50 text-sm" />
                </div>

                <div className="flex items-center justify-between px-2">
                  <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="accent-blue-600" />
                    <span>Beni Hatırla</span>
                  </label>
                  {isLogin && <button onClick={handleForgotPassword} className="text-[11px] text-blue-500 font-bold">Şifremi Unuttum</button>}
                </div>

                <button onClick={handleSubmit} disabled={loading} className="w-full py-5 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.8rem] flex items-center justify-center gap-3 active:scale-95 transition-transform">
                  {loading ? <Loader2 className="animate-spin" /> : <>{isLogin ? "Kasayı Aç" : "Sisteme Kaydol"} <ChevronRight size={18} /></>}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="mfa-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <button onClick={() => setShowMfa(false)} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-bold mb-4">
                  <ArrowLeft size={16} /> Geri Dön
                </button>
                
                <div className="text-center space-y-2">
                  <h3 className="text-white font-bold text-lg">İki Faktörlü Doğrulama</h3>
                  <p className="text-slate-400 text-xs">Telefonunuza gönderilen 6 haneli güvenlik kodunu girin.</p>
                </div>

                <div className="relative group">
                  <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500" size={20} />
                  <input 
                    type="text" 
                    placeholder="Güvenlik Kodu" 
                    maxLength={6}
                    value={mfaCode} 
                    onChange={e => setMfaCode(e.target.value)} 
                    className="w-full pl-14 pr-6 py-5 rounded-[1.8rem] bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500/50 text-center tracking-[0.5em] text-lg font-bold" 
                  />
                </div>

                <button onClick={handleVerifyMfa} disabled={loading} className="w-full py-5 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.8rem] flex items-center justify-center gap-3 active:scale-95 transition-transform">
                  {loading ? <Loader2 className="animate-spin" /> : <>Doğrula ve Giriş Yap <ShieldCheck size={18} /></>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hata ve Başarı Mesajları */}
          <div className="mt-4">
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                  <AlertCircle size={16} /> <span>{error}</span>
                </motion.div>
              )}
              {success && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <ShieldCheck size={16} /> <span>{success}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck size={14} className="text-blue-600" /> 
            AES-256 Uçtan Uca Şifreleme Aktif
          </p>
        </div>
      </motion.div>
    </main>
  );
}
