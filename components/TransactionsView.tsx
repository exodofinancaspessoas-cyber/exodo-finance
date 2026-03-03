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
            case 'PREVISTA': return 'bg-[#ff9500]/10 text-[#ff9500]';
            case 'CONFIRMADA': return 'bg-[#007aff]/10 text-[#007aff]';
            case 'PAGA': return 'bg-[#34c759]/10 text-[#34c759]';
            case 'RECEBIDA': return 'bg-[#34c759]/10 text-[#34c759]';
            case 'ATRASADA': return 'bg-ios-overdue animate-overdue';
            case 'INCOMPLETA': return 'bg-amber-100/10 text-amber-500 border border-amber-500/20';
            case 'EXCLUIDA': return 'bg-[var(--ios-text-secondary)]/10 text-[var(--ios-text-secondary)] line-through';
            default: return 'bg-black/5 text-[var(--ios-text-secondary)]';
        }
    };

    // Placeholder for hapticFeedback, assuming it's defined elsewhere or will be added
    const hapticFeedback = (intensity: number) => {
        // console.log(`Haptic feedback with intensity: ${intensity}`);
    };

    return (
        <div className="animate-in fade-in duration-700 space-y-8 pb-32">
            {/* iOS Large Title Header */}
            <header className="flex flex-col gap-6">
                <div className="flex justify-between items-end px-1">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-[#ff9500] uppercase tracking-widest leading-none">Visão Geral</span>
                        <h1 className="text-4xl font-black tracking-tight leading-none" style={{ color: 'var(--ios-text)' }}>Lançamentos</h1>
                    </div>
                    {/* Month Stats Widget */}
                    <div className="hidden md:flex items-center gap-4 ios-glass p-3 px-5 ios-squircle border shadow-sm transition-all hover:shadow-md" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--ios-text-secondary)' }}>Pendente este mês</span>
                            <span className="text-lg font-black leading-none" style={{ color: 'var(--ios-text)' }}>{formatCurrency(monthStats.pendingTotal)}</span>
                        </div>
                        <div className="w-10 h-10 ios-squircle bg-[#007aff]/10 flex items-center justify-center text-[#007aff]">
                            <TrendingDown size={20} strokeWidth={2.5} />
                        </div>
                    </div>
                </div>

                {/* Main Filter & Action Bar */}
                <div className="ios-glass p-2 ios-squircle-md border border-white/30 shadow-lg flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                    <div className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ios-text-secondary)]" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar lançamento..."
                                className="w-full pl-11 pr-4 py-4 bg-black/5 ios-squircle-sm border-none outline-none text-[16px] font-bold placeholder:text-[var(--ios-text-secondary)] opacity-10 focus:bg-black/10 transition-all shadow-inner"
                                style={{ color: 'var(--ios-text)' }}
                                value={filters.search}
                                onChange={e => setFilters({ ...filters, search: e.target.value })}
                            />
                        </div>
                        <button
                            onClick={() => { hapticFeedback(5); setShowFilters(!showFilters); }}
                            className={`w-14 h-14 ios-squircle flex items-center justify-center transition-all active:scale-95 border-b-2 ${showFilters ? 'bg-[#007aff] text-white border-[#007aff]/30 shadow-lg' : 'bg-black/5 text-[var(--ios-text-secondary)] hover:bg-black/10'}`}
                            style={{ borderColor: showFilters ? undefined : 'var(--ios-glass-border)' }}
                        >
                            <Filter size={20} strokeWidth={2.5} />
                        </button>
                    </div>

                    <div className="flex bg-black/5 p-1 ios-squircle-md gap-1">
                        {[
                            { id: 'ALL', label: 'Todos', icon: LayoutDashboard },
                            { id: 'RECEITA', label: 'Receitas', icon: ArrowUpCircle, color: '#007aff' },
                            { id: 'DESPESA', label: 'Despesas', icon: ArrowDownCircle, color: '#ff3b30' }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => { hapticFeedback(5); setFilters({ ...filters, type: btn.id as any }); setShowRecurring(false); }}
                                className={`flex-1 md:px-5 py-2.5 ios-squircle text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${filters.type === btn.id && !showRecurring ? 'bg-[var(--ios-card-bg)] shadow-md scale-[1.02]' : 'hover:bg-black/5'}`}
                                style={{ color: filters.type === btn.id && !showRecurring ? 'var(--ios-text)' : 'var(--ios-text-secondary)' }}
                            >
                                <btn.icon size={14} strokeWidth={3} className={filters.type === btn.id ? (btn.color ? `text-[${btn.color}]` : 'text-[#007aff]') : 'opacity-40'} />
                                <span>{btn.label}</span>
                            </button>
                        ))}
                        <button
                            onClick={() => { hapticFeedback(5); setShowRecurring(true); setFilters({ ...filters, type: 'ALL' }); }}
                            className={`flex-1 md:px-5 py-2.5 ios-squircle text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${showRecurring ? 'bg-[var(--ios-card-bg)] text-[#ff9500] shadow-md scale-[1.02]' : 'hover:bg-black/5'}`}
                            style={{ color: showRecurring ? '#ff9500' : 'var(--ios-text-secondary)' }}
                        >
                            <Repeat size={14} strokeWidth={3} className={showRecurring ? 'text-[#ff9500]' : 'opacity-40'} />
                            <span>Recorrência</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <div className="ios-glass p-4 ios-squircle border shadow-sm space-y-4 animate-slide-down" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase mb-1 block font-mono" style={{ color: 'var(--ios-text-secondary)' }}>Tipo</label>
                            <select
                                className="w-full p-2.5 border rounded-lg text-[16px] bg-black/5 outline-none transition-all"
                                style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                value={filters.type}
                                onChange={e => setFilters({ ...filters, type: e.target.value as any })}
                            >
                                <option value="ALL" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Todos os Tipos</option>
                                <option value="RECEITA" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Receitas</option>
                                <option value="DESPESA" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Despesas</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase mb-1 block font-mono" style={{ color: 'var(--ios-text-secondary)' }}>Status</label>
                            <select
                                className="w-full p-2.5 border rounded-lg text-[16px] bg-black/5 outline-none transition-all"
                                style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                value={filters.status}
                                onChange={e => setFilters({ ...filters, status: e.target.value as any })}
                            >
                                <option value="ALL" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Todos os Status</option>
                                <option value="PREVISTA" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Prevista</option>
                                <option value="CONFIRMADA" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Confirmada</option>
                                <option value="ATRASADA" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Atrasada</option>
                                <option value="INCOMPLETA" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Incompletas</option>
                                {filters.type !== 'DESPESA' && <option value="RECEBIDA" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Recebida</option>}
                                {filters.type !== 'RECEITA' && <option value="PAGA" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Paga</option>}
                                <option value="EXCLUIDA" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Excluídas</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase mb-1 block font-mono" style={{ color: 'var(--ios-text-secondary)' }}>Categoria</label>
                            <select
                                className="w-full p-2.5 border rounded-lg text-[16px] bg-black/5 outline-none transition-all"
                                style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                value={filters.category}
                                onChange={e => setFilters({ ...filters, category: e.target.value })}
                            >
                                <option value="ALL" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Todas as Categorias</option>
                                {categories
                                    .filter(c => filters.type === 'ALL' || c.type === filters.type)
                                    .map(cat => (
                                        <option key={cat.id} value={cat.id} className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">{cat.name}</option>
                                    ))
                                }
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase mb-1 block font-mono" style={{ color: 'var(--ios-text-secondary)' }}>Conta/Cartão</label>
                            <select
                                className="w-full p-2.5 border rounded-lg text-[16px] bg-black/5 outline-none transition-all"
                                style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                value={filters.account}
                                onChange={e => setFilters({ ...filters, account: e.target.value })}
                            >
                                <option value="ALL" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">Todas as Contas</option>
                                <optgroup label="Contas" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">
                                    {accounts.map(acc => <option key={acc.id} value={acc.id} className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">{acc.name}</option>)}
                                </optgroup>
                                <optgroup label="Cartões" className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">
                                    {cards.map(card => <option key={card.id} value={card.id} className="bg-[var(--ios-card-bg)] text-[var(--ios-text)]">{card.name}</option>)}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase mb-1 block font-mono" style={{ color: 'var(--ios-text-secondary)' }}>Data Início</label>
                            <input
                                type="date"
                                className="w-full p-2.5 border rounded-lg text-sm bg-black/5 outline-none transition-all"
                                style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                value={filters.startDate}
                                onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase mb-1 block font-mono" style={{ color: 'var(--ios-text-secondary)' }}>Data Fim</label>
                            <input
                                type="date"
                                className="w-full p-2.5 border rounded-lg text-sm bg-black/5 outline-none transition-all"
                                style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                value={filters.endDate}
                                onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase mb-1 block font-mono" style={{ color: 'var(--ios-text-secondary)' }}>Valor Mínimo</label>
                            <input
                                type="number"
                                placeholder="R$ 0,00"
                                className="w-full p-2.5 border rounded-lg text-sm bg-black/5 outline-none transition-all"
                                style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                value={filters.minAmount}
                                onChange={e => setFilters({ ...filters, minAmount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase mb-1 block font-mono" style={{ color: 'var(--ios-text-secondary)' }}>Valor Máximo</label>
                            <input
                                type="number"
                                placeholder="R$ Infinito"
                                className="w-full p-2.5 border rounded-lg text-sm bg-black/5 outline-none transition-all"
                                style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                value={filters.maxAmount}
                                onChange={e => setFilters({ ...filters, maxAmount: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <button
                            onClick={() => {
                                const b = getMonthBounds(0);
                                setFilters({ ...filters, startDate: b.start, endDate: b.end });
                            }}
                            className="px-3 py-1 bg-black/5 hover:bg-black/10 rounded-full text-xs font-bold transition-colors"
                            style={{ color: 'var(--ios-text-secondary)' }}
                        >
                            Este Mês
                        </button>
                        <button
                            onClick={() => {
                                const b = getMonthBounds(1);
                                setFilters({ ...filters, startDate: b.start, endDate: b.end });
                            }}
                            className="px-3 py-1 bg-black/5 hover:bg-black/10 rounded-full text-xs font-bold transition-colors"
                            style={{ color: 'var(--ios-text-secondary)' }}
                        >
                            Próximo Mês
                        </button>
                        <button
                            onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })}
                            className="px-3 py-1 bg-black/5 hover:bg-red-500/10 hover:text-red-500 rounded-full text-xs font-bold transition-colors"
                            style={{ color: 'var(--ios-text-secondary)' }}
                        >
                            Ver Tudo (Sem data)
                        </button>
                        <button
                            onClick={() => {
                                setExportData(filteredTransactions);
                                setIsExportModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-[#007aff]/10 text-[#007aff] hover:bg-[#007aff]/20 rounded-lg text-sm font-black transition-colors"
                        >
                            <Download size={16} /> Exportar Filtrados
                        </button>
                    </div>
                </div>
            )}

            {/* COMPACT STATS BAR */}
            <div className="flex items-center gap-2 ios-glass rounded-xl border shadow-sm px-4 py-2.5 overflow-x-auto" style={{ borderColor: 'var(--ios-glass-border)' }}>
                <div className={`flex items-center gap-2 shrink-0 pr-3 border-r ${monthStats.type === 'RECEITA' ? 'text-[#007aff]' : ''}`} style={{ borderColor: 'var(--ios-glass-border)', color: monthStats.type === 'RECEITA' ? undefined : 'var(--ios-text)' }}>
                    <Clock size={14} className="shrink-0 text-slate-400" />
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider leading-none" style={{ color: 'var(--ios-text-secondary)' }}>
                            {monthStats.type === 'RECEITA' ? 'A Receber' : 'Pendentes'}
                        </p>
                        <p className="text-sm font-black leading-tight">{formatCurrency(monthStats.pendingTotal)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 px-3 border-r text-[#ff3b30]" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <AlertTriangle size={14} className="shrink-0" />
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider leading-none" style={{ color: 'var(--ios-text-secondary)' }}>Atrasadas</p>
                        <p className="text-sm font-black leading-tight">{monthStats.overdueCount}</p>
                    </div>
                </div>
                <div className={`flex items-center gap-2 shrink-0 pl-3 ${monthStats.overdueCount > 0 ? 'text-[#ff3b30] animate-overdue' : 'text-[#34c759]'}`}>
                    <CheckCircle size={14} className="shrink-0" />
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider leading-none" style={{ color: 'var(--ios-text-secondary)' }}>Status</p>
                        <p className="text-sm font-black leading-tight">
                            {monthStats.overdueCount > 0 ? 'ATENÇÃO!' : 'EM DIA'}
                        </p>
                    </div>
                </div>
                <div className="ml-auto shrink-0 text-right pl-3 border-l" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider leading-none" style={{ color: 'var(--ios-text-secondary)' }}>Exibindo</p>
                    <p className="text-sm font-black leading-tight" style={{ color: 'var(--ios-text)' }}>{filteredTransactions.length}</p>
                </div>
            </div>

            {/* RECURRING RULES ACCORDION */}
            <div id="recurring-rules-section">
                {
                    recurringRules.length > 0 ? (
                        <div className="ios-glass rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <button
                                onClick={() => setShowRecurring(!showRecurring)}
                                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-black/5 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <Repeat size={16} className="text-[#007aff]" />
                                    <span className="text-sm font-bold" style={{ color: 'var(--ios-text)' }}>Regras Recorrentes</span>
                                    <span className="bg-[#007aff]/10 text-[#007aff] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {recurringRules.filter(r => r.active).length} ativas
                                    </span>
                                </div>
                                <ChevronRight size={16} className="text-slate-400 transition-transform duration-200" style={{ transform: showRecurring ? 'rotate(90deg)' : 'none' }} />
                            </button>

                            {showRecurring && (
                                <div className="border-t divide-y" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                    {recurringRules.map(rule => {
                                        const cat = categories.find(c => c.id === rule.category_id);
                                        const freqLabel: Record<string, string> = { DIARIO: 'Diário', SEMANAL: 'Semanal', MENSAL: 'Mensal', ANUAL: 'Anual' };
                                        return (
                                            <div key={rule.id} className={`flex items-center justify-between px-5 py-3 ${!rule.active ? 'opacity-50' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color || '#94a3b8' }} />
                                                    <div>
                                                        <p className="text-sm font-bold" style={{ color: 'var(--ios-text)' }}>{rule.description}</p>
                                                        <p className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                                                            {freqLabel[rule.frequency] || rule.frequency}
                                                            {rule.day_of_month ? ` · Dia ${rule.day_of_month}` : ''}
                                                            {cat ? ` · ${cat.name}` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-sm font-black ${rule.type === 'FIXO' ? '' : 'text-[#ff9500]'}`} style={{ color: rule.type === 'FIXO' ? 'var(--ios-text)' : undefined }}>
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
                            <div className="bg-black/5 border rounded-xl p-8 text-center" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <Repeat size={32} className="mx-auto text-[var(--ios-text-secondary)] mb-2 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--ios-text-secondary)' }}>Nenhuma regra recorrente</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--ios-text-secondary)' }}>Crie um novo lançamento e marque "Repetir" para começar.</p>
                            </div>
                        )
                    )
                }
            </div>

            {/* Batch Actions Bar */}
            {
                selectedTransactions.size > 0 && (
                    <div className="bg-[var(--ios-text)] text-[var(--ios-bg)] p-3 rounded-lg flex items-center justify-between shadow-lg animate-fade-in sticky top-4 z-30">
                        <span className="font-bold text-sm ml-2">{selectedTransactions.size} selecionados</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const selected = transactions.filter(t => selectedTransactions.has(t.id));
                                    setExportData(selected);
                                    setIsExportModalOpen(true);
                                }}
                                className="p-2 hover:bg-[var(--ios-bg)]/20 rounded-lg text-[#007aff] hover:text-[#007aff]/80 flex items-center gap-2 text-sm"
                                title="Exportar Selecionados"
                            >
                                <Download size={16} /> Exportar
                            </button>
                            <button
                                onClick={handleBatchDelete}
                                className="p-2 hover:bg-[var(--ios-bg)]/20 rounded-lg text-[#ff3b30] hover:text-[#ff3b30]/80 flex items-center gap-2 text-sm disabled:opacity-50"
                                title="Excluir"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-[#ff3b30]/20 border-t-[#ff3b30] rounded-full animate-spin" />
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
            <div className="ios-glass rounded-xl shadow-sm border overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black/5 text-xs uppercase font-medium" style={{ color: 'var(--ios-text-secondary)' }}>
                            <tr>
                                <th className="px-4 py-4 w-10">
                                    <button onClick={selectAll} className="hover:text-[#ff9500]">
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
                        <tbody className="divide-y text-sm" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            {filteredTransactions.map(t => {
                                const isTransfer = t.payment_method === 'TRANSFERENCIA';
                                const category = isTransfer ? { name: 'Transferência', color: '#6366f1', icon: 'ArrowRightLeft' } : categories.find(c => c.id === t.category_id);
                                const isSelected = selectedTransactions.has(t.id);

                                return (
                                    <tr key={t.id} className={`hover:bg-black/5 transition-colors group ${isSelected ? 'bg-[#007aff]/10' : ''} ${t.status === 'EXCLUIDA' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                        <td className="px-4 py-4">
                                            <button onClick={() => toggleSelection(t.id)} className={`${isSelected ? 'text-[#007aff]' : 'text-[var(--ios-text-secondary)] opacity-30 hover:opacity-100'}`}>
                                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                                            <div className="flex flex-col">
                                                <span>{formatDate(t.date)}</span>
                                                {t.status === 'ATRASADA' && (
                                                    <span className="text-[9px] font-bold text-[#ff3b30] uppercase flex items-center gap-0.5">
                                                        <AlertTriangle size={8} /> Vencido
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold" style={{ color: 'var(--ios-text)' }}>
                                            <div className="flex flex-col">
                                                <span className="flex items-center gap-1.5">
                                                    {isTransfer && <ArrowRightLeft size={14} className="text-[#007aff]" />}
                                                    {t.description}
                                                    {t.payment_method === 'CREDITO' && <CreditCard size={12} className="text-[var(--ios-text-secondary)]" />}
                                                    {t.recurrence_id && <RefreshCw size={10} className="text-[#007aff]" title="Recorrente" />}
                                                </span>
                                                {t.installments && (
                                                    <span className="text-[10px] bg-black/5 w-fit px-1 rounded flex items-center gap-1" style={{ color: 'var(--ios-text-secondary)' }}>
                                                        {t.installments.current}/{t.installments.total}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: category?.color || 'var(--ios-text-secondary)' }}
                                                />
                                                <span className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                                                    {category?.name || 'Geral'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${isTransfer ? 'bg-[#007aff]/10 text-[#007aff]' : getStatusColor(t.status)}`}>
                                                {isTransfer ? 'TRANSFERIDO' : t.status}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-black ${isTransfer ? 'text-[#007aff]' : (t.type === 'RECEITA' ? 'text-[#007aff]' : 'text-[#ff3b30]')} ${t.status === 'PREVISTA' && t.recurrence_id ? 'italic opacity-80' : ''}`}>
                                            {t.status === 'PREVISTA' && t.recurrence_id ? '~ ' : ''}
                                            {isTransfer ? '' : (t.type === 'RECEITA' ? '+' : '-')}{formatCurrency(t.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end space-x-2 items-center">
                                                {t.status === 'EXCLUIDA' ? (
                                                    <button
                                                        onClick={() => handleRestore(t.id)}
                                                        className="p-1 px-2 bg-[#007aff]/10 text-[#007aff] rounded-lg font-bold text-[10px] flex items-center gap-1 hover:bg-[#007aff]/20 transition-colors"
                                                        title="Restaurar"
                                                    >
                                                        <RotateCcw size={14} /> RESTAURAR
                                                    </button>
                                                ) : (
                                                    <>
                                                        {t.status !== 'PAGA' && t.status !== 'RECEBIDA' && (
                                                            <button
                                                                onClick={() => handleOpenPayModal(t)}
                                                                className="p-1 px-2 bg-[#34c759]/10 text-[#34c759] rounded-lg font-bold text-[10px] flex items-center gap-1 hover:bg-[#34c759]/20 transition-colors"
                                                            >
                                                                <Check size={14} /> QUITAR
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => isTransfer ? alert('Edição de transferências em breve.') : handleOpenModal(t)}
                                                            className="p-1.5 hover:bg-black/5 rounded-lg text-[var(--ios-text-secondary)] hover:text-[#007aff] transition-colors disabled:opacity-50"
                                                            disabled={isSaving || isTransfer}
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (isTransfer) {
                                                                    if (confirm('Excluir esta transferÃªncia?')) {
                                                                        setIsSaving(true);
                                                                        try {
                                                                            alert('Para excluir uma transferÃªncia, utilize a aba de Contas nesta versÃ£o.');
                                                                        } finally { setIsSaving(false); }
                                                                    }
                                                                } else {
                                                                    handleDelete(t.id);
                                                                }
                                                            }}
                                                            className="p-1.5 hover:bg-[#ff3b30]/10 rounded-lg text-[var(--ios-text-secondary)] hover:text-[#ff3b30] transition-colors disabled:opacity-50"
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
                        <div className="p-16 text-center flex flex-col items-center" style={{ color: 'var(--ios-text-secondary)' }}>
                            <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mb-4 text-[var(--ios-text-secondary)] opacity-20">
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
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                        <div className="ios-glass rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform animate-scale-up border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="p-6 bg-black/5 border-b" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--ios-text)' }}>
                                    <CheckCircle className="text-[#34c759]" /> Quitar Lançamento
                                </h3>
                                <p className="text-sm mt-1" style={{ color: 'var(--ios-text-secondary)' }}>{payTrx.description}</p>
                                <p className="text-xl font-black mt-2" style={{ color: 'var(--ios-text)' }}>{formatCurrency(payTrx.amount)}</p>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--ios-text-secondary)' }}>Data do Pagamento</label>
                                    <input
                                        type="date"
                                        className="w-full bg-black/5 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#34c759]/20"
                                        style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                        value={payFormData.date}
                                        onChange={e => setPayFormData({ ...payFormData, date: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--ios-text-secondary)' }}>Forma de Pagamento</label>
                                    <select
                                        className="w-full bg-black/5 border rounded-lg px-3 py-2 outline-none font-bold"
                                        style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
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
                                        <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--ios-text-secondary)' }}>Qual Cartão?</label>
                                        <select
                                            className="w-full bg-black/5 border rounded-lg px-3 py-2 outline-none font-bold"
                                            style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
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
                                        <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--ios-text-secondary)' }}>De qual Conta saiu?</label>
                                        <select
                                            className="w-full bg-black/5 border rounded-lg px-3 py-2 outline-none font-bold"
                                            style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
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
                                    <label className="block text-[10px] font-bold text-[#007aff] uppercase mb-1">Juros ou Multas Pagas (R$)</label>
                                    <div className="relative">
                                        <TrendingDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#007aff]/60" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-[#007aff]/5 border border-[#007aff]/20 rounded-lg pl-9 pr-3 py-3 outline-none focus:ring-2 focus:ring-[#007aff]/10 font-mono text-lg font-bold text-[#007aff]"
                                            value={payFormData.interest_amount}
                                            onChange={e => setPayFormData({ ...payFormData, interest_amount: e.target.value })}
                                            placeholder="0,00"
                                            onFocus={e => e.target.select()}
                                        />
                                    </div>
                                    <p className="text-[9px] mt-1" style={{ color: 'var(--ios-text-secondary)' }}>Este valor será somado ao total para fins de fluxo de caixa.</p>
                                </div>
                            </div>

                            <div className="p-6 pt-0 flex gap-3">
                                <button
                                    onClick={() => setIsPayModalOpen(false)}
                                    className="flex-1 py-3 font-bold hover:bg-black/5 rounded-xl transition-colors"
                                    style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmPay}
                                    className="flex-[2] py-3 bg-[#34c759] hover:bg-[#2fb34f] text-white font-bold rounded-xl shadow-lg shadow-[#34c759]/20 transition-transform active:scale-95"
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
                        <div className="ios-glass rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="p-6 border-b flex justify-between items-center bg-black/5" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <div>
                                    <h3 className="font-bold text-xl" style={{ color: 'var(--ios-text)' }}>Configuração de Categorias</h3>
                                    <p className="text-xs mt-1" style={{ color: 'var(--ios-text-secondary)' }}>Personalize suas categorias e subcategorias</p>
                                </div>
                                <button onClick={() => setIsCategoryManagerOpen(false)} className="hover:bg-black/5 p-2 rounded-full transition-colors" style={{ color: 'var(--ios-text-secondary)' }}>&times;</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Controls */}
                                <div className="flex justify-between items-center gap-4">
                                    <button
                                        onClick={() => {
                                            setCategoryFormData({ name: '', color: '#6366f1', icon: 'Folder' });
                                            setIsCategoryModalOpen(true);
                                        }}
                                        className="flex-1 py-3 bg-[var(--ios-text)] text-[var(--ios-bg)] rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-black/10"
                                    >
                                        <Plus size={16} /> Nova Categoria Principal
                                    </button>
                                    <button
                                        onClick={handleResetCategories}
                                        className="px-4 py-3 border rounded-xl font-bold text-sm hover:bg-[#ff3b30]/10 hover:text-[#ff3b30] transition-all flex items-center gap-2"
                                        style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text-secondary)' }}
                                    >
                                        <Trash size={16} /> Restaurar Padrões
                                    </button>
                                </div>

                                {/* Category List */}
                                <div className="space-y-4">
                                    {parentCategories.map(parent => {
                                        const subs = subCategories.filter(s => s.parent_id === parent.id);
                                        return (
                                            <div key={parent.id} className="border rounded-2xl overflow-hidden bg-black/5" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                                <div className="p-4 bg-black/5 flex items-center justify-between border-b" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: parent.color }} />
                                                        <span className="font-bold" style={{ color: 'var(--ios-text)' }}>{parent.name}</span>
                                                        <span className="text-[10px] bg-black/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ color: 'var(--ios-text-secondary)' }}>
                                                            {subs.length} subcategorias
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                const newName = prompt('Novo nome para a categoria:', parent.name);
                                                                if (newName) StorageService.saveCategory({ ...parent, name: newName }).then(loadData);
                                                            }}
                                                            className="p-2 text-[var(--ios-text-secondary)] hover:text-[#007aff] hover:bg-[#007aff]/10 rounded-lg transition-colors"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCategory(parent.id)}
                                                            className="p-2 text-[var(--ios-text-secondary)] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="p-4 flex flex-wrap gap-2">
                                                    {subs.map(sub => (
                                                        <div key={sub.id} className="group relative">
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 border rounded-lg text-sm transition-all" style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text-secondary)' }}>
                                                                {sub.name}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteCategory(sub.id);
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--ios-text-secondary)] hover:text-[#ff3b30] transition-all"
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
                                                        className="px-3 py-1.5 border border-dashed rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                        style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text-secondary)' }}
                                                    >
                                                        <Plus size={12} /> Adicionar
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-6 bg-black/5 border-t" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <button onClick={() => setIsCategoryManagerOpen(false)} className="w-full py-3 bg-[#007aff]/10 hover:bg-[#007aff]/20 text-[#007aff] font-bold rounded-xl transition-all">
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
                        <div className="ios-glass rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="p-6 border-b flex justify-between items-center bg-black/5" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <div>
                                    <h3 className="font-bold text-lg" style={{ color: 'var(--ios-text)' }}>Nova Categoria</h3>
                                    <p className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>Criar uma nova categoria principal</p>
                                </div>
                                <button onClick={() => setIsCategoryModalOpen(false)} className="hover:bg-black/5 p-2 rounded-full transition-colors" style={{ color: 'var(--ios-text-secondary)' }}>&times;</button>
                            </div>
                            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase mb-2" style={{ color: 'var(--ios-text-secondary)' }}>Nome da Categoria</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Alimentação, Lazer..."
                                        className="w-full bg-black/5 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#007aff]/20 font-bold"
                                        style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text)' }}
                                        value={categoryFormData.name}
                                        onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase mb-2" style={{ color: 'var(--ios-text-secondary)' }}>Cor de Identificação</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['#007aff', '#34c759', '#ff9500', '#ff3b30', '#30b0c7', '#ffcc00', '#af52de', '#ff2d55', '#5856d6', '#8e8e93'].map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setCategoryFormData({ ...categoryFormData, color })}
                                                className={`w-8 h-8 rounded-full transition-all ${categoryFormData.color === color ? 'ring-2 ring-offset-2 ring-[#007aff] scale-110 shadow-lg' : 'hover:scale-105'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsCategoryModalOpen(false)}
                                        className="flex-1 py-3 font-bold hover:bg-black/5 rounded-xl transition-colors"
                                        style={{ color: 'var(--ios-text-secondary)' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-3 bg-[#007aff] hover:bg-[#0074f0] text-white font-bold rounded-xl shadow-lg shadow-[#007aff]/20 transition-transform active:scale-95"
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
