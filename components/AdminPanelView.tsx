import React, { useState, useEffect, useMemo } from 'react';
import {
    Users, Shield, Clock, Ban, CheckCircle, AlertTriangle, Search,
    ChevronDown, Eye, Unlock, Lock, Trash2, RefreshCw, X, CalendarPlus,
    StickyNote, Loader2, TrendingUp, Wallet, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import {
    AdminUser, AdminUserSummary,
    adminListUsers, adminGetUserSummary,
    adminUnblockUser, adminBlockUser,
    adminExtendTrial, adminUpdateNotes, adminDeleteUser,
} from '../services/adminService';
import { formatCurrency, formatDate } from '../utils';

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: 'ok' | 'err'; onDone: () => void }) {
    useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, []);
    return (
        <div className={`fixed bottom-24 right-6 z-[200] px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl flex items-center gap-2 animate-slide-up ${type === 'ok' ? 'bg-[#34c759]' : 'bg-[#ff3b30]'}`}>
            {type === 'ok' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {msg}
        </div>
    );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
    ATIVO: 'bg-[#34c759]/15 text-[#34c759]',
    PRO: 'bg-[#007aff]/15 text-[#007aff]',
    EXPIRANDO: 'bg-[#ff9500]/15 text-[#ff9500]',
    EXPIRADO: 'bg-[#ff3b30]/15 text-[#ff3b30]',
    BLOQUEADO: 'bg-[#ff3b30]/20 text-[#ff3b30]',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${STATUS_COLORS[status] ?? 'bg-black/10'}`}>
            {status}
        </span>
    );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({
    title, message, dangerous, onConfirm, onCancel,
    inputRequired, inputLabel,
}: {
    title: string;
    message: string;
    dangerous?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    inputRequired?: string; // user must type this string
    inputLabel?: string;
}) {
    const [val, setVal] = useState('');
    const [days, setDays] = useState<number | undefined>(undefined);
    const canConfirm = inputRequired ? val === inputRequired : true;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="ios-glass rounded-3xl border shadow-2xl w-full max-w-sm p-6 space-y-4" style={{ borderColor: 'var(--ios-glass-border)' }}>
                <h3 className="font-black text-[var(--ios-text)] text-lg">{title}</h3>
                <p className="text-sm text-[var(--ios-text-secondary)]">{message}</p>
                {inputRequired && (
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">{inputLabel ?? `Digite "${inputRequired}" para confirmar`}</p>
                        <input
                            type="text"
                            value={val}
                            onChange={e => setVal(e.target.value)}
                            className="w-full bg-black/5 border border-[var(--ios-glass-border)] rounded-xl px-4 py-3 text-[var(--ios-text)] text-[16px] outline-none"
                            placeholder={inputRequired}
                        />
                    </div>
                )}
                <div className="flex gap-3 pt-2">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-[var(--ios-text-secondary)] hover:bg-black/5 font-bold text-sm transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        className={`flex-[2] py-3 rounded-xl text-white font-black text-sm transition-all disabled:opacity-40 ${dangerous ? 'bg-[#ff3b30]' : 'bg-[#ff9500]'}`}
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Days Input Modal ──────────────────────────────────────────────────────────
function DaysModal({ title, onConfirm, onCancel, defaultDays = 30 }: {
    title: string; onConfirm: (days: number) => void; onCancel: () => void; defaultDays?: number;
}) {
    const [days, setDays] = useState(defaultDays);
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="ios-glass rounded-3xl border shadow-2xl w-full max-w-xs p-6 space-y-4" style={{ borderColor: 'var(--ios-glass-border)' }}>
                <h3 className="font-black text-[var(--ios-text)]">{title}</h3>
                <input
                    type="number" min={1} max={3650}
                    value={days}
                    onChange={e => setDays(Number(e.target.value))}
                    className="w-full bg-black/5 border border-[var(--ios-glass-border)] rounded-xl px-4 py-3 text-[var(--ios-text)] text-[16px] font-black text-center outline-none"
                />
                <p className="text-[10px] text-[var(--ios-text-secondary)] text-center">dias a partir de hoje</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-[var(--ios-text-secondary)] hover:bg-black/5 font-bold text-sm transition-colors">Cancelar</button>
                    <button onClick={() => onConfirm(days)} className="flex-[2] py-3 rounded-xl bg-[#ff9500] text-white font-black text-sm transition-all">Confirmar</button>
                </div>
            </div>
        </div>
    );
}

// ── User Drawer ───────────────────────────────────────────────────────────────
function UserDrawer({ userId, onClose, onAction }: { userId: string; onClose: () => void; onAction: () => void }) {
    const [summary, setSummary] = useState<AdminUserSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);

    useEffect(() => {
        adminGetUserSummary(userId)
            .then(data => { setSummary(data); setNotes(data.user?.notes ?? ''); })
            .finally(() => setLoading(false));
    }, [userId]);

    const saveNotes = async () => {
        setSavingNotes(true);
        try { await adminUpdateNotes(userId, notes); }
        finally { setSavingNotes(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] flex">
            <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-md h-full bg-[var(--ios-card-bg)] border-l overflow-y-auto flex flex-col" style={{ borderColor: 'var(--ios-glass-border)' }}>
                {/* Header */}
                <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-[var(--ios-card-bg)] z-10" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <h3 className="font-black text-[var(--ios-text)]">Detalhes do Usuário</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-black/10 flex items-center justify-center text-[var(--ios-text-secondary)]">
                        <X size={18} />
                    </button>
                </div>

                {loading && (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 size={32} className="animate-spin text-[#ff9500]" />
                    </div>
                )}

                {!loading && summary && (
                    <div className="p-6 space-y-6 flex-1">
                        {/* User Identity */}
                        <div className="space-y-1">
                            <h4 className="text-xl font-black text-[var(--ios-text)]">{summary.user.name}</h4>
                            <p className="text-sm text-[var(--ios-text-secondary)]">{summary.user.email}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <StatusBadge status={summary.user.status} />
                                <span className="text-[10px] text-[var(--ios-text-secondary)] font-mono">
                                    Cadastro: {formatDate(summary.user.created_at)}
                                </span>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Saldo Total', value: formatCurrency(summary.user.total_balance), icon: Wallet },
                                { label: 'Transações', value: summary.user.total_transactions.toString(), icon: TrendingUp },
                                { label: 'Dias Restantes', value: summary.user.dias_restantes.toString(), icon: Clock },
                                { label: 'Contas', value: summary.accounts.length.toString(), icon: Shield },
                            ].map(item => (
                                <div key={item.label} className="bg-black/5 rounded-2xl p-3 border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                    <item.icon size={14} className="text-[#ff9500] mb-1" />
                                    <p className="text-lg font-black text-[var(--ios-text)]">{item.value}</p>
                                    <p className="text-[9px] text-[var(--ios-text-secondary)] uppercase tracking-widest font-bold">{item.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Recent Transactions */}
                        {summary.recent_transactions.length > 0 && (
                            <div>
                                <h5 className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest mb-3">Últimas Transações</h5>
                                <div className="space-y-2">
                                    {summary.recent_transactions.map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-3 bg-black/5 rounded-xl border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                            <div className="flex items-center gap-2">
                                                {t.type === 'RECEITA'
                                                    ? <ArrowUpCircle size={14} className="text-[#007aff]" />
                                                    : <ArrowDownCircle size={14} className="text-[#ff3b30]" />
                                                }
                                                <div>
                                                    <p className="text-xs font-bold text-[var(--ios-text)]">{t.description}</p>
                                                    <p className="text-[9px] text-[var(--ios-text-secondary)] font-mono">{formatDate(t.date)}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs font-black ${t.type === 'RECEITA' ? 'text-[#007aff]' : 'text-[#ff3b30]'}`}>
                                                {t.type === 'RECEITA' ? '+' : '-'}{formatCurrency(t.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <h5 className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest mb-2">Anotações Privadas</h5>
                            <textarea
                                rows={4}
                                className="w-full bg-black/5 border border-[var(--ios-glass-border)] rounded-xl p-3 text-[var(--ios-text)] text-[16px] resize-none outline-none"
                                placeholder="Anotações sobre este usuário..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                            <button
                                onClick={saveNotes}
                                disabled={savingNotes}
                                className="mt-2 w-full py-2.5 bg-[#ff9500] text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {savingNotes ? <Loader2 size={14} className="animate-spin" /> : <StickyNote size={14} />}
                                Salvar Anotações
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main AdminPanelView ───────────────────────────────────────────────────────
type FilterTab = 'ALL' | 'ATIVO' | 'PRO' | 'EXPIRANDO' | 'EXPIRADO' | 'BLOQUEADO';

type ModalState =
    | { type: 'unblock'; user: AdminUser }
    | { type: 'extend'; user: AdminUser }
    | { type: 'block'; user: AdminUser }
    | { type: 'delete'; user: AdminUser }
    | null;

export default function AdminPanelView() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
    const [modal, setModal] = useState<ModalState>(null);
    const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => setToast({ msg, type });

    const load = async () => {
        setLoading(true);
        try {
            const data = await adminListUsers();
            setUsers(data);
        } catch (e: any) {
            showToast(e.message, 'err');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // Summary cards
    const summary = useMemo(() => ({
        total: users.length,
        ativos: users.filter(u => u.status === 'ATIVO' || u.status === 'PRO').length,
        expirando: users.filter(u => u.status === 'EXPIRANDO').length,
        bloqueados: users.filter(u => u.status === 'BLOQUEADO').length,
    }), [users]);

    // Filtered users
    const filtered = useMemo(() => {
        return users.filter(u => {
            const matchTab = filterTab === 'ALL' || u.status === filterTab;
            const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
            return matchTab && matchSearch;
        });
    }, [users, filterTab, search]);

    // Action handlers
    const handleAction = async (fn: () => Promise<void>, successMsg: string) => {
        setActionLoading(true);
        setModal(null);
        try {
            await fn();
            showToast(successMsg, 'ok');
            await load();
        } catch (e: any) {
            showToast(e.message, 'err');
        } finally {
            setActionLoading(false);
        }
    };

    const tabs: { id: FilterTab; label: string }[] = [
        { id: 'ALL', label: 'Todos' },
        { id: 'ATIVO', label: 'Ativos' },
        { id: 'PRO', label: 'Pro' },
        { id: 'EXPIRANDO', label: 'Expirando' },
        { id: 'EXPIRADO', label: 'Expirado' },
        { id: 'BLOQUEADO', label: 'Bloqueados' },
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#ff9500]/10 flex items-center justify-center">
                    <Shield size={20} className="text-[#ff9500]" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[var(--ios-text)] tracking-tight flex items-center gap-2">
                        Painel Admin
                    </h2>
                    <p className="text-[10px] text-[var(--ios-text-secondary)] font-bold uppercase tracking-widest">Controle de Usuários</p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="ml-auto w-9 h-9 rounded-xl bg-black/5 border border-[var(--ios-glass-border)] flex items-center justify-center text-[var(--ios-text-secondary)] hover:text-[#ff9500] transition-colors"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total de Usuários', value: summary.total, icon: Users, color: '#007aff' },
                    { label: 'Ativos', value: summary.ativos, icon: CheckCircle, color: '#34c759' },
                    { label: 'Expirando (7d)', value: summary.expirando, icon: Clock, color: '#ff9500' },
                    { label: 'Bloqueados', value: summary.bloqueados, icon: Ban, color: '#ff3b30' },
                ].map(card => (
                    <div key={card.label} className="ios-glass rounded-2xl border p-4 space-y-2" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <card.icon size={18} style={{ color: card.color }} />
                        <p className="text-2xl font-black" style={{ color: card.color }}>{card.value}</p>
                        <p className="text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="space-y-3">
                <div className="flex bg-black/5 p-1 rounded-2xl overflow-x-auto gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterTab(tab.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterTab === tab.id ? 'bg-[var(--ios-card-bg)] text-[var(--ios-text)] shadow-md' : 'text-[var(--ios-text-secondary)]'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ios-text-secondary)]" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        className="w-full pl-10 pr-4 py-3 bg-black/5 border border-[var(--ios-glass-border)] rounded-xl text-[var(--ios-text)] text-[16px] outline-none"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className="ios-glass rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                {loading ? (
                    <div className="p-16 flex items-center justify-center">
                        <Loader2 size={32} className="animate-spin text-[#ff9500]" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-16 text-center text-[var(--ios-text-secondary)]">
                        <Users size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-bold">Nenhum usuário encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-black/5 text-[10px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)]">
                                <tr>
                                    <th className="px-6 py-4 text-left">Usuário</th>
                                    <th className="px-4 py-4 text-left">Status</th>
                                    <th className="px-4 py-4 text-left hidden md:table-cell">Dias</th>
                                    <th className="px-4 py-4 text-right">Recebimentos</th>
                                    <th className="px-4 py-4 text-right text-gray-400">Pendente</th>
                                    <th className="px-4 py-4 text-right hidden lg:table-cell">Saldo</th>
                                    <th className="px-4 py-4 text-left hidden xl:table-cell">Última Ativ.</th>
                                    <th className="px-4 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                {filtered.map(user => (
                                    <UserRow
                                        key={user.id}
                                        user={user}
                                        onView={() => setDrawerUserId(user.id)}
                                        onUnblock={() => setModal({ type: 'unblock', user })}
                                        onExtend={() => setModal({ type: 'extend', user })}
                                        onBlock={() => setModal({ type: 'block', user })}
                                        onDelete={() => setModal({ type: 'delete', user })}
                                        actionLoading={actionLoading}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            {modal?.type === 'unblock' && (
                <DaysModal
                    title={`Liberar acesso para ${modal.user.name}`}
                    defaultDays={30}
                    onConfirm={days => handleAction(() => adminUnblockUser(modal.user.id, days), 'Acesso liberado!')}
                    onCancel={() => setModal(null)}
                />
            )}
            {modal?.type === 'extend' && (
                <DaysModal
                    title={`Estender trial de ${modal.user.name}`}
                    defaultDays={7}
                    onConfirm={days => handleAction(() => adminExtendTrial(modal.user.id, days), 'Trial estendido!')}
                    onCancel={() => setModal(null)}
                />
            )}
            {modal?.type === 'block' && (
                <ConfirmModal
                    title="Bloquear usuário"
                    message={`Tem certeza que deseja bloquear ${modal.user.name}? O usuário perderá acesso imediatamente.`}
                    dangerous
                    onConfirm={() => handleAction(() => adminBlockUser(modal.user.id), 'Usuário bloqueado!')}
                    onCancel={() => setModal(null)}
                />
            )}
            {modal?.type === 'delete' && (
                <ConfirmModal
                    title="⚠️ Excluir usuário permanentemente"
                    message={`Esta ação removerá TODOS os dados de ${modal.user.name}, incluindo transações, contas e seu acesso. Esta ação é IRREVERSÍVEL.`}
                    dangerous
                    inputRequired="CONFIRMAR"
                    inputLabel='Digite "CONFIRMAR" para prosseguir'
                    onConfirm={() => handleAction(() => adminDeleteUser(modal.user.id), 'Usuário excluído permanentemente.')}
                    onCancel={() => setModal(null)}
                />
            )}

            {/* Drawer */}
            {drawerUserId && (
                <UserDrawer
                    userId={drawerUserId}
                    onClose={() => setDrawerUserId(null)}
                    onAction={load}
                />
            )}

            {/* Toast */}
            {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
        </div>
    );
}

// ── User Row (inline) ─────────────────────────────────────────────────────────
function UserRow({ user, onView, onUnblock, onExtend, onBlock, onDelete, actionLoading }: {
    user: AdminUser;
    onView: () => void;
    onUnblock: () => void;
    onExtend: () => void;
    onBlock: () => void;
    onDelete: () => void;
    actionLoading: boolean;
    key?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <tr className="hover:bg-black/5 transition-colors text-sm group relative">
            <td className="px-6 py-4">
                <div className="flex flex-col">
                    <span className="font-bold text-[var(--ios-text)]">{user.name || '—'}</span>
                    <span className="text-[10px] text-[var(--ios-text-secondary)]">{user.email}</span>
                </div>
            </td>
            <td className="px-4 py-4"><StatusBadge status={user.status} /></td>
            <td className="px-4 py-4 hidden md:table-cell font-mono text-xs text-[var(--ios-text-secondary)]">
                {user.status === 'BLOQUEADO' ? '—' : `${user.dias_restantes}d`}
            </td>
            <td className="px-4 py-4 text-right font-black text-xs text-[#34c759]">
                {formatCurrency(user.confirmed_income || 0)}
            </td>
            <td className="px-4 py-4 text-right font-bold text-xs text-gray-400">
                {formatCurrency(user.pending_income || 0)}
            </td>
            <td className="px-4 py-4 text-right hidden lg:table-cell font-black text-xs" style={{ color: user.total_balance >= 0 ? '#34c759' : '#ff3b30' }}>
                {formatCurrency(user.total_balance)}
            </td>
            <td className="px-4 py-4 hidden xl:table-cell text-[var(--ios-text-secondary)] text-xs font-mono">
                {user.last_activity ? formatDate(user.last_activity) : '—'}
            </td>
            <td className="px-4 py-4 text-right">
                <div className="relative inline-block">
                    <button
                        onClick={() => setOpen(!open)}
                        disabled={actionLoading}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)] hover:text-[#ff9500] px-3 py-1.5 rounded-lg hover:bg-black/5 transition-all"
                    >
                        Ações <ChevronDown size={12} />
                    </button>
                    {open && (
                        <>
                            <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--ios-card-bg)] border rounded-2xl shadow-2xl overflow-hidden w-48" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                {[
                                    { label: 'Ver detalhes', icon: Eye, fn: onView, color: '' },
                                    { label: 'Liberar acesso', icon: Unlock, fn: onUnblock, color: 'text-[#34c759]' },
                                    { label: 'Estender trial', icon: CalendarPlus, fn: onExtend, color: 'text-[#007aff]' },
                                    { label: 'Bloquear', icon: Lock, fn: onBlock, color: 'text-[#ff9500]' },
                                    { label: 'Excluir usuário', icon: Trash2, fn: onDelete, color: 'text-[#ff3b30]' },
                                ].map(item => (
                                    <button
                                        key={item.label}
                                        onClick={() => { setOpen(false); item.fn(); }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold hover:bg-black/5 transition-colors text-left ${item.color || 'text-[var(--ios-text)]'}`}
                                    >
                                        <item.icon size={14} />
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}
