
import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowRightLeft, Plus, Landmark, Wallet, Briefcase,
    AlertCircle, CheckCircle2, ChevronRight, X, Loader2,
    Banknote, CalendarDays, FileText, TrendingDown, TrendingUp,
    Edit2, Trash2
} from 'lucide-react';
import { Transfer, Account } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../utils';

// ─── Account Icon ──────────────────────────────────────────────────────────────
const AccountIcon = ({ type, className }: { type: string; className?: string }) => {
    switch (type) {
        case 'POUPANCA': return <Wallet className={className} />;
        case 'SALARIO': return <Briefcase className={className} />;
        case 'DINHEIRO': return <Banknote className={className} />;
        default: return <Landmark className={className} />;
    }
};

// ─── Account Selector ──────────────────────────────────────────────────────────
const AccountSelector = ({
    label, accounts, value, onChange, excludeId
}: {
    label: string;
    accounts: Account[];
    value: string;
    onChange: (id: string) => void;
    excludeId?: string;
}) => {
    const available = accounts.filter(a => a.id !== excludeId);
    const selected = accounts.find(a => a.id === value);

    return (
        <div className="flex-1">
            <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest mb-2">{label}</label>
            <div className="relative">
                <select
                    className="w-full appearance-none bg-black/5 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-3 pr-10 text-sm font-bold text-[var(--ios-text)] outline-none focus:ring-2 focus:ring-[#007aff]/30 transition-all cursor-pointer"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    required
                    style={{ borderColor: 'var(--ios-glass-border)' }}
                >
                    <option value="">Selecionar conta...</option>
                    {available.map(a => (
                        <option key={a.id} value={a.id} className="text-black">{a.name}</option>
                    ))}
                </select>
                <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ios-text-secondary)] rotate-90 pointer-events-none" />
            </div>

            {/* Selected account preview */}
            {selected && (
                <div className="mt-2 p-3 bg-[var(--ios-card-bg)]/80 backdrop-blur-md rounded-xl border flex items-center gap-3 animate-fade-in" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center shrink-0">
                        <AccountIcon type={selected.type} className="w-4 h-4 text-[var(--ios-text-secondary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-[var(--ios-text)] truncate uppercase tracking-widest leading-none mb-1">{selected.name}</p>
                        <p className="text-[9px] font-bold text-[var(--ios-text-secondary)] uppercase tracking-widest leading-none">{selected.bank || selected.type}</p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-sm font-black text-[var(--ios-text)] leading-none mb-1">{formatCurrency(selected.current_balance)}</p>
                        <p className="text-[8px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest leading-none">saldo</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TransfersView() {
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);

    const [form, setForm] = useState({
        from: '',
        to: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [trfs, accs] = await Promise.all([
                StorageService.getTransfers(),
                StorageService.getAccounts()
            ]);
            setTransfers(trfs.sort((a, b) => b.date.localeCompare(a.date)));
            setAccounts(accs);
        } catch (error) {
            console.error('Erro ao carregar transferências:', error);
        } finally {
            setLoading(false);
        }
    };


    const groupedTransfers = useMemo(() => {
        const groups: Record<string, Transfer[]> = {};
        transfers.forEach(t => {
            const monthKey = t.date.substring(0, 7); // YYYY-MM
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(t);
        });
        return groups;
    }, [transfers]);

    // ── Balance preview computation ────────────────────────────────────────
    const fromAccount = accounts.find(a => a.id === form.from);
    const toAccount = accounts.find(a => a.id === form.to);
    const transferAmount = parseFloat(form.amount) || 0;
    // Warning only — does NOT block the transfer (accounts can have negative balances)
    const isInsufficient = !!(fromAccount && transferAmount > 0 && transferAmount > fromAccount.current_balance);
    const isReady = !!(form.from && form.to && form.from !== form.to && transferAmount > 0 && form.date);

    const formatMonthLabel = (key: string) => {
        const [y, m] = key.split('-').map(Number);
        return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isReady || isSaving) return;

        setIsSaving(true);
        try {
            const transferData: Transfer = {
                id: editingTransfer ? editingTransfer.id : StorageService.generateId(),
                from_account_id: form.from,
                to_account_id: form.to,
                amount: transferAmount,
                date: form.date,
                description: form.description.trim() || undefined,
                created_at: editingTransfer ? editingTransfer.created_at : new Date().toISOString()
            };

            console.log('[Transfer] Salvando:', transferData);
            await StorageService.saveTransfer(transferData);
            console.log('[Transfer] Salvo com sucesso!');

            setForm({ from: '', to: '', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
            setEditingTransfer(null);
            setIsModalOpen(false);
            await loadData();
        } catch (error: any) {
            console.error('Erro ao salvar transferência:', error);
            alert(`Erro ao salvar transferência: ${error?.message || 'Tente novamente.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir esta transferência?')) return;

        try {
            await StorageService.deleteTransfer(id);
            await loadData();
        } catch (error) {
            console.error('Erro ao excluir transferência:', error);
            alert('Erro ao excluir transferência.');
        }
    };

    const openModal = (transfer?: Transfer) => {
        if (transfer) {
            setEditingTransfer(transfer);
            setForm({
                from: transfer.from_account_id,
                to: transfer.to_account_id,
                amount: transfer.amount.toString(),
                date: transfer.date,
                description: transfer.description || ''
            });
        } else {
            setEditingTransfer(null);
            setForm({ from: '', to: '', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
        }
        setIsModalOpen(true);
    };

    const { hapticFeedback } = require('./ui/Skeleton');

    return (
        <div className="animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex justify-between items-end mb-10 px-1">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-[#5856d6] uppercase tracking-widest leading-none">Movimentações</span>
                    <h1 className="text-4xl font-black text-[var(--ios-text)] tracking-tight leading-none uppercase">Transferências</h1>
                </div>
                <button
                    id="btn-nova-transferencia"
                    onClick={() => { hapticFeedback(10); openModal(); }}
                    className="bg-[#5856d6] hover:bg-[#5856d6]/90 text-white w-14 h-14 ios-squircle flex items-center justify-center shadow-lg shadow-[#5856d6]/20 transition-all active:scale-95 border border-white/10"
                    aria-label="Nova Transferência"
                >
                    <Plus size={24} strokeWidth={3} />
                </button>
            </div>

            {/* Summary Cards */}
            {!loading && accounts.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    {accounts.slice(0, 4).map(acc => (
                        <div key={acc.id} className="ios-glass ios-squircle-sm border p-5 shadow-sm hover:shadow-md transition-all group" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-8 h-8 ios-squircle bg-black/5 dark:bg-white/5 flex items-center justify-center border border-[var(--ios-glass-border)] shadow-inner">
                                    <AccountIcon type={acc.type} className="w-4 h-4 text-[var(--ios-text-secondary)]" />
                                </div>
                                <p className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest truncate">{acc.name}</p>
                            </div>
                            <p className={`text-xl font-black tracking-tight ${acc.current_balance >= 0 ? 'text-[var(--ios-text)]' : 'text-[#ff3b30]'}`}>
                                {formatCurrency(acc.current_balance)}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Transfer History */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 text-[var(--ios-text-secondary)]">
                    <Loader2 size={40} className="animate-spin mb-4 opacity-40 text-[#5856d6]" />
                    <p className="text-xs font-black uppercase tracking-widest opacity-40">Carregando Movimentações...</p>
                </div>
            ) : transfers.length === 0 ? (
                <div className="ios-glass ios-squircle-md border-2 border-dashed py-24 text-center flex flex-col items-center justify-center px-6" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="w-20 h-20 bg-black/5 ios-squircle flex items-center justify-center mb-6 border shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <ArrowRightLeft size={36} className="text-[var(--ios-text-secondary)] opacity-50" />
                    </div>
                    <h2 className="text-xl font-black text-[var(--ios-text)] tracking-tight mb-2 uppercase">Nenhuma movimentação</h2>
                    <p className="text-[var(--ios-text-secondary)] text-sm font-black uppercase tracking-widest max-w-xs px-4 opacity-70 mb-10">Realize transferências entre suas contas para manter o saldo atualizado.</p>
                    <button
                        onClick={() => { hapticFeedback(5); openModal(); }}
                        className="bg-[#5856d6] text-white px-10 py-4 ios-squircle text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                        Criar primeira transferência
                    </button>
                </div>
            ) : (
                <div className="space-y-10 pb-10">
                    {(Object.entries(groupedTransfers) as [string, Transfer[]][]).map(([month, monthTransfers]) => (
                        <div key={month}>
                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest flex items-center gap-2">
                                    <CalendarDays size={14} className="text-[#5856d6]" />
                                    {formatMonthLabel(month)}
                                </h3>
                                <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
                                <span className="bg-[#5856d6]/10 text-[#5856d6] px-3 py-1 ios-squircle text-[10px] font-black uppercase tracking-widest border border-[#5856d6]/20">
                                    {monthTransfers.length} {monthTransfers.length === 1 ? 'item' : 'itens'}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {monthTransfers.map(t => {
                                    const from = accounts.find(a => a.id === t.from_account_id);
                                    const to = accounts.find(a => a.id === t.to_account_id);
                                    return (
                                        <div key={t.id} className="ios-glass ios-squircle-sm border p-5 shadow-sm hover:shadow-xl hover:translate-y-[-2px] transition-all group" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                            <div className="flex items-center gap-5">
                                                {/* Icon */}
                                                <div className="w-12 h-12 ios-squircle bg-black/5 dark:bg-white/5 border flex items-center justify-center shrink-0 shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                                    <ArrowRightLeft size={20} className="text-[#5856d6]" strokeWidth={2.5} />
                                                </div>

                                                {/* Accounts flow */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 flex-wrap mb-1.5">
                                                        <span className="text-sm font-black text-[#ff3b30] uppercase tracking-tight">
                                                            {from?.name ?? 'Removida'}
                                                        </span>
                                                        <div className="w-6 h-6 ios-squircle bg-black/5 dark:bg-white/5 flex items-center justify-center border border-[var(--ios-glass-border)]">
                                                            <ChevronRight size={12} className="text-[var(--ios-text-secondary)]" />
                                                        </div>
                                                        <span className="text-sm font-black text-[#34c759] uppercase tracking-tight">
                                                            {to?.name ?? 'Removida'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <p className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest flex items-center gap-1.5 opacity-60">
                                                            <CalendarDays size={12} className="text-[var(--ios-text-secondary)]" />
                                                            {formatDate(t.date)}
                                                        </p>
                                                        {t.description && (
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-1 h-1 rounded-full bg-[var(--ios-text-secondary)] opacity-30" />
                                                                <p className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest flex items-center gap-1.5 opacity-80 truncate max-w-[150px]">
                                                                    <FileText size={12} className="text-[var(--ios-text-secondary)]" />
                                                                    {t.description}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Amount */}
                                                <div className="shrink-0 text-right flex items-center gap-6">
                                                    <div>
                                                        <p className="text-xl font-black text-[var(--ios-text)] tracking-tighter leading-none mb-1">{formatCurrency(t.amount)}</p>
                                                        <div className="flex items-center gap-1.5 justify-end mt-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#ff3b30] shadow-[0_0_8px_rgba(255,59,48,0.5)]" />
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.5)]" />
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); hapticFeedback(5); openModal(t); }}
                                                            className="w-10 h-10 ios-squircle bg-black/5 dark:bg-white/5 flex items-center justify-center text-[var(--ios-text-secondary)] hover:text-[#5856d6] transition-all border border-transparent hover:border-[#5856d6]/30 shadow-sm"
                                                            title="Editar"
                                                        >
                                                            <Edit2 size={16} strokeWidth={2.5} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); hapticFeedback(20); handleDelete(t.id); }}
                                                            className="w-10 h-10 ios-squircle bg-[#ff3b30]/10 flex items-center justify-center text-[#ff3b30] hover:brightness-110 transition-all border border-transparent hover:border-[#ff3b30]/30 shadow-sm"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={16} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Modal ──────────────────────────────────────────────────────── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="ios-glass ios-squircle-md shadow-2xl w-full max-w-md overflow-hidden border animate-slide-up" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        {/* Modal Header */}
                        <div className="px-7 py-6 border-b flex justify-between items-center bg-black/5" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#5856d6] text-white ios-squircle flex items-center justify-center shadow-lg shadow-[#5856d6]/20 border border-white/10">
                                    <ArrowRightLeft size={22} strokeWidth={3} />
                                </div>
                                <div>
                                    <h3 className="font-black text-[var(--ios-text)] text-xl tracking-tight leading-none mb-1">
                                        {editingTransfer ? 'Editar Transferência' : 'Nova Transferência'}
                                    </h3>
                                    <p className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest leading-none opacity-60">Mover saldo entre contas</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { hapticFeedback(5); setIsModalOpen(false); }}
                                className="w-10 h-10 flex items-center justify-center bg-black/5 text-[var(--ios-text-secondary)] hover:text-[#ff3b30] ios-squircle transition-all text-2xl leading-none shadow-inner"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-7 space-y-7">
                            {/* Account selectors */}
                            <div className="flex gap-4">
                                <AccountSelector
                                    label="Origem (De)"
                                    accounts={accounts}
                                    value={form.from}
                                    onChange={id => setForm(f => ({ ...f, from: id, to: f.to === id ? '' : f.to }))}
                                    excludeId={form.to}
                                />
                                <div className="flex flex-col items-center justify-center pt-8 shrink-0">
                                    <div className="w-10 h-10 ios-squircle bg-black/5 dark:bg-white/5 border flex items-center justify-center shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                        <ArrowRightLeft size={16} className="text-[#5856d6]" strokeWidth={2.5} />
                                    </div>
                                </div>
                                <AccountSelector
                                    label="Destino (Para)"
                                    accounts={accounts}
                                    value={form.to}
                                    onChange={id => setForm(f => ({ ...f, to: id, from: f.from === id ? '' : f.from }))}
                                    excludeId={form.from}
                                />
                            </div>

                            {/* Amount */}
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Valor da Transferência</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--ios-text-secondary)]">R$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        className={`w-full bg-black/5 border ios-squircle-sm pl-12 pr-6 py-6 text-3xl font-black text-[var(--ios-text)] outline-none focus:ring-4 transition-all shadow-inner ${isInsufficient
                                            ? 'border-[#ff3b30] focus:ring-[#ff3b30]/10 bg-[#ff3b30]/5'
                                            : 'border-[var(--ios-glass-border)] focus:ring-[#5856d6]/20'
                                            }`}
                                        placeholder="0,00"
                                        value={form.amount}
                                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                        onFocus={e => e.target.select()}
                                        required
                                    />
                                </div>

                                {/* Insufficient balance warning */}
                                {isInsufficient && (
                                    <div className="flex items-center gap-2 p-3 bg-[#ff3b30]/10 ios-squircle-sm border border-[#ff3b30]/20 animate-in slide-in-from-top-2">
                                        <AlertCircle size={16} className="text-[#ff3b30]" />
                                        <p className="text-[10px] font-black text-[#ff3b30] uppercase tracking-widest leading-none mt-0.5">
                                            Atenção: Saldo insuficiente ({formatCurrency(fromAccount?.current_balance ?? 0)})
                                        </p>
                                    </div>
                                )}

                                {/* Preview */}
                                {isReady && fromAccount && toAccount && (
                                    <div className="bg-black/5 dark:bg-white/5 border ios-squircle-sm p-5 space-y-4 animate-in fade-in zoom-in-95 shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                            <p className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">Saldo após transferência</p>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-[#ff3b30] shadow-[0_0_8px_rgba(255,59,48,0.5)]" />
                                                    <span className="text-[10px] font-black text-[var(--ios-text)] uppercase tracking-widest">{fromAccount.name}</span>
                                                </div>
                                                <span className="text-xs font-black text-[#ff3b30] tracking-tight">
                                                    {formatCurrency(fromAccount.current_balance - transferAmount)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.5)]" />
                                                    <span className="text-[10px] font-black text-[var(--ios-text)] uppercase tracking-widest">{toAccount.name}</span>
                                                </div>
                                                <span className="text-xs font-black text-[#34c759] tracking-tight">
                                                    {formatCurrency(toAccount.current_balance + transferAmount)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Date + Description */}
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Data</label>
                                    <input
                                        type="date"
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 text-sm font-bold text-[var(--ios-text)] outline-none focus:ring-2 focus:ring-[#5856d6]/30 transition-all shadow-inner"
                                        value={form.date}
                                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Descrição</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-4 text-sm font-bold text-[var(--ios-text)] placeholder:text-[var(--ios-text-secondary)]/30 outline-none focus:ring-2 focus:ring-[#5856d6]/30 transition-all shadow-inner"
                                        placeholder="Opcional"
                                        value={form.description}
                                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col md:flex-row gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { hapticFeedback(5); setIsModalOpen(false); }}
                                    className="flex-1 py-5 ios-squircle font-black text-[10px] uppercase tracking-widest text-[var(--ios-text-secondary)] hover:bg-black/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!isReady || isSaving}
                                    className="flex-[2] py-5 bg-[#5856d6] hover:bg-[#5856d6]/90 text-white disabled:opacity-40 ios-squircle font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[#5856d6]/30 active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/10"
                                >
                                    {isSaving ? (
                                        <><Loader2 size={18} className="animate-spin" /> Processando...</>
                                    ) : (
                                        <><CheckCircle2 size={18} strokeWidth={3} /> {editingTransfer ? 'Salvar Alterações' : 'Confirmar Transferência'}</>
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
