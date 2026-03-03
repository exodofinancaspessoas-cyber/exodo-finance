
import React, { useState, useEffect } from 'react';
import {
    Landmark, Wallet, Briefcase, PlusCircle, MoreHorizontal, Edit, Trash2, Loader2, CreditCard
} from 'lucide-react';
import { Landmark as BankIcon, Wallet as WalletIcon, Briefcase as BriefcaseIcon, PlusCircle as PlusIcon, Edit as EditIcon, Trash2 as TrashIcon, CreditCard as CardIcon } from 'lucide-react';
import { Skeleton, hapticFeedback } from './ui/Skeleton';
import { Account, AccountType, Card } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';

export default function AccountsView() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form for quick card addition inside account modal
    const [showCardForm, setShowCardForm] = useState(false);
    const [cardFormData, setCardFormData] = useState({
        name: '',
        limit: 0,
        closing_day: 1,
        due_day: 10
    });

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'CORRENTE' as AccountType,
        bank: '',
        initial_balance: 0,
        color: 'blue-500'
    });

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const [accs, crds] = await Promise.all([
                StorageService.getAccounts(),
                StorageService.getCards()
            ]);
            setAccounts(accs);
            setCards(crds);
        } catch (error) {
            console.error("Erro ao carregar contas:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (acc?: Account) => {
        if (acc) {
            setEditingAccount(acc);
            setFormData({
                name: acc.name,
                type: acc.type,
                bank: acc.bank || '',
                initial_balance: acc.initial_balance,
                color: acc.color || 'blue-500'
            });
        } else {
            setEditingAccount(null);
            setFormData({
                name: '',
                type: 'CORRENTE',
                bank: '',
                initial_balance: 0,
                color: 'blue-500'
            });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta conta?')) {
            await StorageService.deleteAccount(id);
            await loadAccounts();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;

        setIsSaving(true);
        try {
            const accountId = editingAccount ? editingAccount.id : StorageService.generateId();
            const newAccount: Account = {
                id: accountId,
                name: formData.name,
                type: formData.type,
                bank: formData.bank,
                initial_balance: Number(formData.initial_balance),
                current_balance: 0, // Recalculated by service
                color: formData.color
            };
            await StorageService.saveAccount(newAccount);

            // Save pending cards if any
            const pending = (window as any)._pendingCards || [];
            if (pending.length > 0) {
                for (const card of pending) {
                    await StorageService.saveCard({
                        ...card,
                        account_id: accountId
                    });
                }
                (window as any)._pendingCards = [];
            }

            setIsModalOpen(false);
            loadAccounts();
        } catch (error) {
            console.error("Erro ao salvar conta:", error);
            alert("Erro ao salvar conta. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    const getIcon = (type: AccountType) => {
        switch (type) {
            case 'POUPANCA': return <WalletIcon className="text-green-500" />;
            case 'SALARIO': return <BriefcaseIcon className="text-orange-500" />;
            default: return <BankIcon className="text-blue-500" />;
        }
    };

    if (loading && accounts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--ios-text-secondary)]">
                <Loader2 size={40} className="animate-spin mb-4" />
                <p>Carregando instituições...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-700 space-y-8">
            <div className="flex justify-between items-end px-1">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-[#ff9500] uppercase tracking-widest leading-none">Minhas Contas</span>
                    <h1 className="text-4xl font-black tracking-tight leading-none text-[var(--ios-text)] uppercase">Instituições</h1>
                </div>
                <button
                    id="trigger-new-account"
                    onClick={() => { hapticFeedback(10); handleOpenModal(); }}
                    className="bg-[#ff9500] hover:bg-[#ff9500]/90 text-white w-14 h-14 ios-squircle flex items-center justify-center shadow-lg shadow-[#ff9500]/20 transition-all active:scale-95 border border-white/10"
                    aria-label="Nova Conta"
                >
                    <PlusIcon size={24} strokeWidth={3} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map(acc => (
                    <div
                        key={acc.id}
                        className="ios-glass ios-squircle p-7 border shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all relative group"
                        style={{ borderColor: 'var(--ios-glass-border)' }}
                    >
                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                            <button onClick={() => { hapticFeedback(5); handleOpenModal(acc); }} className="w-9 h-9 bg-black/5 dark:bg-white/5 ios-squircle flex items-center justify-center text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)] hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-transparent hover:border-[var(--ios-glass-border)]"><EditIcon size={16} /></button>
                            <button onClick={() => { hapticFeedback(20); handleDelete(acc.id); }} className="w-9 h-9 bg-[#ff3b30]/10 ios-squircle flex items-center justify-center text-[#ff3b30] hover:brightness-110 transition-all border border-transparent hover:border-[#ff3b30]/30"><TrashIcon size={16} /></button>
                        </div>

                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-14 h-14 ios-squircle bg-black/5 dark:bg-white/5 flex items-center justify-center border shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                {React.cloneElement(getIcon(acc.type) as React.ReactElement, { size: 28, strokeWidth: 2.5 })}
                            </div>
                            <div className="flex flex-col">
                                <h3 className="font-black text-lg leading-none mb-1 text-[var(--ios-text)]">{acc.name}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)]">{acc.bank || acc.type}</span>
                                    {acc.type === 'SALARIO' && (
                                        <span className="bg-[#ff9500]/10 text-[#ff9500] text-[8px] font-black px-1.5 py-0.5 ios-squircle uppercase border border-[#ff9500]/20">Preferencial</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="relative pt-2">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-[var(--ios-text-secondary)] opacity-60">Saldo Consolidado</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm font-black text-[var(--ios-text-secondary)] opacity-30">R$</span>
                                <h4 className={`text-4xl font-black tracking-tighter ${acc.current_balance >= 0 ? 'text-[var(--ios-text)]' : 'text-[#ff3b30]'}`}>
                                    {formatCurrency(acc.current_balance || 0).replace('R$', '').trim()}
                                </h4>
                            </div>

                            {/* Visual balance bar decoration */}
                            <div className="mt-6 w-full h-1.5 bg-black/5 dark:bg-white/5 ios-squircle overflow-hidden shadow-inner">
                                <div
                                    className={`h-full transition-all duration-1000 ${acc.current_balance >= 0 ? 'bg-[#34c759]' : 'bg-[#ff3b30]'}`}
                                    style={{ width: '85%', opacity: 0.3 }}
                                />
                            </div>
                        </div>
                    </div>
                ))}

                {accounts.length === 0 && !loading && (
                    <div className="col-span-full py-24 ios-glass ios-squircle-md border-2 border-dashed flex flex-col items-center justify-center overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className="w-20 h-20 ios-squircle bg-black/5 flex items-center justify-center text-[var(--ios-text-secondary)] mb-6 border shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <WalletIcon size={40} />
                        </div>
                        <h2 className="text-xl font-black text-[var(--ios-text)] tracking-tight mb-2 uppercase">Nenhuma Instituição</h2>
                        <p className="text-[var(--ios-text-secondary)] text-sm font-black uppercase tracking-widest max-w-xs text-center mb-8 px-4 opacity-70">Cadastre suas contas bancárias, carteiras ou investimentos para começar o controle.</p>
                        <button
                            onClick={() => { hapticFeedback(5); handleOpenModal(); }}
                            className="bg-[#ff9500] text-white px-10 py-4 ios-squircle text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                        >
                            Nova Conta
                        </button>
                    </div>
                )}
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in backdrop-blur-md">
                    <div className="ios-glass ios-squircle-md shadow-2xl w-full max-w-md overflow-hidden border animate-slide-up" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className="p-7 border-b flex justify-between items-center bg-black/5" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <h3 className="font-black text-xl tracking-tight text-[var(--ios-text)]">{editingAccount ? 'Editar Conta' : 'Nova Conta'}</h3>
                            <button onClick={() => { hapticFeedback(5); setIsModalOpen(false); }} className="w-10 h-10 ios-squircle bg-black/5 text-[var(--ios-text-secondary)] hover:text-[#ff9500] transition-all flex items-center justify-center text-2xl leading-none">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-7 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)] pl-1">Nome da Instituição</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 outline-none transition-all font-bold text-[var(--ios-text)] placeholder:text-slate-500 shadow-inner focus:ring-2 focus:ring-[#ff9500]/50"
                                    placeholder="Ex: Nubank, Itaú..."
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)] pl-1">Tipo de Conta</label>
                                    <select
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 outline-none transition-all font-bold text-[var(--ios-text)] appearance-none shadow-inner cursor-pointer"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as AccountType })}
                                    >
                                        <option value="CORRENTE">Corrente</option>
                                        <option value="POUPANCA">Poupança</option>
                                        <option value="SALARIO">Salário</option>
                                        <option value="DINHEIRO">Dinheiro</option>
                                        <option value="OUTRO">Outro</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)] pl-1">Identificador</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 outline-none transition-all font-bold text-[var(--ios-text)] placeholder:text-slate-500 shadow-inner focus:ring-2 focus:ring-[#ff9500]/50"
                                        value={formData.bank}
                                        onChange={e => setFormData({ ...formData, bank: e.target.value })}
                                        placeholder="Apelido/Banco"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)] pl-1">Saldo Atual</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--ios-text-secondary)]">R$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm pl-11 pr-4 py-5 outline-none transition-all font-black text-2xl text-[var(--ios-text)] shadow-inner focus:ring-2 focus:ring-[#ff9500]/50"
                                        value={formData.initial_balance || ''}
                                        onChange={e => setFormData({ ...formData, initial_balance: Number(e.target.value) })}
                                        onFocus={e => e.target.select()}
                                        placeholder="0,00"
                                        required
                                    />
                                </div>
                            </div>

                            {/* CARDS SECTION */}
                            <div className="pt-6 border-t" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <div className="flex justify-between items-center mb-5">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-[var(--ios-text)]">
                                        <CardIcon size={16} className="text-[#ff9500]" strokeWidth={2.5} />
                                        Cartões Vinculados
                                    </h4>
                                    {!showCardForm && (
                                        <button
                                            type="button"
                                            onClick={() => { hapticFeedback(5); setShowCardForm(true); }}
                                            className="text-[#ff9500] hover:bg-[#ff9500]/10 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 ios-squircle transition-colors border border-transparent hover:border-[#ff9500]/20"
                                        >
                                            <PlusIcon size={14} strokeWidth={3} className="inline mr-1" /> Vincular
                                        </button>
                                    )}
                                </div>

                                {showCardForm && (
                                    <div className="bg-black/5 p-5 ios-squircle-sm border mb-6 space-y-5 animate-in slide-in-from-top-4 duration-300 shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest leading-none">Configurar novo cartão</span>
                                            <button type="button" onClick={() => setShowCardForm(false)} className="text-[var(--ios-text-secondary)] hover:text-[#ff3b30] transition-colors text-lg">&times;</button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2 space-y-1.5">
                                                <label className="block text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Nome do Cartão</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: Platinum, Black..."
                                                    className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 text-sm font-bold outline-none text-[var(--ios-text)] focus:ring-2 focus:ring-[#ff9500]/50 transition-all shadow-inner"
                                                    value={cardFormData.name}
                                                    onChange={e => setCardFormData({ ...cardFormData, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Limite Total</label>
                                                <input
                                                    type="number"
                                                    placeholder="0,00"
                                                    className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 text-sm font-bold outline-none text-[var(--ios-text)] shadow-inner"
                                                    value={cardFormData.limit}
                                                    onChange={e => setCardFormData({ ...cardFormData, limit: Number(e.target.value) })}
                                                    onFocus={e => e.target.select()}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1.5">
                                                    <label className="block text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest text-center">Fecha</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-black/10 border border-[var(--ios-glass-border)] ios-squircle-sm px-2 py-4 text-sm font-bold text-center text-[var(--ios-text)] shadow-inner"
                                                        value={cardFormData.closing_day}
                                                        onChange={e => setCardFormData({ ...cardFormData, closing_day: Number(e.target.value) })}
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="block text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest text-center">Vence</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-black/10 border border-[var(--ios-glass-border)] ios-squircle-sm px-2 py-4 text-sm font-bold text-center text-[var(--ios-text)] shadow-inner"
                                                        value={cardFormData.due_day}
                                                        onChange={e => setCardFormData({ ...cardFormData, due_day: Number(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={!cardFormData.name || !cardFormData.limit}
                                            onClick={async () => {
                                                hapticFeedback(10);
                                                const newCard: Card = {
                                                    id: StorageService.generateId(),
                                                    name: cardFormData.name,
                                                    limit: cardFormData.limit,
                                                    limit_used: 0,
                                                    closing_day: cardFormData.closing_day,
                                                    due_day: cardFormData.due_day,
                                                    bank: formData.bank || formData.name,
                                                    account_id: editingAccount?.id // Link if exists, otherwise link on handleSubmit
                                                };
                                                // If we are editing an account, save immediately
                                                if (editingAccount) {
                                                    await StorageService.saveCard(newCard);
                                                    await loadAccounts();
                                                } else {
                                                    (window as any)._pendingCards = (window as any)._pendingCards || [];
                                                    (window as any)._pendingCards.push(newCard);
                                                }
                                                setCardFormData({ name: '', limit: 0, closing_day: 1, due_day: 10 });
                                                setShowCardForm(false);
                                            }}
                                            className="w-full bg-[var(--ios-text)] text-[var(--ios-bg)] py-4 ios-squircle-sm text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-30 transition-all active:scale-95 shadow-xl"
                                        >
                                            Adicionar Cartão
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-3 max-h-48 overflow-y-auto pr-1 ios-scrollbar">
                                    {cards.filter(c => c.account_id === editingAccount?.id).map(card => (
                                        <div key={card.id} className="flex justify-between items-center p-4 bg-black/5 ios-squircle-sm border border-[var(--ios-glass-border)] transition-all hover:bg-black/10 shadow-inner">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 ios-squircle bg-[#ff9500]/10 flex items-center justify-center text-[#ff9500] shadow-inner border border-[#ff9500]/20">
                                                    <CardIcon size={20} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black tracking-tight text-[var(--ios-text)]">{card.name}</p>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)]">{formatCurrency(card.limit)}</p>
                                                </div>
                                            </div>
                                            <div className="text-[10px] font-black text-right uppercase tracking-widest text-[var(--ios-text-secondary)] opacity-60">
                                                F: {card.closing_day} | V: {card.due_day}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Show pending cards for new account */}
                                    {(!editingAccount && (window as any)._pendingCards) && (window as any)._pendingCards.map((card: Card) => (
                                        <div key={card.id} className="flex justify-between items-center p-4 bg-[#ff9500]/5 ios-squircle-sm border border-[#ff9500]/20 animate-in fade-in zoom-in-95 shadow-inner">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 ios-squircle bg-[#ff9500]/20 flex items-center justify-center text-[#ff9500] shadow-inner">
                                                    <CardIcon size={20} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black tracking-tight text-[var(--ios-text)]">{card.name}</p>
                                                    <p className="text-[10px] font-black text-[#ff9500] uppercase tracking-widest">Aguardando Salvar</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    hapticFeedback(20);
                                                    (window as any)._pendingCards = (window as any)._pendingCards.filter((c: Card) => c.id !== card.id);
                                                    loadAccounts(); // force re-render
                                                }}
                                                className="w-10 h-10 ios-squircle bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30] hover:text-white transition-all flex items-center justify-center border border-transparent hover:border-[#ff3b30]/30"
                                            >
                                                <TrashIcon size={16} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    ))}

                                    {cards.filter(c => c.account_id === editingAccount?.id).length === 0 && (!editingAccount || !(window as any)._pendingCards?.length) && !showCardForm && (
                                        <div className="py-8 text-center bg-black/5 ios-squircle-sm border border-dashed shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 text-[var(--ios-text-secondary)]">Nenhum cartão vinculado</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        hapticFeedback(5);
                                        (window as any)._pendingCards = [];
                                        setIsModalOpen(false);
                                    }}
                                    className="flex-1 py-4 font-black text-xs uppercase tracking-widest text-[var(--ios-text-secondary)] hover:bg-black/5 ios-squircle transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-[2] py-4 bg-[#ff9500] hover:bg-[#ff9500]/90 text-white ios-squircle text-xs font-black uppercase tracking-widest shadow-lg shadow-[#ff9500]/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border border-white/10"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Processando...</span>
                                        </>
                                    ) : (
                                        <span>Confirmar</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
