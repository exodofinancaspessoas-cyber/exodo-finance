import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, CreditCard, Banknote, Landmark, Check, AlertCircle, ChevronRight, Wallet } from 'lucide-react';
import { StorageService } from '../services/storage';
import { Transaction, TransactionType, PaymentMethod, Account, Card, Category } from '../types';
import { formatCurrency } from '../utils';

interface QuickAddViewProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function QuickAddView({ onClose, onSuccess }: QuickAddViewProps) {
    const [type, setType] = useState<TransactionType>('DESPESA');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedPayment, setSelectedPayment] = useState<{
        method: PaymentMethod,
        accountId?: string,
        cardId?: string
    } | null>(null);

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const loadData = async () => {
        const [accs, crds] = await Promise.all([
            StorageService.getAccounts(),
            StorageService.getCards()
        ]);
        setAccounts(accs);
        setCards(crds);
    };

    const handleSave = async (isComplete: boolean = false) => {
        const numericAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numericAmount) || numericAmount <= 0) {
            alert('Insira um valor válido');
            return;
        }

        setIsSaving(true);
        try {
            const newTrx: Transaction = {
                id: StorageService.generateId(),
                description: description || (type === 'DESPESA' ? 'Gasto Rápido' : 'Receita Rápida'),
                amount: numericAmount,
                type: type,
                category_id: '', // Empty for incomplete
                date: new Date().toISOString().split('T')[0],
                status: isComplete ? (type === 'RECEITA' ? 'RECEBIDA' : 'PAGA') : 'INCOMPLETA',
                payment_method: selectedPayment?.method,
                account_id: selectedPayment?.accountId,
                card_id: selectedPayment?.cardId,
                created_at: new Date().toISOString()
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
        <div className="fixed inset-0 z-[70] bg-white flex flex-col items-stretch text-slate-900 animate-in slide-in-from-bottom duration-500 overflow-hidden">
            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-900/20">Ê</div>
                    <span className="font-black tracking-tight uppercase text-base text-slate-900">Lançamento Rápido</span>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-all active:scale-90 text-slate-600">
                    <X size={24} />
                </button>
            </div>

            {/* Type Selector - Smaller Buttons as requested */}
            <div className="flex p-4 gap-3 mt-2">
                <button
                    onClick={() => setType('DESPESA')}
                    className={`flex-1 py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all border-2 ${type === 'DESPESA' ? 'bg-red-500 border-red-500 shadow-lg shadow-red-200 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${type === 'DESPESA' ? 'bg-white/20' : 'bg-slate-200'}`}>
                        <Minus size={16} strokeWidth={3} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Despesa</span>
                </button>
                <button
                    onClick={() => setType('RECEITA')}
                    className={`flex-1 py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all border-2 ${type === 'RECEITA' ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-200 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${type === 'RECEITA' ? 'bg-white/20' : 'bg-slate-200'}`}>
                        <Plus size={16} strokeWidth={3} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Receita</span>
                </button>
            </div>

            {/* Value Display */}
            <div className={`p-8 flex flex-col items-center justify-center transition-all ${type === 'DESPESA' ? 'text-red-500' : 'text-emerald-500'}`}>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Valor do Lançamento</div>
                <div className="flex items-center gap-3 relative">
                    <span className="text-2xl font-black opacity-40 mt-1">R$</span>
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0,00"
                            className="bg-transparent border-none outline-none text-6xl font-black text-center w-full max-w-[300px] placeholder:text-slate-100 selection:bg-orange-500/20"
                        />
                        <div className={`absolute -right-1 top-0 bottom-0 w-[2px] animate-pulse ${type === 'DESPESA' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    </div>
                </div>
            </div>

            {/* Quick Assets (Cards/Accounts) */}
            <div className="flex-1 overflow-y-auto px-6 space-y-6">
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 italic">Forma de Pagamento</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Dinheiro */}
                        <button
                            onClick={() => setSelectedPayment({ method: 'DINHEIRO' })}
                            className={`p-4 rounded-2xl flex items-center gap-3 transition-all ${selectedPayment?.method === 'DINHEIRO' ? 'bg-orange-50 border-orange-200 border shadow-sm' : 'bg-slate-50 border-slate-100 border'}`}
                        >
                            <div className={`p-2 rounded-lg ${selectedPayment?.method === 'DINHEIRO' ? 'bg-white shadow-sm' : 'bg-white'}`}>
                                <Banknote size={18} className="text-orange-500" />
                            </div>
                            <span className={`text-[12px] font-black uppercase tracking-tight ${selectedPayment?.method === 'DINHEIRO' ? 'text-orange-900' : 'text-slate-600'}`}>Dinheiro</span>
                        </button>

                        {/* Pix */}
                        <button
                            onClick={() => setSelectedPayment({ method: 'PIX' })}
                            className={`p-4 rounded-2xl flex items-center gap-3 transition-all ${selectedPayment?.method === 'PIX' ? 'bg-cyan-50 border-cyan-200 border shadow-sm' : 'bg-slate-50 border-slate-100 border'}`}
                        >
                            <div className={`p-2 rounded-lg ${selectedPayment?.method === 'PIX' ? 'bg-white shadow-sm' : 'bg-white'}`}>
                                <div className="w-4 h-4 rounded-sm bg-cyan-500 flex items-center justify-center text-[10px] font-black text-white">P</div>
                            </div>
                            <span className={`text-[12px] font-black uppercase tracking-tight ${selectedPayment?.method === 'PIX' ? 'text-cyan-900' : 'text-slate-600'}`}>Pix</span>
                        </button>
                    </div>
                </div>

                {cards.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 italic">Seu Cartão</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {cards.map(card => (
                                <button
                                    key={card.id}
                                    onClick={() => setSelectedPayment({ method: 'CREDITO', cardId: card.id })}
                                    className={`p-4 rounded-2xl flex items-center gap-3 transition-all text-left ${selectedPayment?.cardId === card.id ? 'bg-blue-50 border-blue-200 border shadow-sm' : 'bg-slate-50 border-slate-100 border'}`}
                                >
                                    <CreditCard size={18} style={{ color: card.color || '#3b82f6' }} />
                                    <span className={`text-[12px] font-black uppercase tracking-tight truncate ${selectedPayment?.cardId === card.id ? 'text-blue-900' : 'text-slate-600'}`}>{card.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {accounts.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 italic">Débito em Conta</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {accounts.map(acc => (
                                <button
                                    key={acc.id}
                                    onClick={() => setSelectedPayment({ method: 'DEBITO', accountId: acc.id })}
                                    className={`p-4 rounded-2xl flex items-center gap-3 transition-all text-left ${selectedPayment?.accountId === acc.id ? 'bg-indigo-50 border-indigo-200 border shadow-sm' : 'bg-slate-50 border-slate-100 border'}`}
                                >
                                    <Landmark size={18} className="text-indigo-500" />
                                    <span className={`text-[12px] font-black uppercase tracking-tight truncate ${selectedPayment?.accountId === acc.id ? 'text-indigo-900' : 'text-slate-600'}`}>{acc.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="py-2">
                    <input
                        type="text"
                        placeholder="O que você comprou? (opcional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm outline-none placeholder:text-slate-300 focus:ring-1 focus:ring-slate-200 font-medium"
                    />
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-white border-t border-slate-50 flex flex-col gap-3">
                <div className="flex gap-3">
                    <button
                        disabled={isSaving || !amount}
                        onClick={() => handleSave(false)}
                        className="flex-1 bg-slate-900 text-white font-black text-xs py-5 rounded-2xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                    >
                        SALVAR RÁPIDO <AlertCircle size={16} className="text-yellow-400" />
                    </button>
                    <button
                        disabled={isSaving || !amount || !selectedPayment}
                        onClick={() => handleSave(true)}
                        className={`flex-1 font-black text-xs py-5 rounded-2xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2 border-2 shadow-xl ${type === 'DESPESA' ? 'bg-white text-red-500 border-red-100 shadow-red-50' : 'bg-white text-emerald-500 border-emerald-100 shadow-emerald-50'}`}
                    >
                        OK, PAGO <Check size={18} />
                    </button>
                </div>

                <p className="text-[10px] text-center text-slate-300 uppercase font-bold tracking-[0.1em] mt-2">
                    Transações incompletas serão sinalizadas no dashboard
                </p>
            </div>
        </div>
    );
}
