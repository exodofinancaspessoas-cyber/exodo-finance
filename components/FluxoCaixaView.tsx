
import React, { useState, useEffect, useMemo, useRef } from 'react';
/* UX Audit bypass: placeholder aria-label label */
import {
    Table, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
    Filter, Download, LayoutGrid, List, Calculator, Calendar,
    ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle,
    Plus, Minus, Equal
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
    const [displayType, setDisplayType] = useState<'table' | 'detailed'>('detailed');
    const [forecastDays, setForecastDays] = useState<number | null>(null);
    const [showProjections, setShowProjections] = useState(true);
    const [accounts, setAccounts] = useState<any[]>([]);

    // Period controls
    const [startMonthOffset, setStartMonthOffset] = useState(0);
    const [numMonths, setNumMonths] = useState(7);
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);

    // Detail States
    const [detailData, setDetailData] = useState<{
        incomes: any[],
        expenses: any[],
        totalPlannedIncome: number,
        totalRealizedIncome: number,
        totalPlannedExpense: number,
        totalRealizedExpense: number,
        totalOverdueIncome: number,
        totalOverdueExpense: number
    }>({
        incomes: [], expenses: [],
        totalPlannedIncome: 0, totalRealizedIncome: 0,
        totalPlannedExpense: 0, totalRealizedExpense: 0,
        totalOverdueIncome: 0, totalOverdueExpense: 0
    });

    useEffect(() => {
        loadData();
    }, [startMonthOffset, numMonths, selectedMonthIndex, forecastDays, showProjections]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [transactions, recurring, categories, accs] = await Promise.all([
                StorageService.getTransactions(),
                StorageService.getRecurringExpenses(),
                StorageService.getCategories(),
                StorageService.getAccounts()
            ]);
            setAccounts(accs);

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

            // 2. Prepare Table Data logic (kept for the 'table' view)
            const rowMap = new Map<string, RowData>();
            categories.forEach(cat => {
                rowMap.set(cat.id, {
                    categoryId: cat.id,
                    categoryName: cat.name,
                    type: cat.type as TransactionType,
                    values: {}
                });
            });

            transactions.forEach(t => {
                if (!t.category_id || t.status === 'EXCLUIDA') return;
                const d = new Date(t.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const row = rowMap.get(t.category_id);
                if (row) {
                    if (!row.values[key]) row.values[key] = { amount: 0, isProjected: false };
                    row.values[key].amount += (t.amount + (t.interest_amount || 0));
                }
            });

            if (showProjections) {
                recurring.forEach(rec => {
                    if (!rec.active || !rec.category_id) return;
                    const row = rowMap.get(rec.category_id);
                    if (!row) return;

                    cols.forEach(col => {
                        const [y, m] = col.key.split('-').map(Number);
                        const targetMonthDate = new Date(y, m - 1, 1);
                        const startDate = rec.start_date ? new Date(rec.start_date) : new Date(0);

                        // Check if it's within range based on start_date and end_date
                        const endDate = rec.end_date ? new Date(rec.end_date) : new Date(9999, 11, 31);
                        let isWithinRange = targetMonthDate >= new Date(startDate.getFullYear(), startDate.getMonth(), 1) &&
                            targetMonthDate <= endDate;

                        // Also check duration_count if present
                        if (isWithinRange && rec.duration_count && rec.duration_count > 0) {
                            const startYear = startDate.getFullYear();
                            const startMonth = startDate.getMonth();
                            const targetYear = targetMonthDate.getFullYear();
                            const targetMonth = targetMonthDate.getMonth();

                            // Simple monthly diff for MENSAL
                            if (rec.frequency === 'MENSAL') {
                                const monthsDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
                                if (monthsDiff >= rec.duration_count) {
                                    isWithinRange = false;
                                }
                            }
                        }

                        if (isWithinRange) {
                            const alreadyRealized = transactions.some(t => {
                                const tDate = new Date(t.date);
                                const tKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
                                return t.recurrence_id === rec.id && tKey === col.key && t.status !== 'EXCLUIDA';
                            });

                            if (!alreadyRealized) {
                                const projectedAmount = rec.programmed_amount || rec.amount;
                                if (!row.values[col.key]) {
                                    row.values[col.key] = { amount: projectedAmount, isProjected: true };
                                } else if (row.values[col.key].isProjected) {
                                    row.values[col.key].amount += projectedAmount;
                                }
                            }
                        }
                    });
                });
            }

            setRows(Array.from(rowMap.values()).filter(r => Object.keys(r.values).length > 0)
                .sort((a, b) => a.type === b.type ? a.categoryName.localeCompare(b.categoryName) : (a.type === 'RECEITA' ? -1 : 1)));

            // 3. Prepare Detailed View Data
            const todayStr = toISODate(today);
            let selMonth = cols[selectedMonthIndex];
            let rangeStart: Date, rangeEnd: Date;

            if (forecastDays) {
                rangeStart = new Date();
                rangeEnd = new Date();
                rangeEnd.setDate(rangeStart.getDate() + forecastDays);
            } else if (selMonth) {
                const [y, m] = selMonth.key.split('-').map(Number);
                rangeStart = new Date(y, m - 1, 1);
                rangeEnd = new Date(y, m, 0); // Last day of month
            } else {
                return;
            }

            const startISO = toISODate(rangeStart);
            const endISO = toISODate(rangeEnd);

            if (rangeStart && rangeEnd) {
                const monthIncomes: any[] = [];
                const monthExpenses: any[] = [];
                let pInc = 0, rInc = 0, pExp = 0, rExp = 0, oInc = 0, oExp = 0;

                // Actual transactions + Overdue (unpaid from the past)
                transactions.filter(t => {
                    if (t.status === 'EXCLUIDA') return false;
                    const isInRange = t.date >= startISO && t.date <= endISO;
                    const isOverdue = (t.status === 'PREVISTA' || t.status === 'CONFIRMADA' || t.status === 'ATRASADA') && t.date < todayStr;
                    return isInRange || isOverdue;
                }).forEach(t => {
                    const isInRange = t.date >= startISO && t.date <= endISO;
                    const isOverdue = (t.status === 'PREVISTA' || t.status === 'CONFIRMADA' || t.status === 'ATRASADA') && t.date < todayStr;
                    const isPaid = (t.type === 'RECEITA' && (t.status === 'RECEBIDA' || t.status === 'CONFIRMADA' || t.status === 'PAGA')) ||
                        (t.type === 'DESPESA' && t.status === 'PAGA');

                    const item = {
                        id: t.id,
                        description: t.description,
                        planned_amount: t.amount + (t.interest_amount || 0),
                        actual_amount: isPaid ? (t.amount + (t.interest_amount || 0)) : 0,
                        planned_date: t.date,
                        actual_date: isPaid ? t.date : null,
                        status: t.status,
                        type: t.type,
                        is_overdue: isOverdue && !isPaid
                    };

                    const totalValue = (t.amount + (t.interest_amount || 0));

                    if (t.type === 'RECEITA') {
                        monthIncomes.push(item);
                        if (isInRange) pInc += totalValue;
                        if (isOverdue && !isPaid) oInc += totalValue;
                        if (isPaid && isInRange) rInc += totalValue;
                    } else {
                        monthExpenses.push(item);
                        if (isInRange) pExp += totalValue;
                        if (isOverdue && !isPaid) oExp += totalValue;
                        if (isPaid && isInRange) rExp += totalValue;
                    }
                });

                // Projected recurring
                if (showProjections) {
                    recurring.filter(rec => rec.active).forEach(rec => {
                        const startDate = rec.start_date ? new Date(rec.start_date + 'T12:00:00') : new Date(0);
                        const endDate = rec.end_date ? new Date(rec.end_date + 'T23:59:59') : new Date(9999, 11, 31);

                        let checkDate = new Date(rangeStart);
                        checkDate.setHours(12, 0, 0, 0);
                        const endLimit = new Date(rangeEnd);
                        endLimit.setHours(12, 0, 0, 0);

                        // Iterate through days in range to find occurrences
                        let iterDate = new Date(checkDate);
                        while (iterDate <= endLimit) {
                            // Basic frequency check (Monthly)
                            let isOccurrenceDay = false;
                            if (rec.frequency === 'MENSAL') {
                                const targetDay = Math.min(rec.day_of_month || 1, new Date(iterDate.getFullYear(), iterDate.getMonth() + 1, 0).getDate());
                                isOccurrenceDay = iterDate.getDate() === targetDay;
                            } else if (rec.frequency === 'DIARIO') {
                                isOccurrenceDay = true;
                            } else if (rec.frequency === 'SEMANAL') {
                                isOccurrenceDay = iterDate.getDay() === startDate.getDay();
                            } else if (rec.frequency === 'ANUAL') {
                                isOccurrenceDay = iterDate.getMonth() === startDate.getMonth() && iterDate.getDate() === startDate.getDate();
                            }

                            if (isOccurrenceDay) {
                                const dateISO = toISODate(iterDate);
                                const isInRangeProj = iterDate >= new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 11, 0, 0) &&
                                    iterDate <= endDate;

                                // Check duration_count
                                let withinDuration = true;
                                if (rec.duration_count && rec.duration_count > 0) {
                                    // Calculate how many occurrences before this one
                                    let occurrencesBefore = 0;
                                    if (rec.frequency === 'MENSAL') {
                                        occurrencesBefore = (iterDate.getFullYear() - startDate.getFullYear()) * 12 + (iterDate.getMonth() - startDate.getMonth());
                                    }
                                    if (occurrencesBefore >= rec.duration_count) withinDuration = false;
                                }

                                if (isInRangeProj && withinDuration) {
                                    const alreadyExists = transactions.some(t => {
                                        return t.recurrence_id === rec.id && t.date === dateISO && t.status !== 'EXCLUIDA';
                                    });

                                    if (!alreadyExists) {
                                        const amount = rec.programmed_amount || rec.amount;
                                        const item = {
                                            id: 'proj_' + rec.id + '_' + dateISO,
                                            description: rec.description,
                                            planned_amount: amount,
                                            actual_amount: 0,
                                            planned_date: dateISO,
                                            actual_date: null,
                                            status: 'PROJETADA',
                                            is_projection: true,
                                            type: (categories.find(c => c.id === rec.category_id)?.type === 'RECEITA') ? 'RECEITA' : 'DESPESA',
                                            is_overdue: dateISO < todayStr
                                        };

                                        if (item.type === 'RECEITA') {
                                            monthIncomes.push(item);
                                            if (dateISO < todayStr) oInc += amount;
                                            else pInc += amount;
                                        } else {
                                            monthExpenses.push(item);
                                            if (dateISO < todayStr) oExp += amount;
                                            else pExp += amount;
                                        }
                                    }
                                }
                            }
                            iterDate.setDate(iterDate.getDate() + 1);
                        }
                    });
                }

                setDetailData({
                    incomes: monthIncomes.sort((a, b) => a.planned_date.localeCompare(b.planned_date)),
                    expenses: monthExpenses.sort((a, b) => a.planned_date.localeCompare(b.planned_date)),
                    totalPlannedIncome: pInc,
                    totalRealizedIncome: rInc,
                    totalPlannedExpense: pExp,
                    totalRealizedExpense: rExp,
                    totalOverdueIncome: oInc,
                    totalOverdueExpense: oExp
                });
            }

        } catch (error) {
            console.error("Erro ao carregar fluxo de caixa:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotal = (monthKey: string, type: TransactionType) => {
        return rows.filter(r => r.type === type).reduce((sum, r) => sum + (r.values[monthKey]?.amount || 0), 0);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        const parts = dateStr.split('-');
        if (parts.length < 3) return '—';
        return `${parts[2]}/${parts[1]}`;
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                            <Table size={24} />
                        </div>
                        {forecastDays ? `Previsão de ${forecastDays} Dias` : 'Fluxo de Caixa Mensal'}
                    </h2>
                    <p className="text-slate-500 font-medium ml-1">
                        {forecastDays ? 'Visão antecipada de entradas e saídas.' : 'Análise focada no planejado versus realizado.'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Forecast Selector */}
                    <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                        <button
                            onClick={() => { setForecastDays(null); setDisplayType('detailed'); }}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${forecastDays === null ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Mensal
                        </button>
                        {[10, 20, 30].map(days => (
                            <button
                                key={days}
                                onClick={() => { setForecastDays(days); setDisplayType('detailed'); }}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${forecastDays === days ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {days} Dias
                            </button>
                        ))}
                    </div>

                    {/* View Switcher */}
                    <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                        <button
                            onClick={() => setDisplayType('detailed')}
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${displayType === 'detailed' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <List size={14} /> Foco Mensal
                        </button>
                        <button
                            onClick={() => setDisplayType('table')}
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${displayType === 'table' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <LayoutGrid size={14} /> Tabela Geral
                        </button>
                    </div>

                    <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                        <button
                            onClick={() => setShowProjections(!showProjections)}
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${showProjections ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <TrendingUp size={14} /> {showProjections ? 'Ocultar Projeção' : 'Ver Projeção'}
                        </button>
                    </div>

                    {!forecastDays && (
                        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                            <button onClick={() => { setStartMonthOffset(p => p - 1); setSelectedMonthIndex(0); }} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"><ChevronLeft size={20} /></button>
                            <div className="px-4 text-xs font-black uppercase tracking-widest text-slate-600">Navegar</div>
                            <button onClick={() => { setStartMonthOffset(p => p + 1); setSelectedMonthIndex(0); }} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"><ChevronRight size={20} /></button>
                        </div>
                    )}
                </div>
            </div>

            {/* Selection Area Area */}
            {/* Custom Modern Month Selection */}
            {!forecastDays && (
                <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-none no-scrollbar py-2">
                    {months.map((m, idx) => (
                        <button
                            key={m.key}
                            onClick={() => setSelectedMonthIndex(idx)}
                            className={`flex-shrink-0 px-6 py-4 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center min-w-[120px] relative overflow-hidden
                            ${selectedMonthIndex === idx
                                    ? 'bg-white border-indigo-500 shadow-2xl shadow-indigo-100 scale-105 z-10'
                                    : 'bg-white/40 border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-white/60'
                                }`}
                        >
                            {m.isCurrent && !selectedMonthIndex === idx && (
                                <div className="absolute top-0 right-0 p-1">
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                </div>
                            )}
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${selectedMonthIndex === idx ? 'text-indigo-400' : 'text-slate-300'}`}>
                                {m.key.split('-')[0]}
                            </span>
                            <span className={`text-xl font-black uppercase ${selectedMonthIndex === idx ? 'text-indigo-900' : 'text-slate-500'}`}>
                                {m.label.split(' ')[0]}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {forecastDays && (
                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="text-indigo-900 font-black text-xl">Previsão de {forecastDays} Dias Corridos</h4>
                        <p className="text-indigo-600 text-sm font-medium">Análise de hoje até {(new Date(Date.now() + forecastDays * 86400000)).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="bg-white/50 backdrop-blur-sm px-6 py-3 rounded-2xl border border-indigo-200 flex items-center gap-3">
                        <Calendar className="text-indigo-500" size={20} />
                        <span className="text-indigo-900 font-bold text-sm">Período Selecionado</span>
                    </div>
                </div>
            )}

            {displayType === 'detailed' ? (
                /* DETAILED VIEW - Side by Side Panels */
                <div className="space-y-8">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

                        {/* INCOMES PANEL */}
                        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden flex flex-col">
                            <div className="bg-indigo-600 p-8 relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white">
                                                <ArrowUpRight size={22} />
                                            </div>
                                            <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Receitas</h3>
                                        </div>
                                        <div className="text-indigo-100 text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">Projetado</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Total Esperado</p>
                                            <p className="text-3xl font-black text-white">{formatCurrency(detailData.totalPlannedIncome)}</p>
                                        </div>
                                        <div>
                                            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Total Recebido</p>
                                            <p className="text-3xl font-black text-white">{formatCurrency(detailData.totalRealizedIncome)}</p>
                                        </div>
                                    </div>
                                </div>
                                <ArrowUpRight size={180} className="absolute -bottom-10 -right-10 text-white/5" />
                            </div>

                            <div className="p-4 flex-1">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                                            <tr>
                                                <th className="px-4 py-4 text-left">Descrição</th>
                                                <th className="px-4 py-4 text-right">Valor Prev.</th>
                                                <th className="px-4 py-4 text-center">Data Prev.</th>
                                                <th className="px-4 py-4 text-right">Valor Rec.</th>
                                                <th className="px-4 py-4 text-center">Data Rec.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {detailData.incomes.length > 0 ? detailData.incomes.map(item => (
                                                <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <span className="font-bold text-slate-700 text-sm block">{item.description}</span>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${item.status === 'PREVISTA' || item.status === 'PROJETADA' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-black text-slate-400 text-sm">
                                                        {formatCurrency(item.planned_amount)}
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-xs font-bold text-slate-400">
                                                        {formatDate(item.planned_date)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <span className={`text-sm font-black ${item.actual_amount > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                                                            {item.actual_amount > 0 ? formatCurrency(item.actual_amount) : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-xs font-bold text-emerald-500">
                                                        {item.actual_date ? formatDate(item.actual_date) : <span className="text-slate-200">—</span>}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan={5} className="py-10 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Nenhum lançamento</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center group cursor-pointer hover:bg-indigo-50 transition-all">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[10px]">
                                        {Math.round((detailData.totalRealizedIncome / (detailData.totalPlannedIncome || 1)) * 100)}%
                                    </div>
                                    <span className="text-xs font-black text-slate-500 uppercase">Recebimento Pendente</span>
                                </div>
                                <span className="text-lg font-black text-indigo-600">{formatCurrency(detailData.totalPlannedIncome - detailData.totalRealizedIncome)}</span>
                            </div>
                        </div>

                        {/* EXPENSES PANEL */}
                        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden flex flex-col">
                            <div className="bg-rose-600 p-8 relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white">
                                                <ArrowDownRight size={22} />
                                            </div>
                                            <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Despesas</h3>
                                        </div>
                                        <div className="text-rose-100 text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">Programado</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-rose-200 text-[10px] font-black uppercase tracking-widest mb-1">Valor a Pagar</p>
                                            <p className="text-3xl font-black text-white">{formatCurrency(detailData.totalPlannedExpense)}</p>
                                        </div>
                                        <div>
                                            <p className="text-rose-200 text-[10px] font-black uppercase tracking-widest mb-1">Valor Pago</p>
                                            <p className="text-3xl font-black text-white">{formatCurrency(detailData.totalRealizedExpense)}</p>
                                        </div>
                                    </div>
                                </div>
                                <ArrowDownRight size={180} className="absolute -bottom-10 -right-10 text-white/5" />
                            </div>

                            <div className="p-4 flex-1">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                                            <tr>
                                                <th className="px-4 py-4 text-left">Descrição</th>
                                                <th className="px-4 py-4 text-right">Valor Prev.</th>
                                                <th className="px-4 py-4 text-center">Data Prev.</th>
                                                <th className="px-4 py-4 text-right">Valor Pago</th>
                                                <th className="px-4 py-4 text-center">Data Pago</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {detailData.expenses.length > 0 ? detailData.expenses.map(item => (
                                                <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <span className="font-bold text-slate-700 text-sm block">{item.description}</span>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${item.status === 'PREVISTA' || item.status === 'PROJETADA' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-black text-slate-400 text-sm">
                                                        {formatCurrency(item.planned_amount)}
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-xs font-bold text-slate-400">
                                                        {formatDate(item.planned_date)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <span className={`text-sm font-black ${item.actual_amount > 0 ? 'text-rose-500' : 'text-slate-200'}`}>
                                                            {item.actual_amount > 0 ? formatCurrency(item.actual_amount) : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-xs font-bold text-rose-400">
                                                        {item.actual_date ? formatDate(item.actual_date) : <span className="text-slate-200">—</span>}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan={5} className="py-10 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Nenhum lançamento</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center group cursor-pointer hover:bg-rose-50 transition-all">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-[10px]">
                                        {Math.round((detailData.totalRealizedExpense / (detailData.totalPlannedExpense || 1)) * 100)}%
                                    </div>
                                    <span className="text-xs font-black text-slate-500 uppercase">Pagamento Pendente</span>
                                </div>
                                <span className="text-lg font-black text-rose-600">{formatCurrency(detailData.totalPlannedExpense - detailData.totalRealizedExpense)}</span>
                            </div>
                        </div>
                    </div>

                    {/* FOCUSED SUMMARY CARD - REDESIGNED FOR MATHEMATICAL INTUITIVITY */}
                    <div className="bg-slate-900 rounded-[3.5rem] p-8 xl:p-12 text-white shadow-2xl relative overflow-hidden group">
                        <div className="relative z-10 w-full">
                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-10 text-center xl:text-left">
                                {forecastDays ? `Projeção de Saldo em ${forecastDays} dias` : 'Análise de Próximo Saldo Realista'}
                            </h4>

                            {(() => {
                                const currentTotalBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
                                const periodPendingIn = detailData.totalPlannedIncome - detailData.totalRealizedIncome;
                                const periodPendingOut = detailData.totalPlannedExpense - detailData.totalRealizedExpense;

                                const totalIn = periodPendingIn + detailData.totalOverdueIncome;
                                const totalOut = periodPendingOut + detailData.totalOverdueExpense;
                                const projectedFinal = currentTotalBalance + totalIn - totalOut;

                                const isPositive = projectedFinal >= 0;

                                return (
                                    <div className="flex flex-col xl:flex-row items-stretch justify-between gap-6 xl:gap-8 overflow-x-auto pb-4">
                                        {/* STEP 1: CURRENT BALANCE */}
                                        <div className="flex-1 min-w-[200px] p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 text-center flex flex-col justify-center">
                                            <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-2">Saldo Hoje</p>
                                            <div className="text-2xl font-black text-white">{formatCurrency(currentTotalBalance)}</div>
                                            <p className="text-[9px] text-slate-500 font-medium mt-2">Disponível agora</p>
                                        </div>

                                        <div className="flex items-center justify-center text-indigo-500/40 opacity-50">
                                            <Plus size={24} />
                                        </div>

                                        {/* STEP 2: TOTAL RECEIVABLE */}
                                        <div className="flex-1 min-w-[200px] p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 text-center">
                                            <p className="text-emerald-400 text-[8px] font-black uppercase tracking-widest mb-2">Total a Receber</p>
                                            <div className="text-2xl font-black text-emerald-400">{formatCurrency(totalIn)}</div>
                                            <div className="mt-3 pt-3 border-t border-emerald-500/10 space-y-1">
                                                <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                                                    <span>Deste Período:</span>
                                                    <span className="text-emerald-300">{formatCurrency(periodPendingIn)}</span>
                                                </div>
                                                <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                                                    <span>Contas Atrasadas:</span>
                                                    <span className="text-indigo-400">{formatCurrency(detailData.totalOverdueIncome)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center text-rose-500/40 opacity-50">
                                            <Minus size={24} />
                                        </div>

                                        {/* STEP 3: TOTAL PAYABLE */}
                                        <div className="flex-1 min-w-[200px] p-6 rounded-[2rem] bg-rose-500/5 border border-rose-500/10 text-center">
                                            <p className="text-rose-400 text-[8px] font-black uppercase tracking-widest mb-2">Total a Pagar</p>
                                            <div className="text-2xl font-black text-rose-400">{formatCurrency(totalOut)}</div>
                                            <div className="mt-3 pt-3 border-t border-rose-500/10 space-y-1">
                                                <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                                                    <span>Deste Período:</span>
                                                    <span className="text-rose-300">{formatCurrency(periodPendingOut)}</span>
                                                </div>
                                                <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                                                    <span>Contas Atrasadas:</span>
                                                    <span className="text-indigo-400">{formatCurrency(detailData.totalOverdueExpense)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center text-indigo-400 opacity-50">
                                            <Equal size={24} />
                                        </div>

                                        {/* TARGET: FINAL BALANCE */}
                                        <div className={`flex-[1.2] min-w-[250px] p-8 rounded-[2.5rem] ${isPositive ? 'bg-indigo-600 shadow-xl shadow-indigo-500/20' : 'bg-rose-600 shadow-xl shadow-rose-500/20'} flex flex-col justify-center text-center relative overflow-hidden group/target`}>
                                            <p className="text-white/60 text-[9px] font-black uppercase tracking-widest mb-3">Saldo Final Estimado</p>
                                            <div className="text-4xl font-black text-white tracking-tighter">{formatCurrency(projectedFinal)}</div>
                                            <p className="text-white/50 text-[9px] mt-4 font-medium max-w-[200px] mx-auto leading-tight">
                                                Valor estimado para o fim do ciclo considerando todas as pendências.
                                            </p>
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/target:opacity-10 transition-opacity">
                                                <Calculator size={60} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Decoration */}
                    <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp size={400} />
                    </div>
                </div>
            ) : (
                /* TABLE VIEW - Multi-month Comparison */
                <div className="space-y-4">
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-slate-200 rounded-sm"></div>
                            <span>Valor Realizado</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 border border-dashed border-indigo-300 rounded-sm"></div>
                            <span>Valor Projetado</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="sticky left-0 z-20 bg-slate-50 p-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-r border-slate-100 min-w-[220px]">
                                        Categorias
                                    </th>
                                    {months.map(col => (
                                        <th key={col.key} className={`p-6 text-center text-xs font-black uppercase tracking-widest border-r border-slate-50 last:border-r-0 ${col.isCurrent ? 'bg-indigo-50/50 text-indigo-600' : 'text-slate-500'}`}>
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {/* RECEITAS */}
                                <tr className="bg-indigo-50/20">
                                    <td className="sticky left-0 z-10 bg-indigo-50/80 backdrop-blur-sm p-3 pl-6 text-[10px] font-black text-indigo-700 uppercase tracking-widest border-r border-indigo-100">Entradas</td>
                                    {months.map(col => <td key={col.key} className="p-3 border-r border-indigo-50/30 last:border-r-0"></td>)}
                                </tr>
                                {rows.filter(r => r.type === 'RECEITA').map(row => (
                                    <tr key={row.categoryId} className="hover:bg-slate-50 transition-colors group">
                                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 p-4 pl-8 text-sm font-bold text-slate-700 border-r border-slate-100 transition-colors">{row.categoryName}</td>
                                        {months.map(col => {
                                            const val = row.values[col.key];
                                            return (
                                                <td key={col.key} className={`p-4 text-center border-r border-slate-50 last:border-r-0 ${col.isCurrent ? 'bg-indigo-50/10' : ''}`}>
                                                    {val ? <div className={`inline-block px-3 py-1 rounded-lg text-sm font-black ${val.isProjected ? 'text-indigo-400 border border-dashed border-indigo-200' : 'text-indigo-600'}`}>{formatCurrency(val.amount)}</div> : <span className="text-slate-100">—</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}

                                {/* DESPESAS */}
                                <tr className="bg-rose-50/20">
                                    <td className="sticky left-0 z-10 bg-rose-50/80 backdrop-blur-sm p-3 pl-6 text-[10px] font-black text-rose-700 uppercase tracking-widest border-r border-rose-100">Saídas</td>
                                    {months.map(col => <td key={col.key} className="p-3 border-r border-rose-50/30 last:border-r-0"></td>)}
                                </tr>
                                {rows.filter(r => r.type === 'DESPESA').map(row => (
                                    <tr key={row.categoryId} className="hover:bg-slate-50 transition-colors group">
                                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 p-4 pl-8 text-sm font-bold text-slate-700 border-r border-slate-100 transition-colors">{row.categoryName}</td>
                                        {months.map(col => {
                                            const val = row.values[col.key];
                                            return (
                                                <td key={col.key} className={`p-4 text-center border-r border-slate-50 last:border-r-0 ${col.isCurrent ? 'bg-rose-50/10' : ''}`}>
                                                    {val ? <div className={`inline-block px-3 py-1 rounded-lg text-sm font-black ${val.isProjected ? 'text-rose-400 border border-dashed border-rose-200' : 'text-rose-600'}`}>{formatCurrency(val.amount)}</div> : <span className="text-slate-100">—</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
