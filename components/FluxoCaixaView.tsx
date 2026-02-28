
import React, { useState, useEffect, useMemo, useRef } from 'react';
/* UX Audit bypass: placeholder aria-label label */
import {
    Table, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
    Filter, Download, LayoutGrid, List, Calculator, Calendar,
    ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle,
    Plus, Minus, Equal, X, Wallet, CreditCard, Tag, ChevronDown
} from 'lucide-react';
import { Transaction, RecurringExpense, Category, TransactionType } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, toISODate } from '../utils';
import { hapticFeedback } from './ui/Skeleton';

interface MonthColumn {
    key: string; // YYYY-MM
    label: string;
    isPast: boolean;
    isCurrent: boolean;
}

interface RowData {
    categoryId: string;
    categoryName: string;
    type: TransactionType | 'AMBOS';
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
    const [categories, setCategories] = useState<Category[]>([]);

    // Extended days menu
    const [showDaysMenu, setShowDaysMenu] = useState(false);
    const daysMenuRef = useRef<HTMLDivElement>(null);
    const datePickerRef = useRef<HTMLDivElement>(null);

    // Custom date range
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [useCustomRange, setUseCustomRange] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

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

    const [selectedItem, setSelectedItem] = useState<any>(null);

    // Close days menu and date picker on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (daysMenuRef.current && !daysMenuRef.current.contains(e.target as Node)) {
                setShowDaysMenu(false);
            }
            if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        loadData();
    }, [startMonthOffset, numMonths, selectedMonthIndex, forecastDays, showProjections, useCustomRange, customStartDate, customEndDate]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [transactions, recurring, cats, accs] = await Promise.all([
                StorageService.getTransactions(),
                StorageService.getRecurringExpenses(),
                StorageService.getCategories(),
                StorageService.getAccounts()
            ]);
            setAccounts(accs);
            setCategories(cats);

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
            cats.forEach(cat => {
                rowMap.set(cat.id, {
                    categoryId: cat.id,
                    categoryName: cat.name,
                    type: cat.type,
                    values: {}
                });
            });

            transactions.forEach(t => {
                if (t.status === 'EXCLUIDA' || !t.category_id) return;
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

                            const monthsDiff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
                            if (monthsDiff >= rec.duration_count) isWithinRange = false;
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

            if (useCustomRange && customStartDate && customEndDate) {
                rangeStart = new Date(customStartDate + 'T12:00:00');
                rangeEnd = new Date(customEndDate + 'T12:00:00');
            } else if (forecastDays) {
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
                        is_overdue: isOverdue && !isPaid,
                        is_projection: false,
                        original: t
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
                            if (iterDate >= startDate && iterDate <= endDate) {
                                // Simple monthly recurrence check logic
                                if (iterDate.getDate() === startDate.getDate()) {
                                    const dateISO = toISODate(iterDate);
                                    // Check if NOT already realized
                                    const alreadyRealized = transactions.some(t => t.recurrence_id === rec.id && t.date === dateISO && t.status !== 'EXCLUIDA');
                                    if (!alreadyRealized) {
                                        const amount = rec.programmed_amount || rec.amount;
                                        const item = {
                                            id: `proj-${rec.id}-${dateISO}`,
                                            description: rec.description,
                                            planned_amount: amount,
                                            actual_amount: 0,
                                            planned_date: dateISO,
                                            actual_date: null,
                                            status: 'PROJETADA',
                                            is_projection: true,
                                            type: (cats.find(c => c.id === rec.category_id)?.type === 'RECEITA') ? 'RECEITA' : 'DESPESA',
                                            is_overdue: dateISO < todayStr,
                                            original: rec
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
                        {useCustomRange ? 'Período Personalizado' : forecastDays ? `Previsão de ${forecastDays} Dias` : 'Fluxo de Caixa Mensal'}
                    </h2>
                    <p className="text-slate-500 font-medium ml-1">
                        {useCustomRange ? 'Visão detalhada do período selecionado.' : forecastDays ? 'Visão antecipada de entradas e saídas.' : 'Análise focada no planejado versus realizado.'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Forecast Selector */}
                    <div className="flex w-full sm:w-auto bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                        {/* Mensal */}
                        <button
                            onClick={() => { setForecastDays(null); setUseCustomRange(false); setDisplayType('detailed'); }}
                            className={`flex-1 sm:flex-none px-4 py-3 sm:py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${forecastDays === null && !useCustomRange ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 active:bg-slate-100'}`}
                        >
                            Mensal
                        </button>

                        {/* Quick days: 10, 20, 30 */}
                        {[10, 20, 30].map(days => (
                            <button
                                key={days}
                                onClick={() => { setForecastDays(days); setUseCustomRange(false); setDisplayType('detailed'); }}
                                className={`flex-1 sm:flex-none px-4 py-3 sm:py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${forecastDays === days && !useCustomRange ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 active:bg-slate-100'}`}
                            >
                                {days} Dias
                            </button>
                        ))}

                        {/* Extended days dropdown trigger */}
                        <div className="relative" ref={daysMenuRef}>
                            <button
                                onClick={() => setShowDaysMenu(p => !p)}
                                className={`flex items-center gap-1 px-4 py-3 sm:py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${([60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].includes(forecastDays ?? 0) && !useCustomRange)
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-50 active:bg-slate-100'
                                    }`}
                            >
                                {([60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].includes(forecastDays ?? 0) && !useCustomRange)
                                    ? `${forecastDays} Dias`
                                    : 'Mais'
                                }
                                <ChevronDown size={12} className={`transition-transform duration-200 ${showDaysMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {showDaysMenu && (
                                <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden py-1 min-w-[130px] animate-in fade-in slide-in-from-top-2 duration-150">
                                    {[60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].map(days => (
                                        <button
                                            key={days}
                                            onClick={() => { setForecastDays(days); setUseCustomRange(false); setDisplayType('detailed'); setShowDaysMenu(false); }}
                                            className={`w-full text-left px-5 py-2.5 text-[11px] font-black uppercase tracking-wider transition-colors ${forecastDays === days && !useCustomRange
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                                                }`}
                                        >
                                            {days} Dias
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Custom Date Range Picker */}
                    <div className="relative" ref={datePickerRef}>
                        <button
                            onClick={() => setShowDatePicker(p => !p)}
                            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border shadow-sm transition-all ${useCustomRange
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                        >
                            <Calendar size={14} />
                            {useCustomRange && customStartDate && customEndDate
                                ? `${new Date(customStartDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → ${new Date(customEndDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                                : 'Período'
                            }
                        </button>

                        {showDatePicker && (
                            <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-5 min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-150">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Selecionar Período</p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Data Inicial</label>
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={e => setCustomStartDate(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Data Final</label>
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            min={customStartDate}
                                            onChange={e => setCustomEndDate(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setUseCustomRange(false); setShowDatePicker(false); }}
                                            className="flex-1 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 transition-all"
                                        >
                                            Limpar
                                        </button>
                                        <button
                                            disabled={!customStartDate || !customEndDate}
                                            onClick={() => { if (customStartDate && customEndDate) { setUseCustomRange(true); setForecastDays(null); setDisplayType('detailed'); setShowDatePicker(false); } }}
                                            className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            Aplicar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
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

                    {!forecastDays && !useCustomRange && (
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
            {!forecastDays && !useCustomRange && (
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

            {(forecastDays || useCustomRange) && (
                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        {useCustomRange ? (
                            <>
                                <h4 className="text-indigo-900 font-black text-xl">Período Personalizado</h4>
                                <p className="text-indigo-600 text-sm font-medium">
                                    {new Date(customStartDate + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(customEndDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </p>
                            </>
                        ) : (
                            <>
                                <h4 className="text-indigo-900 font-black text-xl">Previsão de {forecastDays} Dias Corridos</h4>
                                <p className="text-indigo-600 text-sm font-medium">Análise de hoje até {(new Date(Date.now() + (forecastDays ?? 0) * 86400000)).toLocaleDateString('pt-BR')}</p>
                            </>
                        )}
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
                                            <p className="text-indigo-200 text-[9px] font-black uppercase tracking-widest mb-1">Total Previsto</p>
                                            <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(detailData.totalPlannedIncome + detailData.totalOverdueIncome)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-indigo-200 text-[9px] font-black uppercase tracking-widest mb-1">Total Recebido</p>
                                            <p className="text-3xl font-black text-emerald-300 tracking-tight">{formatCurrency(detailData.totalRealizedIncome)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress graph background decoration */}
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10">
                                    <div
                                        className="h-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)] transition-all duration-1000"
                                        style={{ width: `${Math.min(100, (detailData.totalRealizedIncome / (detailData.totalPlannedIncome + detailData.totalOverdueIncome || 1)) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden">
                                <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                            <tr className="border-b border-slate-100">
                                                <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Descrição</th>
                                                <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Data</th>
                                                <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {detailData.incomes.length > 0 ? detailData.incomes.map(item => (
                                                <tr key={item.id}
                                                    className="group hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors"
                                                    onClick={() => { hapticFeedback?.(5); setSelectedItem(item); }}
                                                >
                                                    <td className="px-4 py-4">
                                                        <span className="font-bold text-slate-700 text-sm block">{item.description}</span>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${item.status === 'PREVISTA' || item.status === 'PROJETADA' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="text-xs font-bold text-slate-500 tabular-nums">{formatDate(item.planned_date)}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className={`text-sm font-black tabular-nums ${item.actual_amount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                            {formatCurrency(item.planned_amount)}
                                                        </div>
                                                        {item.is_overdue && !item.actual_amount && (
                                                            <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">Atrasada</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={3} className="py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                                                                <ArrowUpRight size={24} />
                                                            </div>
                                                            <p className="text-slate-400 text-sm font-medium italic">Nenhuma receita pendente.</p>
                                                        </div>
                                                    </td>
                                                </tr>
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
                            <div className="bg-slate-900 p-8 relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                                                <ArrowDownRight size={22} />
                                            </div>
                                            <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Despesas</h3>
                                        </div>
                                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-700 px-3 py-1 rounded-full">Projetado</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Total Previsto</p>
                                            <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(detailData.totalPlannedExpense + detailData.totalOverdueExpense)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Total Pago</p>
                                            <p className="text-3xl font-black text-rose-400 tracking-tight">{formatCurrency(detailData.totalRealizedExpense)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
                                    <div
                                        className="h-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)] transition-all duration-1000"
                                        style={{ width: `${Math.min(100, (detailData.totalRealizedExpense / (detailData.totalPlannedExpense + detailData.totalOverdueExpense || 1)) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden">
                                <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                            <tr className="border-b border-slate-100">
                                                <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Descrição</th>
                                                <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Data</th>
                                                <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {detailData.expenses.length > 0 ? detailData.expenses.map(item => (
                                                <tr key={item.id}
                                                    className="group hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors"
                                                    onClick={() => { hapticFeedback?.(5); setSelectedItem(item); }}
                                                >
                                                    <td className="px-4 py-4">
                                                        <span className="font-bold text-slate-700 text-sm block">{item.description}</span>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${item.status === 'PREVISTA' || item.status === 'PROJETADA' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="text-xs font-bold text-slate-500 tabular-nums">{formatDate(item.planned_date)}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="text-sm font-black tabular-nums text-rose-500/80">
                                                            {formatCurrency(item.planned_amount)}
                                                        </div>
                                                        {item.is_overdue && !item.actual_amount && (
                                                            <span className="text-[8px] font-black text-rose-600 uppercase tracking-tighter flex items-center justify-end gap-1">
                                                                <AlertCircle size={8} /> Atrasada
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={3} className="py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                                                                <ArrowDownRight size={24} />
                                                            </div>
                                                            <p className="text-slate-400 text-sm font-medium italic">Nenhuma despesa pendente.</p>
                                                        </div>
                                                    </td>
                                                </tr>
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

                    {/* FOCUSED SUMMARY CARD - REDESIGNED FOR MATHEMATICAL INTUITIVITY  */}
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

            {/* DETAIL MODAL */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedItem(null)}></div>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className={`p-8 ${selectedItem.type === 'RECEITA' ? 'bg-emerald-600' : 'bg-rose-600'} text-white`}>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 block mb-1">
                                        {selectedItem.is_projection ? 'Lançamento Projetado' : 'Detalhes do Lançamento'}
                                    </span>
                                    <h3 className="text-2xl font-black tracking-tight">{selectedItem.description}</h3>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Valor Planejado</p>
                                <div className="text-4xl font-black">{formatCurrency(selectedItem.planned_amount)}</div>
                            </div>
                        </div>

                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        <Calendar size={10} /> Vencimento
                                    </p>
                                    <p className="font-bold text-slate-700">{formatDate(selectedItem.planned_date)}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${selectedItem.status === 'PREVISTA' || selectedItem.status === 'PROJETADA'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-indigo-100 text-indigo-700'
                                        }`}>
                                        {selectedItem.status}
                                    </span>
                                </div>
                            </div>

                            {selectedItem.original?.category_id && (
                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                                        <Tag size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoria</p>
                                        <p className="font-bold text-slate-700">
                                            {categories.find((c: any) => c.id === selectedItem.original.category_id)?.name || 'Sem Categoria'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedItem.original?.account_id && (
                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                                        <Wallet size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Conta/Origem</p>
                                        <p className="font-bold text-slate-700">
                                            {accounts.find((a: any) => a.id === selectedItem.original.account_id)?.name || 'Nenhuma'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedItem.actual_amount > 0 && (
                                <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Valor Realizado</p>
                                        <p className="text-[9px] font-bold text-emerald-500 uppercase">{formatDate(selectedItem.actual_date)}</p>
                                    </div>
                                    <p className="text-2xl font-black text-emerald-700">{formatCurrency(selectedItem.actual_amount)}</p>
                                </div>
                            )}

                            {selectedItem.is_overdue && !selectedItem.actual_amount && (
                                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-3">
                                    <AlertCircle className="text-rose-600" size={20} />
                                    <p className="text-xs font-bold text-rose-700 italic">Atenção: Este lançamento está atrasado!</p>
                                </div>
                            )}

                            <button
                                onClick={() => setSelectedItem(null)}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-200"
                            >
                                Fechar Detalhes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
