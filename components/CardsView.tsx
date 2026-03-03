import React, { useState, useEffect } from 'react';
import { CreditCard, PlusCircle, Edit, Trash2, FileText, Check, AlertCircle, MoreHorizontal, Landmark, ShieldCheck, CreditCard as CardIcon, Loader2 } from 'lucide-react';
import { Card, Category, Transaction, Account } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';
import { Skeleton, hapticFeedback } from './ui/Skeleton';

export default function CardsView() {
    const [cards, setCards] = useState<Card[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Invoice Setup Modal
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [selectedCardForInvoice, setSelectedCardForInvoice] = useState<Card | null>(null);
    const [invoiceSetupData, setInvoiceSetupData] = useState<{ month: string, year: number, monthIndex: number, amount: string }[]>([]);
    const [isSavingInvoices, setIsSavingInvoices] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form
    const [formData, setFormData] = useState({
        name: '',
        limit: 0,
        closing_day: 1,
        due_day: 10,
        bank: '',
        brand: 'VISA',
        account_id: ''
    });

    const [accounts, setAccounts] = useState<Account[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [crds, cats, accs, trxs] = await Promise.all([
            StorageService.getCards(),
            StorageService.getCategories(),
            StorageService.getAccounts(),
            StorageService.getTransactions()
        ]);
        setCards(crds);
        setCategories(cats);
        setAccounts(accs);
        setTransactions(trxs);
    };

    const handleOpenModal = (card?: Card) => {
        if (card) {
            setEditingCard(card);
            setFormData({
                name: card.name,
                limit: card.limit,
                closing_day: card.closing_day,
                due_day: card.due_day,
                bank: card.bank || '',
                brand: card.brand || 'VISA',
                account_id: card.account_id || ''
            });
        } else {
            setEditingCard(null);
            setFormData({
                name: '',
                limit: 0,
                closing_day: 1,
                due_day: 10,
                bank: '',
                brand: 'VISA',
                account_id: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este cartão?')) {
            hapticFeedback(20);
            await StorageService.deleteCard(id);
            loadData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;

        setIsSaving(true);
        hapticFeedback(10);
        try {
            const newCard: Card = {
                id: editingCard ? editingCard.id : StorageService.generateId(),
                name: formData.name,
                limit: Number(formData.limit),
                limit_used: editingCard ? editingCard.limit_used : 0,
                closing_day: Number(formData.closing_day),
                due_day: Number(formData.due_day),
                bank: formData.bank,
                brand: formData.brand as any,
                account_id: formData.account_id || undefined,
            };
            await StorageService.saveCard(newCard);
            setIsModalOpen(false);
            loadData();
        } catch (error) {
            console.error("Erro ao salvar cartão:", error);
            alert("Erro ao salvar cartão. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Invoice Setup Logic ---
    const handleOpenInvoiceSetup = (card: Card) => {
        hapticFeedback(5);
        setSelectedCardForInvoice(card);

        const today = new Date();
        const slots = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const monthName = d.toLocaleDateString('pt-BR', { month: 'long' });
            const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            slots.push({
                month: monthLabel,
                year: d.getFullYear(),
                monthIndex: d.getMonth(),
                amount: ''
            });
        }
        setInvoiceSetupData(slots);
        setIsInvoiceModalOpen(true);
    };

    const handleSaveInvoices = async () => {
        if (!selectedCardForInvoice || isSavingInvoices) return;

        let importCount = 0;
        const newTransactions: Transaction[] = [];
        const cardCategory = categories.find(c => c.name === 'Fatura de Cartão');

        invoiceSetupData.forEach(slot => {
            const amountVal = Number(slot.amount);
            if (amountVal > 0) {
                const dueDate = new Date(slot.year, slot.monthIndex, selectedCardForInvoice.due_day);

                const newTrx: Transaction = {
                    id: StorageService.generateId(),
                    description: `Fatura de Cartão de Crédito - ${slot.month}/${slot.year}`,
                    amount: amountVal,
                    type: 'DESPESA',
                    category_id: cardCategory?.id,
                    date: dueDate.toISOString().split('T')[0],
                    status: 'PREVISTA',
                    payment_method: 'CREDITO',
                    card_id: selectedCardForInvoice.id,
                    account_id: selectedCardForInvoice.account_id,
                    created_at: new Date().toISOString(),
                    observation: 'Importado via Configuração Inicial de Cartão'
                };

                newTransactions.push(newTrx);
                importCount++;
            }
        });

        if (importCount > 0) {
            setIsSavingInvoices(true);
            hapticFeedback(15);
            try {
                await StorageService.saveTransactions(newTransactions);
                alert(`${importCount} faturas importadas com sucesso!`);
                setIsInvoiceModalOpen(false);
                await loadData();
            } catch (error: any) {
                console.error('Erro ao importar faturas:', error);
                alert(`Erro ao salvar faturas: ${error.message || 'Verifique sua conexão.'}`);
            } finally {
                setIsSavingInvoices(false);
            }
        } else {
            alert('Nenhum valor preenchido para importar.');
        }
    };

    const handleSlotChange = (index: number, val: string) => {
        const newData = [...invoiceSetupData];
        newData[index].amount = val;
        setInvoiceSetupData(newData);
    };

    return (
        <div className="animate-in fade-in duration-700 space-y-8 pb-20">
            {/* LARGE TITLE HEADER */}
            <div className="flex justify-between items-end px-1">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-[#007aff] uppercase tracking-widest leading-none">Meus Recursos</span>
                    <h1 className="text-4xl font-black text-[var(--ios-text)] tracking-tight leading-none">Cartões</h1>
                </div>
                <button
                    id="trigger-new-card"
                    onClick={() => { hapticFeedback(10); handleOpenModal(); }}
                    className="bg-[var(--ios-text)] text-[var(--ios-bg)] w-14 h-14 ios-squircle flex items-center justify-center shadow-lg transition-all active:scale-95"
                    aria-label="Novo Cartão"
                >
                    <PlusCircle size={24} strokeWidth={3} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cards.map(card => {
                    const available = card.limit - card.limit_used;
                    const percentUsed = (card.limit_used / card.limit) * 100;

                    return (
                        <div key={card.id} className="ios-glass ios-squircle shadow-sm border hover:shadow-xl hover:translate-y-[-4px] transition-all relative group overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`w-14 h-14 ios-squircle flex items-center justify-center text-white shadow-lg ${card.brand === 'MASTERCARD' ? 'bg-gradient-to-br from-[#eb001b] to-[#ff5f00]' :
                                        card.brand === 'VISA' ? 'bg-gradient-to-br from-[#061c6b] to-[#0052cc]' :
                                            card.brand === 'ELO' ? 'bg-gradient-to-br from-[#000000] to-[#555555]' :
                                                card.brand === 'AMEX' ? 'bg-gradient-to-br from-[#007ed5] to-[#c2d7ed]' : 'bg-slate-900'
                                        }`}>
                                        <CardIcon size={28} strokeWidth={2} />
                                    </div>
                                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenInvoiceSetup(card)}
                                            className="w-10 h-10 ios-squircle bg-black/5 flex items-center justify-center text-[var(--ios-text-secondary)] hover:text-[#007aff] transition-all border border-transparent hover:border-[var(--ios-glass-border)]"
                                            title="Configurar Início"
                                        >
                                            <FileText size={18} strokeWidth={2.5} />
                                        </button>
                                        <button
                                            onClick={() => { hapticFeedback(5); handleOpenModal(card); }}
                                            className="w-10 h-10 ios-squircle bg-black/5 flex items-center justify-center text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)] transition-all border border-transparent hover:border-[var(--ios-glass-border)]"
                                        >
                                            <Edit size={18} strokeWidth={2.5} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(card.id)}
                                            className="w-10 h-10 ios-squircle bg-[#ff3b30]/10 flex items-center justify-center text-[#ff3b30] hover:brightness-110 transition-all border border-transparent hover:border-[var(--ios-glass-border)]"
                                        >
                                            <Trash2 size={18} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h4 className="font-black text-xl text-[var(--ios-text)] tracking-tight leading-tight mb-1">{card.name}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">{card.brand}</span>
                                        <span className="w-1 h-1 rounded-full bg-black/10 dark:bg-white/10"></span>
                                        <span className="text-[10px] font-black text-[#007aff] uppercase tracking-widest">{card.bank}</span>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between text-[10px] mb-2 font-black uppercase tracking-widest">
                                            <span className="text-[var(--ios-text-secondary)]">Uso do Limite</span>
                                            <span className={`${percentUsed > 90 ? 'text-[#ff3b30]' : 'text-[var(--ios-text)]'}`}>{Math.round(percentUsed)}%</span>
                                        </div>
                                        <div className="w-full h-2.5 bg-black/10 ios-squircle overflow-hidden shadow-inner">
                                            <div
                                                className={`h-full ios-squircle transition-all duration-1000 ease-out ${percentUsed > 90 ? 'bg-[#ff3b30]' : percentUsed > 70 ? 'bg-[#ff9500]' : 'bg-[#34c759]'
                                                    }`}
                                                style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-black/5 ios-squircle-sm border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                            <p className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest mb-1.5 leading-none">Fatura Atual</p>
                                            <p className="font-black text-lg text-[var(--ios-text)] tracking-tight leading-none">{formatCurrency(card.limit_used)}</p>
                                        </div>
                                        <div className="p-4 bg-black/5 ios-squircle-sm border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                            <p className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest mb-1.5 leading-none">Disponível</p>
                                            <p className="font-black text-lg text-[#34c759] tracking-tight leading-none">{formatCurrency(available)}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-[10px] pt-2 font-black uppercase tracking-widest text-[var(--ios-text-secondary)]">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-[#ff3b30]"></div>
                                            <span>Fecha dia {card.closing_day}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-[#ff9500]"></div>
                                            <span>Vence dia {card.due_day}</span>
                                        </div>
                                    </div>

                                    {/* PROXIMAS FATURAS */}
                                    <div className="pt-6 border-t" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                        <p className="text-[9px] font-black text-[var(--ios-text)] uppercase tracking-widest mb-4 flex items-center justify-between">
                                            <span>Lançamentos Futuros</span>
                                            <ShieldCheck size={14} className="text-[#34c759]" />
                                        </p>
                                        <div className="space-y-2.5">
                                            {transactions
                                                .filter(t => t.card_id === card.id && t.status !== 'EXCLUIDA' && t.status !== 'PAGA')
                                                .sort((a, b) => a.date.localeCompare(b.date))
                                                .slice(0, 3)
                                                .map(t => (
                                                    <div key={t.id} className="flex justify-between items-center bg-black/5 p-3 ios-squircle-sm border transition-colors hover:bg-black/10" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">{t.date.split('-').reverse().slice(0, 2).join('/')}</span>
                                                            <span className="text-[11px] font-bold text-[var(--ios-text)] truncate max-w-[120px]">{t.description.split('-').pop()?.trim()}</span>
                                                        </div>
                                                        <span className="font-black text-xs text-[var(--ios-text)]">{formatCurrency(t.amount)}</span>
                                                    </div>
                                                ))}
                                            {transactions.filter(t => t.card_id === card.id && t.status !== 'EXCLUIDA' && t.status !== 'PAGA').length === 0 && (
                                                <div className="py-4 text-center bg-black/5 ios-squircle-sm border border-dashed" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                                    <p className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">Tudo em dia</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {cards.length === 0 && (
                    <div className="col-span-full py-24 ios-glass ios-squircle-md border-2 border-dashed flex flex-col items-center justify-center overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className="w-20 h-20 ios-squircle bg-black/5 flex items-center justify-center text-[var(--ios-text-secondary)] mb-6 border shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <CreditCard size={40} />
                        </div>
                        <h2 className="text-xl font-black text-[var(--ios-text)] tracking-tight mb-2">Sem Cartões Ativos</h2>
                        <p className="text-[var(--ios-text-secondary)] text-sm font-black uppercase tracking-widest max-w-xs text-center mb-8 px-4 opacity-70">Cadastre seus cartões para gerenciar limites, faturas e parcelamentos.</p>
                        <button
                            onClick={() => { hapticFeedback(5); handleOpenModal(); }}
                            className="bg-[var(--ios-text)] text-[var(--ios-bg)] px-10 py-4 ios-squircle text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                        >
                            Começar Agora
                        </button>
                    </div>
                )}
            </div>

            {/* MODAL - EDIT / NEW */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in backdrop-blur-md">
                    <div className="ios-glass rounded-3xl ios-squircle-md shadow-2xl w-full max-w-md overflow-hidden border animate-slide-up" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className="p-7 border-b flex justify-between items-center bg-black/5" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <h3 className="font-black text-xl text-[var(--ios-text)] tracking-tight">{editingCard ? 'Editar Dados' : 'Novo Cartão'}</h3>
                            <button onClick={() => { hapticFeedback(5); setIsModalOpen(false); }} className="w-10 h-10 ios-squircle bg-black/5 text-[var(--ios-text-secondary)] hover:text-[#ff3b30] transition-all flex items-center justify-center text-2xl leading-none">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-7 space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Nome do Cartão (Apelido)</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 outline-none transition-all font-bold text-[var(--ios-text)] placeholder:text-slate-500 shadow-inner focus:ring-2 focus:ring-[#007aff]/50"
                                    placeholder="Ex: Nubank Black, Itaú Visa..."
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Limite Total do Cartão</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--ios-text-secondary)]">R$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm pl-11 pr-4 py-5 outline-none transition-all font-black text-2xl text-[var(--ios-text)] shadow-inner focus:ring-2 focus:ring-[#007aff]/50"
                                        value={formData.limit || ''}
                                        onChange={e => setFormData({ ...formData, limit: Number(e.target.value) })}
                                        onFocus={e => e.target.select()}
                                        placeholder="0,00"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Dia Fechamento</label>
                                    <input
                                        type="number"
                                        min="1" max="31"
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 outline-none transition-all font-black text-center text-[var(--ios-text)] shadow-inner focus:ring-2 focus:ring-[#007aff]/50"
                                        value={formData.closing_day}
                                        onChange={e => setFormData({ ...formData, closing_day: Number(e.target.value) })}
                                        onFocus={e => e.target.select()} required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Dia Vencimento</label>
                                    <input
                                        type="number"
                                        min="1" max="31"
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 outline-none transition-all font-black text-center text-[var(--ios-text)] shadow-inner focus:ring-2 focus:ring-[#007aff]/50"
                                        value={formData.due_day}
                                        onChange={e => setFormData({ ...formData, due_day: Number(e.target.value) })}
                                        onFocus={e => e.target.select()} required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Bandeira</label>
                                    <select
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 outline-none transition-all font-bold text-[var(--ios-text)] appearance-none shadow-inner cursor-pointer"
                                        value={formData.brand}
                                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                    >
                                        <option value="VISA">Visa</option>
                                        <option value="MASTERCARD">Mastercard</option>
                                        <option value="ELO">Elo</option>
                                        <option value="AMEX">Amex</option>
                                        <option value="HIPERCARD">Hipercard</option>
                                        <option value="OUTRO">Outro</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Banco Emissor</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 outline-none transition-all font-bold text-[var(--ios-text)] placeholder:text-slate-500 shadow-inner focus:ring-2 focus:ring-[#007aff]/50"
                                        placeholder="Ex: Itaú"
                                        value={formData.bank}
                                        onChange={e => setFormData({ ...formData, bank: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Vincular a Conta Bancária</label>
                                <select
                                    className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 outline-none transition-all font-bold text-[var(--ios-text)] appearance-none shadow-inner cursor-pointer"
                                    value={formData.account_id}
                                    onChange={e => {
                                        const accId = e.target.value;
                                        const acc = accounts.find(a => a.id === accId);
                                        setFormData({
                                            ...formData,
                                            account_id: accId,
                                            bank: acc ? acc.bank || acc.name : formData.bank
                                        });
                                    }}
                                >
                                    <option value="">Nenhuma (Cartão Avulso)</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name} {acc.bank ? `(${acc.bank})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col md:flex-row gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { hapticFeedback(5); setIsModalOpen(false); }}
                                    className="flex-1 py-4 text-[var(--ios-text-secondary)] font-black text-xs uppercase tracking-widest hover:bg-black/5 ios-squircle transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-[2] py-4 bg-[var(--ios-text)] text-[var(--ios-bg)] ios-squircle text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Salvando...</span>
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

            {/* MODAL - INVOICE STARTUP */}
            {isInvoiceModalOpen && selectedCardForInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in backdrop-blur-md">
                    <div className="ios-glass rounded-3xl ios-squircle-md shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border animate-slide-up" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className="p-7 border-b bg-black/5" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-black text-2xl text-[var(--ios-text)] tracking-tight leading-none mb-2 flex items-center gap-3">
                                        <div className="w-10 h-10 ios-squircle bg-[#007aff]/10 flex items-center justify-center text-[#007aff] shadow-inner border border-[#007aff]/20">
                                            <FileText size={20} strokeWidth={2.5} />
                                        </div>
                                        Lançamento Inicial
                                    </h3>
                                    <div className="flex items-center gap-2 pl-1">
                                        <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">Cartão:</span>
                                        <span className="text-sm font-black text-[#007aff] tracking-tight">{selectedCardForInvoice.name}</span>
                                    </div>
                                </div>
                                <button onClick={() => { hapticFeedback(5); setIsInvoiceModalOpen(false); }} className="w-10 h-10 ios-squircle bg-black/5 text-[var(--ios-text-secondary)] hover:text-[#ff3b30] transition-all flex items-center justify-center text-2xl leading-none">&times;</button>
                            </div>

                            <div className="mt-6 bg-[#007aff]/10 text-[#007aff] text-[11px] p-4 ios-squircle-sm border border-[#007aff]/20 flex gap-4">
                                <AlertCircle size={20} className="shrink-0" strokeWidth={2.5} />
                                <p className="font-black uppercase tracking-widest leading-relaxed opacity-90 text-[9px]">
                                    Utilize esta tela para registrar saldos de faturas futuras (compras já parceladas).
                                    Isso sincroniza seu limite atual e prevê seus gastos dos próximos meses.
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-7 ios-scrollbar">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-5 bg-black/5 ios-squircle-sm border shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 ios-squircle bg-[#007aff] text-white flex items-center justify-center shadow-lg shadow-[#007aff]/20">
                                            <Landmark size={24} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">Saldo Total das Próximas Faturas</p>
                                            <p className="text-2xl font-black text-[var(--ios-text)] tracking-tight leading-none">
                                                {formatCurrency(invoiceSetupData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0))}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {invoiceSetupData.map((slot, index) => {
                                        const dueDate = new Date(slot.year, slot.monthIndex, selectedCardForInvoice.due_day);
                                        const isActive = Number(slot.amount) > 0;

                                        return (
                                            <div key={`${slot.year}-${slot.monthIndex}`} className={`p-4 ios-squircle-sm border transition-all flex items-center justify-between ${isActive ? 'bg-[#007aff]/10 border-[#007aff]/30 shadow-sm' : 'bg-black/5 border-transparent hover:border-[var(--ios-glass-border)]'}`}>
                                                <div className="flex items-center gap-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest leading-none mb-1">{slot.year}</span>
                                                        <span className={`text-sm font-black tracking-tight ${isActive ? 'text-[#007aff]' : 'text-[var(--ios-text)]'}`}>{slot.month}</span>
                                                    </div>
                                                    <div className="h-6 w-px bg-black/10 dark:bg-white/10"></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest leading-none mb-1">Pagamento</span>
                                                        <span className="text-[10px] font-bold text-[var(--ios-text-secondary)]">{dueDate.toLocaleDateString()}</span>
                                                    </div>
                                                </div>

                                                <div className="w-40 relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--ios-text-secondary)]">R$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0,00"
                                                        className={`w-full py-3 pl-8 pr-4 ios-squircle-sm outline-none font-black text-right text-sm transition-all shadow-inner ${isActive ? 'bg-[#007aff]/10 border border-[#007aff]/20 text-[#007aff]' : 'bg-black/5 border border-[var(--ios-glass-border)] text-[var(--ios-text)] focus:ring-2 focus:ring-[#007aff]/50'}`}
                                                        value={slot.amount || ''}
                                                        onFocus={e => e.target.select()}
                                                        onChange={e => handleSlotChange(index, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-7 border-t bg-black/5 flex flex-col md:flex-row gap-3" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <button
                                onClick={() => { hapticFeedback(5); setIsInvoiceModalOpen(false); }}
                                className="flex-1 py-4 text-[var(--ios-text-secondary)] font-black text-xs uppercase tracking-widest hover:bg-black/5 ios-squircle transition-colors"
                                disabled={isSavingInvoices}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveInvoices}
                                disabled={isSavingInvoices}
                                className="flex-[2] py-4 bg-[#007aff] hover:brightness-110 text-white ios-squircle text-xs font-black uppercase tracking-widest shadow-lg shadow-[#007aff]/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSavingInvoices ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Processando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} strokeWidth={3} />
                                        <span>Salvar Histórico</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
