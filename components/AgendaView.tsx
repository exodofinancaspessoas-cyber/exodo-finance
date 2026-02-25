
import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock, CheckCircle2, AlertCircle, Calendar, Filter, ChevronRight,
    MoreHorizontal, Check, TrendingUp, TrendingDown, Clock3,
    CalendarDays, List, Search, ArrowRight, Wallet
} from 'lucide-react';
import { Transaction, Category, Account, Card } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate, toISODate, isSameMonth } from '../utils';

type AgendaTab = 'pendentes' | 'atrasadas' | 'liquidadas';
type ViewMode = 'list' | 'timeline';

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

    const handleMarkAsPaid = async (transaction: Transaction) => {
        // Se a transação não tiver conta vinculada, precisamos perguntar de onde sai o dinheiro
        if (!transaction.account_id && transaction.type === 'DESPESA' && !transaction.card_id) {
            setPayingTransaction(transaction);
            const defaultAcc = accounts[0]?.id || '';
            setSelectedAccountForPayment(defaultAcc);
            return;
        }

        // Caso seja fatura de cartão (tem card_id), mas não tem conta de pagamento vinculada
        if (transaction.card_id && !transaction.account_id && transaction.type === 'DESPESA') {
            setPayingTransaction(transaction);
            const defaultAcc = accounts[0]?.id || '';
            setSelectedAccountForPayment(defaultAcc);
            return;
        }

        const updatedStatus = transaction.type === 'RECEITA' ? 'RECEBIDA' : 'PAGA';
        const updated: Transaction = {
            ...transaction,
            status: updatedStatus
        };
        await StorageService.saveTransaction(updated);
        loadData(); // Reload to update lists
    };

    const confirmPaymentWithAccount = async () => {
        if (!payingTransaction) return;

        const updatedStatus = payingTransaction.type === 'RECEITA' ? 'RECEBIDA' : 'PAGA';
        const updated: Transaction = {
            ...payingTransaction,
            status: updatedStatus,
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <CalendarDays className="text-rose-600" size={28} />
                        Agenda Financeira
                    </h1>
                    <p className="text-slate-500 text-sm">Controle o que entra e o que sai com precisão.</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Lista Simples"
                    >
                        <List size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('timeline')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'timeline' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Ver por Data"
                    >
                        <Clock3 size={18} />
                    </button>
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
                {groupedData.length === 0 || (groupedData.length === 1 && groupedData[0].data.length === 0) ? (
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
                )}
            </div>

            {/* Modal de Seleção de Conta para Pagamento */}
            {payingTransaction && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 animate-in fade-in duration-200 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Wallet size={32} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">Confirmar Pagamento</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                De qual conta sairá o valor de <span className="font-bold text-slate-900">{formatCurrency(payingTransaction.amount)}</span> para quitar <strong>{payingTransaction.description}</strong>?
                            </p>

                            <div className="space-y-4 text-left">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Selecione a Conta Bancária</label>
                                    <select
                                        value={selectedAccountForPayment}
                                        onChange={(e) => setSelectedAccountForPayment(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-rose-500 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Selecione uma conta...</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.current_balance)})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1 mb-1.5 block">Juros / Multas (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={interestAmount}
                                        onChange={(e) => setInterestAmount(e.target.value)}
                                        placeholder="0,00"
                                        className="w-full bg-indigo-50/30 border-2 border-indigo-100/50 rounded-2xl px-4 py-3 text-sm font-bold text-indigo-700 focus:border-indigo-400 outline-none transition-all appearance-none"
                                    />
                                </div>

                                <div className="flex flex-col gap-2 pt-2">
                                    <button
                                        onClick={confirmPaymentWithAccount}
                                        disabled={!selectedAccountForPayment}
                                        className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl shadow-lg shadow-rose-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Check size={20} />
                                        Confirmar Pagamento
                                    </button>
                                    <button
                                        onClick={() => setPayingTransaction(null)}
                                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-3 rounded-2xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

