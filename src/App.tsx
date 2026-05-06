/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  PieChart, 
  Settings, 
  ArrowUpRight, 
  ArrowDownLeft,
  Bell,
  X,
  LogOut,
  Shield,
  Users,
  TrendingUp,
  Info,
  User as UserIcon,
  CreditCard,
  ArrowRightLeft,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CATEGORIES, 
  NECESSITY_LABELS,
  WALLET_LABELS
} from './constants';
import { 
  Transaction, 
  TransactionCategory, 
  NecessityType, 
  Subscription,
  WalletType,
  TransactionType,
  Snapshot,
  AppNotification
} from './types';
import { 
  Cell, 
  Pie, 
  PieChart as RechartsPieChart, 
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { api } from './services/api';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'analysis' | 'funds' | 'settings'>('home');
  const [showAddModal, setShowAddModal] = useState(false);
  const [appCurrency, setAppCurrency] = useState('ر.س');
  
  // Auth states
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [userBudget, setUserBudget] = useState(0);
  const [initialBalances, setInitialBalances] = useState({ cash: 0, bank: 0 });
  const [extraFunds, setExtraFunds] = useState({ emergency: 0, savings: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<{ show: boolean, sub?: Subscription }>({ show: false });
  const [showFundModal, setShowFundModal] = useState(false);
  const [showMasterBalanceModal, setShowMasterBalanceModal] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<Snapshot | null>(null);
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser && !parsedUser.hasSeenTutorial) {
        setShowTutorial(true);
      }
    }
    setLoading(false);
  }, []);

  const refreshData = async () => {
    if (!user) return;
    try {
      const [uProfile, txs, subs, snaps, notices] = await Promise.all([
        api.getUser(user.id),
        api.getTransactions(user.id),
        api.getSubscriptions(user.id),
        api.getSnapshots(user.id),
        api.getNotifications(user.id)
      ]);

      if (uProfile) {
        setUserBudget(uProfile.budgetThreshold || 0);
        setAppCurrency(uProfile.currency || 'ر.س');
        setInitialBalances({
          cash: uProfile.initialCash || 0,
          bank: uProfile.initialBank || 0
        });
        setExtraFunds({
          emergency: uProfile.emergencyFund || 0,
          savings: uProfile.savingsFund || 0
        });
      }

      setTransactions(txs);
      setSubscriptions(subs);
      setSnapshots(snaps);
      setNotifications(notices);
    } catch (err) {
      console.error("Error fetching data from SQL:", err);
    }
  };

  useEffect(() => {
    if (user) {
      refreshData();
    } else {
      setTransactions([]);
      setSubscriptions([]);
      setSnapshots([]);
    }
  }, [user, activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  // Derived Values
  const walletBalances = transactions.reduce((acc: Record<string, number>, t) => {
    if (t.type === 'income') {
      acc[t.wallet] += t.amount;
    } else if (t.type === 'expense') {
      acc[t.wallet] -= t.amount;
    } else if (t.type === 'transfer' && t.toWallet) {
      acc[t.wallet] -= t.amount;
      acc[t.toWallet] += t.amount;
    }
    return acc;
  }, { 
    cash: initialBalances.cash, 
    bank: initialBalances.bank,
    emergency: extraFunds.emergency,
    savings: extraFunds.savings
  });

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);
  
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);
    
  const necessityTotal = transactions.filter(t => t.type === 'expense' && (!t.necessity || t.necessity === 'necessity')).reduce((a, b) => a + b.amount, 0);
  const luxuryTotal = transactions.filter(t => t.type === 'expense' && t.necessity === 'luxury').reduce((a, b) => a + b.amount, 0);
  const necessityPct = totalExpenses > 0 ? Math.round((necessityTotal / totalExpenses) * 100) : 0;
  const luxuryPct = totalExpenses > 0 ? Math.round((luxuryTotal / totalExpenses) * 100) : 0;

  const currentTotal = walletBalances.cash + walletBalances.bank;

  const [isResetConfirming, setIsResetConfirming] = useState(false);

  const handleUpdateBalance = async (type: WalletType, amount: number) => {
    if (!user) return;
    try {
      await api.saveUser(user.id, {
        [type === 'cash' ? 'initialCash' : 'initialBank']: amount
      });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCurrency = async (newCurrency: string) => {
    if (!user || newCurrency === appCurrency) return;
    try {
      setLoading(true);
      // 1. Get current rates
      const rates = await api.getExchangeRates();
      
      const getCode = (c: string) => c === 'ر.س' ? 'SAR' : (c === 'ج.م' ? 'EGP' : c);
      const oldCode = getCode(appCurrency);
      const newCode = getCode(newCurrency);

      if (rates[oldCode] && rates[newCode]) {
        // Ratio logic: (Value in Base / RateOld) * RateNew
        // If 1 USD = 3.75 SAR and 1 USD = 0.31 KWD
        // To go from SAR to KWD: Amount / 3.75 * 0.31
        const ratio = (1 / rates[oldCode]) * rates[newCode];
        
        // 2. Update all amounts in DB
        await api.convertCurrency(user.id, ratio);
      }

      // 3. Update user profile with new currency label
      await api.saveUser(user.id, { currency: newCurrency });
      setAppCurrency(newCurrency);
      await refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (!user || transactions.length === 0) return;
    
    try {
      // 1. Create Snapshot
      await api.addSnapshot({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        totalAmount: currentTotal,
        cashAmount: walletBalances.cash,
        bankAmount: walletBalances.bank,
        transactionCount: transactions.length,
        userId: user.id,
        transactions: transactions
      });

      // 2. Delete Transactions
      await api.clearTransactions(user.id);

      // 3. Reset User balances
      await api.saveUser(user.id, {
        initialCash: 0,
        initialBank: 0
      });

      refreshData();
      setIsResetConfirming(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTransaction = async (t: Omit<Transaction, 'id'>) => {
    if (!user) return;
    try {
      const id = crypto.randomUUID();
      await api.addTransaction({
        ...t,
        id,
        userId: user.id
      });
      setLastTransactionId(id);
      refreshData();
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUndo = async () => {
    if (!user || !lastTransactionId) return;
    try {
      await api.deleteTransaction(lastTransactionId);
      setLastTransactionId(null);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      let result;
      if (authMode === 'signup') {
        result = await api.signup({ displayName: authName, email: authEmail, password: authPassword });
      } else {
        result = await api.login({ email: authEmail, password: authPassword });
      }
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      setUser(result.user);
      if (result.user && !result.user.hasSeenTutorial) {
        setShowTutorial(true);
      }
    } catch (err: any) {
      setAuthError(err.message || 'حدث خطأ ما');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }} 
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-4xl font-black text-white"
        >
          مصاريفي
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black text-white">مصاريفي</h1>
            <p className="text-zinc-500 font-medium">خطوتك الأولى نحو الاستقرار المالي</p>
          </div>

          <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5 space-y-6 shadow-2xl">
            <div className="flex bg-zinc-950 p-1 rounded-2xl border border-white/5">
              <button 
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${authMode === 'login' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                دخول
              </button>
              <button 
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${authMode === 'signup' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                حساب جديد
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {authMode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">الاسم الكريم</label>
                  <input 
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="دخل اسمك هنا"
                    className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-white/20 transition-all font-bold placeholder:text-zinc-700"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">البريد الإلكتروني</label>
                <input 
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-white/20 transition-all font-bold placeholder:text-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">كلمة المرور</label>
                <input 
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-white/20 transition-all font-bold placeholder:text-zinc-700"
                />
              </div>

              {authError && (
                <p className="text-[10px] font-bold text-rose-500 px-1 text-center">{authError}</p>
              )}

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-5 bg-white text-zinc-950 font-black rounded-2xl active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {authLoading ? 'جاري التحميل...' : (authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب')}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <div className="relative flex justify-center text-[10px] font-black uppercase"><span className="bg-zinc-900 px-4 text-zinc-500">مرحباً بك</span></div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 font-sans bg-zinc-950 text-zinc-100" dir="rtl">
      {/* Tutorial Overlay */}
      <AnimatePresence>
        {showTutorial && (
          <Tutorial 
            onComplete={async () => {
              if (user) {
                try {
                  await api.saveUser(user.id, { hasSeenTutorial: true });
                  
                  // Send welcome notification
                  await api.addNotification({
                    id: crypto.randomUUID(),
                    title: "أهلاً بك في مصاريفي! 🌟",
                    message: "يسعدنا انضمامك إلينا. الآن يمكنك البدء بتنظيم ميزانيتك ومتابعة مصروفاتك بكل سهولة.",
                    date: new Date().toISOString(),
                    userId: user.id
                  });

                  const updatedUser = { ...user, hasSeenTutorial: true };
                  setUser(updatedUser);
                  localStorage.setItem('user', JSON.stringify(updatedUser));
                  refreshData();
                } catch (e) {
                  console.error(e);
                }
              }
              setShowTutorial(false);
            }} 
          />
        )}
        {showNotificationsModal && (
          <NotificationsModal 
            notifications={notifications}
            onClose={() => setShowNotificationsModal(false)}
            onMarkRead={async () => {
              if (user) {
                await api.markAllNotificationsRead(user.id);
                refreshData();
              }
            }}
            onDelete={async (id) => {
              await api.deleteNotification(id);
              refreshData();
            }}
          />
        )}
        {showAdminPanel && (
          <AdminPanel 
            onClose={() => setShowAdminPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-zinc-950/50 backdrop-blur-lg border-b border-white/5 safe-top sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-black text-white tracking-widest uppercase text-right">مصاريفي</h1>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">أهلاً بك، {user.displayName?.split(' ')[0]}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowNotificationsModal(true)}
            className="p-2.5 bg-zinc-900 rounded-2xl text-zinc-400 relative border border-white/5 shadow-inner"
          >
            <Bell size={18} />
            {notifications.filter(n => !n.isRead).length > 0 && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            )}
          </button>
          <button onClick={handleLogout} className="p-2.5 bg-zinc-900 rounded-2xl text-zinc-400 border border-white/5">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-lg mx-auto">
        {activeTab === 'home' && (
          <>
            {/* Balance Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-white/10 text-white p-8 rounded-[2.5rem] shadow-2xl space-y-6 relative overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-zinc-800 rounded-full blur-3xl opacity-50"></div>
              <div className="space-y-1 relative z-10 text-center sm:text-right">
                <span className="text-xs font-medium opacity-50 uppercase tracking-widest">إجمالي الميزانية</span>
                <div className="text-5xl font-black tabular-nums">
                  {currentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xl font-medium text-zinc-500">{appCurrency}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-zinc-950/40 p-5 rounded-3xl border border-white/5 space-y-1 group hover:border-white/20 transition-all">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">الكاش</span>
                  <p className="text-2xl font-black tabular-nums text-white">{walletBalances.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-zinc-950/40 p-5 rounded-3xl border border-white/5 space-y-1 group hover:border-white/20 transition-all">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">الصرافة</span>
                  <p className="text-2xl font-black tabular-nums text-white">{walletBalances.bank.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="flex gap-6 pt-6 border-t border-white/5 relative z-10">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <div className="p-1 bg-emerald-400/10 rounded-lg"><ArrowDownLeft size={12} /></div>
                    <span className="text-[10px] font-bold uppercase">الدخل</span>
                  </div>
                  <div className="text-xl font-black tabular-nums text-emerald-50">{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="flex-1 space-y-1 border-r border-white/5 pr-6">
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <div className="p-1 bg-rose-400/10 rounded-lg"><ArrowUpRight size={12} /></div>
                    <span className="text-[10px] font-bold uppercase">المصروف</span>
                  </div>
                  <div className="text-xl font-black tabular-nums text-rose-50">{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            </motion.div>

            {/* Threshold Warning */}
            {userBudget > 0 && totalExpenses > userBudget && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-rose-950/20 border border-rose-500/10 p-5 rounded-3xl flex items-center gap-4"
              >
                <div className="bg-rose-500 text-white p-3 rounded-2xl shadow-lg shadow-rose-900/50">
                  <Bell size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-rose-100">تحذير الميزانية!</p>
                  <p className="text-xs text-rose-400 leading-relaxed">لقد تجاوزت سقف الصرف المحدد ({userBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).</p>
                </div>
              </motion.div>
            )}

            {/* Subscriptions Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h2 className="font-bold text-zinc-100">الاشتراكات الشهرية</h2>
                <button 
                  onClick={() => setShowSubscriptionModal({ show: true })}
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-300"
                >
                  إدارة
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1 -mx-1">
                {subscriptions.length > 0 ? subscriptions.map((s) => (
                  <div 
                    key={s.id} 
                    onClick={() => setShowSubscriptionModal({ show: true, sub: s })}
                    className="min-w-[150px] flex-shrink-0 bg-zinc-900 p-5 rounded-3xl border border-white/5 space-y-4 active:scale-95 transition-transform cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center font-black text-zinc-400 text-xl overflow-hidden border border-white/5">
                      {s.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-100 truncate">{s.name}</p>
                      <p className="text-[10px] text-zinc-500">قادم: {new Date(s.nextBillingDate).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <p className="text-sm font-black text-white">{s.amount.toFixed(2)} {appCurrency}</p>
                  </div>
                )) : (
                   <div className="w-full bg-zinc-900 p-6 rounded-3xl border border-white/5 text-center space-y-2">
                      <CreditCard className="mx-auto text-zinc-800" size={32} />
                      <p className="text-xs text-zinc-500 font-bold">لا توجد اشتراكات نشطة</p>
                   </div>
                )}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="space-y-4 pb-12">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-zinc-100">آخر العمليات</h2>
                  {lastTransactionId && (
                    <button 
                      onClick={handleUndo}
                      className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20 active:scale-95 transition-all"
                    >
                      تراجع (إلغاء العملية)
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => setShowAllTransactions(true)}
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-300"
                >
                  الكل
                </button>
              </div>
              <div className="space-y-3">
                {transactions.length > 0 ? transactions.slice(0, 5).map((t) => {
                  const category = CATEGORIES[t.category];
                  const isExpense = t.type === 'expense';
                  const isTransfer = t.type === 'transfer';
                  
                  return (
                    <motion.div 
                      layout
                      key={t.id} 
                      className="bg-zinc-900 p-4 rounded-[2rem] flex items-center gap-5 border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className={`p-4 rounded-2xl ${category.color} shadow-sm grayscale brightness-75 contrast-125`}>
                        <category.icon size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-zinc-100 truncate">{t.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">{category.label}</span>
                          <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
                          <span className="text-[10px] font-bold text-zinc-600 uppercase">
                            {WALLET_LABELS[t.wallet]}
                            {isTransfer && t.toWallet && ` ← ${WALLET_LABELS[t.toWallet]}`}
                          </span>
                        </div>
                      </div>
                      <div className={`text-lg font-black tabular-nums ${isExpense ? 'text-zinc-100' : isTransfer ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {isExpense ? '-' : isTransfer ? '⇄' : '+'} {t.amount.toFixed(2)}
                      </div>
                    </motion.div>
                  );
                }) : (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-800">
                      <LayoutDashboard size={32} />
                    </div>
                    <p className="text-zinc-500 text-sm">ابدأ بتسجيل أول مصروف لك عبر الضغط على +</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold px-1 text-white">تحليل ميزانيتك</h2>
            
            <div className="aspect-square bg-zinc-900 rounded-[3rem] p-8 shadow-2xl flex flex-col items-center justify-center border border-white/5 relative overflow-hidden">
               <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-white/0 via-white/5 to-white/0"></div>
               <ResponsiveContainer width="100%" height="80%">
                 <RechartsPieChart>
                  <Pie
                    data={transactions.filter(t => t.type === 'expense').reduce((acc, curr) => {
                      const idx = acc.findIndex(i => i.name === CATEGORIES[curr.category].label);
                      if (idx > -1) acc[idx].value += curr.amount;
                      else acc.push({ name: CATEGORIES[curr.category].label, value: curr.amount });
                      return acc;
                    }, [] as { name: string, value: number }[])}
                    cx="50%"
                    cy="50%"
                    innerRadius="65%"
                    outerRadius="90%"
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {transactions.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#ffffff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 7]} cornerRadius={12} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', direction: 'rtl', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="absolute text-center mt-[-10%] pointer-events-none">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">إجمالي المصروف</p>
                <p className="text-3xl font-black text-white">{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {appCurrency}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-5">
               <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 shadow-sm">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mb-4"><ArrowDownLeft size={20} /></div>
                  <p className="text-xs font-bold text-zinc-500 uppercase">الضروريات</p>
                  <p className="text-2xl font-black text-white mt-1">{necessityPct}%</p>
               </div>
               <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 shadow-sm">
                  <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center mb-4"><ArrowUpRight size={20} /></div>
                  <p className="text-xs font-bold text-zinc-500 uppercase">الكماليات</p>
                  <p className="text-2xl font-black text-white mt-1">{luxuryPct}%</p>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'funds' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20 px-1">
            <h2 className="text-2xl font-bold text-white">صناديق الادخار والطوارئ</h2>
            
            <div className="grid gap-6">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowFundModal(true)}
                className="bg-zinc-900 p-8 rounded-[3rem] border border-amber-500/20 relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute top-0 right-0 p-8 text-amber-500/10 group-hover:text-amber-500/20 transition-colors">
                  <Shield size={120} />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">صندوق الطوارئ</h3>
                    <p className="text-xs text-zinc-500">مخصص للحالات المفاجئة والطارئة</p>
                  </div>
                  <p className="text-4xl font-black text-white tabular-nums">
                    {walletBalances.emergency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-bold text-zinc-500">{appCurrency}</span>
                  </p>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowFundModal(true)}
                className="bg-zinc-900 p-8 rounded-[3rem] border border-indigo-500/20 relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute top-0 right-0 p-8 text-indigo-500/10 group-hover:text-indigo-500/20 transition-colors">
                  <TrendingUp size={120} />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">صندوق الادخار</h3>
                    <p className="text-xs text-zinc-500">مخصص لخططك وأهدافك المستقبلية</p>
                  </div>
                  <p className="text-4xl font-black text-white tabular-nums">
                    {walletBalances.savings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-bold text-zinc-500">{appCurrency}</span>
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
            <h2 className="text-2xl font-bold px-1 text-white">الإعدادات</h2>
            
            {user?.isAdmin && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-[2.5rem] space-y-4">
                <div className="p-4 space-y-2">
                  <h3 className="text-lg font-black text-emerald-500">لوحة الإدارة</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed text-emerald-500/70">لديك صلاحيات المشرف. يمكنك إدارة المستخدمين وإرسال تنبيهات عامة من هنا.</p>
                </div>
                
                <button 
                  onClick={() => setShowAdminPanel(true)}
                  className="w-full bg-emerald-500 text-white py-6 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-emerald-500/20"
                >
                  <Shield size={24} />
                  فتح لوحة الإدارة
                </button>
              </div>
            )}

            <div className="bg-zinc-900 rounded-[2.5rem] p-4 border border-white/5 space-y-4">
              <div className="p-6 space-y-2">
                <h3 className="text-lg font-black text-white">إدارة أرصدتك وعملتك</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">قم بتعديل أرصدة الكاش والبنك، وتحديث مبالغ الصناديق، أو تغيير العملة الافتراضية للتطبيق.</p>
              </div>
              
              <button 
                onClick={() => setShowMasterBalanceModal(true)}
                className="w-full bg-white text-zinc-950 py-6 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl"
              >
                <CreditCard size={24} />
                تعديل الأرصدة والعملة
              </button>
            </div>

            {/* Password Change Section */}
            <div className="bg-zinc-900 rounded-[2.5rem] p-8 border border-white/5 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-zinc-800 rounded-2xl text-zinc-400">
                  <Lock size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">تغيير كلمة المرور</h3>
                  <p className="text-xs text-zinc-500">قم بتحديث كلمة مرور حسابك بانتظام</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">كلمة المرور الحالية</label>
                  <input 
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-white/20 transition-all font-mono"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">كلمة المرور الجديدة</label>
                  <input 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-white/20 transition-all font-mono"
                    placeholder="••••••••"
                  />
                </div>
                <button 
                  onClick={async () => {
                    if (!oldPassword || !newPassword) return;
                    setChangingPassword(true);
                    try {
                      await api.changePassword(user!.id, oldPassword, newPassword);
                      setOldPassword('');
                      setNewPassword('');
                      alert('تم تغيير كلمة المرور بنجاح');
                    } catch (err: any) {
                      alert(err.message || 'فشلت العملية');
                    } finally {
                      setChangingPassword(false);
                    }
                  }}
                  disabled={changingPassword || !oldPassword || !newPassword}
                  className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                  {changingPassword ? 'جاري التغيير...' : 'تحديث كلمة المرور'}
                </button>
              </div>
            </div>

            <div className="bg-rose-500/5 border border-rose-500/10 p-6 rounded-[2rem] space-y-4">
              <div className="flex items-center gap-3 text-rose-500">
                <X size={24} />
                <h3 className="font-bold">تصفير الحساب</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                هذا الزر سيقوم بحذف جميع العمليات المسجلة حالياً وتصفير الأرصدة. سيتم حفظ "سنابشوت" تلقائياً يمكنك الرجوع إليه في أي وقت بالأسفل.
              </p>
              {!isResetConfirming ? (
                <button 
                  onClick={() => setIsResetConfirming(true)}
                  className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black rounded-2xl active:scale-95 transition-all"
                >
                  تصفير البيانات
                </button>
              ) : (
                <div className="flex gap-3">
                  <button 
                    onClick={handleResetData}
                    className="flex-[2] py-4 bg-rose-500 text-white font-black rounded-2xl animate-pulse"
                  >
                    تأكيد الحذف النهائي
                  </button>
                  <button 
                    onClick={() => setIsResetConfirming(false)}
                    className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-bold rounded-2xl"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>

            {/* Snapshots History */}
            <div className="space-y-4">
              <h3 className="font-bold text-zinc-100 flex items-center gap-2">
                سنابشوت تاريخية
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded-full border border-white/10 text-zinc-500">{snapshots.length}</span>
              </h3>
              <div className="space-y-3">
                {snapshots.length > 0 ? snapshots.map((s) => (
                  <div 
                    key={s.id} 
                    onClick={() => setViewingSnapshot(s)}
                    className="bg-zinc-900 p-5 rounded-3xl border border-white/5 space-y-4 cursor-pointer hover:border-white/20 transition-all active:scale-95"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-black text-white">{new Date(s.date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-[10px] text-zinc-500 font-medium">حالة الحساب عند التصفير</p>
                      </div>
                      <div className="bg-zinc-950 px-3 py-1 rounded-full border border-white/5 text-[10px] font-bold text-zinc-400">
                        {s.transactionCount} عملية
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="bg-zinc-950/50 p-3 rounded-2xl border border-white/5">
                        <span className="text-[9px] text-zinc-500 block uppercase">المجموع</span>
                        <p className="text-sm font-black text-white">{s.totalAmount.toLocaleString()}</p>
                      </div>
                      <div className="bg-zinc-950/50 p-3 rounded-2xl border border-white/5">
                        <span className="text-[9px] text-zinc-500 block uppercase">كاش/بنك</span>
                        <p className="text-sm font-black text-white">{s.cashAmount.toLocaleString()} / {s.bankAmount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 opacity-30">
                    <p className="text-xs font-bold">لا يوجد أرشيف سنابشوت بعد</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-2xl border-t border-white/5 px-6 py-4 flex justify-between items-center safe-bottom z-40 lg:max-w-lg lg:mx-auto lg:rounded-t-[3rem]">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'home' ? 'text-white scale-110' : 'text-zinc-500'}`}
        >
          <LayoutDashboard size={26} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span className="text-[9px] font-bold uppercase tracking-tighter">الرئيسية</span>
        </button>
        
        <div className="relative">
          <button 
            onClick={() => setShowAddModal(true)}
            className="absolute -top-16 left-1/2 -translate-x-1/2 bg-white text-zinc-950 p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(255,255,255,0.2)] ring-8 ring-zinc-950 active:scale-90 transition-all font-black"
          >
            <Plus size={32} strokeWidth={3} />
          </button>
        </div>

        <div className="flex gap-8">
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'analysis' ? 'text-white scale-110' : 'text-zinc-500'}`}
          >
            <PieChart size={26} strokeWidth={activeTab === 'analysis' ? 2.5 : 2} />
            <span className="text-[9px] font-bold uppercase tracking-tighter">التحليل</span>
          </button>

          <button 
            onClick={() => setActiveTab('funds')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'funds' ? 'text-white scale-110' : 'text-zinc-500'}`}
          >
            <Shield size={26} strokeWidth={activeTab === 'funds' ? 2.5 : 2} />
            <span className="text-[9px] font-bold uppercase tracking-tighter">الصناديق</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'settings' ? 'text-white scale-110' : 'text-zinc-500'}`}
          >
            <Settings size={26} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[9px] font-bold uppercase tracking-tighter">الإعدادات</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <QuickAddModal 
            user={user}
            onClose={() => setShowAddModal(false)} 
            onAdd={handleAddTransaction} 
            appCurrency={appCurrency}
          />
        )}
        {showSubscriptionModal.show && (
          <SubscriptionManagerModal
            user={user}
            subscription={showSubscriptionModal.sub}
            onClose={() => setShowSubscriptionModal({ show: false })}
            onRefresh={refreshData}
          />
        )}
        {showAllTransactions && (
          <AllTransactionsModal
            transactions={transactions}
            onClose={() => setShowAllTransactions(false)}
            appCurrency={appCurrency}
          />
        )}
        {viewingSnapshot && (
          <SnapshotDetailModal
            snapshot={viewingSnapshot}
            onClose={() => setViewingSnapshot(null)}
            appCurrency={appCurrency}
          />
        )}
        {showFundModal && (
          <FundManagerModal
            user={user}
            extraFunds={extraFunds}
            appCurrency={appCurrency}
            onClose={() => setShowFundModal(false)}
            onRefresh={refreshData}
          />
        )}
        {showMasterBalanceModal && (
          <MasterBalanceModal
            user={user}
            appCurrency={appCurrency}
            initialBalances={initialBalances}
            extraFunds={extraFunds}
            onUpdateCurrency={handleUpdateCurrency}
            onClose={() => setShowMasterBalanceModal(false)}
            onOpenAdmin={() => setShowAdminPanel(true)}
            onRefresh={refreshData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MasterBalanceModal({ 
  user, 
  appCurrency, 
  initialBalances, 
  extraFunds, 
  onUpdateCurrency, 
  onClose,
  onRefresh,
  onOpenAdmin
}: { 
  user: any, 
  appCurrency: string,
  initialBalances: { cash: number, bank: number },
  extraFunds: { emergency: number, savings: number },
  onUpdateCurrency: (c: string) => Promise<void>,
  onClose: () => void,
  onRefresh: () => void,
  onOpenAdmin: () => void
}) {
  const [cash, setCash] = useState((initialBalances?.cash || 0).toString());
  const [bank, setBank] = useState((initialBalances?.bank || 0).toString());
  const [emergency, setEmergency] = useState((extraFunds?.emergency || 0).toString());
  const [savings, setSavings] = useState((extraFunds?.savings || 0).toString());
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Update master profile fields including current (spendable) balances and funds
      await api.saveUser(user.id, {
        initialCash: parseFloat(cash) || 0,
        initialBank: parseFloat(bank) || 0,
        emergencyFund: parseFloat(emergency) || 0,
        savingsFund: parseFloat(savings) || 0
      });
      
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-zinc-950 z-[100] flex flex-col p-6 overflow-y-auto"
      dir="rtl"
    >
      <div className="flex justify-between items-center mb-10 sticky top-0 bg-zinc-950 z-10 py-2">
        <div>
          <h2 className="text-2xl font-black text-white">إدارة الحسابات</h2>
          <p className="text-xs text-zinc-500">تحكم شامل بأرصدتك وعملتك</p>
        </div>
        <button onClick={onClose} className="bg-zinc-900 border border-white/5 p-3 rounded-2xl text-zinc-500">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-10 flex-1">
        {/* Currency Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">العملة الافتراضية</label>
          <div className="grid grid-cols-4 gap-3">
            {['ر.س', 'ج.م', 'USD', 'AED', 'KWD', 'EUR', 'TRY', 'GBP'].map((cur) => (
              <button
                key={cur}
                onClick={() => onUpdateCurrency(cur)}
                className={`py-4 rounded-2xl text-xs font-black border transition-all ${appCurrency === cur ? 'bg-white text-zinc-950 border-white shadow-lg' : 'bg-zinc-900 text-zinc-500 border-white/5'}`}
              >
                {cur}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-amber-500/80 px-1">ملاحظة: تغيير العملة سيقوم بتحويل جميع المبالغ المسجلة تلقائياً حسب أسعار الصرف الحالية.</p>
        </div>

        {/* Spendable Balances */}
        <div className="space-y-6">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">الأرصدة المتاحة للصرف</label>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 space-y-4">
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-zinc-500 uppercase">الكاش الشخصي</span>
                 <UserIcon size={16} className="text-zinc-600" />
               </div>
               <div className="flex items-center gap-3">
                 <input 
                  type="number"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  className="bg-transparent text-3xl font-black text-white outline-none w-full"
                 />
                 <span className="text-lg font-bold text-zinc-600">{appCurrency}</span>
               </div>
            </div>
            <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 space-y-4">
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-zinc-500 uppercase">رصيد البنك</span>
                 <CreditCard size={16} className="text-zinc-600" />
               </div>
               <div className="flex items-center gap-3">
                 <input 
                  type="number"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="bg-transparent text-3xl font-black text-white outline-none w-full"
                 />
                 <span className="text-lg font-bold text-zinc-600">{appCurrency}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Funds Balances */}
        <div className="space-y-6">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">صناديق الادخار والطوارئ</label>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-zinc-900 p-6 rounded-[2rem] border border-amber-500/10 space-y-4">
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-amber-500 uppercase">صندوق الطوارئ</span>
                 <Shield size={16} className="text-amber-500" />
               </div>
               <div className="flex items-center gap-3">
                 <input 
                  type="number"
                  value={emergency}
                  onChange={(e) => setEmergency(e.target.value)}
                  className="bg-transparent text-3xl font-black text-amber-200 outline-none w-full"
                 />
                 <span className="text-lg font-bold text-amber-500/50">{appCurrency}</span>
               </div>
            </div>
            <div className="bg-zinc-900 p-6 rounded-[2rem] border border-indigo-500/10 space-y-4">
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-indigo-500 uppercase">صندوق الادخار</span>
                 <TrendingUp size={16} className="text-indigo-500" />
               </div>
               <div className="flex items-center gap-3">
                 <input 
                  type="number"
                  value={savings}
                  onChange={(e) => setSavings(e.target.value)}
                  className="bg-transparent text-3xl font-black text-indigo-200 outline-none w-full"
                 />
                 <span className="text-lg font-bold text-indigo-500/50">{appCurrency}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 sticky bottom-0 bg-zinc-950 py-4">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-white text-zinc-950 py-6 rounded-[2rem] font-black text-xl active:scale-95 transition-all shadow-xl disabled:opacity-50"
        >
          {loading ? 'جاري الحفظ...' : 'حفظ جميع التغييرات'}
        </button>

        {user?.isAdmin && (
          <button 
            onClick={() => {
              onClose();
              onOpenAdmin();
            }}
            className="w-full mt-4 flex items-center justify-center gap-3 p-5 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/20 text-emerald-500 shadow-lg shadow-emerald-500/5 active:scale-95 transition-all"
          >
            <Shield size={20} />
            <span className="font-black text-sm">فتح لوحة الإدارة</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

function FundManagerModal({ 
  user, 
  extraFunds, 
  appCurrency, 
  onClose, 
  onRefresh 
}: { 
  user: any, 
  extraFunds: { emergency: number, savings: number }, 
  appCurrency: string,
  onClose: () => void,
  onRefresh: () => void 
}) {
  const [emergency, setEmergency] = useState(extraFunds.emergency.toString());
  const [savings, setSavings] = useState(extraFunds.savings.toString());
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await api.saveUser(user.id, {
        emergencyFund: parseFloat(emergency) || 0,
        savingsFund: parseFloat(savings) || 0
      });
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 bg-zinc-950 z-[90] flex flex-col p-6 overflow-y-auto"
      dir="rtl"
    >
      <div className="flex justify-between items-center mb-8 sticky top-0 bg-zinc-950 z-10 py-2">
        <div>
          <h2 className="text-2xl font-black text-white">إدارة الصناديق</h2>
          <p className="text-xs text-zinc-500">تحكم في مدخراتك وحالات الطوارئ</p>
        </div>
        <button onClick={onClose} className="bg-zinc-900 border border-white/5 p-3 rounded-2xl text-zinc-500">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-8 flex-1">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">صندوق الطوارئ</label>
            <Shield className="text-amber-500" size={16} />
          </div>
          <div className="relative group">
            <input 
              type="number"
              value={emergency}
              onChange={(e) => setEmergency(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 p-6 rounded-[2rem] text-3xl font-black text-white focus:border-amber-500 outline-none transition-all"
              placeholder="0.00"
            />
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">{appCurrency}</span>
          </div>
          <p className="text-[10px] text-zinc-500 px-2 leading-relaxed">
            مبلغ مخصص للحالات المفاجئة (يفضل أن يغطي مصاريف 3-6 أشهر).
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">صندوق الادخار</label>
            <TrendingUp className="text-indigo-500" size={16} />
          </div>
          <div className="relative group">
            <input 
              type="number"
              value={savings}
              onChange={(e) => setSavings(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 p-6 rounded-[2rem] text-3xl font-black text-white focus:border-indigo-500 outline-none transition-all"
              placeholder="0.00"
            />
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">{appCurrency}</span>
          </div>
          <p className="text-[10px] text-zinc-500 px-2 leading-relaxed">
            مبالغ للخطط المستقبلية أو الأهداف طويلة المدى.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-white text-zinc-950 py-5 rounded-[2rem] font-black text-lg active:scale-95 transition-all shadow-xl disabled:opacity-50"
        >
          {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>
    </motion.div>
  );
}

function AllTransactionsModal({ transactions, onClose, appCurrency }: { transactions: Transaction[], onClose: () => void, appCurrency: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 bg-zinc-950 z-[60] flex flex-col p-6 overflow-y-auto"
      dir="rtl"
    >
      <div className="flex justify-between items-center mb-8 sticky top-0 bg-zinc-950 z-10 py-2">
        <h2 className="text-2xl font-black text-white">كل العمليات</h2>
        <button onClick={onClose} className="bg-zinc-900 border border-white/5 p-3 rounded-2xl text-zinc-500">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4">
        {transactions.map((t) => {
          const category = CATEGORIES[t.category];
          const isExpense = t.type === 'expense';
          const isTransfer = t.type === 'transfer';
          return (
            <div key={t.id} className="bg-zinc-900 p-4 rounded-[2rem] flex items-center gap-5 border border-white/5">
              <div className={`p-4 rounded-2xl ${category.color} shadow-sm grayscale brightness-75`}>
                <category.icon size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-100 truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">{new Date(t.date).toLocaleDateString('ar-SA')}</span>
                  <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
                  <span className="text-[10px] font-bold text-zinc-600">
                    {WALLET_LABELS[t.wallet]} {isTransfer && ` ← ${WALLET_LABELS[t.toWallet!]}`}
                  </span>
                </div>
              </div>
              <div className={`text-lg font-black tabular-nums ${isExpense ? 'text-zinc-100' : isTransfer ? 'text-amber-500' : 'text-emerald-500'}`}>
                {isExpense ? '-' : isTransfer ? '⇄' : '+'} {t.amount.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SnapshotDetailModal({ snapshot, onClose, appCurrency }: { snapshot: Snapshot, onClose: () => void, appCurrency: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 bg-zinc-950 z-[80] flex flex-col p-6 overflow-y-auto"
      dir="rtl"
    >
      <div className="flex justify-between items-center mb-8 sticky top-0 bg-zinc-950 z-10 py-2">
        <div>
          <h2 className="text-2xl font-black text-white">تفاصيل السنابشوت</h2>
          <p className="text-xs text-zinc-500">{new Date(snapshot.date).toLocaleString('ar-SA')}</p>
        </div>
        <button onClick={onClose} className="bg-zinc-900 border border-white/5 p-3 rounded-2xl text-zinc-500">
          <X size={24} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5">
          <p className="text-[10px] font-black text-zinc-500 uppercase">مجموع الحساب</p>
          <p className="text-2xl font-black text-white">{snapshot.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {appCurrency}</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5">
          <p className="text-[10px] font-black text-zinc-500 uppercase">عدد العمليات</p>
          <p className="text-2xl font-black text-white">{snapshot.transactionCount}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-zinc-400 px-1">العمليات المؤرشفة</h3>
        {(snapshot.transactions || []).map((t) => {
          const category = CATEGORIES[t.category];
          const isExpense = t.type === 'expense';
          const isTransfer = t.type === 'transfer';
          return (
            <div key={t.id} className="bg-zinc-900/50 p-4 rounded-[2rem] flex items-center gap-5 border border-white/5 opacity-80">
              <div className={`p-4 rounded-2xl ${category.color} shadow-sm grayscale brightness-75`}>
                <category.icon size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-100 truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-zinc-500">{WALLET_LABELS[t.wallet]}</span>
                </div>
              </div>
              <div className={`text-lg font-black tabular-nums ${isExpense ? 'text-zinc-100' : isTransfer ? 'text-amber-500' : 'text-emerald-500'}`}>
                {isExpense ? '-' : isTransfer ? '⇄' : '+'} {t.amount.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SubscriptionManagerModal({ user, subscription, onClose, onRefresh }: { user: any, subscription?: Subscription, onClose: () => void, onRefresh: () => void }) {
  const [name, setName] = useState(subscription?.name || '');
  const [amount, setAmount] = useState(subscription?.amount.toString() || '');
  const [billingDate, setBillingDate] = useState(subscription?.nextBillingDate.split('T')[0] || new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<TransactionCategory>(subscription?.category || 'bills');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleSave = async () => {
    if (!user || !amount || !name || !billingDate) return;
    try {
      await api.saveSubscription({
        id: subscription?.id || crypto.randomUUID(),
        name,
        amount: parseFloat(amount),
        nextBillingDate: new Date(billingDate).toISOString(),
        category,
        userId: user.id
      });
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!user || !subscription?.id) return;
    try {
      await api.deleteSubscription(subscription.id);
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 bg-zinc-950/80 backdrop-blur-xl z-[70] flex items-center justify-center p-6"
    >
      <div className="bg-zinc-900 w-full max-w-sm rounded-[3rem] border border-white/10 p-8 space-y-6" dir="rtl">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white">{subscription ? 'تعديل اشتراك' : 'إضافة اشتراك'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={24} /></button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">اسم الاشتراك</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-white/20"
              placeholder="مثلاً: Netflix"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">المبلغ الشهري</label>
            <input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-white/20"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">تاريخ التجديد القادم</label>
            <input 
              type="date"
              value={billingDate}
              onChange={(e) => setBillingDate(e.target.value)}
              className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-white/20"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          {!isConfirmingDelete ? (
            <>
              <button 
                onClick={handleSave}
                className="flex-1 py-4 bg-white text-zinc-950 font-black rounded-2xl active:scale-95 transition-all"
              >
                {subscription ? 'تحديث البيانات' : 'إضافة الاشتراك'}
              </button>
              {subscription && (
                <button 
                  id="delete-subscription-btn"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="w-16 h-16 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-2xl hover:bg-rose-500/20 active:scale-95 transition-all"
                >
                  <X size={24} />
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                onClick={handleDelete}
                className="flex-1 py-4 bg-rose-500 text-white font-black rounded-2xl active:scale-95 animate-pulse"
              >
                تأكيد حذف الاشتراك؟
              </button>
              <button 
                onClick={() => setIsConfirmingDelete(false)}
                className="w-16 h-16 flex items-center justify-center bg-zinc-800 text-zinc-400 rounded-2xl active:scale-95"
              >
                <X size={24} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Tutorial({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  
  const steps = [
    {
      title: "أهلاً بك في مصاريفي! 🚀",
      description: "هذا التطبيق مصمم لمساعدتك على تنظيم ميزانيتك بكل بساطة واحترافية. خلنا ناخذ جولة سريعة.",
      icon: <LayoutDashboard size={40} className="text-white" />
    },
    {
      title: "ميزانيتك الإجمالية 💰",
      description: "هنا تقدر تشوف إجمالي مبالغك في الكاش والبنك، وتطالع دخلك ومصروفك الشهري بوضوح.",
      icon: <PieChart size={40} className="text-amber-500" />
    },
    {
      title: "الاشتراكات الشهرية 💳",
      description: "تقدر تضيف اشتراكاتك (نتفليكس، نادي، غيره) والتطبيق راح يذكرك بموعد التجديد ويخصمها تلقائياً.",
      icon: <CreditCard size={40} className="text-blue-500" />
    },
    {
      title: "إضافة عملية جديدة ➕",
      description: "الزر اللي في النص هو قلب التطبيق. أي ريال تصرفه أو يجيك، سجله هنا فوراً عشان ما تنساه.",
      icon: <Plus size={40} className="text-emerald-500" />
    },
    {
      title: "تراجع عن الخطأ 🔄",
      description: "غلطت في تسجيل عملية؟ لا تشيل هم، زر 'تراجع' يطلع لك فوراً بعد كل عملية عشان تمسحها بضغطة وحدة.",
      icon: <ArrowRightLeft size={40} className="text-rose-500" />
    },
    {
      title: "العملات والصناديق 🌍",
      description: "من الإعدادات تقدر تغير العملة لـ (ريال، درهم، دينار...) وتوزع فلوسك في صناديق ادخار أو طوارئ.",
      icon: <Settings size={40} className="text-zinc-400" />
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl"
    >
      <motion.div 
        key={step}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-zinc-900 border border-white/10 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden text-center space-y-6"
      >
        <div className="flex justify-center mb-2">
          <motion.div 
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            className="p-6 bg-zinc-800 rounded-[2rem] border border-white/5"
          >
            {steps[step].icon}
          </motion.div>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-black text-white">{steps[step].title}</h2>
          <p className="text-zinc-400 leading-relaxed font-bold text-sm">
            {steps[step].description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 pt-4">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-white' : 'w-1.5 bg-zinc-800'}`}
              />
            ))}
          </div>
          <button 
            onClick={handleNext}
            className="px-8 py-4 bg-white text-zinc-950 font-black rounded-2xl active:scale-95 transition-all shadow-lg"
          >
            {step === steps.length - 1 ? 'ابدأ الاستخدام' : 'التالي'}
          </button>
        </div>

        <button 
          onClick={onComplete}
          className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-400 p-1"
        >
          <X size={20} />
        </button>
      </motion.div>
    </motion.div>
  );
}

function NotificationsModal({ 
  notifications, 
  onClose, 
  onMarkRead, 
  onDelete 
}: { 
  notifications: AppNotification[], 
  onClose: () => void, 
  onMarkRead: () => void,
  onDelete: (id: string) => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-xl font-black text-white">التنبيهات</h2>
          <div className="flex gap-2">
            <button 
              onClick={onMarkRead}
              className="text-[10px] font-black text-zinc-500 hover:text-zinc-300"
            >
              قراءة الكل
            </button>
            <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-400">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {notifications.length > 0 ? notifications.map((n) => (
            <motion.div 
              key={n.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-5 rounded-[2rem] border relative transition-all group ${n.isRead ? 'bg-zinc-950/40 border-white/5' : 'bg-zinc-800 border-white/10 shadow-lg'}`}
            >
              {!n.isRead && (
                <span className="absolute top-5 left-5 w-2 h-2 bg-emerald-500 rounded-full"></span>
              )}
              <div className="space-y-1">
                <h3 className="font-bold text-white text-sm pr-4">{n.title}</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">{n.message}</p>
                <p className="text-[10px] text-zinc-600 pt-1">
                  {new Date(n.date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', hour: 'numeric', minute: 'numeric' })}
                </p>
              </div>
              <button 
                onClick={() => onDelete(n.id)}
                className="absolute bottom-5 left-5 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-rose-500/50 hover:text-rose-500"
              >
                <X size={14} />
              </button>
            </motion.div>
          )) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center mx-auto text-zinc-800">
                <Bell size={24} />
              </div>
              <p className="text-zinc-500 text-xs font-bold">لا توجد تنبيهات جديدة</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) return;
    setSending(true);
    try {
      await api.broadcastNotification(broadcastTitle, broadcastMessage);
      setBroadcastTitle('');
      setBroadcastMessage('');
      alert('تم إرسال التنبيه لجميع المستخدمين بنجاح!');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
          <div>
            <h2 className="text-xl font-black text-white">لوحة الإدارة</h2>
            <p className="text-[10px] text-zinc-500 font-bold">إدارة المستخدمين وتبليغ الجميع</p>
          </div>
          <button onClick={onClose} className="p-3 bg-zinc-950 border border-white/5 rounded-2xl text-zinc-500">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {/* Broadcast Section */}
          <div className="space-y-6">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Bell size={18} className="text-emerald-500" />
              إرسال تنبيه عام لكل المشتركين
            </h3>
            <div className="space-y-4">
              <input 
                type="text"
                placeholder="عنوان التنبيه"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-sm outline-none focus:border-emerald-500/50 transition-all"
              />
              <textarea 
                placeholder="نص التنبيه..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-sm outline-none focus:border-emerald-500/50 transition-all min-h-[100px]"
              />
              <button 
                onClick={handleBroadcast}
                disabled={sending || !broadcastTitle || !broadcastMessage}
                className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {sending ? 'جاري الإرسال...' : 'إرسال للجميع الآن'}
              </button>
            </div>
          </div>

          {/* User List Section */}
          <div className="space-y-6">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Users size={18} className="text-blue-500" />
              قائمة المستخدمين ({users.length})
            </h3>
            <div className="space-y-2">
              {loading ? (
                <p className="text-xs text-zinc-500 text-center py-10">جاري تحميل المستخدمين...</p>
              ) : users.map(u => (
                  <div key={u.id} className="p-4 bg-zinc-950/50 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-white">{u.displayName}</p>
                        <p className="text-[10px] text-zinc-500">{u.email}</p>
                      </div>
                      {u.isAdmin && (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full border border-emerald-500/20">
                          مدير
                        </span>
                      )}
                    </div>
                    
                    <button 
                      onClick={async () => {
                        const pass = prompt('أدخل كلمة المرور الجديدة لهذا المستخدم:');
                        if (pass) {
                          try {
                            await api.resetUserPassword(u.id, pass);
                            alert('تم تحديث كلمة المرور بنجاح!');
                          } catch (err) {
                            alert('فشلت العملية');
                          }
                        }
                      }}
                      className="w-full py-2 bg-zinc-900 border border-white/5 rounded-xl text-[10px] font-black text-zinc-400 hover:text-white transition-all uppercase tracking-widest"
                    >
                      إعادة تعيين كلمة المرور
                    </button>
                  </div>
                ))}
              </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuickAddModal({ user, onClose, onAdd, appCurrency }: { user: any, onClose: () => void, onAdd: (t: Omit<Transaction, 'id'>) => void, appCurrency: string }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('salary');
  const [necessity, setNecessity] = useState<NecessityType>('necessity');
  const [type, setType] = useState<TransactionType>('expense');
  const [wallet, setWallet] = useState<WalletType>('bank');
  const [toWallet, setToWallet] = useState<WalletType>('cash');
  const [isSubscription, setIsSubscription] = useState(false);
  
  // Converter states
  const [convertFrom, setConvertFrom] = useState('USD');
  const [convertAmount, setConvertAmount] = useState('');
  const [rates, setRates] = useState<any>({});
  const [showConverter, setShowConverter] = useState(false);

  useEffect(() => {
    if (type === 'income') {
      setCategory('salary');
      // Reset wallet if it was a fund account
      if (['emergency', 'savings'].includes(wallet)) setWallet('bank');
    } else if (type === 'expense') {
      setCategory('food');
      // Reset wallet if it was a fund account
      if (['emergency', 'savings'].includes(wallet)) setWallet('bank');
    }
  }, [type]);

  useEffect(() => {
    api.getExchangeRates().then(setRates);
  }, []);

  const handleConvert = () => {
    if (!convertAmount || !rates[convertFrom]) return;
    
    // Get target currency code
    const targetCode = appCurrency === 'ر.س' ? 'SAR' : (appCurrency === 'ج.م' ? 'EGP' : appCurrency);
    const fromCode = convertFrom;

    if (!rates[targetCode]) return;

    // Standard conversion via Base (USD usually)
    // Value in base = convertAmount / rates[fromCode]
    // Value in target = Value in base * rates[targetCode]
    const finalAmount = (parseFloat(convertAmount) / rates[fromCode]) * rates[targetCode];
    
    setAmount(finalAmount.toFixed(2));
    setShowConverter(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !user) return;
    
    // Auto-description for transfers
    const finalDescription = type === 'transfer' 
      ? `تحويل من ${WALLET_LABELS[wallet]} إلى ${WALLET_LABELS[toWallet]}`
      : description || CATEGORIES[category].label;

    if (isSubscription) {
      try {
        await api.saveSubscription({
          id: crypto.randomUUID(),
          name: finalDescription,
          amount: parseFloat(amount),
          nextBillingDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
          category,
          userId: user.id
        });
      } catch (err) {
        console.error(err);
      }
    }

    onAdd({
      amount: parseFloat(amount),
      description: finalDescription,
      category,
      type,
      necessity,
      wallet,
      toWallet: type === 'transfer' ? toWallet : undefined,
      date: new Date().toISOString(),
      userId: user.id
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-zinc-950 z-50 flex flex-col p-6 overflow-y-auto"
      dir="rtl"
    >
      <div className="flex justify-between items-center mb-8">
        <button onClick={onClose} className="bg-zinc-900 border border-white/5 p-3 rounded-2xl text-zinc-500 active:bg-zinc-800">
          <X size={24} />
        </button>
        <div className="flex p-1 bg-zinc-900 rounded-2xl border border-white/5">
           {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
             <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${type === t ? 'bg-white text-zinc-950 shadow-lg' : 'text-zinc-500'}`}
             >
               {t === 'expense' ? 'مصروف' : t === 'income' ? 'دخل' : 'تحويل'}
             </button>
           ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-10 max-w-lg mx-auto w-full">
        <div className="space-y-4 text-center relative">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">أدخل المبلغ</label>
            <button 
              type="button"
              onClick={() => setShowConverter(!showConverter)}
              className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20"
            >
              محول العملات {showConverter ? '↑' : '↓'}
            </button>
          </div>

          {showConverter && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-zinc-900 p-4 rounded-3xl border border-white/5 flex items-center gap-3"
            >
              <input 
                type="number"
                placeholder="المبلغ"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                className="flex-1 bg-zinc-950 border border-white/5 p-3 rounded-xl text-white outline-none"
              />
              <select 
                value={convertFrom}
                onChange={(e) => setConvertFrom(e.target.value)}
                className="bg-zinc-950 border border-white/5 p-3 rounded-xl text-white outline-none text-xs"
              >
                {['USD', 'SAR', 'EGP', 'AED', 'KWD', 'EUR', 'TRY', 'GBP'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option disabled>──────</option>
                {Object.keys(rates).filter(c => !['USD', 'SAR', 'EGP', 'AED', 'KWD', 'EUR', 'TRY', 'GBP'].includes(c)).slice(0, 50).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button 
                type="button"
                onClick={handleConvert}
                className="bg-amber-500 text-zinc-950 px-4 py-3 rounded-xl font-black text-xs"
              >
                تحويل
              </button>
            </motion.div>
          )}

          <div className="flex items-center justify-center gap-3">
             <input 
              type="number" 
              autoFocus
              inputMode="decimal"
              placeholder="0.00"
              className="w-full text-7xl font-black bg-transparent border-none outline-none focus:ring-0 placeholder:text-zinc-900 text-center tabular-nums text-white"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="text-2xl font-bold text-zinc-600">{appCurrency}</span>
          </div>
        </div>

        {type !== 'transfer' && (
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">التصنيف</label>
            <div className="grid grid-cols-4 gap-4">
              {(Object.keys(CATEGORIES) as TransactionCategory[])
                .filter(catKey => {
                  if (type === 'income') {
                    return ['salary', 'investment', 'gift', 'other'].includes(catKey);
                  }
                  if (type === 'expense') {
                    return !['salary'].includes(catKey);
                  }
                  return true;
                })
                .map((catKey) => {
                  const cat = CATEGORIES[catKey];
                  const isSelected = category === catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setCategory(catKey)}
                      className={`flex flex-col items-center gap-3 p-4 rounded-3xl transition-all border border-transparent ${
                        isSelected ? 'bg-white text-zinc-950 scale-110 shadow-2xl' : 'bg-zinc-900 text-zinc-500 border-white/5 hover:bg-zinc-800'
                      }`}
                    >
                      <cat.icon size={26} strokeWidth={isSelected ? 2.5 : 2} />
                      <span className="text-[9px] font-black uppercase tracking-tighter">{cat.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
              {type === 'transfer' ? 'من حساب' : 'الحساب'}
            </label>
            <div className={`p-1 bg-zinc-900 rounded-[1.5rem] border border-white/5 grid ${type === 'transfer' ? 'grid-cols-4 px-1' : 'grid-cols-2'}`}>
                {(type === 'transfer' ? ['cash', 'bank', 'savings', 'emergency'] : ['cash', 'bank']).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWallet(w as WalletType)}
                    className={`py-4 text-[9px] font-black rounded-2xl transition-all ${wallet === w ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}
                  >
                    {WALLET_LABELS[w]}
                  </button>
                ))}
            </div>
          </div>

          {type === 'transfer' && (
            <div className="flex-1 space-y-4">
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">إلى حساب</label>
              <div className="p-1 bg-zinc-900 rounded-[1.5rem] border border-white/5 grid grid-cols-4 px-1">
                  {(['cash', 'bank', 'savings', 'emergency'] as WalletType[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setToWallet(w)}
                      className={`py-4 text-[9px] font-black rounded-2xl transition-all ${toWallet === w ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}
                    >
                      {WALLET_LABELS[w]}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {type === 'expense' && (
            <div className="flex-shrink-0 space-y-4 min-w-[100px]">
               <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">التكرار</label>
               <button
                type="button"
                onClick={() => setIsSubscription(!isSubscription)}
                className={`w-full py-4 text-xs font-bold rounded-2xl transition-all border ${isSubscription ? 'bg-white text-zinc-950 border-white' : 'bg-zinc-900 text-zinc-600 border-white/5'}`}
               >
                 {isSubscription ? 'اشتراك' : 'مرة واحدة'}
               </button>
            </div>
          )}
        </div>

        {type === 'expense' && (
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">الأهمية</label>
            <div className="flex p-1 bg-zinc-900 rounded-[1.5rem] border border-white/5">
                <button
                type="button"
                onClick={() => setNecessity('necessity')}
                className={`flex-1 py-4 text-xs font-bold rounded-2xl transition-all ${necessity === 'necessity' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                >
                  {NECESSITY_LABELS.necessity}
                </button>
                <button
                type="button"
                onClick={() => setNecessity('luxury')}
                className={`flex-1 py-4 text-xs font-bold rounded-2xl transition-all ${necessity === 'luxury' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                >
                  {NECESSITY_LABELS.luxury}
                </button>
            </div>
          </div>
        )}


        <div className="space-y-4">
           <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">الوصف</label>
           <input 
            placeholder={type === 'transfer' ? 'تحويل مبلغ...' : type === 'income' ? 'راتب الشهر، مكافأة، مبيعات...' : 'اشتريت قهوة، تسوقت من العثيم...'}
            className="w-full p-6 bg-zinc-900 rounded-3xl border border-white/5 outline-none focus:ring-4 focus:ring-white/5 text-lg text-white font-bold"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="mt-auto space-y-4 pt-10">
          <button 
            type="submit"
            disabled={!amount}
            className={`w-full py-6 rounded-[2rem] font-black text-xl shadow-2xl transition-all transform active:scale-95 ${
              !amount ? 'bg-zinc-900 text-zinc-800' : 'bg-white text-zinc-950 shadow-white/10 ring-8 ring-zinc-950'
            }`}
          >
            تأكيد العملية
          </button>
          <p className="text-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest pb-4">سيتم حفظ العملية سحابياً فورياً</p>
        </div>
      </form>
    </motion.div>
  );
}
