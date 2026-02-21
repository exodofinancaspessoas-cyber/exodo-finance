import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, CreditCard, Banknote, Landmark, Check, AlertCircle, ChevronDown, Calendar, Tag, RefreshCw, Search } from 'lucide-react';
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
        cardId?: string
    } | null>(null);

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const amountInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
        // Focus amount input on mount with a slight delay for keyboard to open smoothly
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
            {/* Sophisticated Header */}
            <header className="p-6 flex justify-between items-center bg-white sticky top-0 z-30 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl rotate-3">Ê</div>
                    <div className="flex flex-col">
                        <span className="font-black tracking-[0.2em] uppercase text-[10px] text-orange-500">Exodo Finance</span>
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

                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
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
                                    className={`bg-transparent border-none outline-none text-7xl md:text-8xl font-black text-center w-full max-w-[320px] placeholder:text-slate-100 transition-colors ${type === 'DESPESA' ? 'text-slate-900' : 'text-slate-900'}`}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Switcher & Fields */}
                <div className="p-6 space-y-10 pb-48">

                    {/* Toggle Tipo Sophisticated */}
                    <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl relative border border-slate-200">
                        <button
                            onClick={() => setType('DESPESA')}
                            className={`py-4 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest z-10 ${type === 'DESPESA' ? 'bg-white text-red-500 shadow-xl' : 'text-slate-400'
                                }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${type === 'DESPESA' ? 'bg-red-500' : 'bg-slate-300'}`} />
                            Despesa
                        </button>
                        <button
                            onClick={() => setType('RECEITA')}
                            className={`py-4 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest z-10 ${type === 'RECEITA' ? 'bg-white text-blue-500 shadow-xl' : 'text-slate-400'
                                }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${type === 'RECEITA' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                            Receita
                        </button>
                    </div>

                    {/* Descricao Section */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">O que é isso? <span className="text-orange-500">*</span></label>
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-5 text-lg outline-none focus:bg-white focus:border-orange-500/10 focus:shadow-2xl focus:shadow-orange-500/5 transition-all font-bold placeholder:text-slate-200"
                            />
                        </div>
                    </div>

                    {/* Pagamento Grid */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Forma de Pagamento <span className="text-orange-500">*</span></label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSelectedPayment({ method: 'DINHEIRO' })}
                                className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'DINHEIRO' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                            >
                                <Banknote size={24} strokeWidth={1} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Dinheiro</span>
                            </button>
                            <button
                                onClick={() => setSelectedPayment({ method: 'PIX' })}
                                className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'PIX' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                            >
                                <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center text-[10px] font-black text-white">P</div>
                                <span className="text-[9px] font-black uppercase tracking-tighter">Pix</span>
                            </button>

                            <button
                                onClick={() => setSelectedPayment({ method: 'BOLETO' })}
                                className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'BOLETO' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                            >
                                <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center text-[10px] font-black text-white italic">B</div>
                                <span className="text-[9px] font-black uppercase tracking-tighter">Boleto</span>
                            </button>

                            <button
                                onClick={() => setSelectedPayment({ method: 'TRANSFERENCIA' })}
                                className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'TRANSFERENCIA' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                            >
                                <RefreshCw size={24} strokeWidth={1} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Transferência</span>
                            </button>

                            {cards.map(card => (
                                <button
                                    key={card.id}
                                    onClick={() => setSelectedPayment({ method: 'CREDITO', cardId: card.id })}
                                    className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.cardId === card.id ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                                >
                                    <CreditCard size={24} strokeWidth={1} />
                                    <span className="text-[9px] font-black uppercase tracking-tighter truncate w-full text-center">{card.name}</span>
                                </button>
                            ))}

                            <button
                                onClick={() => setSelectedPayment({ method: 'CREDITO' })}
                                className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'CREDITO' && !selectedPayment.cardId ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                            >
                                <CreditCard size={24} strokeWidth={1} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Cartão (Geral)</span>
                            </button>

                            {accounts.map(acc => (
                                <button
                                    key={acc.id}
                                    onClick={() => setSelectedPayment({ method: 'DEBITO', accountId: acc.id })}
                                    className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.accountId === acc.id ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                                >
                                    <Landmark size={24} strokeWidth={1} />
                                    <span className="text-[9px] font-black uppercase tracking-tighter truncate w-full text-center">{acc.name}</span>
                                </button>
                            ))}

                            <button
                                onClick={() => setSelectedPayment({ method: 'DEBITO' })}
                                className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'DEBITO' && !selectedPayment.accountId ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xl scale-[1.02]' : 'border-slate-50 bg-slate-50 text-slate-400 opacity-60'}`}
                            >
                                <Landmark size={24} strokeWidth={1} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Conta (Geral)</span>
                            </button>
                        </div>
                    </div>

                    {/* Categoria Selector */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Categoria</label>
                        <div className="relative group">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-200" />
                            <input
                                type="text"
                                placeholder="Filtrar categorias..."
                                value={categorySearch}
                                onChange={(e) => setCategorySearch(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm outline-none focus:border-orange-500/20 font-bold"
                            />
                        </div>
                        <div className="relative">
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full bg-slate-900 text-white rounded-2xl p-5 pl-6 appearance-none outline-none font-bold text-sm shadow-2xl"
                            >
                                <option value="">ESCOLHA UMA CATEGORIA</option>
                                {categories
                                    .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                    .map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))
                                }
                            </select>
                            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                        </div>
                    </div>

                    {/* Extra Settings */}
                    <div className="grid grid-cols-2 gap-3 pt-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Quando?</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-black outline-none"
                            />
                        </div>
                        <div className="flex flex-col justify-end">
                            <button
                                onClick={() => setIsRecurring(!isRecurring)}
                                className={`w-full p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${isRecurring ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`}
                            >
                                <RefreshCw size={14} className={isRecurring ? 'animate-spin-slow' : ''} />
                                <span className="text-[9px] font-black uppercase">Recorrente?</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION FOOTER: Smaller, Orange, Sophisticated */}
            <footer className="px-6 py-6 pb-8 bg-white/80 backdrop-blur-xl border-t border-slate-50 sticky bottom-0 z-40 shrink-0">
                <div className="max-w-xl mx-auto flex gap-3">
                    <button
                        onClick={() => handleSave(false)}
                        disabled={isSaving || !amount}
                        className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] active:scale-95 transition-all text-center border border-slate-200/50 shadow-sm"
                    >
                        Salvar Rascunho
                    </button>

                    <button
                        onClick={() => handleSave(true)}
                        disabled={isSaving || !amount}
                        className={`flex-[1.8] py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2 shadow-2xl active:scale-95 ${isReadyToComplete
                            ? 'bg-orange-500 text-white shadow-orange-500/40 ring-4 ring-orange-500/10'
                            : 'bg-slate-200 text-slate-400 shadow-none'
                            }`}
                    >
                        {isSaving ? 'Salvando...' : 'Finalizar'}
                        <Check size={16} strokeWidth={4} />
                    </button>
                </div>
            </footer >
        </div>
    );
}
