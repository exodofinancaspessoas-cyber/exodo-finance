
import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowRightLeft, Plus, Landmark, Wallet, Briefcase,
    AlertCircle, CheckCircle2, ChevronRight, X, Loader2,
    Banknote, CalendarDays, FileText, TrendingDown, TrendingUp
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
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</label>
            <div className="relative">
                <select
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all cursor-pointer"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    required
                >
                    <option value="">Selecionar conta...</option>
                    {available.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
                <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
            </div>

            {/* Selected account preview */}
            {selected && (
                <div className="mt-2 p-3 bg-white rounded-xl border border-slate-100 flex items-center gap-3 animate-fade-in">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <AccountIcon type={selected.type} className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{selected.name}</p>
                        <p className="text-xs text-slate-400">{selected.bank || selected.type}</p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-800">{formatCurrency(selected.current_balance)}</p>
                        <p className="text-[10px] text-slate-400">saldo atual</p>
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
            const newTransfer: Transfer = {
                id: StorageService.generateId(),
                from_account_id: form.from,
                to_account_id: form.to,
                amount: transferAmount,
                date: form.date,
                description: form.description.trim() || undefined,
                created_at: new Date().toISOString()
            };
            console.log('[Transfer] Salvando:', newTransfer);
            await StorageService.saveTransfer(newTransfer);
            console.log('[Transfer] Salvo com sucesso!');
            setForm({ from: '', to: '', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
            setIsModalOpen(false);
            await loadData();
        } catch (error: any) {
            console.error('Erro ao salvar transferência:', error);
            alert(`Erro ao salvar transferência: ${error?.message || 'Tente novamente.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const openModal = () => {
        setForm({ from: '', to: '', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
        setIsModalOpen(true);
    };

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Transferências</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Mova dinheiro entre suas contas</p>
                </div>
                <button
                    id="btn-nova-transferencia"
                    onClick={openModal}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all hover:shadow-lg active:scale-95 font-semibold text-sm"
                >
                    <Plus size={18} />
                    Nova Transferência
                </button>
            </div>

            {/* Summary Cards */}
            {!loading && accounts.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {accounts.slice(0, 4).map(acc => (
                        <div key={acc.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                                    <AccountIcon type={acc.type} className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <p className="text-xs font-bold text-slate-500 truncate">{acc.name}</p>
                            </div>
                            <p className={`text-lg font-black ${acc.current_balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                                {formatCurrency(acc.current_balance)}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Transfer History */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 size={36} className="animate-spin mb-3" />
                    <p className="text-sm">Carregando transferências...</p>
                </div>
            ) : transfers.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ArrowRightLeft size={28} className="text-slate-400" />
                    </div>
                    <p className="text-lg font-bold text-slate-600">Nenhuma transferência</p>
                    <p className="text-sm text-slate-400 mt-1">Clique em "Nova Transferência" para começar</p>
                    <button
                        onClick={openModal}
                        className="mt-5 inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
                    >
                        <Plus size={16} />
                        Criar primeira transferência
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {(Object.entries(groupedTransfers) as [string, Transfer[]][]).map(([month, monthTransfers]) => (
                        <div key={month}>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <CalendarDays size={12} />
                                {formatMonthLabel(month)}
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-black">
                                    {monthTransfers.length}
                                </span>
                            </h3>
                            <div className="space-y-2">
                                {monthTransfers.map(t => {
                                    const from = accounts.find(a => a.id === t.from_account_id);
                                    const to = accounts.find(a => a.id === t.to_account_id);
                                    return (
                                        <div key={t.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow group">
                                            <div className="flex items-center gap-4">
                                                {/* Icon */}
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                                    <ArrowRightLeft size={18} className="text-slate-500" />
                                                </div>

                                                {/* Accounts flow */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-bold text-red-600 truncate">
                                                            {from?.name ?? 'Conta removida'}
                                                        </span>
                                                        <ChevronRight size={14} className="text-slate-300 shrink-0" />
                                                        <span className="text-sm font-bold text-emerald-600 truncate">
                                                            {to?.name ?? 'Conta removida'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                        <CalendarDays size={10} />
                                                        {formatDate(t.date)}
                                                        {t.description && (
                                                            <>
                                                                <span className="text-slate-200">·</span>
                                                                <FileText size={10} />
                                                                <span className="truncate max-w-[140px]">{t.description}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>

                                                {/* Amount */}
                                                <div className="shrink-0 text-right">
                                                    <p className="text-base font-black text-slate-800">{formatCurrency(t.amount)}</p>
                                                    <div className="flex items-center gap-1 justify-end mt-0.5">
                                                        <TrendingDown size={10} className="text-red-400" />
                                                        <TrendingUp size={10} className="text-emerald-400" />
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
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
                                    <ArrowRightLeft size={16} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base leading-tight">Nova Transferência</h3>
                                    <p className="text-xs text-slate-400">Mover saldo entre contas</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Account selectors */}
                            <div className="flex gap-3">
                                <AccountSelector
                                    label="Origem (De)"
                                    accounts={accounts}
                                    value={form.from}
                                    onChange={id => setForm(f => ({ ...f, from: id, to: f.to === id ? '' : f.to }))}
                                    excludeId={form.to}
                                />
                                <div className="flex flex-col items-center justify-center pt-6 shrink-0">
                                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                                        <ArrowRightLeft size={15} className="text-slate-500" />
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
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Valor</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        className={`w-full bg-slate-50 border rounded-xl pl-10 pr-4 py-3.5 text-xl font-black text-slate-800 outline-none focus:ring-2 transition-all ${isInsufficient
                                            ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400 bg-red-50'
                                            : 'border-slate-200 focus:ring-orange-500/30 focus:border-orange-400'
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
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-red-500 mt-2 animate-fade-in">
                                        <AlertCircle size={13} />
                                        Saldo insuficiente. Disponível: {formatCurrency(fromAccount?.current_balance ?? 0)}
                                    </p>
                                )}

                                {/* Preview */}
                                {isReady && fromAccount && toAccount && (
                                    <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2 animate-fade-in">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prévia após a transferência</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <TrendingDown size={14} className="text-red-500" />
                                                <span className="text-xs font-bold text-slate-600">{fromAccount.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black text-red-600">
                                                    {formatCurrency(fromAccount.current_balance - transferAmount)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 ml-1">
                                                    (antes: {formatCurrency(fromAccount.current_balance)})
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp size={14} className="text-emerald-500" />
                                                <span className="text-xs font-bold text-slate-600">{toAccount.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black text-emerald-600">
                                                    {formatCurrency(toAccount.current_balance + transferAmount)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 ml-1">
                                                    (antes: {formatCurrency(toAccount.current_balance)})
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Date + Description */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Data</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                                        value={form.date}
                                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descrição <span className="normal-case text-slate-300">(opcional)</span></label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                                        placeholder="Ex: Reserva"
                                        value={form.description}
                                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!isReady || isSaving}
                                    className="flex-1 px-4 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md disabled:shadow-none"
                                >
                                    {isSaving ? (
                                        <><Loader2 size={15} className="animate-spin" /> Salvando...</>
                                    ) : (
                                        <><CheckCircle2 size={15} /> Confirmar Transferência</>
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
