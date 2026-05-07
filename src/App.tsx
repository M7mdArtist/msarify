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
  BellOff,
  BellRing,
  X,
  LogOut,
  Shield,
  Users,
  TrendingUp,
  Info,
  User as UserIcon,
  CreditCard,
  ArrowRightLeft,
  Lock,
  Smartphone,
  ChevronRight,
  ChevronDown,
  Trash2,
  Camera,
  Loader2,
  Wallet
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';

const convertArabicNumerals = (str: string) => {
  return str
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[٫،,]/g, ".");
};
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
  subMonths, 
  format
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Cell, 
  Pie, 
  PieChart as RechartsPieChart, 
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area
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
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<any>({});
  
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const rates = await api.getExchangeRates();
        setExchangeRates(rates);
      } catch (e) {
        console.error("Rates fetch failed:", e);
      }
    };
    fetchRates();
    const interval = setInterval(fetchRates, 1000 * 60 * 60); // Refresh every hour
    return () => clearInterval(interval);
  }, []);
  
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

  const trendData = React.useMemo(() => {
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(new Date(), i);
      return {
        month: format(date, 'MMM', { locale: ar }),
        monthKey: format(date, 'yyyy-MM'),
        income: 0,
        expense: 0
      };
    }).reverse();

    transactions.forEach(t => {
      const tDate = new Date(t.date);
      const key = format(tDate, 'yyyy-MM');
      const dataPoint = last6Months.find(m => m.monthKey === key);
      if (dataPoint) {
        if (t.type === 'income') dataPoint.income += t.amount;
        else if (t.type === 'expense') dataPoint.expense += t.amount;
      }
    });

    return last6Months;
  }, [transactions]);

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

  // Dashboard Tab Component
  const DashboardTab = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Premium Balance Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-8 rounded-[3rem] overflow-hidden group shadow-2xl bg-zinc-900 border border-white/5 active:scale-[0.99] transition-transform duration-500"
      >
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full -mr-64 -mt-64 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 blur-[100px] rounded-full -ml-48 -mb-48 group-hover:bg-emerald-500/10 transition-all duration-700"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02),transparent)] opacity-50"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-10">
            <div className="space-y-1 text-right w-full">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">إجمالي الرصيد</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black tabular-nums tracking-tighter text-white drop-shadow-2xl">
                {currentTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                <span className="text-sm font-medium text-zinc-600 mr-2">{appCurrency}</span>
              </h2>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-white/[0.03] backdrop-blur-3xl p-5 rounded-[2.5rem] border border-white/5 space-y-4 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-zinc-800 rounded-2xl text-zinc-400">
                  <Wallet size={16} />
                </div>
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">الكاش</span>
              </div>
              <p className="text-xl font-black tabular-nums text-white truncate">
                {walletBalances.cash.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                <span className="text-[10px] font-bold text-zinc-600 mr-1.5">{appCurrency}</span>
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-white/[0.03] backdrop-blur-3xl p-5 rounded-[2.5rem] border border-white/5 space-y-4 hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-zinc-800 rounded-2xl text-zinc-400">
                  <Smartphone size={16} />
                </div>
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">الصرافة</span>
              </div>
              <p className="text-xl font-black tabular-nums text-white truncate">
                {walletBalances.bank.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                <span className="text-[10px] font-bold text-zinc-600 mr-1.5">{appCurrency}</span>
              </p>
            </motion.div>
          </div>

          <div className="pt-8 border-t border-white/5 flex gap-12 justify-center">
            <div className="group cursor-help">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <div className="w-6 h-6 rounded-xl bg-emerald-400/10 flex items-center justify-center group-hover:scale-110 transition-transform"><ArrowDownLeft size={12} /></div>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">دخل</span>
              </div>
              <p className="text-lg font-black text-white">{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-[10px] text-zinc-600 font-bold">{appCurrency}</span></p>
            </div>
            
            <div className="w-px h-10 bg-white/5 self-center"></div>

            <div className="group cursor-help">
              <div className="flex items-center gap-2 text-rose-400 mb-1">
                <div className="w-6 h-6 rounded-xl bg-rose-400/10 flex items-center justify-center group-hover:scale-110 transition-transform"><ArrowUpRight size={12} /></div>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">صرف</span>
              </div>
              <p className="text-lg font-black text-white">{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-[10px] text-zinc-600 font-bold">{appCurrency}</span></p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Threshold Warning */}
      {userBudget > 0 && totalExpenses > userBudget && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl flex items-center gap-4 group"
        >
          <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">
            <Bell size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-rose-200 uppercase tracking-tight">تعديت الميزانية!</p>
            <p className="text-xs text-rose-500/70 font-bold">صرفت أكثر من {userBudget.toLocaleString()} {appCurrency}</p>
          </div>
          <ChevronRight size={16} className="text-rose-500/30" />
        </motion.div>
      )}

      {/* Subscription Sliders */}
      <div className="space-y-4">
        <div className="flex justify-between items-center group cursor-pointer px-1">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-indigo-400" />
            <h2 className="font-black text-zinc-100 uppercase tracking-tighter">الاشتراكات</h2>
          </div>
          <button onClick={() => setShowSubscriptionModal({ show: true })} className="text-[10px] font-black text-zinc-500 bg-zinc-900 border border-white/5 py-1 px-3 rounded-full hover:border-white/20 transition-all uppercase tracking-widest">إدارة</button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1 -mx-1 snap-x">
          {subscriptions.length > 0 ? subscriptions.map((s) => (
            <motion.div 
              key={s.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSubscriptionModal({ show: true, sub: s })}
              className="min-w-[160px] snap-center glass p-5 rounded-[2rem] space-y-4 cursor-pointer hover:border-white/20 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-100 font-bold text-lg shadow-inner">{s.name[0]}</div>
              <div>
                <p className="text-sm font-black">{s.name}</p>
                <p className="text-[10px] text-zinc-500 font-bold">كل شهر</p>
              </div>
              <div className="pt-2 flex justify-between items-end">
                <span className="text-sm font-black">{s.amount.toFixed(0)} <span className="text-[9px] opacity-40 font-bold uppercase">{appCurrency}</span></span>
                <span className="text-[9px] font-black text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-md">يوم {new Date(s.nextBillingDate).getDate()}</span>
              </div>
            </motion.div>
          )) : (
            <div className="w-full glass p-8 rounded-[2rem] text-center space-y-3">
              <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto text-zinc-800 shadow-inner"><CreditCard size={20} /></div>
              <p className="text-xs text-zinc-500 font-bold">لا توجد اشتراكات مجدولة</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent History */}
      <div className="space-y-6 pb-12">
        <div className="flex justify-between items-center group px-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-zinc-900 rounded-lg text-zinc-500 border border-white/5">
              <ArrowRightLeft size={14} />
            </div>
            <h2 className="font-black text-white uppercase tracking-tighter text-lg">العمليات الأخيرة</h2>
          </div>
          <button 
            onClick={() => setShowAllTransactions(true)} 
            className="text-[9px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900/50 px-3 py-1.5 rounded-full border border-white/5 hover:border-white/10 active:bg-zinc-800 transition-all"
          >
            عرض الكل
          </button>
        </div>
        <div className="space-y-4">
          {transactions.length > 0 ? transactions.slice(0, 5).map((t, i) => {
            const category = CATEGORIES[t.category];
            const isExpense = t.type === 'expense';
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={t.id}
                className="bg-white/[0.02] backdrop-blur-3xl p-4 rounded-[2rem] flex items-center gap-4 hover:bg-white/[0.04] transition-all border border-white/5 group"
              >
                <div className={`w-14 h-14 rounded-[1.25rem] ${category.color} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 relative overflow-hidden`}>
                   <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <category.icon size={24} className="text-white relative z-10" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="font-black text-sm text-white truncate mb-0.5 tracking-tight">{t.description}</p>
                  <div className="flex items-center justify-end gap-2 text-zinc-500">
                    <span className="text-[9px] font-bold uppercase tracking-wider">{WALLET_LABELS[t.wallet]}</span>
                    <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
                    <span className="text-[9px] font-bold uppercase tracking-wider">{new Date(t.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
                <div className={`text-lg font-black tabular-nums ${isExpense ? 'text-white' : 'text-emerald-400'} pr-1`}>
                  <span className="text-xs opacity-50 ml-1">{isExpense ? '-' : '+'}</span>
                  {t.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </div>
              </motion.div>
            );
          }) : (
            <div className="text-center py-16 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/5 space-y-4">
              <div className="w-20 h-20 bg-zinc-950 rounded-[2.5rem] flex items-center justify-center mx-auto text-zinc-900 shadow-inner group">
                <LayoutDashboard size={40} className="group-hover:scale-110 transition-transform" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-zinc-500 uppercase tracking-tight">لا توجد عمليات مسجلة</p>
                <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">سجل أول عملية لك الآن</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

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

      <header className="px-6 py-10 flex justify-between items-center sticky top-0 z-40 bg-zinc-950/60 backdrop-blur-3xl border-b border-white/5 safe-top">
        <div className="space-y-0.5">
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-tight italic">مصاريفي</h1>
          <div className="flex items-center gap-2 pr-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.25em]">{user.displayName}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotificationsModal(true)}
            className="p-3 bg-white/[0.03] backdrop-blur-3xl rounded-2xl text-zinc-400 relative border border-white/10 transition-all hover:bg-white/[0.07] hover:text-white"
          >
            <Bell size={20} />
            {notifications.filter(n => !n.isRead).length > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-zinc-950"></span>
            )}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="p-3 bg-white/[0.03] backdrop-blur-3xl rounded-2xl text-zinc-400 border border-white/10 transition-all hover:bg-white/[0.07] hover:text-rose-400"
          >
            <LogOut size={20} />
          </motion.button>
        </div>
      </header>

      <main className="p-4 space-y-10 max-w-lg mx-auto pb-32">
        {activeTab === 'home' && <DashboardTab />}

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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">إجمالي المصروف</p>
                  <p className="text-base sm:text-lg font-black text-white text-center break-words max-w-[100px]">
                    {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    <span className="text-[9px] opacity-40 mr-1">{appCurrency}</span>
                  </p>
                </div>
            </div>
            
            <div className="bg-zinc-900 rounded-[3rem] p-8 border border-white/5 space-y-6">
              <div className="px-2">
                <h3 className="text-lg font-black text-white">تحركات الميزانية</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">آخر 6 أشهر</p>
              </div>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} 
                      dy={10}
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', direction: 'rtl' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorIncome)" 
                      name="الدخل"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expense" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorExpense)" 
                      name="المصروف"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">الدخل</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50"></div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">المصروف</span>
                </div>
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
            
            {!!user?.isAdmin && (
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

            <button 
              onClick={() => setShowTutorial(true)}
              className="w-full flex items-center justify-center gap-4 p-8 bg-zinc-900 rounded-[3rem] border border-white/5 hover:border-amber-500/30 transition-all group overflow-hidden relative active:scale-95 shadow-xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-12 translate-x-12"></div>
              <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-400 group-hover:scale-110 transition-transform">
                <Info size={32} />
              </div>
              <div className="flex-1 text-right">
                <h4 className="font-black text-white text-lg">تعليمات الاستخدام</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">شرح شامل لمزايا التطبيق</p>
              </div>
              <div className="p-3 bg-zinc-800 rounded-xl text-zinc-600">
                <ChevronRight size={20} />
              </div>
            </button>

            <button 
              onClick={() => setShowInstallGuide(true)}
              className="w-full flex items-center justify-center gap-4 p-8 bg-zinc-900 rounded-[3rem] border border-white/5 hover:border-blue-500/30 transition-all group overflow-hidden relative active:scale-95 shadow-xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-12 translate-x-12"></div>
              <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                <Smartphone size={32} />
              </div>
              <div className="flex-1 text-right">
                <h4 className="font-black text-white text-lg">تثبيت التطبيق على الآيفون</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">دليل الخطوات لسهولة الوصول</p>
              </div>
              <div className="p-3 bg-zinc-800 rounded-xl text-zinc-600">
                <ChevronRight size={20} />
              </div>
            </button>

            {/* Siri Integration Section */}
            <div className="bg-zinc-900 rounded-[2.5rem] p-8 border border-white/5 space-y-6 overflow-hidden relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-12 translate-x-12"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/10">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-sm">تكامل سيري (Siri)</h3>
                    <p className="text-[10px] text-blue-500/50 font-bold uppercase tracking-wider">الإدخال الصوتي السريع</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="p-5 bg-zinc-950 rounded-[1.5rem] border border-white/5 space-y-3">
                  <p className="text-[10px] text-zinc-500 font-bold text-center">مفتاح الوصول الخاص بسيري</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={user?.siriToken || "لم يتم إنشاء مفتاح بعد"} 
                      className="flex-1 bg-transparent text-center font-mono text-xs text-blue-400 outline-none"
                    />
                    {user?.siriToken && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(user.siriToken);
                          alert("تم نسخ المفتاح!");
                        }}
                        className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"
                      >
                        <CreditCard size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/user/siri-token', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                      });
                      const data = await res.json();
                      if (data.siriToken) {
                        setUser({ ...user, siriToken: data.siriToken });
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full py-5 bg-blue-600 text-white font-black rounded-[2rem] active:scale-95 transition-all text-sm shadow-xl"
                >
                  {user?.siriToken ? "تجديد المفتاح السري" : "إنشاء مفتاح الوصول"}
                </button>
              </div>
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
      <div className="fixed bottom-8 left-6 right-6 z-40 lg:max-w-lg lg:mx-auto">
        <nav className="bg-zinc-900/80 backdrop-blur-3xl rounded-[3rem] border border-white/5 py-4 px-6 flex justify-between items-center shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === 'home' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <LayoutDashboard size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{activeTab === 'home' && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-white rounded-full absolute -top-2" />}الرئيسية</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === 'analysis' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <PieChart size={22} strokeWidth={activeTab === 'analysis' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{activeTab === 'analysis' && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-white rounded-full absolute -top-2" />}التحليل</span>
          </button>

          <div className="relative -mt-16">
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowAddModal(true)}
              className="bg-white text-zinc-950 p-5 rounded-3xl shadow-[0_20px_40px_rgba(255,255,255,0.15)] ring-[10px] ring-zinc-950 transition-all"
            >
              <Plus size={28} strokeWidth={3} />
            </motion.button>
          </div>

          <button 
            onClick={() => setActiveTab('funds')}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === 'funds' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <Shield size={22} strokeWidth={activeTab === 'funds' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{activeTab === 'funds' && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-white rounded-full absolute -top-2" />}الصناديق</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === 'settings' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <Settings size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{activeTab === 'settings' && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-white rounded-full absolute -top-2" />}الإعدادات</span>
          </button>
        </nav>
      </div>

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
        {showInstallGuide && (
          <InstallGuideModal user={user} onClose={() => setShowInstallGuide(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function InstallGuideModal({ user, onClose }: { user: any, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'iphone' | 'siri'>('iphone');

  const iphoneSteps = [
    {
      title: "الخطوة الأولى",
      desc: "اضغط على زر المشاركة في متصفح سفاري بالأسفل",
      img: "/iphone-step1.png"
    },
    {
      title: "الخطوة الثانية",
      desc: "انزل للأسفل واضغط على 'إضافة إلى الشاشة الرئيسية'",
      img: "/iphone-step2.png"
    },
    {
      title: "الخطوة الثالثة",
      desc: "اضغط على 'إضافة' في الزاوية العلوية وسيكون جاهزاً",
      img: "/iphone-step3.png"
    }
  ];

  const siriSteps = [
    {
      title: "تطبيق Shortcuts",
      desc: "افتح تطبيق 'الاختصارات' (Shortcuts) على جوالك وأنشئ اختصاراً جديداً"
    },
    {
      title: "إملاء النص",
      desc: "أضف إجراء 'Dictate Text' (إملاء النص) واجعل اللغة العربية/الإنجليزية"
    },
    {
      title: "جلب محتويات الرابط",
      desc: "أضف إجراء 'Get Contents of URL' وضع الرابط: " + window.location.origin + "/api/quick-add"
    },
    {
      title: "الإعدادات التقنية",
      desc: "اجعل الطريقة (Method) هي POST، وأضف Header باسم 'x-api-key' وضَع فيه مفتاحك الخاص من الإعدادات، وفي Body اجعل JSON يحتوي على مفتاح 'text' قيمته هي 'Dictated Text'"
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-zinc-950/95 backdrop-blur-2xl"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-8 border-b border-white/5 space-y-6 sticky top-0 bg-zinc-900 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-white">دليل الاستخدام</h2>
              <p className="text-[10px] text-zinc-500 font-bold">كل ما تحتاجه للوصول السريع</p>
            </div>
            <button onClick={onClose} className="p-3 bg-zinc-950 border border-white/5 rounded-2xl text-zinc-500">
              <X size={24} />
            </button>
          </div>

          <div className="flex p-1 bg-zinc-950 rounded-2xl border border-white/5">
            <button 
              onClick={() => setActiveTab('iphone')}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${activeTab === 'iphone' ? 'bg-white text-zinc-950 shadow-lg' : 'text-zinc-500'}`}
            >
              كتطبيق iPhone
            </button>
            <button 
              onClick={() => setActiveTab('siri')}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${activeTab === 'siri' ? 'bg-white text-zinc-950 shadow-lg' : 'text-zinc-500'}`}
            >
              عبر Siri
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar" dir="rtl">
          {activeTab === 'iphone' ? (
            iphoneSteps.map((s, i) => (
              <div key={i} className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="w-8 h-8 rounded-full bg-white text-zinc-950 flex items-center justify-center font-black text-sm">
                    {i + 1}
                  </span>
                  <h3 className="font-black text-white">{s.title}</h3>
                </div>
                <p className="text-zinc-400 text-xs font-bold leading-relaxed">{s.desc}</p>
                <div className="bg-zinc-950 rounded-[2rem] border border-white/5 overflow-hidden aspect-[9/16] relative">
                  <img 
                    src={s.img} 
                    alt={s.title} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://placehold.co/1080x1920/18181b/ffffff?text=Image+${i+1}`;
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-8">
              {siriSteps.map((s, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs">
                    {i + 1}
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="font-black text-white text-sm">{s.title}</h4>
                    <p className="text-zinc-400 text-[11px] font-bold leading-relaxed">{s.desc}</p>
                    {i === 3 && (
                      <div className="mt-4 p-4 bg-zinc-950 rounded-2xl border border-white/5 space-y-2">
                        <p className="text-[9px] text-zinc-500 font-black uppercase">مفتاحك الشخصي</p>
                        <div 
                          onClick={() => {
                            if (user?.siriToken) {
                              navigator.clipboard.writeText(user.siriToken);
                              alert("تم نسخ المفتاح!");
                            }
                          }}
                          className="font-mono text-[10px] text-blue-400 break-all cursor-pointer hover:text-blue-300 transition-colors"
                        >
                          {user?.siriToken || "يرجى إنشاء مفتاح من الإعدادات أولاً"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="pt-4 text-center">
            <button 
              onClick={onClose}
              className="w-full py-5 bg-white text-zinc-950 font-black rounded-2xl active:scale-95 transition-all shadow-xl"
            >
              فهمت، جاهز!
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
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
                  type="text"
                  inputMode="decimal"
                  value={cash}
                  onChange={(e) => {
                    const val = convertArabicNumerals(e.target.value);
                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setCash(val);
                    }
                  }}
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
                  type="text"
                  inputMode="decimal"
                  value={bank}
                  onChange={(e) => {
                    const val = convertArabicNumerals(e.target.value);
                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setBank(val);
                    }
                  }}
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
                  type="text"
                  inputMode="decimal"
                  value={emergency}
                  onChange={(e) => {
                    const val = convertArabicNumerals(e.target.value);
                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setEmergency(val);
                    }
                  }}
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
                  type="text"
                  inputMode="decimal"
                  value={savings}
                  onChange={(e) => {
                    const val = convertArabicNumerals(e.target.value);
                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setSavings(val);
                    }
                  }}
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
              type="text"
              inputMode="decimal"
              value={emergency}
              onChange={(e) => {
                const val = convertArabicNumerals(e.target.value);
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setEmergency(val);
                }
              }}
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
              type="text"
              inputMode="decimal"
              value={savings}
              onChange={(e) => {
                const val = convertArabicNumerals(e.target.value);
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setSavings(val);
                }
              }}
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
              <div className="flex-1 min-w-0 text-right">
                <p className="font-bold text-zinc-100 truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-0.5 justify-end">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">
                    {isTransfer ? 'تحويل' : category.label}
                  </span>
                  <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
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
              <div className="flex-1 min-w-0 text-right">
                <p className="font-bold text-zinc-100 truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-0.5 justify-end">
                  <span className="text-[10px] font-bold text-zinc-500">
                    {isTransfer ? 'تحويل' : category.label}
                  </span>
                  <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
                  <span className="text-[10px] font-bold text-zinc-600">
                    {WALLET_LABELS[t.wallet]} {isTransfer && t.toWallet && ` ← ${WALLET_LABELS[t.toWallet]}`}
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
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const val = convertArabicNumerals(e.target.value);
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setAmount(val);
                }
              }}
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
      title: "الميزانية والتحركات 💰",
      description: "في الصفحة الرئيسية، تقدر تشوف إجمالي مبالغك (كاش وبنك)، وتطالع الرسم البياني اللي يوضح لك 'تحركات الميزانية' ومقارنة الدخل بالمصروف.",
      icon: <PieChart size={40} className="text-amber-500" />
    },
    {
      title: "إضافة عملية (الزر الأهم!) ➕",
      description: "الزر اللي في النص تحت (+) هو أهم زر في التطبيق. أي مبلغ تصرفه أو يدخل لك، سجل بالضغط عليه مباشرة عشان ميزانيتك تظل دقيقة.",
      icon: <Plus size={40} className="text-emerald-500" />
    },
    {
      title: "قسم التحليل الذكي 📊",
      description: "زر 'التحليل' في الأسفل يعطيك نظرة أعمق لمصاريفك، إجمالي المصاريف حسب الفئات، ويقولك وين صرفت أكثر.",
      icon: <PieChart size={40} className="text-blue-500" />
    },
    {
      title: "الصناديق والادخار 🛡️",
      description: "في قسم 'الصناديق'، تقدر تخصص فلوس للطوارئ أو للادخار لمستقبلك بعيداً عن مصاريفك اليومية.",
      icon: <Shield size={40} className="text-indigo-500" />
    },
    {
      title: "تنبيهات الميزانية 🔔",
      description: "فوق على اليمين فيه جرس التنبيهات. التطبيق راح ينبهك إذا قربت تخلص ميزانيتك أو فيه تحديثات مهمة تفيدك.",
      icon: <Bell size={40} className="text-amber-400" />
    },
    {
      title: "جاهز تبدأ؟ 😍",
      description: "ابدأ بتعديل أرصدتك الحالية من قسم 'الإعدادات'.. وخلنا نساعدك تدير فلوسك صح!",
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
  onMarkRead: (id: string) => void,
  onDelete: (id: string) => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[2.5rem] flex flex-col max-h-[80vh] overflow-hidden shadow-2xl"
        dir="rtl"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-zinc-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
              <Bell size={20} />
            </div>
            <h2 className="text-xl font-black text-white">التنبيهات</h2>
          </div>
          <button onClick={onClose} className="p-3 bg-zinc-950 border border-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {notifications.length > 0 ? (
            notifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => !n.isRead && onMarkRead(n.id)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer group relative ${n.isRead ? 'bg-zinc-950/50 border-white/5' : 'bg-white/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5'}`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h3 className={`font-bold text-sm ${n.isRead ? 'text-zinc-300' : 'text-white'}`}>{n.title}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">{n.message}</p>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest pt-1">
                      {new Date(n.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
                    className="opacity-0 group-hover:opacity-100 p-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {!n.isRead && <div className="absolute top-4 left-4 w-2 h-2 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50"></div>}
              </div>
            ))
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-950 rounded-[2rem] flex items-center justify-center mx-auto text-zinc-800 shadow-inner">
                <BellOff size={32} />
              </div>
              <p className="text-sm font-bold text-zinc-500">لا توجد تنبيهات جديدة</p>
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
      alert('تم إرسال التنبيه للجميع بنجاح');
    } catch (err) {
      alert('فشل إرسال التنبيه');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-zinc-950/95 backdrop-blur-3xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        dir="rtl"
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-zinc-900 sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-black text-emerald-500">لوحة الإدارة</h2>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">إدارة المستخدمين والنظام</p>
          </div>
          <button onClick={onClose} className="p-4 bg-zinc-950 border border-white/5 rounded-2xl text-zinc-500 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {/* Broadcast Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                <Bell size={24} />
              </div>
              <h3 className="text-lg font-black text-white">تنبيه عام للمستخدمين</h3>
            </div>
            
            <div className="space-y-4">
              <input 
                type="text"
                placeholder="عنوان التنبيه"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500/30 transition-all font-bold"
              />
              <textarea 
                placeholder="رسالة التنبيه المرسلة لجميع المستخدمين..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={3}
                className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-amber-500/30 transition-all font-bold resize-none"
              />
              <button 
                onClick={handleBroadcast}
                disabled={sending || !broadcastTitle || !broadcastMessage}
                className="w-full py-5 bg-amber-500 text-zinc-950 font-black rounded-2xl active:scale-95 transition-all shadow-xl shadow-amber-500/10 disabled:opacity-50"
              >
                {sending ? 'جاري الإرسال...' : 'إرسال التنبيه الآن'}
              </button>
            </div>
          </div>

          <div className="w-full h-px bg-white/5"></div>

          {/* Users List Section */}
          <div className="space-y-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                  <Users size={24} />
                </div>
                <h3 className="text-lg font-black text-white">قائمة المستخدمين</h3>
              </div>
              <span className="text-[10px] font-black text-zinc-500 bg-zinc-950 px-3 py-1 rounded-full border border-white/5 uppercase">
                {users.length} مستخدم
              </span>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="py-10 text-center space-y-4">
                  <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-zinc-500 font-bold">جاري جلب بيانات المستخدمين...</p>
                </div>
              ) : (
                users.map(u => (
                  <div key={u.id} className="p-5 bg-zinc-950/50 rounded-[2rem] border border-white/5 space-y-5 hover:border-white/10 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-black text-white">{u.displayName}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">{u.email}</p>
                      </div>
                      {u.isAdmin ? (
                        <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-lg text-[10px] font-black border border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
                          <Shield size={10} />
                          MEMBER ADMIN
                        </div>
                      ) : (
                        <div className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5">
                          <UserIcon size={10} />
                          STANDARD
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        onClick={async () => {
                          const pass = prompt(`تغيير كلمة المرور للمستخدم (${u.displayName}):`);
                          if (pass && pass.length >= 6) {
                            try {
                              await api.resetUserPassword(u.id, pass);
                              alert('تم تغيير كلمة المرور بنجاح');
                            } catch (e: any) {
                              alert(e.message || 'فشلت العملية');
                            }
                          } else if (pass) {
                            alert('يجب أن تكون كلمة المرور 6 خانات على الأقل');
                          }
                        }}
                        className="flex-1 py-3 bg-zinc-900 border border-white/5 rounded-xl text-[10px] font-black text-blue-400 hover:bg-blue-400 hover:text-white transition-all active:scale-95"
                      >
                        إعادة تعيين الباسوورد
                      </button>
                      
                      {!u.isAdmin && (
                        <button 
                          onClick={async () => {
                            if (confirm(`هل أنت متأكد من حذف المستخدم "${u.displayName}" نهائياً؟ سيتم مسح جميع بياناته.`)) {
                              try {
                                await api.deleteUser(u.id);
                                loadUsers();
                                alert('تم حذف المستخدم وكافة بياناته بنجاح');
                              } catch (e: any) {
                                alert(e.message || 'فشل حذف المستخدم');
                              }
                            }
                          }}
                          className="px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
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
    } else if (type === 'transfer') {
      setCategory('transfer');
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreviewImage(base64);
      analyzeReceipt(base64);
    };
    reader.readAsDataURL(file);
  };

  const analyzeReceipt = async (base64Image: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("API Key missing");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `الرجاء تحليل صورة الفاتورة المرفقة واستخراج البيانات التالية بتنسيق JSON حصراً:
      {
        "amount": number,
        "description": "وصف مختصر للعملية",
        "category": "إحدى هذه القيم فقط: food, shopping, transport, health, fun, bills, home, other",
        "wallet": "إحدى هذه القيم فقط: cash, bank"
      }
      ملاحظات:
      - المبلغ يجب أن يكون رقماً.
      - الوصف باللغة العربية.
      - التصنيف يجب أن يكون مطابقاً للقيم الإنجليزية المذكورة.
      - إذا لم تكن العملة واضحة، افترض أنها ${appCurrency}.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1]
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              description: { type: Type.STRING },
              category: { 
                type: Type.STRING, 
                enum: ["food", "shopping", "transport", "health", "fun", "bills", "home", "other"]
              },
              wallet: { 
                type: Type.STRING, 
                enum: ["cash", "bank"]
              }
            },
            required: ["amount", "description", "category", "wallet"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      if (data.amount) setAmount(data.amount.toString());
      if (data.description) setDescription(data.description);
      if (data.category) setCategory(data.category);
      if (data.wallet) setWallet(data.wallet);
    } catch (err: any) {
      console.error("Receipt Analysis Error:", err);
      let errorMsg = "حدث خطأ أثناء تحليل الصورة. تأكد من وضوح الصورة وحاول مرة أخرى.";
      if (err.message?.includes("API_KEY_INVALID")) {
        errorMsg = "خطأ في مفتاح API. يرجى التحقق من الإعدادات.";
      }
      setAnalysisError(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
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
        <div className="relative">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 rounded-2xl border border-white/5 transition-all ${isAnalyzing ? 'bg-amber-500 text-zinc-950 animate-pulse' : 'bg-zinc-900 text-zinc-500 active:bg-zinc-800'}`}
          >
            {isAnalyzing ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-10 max-w-lg mx-auto w-full">
        {previewImage && (
          <div className="relative w-full aspect-video rounded-[2rem] overflow-hidden border border-white/10 group">
            <img src={previewImage} className="w-full h-full object-cover" alt="Receipt Preview" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                type="button"
                onClick={() => setPreviewImage(null)}
                className="bg-rose-500 p-3 rounded-full text-white shadow-xl"
              >
                <X size={20} />
              </button>
            </div>
            {isAnalyzing && (
              <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <Loader2 size={40} className="text-amber-500 animate-spin" />
                <p className="text-xs font-black text-amber-500 uppercase tracking-widest animate-pulse">جاري فحص الفاتورة بذكاء...</p>
              </div>
            )}
            {analysisError && (
              <div className="absolute inset-0 bg-rose-500/20 backdrop-blur-md flex flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="w-12 h-12 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center">
                  <X size={24} />
                </div>
                <p className="text-sm font-bold text-white leading-relaxed">{analysisError}</p>
                <button 
                  type="button"
                  onClick={() => analyzeReceipt(previewImage!)}
                  className="mt-2 px-6 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}
          </div>
        )}
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
              className="bg-zinc-900 p-5 rounded-[2rem] border border-amber-500/10 space-y-4 shadow-2xl shadow-amber-500/5 overflow-hidden"
            >
              <div className="flex gap-3">
                <div className="flex-1 relative group">
                  <input 
                    type="text"
                    inputMode="decimal"
                    placeholder="المبلغ المراد تحويله"
                    value={convertAmount}
                    onChange={(e) => {
                      const val = convertArabicNumerals(e.target.value);
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setConvertAmount(val);
                      }
                    }}
                    className="w-full bg-zinc-950 border border-white/5 p-4 rounded-2xl text-white outline-none text-lg font-black focus:border-amber-500/50 transition-all text-center placeholder:text-zinc-800 placeholder:text-sm"
                  />
                </div>
                <div className="w-24 relative">
                  <select 
                    value={convertFrom}
                    onChange={(e) => setConvertFrom(e.target.value)}
                    className="w-full h-full bg-zinc-950 border border-white/5 p-3 rounded-2xl text-white outline-none text-xs font-black appearance-none cursor-pointer text-center focus:border-amber-500/50 transition-all"
                  >
                    {['USD', 'SAR', 'EGP', 'AED', 'KWD', 'EUR', 'TRY', 'GBP'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option disabled>──────</option>
                    {Object.keys(rates).filter(c => !['USD', 'SAR', 'EGP', 'AED', 'KWD', 'EUR', 'TRY', 'GBP'].includes(c)).slice(0, 50).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                    <ChevronDown size={12} />
                  </div>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleConvert}
                className="w-full bg-amber-500 text-zinc-950 py-4 rounded-2xl font-black text-sm shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ring-4 ring-amber-500/10"
              >
                تطبيق التحويل إلى {appCurrency}
              </button>
            </motion.div>
          )}

          <div className="flex items-center justify-center gap-3">
             <input 
              type="text" 
              autoFocus
              inputMode="decimal"
              placeholder="0.00"
              className="w-full text-7xl font-black bg-transparent border-none outline-none focus:ring-0 placeholder:text-zinc-900 text-center tabular-nums text-white"
              value={amount}
              onChange={(e) => {
                const val = convertArabicNumerals(e.target.value);
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setAmount(val);
                }
              }}
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
