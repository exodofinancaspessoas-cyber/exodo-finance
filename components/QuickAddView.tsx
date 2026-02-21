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

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
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

    const handleSave = async (isQuick: boolean = false) => {
        const numericAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numericAmount) || numericAmount <= 0) {
            alert('Insira um valor válido');
            return;
        }

        setIsSaving(true);
        try {
            const newTrx: Transaction = {
                id: StorageService.generateId(),
                description: description || (type === 'DESPESA' ? 'Nova Despesa' : 'Nova Receita'),
                amount: numericAmount,
                type: type,
                category_id: categoryId,
                date: date,
                status: isQuick ? 'INCOMPLETA' : status,
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
            alert('Erro ao salvar');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col items-stretch text-slate-900 animate-in slide-in-from-bottom duration-500 overflow-hidden h-[100dvh]">
            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-900/20">Ê</div>
                    <span className="font-black tracking-tight uppercase text-base text-slate-900">Nova Transação</span>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-all active:scale-90 text-slate-600">
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
                {/* Type Selector */}
                <div className="flex p-4 gap-3 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                    <button
                        onClick={() => setType('DESPESA')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all border-2 ${type === 'DESPESA'
                            ? 'bg-white border-red-500 text-red-600 shadow-sm font-bold'
                            : 'bg-transparent border-transparent text-slate-400'
                            }`}
                    >
                        Despesa
                    </button>
                    <button
                        onClick={() => setType('RECEITA')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all border-2 ${type === 'RECEITA'
                            ? 'bg-white border-blue-500 text-blue-600 shadow-sm font-bold'
                            : 'bg-transparent border-transparent text-slate-400'
                            }`}
                    >
                        Receita
                    </button>
                </div>

                <div className="p-6 space-y-6 pb-32">
                    {/* Descricao */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Descrição</label>
                        <input
                            type="text"
                            placeholder="Ex: Mercado, Salário"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-base outline-none focus:border-orange-500/30 transition-all font-bold placeholder:text-slate-200"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Valor */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Valor Total</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">R$</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0,00"
                                    className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 pl-12 text-base outline-none focus:border-orange-500/30 transition-all font-bold"
                                />
                            </div>
                        </div>

                        {/* Data */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Data</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 pl-12 text-base outline-none focus:border-orange-500/30 transition-all font-bold"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Categoria */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Categoria</label>
                        <div className="space-y-2">
                            {/* Busca de Categoria */}
                            <div className="relative group">
                                <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar categoria..."
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-12 text-sm outline-none focus:border-orange-500/30 focus:bg-white transition-all font-bold placeholder:text-slate-300"
                                />
                                {categorySearch && (
                                    <button
                                        onClick={() => setCategorySearch('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Seletor de Categoria */}
                            <div className="relative">
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                <select
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                    className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 pl-6 appearance-none outline-none focus:border-orange-500/30 transition-all font-bold text-slate-600"
                                >
                                    <option value="">{categorySearch ? `RESULTADOS PARA: ${categorySearch.toUpperCase()}` : 'SELECIONAR CATEGORIA'}</option>
                                    {categories
                                        .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                        .map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))
                                    }
                                    {categories.filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                                        <option disabled>Nenhum resultado encontrado</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Metodo de Pagamento */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Método de Pagamento</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setSelectedPayment({ method: 'DINHEIRO' })}
                                className={`p-3 rounded-xl flex items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'DINHEIRO' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                            >
                                <Banknote size={16} />
                                <span className="text-xs font-bold">Dinheiro</span>
                            </button>
                            <button
                                onClick={() => setSelectedPayment({ method: 'PIX' })}
                                className={`p-3 rounded-xl flex items-center gap-2 border-2 transition-all ${selectedPayment?.method === 'PIX' ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                            >
                                <div className="w-4 h-4 rounded-sm bg-cyan-500 flex items-center justify-center text-[10px] font-black text-white">P</div>
                                <span className="text-xs font-bold">Pix</span>
                            </button>

                            {cards.map(card => (
                                <button
                                    key={card.id}
                                    onClick={() => setSelectedPayment({ method: 'CREDITO', cardId: card.id })}
                                    className={`p-3 rounded-xl flex items-center gap-2 border-2 transition-all ${selectedPayment?.cardId === card.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                                >
                                    <CreditCard size={16} />
                                    <span className="text-xs font-bold truncate">{card.name}</span>
                                </button>
                            ))}

                            {accounts.map(acc => (
                                <button
                                    key={acc.id}
                                    onClick={() => setSelectedPayment({ method: 'DEBITO', accountId: acc.id })}
                                    className={`p-3 rounded-xl flex items-center gap-2 border-2 transition-all ${selectedPayment?.accountId === acc.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                                >
                                    <Landmark size={16} />
                                    <span className="text-xs font-bold truncate">{acc.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recorrencia */}
                    <button
                        onClick={() => setIsRecurring(!isRecurring)}
                        className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${isRecurring ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white'}`}
                    >
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${isRecurring ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-200'}`}>
                            {isRecurring && <Check size={14} strokeWidth={4} />}
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold text-slate-700">Repetir esta {type === 'DESPESA' ? 'despesa' : 'receita'}?</p>
                            <p className="text-[10px] text-slate-400 font-medium">Mantenha seus gastos fixos e variáveis organizados</p>
                        </div>
                    </button>

                    {/* Status */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status da Transação</label>
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                            {['PREVISTA', 'CONFIRMADA', 'PAGA', 'ATRASADA'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setStatus(s as TransactionStatus)}
                                    className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${status === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-3 sticky bottom-0 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
                <div className="flex gap-3">
                    <button
                        disabled={isSaving || !amount}
                        onClick={() => handleSave(true)}
                        className="flex-1 bg-slate-100 text-slate-600 font-black text-xs py-5 rounded-2xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                    >
                        SALVAR RÁPIDO <AlertCircle size={16} className="text-yellow-500" />
                    </button>
                    <button
                        disabled={isSaving || !amount || !selectedPayment || !categoryId}
                        onClick={() => handleSave(false)}
                        className="flex-1 bg-slate-900 text-white font-black text-xs py-5 rounded-2xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                    >
                        CRIAR TRANSAÇÃO <Check size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
