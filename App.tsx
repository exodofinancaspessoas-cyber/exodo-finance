
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const loadedUser = StorageService.getUser();
    setUser(loadedUser);
  }, []);

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard currentMonth={currentMonth} onChangeView={setCurrentView} />;
      case 'incomes':
        return <TransactionsView initialType="RECEITA" />;
      case 'expenses':
        return <TransactionsView initialType="DESPESA" />;
      case 'accounts':
        return <AccountsView />;
      case 'cards':
        return <CardsView />;
      case 'transfers':
        return <TransfersView />;
      case 'projection':
        return <ProjectionView />;
      case 'recurring':
        return <RecurringExpensesView />;
      case 'reports': return <ReportsView />;
      case 'goals': return <GoalsView />;
      case 'budgets': return <BudgetsView />;
      case 'simulator': return <InvoiceSimulator />;
      default:
        return <Dashboard currentMonth={currentMonth} onChangeView={setCurrentView} />;
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
    >
      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
        {renderView()}
      </div>
    </Layout>
  );
}