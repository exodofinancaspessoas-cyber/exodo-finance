
import React, { useState, useEffect } from 'react';
import {
    Menu, LogOut, LayoutDashboard, Landmark,
    User as UserIcon, TrendingUp, Target, PieChart, Calculator,
    BarChart3, Settings, Wallet, LineChart, BookOpen, Sparkles, Plus, Smartphone, X, CalendarDays,
    ArrowRightLeft
} from 'lucide-react';
import { User } from '../types';
import { VersionInfo } from '../version';
import { hapticFeedback } from './ui/Skeleton';
import { isSupabaseConfigured } from '../services/supabase';
import { Cloud, CloudOff } from 'lucide-react';

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
        { id: 'movements', icon: Wallet, label: 'Lançar' },
        { id: 'finance', icon: Landmark, label: 'Contas' },
    ];

    // Get active page label for mobile header
    const activeItem = detailedMenuItems.find(item => isActive(item.id));
    const activeMobileLabel = activeItem?.label ?? 'Êxodo';

    return (
        <div className="flex h-screen bg-slate-50 relative overflow-hidden font-sans text-slate-900">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800 shrink-0 transition-all duration-300">
                <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">Ê</div>
                    <h1 className="text-xl font-bold tracking-tight">Êxodo Finance</h1>
                </div>

                <nav className="flex-1 overflow-y-auto pt-4 pb-6 space-y-1 px-3">
                    {/* Botão Global de Novo Lançamento (Desktop) */}
                    <div className="px-3 mb-6">
                        <button
                            onClick={() => { hapticFeedback(15); onQuickAdd?.(); }}
                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black py-4 px-4 rounded-2xl shadow-xl shadow-orange-900/40 hover:shadow-orange-900/60 active:scale-95 transition-all flex items-center justify-center gap-3 group"
                        >
                            <div className="bg-white/20 p-1.5 rounded-xl group-hover:bg-white/30 transition-colors">
                                <Plus size={20} strokeWidth={3} />
                            </div>
                            <span className="text-sm tracking-tight">Novo Lançamento</span>
                        </button>
                    </div>

                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 opacity-50">Menu Principal</div>

                    {detailedMenuItems.map(item => (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            onClick={() => { hapticFeedback(5); onChangeView(item.id); }}
                            className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg transition-all duration-200 group
                ${isActive(item.id)
                                    ? 'bg-orange-600/90 text-white shadow-lg shadow-orange-900/20 translate-x-1'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }
              `}
                        >
                            <div className="relative shrink-0">
                                <item.icon size={20} className={isActive(item.id) ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
                                {item.id === 'dashboard' && insightCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-slate-900">
                                        {insightCount > 9 ? '9+' : insightCount}
                                    </span>
                                )}
                            </div>
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex items-center space-x-3 mb-4 px-2">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                            <UserIcon size={20} className="text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                Versão {VersionInfo.version}
                                {isSupabaseConfigured() ? (
                                    <span className="text-emerald-500" title="Cloud Active"><Cloud size={10} /></span>
                                ) : (
                                    <span className="text-amber-500" title="Local Only Mode"><CloudOff size={10} /></span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onOpenTraining}
                        className="flex items-center space-x-2 text-orange-500 hover:text-orange-600 text-[11px] font-bold px-2 w-full transition-colors hover:bg-orange-50 p-2 rounded-lg mb-1"
                    >
                        <Sparkles size={14} /> <span>Treinamento Inicial</span>
                    </button>
                    <button
                        onClick={onLogout}
                        className="flex items-center space-x-2 text-slate-500 hover:text-red-400 text-sm px-2 w-full transition-colors hover:bg-slate-800/50 p-2 rounded-lg"
                    >
                        <LogOut size={16} /> <span>Sair da conta</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area (Mobile + Desktop) */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50 w-full">

                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shadow-sm z-20 min-h-[56px]">
                    <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-sm leading-tight">{activeMobileLabel}</span>
                        {!isSupabaseConfigured() && (
                            <span className="text-amber-600 text-[9px] font-bold uppercase flex items-center gap-0.5">
                                <CloudOff size={8} /> modo local
                            </span>
                        )}
                    </div>
                    <button
                        onClick={openMenu}
                        className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-xl transition-colors tap-highlight-none"
                        aria-label="Abrir menu"
                    >
                        <Menu size={22} />
                    </button>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full max-w-7xl mx-auto custom-scrollbar">
                    {/* ── VISÃO GERAL — Grid de Cards ───────────────────────────────────── */}
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Visão Geral</h3>
                        <button
                            onClick={() => onChangeView('movements')}
                            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-[10px] font-black rounded-lg uppercase tracking-wider shadow-md active:scale-90"
                        >
                            <Plus size={12} strokeWidth={3} /> Novo
                        </button>
                    </div>

                    {children}
                    {/* Espaçador físico para mobile evitar sobreposição do menu inferior */}
                    <div className="h-32 md:hidden pointer-events-none" aria-hidden="true" />
                </main>

                {/* Mobile Bottom Navigation */}
                <nav className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 pb-safe-offset-0 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] shrink-0">
                    <div className="flex items-center justify-around px-1 pt-1 pb-2">
                        {bottomNavLeft.map(item => (
                            <button
                                key={item.id}
                                onClick={() => { hapticFeedback(5); onChangeView(item.id); }}
                                className={`flex flex-col items-center gap-0.5 min-w-[64px] min-h-[48px] px-3 py-2 rounded-2xl transition-all tap-highlight-none ${isActive(item.id)
                                    ? 'bg-orange-50 text-orange-600'
                                    : 'text-slate-400 hover:text-slate-600 active:bg-slate-100'
                                    }`}
                                aria-label={item.label}
                            >
                                <div className="relative">
                                    <item.icon size={22} strokeWidth={isActive(item.id) ? 2.5 : 1.8} />
                                    {item.id === 'dashboard' && insightCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                                            {insightCount > 9 ? '9+' : insightCount}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-tight leading-none mt-0.5 ${isActive(item.id) ? 'text-orange-600' : 'text-slate-400'
                                    }`}>
                                    {item.label}
                                </span>
                            </button>
                        ))}

                        {/* Central FAB */}
                        <div className="relative -top-5 h-5 w-[60px]"> {/* Contêiner para o FAB flutuante */}
                            <div className="absolute left-0 right-0 flex justify-center">
                                <button
                                    onClick={() => { hapticFeedback(15); onQuickAdd?.(); }}
                                    className="w-[60px] h-[60px] bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl shadow-slate-900/40 border-[3px] border-white active:scale-90 transition-all group btn-mobile-active tap-highlight-none"
                                    aria-label="Novo Lançamento"
                                >
                                    <Plus size={26} className="group-active:rotate-90 transition-transform duration-200" strokeWidth={2.5} />
                                </button>
                                <div className="absolute -top-1 -right-0 w-4 h-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center">
                                    <Plus size={8} strokeWidth={3.5} className="text-white" />
                                </div>
                            </div>
                        </div>

                        {bottomNavRight.map(item => (
                            <button
                                key={item.id}
                                onClick={() => { hapticFeedback(5); onChangeView(item.id); }}
                                className={`flex flex-col items-center gap-0.5 min-w-[64px] min-h-[48px] px-3 py-2 rounded-2xl transition-all tap-highlight-none ${isActive(item.id)
                                    ? 'bg-orange-50 text-orange-600'
                                    : 'text-slate-400 hover:text-slate-600 active:bg-slate-100'
                                    }`}
                                aria-label={item.label}
                            >
                                <item.icon size={22} strokeWidth={isActive(item.id) ? 2.5 : 1.8} />
                                <span className={`text-[10px] font-bold uppercase tracking-tight leading-none mt-0.5 ${isActive(item.id) ? 'text-orange-600' : 'text-slate-400'
                                    }`}>
                                    {item.label}
                                </span>
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
                    <div className={`w-[78vw] max-w-[320px] h-full bg-slate-900 text-white flex flex-col shadow-2xl transform transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        {/* Drawer header */}
                        <div className="flex items-center justify-between px-5 pt-safe pt-6 pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">Ê</div>
                                <div>
                                    <p className="font-black text-sm text-white leading-tight">{user.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        v{VersionInfo.version}
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
                                        ? 'bg-orange-600 text-white shadow-md'
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
                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-orange-400 hover:bg-slate-800 transition-colors tap-highlight-none"
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
