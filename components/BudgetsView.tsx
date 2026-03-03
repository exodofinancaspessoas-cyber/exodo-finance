
import React, { useState, useEffect } from 'react';
import { PieChart, TrendingUp, AlertTriangle, Edit3, Save, X } from 'lucide-react';
import { StorageService } from '../services/storage';
import { Budget, Category, Transaction } from '../types';
import { formatCurrency } from '../utils';
import { hapticFeedback } from './ui/Skeleton';

export default function BudgetsView() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [editingBudget, setEditingBudget] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [bds, cats, trxs] = await Promise.all([
                StorageService.getBudgets(),
                StorageService.getCategories(),
                StorageService.getTransactions()
            ]);
            setBudgets(bds);
            setCategories(cats.filter(c => c.type === 'DESPESA'));
            setTransactions(trxs);
        } catch (error) {
            console.error("Erro ao carregar orçamentos:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateSpent = (categoryId: string) => {
        const now = new Date();
        return transactions
            .filter(t => t.category_id === categoryId && t.type === 'DESPESA' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear())
            .reduce((acc, curr) => acc + curr.amount, 0);
    };

    const handleSaveBudget = async (categoryId: string) => {
        const newBudget: Budget = {
            id: StorageService.generateId(),
            category_id: categoryId,
            amount: editValue,
            alert_80: true,
            alert_100: true
        };
        await StorageService.saveBudget(newBudget);
        setEditingBudget(null);
        await loadData();
    };



    return (
        <div className="animate-in fade-in duration-700 flex flex-col gap-8">
            {/* Header / Summary Card */}
            <div className="ios-glass ios-squircle-md p-8 shadow-xl border flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group" style={{ borderColor: 'var(--ios-glass-border)' }}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff9500]/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-[#ff9500]/10 transition-colors duration-1000"></div>

                <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
                    <div className="w-16 h-16 bg-[#ff9500] text-white ios-squircle flex items-center justify-center shadow-lg shadow-[#ff9500]/20 border border-white/10 shrink-0">
                        <PieChart size={30} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-[var(--ios-text)] tracking-tight leading-none mb-2 uppercase">Orçamentos</h1>
                        <p className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest opacity-60">Planejamento Mensal de Gastos</p>
                    </div>
                </div>

                <div className="flex flex-col items-end relative z-10 w-full md:w-auto px-2">
                    <p className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest mb-1 opacity-50">Total Planejado</p>
                    <p className="text-4xl font-black text-[#ff9500] tracking-tighter drop-shadow-sm">
                        {formatCurrency(budgets.reduce((acc, curr) => acc + curr.amount, 0))}
                    </p>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {categories.map(cat => {
                    const budget = budgets.find(b => b.category_id === cat.id);
                    const spent = calculateSpent(cat.id);
                    const limit = budget ? budget.amount : 0;
                    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                    const isOver = spent > limit && limit > 0;
                    const isWarning = percentage >= 80 && !isOver;

                    if (editingBudget === cat.id) {
                        return (
                            <div key={cat.id} className="ios-glass ios-squircle-md shadow-2xl border-2 border-[#ff9500] p-8 scale-[1.02] z-10 animate-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[#ff9500]/10 text-[#ff9500] ios-squircle flex items-center justify-center font-black">
                                            {cat.name[0]}
                                        </div>
                                        <span className="font-black text-xl text-[var(--ios-text)] uppercase tracking-tight">{cat.name}</span>
                                    </div>
                                    <button
                                        onClick={() => { hapticFeedback(5); setEditingBudget(null); }}
                                        className="w-8 h-8 flex items-center justify-center bg-black/5 text-[var(--ios-text-secondary)] hover:text-[#ff3b30] ios-squircle transition-all"
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest mb-2 pl-1">Novo Limite Mensal</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--ios-text-secondary)]/50">R$</span>
                                            <input
                                                type="number"
                                                autoFocus
                                                className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm pl-10 pr-6 py-4 text-2xl font-black text-[var(--ios-text)] outline-none focus:ring-4 focus:ring-[#ff9500]/10 transition-all shadow-inner"
                                                value={editValue || ''}
                                                onChange={e => setEditValue(Number(e.target.value))}
                                                onFocus={e => e.target.select()}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { hapticFeedback(10); handleSaveBudget(cat.id); }}
                                        className="w-full bg-[#ff9500] hover:bg-[#ff9500]/90 text-white py-4 ios-squircle font-black flex items-center justify-center gap-3 shadow-lg shadow-[#ff9500]/30 transition-all active:scale-95 uppercase text-[10px] tracking-widest border border-white/10"
                                    >
                                        <Save size={18} strokeWidth={2.5} /> Confirmar Teto
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={cat.id} className={`ios-glass ios-squircle-md p-7 border transition-all hover:shadow-xl hover:translate-y-[-4px] group overflow-hidden ${isOver ? 'border-[#ff3b30]/30 bg-[#ff3b30]/5 shadow-[#ff3b30]/5' : isWarning ? 'border-[#ff9501]/30 bg-[#ff9501]/5 shadow-[#ff9501]/5' : ''}`} style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 ios-squircle flex items-center justify-center text-xl font-black border transition-transform group-hover:scale-110 duration-500 shadow-sm ${isOver ? 'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/20' : 'bg-black/5 dark:bg-white/5 text-[var(--ios-text-secondary)] border-[var(--ios-glass-border)]'}`}>
                                        {cat.name[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg text-[var(--ios-text)] uppercase tracking-tight leading-tight">{cat.name}</h3>
                                        {limit > 0 ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                {isOver && <AlertTriangle size={12} className="animated-pulse text-[#ff3b30]" />}
                                                <p className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 ios-squircle border ${isOver ? 'bg-[#ff3b30]/10 border-[#ff3b30]/20 text-[#ff3b30]' : isWarning ? 'bg-[#ff9501]/10 border-[#ff9501]/20 text-[#ff9501]' : 'bg-black/5 dark:bg-white/5 text-[var(--ios-text-secondary)] border-[var(--ios-glass-border)]'}`}>
                                                    {isOver ? `Estourou por ${formatCurrency(Math.abs(limit - spent))}` : `Resta ${formatCurrency(limit - spent)}`}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)] opacity-40 mt-1">Sem limite definido</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => { hapticFeedback(5); setEditingBudget(cat.id); setEditValue(limit); }}
                                    className="w-10 h-10 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 ios-squircle flex items-center justify-center text-[var(--ios-text-secondary)] hover:text-[#ff9500] transition-all border border-transparent hover:border-[#ff9500]/30 shadow-sm"
                                >
                                    <Edit3 size={16} strokeWidth={2.5} />
                                </button>
                            </div>

                            {limit > 0 ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest opacity-50 mb-1">Gasto Atual</span>
                                            <span className={`text-3xl font-black tracking-tighter shadow-sm ${isOver ? 'text-[#ff3b30]' : isWarning ? 'text-[#ff9501]' : 'text-[#34c759]'}`}>
                                                {formatCurrency(spent)}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-black mb-1 uppercase tracking-widest text-[var(--ios-text-secondary)] opacity-40">de {formatCurrency(limit)}</span>
                                    </div>
                                    <div className="w-full bg-black/10 dark:bg-white/5 ios-squircle h-3 overflow-hidden shadow-inner border border-[var(--ios-glass-border)]">
                                        <div
                                            className={`h-full ios-squircle transition-all duration-1000 ease-out ${isOver ? 'bg-gradient-to-r from-[#ff3b30] to-[#ff453a] shadow-[0_0_15px_rgba(255,59,48,0.3)]' : isWarning ? 'bg-gradient-to-r from-[#ff9501] to-[#ffcc00] shadow-[0_0_15px_rgba(255,149,1,0.3)]' : 'bg-gradient-to-r from-[#34c759] to-[#30d158] shadow-[0_0_15px_rgba(52,199,89,0.3)]'}`}
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between items-center px-1">
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isOver ? 'text-[#ff3b30]' : isWarning ? 'text-[#ff9501]' : 'text-[#34c759]'}`}>
                                            {percentage.toFixed(0)}% do orçamento
                                        </span>
                                        {spent > 0 && (
                                            <div className="flex items-center gap-1 text-[9px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest opacity-40">
                                                <TrendingUp size={10} /> {((spent / Math.max(1, spent)) * 100).toFixed(0)}% este mês
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { hapticFeedback(5); setEditingBudget(cat.id); setEditValue(0); }}
                                    className="w-full py-5 border-2 border-dashed border-[var(--ios-glass-border)] ios-squircle text-[10px] tracking-widest uppercase hover:border-[#ff9500]/50 hover:text-[#ff9500] hover:bg-[#ff9500]/5 hover:shadow-lg hover:shadow-[#ff9500]/5 transition-all font-black flex items-center justify-center gap-3 active:scale-95"
                                    style={{ color: 'var(--ios-text-secondary)' }}
                                >
                                    <TrendingUp size={16} strokeWidth={3} /> Definir Teto Mensal
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
