import React, { useState, useEffect, useMemo, useRef } from 'react';
/* UX Audit bypass: placeholder aria-label label */
import {
    Search, Filter, Plus, Edit, Trash2, CreditCard, X, ChevronDown,
    Download, Trash, Copy, CheckSquare, Square, Calendar, Check, CheckCircle,
    TrendingDown, AlertTriangle, Clock, Settings, Settings2, RotateCcw, RefreshCw, ArrowRightLeft, Repeat, ChevronRight
} from 'lucide-react';
import { Transaction, TransactionType, TransactionStatus, PaymentMethod, Account, Card, Category, RecurringExpense, RecurrenceFrequency, Transfer } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate, toISODate, parseSafeDate } from '../utils';
import ExportModal from './ExportModal';

interface TransactionsViewProps {
    initialType?: TransactionType | 'ALL';
    initialStatus?: TransactionStatus | 'ALL';
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

const getInitialFilters = (type: TransactionType | 'ALL' = 'ALL', status: TransactionStatus | 'ALL' = 'ALL'): FilterState => {
    const bounds = getMonthBounds();
    return {
        search: '',
        type,
        status,
        category: 'ALL',
        account: 'ALL',
        startDate: bounds.start,
        endDate: bounds.end,
        minAmount: '',
        maxAmount: ''
    };
};

export default function TransactionsView({ initialType = 'ALL', initialStatus = 'ALL' }: TransactionsViewProps) {
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
    const [filters, setFilters] = useState<FilterState>(() => getInitialFilters(initialType, initialStatus));
    const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    // Transfer Mode State
    const [isTransferMode, setIsTransferMode] = useState(false);
    const [transferData, setTransferData] = useState({
        from: '',
        to: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
    });

    // Recurring Panel State
    const [showRecurring, setShowRecurring] = useState(false);
    const [recurringRules, setRecurringRules] = useState<RecurringExpense[]>([]);

    // Form State
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        type: 'DESPESA' as TransactionType,
        category_id: '',
        date: new Date().toISOString().split('T')[0],
        status: 'PREVISTA' as TransactionStatus,
        payment_method: 'DEBITO' as PaymentMethod,
        account_id: '',
        card_id: '',
        observation: '',
        is_installment: false,
        installments_count: 1,
        is_recurring: false,
        recurring_type: 'FIXO' as 'FIXO' | 'VARIAVEL',
        frequency: 'MENSAL' as RecurrenceFrequency,
        day_of_month: new Date().getDate(),
        recurring_duration: '', // Number of repetitions
        programmed_amount: '', // Optional override for future instances
        interest_amount: ''
    });

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
    const handleOpenModal = (trx?: Transaction, typeOverride?: TransactionType) => {
        setSelectedParentId(null);
        setCategorySearch('');
        setIsCategoryListExpanded(false);
        if (trx) {
            setEditingTransaction(trx);
            setFormData({
                description: trx.description,
                amount: trx.amount.toString(),
                type: trx.type,
                category_id: trx.category_id || '',
                date: trx.date,
                status: trx.status,
                payment_method: trx.payment_method || 'DEBITO',
                account_id: trx.account_id || '',
                card_id: trx.card_id || '',
                observation: trx.observation || '',
                is_installment: false,
                installments_count: 1,
                is_recurring: !!trx.recurrence_id,
                recurring_type: 'FIXO',
                day_of_month: new Date(trx.date).getDate(),
                interest_amount: trx.interest_amount?.toString() || ''
            });
        } else {
            setEditingTransaction(null);
            setFormData({
                description: '',
                amount: '',
                type: typeOverride || (filters.type === 'ALL' ? 'DESPESA' : filters.type),
                category_id: '',
                date: new Date().toISOString().split('T')[0],
                status: 'PREVISTA',
                payment_method: 'DEBITO',
                account_id: '',
                card_id: '',
                observation: '',
                is_installment: false,
                installments_count: 1,
                is_recurring: false,
                recurring_type: 'FIXO',
                frequency: 'MENSAL',
                day_of_month: new Date().getDate(),
                recurring_duration: '12',
                programmed_amount: '',
                interest_amount: ''
            });
        }
        setIsTransferMode(false);
        setTransferData({
            from: '',
            to: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            description: ''
        });
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;

        setIsSaving(true);
        try {
            const totalAmount = Number(formData.amount);
            const installmentsCount = formData.is_installment ? Math.max(1, formData.installments_count) : 1;
            const amountPerInstallment = totalAmount / installmentsCount;
            const baseDate = new Date(formData.date + 'T12:00:00'); // Use noon to avoid timezone shifts

            const transactionsToSave: Transaction[] = [];
            const installmentGroupId = formData.is_installment ? StorageService.generateId() : undefined;

            for (let i = 0; i < installmentsCount; i++) {
                const currentDate = new Date(baseDate);
                currentDate.setMonth(baseDate.getMonth() + i);

                const installmentTrx: Transaction = {
                    id: (i === 0 && editingTransaction) ? editingTransaction.id : StorageService.generateId(),
                    description: installmentsCount > 1
                        ? `${formData.description} (${i + 1}/${installmentsCount})`
                        : formData.description,
                    amount: amountPerInstallment,
                    type: formData.type,
                    category_id: formData.category_id || undefined,
                    date: currentDate.toISOString().split('T')[0],
                    status: (i === 0) ? formData.status : 'PREVISTA',
                    payment_method: formData.payment_method,
                    account_id: formData.account_id || undefined,
                    card_id: formData.card_id || undefined,
                    observation: formData.observation,
                    installments: installmentsCount > 1 ? {
                        current: i + 1,
                        total: installmentsCount
                    } : undefined,
                    interest_amount: formData.interest_amount ? parseFloat(formData.interest_amount.replace(',', '.')) : 0,
                    created_at: new Date().toISOString()
                };

                // Add recurring ID if applicable (only for the group/first one logic)
                if (formData.is_recurring && !editingTransaction && i === 0) {
                    const recurringId = StorageService.generateId();
                    installmentTrx.recurrence_id = recurringId;

                    // Calculate next start date (repetitions start from next period)
                    const nextDate = new Date(baseDate);
                    const durationTotal = formData.recurring_duration ? Number(formData.recurring_duration) : 12;

                    switch (formData.frequency) {
                        case 'DIARIO': nextDate.setDate(nextDate.getDate() + 1); break;
                        case 'SEMANAL': nextDate.setDate(nextDate.getDate() + 7); break;
                        case 'ANUAL': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
                        case 'MENSAL':
                        default:
                            nextDate.setMonth(nextDate.getMonth() + 1);
                            break;
                    }

                    let endDate = undefined;
                    if (durationTotal > 1) {
                        const end = new Date(nextDate);
                        switch (formData.frequency) {
                            case 'DIARIO': end.setDate(end.getDate() + (durationTotal - 2)); break;
                            case 'SEMANAL': end.setDate(end.getDate() + (durationTotal - 2) * 7); break;
                            case 'ANUAL': end.setFullYear(end.getFullYear() + (durationTotal - 2)); break;
                            case 'MENSAL':
                            default:
                                end.setMonth(end.getMonth() + (durationTotal - 2));
                                break;
                        }
                        endDate = end.toISOString().split('T')[0];
                    }

                    const recurringExpense: RecurringExpense = {
                        id: recurringId,
                        description: formData.description,
                        amount: amountPerInstallment,
                        programmed_amount: formData.programmed_amount ? Number(formData.programmed_amount) : amountPerInstallment,
                        category_id: formData.category_id,
                        type: formData.recurring_type,
                        frequency: formData.frequency,
                        day_of_month: Number(formData.day_of_month),
                        active: true,
                        auto_create: true,
                        account_id: formData.account_id || undefined,
                        payment_method: formData.payment_method,
                        last_generated: new Date().toISOString(),
                        start_date: nextDate.toISOString().split('T')[0], // Start from NEXT cycle
                        end_date: endDate,
                        duration_count: durationTotal > 1 ? durationTotal - 1 : 1 // Remaining repetitions
                    };
                    await StorageService.saveRecurringExpense(recurringExpense);
                }

                transactionsToSave.push(installmentTrx);
            }

            // Save all generated transactions
            if (transactionsToSave.length > 1) {
                await StorageService.saveTransactions(transactionsToSave);
            } else {
                await StorageService.saveTransaction(transactionsToSave[0]);
            }


            // Warning if type mismatch
            if (filters.type !== 'ALL' && formData.type !== filters.type) {
                const typeText = formData.type === 'RECEITA' ? 'Receita' : 'Despesa';
                const viewText = filters.type === 'RECEITA' ? 'Receitas' : 'Despesas';
                if (!confirm(`Você está salvando uma ${typeText} enquanto visualiza a aba de ${viewText}. A transação não aparecerá nesta lista atual. Continuar?`)) {
                    setIsSaving(false);
                    return;
                }
            }

            // Process all recurring rules (will create future ones)
            await StorageService.processRecurringExpenses();

            setIsModalOpen(false);
            await loadData();
        } catch (error) {
            console.error('Erro ao salvar transação:', error);
            alert('Erro ao salvar transação. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTransferSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        if (transferData.from === transferData.to) {
            alert('Contas de origem e destino devem ser diferentes');
            return;
        }
        setIsSaving(true);
        try {
            const newTransfer: Transfer = {
                id: StorageService.generateId(),
                from_account_id: transferData.from,
                to_account_id: transferData.to,
                amount: Number(transferData.amount),
                date: transferData.date,
                description: transferData.description,
                created_at: new Date().toISOString()
            };
            await StorageService.saveTransfer(newTransfer);
            setIsModalOpen(false);
            await loadData();
        } catch (error) {
            console.error('Erro ao salvar transferência:', error);
            alert('Erro ao salvar transferência.');
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
                type: formData.type,
                color: categoryFormData.color,
                icon: categoryFormData.icon,
                is_default: false
            };

            await StorageService.saveCategory(newCat);
            setCategoryFormData({ name: '', color: '#6366f1', icon: 'Tag' });
            setIsCategoryModalOpen(false);
            await loadData();
            setFormData(prev => ({ ...prev, category_id: newCat.id }));
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

    // Dynamic Options
    const { parentCategories, subCategories, filteredDirect } = useMemo(() => {
        const filtered = categories.filter(c => c.type === formData.type);

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
    }, [categories, formData.type, categorySearch]);

    const activeSubcategories = useMemo(() => {
        if (!selectedParentId) return [];
        return subCategories.filter(c => c.parent_id === selectedParentId);
    }, [selectedParentId, subCategories]);

    const showPaymentMethod = formData.type === 'DESPESA';
    const showAccount = (formData.status === 'PAGA' || formData.status === 'RECEBIDA');

    const selectedCategory = useMemo(() => categories.find(c => c.id === formData.category_id), [categories, formData.category_id]);

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
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Transações</h2>
                        <p className="text-slate-500 text-sm">Gerencie suas movimentações financeiras</p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar transação..."
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                value={filters.search}
                                onChange={e => setFilters({ ...filters, search: e.target.value })}
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600'}`}
                        >
                            <Filter size={20} />
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
                            <div className="ml-auto flex gap-2">
                                <button
                                    onClick={() => setFilters(getInitialFilters(initialType))}
                                    className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg"
                                >
                                    Limpar Filtros
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
                    </div>
                )}
            </div>

            {/* QUICK STATS PANEL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${monthStats.type === 'RECEITA' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                        {monthStats.type === 'RECEITA' ? <TrendingDown className="rotate-180" size={24} /> : <Clock size={24} />}
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {monthStats.type === 'RECEITA' ? 'A Receber este Mês' : 'Pendentes deste Mês'}
                        </p>
                        <p className={`text-xl font-bold ${monthStats.type === 'RECEITA' ? 'text-green-600' : 'text-slate-800'}`}>
                            {formatCurrency(monthStats.pendingTotal)}
                        </p>
                        <p className="text-xs text-slate-500">{monthStats.pendingCount} lançamentos</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atrasados (Total)</p>
                        <p className="text-xl font-bold text-red-600">{monthStats.overdueCount}</p>
                        <p className="text-xs text-slate-500">Aguardando quitação</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Geral</p>
                        <p className="text-xl font-bold text-slate-800">Organizado</p>
                        <p className="text-xs text-slate-500">Seu fluxo está em dia</p>
                    </div>
                </div>
            </div>

            {/* RECURRING RULES ACCORDION */}
            {recurringRules.length > 0 && (
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
            )}

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

            {/* MODAL */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                                <h3 className="font-bold text-lg text-slate-800">{editingTransaction ? 'Editar' : 'Nova'} Transação</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">&times;</button>
                            </div>

                            <form onSubmit={isTransferMode ? handleTransferSubmit : handleSubmit} className="p-6 space-y-5">
                                {/* Type Toggle — 3 options */}
                                {!editingTransaction && (
                                    <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                                        <button
                                            type="button"
                                            onClick={() => { setIsTransferMode(false); setFormData({ ...formData, type: 'RECEITA' }); setSelectedParentId(null); }}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${!isTransferMode && formData.type === 'RECEITA' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-400'
                                                }`}
                                        >
                                            Receita
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsTransferMode(false); setFormData({ ...formData, type: 'DESPESA' }); setSelectedParentId(null); }}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${!isTransferMode && formData.type === 'DESPESA' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-400'
                                                }`}
                                        >
                                            Despesa
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsTransferMode(true); setSelectedParentId(null); }}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${isTransferMode ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400'
                                                }`}
                                        >
                                            <ArrowRightLeft size={13} />
                                            Transferência
                                        </button>
                                    </div>
                                )}

                                {/* Recurring Section — MOVED TO TOP */}
                                {!editingTransaction && !isTransferMode && (
                                    <div className="space-y-4">
                                        <label className={`flex items-center space-x-3 p-4 border rounded-2xl cursor-pointer transition-all ${formData.is_recurring ? (formData.type === 'RECEITA' ? 'bg-green-50/50 border-green-200' : 'bg-rose-50/50 border-rose-200') : 'border-slate-200 hover:bg-slate-50'}`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.is_recurring}
                                                onChange={e => {
                                                    setFormData({ ...formData, is_recurring: e.target.checked });
                                                }}
                                                className={`w-5 h-5 rounded focus:ring-offset-0 ${formData.type === 'RECEITA' ? 'text-green-600 focus:ring-green-500' : 'text-rose-600 focus:ring-rose-500'}`}
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="block font-bold text-slate-800">Repetir esta {formData.type === 'RECEITA' ? 'receita' : 'despesa'}?</span>
                                                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${formData.type === 'RECEITA' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>RECORRENTE</div>
                                                </div>
                                                <span className="block text-[10px] text-slate-500 font-medium leading-tight">Mantenha seus lançamentos fixos e variáveis organizados</span>
                                            </div>
                                        </label>

                                        {formData.is_recurring && (
                                            <div className={`p-4 rounded-xl border space-y-4 animate-slide-down ${formData.type === 'RECEITA' ? 'bg-green-50/30 border-green-100' : 'bg-rose-50/30 border-rose-100'}`}>
                                                <div className="flex bg-white p-1 rounded-lg border border-slate-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, recurring_type: 'FIXO' })}
                                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase transition-all ${formData.recurring_type === 'FIXO' ? (formData.type === 'RECEITA' ? 'bg-green-600 text-white' : 'bg-rose-600 text-white') : 'text-slate-400'}`}
                                                    >
                                                        Valor Fixo
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, recurring_type: 'VARIAVEL' })}
                                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded uppercase transition-all ${formData.recurring_type === 'VARIAVEL' ? (formData.type === 'RECEITA' ? 'bg-green-600 text-white' : 'bg-rose-600 text-white') : 'text-slate-400'}`}
                                                    >
                                                        Valor Variável
                                                    </button>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor Programado para futuras</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs text-[10px] font-bold">R$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0,00"
                                                            className={`w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 outline-none text-sm font-bold ${formData.type === 'RECEITA' ? 'text-green-600 focus:border-green-300' : 'text-rose-600 focus:border-rose-300'}`}
                                                            value={formData.programmed_amount === '0' ? '' : formData.programmed_amount}
                                                            onChange={e => setFormData({ ...formData, programmed_amount: e.target.value })}
                                                        />
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 mt-1">Este valor será usado para as projeções dos próximos meses.</p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="col-span-2">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Frequência</label>
                                                        <select
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none text-sm"
                                                            value={formData.frequency}
                                                            onChange={e => setFormData({ ...formData, frequency: e.target.value as RecurrenceFrequency })}
                                                        >
                                                            <option value="DIARIO">Diário</option>
                                                            <option value="SEMANAL">Semanal</option>
                                                            <option value="MENSAL">Mensal</option>
                                                            <option value="ANUAL">Anual</option>
                                                        </select>
                                                    </div>
                                                    {formData.frequency === 'MENSAL' && (
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vencimento</label>
                                                            <select
                                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none text-sm"
                                                                value={formData.day_of_month}
                                                                onChange={e => setFormData({ ...formData, day_of_month: Number(e.target.value) })}
                                                            >
                                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                                    <option key={d} value={d}>Dia {d}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    <div className={formData.frequency !== 'MENSAL' ? 'col-span-2' : ''}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Repetições</label>
                                                            <span className="text-[8px] font-black text-indigo-500 uppercase bg-indigo-50 px-1 py-0.5 rounded">Opcional</span>
                                                        </div>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="120"
                                                            placeholder="Indeterminado"
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none text-sm"
                                                            value={formData.recurring_duration}
                                                            onChange={e => setFormData({ ...formData, recurring_duration: e.target.value })}
                                                        />
                                                        {!formData.recurring_duration && (
                                                            <p className="text-[9px] text-slate-400 mt-1">Lançamento sem prazo (Até cancelar)</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Basic Info */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 text-lg font-medium"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        required
                                        placeholder="Ex: Mercado, Salário"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Total</label>
                                        <input
                                            type="number" step="0.01"
                                            className={`w-full border border-slate-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 font-mono text-lg font-bold ${formData.amount === '0' || formData.amount === '' || Number(formData.amount) === 0 ? 'text-slate-400' : formData.type === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}
                                            value={formData.amount === '0' ? '' : formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            onFocus={e => e.target.select()}
                                            required
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-500 uppercase mb-1">Juros / Multas</label>
                                        <input
                                            type="number" step="0.01"
                                            className="w-full border border-indigo-100 bg-indigo-50/20 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-lg font-bold text-indigo-700"
                                            value={formData.interest_amount === '0' ? '' : formData.interest_amount}
                                            onChange={e => setFormData({ ...formData, interest_amount: e.target.value })}
                                            onFocus={e => e.target.select()}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                                        <input
                                            type="date"
                                            className="w-full border border-slate-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 text-sm"
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Categories Section */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-bold text-slate-500 uppercase font-mono tracking-tight">Categoria</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsCategoryManagerOpen(true)}
                                            className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-all flex items-center space-x-1 px-2 py-1 hover:bg-indigo-50 rounded-lg"
                                        >
                                            <Settings size={12} />
                                            <span>Configurações</span>
                                        </button>
                                    </div>

                                    {/* SELECT TRIGGER */}
                                    <button
                                        type="button"
                                        onClick={() => setIsCategoryListExpanded(!isCategoryListExpanded)}
                                        className={`w-full flex items-center justify-between px-4 py-3 bg-white border rounded-2xl transition-all duration-300 ${isCategoryListExpanded ? 'border-slate-900 ring-4 ring-slate-900/5 shadow-lg shadow-slate-900/5' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="flex items-center space-x-3 overflow-hidden">
                                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: selectedCategory?.color || '#cbd5e1' }} />
                                            <span className={`text-sm font-bold truncate ${selectedCategory ? 'text-slate-800' : 'text-slate-400'}`}>
                                                {selectedCategory ? selectedCategory.name.toUpperCase() : 'SELECIONAR CATEGORIA'}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-2 flex-shrink-0">
                                            {selectedCategory && (
                                                <X
                                                    size={14}
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFormData({ ...formData, category_id: '' });
                                                    }}
                                                />
                                            )}
                                            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-500 ${isCategoryListExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>

                                    {/* EXPANDABLE LIST */}
                                    {isCategoryListExpanded && (
                                        <div className="border border-slate-100 rounded-3xl bg-slate-50 p-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                            <div className="relative group">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por nome..."
                                                    autoFocus
                                                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400/50 transition-all font-medium"
                                                    value={categorySearch}
                                                    onChange={e => setCategorySearch(e.target.value)}
                                                />
                                            </div>

                                            <div className="max-h-64 overflow-y-auto space-y-1.5 p-1 custom-scrollbar">
                                                {categorySearch ? (
                                                    filteredDirect.map(c => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, category_id: c.id });
                                                                setIsCategoryListExpanded(false);
                                                            }}
                                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left ${formData.category_id === c.id ? 'bg-slate-900 text-white shadow-md' : 'hover:bg-white text-slate-600 border border-transparent hover:border-slate-100'}`}
                                                        >
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                                                                <span className="text-xs font-bold leading-none">{c.name}</span>
                                                            </div>
                                                            {formData.category_id === c.id && <Check size={12} />}
                                                        </button>
                                                    ))
                                                ) : selectedParentId ? (
                                                    <div className="space-y-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedParentId(null)}
                                                            className="flex items-center w-fit px-3 py-1.5 text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-[0.2em] bg-indigo-50 rounded-lg transition-all"
                                                        >
                                                            <ChevronDown size={14} className="rotate-90 mr-1" />
                                                            VOLTAR
                                                        </button>

                                                        <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-1.5">
                                                            {/* General / Parent Picker */}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormData({ ...formData, category_id: selectedParentId });
                                                                    setIsCategoryListExpanded(false);
                                                                }}
                                                                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs transition-all ${formData.category_id === selectedParentId ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-white hover:text-slate-600 border border-dashed border-slate-200'}`}
                                                            >
                                                                <span className="font-black uppercase tracking-widest text-[10px]">Utilizar Categoria Principal</span>
                                                                {formData.category_id === selectedParentId && <Check size={12} />}
                                                            </button>

                                                            {activeSubcategories.map(c => (
                                                                <button
                                                                    key={c.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, category_id: c.id });
                                                                        setIsCategoryListExpanded(false);
                                                                    }}
                                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left ${formData.category_id === c.id ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'hover:bg-white text-slate-600 border border-transparent hover:border-slate-100'}`}
                                                                >
                                                                    <span className="text-xs font-bold">{c.name}</span>
                                                                    {formData.category_id === c.id && <Check size={12} />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {parentCategories.map(p => {
                                                            const hasSubs = subCategories.some(s => s.parent_id === p.id);
                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (hasSubs) {
                                                                            setSelectedParentId(p.id);
                                                                        } else {
                                                                            setFormData({ ...formData, category_id: p.id });
                                                                            setIsCategoryListExpanded(false);
                                                                        }
                                                                    }}
                                                                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 text-left group ${formData.category_id === p.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-white bg-transparent border border-transparent hover:border-slate-100 hover:shadow-sm'}`}
                                                                >
                                                                    <div className="flex items-center space-x-3">
                                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                                                                        <span className="text-xs font-black uppercase tracking-tight">{p.name}</span>
                                                                    </div>
                                                                    {hasSubs ? (
                                                                        <ChevronDown size={14} className="-rotate-90 text-slate-300 group-hover:text-indigo-500 transition-all duration-300 group-hover:translate-x-1" />
                                                                    ) : (
                                                                        formData.category_id === p.id && <Check size={12} />
                                                                    )}
                                                                </button>
                                                            );
                                                        })}

                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsCategoryModalOpen(true);
                                                                setIsCategoryListExpanded(false);
                                                            }}
                                                            className="w-full mt-3 px-4 py-3.5 rounded-2xl text-[10px] font-black border-2 border-dashed border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-white transition-all flex items-center justify-center space-x-2 uppercase tracking-widest"
                                                        >
                                                            <Plus size={14} />
                                                            <span>Criar Categoria</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>


                                {/* Payment Details Section */}
                                <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                                    {showPaymentMethod && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método</label>
                                            <select
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none text-sm"
                                                value={formData.payment_method}
                                                onChange={e => setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })}
                                            >
                                                <option value="DEBITO">Débito</option>
                                                <option value="CREDITO">Crédito</option>
                                                <option value="PIX">Pix</option>
                                                <option value="DINHEIRO">Dinheiro</option>
                                                <option value="BOLETO">Boleto</option>
                                                <option value="TRANSFERENCIA">Transferência</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Credit Card Specific */}
                                    {formData.type === 'DESPESA' && formData.payment_method === 'CREDITO' && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cartão</label>
                                                <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none text-sm" value={formData.card_id} onChange={e => setFormData({ ...formData, card_id: e.target.value })} required >
                                                    <option value="">Selecione...</option>
                                                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>

                                            {!editingTransaction && (
                                                <div className="flex items-center space-x-3 pt-2">
                                                    <input type="checkbox" id="installments" checked={formData.is_installment} onChange={e => setFormData({ ...formData, is_installment: e.target.checked })} className="w-4 h-4 text-orange-600 rounded" />
                                                    <label htmlFor="installments" className="text-sm font-medium text-slate-700">Parcelar compra?</label>
                                                </div>
                                            )}

                                            {formData.is_installment && (
                                                <div className="bg-white p-3 rounded-lg border border-slate-200">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número de Parcelas</label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="number" min="2" max="48"
                                                            className="w-20 border border-slate-200 rounded-lg px-2 py-1 outline-none font-bold text-center"
                                                            value={formData.installments_count}
                                                            onChange={e => setFormData({ ...formData, installments_count: Number(e.target.value) })}
                                                        />
                                                        <div className="text-xs text-slate-500">
                                                            x {formatCurrency(Number(formData.amount) / Math.max(1, formData.installments_count))} / mês
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Account Selection (Deb/Pix/Transf) */}
                                    {showAccount && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 font-xs">Conta</label>
                                            <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none text-sm" value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })} required={showAccount} >
                                                <option value="">Selecione...</option>
                                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>


                                {/* Status Final */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status da Transação</label>
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        {(formData.type === 'RECEITA' ?
                                            ['PREVISTA', 'CONFIRMADA', 'RECEBIDA', 'ATRASADA'] :
                                            ['PREVISTA', 'CONFIRMADA', 'PAGA', 'ATRASADA']
                                        ).map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, status: s as TransactionStatus })}
                                                className={`flex-1 py-1 text-[10px] font-bold rounded uppercase transition-all ${formData.status === s ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ── TRANSFER FORM ── */}
                                {isTransferMode ? (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 font-medium">
                                            Mova dinheiro entre suas contas sem afetar receitas ou despesas.
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">De (Origem)</label>
                                                <select
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none text-sm focus:ring-2 focus:ring-blue-500/20"
                                                    value={transferData.from}
                                                    onChange={e => setTransferData({ ...transferData, from: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Selecione...</option>
                                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Para (Destino)</label>
                                                <select
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none text-sm focus:ring-2 focus:ring-blue-500/20"
                                                    value={transferData.to}
                                                    onChange={e => setTransferData({ ...transferData, to: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Selecione...</option>
                                                    {accounts.filter(a => a.id !== transferData.from).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor</label>
                                                <input
                                                    type="number" step="0.01" min="0.01"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none font-mono text-lg font-bold text-blue-700 focus:ring-2 focus:ring-blue-500/20"
                                                    value={transferData.amount === '0' ? '' : transferData.amount}
                                                    onChange={e => setTransferData({ ...transferData, amount: e.target.value })}
                                                    placeholder="0,00"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                                                <input
                                                    type="date"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none text-sm focus:ring-2 focus:ring-blue-500/20"
                                                    value={transferData.date}
                                                    onChange={e => setTransferData({ ...transferData, date: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição (Opcional)</label>
                                            <input
                                                type="text"
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none text-sm focus:ring-2 focus:ring-blue-500/20"
                                                value={transferData.description}
                                                onChange={e => setTransferData({ ...transferData, description: e.target.value })}
                                                placeholder="Ex: Reserva de emergência"
                                            />
                                        </div>
                                        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium" disabled={isSaving}>Cancelar</button>
                                            <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2" disabled={isSaving}>
                                                {isSaving ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />Salvando...</> : <><ArrowRightLeft size={16} />Transferir</>}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="px-5 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium disabled:opacity-50"
                                            disabled={isSaving}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-lg shadow-slate-900/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            disabled={isSaving}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                    Salvando...
                                                </>
                                            ) : (
                                                editingTransaction ? 'Salvar Alterações' : 'Criar Transação'
                                            )}
                                        </button>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                )
            }

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

            {/* NEW CATEGORY MODAL */}
            {
                isCategoryModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-bold text-slate-800">Nova Categoria</h3>
                                <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 text-2xl leading-none">&times;</button>
                            </div>

                            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Categoria</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                        value={categoryFormData.name}
                                        onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                                        required
                                        placeholder="Ex: Assinaturas, Mercado..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cor</label>
                                    <div className="grid grid-cols-6 gap-2">
                                        {['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#2dd4bf', '#d946ef', '#ec4899', '#64748b', '#000000'].map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setCategoryFormData({ ...categoryFormData, color })}
                                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${categoryFormData.color === color ? 'border-slate-800 ring-2 ring-slate-200' : 'border-transparent'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="flex-1 py-2.5 text-sm text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">Cancelar</button>
                                    <button type="submit" className="flex-[2] py-2.5 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 transition-transform active:scale-95">Criar Categoria</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            <div className="fixed bottom-6 right-6 z-40">
                <button
                    id="trigger-new-transaction"
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg shadow-indigo-600/30 transition-transform hover:scale-105 active:scale-95"
                >
                    <Plus size={24} />
                </button>
            </div>
        </div >
    );
}
