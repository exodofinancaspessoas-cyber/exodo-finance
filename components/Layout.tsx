
import React, { useState } from 'react';
import {
    Menu, LogOut, LayoutDashboard, Wallet, CreditCard,
    ArrowRightLeft, User as UserIcon, ArrowDownCircle,
    TrendingUp, Repeat, Target, PieChart, Calculator,
    BarChart3
} from 'lucide-react';
import { User } from '../types';
import { VersionInfo } from '../version';

interface SidebarProps {
    currentView: string;
    onChangeView: (view: string) => void;
    user: User;
    onLogout: () => void;
    children: React.ReactNode;
}

export default function Layout({ currentView, onChangeView, user, onLogout, children }: SidebarProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const detailedMenuItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'accounts', icon: Wallet, label: 'Minhas Contas' },
        { id: 'projection', icon: TrendingUp, label: 'Projeção (Novo)' },
        { id: 'recurring', icon: Repeat, label: 'Recorrentes' },
        { id: 'reports', icon: BarChart3, label: 'Relatórios' },
        { id: 'incomes', icon: Wallet, label: 'Receitas' },
        { id: 'expenses', icon: ArrowDownCircle, label: 'Despesas' },
        { id: 'goals', icon: Target, label: 'Metas' },
        { id: 'budgets', icon: PieChart, label: 'Orçamentos' },
        { id: 'simulator', icon: Calculator, label: 'Simulador' },
        { id: 'cards', icon: CreditCard, label: 'Meus Cartões' },
        { id: 'transfers', icon: ArrowRightLeft, label: 'Transferências' },
    ];

    return (
        <div className="flex h-screen bg-slate-50 relative overflow-hidden font-sans text-slate-900">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800 shrink-0 transition-all duration-300">
                <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">Ê</div>
                    <h1 className="text-xl font-bold tracking-tight">Êxodo Finance</h1>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 space-y-1 px-3">
                    {detailedMenuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onChangeView(item.id)}
                            className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg transition-all duration-200 group
                ${currentView === item.id
                                    ? 'bg-orange-600/90 text-white shadow-lg shadow-orange-900/20 translate-x-1'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }
              `}
                        >
                            <item.icon size={20} className={currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
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
                            <div className="flex items-center space-x-2">
                                <p className="text-xs text-slate-500 truncate">Plano MVP</p>
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                    v{VersionInfo.version}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="px-2 mb-4">
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
                            Último Deploy: {VersionInfo.date}
                        </p>
                    </div>
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
                <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm z-20">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold">Ê</div>
                        <span className="font-bold text-lg text-slate-800">Êxodo</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <Menu size={24} />
                    </button>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full max-w-7xl mx-auto custom-scrollbar">
                    {children}
                </main>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm text-white p-6 animate-fade-in flex flex-col">
                    <div className="flex justify-between items-center mb-10">
                        <span className="font-bold text-2xl tracking-tight">Menu Principal</span>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                        >
                            <LogOut size={24} className="rotate-180" /> {/* Using LogOut icon as Close X replacement or similar */}
                        </button>
                    </div>

                    <nav className="space-y-4 flex-1">
                        {detailedMenuItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => { onChangeView(item.id); setIsMobileMenuOpen(false); }}
                                className={`flex items-center space-x-4 w-full p-4 rounded-xl transition-all
                  ${currentView === item.id ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-300'}
                `}
                            >
                                <item.icon size={24} className={currentView === item.id ? 'text-white' : 'text-slate-500'} />
                                <span className="text-lg font-medium">{item.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="pt-6 border-t border-slate-800">
                        <button
                            onClick={onLogout}
                            className="flex items-center justify-center space-x-3 w-full p-4 rounded-xl bg-slate-800 text-red-400 hover:bg-slate-700 transition-colors font-medium"
                        >
                            <LogOut size={20} /> <span>Sair do App</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
