
import React, { useState, useEffect } from 'react';
import {
    Table, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
    Filter, Download, LayoutGrid, List, Calculator, Calendar
} from 'lucide-react';
import { Transaction, RecurringExpense, Category, TransactionType } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, toISODate } from '../utils';

interface MonthColumn {
    key: string; // YYYY-MM
    label: string;
    isPast: boolean;
    isCurrent: boolean;
}

interface RowData {
    categoryId: string;
    categoryName: string;
    type: TransactionType;
    values: Record<string, {
        amount: number;
        isProjected: boolean;
    }>;
}

export default function FluxoCaixaView() {
    const [months, setMonths] = useState<MonthColumn[]>([]);
    const [rows, setRows] = useState<RowData[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'all' | 'receita' | 'despesa'>('all');

    // Period controls
    const [startMonthOffset, setStartMonthOffset] = useState(-1); // Start 1 month ago
    const [numMonths, setNumMonths] = useState(7); // Show 7 months total (1 past + current + 5 future)

    useEffect(() => {
        loadData();
    }, [startMonthOffset, numMonths]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [transactions, recurring, categories] = await Promise.all([
                StorageService.getTransactions(),
                StorageService.getRecurringExpenses(),
                StorageService.getCategories()
            ]);

            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();

            // 1. Generate month columns
            const cols: MonthColumn[] = [];
            for (let i = 0; i < numMonths; i++) {
                const d = new Date(currentYear, currentMonth + startMonthOffset + i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                cols.push({
                    key,
                    label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                    isPast: d < new Date(currentYear, currentMonth, 1),
                    isCurrent: d.getMonth() === currentMonth && d.getFullYear() === currentYear
                });
            }
            setMonths(cols);

            // 2. Prepare rows by category
            const rowMap = new Map<string, RowData>();

            categories.forEach(cat => {
                rowMap.set(cat.id, {
                    categoryId: cat.id,
                    categoryName: cat.name,
                    type: cat.type as TransactionType,
                    values: {}
                });
            });

            // 3. Populate with REAL transactions
            transactions.forEach(t => {
                if (!t.category_id || t.status === 'EXCLUIDA') return;
                const date = new Date(t.date);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                const row = rowMap.get(t.category_id);
                if (row) {
                    if (!row.values[key]) row.values[key] = { amount: 0, isProjected: false };
                    row.values[key].amount += t.amount;
                }
            });

            // 4. Populate with PROJECTED recurring (where no real transaction exists yet for that recurrence_id)
            recurring.forEach(rec => {
                if (!rec.active || !rec.category_id) return;
                const row = rowMap.get(rec.category_id);
                if (!row) return;

                cols.forEach(col => {
                    const [y, m] = col.key.split('-').map(Number);
                    const targetMonthDate = new Date(y, m - 1, 1);

                    // Logic to see if this recurring should appear in this month
                    // Simplified: if freq is MENSAL and it's within start/end dates
                    const startDate = rec.start_date ? new Date(rec.start_date) : new Date(0);
                    const endDate = rec.end_date ? new Date(rec.end_date) : new Date(9999, 11, 31);

                    const isWithinRange = targetMonthDate >= new Date(startDate.getFullYear(), startDate.getMonth(), 1) &&
                        targetMonthDate <= endDate;

                    if (isWithinRange) {
                        // Check if a transaction for this recurrence already exists in this month
                        const alreadyRealized = transactions.some(t => {
                            const tDate = new Date(t.date);
                            const tKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
                            return t.recurrence_id === rec.id && tKey === col.key;
                        });

                        if (!alreadyRealized) {
                            if (!row.values[col.key]) {
                                row.values[col.key] = {
                                    amount: rec.programmed_amount || rec.amount,
                                    isProjected: true
                                };
                            } else if (row.values[col.key].isProjected) {
                                // Add to projection if multiple rules meet here (rare but possible)
                                row.values[col.key].amount += rec.programmed_amount || rec.amount;
                            }
                        }
                    }
                });
            });

            // Convert map to array and filter out empty categories
            const finalRows = Array.from(rowMap.values()).filter(row => {
                return Object.keys(row.values).length > 0;
            }).sort((a, b) => {
                if (a.type !== b.type) return a.type === 'RECEITA' ? -1 : 1;
                return a.categoryName.localeCompare(b.categoryName);
            });

            setRows(finalRows);
        } catch (error) {
            console.error("Erro ao carregar fluxo de caixa:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotal = (monthKey: string, type: TransactionType) => {
        return rows
            .filter(r => r.type === type)
            .reduce((sum, r) => sum + (r.values[monthKey]?.amount || 0), 0);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Table className="text-indigo-600" /> Fluxo de Caixa Mensal
                    </h2>
                    <p className="text-slate-500">Planejamento e comparativo entre o previsto e o realizado.</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                        <button
                            onClick={() => setStartMonthOffset(prev => prev - 1)}
                            className="p-1.5 hover:bg-slate-50 rounded-md text-slate-500 transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="px-3 py-1.5 text-xs font-bold uppercase text-slate-600 flex items-center">
                            Navegar Período
                        </div>
                        <button
                            onClick={() => setStartMonthOffset(prev => prev + 1)}
                            className="p-1.5 hover:bg-slate-50 rounded-md text-slate-500 transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('all')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${viewMode === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                        >
                            Tudo
                        </button>
                        <button
                            onClick={() => setViewMode('receita')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${viewMode === 'receita' ? 'bg-white shadow text-green-600' : 'text-slate-500'}`}
                        >
                            Receitas
                        </button>
                        <button
                            onClick={() => setViewMode('despesa')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${viewMode === 'despesa' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}
                        >
                            Despesas
                        </button>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-slate-200 rounded-sm"></div>
                    <span>Realizado</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border border-dashed border-indigo-300 rounded-sm"></div>
                    <span>Previsto/Estimado</span>
                </div>
            </div>

            {/* Main Table Container */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="sticky left-0 z-20 bg-slate-50 p-4 text-xs font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 min-w-[180px]">
                                Categorias
                            </th>
                            {months.map(col => (
                                <th key={col.key} className={`p-4 text-center text-xs font-black uppercase tracking-widest border-r border-slate-100 last:border-r-0 ${col.isCurrent ? 'bg-indigo-50/50 text-indigo-600' : 'text-slate-500'}`}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {/* RECEITAS SECTION */}
                        {(viewMode === 'all' || viewMode === 'receita') && (
                            <>
                                <tr className="bg-green-50/30">
                                    <td className="sticky left-0 z-10 bg-green-50/80 backdrop-blur-sm p-3 pl-4 text-[10px] font-black text-green-700 uppercase tracking-widest border-r border-green-100">
                                        Entradas
                                    </td>
                                    {months.map(col => (
                                        <td key={col.key} className="p-3 text-center bg-green-50/30 border-r border-green-50 last:border-r-0"></td>
                                    ))}
                                </tr>
                                {rows.filter(r => r.type === 'RECEITA').map(row => (
                                    <tr key={row.categoryId} className="hover:bg-slate-50 transition-colors group">
                                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 p-3 pl-6 text-sm font-bold text-slate-700 border-r border-slate-100 transition-colors">
                                            {row.categoryName}
                                        </td>
                                        {months.map(col => {
                                            const val = row.values[col.key];
                                            return (
                                                <td key={col.key} className={`p-3 text-center border-r border-slate-50 last:border-r-0 ${col.isCurrent ? 'bg-indigo-50/10' : ''}`}>
                                                    {val ? (
                                                        <div className={`inline-block px-2 py-1 rounded text-sm font-bold ${val.isProjected ? 'text-indigo-400 border border-dashed border-indigo-200' : 'text-green-600'}`}>
                                                            {formatCurrency(val.amount)}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-200">—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {/* TOTAL RECEITAS */}
                                <tr className="bg-slate-50/80 font-black">
                                    <td className="sticky left-0 z-10 bg-slate-50/90 p-3 pl-4 text-xs uppercase tracking-widest text-slate-600 border-r border-slate-200">
                                        Total Recebido
                                    </td>
                                    {months.map(col => (
                                        <td key={col.key} className="p-3 text-center text-sm text-green-700 border-r border-slate-100 last:border-r-0">
                                            {formatCurrency(calculateTotal(col.key, 'RECEITA'))}
                                        </td>
                                    ))}
                                </tr>
                            </>
                        )}

                        <tr className="h-4 bg-white"></tr>

                        {/* DESPESAS SECTION */}
                        {(viewMode === 'all' || viewMode === 'despesa') && (
                            <>
                                <tr className="bg-red-50/30">
                                    <td className="sticky left-0 z-10 bg-red-50/80 backdrop-blur-sm p-3 pl-4 text-[10px] font-black text-red-700 uppercase tracking-widest border-r border-red-100">
                                        Saídas
                                    </td>
                                    {months.map(col => (
                                        <td key={col.key} className="p-3 text-center bg-red-50/30 border-r border-red-50 last:border-r-0"></td>
                                    ))}
                                </tr>
                                {rows.filter(r => r.type === 'DESPESA').map(row => (
                                    <tr key={row.categoryId} className="hover:bg-slate-50 transition-colors group">
                                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 p-3 pl-6 text-sm font-bold text-slate-700 border-r border-slate-100 transition-colors">
                                            {row.categoryName}
                                        </td>
                                        {months.map(col => {
                                            const val = row.values[col.key];
                                            return (
                                                <td key={col.key} className={`p-3 text-center border-r border-slate-50 last:border-r-0 ${col.isCurrent ? 'bg-indigo-50/10' : ''}`}>
                                                    {val ? (
                                                        <div className={`inline-block px-2 py-1 rounded text-sm font-bold ${val.isProjected ? 'text-indigo-400 border border-dashed border-indigo-200' : 'text-red-500'}`}>
                                                            {formatCurrency(val.amount)}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-200">—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {/* TOTAL DESPESAS */}
                                <tr className="bg-slate-50/80 font-black">
                                    <td className="sticky left-0 z-10 bg-slate-50/90 p-3 pl-4 text-xs uppercase tracking-widest text-slate-600 border-r border-slate-200">
                                        Total Saídas
                                    </td>
                                    {months.map(col => (
                                        <td key={col.key} className="p-3 text-center text-sm text-red-700 border-r border-slate-100 last:border-r-0">
                                            {formatCurrency(calculateTotal(col.key, 'DESPESA'))}
                                        </td>
                                    ))}
                                </tr>
                            </>
                        )}

                        {/* FINAL BALANCE */}
                        {viewMode === 'all' && (
                            <tr className="bg-slate-900 text-white font-black">
                                <td className="sticky left-0 z-10 bg-slate-900 p-4 pl-4 text-xs uppercase tracking-[0.2em] border-r border-slate-800">
                                    Saldo do Mês
                                </td>
                                {months.map(col => {
                                    const bal = calculateTotal(col.key, 'RECEITA') - calculateTotal(col.key, 'DESPESA');
                                    return (
                                        <td key={col.key} className={`p-4 text-center text-sm border-r border-slate-800 last:border-r-0 ${bal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatCurrency(bal)}
                                        </td>
                                    );
                                })}
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* AI Insights Card */}
            <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                        <Calculator className="text-indigo-400" /> Resumo do Planejamento
                    </h3>
                    <p className="text-indigo-200 text-sm mb-6 max-w-2xl">
                        A tabela acima mostra o que você já gastou (cores sólidas) e o que está programado para o futuro (pontilhado).
                        As projeções são baseadas nos seus lançamentos recorrentes e ajudam a prever se o dinheiro vai sobrar no final de cada mês.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                            <span className="block text-[10px] uppercase font-bold text-indigo-300 mb-1">Total Previsto (Proximos 6 meses)</span>
                            <span className="text-xl font-bold">
                                {formatCurrency(months.filter(m => !m.isPast).reduce((acc, col) => acc + calculateTotal(col.key, 'RECEITA'), 0))}
                            </span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                            <span className="block text-[10px] uppercase font-bold text-indigo-300 mb-1">Gastos Programados</span>
                            <span className="text-xl font-bold">
                                {formatCurrency(months.filter(m => !m.isPast).reduce((acc, col) => acc + calculateTotal(col.key, 'DESPESA'), 0))}
                            </span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                            <span className="block text-[10px] uppercase font-bold text-indigo-300 mb-1">Saldo Final Projetado</span>
                            <span className="text-xl font-bold text-emerald-400">
                                {formatCurrency(months.filter(m => !m.isPast).reduce((acc, col) => acc + (calculateTotal(col.key, 'RECEITA') - calculateTotal(col.key, 'DESPESA')), 0))}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 opacity-10 -translate-y-1/4 translate-x-1/4">
                    <Table size={240} />
                </div>
            </div>
        </div>
    );
}
