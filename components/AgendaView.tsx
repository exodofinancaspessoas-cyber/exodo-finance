
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
        const targetMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

        return transactions.filter(t => {
            if (t.status === 'EXCLUIDA') return false;

            // Matches Search
            if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            const isTrxInMonth = t.date.startsWith(targetMonthKey);

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
        const targetMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthTrxs = transactions.filter(t => t.status !== 'EXCLUIDA' && t.date.startsWith(targetMonthKey));

        const balance = {
            pending_income: 0,
            pending_expense: 0,
            paid_income: 0,
            paid_expense: 0,
            overdue: 0
        };

        transactions.forEach(t => {
            if (t.status === 'EXCLUIDA') return;
            const trxInMonth = t.date.startsWith(targetMonthKey);

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
                    <div className="w-14 h-14 bg-[#ff2d55]/10 text-[#ff2d55] ios-squircle flex items-center justify-center shrink-0 shadow-sm border border-[#ff2d55]/20">
                        <CalendarDays size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-[#5856d6] dark:text-[#7d7aff] uppercase tracking-widest leading-none">Planejamento</span>
                        <h1 className="text-4xl font-black text-[var(--ios-text)] tracking-tight leading-none mt-1">
                            Agenda
                        </h1>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Seletor de Mês */}
                    <div className="flex items-center gap-1 bg-[var(--ios-card-bg)]/80 backdrop-blur-md p-1.5 ios-squircle-sm border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <button
                            onClick={prevMonth}
                            className="w-9 h-9 flex items-center justify-center text-[var(--ios-text-secondary)] hover:text-[#ff2d55] hover:bg-[#ff2d55]/10 ios-squircle transition-all"
                        >
                            <ChevronLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div className="px-4 text-center min-w-[140px]">
                            <span className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest block leading-none mb-1">Período</span>
                            <span className="text-sm font-black text-[var(--ios-text)] capitalize tracking-tight">
                                {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                        <button
                            onClick={nextMonth}
                            className="w-9 h-9 flex items-center justify-center text-[var(--ios-text-secondary)] hover:text-[#ff2d55] hover:bg-[#ff2d55]/10 ios-squircle transition-all"
                        >
                            <ChevronRight size={20} strokeWidth={2.5} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-[var(--ios-card-bg)]/80 backdrop-blur-md p-1.5 ios-squircle-sm border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`w-9 h-9 ios-squircle flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-[var(--ios-text)] text-[var(--ios-bg)] shadow-md' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                            title="Lista"
                        >
                            <List size={20} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`w-9 h-9 ios-squircle flex items-center justify-center transition-all ${viewMode === 'timeline' ? 'bg-[var(--ios-text)] text-[var(--ios-bg)] shadow-md' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                            title="Timeline"
                        >
                            <Clock3 size={20} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`w-9 h-9 ios-squircle flex items-center justify-center transition-all ${viewMode === 'calendar' ? 'bg-[var(--ios-text)] text-[var(--ios-bg)] shadow-md' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                            title="Calendário"
                        >
                            <Calendar size={20} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[var(--ios-card-bg)]/80 backdrop-blur-xl p-5 ios-squircle-sm border group hover:shadow-md transition-all" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 ios-squircle bg-[#34c759]/10 text-[#34c759] flex items-center justify-center"><TrendingUp size={18} strokeWidth={2.5} /></div>
                        <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">A Receber</span>
                    </div>
                    <p className="text-2xl font-black text-[var(--ios-text)] tracking-tight">{formatCurrency(stats.pending_income)}</p>
                </div>
                <div className="bg-[var(--ios-card-bg)]/80 backdrop-blur-xl p-5 ios-squircle-sm border group hover:shadow-md transition-all" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 ios-squircle bg-[#ff3b30]/10 text-[#ff3b30] flex items-center justify-center"><TrendingDown size={18} strokeWidth={2.5} /></div>
                        <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">A Pagar</span>
                    </div>
                    <p className="text-2xl font-black text-[var(--ios-text)] tracking-tight">{formatCurrency(stats.pending_expense)}</p>
                </div>
                <div className="bg-[var(--ios-card-bg)]/80 backdrop-blur-xl p-5 ios-squircle-sm border group hover:shadow-md transition-all" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 ios-squircle bg-[#ff9500]/10 text-[#ff9500] flex items-center justify-center"><AlertCircle size={18} strokeWidth={2.5} /></div>
                        <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">Em Atraso</span>
                    </div>
                    <p className={`text-2xl font-black tracking-tight ${stats.overdue < 0 ? 'text-[#ff3b30]' : 'text-[#34c759]'}`}>
                        {formatCurrency(Math.abs(stats.overdue))}
                    </p>
                </div>
                <div className="bg-[var(--ios-card-bg)]/80 backdrop-blur-xl p-5 ios-squircle-sm border group hover:shadow-md transition-all" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 ios-squircle bg-[#007aff]/10 text-[#007aff] flex items-center justify-center"><CheckCircle2 size={18} strokeWidth={2.5} /></div>
                        <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">Realizado</span>
                    </div>
                    <p className="text-2xl font-black text-[var(--ios-text)] tracking-tight">{formatCurrency(stats.paid_income - stats.paid_expense)}</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b" style={{ borderColor: 'var(--ios-glass-border)' }}>
                <div className="flex overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('pendentes')}
                        className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'pendentes' ? 'border-[#ff2d55] text-[#ff2d55]' : 'border-transparent text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)]'}`}
                    >
                        Pagar/Receber
                    </button>
                    <button
                        onClick={() => setActiveTab('atrasadas')}
                        className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'atrasadas' ? 'border-[#ff9500] text-[#ff9500]' : 'border-transparent text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)]'}`}
                    >
                        Em Atraso
                    </button>
                    <button
                        onClick={() => setActiveTab('liquidadas')}
                        className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'liquidadas' ? 'border-[#34c759] text-[#34c759]' : 'border-transparent text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)]'}`}
                    >
                        Finalizados
                    </button>
                </div>

                <div className="flex items-center gap-3 py-2 md:py-0">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ios-text-secondary)] group-focus-within:text-[#ff2d55] transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-black/5 border-none ios-squircle-sm pl-10 pr-4 py-2 text-xs font-bold text-[var(--ios-text)] focus:ring-1 focus:ring-[#ff2d55]/30 transition-all w-full md:w-48"
                        />
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div className="space-y-8">
                {viewMode === 'calendar' ? (
                    <div className="bg-[var(--ios-card-bg)]/80 backdrop-blur-xl ios-squircle-md border shadow-xl overflow-hidden animate-in fade-in duration-700" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        {/* Calendar Week Header */}
                        <div className="grid grid-cols-7 bg-black/5 border-b" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                <div key={day} className="py-3 text-center text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-white/5 border-l border-t border-transparent" style={{ borderColor: 'var(--ios-glass-border)' }}>
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
                                        <div key={dateStr} className={`min-h-[100px] md:min-h-[140px] p-2 hover:bg-black/5 transition-colors group relative ${isToday ? 'bg-[#ff2d55]/5' : ''}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`text-[10px] font-black w-7 h-7 flex items-center justify-center ios-squircle transition-all ${isToday ? 'bg-[#ff2d55] text-white shadow-lg' : 'text-[var(--ios-text-secondary)] group-hover:text-[var(--ios-text)] group-hover:bg-black/5'}`}>
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
                                                            className={`w-full p-1.5 rounded-lg text-[10px] font-bold truncate text-left transition-all ${isPaid
                                                                ? 'bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/20 opacity-60'
                                                                : t.type === 'RECEITA'
                                                                    ? 'bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/30 hover:scale-[1.02]'
                                                                    : 'bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/30 hover:scale-[1.02]'
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
                        <div className="bg-[var(--ios-card-bg)]/50 backdrop-blur-sm ios-squircle-md border-2 border-dashed p-20 flex flex-col items-center justify-center text-center" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="w-16 h-16 bg-black/5 ios-squircle flex items-center justify-center mb-6 border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <Calendar className="text-[var(--ios-text-secondary)]/30" size={32} />
                            </div>
                            <h3 className="text-xl font-black text-[var(--ios-text)] tracking-tight mb-2">Nada por aqui</h3>
                            <p className="text-[var(--ios-text-secondary)] text-sm font-medium max-w-xs mx-auto">Não há lançamentos para este filtro ou período selecionado.</p>
                        </div>
                    ) : (
                        groupedData.map((group, idx) => (
                            <div key={idx} className="space-y-3">
                                {viewMode === 'timeline' && (
                                    <h3 className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest px-2 flex items-center gap-2 mb-4">
                                        <div className="w-1 h-3 bg-[#ff2d55] rounded-full"></div>
                                        {group.title === 'Hoje' ? (
                                            <span className="text-[#ff2d55]">Para Hoje</span>
                                        ) : group.title === 'Em Atraso' ? (
                                            <span className="text-[#ff3b30]">Em Atraso</span>
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
                                                className="bg-[var(--ios-card-bg)]/80 backdrop-blur-xl p-4 ios-squircle-sm border group hover:shadow-md transition-all active:scale-[0.98] mb-2"
                                                style={{ borderColor: 'var(--ios-glass-border)' }}
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        {/* Type Indicator */}
                                                        <div className={`w-12 h-12 ios-squircle flex items-center justify-center shrink-0 ${trx.type === 'RECEITA' ? 'bg-[#34c759]/10 text-[#34c759]' : 'bg-black/5 text-[var(--ios-text-secondary)]'
                                                            }`}>
                                                            {trx.type === 'RECEITA' ? <TrendingUp size={22} strokeWidth={2.5} /> : <TrendingDown size={22} strokeWidth={2.5} />}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="font-bold text-[var(--ios-text)] truncate">{trx.description}</h4>
                                                                {trx.installments && (
                                                                    <span className="text-[9px] font-black bg-black/5 text-[var(--ios-text-secondary)] px-1.5 py-0.5 ios-squircle-sm border border-[var(--ios-glass-border)]">
                                                                        {trx.installments.current}/{trx.installments.total}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">
                                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat?.color || '#94a3b8' }}></div>
                                                                    {cat?.name || 'Geral'}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">
                                                                    <Wallet size={12} strokeWidth={2.5} />
                                                                    {source}
                                                                </div>
                                                                {viewMode === 'list' && (
                                                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">
                                                                        <Calendar size={12} strokeWidth={2.5} />
                                                                        {formatDate(trx.date)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className={`font-black text-xl tracking-tighter leading-none mb-1 ${trx.type === 'RECEITA' ? 'text-[#34c759]' : 'text-[var(--ios-text)]'}`}>
                                                            {trx.type === 'DESPESA' ? '-' : ''}{formatCurrency(trx.amount + (trx.interest_amount || 0))}
                                                        </p>
                                                        {trx.interest_amount > 0 && (
                                                            <p className="text-[9px] text-[#5856d6] font-black uppercase tracking-widest leading-none mb-2">+ {formatCurrency(trx.interest_amount)} juros</p>
                                                        )}
                                                        <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 ios-squircle-sm ${isPaid ? 'bg-[#34c759]/10 text-[#34c759]' :
                                                            trx.date < toISODate(new Date()) ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : 'bg-[#ff9500]/10 text-[#ff9500]'
                                                            }`}>
                                                            {trx.status}
                                                        </span>
                                                    </div>

                                                    {!isPaid && (
                                                        <button
                                                            onClick={() => handleMarkAsPaid(trx)}
                                                            className="w-10 h-10 ios-squircle bg-black/5 text-[var(--ios-text-secondary)] hover:bg-[#34c759] hover:text-white transition-all flex items-center justify-center shadow-sm border border-transparent hover:border-[#34c759]/20"
                                                            title="Confirmar Pagamento"
                                                        >
                                                            <Check size={22} strokeWidth={2.5} />
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in backdrop-blur-md">
                    <div className="bg-[var(--ios-card-bg)]/95 backdrop-blur-xl ios-squircle-md shadow-2xl w-full max-w-sm overflow-hidden border animate-in zoom-in-95 slide-in-from-bottom-8" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        {/* Header do Modal */}
                        <div className="p-8 pb-6 bg-black/5">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-14 h-14 bg-[#34c759]/10 text-[#34c759] ios-squircle flex items-center justify-center shrink-0 border border-[#34c759]/20">
                                    <CheckCircle2 size={32} strokeWidth={2.5} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-xl font-black text-[var(--ios-text)] tracking-tight leading-none mb-1">Quitar Dados</h3>
                                    <p className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest truncate leading-none">{payingTransaction.description}</p>
                                </div>
                            </div>
                            <p className="text-4xl font-black text-[var(--ios-text)] tracking-tighter leading-none">
                                {formatCurrency(payingTransaction.amount)}
                            </p>
                        </div>

                        {/* Corpo do Modal */}
                        <div className="p-8 space-y-5">
                            <div>
                                {/* Data do Pagamento */}
                                <div>
                                    <label className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest ml-1 mb-2 block">Data do Pagamento</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                            className="w-full bg-black/5 border ios-squircle-sm px-4 py-4 text-sm font-bold text-[var(--ios-text)] outline-none focus:ring-1 focus:ring-[#34c759]/30 transition-all"
                                            style={{ borderColor: 'var(--ios-glass-border)' }}
                                        />
                                    </div>
                                </div>

                                {/* Forma de Pagamento */}
                                <div className="mt-5">
                                    <label className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest ml-1 mb-2 block">Forma de Pagamento</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full bg-black/5 border ios-squircle-sm px-4 py-4 text-sm font-bold text-[var(--ios-text)] outline-none focus:ring-1 focus:ring-[#34c759]/30 transition-all appearance-none cursor-pointer"
                                        style={{ borderColor: 'var(--ios-glass-border)' }}
                                    >
                                        <option value="DEBITO" className="text-black">Débito em Conta</option>
                                        <option value="PIX" className="text-black">PIX</option>
                                        <option value="DINHEIRO" className="text-black">Dinheiro</option>
                                        <option value="BOLETO" className="text-black">Boleto</option>
                                        {payingTransaction.card_id && <option value="CREDITO" className="text-black">Cartão de Crédito</option>}
                                    </select>
                                </div>

                                {/* Conta de Saída */}
                                <div className="mt-5">
                                    <label className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest ml-1 mb-2 block">Conta de Quitação</label>
                                    <select
                                        value={selectedAccountForPayment}
                                        onChange={(e) => setSelectedAccountForPayment(e.target.value)}
                                        className="w-full bg-black/5 border ios-squircle-sm px-4 py-4 text-sm font-bold text-[var(--ios-text)] outline-none focus:ring-1 focus:ring-[#34c759]/30 transition-all appearance-none cursor-pointer"
                                        style={{ borderColor: 'var(--ios-glass-border)' }}
                                    >
                                        <option value="" className="text-black">Selecione uma conta...</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id} className="text-black">{acc.name} ({formatCurrency(acc.current_balance)})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Juros / Multas */}
                                <div className="mt-5">
                                    <label className="text-[10px] font-black text-[#5856d6] dark:text-[#7d7aff] uppercase tracking-widest ml-1 mb-2 block">Acréscimos (Juros/Multas)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#5856d6] dark:text-[#7d7aff]">R$</span>
                                        <input
                                            type="text"
                                            value={interestAmount}
                                            onChange={(e) => setInterestAmount(e.target.value)}
                                            placeholder="0,00"
                                            className="w-full bg-[#5856d6]/5 border ios-squircle-sm pl-11 pr-4 py-4 text-sm font-black text-[#5856d6] dark:text-[#7d7aff] outline-none focus:ring-1 focus:ring-[#5856d6]/30 transition-all"
                                            style={{ borderColor: 'var(--ios-glass-border)' }}
                                        />
                                    </div>
                                    <p className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest mt-2 ml-1 leading-tight">Este valor será somado ao total para efeitos de fluxo de caixa.</p>
                                </div>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex flex-col gap-3 pt-6">
                                <button
                                    onClick={confirmPaymentWithAccount}
                                    disabled={!selectedAccountForPayment}
                                    className="w-full bg-[var(--ios-text)] text-[var(--ios-bg)] disabled:opacity-20 ios-squircle py-5 font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Confirmar Quitação
                                </button>
                                <button
                                    onClick={() => setPayingTransaction(null)}
                                    className="w-full py-4 text-[var(--ios-text-secondary)] font-black text-[10px] uppercase tracking-widest hover:text-[var(--ios-text)] transition-colors"
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

