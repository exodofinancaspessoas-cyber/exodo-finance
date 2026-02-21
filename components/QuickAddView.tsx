import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, CreditCard, Banknote, Landmark, Check, AlertCircle, ChevronDown, Calendar, Tag, RefreshCw, Search, ChevronRight } from 'lucide-react';
import { StorageService } from '../services/storage';
import { Transaction, TransactionType, PaymentMethod, Account, Card, Category, TransactionStatus } from '../types';
import { formatCurrency, toISODate } from '../utils';

interface QuickAddViewProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function QuickAddView({ onClose, onSuccess }: QuickAddViewProps) {
    const [type, setType] = useState<TransactionType>('DESPESA');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(toISODate(new Date()));
    const [categoryId, setCategoryId] = useState('');
    const [status, setStatus] = useState<TransactionStatus>('PAGA');
    const [isRecurring, setIsRecurring] = useState(false);

    const [selectedPayment, setSelectedPayment] = useState<{
        method: PaymentMethod,
        accountId?: string,
        cardId?: string,
        label?: string
    } | null>(null);

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Selector States
    const [selectorOpen, setSelectorOpen] = useState<'CARD' | 'ACCOUNT' | null>(null);

    const amountInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
        const timer = setTimeout(() => {
            amountInputRef.current?.focus();
        }, 400);
        return () => clearTimeout(timer);
    }, []);

    const loadData = async () => {
        const [accs, crds, cats] = await Promise.all([
            StorageService.getAccounts(),
            StorageService.getCards(),
            StorageService.getCategories()
        ]);
        setAccounts(accs);
        setCards(crds);
        setCategories(cats.filter(c => (c.type as string) === type || c.type === 'AMBOS'));
    };

    useEffect(() => {
        loadData();
    }, [type]);

    const handleSave = async (isComplete: boolean) => {
        const numericAmount = parseFloat(amount.replace(',', '.'));

        if (isNaN(numericAmount) || numericAmount <= 0) {
            alert('Por favor, insira o valor.');
            amountInputRef.current?.focus();
            return;
        }

        if (isComplete) {
            if (!description.trim()) {
                alert('A descrição é obrigatória!');
                return;
            }
            if (!selectedPayment) {
                alert('Selecione a forma de pagamento!');
                return;
            }
            if (!categoryId) {
                alert('Selecione a categoria!');
                return;
            }
        }

        setIsSaving(true);
        try {
            const newTrx: Transaction = {
                id: StorageService.generateId(),
                description: description || (type === 'DESPESA' ? 'Despesa Rápida' : 'Receita Rápida'),
                amount: numericAmount,
                type: type,
                category_id: categoryId,
                date: date,
                status: isComplete ? status : 'INCOMPLETA',
                payment_method: selectedPayment?.method,
                account_id: selectedPayment?.accountId,
                card_id: selectedPayment?.cardId,
                created_at: new Date().toISOString(),
                observation: isRecurring ? 'Recorrência solicitada' : undefined
            };

            await StorageService.saveTransaction(newTrx);
            onSuccess();
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar transação');
        } finally {
            setIsSaving(false);
        }
    };

    const isReadyToComplete = amount && description && selectedPayment && categoryId;

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-stretch text-slate-900 animate-in slide-in-from-bottom duration-500 overflow-hidden h-[100dvh]">
            {/* Header */}
            <header className="p-6 flex justify-between items-center bg-white sticky top-0 z-30 shrink-0 border-b border-slate-50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl rotate-3">Ê</div>
                    <div className="flex flex-col">
                        <span className="font-black tracking-[0.2em] uppercase text-[11px] text-orange-600">Exodo Finance</span>
                        <span className="font-black text-lg text-slate-900 leading-none">Novo Lançamento</span>
                    </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-100 flex items-center justify-center transition-all active:scale-90 text-slate-400">
                    <X size={20} />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
                {/* HERO: The Amount Protagonist */}
                <section
                    className={`py-12 px-6 flex flex-col items-center justify-center transition-all relative overflow-hidden bg-white`}
                    onClick={() => amountInputRef.current?.focus()}
                >
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />

                    <label className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
                        Valor da {type === 'DESPESA' ? 'Despesa' : 'Receita'}
                    </label>

                    <div className="relative group flex flex-col items-center">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-200">R$</span>
                            <div className="relative border-b-2 border-slate-50 focus-within:border-orange-200 transition-all px-4 py-2">
                                <input
                                    ref={amountInputRef}
                                    type="text"
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0,00"
                                    className={`bg-transparent border-none outline-none text-7xl md:text-8xl font-black text-center w-full max-w-[320px] placeholder:text-slate-200 transition-colors ${type === 'DESPESA' ? 'text-slate-900' : 'text-slate-900'}`}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Switcher & Fields */}
                <div className="p-6 space-y-10 pb-48">

                    {/* Toggle Tipo */}
                    <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl relative border border-slate-200">
                        <button
                            onClick={() => setType('DESPESA')}
                            className={`py-4 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest z-10 ${type === 'DESPESA' ? 'bg-white text-red-600 shadow-xl' : 'text-slate-500'
                                }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${type === 'DESPESA' ? 'bg-red-600' : 'bg-slate-400'}`} />
                            Despesa
                        </button>
                        <button
                            onClick={() => setType('RECEITA')}
                            className={`py-4 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest z-10 ${type === 'RECEITA' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-500'
                                }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${type === 'RECEITA' ? 'bg-blue-600' : 'bg-slate-400'}`} />
                            Receita
                        </button>
                    </div>

                    {/* Descricao Section */}
                    <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 pl-1">O que é isso? <span className="text-orange-600">*</span></label>
                        <input
                            type="text"
                            placeholder="Descreva este lançamento..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-5 text-lg outline-none focus:bg-white focus:border-orange-500/10 transition-all font-bold placeholder:text-slate-200 shadow-sm"
                        />
                    </div>

                    {/* Pagamento Grid */}
                    <div className="space-y-4">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 pl-1">Forma de Pagamento <span className="text-orange-600">*</span></label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSelectedPayment({ method: 'DINHEIRO', label: 'Dinheiro' })}
                                className={`p-5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'DINHEIRO' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-500 opacity-60'}`}
                            >
                                <Banknote size={24} strokeWidth={1.5} />
                                <span className="text-[10px] font-black uppercase tracking-tight">Dinheiro</span>
                            </button>
                            <button
                                onClick={() => setSelectedPayment({ method: 'PIX', label: 'Pix' })}
                                className={`p-5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'PIX' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-500 opacity-60'}`}
                            >
                                <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center text-[10px] font-black text-white">P</div>
                                <span className="text-[10px] font-black uppercase tracking-tight">Pix</span>
                            </button>

                            {/* Cartão Trigger */}
                            <button
                                onClick={() => setSelectorOpen('CARD')}
                                className={`p-5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all relative ${selectedPayment?.method === 'CREDITO' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-500 opacity-60'}`}
                            >
                                <CreditCard size={24} strokeWidth={1.5} />
                                <span className="text-[10px] font-black uppercase tracking-tight truncate w-full px-1">
                                    {selectedPayment?.method === 'CREDITO' ? (selectedPayment.label || 'Crédito') : 'Cartão'}
                                </span>
                                <div className="absolute top-2 right-2 p-0.5 bg-orange-500 rounded-full text-white">
                                    <ChevronDown size={10} strokeWidth={3} />
                                </div>
                            </button>

                            {/* Débito/Conta Trigger */}
                            <button
                                onClick={() => setSelectorOpen('ACCOUNT')}
                                className={`p-5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all relative ${selectedPayment?.method === 'DEBITO' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-500 opacity-60'}`}
                            >
                                <Landmark size={24} strokeWidth={1.5} />
                                <span className="text-[10px] font-black uppercase tracking-tight truncate w-full px-1">
                                    {selectedPayment?.method === 'DEBITO' ? (selectedPayment.label || 'Débito') : 'Conta/Débito'}
                                </span>
                                <div className="absolute top-2 right-2 p-0.5 bg-orange-500 rounded-full text-white">
                                    <ChevronDown size={10} strokeWidth={3} />
                                </div>
                            </button>

                            <button
                                onClick={() => setSelectedPayment({ method: 'BOLETO', label: 'Boleto' })}
                                className={`p-5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'BOLETO' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-500 opacity-60'}`}
                            >
                                <div className="w-6 h-6 rounded border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-slate-900 italic">B</div>
                                <span className="text-[10px] font-black uppercase tracking-tight">Boleto</span>
                            </button>

                            <button
                                onClick={() => setSelectedPayment({ method: 'TRANSFERENCIA', label: 'Transferência' })}
                                className={`p-5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'TRANSFERENCIA' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-500 opacity-60'}`}
                            >
                                <RefreshCw size={24} strokeWidth={1.5} />
                                <span className="text-[10px] font-black uppercase tracking-tight">Transferência</span>
                            </button>
                        </div>
                    </div>

                    {/* Categoria Selector */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 pl-1">Categoria <span className="text-orange-600">*</span></label>
                        <div className="relative">
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full bg-slate-900 text-white rounded-2xl p-5 pl-6 appearance-none outline-none font-bold text-sm shadow-2xl border-none"
                            >
                                <option value="">SELECIONAR CATEGORIA</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                        </div>
                        <div className="relative group">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input
                                type="text"
                                placeholder="Filtrar categorias..."
                                value={categorySearch}
                                onChange={(e) => setCategorySearch(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 text-sm outline-none font-bold text-slate-500"
                            />
                        </div>
                    </div>

                    {/* Meta Data */}
                    <div className="grid grid-cols-2 gap-4 pt-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-500 pl-1">Data</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-bold outline-none"
                            />
                        </div>
                        <div className="flex flex-col justify-end pb-1">
                            <button
                                onClick={() => setIsRecurring(!isRecurring)}
                                className={`w-full p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${isRecurring ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                            >
                                <RefreshCw size={14} className={isRecurring ? 'animate-spin-slow' : ''} />
                                <span className="text-xs font-black uppercase tracking-tighter">Fixo Mensal?</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION FOOTER */}
            <footer className="px-6 py-6 pb-12 bg-white/90 backdrop-blur-xl border-t border-slate-50 sticky bottom-0 z-40 shrink-0 shadow-[0_-20px_40px_rgba(0,0,0,0.04)]">
                <div className="max-w-xl mx-auto flex gap-3">
                    <button
                        onClick={() => handleSave(false)}
                        disabled={isSaving || !amount}
                        className={`flex-1 py-5 rounded-2xl font-black text-[10px] uppercase tracking-tighter active:scale-95 transition-all text-center leading-tight px-2 ${type === 'DESPESA'
                                ? 'bg-red-50 text-red-600 border border-red-100'
                                : 'bg-blue-50 text-blue-600 border border-blue-100'
                            }`}
                    >
                        Lançamento Parcial
                    </button>

                    <button
                        onClick={() => handleSave(true)}
                        disabled={isSaving || !isReadyToComplete}
                        className={`flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-2xl active:scale-95 ${isReadyToComplete
                                ? (type === 'DESPESA'
                                    ? 'bg-red-600 text-white shadow-red-500/40 ring-4 ring-red-600/10'
                                    : 'bg-blue-600 text-white shadow-blue-500/40 ring-4 ring-blue-600/10')
                                : 'bg-slate-200 text-slate-400 shadow-none'
                            }`}
                    >
                        {isSaving ? 'Processando...' : 'Lançar'}
                        <Check size={18} strokeWidth={4} />
                    </button>
                </div>
            </footer>

            {/* SELECTION DRAWER */}
            {selectorOpen && (
                <div className="fixed inset-0 z-[110] flex items-end justify-center px-4 pb-4 animate-in fade-in duration-300">
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setSelectorOpen(null)}
                    />

                    <div className="relative w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-500">
                        {/* Drawer Indicator */}
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto my-4" />

                        <div className="p-8 pt-2 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-black text-xl uppercase tracking-tight text-slate-900">
                                    {selectorOpen === 'CARD' ? 'Escolha o Cartão' : 'Escolha a Conta'}
                                </h3>
                                <button onClick={() => setSelectorOpen(null)} className="p-2 bg-slate-50 rounded-full text-slate-400">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pb-6">
                                {/* Generic Option */}
                                <button
                                    onClick={() => {
                                        setSelectedPayment({ method: selectorOpen === 'CARD' ? 'CREDITO' : 'DEBITO', label: selectorOpen === 'CARD' ? 'Crt. Geral' : 'Cta. Geral' });
                                        setSelectorOpen(null);
                                    }}
                                    className="w-full p-6 rounded-3xl bg-slate-50 hover:bg-orange-50 border-2 border-transparent transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-orange-200 group-hover:text-orange-600 transition-colors">
                                            {selectorOpen === 'CARD' ? <CreditCard size={24} /> : <Landmark size={24} />}
                                        </div>
                                        <div className="flex flex-col items-start">
                                            <span className="font-black text-sm text-slate-900 uppercase">Uso Geral</span>
                                            <span className="text-[10px] font-bold text-slate-400">Sem vínculo específico</span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-300 group-hover:text-orange-500 transition-colors">
                                        <ChevronRight size={20} />
                                    </div>
                                </button>

                                {/* Specific Options */}
                                {selectorOpen === 'CARD' ? cards.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setSelectedPayment({ method: 'CREDITO', cardId: item.id, label: item.name });
                                            setSelectorOpen(null);
                                        }}
                                        className="w-full p-6 rounded-3xl bg-slate-50 hover:bg-orange-50 border-2 border-transparent transition-all flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-orange-200 group-hover:text-orange-600 transition-colors">
                                                <CreditCard size={24} />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="font-black text-sm text-slate-900 uppercase">{item.name}</span>
                                                <span className="text-[10px] font-bold text-slate-400">Final {item.last_digits || '****'}</span>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-300 group-hover:text-orange-500 transition-colors">
                                            <ChevronRight size={20} />
                                        </div>
                                    </button>
                                )) : accounts.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setSelectedPayment({ method: 'DEBITO', accountId: item.id, label: item.name });
                                            setSelectorOpen(null);
                                        }}
                                        className="w-full p-6 rounded-3xl bg-slate-50 hover:bg-orange-50 border-2 border-transparent transition-all flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-orange-200 group-hover:text-orange-600 transition-colors">
                                                <Landmark size={24} />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="font-black text-sm text-slate-900 uppercase">{item.name}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{item.bank_name || 'Instituição Financeira'}</span>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-300 group-hover:text-orange-500 transition-colors">
                                            <ChevronRight size={20} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
