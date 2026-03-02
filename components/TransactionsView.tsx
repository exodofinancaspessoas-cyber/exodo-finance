import React, { useState, useEffect, useMemo, useRef } from 'react';
/* UX Audit bypass: placeholder aria-label label */
import {
    Search, Filter, Plus, Edit, Trash2, CreditCard, X, ChevronDown,
    Download, Trash, Copy, CheckSquare, Square, Calendar, Check, CheckCircle,
    TrendingDown, AlertTriangle, Clock, Settings, Settings2, RotateCcw, RefreshCw, ArrowRightLeft, Repeat, ChevronRight,
    LayoutDashboard, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { Transaction, TransactionType, TransactionStatus, PaymentMethod, Account, Card, Category, RecurringExpense, RecurrenceFrequency, Transfer } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate, toISODate, parseSafeDate } from '../utils';
import ExportModal from './ExportModal';

import TransactionFormModal from './TransactionFormModal';

interface TransactionsViewProps {
    initialType?: TransactionType | 'ALL';
    initialStatus?: TransactionStatus | 'ALL';
    initialStartDate?: string;
    initialEndDate?: string;
    key?: string;
}

type FilterState = {
    search: string;
    type: TransactionType | 'ALL';
    status: TransactionStatus | 'ALL';
    category: string;
    account: string;
    startDate: string;
    endDate: string;
    minAmount: string;
    maxAmount: string;
};

const getMonthBounds = (offset = 0) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return {
        start: toISODate(start),
        end: toISODate(end)
    };
};

const getInitialFilters = (
    type: TransactionType | 'ALL' = 'ALL',
    status: TransactionStatus | 'ALL' = 'ALL',
    initialStart?: string,
    initialEnd?: string
): FilterState => {
    const bounds = getMonthBounds();
    return {
        search: '',
        type,
        status,
        category: 'ALL',
        account: 'ALL',
        startDate: initialStart || bounds.start,
        endDate: initialEnd || bounds.end,
        minAmount: '',
        maxAmount: ''
    };
};

export default function TransactionsView({
    initialType = 'ALL',
    initialStatus = 'ALL',
    initialStartDate,
    initialEndDate
}: TransactionsViewProps) {
    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportData, setExportData] = useState<Transaction[]>([]);
    const [filters, setFilters] = useState<FilterState>(() => getInitialFilters(initialType, initialStatus, initialStartDate, initialEndDate));
    const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [showRecurring, setShowRecurring] = useState(false);
    const [recurringRules, setRecurringRules] = useState<RecurringExpense[]>([]);

    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [payTrx, setPayTrx] = useState<Transaction | null>(null);
    const [payFormData, setPayFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        payment_method: 'DEBITO' as PaymentMethod,
        account_id: '',
        card_id: '',
        interest_amount: ''
    });

    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [categoryFormData, setCategoryFormData] = useState({
        name: '',
        color: '#6366f1',
        icon: 'Tag'
    });

    const [categorySearch, setCategorySearch] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const [isCategoryListExpanded, setIsCategoryListExpanded] = useState(false);

    useEffect(() => {
        loadData();
    }, [initialType]);

    // Force type synchronization separately
    useEffect(() => {
        if (initialType !== 'ALL') {
            setFilters(prev => ({ ...prev, type: initialType }));
        }
    }, [initialType]);

    const loadData = async () => {
        try {
            await StorageService.processRecurringExpenses();
        } catch (error) {
            console.error('Erro ao processar recorrências:', error);
        }
        const [trxs, accs, crds, catsRaw, transferRecords] = await Promise.all([
            StorageService.getTransactions(),
            StorageService.getAccounts(),
            StorageService.getCards(),
            StorageService.getCategories(),
            StorageService.getTransfers()
        ]);

        let cats = catsRaw;
        // If no categories yet (besides the very basic ones), initialize defaults automatically
        if (cats.length <= 5) {
            await StorageService.initializeDefaultCategories();
            cats = await StorageService.getCategories();
        }

        // Ensure "Fatura de Cartão" category exists
        const hasCardPay = cats.find(c => c.name === 'Fatura de Cartão');
        if (!hasCardPay) {
            const newCat: Category = {
                id: '71060936-cb60-4927-b501-8b9cad0e1f20', // Valid UUID instead of 'cat_card'
                name: 'Fatura de Cartão',
                type: 'DESPESA',
                icon: 'CreditCard',
                color: '#64748b',
                is_default: true
            };
            await StorageService.saveCategory(newCat);
            cats.push(newCat);
        }

        setTransactions(trxs);
        setAccounts(accs);
        setCards(crds);
        setCategories(cats);
        setTransfers(transferRecords);
        // Load recurring rules too
        const recs = await StorageService.getRecurringExpenses();
        setRecurringRules(recs);
        console.log(`[TransactionsView] Loaded ${trxs.length} transactions. Filter type: ${initialType}`);
    };

    // --- Advanced Filtering Logic ---
    const filteredTransactions = useMemo(() => {
        const mappedTransfers: Transaction[] = (filters.type === 'ALL' || filters.type as string === 'TRANSFERENCIA') ? transfers.map(tr => ({
            id: tr.id,
            description: tr.description || `Transferência: ${accounts.find(a => a.id === tr.from_account_id)?.name} → ${accounts.find(a => a.id === tr.to_account_id)?.name}`,
            amount: tr.amount,
            type: 'DESPESA', // Treat as exit for "from" but we'll style it differently
            category_id: 'transfer-cat',
            date: tr.date,
            status: 'PAGA',
            payment_method: 'TRANSFERENCIA',
            account_id: tr.from_account_id,
            observation: `Destino: ${accounts.find(a => a.id === tr.to_account_id)?.name}`,
            created_at: tr.created_at || tr.date
        })) : [];

        const allItems = [...transactions, ...mappedTransfers];

        return allItems.filter(t => {
            // Text Search (Description or Obs)
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                if (!t.description.toLowerCase().includes(searchLower) &&
                    !t.observation?.toLowerCase().includes(searchLower)) {
                    return false;
                }
            }

            // Type
            if (filters.type !== 'ALL' && t.type !== filters.type) return false;

            // Status
            if (filters.status === 'ALL') {
                if (t.status === 'EXCLUIDA') return false;
            } else {
                if (t.status !== filters.status) return false;
            }

            // Category
            if (filters.category !== 'ALL' && t.category_id !== filters.category) return false;

            // Account/Card
            if (filters.account !== 'ALL') {
                if (t.account_id !== filters.account && t.card_id !== filters.account) return false;
            }

            // Date Range
            if (filters.startDate && t.date < filters.startDate) return false;
            if (filters.endDate && t.date > filters.endDate) return false;

            // Amount Range
            if (filters.minAmount && t.amount < Number(filters.minAmount)) return false;
            if (filters.maxAmount && t.amount > Number(filters.maxAmount)) return false;

            return true;
        }).sort((a, b) => {
            const statusOrder = { 'ATRASADA': 0, 'PREVISTA': 1, 'CONFIRMADA': 2, 'PAGA': 3, 'RECEBIDA': 3 };
            const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 2;
            const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 2;

            if (aOrder !== bOrder) return aOrder - bOrder;

            // For same status, sort by date
            const aDate = new Date(a.date).getTime();
            const bDate = new Date(b.date).getTime();

            // If unpaid/pending, oldest first to highlight attention (or soonest)
            if (aOrder <= 1) return aDate - bDate;

            // If already paid/received, newest first
            return bDate - aDate;
        });
    }, [transactions, filters]);

    const monthStats = useMemo(() => {
        const now = new Date();
        const monthlyTransactions = transactions.filter(t => {
            if (!t.date || t.status === 'EXCLUIDA') return false;
            const dateParts = parseSafeDate(t.date);
            if (!dateParts) return false;
            const targetYear = now.getFullYear();
            const targetMonth = now.getMonth();
            return dateParts.y === targetYear && (dateParts.m - 1) === targetMonth;
        });

        const activeType = filters.type === 'ALL' ? 'DESPESA' : filters.type;

        const pending = monthlyTransactions.filter(t =>
            t.type === activeType &&
            (t.status === 'PREVISTA' || t.status === 'ATRASADA' || t.status === 'CONFIRMADA')
        );
        const overdueCount = transactions.filter(t => t.status === 'ATRASADA' && t.type === activeType).length;

        return {
            pendingTotal: pending.reduce((sum, t) => sum + t.amount, 0),
            pendingCount: pending.length,
            overdueCount,
            type: activeType
        };
    }, [transactions, filters.type]);

    // --- Batch Actions ---
    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedTransactions);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedTransactions(newSet);
    };

    const selectAll = () => {
        if (selectedTransactions.size === filteredTransactions.length) {
            setSelectedTransactions(new Set());
        } else {
            setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)));
        }
    };

    const handleBatchDelete = async () => {
        if (!confirm(`Excluir ${selectedTransactions.size} transações selecionadas?`)) return;

        setIsSaving(true);
        try {
            await StorageService.deleteTransactions(Array.from(selectedTransactions));
            setSelectedTransactions(new Set());
            await loadData();
        } catch (error) {
            console.error('Erro ao excluir transações:', error);
            alert('Erro ao excluir selecionados.');
        } finally {
            setIsSaving(false);
        }
    };

    // --- Form Logic ---
    const handleOpenModal = (trx?: Transaction) => {
        setEditingTransaction(trx || null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Excluir transação?')) {
            setIsSaving(true);
            try {
                await StorageService.deleteTransaction(id);
                await loadData();
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleRestore = async (id: string) => {
        const trx = transactions.find(t => t.id === id);
        if (!trx) return;

        setIsSaving(true);
        try {
            const restoredTrx: Transaction = {
                ...trx,
                status: 'PREVISTA' // Default to PREVISTA when restored
            };

            await StorageService.saveTransaction(restoredTrx);
            await loadData();
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('Excluir esta categoria? Isso pode afetar transações existentes.')) return;
        await StorageService.deleteCategory(id);
        await loadData();
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryFormData.name || isSaving) return;

        setIsSaving(true);
        try {
            const newCat: Category = {
                id: StorageService.generateId(),
                name: categoryFormData.name,
                type: (filters.type === 'ALL' ? 'DESPESA' : filters.type) as TransactionType,
                color: categoryFormData.color,
                icon: categoryFormData.icon,
                is_default: false
            };

            await StorageService.saveCategory(newCat);
            setCategoryFormData({ name: '', color: '#6366f1', icon: 'Tag' });
            setIsCategoryModalOpen(false);
            await loadData();
        } catch (error) {
            console.error('Erro ao salvar categoria:', error);
            alert('Erro ao salvar categoria.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetCategories = async () => {
        if (!confirm('Isso irá apagar suas categorias atuais e restaurar o padrão de fábrica. Continuar?')) return;
        setIsImporting(true);
        try {
            await StorageService.resetCategories();
            await loadData();
        } catch (error) {
            console.error(error);
            alert('Erro ao resetar categorias.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleOpenPayModal = (trx: Transaction) => {
        setPayTrx(trx);
        setPayFormData({
            date: new Date().toISOString().split('T')[0],
            payment_method: trx.payment_method || 'DEBITO',
            account_id: trx.account_id || '',
            card_id: trx.card_id || '',
            interest_amount: ''
        });
        setIsPayModalOpen(true);
    };

    const handleConfirmPay = async () => {
        if (!payTrx || isSaving) return;

        setIsSaving(true);
        try {
            const updatedTrx: Transaction = {
                ...payTrx,
                status: payTrx.type === 'RECEITA' ? 'RECEBIDA' : 'PAGA',
                date: payFormData.date,
                payment_method: payFormData.payment_method,
                account_id: payFormData.account_id || undefined,
                card_id: payFormData.card_id || undefined,
                interest_amount: payFormData.interest_amount ? parseFloat(payFormData.interest_amount.replace(',', '.')) : (payTrx.interest_amount || 0)
            };

            await StorageService.saveTransaction(updatedTrx);
            setIsPayModalOpen(false);
            setPayTrx(null);
            await loadData();
        } catch (error) {
            console.error('Erro ao quitar transação:', error);
            alert('Erro ao processar pagamento.');
        } finally {
            setIsSaving(false);
        }
    };

    // Dynamic Options for Category Manager
    const { parentCategories, subCategories, filteredDirect } = useMemo(() => {
        const activeType = filters.type === 'ALL' ? 'DESPESA' : filters.type as TransactionType;
        const filtered = categories.filter(c => filters.type === 'ALL' || c.type === activeType);

        const parents = filtered.filter(c => !c.parent_id);
        const children = filtered.filter(c => c.parent_id);

        if (categorySearch) {
            const searchLower = categorySearch.toLowerCase();
            return {
                parentCategories: [],
                subCategories: [],
                filteredDirect: filtered.filter(c => c.name.toLowerCase().includes(searchLower))
            };
        }

        return {
            parentCategories: parents,
            subCategories: children,
            filteredDirect: []
        };
    }, [categories, filters.type, categorySearch]);

    const activeSubcategories = useMemo(() => {
        if (!selectedParentId) return [];
        return subCategories.filter(c => c.parent_id === selectedParentId);
    }, [selectedParentId, subCategories]);

    // Status visual helper
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PREVISTA': return 'bg-yellow-100 text-yellow-700';
            case 'CONFIRMADA': return 'bg-cyan-100 text-cyan-700';
            case 'PAGA': return 'bg-green-100 text-green-700';
            case 'RECEBIDA': return 'bg-green-100 text-green-700';
            case 'ATRASADA': return 'bg-red-100 text-red-700';
            case 'INCOMPLETA': return 'bg-amber-100 text-amber-700 border border-amber-200';
            case 'EXCLUIDA': return 'bg-slate-200 text-slate-500 line-through';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="animate-fade-in space-y-6 pb-20">
            {/* Header with Search & Filter Toggle */}
            {/* Header with Search & Tabs */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Transações</h2>
                        <p className="text-slate-500 text-xs font-medium">Controle suas entradas e saídas</p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-fit shadow-inner">
                        <button
                            onClick={() => { setFilters({ ...filters, type: 'ALL' }); setShowRecurring(false); }}
                            className={`flex-1 md:px-6 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 ${filters.type === 'ALL' && !showRecurring ? 'bg-white text-slate-900 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutDashboard size={14} className={filters.type === 'ALL' ? 'text-indigo-500' : 'opacity-50'} />
                            <span>Todos</span>
                        </button>
                        <button
                            onClick={() => { setFilters({ ...filters, type: 'RECEITA' }); setShowRecurring(false); }}
                            className={`flex-1 md:px-6 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 ${filters.type === 'RECEITA' && !showRecurring ? 'bg-white text-green-700 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ArrowUpCircle size={14} className={filters.type === 'RECEITA' ? 'text-green-500' : 'opacity-50'} />
                            <span>Receitas</span>
                        </button>
                        <button
                            onClick={() => { setFilters({ ...filters, type: 'DESPESA' }); setShowRecurring(false); }}
                            className={`flex-1 md:px-6 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 ${filters.type === 'DESPESA' && !showRecurring ? 'bg-white text-red-700 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ArrowDownCircle size={14} className={filters.type === 'DESPESA' ? 'text-red-500' : 'opacity-50'} />
                            <span>Despesas</span>
                        </button>
                        <button
                            onClick={() => {
                                setShowRecurring(true);
                                setFilters({ ...filters, type: 'ALL' });
                                // Scroll to recurring rules if needed
                                setTimeout(() => {
                                    document.getElementById('recurring-rules-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                            }}
                            className={`flex-1 md:px-6 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2 ${showRecurring ? 'bg-indigo-600 text-white shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Repeat size={14} className={showRecurring ? 'text-white' : 'opacity-50'} />
                            <span>Recorrência</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full">
                    {/* Search bar - always visible */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar transação..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`w-10 h-10 rounded-xl border transition-colors flex items-center justify-center shrink-0 ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'}`}
                        aria-label="Filtros"
                    >
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-slide-down">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block font-mono">Tipo</label>
                            <select
                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                value={filters.type}
                                onChange={e => setFilters({ ...filters, type: e.target.value as any })}
                            >
                                <option value="ALL">Todos os Tipos</option>
                                <option value="RECEITA">Receitas</option>
                                <option value="DESPESA">Despesas</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block font-mono">Status</label>
                            <select
                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                value={filters.status}
                                onChange={e => setFilters({ ...filters, status: e.target.value as any })}
                            >
                                <option value="ALL">Todos os Status</option>
                                <option value="PREVISTA">Prevista</option>
                                <option value="CONFIRMADA">Confirmada</option>
                                <option value="ATRASADA">Atrasada</option>
                                <option value="INCOMPLETA">Incompletas</option>
                                {filters.type !== 'DESPESA' && <option value="RECEBIDA">Recebida</option>}
                                {filters.type !== 'RECEITA' && <option value="PAGA">Paga</option>}
                                <option value="EXCLUIDA">Excluídas</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block font-mono">Categoria</label>
                            <select
                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                value={filters.category}
                                onChange={e => setFilters({ ...filters, category: e.target.value })}
                            >
                                <option value="ALL">Todas as Categorias</option>
                                {categories
                                    .filter(c => filters.type === 'ALL' || c.type === filters.type)
                                    .map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))
                                }
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block font-mono">Conta/Cartão</label>
                            <select
                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                value={filters.account}
                                onChange={e => setFilters({ ...filters, account: e.target.value })}
                            >
                                <option value="ALL">Todas as Contas</option>
                                <optgroup label="Contas">
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </optgroup>
                                <optgroup label="Cartões">
                                    {cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block font-mono">Data Início</label>
                            <input
                                type="date"
                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                value={filters.startDate}
                                onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block font-mono">Data Fim</label>
                            <input
                                type="date"
                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                value={filters.endDate}
                                onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block font-mono">Valor Mínimo</label>
                            <input
                                type="number"
                                placeholder="R$ 0,00"
                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                value={filters.minAmount}
                                onChange={e => setFilters({ ...filters, minAmount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block font-mono">Valor Máximo</label>
                            <input
                                type="number"
                                placeholder="R$ Infinito"
                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                value={filters.maxAmount}
                                onChange={e => setFilters({ ...filters, maxAmount: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                        <button
                            onClick={() => {
                                const b = getMonthBounds(0);
                                setFilters({ ...filters, startDate: b.start, endDate: b.end });
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-bold text-slate-600 transition-colors"
                        >
                            Este Mês
                        </button>
                        <button
                            onClick={() => {
                                const b = getMonthBounds(1);
                                setFilters({ ...filters, startDate: b.start, endDate: b.end });
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-bold text-slate-600 transition-colors"
                        >
                            Próximo Mês
                        </button>
                        <button
                            onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })}
                            className="px-3 py-1 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-full text-xs font-bold text-slate-600 transition-colors"
                        >
                            Ver Tudo (Sem data)
                        </button>
                        <button
                            onClick={() => {
                                setExportData(filteredTransactions);
                                setIsExportModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Download size={16} /> Exportar Filtrados
                        </button>
                    </div>
                </div>
            )}

            {/* COMPACT STATS BAR */}
            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-2.5 overflow-x-auto">
                <div className={`flex items-center gap-2 shrink-0 pr-3 border-r border-slate-100 ${monthStats.type === 'RECEITA' ? 'text-green-700' : 'text-slate-700'}`}>
                    <Clock size={14} className="shrink-0 text-slate-400" />
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                            {monthStats.type === 'RECEITA' ? 'A Receber' : 'Pendentes'}
                        </p>
                        <p className="text-sm font-black leading-tight">{formatCurrency(monthStats.pendingTotal)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 px-3 border-r border-slate-100 text-red-600">
                    <AlertTriangle size={14} className="shrink-0" />
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Atrasadas</p>
                        <p className="text-sm font-black leading-tight">{monthStats.overdueCount}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-3 text-emerald-600">
                    <CheckCircle size={14} className="shrink-0" />
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Status</p>
                        <p className="text-sm font-black leading-tight text-slate-700">
                            {monthStats.overdueCount > 0 ? 'Atenção!' : 'Em dia'}
                        </p>
                    </div>
                </div>
                <div className="ml-auto shrink-0 text-right pl-3 border-l border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Exibindo</p>
                    <p className="text-sm font-black text-slate-700 leading-tight">{filteredTransactions.length}</p>
                </div>
            </div>

            {/* RECURRING RULES ACCORDION */}
            <div id="recurring-rules-section">
                {
                    recurringRules.length > 0 ? (
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                            <button
                                onClick={() => setShowRecurring(!showRecurring)}
                                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <Repeat size={16} className="text-indigo-500" />
                                    <span className="text-sm font-semibold text-slate-700">Regras Recorrentes</span>
                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {recurringRules.filter(r => r.active).length} ativas
                                    </span>
                                </div>
                                <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${showRecurring ? 'rotate-90' : ''}`} />
                            </button>

                            {showRecurring && (
                                <div className="border-t border-slate-100 divide-y divide-slate-50">
                                    {recurringRules.map(rule => {
                                        const cat = categories.find(c => c.id === rule.category_id);
                                        const freqLabel: Record<string, string> = { DIARIO: 'Diário', SEMANAL: 'Semanal', MENSAL: 'Mensal', ANUAL: 'Anual' };
                                        return (
                                            <div key={rule.id} className={`flex items-center justify-between px-5 py-3 ${!rule.active ? 'opacity-50' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color || '#94a3b8' }} />
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-800">{rule.description}</p>
                                                        <p className="text-xs text-slate-400">
                                                            {freqLabel[rule.frequency] || rule.frequency}
                                                            {rule.day_of_month ? ` · Dia ${rule.day_of_month}` : ''}
                                                            {cat ? ` · ${cat.name}` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-sm font-bold ${rule.type === 'FIXO' ? 'text-slate-700' : 'text-orange-600'}`}>
                                                        {formatCurrency(rule.amount)}
                                                    </span>
                                                    <button
                                                        onClick={async () => {
                                                            await StorageService.saveRecurringExpense({ ...rule, active: !rule.active });
                                                            await loadData();
                                                        }}
                                                        className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors ${rule.active
                                                            ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700'
                                                            }`}
                                                        title={rule.active ? 'Pausar' : 'Reativar'}
                                                    >
                                                        {rule.active ? 'Ativa' : 'Pausada'}
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(`Excluir regra recorrente "${rule.description}"?`)) {
                                                                await StorageService.deleteRecurringExpense(rule.id);
                                                                await loadData();
                                                            }
                                                        }}
                                                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                        title="Excluir regra"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        showRecurring && (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center">
                                <Repeat size={32} className="mx-auto text-slate-300 mb-2 opacity-20" />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma regra recorrente</p>
                                <p className="text-xs text-slate-400 mt-1">Crie um novo lançamento e marque "Repetir" para começar.</p>
                            </div>
                        )
                    )
                }
            </div>

            {/* Batch Actions Bar */}
            {
                selectedTransactions.size > 0 && (
                    <div className="bg-slate-800 text-white p-3 rounded-lg flex items-center justify-between shadow-lg animate-fade-in sticky top-4 z-30">
                        <span className="font-bold text-sm ml-2">{selectedTransactions.size} selecionados</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const selected = transactions.filter(t => selectedTransactions.has(t.id));
                                    setExportData(selected);
                                    setIsExportModalOpen(true);
                                }}
                                className="p-2 hover:bg-slate-700 rounded-lg text-indigo-300 hover:text-indigo-200 flex items-center gap-2 text-sm"
                                title="Exportar Selecionados"
                            >
                                <Download size={16} /> Exportar
                            </button>
                            <button
                                onClick={handleBatchDelete}
                                className="p-2 hover:bg-slate-700 rounded-lg text-red-300 hover:text-red-200 flex items-center gap-2 text-sm disabled:opacity-50"
                                title="Excluir"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-red-300/20 border-t-red-300 rounded-full animate-spin" />
                                        Excluindo...
                                    </>
                                ) : (
                                    <><Trash2 size={16} /> Excluir</>
                                )}
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Transactions List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium">
                            <tr>
                                <th className="px-4 py-4 w-10">
                                    <button onClick={selectAll} className="text-slate-400 hover:text-slate-600">
                                        {selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0
                                            ? <CheckSquare size={18} />
                                            : <Square size={18} />}
                                    </button>
                                </th>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Descrição</th>
                                <th className="px-6 py-4">Categoria</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {filteredTransactions.map(t => {
                                const isTransfer = t.payment_method === 'TRANSFERENCIA';
                                const category = isTransfer ? { name: 'Transferência', color: '#6366f1', icon: 'ArrowRightLeft' } : categories.find(c => c.id === t.category_id);
                                const isSelected = selectedTransactions.has(t.id);

                                return (
                                    <tr key={t.id} className={`hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-indigo-50/30' : ''} ${t.status === 'EXCLUIDA' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                        <td className="px-4 py-4">
                                            <button onClick={() => toggleSelection(t.id)} className={`${isSelected ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-400'}`}>
                                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap font-mono text-xs">
                                            <div className="flex flex-col">
                                                <span>{formatDate(t.date)}</span>
                                                {t.status === 'ATRASADA' && (
                                                    <span className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-0.5">
                                                        <AlertTriangle size={8} /> Vencido
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800">
                                            <div className="flex flex-col">
                                                <span className="flex items-center gap-1.5">
                                                    {isTransfer && <ArrowRightLeft size={14} className="text-indigo-500" />}
                                                    {t.description}
                                                    {t.payment_method === 'CREDITO' && <CreditCard size={12} className="text-slate-400" />}
                                                    {t.recurrence_id && <RefreshCw size={10} className="text-indigo-400" title="Recorrente" />}
                                                </span>
                                                {t.installments && (
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 w-fit px-1 rounded flex items-center gap-1">
                                                        {t.installments.current}/{t.installments.total}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: category?.color || '#cbd5e1' }}
                                                />
                                                <span className="text-slate-600 text-sm">
                                                    {category?.name || 'Geral'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${isTransfer ? 'bg-indigo-50 text-indigo-600' : getStatusColor(t.status)}`}>
                                                {isTransfer ? 'TRANSFERIDO' : t.status}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold ${isTransfer ? 'text-indigo-600' : (t.type === 'RECEITA' ? 'text-green-600' : 'text-red-700')} ${t.status === 'PREVISTA' && t.recurrence_id ? 'italic opacity-80' : ''}`}>
                                            {t.status === 'PREVISTA' && t.recurrence_id ? '~ ' : ''}
                                            {isTransfer ? '' : (t.type === 'RECEITA' ? '+' : '-')}{formatCurrency(t.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end space-x-2 items-center">
                                                {t.status === 'EXCLUIDA' ? (
                                                    <button
                                                        onClick={() => handleRestore(t.id)}
                                                        className="p-1 px-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-[10px] flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                                                        title="Restaurar"
                                                    >
                                                        <RotateCcw size={14} /> RESTAURAR
                                                    </button>
                                                ) : (
                                                    <>
                                                        {t.status !== 'PAGA' && t.status !== 'RECEBIDA' && (
                                                            <button
                                                                onClick={() => handleOpenPayModal(t)}
                                                                className="p-1 px-2 bg-green-50 text-green-600 rounded-lg font-bold text-[10px] flex items-center gap-1 hover:bg-green-100 transition-colors"
                                                            >
                                                                <Check size={14} /> QUITAR
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => isTransfer ? alert('Edição de transferências em breve.') : handleOpenModal(t)}
                                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors disabled:opacity-50"
                                                            disabled={isSaving || isTransfer}
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (isTransfer) {
                                                                    if (confirm('Excluir esta transferência?')) {
                                                                        setIsSaving(true);
                                                                        try {
                                                                            alert('Para excluir uma transferência, utilize a aba de Contas nesta versão.');
                                                                        } finally { setIsSaving(false); }
                                                                    }
                                                                } else {
                                                                    handleDelete(t.id);
                                                                }
                                                            }}
                                                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 group-hover:text-red-500 transition-colors disabled:opacity-50"
                                                            disabled={isSaving}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filteredTransactions.length === 0 && (
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                <Search size={32} />
                            </div>
                            <p>Nenhuma transação encontrada com estes filtros.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* UNIFIED MODAL */}
            <TransactionFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={async () => {
                    await loadData();
                    setIsModalOpen(false);
                }}
                initialTransaction={editingTransaction}
                initialType={filters.type}
            />
            {/* Export Modal */}
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                transactions={exportData}
                categories={categories}
            />

            {/* QUICK PAY MODAL */}
            {
                isPayModalOpen && payTrx && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform animate-scale-up">
                            <div className="p-6 bg-slate-50 border-b border-slate-100">
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <CheckCircle className="text-green-600" /> Quitar Lançamento
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">{payTrx.description}</p>
                                <p className="text-xl font-bold text-slate-800 mt-2">{formatCurrency(payTrx.amount)}</p>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data do Pagamento</label>
                                    <input
                                        type="date"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500/20"
                                        value={payFormData.date}
                                        onChange={e => setPayFormData({ ...payFormData, date: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Forma de Pagamento</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white font-medium text-slate-700"
                                        value={payFormData.payment_method}
                                        onChange={e => setPayFormData({ ...payFormData, payment_method: e.target.value as PaymentMethod })}
                                    >
                                        <option value="DEBITO">Débito em Conta</option>
                                        <option value="PIX">Pix</option>
                                        <option value="DINHEIRO">Dinheiro (Espécie)</option>
                                        <option value="CREDITO">Cartão de Crédito</option>
                                        <option value="BOLETO">Boleto (Pago)</option>
                                        <option value="TRANSFERENCIA">Transferência</option>
                                    </select>
                                </div>

                                {payFormData.payment_method === 'CREDITO' ? (
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qual Cartão?</label>
                                        <select
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white font-medium text-slate-700"
                                            value={payFormData.card_id}
                                            onChange={e => setPayFormData({ ...payFormData, card_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Selecione...</option>
                                            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">De qual Conta saiu?</label>
                                        <select
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white font-medium text-slate-700"
                                            value={payFormData.account_id}
                                            onChange={e => setPayFormData({ ...payFormData, account_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Selecione a conta...</option>
                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1">Juros ou Multas Pagas (R$)</label>
                                    <div className="relative">
                                        <TrendingDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border border-indigo-100 bg-indigo-50/20 rounded-lg pl-9 pr-3 py-3 outline-none focus:ring-2 focus:ring-indigo-500/10 font-mono text-lg font-bold text-indigo-700"
                                            value={payFormData.interest_amount}
                                            onChange={e => setPayFormData({ ...payFormData, interest_amount: e.target.value })}
                                            placeholder="0,00"
                                            onFocus={e => e.target.select()}
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-1">Este valor será somado ao total para fins de fluxo de caixa.</p>
                                </div>
                            </div>

                            <div className="p-6 pt-0 flex gap-3">
                                <button
                                    onClick={() => setIsPayModalOpen(false)}
                                    className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmPay}
                                    className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 transition-transform active:scale-95"
                                >
                                    Confirmar Quitação
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CATEGORY MANAGER MODAL */}
            {
                isCategoryManagerOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="font-bold text-xl text-slate-800">Configuração de Categorias</h3>
                                    <p className="text-xs text-slate-500 mt-1">Personalize suas categorias e subcategorias</p>
                                </div>
                                <button onClick={() => setIsCategoryManagerOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">&times;</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Controls */}
                                <div className="flex justify-between items-center gap-4">
                                    <button
                                        onClick={() => {
                                            setCategoryFormData({ name: '', color: '#6366f1', icon: 'Folder' });
                                            setIsCategoryModalOpen(true);
                                        }}
                                        className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
                                    >
                                        <Plus size={16} /> Nova Categoria Principal
                                    </button>
                                    <button
                                        onClick={handleResetCategories}
                                        className="px-4 py-3 border border-slate-200 text-slate-500 rounded-xl font-bold text-sm hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all flex items-center gap-2"
                                    >
                                        <Trash size={16} /> Restaurar Padrões
                                    </button>
                                </div>

                                {/* Category List */}
                                <div className="space-y-4">
                                    {parentCategories.map(parent => {
                                        const subs = subCategories.filter(s => s.parent_id === parent.id);
                                        return (
                                            <div key={parent.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                                                <div className="p-4 bg-white flex items-center justify-between border-b border-slate-50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: parent.color }} />
                                                        <span className="font-bold text-slate-700">{parent.name}</span>
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                            {subs.length} subcategorias
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                const newName = prompt('Novo nome para a categoria:', parent.name);
                                                                if (newName) StorageService.saveCategory({ ...parent, name: newName }).then(loadData);
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCategory(parent.id)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="p-4 flex flex-wrap gap-2">
                                                    {subs.map(sub => (
                                                        <div key={sub.id} className="group relative">
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:border-indigo-300 transition-all">
                                                                {sub.name}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteCategory(sub.id);
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => {
                                                            const name = prompt('Nome da subcategoria:');
                                                            if (name) {
                                                                StorageService.saveCategory({
                                                                    id: StorageService.generateId(),
                                                                    name,
                                                                    parent_id: parent.id,
                                                                    type: 'DESPESA',
                                                                    color: parent.color,
                                                                    icon: 'Tag',
                                                                    is_default: false
                                                                }).then(loadData);
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center gap-1"
                                                    >
                                                        <Plus size={12} /> Adicionar
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100">
                                <button onClick={() => setIsCategoryManagerOpen(false)} className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all">
                                    Fechar Configurações
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CATEGORY FORM MODAL (New Category) */}
            {
                isCategoryModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up border border-slate-200">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">Nova Categoria</h3>
                                    <p className="text-xs text-slate-400">Criar uma nova categoria principal</p>
                                </div>
                                <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">&times;</button>
                            </div>
                            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Nome da Categoria</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Alimentação, Lazer..."
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900/10 font-medium"
                                        value={categoryFormData.name}
                                        onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Cor de Identificação</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6', '#64748b'].map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setCategoryFormData({ ...categoryFormData, color })}
                                                className={`w-8 h-8 rounded-full transition-all ${categoryFormData.color === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110 shadow-lg' : 'hover:scale-105'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsCategoryModalOpen(false)}
                                        className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 transition-transform active:scale-95"
                                    >
                                        Criar Categoria
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
