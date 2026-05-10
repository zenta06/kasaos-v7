"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ChevronRight, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        router.push('/dashboard');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setIsLogin(true);
        setError('Hesap oluşturuldu! Şimdi giriş yapın.');
      }
    } catch (err: any) {
      setError(err.message.includes('auth/user-not-found') ? 'Kullanıcı bulunamadı.' : 'Kimlik bilgileri hatalı veya eksik.');
    } finally {
      setLoading(false);
    }
  };

  // --- ENTER TUŞU KONTROLÜ ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  return (
    <main className="min-h-screen bg-[#030712] flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* Dekoratif Arka Plan Işıkları */}
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
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-bold mt-2">Master Suite Login</p>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-3xl p-8 rounded-[3.5rem] shadow-3xl">
          
          {/* MODERN TOGGLE */}
          <div className="flex bg-black/40 p-1.5 rounded-3xl mb-8 relative">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest relative z-10 transition-colors ${isLogin ? 'text-white' : 'text-slate-500'}`}
            >
              Giriş Yap
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest relative z-10 transition-colors ${!isLogin ? 'text-white' : 'text-slate-500'}`}
            >
              Kayıt Ol
            </button>
            
            <motion.div 
              className="absolute top-1.5 bottom-1.5 left-1.5 bg-blue-600 rounded-[1.2rem] shadow-lg shadow-blue-600/20"
              animate={{ 
                x: isLogin ? '0%' : '100%',
                width: 'calc(50% - 3px)'
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input 
                type="email" 
                placeholder="E-posta Adresi" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown} // ENTER DESTEĞİ
                className="w-full pl-14 pr-6 py-5 rounded-[1.8rem] bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input 
                type="password" 
                placeholder="Master Şifre" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown} // ENTER DESTEĞİ
                className="w-full pl-14 pr-6 py-5 rounded-[1.8rem] bg-white/5 border border-white/10 text-white outline-none focus:border-blue-500/50 transition-all font-medium text-sm"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              onClick={handleSubmit} 
              disabled={loading}
              className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.8rem] shadow-2xl shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isLogin ? "Kasayı Aç" : "Sisteme Kaydol"}
                  <ChevronRight size={18} />
                </>
              )}
            </button>
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