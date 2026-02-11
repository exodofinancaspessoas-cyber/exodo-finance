
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpCircle, ArrowDownCircle, Wallet, Calendar,
  TrendingUp, Activity, Plus, FileText, ArrowRight, Loader2
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../utils';
import { Account, Card, Transaction, Category } from '../types';
import SupabaseSync from './SupabaseSync';

interface DashboardProps {
  currentMonth: Date;
  onChangeView: (view: string) => void;
}

export default function Dashboard({ currentMonth, onChangeView }: DashboardProps) {
  const [user] = useState(() => StorageService.getUser());
  const [data, setData] = useState<{
    transactions: Transaction[];
    categories: Category[];
    accounts: Account[];
    cards: Card[];
  }>({
    transactions: [],
    categories: [],
    accounts: [],
    cards: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [currentMonth]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [trxs, cats, accs, crds] = await Promise.all([
        StorageService.getTransactions(),
        StorageService.getCategories(),
        StorageService.getAccounts(),
        StorageService.getCards()
      ]);
      setData({ transactions: trxs, categories: cats, accounts: accs, cards: crds });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const { transactions, categories, accounts } = data;

  // --- Calculations ---

  // 1. Total Balance (Sum of all accounts)
  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, account) => acc + (account.current_balance || 0), 0);
  }, [accounts]);

  // 2. Monthly Stats
  const monthlyStats = useMemo(() => {
    const targetYear = currentMonth.getFullYear();
    const targetMonth = currentMonth.getMonth();

    const monthlyTransactions = transactions.filter(t => {
      if (!t.date) return false;
      const [y, m] = t.date.split('-').map(Number);
      return y === targetYear && (m - 1) === targetMonth;
    });

    const income = monthlyTransactions
      .filter(t => t.type === 'RECEITA')
      .reduce((acc, t) => acc + t.amount, 0);

    const expense = monthlyTransactions
      .filter(t => t.type === 'DESPESA')
      .reduce((acc, t) => acc + t.amount, 0);

    return { income, expense, balance: income - expense };
  }, [transactions, currentMonth]);

  // 3. Recent Activity (Last 5 transactions)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  // 4. Budget/Category Highlights
  const topSpendingCategories = useMemo(() => {
    const targetYear = currentMonth.getFullYear();
    const targetMonth = currentMonth.getMonth();

    const monthlyExpenses = transactions.filter(t => {
      if (!t.date || t.type !== 'DESPESA') return false;
      const [y, m] = t.date.split('-').map(Number);
      return y === targetYear && (m - 1) === targetMonth;
    });

    const categorySpending: Record<string, number> = {};
    monthlyExpenses.forEach(t => {
      categorySpending[t.category_id] = (categorySpending[t.category_id] || 0) + t.amount;
    });

    return Object.entries(categorySpending)
      .map(([id, amount]) => ({
        name: categories.find(c => c.id === id)?.name || 'Outros',
        amount
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [transactions, categories, currentMonth]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 size={40} className="animate-spin mb-4" />
        <p className="font-medium">Carregando seus dados...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8 pb-20">
      {/* Header / Welcome */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Olá, {user?.name?.split(' ')[0] || 'Visitante'}! 👋
          </h1>
          <p className="text-slate-500 mt-1">
            Aqui está o resumo financeiro de {currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onChangeView('incomes')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold transition-colors text-sm"
          >
            <Plus size={16} /> Nova Receita
          </button>
          <button
            onClick={() => onChangeView('expenses')}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-bold transition-colors text-sm"
          >
            <Plus size={16} /> Nova Despesa
          </button>
        </div>
      </div>

      {/* SUPABASE CONNECTION STATUS & SYNC */}
      <SupabaseSync />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet size={80} />
          </div>
          <div className="relative z-10">
            <p className="text-slate-400 text-sm font-medium mb-1">Saldo Total Acumulado</p>
            <h2 className="text-3xl font-bold tracking-tight">{formatCurrency(totalBalance)}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 w-fit px-2 py-1 rounded-lg">
              <Activity size={14} /> Atualizado agora
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-100 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <ArrowUpCircle size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase">Receitas</span>
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Entradas do Mês</p>
            <h2 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(monthlyStats.income)}</h2>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-red-100 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-xl">
              <ArrowDownCircle size={24} />
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase">Despesas</span>
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Saídas do Mês</p>
            <h2 className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(monthlyStats.expense)}</h2>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Activity size={20} className="text-indigo-600" /> Atividade Recente
            </h3>
            <button onClick={() => onChangeView('reports')} className="text-indigo-600 text-sm font-bold hover:underline flex items-center gap-1">
              Ver tudo <ArrowRight size={14} />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {recentTransactions.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {recentTransactions.map(t => {
                  const category = categories.find(c => c.id === t.category_id);
                  return (
                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.type === 'RECEITA' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {t.type === 'RECEITA' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{t.description}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{formatDate(t.date)}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 uppercase font-bold text-[10px]">{category?.name || 'Geral'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-sm ${t.type === 'RECEITA' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.type === 'RECEITA' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                        <p className="text-xs text-slate-400 capitalize">{t.status?.toLowerCase()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <p>Nenhuma atividade recente.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
              <TrendingUp size={16} /> Maiores Gastos (Mês)
            </h3>
            <div className="space-y-4">
              {topSpendingCategories.length > 0 ? topSpendingCategories.map((cat, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{cat.name}</span>
                    <span className="font-bold text-slate-900">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-orange-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min((cat.amount / (monthlyStats.expense || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-400 text-center py-4">Sem dados de despesas neste mês.</p>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <FileText size={18} /> Dica Financeira
              </h3>
              <p className="text-white/90 text-sm leading-relaxed mb-4">
                {monthlyStats.balance > 0
                  ? "Parabéns! Você está no azul este mês. Que tal investir o excedente em suas metas de longo prazo?"
                  : "Atenção: Suas despesas superaram as receitas. Revise seus gastos supérfluos na aba de Relatórios."}
              </p>
              <button
                onClick={() => onChangeView('reports')}
                className="w-full py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg font-bold text-xs transition-colors"
              >
                Ver Análise Completa
              </button>
            </div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}