
import React, { useState, useEffect } from 'react';
import {
    TrendingUp, Calendar, ArrowRight, AlertTriangle, CheckCircle,
    ChevronDown, ChevronUp, DollarSign
} from 'lucide-react';
import { Transaction, RecurringExpense, Account, Card, ProjectionMonth } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';

export default function ProjectionView() {
    const [months, setMonths] = useState<ProjectionMonth[]>([]);
    const [period, setPeriod] = useState<number>(6); // Default 6 months
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        calculateProjection();
    }, [period]);

    const calculateProjection = async () => {
        setLoading(true);
        try {
            const [transactions, recurring, accounts] = await Promise.all([
                StorageService.getTransactions(),
                StorageService.getRecurringExpenses(),
                StorageService.getAccounts()
            ]);

            // Initial Balance (Sum of all accounts)
            let currentBalance = accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

            const projectedMonths: ProjectionMonth[] = [];
            const today = new Date();

            // Generate for N months
            for (let i = 0; i < period; i++) {
                const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

                // Filter transactions for this month
                const monthTrx = transactions.filter(t => {
                    const tDate = new Date(t.date);
                    return tDate.getMonth() === date.getMonth() && tDate.getFullYear() === date.getFullYear();
                });

                let monthIncome = 0;
                let monthExpense = 0;
                const detailIncomes: Transaction[] = [];
                const detailExpenses: Transaction[] = [];

                monthTrx.forEach(t => {
                    if (t.type === 'RECEITA') {
                        monthIncome += t.amount;
                        detailIncomes.push(t);
                    } else {
                        monthExpense += t.amount;
                        detailExpenses.push(t);
                    }
                });

                const activeRecurring = recurring.filter(r => r.active);
                const projectedRecurring: RecurringExpense[] = [];

                activeRecurring.forEach(rec => {
                    const alreadyExists = monthTrx.some(t => t.recurrence_id === rec.id);
                    if (!alreadyExists) {
                        monthExpense += rec.amount;
                        projectedRecurring.push(rec);
                    }
                });

                const startBal = currentBalance;
                const endBal = startBal + monthIncome - monthExpense;
                currentBalance = endBal;

                projectedMonths.push({
                    month: monthKey,
                    label: monthLabel,
                    start_balance: startBal,
                    end_balance: endBal,
                    incomes: monthIncome,
                    expenses: monthExpense,
                    status: endBal >= 0 ? 'POSITIVE' : 'NEGATIVE',
                    details: {
                        incomes: detailIncomes,
                        expenses: detailExpenses,
                        recurring: projectedRecurring,
                        card_invoices: []
                    }
                });
            }

            setMonths(projectedMonths);
        } catch (error) {
            console.error("Erro na projeção:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleMonth = (month: string) => {
        if (expandedMonth === month) setExpandedMonth(null);
        else setExpandedMonth(month);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="text-purple-600" /> Projeção Financeira
                    </h2>
                    <p className="text-slate-500">Veja o futuro do seu dinheiro e prepare-se.</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {[3, 6, 12].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${period === p ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {p} Meses
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                {months.map((m, index) => (
                    <div key={m.month} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
                        {/* Header Card */}
                        <div
                            onClick={() => toggleMonth(m.month)}
                            className={`p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${m.status === 'NEGATIVE' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-green-500'}`}
                        >
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex flex-col items-center justify-center border border-slate-200">
                                    <span className="text-xs text-slate-500 font-bold uppercase">{m.label.split(' ')[0].substring(0, 3)}</span>
                                    <span className="text-sm font-bold text-slate-800">{m.label.split(' ')[1]}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 capitalize">{m.label}</h3>
                                    <p className="text-sm text-slate-500">
                                        Inicia com <span className={m.start_balance >= 0 ? "text-slate-700" : "text-red-500"}>{formatCurrency(m.start_balance)}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-6 text-right">
                                <div className="hidden md:block">
                                    <p className="text-xs text-slate-400 font-medium uppercase">Resultado Previsto</p>
                                    <p className={`text-lg font-bold ${m.end_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(m.end_balance)}
                                    </p>
                                </div>
                                {expandedMonth === m.month ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedMonth === m.month && (
                            <div className="border-t border-slate-100 bg-slate-50/50 p-6 animate-fade-in">

                                {/* Alert Message */}
                                {m.status === 'NEGATIVE' && (
                                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6 flex items-start gap-3">
                                        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                                        <div>
                                            <h4 className="font-bold text-red-800">Atenção: Saldo Negativo Projetado</h4>
                                            <p className="text-sm text-red-700 mt-1">
                                                Você deve encerrar este mês devendo <strong>{formatCurrency(m.end_balance)}</strong>.
                                                Considere reduzir despesas ou antecipar receitas.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Incomes */}
                                    <div>
                                        <h4 className="font-bold text-slate-700 mb-4 flex items-center justify-between">
                                            <span>Receitas Previstas</span>
                                            <span className="text-green-600">{formatCurrency(m.incomes)}</span>
                                        </h4>
                                        <div className="space-y-3">
                                            {m.details.incomes.length > 0 ? (
                                                m.details.incomes.map(t => (
                                                    <div key={t.id} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                                            <span className="text-slate-700">{t.description}</span>
                                                        </div>
                                                        <span className="font-medium text-slate-900">{formatCurrency(t.amount)}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">Nenhuma receita lançada.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expenses */}
                                    <div>
                                        <h4 className="font-bold text-slate-700 mb-4 flex items-center justify-between">
                                            <span>Despesas Previstas</span>
                                            <span className="text-red-600">{formatCurrency(m.expenses)}</span>
                                        </h4>
                                        <div className="space-y-3">
                                            {/* Transactions */}
                                            {m.details.expenses.map(t => (
                                                <div key={t.id} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-700">{t.description}</span>
                                                            {t.installments && <span className="text-xs text-slate-400">Parcela {t.installments.current}/{t.installments.total}</span>}
                                                        </div>
                                                    </div>
                                                    <span className="font-medium text-slate-900">{formatCurrency(t.amount)}</span>
                                                </div>
                                            ))}

                                            {/* Projected Recurring */}
                                            {m.details.recurring.map(r => (
                                                <div key={'rec_' + r.id} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-slate-100 shadow-sm opacity-80 border-dashed">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-700">{r.description}</span>
                                                            <span className="text-xs text-purple-500 font-medium">Recorrente (Previsto)</span>
                                                        </div>
                                                    </div>
                                                    <span className="font-medium text-slate-900">{formatCurrency(r.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
