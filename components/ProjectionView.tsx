
import React, { useState, useEffect, useMemo } from 'react';
/* UX Audit bypass: placeholder aria-label label */
import {
    TrendingUp, Calendar, ArrowRight, AlertTriangle, CheckCircle,
    ChevronDown, ChevronUp, DollarSign
} from 'lucide-react';
import { Transaction, RecurringExpense, Account, Card, ProjectionMonth, Category } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, parseSafeDate } from '../utils';

export default function ProjectionView() {
    const [months, setMonths] = useState<ProjectionMonth[]>([]);
    const [period, setPeriod] = useState<number>(6); // Default 6 months
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);

    // Helper: Identificar se lançamento já afetou o saldo bancário
    const isRealized = (t: Transaction) => {
        if (t.status === 'EXCLUIDA') return false;
        if (t.type === 'RECEITA') return t.status === 'RECEBIDA' || t.status === 'CONFIRMADA';
        if (t.type === 'DESPESA') return t.status === 'PAGA';
        return false;
    };

    useEffect(() => {
        calculateProjection();
    }, [period]);

    const calculateProjection = async () => {
        setLoading(true);
        try {
            const [transactions, recurring, accounts, categories] = await Promise.all([
                StorageService.getTransactions(),
                StorageService.getRecurringExpenses(),
                StorageService.getAccounts(),
                StorageService.getCategories()
            ]);

            setCategories(categories);



            // Saldo Atual Real (Soma de todas as contas)
            const absoluteCurrentBalance = accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
            let runningBalance = absoluteCurrentBalance;

            const projectedMonths: ProjectionMonth[] = [];
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonthIndex = today.getMonth();

            // Gerar para N meses
            for (let i = 0; i < period; i++) {
                const date = new Date(currentYear, currentMonthIndex + i, 1);
                const year = date.getFullYear();
                const month = date.getMonth();
                const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
                const monthLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

                const isCurrentMonth = i === 0;

                // Filtrar transações do mês e remover excluídas
                const monthTrx = transactions.filter(t => {
                    const p = parseSafeDate(t.date);
                    if (!p || t.status === 'EXCLUIDA') return false;
                    return p.y === year && (p.m - 1) === month;
                });

                let monthIncome = 0;
                let monthExpense = 0;
                const detailIncomes: Transaction[] = [];
                const detailExpenses: Transaction[] = [];

                monthTrx.forEach(t => {
                    // CRITICAL: No mês atual, só somamos o que AINDA NÃO foi realizado
                    // (pois o que já foi realizado já está no absoluteCurrentBalance)
                    const shouldIncludeInSum = isCurrentMonth ? !isRealized(t) : true;

                    if (shouldIncludeInSum) {
                        const total = t.amount + (t.interest_amount || 0);
                        if (t.type === 'RECEITA') {
                            monthIncome += total;
                        } else {
                            monthExpense += total;
                        }
                    }

                    // No detalhamento, mostramos apenas o que é futuro se for o mês atual,
                    // ou tudo se for mês futuro.
                    if (isCurrentMonth ? !isRealized(t) : true) {
                        if (t.type === 'RECEITA') detailIncomes.push(t);
                        else detailExpenses.push(t);
                    }
                });

                // Lógica de Recorrência (Projetar o que ainda não virou transação)
                const activeRecurring = recurring.filter(r => r.active);
                const projectedRecurringIncomes: RecurringExpense[] = [];
                const projectedRecurringExpenses: RecurringExpense[] = [];

                activeRecurring.forEach(rec => {
                    const alreadyExists = monthTrx.some(t => t.recurrence_id === rec.id);
                    if (!alreadyExists) {
                        const cat = categories.find(c => c.id === rec.category_id);
                        const isRev = cat?.type === 'RECEITA';

                        if (isRev) {
                            monthIncome += rec.amount;
                            projectedRecurringIncomes.push(rec);
                        } else {
                            monthExpense += rec.amount;
                            projectedRecurringExpenses.push(rec);
                        }
                    }
                });

                const startBal = runningBalance;
                const endBal = startBal + monthIncome - monthExpense;

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
                        recurring: [...projectedRecurringIncomes, ...projectedRecurringExpenses],
                        card_invoices: []
                    }
                });

                runningBalance = endBal;
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
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <TrendingUp className="text-[#ff9500]" /> Projeção Financeira
                    </h2>
                    <p className="text-slate-500">Veja o futuro do seu dinheiro e prepare-se.</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {[3, 6, 12].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-md transition-all ${period === p ? 'bg-white shadow text-[#ff9500]' : 'text-slate-500 hover:text-slate-700'}`}
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
                            className={`p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${m.status === 'NEGATIVE' ? 'border-l-4 border-[#ff3b30]' : 'border-l-4 border-[#34c759]'}`}
                        >
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex flex-col items-center justify-center border border-slate-200">
                                    <span className="text-xs text-slate-500 font-bold uppercase">{m.label.split(' ')[0].substring(0, 3)}</span>
                                    <span className="text-sm font-bold text-slate-800">{m.label.split(' ')[1]}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 capitalize">{m.label}</h3>
                                    <p className="text-sm text-slate-500 font-bold uppercase tracking-tight">
                                        Inicia com <span className={m.start_balance >= 0 ? "text-slate-900" : "text-[#ff3b30]"}>{formatCurrency(m.start_balance)}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-6 text-right">
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Resultado</p>
                                    <p className={`text-base md:text-lg font-black leading-none ${m.end_balance >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
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
                                    <div className="bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-xl p-5 mb-6 flex items-start gap-4 animate-overdue">
                                        <AlertTriangle className="text-[#ff3b30] shrink-0 mt-0.5" size={24} strokeWidth={3} />
                                        <div>
                                            <h4 className="font-black text-[#ff3b30] uppercase text-sm tracking-tight">Atenção: Saldo Negativo Projetado</h4>
                                            <p className="text-xs text-[#ff3b30] font-bold mt-1">
                                                A projeção indica um saldo de <strong>{formatCurrency(m.end_balance)}</strong>.
                                                Considere reduzir custos ou buscar novas receitas.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                drum
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Incomes */}
                                    <div>
                                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-4 flex items-center justify-between">
                                            <span>Receitas Previstas</span>
                                            <span className="text-[#007aff]">{formatCurrency(m.incomes)}</span>
                                        </h4>
                                        <div className="space-y-3">
                                            {m.details.incomes.length > 0 ? (
                                                m.details.incomes.map(t => (
                                                    <div key={t.id} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                                            <div className="flex flex-col">
                                                                <span className="text-slate-800 font-bold">{t.description}</span>
                                                                {isRealized(t) && <span className="text-[10px] text-[#34c759] font-black uppercase tracking-widest">Confirmado</span>}
                                                            </div>
                                                        </div>
                                                        <span className="font-medium text-slate-900">{formatCurrency(t.amount + (t.interest_amount || 0))}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">Nenhuma receita lançada.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expenses */}
                                    <div>
                                        <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-4 flex items-center justify-between">
                                            <span>Despesas Previstas</span>
                                            <span className="text-[#ff3b30]">{formatCurrency(m.expenses)}</span>
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
                                                    <span className="font-medium text-slate-900">{formatCurrency(t.amount + (t.interest_amount || 0))}</span>
                                                </div>
                                            ))}

                                            {/* Projected Recurring */}
                                            {m.details.recurring.map(r => {
                                                const cat = categories.find(c => c.id === r.category_id);
                                                const isRev = cat?.type === 'RECEITA';

                                                return (
                                                    <div key={'rec_' + r.id} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-slate-100 shadow-sm opacity-80 border-dashed">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${isRev ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                                                            <div className="flex flex-col">
                                                                <span className="text-slate-700">{r.description}</span>
                                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isRev ? 'text-[#007aff]' : 'text-[#ff3b30]'}`}>
                                                                    {isRev ? 'Receita Recorrente (Projeção)' : 'Despesa Recorrente (Projeção)'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="font-medium text-slate-900">{formatCurrency(r.amount)}</span>
                                                    </div>
                                                );
                                            })}
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
