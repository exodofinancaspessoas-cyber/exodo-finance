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
            <div className="ios-glass ios-squircle-md shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border animate-slide-up" style={{ borderColor: 'var(--ios-glass-border)' }}>
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-black/5 sticky top-0 z-20 shrink-0" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isTransferMode ? 'bg-blue-500/10 text-blue-500' : formData.type === 'RECEITA' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {isTransferMode ? <ArrowRightLeft size={20} /> : formData.type === 'RECEITA' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                        </div>
                        <div>
                            <h3 className="font-black text-lg tracking-tight" style={{ color: 'var(--ios-text)' }}>
                                {isTransferMode ? 'Nova Transferência' : initialTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
                            </h3>
                            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest leading-none mt-0.5" style={{ color: 'var(--ios-text)' }}>Gestão Financeira Completa</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full transition-all active:scale-90" style={{ color: 'var(--ios-text-secondary)' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={isTransferMode ? handleTransferSubmit : handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Mode Toggle */}
                        {!initialTransaction && (
                            <div className="flex p-1.5 bg-black/5 rounded-2xl gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => { setIsTransferMode(false); setFormData({ ...formData, type: 'RECEITA' }); }}
                                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isTransferMode && formData.type === 'RECEITA' ? 'bg-[var(--ios-text)] text-[var(--ios-bg)] shadow-md scale-[1.02]' : 'text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)]'}`}
                                >
                                    Receita
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsTransferMode(false); setFormData({ ...formData, type: 'DESPESA' }); }}
                                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isTransferMode && formData.type === 'DESPESA' ? 'bg-[var(--ios-text)] text-[var(--ios-bg)] shadow-md scale-[1.02]' : 'text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)]'}`}
                                >
                                    Despesa
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsTransferMode(true)}
                                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${isTransferMode ? 'bg-[var(--ios-text)] text-[var(--ios-bg)] shadow-md scale-[1.02]' : 'text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)]'}`}
                                >
                                    Transferência
                                </button>
                            </div>
                        )}

                        {isTransferMode ? (
                            /* TRANSFER FORM */
                            <div className="space-y-5 animate-in slide-in-from-top-4 duration-500">
                                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-[11px] text-blue-500 font-bold leading-relaxed flex items-start gap-2.5">
                                    <Sparkles size={14} className="mt-0.5 shrink-0" />
                                    Transfira entre suas contas e o saldo se ajustará automaticamente sem afetar suas estatísticas de receita/despesa.
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Origem</label>
                                        <select
                                            className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-4 text-xs font-black outline-none focus:bg-transparent focus:border-blue-500/20 transition-all appearance-none"
                                            style={{ color: 'var(--ios-text)' }}
                                            value={transferData.from}
                                            onChange={e => setTransferData({ ...transferData, from: e.target.value })}
                                            required
                                        >
                                            <option value="" className="text-black">Selecione...</option>
                                            {accounts.map(a => <option key={a.id} value={a.id} className="text-black">{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Destino</label>
                                        <select
                                            className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-4 text-xs font-black outline-none focus:bg-transparent focus:border-blue-500/20 transition-all appearance-none"
                                            style={{ color: 'var(--ios-text)' }}
                                            value={transferData.to}
                                            onChange={e => setTransferData({ ...transferData, to: e.target.value })}
                                            required
                                        >
                                            <option value="" className="text-black">Selecione...</option>
                                            {accounts.map(a => <option key={a.id} value={a.id} className="text-black">{a.name}</option>)}
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
                                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Data</label>
                                        <input
                                            type="date"
                                            className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-4 text-xs font-black outline-none text-[var(--ios-text)]"
                                            value={transferData.date}
                                            onChange={e => setTransferData({ ...transferData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Identificação</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-4 text-xs font-black outline-none text-[var(--ios-text)] placeholder:opacity-20"
                                            value={transferData.description}
                                            onChange={e => setTransferData({ ...transferData, description: e.target.value })}
                                            placeholder="Ex: Reserva, Reserva"
                                        />
                                    </div>
                                </div>

                            </div>
                        ) : (
                            /* TRANSACTION FORM */
                            <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)]">O que é este lançamento?</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => ocrInputRef.current?.click()} className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center transition-all active:scale-75 shadow-sm border border-orange-500/20">
                                                <ScanLine size={14} />
                                            </button>
                                            <input type="file" ref={ocrInputRef} onChange={handleOCRCapture} accept="image/*" className="hidden" />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full bg-black/5 border-2 border-transparent rounded-3xl p-5 text-lg font-black outline-none focus:bg-transparent focus:border-emerald-500/10 transition-all text-[var(--ios-text)] placeholder:opacity-20"
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
                                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Valor Total</label>
                                        <div className="relative">
                                            <span className={`absolute left-5 top-1/2 -translate-y-1/2 font-black ${formData.type === 'RECEITA' ? 'text-emerald-500' : 'text-rose-500'}`}>R$</span>
                                            <input
                                                type="number" step="0.01"
                                                className={`w-full bg-black/5 border-2 border-transparent rounded-3xl pl-12 pr-4 py-5 font-black text-xl outline-none focus:bg-transparent transition-all ${formData.type === 'RECEITA' ? 'text-emerald-500 focus:border-emerald-500/10' : 'text-rose-500 focus:border-rose-500/10'}`}
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
                                                className="w-full bg-indigo-500/5 border-2 border-transparent rounded-3xl pl-12 pr-4 py-5 font-black text-xl outline-none focus:bg-transparent focus:border-indigo-500/10 transition-all text-indigo-500"
                                                value={formData.interest_amount}
                                                onChange={e => setFormData({ ...formData, interest_amount: e.target.value })}
                                                onFocus={e => e.target.select()}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Categoria</label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30 text-[var(--ios-text)]" />
                                        <input
                                            type="text"
                                            placeholder="Pesquisar categoria..."
                                            className="w-full bg-black/5 border-2 border-transparent rounded-3xl pl-12 pr-20 py-4 text-[11px] font-bold outline-none focus:bg-transparent focus:border-white/10 transition-all text-[var(--ios-text)] placeholder:opacity-20"
                                            value={categorySearch}
                                            onChange={e => { setCategorySearch(e.target.value); setIsCategoryListExpanded(true); }}
                                            onFocus={() => setIsCategoryListExpanded(true)}
                                        />
                                        {formData.category_id && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-[var(--ios-text)] text-[var(--ios-bg)] px-3 py-1.5 rounded-full shadow-lg">
                                                <Tag size={10} />
                                                <span className="text-[9px] font-black uppercase truncate max-w-[80px]">
                                                    {categories.find(c => c.id === formData.category_id)?.name}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {isCategoryListExpanded && (
                                        <div className="bg-black/5 rounded-3xl p-4 grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-300 custom-scrollbar border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                            {filteredCategories.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => { setFormData({ ...formData, category_id: c.id }); setIsCategoryListExpanded(false); setCategorySearch(''); }}
                                                    className={`p-3 rounded-2xl flex items-center gap-3 transition-all active:scale-[0.98] ${formData.category_id === c.id ? 'bg-[var(--ios-text)] text-[var(--ios-bg)] shadow-lg' : 'bg-[var(--ios-card-bg)] border border-white/5 hover:bg-black/5'}`}
                                                >
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: formData.category_id === c.id ? 'transparent' : c.color + '20', color: formData.category_id === c.id ? 'var(--ios-bg)' : c.color }}>
                                                        <Tag size={12} fill={formData.category_id === c.id ? 'currentColor' : 'currentColor'} />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-tight truncate" style={{ color: formData.category_id === c.id ? 'var(--ios-bg)' : 'var(--ios-text)' }}>{c.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Forma de Pagamento</label>
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
                                                className={`py-4 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${formData.payment_method === method.id ? 'border-orange-500/50 bg-orange-500/10 text-orange-500 shadow-sm' : 'border-transparent bg-black/5 text-[var(--ios-text-secondary)] opacity-40'}`}
                                            >
                                                <method.icon size={16} />
                                                <span className="text-[8px] font-black uppercase tracking-widest">{method.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {(formData.payment_method === 'DEBITO' || formData.payment_method === 'PIX') && (
                                        <div className="space-y-2 animate-in fade-in duration-300">
                                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Conta Bancária</label>
                                            <select
                                                className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-4 text-xs font-black outline-none focus:border-white/10 transition-all appearance-none text-[var(--ios-text)]"
                                                value={formData.account_id}
                                                onChange={e => setFormData({ ...formData, account_id: e.target.value })}
                                                required
                                            >
                                                <option value="" className="text-black">Selecione a conta...</option>
                                                {accounts.map(a => <option key={a.id} value={a.id} className="text-black">{a.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {formData.payment_method === 'CREDITO' && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Cartão de Crédito</label>
                                                <select
                                                    className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-4 text-xs font-black outline-none focus:border-white/10 transition-all appearance-none text-[var(--ios-text)]"
                                                    value={formData.card_id}
                                                    onChange={e => setFormData({ ...formData, card_id: e.target.value })}
                                                    required
                                                >
                                                    <option value="" className="text-black">Selecione o cartão...</option>
                                                    {cards.map(c => <option key={c.id} value={c.id} className="text-black">{c.name}</option>)}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <label className={`flex items-center space-x-3 p-4 border rounded-2xl cursor-pointer transition-all ${formData.is_installment ? 'bg-orange-500/10 border-orange-500/20' : 'border-white/5 hover:bg-black/5'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_installment}
                                                        onChange={e => setFormData({ ...formData, is_installment: e.target.checked })}
                                                        className="w-4 h-4 text-orange-500 rounded bg-transparent border-white/20"
                                                    />
                                                    <span className="text-[10px] font-black uppercase" style={{ color: 'var(--ios-text)' }}>Parcelado?</span>
                                                </label>
                                                {formData.is_installment && (
                                                    <div className="flex items-center bg-black/5 rounded-2xl px-4 py-2">
                                                        <span className="text-[9px] font-black opacity-30 uppercase mr-3" style={{ color: 'var(--ios-text)' }}>Em:</span>
                                                        <input
                                                            type="number" min="2" max="120"
                                                            className="bg-transparent w-full text-xs font-black outline-none text-[var(--ios-text)]"
                                                            value={formData.installments_count}
                                                            onChange={e => setFormData({ ...formData, installments_count: Number(e.target.value) })}
                                                        />
                                                        <span className="text-[9px] font-black opacity-30 uppercase" style={{ color: 'var(--ios-text)' }}>x</span>
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
                                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Data</label>
                                            <input
                                                type="date"
                                                className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-4 text-[16px] font-black outline-none focus:bg-transparent focus:border-white/10 transition-all text-[var(--ios-text)]"
                                                value={formData.date}
                                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Status</label>
                                            <select
                                                className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-4 text-[16px] font-black outline-none focus:bg-transparent focus:border-white/10 transition-all appearance-none text-[var(--ios-text)]"
                                                value={formData.status}
                                                onChange={e => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                                                required
                                            >
                                                {formData.type === 'RECEITA' ? (
                                                    <>
                                                        <option value="PREVISTA" className="text-black">Prevista</option>
                                                        <option value="RECEBIDA" className="text-black">Recebida</option>
                                                        <option value="ATRASADA" className="text-black">Atrasada</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="PREVISTA" className="text-black">Prevista</option>
                                                        <option value="CONFIRMADA" className="text-black">Agendada</option>
                                                        <option value="PAGA" className="text-black">Paga</option>
                                                        <option value="ATRASADA" className="text-black">Atrasada</option>
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {!formData.is_installment && (
                                    <div className="space-y-4">
                                        <label className={`flex items-center space-x-3 p-4 border rounded-2xl cursor-pointer transition-all ${formData.is_recurring ? 'bg-orange-500/10 border-orange-500/20' : 'border-white/5'}`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.is_recurring}
                                                onChange={e => setFormData({ ...formData, is_recurring: e.target.checked })}
                                                className="w-4 h-4 text-orange-500 rounded bg-transparent border-white/20"
                                            />
                                            <span className="text-[10px] font-black uppercase" style={{ color: 'var(--ios-text)' }}>Repetir (Fixos/Variáveis)??</span>
                                        </label>

                                        {formData.is_recurring && (
                                            <div className="p-5 bg-black/5 rounded-[24px] space-y-5 animate-in fade-in slide-in-from-top-2 border border-white/5 shadow-inner">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black opacity-30 uppercase tracking-widest px-1" style={{ color: 'var(--ios-text)' }}>Este valor é...</label>
                                                    <div className="flex bg-black/5 p-1 rounded-2xl border border-white/5 gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, recurring_type: 'FIXO' })}
                                                            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.recurring_type === 'FIXO' ? 'bg-[var(--ios-text)] text-[var(--ios-bg)] shadow-lg' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                                                        >
                                                            Fixo
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, recurring_type: 'VARIAVEL' })}
                                                            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.recurring_type === 'VARIAVEL' ? 'bg-orange-500 text-white shadow-lg' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                                                        >
                                                            Variável
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black opacity-30 uppercase tracking-widest px-1" style={{ color: 'var(--ios-text)' }}>Frequência</label>
                                                        <div className="relative">
                                                            <RefreshCw size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" />
                                                            <select
                                                                className="w-full bg-black/5 border-2 border-transparent rounded-2xl pl-10 pr-4 py-3 text-xs font-black outline-none focus:border-white/10 appearance-none text-[var(--ios-text)]"
                                                                value={formData.frequency}
                                                                onChange={e => setFormData({ ...formData, frequency: e.target.value as RecurrenceFrequency })}
                                                            >
                                                                <option value="DIARIO" className="text-black">Diário</option>
                                                                <option value="SEMANAL" className="text-black">Semanal</option>
                                                                <option value="MENSAL" className="text-black">Mensal</option>
                                                                <option value="ANUAL" className="text-black">Anual</option>
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none text-[var(--ios-text)]" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black opacity-30 uppercase tracking-widest px-1" style={{ color: 'var(--ios-text)' }}>Vencimento</label>
                                                        <div className="relative">
                                                            <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" />
                                                            <select
                                                                className="w-full bg-black/5 border-2 border-transparent rounded-2xl pl-10 pr-4 py-3 text-xs font-black outline-none focus:border-white/10 appearance-none text-[var(--ios-text)]"
                                                                value={formData.day_of_month}
                                                                onChange={e => setFormData({ ...formData, day_of_month: Number(e.target.value) })}
                                                            >
                                                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                                    <option key={d} value={d} className="text-black">Dia {d}</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none text-[var(--ios-text)]" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-[10px] font-black opacity-30 uppercase tracking-widest" style={{ color: 'var(--ios-text)' }}>Repetições</label>
                                                        <span className="text-[8px] font-bold opacity-20 uppercase" style={{ color: 'var(--ios-text)' }}>Opcional</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-3 text-[16px] font-black outline-none focus:border-white/10 text-[var(--ios-text)]"
                                                        placeholder="Indeterminado (Até cancelar)"
                                                        value={formData.recurring_duration}
                                                        onChange={e => setFormData({ ...formData, recurring_duration: e.target.value })}
                                                    />
                                                </div>

                                                {formData.recurring_type === 'VARIAVEL' && (
                                                    <div className="space-y-3 pt-4 border-t border-white/10">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                                                                <Sparkles size={14} />
                                                            </div>
                                                            <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Valor Programado</label>
                                                        </div>
                                                        <div className="relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-orange-500 text-sm">R$</span>
                                                            <input
                                                                type="number" step="0.01"
                                                                className="w-full bg-black/5 border-2 border-orange-500/10 rounded-2xl pl-11 pr-4 py-4 text-[16px] font-black outline-none focus:border-orange-500/30 transition-all text-orange-500 shadow-sm"
                                                                value={formData.programmed_amount}
                                                                onChange={e => setFormData({ ...formData, programmed_amount: e.target.value })}
                                                                placeholder="0,00"
                                                            />
                                                        </div>
                                                        <p className="text-[9px] opacity-30 leading-tight font-medium px-1 italic" style={{ color: 'var(--ios-text)' }}>
                                                            * Para itens variáveis, este valor gera previsões automáticas no seu fluxo de caixa futuro.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text)] pl-1">Observações</label>
                                    <textarea
                                        className="w-full bg-black/5 border-2 border-transparent rounded-2xl p-4 text-[16px] font-medium outline-none focus:bg-transparent focus:border-white/10 transition-all resize-none h-20 text-[var(--ios-text)] placeholder:opacity-20"
                                        value={formData.observation}
                                        onChange={e => setFormData({ ...formData, observation: e.target.value })}
                                        placeholder="Alguma nota extra sobre este lançamento..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-black/5 flex gap-3 border-t sticky bottom-0 z-20 shrink-0" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest bg-black/5 hover:bg-black/10 rounded-2xl transition-all active:scale-95"
                            style={{ color: 'var(--ios-text-secondary)' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-[2] py-4 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    {initialTransaction ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                                    <Check size={14} strokeWidth={4} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
