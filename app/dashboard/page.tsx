"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Copy, LogOut, Shield, CreditCard, Mail, User, Check, 
  Eye, X, Search, Sun, Moon, Wand2, Bell, RotateCcw, ArrowLeft,
  ListChecks, CheckSquare, Square, ChevronDown, Loader2,
  ShieldAlert, ShieldCheck, Zap, Activity, Clock, AlertTriangle, Download, Key
} from 'lucide-react';
import { encryptData, decryptData } from '@/lib/crypto';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  // --- GÜVENLİK VE YÜKLEME STATE'LERİ ---
  const [authChecking, setAuthChecking] = useState(true); // Sayfa açılışında kontrol aktif
  
  // --- TEMEL STATE'LER ---
  const [passwords, setPasswords] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Hepsi');
  const [showTrash, setShowTrash] = useState(false);
  const [showNotifHistory, setShowNotifHistory] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // --- SEÇİM MODU & TOPLU İŞLEM ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // --- MODALLAR ---
  const [confirmModal, setConfirmModal] = useState<{show: boolean, type: 'clear' | 'restore' | 'logout' | 'bulkDelete' | 'singleDelete' | null, targetId?: string}>({ show: false, type: null });
  const [isGenOpen, setIsGenOpen] = useState(false);
  const [genPass, setGenPass] = useState('');
  const [selectedPass, setSelectedPass] = useState<{val: string, site: string} | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // --- FORM INPUTLARI ---
  const [entryType, setEntryType] = useState('E-posta / Şifre');
  const [category, setCategory] = useState('Genel');
  const [reminderDays, setReminderDays] = useState('Yok');
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [isRemindOpen, setIsRemindOpen] = useState(false);

  const [siteName, setSiteName] = useState('');
  const [field1, setField1] = useState(''); 
  const [sitePass, setSitePass] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifHistory, setNotifHistory] = useState<any[]>([]);
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);
  
  const router = useRouter();
  const VAULT_KEY = "kasaos-internal-secure-key"; 
  const categories = ['Genel', 'Sosyal', 'İş', 'Finans', 'Alışveriş'];
  const entryTypes = ['E-posta / Şifre', 'Banka / Kart'];
  const reminderOptions = ['Yok', '30 Gün', '60 Gün', '90 Gün'];

  const inputBg = darkMode ? 'bg-[#1e293b] border-white/10' : 'bg-white border-slate-300 shadow-sm';
  const textColor = darkMode ? 'text-slate-100' : 'text-slate-900';

  const notify = useCallback((msg: string) => {
    const id = Date.now();
    new Audio('/notify.mp3').play().catch(() => {}); 
    const newNotif = { id, msg, time: new Date().toLocaleTimeString() };
    setNotifications(prev => [...prev, newNotif]);
    setNotifHistory(prev => [newNotif, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // --- KRİTİK: AUTH VE VERİ DİNLEYİCİSİ ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/'); // replace kullanarak geri gitmeyi de engelliyoruz
      } else {
        // Kullanıcı varsa verileri dinlemeye başla
        const q = query(collection(db, "passwords"), where("userId", "==", user.uid));
        const unsubSnap = onSnapshot(q, (snap) => {
          setPasswords(snap.docs.map(d => ({ ...d.data(), id: d.id })));
          setAuthChecking(false); // Veriler gelince yükleme ekranını kapat
        });
        
        // 2FA durumunu yükle
        const saved2FA = localStorage.getItem('kasaos_2fa_status');
        if (saved2FA === 'true') setIs2FAEnabled(true);

        return () => unsubSnap();
      }
    });

    return () => unsubAuth();
  }, [router]);

  // --- PANIC MODE ---
  const handlePanic = () => {
    auth.signOut();
    window.location.href = "https://www.google.com";
  };

  // --- YARDIMCI FONKSİYONLAR ---
  const getPassStrength = (pass: string) => {
    if (!pass) return { score: 0, color: 'bg-slate-500', label: 'Yok' };
    const dec = decryptData(pass, VAULT_KEY);
    let score = 0;
    if (dec.length > 8) score++;
    if (dec.length > 12) score++;
    if (/[A-Z]/.test(dec)) score++;
    if (/[0-9]/.test(dec)) score++;
    if (/[^A-Za-z0-9]/.test(dec)) score++;
    if (score <= 2) return { score, color: 'bg-red-500', label: 'ZAYIF' };
    if (score <= 4) return { score, color: 'bg-orange-500', label: 'ORTA' };
    return { score, color: 'bg-emerald-500', label: 'GÜÇLÜ' };
  };

  const stats = useMemo(() => {
    const active = passwords.filter(p => !p.deleted);
    const risks = active.filter(p => getPassStrength(p.password).score <= 2).length;
    const health = active.length > 0 ? Math.round(((active.length - risks) / active.length) * 100) : 100;
    return { total: active.length, risks, health };
  }, [passwords]);

  const expiredPasswords = useMemo(() => {
    return passwords.filter(p => {
      if (!p.reminder || p.reminder === 'Yok' || p.deleted || dismissedReminders.includes(p.id)) return false;
      const days = parseInt(p.reminder);
      const created = p.createdAt?.toDate() || new Date();
      const diff = (new Date().getTime() - created.getTime()) / (1000 * 3600 * 24);
      return diff >= days;
    });
  }, [passwords, dismissedReminders]);

  const executeConfirmAction = async () => {
    const batch = writeBatch(db);
    try {
      if (confirmModal.type === 'clear') {
        passwords.filter(p => p.deleted).forEach(p => batch.delete(doc(db, "passwords", p.id)));
        await batch.commit();
        notify("Çöp kutusu boşaltıldı!");
      } else if (confirmModal.type === 'restore') {
        passwords.filter(p => p.deleted).forEach(p => batch.update(doc(db, "passwords", p.id), { deleted: false }));
        await batch.commit();
        notify("Tüm veriler geri yüklendi!");
        setShowTrash(false);
      } else if (confirmModal.type === 'logout') {
        auth.signOut();
      } else if (confirmModal.type === 'singleDelete' && confirmModal.targetId) {
        if (showTrash) {
            await deleteDoc(doc(db, "passwords", confirmModal.targetId));
            notify("Kalıcı olarak silindi!");
        } else {
            await updateDoc(doc(db, "passwords", confirmModal.targetId), { deleted: true });
            notify("Çöp kutusuna taşındı!");
        }
      } else if (confirmModal.type === 'bulkDelete') {
        selectedIds.forEach(id => {
          if (showTrash) batch.delete(doc(db, "passwords", id));
          else batch.update(doc(db, "passwords", id), { deleted: true });
        });
        await batch.commit();
        notify("Toplu işlem tamamlandı.");
        setSelectedIds([]);
        setIsSelectionMode(false);
      }
    } catch (e) { notify("Hata oluştu!"); }
    setConfirmModal({ show: false, type: null });
  };

  const handleSave = async () => {
    if (!siteName) return notify("Hizmet adı boş olamaz!");
    setIsAdding(true);
    try {
      await addDoc(collection(db, "passwords"), {
        type: entryType, category, site: siteName, field1,
        password: sitePass ? encryptData(sitePass, VAULT_KEY) : '',
        reminder: reminderDays,
        userId: auth.currentUser?.uid, createdAt: serverTimestamp(), deleted: false
      });
      setSiteName(''); setField1(''); setSitePass(''); setReminderDays('Yok');
      setIsAdding(false); notify("Şifre kilitlendi!");
    } catch { setIsAdding(false); notify("Bağlantı hatası!"); }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !currentPassword) return notify("Hata: Eksik bilgi.");
    setProfileLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await verifyBeforeUpdateEmail(user, newEmail);
      notify("Onay maili gönderildi.");
      setNewEmail(''); setCurrentPassword('');
    } catch (err) { notify("Hata: Şifre yanlış."); }
    finally { setProfileLoading(false); }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !currentPassword) return notify("Hata: Eksik bilgi.");
    setProfileLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      notify("Master şifre güncellendi!");
      setCurrentPassword(''); setNewPassword('');
    } catch (err) { notify("Hata: Mevcut şifre yanlış."); }
    finally { setProfileLoading(false); }
  };

  const handleToggle2FA = () => {
    const nextState = !is2FAEnabled;
    setIs2FAEnabled(nextState);
    localStorage.setItem('kasaos_2fa_status', String(nextState));
    notify(nextState ? "2FA Aktif." : "2FA Devre dışı.");
  };

  const handleExportVault = () => {
    const activeData = passwords.filter(p => !p.deleted).map(p => ({
      site: p.site, kullanici: p.field1, sifre: decryptData(p.password, VAULT_KEY), kategori: p.category
    }));
    const dataStr = JSON.stringify(activeData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `KasaOS_Yedek.json`; link.click();
    notify("Yedek dışa aktarıldı!");
  };

  const filteredData = useMemo(() => {
    return passwords.filter(p => {
      const matchesSearch = p.site?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTrash = showTrash ? p.deleted === true : !p.deleted;
      const matchesCat = selectedCategory === 'Hepsi' || p.category === selectedCategory;
      return matchesSearch && matchesTrash && matchesCat;
    });
  }, [passwords, searchTerm, showTrash, selectedCategory]);

  const generateSecurePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let p = "";
    for (let i = 0; i < 18; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    setGenPass(p);
  };

  // --- GÜVENLİK BARİYERİ: KONTROL BİTMEDEN SAYFAYI GÖSTERME ---
  if (authChecking) {
    return (
      <div className="fixed inset-0 bg-[#030712] flex flex-col items-center justify-center z-[9999]">
         <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center animate-pulse mb-8 shadow-2xl shadow-blue-600/20">
            <Shield className="text-white" size={40} />
         </div>
         <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <p className="text-blue-500 font-black text-[10px] uppercase tracking-[0.4em]">KasaOS Güvenlik Doğrulaması...</p>
         </div>
      </div>
    );
  }

  return (
    <main className={`${darkMode ? 'bg-[#030712]' : 'bg-slate-50'} ${textColor} min-h-screen p-4 md:p-12 transition-all duration-500`}>
      
      {/* --- ZARİF HATIRLATICI PENCERESİ --- */}
      <div className="fixed bottom-8 left-8 z-[750] flex flex-col gap-4 max-w-sm">
        <AnimatePresence>
          {expiredPasswords.map(p => (
            <motion.div key={p.id} initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }}
              className={`${darkMode ? 'bg-[#1e293b]/95 border-blue-500/30' : 'bg-white border-blue-200'} border p-6 rounded-[2.5rem] shadow-2xl backdrop-blur-xl`}>
              <div className="flex gap-4 mb-4">
                <div className="bg-blue-500/20 text-blue-500 p-3 rounded-2xl"><Clock size={24}/></div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tighter italic">Yenileme Vakti</h4>
                  <p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">{p.site} şifreniz eskiyor.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDismissedReminders(prev => [...prev, p.id])} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-700 transition-all">Şimdi Güncelle</button>
                <button onClick={() => setDismissedReminders(prev => [...prev, p.id])} className={`px-4 py-3 rounded-2xl border ${inputBg} opacity-50 hover:opacity-100 transition-all`}><X size={14}/></button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="max-w-7xl mx-auto pb-40">
        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-3xl shadow-blue-600/40 rotate-6">
              <Shield className="text-white" size={38} />
            </div>
            <div>
              <h1 className="text-5xl font-black italic tracking-tighter leading-none mb-2">KasaOS <span className="text-blue-600">MEGA</span></h1>
              <span className="text-[10px] font-black px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20 uppercase tracking-[0.2em]">Uçtan Uca Şifreli</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handlePanic} className="p-4.5 bg-red-600 text-white rounded-[1.5rem] shadow-xl shadow-red-600/30 hover:scale-110 active:scale-95 transition-all animate-pulse">
                <Zap size={22} fill="currentColor"/>
            </button>
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30" size={20} />
              <input placeholder="Hızlı ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-48 py-4.5 pl-14 pr-6 rounded-[2rem] outline-none border transition-all text-sm font-bold ${inputBg} ${textColor} focus:w-64 focus:border-blue-600`}/>
            </div>
            <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }} 
              className={`p-4.5 rounded-[1.5rem] border transition-all hover:scale-105 ${isSelectionMode ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : inputBg}`}>
              <ListChecks size={22} />
            </button>
            <button onClick={() => setShowNotifHistory(true)} className={`p-4.5 rounded-[1.5rem] border ${inputBg} relative hover:scale-105`}><Bell size={22} /> {notifHistory.length > 0 && <span className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full" />}</button>
            <button onClick={() => setShowTrash(!showTrash)} className={`p-4.5 rounded-[1.5rem] border transition-all hover:scale-105 ${showTrash ? 'bg-red-500 text-white shadow-xl shadow-red-500/20' : inputBg}`}><Trash2 size={22} /></button>
            
            <button onClick={() => setIsProfileOpen(true)} className={`p-4.5 rounded-[1.5rem] border ${inputBg} hover:scale-105 transition-all`}>
              <User size={22} className="text-blue-500" />
            </button>

            <button onClick={() => setDarkMode(!darkMode)} className={`p-4.5 rounded-[1.5rem] border ${inputBg} hover:rotate-12 transition-all`}>{darkMode ? <Sun size={22} /> : <Moon size={22} />}</button>
            <button onClick={() => setConfirmModal({ show: true, type: 'logout' })} className="p-4.5 bg-red-500/10 text-red-500 rounded-[1.5rem] border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"><LogOut size={22}/></button>
          </div>
        </header>

        {/* --- STATS --- */}
        {!showTrash && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className={`${darkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'} p-8 rounded-[3rem] border flex items-center gap-6 shadow-sm`}>
              <div className="bg-blue-600/10 text-blue-600 p-5 rounded-3xl"><ShieldCheck size={32}/></div>
              <div>
                <h3 className="text-3xl font-black italic tracking-tighter">{stats.total}</h3>
                <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">Kayıtlı Şifre</p>
              </div>
            </div>
            <div className={`${darkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'} p-8 rounded-[3rem] border flex items-center gap-6 shadow-sm`}>
              <div className="bg-red-600/10 text-red-600 p-5 rounded-3xl"><AlertTriangle size={32}/></div>
              <div>
                <h3 className="text-3xl font-black italic tracking-tighter">{stats.risks}</h3>
                <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">Zayıf Şifre</p>
              </div>
            </div>
            <div className={`${darkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'} p-8 rounded-[3rem] border flex items-center gap-6 shadow-sm`}>
              <div className="bg-emerald-600/10 text-emerald-600 p-5 rounded-3xl"><Activity size={32}/></div>
              <div className="flex-1">
                <div className="flex justify-between items-end mb-1">
                  <h3 className="text-3xl font-black italic tracking-tighter">%{stats.health}</h3>
                  <p className="text-[10px] font-black opacity-30 uppercase tracking-widest pb-1">Sağlık</p>
                </div>
                <div className="h-2 bg-slate-700/20 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${stats.health}%` }} className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TRASH CONTROLS --- */}
        <AnimatePresence>
          {showTrash && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="bg-red-500/5 border border-red-500/20 p-8 rounded-[3.5rem] mb-10 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
              <div className="flex items-center gap-6">
                <div className="bg-red-500 text-white p-4 rounded-3xl shadow-lg shadow-red-500/30 rotate-12"><Trash2 size={24} /></div>
                <div>
                  <h2 className="text-xl font-black text-red-500 uppercase tracking-tighter italic">Çöp Kutusu</h2>
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Verileri yönetin veya kalıcı olarak silin</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setConfirmModal({ show: true, type: 'restore' })} className="px-8 py-4 bg-emerald-500 text-white rounded-[1.5rem] font-black text-[10px] tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 uppercase"><RotateCcw size={16}/> Hepsini Geri Yükle</button>
                <button onClick={() => setConfirmModal({ show: true, type: 'clear' })} className="px-8 py-4 bg-red-600 text-white rounded-[1.5rem] font-black text-[10px] tracking-widest flex items-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 uppercase"><Trash2 size={16}/> Tümünü Sil</button>
                <button onClick={() => setShowTrash(false)} className={`px-8 py-4 rounded-[1.5rem] font-black text-[10px] border ${inputBg} flex items-center gap-2 uppercase transition-all hover:scale-105`}><ArrowLeft size={16}/> Geri Dön</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- CATEGORIES --- */}
        {!showTrash && (
          <div className="flex gap-3 mb-10 overflow-x-auto pb-4 no-scrollbar">
            {['Hepsi', ...categories].map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest border transition-all whitespace-nowrap
                ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : `${inputBg} opacity-60 hover:opacity-100`}`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* --- ADD FORM --- */}
        {!showTrash && !isSelectionMode && (
          <motion.div layout className={`${darkMode ? 'bg-[#0f172a]/90 border-white/5' : 'bg-white border-slate-200 shadow-2xl'} border p-8 rounded-[4rem] mb-16 backdrop-blur-3xl`}>
            <div className="flex flex-col lg:flex-row gap-6 mb-6">
              <div className="relative">
                <button onClick={() => { setIsTypeOpen(!isTypeOpen); setIsCatOpen(false); setIsRemindOpen(false); }} 
                  className={`w-full lg:w-56 p-5 rounded-[2rem] border font-black text-xs flex items-center justify-between transition-all ${inputBg}`}>
                  {entryType} <ChevronDown size={16} className={`transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isTypeOpen && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className={`absolute top-full left-0 w-full mt-2 z-[600] rounded-[2rem] border overflow-hidden p-2 backdrop-blur-2xl ${darkMode ? 'bg-[#1e293b]/95 border-white/10' : 'bg-white border-slate-200 shadow-2xl'}`}>
                      {entryTypes.map(t => (
                        <button key={t} onClick={() => { setEntryType(t); setIsTypeOpen(false); }} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors`}>{t}</button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button onClick={() => { setIsCatOpen(!isCatOpen); setIsTypeOpen(false); setIsRemindOpen(false); }} 
                  className={`w-full lg:w-44 p-5 rounded-[2rem] border font-black text-xs flex items-center justify-between transition-all ${inputBg}`}>
                  {category} <ChevronDown size={16} className={`transition-transform ${isCatOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isCatOpen && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className={`absolute top-full left-0 w-full mt-2 z-[600] rounded-[2rem] border overflow-hidden p-2 backdrop-blur-2xl ${darkMode ? 'bg-[#1e293b]/95 border-white/10' : 'bg-white border-slate-200 shadow-2xl'}`}>
                      {categories.map(c => (
                        <button key={c} onClick={() => { setCategory(c); setIsCatOpen(false); }} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors`}>{c}</button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 grid gap-4 md:grid-cols-3">
                <input placeholder="Hizmet Adı" value={siteName} onChange={e => setSiteName(e.target.value)} className={`p-5 rounded-[2.5rem] border outline-none font-bold transition-all focus:border-blue-500 ${inputBg} ${textColor}`}/>
                <input placeholder="Kullanıcı / Hesap" value={field1} onChange={e => setField1(e.target.value)} className={`p-5 rounded-[2.5rem] border outline-none font-bold transition-all focus:border-blue-500 ${inputBg} ${textColor}`}/>
                <div className="relative">
                  <input type="password" placeholder="Şifre" value={sitePass} onChange={e => setSitePass(e.target.value)} className={`w-full p-5 rounded-[2.5rem] border outline-none font-bold transition-all focus:border-blue-500 ${inputBg} ${textColor}`}/>
                  <button onClick={() => {setIsGenOpen(true); generateSecurePassword();}} className="absolute right-5 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg hover:scale-110 transition-transform"><Wand2 size={16}/></button>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Hatırlatıcı:</span>
                <div className="relative">
                  <button onClick={() => setIsRemindOpen(!isRemindOpen)} className={`px-6 py-3 rounded-2xl border font-black text-[10px] uppercase flex items-center gap-3 transition-all ${inputBg}`}>
                    <Clock size={14}/> {reminderDays} <ChevronDown size={12} />
                  </button>
                  <AnimatePresence>
                    {isRemindOpen && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                        className={`absolute top-full left-0 w-40 mt-2 z-[600] rounded-2xl border overflow-hidden p-2 backdrop-blur-2xl ${darkMode ? 'bg-[#1e293b]/95 border-white/10' : 'bg-white border-slate-200'}`}>
                        {reminderOptions.map(r => (
                          <button key={r} onClick={() => { setReminderDays(r); setIsRemindOpen(false); }} className={`w-full text-left p-3 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-colors`}>{r}</button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <button onClick={handleSave} disabled={isAdding} className="bg-blue-600 hover:bg-blue-500 px-12 py-5 rounded-[2.5rem] font-black text-xs text-white shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest">
                {isAdding ? <Loader2 size={26} className="animate-spin" /> : <><Plus size={26}/> Şifreyi Kilitle</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* --- CARDS LIST --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <AnimatePresence mode='popLayout'>
            {filteredData.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const strength = getPassStrength(item.password);
              return (
                <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: isSelected ? 0.95 : 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => isSelectionMode && (isSelected ? setSelectedIds(s => s.filter(i => i !== item.id)) : setSelectedIds(s => [...s, item.id]))}
                  className={`p-10 rounded-[4rem] border transition-all cursor-pointer relative group ${isSelected ? 'border-blue-600 bg-blue-600/10' : darkMode ? 'bg-[#1e293b]/40 border-white/5 hover:bg-[#1e293b]/60' : 'bg-white border-slate-200 shadow-xl'}`}>
                  
                  {!isSelectionMode && !showTrash && (
                    <div className="absolute top-11 right-28 flex flex-col items-center">
                      <div className={`w-3.5 h-3.5 rounded-full ${strength.color} ring-4 ring-${strength.color.split('-')[1]}-500/20 mb-1.5 shadow-lg`} />
                      <span className="text-[8px] font-black opacity-30 tracking-widest">{strength.label}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-5 mb-10">
                    <div className={`w-16 h-16 rounded-[1.8rem] flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white' : darkMode ? 'bg-white/5 text-blue-400' : 'bg-slate-100 text-blue-600'}`}>
                      {isSelectionMode ? (isSelected ? <CheckSquare size={26}/> : <Square size={26}/>) : (item.type.includes('Banka') ? <CreditCard size={26}/> : <Mail size={26}/>)}
                    </div>
                    <div>
                      <h3 className={`font-black text-2xl tracking-tighter leading-none mb-1.5 ${isSelected ? 'text-blue-500' : textColor}`}>{item.site}</h3>
                      <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">{item.category}</span>
                    </div>
                  </div>

                  <div className={`p-8 rounded-[2.5rem] mb-8 transition-all relative group/field ${isSelected ? 'bg-blue-600/10' : darkMode ? 'bg-black/30 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
                    <p className="text-[10px] font-black uppercase mb-2 opacity-30 tracking-widest italic">HESAP / KİMLİK</p>
                    <p className="font-bold text-lg truncate pr-10">{item.field1}</p>
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.field1); notify("Hesap kopyalandı!"); }}
                      className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/field:opacity-100 transition-all p-3 hover:bg-blue-600 hover:text-white rounded-xl">
                      <Copy size={18}/>
                    </button>
                  </div>

                  {!showTrash && !isSelectionMode && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedPass({ val: decryptData(item.password, VAULT_KEY), site: item.site }); }} 
                      className="w-full bg-blue-600 py-6 rounded-[2.5rem] font-black text-xs text-white flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95 uppercase tracking-widest">
                      <Eye size={20}/> GÖRÜNTÜLE
                    </button>
                  )}

                  {!isSelectionMode && (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmModal({show: true, type: 'singleDelete', targetId: item.id}); }} 
                      className="absolute top-8 right-8 p-3.5 text-slate-600 hover:text-red-500 transition-all bg-white/5 rounded-2xl border border-transparent hover:border-red-500/20 hover:scale-110">
                      {showTrash ? <RotateCcw size={22}/> : <Trash2 size={22}/>}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* --- SEÇİM ÇUBUĞU --- */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[450] w-full max-w-2xl px-6">
            <div className={`p-6 rounded-[3rem] border shadow-4xl flex items-center justify-between backdrop-blur-2xl ${darkMode ? 'bg-[#1e293b]/90 border-blue-500/30' : 'bg-white border-blue-200'}`}>
              <div className="flex items-center gap-6 pl-4">
                <div className="bg-blue-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-lg">{selectedIds.length}</div>
                <div>
                  <p className="font-black text-xs uppercase tracking-widest text-blue-500">Öğe Seçildi</p>
                  <p className="text-[10px] font-bold opacity-40 uppercase">Toplu işlem modundasınız</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => { if(selectedIds.length > 0) setConfirmModal({show:true, type: 'bulkDelete'}); }} 
                  className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${selectedIds.length > 0 ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 active:scale-95' : 'opacity-30 cursor-not-allowed bg-slate-500/20'}`}>
                  Seçilenleri Sil
                </button>
                <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border ${inputBg} hover:bg-slate-500/10 transition-all active:scale-95`}>İptal</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ONAY MODALI --- */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmModal({show:false, type:null})} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.8, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className={`relative w-full max-w-lg p-14 rounded-[5rem] text-center shadow-4xl ${darkMode ? 'bg-[#111827] border border-white/10' : 'bg-white'}`}>
              <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl ${confirmModal.type?.includes('Delete') || confirmModal.type === 'clear' ? 'bg-red-500/10 text-red-500 shadow-red-500/10' : 'bg-blue-500/10 text-blue-500 shadow-blue-500/10'}`}>
                <ShieldAlert size={48}/>
              </div>
              <h2 className="text-4xl font-black mb-4 tracking-tighter italic uppercase">Onay Gerekli</h2>
              <p className="opacity-50 mb-12 font-bold text-sm tracking-tight leading-relaxed">Bu işlemi gerçekleştirmek istediğinizden emin misiniz?</p>
              <div className="flex gap-4">
                <button onClick={() => setConfirmModal({show:false, type:null})} className={`flex-1 py-6 rounded-[2.5rem] font-black text-xs tracking-widest ${inputBg} opacity-60 hover:opacity-100 uppercase transition-all active:scale-95`}>Vazgeç</button>
                <button onClick={executeConfirmAction} className={`flex-1 py-6 rounded-[2.5rem] font-black text-xs text-white tracking-widest uppercase shadow-2xl transition-all active:scale-95 ${confirmModal.type?.includes('Delete') || confirmModal.type === 'clear' ? 'bg-red-600 shadow-red-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>Evet, Onayla</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PROFİL MODALI --- */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProfileOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className={`relative w-full max-w-xl border rounded-[5rem] p-12 md:p-16 shadow-4xl ${darkMode ? 'bg-[#111827] border-white/10' : 'bg-white border-slate-200'}`}>
              <button onClick={() => setIsProfileOpen(false)} className="absolute top-10 right-10 p-3 text-slate-500 hover:text-red-500 rounded-full transition-all"><X size={28}/></button>
              <div className="flex items-center gap-5 mb-10">
                <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-[2rem] flex items-center justify-center font-bold shadow-inner"><User size={32} /></div>
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase">Hesap & Güvenlik</h2>
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{auth.currentUser?.email}</p>
                </div>
              </div>
              <div className={`p-6 rounded-[2.5rem] border mb-8 ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-3 flex items-center gap-2"><Key size={14} /> Yetki Doğrulaması (Zorunlu)</p>
                <input type="password" placeholder="Mevcut Master Şifreniz" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={`w-full p-4 rounded-[1.8rem] border outline-none font-bold text-xs transition-all focus:border-blue-500 ${inputBg} ${textColor}`} />
              </div>
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                  <input type="email" placeholder="Yeni E-posta" value={newEmail} onChange={e => setNewEmail(e.target.value)} className={`flex-1 p-4 rounded-[1.8rem] border outline-none font-bold text-xs transition-all focus:border-blue-500 ${inputBg} ${textColor}`} />
                  <button onClick={handleUpdateEmail} disabled={profileLoading || !newEmail || !currentPassword} className="px-6 py-4 bg-blue-600 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 disabled:opacity-40 transition-all active:scale-95">Mail Değiştir</button>
                </div>
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                  <input type="password" placeholder="Yeni Master Şifre" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`flex-1 p-4 rounded-[1.8rem] border outline-none font-bold text-xs transition-all focus:border-blue-500 ${inputBg} ${textColor}`} />
                  <button onClick={handleUpdatePassword} disabled={profileLoading || !newPassword || !currentPassword} className="px-6 py-4 bg-blue-600 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 disabled:opacity-40 transition-all active:scale-95">Şifre Değiştir</button>
                </div>
                <div className="pt-4 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                  <button onClick={handleToggle2FA} className={`flex-1 w-full py-4 px-6 rounded-[1.8rem] border font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 ${is2FAEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : `${inputBg} opacity-60 hover:opacity-100`}`}>
                    <ShieldCheck size={16} /> {is2FAEnabled ? "2FA: Aktif" : "2FA Aç"}
                  </button>
                  <button onClick={handleExportVault} className="flex-1 w-full py-4 px-6 bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-600 hover:text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95">
                    <Download size={16} /> Yedekle
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- VIEW PASSWORD MODAL --- */}
      <AnimatePresence>
        {selectedPass && (
          <div className="fixed inset-0 z-[900] flex items-center justify-center p-6 text-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPass(null)} className="absolute inset-0 bg-black/95 backdrop-blur-3xl" />
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
              className={`relative w-full max-w-2xl border rounded-[6rem] p-20 ${darkMode ? 'bg-[#0f172a] border-white/10' : 'bg-white border-slate-200 shadow-4xl'}`}>
              <button onClick={() => setSelectedPass(null)} className="absolute top-14 right-14 text-slate-500 hover:text-red-500 transition-all p-4 rounded-full"><X size={42}/></button>
              <h2 className="text-5xl font-black mb-6 tracking-tighter italic text-blue-600 uppercase">{selectedPass.site}</h2>
              <div className={`p-16 rounded-[4rem] mb-16 font-mono text-5xl break-all tracking-[0.4em] shadow-inner ${darkMode ? 'bg-black/60 text-emerald-400' : 'bg-slate-100 text-blue-700'}`}>
                {selectedPass.val}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(selectedPass.val); notify("Şifre kopyalandı!"); }} 
                className="w-full bg-blue-600 py-10 rounded-[3rem] font-black text-sm text-white shadow-3xl active:scale-95 flex items-center justify-center gap-5 uppercase tracking-widest"><Copy size={36}/> Panoya Kopyala</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PASSWORD GENERATOR --- */}
      <AnimatePresence>
        {isGenOpen && (
          <div className="fixed inset-0 z-[900] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGenOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className={`relative w-full max-w-md border rounded-[5rem] p-16 text-center shadow-4xl ${darkMode ? 'bg-[#111827] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="w-28 h-28 bg-blue-600/10 rounded-[3rem] flex items-center justify-center mx-auto mb-10"><Wand2 className="text-blue-500" size={56} /></div>
              <h2 className={`text-4xl font-black mb-10 italic tracking-tighter uppercase ${textColor}`}>Şifre Üretici</h2>
              <div className={`p-10 rounded-[3.5rem] mb-10 font-mono text-3xl break-all shadow-inner ${darkMode ? 'bg-black/60 text-blue-400' : 'bg-slate-100'}`}>{genPass}</div>
              <div className="flex flex-col gap-5">
                <button onClick={generateSecurePassword} className="w-full py-6 rounded-[2.5rem] bg-blue-600/10 text-blue-500 font-black text-[10px] tracking-widest uppercase hover:bg-blue-600/20 transition-all active:scale-95">Yenile</button>
                <button onClick={() => { setSitePass(genPass); setIsGenOpen(false); notify("Şifre uygulandı!"); }} className="w-full bg-blue-600 py-6 rounded-[2.5rem] font-black text-[10px] text-white shadow-2xl active:scale-95 uppercase tracking-widest">Kasaya Aktar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

{/* --- CANLI BİLDİRİM TOAST SİSTEMİ (SAĞ ÜST) --- */}
      <div className="fixed top-10 right-10 z-[2000] flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className={`pointer-events-auto p-6 rounded-[2rem] border shadow-4xl min-w-[320px] flex items-center gap-4 backdrop-blur-2xl ${
                darkMode 
                  ? 'bg-[#1e293b]/90 border-blue-500/30 text-white shadow-blue-500/10' 
                  : 'bg-white border-blue-200 text-slate-900 shadow-xl'
              }`}
            >
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Bell size={24} className="text-white animate-bounce" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mb-1">Sistem Mesajı</p>
                <p className="font-bold text-sm leading-tight tracking-tight">{n.msg}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="p-2 hover:bg-slate-500/10 rounded-full transition-colors"
              >
                <X size={18} className="opacity-40" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* --- BİLDİRİM GEÇMİŞİ (SAĞ PANEL) --- */}
      <AnimatePresence>
        {showNotifHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNotifHistory(false)} className="fixed inset-0 bg-black/60 backdrop-blur-md z-[190]" />
            <motion.div initial={{ x: 600 }} animate={{ x: 0 }} exit={{ x: 600 }}
              className={`fixed right-0 top-0 h-full w-full md:w-[450px] z-[200] shadow-4xl p-12 border-l backdrop-blur-3xl ${darkMode ? 'bg-[#0f172a]/95 border-white/10' : 'bg-white/95 border-slate-200'}`}>
              <div className="flex justify-between items-center mb-16">
                <h2 className="text-4xl font-black italic tracking-tighter uppercase">Bildirimler</h2>
                <button onClick={() => setShowNotifHistory(false)} className="p-4 hover:bg-red-500/10 text-red-500 rounded-full transition-all"><X size={32}/></button>
              </div>
              <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-200px)] pr-4 custom-scrollbar">
                {notifHistory.length === 0 ? (
                  <p className="text-center opacity-30 py-20 font-bold italic">Kayıt yok.</p>
                ) : (
                  notifHistory.map(h => (
                    <div key={h.id} className={`p-8 rounded-[2.5rem] border relative overflow-hidden transition-all hover:scale-[1.02] ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="absolute left-0 top-0 w-1.5 h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
                      <p className={`font-black text-sm tracking-tight mb-3 ${textColor}`}>{h.msg}</p>
                      <span className="text-[10px] opacity-30 font-black tracking-widest">{h.time}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </main>
  );
}
