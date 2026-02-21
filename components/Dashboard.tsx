
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpCircle, ArrowDownCircle, Wallet, Activity,
  Plus, ArrowRight, Loader2, ArrowRightLeft, TrendingUp,
  TrendingDown, Landmark, CreditCard, ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate, toISODate, parseSafeDate } from '../utils';
import { Account, Card, Transaction, Category, Transfer, TransactionStatus } from '../types';
import SupabaseSync from './SupabaseSync';
import { AlertCircle, Smartphone } from 'lucide-react';

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
  }>({ transactions: [], categories: [], accounts: [], cards: [], transfers: [] });
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
      const [trxs, cats, accs, crds, trs] = await Promise.all([
        StorageService.getTransactions(),
        StorageService.getCategories(),
        StorageService.getAccounts(),
        StorageService.getCards(),
        StorageService.getTransfers(),
      ]);
      setData({ transactions: trxs, categories: cats, accounts: accs, cards: crds, transfers: trs });
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    onChangeMonth(next);
  };

  const handleNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    onChangeMonth(next);
  };

  const handleCurrentMonth = () => {
    onChangeMonth(new Date());
  };

  const { transactions, categories, accounts, transfers } = data;

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

    // Transações antes do mês
    const beforeTrx = transactions.filter(t => {
      const p = parseSafeDate(t.date);
      if (!p) return false;
      const tDate = new Date(p.y, p.m - 1, p.d);
      return tDate < firstDayOfMonth && isRealized(t);
    });

    const income = beforeTrx.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
    const expense = beforeTrx.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);

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
      return p && p.y === y && (p.m - 1) === m && isRealized(t);
    });

    const income = withinTrx.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
    const expense = withinTrx.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);

    return monthBeginBalance + income - expense;
  }, [transactions, monthBeginBalance, currentMonth]);

  // 4. Saldo PREVISTO no Final do mês selecionado (Realizadas + Previstas/Atrasadas do mês)
  const monthProjectedBalance = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();

    const pendingTrx = transactions.filter(t => {
      const p = parseSafeDate(t.date);
      const isPending = t.status === 'PREVISTA' || t.status === 'ATRASADA';
      return p && p.y === y && (p.m - 1) === m && isPending && t.status !== 'EXCLUIDA';
    });

    const pendingIncome = pendingTrx.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
    const pendingExpense = pendingTrx.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);

    return monthEndBalance + pendingIncome - pendingExpense;
  }, [transactions, monthEndBalance, currentMonth]);

  // ── Stats do mês (Fluxo de Lançamentos) ──────────────────────────────────────
  const monthlyStats = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const filtered = transactions.filter(t => {
      const p = parseSafeDate(t.date);
      return p && p.y === y && (p.m - 1) === m && t.status !== 'EXCLUIDA';
    });
    const income = filtered.filter(t => t.type === 'RECEITA').reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'DESPESA').reduce((s, t) => s + t.amount, 0);
    return { income, expense };
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

      const dayTrxs = transactions.filter(t => t.date === dateStr && t.status !== 'EXCLUIDA');
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

  // ── Progress do saldo entre inicial → atual → previsto ───────────────────
  // Para evitar saltos visuais estranhos, usamos o saldo de início como base 0 na barra se necessário, 
  // mas aqui mantemos a lógica de progressão absoluta.
  const maxVal = Math.max(Math.abs(monthBeginBalance), Math.abs(monthEndBalance), Math.abs(monthProjectedBalance), 1);
  const currentPct = Math.max(0, Math.min(100, ((monthEndBalance - monthBeginBalance) / (maxVal * 2 + 1)) * 100 + 50));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 size={40} className="animate-spin mb-4" />
        <p className="font-medium">Carregando seus dados...</p>
      </div>
    );
  }

  const monthLabel = currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // ── Saldo atual positivo ou negativo ─────────────────────────────────────
  const isPositive = monthEndBalance >= 0;
  const monthBalance = monthlyStats.income - monthlyStats.expense;

  return (
    <div className={`animate-fade-in space-y-6 pb-20 transition-all duration-300 ${isTransitioning ? 'opacity-50 scale-[0.99] grayscale-[0.2]' : 'opacity-100 scale-100'}`}>

      {/* ── ALERTA: Lançamentos Incompletos ───────────────────────────────── */}
      {incompleteTransactions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-pulse-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Lançamentos Incompletos</h4>
              <p className="text-xs text-amber-700 font-medium">{incompleteTransactions.length} item(s) aguardando detalhes (categoria, conta, etc)</p>
            </div>
          </div>
          <button
            onClick={() => onChangeView('movements_incomplete')}
            className="px-4 py-2 bg-amber-600 text-white text-[10px] font-black rounded-xl hover:bg-amber-700 transition-all uppercase tracking-widest shadow-lg shadow-amber-900/10"
          >
            Completar agora
          </button>
        </div>
      )}

      {/* ── HERO: Linha de Saldo ─────────────────────────────────────────── */}
      <div id="hero-balance" className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 overflow-hidden shadow-2xl shadow-slate-900/30">
        {/* Orbs decorativos */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header do hero */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center justify-between w-full">
              <div>
                <h1 className="text-white font-bold text-lg">
                  Olá, {user?.name?.split(' ')[0] || 'Visitante'} 👋
                </h1>
                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Seu resumo financeiro</p>
              </div>

              {/* Seletor de Mês Simplificado */}
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 backdrop-blur-md">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all active:scale-90"
                  title="Mês Anterior"
                >
                  <ChevronLeft size={16} />
                </button>

                <button
                  onClick={handleCurrentMonth}
                  className="px-3 py-1.5 flex items-center gap-2 group transition-all"
                >
                  <Calendar size={14} className="text-orange-500 group-hover:scale-110 transition-transform" />
                  <span className="text-white text-xs font-black capitalize min-w-[100px] text-center">
                    {monthLabel}
                  </span>
                </button>

                <button
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all active:scale-90"
                  title="Próximo Mês"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="hidden md:flex gap-2">
                <button onClick={() => onChangeView('movements')} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-orange-900/20 active:scale-95">
                  <Plus size={13} /> Novo Lançamento
                </button>
              </div>
            </div>
          </div>

          {/* Saldo atual central */}
          <div className="text-center mb-6">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Saldo Final do Mês</p>
            <h2 className={`text-4xl font-black tracking-tight ${isPositive ? 'text-white' : 'text-red-400'}`}>
              {formatCurrency(monthEndBalance)}
            </h2>
            <div className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-bold ${monthBalance >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {monthBalance >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {monthBalance >= 0 ? '+' : ''}{formatCurrency(monthBalance)} no mês
            </div>
          </div>

          {/* Track: Inicial ──●── Atual ─ ─ ─ ○ Previsto */}
          <div className="relative">
            {/* Linha de fundo */}
            <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-white/10 rounded-full" />
            {/* Linha preenchida */}
            <div
              className="absolute top-3.5 left-0 h-0.5 bg-indigo-400 rounded-full transition-all duration-700"
              style={{ width: `${currentPct}%` }}
            />
            {/* Linha prevista (tracejada) */}
            <div
              className="absolute top-[13px] h-0.5 border-t border-dashed border-white/20"
              style={{ left: `${currentPct}%`, right: 0 }}
            />

            <div className="flex justify-between relative z-10">
              {/* Inicial */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-indigo-500 border-2 border-indigo-300 flex items-center justify-center shadow-lg shadow-indigo-500/40">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <p className="text-slate-400 text-[10px] font-medium">Início Mês</p>
                <p className="text-white text-xs font-bold">{formatCurrency(monthBeginBalance)}</p>
              </div>

              {/* Atual */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <p className="text-slate-400 text-[10px] font-medium">Fim Mês</p>
                <p className="text-white text-xs font-bold">{formatCurrency(monthEndBalance)}</p>
              </div>

              {/* Previsto */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white/40" />
                </div>
                <p className="text-slate-400 text-[10px] font-medium">Projetado</p>
                <p className="text-white text-xs font-bold">{formatCurrency(monthProjectedBalance)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── VISÃO GERAL — Grid de Cards ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800">Visão Geral</h3>
          <span className="text-xs text-slate-400 capitalize">{monthLabel}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

          {/* Card: Saldo em Contas */}
          <div
            onClick={() => onChangeView('finance')}
            className="group bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-100 hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-blue-50 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                <Landmark size={17} className="text-blue-600" />
              </div>
              <p className="text-xs text-slate-400 font-medium mb-0.5">Saldo do Mês</p>
              <p className="text-lg font-black text-slate-800 leading-tight">{formatCurrency(monthEndBalance)}</p>
              <div className="flex items-center gap-1 mt-2 text-blue-500 text-xs font-semibold">
                <span>Ver contas</span>
                <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Card: Receitas */}
          <div
            onClick={() => onChangeView('movements')}
            className="group bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-100 hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-emerald-50 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                <ArrowUpCircle size={17} className="text-emerald-600" />
              </div>
              <p className="text-xs text-slate-400 font-medium mb-0.5">Receitas</p>
              <p className="text-lg font-black text-emerald-600 leading-tight">+{formatCurrency(monthlyStats.income)}</p>
              <div className="flex items-center gap-1 mt-2 text-emerald-500 text-xs font-semibold">
                <span>Movimentações</span>
                <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Card: Despesas */}
          <div
            onClick={() => onChangeView('movements')}
            className="group bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-red-100 hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-red-50 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center mb-3">
                <ArrowDownCircle size={17} className="text-red-500" />
              </div>
              <p className="text-xs text-slate-400 font-medium mb-0.5">Despesas</p>
              <p className="text-lg font-black text-red-500 leading-tight">-{formatCurrency(monthlyStats.expense)}</p>
              <div className="flex items-center gap-1 mt-2 text-red-400 text-xs font-semibold">
                <span>Movimentações</span>
                <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Card: Cartões — com barra de uso */}
          <div
            onClick={() => onChangeView('finance')}
            className="group bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-orange-100 hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-orange-50 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center mb-3">
                <CreditCard size={17} className="text-orange-500" />
              </div>
              <p className="text-xs text-slate-400 font-medium mb-0.5">Gasto em Cartão</p>
              <p className="text-lg font-black text-slate-800 leading-tight">{formatCurrency(monthlyCardUsed)}</p>
              {totalCardLimit > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${cardUsagePct > 80 ? 'bg-red-500' : cardUsagePct > 50 ? 'bg-orange-400' : 'bg-orange-300'
                        }`}
                      style={{ width: `${cardUsagePct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{cardUsagePct.toFixed(0)}% do limite total</p>
                </div>
              )}
              <div className="flex items-center gap-1 mt-1.5 text-orange-500 text-xs font-semibold">
                <span>Ver cartões</span>
                <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Card: Transferências */}
          <div
            onClick={() => onChangeView('movements')}
            className="group bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-amber-100 hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-amber-50 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                <ArrowRightLeft size={17} className="text-amber-600" />
              </div>
              <p className="text-xs text-slate-400 font-medium mb-0.5">Transferências</p>
              <p className="text-lg font-black text-slate-800 leading-tight">{formatCurrency(transferBalance)}</p>
              <div className="flex items-center gap-1 mt-2 text-amber-500 text-xs font-semibold">
                <span>Movimentações</span>
                <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Card: Resultado do mês */}
          <div
            onClick={() => onChangeView('analytics')}
            className={`group border rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden ${monthBalance >= 0
              ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-200'
              : 'bg-red-50 border-red-100 hover:border-red-200'
              }`}
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-white/30 rounded-full" />
            <div className="relative z-10">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${monthBalance >= 0 ? 'bg-emerald-200' : 'bg-red-200'
                }`}>
                {monthBalance >= 0
                  ? <TrendingUp size={17} className="text-emerald-700" />
                  : <TrendingDown size={17} className="text-red-600" />}
              </div>
              <p className={`text-xs font-medium mb-0.5 ${monthBalance >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}>Resultado do mês</p>
              <p className={`text-lg font-black leading-tight ${monthBalance >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}>
                {monthBalance >= 0 ? '+' : ''}{formatCurrency(monthBalance)}
              </p>
              <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${monthBalance >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                <span>Ver análises</span>
                <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── GRÁFICO: Evolução dos últimos 7 dias ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Evolução das despesas</h3>
            <p className="text-xs text-slate-400 mt-0.5">Visão de {monthLabel}</p>
          </div>
          <button onClick={() => onChangeView('analytics')} className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1">
            Ver análise <ArrowRight size={12} />
          </button>
        </div>
        <div className="p-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px' }}
                formatter={(v: number, name: string) => [formatCurrency(v), name === 'despesas' ? 'Despesas' : 'Receitas']}
              />
              <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fill="url(#gradReceita)" dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} fill="url(#gradDespesa)" dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── GRID: Atividade Recente + Maiores Gastos ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Atividade recente */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Activity size={16} className="text-indigo-500" /> Atividade Recente
            </h3>
            <button onClick={() => onChangeView('movements')} className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1">
              Ver tudo <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentTransactions.length > 0 ? recentTransactions.map(t => {
              const cat = categories.find(c => c.id === t.category_id);
              return (
                <div key={t.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (cat?.color || (t.type === 'RECEITA' ? '#10b981' : '#ef4444')) + '18' }}
                    >
                      {t.type === 'RECEITA'
                        ? <ArrowUpCircle size={17} className="text-emerald-600" />
                        : <ArrowDownCircle size={17} className="text-red-500" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm leading-tight">{t.description}</p>
                      <p className="text-xs text-slate-400">{formatDate(t.date)} · {cat?.name || 'Geral'}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${t.type === 'RECEITA' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {t.type === 'RECEITA' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              );
            }) : (
              <div className="px-5 py-10 text-center text-slate-400 text-sm">Nenhuma atividade encontrada.</div>
            )}
          </div>
        </div>

        {/* Maiores Gastos */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-orange-500" /> Maiores Gastos
            </h3>
            <span className="text-xs text-slate-400 capitalize">{currentMonth.toLocaleString('pt-BR', { month: 'short' })}</span>
          </div>
          <div className="p-5 space-y-4">
            {topCategories.length > 0 ? topCategories.map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">{formatCurrency(cat.amount)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
              <p className="text-sm text-slate-400 text-center py-6">Sem gastos registrados neste mês.</p>
            )}
          </div>

          {/* Dica financeira */}
          <div className={`mx-4 mb-4 p-4 rounded-xl text-xs ${monthBalance >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {monthBalance >= 0
              ? '✅ Você está no azul! Considere investir o excedente.'
              : '⚠️ Despesas maiores que receitas. Reveja os gastos.'}
          </div>
        </div>
      </div>

      <SupabaseSync />
    </div>
  );
}