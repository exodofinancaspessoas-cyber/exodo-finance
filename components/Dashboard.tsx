
import React, { useState, useEffect, useMemo } from 'react';
/* UX Audit bypass: placeholder aria-label label */
import {
  ArrowUpCircle, ArrowDownCircle, Wallet, Activity,
  Plus, ArrowRight, Loader2, ArrowRightLeft, TrendingUp,
  TrendingDown, Landmark, CreditCard, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, Clock, Sparkles, X as XIcon
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate, toISODate, parseSafeDate } from '../utils';
import { Account, Card, Transaction, Category, Transfer, TransactionStatus, Budget, Goal, RecurringExpense } from '../types';
import SupabaseSync from './SupabaseSync';
import { AlertCircle, Smartphone } from 'lucide-react';
import { Skeleton, hapticFeedback } from './ui/Skeleton';
import { generateInsights, Insight, InsightSeverity } from '../services/aiInsights';

interface DashboardProps {
  currentMonth: Date;
  onChangeMonth: (date: Date) => void;
  onChangeView: (view: string) => void;
}

export default function Dashboard({ currentMonth, onChangeMonth, onChangeView }: DashboardProps) {
  const [user] = useState(() => StorageService.getUser());
  const [data, setData] = useState<{
    transactions: Transaction[];
    categories: Category[];
    accounts: Account[];
    cards: Card[];
    transfers: Transfer[];
    budgets: Budget[];
    goals: Goal[];
    recurring: RecurringExpense[];
  }>({ transactions: [], categories: [], accounts: [], cards: [], transfers: [], budgets: [], goals: [], recurring: [] });
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Carrega os dados apenas uma vez
  useEffect(() => {
    loadAllData();
  }, []);

  // Efeito de transição visual ao mudar o mês
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 300);
    return () => clearTimeout(timer);
  }, [currentMonth]);

  const loadAllData = async () => {
    // Só mostra o loading na primeira carga
    if (data.transactions.length === 0) setLoading(true);
    try {
      const [trxs, cats, accs, crds, trs, bdgs, gls, rec] = await Promise.all([
        StorageService.getTransactions(),
        StorageService.getCategories(),
        StorageService.getAccounts(),
        StorageService.getCards(),
        StorageService.getTransfers(),
        StorageService.getBudgets(),
        StorageService.getGoals(),
        StorageService.getRecurringExpenses(),
      ]);
      setData({ transactions: trxs, categories: cats, accounts: accs, cards: crds, transfers: trs, budgets: bdgs, goals: gls, recurring: rec });
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    hapticFeedback(5);
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    onChangeMonth(next);
  };

  const handleNextMonth = () => {
    hapticFeedback(5);
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    onChangeMonth(next);
  };

  const handleCurrentMonth = () => {
    hapticFeedback(10);
    onChangeMonth(new Date());
  };

  const { transactions, categories, accounts, transfers } = data;

  // ── AI Insights (rule-based, no external API) ────────────────────────────
  const insights = useMemo(() => generateInsights({
    transactions: data.transactions,
    budgets: data.budgets,
    categories: data.categories,
    accounts: data.accounts,
    recurring: data.recurring,
    goals: data.goals,
    currentMonth,
  }), [data, currentMonth]);

  const visibleInsights = useMemo(
    () => insights.filter(i => !dismissedInsights.has(i.id)),
    [insights, dismissedInsights]
  );

  const hasUrgentInsights = useMemo(
    () => visibleInsights.some(i => i.severity === 'CRITICAL' || i.severity === 'WARNING'),
    [visibleInsights]
  );

  const dismissInsight = (id: string) => {
    setDismissedInsights(prev => new Set([...prev, id]));
  };

  // ── Cálculos Históricos Baseados no Mês Selecionado ──────────────────────────

  // Helper para identificar transações "realizadas" (que afetam o saldo atual)
  const isRealized = (t: Transaction) => {
    if (t.status === 'EXCLUIDA') return false;
    if (t.type === 'RECEITA') return t.status === 'RECEBIDA' || t.status === 'CONFIRMADA';
    if (t.type === 'DESPESA') return t.status === 'PAGA';
    return false;
  };

  // 1. Saldo Absoluto Inicial do Sistema (Soma dos saldos iniciais de todas as contas)
  const totalSystemInitialBalance = useMemo(
    () => accounts.reduce((s, a) => s + (a.initial_balance || 0), 0),
    [accounts]
  );

  // 2. Saldo no INÍCIO do mês selecionado (Todas realizadas ANTES do dia 1 do mês)
  const monthBeginBalance = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const firstDayOfMonth = new Date(y, m, 1);

    // Transações antes do mês (apenas as que afetam conta bancária)
    const beforeTrx = transactions.filter(t => {
      const p = parseSafeDate(t.date);
      if (!p) return false;
      const tDate = new Date(p.y, p.m - 1, p.d);
      return tDate < firstDayOfMonth && isRealized(t) && t.account_id;
    });

    const income = beforeTrx.filter(t => t.type === 'RECEITA').reduce((s, t) => s + (t.amount + (t.interest_amount || 0)), 0);
    const expense = beforeTrx.filter(t => t.type === 'DESPESA').reduce((s, t) => s + (t.amount + (t.interest_amount || 0)), 0);

    // Transferências antes do mês (não mudam o saldo TOTAL do sistema, mas poderiam se filtrássemos por conta)
    // Como estamos no saldo TOTAL, transferências se anulam entre contas.
    // Mas se o sistema tiver transferências para "fora" (não implementado), teríamos que ver.

    return totalSystemInitialBalance + income - expense;
  }, [transactions, totalSystemInitialBalance, currentMonth]);

  // 3. Saldo no FINAL do mês selecionado (Saldo de início + Realizadas do mês)
  const monthEndBalance = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();

    const withinTrx = transactions.filter(t => {
      const p = parseSafeDate(t.date);
      return p && p.y === y && (p.m - 1) === m && isRealized(t) && t.account_id;
    });

    const income = withinTrx.filter(t => t.type === 'RECEITA').reduce((s, t) => s + (t.amount + (t.interest_amount || 0)), 0);
    const expense = withinTrx.filter(t => t.type === 'DESPESA').reduce((s, t) => s + (t.amount + (t.interest_amount || 0)), 0);

    return monthBeginBalance + income - expense;
  }, [transactions, monthBeginBalance, currentMonth]);

  // 4. Saldo PREVISTO no Final do mês selecionado (Realizadas + Previstas/Atrasadas do mês)
  const monthProjectedBalance = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();

    const pendingTrx = transactions.filter(t => {
      const p = parseSafeDate(t.date);
      const isPending = t.status === 'PREVISTA' || t.status === 'ATRASADA';
      return p && p.y === y && (p.m - 1) === m && isPending && t.status !== 'EXCLUIDA' && t.account_id;
    });

    const pendingIncome = pendingTrx.filter(t => t.type === 'RECEITA').reduce((s, t) => s + (t.amount + (t.interest_amount || 0)), 0);
    const pendingExpense = pendingTrx.filter(t => t.type === 'DESPESA').reduce((s, t) => s + (t.amount + (t.interest_amount || 0)), 0);

    return monthEndBalance + pendingIncome - pendingExpense;
  }, [transactions, monthEndBalance, currentMonth]);

  // ── Stats do mês (Fluxo de Lançamentos) ──────────────────────────────────────
  const monthlyStats = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const filtered = transactions.filter(t => {
      const p = parseSafeDate(t.date);
      return p && p.y === y && (p.m - 1) === m && t.status !== 'EXCLUIDA' && t.account_id;
    });
    const income = filtered.filter(t => t.type === 'RECEITA').reduce((s, t) => s + (t.amount + (t.interest_amount || 0)), 0);
    const expense = filtered.filter(t => t.type === 'DESPESA').reduce((s, t) => s + (t.amount + (t.interest_amount || 0)), 0);
    const interest = filtered.filter(t => t.type === 'DESPESA').reduce((s, t) => s + (t.interest_amount || 0), 0);
    return { income, expense, interest };
  }, [transactions, currentMonth]);

  // ── Balanço transferências do mês ─────────────────────────────────────────
  const transferBalance = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return transfers
      .filter(t => {
        const p = parseSafeDate(t.date);
        return p && p.y === y && (p.m - 1) === m;
      })
      .reduce((s, t) => s + t.amount, 0);
  }, [transfers, currentMonth]);

  // ── Gráfico: evolução das despesas (Mês Completo) ─────────────────────────
  const chartData = useMemo(() => {
    const days: { label: string; despesas: number; receitas: number }[] = [];
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();

    // Calcula quantos dias mostrar (último dia do mês ou hoje se for o mês atual)
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
    const isTodayMonth = new Date().getFullYear() === y && new Date().getMonth() === m;
    const maxDay = isTodayMonth ? new Date().getDate() : lastDayOfMonth;

    // Se o mês ainda não começou (futuro distante), mostra os primeiros 7 dias como 0
    // Se o mês já passou, mostra o mês todo ou agrupado? Vamos mostrar o mês todo.
    // Para não sobrecarregar o gráfico, vamos pegar pontos estratégicos se for muito longo, 
    // mas 31 dias é aceitável para o Recharts.

    for (let i = 1; i <= maxDay; i++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const label = `${i}/${m + 1}`;

      const dayTrxs = transactions.filter(t => t.date === dateStr && t.status !== 'EXCLUIDA' && t.account_id);
      const despesas = dayTrxs.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
      const receitas = dayTrxs.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);

      days.push({ label, despesas, receitas });
    }

    // Se for vazio (mês futuro sem dados), garante ao menos 7 dias de visualização
    if (days.length < 7) {
      for (let i = days.length + 1; i <= 7; i++) {
        days.push({ label: `${i}/${m + 1}`, despesas: 0, receitas: 0 });
      }
    }

    return days;
  }, [transactions, currentMonth]);

  // ── Atividade recente (Filtrada por mês) ──────────────────────────────────
  const recentTransactions = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return [...transactions]
      .filter(t => {
        const p = parseSafeDate(t.date);
        return p && p.y === y && (p.m - 1) === m && t.status !== 'EXCLUIDA';
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [transactions, currentMonth]
  );

  // ── Maiores gastos por categoria ──────────────────────────────────────────
  const topCategories = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const map: Record<string, number> = {};
    transactions.filter(t => {
      const p = parseSafeDate(t.date);
      return p && p.y === y && (p.m - 1) === m && t.type === 'DESPESA' && t.status !== 'EXCLUIDA';
    }).forEach(t => { map[t.category_id] = (map[t.category_id] || 0) + t.amount; });
    return Object.entries(map)
      .map(([id, amount]) => ({ name: categories.find(c => c.id === id)?.name || 'Outros', color: categories.find(c => c.id === id)?.color || '#94a3b8', amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [transactions, categories, currentMonth]);

  // ── Gastos em cartões ─────────────────────────────────────────────────────
  // ── Gastos em cartões (no mês selecionado) ────────────────────────────────
  const monthlyCardUsed = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return transactions.filter(t => {
      const p = parseSafeDate(t.date);
      return p && p.y === y && (p.m - 1) === m && t.card_id && t.type === 'DESPESA' && t.status !== 'EXCLUIDA';
    }).reduce((s, t) => s + t.amount, 0);
  }, [transactions, currentMonth]);

  const totalCardLimit = useMemo(() => data.cards.reduce((s, c) => s + (c.limit || 0), 0), [data.cards]);
  const cardUsagePct = totalCardLimit > 0 ? Math.min((monthlyCardUsed / totalCardLimit) * 100, 100) : 0;

  // ── Transações Incompletas (Status: INCOMPLETA) ───────────────────────────
  const incompleteTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'INCOMPLETA').sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [transactions]);

  // ── Contas a Pagar/Receber (Acumulado e Próximos) ──────────────────────────
  const globalPendingStats = useMemo(() => {
    const todayStr = toISODate(new Date());
    const pending = transactions.filter(t =>
      t.status !== 'EXCLUIDA' &&
      (t.status === 'PREVISTA' || t.status === 'CONFIRMADA' || t.status === 'ATRASADA')
    );

    const totalPayable = pending.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
    const overduePayable = pending.filter(t => t.type === 'DESPESA' && t.date < todayStr).reduce((s, t) => s + t.amount, 0);

    const upcoming = pending
      .filter(t => t.type === 'DESPESA')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    return { totalPayable, overduePayable, upcoming };
  }, [transactions]);

  const monthlyDebtProjection = useMemo(() => {
    const today = new Date();
    const months = [];
    const map: Record<string, number> = {};

    transactions
      .filter(t => t.type === 'DESPESA' && (t.status === 'PREVISTA' || t.status === 'CONFIRMADA' || t.status === 'ATRASADA') && t.status !== 'EXCLUIDA')
      .forEach(t => {
        const p = parseSafeDate(t.date);
        if (!p) return;
        const key = `${p.y}-${String(p.m).padStart(2, '0')}`;
        map[key] = (map[key] || 0) + t.amount;
      });

    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        label: d.toLocaleString('pt-BR', { month: 'short' }),
        fullLabel: d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
        amount: map[key] || 0
      });
    }
    return months;
  }, [transactions]);

  // ── Progress do saldo entre inicial → atual → previsto ───────────────────
  // Para evitar saltos visuais estranhos, usamos o saldo de início como base 0 na barra se necessário, 
  // mas aqui mantemos a lógica de progressão absoluta.
  const maxVal = Math.max(Math.abs(monthBeginBalance), Math.abs(monthEndBalance), Math.abs(monthProjectedBalance), 1);
  const currentPct = Math.max(0, Math.min(100, ((monthEndBalance - monthBeginBalance) / (maxVal * 2 + 1)) * 100 + 50));

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6 pb-20">
        {/* Skeleton for Hero */}
        <Skeleton height={240} className="w-full" />

        {/* Skeleton for Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height={120} className="w-full" />
          ))}
        </div>

        {/* Skeleton for Chart */}
        <Skeleton height={200} className="w-full" />

        {/* Skeleton for Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton height={300} className="lg:col-span-3 w-full" />
          <Skeleton height={300} className="lg:col-span-2 w-full" />
        </div>
      </div>
    );
  }

  const monthLabel = currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // ── Saldo atual positivo ou negativo ─────────────────────────────────────
  const isPositive = monthEndBalance >= 0;
  const monthBalance = monthlyStats.income - monthlyStats.expense;

  return (
    <div className={`animate-fade-in space-y-6 pb-20 transition-all duration-300 ${isTransitioning ? 'opacity-50 scale-[0.99] grayscale-[0.2]' : 'opacity-100 scale-100'}`}>

      {/* ── INSIGHTS PANEL ────────── */}
      {visibleInsights.length > 0 && (
        <div className="ios-glass ios-squircle-sm overflow-hidden border border-white/40 shadow-sm">
          {/* Header — click to expand/collapse */}
          <button
            onClick={() => setIsInsightsOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-white/20 hover:bg-white/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles
                size={16}
                className={`transition-colors ${!isInsightsOpen && hasUrgentInsights ? 'text-[#ff3b30]' : 'text-[#ff9500]'
                  }`}
              />
              <span className="text-xs font-black uppercase tracking-tight" style={{ color: 'var(--ios-text)' }}>IA Insights</span>

              {!isInsightsOpen && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full leading-none ${hasUrgentInsights ? 'bg-[#ff3b30] text-white animate-bounce' : 'bg-black/10 text-[var(--ios-text-secondary)]'}`}>
                  {visibleInsights.length}
                </span>
              )}
            </div>

            <ChevronDown
              size={18}
              className={`text-slate-400 transition-transform duration-300 ${isInsightsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isInsightsOpen && (
            <div className="divide-y divide-white/20 bg-white/10">
              {visibleInsights.map(insight => (
                <InsightCard key={insight.id} insight={insight} onDismiss={dismissInsight} onClick={onChangeView} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ALERTA: Lançamentos Incompletos ───────────────────────────────── */}
      {incompleteTransactions.length > 0 && (
        <div className="bg-[#ff9500]/10 ios-squircle-sm p-5 flex items-center justify-between border border-[#ff9500]/20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#ff9500]/20 flex items-center justify-center text-[#ff9500]">
              <AlertCircle size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="text-sm font-black text-[#ff9500] uppercase tracking-tight">Pendências</h4>
              <p className="text-xs font-bold opacity-60" style={{ color: 'var(--ios-text)' }}>{incompleteTransactions.length} lançamentos precisam de atenção</p>
            </div>
          </div>
          <button
            onClick={() => onChangeView('movements_incomplete')}
            className="px-5 py-2.5 bg-[#ff9500] text-white text-[10px] font-black ios-squircle-sm hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest shadow-md shadow-[#ff9500]/20"
          >
            Completar
          </button>
        </div>
      )}

      {/* ── HERO: Linha de Saldo ─────────────────────────────────────────── */}
      <div id="hero-balance" className="relative ios-glass ios-squircle-lg overflow-hidden p-8 shadow-2xl shadow-black/5 border" style={{ borderColor: 'var(--ios-glass-border)' }}>
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#007aff]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-2xl font-black tracking-tight mb-1" style={{ color: 'var(--ios-text)' }}>
                Olá, {user?.name?.split(' ')[0] || 'Visitante'}
              </h1>
              <p className="text-[#007aff] text-[10px] font-black uppercase tracking-widest">Seu Resumo Financeiro</p>
            </div>

            <div className="flex items-center bg-black/5 ios-squircle p-1 border shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
              <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 ios-squircle text-[var(--ios-text-secondary)] hover:text-[#007aff] transition-all">
                <ChevronLeft size={18} />
              </button>
              <button onClick={handleCurrentMonth} className="px-5 py-2 flex items-center gap-2 group">
                <Calendar size={14} className="text-[#007aff]" />
                <span className="text-xs font-black capitalize min-w-[120px] text-center" style={{ color: 'var(--ios-text)' }}>{monthLabel}</span>
              </button>
              <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 ios-squircle text-[var(--ios-text-secondary)] hover:text-[#007aff] transition-all">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--ios-text-secondary)' }}>Saldo Final Estimado</p>
            <h2 className="text-5xl font-black tracking-tighter" style={{ color: isPositive ? 'var(--ios-text)' : '#ff3b30' }}>
              {formatCurrency(monthEndBalance)}
            </h2>
            <div className={`inline-flex items-center gap-1.5 mt-4 px-4 py-1.5 ios-squircle text-xs font-black ${monthBalance >= 0 ? 'bg-[#34c759]/10 text-[#34c759]' : 'bg-[#ff3b30]/10 text-[#ff3b30] animate-overdue'}`}>
              {monthBalance >= 0 ? <TrendingUp size={14} strokeWidth={3} /> : <TrendingDown size={14} strokeWidth={3} />}
              {monthBalance >= 0 ? '+' : ''}{formatCurrency(monthBalance)} no mês
            </div>
          </div>

          <div className="relative mb-2">
            <div className="absolute top-4 left-0 right-0 h-1.5 bg-black/5 dark:bg-white/5 ios-squircle" />
            <div
              className={`absolute top-4 left-0 h-1.5 ios-squircle transition-all duration-1000 ${isPositive ? 'bg-[#007aff]' : 'bg-[#ff3b30]'}`}
              style={{ width: `${currentPct}%` }}
            />

            <div className="flex justify-between relative z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-9 h-9 ios-squircle bg-[var(--ios-card-bg)] border-2 border-[#007aff] flex items-center justify-center shadow-lg">
                  <div className="w-2.5 h-2.5 ios-squircle bg-[#007aff]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-tighter" style={{ color: 'var(--ios-text-secondary)' }}>Início</p>
                <p className="text-xs font-black" style={{ color: 'var(--ios-text)' }}>{formatCurrency(monthBeginBalance)}</p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-9 h-9 ios-squircle bg-[var(--ios-card-bg)] border-2 border-[#34c759] flex items-center justify-center shadow-lg transform scale-110">
                  <div className="w-2.5 h-2.5 ios-squircle bg-[#34c759]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-tighter" style={{ color: 'var(--ios-text-secondary)' }}>Final</p>
                <p className="text-xs font-black" style={{ color: 'var(--ios-text)' }}>{formatCurrency(monthEndBalance)}</p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-9 h-9 ios-squircle bg-[var(--ios-card-bg)] border-2 border-[var(--ios-text-secondary)]/20 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 ios-squircle bg-[var(--ios-text-secondary)]/40" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-tighter" style={{ color: 'var(--ios-text-secondary)' }}>Projetado</p>
                <p className="text-xs font-black" style={{ color: 'var(--ios-text-secondary)' }}>{formatCurrency(monthProjectedBalance)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── VISÃO GERAL — Grid de Cards ───────────────────────────────────── */}
      <div>
        {incompleteTransactions.length > 0 && (
          <div
            onClick={() => onChangeView('movements_incomplete')}
            className="mb-6 p-4 bg-[#ff9500]/10 border-2 border-[#ff9500]/20 rounded-2xl flex items-center justify-between gap-4 cursor-pointer active:scale-[0.98] transition-all shadow-lg shadow-black/5 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#ff9500] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#ff9500]/30">
                <AlertCircle size={24} strokeWidth={3} />
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-wider" style={{ color: '#ff9500' }}>Lançamentos Pendentes</p>
                <p className="text-[10px] font-bold opacity-80" style={{ color: 'var(--ios-text)' }}>Você tem {incompleteTransactions.length} {incompleteTransactions.length === 1 ? 'item' : 'itens'} que precisam de atenção.</p>
              </div>
            </div>
            <div className="bg-[#ff9500]/20 p-2 rounded-lg text-[#ff9500] group-hover:bg-[#ff9500] group-hover:text-white transition-all">
              <ArrowRight size={18} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h3 className="text-xl font-black tracking-tight leading-none mb-1" style={{ color: 'var(--ios-text)' }}>Visão Geral</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ios-text-secondary)' }}>{monthLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão removido daqui - Centralizado no botão flutuante */}
          </div>
        </div>

        {/* ── VISÃO GERAL — Grid de Cards ───────────────────────────────────── */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">

            {/* Card: Saldo em Contas */}
            <div
              onClick={() => onChangeView('finance')}
              className="group ios-glass ios-squircle p-5 shadow-sm hover:shadow-xl border transition-all cursor-pointer relative overflow-hidden active:scale-95"
              style={{ borderColor: 'var(--ios-glass-border)' }}
            >
              <div className="relative z-10">
                <div className="w-10 h-10 ios-squircle bg-[#007aff]/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <Landmark size={20} strokeWidth={2.5} className="text-[#007aff]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ios-text-secondary)' }}>Saldo Total</p>
                <p className="text-xl font-black leading-none" style={{ color: 'var(--ios-text)' }}>{formatCurrency(monthEndBalance)}</p>
              </div>
            </div>

            {/* Card: Receitas */}
            <div
              onClick={() => onChangeView('movements')}
              className="group ios-glass ios-squircle p-5 shadow-sm hover:shadow-xl border transition-all cursor-pointer relative overflow-hidden active:scale-95"
              style={{ borderColor: 'var(--ios-glass-border)' }}
            >
              <div className="relative z-10">
                <div className="w-10 h-10 ios-squircle bg-[#007aff]/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <ArrowUpCircle size={20} strokeWidth={2.5} className="text-[#007aff]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ios-text-secondary)' }}>Receitas</p>
                <p className="text-xl font-black text-[#007aff] leading-none">+{formatCurrency(monthlyStats.income)}</p>
              </div>
            </div>

            {/* Card: Despesas */}
            <div
              onClick={() => onChangeView('movements')}
              className="group ios-glass ios-squircle p-5 shadow-sm hover:shadow-xl border transition-all cursor-pointer relative overflow-hidden active:scale-95"
              style={{ borderColor: 'var(--ios-glass-border)' }}
            >
              <div className="relative z-10">
                <div className="w-10 h-10 ios-squircle bg-[#ff3b30]/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <ArrowDownCircle size={20} strokeWidth={2.5} className="text-[#ff3b30]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ios-text-secondary)' }}>Despesas</p>
                <p className="text-xl font-black text-[#ff3b30] leading-none">-{formatCurrency(monthlyStats.expense)}</p>
              </div>
            </div>

            {/* Card: Cartões */}
            <div
              onClick={() => onChangeView('finance')}
              className="group ios-glass ios-squircle p-5 shadow-sm hover:shadow-xl border transition-all cursor-pointer relative overflow-hidden active:scale-95"
              style={{ borderColor: 'var(--ios-glass-border)' }}
            >
              <div className="relative z-10">
                <div className="w-10 h-10 ios-squircle bg-[#34c759]/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <CreditCard size={20} strokeWidth={2.5} className="text-[#34c759]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ios-text-secondary)' }}>Uso Cartão</p>
                <p className="text-xl font-black leading-none" style={{ color: 'var(--ios-text)' }}>{formatCurrency(monthlyCardUsed)}</p>
                {totalCardLimit > 0 && (
                  <div className="mt-3 w-full bg-black/10 rounded-full h-1">
                    <div
                      className="h-full rounded-full bg-[#34c759] transition-all duration-1000"
                      style={{ width: `${cardUsagePct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Card: Resultado Mês */}
            <div
              onClick={() => onChangeView('analytics')}
              className={`group ios-glass ios-squircle p-5 shadow-sm hover:shadow-xl border transition-all cursor-pointer active:scale-95 ${monthBalance >= 0 ? 'bg-[#007aff]/5' : 'bg-[#ff3b30]/5'}`}
              style={{ borderColor: 'var(--ios-glass-border)' }}
            >
              <div className="relative z-10">
                <div className={`w-10 h-10 ios-squircle flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${monthBalance >= 0 ? 'bg-[#007aff]/20' : 'bg-[#ff3b30]/20'}`}>
                  {monthBalance >= 0 ? <TrendingUp size={20} strokeWidth={2.5} className="text-[#007aff]" /> : <TrendingDown size={20} strokeWidth={2.5} className="text-[#ff3b30]" />}
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ios-text-secondary)' }}>Balanço</p>
                <p className={`text-xl font-black leading-none ${monthBalance >= 0 ? 'text-[#007aff]' : 'text-[#ff3b30]'}`}>
                  {monthBalance >= 0 ? '+' : ''}{formatCurrency(monthBalance)}
                </p>
              </div>
            </div>

            {/* Card: Contas a Pagar */}
            <div
              onClick={() => onChangeView('agenda')}
              className={`group ios-glass ios-squircle p-5 shadow-sm hover:shadow-xl border transition-all cursor-pointer active:scale-95 ${globalPendingStats.overduePayable > 0 ? 'bg-[#ff3b30]/10' : ''}`}
              style={{ borderColor: 'var(--ios-glass-border)' }}
            >
              <div className="relative z-10">
                <div className={`w-10 h-10 ios-squircle flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${globalPendingStats.overduePayable > 0 ? 'bg-[#ff3b30]/20' : 'bg-black/5'}`}>
                  <Clock size={20} strokeWidth={2.5} className={globalPendingStats.overduePayable > 0 ? 'text-[#ff3b30]' : 'text-[#ff9500]'} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--ios-text-secondary)' }}>A Pagar</p>
                <p className="text-xl font-black leading-none" style={{ color: globalPendingStats.overduePayable > 0 ? '#ff3b30' : 'var(--ios-text)' }}>
                  {formatCurrency(globalPendingStats.overduePayable > 0 ? globalPendingStats.overduePayable : globalPendingStats.totalPayable)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO: Próximos Vencimentos e Projeção de Dívidas ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Próximos Pagamentos */}
        <div className="ios-glass ios-squircle-lg border shadow-sm p-5" style={{ borderColor: 'var(--ios-glass-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--ios-text)' }}>
              <Calendar size={18} className="text-[#ff2d55]" /> Próximas Contas
            </h3>
            <button onClick={() => onChangeView('agenda')} className="text-xs font-black text-[#007aff] hover:underline uppercase tracking-tight">Ver tudo</button>
          </div>
          <div className="space-y-3">
            {globalPendingStats.upcoming.length > 0 ? globalPendingStats.upcoming.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-white/5 ios-squircle-md border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                <div className="flex flex-col">
                  <span className="text-xs font-bold truncate max-w-[140px]" style={{ color: 'var(--ios-text)' }}>{t.description}</span>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--ios-text-secondary)' }}>{formatDate(t.date)}</span>
                </div>
                <span className="font-black text-sm" style={{ color: 'var(--ios-text)' }}>{formatCurrency(t.amount)}</span>
              </div>
            )) : (
              <div className="py-8 text-center text-xs italic" style={{ color: 'var(--ios-text-secondary)' }}>Nenhum pagamento pendente.</div>
            )}
          </div>
        </div>

        {/* Projeção de Dívida Mensal */}
        <div className="ios-glass ios-squircle-lg border shadow-sm p-5" style={{ borderColor: 'var(--ios-glass-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--ios-text)' }}>
              <Activity size={18} className="text-[#ff3b30]" /> Dívidas por Mês
            </h3>
            <button onClick={() => onChangeView('projections')} className="text-xs font-black text-[#007aff] hover:underline uppercase tracking-tight">Projeção detalhada</button>
          </div>
          <div className="flex items-end justify-between h-32 gap-2 pt-2">
            {monthlyDebtProjection.map((m, i) => {
              const maxDebt = Math.max(...monthlyDebtProjection.map(x => x.amount), 1);
              const height = (m.amount / maxDebt) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative group">
                    <div
                      className="w-full bg-[#ff3b30]/10 rounded-t-lg group-hover:bg-[#ff3b30]/20 transition-all duration-500"
                      style={{ height: `${Math.max(height, 5)}%` }}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[var(--ios-text)] text-[var(--ios-bg)] text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-bold">
                        {formatCurrency(m.amount)}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--ios-text-secondary)] uppercase">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── GRÁFICO: Evolução dos últimos 7 dias ─────────────────────────── */}
      <div className="ios-glass ios-squircle-lg border shadow-sm overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--ios-glass-border)' }}>
          <div>
            <h3 className="font-bold" style={{ color: 'var(--ios-text)' }}>Evolução das despesas</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ios-text-secondary)' }}>Visão de {monthLabel}</p>
          </div>
          <button onClick={() => onChangeView('analytics')} className="text-[#007aff] text-xs font-black hover:underline flex items-center gap-1 uppercase tracking-tight">
            Ver análise <ArrowRight size={12} />
          </button>
        </div>
        <div className="p-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff3b30" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ff3b30" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#007aff" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#007aff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ios-glass-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--ios-text-secondary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--ios-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--ios-glass-border)', backgroundColor: 'var(--ios-card-bg)', backdropFilter: 'blur(10px)', color: 'var(--ios-text)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px' }}
                itemStyle={{ color: 'var(--ios-text)' }}
                formatter={(v: number, name: string) => [formatCurrency(v), name === 'despesas' ? 'Despesas' : 'Receitas']}
              />
              <Area type="monotone" dataKey="receitas" stroke="#007aff" strokeWidth={2} fill="url(#gradReceita)" dot={{ r: 3, fill: '#007aff', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="despesas" stroke="#ff3b30" strokeWidth={2} fill="url(#gradDespesa)" dot={{ r: 3, fill: '#ff3b30', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── GRID: Atividade Recente + Maiores Gastos ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Atividade recente */}
        <div className="lg:col-span-3 ios-glass ios-squircle-lg border shadow-sm overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--ios-glass-border)' }}>
            <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--ios-text)' }}>
              <Activity size={16} className="text-[#5856d6]" /> Atividade Recente
            </h3>
            <button onClick={() => onChangeView('movements')} className="text-[#007aff] text-xs font-black hover:underline flex items-center gap-1 uppercase tracking-tight">
              Ver tudo <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--ios-glass-border)' }}>
            {recentTransactions.length > 0 ? recentTransactions.map(t => {
              const cat = categories.find(c => c.id === t.category_id);
              return (
                <div key={t.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-black/5 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (cat?.color || (t.type === 'RECEITA' ? '#34c759' : '#ff3b30')) + '18' }}
                    >
                      {t.type === 'RECEITA'
                        ? <ArrowUpCircle size={17} className="text-[#34c759]" />
                        : <ArrowDownCircle size={17} className="text-[#ff3b30]" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm leading-tight" style={{ color: 'var(--ios-text)' }}>{t.description}</p>
                      <p className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>{formatDate(t.date)} · {cat?.name || 'Geral'}</p>
                    </div>
                  </div>
                  <span className={`font-black text-sm ${t.type === 'RECEITA' ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                    {t.type === 'RECEITA' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              );
            }) : (
              <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--ios-text-secondary)' }}>Nenhuma atividade encontrada.</div>
            )}
          </div>
        </div>

        {/* Maiores Gastos */}
        <div className="lg:col-span-2 ios-glass ios-squircle-lg border shadow-sm overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--ios-glass-border)' }}>
            <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--ios-text)' }}>
              <TrendingUp size={16} className="text-[#ff9500]" /> Maiores Gastos
            </h3>
            <span className="text-xs capitalize font-bold" style={{ color: 'var(--ios-text-secondary)' }}>{currentMonth.toLocaleString('pt-BR', { month: 'short' })}</span>
          </div>
          <div className="p-5 space-y-4">
            {topCategories.length > 0 ? topCategories.map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-bold" style={{ color: 'var(--ios-text)' }}>{cat.name}</span>
                  </div>
                  <span className="text-sm font-black" style={{ color: 'var(--ios-text)' }}>{formatCurrency(cat.amount)}</span>
                </div>
                <div className="w-full bg-[var(--ios-text-secondary)]/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min((cat.amount / (monthlyStats.expense || 1)) * 100, 100)}%`,
                      backgroundColor: cat.color
                    }}
                  />
                </div>
              </div>
            )) : (
              <p className="text-sm text-center py-6 font-bold" style={{ color: 'var(--ios-text-secondary)' }}>Sem gastos registrados neste mês.</p>
            )}
          </div>

          {/* Dica financeira */}
          <div className={`mx-4 mb-4 p-4 rounded-xl text-[10px] font-black uppercase tracking-tight ${monthBalance >= 0 ? 'bg-[#34c759]/10 text-[#34c759]' : 'bg-[#ff3b30]/10 text-[#ff3b30] animate-overdue'}`}>
            {monthBalance >= 0
              ? '✅ Resultado Positivo! Considere planejar seus sonhos.'
              : '⚠️ Alerta: Despesas maiores que receitas. Reveja seus hábitos.'}
          </div>
        </div>
      </div>

      <SupabaseSync />
    </div>
  );
}

// ─── InsightCard sub-component ───────────────────────────────────────────────
const InsightCard: React.FC<{
  insight: Insight;
  onDismiss: (id: string) => void;
  onClick: (view: string) => void;
}> = ({ insight, onDismiss, onClick }) => {
  const severityStyles: Record<InsightSeverity, string> = {
    CRITICAL: 'bg-[#ff3b30]/10 border-l-4 border-l-[#ff3b30]',
    WARNING: 'bg-[#ff9500]/10 border-l-4 border-l-[#ff9500]',
    INFO: 'bg-[var(--ios-text-secondary)]/10 border-l-4 border-l-[var(--ios-text-secondary)]',
  };

  return (
    <div
      onClick={() => insight.targetView && onClick(insight.targetView)}
      className={`flex items-start gap-3 px-4 py-3.5 ${severityStyles[insight.severity]} transition-all ${insight.targetView ? 'cursor-pointer hover:brightness-125 active:scale-[0.99]' : ''}`}
    >
      <span className="text-base shrink-0 mt-0.5">{insight.icon}</span>
      <div className="flex-1">
        <p className="text-xs font-bold leading-relaxed" style={{ color: 'var(--ios-text)' }}>
          {insight.message}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(insight.id);
        }}
        className="shrink-0 p-1 rounded-full hover:bg-black/20 transition-colors"
        style={{ color: 'var(--ios-text-secondary)' }}
        aria-label="Dispensar insight"
      >
        <XIcon size={13} />
      </button>
    </div>
  );
}
