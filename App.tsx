
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
import { Sparkles } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Onboarding states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showManual, setShowManual] = useState(() => {
    return !localStorage.getItem('onboarding_completed');
  });

  useEffect(() => {
    const loadedUser = StorageService.getUser();
    setUser(loadedUser);

    // Check for Deep Links / Shortcuts
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'quick-add') {
      setCurrentView('dashboard');
      // The Dashboard component will handle the auto-opening via its own useEffect
    }

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

  return (
    <Layout
      currentView={currentView}
      onChangeView={setCurrentView}
      user={user}
      onLogout={() => {
        StorageService.logout();
        setUser(null);
      }}
      onOpenTraining={() => setShowManual(true)}
    >
      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full relative">
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
    </Layout>
  );
}