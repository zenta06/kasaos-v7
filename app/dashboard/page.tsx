"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Copy, LogOut, Shield, CreditCard, Mail, User, Check, 
  Eye, X, Search, Sun, Moon, Wand2, Bell, RotateCcw, ArrowLeft,
  ListChecks, CheckSquare, Square, ChevronDown, Loader2,
  ShieldAlert, ShieldCheck, Zap, Activity, Clock, AlertTriangle, Download, Key,
  Lock, Unlock, BarChart3, TrendingUp, ExternalLink, RefreshCw, CheckCircle2,
  XCircle, Info, Wifi, WifiOff, Eye as EyeIcon, EyeOff
} from 'lucide-react';
import { encryptData, decryptData } from '@/lib/crypto';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

// ============================================================
// SHA-1 HASH YARDIMCISI (HIBP için)
// ============================================================
async function sha1(str: string): Promise<string> {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function checkPwned(password: string): Promise<number> {
  try {
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!res.ok) return 0;
    const text = await res.text();
    const line = text.split('\n').find(l => l.startsWith(suffix));
    if (!line) return 0;
    return parseInt(line.split(':')[1].trim(), 10);
  } catch {
    return -1; // hata durumu
  }
}

export default function Dashboard() {
  // --- GÜVENLİK VE YÜKLEME STATE'LERİ ---
  const [authChecking, setAuthChecking] = useState(true);
  
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

  // --- YENİ: SIZINTI KONTROLÜ ---
  const [pwnedResults, setPwnedResults] = useState<Record<string, number>>({}); // id -> count
  const [pwnedChecking, setPwnedChecking] = useState(false);
  const [pwnedDismissed, setPwnedDismissed] = useState(false);
  const [showPwnedBanner, setShowPwnedBanner] = useState(false);

  // --- YENİ: GÜVENLİK RAPORU ---
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResults, setAuditResults] = useState<any[]>([]);

  // --- YENİ: SESSION TIMEOUT ---
  const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 dakika
  const lastActivityRef = useRef(Date.now());
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showSessionBanner, setShowSessionBanner] = useState(false);

  // --- YENİ: Şifre görünürlük toggle ---
  const [visiblePassId, setVisiblePassId] = useState<string | null>(null);

  const router = useRouter();
  process.env.NEXT_PUBLIC_VAULT_KEY;
  const categories = ['Genel', 'Sosyal', 'İş', 'Finans', 'Alışveriş'];
  const entryTypes = ['E-posta / Şifre', 'Banka / Kart'];
  const reminderOptions = ['Yok', '30 Gün', '60 Gün', '90 Gün'];

  const inputBg = darkMode ? 'bg-[#1e293b] border-white/10' : 'bg-white border-slate-300 shadow-sm';
  const cardBg = darkMode ? 'bg-[#0f172a] border-white/5' : 'bg-white border-slate-200 shadow-lg';
  const textColor = darkMode ? 'text-slate-100' : 'text-slate-900';
  const subText = darkMode ? 'text-slate-400' : 'text-slate-500';

  const notify = useCallback((msg: string) => {
    const id = Date.now();
    new Audio('/notify.mp3').play().catch(() => {}); 
    const newNotif = { id, msg, time: new Date().toLocaleTimeString() };
    setNotifications(prev => [...prev, newNotif]);
    setNotifHistory(prev => [newNotif, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // ============================================================
  // SESSION TIMEOUT MANTIĞI
  // ============================================================
  const resetSessionTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetSessionTimer, { passive: true }));

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= SESSION_TIMEOUT_MS) {
        clearInterval(interval);
        auth.signOut().then(() => {
          // Session banner'ı login sayfasında göstermek için sessionStorage kullan
          sessionStorage.setItem('kasaos_session_timeout', 'true');
          router.replace('/');
        });
      }
    }, 10000);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetSessionTimer));
      clearInterval(interval);
    };
  }, [resetSessionTimer, router]);

  // Login sayfasından döndükten sonra banner göster (bu component mount olunca)
  useEffect(() => {
    if (sessionStorage.getItem('kasaos_session_timeout') === 'true') {
      setShowSessionBanner(true);
      sessionStorage.removeItem('kasaos_session_timeout');
    }
  }, []);

  // ============================================================
  // AUTH VE VERİ DİNLEYİCİSİ
  // ============================================================
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/');
      } else {
        const q = query(collection(db, "passwords"), where("userId", "==", user.uid));
        const unsubSnap = onSnapshot(q, (snap) => {
          setPasswords(snap.docs.map(d => ({ ...d.data(), id: d.id })));
          setAuthChecking(false);
        });
        const saved2FA = localStorage.getItem('kasaos_2fa_status');
        if (saved2FA === 'true') setIs2FAEnabled(true);
        return () => unsubSnap();
      }
    });
    return () => unsubAuth();
  }, [router]);

  // ============================================================
  // SIZINTI KONTROLÜ - şifreler yüklenince otomatik çalış
  // ============================================================
  const runPwnedCheck = useCallback(async (passArr: any[]) => {
    if (passArr.length === 0) return;
    setPwnedChecking(true);
    const results: Record<string, number> = {};
    for (const p of passArr.filter(p => !p.deleted && p.password)) {
      const dec = decryptData(p.password, VAULT_KEY);
      if (dec) {
        const count = await checkPwned(dec);
        results[p.id] = count;
        await new Promise(r => setTimeout(r, 100)); // rate limit
      }
    }
    setPwnedResults(results);
    setPwnedChecking(false);
    const leaked = Object.values(results).filter(c => c > 0).length;
    if (leaked > 0) setShowPwnedBanner(true);
  }, []);

  useEffect(() => {
    if (!authChecking && passwords.length > 0) {
      runPwnedCheck(passwords);
    }
  }, [authChecking]);

  const leakedPasswords = useMemo(() => {
    return passwords.filter(p => !p.deleted && pwnedResults[p.id] > 0);
  }, [passwords, pwnedResults]);

  // ============================================================
  // GÜVENLİK RAPORU
  // ============================================================
  const runAudit = useCallback(async () => {
    setAuditLoading(true);
    const active = passwords.filter(p => !p.deleted);
    const results = await Promise.all(active.map(async (p) => {
      const dec = p.password ? decryptData(p.password, VAULT_KEY) : '';
      const strength = getPassStrength(p.password);
      let pwnCount = pwnedResults[p.id];
      if (pwnCount === undefined && dec) {
        pwnCount = await checkPwned(dec);
        await new Promise(r => setTimeout(r, 100));
      }
      return {
        ...p,
        decrypted: dec,
        strength,
        pwnCount: pwnCount ?? 0,
        hasReminder: p.reminder && p.reminder !== 'Yok',
      };
    }));
    setAuditResults(results);
    setAuditLoading(false);
  }, [passwords, pwnedResults]);

  const openAudit = () => {
    setShowAuditModal(true);
    runAudit();
  };

  // ============================================================
  // PANIC MODE
  // ============================================================
  const handlePanic = () => {
    auth.signOut();
    window.location.href = "https://www.google.com";
  };

  // ============================================================
  // YARDIMCI FONKSİYONLAR
  // ============================================================
  const getPassStrength = (pass: string) => {
    if (!pass) return { score: 0, color: 'bg-slate-500', label: 'Yok', textColor: 'text-slate-400' };
    const dec = decryptData(pass, VAULT_KEY);
    let score = 0;
    if (dec.length > 8) score++;
    if (dec.length > 12) score++;
    if (/[A-Z]/.test(dec)) score++;
    if (/[0-9]/.test(dec)) score++;
    if (/[^A-Za-z0-9]/.test(dec)) score++;
    if (score <= 2) return { score, color: 'bg-red-500', label: 'ZAYIF', textColor: 'text-red-400' };
    if (score <= 4) return { score, color: 'bg-amber-500', label: 'ORTA', textColor: 'text-amber-400' };
    return { score, color: 'bg-emerald-500', label: 'GÜÇLÜ', textColor: 'text-emerald-400' };
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

  const healthColor = stats.health >= 80 ? 'bg-emerald-500' : stats.health >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const healthGlow = stats.health >= 80 ? 'shadow-emerald-500/50' : stats.health >= 50 ? 'shadow-amber-500/50' : 'shadow-red-500/50';

  // --- GÜVENLİK BARİYERİ ---
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
    <main className={`${darkMode ? 'bg-[#030712]' : 'bg-slate-50'} ${textColor} min-h-screen p-3 sm:p-6 md:p-10 transition-all duration-500`}>
      
      {/* ============================================================
          YENİ: SESSION TIMEOUT BANNERI (Kullanıcı kapatmadıkça kapanmaz)
      ============================================================ */}
      <AnimatePresence>
        {showSessionBanner && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[3000] flex items-center justify-between gap-4 px-4 sm:px-8 py-4 bg-amber-500 text-white shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl p-2"><Clock size={20}/></div>
              <div>
                <p className="font-black text-xs sm:text-sm uppercase tracking-wide">Oturum Zaman Aşımı</p>
                <p className="text-[10px] sm:text-xs opacity-80 font-bold">5 Dakika Boyunca Hareket Etmediğiniz İçin Giriş Sayfasına Aktarıldınız.</p>
              </div>
            </div>
            <button onClick={() => setShowSessionBanner(false)} className="bg-white/20 hover:bg-white/30 rounded-xl p-2 transition-all flex-shrink-0"><X size={18}/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          YENİ: SIZINTI UYARI BANNERI (Kullanıcı kapatmadıkça kapanmaz)
      ============================================================ */}
      <AnimatePresence>
        {showPwnedBanner && !pwnedDismissed && leakedPasswords.length > 0 && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className={`fixed ${showSessionBanner ? 'top-[72px]' : 'top-0'} left-0 right-0 z-[2900] shadow-2xl`}
          >
            <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-600 text-white px-4 sm:px-8 py-4">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="bg-white/20 rounded-xl p-2.5 flex-shrink-0 mt-0.5 sm:mt-0">
                    <ShieldAlert size={22}/>
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                      <span className="bg-white text-red-600 text-[9px] px-2 py-0.5 rounded-full font-black">ACİL</span>
                      Veri Sızıntısı Tespit Edildi!
                    </p>
                    <p className="text-xs opacity-90 font-bold mt-0.5">
                      <strong>{leakedPasswords.length} şifreniz</strong> HaveIBeenPwned veritabanında sızdırılmış olarak görünüyor. Hemen değiştirmeniz önerilir.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {leakedPasswords.slice(0,5).map(p => (
                        <span key={p.id} className="bg-white/20 text-[10px] font-black px-2 py-0.5 rounded-lg">{p.site}</span>
                      ))}
                      {leakedPasswords.length > 5 && <span className="bg-white/20 text-[10px] font-black px-2 py-0.5 rounded-lg">+{leakedPasswords.length - 5} daha</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => { setShowAuditModal(true); runAudit(); }}
                    className="bg-white text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all whitespace-nowrap"
                  >
                    Raporu Gör
                  </button>
                  <button onClick={() => setPwnedDismissed(true)} className="bg-white/20 hover:bg-white/30 rounded-xl p-2 transition-all"><X size={18}/></button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ZARİF HATIRLATICI PENCERESİ --- */}
      <div className="fixed bottom-4 sm:bottom-8 left-4 sm:left-8 z-[750] flex flex-col gap-4 max-w-xs sm:max-w-sm">
        <AnimatePresence>
          {expiredPasswords.map(p => (
            <motion.div key={p.id} initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }}
              className={`${darkMode ? 'bg-[#1e293b]/95 border-blue-500/30' : 'bg-white border-blue-200'} border p-5 sm:p-6 rounded-[2.5rem] shadow-2xl backdrop-blur-xl`}>
              <div className="flex gap-4 mb-4">
                <div className="bg-blue-500/20 text-blue-500 p-3 rounded-2xl flex-shrink-0"><Clock size={20}/></div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-tighter italic">Yenileme Vakti</h4>
                  <p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">{p.site} şifreniz eskiyor.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDismissedReminders(prev => [...prev, p.id])} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-700 transition-all">Güncelle</button>
                <button onClick={() => setDismissedReminders(prev => [...prev, p.id])} className={`px-4 py-3 rounded-2xl border ${inputBg} opacity-50 hover:opacity-100 transition-all`}><X size={14}/></button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className={`max-w-7xl mx-auto pb-32 ${(showPwnedBanner && !pwnedDismissed && leakedPasswords.length > 0) || showSessionBanner ? 'pt-20 sm:pt-24' : ''}`}>
        
        {/* ============================================================
            HEADER - RESPONSIVE
        ============================================================ */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 sm:mb-16 gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-blue-600 rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center shadow-3xl shadow-blue-600/40 rotate-6 flex-shrink-0">
              <Shield className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-5xl font-black italic tracking-tighter leading-none mb-1 sm:mb-2">KasaOS <span className="text-blue-600">MEGA</span></h1>
              <span className="text-[9px] sm:text-[10px] font-black px-2 sm:px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20 uppercase tracking-[0.2em]">Uçtan Uca Şifreli</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button onClick={handlePanic} className="p-3 sm:p-4 bg-red-600 text-white rounded-[1.2rem] sm:rounded-[1.5rem] shadow-xl shadow-red-600/30 hover:scale-110 active:scale-95 transition-all animate-pulse">
              <Zap size={18} fill="currentColor"/>
            </button>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
              <input placeholder="Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-32 sm:w-48 py-3 sm:py-4 pl-10 sm:pl-14 pr-4 sm:pr-6 rounded-[1.5rem] sm:rounded-[2rem] outline-none border transition-all text-xs sm:text-sm font-bold ${inputBg} ${textColor} focus:w-40 sm:focus:w-64 focus:border-blue-600`}/>
            </div>
            <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }} 
              className={`p-3 sm:p-4 rounded-[1.2rem] sm:rounded-[1.5rem] border transition-all hover:scale-105 ${isSelectionMode ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : inputBg}`}>
              <ListChecks size={18} />
            </button>
            <button onClick={() => setShowNotifHistory(true)} className={`p-3 sm:p-4 rounded-[1.2rem] sm:rounded-[1.5rem] border ${inputBg} relative hover:scale-105`}>
              <Bell size={18} />
              {notifHistory.length > 0 && <span className="absolute top-3 sm:top-4 right-3 sm:right-4 w-2 h-2 bg-blue-500 rounded-full" />}
            </button>
            {/* Sızıntı kontrolü butonu */}
            <button
              onClick={() => runPwnedCheck(passwords)}
              disabled={pwnedChecking}
              className={`p-3 sm:p-4 rounded-[1.2rem] sm:rounded-[1.5rem] border transition-all hover:scale-105 ${leakedPasswords.length > 0 ? 'bg-red-500/10 border-red-500/30 text-red-400' : inputBg}`}
              title="Sızıntı Kontrolü"
            >
              {pwnedChecking ? <Loader2 size={18} className="animate-spin"/> : <WifiOff size={18}/>}
            </button>
            <button onClick={() => setShowTrash(!showTrash)} className={`p-3 sm:p-4 rounded-[1.2rem] sm:rounded-[1.5rem] border transition-all hover:scale-105 ${showTrash ? 'bg-red-500 text-white shadow-xl shadow-red-500/20' : inputBg}`}><Trash2 size={18} /></button>
            <button onClick={() => setIsProfileOpen(true)} className={`p-3 sm:p-4 rounded-[1.2rem] sm:rounded-[1.5rem] border ${inputBg} hover:scale-105 transition-all`}>
              <User size={18} className="text-blue-500" />
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-3 sm:p-4 rounded-[1.2rem] sm:rounded-[1.5rem] border ${inputBg} hover:rotate-12 transition-all`}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button onClick={() => setConfirmModal({ show: true, type: 'logout' })} className="p-3 sm:p-4 bg-red-500/10 text-red-500 rounded-[1.2rem] sm:rounded-[1.5rem] border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"><LogOut size={18}/></button>
          </div>
        </header>

        {/* ============================================================
            STATS - RESPONSIVE (Sağlık barına tıklanınca audit açılır)
        ============================================================ */}
        {!showTrash && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-12">
            <div className={`${darkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'} p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border flex items-center gap-4 sm:gap-6 shadow-sm`}>
              <div className="bg-blue-600/10 text-blue-600 p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex-shrink-0"><ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" /></div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black italic tracking-tighter">{stats.total}</h3>
                <p className="text-[9px] sm:text-[10px] font-black opacity-30 uppercase tracking-widest">Kayıtlı Şifre</p>
              </div>
            </div>
            <div className={`${darkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'} p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border flex items-center gap-4 sm:gap-6 shadow-sm`}>
              <div className="bg-red-600/10 text-red-600 p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex-shrink-0"><AlertTriangle size={24}/></div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black italic tracking-tighter">{stats.risks}</h3>
                <p className="text-[9px] sm:text-[10px] font-black opacity-30 uppercase tracking-widest">Zayıf Şifre</p>
              </div>
            </div>
            {/* Tıklanabilir sağlık kartı */}
            <button
              onClick={openAudit}
              className={`${darkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'} p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border flex items-center gap-4 sm:gap-6 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left w-full group`}
            >
              <div className={`bg-emerald-600/10 text-emerald-600 p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex-shrink-0 group-hover:bg-emerald-600/20 transition-all`}><Activity size={24}/></div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-end mb-1">
                  <h3 className="text-2xl sm:text-3xl font-black italic tracking-tighter">%{stats.health}</h3>
                  <div className="flex items-center gap-1 pb-1">
                    <p className="text-[9px] sm:text-[10px] font-black opacity-30 uppercase tracking-widest">Sağlık</p>
                    <BarChart3 size={12} className="opacity-30 group-hover:opacity-60 transition-all"/>
                  </div>
                </div>
                <div className="h-2 bg-slate-700/20 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${stats.health}%` }} className={`h-full ${healthColor} shadow-[0_0_10px_rgba(16,185,129,0.5)]`} />
                </div>
                <p className="text-[9px] opacity-0 group-hover:opacity-40 transition-all font-bold mt-1 uppercase tracking-widest">Rapora tıkla →</p>
              </div>
            </button>
          </div>
        )}

        {/* --- TRASH CONTROLS --- */}
        <AnimatePresence>
          {showTrash && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="bg-red-500/5 border border-red-500/20 p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3.5rem] mb-8 sm:mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 backdrop-blur-xl">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="bg-red-500 text-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-lg shadow-red-500/30 rotate-12 flex-shrink-0"><Trash2 size={20} /></div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-red-500 uppercase tracking-tighter italic">Çöp Kutusu</h2>
                  <p className="text-[9px] sm:text-[10px] font-bold opacity-40 uppercase tracking-widest">Verileri yönetin veya kalıcı olarak silin</p>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-4 flex-wrap">
                <button onClick={() => setConfirmModal({ show: true, type: 'restore' })} className="px-5 sm:px-8 py-3 sm:py-4 bg-emerald-500 text-white rounded-[1.2rem] sm:rounded-[1.5rem] font-black text-[9px] sm:text-[10px] tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 uppercase"><RotateCcw size={14}/> Geri Yükle</button>
                <button onClick={() => setConfirmModal({ show: true, type: 'clear' })} className="px-5 sm:px-8 py-3 sm:py-4 bg-red-600 text-white rounded-[1.2rem] sm:rounded-[1.5rem] font-black text-[9px] sm:text-[10px] tracking-widest flex items-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 uppercase"><Trash2 size={14}/> Tümünü Sil</button>
                <button onClick={() => setShowTrash(false)} className={`px-5 sm:px-8 py-3 sm:py-4 rounded-[1.2rem] sm:rounded-[1.5rem] font-black text-[9px] sm:text-[10px] border ${inputBg} flex items-center gap-2 uppercase transition-all hover:scale-105`}><ArrowLeft size={14}/> Geri Dön</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- CATEGORIES --- */}
        {!showTrash && (
          <div className="flex gap-2 sm:gap-3 mb-8 sm:mb-10 overflow-x-auto pb-2 no-scrollbar">
            {['Hepsi', ...categories].map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-5 sm:px-8 py-3 sm:py-4 rounded-[1.2rem] sm:rounded-[1.5rem] font-black text-[9px] sm:text-[10px] uppercase tracking-widest border transition-all whitespace-nowrap
                ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : `${inputBg} opacity-60 hover:opacity-100`}`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* --- ADD FORM --- */}
        {!showTrash && !isSelectionMode && (
          <motion.div layout className={`${darkMode ? 'bg-[#0f172a]/90 border-white/5' : 'bg-white border-slate-200 shadow-2xl'} border p-5 sm:p-8 rounded-[2.5rem] sm:rounded-[4rem] mb-10 sm:mb-16 backdrop-blur-3xl`}>
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 mb-4 sm:mb-6">
              <div className="relative z-10">
                <button onClick={() => { setIsTypeOpen(!isTypeOpen); setIsCatOpen(false); setIsRemindOpen(false); }} 
                  className={`w-full lg:w-56 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border font-black text-xs flex items-center justify-between transition-all ${inputBg}`}>
                  {entryType} <ChevronDown size={14} className={`transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isTypeOpen && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className={`absolute top-full left-0 w-full mt-2 z-[600] rounded-[1.5rem] border overflow-hidden p-2 backdrop-blur-2xl ${darkMode ? 'bg-[#1e293b]/95 border-white/10' : 'bg-white border-slate-200 shadow-2xl'}`}>
                      {entryTypes.map(t => (
                        <button key={t} onClick={() => { setEntryType(t); setIsTypeOpen(false); }} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors`}>{t}</button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative z-10">
                <button onClick={() => { setIsCatOpen(!isCatOpen); setIsTypeOpen(false); setIsRemindOpen(false); }} 
                  className={`w-full lg:w-44 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border font-black text-xs flex items-center justify-between transition-all ${inputBg}`}>
                  {category} <ChevronDown size={14} className={`transition-transform ${isCatOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isCatOpen && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className={`absolute top-full left-0 w-full mt-2 z-[600] rounded-[1.5rem] border overflow-hidden p-2 backdrop-blur-2xl ${darkMode ? 'bg-[#1e293b]/95 border-white/10' : 'bg-white border-slate-200 shadow-2xl'}`}>
                      {categories.map(c => (
                        <button key={c} onClick={() => { setCategory(c); setIsCatOpen(false); }} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors`}>{c}</button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                <input placeholder="Hizmet Adı" value={siteName} onChange={e => setSiteName(e.target.value)} className={`p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2.5rem] border outline-none font-bold text-sm transition-all focus:border-blue-500 ${inputBg} ${textColor}`}/>
                <input placeholder="Kullanıcı / Hesap" value={field1} onChange={e => setField1(e.target.value)} className={`p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2.5rem] border outline-none font-bold text-sm transition-all focus:border-blue-500 ${inputBg} ${textColor}`}/>
                <div className="relative">
                  <input type="password" placeholder="Şifre" value={sitePass} onChange={e => setSitePass(e.target.value)} className={`w-full p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2.5rem] border outline-none font-bold text-sm transition-all focus:border-blue-500 ${inputBg} ${textColor}`}/>
                  <button onClick={() => {setIsGenOpen(true); generateSecurePassword();}} className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2 rounded-xl shadow-lg hover:scale-110 transition-transform"><Wand2 size={14}/></button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40">Hatırlatıcı:</span>
                <div className="relative">
                  <button onClick={() => setIsRemindOpen(!isRemindOpen)} className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl border font-black text-[9px] sm:text-[10px] uppercase flex items-center gap-2 sm:gap-3 transition-all ${inputBg}`}>
                    <Clock size={12}/> {reminderDays} <ChevronDown size={10} />
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
              <button onClick={handleSave} disabled={isAdding} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 px-8 sm:px-12 py-4 sm:py-5 rounded-[1.5rem] sm:rounded-[2.5rem] font-black text-xs text-white shadow-2xl flex items-center justify-center gap-3 sm:gap-4 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest">
                {isAdding ? <Loader2 size={20} className="animate-spin" /> : <><Plus size={20}/> Şifreyi Kilitle</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* ============================================================
            ŞİFRE KARTLARI - MODERN TASARIM
        ============================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          <AnimatePresence mode='popLayout'>
            {filteredData.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const strength = getPassStrength(item.password);
              const isPwned = pwnedResults[item.id] > 0;
              const isVisible = visiblePassId === item.id;
              const decryptedPass = decryptData(item.password, VAULT_KEY);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92, y: 10 }}
                  animate={{ opacity: 1, scale: isSelected ? 0.97 : 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: -10 }}
                  onClick={() => isSelectionMode && (isSelected ? setSelectedIds(s => s.filter(i => i !== item.id)) : setSelectedIds(s => [...s, item.id]))}
                  className={`rounded-[2rem] sm:rounded-[2.5rem] border transition-all cursor-pointer relative overflow-hidden group
                    ${isSelected
                      ? 'border-blue-600 bg-blue-600/10'
                      : isPwned && !showTrash
                        ? darkMode ? 'bg-[#1a0a0a] border-red-500/30 hover:border-red-500/60' : 'bg-red-50 border-red-200 hover:border-red-300'
                        : darkMode ? 'bg-[#0d1526] border-white/5 hover:border-white/10 hover:bg-[#111d30]' : 'bg-white border-slate-200 shadow-md hover:shadow-xl'
                    }`}
                >
                  {/* Üst renkli şerit */}
                  <div className={`h-1.5 w-full ${isSelected ? 'bg-blue-600' : isPwned && !showTrash ? 'bg-red-500' : strength.color} opacity-80`} />

                  <div className="p-5 sm:p-7">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-[1rem] flex items-center justify-center flex-shrink-0 transition-all
                          ${isSelected ? 'bg-blue-600 text-white' : isPwned && !showTrash ? 'bg-red-500/15 text-red-400' : darkMode ? 'bg-white/8 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                          {isSelectionMode
                            ? (isSelected ? <CheckSquare size={20}/> : <Square size={20}/>)
                            : (item.type.includes('Banka') ? <CreditCard size={20}/> : <Mail size={20}/>)
                          }
                        </div>
                        <div>
                          <h3 className={`font-black text-base sm:text-lg tracking-tight leading-none mb-1 ${isSelected ? 'text-blue-400' : textColor}`}>{item.site}</h3>
                          <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-lg
                            ${darkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{item.category}</span>
                        </div>
                      </div>

                      {/* Sağ üst: güç göstergesi + silme */}
                      <div className="flex items-center gap-2">
                        {!isSelectionMode && !showTrash && (
                          <div className="flex items-center gap-1.5">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className={`w-1 rounded-full transition-all ${i <= strength.score ? strength.color : darkMode ? 'bg-white/10' : 'bg-slate-200'}`}
                                style={{ height: `${6 + i * 2}px` }} />
                            ))}
                          </div>
                        )}
                        {!isSelectionMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmModal({show: true, type: 'singleDelete', targetId: item.id}); }}
                            className={`p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10
                              ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {showTrash ? <RotateCcw size={16}/> : <Trash2 size={16}/>}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sızıntı uyarısı */}
                    {isPwned && !showTrash && !isSelectionMode && (
                      <div className="mb-4 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                        <ShieldAlert size={14} className="text-red-400 flex-shrink-0"/>
                        <p className="text-[9px] font-black text-red-400 uppercase tracking-wide">{pwnedResults[item.id].toLocaleString()} kez sızdırıldı!</p>
                      </div>
                    )}

                    {/* Hesap alanı */}
                    <div className={`px-4 py-3 rounded-[1.2rem] mb-3 relative group/field transition-all
                      ${isSelected ? 'bg-blue-600/10' : darkMode ? 'bg-black/25' : 'bg-slate-50'}`}>
                      <p className={`text-[8px] font-black uppercase tracking-[0.15em] mb-1 ${darkMode ? 'opacity-30' : 'opacity-40'}`}>Hesap</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`font-semibold text-sm truncate ${subText}`}>{item.field1 || '—'}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.field1); notify("Hesap kopyalandı!"); }}
                          className={`opacity-0 group-hover/field:opacity-100 transition-all p-1.5 rounded-lg hover:bg-blue-600 hover:text-white flex-shrink-0
                            ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Copy size={13}/>
                        </button>
                      </div>
                    </div>

                    {/* Şifre alanı - inline görünüm */}
                    {!showTrash && !isSelectionMode && (
                      <div className={`px-4 py-3 rounded-[1.2rem] relative group/pass transition-all
                        ${darkMode ? 'bg-black/25' : 'bg-slate-50'}`}>
                        <p className={`text-[8px] font-black uppercase tracking-[0.15em] mb-1 ${darkMode ? 'opacity-30' : 'opacity-40'}`}>Şifre</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-mono text-sm tracking-widest ${isVisible ? (darkMode ? 'text-emerald-400' : 'text-blue-700') : subText}`}>
                            {isVisible ? decryptedPass : '••••••••••'}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover/pass:opacity-100 transition-all">
                            <button
                              onClick={(e) => { e.stopPropagation(); setVisiblePassId(isVisible ? null : item.id); }}
                              className={`p-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex-shrink-0
                                ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {isVisible ? <EyeOff size={13}/> : <Eye size={13}/>}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(decryptedPass); notify("Şifre kopyalandı!"); }}
                              className={`p-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex-shrink-0
                                ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              <Copy size={13}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Güç etiketi */}
                    {!showTrash && !isSelectionMode && (
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`text-[8px] font-black uppercase tracking-widest ${strength.textColor}`}>{strength.label}</span>
                        {item.reminder && item.reminder !== 'Yok' && (
                          <span className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <Clock size={10}/> {item.reminder}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ============================================================
          YENİ: GÜVENLİK RAPORU MODALI
      ============================================================ */}
      <AnimatePresence>
        {showAuditModal && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAuditModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className={`relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-[2.5rem] sm:rounded-[4rem] border shadow-4xl ${darkMode ? 'bg-[#0d1117] border-white/10' : 'bg-white border-slate-200'}`}
            >
              {/* Modal Header */}
              <div className={`p-6 sm:p-10 pb-0 flex-shrink-0`}>
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 sm:w-16 h-12 sm:h-16 bg-emerald-500/10 text-emerald-500 rounded-[1.2rem] sm:rounded-[2rem] flex items-center justify-center">
                      <BarChart3 size={24}/>
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-3xl font-black italic tracking-tighter uppercase">Güvenlik Raporu</h2>
                      <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'opacity-40' : 'opacity-50'}`}>Detaylı Şifre Sağlık Analizi</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button onClick={runAudit} disabled={auditLoading} className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all hover:scale-105 ${inputBg} disabled:opacity-40`}>
                      <RefreshCw size={16} className={auditLoading ? 'animate-spin' : ''}/>
                    </button>
                    <button onClick={() => setShowAuditModal(false)} className="p-2.5 sm:p-3.5 text-slate-500 hover:text-red-500 transition-all rounded-xl sm:rounded-2xl hover:bg-red-500/10"><X size={20}/></button>
                  </div>
                </div>

                {/* Özet kartları */}
                {!auditLoading && auditResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    {[
                      { label: 'Güçlü', count: auditResults.filter(r => r.strength.score > 4).length, color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: <ShieldCheck size={16}/> },
                      { label: 'Zayıf', count: auditResults.filter(r => r.strength.score <= 2).length, color: 'text-red-500', bg: 'bg-red-500/10', icon: <ShieldAlert size={16}/> },
                      { label: 'Sızdırılmış', count: auditResults.filter(r => r.pwnCount > 0).length, color: 'text-orange-500', bg: 'bg-orange-500/10', icon: <AlertTriangle size={16}/> },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} rounded-[1.2rem] sm:rounded-[2rem] p-3 sm:p-5 text-center`}>
                        <div className={`${s.color} flex justify-center mb-1.5`}>{s.icon}</div>
                        <p className={`font-black text-xl sm:text-3xl ${s.color}`}>{s.count}</p>
                        <p className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${s.color} opacity-70`}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kaydırılabilir liste */}
              <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-6 sm:pb-10 space-y-3">
                {auditLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Loader2 size={36} className="animate-spin text-blue-500"/>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Sızıntı kontrolü yapılıyor...</p>
                  </div>
                ) : auditResults.map(item => (
                  <div key={item.id} className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-[1.2rem] sm:rounded-[2rem] border transition-all
                    ${item.pwnCount > 0
                      ? darkMode ? 'bg-red-950/30 border-red-500/20' : 'bg-red-50 border-red-200'
                      : item.strength.score <= 2
                        ? darkMode ? 'bg-amber-950/20 border-amber-500/15' : 'bg-amber-50 border-amber-200'
                        : darkMode ? 'bg-white/3 border-white/5' : 'bg-slate-50 border-slate-200'
                    }`}>
                    <div className={`w-9 sm:w-11 h-9 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0
                      ${item.pwnCount > 0 ? 'bg-red-500/15 text-red-400' : item.strength.score <= 2 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                      {item.pwnCount > 0 ? <XCircle size={18}/> : item.strength.score <= 2 ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-black text-sm truncate">{item.site}</p>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-lg ${item.strength.textColor} ${darkMode ? 'bg-white/5' : 'bg-slate-100'}`}>{item.strength.label}</span>
                      </div>
                      <p className={`text-[9px] font-bold truncate ${darkMode ? 'opacity-40' : 'opacity-50'}`}>{item.field1}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      {item.pwnCount > 0 && (
                        <div className="text-right">
                          <p className="text-[9px] font-black text-red-400 uppercase">{item.pwnCount.toLocaleString()}x</p>
                          <p className="text-[8px] text-red-400/60 font-bold uppercase">sızdırıldı</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className={`w-0.5 sm:w-1 rounded-full ${i <= item.strength.score ? item.strength.color : darkMode ? 'bg-white/10' : 'bg-slate-200'}`}
                            style={{ height: `${5 + i * 2}px` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SEÇİM ÇUBUĞU --- */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 z-[450] w-full max-w-2xl px-4 sm:px-6">
            <div className={`p-4 sm:p-6 rounded-[2rem] sm:rounded-[3rem] border shadow-4xl flex items-center justify-between backdrop-blur-2xl ${darkMode ? 'bg-[#1e293b]/90 border-blue-500/30' : 'bg-white border-blue-200'}`}>
              <div className="flex items-center gap-4 pl-2 sm:pl-4">
                <div className="bg-blue-600 text-white w-10 sm:w-12 h-10 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-black shadow-lg">{selectedIds.length}</div>
                <div>
                  <p className="font-black text-xs uppercase tracking-widest text-blue-500">Öğe Seçildi</p>
                  <p className="text-[9px] font-bold opacity-40 uppercase hidden sm:block">Toplu işlem modundasınız</p>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-4">
                <button onClick={() => { if(selectedIds.length > 0) setConfirmModal({show:true, type: 'bulkDelete'}); }} 
                  className={`px-5 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all ${selectedIds.length > 0 ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 active:scale-95' : 'opacity-30 cursor-not-allowed bg-slate-500/20'}`}>
                  Sil
                </button>
                <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className={`px-5 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest border ${inputBg} hover:bg-slate-500/10 transition-all active:scale-95`}>İptal</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ONAY MODALI --- */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmModal({show:false, type:null})} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.8, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className={`relative w-full max-w-md p-10 sm:p-14 rounded-[3rem] sm:rounded-[5rem] text-center shadow-4xl ${darkMode ? 'bg-[#111827] border border-white/10' : 'bg-white'}`}>
              <div className={`w-16 sm:w-24 h-16 sm:h-24 rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 sm:mb-10 shadow-2xl ${confirmModal.type?.includes('Delete') || confirmModal.type === 'clear' ? 'bg-red-500/10 text-red-500 shadow-red-500/10' : 'bg-blue-500/10 text-blue-500 shadow-blue-500/10'}`}>
                <ShieldAlert size={36}/>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mb-3 sm:mb-4 tracking-tighter italic uppercase">Onay Gerekli</h2>
              <p className="opacity-50 mb-8 sm:mb-12 font-bold text-sm tracking-tight leading-relaxed">Bu işlemi gerçekleştirmek istediğinizden emin misiniz?</p>
              <div className="flex gap-3 sm:gap-4">
                <button onClick={() => setConfirmModal({show:false, type:null})} className={`flex-1 py-4 sm:py-6 rounded-[2rem] sm:rounded-[2.5rem] font-black text-xs tracking-widest ${inputBg} opacity-60 hover:opacity-100 uppercase transition-all active:scale-95`}>Vazgeç</button>
                <button onClick={executeConfirmAction} className={`flex-1 py-4 sm:py-6 rounded-[2rem] sm:rounded-[2.5rem] font-black text-xs text-white tracking-widest uppercase shadow-2xl transition-all active:scale-95 ${confirmModal.type?.includes('Delete') || confirmModal.type === 'clear' ? 'bg-red-600 shadow-red-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>Evet, Onayla</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PROFİL MODALI --- */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProfileOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className={`relative w-full max-w-xl border rounded-[3rem] sm:rounded-[5rem] p-8 sm:p-16 shadow-4xl overflow-y-auto max-h-[95vh] ${darkMode ? 'bg-[#111827] border-white/10' : 'bg-white border-slate-200'}`}>
              <button onClick={() => setIsProfileOpen(false)} className="absolute top-6 sm:top-10 right-6 sm:right-10 p-3 text-slate-500 hover:text-red-500 rounded-full transition-all"><X size={24}/></button>
              <div className="flex items-center gap-4 sm:gap-5 mb-8 sm:mb-10">
                <div className="w-12 sm:w-16 h-12 sm:h-16 bg-blue-600/10 text-blue-500 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center font-bold shadow-inner flex-shrink-0"><User size={28} /></div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter uppercase">Hesap & Güvenlik</h2>
                  <p className="text-[9px] sm:text-[10px] font-bold opacity-40 uppercase tracking-widest">{auth.currentUser?.email}</p>
                </div>
              </div>
              <div className={`p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border mb-6 sm:mb-8 ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[9px] sm:text-[10px] font-black uppercase text-blue-500 tracking-widest mb-3 flex items-center gap-2"><Key size={12} /> Yetki Doğrulaması (Zorunlu)</p>
                <input type="password" placeholder="Mevcut Master Şifreniz" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={`w-full p-4 rounded-[1.5rem] sm:rounded-[1.8rem] border outline-none font-bold text-xs transition-all focus:border-blue-500 ${inputBg} ${textColor}`} />
              </div>
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <input type="email" placeholder="Yeni E-posta" value={newEmail} onChange={e => setNewEmail(e.target.value)} className={`flex-1 p-4 rounded-[1.5rem] sm:rounded-[1.8rem] border outline-none font-bold text-xs transition-all focus:border-blue-500 ${inputBg} ${textColor}`} />
                  <button onClick={handleUpdateEmail} disabled={profileLoading || !newEmail || !currentPassword} className="px-6 py-4 bg-blue-600 text-white rounded-[1.5rem] sm:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 disabled:opacity-40 transition-all active:scale-95">Mail Değiştir</button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <input type="password" placeholder="Yeni Master Şifre" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`flex-1 p-4 rounded-[1.5rem] sm:rounded-[1.8rem] border outline-none font-bold text-xs transition-all focus:border-blue-500 ${inputBg} ${textColor}`} />
                  <button onClick={handleUpdatePassword} disabled={profileLoading || !newPassword || !currentPassword} className="px-6 py-4 bg-blue-600 text-white rounded-[1.5rem] sm:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 disabled:opacity-40 transition-all active:scale-95">Şifre Değiştir</button>
                </div>
                <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                  <button onClick={handleToggle2FA} className={`flex-1 w-full py-4 px-6 rounded-[1.5rem] sm:rounded-[1.8rem] border font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 ${is2FAEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : `${inputBg} opacity-60 hover:opacity-100`}`}>
                    <ShieldCheck size={14} /> {is2FAEnabled ? "2FA: Aktif" : "2FA Aç"}
                  </button>
                  <button onClick={handleExportVault} className="flex-1 w-full py-4 px-6 bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-600 hover:text-white rounded-[1.5rem] sm:rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95">
                    <Download size={14} /> Yedekle
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================
          VIEW PASSWORD MODAL - KÜÇÜLTÜLDÜ
      ============================================================ */}
      <AnimatePresence>
        {selectedPass && (
          <div className="fixed inset-0 z-[900] flex items-center justify-center p-4 sm:p-6 text-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPass(null)} className="absolute inset-0 bg-black/95 backdrop-blur-3xl" />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={`relative w-full max-w-md border rounded-[3rem] sm:rounded-[4rem] p-8 sm:p-12 ${darkMode ? 'bg-[#0f172a] border-white/10' : 'bg-white border-slate-200 shadow-4xl'}`}
            >
              <button onClick={() => setSelectedPass(null)} className="absolute top-6 sm:top-8 right-6 sm:right-8 text-slate-500 hover:text-red-500 transition-all p-2.5 rounded-full"><X size={24}/></button>
              
              <div className="w-12 h-12 bg-blue-600/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                <Lock size={20} className="text-blue-500"/>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mb-1 tracking-tighter italic text-blue-500 uppercase">{selectedPass.site}</h2>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-6 ${darkMode ? 'opacity-30' : 'opacity-40'}`}>Şifre Görüntüleniyor</p>
              
              <div className={`p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] mb-6 font-mono text-lg sm:text-2xl break-all tracking-[0.25em] sm:tracking-[0.4em] shadow-inner ${darkMode ? 'bg-black/60 text-emerald-400' : 'bg-slate-100 text-blue-700'}`}>
                {selectedPass.val}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(selectedPass.val); notify("Şifre kopyalandı!"); }}
                className="w-full bg-blue-600 py-5 sm:py-6 rounded-[1.5rem] sm:rounded-[2.5rem] font-black text-xs text-white shadow-2xl active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                <Copy size={20}/> Panoya Kopyala
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- PASSWORD GENERATOR --- */}
      <AnimatePresence>
        {isGenOpen && (
          <div className="fixed inset-0 z-[900] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGenOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className={`relative w-full max-w-sm border rounded-[3rem] sm:rounded-[5rem] p-10 sm:p-16 text-center shadow-4xl ${darkMode ? 'bg-[#111827] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="w-16 sm:w-20 h-16 sm:h-20 bg-blue-600/10 rounded-[2rem] sm:rounded-[3rem] flex items-center justify-center mx-auto mb-6 sm:mb-8"><Wand2 className="text-blue-500" size={36} /></div>
              <h2 className={`text-2xl sm:text-3xl font-black mb-6 sm:mb-8 italic tracking-tighter uppercase ${textColor}`}>Şifre Üretici</h2>
              <div className={`p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] mb-6 sm:mb-8 font-mono text-xl sm:text-2xl break-all shadow-inner ${darkMode ? 'bg-black/60 text-blue-400' : 'bg-slate-100'}`}>{genPass}</div>
              <div className="flex flex-col gap-3 sm:gap-4">
                <button onClick={generateSecurePassword} className="w-full py-4 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] bg-blue-600/10 text-blue-500 font-black text-[10px] tracking-widest uppercase hover:bg-blue-600/20 transition-all active:scale-95">Yenile</button>
                <button onClick={() => { setSitePass(genPass); setIsGenOpen(false); notify("Şifre uygulandı!"); }} className="w-full bg-blue-600 py-4 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] font-black text-[10px] text-white shadow-2xl active:scale-95 uppercase tracking-widest">Kasaya Aktar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CANLI BİLDİRİM TOAST SİSTEMİ (SAĞ ÜST) --- */}
      <div className="fixed top-4 sm:top-10 right-4 sm:right-10 z-[2000] flex flex-col gap-3 pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-xs">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className={`pointer-events-auto p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border shadow-4xl flex items-center gap-3 sm:gap-4 backdrop-blur-2xl ${
                darkMode 
                  ? 'bg-[#1e293b]/90 border-blue-500/30 text-white shadow-blue-500/10' 
                  : 'bg-white border-blue-200 text-slate-900 shadow-xl'
              }`}
            >
              <div className="w-10 sm:w-12 h-10 sm:h-12 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 flex-shrink-0">
                <Bell size={18} className="text-white animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 mb-0.5">Sistem</p>
                <p className="font-bold text-xs leading-tight tracking-tight truncate">{n.msg}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="p-1.5 hover:bg-slate-500/10 rounded-full transition-colors flex-shrink-0"
              >
                <X size={14} className="opacity-40" />
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
              className={`fixed right-0 top-0 h-full w-full sm:w-[400px] md:w-[450px] z-[200] shadow-4xl p-8 sm:p-12 border-l backdrop-blur-3xl ${darkMode ? 'bg-[#0f172a]/95 border-white/10' : 'bg-white/95 border-slate-200'}`}>
              <div className="flex justify-between items-center mb-10 sm:mb-16">
                <h2 className="text-2xl sm:text-4xl font-black italic tracking-tighter uppercase">Bildirimler</h2>
                <button onClick={() => setShowNotifHistory(false)} className="p-3 sm:p-4 hover:bg-red-500/10 text-red-500 rounded-full transition-all"><X size={24}/></button>
              </div>
              <div className="space-y-4 sm:space-y-6 overflow-y-auto max-h-[calc(100vh-160px)] pr-2 sm:pr-4">
                {notifHistory.length === 0 ? (
                  <p className="text-center opacity-30 py-16 font-bold italic">Kayıt yok.</p>
                ) : (
                  notifHistory.map(h => (
                    <div key={h.id} className={`p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border relative overflow-hidden transition-all hover:scale-[1.02] ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="absolute left-0 top-0 w-1 sm:w-1.5 h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
                      <p className={`font-black text-xs sm:text-sm tracking-tight mb-2 sm:mb-3 ${textColor}`}>{h.msg}</p>
                      <span className="text-[9px] opacity-30 font-black tracking-widest">{h.time}</span>
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
