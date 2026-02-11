
import React, { useState, useEffect } from 'react';
import { PieChart, TrendingUp, AlertTriangle, Edit3, Save, X } from 'lucide-react';
import { StorageService } from '../services/storage';
import { Budget, Category, Transaction } from '../types';
import { formatCurrency } from '../utils';

export default function BudgetsView() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [editingBudget, setEditingBudget] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setBudgets(StorageService.getBudgets());
        setCategories(StorageService.getCategories().filter(c => c.type === 'DESPESA'));
        setTransactions(StorageService.getTransactions());
    };

    const calculateSpent = (categoryId: string) => {
        const now = new Date();
        return transactions
            .filter(t => t.category_id === categoryId && t.type === 'DESPESA' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear())
            .reduce((acc, curr) => acc + curr.amount, 0);
    };

    const handleSaveBudget = (categoryId: string) => {
        const newBudget: Budget = {
            id: StorageService.generateId(),
            category_id: categoryId,
            amount: editValue,
            alert_80: true,
            alert_100: true
        };
        StorageService.saveBudget(newBudget);
        setEditingBudget(null);
        loadData();
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <PieChart className="text-pink-500" /> Orçamentos Mensais
                    </h2>
                    <p className="text-slate-500">Defina limites para suas categorias e evite surpresas.</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Total Orçado</p>
                    <p className="text-2xl font-bold text-slate-800">{formatCurrency(budgets.reduce((acc, curr) => acc + curr.amount, 0))}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(cat => {
                    const budget = budgets.find(b => b.category_id === cat.id);
                    const spent = calculateSpent(cat.id);
                    const limit = budget ? budget.amount : 0;
                    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                    const isOver = spent > limit && limit > 0;
                    const isWarning = percentage >= 80 && !isOver;

                    if (editingBudget === cat.id) {
                        return (
                            <div key={cat.id} className="bg-white rounded-xl shadow-lg border-2 border-pink-100 p-6 scale-105 z-10">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-bold text-slate-700 flex items-center gap-2">{cat.name}</span>
                                    <button onClick={() => setEditingBudget(null)}><X size={18} className="text-slate-400 hover:text-red-500" /></button>
                                </div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Limite Mensal</label>
                                <input
                                    type="number"
                                    autoFocus
                                    className="w-full text-2xl font-bold border-b-2 border-pink-500 outline-none pb-1 mb-6 text-slate-800"
                                    value={editValue}
                                    onChange={e => setEditValue(Number(e.target.value))}
                                />
                                <button onClick={() => handleSaveBudget(cat.id)} className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-500/30">
                                    <Save size={18} /> Salvar Orçamento
                                </button>
                            </div>
                        );
                    }

                    return (
                        <div key={cat.id} className={`bg-white rounded-xl p-6 border transition-all hover:shadow-md ${isOver ? 'border-red-200 bg-red-50' : isWarning ? 'border-yellow-200 bg-yellow-50' : 'border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isOver ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {/* Simplified Icon mapping or generic */}
                                        {cat.name[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{cat.name}</h3>
                                        {limit > 0 ? (
                                            <p className={`text-xs font-medium ${isOver ? 'text-red-600' : 'text-slate-500'}`}>
                                                {isOver ? `Estourou ${formatCurrency(spent - limit)}` : `Resta ${formatCurrency(limit - spent)}`}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-slate-400">Sem orçamento definido</p>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => { setEditingBudget(cat.id); setEditValue(limit); }} className="text-slate-300 hover:text-pink-500 transition-colors">
                                    <Edit3 size={16} />
                                </button>
                            </div>

                            {limit > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <span className="text-2xl font-bold text-slate-800">{formatCurrency(spent)}</span>
                                        <span className="text-xs text-slate-400 mb-1">de {formatCurrency(limit)}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${isOver ? 'bg-red-500' : isWarning ? 'bg-yellow-400' : 'bg-green-500'}`}
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => { setEditingBudget(cat.id); setEditValue(0); }} className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50 transition-all font-medium">
                                    + Definir Teto de Gastos
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
