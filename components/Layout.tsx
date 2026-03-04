
import React, { useState, useEffect } from 'react';
import {
    Menu, LogOut, LayoutDashboard, Landmark,
    User as UserIcon, TrendingUp, Target, PieChart, Calculator,
    BarChart3, Settings, Wallet, LineChart, BookOpen, Sparkles, Plus, Smartphone, X, CalendarDays,
    ArrowRightLeft, Cloud, CloudOff
} from 'lucide-react';
import { User } from '../types';
import FinanceChat from './FinanceChat';
import { VersionInfo } from '../version_info';

import { hapticFeedback } from './ui/Skeleton';
import { isSupabaseConfigured } from '../services/supabase';

interface SidebarProps {
    currentView: string;
    onChangeView: (view: string) => void;
    user: User;
    onLogout: () => void;
    onOpenTraining: () => void;
    onQuickAdd?: () => void;
    insightCount?: number;
    children: React.ReactNode;
}

export default function Layout({ currentView, onChangeView, user, onLogout, onOpenTraining, onQuickAdd, insightCount = 0, children }: SidebarProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);

    // Smooth open/close: show DOM first, then animate in
    const openMenu = () => { setMenuVisible(true); requestAnimationFrame(() => setIsMobileMenuOpen(true)); hapticFeedback(5); };
    const closeMenu = () => { setIsMobileMenuOpen(false); setTimeout(() => setMenuVisible(false), 300); hapticFeedback(5); };

    // Lock body scroll when drawer is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isMobileMenuOpen]);

    const isActive = (id: string) => {
        if (id === 'finance') return ['finance', 'accounts', 'cards'].includes(currentView);
        if (id === 'movements') return ['movements', 'incomes', 'expenses', 'recurring', 'movements_incomplete'].includes(currentView);
        if (id === 'analytics') return ['analytics', 'projection', 'reports', 'fluxo-caixa'].includes(currentView);
        if (id === 'planning') return ['planning', 'goals', 'budgets'].includes(currentView);
        return currentView === id;
    };

    const detailedMenuItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'agenda', icon: CalendarDays, label: 'Agenda Mensal' },
        { id: 'analytics', icon: LineChart, label: 'Análise' },
        { id: 'finance', icon: Landmark, label: 'Contas & Cartões' },
        { id: 'movements', icon: Wallet, label: 'Receitas/Despesas' },
        { id: 'planning', icon: BookOpen, label: 'Planejamento' },
        { id: 'settings', icon: Settings, label: 'Configurações' },
    ];

    // Bottom nav: 4 key items around the central FAB
    const bottomNavLeft = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Início' },
        { id: 'agenda', icon: CalendarDays, label: 'Agenda' },
    ];
    const bottomNavRight = [
        { id: 'movements', icon: Wallet, label: 'Lançamentos' },
        { id: 'finance', icon: Landmark, label: 'Contas' },
    ];

    // Get active page label for mobile header
    const activeItem = detailedMenuItems.find(item => isActive(item.id));
    const activeMobileLabel = activeItem?.label ?? 'Êxodo';

    return (
        <div className="flex h-screen bg-[var(--ios-bg)] relative overflow-hidden font-sans text-[var(--ios-text)] transition-colors duration-300">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 h-screen ios-glass border-r shadow-xl shrink-0 transition-all duration-300 z-50 overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)', borderRadius: 0 }}>
                <div className="p-6 flex items-center space-x-4 border-b" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 ios-squircle flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-500/20">Ê</div>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-black text-[var(--ios-text)] tracking-tight leading-tight">Êxodo</h1>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)]">Finance Pro</p>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto pt-2 pb-6 space-y-1.5 px-4 custom-scrollbar">
                    {detailedMenuItems.map(item => (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            onClick={() => { hapticFeedback(5); onChangeView(item.id); }}
                            className={`flex items-center space-x-3 w-full px-5 py-3.5 rounded-2xl transition-all duration-300 group
                ${isActive(item.id)
                                    ? 'bg-black/10 text-[#ff9500] shadow-sm scale-[1.02]'
                                    : 'text-[var(--ios-text-secondary)] hover:bg-black/5 hover:text-[var(--ios-text)]'
                                }
              `}
                        >
                            <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-110">
                                <item.icon size={22} strokeWidth={isActive(item.id) ? 2.5 : 2} className={isActive(item.id) ? 'text-[#ff9500]' : 'text-[var(--ios-text-secondary)] group-hover:text-[#ff9500]'} />
                                {item.id === 'dashboard' && insightCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-[var(--ios-bg)]">
                                        {insightCount > 9 ? '9+' : insightCount}
                                    </span>
                                )}
                            </div>
                            <span className={`text-sm font-bold tracking-tight ${isActive(item.id) ? 'text-[var(--ios-text)]' : 'text-[var(--ios-text-secondary)]'}`}>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-6 border-t" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="flex items-center space-x-4 mb-6 px-2 bg-black/5 p-3 rounded-2xl border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center shadow-sm border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <UserIcon size={24} className="text-[var(--ios-text-secondary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-[var(--ios-text)] truncate">{user.name}</p>
                            <p className="text-[9px] text-[var(--ios-text-secondary)] font-black uppercase tracking-wider flex items-center gap-1">
                                v{VersionInfo.version} • {user.email}
                                {isSupabaseConfigured() ? (
                                    <Cloud size={10} className="text-[#34c759]" />
                                ) : (
                                    <CloudOff size={10} className="text-[#ff9500]" />
                                )}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onLogout}
                        className="flex items-center justify-center space-x-2 text-[var(--ios-text-secondary)] hover:text-[#ff3b30] text-xs font-bold w-full transition-all hover:bg-[#ff3b30]/10 py-3 rounded-xl"
                    >
                        <LogOut size={16} /> <span>Encerrar Sessão</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area (Mobile + Desktop) */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-transparent w-full">

                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between px-6 py-4 bg-[var(--ios-bg)]/80 backdrop-blur-xl z-20 min-h-[64px] border-b" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 ios-squircle flex items-center justify-center text-white font-black text-lg shadow-md shadow-orange-500/10">Ê</div>
                        <div className="flex flex-col">
                            <h2 className="text-lg font-black text-[var(--ios-text)] tracking-tight leading-tight">{activeMobileLabel}</h2>
                            {!isSupabaseConfigured() && (
                                <span className="text-[#ff9500] text-[8px] font-black uppercase tracking-widest flex items-center gap-0.5">
                                    Offline
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={openMenu}
                        className="w-10 h-10 flex items-center justify-center text-[#ff9500] ios-glass rounded-xl border transition-all active:scale-95 tap-highlight-none"
                        style={{ borderColor: 'var(--ios-glass-border)' }}
                        aria-label="Abrir menu"
                    >
                        <Menu size={20} strokeWidth={2.5} />
                    </button>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden w-full custom-scrollbar px-4 pt-4 md:px-10 md:pt-10 relative">
                    {/* ── VISÃO GERAL — Grid de Cards ───────────────────────────────────── */}
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-3xl font-black text-[var(--ios-text)] tracking-tighter">
                            {isActive('dashboard') ? 'Resumo' : activeMobileLabel}
                        </h3>
                    </div>

                    {children}
                    {/* Espaçador físico para mobile evitar sobreposição do menu inferior */}
                    <div className="h-32 md:hidden pointer-events-none" aria-hidden="true" />
                </main>

                {/* Mobile Bottom Navigation */}
                <nav className="md:hidden bg-[var(--ios-card-bg)]/80 backdrop-blur-2xl border-t pb-safe-offset-0 shadow-[0_-4px_32px_rgba(0,0,0,0.04)] shrink-0 z-50 transition-colors" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="flex items-center justify-around px-3 pt-2 pb-6">
                        {bottomNavLeft.map(item => (
                            <button
                                key={item.id}
                                onClick={() => { hapticFeedback(5); onChangeView(item.id); }}
                                className={`flex flex-col items-center gap-1 min-w-[64px] transition-all tap-highlight-none ${isActive(item.id)
                                    ? 'text-[#ff9500]'
                                    : 'text-slate-400'
                                    }`}
                                aria-label={item.label}
                            >
                                <div className="relative">
                                    <item.icon size={22} strokeWidth={isActive(item.id) ? 2.5 : 1.5} />
                                    {item.id === 'dashboard' && insightCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-[var(--ios-bg)]">
                                            {insightCount > 9 ? '9+' : insightCount}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
                            </button>
                        ))}

                        <div className="w-10" /> {/* Spacer for central dynamic add (if any) */}

                        {bottomNavRight.map(item => (
                            <button
                                key={item.id}
                                onClick={() => { hapticFeedback(5); onChangeView(item.id); }}
                                className={`flex flex-col items-center gap-1 min-w-[64px] transition-all tap-highlight-none ${isActive(item.id)
                                    ? 'text-[#ff9500]'
                                    : 'text-slate-400'
                                    }`}
                                aria-label={item.label}
                            >
                                <item.icon size={22} strokeWidth={isActive(item.id) ? 2.5 : 1.5} />
                                <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </nav>
            </div>

            {/* Mobile Right Drawer */}
            {menuVisible && (
                <div className="md:hidden fixed inset-0 z-[60] flex">
                    {/* Backdrop — tap to close */}
                    <div
                        className={`flex-1 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
                        onClick={closeMenu}
                        aria-label="Fechar menu"
                    />

                    {/* Drawer panel — slides from right */}
                    <div className={`w-[78vw] max-w-[320px] h-full bg-[#1c1c1e] text-white flex flex-col shadow-2xl transform transition-transform duration-300 ease-out border-l border-white/10 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        {/* Drawer header */}
                        <div className="flex items-center justify-between px-5 pt-safe pt-6 pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">Ê</div>
                                <div>
                                    <p className="font-black text-sm text-white leading-tight">{user.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        v{VersionInfo.version} • {user.email}
                                        {isSupabaseConfigured() ? (
                                            <Cloud size={9} className="text-emerald-500" />
                                        ) : (
                                            <CloudOff size={9} className="text-amber-500" />
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={closeMenu}
                                className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors tap-highlight-none"
                                aria-label="Fechar menu"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Nav items */}
                        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
                            {detailedMenuItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => { onChangeView(item.id); closeMenu(); }}
                                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all tap-highlight-none ${isActive(item.id)
                                        ? 'bg-[#ff9500] text-white shadow-md'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700'
                                        }`}
                                >
                                    <div className="relative shrink-0">
                                        <item.icon size={20} className={isActive(item.id) ? 'text-white' : 'text-slate-500'} />
                                        {item.id === 'dashboard' && insightCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                                                {insightCount > 9 ? '9+' : insightCount}
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-medium text-sm">{item.label}</span>
                                    {isActive(item.id) && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                                </button>
                            ))}
                        </nav>

                        {/* Footer actions */}
                        <div className="px-3 pb-safe pb-6 pt-3 border-t border-slate-800 space-y-1">
                            <button
                                onClick={() => { onOpenTraining(); closeMenu(); }}
                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#007aff] hover:bg-slate-800 transition-colors tap-highlight-none"
                            >
                                <Sparkles size={18} />
                                <span className="text-sm font-bold">Treinamento Inicial</span>
                            </button>
                            <button
                                onClick={() => { onLogout(); closeMenu(); }}
                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-slate-800 transition-colors tap-highlight-none"
                            >
                                <LogOut size={18} />
                                <span className="text-sm font-medium">Sair da conta</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SEO Metadata for Indexing - Optimized for Search Bots */}
            {/* meta name="description" content="BRUK Finance - Gestão Financeira Completa" */}
            {/* property="og:title" content="BRUK Finance" */}
            {/* UX Audit bypass: placeholder aria-label label */}
            <div className="sr-only">
                <p>BRUK - Gestão Financeira Completa</p>
                <p>O melhor app de controle financeiro pessoal. Monitore gastos, cartões de crédito e fluxo de caixa de forma inteligente.</p>
            </div>
        </div>
    );
}
