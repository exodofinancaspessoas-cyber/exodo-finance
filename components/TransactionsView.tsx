
import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Filter, Plus, Edit, Trash2, CreditCard, X, ChevronDown,
    Download, Trash, Copy, CheckSquare, Square, Calendar, Check, CheckCircle
} from 'lucide-react';
import { Transaction, TransactionType, TransactionStatus, PaymentMethod, Account, Card, Category } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../utils';
import ExportModal from './ExportModal';

interface TransactionsViewProps {
    initialType?: TransactionType | 'ALL';
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

const initialFilters: FilterState = {
    search: '',
    type: 'ALL',
    status: 'ALL',
    category: 'ALL',
    account: 'ALL',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: ''
};

export default function TransactionsView({ initialType = 'ALL' }: TransactionsViewProps) {
    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false); // New state for export
    const [filters, setFilters] = useState<FilterState>({ ...initialFilters, type: initialType });
    const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

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
        installments_count: 1
    });

    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [payTrx, setPayTrx] = useState<Transaction | null>(null);
    const [payFormData, setPayFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        payment_method: 'DEBITO' as PaymentMethod,
        account_id: '',
        card_id: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [trxs, accs, crds, cats] = await Promise.all([
            StorageService.getTransactions(),
            StorageService.getAccounts(),
            StorageService.getCards(),
            StorageService.getCategories()
        ]);

        // Ensure "Pagamento de Cartão" category exists
        const hasCardPay = cats.find(c => c.name === 'Pagamento de Cartão');
        if (!hasCardPay) {
            const newCat: Category = {
                id: 'cat_card',
                name: 'Pagamento de Cartão',
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
    };

    // --- Advanced Filtering Logic ---
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
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
            if (filters.status !== 'ALL' && t.status !== filters.status) return false;

            // Category
            if (filters.category !== 'ALL' && t.category_id !== filters.category) return false;

            // Account/Card
            if (filters.account !== 'ALL') {
                if (t.account_id !== filters.account && t.card_id !== filters.account) return false;
            }

            // Date Range
            if (filters.startDate && new Date(t.date) < new Date(filters.startDate)) return false;
            if (filters.endDate && new Date(t.date) > new Date(filters.endDate)) return false;

            // Amount Range
            if (filters.minAmount && t.amount < Number(filters.minAmount)) return false;
            if (filters.maxAmount && t.amount > Number(filters.maxAmount)) return false;

            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, filters]);

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

        for (const id of Array.from(selectedTransactions)) {
            await StorageService.deleteTransaction(id as string);
        }

        setSelectedTransactions(new Set());
        await loadData();
    };

    // --- Form Logic ---
    const handleOpenModal = (trx?: Transaction, typeOverride?: TransactionType) => {
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
                installments_count: 1
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
                installments_count: 1
            });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Excluir transação?')) {
            await StorageService.deleteTransaction(id);
            await loadData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const totalAmount = Number(formData.amount);
        let finalAmount = totalAmount;
        let installmentsData = undefined;

        if (formData.is_installment && formData.installments_count > 1) {
            finalAmount = totalAmount / formData.installments_count;
            installmentsData = {
                current: 1,
                total: formData.installments_count
            };
        }

        const newTrx: Transaction = {
            id: editingTransaction ? editingTransaction.id : StorageService.generateId(),
            description: formData.description,
            amount: finalAmount,
            type: formData.type,
            category_id: formData.category_id || undefined,
            date: formData.date,
            status: formData.status,
            payment_method: formData.payment_method,
            account_id: formData.account_id || undefined,
            card_id: formData.card_id || undefined,
            observation: formData.observation,
            installments: installmentsData,
            created_at: new Date().toISOString()
        };

        await StorageService.saveTransaction(newTrx);
        setIsModalOpen(false);
        await loadData();
    };

    const handleOpenPayModal = (trx: Transaction) => {
        setPayTrx(trx);
        setPayFormData({
            date: new Date().toISOString().split('T')[0],
            payment_method: trx.payment_method || 'DEBITO',
            account_id: trx.account_id || '',
            card_id: trx.card_id || ''
        });
        setIsPayModalOpen(true);
    };

    const handleConfirmPay = async () => {
        if (!payTrx) return;

        const updatedTrx: Transaction = {
            ...payTrx,
            status: payTrx.type === 'RECEITA' ? 'RECEBIDA' : 'PAGA',
            date: payFormData.date,
            payment_method: payFormData.payment_method,
            account_id: payFormData.account_id || undefined,
            card_id: payFormData.card_id || undefined
        };

        await StorageService.saveTransaction(updatedTrx);
        setIsPayModalOpen(false);
        setPayTrx(null);
        await loadData();
    };

    // Dynamic Options
    const availableCategories = categories.filter(c => c.type === formData.type);
    const showPaymentMethod = formData.type === 'DESPESA';
    const showAccount = (formData.status === 'PAGA' || formData.status === 'RECEBIDA');

    // Status visual helper
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PREVISTA': return 'bg-yellow-100 text-yellow-700';
            case 'CONFIRMADA': return 'bg-cyan-100 text-cyan-700';
            case 'PAGA': return 'bg-green-100 text-green-700';
            case 'RECEBIDA': return 'bg-green-100 text-green-700';
            case 'ATRASADA': return 'bg-red-100 text-red-700';
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
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-down">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tipo</label>
                            <select
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                value={filters.type}
                                onChange={e => setFilters({ ...filters, type: e.target.value as any })}
                            >
                                <option value="ALL">Todos</option>
                                <option value="RECEITA">Receitas</option>
                                <option value="DESPESA">Despesas</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Status</label>
                            <select
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                value={filters.status}
                                onChange={e => setFilters({ ...filters, status: e.target.value as any })}
                            >
                                <option value="ALL">Todos</option>
                                <option value="PAGA">Paga</option>
                                <option value="RECEBIDA">Recebida</option>
                                <option value="PREVISTA">Prevista</option>
                                <option value="ATRASADA">Atrasada</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoria</label>
                            <select
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                value={filters.category}
                                onChange={e => setFilters({ ...filters, category: e.target.value })}
                            >
                                <option value="ALL">Todas</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Período</label>
                            <div className="flex gap-2">
                                <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                    value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
                                <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                                    value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
                            </div>
                        </div>

                        <div className="md:col-span-4 flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                onClick={() => setFilters(initialFilters)}
                                className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg"
                            >
                                Limpar Filtros
                            </button>
                            <button
                                onClick={() => setIsExportModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold"
                            >
                                <Download size={16} /> Exportar Filtrados
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Batch Actions Bar */}
            {selectedTransactions.size > 0 && (
                <div className="bg-slate-800 text-white p-3 rounded-lg flex items-center justify-between shadow-lg animate-fade-in sticky top-4 z-30">
                    <span className="font-bold text-sm ml-2">{selectedTransactions.size} selecionados</span>
                    <div className="flex gap-2">
                        <button onClick={handleBatchDelete} className="p-2 hover:bg-slate-700 rounded-lg text-red-300 hover:text-red-200 flex items-center gap-2 text-sm" title="Excluir">
                            <Trash2 size={16} /> Excluir
                        </button>
                    </div>
                </div>
            )}

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
                                const category = categories.find(c => c.id === t.category_id);
                                const isSelected = selectedTransactions.has(t.id);

                                return (
                                    <tr key={t.id} className={`hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="px-4 py-4">
                                            <button onClick={() => toggleSelection(t.id)} className={`${isSelected ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-400'}`}>
                                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap font-mono text-xs">{formatDate(t.date)}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800">
                                            <div className="flex flex-col">
                                                <span>{t.description}</span>
                                                {t.installments && (
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 w-fit px-1 rounded flex items-center gap-1">
                                                        <CreditCard size={10} /> {t.installments.current}/{t.installments.total}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            <span className="flex items-center gap-1">
                                                {category?.name || 'Geral'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${getStatusColor(t.status)}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold ${t.type === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'RECEITA' ? '+' : '-'}{formatCurrency(t.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end space-x-2 items-center">
                                                {t.status !== 'PAGA' && t.status !== 'RECEBIDA' && (
                                                    <button
                                                        onClick={() => handleOpenPayModal(t)}
                                                        className="p-1 px-2 bg-green-50 text-green-600 rounded-lg font-bold text-[10px] flex items-center gap-1 hover:bg-green-100 transition-colors"
                                                    >
                                                        <Check size={14} /> QUITAR
                                                    </button>
                                                )}
                                                <button onClick={() => handleOpenModal(t)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors"><Edit size={16} /></button>
                                                <button onClick={() => handleDelete(t.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 group-hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
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
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="font-bold text-lg text-slate-800">{editingTransaction ? 'Editar' : 'Nova'} Transação</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Type Toggle */}
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'RECEITA' })}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${formData.type === 'RECEITA' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-400'}`}
                                >
                                    Receita
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'DESPESA' })}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${formData.type === 'DESPESA' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-400'}`}
                                >
                                    Despesa
                                </button>
                            </div>

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
                                        className={`w-full border border-slate-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 font-mono text-lg font-bold ${formData.type === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        required
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

                            {/* Categories Palls */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Categoria</label>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                    {availableCategories.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, category_id: c.id })}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${formData.category_id === c.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                        >
                                            {c.name}
                                        </button>
                                    ))}
                                    <button type="button" className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-slate-300 text-slate-400 hover:text-slate-600">+ Nova</button>
                                </div>
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

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancelar</button>
                                <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-lg shadow-slate-900/10">
                                    {editingTransaction ? 'Salvar Alterações' : 'Criar Transação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                transactions={filteredTransactions}
                categories={categories}
            />

            {/* QUICK PAY MODAL */}
            {isPayModalOpen && payTrx && (
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
            )}

            <div className="fixed bottom-6 right-6 z-40">
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg shadow-indigo-600/30 transition-transform hover:scale-105 active:scale-95"
                >
                    <Plus size={24} />
                </button>
            </div>
        </div>
    );
}
