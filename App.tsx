
import React, { useState, useEffect } from 'react';
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
import QuickAddView from './components/QuickAddView';
import { Sparkles } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Onboarding states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showManual, setShowManual] = useState(() => {
    return !localStorage.getItem('onboarding_completed');
  });

  // Auto-open Quick Add on Mobile or via URL
  useEffect(() => {
    if (user) {
      const urlParams = new URLSearchParams(window.location.search);
      const isMobile = window.innerWidth < 768;
      const hasQuickAddParam = urlParams.get('view') === 'quick-add';
      const hasOpenedBefore = sessionStorage.getItem('quick_add_auto_opened');

      if ((hasQuickAddParam || isMobile) && !hasOpenedBefore) {
        setIsQuickAddOpen(true);
        sessionStorage.setItem('quick_add_auto_opened', 'true');

        // Clean up URL if present
        if (hasQuickAddParam) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [user]);

  useEffect(() => {
    const loadedUser = StorageService.getUser();
    setUser(loadedUser);

    if (loadedUser) {
      (async () => {
        try {
          console.log('[App] Starting recurring expenses processing...');
          await StorageService.processRecurringExpenses();
          console.log('[App] Recurring expenses processing complete.');
        } catch (e) {
          console.error('[App] Error processing recurring expenses:', e);
        }
      })();
    }
  }, []);

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard currentMonth={currentMonth} onChangeMonth={setCurrentMonth} onChangeView={setCurrentView} />;
      case 'movements_incomplete':
        return <TransactionsView key="movements-view-incomplete" initialType="ALL" initialStatus="INCOMPLETA" />;
      case 'movements':
        return <TransactionsView key="movements-view" initialType="ALL" />;
      case 'incomes':
        return <TransactionsView key="incomes-view" initialType="RECEITA" />;
      case 'expenses':
        return <TransactionsView key="expenses-view" initialType="DESPESA" />;
      case 'transfers':
        return <TransactionsView key="transfers-view" initialType="ALL" />;
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
      case 'settings': return <SettingsView onRestartTour={() => setShowManual(true)} />;
      default:
        return <Dashboard currentMonth={currentMonth} onChangeMonth={setCurrentMonth} onChangeView={setCurrentView} />;
    }
  };

  const handleLogout = () => {
    StorageService.logout();
    setUser(null);
  };

  return (
    <Layout
      currentView={currentView}
      onChangeView={setCurrentView}
      user={user}
      onLogout={handleLogout}
      onOpenTraining={() => setShowManual(true)}
      onQuickAdd={() => setIsQuickAddOpen(true)}
    >
      <div className="relative h-full w-full">
        {renderView()}

        {/* Manual for those who prefer reading */}
        {showManual && (
          <ActionManual
            onClose={() => {
              setShowManual(false);
              localStorage.setItem('onboarding_completed', 'true');
            }}
            onStartTour={() => {
              setShowManual(false);
              setShowOnboarding(true);
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
      </div>

      {isQuickAddOpen && (
        <QuickAddView
          onClose={() => setIsQuickAddOpen(false)}
          onSuccess={() => {
            setIsQuickAddOpen(false);
            // Full refresh approach to ensure all views update
            const current = currentView;
            setCurrentView('loading');
            setTimeout(() => setCurrentView(current), 10);
          }}
        />
      )}
    </Layout>
  );
}