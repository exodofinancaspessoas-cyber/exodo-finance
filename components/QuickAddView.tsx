import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, CreditCard, Banknote, Landmark, Check, AlertCircle, ChevronDown, Calendar, Tag, RefreshCw } from 'lucide-react';
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
        // Focus amount input on mount
        setTimeout(() => {
            if (amountInputRef.current) {
                amountInputRef.current.focus();
            }
        }, 300);
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

        // Basic validation
        if (isNaN(numericAmount) || numericAmount <= 0) {
            alert('Por favor, insira o valor.');
            amountInputRef.current?.focus();
            return;
        }

        // Hard validation for "Completar Agora"
        if (isComplete) {
            if (!description.trim()) {
                alert('A descrição é obrigatória para completar o lançamento.');
                return;
            }
            if (!selectedPayment) {
                alert('Selecione uma forma de pagamento.');
                return;
            }
            if (!categoryId) {
                alert('Selecione uma categoria.');
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
        <div className="fixed inset-0 z-[70] bg-white flex flex-col items-stretch text-slate-900 animate-in slide-in-from-bottom duration-500 overflow-hidden h-[100dvh]">
            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-900/20">Ê</div>
                    <span className="font-black tracking-tight uppercase text-base text-slate-900">Novo Lançamento</span>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-all active:scale-90 text-slate-600">
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
                {/* Large Amount Display - Direct focus target */}
                <div
                    className={`p-10 flex flex-col items-center justify-center transition-all bg-slate-50 border-b border-slate-100 ${type === 'DESPESA' ? 'text-red-500' : 'text-blue-500'}`}
                    onClick={() => amountInputRef.current?.focus()}
                >
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Digite o Valor</div>
                    <div className="flex items-center gap-3 relative">
                        <span className="text-3xl font-black opacity-30">R$</span>
                        <div className="relative">
                            <input
                                ref={amountInputRef}
                                type="text"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0,00"
                                className="bg-transparent border-none outline-none text-7xl font-black text-center w-full max-w-[320px] placeholder:text-slate-200"
                            />
                            <div className={`absolute -right-2 top-0 bottom-0 w-1 animate-pulse ${type === 'DESPESA' ? 'bg-red-500' : 'bg-blue-500'}`} />
                        </div>
                    </div>
                </div>

                {/* Type Selector Sticky */}
                <div className="flex p-4 gap-3 bg-white sticky top-0 z-10 backdrop-blur-sm border-b border-slate-50">
                    <button
                        onClick={() => setType('DESPESA')}
                        className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 transition-all border-2 ${type === 'DESPESA'
                                ? 'bg-red-500 border-red-500 shadow-lg shadow-red-200 text-white scale-[1.02]'
                                : 'bg-red-50 border-red-100 text-red-400'
                            }`}
                    >
                        <Minus size={18} strokeWidth={3} />
                        <span className="text-xs font-black uppercase tracking-widest">Despesa</span>
                    </button>
                    <button
                        onClick={() => setType('RECEITA')}
                        className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 transition-all border-2 ${type === 'RECEITA'
                                ? 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-200 text-white scale-[1.02]'
                                : 'bg-blue-50 border-blue-100 text-blue-400'
                            }`}
                    >
                        <Plus size={18} strokeWidth={3} />
                        <span className="text-xs font-black uppercase tracking-widest">Receita</span>
                    </button>
                </div>

                <div className="p-6 space-y-8 pb-40">
                    {/* Descricao - Required for complete */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">O que é isso? (obrigatório)</label>
                            {description && <Check size={14} className="text-emerald-500" />}
                        </div>
                        <input
                            type="text"
                            placeholder="Ex: Almoço, Supermercado, Salário..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-base outline-none focus:border-slate-300 transition-all font-bold placeholder:text-slate-200 shadow-sm"
                        />
                    </div>

                    {/* Forma de Pagamento */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Como você pagou? (obrigatório)</label>
                            {selectedPayment && <Check size={14} className="text-emerald-500" />}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSelectedPayment({ method: 'DINHEIRO' })}
                                className={`p-4 rounded-2xl flex items-center gap-3 border-2 transition-all ${selectedPayment?.method === 'DINHEIRO' ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                            >
                                <Banknote size={20} />
                                <span className="text-xs font-black uppercase">Dinheiro</span>
                            </button>
                            <button
                                onClick={() => setSelectedPayment({ method: 'PIX' })}
                                className={`p-4 rounded-2xl flex items-center gap-3 border-2 transition-all ${selectedPayment?.method === 'PIX' ? 'border-cyan-500 bg-cyan-50 text-cyan-700 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                            >
                                <div className="w-5 h-5 rounded bg-cyan-500 flex items-center justify-center text-[10px] font-black text-white">P</div>
                                <span className="text-xs font-black uppercase">Pix</span>
                            </button>

                            {cards.map(card => (
                                <button
                                    key={card.id}
                                    onClick={() => setSelectedPayment({ method: 'CREDITO', cardId: card.id })}
                                    className={`p-4 rounded-2xl flex items-center gap-3 border-2 transition-all ${selectedPayment?.cardId === card.id ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                >
                                    <CreditCard size={20} />
                                    <span className="text-xs font-black uppercase truncate">{card.name}</span>
                                </button>
                            ))}

                            {accounts.map(acc => (
                                <button
                                    key={acc.id}
                                    onClick={() => setSelectedPayment({ method: 'DEBITO', accountId: acc.id })}
                                    className={`p-4 rounded-2xl flex items-center gap-3 border-2 transition-all ${selectedPayment?.accountId === acc.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                >
                                    <Landmark size={20} />
                                    <span className="text-xs font-black uppercase truncate">{acc.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Busca e Categoria */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Qual a Categoria?</label>
                            {categoryId && <Check size={14} className="text-emerald-500" />}
                        </div>
                        <div className="space-y-3">
                            <div className="relative">
                                <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input
                                    type="text"
                                    placeholder="Procurar categoria..."
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm outline-none focus:bg-white focus:border-slate-300 font-bold"
                                />
                            </div>
                            <div className="relative">
                                <select
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                    className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 pl-6 appearance-none outline-none font-bold text-slate-700 shadow-sm"
                                >
                                    <option value="">{categorySearch ? 'Categorias encontradas:' : 'SELECIONAR CATEGORIA'}</option>
                                    {categories
                                        .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                        .map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))
                                    }
                                </select>
                                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    {/* Data & Recorrencia */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Data do Lançamento</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-base outline-none font-bold"
                            />
                        </div>
                        <button
                            onClick={() => setIsRecurring(!isRecurring)}
                            className={`p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${isRecurring ? 'border-orange-500 bg-orange-50' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                        >
                            <RefreshCw size={18} className={isRecurring ? 'text-orange-500 animate-spin-slow' : ''} />
                            <span className="text-xs font-black uppercase">É um gasto fixo mensal?</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer with specific buttons as requested */}
            <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-3 sticky bottom-0 z-10 shadow-[0_-15px_40px_rgba(0,0,0,0.08)]">
                <div className="flex flex-col gap-3">
                    <button
                        disabled={isSaving || !amount}
                        onClick={() => handleSave(true)}
                        className={`w-full py-5 rounded-3xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] ${isReadyToComplete
                                ? 'bg-slate-900 text-white shadow-slate-400'
                                : 'bg-slate-100 text-slate-400 shadow-none'
                            }`}
                    >
                        Completar Agora <Check size={20} />
                    </button>

                    <button
                        disabled={isSaving || !amount}
                        onClick={() => handleSave(false)}
                        className="w-full py-5 rounded-3xl bg-white border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] active:scale-[0.98] transition-all"
                    >
                        Completar Depois (Salvar Rascunho)
                    </button>
                </div>
            </div>
        </div>
    );
}
