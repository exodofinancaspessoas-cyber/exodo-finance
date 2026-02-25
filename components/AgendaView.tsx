
import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock, CheckCircle2, AlertCircle, Calendar, Filter, ChevronRight, ChevronLeft,
    MoreHorizontal, Check, TrendingUp, TrendingDown, Clock3,
    CalendarDays, List, Search, ArrowRight, Wallet
} from 'lucide-react';
import { Transaction, Category, Account, Card } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate, toISODate, isSameMonth } from '../utils';

type AgendaTab = 'pendentes' | 'atrasadas' | 'liquidadas';
type ViewMode = 'list' | 'timeline' | 'calendar';

export default function AgendaView() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);

    const [activeTab, setActiveTab] = useState<AgendaTab>('pendentes');
    const [viewMode, setViewMode] = useState<ViewMode>('timeline');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [payingTransaction, setPayingTransaction] = useState<Transaction | null>(null);
    const [selectedAccountForPayment, setSelectedAccountForPayment] = useState<string>('');
    const [interestAmount, setInterestAmount] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(toISODate(new Date()));
    const [paymentMethod, setPaymentMethod] = useState<string>('DEBITO');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [trxs, cats, accs, crds] = await Promise.all([
            StorageService.getTransactions(),
            StorageService.getCategories(),
            StorageService.getAccounts(),
            StorageService.getCards()
        ]);
        setTransactions(trxs);
        setCategories(cats);
        setAccounts(accs);
        setCards(crds);
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleMarkAsPaid = async (transaction: Transaction) => {
        setPayingTransaction(transaction);
        setSelectedAccountForPayment(transaction.account_id || accounts[0]?.id || '');
        setInterestAmount('0');
        setPaymentDate(toISODate(new Date()));
        setPaymentMethod(transaction.payment_method || 'DEBITO');
    };

    const confirmPaymentWithAccount = async () => {
        if (!payingTransaction) return;

        const updatedStatus = payingTransaction.type === 'RECEITA' ? 'RECEBIDA' : 'PAGA';
        const updated: Transaction = {
            ...payingTransaction,
            status: updatedStatus,
            date: paymentDate,
            payment_method: paymentMethod as any,
            account_id: selectedAccountForPayment || undefined,
            interest_amount: interestAmount ? parseFloat(interestAmount.replace(',', '.')) : (payingTransaction.interest_amount || 0)
        };
        await StorageService.saveTransaction(updated);
        setPayingTransaction(null);
        loadData();
    };

    const getCategory = (id: string) => categories.find(c => c.id === id);
    const getAccountOrCard = (t: Transaction) => {
        if (t.card_id) return cards.find(c => c.id === t.card_id)?.name || 'Cartão';
        return accounts.find(a => a.id === t.account_id)?.name || 'Conta';
    };

    const filteredData = useMemo(() => {
        const today = toISODate(new Date());

        return transactions.filter(t => {
            if (t.status === 'EXCLUIDA') return false;

            // Matches Search
            if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            const trxDate = new Date(t.date);
            const isTrxInMonth = isSameMonth(trxDate, currentMonth);

            if (activeTab === 'pendentes') {
                return isTrxInMonth && (t.status === 'PREVISTA' || t.status === 'CONFIRMADA') && t.date >= today;
            }
            if (activeTab === 'atrasadas') {
                return (t.status === 'PREVISTA' || t.status === 'CONFIRMADA' || t.status === 'ATRASADA') && t.date < today;
            }
            if (activeTab === 'liquidadas') {
                return isTrxInMonth && (t.status === 'PAGA' || t.status === 'RECEBIDA');
            }
            return false;
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [transactions, activeTab, currentMonth, searchTerm]);

    const stats = useMemo(() => {
        const today = toISODate(new Date());
        const currentMonthTrxs = transactions.filter(t => t.status !== 'EXCLUIDA' && isSameMonth(new Date(t.date), currentMonth));

        const balance = {
            pending_income: 0,
            pending_expense: 0,
            paid_income: 0,
            paid_expense: 0,
            overdue: 0
        };

        transactions.forEach(t => {
            if (t.status === 'EXCLUIDA') return;
            const trxInMonth = isSameMonth(new Date(t.date), currentMonth);

            const isOverdue = (t.status === 'PREVISTA' || t.status === 'CONFIRMADA' || t.status === 'ATRASADA') && t.date < today;
            if (isOverdue) {
                const total = t.amount + (t.interest_amount || 0);
                balance.overdue += t.type === 'RECEITA' ? total : -total;
            }

            if (trxInMonth) {
                if (t.status === 'PAGA' || t.status === 'RECEBIDA') {
                    if (t.type === 'RECEITA') balance.paid_income += t.amount;
                    else balance.paid_expense += t.amount;
                } else if (t.date >= today) {
                    if (t.type === 'RECEITA') balance.pending_income += (t.amount + (t.interest_amount || 0));
                    else balance.pending_expense += (t.amount + (t.interest_amount || 0));
                }
            }
        });

        return balance;
    }, [transactions, currentMonth]);

    const groupedData = useMemo(() => {
        if (viewMode === 'list') return [{ title: 'Lista Geral', data: filteredData }];

        const groups: Record<string, Transaction[]> = {};
        const todayStr = toISODate(new Date());

        filteredData.forEach(t => {
            let key = t.date;
            if (t.date === todayStr) key = 'Hoje';
            else if (t.date < todayStr) key = 'Em Atraso';

            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });

        return Object.entries(groups).map(([title, data]) => ({ title, data }));
    }, [filteredData, viewMode]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Summary */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center shrink-0 shadow-sm border border-rose-100">
                        <CalendarDays size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                            Agenda Financeira
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">Controle o que entra e o que sai com precisão.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Seletor de Mês */}
                    <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                        <button
                            onClick={prevMonth}
                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="px-4 text-center min-w-[140px]">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Mês de Análise</span>
                            <span className="text-sm font-bold text-slate-700 capitalize">
                                {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                        <button
                            onClick={nextMonth}
                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            title="Lista Simples"
                        >
                            <List size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`p-2.5 rounded-xl transition-all ${viewMode === 'timeline' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            title="Linha do Tempo"
                        >
                            <Clock3 size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`p-2.5 rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            title="Calendário Mensal"
                        >
                            <Calendar size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 group hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">A Receber</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{formatCurrency(stats.pending_income)}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 group hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><TrendingDown size={20} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">A Pagar</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{formatCurrency(stats.pending_expense)}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 group hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><AlertCircle size={20} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Atrasado</span>
                    </div>
                    <p className={`text-2xl font-black ${stats.overdue < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(Math.abs(stats.overdue))}
                    </p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 group hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-slate-50 text-slate-600 rounded-xl"><CheckCircle2 size={20} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Realizado (Líquido)</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{formatCurrency(stats.paid_income - stats.paid_expense)}</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200">
                <div className="flex overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('pendentes')}
                        className={`px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'pendentes' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        A Pagar/Receber
                    </button>
                    <button
                        onClick={() => setActiveTab('atrasadas')}
                        className={`px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'atrasadas' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        Vencidas/Atrasadas
                    </button>
                    <button
                        onClick={() => setActiveTab('liquidadas')}
                        className={`px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'liquidadas' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        Pagos/Recebidos
                    </button>
                </div>

                <div className="flex items-center gap-3 py-2 md:py-0">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-600 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar na agenda..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-rose-500 transition-all w-full md:w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div className="space-y-8">
                {viewMode === 'calendar' ? (
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-700">
                        {/* Calendar Week Header */}
                        <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 border-l border-t border-transparent">
                            {(() => {
                                const year = currentMonth.getFullYear();
                                const month = currentMonth.getMonth();
                                const firstDay = new Date(year, month, 1).getDay();
                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                const todayStr = toISODate(new Date());

                                const cells = [];
                                // Padding start
                                for (let i = 0; i < firstDay; i++) {
                                    cells.push(<div key={`pad-start-${i}`} className="min-h-[100px] md:min-h-[140px] bg-slate-50/30" />);
                                }

                                // Days of month
                                for (let d = 1; d <= daysInMonth; d++) {
                                    const dateStr = toISODate(new Date(year, month, d));
                                    const isToday = dateStr === todayStr;
                                    const dayTrxs = transactions.filter(t => t.date === dateStr && t.status !== 'EXCLUIDA');

                                    cells.push(
                                        <div key={dateStr} className={`min-h-[100px] md:min-h-[140px] p-2 hover:bg-slate-50/50 transition-colors group relative ${isToday ? 'bg-rose-50/20' : ''}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-rose-600 text-white shadow-md shadow-rose-200 scale-110' : 'text-slate-400 group-hover:text-slate-900 group-hover:bg-slate-100'}`}>
                                                    {d}
                                                </span>
                                            </div>

                                            <div className="space-y-1 overflow-y-auto max-h-[80px] md:max-h-[100px] no-scrollbar">
                                                {dayTrxs.map(t => {
                                                    const isPaid = t.status === 'PAGA' || t.status === 'RECEBIDA';
                                                    return (
                                                        <button
                                                            key={t.id}
                                                            onClick={!isPaid ? () => handleMarkAsPaid(t) : undefined}
                                                            className={`w-full p-1 rounded-md text-[9px] font-bold truncate text-left transition-all ${isPaid
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 opacity-60'
                                                                : t.type === 'RECEITA'
                                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:scale-[1.02]'
                                                                    : 'bg-rose-50 text-rose-700 border border-rose-100 hover:scale-[1.02] active:bg-rose-100'
                                                                }`}
                                                            title={`${t.description}: ${formatCurrency(t.amount)}`}
                                                        >
                                                            {t.description}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }

                                // Padding end
                                const totalCellsSoFar = firstDay + daysInMonth;
                                const padEnd = (7 - (totalCellsSoFar % 7)) % 7;
                                for (let i = 0; i < padEnd; i++) {
                                    cells.push(<div key={`pad-end-${i}`} className="min-h-[100px] md:min-h-[140px] bg-slate-50/30" />);
                                }

                                return cells;
                            })()}
                        </div>
                    </div>
                ) : (
                    groupedData.length === 0 || (groupedData.length === 1 && groupedData[0].data.length === 0) ? (
                        <div className="bg-white py-20 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Calendar className="text-slate-300" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Nada encontrado aqui</h3>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto">Não há lançamentos para este filtro ou período selecionado.</p>
                        </div>
                    ) : (
                        groupedData.map((group, idx) => (
                            <div key={idx} className="space-y-3">
                                {viewMode === 'timeline' && (
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                                        <div className="w-1 h-3 bg-rose-600 rounded-full"></div>
                                        {group.title === 'Hoje' ? (
                                            <span className="text-rose-600">Para Hoje</span>
                                        ) : group.title === 'Em Atraso' ? (
                                            <span className="text-rose-600">Em Atraso</span>
                                        ) : (
                                            formatDate(group.title) || group.title
                                        )}
                                    </h3>
                                )}

                                <div className="grid grid-cols-1 gap-3">
                                    {group.data.map(trx => {
                                        const cat = getCategory(trx.category_id || '');
                                        const source = getAccountOrCard(trx);
                                        const isPaid = trx.status === 'PAGA' || trx.status === 'RECEBIDA';

                                        return (
                                            <div
                                                key={trx.id}
                                                className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 hover:border-rose-200 transition-all group active:scale-[0.98]"
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        {/* Type Indicator */}
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${trx.type === 'RECEITA' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'
                                                            }`}>
                                                            {trx.type === 'RECEITA' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <h4 className="font-bold text-slate-800 truncate">{trx.description}</h4>
                                                                {trx.installments && (
                                                                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                                                                        {trx.installments.current}/{trx.installments.total}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#94a3b8' }}></div>
                                                                    {cat?.name || 'Geral'}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                                                                    <Wallet size={12} className="text-slate-400" />
                                                                    {source}
                                                                </div>
                                                                {viewMode === 'list' && (
                                                                    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                                                                        <Calendar size={12} />
                                                                        {formatDate(trx.date)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className={`font-black text-lg ${trx.type === 'RECEITA' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                            {trx.type === 'DESPESA' ? '-' : ''}{formatCurrency(trx.amount + (trx.interest_amount || 0))}
                                                        </p>
                                                        {trx.interest_amount > 0 && (
                                                            <p className="text-[9px] text-indigo-500 font-bold -mt-1">+ {formatCurrency(trx.interest_amount)} juros</p>
                                                        )}
                                                        <span className={`text-[10px] font-black tracking-tighter uppercase px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-700' :
                                                            trx.date < toISODate(new Date()) ? 'bg-rose-100 text-rose-700' : 'bg-rose-100 text-rose-700'
                                                            }`}>
                                                            {trx.status}
                                                        </span>
                                                    </div>

                                                    {!isPaid && (
                                                        <button
                                                            onClick={() => handleMarkAsPaid(trx)}
                                                            className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center hover:scale-110 active:scale-90"
                                                            title="Confirmar Pagamento"
                                                        >
                                                            <Check size={20} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>

            {/* Modal de Quitação de Lançamento (Design Pro Max) */}
            {payingTransaction && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in duration-300 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 border border-slate-100">
                        {/* Header do Modal */}
                        <div className="p-8 pb-6">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-inner">
                                    <CheckCircle2 size={32} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-xl font-black text-slate-900 leading-tight">Quitar Lançamento</h3>
                                    <p className="text-slate-500 text-sm truncate font-medium">{payingTransaction.description}</p>
                                </div>
                            </div>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter">
                                {formatCurrency(payingTransaction.amount)}
                            </p>
                        </div>

                        {/* Corpo do Modal */}
                        <div className="px-8 pb-8 space-y-5">
                            <div className="space-y-4">
                                {/* Data do Pagamento */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Data do Pagamento</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Forma de Pagamento */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Forma de Pagamento</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="DEBITO">Débito em Conta</option>
                                        <option value="PIX">Transferência / PIX</option>
                                        <option value="DINHEIRO">Dinheiro Espécie</option>
                                        <option value="BOLETO">Boleto Bancário</option>
                                        {payingTransaction.card_id && <option value="CREDITO">Cartão de Crédito</option>}
                                    </select>
                                </div>

                                {/* Conta de Saída */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">De qual conta saiu?</label>
                                    <select
                                        value={selectedAccountForPayment}
                                        onChange={(e) => setSelectedAccountForPayment(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Selecione uma conta...</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.current_balance)})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Juros / Multas */}
                                <div>
                                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1 mb-2 block">Juros ou Multas Pagas (R$)</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400">
                                            <TrendingUp size={16} />
                                        </div>
                                        <input
                                            type="text"
                                            value={interestAmount}
                                            onChange={(e) => setInterestAmount(e.target.value)}
                                            placeholder="0,00"
                                            className="w-full bg-indigo-50/50 border-2 border-indigo-100/50 rounded-2xl pl-10 pr-4 py-3.5 text-sm font-bold text-indigo-700 focus:border-indigo-400 focus:bg-white outline-none transition-all"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1">Este valor será somado ao total para fins de fluxo de caixa.</p>
                                </div>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex flex-col gap-3 pt-4">
                                <button
                                    onClick={confirmPaymentWithAccount}
                                    disabled={!selectedAccountForPayment}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:grayscale text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 text-base"
                                >
                                    Confirmar Quitação
                                </button>
                                <button
                                    onClick={() => setPayingTransaction(null)}
                                    className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

