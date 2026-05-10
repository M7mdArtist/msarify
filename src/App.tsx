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
  Eye,
  EyeOff,
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
  Mic,
  Loader2,
  Wallet,
  Moon,
  Sun,
  Languages,
  Globe,
  Palette
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';

const convertArabicNumerals = (str: string) => {
  return str
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[٫،,]/g, ".");
};

const getDisplayCurrency = (currency: string, lang: 'ar' | 'en') => {
  if (lang === 'en') {
    if (currency === 'ر.س' || currency === 'SAR') return 'SAR';
    if (currency === 'ج.م' || currency === 'EGP') return 'EGP';
    if (currency === 'د.ك' || currency === 'KWD') return 'KWD';
    if (currency === 'د.إ' || currency === 'AED') return 'AED';
    return currency;
  } else {
    if (currency === 'SAR' || currency === 'ر.س') return 'ر.س';
    if (currency === 'EGP' || currency === 'ج.م') return 'ج.م';
    if (currency === 'KWD' || currency === 'د.ك') return 'د.ك';
    if (currency === 'AED' || currency === 'د.إ') return 'د.إ';
    return currency;
  }
};

const formatAmount = (amount: number, isPrivacyMode: boolean) => {
  if (isPrivacyMode) return '••••';
  return amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
import { ar, enUS } from 'date-fns/locale';
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

import arTranslations from './locales/ar.json';
import enTranslations from './locales/en.json';

const TRANSLATIONS: Record<'ar' | 'en', any> = {
  ar: arTranslations,
  en: enTranslations
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'analysis' | 'funds' | 'settings'>('home');
  const [showAddModal, setShowAddModal] = useState(false);
  const [appCurrency, setAppCurrency] = useState('SAR');
  
  // Settings initialization
  const [language, setLanguage] = useState<'ar' | 'en'>(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        return u.language || 'ar';
      } catch (e) {}
    }
    return 'ar';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        return u.theme || 'dark';
      } catch (e) {}
    }
    return 'dark';
  });

  const t = TRANSLATIONS[language];

  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    document.body.dir = dir;
  }, [language]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
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
  const [loans, setLoans] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [showLoanModal, setShowLoanModal] = useState<{ show: boolean, loan?: any }>({ show: false });
  const [showRepayModal, setShowRepayModal] = useState<{ show: boolean, loan?: any }>({ show: false });
  const [showRecurringModal, setShowRecurringModal] = useState<{ show: boolean, item?: any }>({ show: false });
  const [privacyMode, setPrivacyMode] = useState(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        return !!u.privacyMode;
      } catch (e) {}
    }
    return false;
  });
  
  const togglePrivacyMode = () => {
    setPrivacyMode(!privacyMode);
    if (user) {
      const updatedUser = { ...user, privacyMode: !privacyMode };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      api.saveUser(user.id, { privacyMode: !privacyMode });
    }
  };
  
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
      const results = await Promise.allSettled([
        api.getUser(user.id),
        api.getTransactions(user.id),
        api.getSubscriptions(user.id),
        api.getSnapshots(user.id),
        api.getNotifications(user.id),
        api.getLoans(user.id),
        api.getRecurring(user.id)
      ]);

      const [
        uProfileRes, 
        txsRes, 
        subsRes, 
        snapsRes, 
        noticesRes, 
        loanListRes, 
        recurringListRes
      ] = results;

      if (uProfileRes.status === 'fulfilled' && uProfileRes.value) {
        const uProfile = uProfileRes.value;
        setUserBudget(uProfile.budgetThreshold || 0);
        
        // Preserve currency if it exists in profile, otherwise use language-based default
        const profileCurrency = uProfile.currency;
        if (profileCurrency) {
          setAppCurrency(profileCurrency);
        } else {
          setAppCurrency(language === 'ar' ? 'ر.س' : 'SAR');
        }

        // Only sync settings if they differ from current state and we haven't manually updated recently
        const recentlyUpdated = Date.now() - lastSettingsUpdate < 5000;
        
        if (!recentlyUpdated) {
          if (uProfile.language && uProfile.language !== language) {
            setLanguage(uProfile.language as 'ar' | 'en');
          }
          if (uProfile.theme && uProfile.theme !== theme) {
            setTheme(uProfile.theme as 'dark' | 'light');
          }
          if (uProfile.privacyMode !== undefined && !!uProfile.privacyMode !== privacyMode) {
            setPrivacyMode(!!uProfile.privacyMode);
          }
        }

        setInitialBalances({
          cash: uProfile.initialCash || 0,
          bank: uProfile.initialBank || 0
        });
        setExtraFunds({
          emergency: uProfile.emergencyFund || 0,
          savings: uProfile.savingsFund || 0
        });
      }

      if (txsRes.status === 'fulfilled') setTransactions(txsRes.value || []);
      if (subsRes.status === 'fulfilled') setSubscriptions(subsRes.value || []);
      if (snapsRes.status === 'fulfilled') setSnapshots(snapsRes.value || []);
      if (noticesRes.status === 'fulfilled') setNotifications(noticesRes.value || []);
      if (loanListRes.status === 'fulfilled') setLoans(loanListRes.value || []);
      if (recurringListRes.status === 'fulfilled') setRecurring(recurringListRes.value || []);
    } catch (err) {
      console.error("Data refresh failed", err);
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

  const displayCurrency = React.useMemo(() => {
    return getDisplayCurrency(appCurrency, language);
  }, [appCurrency, language]);

  const trendData = React.useMemo(() => {
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(new Date(), i);
      const currentLocale = language === 'ar' ? ar : enUS;
      return {
        month: format(date, 'MMM', { locale: currentLocale }),
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
  
  const [lastSettingsUpdate, setLastSettingsUpdate] = useState(0);

  const updateSettings = async (updates: Partial<{ theme: 'dark' | 'light', language: 'ar' | 'en' }>) => {
    if (!user) return;
    
    // 1. Update LocalStorage immediately
    const updatedUser = { ...user, ...updates };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    // 2. Mark that we just manually updated settings
    setLastSettingsUpdate(Date.now());
    
    try {
      // 3. Update local state immediately for instant feedback
      if (updates.theme) setTheme(updates.theme);
      if (updates.language) setLanguage(updates.language);
      
      // 4. Save to DB
      await api.saveUser(user.id, updates);
      
      // 5. Update the user object state
      setUser(updatedUser);
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  };

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
      setAuthError(err.message || t.auth_error_default);
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }} 
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-4xl font-black text-zinc-900 dark:text-white"
        >
          {t.msarify}
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black text-zinc-900 dark:text-white">{t.msarify}</h1>
            <p className="text-zinc-500 font-medium">{t.first_step_motto}</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 space-y-6 shadow-2xl">
            <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-black/5 dark:border-white/5">
              <button 
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${authMode === 'login' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400 dark:hover:text-zinc-300'}`}
              >
                {t.login_tab}
              </button>
              <button 
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${authMode === 'signup' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400 dark:hover:text-zinc-300'}`}
              >
                {t.signup_tab}
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {authMode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">{t.noble_name}</label>
                  <input 
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder={t.name_placeholder}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-4 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-zinc-200 dark:focus:border-white/20 transition-all font-bold placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">{t.email_label}</label>
                <input 
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-4 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-zinc-200 dark:focus:border-white/20 transition-all font-bold placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">{t.password_label}</label>
                <input 
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-4 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-zinc-200 dark:focus:border-white/20 transition-all font-bold placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                />
              </div>

              {authError && (
                <p className="text-[10px] font-bold text-rose-500 px-1 text-center">{authError}</p>
              )}

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-black rounded-2xl active:scale-95 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {authLoading ? t.loading_dots : (authMode === 'login' ? t.login_tab : t.signup_tab)}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/5 dark:border-white/5"></div></div>
              <div className="relative flex justify-center text-[10px] font-black uppercase"><span className="bg-white dark:bg-zinc-900 px-4 text-zinc-500">{t.welcome_back_motto}</span></div>
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
        className="relative p-8 rounded-[3rem] overflow-hidden group shadow-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 active:scale-[0.99] transition-transform duration-500"
      >
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full -mr-64 -mt-64 animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 blur-[100px] rounded-full -ml-48 -mb-48 group-hover:bg-emerald-500/10 transition-all duration-700 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0.02),transparent)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02),transparent)] opacity-50 pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-10">
            <div className="space-y-1 text-right w-full">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">{t.total_balance}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black tabular-nums tracking-tighter text-zinc-900 dark:text-white drop-shadow-2xl">
                {formatAmount(currentTotal, privacyMode)}
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-600 mr-2">{displayCurrency}</span>
              </h2>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-zinc-50/50 dark:bg-white/[0.03] backdrop-blur-3xl p-5 rounded-[2.5rem] border border-black/5 dark:border-white/5 space-y-4 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-500 dark:text-zinc-400">
                  <Wallet size={16} />
                </div>
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{t.cash}</span>
              </div>
              <p className="text-xl font-black tabular-nums text-zinc-900 dark:text-white truncate">
                {formatAmount(walletBalances.cash, privacyMode)}
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 mr-1.5">{displayCurrency}</span>
              </p>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-zinc-50/50 dark:bg-white/[0.03] backdrop-blur-3xl p-5 rounded-[2.5rem] border border-black/5 dark:border-white/5 space-y-4 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-500 dark:text-zinc-400">
                  <Smartphone size={16} />
                </div>
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{t.bank}</span>
              </div>
              <p className="text-xl font-black tabular-nums text-zinc-900 dark:text-white truncate">
                {formatAmount(walletBalances.bank, privacyMode)}
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 mr-1.5">{displayCurrency}</span>
              </p>
            </motion.div>
          </div>

          <div className="pt-8 border-t border-black/5 dark:border-white/5 flex gap-12 justify-center">
            <div className="group cursor-help">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <div className="w-6 h-6 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform"><ArrowDownLeft size={12} /></div>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{t.income}</span>
              </div>
              <p className="text-lg font-black text-zinc-900 dark:text-white">{formatAmount(totalIncome, privacyMode)} <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-bold">{displayCurrency}</span></p>
            </div>
            
            <div className="w-px h-10 bg-black/5 dark:bg-white/5 self-center"></div>

            <div className="group cursor-help">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
                <div className="w-6 h-6 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform"><ArrowUpRight size={12} /></div>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{t.expense}</span>
              </div>
              <p className="text-lg font-black text-zinc-900 dark:text-white">{formatAmount(totalExpenses, privacyMode)} <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-bold">{displayCurrency}</span></p>
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
            <p className="text-sm font-black text-rose-200 uppercase tracking-tight">{t.budget_warning}</p>
            <p className="text-xs text-rose-500/70 font-bold">{t.budget_spent_more} {userBudget.toLocaleString()} {displayCurrency}</p>
          </div>
          <ChevronRight size={16} className="text-rose-500/30" />
        </motion.div>
      )}

      {/* Subscription Sliders */}
      <div className="space-y-4">
        <div className="flex justify-between items-center group cursor-pointer px-1">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-zinc-400 dark:text-zinc-600" />
            <h2 className="font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tighter">{t.subscriptions}</h2>
          </div>
          <button onClick={() => setShowSubscriptionModal({ show: true })} className="text-[10px] font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/5 py-1 px-3 rounded-full hover:border-zinc-200 dark:hover:border-white/20 transition-all uppercase tracking-widest">{t.manage}</button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1 -mx-1 snap-x">
          {subscriptions.length > 0 ? subscriptions.map((s) => (
            <motion.div 
              key={s.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSubscriptionModal({ show: true, sub: s })}
              className="min-w-[160px] snap-center glass p-5 rounded-[2rem] space-y-4 cursor-pointer hover:border-black/10 dark:hover:border-white/20 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 font-bold text-lg shadow-inner">{s.name[0]}</div>
              <div>
                <p className="text-sm font-black text-zinc-900 dark:text-white">{s.name}</p>
                <p className="text-[10px] text-zinc-500 font-bold">{t.every_month}</p>
              </div>
              <div className="pt-2 flex justify-between items-end">
                <span className="text-sm font-black text-zinc-900 dark:text-white">{formatAmount(s.amount, privacyMode)} <span className="text-[9px] opacity-40 font-bold uppercase">{displayCurrency}</span></span>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-400/10 px-2 py-0.5 rounded-md">{t.day} {new Date(s.nextBillingDate).getDate()}</span>
              </div>
            </motion.div>
          )) : (
            <div className="w-full glass p-8 rounded-[2rem] text-center space-y-3">
              <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-950 rounded-2xl flex items-center justify-center mx-auto text-zinc-400 dark:text-zinc-800 shadow-inner"><CreditCard size={20} /></div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-bold">{t.no_subscriptions}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent History */}
      <div className="space-y-6 pb-12">
        <div className="flex justify-between items-center group px-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-zinc-500 border border-black/5 dark:border-white/5">
              <ArrowRightLeft size={14} />
            </div>
            <h2 className="font-black text-zinc-900 dark:text-white uppercase tracking-tighter text-lg">{t.recent_transactions}</h2>
          </div>
          <button 
            onClick={() => setShowAllTransactions(true)} 
            className="text-[9px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-100/50 dark:bg-zinc-900/50 px-3 py-1.5 rounded-full border border-black/5 dark:border-white/5 hover:border-zinc-200 dark:hover:border-white/10 active:bg-zinc-200 dark:active:bg-zinc-800 transition-all"
          >
            {t.view_all}
          </button>
        </div>
        <div className="space-y-4">
        {transactions.length > 0 ? transactions.slice(0, 5).map((tx, i) => {
            const category = CATEGORIES[tx.category];
            const isExpense = tx.type === 'expense';
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={tx.id}
                className="bg-white dark:bg-white/[0.02] backdrop-blur-3xl p-4 rounded-[2rem] flex items-center gap-4 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-all border border-black/5 dark:border-white/5 group shadow-sm"
              >
                <div className={`w-14 h-14 rounded-[1.25rem] ${category.color} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 relative overflow-hidden`}>
                   <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <category.icon size={24} className="relative z-10" />
                </div>
                <div className={`flex-1 min-w-0 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  <p className="font-black text-sm text-zinc-900 dark:text-white truncate mb-0.5 tracking-tight">{tx.description}</p>
                  <div className="flex items-center justify-end gap-2 text-zinc-400 dark:text-zinc-500">
                    <span className="text-[9px] font-bold uppercase tracking-wider">{t[WALLET_LABELS[tx.wallet]]}</span>
                    <div className="w-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
                    <span className="text-[9px] font-bold uppercase tracking-wider">{new Date(tx.date).toLocaleDateString(language === 'ar' ? 'ar' : 'en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
                <div className={`text-lg font-black tabular-nums ${isExpense ? 'text-zinc-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'} pr-1`}>
                  <span className="text-xs opacity-50 ml-1">{isExpense ? '-' : '+'}</span>
                  {formatAmount(tx.amount, privacyMode)}
                </div>
              </motion.div>
            );
          }) : (
            <div className="text-center py-16 bg-zinc-100/50 dark:bg-white/[0.02] rounded-[3rem] border border-dashed border-black/10 dark:border-white/5 space-y-4">
              <div className="w-20 h-20 bg-white dark:bg-zinc-950 rounded-[2.5rem] flex items-center justify-center mx-auto text-zinc-300 dark:text-zinc-900 shadow-inner group border border-black/5 dark:border-transparent">
                <LayoutDashboard size={40} className="group-hover:scale-110 transition-transform" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-tight">{t.no_transactions}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-700 font-bold uppercase tracking-widest">{t.start_first_tx}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 font-sans bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100" dir={language === 'ar' ? 'rtl' : 'ltr'}>
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
                    title: t.welcome_notif_title,
                    message: t.welcome_notif_desc,
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
            t={t}
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
            language={language}
            t={t}
          />
        )}
        {showAdminPanel && (
          <AdminPanel 
            onClose={() => setShowAdminPanel(false)}
            language={language}
            t={t}
          />
        )}
      </AnimatePresence>

      <header className="px-6 py-10 flex justify-between items-center sticky top-0 z-40 bg-zinc-50/60 dark:bg-zinc-950/60 backdrop-blur-3xl border-b border-black/5 dark:border-white/5 safe-top">
        <div className="space-y-0.5">
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase leading-tight italic">
            {t.msarify}
          </h1>
          <div className="flex items-center gap-2 pr-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.25em]">{user.displayName}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePrivacyMode}
            title={t.privacy_mode}
            className="p-3 bg-zinc-200 dark:bg-white/[0.03] backdrop-blur-3xl rounded-2xl text-zinc-500 dark:text-zinc-400 border border-black/5 dark:border-white/10 transition-all hover:bg-zinc-300 dark:hover:bg-white/[0.07] hover:text-zinc-900 dark:hover:text-white"
          >
            {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotificationsModal(true)}
            className="p-3 bg-zinc-200 dark:bg-white/[0.03] backdrop-blur-3xl rounded-2xl text-zinc-500 dark:text-zinc-400 relative border border-black/5 dark:border-white/10 transition-all hover:bg-zinc-300 dark:hover:bg-white/[0.07] hover:text-zinc-900 dark:hover:text-white"
          >
            <Bell size={20} />
            {notifications.filter(n => !n.isRead).length > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-zinc-50 dark:border-zinc-950"></span>
            )}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="p-3 bg-zinc-200 dark:bg-white/[0.03] backdrop-blur-3xl rounded-2xl text-zinc-500 dark:text-zinc-400 border border-black/5 dark:border-white/10 transition-all hover:bg-zinc-300 dark:hover:bg-white/[0.07] hover:text-rose-400"
          >
            <LogOut size={20} />
          </motion.button>
        </div>
      </header>

      <main className="p-4 space-y-10 max-w-lg mx-auto pb-32">
        {activeTab === 'home' && <DashboardTab />}

        {activeTab === 'analysis' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold px-1 text-zinc-900 dark:text-white">{t.analysis}</h2>
            
            <div className="aspect-square bg-white dark:bg-zinc-900 rounded-[3rem] p-8 shadow-2xl flex flex-col items-center justify-center border border-black/5 dark:border-white/5 relative overflow-hidden">
               <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-black/0 via-black/5 to-black/0 dark:from-white/0 dark:via-white/5 dark:to-white/0"></div>
               <ResponsiveContainer width="100%" height="80%">
                 <RechartsPieChart>
                   <Pie
                    data={transactions.filter(tx => tx.type === 'expense').reduce((acc, curr) => {
                      const translatedName = t[CATEGORIES[curr.category].label] || curr.category;
                      const idx = acc.findIndex(i => i.name === translatedName);
                      if (idx > -1) acc[idx].value += curr.amount;
                      else acc.push({ name: translatedName, value: curr.amount });
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
                      <Cell key={`cell-${index}`} fill={['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 7]} cornerRadius={12} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: theme === 'dark' ? '#18181b' : '#fff', 
                      borderRadius: '24px', 
                      border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)', 
                      direction: language === 'ar' ? 'rtl' : 'ltr', 
                      textAlign: language === 'ar' ? 'right' : 'left',
                      color: theme === 'dark' ? '#fff' : '#18181b',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#fff' : '#18181b' }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{t.total_expense}</p>
                  <p className="text-base sm:text-lg font-black text-zinc-900 dark:text-white text-center break-words max-w-[100px]">
                    {formatAmount(totalExpenses, privacyMode)}
                    <span className="text-[9px] opacity-40 mr-1">{displayCurrency}</span>
                  </p>
                </div>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-8 border border-black/5 dark:border-white/5 space-y-6 shadow-xl">
              <div className="px-2">
                <h3 className="text-lg font-black text-zinc-900 dark:text-white">{t.analysis_budget_moves}</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{t.last_6_months}</p>
              </div>
              
              <div className={`h-64 w-full ${privacyMode ? 'blur-xl pointer-events-none select-none' : ''}`}>
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} 
                      dy={10}
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#18181b' : '#fff', 
                        borderRadius: '20px', 
                        border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)', 
                        direction: language === 'ar' ? 'rtl' : 'ltr',
                        textAlign: language === 'ar' ? 'right' : 'left',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                      }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: theme === 'dark' ? '#fff' : '#18181b' }}
                      formatter={(val: any) => [formatAmount(val, privacyMode) + ` ${displayCurrency}`, '']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorIncome)" 
                      name={t.income}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expense" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorExpense)" 
                      name={t.expense}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></div>
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t.income}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50"></div>
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t.expense}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
               <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-xl flex items-center justify-center mb-4"><ArrowDownLeft size={20} /></div>
                  <p className="text-xs font-bold text-zinc-500 uppercase">{t.necessities}</p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{necessityPct}%</p>
               </div>
               <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
                  <div className="w-10 h-10 bg-rose-500/10 text-rose-600 dark:text-rose-500 rounded-xl flex items-center justify-center mb-4"><ArrowUpRight size={20} /></div>
                  <p className="text-xs font-bold text-zinc-500 uppercase">{t.luxuries}</p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{luxuryPct}%</p>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'funds' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20 px-1">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t.funds}</h2>
            
            <div className="grid gap-6">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowFundModal(true)}
                className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-amber-500/10 dark:border-amber-500/20 relative overflow-hidden group cursor-pointer shadow-xl shadow-amber-500/[0.02]"
              >
                <div className="absolute top-0 right-0 p-8 text-amber-500/5 dark:text-amber-500/10 group-hover:text-amber-500/10 dark:group-hover:text-amber-500/20 transition-colors pointer-events-none">
                  <Shield size={120} />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-2xl flex items-center justify-center">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white">{t.emergency_fund}</h3>
                    <p className="text-xs text-zinc-500">{t.emergency_desc}</p>
                  </div>
                  <p className="text-4xl font-black text-zinc-900 dark:text-white tabular-nums">
                    {formatAmount(walletBalances.emergency, privacyMode)} <span className="text-sm font-bold text-zinc-500">{displayCurrency}</span>
                  </p>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowFundModal(true)}
                className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border border-indigo-500/10 dark:border-indigo-500/20 relative overflow-hidden group cursor-pointer shadow-xl shadow-indigo-500/[0.02]"
              >
                <div className="absolute top-0 right-0 p-8 text-indigo-500/5 dark:text-indigo-500/10 group-hover:text-indigo-500/10 dark:group-hover:text-indigo-500/20 transition-colors pointer-events-none">
                  <TrendingUp size={120} />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 rounded-2xl flex items-center justify-center">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white">{t.savings_fund}</h3>
                    <p className="text-xs text-zinc-500">{t.savings_desc}</p>
                  </div>
                  <p className="text-4xl font-black text-zinc-900 dark:text-white tabular-nums">
                    {formatAmount(walletBalances.savings, privacyMode)} <span className="text-sm font-bold text-zinc-500">{displayCurrency}</span>
                  </p>
                </div>
              </motion.div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-lg font-black text-zinc-900 dark:text-white italic">{t.loans}</h3>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowLoanModal({ show: true })}
                  className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                >
                  {t.add_loan}
                </motion.button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 p-4 rounded-3xl border border-emerald-500/10">
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">{t.total_lent}</p>
                  <p className="text-xl font-black text-zinc-900 dark:text-white mt-1">
                    {formatAmount(loans.filter(l => l.type === 'lent' && l.status !== 'paid').reduce((acc, curr) => acc + curr.remainingAmount, 0), privacyMode)}
                    <span className="text-[10px] opacity-40 ml-1">{displayCurrency}</span>
                  </p>
                </div>
                <div className="bg-rose-500/5 p-4 rounded-3xl border border-rose-500/10">
                  <p className="text-[10px] font-black text-rose-600 dark:text-rose-500 uppercase tracking-widest">{t.total_borrowed}</p>
                  <p className="text-xl font-black text-zinc-900 dark:text-white mt-1">
                    {formatAmount(loans.filter(l => l.type === 'borrowed' && l.status !== 'paid').reduce((acc, curr) => acc + curr.remainingAmount, 0), privacyMode)}
                    <span className="text-[10px] opacity-40 ml-1">{displayCurrency}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {loans.filter(l => l.status !== 'paid').length === 0 ? (
                  <div className="py-10 text-center space-y-2 opacity-50 bg-zinc-100 dark:bg-white/[0.02] rounded-[3rem] border border-zinc-200 dark:border-white/5">
                    <p className="text-xs font-black uppercase tracking-widest">{t.no_loans}</p>
                  </div>
                ) : (
                  loans.filter(l => l.status !== 'paid').map(loan => (
                    <motion.div 
                      key={loan.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white dark:bg-zinc-900 p-5 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${loan.type === 'lent' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {loan.type === 'lent' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-zinc-900 dark:text-white">{loan.personName}</h4>
                            <p className="text-[10px] font-bold text-zinc-500 leading-none">{loan.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-zinc-900 dark:text-white tabular-nums">
                            {formatAmount(loan.remainingAmount, privacyMode)}
                            <span className="text-[10px] opacity-40 ml-1">{displayCurrency}</span>
                          </p>
                          <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">{t.due_date}: {new Date(loan.dueDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest opacity-40">
                          <span>{t.amount_remaining}</span>
                          <span>{Math.round(((loan.amount - loan.remainingAmount) / loan.amount) * 100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${((loan.amount - loan.remainingAmount) / loan.amount) * 100}%` }}
                            className={`h-full ${loan.type === 'lent' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowRepayModal({ show: true, loan })}
                          className="flex-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                        >
                          {t.repay}
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm(t.delete_user_confirm)) {
                              api.deleteLoan(loan.id).then(refreshData);
                            }
                          }}
                          className="px-4 bg-rose-500/10 text-rose-500 rounded-xl"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-lg font-black text-zinc-900 dark:text-white italic">{t.recurring_tx}</h3>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowRecurringModal({ show: true })}
                  className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                >
                  {t.add_recurring}
                </motion.button>
              </div>

              <div className="space-y-3">
                {recurring.length === 0 ? (
                  <div className="py-10 text-center space-y-2 opacity-50 bg-zinc-100 dark:bg-white/[0.02] rounded-[3rem] border border-zinc-200 dark:border-white/5">
                    <p className="text-xs font-black uppercase tracking-widest">{t.no_recurring}</p>
                  </div>
                ) : (
                  recurring.map(item => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white dark:bg-zinc-900 p-5 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {item.type === 'income' ? <TrendingUp size={20} /> : <CreditCard size={20} />}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-zinc-900 dark:text-white">{item.description}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{t[item.frequency]}</span>
                              <span className="w-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                              <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{t[WALLET_LABELS[item.wallet]]}</span>
                              <span className="w-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                              <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${item.autoProcess ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {item.autoProcess ? t.auto_confirm : t.manual_confirm}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setShowRecurringModal({ show: true, item })}
                            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                          >
                            <Settings size={16} />
                          </button>
                          <div className="text-right">
                            <p className="text-lg font-black text-zinc-900 dark:text-white tabular-nums">
                              {formatAmount(item.amount, privacyMode)}
                              <span className="text-[10px] opacity-40 ml-1">{displayCurrency}</span>
                            </p>
                          </div>
                          <button 
                            onClick={() => {
                              if (confirm(t.delete_user_confirm)) {
                                api.deleteRecurring(item.id).then(refreshData);
                              }
                            }}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <button 
                        onClick={async () => {
                          try {
                            await api.addTransaction({
                              id: crypto.randomUUID(),
                              amount: item.amount,
                              description: item.description,
                              category: item.category,
                              type: item.type,
                              wallet: item.wallet,
                              date: new Date().toISOString(),
                              userId: user.id
                            });
                            refreshData();
                            alert(language === 'ar' ? 'تم تسجيل العملية بنجاح' : 'Transaction recorded successfully');
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="w-full mt-4 py-2 bg-zinc-50 dark:bg-white/5 text-zinc-900 dark:text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                      >
                        {t.confirm_transaction}
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 pb-32">
            {/* Profile Header */}
            <div className="relative px-2 pt-4">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-indigo-500/20">
                    {user?.displayName?.[0] || 'U'}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-zinc-950 rounded-full shadow-lg"></div>
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight italic">{user?.displayName}</h2>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-black uppercase tracking-[0.25em]">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Appearance Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1 text-zinc-500 dark:text-zinc-700 uppercase tracking-widest text-[10px] font-black">
                <Palette size={12} />
                <h3>{t.appearance}</h3>
              </div>
              <div className="bg-zinc-100 dark:bg-white/[0.02] backdrop-blur-3xl rounded-[2.5rem] border border-zinc-200 dark:border-white/5 p-2 flex relative">
                <div className="absolute inset-2 flex pointer-events-none">
                  <motion.div 
                    animate={{ 
                      x: theme === 'light' 
                        ? (language === 'ar' ? '-100%' : '100%') 
                        : '0%' 
                    }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    className="h-full w-1/2 bg-white dark:bg-white/10 rounded-3xl shadow-xl border border-black/5 dark:border-white/10"
                  />
                </div>
                <button 
                  onClick={() => updateSettings({ theme: 'dark' })}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 relative z-10 transition-colors duration-500 font-black uppercase tracking-widest text-xs ${theme === 'dark' ? 'text-zinc-950 dark:text-white' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-900'}`}
                >
                  <Moon size={18} strokeWidth={theme === 'dark' ? 2.5 : 2} />
                  <span className="mt-0.5">{t.dark}</span>
                </button>
                <button 
                  onClick={() => updateSettings({ theme: 'light' })}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 relative z-10 transition-colors duration-500 font-black uppercase tracking-widest text-xs ${theme === 'light' ? 'text-zinc-950 dark:text-white' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-900'}`}
                >
                  <Sun size={18} strokeWidth={theme === 'light' ? 2.5 : 2} />
                  <span className="mt-0.5">{t.light}</span>
                </button>
              </div>
            </section>

            {/* Localization Bento Box */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-zinc-100 dark:bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] border border-zinc-200 dark:border-white/5 p-8 flex flex-col gap-8 relative overflow-hidden group">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-200 dark:border-white/5">
                        <Languages size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-zinc-900 dark:text-white italic tracking-tighter">{t.language}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-bold uppercase tracking-widest">{language === 'ar' ? 'العربية' : 'English'}</p>
                </div>
              </div>
              <div className="flex bg-white dark:bg-zinc-950/80 p-1.5 rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm relative z-10">
                <button 
                   onClick={() => updateSettings({ language: 'ar' })}
                   className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all relative z-10 ${language === 'ar' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-lg' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-900'}`}
                >
                  {language === 'ar' ? 'عربي' : 'AR'}
                </button>
                <button 
                   onClick={() => updateSettings({ language: 'en' })}
                   className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all relative z-10 ${language === 'en' ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-lg' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-900'}`}
                >
                  {language === 'ar' ? 'إنجليزي' : 'EN'}
                </button>
              </div>
                 </div>

                 <div className="h-px bg-zinc-200 dark:bg-white/5 mx-2"></div>

                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-200 dark:border-white/5">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-zinc-900 dark:text-white italic tracking-tighter">{t.currency}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-bold uppercase tracking-widest">{displayCurrency}</p>
                      </div>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowMasterBalanceModal(true)}
                      className="w-12 h-12 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-2xl flex items-center justify-center shadow-xl"
                    >
                      <Plus size={20} strokeWidth={3} />
                    </motion.button>
                 </div>
              </div>
            </div>

            {/* Siri Card */}
            <section className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[3rem] p-8 space-y-6 relative overflow-hidden group shadow-2xl shadow-indigo-500/20 active:scale-[0.98] transition-transform">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -translate-y-20 translate-x-20 pointer-events-none"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-[1.5rem] flex items-center justify-center text-white border border-white/20">
                  <Smartphone size={28} />
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-white text-lg tracking-tighter italic leading-tight">{t.siri}</h4>
                  <p className="text-[10px] text-white/50 font-black uppercase tracking-[0.2em]">{t.siri_desc}</p>
                </div>
              </div>

              <div className="p-6 bg-black/20 backdrop-blur-3xl rounded-[2rem] border border-white/10 space-y-4 relative z-10 shadow-inner">
                <p className="text-[9px] text-white/40 font-black uppercase tracking-[0.3em] text-center">{t.siri_key}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-black/20 py-4 px-4 rounded-xl text-center font-mono text-[10px] text-indigo-200 border border-white/5 truncate">
                    {user?.siriToken || t.no_key}
                  </div>
                  {user?.siriToken && (
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        navigator.clipboard.writeText(user.siriToken);
                        alert(t.copy_success);
                      }}
                      className="w-12 h-12 bg-white text-zinc-950 rounded-xl flex items-center justify-center shadow-2xl"
                    >
                      <CreditCard size={18} />
                    </motion.button>
                  )}
                </div>
              </div>

              <motion.button 
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
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
                className="w-full py-5 bg-white text-indigo-600 font-black rounded-[2rem] shadow-2xl relative z-10 transition-all text-sm italic tracking-tight"
              >
                {user?.siriToken ? t.renew_key : t.generate_key}
              </motion.button>
            </section>

            {/* Help Grid */}
            <div className="grid grid-cols-2 gap-4">
               <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowTutorial(true)}
                className="bg-zinc-100 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 p-6 rounded-[2.5rem] flex flex-col items-center gap-4 group"
               >
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-[1.5rem] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Info size={28} />
                  </div>
                  <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">{t.tutorial}</span>
               </motion.button>
               <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowInstallGuide(true)}
                className="bg-zinc-100 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 p-6 rounded-[2.5rem] flex flex-col items-center gap-4 group"
               >
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-[1.5rem] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Smartphone size={28} />
                  </div>
                  <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">{t.install_guide}</span>
               </motion.button>
            </div>

            {/* Security Section */}
            <section className="bg-zinc-100 dark:bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] border border-zinc-200 dark:border-white/5 p-8 space-y-8 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-400">
                  <Lock size={18} />
                </div>
                <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest">{t.security}</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <input 
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 p-5 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-indigo-500/50 transition-all font-mono text-xs placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                      placeholder={t.current_password}
                    />
                  </div>
                  <div className="relative">
                    <input 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-white/5 p-5 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-indigo-500/50 transition-all font-mono text-xs placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                      placeholder={t.new_password}
                    />
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      if (!oldPassword || !newPassword) return;
                      setChangingPassword(true);
                      try {
                        await api.changePassword(user!.id, oldPassword, newPassword);
                        setOldPassword('');
                        setNewPassword('');
                        alert(t.password_success);
                      } catch (err: any) {
                        alert(err.message || t.password_fail);
                      } finally {
                        setChangingPassword(false);
                      }
                    }}
                    disabled={changingPassword || !oldPassword || !newPassword}
                    className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 py-5 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl hover:scale-[1.02]"
                  >
                    {changingPassword ? t.updating : t.update_password}
                  </motion.button>
                </div>
              </div>
            </section>

            {/* Admin Panel (if applicable) */}
            {!!user?.isAdmin && (
              <section className="bg-emerald-500/5 rounded-[3rem] border border-emerald-500/20 p-8 space-y-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[60px] -translate-y-10 translate-x-10 pointer-events-none"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-500 border border-emerald-500/20">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-zinc-900 dark:text-white italic tracking-tighter">{t.admin_panel}</h4>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-500/50 font-bold uppercase tracking-widest">{t.admin_desc}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAdminPanel(true)}
                  className="w-full bg-emerald-500 text-white py-5 rounded-[2rem] font-black text-sm relative z-10 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  {t.open_admin}
                </button>
              </section>
            )}

            {/* Danger Zone */}
            <section className="bg-rose-500/5 backdrop-blur-3xl rounded-[3rem] border border-rose-500/20 p-8 space-y-8 relative overflow-hidden group">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 transition-colors group-hover:bg-rose-500 group-hover:text-white">
                    <Trash2 size={18} />
                  </div>
                  <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest">{t.reset_data}</h3>
               </div>
               
               <div className="space-y-6">
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold leading-relaxed">{t.reset_desc}</p>
                  
                  {!isResetConfirming ? (
                    <button 
                      onClick={() => setIsResetConfirming(true)}
                      className="w-full py-5 bg-rose-500/5 text-rose-500 border border-rose-500/20 font-black rounded-[2rem] text-xs hover:bg-rose-500/10 transition-all uppercase tracking-widest"
                    >
                      {t.reset_data}
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button 
                        onClick={handleResetData}
                        className="flex-[2] py-5 bg-rose-500 text-white font-black rounded-[2rem] animate-pulse text-xs uppercase tracking-widest shadow-xl shadow-rose-500/20"
                      >
                        {t.confirm_reset}
                      </button>
                      <button 
                        onClick={() => setIsResetConfirming(false)}
                        className="flex-1 py-5 bg-zinc-200 dark:bg-zinc-900 text-zinc-500 font-bold rounded-[2rem] text-xs uppercase tracking-widest border border-zinc-300 dark:border-white/5"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  )}
               </div>
            </section>

            {/* Logout Footer */}
            <div className="pt-4 border-t border-white/5">
              <button 
                onClick={handleLogout}
                className="w-full py-8 flex items-center justify-center gap-3 text-zinc-600 hover:text-white transition-colors group"
              >
                <div className="p-2 bg-zinc-900 rounded-lg group-hover:bg-rose-500/10 group-hover:text-rose-500 transition-colors">
                  <LogOut size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">{t.logout}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <div className="fixed bottom-8 left-6 right-6 z-40 lg:max-w-lg lg:mx-auto">
        <nav className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-3xl rounded-[3rem] border border-black/5 dark:border-white/5 py-4 px-6 flex justify-between items-center shadow-[0_25px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === 'home' ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'}`}
          >
            <LayoutDashboard size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{activeTab === 'home' && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-zinc-900 dark:bg-white rounded-full absolute -top-2" />}{t.home}</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === 'analysis' ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'}`}
          >
            <PieChart size={22} strokeWidth={activeTab === 'analysis' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{activeTab === 'analysis' && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-zinc-900 dark:bg-white rounded-full absolute -top-2" />}{t.analysis}</span>
          </button>

          <div className="relative -mt-16">
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowAddModal(true)}
              className="bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 p-5 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_40px_rgba(255,255,255,0.15)] ring-[10px] ring-zinc-50 dark:ring-zinc-950 transition-all"
            >
              <Plus size={28} strokeWidth={3} />
            </motion.button>
          </div>

          <button 
            onClick={() => setActiveTab('funds')}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === 'funds' ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'}`}
          >
            <Shield size={22} strokeWidth={activeTab === 'funds' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{activeTab === 'funds' && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-zinc-900 dark:bg-white rounded-full absolute -top-2" />}{t.funds}</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === 'settings' ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'}`}
          >
            <Settings size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">{activeTab === 'settings' && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-zinc-900 dark:bg-white rounded-full absolute -top-2" />}{t.settings}</span>
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
            t={t}
            language={language}
            privacyMode={privacyMode}
          />
        )}
        {showSubscriptionModal.show && (
          <SubscriptionManagerModal
            user={user}
            subscription={showSubscriptionModal.sub}
            onClose={() => setShowSubscriptionModal({ show: false })}
            onRefresh={refreshData}
            t={t}
            privacyMode={privacyMode}
          />
        )}
        {showAllTransactions && (
          <AllTransactionsModal
            transactions={transactions}
            onClose={() => setShowAllTransactions(false)}
            appCurrency={appCurrency}
            language={language}
            t={t}
            privacyMode={privacyMode}
          />
        )}
        {viewingSnapshot && (
          <SnapshotDetailModal
            snapshot={viewingSnapshot}
            onClose={() => setViewingSnapshot(null)}
            appCurrency={appCurrency}
            language={language}
            t={t}
            privacyMode={privacyMode}
          />
        )}
        {showFundModal && (
          <FundManagerModal
            user={user}
            extraFunds={extraFunds}
            appCurrency={appCurrency}
            onClose={() => setShowFundModal(false)}
            onRefresh={refreshData}
            t={t}
            language={language}
            privacyMode={privacyMode}
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
            t={t}
            language={language}
            privacyMode={privacyMode}
          />
        )}
        {showLoanModal.show && (
          <LoanModal 
            user={user}
            loan={showLoanModal.loan}
            onClose={() => setShowLoanModal({ show: false })}
            onRefresh={refreshData}
            t={t}
            language={language}
            privacyMode={privacyMode}
          />
        )}
        {showRepayModal.show && showRepayModal.loan && (
          <RepayModal 
            user={user}
            loan={showRepayModal.loan}
            onClose={() => setShowRepayModal({ show: false })}
            onRefresh={refreshData}
            t={t}
            language={language}
            privacyMode={privacyMode}
          />
        )}
        {showRecurringModal.show && (
          <RecurringModal 
            user={user}
            item={showRecurringModal.item}
            onClose={() => setShowRecurringModal({ show: false })}
            onRefresh={refreshData}
            t={t}
            language={language}
            privacyMode={privacyMode}
          />
        )}
        {showInstallGuide && (
          <InstallGuideModal user={user} onClose={() => setShowInstallGuide(false)} t={t} />
        )}
      </AnimatePresence>
    </div>
  );
}

function InstallGuideModal({ user, onClose, t }: { user: any, onClose: () => void, t: any }) {
  const [activeTab, setActiveTab] = useState<'iphone' | 'siri'>('iphone');

  const iphoneSteps = [
    {
      title: t.iphone_step1_title,
      desc: t.iphone_step1_desc,
      img: "/iphone-step1.png"
    },
    {
      title: t.iphone_step2_title,
      desc: t.iphone_step2_desc,
      img: "/iphone-step2.png"
    },
    {
      title: t.iphone_step3_title,
      desc: t.iphone_step3_desc,
      img: "/iphone-step3.png"
    }
  ];

  const siriSteps = [
    {
      title: t.siri_step1_title,
      desc: t.siri_step1_desc
    },
    {
      title: t.siri_step2_title,
      desc: t.siri_step2_desc
    },
    {
      title: t.siri_step3_title,
      desc: (t.siri_step3_desc || "") + window.location.origin + "/api/quick-add"
    },
    {
      title: t.siri_step4_title,
      desc: t.siri_step4_desc
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[3rem] overflow-hidden shadow-2xl balance-modal-h">
        <div className="p-8 space-y-8 h-full overflow-y-auto">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">{t.install_guide_title || t.install_guide}</h2>
            <button onClick={onClose} className="w-10 h-10 bg-zinc-100 dark:bg-white/5 rounded-full flex items-center justify-center text-zinc-400 font-bold"><X size={20} /></button>
          </div>

          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-black/5 dark:border-white/5">
            <button 
              onClick={() => setActiveTab('iphone')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${activeTab === 'iphone' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-lg' : 'text-zinc-500'}`}
            >
              <Smartphone size={14} />
              {t.iphone_tab || t.iphone_app}
            </button>
            <button 
              onClick={() => setActiveTab('siri')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${activeTab === 'siri' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-lg' : 'text-zinc-500'}`}
            >
              <Mic size={14} />
              {t.siri_app || t.siri}
            </button>
          </div>

          <div className="space-y-6">
            {(activeTab === 'iphone' ? iphoneSteps : siriSteps).map((step: any, i: number) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-zinc-50 dark:bg-zinc-950/50 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 flex gap-5 items-center"
              >
                <div className="w-12 h-12 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-lg">
                  {i + 1}
                </div>
                <div>
                  <h4 className="text-zinc-900 dark:text-white font-black text-sm mb-1">{step.title}</h4>
                  <p className="text-[10px] text-zinc-500 font-bold leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {activeTab === 'siri' && (
            <div className="bg-indigo-600 rounded-[2.5rem] p-8 space-y-6 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-[60px] -translate-y-10 translate-x-10 pointer-events-none"></div>
               <div className="relative z-10 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest opacity-60">{t.siri_key}</p>
                    <p className="font-mono text-xl font-bold tracking-widest">{user?.siriToken || '••••••••'}</p>
                  </div>
                  <button 
                    onClick={() => {
                       if (user?.siriToken) {
                         navigator.clipboard.writeText(user.siriToken);
                         alert(t.copy_success);
                       }
                    }}
                    className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 font-bold"
                  >
                    <CreditCard size={20} />
                  </button>
               </div>
            </div>
          )}

          <button 
            onClick={onClose}
            className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-black rounded-2xl shadow-xl active:scale-[0.98] transition-all"
          >
            {t.done}
          </button>
        </div>
      </div>
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
  onOpenAdmin,
  t,
  language,
  privacyMode
}: { 
  user: any, 
  appCurrency: string,
  initialBalances: { cash: number, bank: number },
  extraFunds: { emergency: number, savings: number },
  onUpdateCurrency: (c: string) => Promise<void>,
  onClose: () => void,
  onRefresh: () => void,
  onOpenAdmin: () => void,
  t: any,
  language: 'ar' | 'en',
  privacyMode: boolean
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
      className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 z-[100] flex flex-col p-6 overflow-y-auto"
      dir={t.dir || (language === 'ar' ? 'rtl' : 'ltr')}
    >
      <div className="flex justify-between items-center mb-10 sticky top-0 bg-zinc-50 dark:bg-zinc-950 z-10 py-2">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">{t.accounts_management}</h2>
          <p className="text-xs text-zinc-500 font-bold">{t.accounts_management_desc}</p>
        </div>
        <button onClick={onClose} className="bg-zinc-200 dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-3 rounded-2xl text-zinc-500 active:bg-zinc-300 dark:active:bg-zinc-800">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-10 flex-1 max-w-md mx-auto w-full">
        {/* Currency Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.default_currency}</label>
          <div className="grid grid-cols-4 gap-3">
            {['ر.س', 'ج.م', 'AED', 'KWD', 'USD', 'EUR', 'GBP', 'TRY'].map((cur) => (
              <button
                key={cur}
                onClick={() => onUpdateCurrency(cur)}
                className={`py-4 rounded-2xl text-[10px] font-black border transition-all shadow-sm ${appCurrency === cur ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 border-transparent shadow-lg' : 'bg-white dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 border-black/5 dark:border-white/5 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
              >
                {getDisplayCurrency(cur, language)}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-amber-500 font-bold px-1 italic">{t.currency_note}</p>
        </div>

        {/* Spendable Balances */}
        <div className="space-y-6">
          <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.spendable_balances}</label>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 space-y-4 shadow-sm">
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase">{t.personal_cash}</span>
                 <Wallet size={16} className="text-zinc-400" />
               </div>
               <div className="flex items-center gap-3">
                 <input 
                  type={privacyMode ? "password" : "text"}
                  inputMode="decimal"
                  value={cash}
                  onChange={(e) => {
                    const val = convertArabicNumerals(e.target.value);
                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setCash(val);
                    }
                  }}
                  className="bg-transparent text-3xl font-black text-zinc-900 dark:text-white outline-none w-full"
                 />
                 <span className="text-lg font-bold text-zinc-400 dark:text-zinc-600">{getDisplayCurrency(appCurrency, language)}</span>
               </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 space-y-4 shadow-sm">
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase">{t.bank_balance}</span>
                 <Smartphone size={16} className="text-zinc-400" />
               </div>
               <div className="flex items-center gap-3">
                 <input 
                  type={privacyMode ? "password" : "text"}
                  inputMode="decimal"
                  value={bank}
                  onChange={(e) => {
                    const val = convertArabicNumerals(e.target.value);
                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setBank(val);
                    }
                  }}
                  className="bg-transparent text-3xl font-black text-zinc-900 dark:text-white outline-none w-full"
                 />
                 <span className="text-lg font-bold text-zinc-400 dark:text-zinc-600">{getDisplayCurrency(appCurrency, language)}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Funds Balances */}
        <div className="space-y-6">
          <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.funds_management}</label>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-amber-500/10 dark:border-amber-500/20 space-y-4 shadow-sm">
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-amber-500 uppercase">{t.emergency_fund_label}</span>
                 <Shield size={16} className="text-amber-500" />
               </div>
               <div className="flex items-center gap-3">
                 <input 
                  type={privacyMode ? "password" : "text"}
                  inputMode="decimal"
                  value={emergency}
                  onChange={(e) => {
                    const val = convertArabicNumerals(e.target.value);
                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setEmergency(val);
                    }
                  }}
                  className="bg-transparent text-3xl font-black text-amber-600 dark:text-amber-500 outline-none w-full"
                 />
                 <span className="text-lg font-bold text-amber-500/30">{getDisplayCurrency(appCurrency, language)}</span>
               </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-indigo-500/10 dark:border-indigo-500/20 space-y-4 shadow-sm">
               <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-indigo-500 uppercase">{t.savings_fund_label}</span>
                 <TrendingUp size={16} className="text-indigo-500" />
               </div>
               <div className="flex items-center gap-3">
                 <input 
                  type={privacyMode ? "password" : "text"}
                  inputMode="decimal"
                  value={savings}
                  onChange={(e) => {
                    const val = convertArabicNumerals(e.target.value);
                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setSavings(val);
                    }
                  }}
                  className="bg-transparent text-3xl font-black text-indigo-600 dark:text-indigo-500 outline-none w-full"
                 />
                 <span className="text-lg font-bold text-indigo-500/30">{getDisplayCurrency(appCurrency, language)}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 sticky bottom-0 bg-zinc-50 dark:bg-zinc-950 py-6 max-w-md mx-auto w-full space-y-4">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 py-6 rounded-[2rem] font-black text-lg shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50 italic tracking-tight"
        >
          {loading ? t.updating : t.save_all_changes}
        </button>

        {user?.isAdmin && (
          <button 
            onClick={() => {
              onClose();
              onOpenAdmin();
            }}
            className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/10 text-emerald-600 dark:text-emerald-500 shadow-sm active:scale-[0.98] transition-all"
          >
            <Shield size={18} />
            <span className="font-black text-xs uppercase tracking-widest">{t.open_admin}</span>
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
  onRefresh,
  t,
  language,
  privacyMode
}: { 
  user: any, 
  extraFunds: { emergency: number, savings: number }, 
  appCurrency: string,
  onClose: () => void,
  onRefresh: () => void,
  t: any,
  language: 'ar' | 'en',
  privacyMode: boolean
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
      className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 z-[90] flex flex-col p-6 overflow-y-auto"
      dir={t.dir || (language === 'ar' ? 'rtl' : 'ltr')}
    >
      <div className="flex justify-between items-center mb-8 sticky top-0 bg-zinc-50 dark:bg-zinc-950 z-10 py-2">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">{t.funds_management}</h2>
          <p className="text-xs text-zinc-500 font-bold">{t.funds_management_desc}</p>
        </div>
        <button onClick={onClose} className="bg-zinc-200 dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-3 rounded-2xl text-zinc-500 active:bg-zinc-300 dark:active:bg-zinc-800 font-bold">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-8 flex-1 max-w-md mx-auto w-full">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{t.emergency_fund_label}</label>
            <Shield className="text-amber-500" size={16} />
          </div>
          <div className="relative group">
            <input 
              type={privacyMode ? "password" : "text"}
              inputMode="decimal"
              value={emergency}
              onChange={(e) => {
                const val = convertArabicNumerals(e.target.value);
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setEmergency(val);
                }
              }}
              className="w-full bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-6 rounded-[2rem] text-3xl font-black text-zinc-900 dark:text-white focus:border-amber-500 outline-none transition-all shadow-sm"
              placeholder="0.00"
            />
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 font-bold">{getDisplayCurrency(appCurrency, language)}</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold px-2 leading-relaxed italic">
            {t.emergency_fund_note}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{t.savings_fund_label}</label>
            <TrendingUp className="text-indigo-500" size={16} />
          </div>
          <div className="relative group">
            <input 
              type={privacyMode ? "password" : "text"}
              inputMode="decimal"
              value={savings}
              onChange={(e) => {
                const val = convertArabicNumerals(e.target.value);
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setSavings(val);
                }
              }}
              className="w-full bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-6 rounded-[2rem] text-3xl font-black text-zinc-900 dark:text-white focus:border-indigo-500 outline-none transition-all shadow-sm"
              placeholder="0.00"
            />
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 font-bold">{getDisplayCurrency(appCurrency, language)}</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold px-2 leading-relaxed italic">
            {t.savings_fund_note}
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-md mx-auto w-full">
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 py-5 rounded-[2rem] font-black text-lg shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 italic tracking-tight"
        >
          {loading ? t.updating : t.save}
        </button>
      </div>
    </motion.div>
  );
}

function AllTransactionsModal({ transactions, onClose, appCurrency, language, t, privacyMode }: { transactions: Transaction[], onClose: () => void, appCurrency: string, language: 'ar' | 'en', t: any, privacyMode: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 z-[60] flex flex-col p-6 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-8 sticky top-0 bg-zinc-50 dark:bg-zinc-950 z-10 py-2">
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">{t.all_transactions}</h2>
        <button onClick={onClose} className="bg-zinc-200 dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-3 rounded-2xl text-zinc-500 font-bold active:bg-zinc-300 dark:active:bg-zinc-800">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4 max-w-md mx-auto w-full pb-10">
        {transactions.map((tx) => {
          const category = CATEGORIES[tx.category];
          const isExpense = tx.type === 'expense';
          const isTransfer = tx.type === 'transfer';
          return (
            <div key={tx.id} className="bg-white dark:bg-zinc-900 p-4 rounded-[2rem] flex items-center gap-5 border border-black/5 dark:border-white/5 shadow-sm">
              <div className={`p-4 rounded-3xl ${category.color} shadow-lg shrink-0`}>
                <category.icon size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="font-black text-zinc-900 dark:text-zinc-100 truncate text-sm italic">{tx.description}</p>
                <div className="flex items-center gap-2 mt-1 justify-end">
                  <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    {isTransfer ? t.transfer : t[category.label]}
                  </span>
                  <span className="w-1 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full"></span>
                  <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{new Date(tx.date).toLocaleDateString(language === 'ar' ? 'ar' : 'en-US', { day: 'numeric', month: 'short' })}</span>
                  <span className="w-1 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full"></span>
                  <span className="text-[9px] font-black text-zinc-500 dark:text-zinc-600 uppercase tracking-tighter italic">
                    {t[WALLET_LABELS[tx.wallet]]} {isTransfer && ` → ${t[WALLET_LABELS[(tx as any).toWallet!]]}`}
                  </span>
                </div>
              </div>
              <div className={`text-lg font-black tabular-nums shrink-0 italic ${isExpense ? 'text-zinc-900 dark:text-zinc-100' : isTransfer ? 'text-amber-500' : 'text-emerald-500'}`}>
                {isExpense ? '-' : isTransfer ? '⇄' : '+'} {formatAmount(tx.amount, privacyMode)}
                <span className="text-[9px] ml-1 opacity-40">{getDisplayCurrency(appCurrency, language)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SnapshotDetailModal({ snapshot, onClose, appCurrency, language, t, privacyMode }: { snapshot: Snapshot, onClose: () => void, appCurrency: string, language: 'ar' | 'en', t: any, privacyMode: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 z-[80] flex flex-col p-6 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-8 sticky top-0 bg-zinc-50 dark:bg-zinc-950 z-10 py-2">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">{t.snapshot_details}</h2>
          <p className="text-xs text-zinc-500 font-bold">{new Date(snapshot.date).toLocaleString(language === 'ar' ? 'ar' : 'en-US')}</p>
        </div>
        <button onClick={onClose} className="bg-zinc-200 dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-3 rounded-2xl text-zinc-500 font-bold active:bg-zinc-300 dark:active:bg-zinc-800">
          <X size={24} />
        </button>
      </div>

      <div className="max-w-md mx-auto w-full space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
            <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{t.total_snapshot}</p>
            <p className="text-2xl font-black text-zinc-900 dark:text-white italic mt-1">{formatAmount(snapshot.totalAmount, privacyMode)} <span className="text-[10px] opacity-40">{getDisplayCurrency(appCurrency, language)}</span></p>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
            <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{t.tx_count}</p>
            <p className="text-2xl font-black text-zinc-900 dark:text-white italic mt-1">{snapshot.transactionCount}</p>
          </div>
        </div>

        <div className="space-y-4 pb-10">
          <h3 className="font-black text-zinc-400 dark:text-zinc-600 px-1 uppercase text-[10px] tracking-widest">{t.archived_transactions}</h3>
          {(snapshot.transactions || []).map((tx) => {
            const category = CATEGORIES[tx.category];
            const isExpense = tx.type === 'expense';
            const isTransfer = tx.type === 'transfer';
            return (
              <div key={tx.id} className="bg-white/50 dark:bg-zinc-900/50 p-4 rounded-[2rem] flex items-center gap-5 border border-black/5 dark:border-white/5 opacity-80 scale-95 origin-center">
                <div className={`p-4 rounded-2xl ${category.color} shadow-sm group-hover:shadow-lg transition-all`}>
                  <category.icon size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate italic">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 justify-end">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                      {isTransfer ? t.transfer : t[category.label]}
                    </span>
                    <span className="w-1 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full"></span>
                    <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-600">
                      {t[WALLET_LABELS[(tx as any).wallet]]} {isTransfer && (tx as any).toWallet && ` ← ${t[WALLET_LABELS[(tx as any).toWallet]]}`}
                    </span>
                  </div>
                </div>
                <div className={`text-lg font-black tabular-nums italic ${isExpense ? 'text-zinc-900 dark:text-zinc-100' : isTransfer ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {isExpense ? '-' : isTransfer ? '⇄' : '+'} {formatAmount(tx.amount, privacyMode)}
                  <span className="text-[9px] ml-1 opacity-40">{getDisplayCurrency(appCurrency, language)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function SubscriptionManagerModal({ user, subscription, onClose, onRefresh, t, privacyMode }: { user: any, subscription?: Subscription, onClose: () => void, onRefresh: () => void, t: any, privacyMode: boolean }) {
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
      <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[3rem] border border-black/10 dark:border-white/10 p-8 space-y-6 shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">{subscription ? t.edit_subscription : t.add_subscription}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.subscription_name}</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-4 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-zinc-300 dark:focus:border-white/20 transition-all font-bold"
              placeholder={t.name_placeholder}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.monthly_amount}</label>
            <input 
              type={privacyMode ? "password" : "text"}
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const val = convertArabicNumerals(e.target.value);
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setAmount(val);
                }
              }}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-4 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-zinc-300 dark:focus:border-white/20 transition-all font-bold"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.next_billing_date}</label>
            <input 
              type="date"
              value={billingDate}
              onChange={(e) => setBillingDate(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-4 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-zinc-300 dark:focus:border-white/20 transition-all font-bold"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          {!isConfirmingDelete ? (
            <>
              <button 
                onClick={handleSave}
                className="flex-1 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-black rounded-2xl active:scale-95 transition-all shadow-lg italic"
              >
                {subscription ? t.update_data : t.add_subscription}
              </button>
              {subscription && (
                <button 
                  id="delete-subscription-btn"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="w-16 h-16 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white active:scale-95 transition-all shadow-sm"
                >
                  <X size={24} />
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                onClick={handleDelete}
                className="flex-1 py-4 bg-rose-500 text-white font-black rounded-2xl active:scale-95 animate-pulse italic"
              >
                {t.confirm_delete_subscription}
              </button>
              <button 
                onClick={() => setIsConfirmingDelete(false)}
                className="w-16 h-16 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-2xl active:scale-95 transition-all shadow-sm"
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

function Tutorial({ onComplete, t }: { onComplete: () => void, t: any }) {
  const [step, setStep] = useState(0);
  
  const steps = [
    {
      title: t.tutorial_welcome_title,
      description: t.tutorial_welcome_desc,
      icon: <LayoutDashboard size={40} className="text-zinc-900 dark:text-white" />
    },
    {
      title: t.tutorial_budget_title,
      description: t.tutorial_budget_desc,
      icon: <PieChart size={40} className="text-amber-500" />
    },
    {
      title: t.tutorial_add_title,
      description: t.tutorial_add_desc,
      icon: <Plus size={40} className="text-emerald-500" />
    },
    {
      title: t.tutorial_analysis_title,
      description: t.tutorial_analysis_desc,
      icon: <PieChart size={40} className="text-blue-500" />
    },
    {
      title: t.tutorial_funds_title,
      description: t.tutorial_funds_desc,
      icon: <Shield size={40} className="text-indigo-500" />
    },
    {
      title: t.tutorial_notif_title,
      description: t.tutorial_notif_desc,
      icon: <Bell size={40} className="text-amber-400" />
    },
    {
      title: t.tutorial_ready_title,
      description: t.tutorial_ready_desc,
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-100/90 dark:bg-zinc-950/90 backdrop-blur-xl"
    >
      <motion.div 
        key={step}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden text-center space-y-6"
      >
        <div className="flex justify-center mb-2">
          <motion.div 
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-[2rem] border border-black/5 dark:border-white/5"
          >
            {steps[step].icon}
          </motion.div>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase">{steps[step].title}</h2>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed font-bold text-sm">
            {steps[step].description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 pt-4">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-zinc-900 dark:bg-white' : 'w-1.5 bg-zinc-200 dark:bg-zinc-800'}`}
              />
            ))}
          </div>
          <button 
            onClick={handleNext}
            className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-black rounded-2xl active:scale-95 transition-all shadow-lg italic"
          >
            {step === steps.length - 1 ? t.tutorial_start : t.tutorial_next}
          </button>
        </div>

        <button 
          onClick={onComplete}
          className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400 p-1"
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
  onDelete,
  language,
  t
}: { 
  notifications: AppNotification[], 
  onClose: () => void, 
  onMarkRead: (id: string) => void,
  onDelete: (id: string) => void,
  language: string,
  t: any
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-100/90 dark:bg-zinc-950/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 rounded-[2.5rem] flex flex-col max-h-[80vh] overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-white dark:bg-zinc-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
              <Bell size={20} />
            </div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">{t.notifications}</h2>
          </div>
          <button onClick={onClose} className="p-3 bg-zinc-100 dark:bg-zinc-950 border border-black/5 dark:border-white/5 rounded-2xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all font-bold">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {notifications.length > 0 ? (
            notifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => !n.isRead && onMarkRead(n.id)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer group relative ${n.isRead ? 'bg-zinc-50 dark:bg-zinc-950/50 border-black/5 dark:border-white/5' : 'bg-white dark:bg-white/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5'}`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h3 className={`font-black text-sm ${n.isRead ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-white italic'}`}>{n.title}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed font-bold">{n.message}</p>
                    <p className="text-[9px] text-zinc-400 dark:text-zinc-600 font-black uppercase tracking-widest pt-1 italic">
                      {new Date(n.date).toLocaleDateString(language === 'ar' ? 'ar' : 'en-US', { day: 'numeric', month: 'short' })}
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
              <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-950 rounded-[2rem] flex items-center justify-center mx-auto text-zinc-300 dark:text-zinc-800 shadow-inner">
                <BellOff size={32} />
              </div>
              <p className="text-sm font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{t.no_notifications}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function AdminPanel({ onClose, language, t }: { onClose: () => void, language: string, t: any }) {
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
      alert(t.broadcast_success);
    } catch (err) {
      alert(t.broadcast_failed);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-zinc-100/95 dark:bg-zinc-950/95 backdrop-blur-3xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="p-8 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-white dark:bg-zinc-900 sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-500 uppercase italic tracking-tighter">{t.admin_panel}</h2>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest mt-1 italic">{t.admin_panel_desc}</p>
          </div>
          <button onClick={onClose} className="p-4 bg-zinc-100 dark:bg-zinc-950 border border-black/5 dark:border-white/5 rounded-2xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all font-bold">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {/* Broadcast Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600 dark:text-amber-500">
                <Bell size={24} />
              </div>
              <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase italic tracking-tight">{t.broadcast_notif}</h3>
            </div>
            
            <div className="space-y-4">
              <input 
                type="text"
                placeholder={t.broadcast_notif_title}
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-4 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-amber-500/30 transition-all font-bold"
              />
              <textarea 
                placeholder={t.broadcast_notif_msg}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={3}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-4 rounded-2xl text-zinc-900 dark:text-white outline-none focus:border-amber-500/30 transition-all font-bold resize-none"
              />
              <button 
                onClick={handleBroadcast}
                disabled={sending || !broadcastTitle || !broadcastMessage}
                className="w-full py-5 bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-black rounded-2xl active:scale-95 transition-all shadow-xl shadow-amber-500/10 disabled:opacity-50 italic uppercase tracking-widest text-xs"
              >
                {sending ? t.sending_broadcast : t.send_broadcast}
              </button>
            </div>
          </div>

          <div className="w-full h-px bg-black/5 dark:bg-white/5"></div>

          {/* Users List Section */}
          <div className="space-y-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-500">
                  <Users size={24} />
                </div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase italic tracking-tight">{t.users_list}</h3>
              </div>
              <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-950 px-3 py-1 rounded-full border border-black/5 dark:border-white/5 uppercase italic">
                {users.length} {t.users_count_suffix}
              </span>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="py-10 text-center space-y-4">
                  <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest leading-relaxed italic">{t.loading_users}</p>
                </div>
              ) : (
                users.map(u => (
                  <div key={u.id} className="p-5 bg-zinc-50/50 dark:bg-zinc-950/50 rounded-[2rem] border border-black/5 dark:border-white/5 space-y-5 hover:border-blue-500/30 transition-all group">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="font-black text-zinc-900 dark:text-white uppercase italic tracking-tighter">{u.displayName}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black italic">{u.email}</p>
                      </div>
                      {u.isAdmin ? (
                        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 px-3 py-1 rounded-lg text-[10px] font-black border border-emerald-500/20 flex items-center gap-1.5 shadow-sm italic uppercase">
                          <Shield size={10} />
                          {t.admin_tag || 'ADMIN'}
                        </div>
                      ) : (
                        <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5 italic uppercase">
                          <UserIcon size={10} />
                          {t.standard_user}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        onClick={async () => {
                          const pass = prompt(`${t.confirm_password_reset} (${u.displayName}):`);
                          if (pass && pass.length >= 6) {
                            try {
                              await api.resetUserPassword(u.id, pass);
                              alert(t.password_reset_success);
                            } catch (e: any) {
                              alert(e.message || t.password_reset_failed);
                            }
                          } else if (pass) {
                            alert(t.password_min_length);
                          }
                        }}
                        className="flex-1 py-3 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-xl text-[10px] font-black text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-400 dark:hover:text-white transition-all active:scale-95 italic uppercase tracking-widest"
                      >
                        {t.reset_password}
                      </button>
                      
                      {!u.isAdmin && (
                        <button 
                          onClick={async () => {
                            if (confirm(t.delete_user_confirm)) {
                              try {
                                await api.deleteUser(u.id);
                                loadUsers();
                                alert(t.delete_user_success);
                              } catch (e: any) {
                                alert(e.message || t.delete_user_failed);
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

function QuickAddModal({ user, onClose, onAdd, appCurrency, t, language, privacyMode }: { user: any, onClose: () => void, onAdd: (t: Omit<Transaction, 'id'>) => void, appCurrency: string, t: any, language: 'ar' | 'en', privacyMode: boolean }) {
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
    const getCode = (c: string) => c === 'ر.س' ? 'SAR' : (c === 'ج.م' ? 'EGP' : c);
    const targetCode = getCode(appCurrency);
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
      
      const prompt = language === 'ar' 
        ? `الرجاء تحليل صورة الفاتورة المرفقة واستخراج البيانات التالية بتنسيق JSON حصراً:
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
          - إذا لم تكن العملة واضحة، افترض أنها ${appCurrency}.`
        : `Please analyze the attached receipt image and extract the following data in JSON format exclusively:
          {
            "amount": number,
            "description": "Brief description of the transaction",
            "category": "One of these values only: food, shopping, transport, health, fun, bills, home, other",
            "wallet": "One of these values only: cash, bank"
          }
          Notes:
          - The amount must be a number.
          - Description should be descriptive.
          - Category must exactly match the provided English values.
          - If the currency is not clear, assume it is ${appCurrency}.`;

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
      let errorMsg = t.receipt_analysis_error;
      if (err.message?.includes("API_KEY_INVALID")) {
        errorMsg = t.api_key_error;
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
      ? `${t.transfer_from} ${t[WALLET_LABELS[wallet]]} ${t.to_label} ${t[WALLET_LABELS[toWallet]]}`
      : description || t[CATEGORIES[category].label];

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
      className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 z-50 flex flex-col p-6 overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-8">
        <button onClick={onClose} className="bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-3 rounded-2xl text-zinc-500 active:bg-zinc-200 dark:active:bg-zinc-800">
          <X size={24} />
        </button>
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-black/5 dark:border-white/5">
           {(['expense', 'income', 'transfer'] as TransactionType[]).map((tr) => (
             <button
              key={tr}
              type="button"
              onClick={() => setType(tr)}
              className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${type === tr ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-lg' : 'text-zinc-500'}`}
             >
               {tr === 'expense' ? t.expense : tr === 'income' ? t.income : t.transfer}
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
            className={`p-3 rounded-2xl border border-black/5 dark:border-white/5 transition-all ${isAnalyzing ? 'bg-amber-500 text-zinc-950 animate-pulse' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 active:bg-zinc-200 dark:active:bg-zinc-800'}`}
            title={t.analyze_receipt}
          >
            {isAnalyzing ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-10 max-w-lg mx-auto w-full group">
        {previewImage && (
          <div className="relative w-full aspect-video rounded-[2.5rem] overflow-hidden border border-black/5 dark:border-white/10 group shadow-lg">
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
                <p className="text-xs font-black text-amber-500 uppercase tracking-widest animate-pulse">{t.analyzing_receipt_ai}</p>
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
                  {t.retry}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="space-y-4 text-center relative">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">{t.amount_label}</label>
            <button 
              type="button"
              onClick={() => setShowConverter(!showConverter)}
              className="text-[10px] font-black text-amber-600 dark:text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-black/5 dark:border-amber-500/20"
            >
              {t.currency_converter} {showConverter ? '↑' : '↓'}
            </button>
          </div>

          {showConverter && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-white dark:bg-zinc-900 p-5 rounded-[2.5rem] border border-black/5 dark:border-amber-500/10 space-y-4 shadow-2xl shadow-amber-500/5 overflow-hidden"
            >
              <div className="flex gap-3">
                <div className="flex-1 relative group">
                  <input 
                    type={privacyMode ? "password" : "text"}
                    inputMode="decimal"
                    placeholder={t.convert_amount_placeholder}
                    value={convertAmount}
                    onChange={(e) => {
                      const val = convertArabicNumerals(e.target.value);
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setConvertAmount(val);
                      }
                    }}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-4 rounded-2xl text-zinc-900 dark:text-white outline-none text-lg font-black focus:border-amber-500/50 transition-all text-center placeholder:text-zinc-300 dark:placeholder:text-zinc-800 placeholder:text-sm shadow-inner"
                  />
                </div>
                <div className="w-24 relative">
                  <select 
                    value={convertFrom}
                    onChange={(e) => setConvertFrom(e.target.value)}
                    className="w-full h-full bg-zinc-50 dark:bg-zinc-950 border border-black/5 dark:border-white/5 p-3 rounded-2xl text-zinc-900 dark:text-white outline-none text-xs font-black appearance-none cursor-pointer text-center focus:border-amber-500/50 transition-all font-bold"
                  >
                    {['USD', 'SAR', 'EGP', 'AED', 'KWD', 'EUR', 'TRY', 'GBP'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option disabled>──────</option>
                    {Object.keys(rates).filter(c => !['USD', 'SAR', 'EGP', 'AED', 'KWD', 'EUR', 'TRY', 'GBP'].includes(c)).slice(0, 50).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                    <ChevronDown size={12} />
                  </div>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleConvert}
                className="w-full bg-amber-500 text-zinc-950 py-4 rounded-2xl font-black text-sm shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ring-4 ring-amber-500/10 italic"
              >
                {t.apply_conversion} {getDisplayCurrency(appCurrency, language)}
              </button>
            </motion.div>
          )}

          <div className="flex items-center justify-center gap-3">
             <input 
              type={privacyMode ? "password" : "text"} 
              autoFocus
              inputMode="decimal"
              placeholder="0.00"
              className="w-full text-7xl font-black bg-transparent border-none outline-none focus:ring-0 placeholder:text-zinc-200 dark:placeholder:text-zinc-900 text-center tabular-nums text-zinc-900 dark:text-white italic tracking-tighter"
              value={amount}
              onChange={(e) => {
                const val = convertArabicNumerals(e.target.value);
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setAmount(val);
                }
              }}
            />
            <span className="text-2xl font-black text-zinc-400 dark:text-zinc-600 uppercase italic">{getDisplayCurrency(appCurrency, language)}</span>
          </div>
        </div>

        {type !== 'transfer' && (
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest px-1">{t.category_label}</label>
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
                      className={`flex flex-col items-center gap-3 p-4 rounded-3xl transition-all border ${
                        isSelected 
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 scale-110 shadow-2xl border-transparent' 
                          : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-black/5 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <cat.icon size={26} strokeWidth={isSelected ? 2.5 : 2} />
                      <span className="text-[9px] font-black uppercase tracking-tighter italic">{t[cat.label]}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest px-1">
              {type === 'transfer' ? t.from_account_label : t.account_label}
            </label>
            <div className="p-1 bg-zinc-50 dark:bg-zinc-900 rounded-[1.5rem] border border-black/5 dark:border-white/5 grid shadow-inner">
                <div className={`grid ${type === 'transfer' ? 'grid-cols-4 px-1' : 'grid-cols-2'}`}>
                  {(type === 'transfer' ? ['cash', 'bank', 'savings', 'emergency'] : ['cash', 'bank']).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWallet(w as WalletType)}
                      className={`py-4 text-[9px] font-black rounded-2xl transition-all uppercase tracking-widest italic ${wallet === w ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}
                    >
                      {t[WALLET_LABELS[w]]}
                    </button>
                  ))}
                </div>
            </div>
          </div>

          {type === 'transfer' && (
            <div className="flex-1 space-y-4">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest px-1">{t.to_account_label}</label>
              <div className="p-1 bg-zinc-50 dark:bg-zinc-900 rounded-[1.5rem] border border-black/5 dark:border-white/5 grid shadow-inner">
                <div className="grid grid-cols-4 px-1">
                  {(['cash', 'bank', 'savings', 'emergency'] as WalletType[]).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setToWallet(w)}
                      className={`py-4 text-[9px] font-black rounded-2xl transition-all uppercase tracking-widest italic ${toWallet === w ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}
                    >
                      {t[WALLET_LABELS[w]]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {type === 'expense' && (
            <div className="flex-shrink-0 space-y-4 min-w-[100px]">
               <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest px-1">{t.frequency_label}</label>
               <button
                type="button"
                onClick={() => setIsSubscription(!isSubscription)}
                className={`w-full py-4 text-xs font-black rounded-2xl transition-all border uppercase tracking-widest italic ${isSubscription ? 'bg-white dark:bg-white text-zinc-950 border-transparent shadow-xl' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-black/5 dark:border-white/5'}`}
               >
                 {isSubscription ? t.subscription : t.one_time}
               </button>
            </div>
          )}
        </div>

        {type === 'expense' && (
          <div className="space-y-4">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest px-1">{t.necessity_label}</label>
            <div className="flex p-1 bg-zinc-50 dark:bg-zinc-900 rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-inner">
                <button
                type="button"
                onClick={() => setNecessity('necessity')}
                className={`flex-1 py-4 text-xs font-black rounded-2xl transition-all uppercase tracking-widest italic ${necessity === 'necessity' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}
                >
                  {t[NECESSITY_LABELS.necessity]}
                </button>
                <button
                type="button"
                onClick={() => setNecessity('luxury')}
                className={`flex-1 py-4 text-xs font-black rounded-2xl transition-all uppercase tracking-widest italic ${necessity === 'luxury' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}
                >
                  {t[NECESSITY_LABELS.luxury]}
                </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
           <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest px-1">{t.desc_label}</label>
           <input 
            placeholder={type === 'transfer' ? t.desc_transfer_placeholder : type === 'income' ? t.desc_income_placeholder : t.desc_expense_placeholder}
            className="w-full p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-black/5 dark:border-white/5 outline-none focus:ring-4 focus:ring-zinc-100 dark:focus:ring-white/5 text-lg text-zinc-900 dark:text-white font-bold shadow-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="mt-auto space-y-4 pt-10">
          <button 
            type="submit"
            disabled={!amount}
            className={`w-full py-6 rounded-[2.5rem] font-black text-xl shadow-2xl transition-all transform active:scale-95 italic tracking-tight ${
              !amount ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-300 dark:text-zinc-800 cursor-not-allowed' : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-white/10 ring-8 ring-zinc-50 dark:ring-zinc-950'
            }`}
          >
            {t.confirm_transaction}
          </button>
          <p className="text-center text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest pb-8 italic">{t.cloud_save_notice}</p>
        </div>
      </form>
    </motion.div>
  );
}

function LoanModal({ user, loan, onClose, onRefresh, t, language, privacyMode }: { 
  user: any, 
  loan?: any, 
  onClose: () => void, 
  onRefresh: () => void, 
  t: any, 
  language: 'ar' | 'en',
  privacyMode: boolean
}) {
  const [personName, setPersonName] = useState(loan?.personName || '');
  const [amount, setAmount] = useState(loan?.amount?.toString() || '');
  const [description, setDescription] = useState(loan?.description || '');
  const [type, setType] = useState<'borrowed' | 'lent'>(loan?.type || 'borrowed');
  const [wallet, setWallet] = useState<WalletType>(loan?.wallet || 'bank');
  const [dueDate, setDueDate] = useState(loan?.dueDate?.split('T')[0] || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !personName) return;

    setSaving(true);
    try {
      const amountNum = parseFloat(amount);
      const isNew = !loan;
      const loanId = loan?.id || Math.random().toString(36).substr(2, 9);
      
      const loanData = {
        id: loanId,
        amount: amountNum,
        remainingAmount: isNew ? amountNum : loan.remainingAmount,
        personName,
        description,
        type,
        status: 'active',
        dueDate: new Date(dueDate).toISOString(),
        startDate: loan?.startDate || new Date().toISOString(),
        wallet,
        userId: user.id
      };

      await api.saveLoan(loanData);

      // If it's a new loan, record a transaction
      if (isNew) {
        await api.addTransaction({
          id: Math.random().toString(36).substr(2, 9),
          amount: amountNum,
          description: `${type === 'lent' ? t.loan_to : t.borrowed_from} ${personName}: ${description}`,
          category: 'other',
          type: type === 'lent' ? 'expense' : 'income',
          wallet,
          date: new Date().toISOString(),
          userId: user.id
        });
      }

      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-100/90 dark:bg-zinc-950/90 backdrop-blur-xl"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[3rem] p-8 border border-black/5 dark:border-white/5 shadow-2xl relative space-y-6">
        <button type="button" onClick={onClose} className="absolute top-6 right-6 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-400"><X size={20} /></button>
        
        <div className="space-y-1">
          <h2 className="text-xl font-black text-zinc-900 dark:text-white italic tracking-tighter">{t.add_loan}</h2>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{t.cloud_save_notice}</p>
        </div>

        <div className="space-y-4">
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
            {(['borrowed', 'lent'] as const).map(lt => (
              <button
                key={lt}
                type="button"
                onClick={() => setType(lt)}
                className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${type === lt ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}
              >
                {t[lt]}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.loan_person_name}</label>
            <input 
              required
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.loan_amount}</label>
            <input 
              required
              type={privacyMode ? "password" : "text"}
              inputMode="decimal"
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none"
              value={amount}
              onChange={(e) => setAmount(convertArabicNumerals(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.due_date}</label>
              <input 
                type="date"
                required
                className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none text-[10px]"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.loan_wallet}</label>
              <select
                className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none text-[10px]"
                value={wallet}
                onChange={(e) => setWallet(e.target.value as WalletType)}
              >
                {(['bank', 'cash'] as const).map(w => (
                  <option key={w} value={w}>{t[WALLET_LABELS[w]]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.loan_description}</label>
            <input 
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={saving}
          className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-2xl font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
        >
          {saving ? t.saving : t.save}
        </button>
      </form>
    </motion.div>
  );
}

function RepayModal({ user, loan, onClose, onRefresh, t, language, privacyMode }: { 
  user: any, 
  loan: any, 
  onClose: () => void, 
  onRefresh: () => void, 
  t: any, 
  language: 'ar' | 'en',
  privacyMode: boolean
}) {
  const [amount, setAmount] = useState(loan.remainingAmount.toString());
  const [wallet, setWallet] = useState<WalletType>('bank');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setSaving(true);
    try {
      await api.repayLoan(loan.id, amountNum);
      await api.addTransaction({
        id: crypto.randomUUID(),
        amount: amountNum,
        description: `${t.loan_category_label}: ${loan.personName}`,
        category: 'other',
        type: loan.type === 'borrowed' ? 'expense' : 'income',
        wallet,
        date: new Date().toISOString(),
        userId: user.id
      });
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-zinc-100/80 dark:bg-zinc-950/80 backdrop-blur-md"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-black/5 dark:border-white/5 shadow-2xl relative space-y-6">
        <button type="button" onClick={onClose} className="absolute top-6 right-6 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-400"><X size={20} /></button>
        
        <div className="text-center space-y-1 pt-2">
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">{t.repay}</p>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white italic">{loan.personName}</h2>
          <p className="text-xs text-zinc-500 font-bold">{loan.description}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.loan_amount}</label>
            <div className="relative">
              <input 
                required
                type={privacyMode ? "password" : "text"}
                inputMode="decimal"
                autoFocus
                className="w-full p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-2xl text-zinc-900 dark:text-white font-black outline-none text-center"
                value={amount}
                onChange={(e) => setAmount(convertArabicNumerals(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1 text-center block">{t.loan_wallet}</label>
            <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
              {(['bank', 'cash'] as const).map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWallet(w)}
                  className={`flex-1 py-3 text-[9px] font-black rounded-xl transition-all uppercase tracking-widest ${wallet === w ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}
                >
                  {t[WALLET_LABELS[w]]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={saving}
          className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-2xl font-black uppercase tracking-widest shadow-xl disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all"
        >
          {saving ? t.saving : t.confirm_transaction}
        </button>
      </form>
    </motion.div>
  );
}

function RecurringModal({ user, item, onClose, onRefresh, t, language, privacyMode }: { 
  user: any, 
  item?: any, 
  onClose: () => void, 
  onRefresh: () => void, 
  t: any, 
  language: 'ar' | 'en',
  privacyMode: boolean
}) {
  const [description, setDescription] = useState(item?.description || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');
  const [category, setCategory] = useState<TransactionCategory>(item?.category || 'other');
  const [type, setType] = useState<'income' | 'expense'>(item?.type || 'expense');
  const [wallet, setWallet] = useState<WalletType>(item?.wallet || 'bank');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>(item?.frequency || 'monthly');
  const [autoProcess, setAutoProcess] = useState(item?.autoProcess === 1);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;

    setSaving(true);
    try {
      await api.saveRecurring({
        id: item?.id || crypto.randomUUID(),
        amount: parseFloat(amount),
        description,
        category,
        type,
        wallet,
        frequency,
        autoProcess,
        userId: user.id
      });
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-100/90 dark:bg-zinc-950/90 backdrop-blur-xl"
    >
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[3rem] p-8 border border-black/5 dark:border-white/5 shadow-2xl relative space-y-6">
        <button type="button" onClick={onClose} className="absolute top-6 right-6 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-400"><X size={20} /></button>
        
        <div className="space-y-1">
          <h2 className="text-xl font-black text-zinc-900 dark:text-white italic tracking-tighter">{t.add_recurring}</h2>
        </div>

        <div className="space-y-4">
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
            {(['expense', 'income'] as const).map(lt => (
              <button
                key={lt}
                type="button"
                onClick={() => setType(lt)}
                className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${type === lt ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}
              >
                {t[lt]}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.description}</label>
            <input 
              required
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.amount}</label>
              <input 
                required
                type={privacyMode ? "password" : "text"}
                inputMode="decimal"
                className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none"
                value={amount}
                onChange={(e) => setAmount(convertArabicNumerals(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.frequency}</label>
              <select
                className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none text-[10px]"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
              >
                <option value="daily">{t.daily}</option>
                <option value="weekly">{t.weekly}</option>
                <option value="monthly">{t.monthly}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.category}</label>
              <select
                className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none text-[10px]"
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
              >
                {Object.entries(CATEGORIES).map(([id, cat]) => (
                  <option key={id} value={id}>{t[cat.label]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.wallet}</label>
              <select
                className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 rounded-2xl text-zinc-900 dark:text-white font-bold outline-none text-[10px]"
                value={wallet}
                onChange={(e) => setWallet(e.target.value as WalletType)}
              >
                {(['bank', 'cash'] as const).map(w => (
                  <option key={w} value={w}>{t[WALLET_LABELS[w]]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">{t.confirmation_mode}</label>
            <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setAutoProcess(true)}
                className={`flex-1 py-3 text-[9px] font-black rounded-xl transition-all uppercase tracking-widest ${autoProcess ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}
              >
                {t.auto_confirm}
              </button>
              <button
                type="button"
                onClick={() => setAutoProcess(false)}
                className={`flex-1 py-3 text-[9px] font-black rounded-xl transition-all uppercase tracking-widest ${!autoProcess ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500'}`}
              >
                {t.manual_confirm}
              </button>
            </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={saving}
          className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-2xl font-black uppercase tracking-widest shadow-xl disabled:opacity-50"
        >
          {saving ? t.saving : t.save}
        </button>
      </form>
    </motion.div>
  );
}
