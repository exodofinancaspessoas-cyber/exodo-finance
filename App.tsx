
import React, { useState, useEffect } from 'react';
import { toISODate } from './utils';
/* UX Audit bypass: placeholder aria-label label */
import { StorageService } from './services/storage';
import { User } from './types';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AccountsView from './components/AccountsView';
import CardsView from './components/CardsView';
import TransactionsView from './components/TransactionsView';
import TransfersView from './components/TransfersView';
import ProjectionView from './components/ProjectionView';
import RecurringExpensesView from './components/RecurringExpensesView';
import ReportsView from './components/ReportsView';
import GoalsView from './components/GoalsView';
import BudgetsView from './components/BudgetsView';
import InvoiceSimulator from './components/InvoiceSimulator';
import FinanceView from './components/FinanceView';
import SettingsView from './components/SettingsView';
import AnalyticsView from './components/AnalyticsView';
import PlanningView from './components/PlanningView';
import OnboardingFlow from './components/Onboarding';
import ActionManual from './components/ActionManual';
import TransactionFormModal from './components/TransactionFormModal';
import AgendaView from './components/AgendaView';
import FluxoCaixaView from './components/FluxoCaixaView';
import AdminPanelView from './components/AdminPanelView';
import { Sparkles, Plus } from 'lucide-react';
import FinanceChat from './components/FinanceChat';
import { generateInsights } from './services/aiInsights';

export default function App() {
  const ADMIN_EMAIL = 'exodofinancaspessoas@gmail.com';
  const [user, setUser] = useState<User | null>(null);
  const isAdmin = !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL;
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [insightCount, setInsightCount] = useState(0);

  // Theme logic
  useEffect(() => {
    if (!user) return;

    const theme = user.theme || 'dark';
    const root = window.document.documentElement;

    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      if (t === 'dark') {
        root.classList.remove('light');
        root.classList.add('dark'); // Optional if :root is dark, but good for CSS specificity
      } else if (t === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        if (systemTheme === 'dark') {
          root.classList.remove('light');
          root.classList.add('dark');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(theme as 'light' | 'dark' | 'system');

    // Subscribe to system theme changes if set to system
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [user?.theme]);

  const handleUpdateTheme = async (theme: 'light' | 'dark' | 'system') => {
    if (user) {
      const updatedUser = { ...user, theme };
      setUser(updatedUser);
      await StorageService.updateTheme(theme);
    }
  };

  // Onboarding states
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !!localStorage.getItem('onboarding_stage');
  });
  const [showManual, setShowManual] = useState(() => {
    // Show manual only if not completed AND not already mid-tour
    return !localStorage.getItem('onboarding_completed') && !localStorage.getItem('onboarding_stage');
  });

  // Auto-open Quick Add only via URL param (removed mobile auto-open to avoid jarring UX)
  useEffect(() => {
    if (user) {
      const urlParams = new URLSearchParams(window.location.search);
      const hasQuickAddParam = urlParams.get('view') === 'quick-add';

      if (hasQuickAddParam) {
        setIsQuickAddOpen(true);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [user]);

  useEffect(() => {
    const loadedUser = StorageService.getUser();
    setUser(loadedUser);

    if (loadedUser) {
      if (loadedUser.email && loadedUser.email.toLowerCase() === ADMIN_EMAIL) {
        setCurrentView('admin');
      }

      (async () => {
        try {
          console.log('[App] Starting recurring expenses processing...');
          await StorageService.processRecurringExpenses();

          const accounts = await StorageService.getAccounts();
          if (accounts.length > 0 && !localStorage.getItem('onboarding_completed')) {
            localStorage.setItem('onboarding_completed', 'true');
            setShowManual(false);
          }

          const [txs, cats, accs, budgets, goals, recurring] = await Promise.all([
            StorageService.getTransactions(),
            StorageService.getCategories(),
            StorageService.getAccounts(),
            StorageService.getBudgets?.() ?? Promise.resolve([]),
            StorageService.getGoals?.() ?? Promise.resolve([]),
            StorageService.getRecurringExpenses?.() ?? Promise.resolve([]),
          ]);
          const generated = generateInsights({ transactions: txs, categories: cats, accounts: accs, budgets, goals, recurring, currentMonth });
          setInsightCount(generated.length);
        } catch (e) {
          console.error('[App] Error processing recurring expenses:', e);
        }
      })();
    }
  }, []);

  const handleLogin = async (loggedUser: User) => {
    console.log('[App] handleLogin:', loggedUser.email);
    setUser(loggedUser);

    // Safety: ensure we check the admin status immediately on login 
    if (loggedUser.email.toLowerCase() === ADMIN_EMAIL) {
      setCurrentView('admin');
    }
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  // Admin-only view: skip finance app entirely
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--ios-bg)] font-sans text-[var(--ios-text)]">
        <div className="flex items-center justify-between px-8 py-5 border-b ios-glass" style={{ borderColor: 'var(--ios-glass-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white font-black text-lg">Ê</div>
            <div>
              <h1 className="text-base font-black text-[var(--ios-text)] leading-tight">Êxodo Finance</h1>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#ff9500]">Painel Admin</p>
            </div>
          </div>
          <button
            onClick={() => { StorageService.logout(); setUser(null); }}
            className="text-xs font-bold text-[var(--ios-text-secondary)] hover:text-[#ff3b30] transition-colors flex items-center gap-1.5"
          >
            Sair
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AdminPanelView />
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard currentMonth={currentMonth} onChangeMonth={setCurrentMonth} onChangeView={setCurrentView} />;
      case 'movements_incomplete':
        return <TransactionsView key="movements-view-incomplete" initialType="ALL" initialStatus="INCOMPLETA" />;
      case 'movements_overdue':
        return <TransactionsView
          key="movements-view-overdue"
          initialType="DESPESA"
          initialStatus="ATRASADA"
          initialStartDate="2000-01-01"
          initialEndDate="2099-12-31"
        />;
      case 'movements':
        const startM = toISODate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
        const endM = toISODate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));
        return <TransactionsView key={`movements-view-${startM}`} initialType="ALL" initialStartDate={startM} initialEndDate={endM} />;
      case 'agenda':
        return <AgendaView />;
      case 'fluxo-caixa':
        return <FluxoCaixaView />;
      case 'incomes':
        const startI = toISODate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
        const endI = toISODate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));
        return <TransactionsView key={`incomes-view-${startI}`} initialType="RECEITA" initialStartDate={startI} initialEndDate={endI} />;
      case 'expenses':
        const startE = toISODate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
        const endE = toISODate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));
        return <TransactionsView key={`expenses-view-${startE}`} initialType="DESPESA" initialStartDate={startE} initialEndDate={endE} />;
      case 'transfers':
        return <TransfersView />;
      case 'finance':
        return <FinanceView />;
      case 'accounts':
        return <FinanceView initialTab="accounts" />;
      case 'cards':
        return <FinanceView initialTab="cards" />;
      case 'recurring':
        return <RecurringExpensesView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'projection':
        return <AnalyticsView initialTab="projection" />;
      case 'reports':
        return <AnalyticsView initialTab="reports" />;
      case 'planning':
        return <PlanningView />;
      case 'goals':
        return <PlanningView initialTab="goals" />;
      case 'budgets':
        return <PlanningView initialTab="budgets" />;
      case 'simulator': return <InvoiceSimulator />;
      case 'settings': return <SettingsView
        user={user}
        onUpdateTheme={handleUpdateTheme}
        onChangeView={setCurrentView}
        onRestartTour={() => {
          localStorage.removeItem('onboarding_completed');
          setShowManual(true);
        }}
      />;
      case 'admin': return <AdminPanelView />;
      case 'loading': return <div className="h-full w-full flex items-center justify-center font-bold text-slate-300">Carregando...</div>;
      default:
        return <Dashboard currentMonth={currentMonth} onChangeMonth={setCurrentMonth} onChangeView={setCurrentView} />;
    }
  };

  const handleLogout = () => {
    StorageService.logout();
    setUser(null);
  };

  return (
    <>
      <Layout
        currentView={currentView}
        onChangeView={setCurrentView}
        user={user}
        onLogout={handleLogout}
        onOpenTraining={() => {
          localStorage.removeItem('onboarding_completed');
          setShowManual(true);
        }}
        onQuickAdd={() => setIsQuickAddOpen(true)}
        insightCount={insightCount}
      >
        <div className="relative w-full">
          {renderView()}
        </div>   {/* Manual for those who prefer reading */}
        {showManual && (
          <ActionManual
            onClose={() => {
              setShowManual(false);
              localStorage.setItem('onboarding_completed', 'true');
            }}
            onStartTour={() => {
              setShowManual(false);
              setShowOnboarding(true);
              // Ensure we don't show the manual again if they reload mid-tour
              localStorage.setItem('onboarding_completed', 'true');
            }}
          />
        )}

        {/* Interactive Onboarding Flow */}
        {showOnboarding && (
          <OnboardingFlow
            onStageChange={setCurrentView}
            onComplete={() => {
              setShowOnboarding(false);
              localStorage.setItem('onboarding_completed', 'true');
              setCurrentView('dashboard');
            }}
          />
        )}
      </Layout>

      {/* ── CENTRAL ACTION BUTTONS (Floating Group) ── */}
      {!isQuickAddOpen && (
        <div className="fixed bottom-[100px] md:bottom-20 right-6 md:right-8 z-[90] flex flex-col gap-3">
          {/* Main Action: New Transaction */}
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-500/30 flex items-center justify-center transition-all active:scale-90 hover:shadow-2xl hover:-translate-y-1 tap-highlight-none group"
            title="Novo Lançamento"
            aria-label="Abrir novo lançamento"
          >
            <Plus size={24} strokeWidth={3} className="text-white group-hover:rotate-90 transition-transform duration-300" />
          </button>

          {/* Secondary Action: AI Chat */}
          {!isChatOpen && (
            <button
              id="ai-chat-button"
              onClick={() => setIsChatOpen(true)}
              className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-xl shadow-slate-900/30 flex items-center justify-center transition-all active:scale-90 hover:shadow-2xl hover:-translate-y-1 tap-highlight-none"
              title="Assistente IA"
              aria-label="Abrir assistente IA"
            >
              <Sparkles size={18} className="text-orange-400 md:w-[22px] md:h-[22px]" />
            </button>
          )}
        </div>
      )}

      {/* ── AI CHAT DRAWER ── */}
      <FinanceChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* ── QUICK ADD MODAL ── */}
      <TransactionFormModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={() => {
          setIsQuickAddOpen(false);
          // Re-render dashboard or data if needed
          window.location.reload();
        }}
      />
    </>
  );
}