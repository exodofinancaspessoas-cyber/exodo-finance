import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    X, Plus, Minus, CreditCard, Banknote, Landmark, Check, AlertCircle,
    ChevronDown, Calendar, Tag, RefreshCw, Search, ArrowRightLeft,
    Camera, Mic, StopCircle, Play, Sparkles, ScanLine, Loader2, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { StorageService } from '../services/storage';
import {
    Transaction, TransactionType, PaymentMethod, Account, Card,
    Category, TransactionStatus, RecurrenceType, RecurrenceFrequency
} from '../types';
import { formatCurrency, toISODate } from '../utils';
import { suggestCategory, scanReceipt as scanReceiptAI } from '../services/aiService';

interface TransactionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialTransaction?: Transaction | null;
    initialType?: TransactionType | 'ALL';
}

export default function TransactionFormModal({
    isOpen,
    onClose,
    onSuccess,
    initialTransaction = null,
    initialType = 'ALL'
}: TransactionFormModalProps) {
    // --- Data State ---
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // --- Form State ---
    const [isTransferMode, setIsTransferMode] = useState(false);
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        type: 'DESPESA' as TransactionType,
        category_id: '',
        date: toISODate(new Date()),
        status: 'PAGA' as TransactionStatus,
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
        recurring_duration: '',
        programmed_amount: '',
        interest_amount: ''
    });

    const [transferData, setTransferData] = useState({
        from: '',
        to: '',
        amount: '',
        date: toISODate(new Date()),
        description: ''
    });

    // --- AI & Media State ---
    const [isAISuggesting, setIsAISuggesting] = useState(false);
    const [isOCRScanning, setIsOCRScanning] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
    const [capturedAudio, setCapturedAudio] = useState<Blob | null>(null);
    const ocrInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // --- Selectors ---
    const [categorySearch, setCategorySearch] = useState('');
    const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
    const [isCategoryListExpanded, setIsCategoryListExpanded] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadData();
            if (initialTransaction) {
                setFormData({
                    description: initialTransaction.description,
                    amount: String(initialTransaction.amount),
                    type: initialTransaction.type,
                    category_id: initialTransaction.category_id,
                    date: initialTransaction.date,
                    status: initialTransaction.status,
                    payment_method: initialTransaction.payment_method || 'DEBITO',
                    account_id: initialTransaction.account_id || '',
                    card_id: initialTransaction.card_id || '',
                    observation: initialTransaction.observation || '',
                    is_installment: false,
                    installments_count: 1,
                    is_recurring: false,
                    recurring_type: 'FIXO',
                    frequency: 'MENSAL',
                    day_of_month: initialTransaction.date ? new Date(initialTransaction.date + 'T12:00:00').getDate() : new Date().getDate(),
                    recurring_duration: '',
                    programmed_amount: '',
                    interest_amount: initialTransaction.interest_amount ? String(initialTransaction.interest_amount) : ''
                });
            } else if (initialType !== 'ALL') {
                setFormData(prev => ({
                    ...prev,
                    type: initialType as TransactionType,
                    status: initialType === 'RECEITA' ? 'RECEBIDA' : 'PAGA'
                }));
            }
        }
    }, [isOpen, initialTransaction, initialType]);

    const loadData = async () => {
        const [accs, crds, cats] = await Promise.all([
            StorageService.getAccounts(),
            StorageService.getCards(),
            StorageService.getCategories()
        ]);
        setAccounts(accs);
        setCards(crds);
        setCategories(cats);
    };

    // --- Handlers ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);
        try {
            const numericAmount = parseFloat(formData.amount);
            const numericInterest = parseFloat(formData.interest_amount || '0');
            const installmentsCount = formData.is_installment ? Math.max(1, formData.installments_count) : 1;
            const amountPerInstallment = numericAmount / installmentsCount;
            const baseDate = new Date(formData.date + 'T12:00:00');

            const transactionsToSave: Transaction[] = [];

            for (let i = 0; i < installmentsCount; i++) {
                const currentDate = new Date(baseDate);
                currentDate.setMonth(baseDate.getMonth() + i);

                const trx: Transaction = {
                    id: (i === 0 && initialTransaction) ? initialTransaction.id : StorageService.generateId(),
                    description: installmentsCount > 1
                        ? `${formData.description} (${i + 1}/${installmentsCount})`
                        : formData.description,
                    amount: amountPerInstallment,
                    type: formData.type,
                    category_id: formData.category_id || undefined,
                    date: toISODate(currentDate),
                    status: (i === 0) ? formData.status : 'PREVISTA',
                    payment_method: formData.payment_method,
                    account_id: formData.account_id || undefined,
                    card_id: formData.card_id || undefined,
                    observation: formData.observation,
                    interest_amount: i === 0 ? numericInterest : 0,
                    created_at: (i === 0 && initialTransaction) ? initialTransaction.created_at : new Date().toISOString()
                };

                if (formData.is_recurring && !initialTransaction && i === 0) {
                    const recurringId = StorageService.generateId();
                    trx.recurrence_id = recurringId;

                    const nextDate = new Date(baseDate);
                    const durationTotal = formData.recurring_duration ? Number(formData.recurring_duration) : undefined;

                    switch (formData.frequency) {
                        case 'DIARIO': nextDate.setDate(nextDate.getDate() + 1); break;
                        case 'SEMANAL': nextDate.setDate(nextDate.getDate() + 7); break;
                        case 'ANUAL': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
                        case 'MENSAL':
                        default: nextDate.setMonth(nextDate.getMonth() + 1); break;
                    }

                    await StorageService.saveRecurringExpense({
                        id: recurringId,
                        description: formData.description,
                        amount: amountPerInstallment,
                        category_id: formData.category_id,
                        type: formData.recurring_type,
                        frequency: formData.frequency,
                        day_of_month: formData.day_of_month,
                        active: true,
                        auto_create: true,
                        start_date: toISODate(nextDate),
                        account_id: formData.account_id || undefined,
                        card_id: formData.card_id || undefined,
                        payment_method: formData.payment_method,
                        duration_count: durationTotal && durationTotal > 1 ? durationTotal - 1 : undefined,
                        programmed_amount: formData.recurring_type === 'VARIAVEL' ? Number(formData.programmed_amount) : amountPerInstallment
                    });
                }
                transactionsToSave.push(trx);
            }

            if (transactionsToSave.length > 1) {
                await StorageService.saveTransactions(transactionsToSave);
            } else {
                await StorageService.saveTransaction(transactionsToSave[0]);
            }

            await StorageService.processRecurringExpenses();
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar transação');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTransferSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await StorageService.saveTransfer({
                id: StorageService.generateId(),
                from_account_id: transferData.from,
                to_account_id: transferData.to,
                amount: parseFloat(transferData.amount),
                date: transferData.date,
                description: transferData.description,
                created_at: new Date().toISOString()
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Erro ao realizar transferência');
        } finally {
            setIsSaving(false);
        }
    };

    // AI Categorization
    const handleDescriptionBlur = async () => {
        if (formData.description.trim().length < 3 || formData.category_id) return;
        setIsAISuggesting(true);
        try {
            const result = await suggestCategory(formData.description, categories);
            if (result?.category_id) {
                setFormData(prev => ({ ...prev, category_id: result.category_id }));
            }
        } catch (e) {
            console.warn('[AI] Categorization failed:', e);
        } finally {
            setIsAISuggesting(false);
        }
    };

    // OCR Scanning
    const handleOCRCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsOCRScanning(true);
        try {
            const result = await scanReceiptAI(file);
            if (result) {
                setFormData(prev => ({
                    ...prev,
                    description: result.description || prev.description,
                    amount: result.amount ? String(result.amount) : prev.amount,
                    date: result.date || prev.date
                }));
            }
        } catch (e) {
            console.warn('[AI] OCR failed:', e);
        } finally {
            setIsOCRScanning(false);
        }
    };

    // --- Computed ---
    const filteredCategories = useMemo(() => {
        let list = categories.filter(c => c.type === (isTransferMode ? 'AMBOS' : formData.type) || c.type === 'AMBOS');
        if (categorySearch) {
            const low = categorySearch.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(low));
        }
        return list;
    }, [categories, formData.type, categorySearch, isTransferMode]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in overflow-hidden">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
                {/* Header */}
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 sticky top-0 z-20 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isTransferMode ? 'bg-blue-100 text-blue-600' : formData.type === 'RECEITA' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {isTransferMode ? <ArrowRightLeft size={20} /> : formData.type === 'RECEITA' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-slate-800 tracking-tight">
                                {isTransferMode ? 'Nova Transferência' : initialTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Gestão Financeira Completa</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-400 transition-all active:scale-90">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Mode Toggle */}
                    {!initialTransaction && (
                        <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1.5">
                            <button
                                type="button"
                                onClick={() => { setIsTransferMode(false); setFormData({ ...formData, type: 'RECEITA' }); }}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isTransferMode && formData.type === 'RECEITA' ? 'bg-white text-emerald-600 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Receita
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsTransferMode(false); setFormData({ ...formData, type: 'DESPESA' }); }}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isTransferMode && formData.type === 'DESPESA' ? 'bg-white text-rose-600 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Despesa
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsTransferMode(true)}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${isTransferMode ? 'bg-white text-blue-600 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Transferência
                            </button>
                        </div>
                    )}

                    <form onSubmit={isTransferMode ? handleTransferSubmit : handleSubmit} className="space-y-6">
                        {isTransferMode ? (
                            /* TRANSFER FORM */
                            <div className="space-y-5 animate-in slide-in-from-top-4 duration-500">
                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-[11px] text-blue-700 font-bold leading-relaxed flex items-start gap-2.5">
                                    <Sparkles size={14} className="mt-0.5 shrink-0" />
                                    Transfira entre suas contas e o saldo se ajustará automaticamente sem afetar suas estatísticas de receita/despesa.
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Origem</label>
                                        <select
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-xs font-black outline-none focus:bg-white focus:border-blue-500/10 transition-all appearance-none"
                                            value={transferData.from}
                                            onChange={e => setTransferData({ ...transferData, from: e.target.value })}
                                            required
                                        >
                                            <option value="">Selecione...</option>
                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Destino</label>
                                        <select
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-xs font-black outline-none focus:bg-white focus:border-blue-500/10 transition-all appearance-none"
                                            value={transferData.to}
                                            onChange={e => setTransferData({ ...transferData, to: e.target.value })}
                                            required
                                        >
                                            <option value="">Selecione...</option>
                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Valor da Transferência</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-black text-blue-600">R$</span>
                                        <input
                                            type="number" step="0.01"
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-3xl pl-12 pr-6 py-5 text-2xl font-black outline-none focus:bg-white focus:border-blue-500/10 transition-all"
                                            value={transferData.amount}
                                            onChange={e => setTransferData({ ...transferData, amount: e.target.value })}
                                            onFocus={e => e.target.select()}
                                            required
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Data</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-xs font-black outline-none"
                                            value={transferData.date}
                                            onChange={e => setTransferData({ ...transferData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Identificação</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-xs font-black outline-none"
                                            value={transferData.description}
                                            onChange={e => setTransferData({ ...transferData, description: e.target.value })}
                                            placeholder="Ex: Reserva, Reserva"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full py-5 rounded-3xl bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all hover:bg-blue-700 disabled:opacity-50 mt-4"
                                >
                                    {isSaving ? 'Processando...' : 'Confirmar Transferência'}
                                </button>
                            </div>
                        ) : (
                            /* TRANSACTION FORM */
                            <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">O que é este lançamento?</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => ocrInputRef.current?.click()} className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center transition-all active:scale-75 shadow-sm border border-orange-100">
                                                <ScanLine size={14} />
                                            </button>
                                            <input type="file" ref={ocrInputRef} onChange={handleOCRCapture} accept="image/*" className="hidden" />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-3xl p-5 text-lg font-black outline-none focus:bg-white focus:border-emerald-500/10 transition-all placeholder:text-slate-200"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            onBlur={handleDescriptionBlur}
                                            required
                                            placeholder="Ex: Farmácia, Restaurante, Salário..."
                                        />
                                        {isAISuggesting && (
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-white py-1.5 px-3 rounded-full shadow-sm border border-slate-50">
                                                <Loader2 size={12} className="animate-spin text-orange-500" />
                                                <span className="text-[8px] font-black text-orange-500 uppercase">IA Analisando</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Valor Total</label>
                                        <div className="relative">
                                            <span className={`absolute left-5 top-1/2 -translate-y-1/2 font-black ${formData.type === 'RECEITA' ? 'text-emerald-600' : 'text-rose-600'}`}>R$</span>
                                            <input
                                                type="number" step="0.01"
                                                className={`w-full bg-slate-50 border-2 border-slate-50 rounded-3xl pl-12 pr-4 py-5 font-black text-xl outline-none focus:bg-white transition-all ${formData.type === 'RECEITA' ? 'text-emerald-700 focus:border-emerald-500/10' : 'text-rose-700 focus:border-rose-500/10'}`}
                                                value={formData.amount}
                                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                                onFocus={e => e.target.select()}
                                                required
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 pl-1">Juros / Multa</label>
                                        <div className="relative">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-indigo-500">R$</span>
                                            <input
                                                type="number" step="0.01"
                                                className="w-full bg-indigo-50/20 border-2 border-indigo-50 rounded-3xl pl-12 pr-4 py-5 font-black text-xl outline-none focus:bg-white focus:border-indigo-500/10 transition-all text-indigo-700"
                                                value={formData.interest_amount}
                                                onChange={e => setFormData({ ...formData, interest_amount: e.target.value })}
                                                onFocus={e => e.target.select()}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Category Selector */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Categoria</label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Pesquisar categoria..."
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-3xl pl-12 pr-20 py-4 text-[11px] font-bold outline-none focus:bg-white focus:border-slate-100 transition-all"
                                            value={categorySearch}
                                            onChange={e => { setCategorySearch(e.target.value); setIsCategoryListExpanded(true); }}
                                            onFocus={() => setIsCategoryListExpanded(true)}
                                        />
                                        {formData.category_id && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-full shadow-lg">
                                                <Tag size={10} />
                                                <span className="text-[9px] font-black uppercase truncate max-w-[80px]">
                                                    {categories.find(c => c.id === formData.category_id)?.name}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {isCategoryListExpanded && (
                                        <div className="bg-slate-50 rounded-3xl p-4 grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-300 custom-scrollbar">
                                            {filteredCategories.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => { setFormData({ ...formData, category_id: c.id }); setIsCategoryListExpanded(false); setCategorySearch(''); }}
                                                    className={`p-3 rounded-2xl flex items-center gap-3 transition-all active:scale-[0.98] ${formData.category_id === c.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: formData.category_id === c.id ? 'transparent' : c.color + '20', color: formData.category_id === c.id ? 'white' : c.color }}>
                                                        <Tag size={12} fill={formData.category_id === c.id ? 'white' : 'currentColor'} />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-tight truncate">{c.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Payment Info */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Forma de Pagamento</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { id: 'DINHEIRO', label: 'Cash', icon: Banknote },
                                            { id: 'PIX', label: 'Pix', icon: Landmark },
                                            { id: 'DEBITO', label: 'Débito', icon: Landmark },
                                            { id: 'CREDITO', label: 'Crédito', icon: CreditCard },
                                        ].map(method => (
                                            <button
                                                key={method.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, payment_method: method.id as PaymentMethod })}
                                                className={`py-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${formData.payment_method === method.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                                            >
                                                <method.icon size={16} />
                                                <span className="text-[8px] font-black uppercase tracking-widest">{method.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {(formData.payment_method === 'DEBITO' || formData.payment_method === 'PIX') && (
                                        <div className="space-y-2 animate-in fade-in duration-300">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Conta Bancária</label>
                                            <select
                                                className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-xs font-black outline-none focus:bg-white transition-all appearance-none"
                                                value={formData.account_id}
                                                onChange={e => setFormData({ ...formData, account_id: e.target.value })}
                                                required
                                            >
                                                <option value="">Selecione a conta...</option>
                                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {formData.payment_method === 'CREDITO' && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Cartão de Crédito</label>
                                                <select
                                                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-xs font-black outline-none focus:bg-white transition-all appearance-none"
                                                    value={formData.card_id}
                                                    onChange={e => setFormData({ ...formData, card_id: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Selecione o cartão...</option>
                                                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <label className={`flex items-center space-x-3 p-4 border rounded-2xl cursor-pointer transition-all ${formData.is_installment ? 'bg-indigo-50 border-indigo-200' : 'border-slate-100 hover:bg-slate-50'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_installment}
                                                        onChange={e => setFormData({ ...formData, is_installment: e.target.checked })}
                                                        className="w-4 h-4 text-indigo-600 rounded"
                                                    />
                                                    <span className="text-[10px] font-black uppercase text-slate-700">Parcelado?</span>
                                                </label>
                                                {formData.is_installment && (
                                                    <div className="flex items-center bg-slate-50 rounded-2xl px-4 py-2">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase mr-3">Em:</span>
                                                        <input
                                                            type="number" min="2" max="120"
                                                            className="bg-transparent w-full text-xs font-black outline-none text-slate-900"
                                                            value={formData.installments_count}
                                                            onChange={e => setFormData({ ...formData, installments_count: Number(e.target.value) })}
                                                        />
                                                        <span className="text-[9px] font-black text-slate-400 uppercase">x</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Extra Configs */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Data</label>
                                            <input
                                                type="date"
                                                className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-xs font-black outline-none focus:bg-white transition-all"
                                                value={formData.date}
                                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Status</label>
                                            <select
                                                className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-xs font-black outline-none focus:bg-white transition-all appearance-none"
                                                value={formData.status}
                                                onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                                                required
                                            >
                                                {formData.type === 'RECEITA' ? (
                                                    <>
                                                        <option value="PREVISTA">Prevista</option>
                                                        <option value="RECEBIDA">Recebida</option>
                                                        <option value="ATRASADA">Atrasada</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="PREVISTA">Prevista</option>
                                                        <option value="CONFIRMADA">Agendada</option>
                                                        <option value="PAGA">Paga</option>
                                                        <option value="ATRASADA">Atrasada</option>
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                    </div>

                                    {!formData.is_installment && (
                                        <div className="space-y-4">
                                            <label className={`flex items-center space-x-3 p-4 border rounded-2xl cursor-pointer transition-all ${formData.is_recurring ? 'bg-indigo-50 border-indigo-200' : 'border-slate-100'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_recurring}
                                                    onChange={e => setFormData({ ...formData, is_recurring: e.target.checked })}
                                                    className="w-4 h-4 text-indigo-600 rounded"
                                                />
                                                <span className="text-[10px] font-black uppercase text-slate-700">Repetir (Fixos/Variáveis)?</span>
                                            </label>

                                            {formData.is_recurring && (
                                                <div className="p-5 bg-slate-50 rounded-[24px] space-y-5 animate-in fade-in slide-in-from-top-2 border border-slate-100 shadow-inner">
                                                    <div className="space-y-3">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Este valor é...</label>
                                                        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, recurring_type: 'FIXO' })}
                                                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.recurring_type === 'FIXO' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                                                            >
                                                                Fixo
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, recurring_type: 'VARIAVEL' })}
                                                                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.recurring_type === 'VARIAVEL' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                                                            >
                                                                Variável
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Frequência</label>
                                                            <div className="relative">
                                                                <RefreshCw size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" />
                                                                <select
                                                                    className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-10 pr-4 py-3 text-xs font-black outline-none focus:border-indigo-100 appearance-none"
                                                                    value={formData.frequency}
                                                                    onChange={e => setFormData({ ...formData, frequency: e.target.value as RecurrenceFrequency })}
                                                                >
                                                                    <option value="DIARIO">Diário</option>
                                                                    <option value="SEMANAL">Semanal</option>
                                                                    <option value="MENSAL">Mensal</option>
                                                                    <option value="ANUAL">Anual</option>
                                                                </select>
                                                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vencimento</label>
                                                            <div className="relative">
                                                                <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" />
                                                                <select
                                                                    className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-10 pr-4 py-3 text-xs font-black outline-none focus:border-indigo-100 appearance-none"
                                                                    value={formData.day_of_month}
                                                                    onChange={e => setFormData({ ...formData, day_of_month: Number(e.target.value) })}
                                                                >
                                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                                        <option key={d} value={d}>Dia {d}</option>
                                                                    ))}
                                                                </select>
                                                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center px-1">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Repetições</label>
                                                            <span className="text-[8px] font-bold text-slate-300 uppercase">Opcional</span>
                                                        </div>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-white border-2 border-slate-100 rounded-2xl p-3 text-xs font-black outline-none focus:border-indigo-100"
                                                            placeholder="Indeterminado (Até cancelar)"
                                                            value={formData.recurring_duration}
                                                            onChange={e => setFormData({ ...formData, recurring_duration: e.target.value })}
                                                        />
                                                    </div>

                                                    {formData.recurring_type === 'VARIAVEL' && (
                                                        <div className="space-y-3 pt-4 border-t border-slate-200/60">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                                                                    <Sparkles size={14} />
                                                                </div>
                                                                <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Valor Programado</label>
                                                            </div>
                                                            <div className="relative">
                                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-orange-500 text-sm">R$</span>
                                                                <input
                                                                    type="number" step="0.01"
                                                                    className="w-full bg-white border-2 border-orange-100/50 rounded-2xl pl-11 pr-4 py-4 text-sm font-black outline-none focus:border-orange-200 transition-all text-orange-900 shadow-sm"
                                                                    value={formData.programmed_amount}
                                                                    onChange={e => setFormData({ ...formData, programmed_amount: e.target.value })}
                                                                    placeholder="0,00"
                                                                />
                                                            </div>
                                                            <p className="text-[9px] text-slate-400 leading-tight font-medium px-1 italic">
                                                                * Para itens variáveis, este valor gera previsões automáticas no seu fluxo de caixa futuro.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Observações</label>
                                        <textarea
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-xs font-medium outline-none focus:bg-white transition-all resize-none h-20"
                                            value={formData.observation}
                                            onChange={e => setFormData({ ...formData, observation: e.target.value })}
                                            placeholder="Alguma nota extra sobre este lançamento..."
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`w-full py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3 ${formData.type === 'RECEITA' ? 'bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700' : 'bg-rose-600 shadow-rose-500/20 hover:bg-rose-700'} text-white`}
                                >
                                    {isSaving ? 'Processando...' : initialTransaction ? 'Atualizar Lançamento' : 'Confirmar Lançamento'}
                                    <Check size={18} strokeWidth={4} />
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
