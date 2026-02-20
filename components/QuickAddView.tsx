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

    const appendNumber = (num: string) => {
        setAmount(prev => prev + num);
    };

    const clearAmount = () => setAmount('');

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900 flex flex-col items-stretch text-white animate-in fade-in slide-in-from-bottom duration-300 overflow-hidden">
            {/* Header */}
            <div className="p-4 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black text-xs">Ê</div>
                    <span className="font-black tracking-tighter uppercase text-sm">Lançamento Rápido</span>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Type Selector */}
            <div className="flex p-4 gap-2">
                <button
                    onClick={() => setType('DESPESA')}
                    className={`flex-1 py-4 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border-2 ${type === 'DESPESA' ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/20' : 'bg-slate-800 border-transparent text-slate-400'}`}
                >
                    <Minus size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Despesa</span>
                </button>
                <button
                    onClick={() => setType('RECEITA')}
                    className={`flex-1 py-4 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border-2 ${type === 'RECEITA' ? 'bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-slate-800 border-transparent text-slate-400'}`}
                >
                    <Plus size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Receita</span>
                </button>
            </div>

            {/* Value Display */}
            <div className={`p-8 flex flex-col items-center justify-center transition-colors ${type === 'DESPESA' ? 'text-red-400' : 'text-emerald-400'}`}>
                <div className="text-sm font-black uppercase tracking-widest opacity-50 mb-2">Valor Total</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black opacity-50">R$</span>
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0,00"
                        className="bg-transparent border-none outline-none text-6xl font-black text-center w-full max-w-[280px] placeholder:text-slate-700"
                    />
                </div>
            </div>

            {/* Quick Assets (Cards/Accounts) */}
            <div className="flex-1 overflow-y-auto px-4 space-y-4">
                <div className="space-y-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Forma de Pagamento</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {/* Dinheiro */}
                        <button
                            onClick={() => setSelectedPayment({ method: 'DINHEIRO' })}
                            className={`p-3 rounded-xl flex items-center gap-3 transition-colors ${selectedPayment?.method === 'DINHEIRO' ? 'bg-orange-600/20 border-orange-500/50 border shadow-inner' : 'bg-slate-800 border-transparent border'}`}
                        >
                            <Banknote size={16} className="text-orange-500" />
                            <span className="text-[11px] font-bold">Dinheiro</span>
                        </button>

                        {/* Pix */}
                        <button
                            onClick={() => setSelectedPayment({ method: 'PIX' })}
                            className={`p-3 rounded-xl flex items-center gap-3 transition-colors ${selectedPayment?.method === 'PIX' ? 'bg-cyan-600/20 border-cyan-500/50 border shadow-inner' : 'bg-slate-800 border-transparent border'}`}
                        >
                            <div className="w-4 h-4 rounded-sm bg-cyan-500 flex items-center justify-center text-[10px] font-black">P</div>
                            <span className="text-[11px] font-bold">Pix</span>
                        </button>
                    </div>
                </div>

                {cards.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Seu Cartão</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {cards.map(card => (
                                <button
                                    key={card.id}
                                    onClick={() => setSelectedPayment({ method: 'CREDITO', cardId: card.id })}
                                    className={`p-3 rounded-xl flex items-center gap-3 transition-colors text-left ${selectedPayment?.cardId === card.id ? 'bg-blue-600/20 border-blue-500/50 border shadow-inner' : 'bg-slate-800 border-transparent border'}`}
                                >
                                    <CreditCard size={16} style={{ color: card.color || '#60a5fa' }} />
                                    <span className="text-[11px] font-bold truncate">{card.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {accounts.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">Débito em Conta</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {accounts.map(acc => (
                                <button
                                    key={acc.id}
                                    onClick={() => setSelectedPayment({ method: 'DEBITO', accountId: acc.id })}
                                    className={`p-3 rounded-xl flex items-center gap-3 transition-colors text-left ${selectedPayment?.accountId === acc.id ? 'bg-indigo-600/20 border-indigo-500/50 border shadow-inner' : 'bg-slate-800 border-transparent border'}`}
                                >
                                    <Landmark size={16} className="text-indigo-400" />
                                    <span className="text-[11px] font-bold truncate">{acc.name}</span>
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
                        className="w-full bg-slate-800 border-none rounded-xl p-4 text-sm outline-none placeholder:text-slate-600 focus:ring-1 focus:ring-slate-600"
                    />
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-800/80 backdrop-blur-md border-t border-slate-700 flex flex-col gap-3">
                <div className="flex gap-2">
                    <button
                        disabled={isSaving || !amount}
                        onClick={() => handleSave(false)}
                        className="flex-1 bg-slate-700 text-white font-black text-xs py-4 rounded-2xl hover:bg-slate-600 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                        SALVAR RÁPIDO <AlertCircle size={14} className="text-yellow-500" />
                    </button>
                    <button
                        disabled={isSaving || !amount || !selectedPayment}
                        onClick={() => handleSave(true)}
                        className="flex-1 bg-white text-slate-900 font-black text-xs py-4 rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                        OK, PAGO <Check size={16} />
                    </button>
                </div>

                <p className="text-[9px] text-center text-slate-500 uppercase font-bold tracking-widest">
                    Transações incompletas serão sinalizadas no dashboard
                </p>
            </div>
        </div>
    );
}
