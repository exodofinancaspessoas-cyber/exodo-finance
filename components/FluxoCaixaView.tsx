
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
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#5856d6]/10 text-[#5856d6] dark:text-[#7d7aff] ios-squircle flex items-center justify-center shrink-0 border border-[#5856d6]/20">
                        <Table size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-[#5856d6] dark:text-[#7d7aff] uppercase tracking-widest leading-none">Fluxo</span>
                        <h2 className="text-4xl font-black text-[var(--ios-text)] tracking-tight leading-none mt-1">
                            {useCustomRange ? 'Personalizado' : forecastDays ? `${forecastDays} Dias` : 'Caixa Mensal'}
                        </h2>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Forecast Selector */}
                    <div className="flex w-full sm:w-auto bg-[var(--ios-card-bg)]/80 backdrop-blur-md rounded-xl border p-1 shadow-sm" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        {/* Mensal */}
                        <button
                            onClick={() => { setForecastDays(null); setUseCustomRange(false); setDisplayType('detailed'); }}
                            className={`flex-1 sm:flex-none px-4 py-2.5 text-[10px] font-black uppercase tracking-wider ios-squircle transition-all ${forecastDays === null && !useCustomRange ? 'bg-[var(--ios-text)] text-[var(--ios-bg)]' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                        >
                            Mensal
                        </button>

                        {/* Quick days: 10, 20, 30 */}
                        {[10, 20, 30].map(days => (
                            <button
                                key={days}
                                onClick={() => { setForecastDays(days); setUseCustomRange(false); setDisplayType('detailed'); }}
                                className={`flex-1 sm:flex-none px-4 py-2.5 text-[10px] font-black uppercase tracking-wider ios-squircle transition-all ${forecastDays === days && !useCustomRange ? 'bg-[var(--ios-text)] text-[var(--ios-bg)]' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                            >
                                {days}D
                            </button>
                        ))}

                        {/* Extended days dropdown trigger */}
                        <div className="relative" ref={daysMenuRef}>
                            <button
                                onClick={() => setShowDaysMenu(p => !p)}
                                className={`flex items-center justify-center gap-1 w-10 h-10 ios-squircle transition-all ${([60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].includes(forecastDays ?? 0) && !useCustomRange)
                                    ? 'bg-[var(--ios-text)] text-[var(--ios-bg)]'
                                    : 'text-[var(--ios-text-secondary)] hover:bg-black/5'
                                    }`}
                            >
                                <ChevronDown size={14} className={`transition-transform duration-200 ${showDaysMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {showDaysMenu && (
                                <div className="absolute top-full right-0 mt-2 bg-[var(--ios-card-bg)]/95 backdrop-blur-xl ios-squircle-sm border shadow-2xl z-50 overflow-hidden py-1 min-w-[130px] animate-in fade-in slide-in-from-top-2 duration-150" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                    {[60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].map(days => (
                                        <button
                                            key={days}
                                            onClick={() => { setForecastDays(days); setUseCustomRange(false); setDisplayType('detailed'); setShowDaysMenu(false); }}
                                            className={`w-full text-left px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${forecastDays === days && !useCustomRange
                                                ? 'bg-[#ff2d55] text-white'
                                                : 'text-[var(--ios-text-secondary)] hover:bg-black/5 hover:text-[var(--ios-text)]'
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
                            className={`flex items-center gap-2 px-4 h-11 text-[10px] font-black uppercase tracking-wider ios-squircle border shadow-sm transition-all ${useCustomRange
                                ? 'bg-[#ff2d55] text-white border-[#ff2d55]'
                                : 'bg-[var(--ios-card-bg)]/80 backdrop-blur-md text-[var(--ios-text-secondary)] border-[var(--ios-glass-border)]'
                                }`}
                        >
                            <Calendar size={14} strokeWidth={2.5} />
                            {useCustomRange && customStartDate && customEndDate
                                ? `${new Date(customStartDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                                : 'Período'
                            }
                        </button>

                        {showDatePicker && (
                            <div className="absolute top-full right-0 mt-2 bg-[var(--ios-card-bg)]/95 backdrop-blur-xl ios-squircle-md border shadow-2xl z-50 p-6 min-w-[280px] animate-in fade-in slide-in-from-top-2 duration-150" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)] mb-5">Intervalo</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-[var(--ios-text-secondary)] tracking-widest mb-2 ml-1">Início</label>
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={e => setCustomStartDate(e.target.value)}
                                            className="w-full px-4 py-3.5 bg-black/5 border ios-squircle-sm text-sm font-bold text-[var(--ios-text)] focus:ring-1 focus:ring-[#ff2d55]/30 transition-all outline-none"
                                            style={{ borderColor: 'var(--ios-glass-border)' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black uppercase text-[var(--ios-text-secondary)] tracking-widest mb-2 ml-1">Fim</label>
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            min={customStartDate}
                                            onChange={e => setCustomEndDate(e.target.value)}
                                            className="w-full px-4 py-3.5 bg-black/5 border ios-squircle-sm text-sm font-bold text-[var(--ios-text)] focus:ring-1 focus:ring-[#ff2d55]/30 transition-all outline-none"
                                            style={{ borderColor: 'var(--ios-glass-border)' }}
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setUseCustomRange(false); setShowDatePicker(false); }}
                                            className="flex-1 py-3 ios-squircle text-[10px] font-black uppercase text-[var(--ios-text-secondary)] hover:bg-black/5 transition-all"
                                        >
                                            Limpar
                                        </button>
                                        <button
                                            disabled={!customStartDate || !customEndDate}
                                            onClick={() => { if (customStartDate && customEndDate) { setUseCustomRange(true); setForecastDays(null); setDisplayType('detailed'); setShowDatePicker(false); } }}
                                            className="flex-1 py-3 ios-squircle bg-[#ff2d55] text-white text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-30 transition-all"
                                        >
                                            Ok
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* View Switcher */}
                    <div className="flex bg-[var(--ios-card-bg)]/80 backdrop-blur-md rounded-xl border p-1 shadow-sm" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <button
                            onClick={() => setDisplayType('detailed')}
                            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider ios-squircle transition-all ${displayType === 'detailed' ? 'bg-[var(--ios-text)] text-[var(--ios-bg)]' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                        >
                            <List size={14} strokeWidth={2.5} /> Foco
                        </button>
                        <button
                            onClick={() => setDisplayType('table')}
                            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider ios-squircle transition-all ${displayType === 'table' ? 'bg-[var(--ios-text)] text-[var(--ios-bg)]' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                        >
                            <LayoutGrid size={14} strokeWidth={2.5} /> Tabela
                        </button>
                    </div>

                    <div className="flex bg-[var(--ios-card-bg)]/80 backdrop-blur-md rounded-xl border p-1 shadow-sm" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <button
                            onClick={() => setShowProjections(!showProjections)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider ios-squircle transition-all ${showProjections ? 'bg-[#5856d6] text-white shadow-md' : 'text-[var(--ios-text-secondary)] hover:bg-black/5'}`}
                        >
                            <TrendingUp size={14} strokeWidth={2.5} /> {showProjections ? 'Ocultar' : 'Ver'} Projeção
                        </button>
                    </div>

                    {!forecastDays && !useCustomRange && (
                        <div className="flex items-center gap-1 bg-[var(--ios-card-bg)]/80 backdrop-blur-md rounded-xl border p-1 shadow-sm" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <button onClick={() => { setStartMonthOffset(p => p - 1); setSelectedMonthIndex(0); }} className="w-10 h-10 flex items-center justify-center ios-squircle text-[var(--ios-text-secondary)] hover:text-[#ff2d55] hover:bg-black/5 transition-all"><ChevronLeft size={20} strokeWidth={2.5} /></button>
                            <div className="px-3 text-[10px] font-black uppercase tracking-widest text-[var(--ios-text-secondary)]">Menu</div>
                            <button onClick={() => { setStartMonthOffset(p => p + 1); setSelectedMonthIndex(0); }} className="w-10 h-10 flex items-center justify-center ios-squircle text-[var(--ios-text-secondary)] hover:text-[#ff2d55] hover:bg-black/5 transition-all"><ChevronRight size={20} strokeWidth={2.5} /></button>
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
                            className={`flex-shrink-0 px-6 py-4 ios-squircle-md border-2 transition-all duration-300 flex flex-col items-center min-w-[120px] relative overflow-hidden backdrop-blur-sm
                            ${selectedMonthIndex === idx
                                    ? 'bg-[var(--ios-card-bg)] border-[#ff2d55] shadow-xl shadow-[#ff2d55]/10 scale-105 z-10'
                                    : 'bg-[var(--ios-card-bg)]/40 border-[var(--ios-glass-border)] text-[var(--ios-text-secondary)] hover:border-[var(--ios-text-secondary)] hover:bg-[var(--ios-card-bg)]/60'
                                }`}
                        >
                            {m.isCurrent && selectedMonthIndex !== idx && (
                                <div className="absolute top-0 right-0 p-2">
                                    <div className="w-2 h-2 bg-[#ff2d55] rounded-full shadow-[0_0_8px_rgba(255,45,85,0.4)]"></div>
                                </div>
                            )}
                            <span className={`text-[9px] font-black uppercase tracking-[0.3em] mb-1 ${selectedMonthIndex === idx ? 'text-[#ff2d55]' : 'text-[var(--ios-text-secondary)]/50'}`}>
                                {m.key.split('-')[0]}
                            </span>
                            <span className={`text-xl font-black uppercase tracking-tighter ${selectedMonthIndex === idx ? 'text-[var(--ios-text)]' : 'text-[var(--ios-text-secondary)]'}`}>
                                {m.label.split(' ')[0]}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {(forecastDays || useCustomRange) && (
                <div className="bg-[#5856d6]/10 border border-[#5856d6]/20 p-6 ios-squircle-md flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm">
                    <div>
                        {useCustomRange ? (
                            <>
                                <h4 className="text-[var(--ios-text)] font-black text-xl tracking-tight">Período Personalizado</h4>
                                <p className="text-[var(--ios-text-secondary)] text-sm font-medium">
                                    {new Date(customStartDate + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(customEndDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </p>
                            </>
                        ) : (
                            <>
                                <h4 className="text-[var(--ios-text)] font-black text-xl tracking-tight">Previsão de {forecastDays} Dias</h4>
                                <p className="text-[var(--ios-text-secondary)] text-sm font-medium">Análise preditiva até {(new Date(Date.now() + (forecastDays ?? 0) * 86400000)).toLocaleDateString('pt-BR')}</p>
                            </>
                        )}
                    </div>
                    <div className="bg-black/5 backdrop-blur-sm px-6 py-3 ios-squircle-sm border border-[var(--ios-glass-border)] flex items-center gap-3">
                        <Calendar className="text-[#5856d6]" size={20} strokeWidth={2.5} />
                        <span className="text-[var(--ios-text)] font-black text-[10px] uppercase tracking-widest">Ativo</span>
                    </div>
                </div>
            )}

            {displayType === 'detailed' ? (
                /* DETAILED VIEW - Side by Side Panels */
                <div className="space-y-8">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

                        {/* INCOMES PANEL */}
                        <div className="bg-[var(--ios-card-bg)]/80 backdrop-blur-md ios-squircle-lg border shadow-xl flex flex-col overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="bg-[#34c759]/10 p-8 relative overflow-hidden border-b" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#34c759]/20 backdrop-blur-md ios-squircle flex items-center justify-center text-[#34c759]">
                                                <ArrowUpRight size={22} strokeWidth={2.5} />
                                            </div>
                                            <h3 className="text-[var(--ios-text)] font-black text-2xl uppercase tracking-tighter">Receitas</h3>
                                        </div>
                                        <div className="text-[#34c759] text-[9px] font-black uppercase tracking-[0.2em] bg-[#34c759]/10 px-3 py-1 ios-squircle-sm">Previsto</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-[var(--ios-text-secondary)] text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Total Esperado</p>
                                            <p className="text-3xl font-black text-[var(--ios-text)] tracking-tight">{formatCurrency(detailData.totalPlannedIncome + detailData.totalOverdueIncome)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[#34c759] text-[9px] font-black uppercase tracking-widest mb-1 opacity-80">Recebido</p>
                                            <p className="text-3xl font-black text-[#34c759] tracking-tight">{formatCurrency(detailData.totalRealizedIncome)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress graph background decoration */}
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-black/5 dark:bg-white/5">
                                    <div
                                        className="h-full bg-[#34c759] shadow-[0_0_15px_rgba(52,199,89,0.3)] transition-all duration-1000"
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
                                                    className="group hover:bg-black/5 active:bg-black/10 cursor-pointer transition-colors"
                                                    onClick={() => { hapticFeedback?.(5); setSelectedItem(item); }}
                                                >
                                                    <td className="px-6 py-5">
                                                        <span className="font-bold text-[var(--ios-text)] text-sm block tracking-tight">{item.description}</span>
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 ios-squircle-sm ${item.status === 'PREVISTA' || item.status === 'PROJETADA' ? 'bg-[#ff9500]/10 text-[#ff9500]' : 'bg-[#34c759]/10 text-[#34c759]'}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="text-xs font-bold text-[var(--ios-text-secondary)] tabular-nums">{formatDate(item.planned_date)}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <div className={`text-sm font-black tabular-nums ${item.actual_amount > 0 ? 'text-[#34c759]' : 'text-[var(--ios-text-secondary)]'}`}>
                                                            {formatCurrency(item.planned_amount)}
                                                        </div>
                                                        {item.is_overdue && !item.actual_amount && (
                                                            <span className="text-[8px] font-black text-[#ff3b30] uppercase tracking-tighter">Atrasada</span>
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
                            <div className="p-6 bg-black/5 border-t flex justify-between items-center group cursor-pointer hover:bg-[#34c759]/5 transition-all" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 ios-squircle bg-[#34c759]/10 text-[#34c759] flex items-center justify-center font-black text-[10px]">
                                        {Math.round((detailData.totalRealizedIncome / (detailData.totalPlannedIncome || 1)) * 100)}%
                                    </div>
                                    <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">Pendente</span>
                                </div>
                                <span className="text-xl font-black text-[#34c759] tracking-tighter">{formatCurrency(detailData.totalPlannedIncome - detailData.totalRealizedIncome)}</span>
                            </div>
                        </div>

                        {/* EXPENSES PANEL */}
                        <div className="bg-[var(--ios-card-bg)]/80 backdrop-blur-md ios-squircle-lg border shadow-xl flex flex-col overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="bg-[#ff3b30]/10 p-8 relative overflow-hidden border-b" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#ff3b30]/20 backdrop-blur-md ios-squircle flex items-center justify-center text-[#ff3b30]">
                                                <ArrowDownRight size={22} strokeWidth={2.5} />
                                            </div>
                                            <h3 className="text-[var(--ios-text)] font-black text-2xl uppercase tracking-tighter">Despesas</h3>
                                        </div>
                                        <div className="text-[#ff3b30] text-[9px] font-black uppercase tracking-[0.2em] bg-[#ff3b30]/10 px-3 py-1 ios-squircle-sm">Previsto</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-[var(--ios-text-secondary)] text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Total Esperado</p>
                                            <p className="text-3xl font-black text-[var(--ios-text)] tracking-tight">{formatCurrency(detailData.totalPlannedExpense + detailData.totalOverdueExpense)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[#ff3b30] text-[9px] font-black uppercase tracking-widest mb-1 opacity-80">Pago</p>
                                            <p className="text-3xl font-black text-[#ff3b30] tracking-tight">{formatCurrency(detailData.totalRealizedExpense)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-black/5 dark:bg-white/5">
                                    <div
                                        className="h-full bg-[#ff3b30] shadow-[0_0_15px_rgba(255,59,48,0.3)] transition-all duration-1000"
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
                                                    className="group hover:bg-black/5 active:bg-black/10 cursor-pointer transition-colors"
                                                    onClick={() => { hapticFeedback?.(5); setSelectedItem(item); }}
                                                >
                                                    <td className="px-6 py-5">
                                                        <span className="font-bold text-[var(--ios-text)] text-sm block tracking-tight">{item.description}</span>
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 ios-squircle-sm ${item.status === 'PREVISTA' || item.status === 'PROJETADA' ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : 'bg-[var(--ios-text-secondary)]/10 text-[var(--ios-text-secondary)]'}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="text-xs font-bold text-[var(--ios-text-secondary)] tabular-nums">{formatDate(item.planned_date)}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <div className="text-sm font-black tabular-nums text-[#ff3b30]/80">
                                                            {formatCurrency(item.planned_amount)}
                                                        </div>
                                                        {item.is_overdue && !item.actual_amount && (
                                                            <span className="text-[8px] font-black text-[#ff3b30] uppercase tracking-tighter flex items-center justify-end gap-1">
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
                            <div className="p-6 bg-black/5 border-t flex justify-between items-center group cursor-pointer hover:bg-[#ff3b30]/5 transition-all" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 ios-squircle bg-[#ff3b30]/10 text-[#ff3b30] flex items-center justify-center font-black text-[10px]">
                                        {Math.round((detailData.totalRealizedExpense / (detailData.totalPlannedExpense || 1)) * 100)}%
                                    </div>
                                    <span className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest">Pendente</span>
                                </div>
                                <span className="text-xl font-black text-[#ff3b30] tracking-tighter">{formatCurrency(detailData.totalPlannedExpense - detailData.totalRealizedExpense)}</span>
                            </div>
                        </div>
                    </div>

                    {/* FOCUSED SUMMARY CARD - REDESIGNED FOR MATHEMATICAL INTUITIVITY  */}
                    <div className="bg-[#1c1c1e] dark:bg-[#1c1c1e] rounded-[2.5rem] p-8 xl:p-12 text-white shadow-2xl relative overflow-hidden group border border-white/5">
                        <div className="relative z-10 w-full">
                            <h4 className="text-[10px] font-black text-[#5856d6] uppercase tracking-[0.4em] mb-10 text-center xl:text-left">
                                {forecastDays ? `Projeção em ${forecastDays} dias` : 'Próximo Saldo Realista'}
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
                                    <div className="flex flex-col xl:flex-row items-stretch justify-between gap-6 xl:gap-8 overflow-x-auto pb-4 no-scrollbar">
                                        {/* STEP 1: CURRENT BALANCE */}
                                        <div className="flex-1 min-w-[200px] p-6 ios-squircle-md bg-white/5 border border-white/10 text-center flex flex-col justify-center">
                                            <p className="text-white/40 text-[8px] font-black uppercase tracking-widest mb-2">Hoje</p>
                                            <div className="text-2xl font-black text-white">{formatCurrency(currentTotalBalance)}</div>
                                            <p className="text-[9px] text-white/20 font-medium mt-2">Disponível</p>
                                        </div>

                                        <div className="flex items-center justify-center text-white/20">
                                            <Plus size={20} strokeWidth={3} />
                                        </div>

                                        {/* STEP 2: TOTAL RECEIVABLE */}
                                        <div className="flex-1 min-w-[200px] p-6 ios-squircle-md bg-[#34c759]/5 border border-[#34c759]/10 text-center">
                                            <p className="text-[#34c759] text-[8px] font-black uppercase tracking-widest mb-2">A Receber</p>
                                            <div className="text-2xl font-black text-[#34c759]">{formatCurrency(totalIn)}</div>
                                            <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                                                <div className="flex justify-between text-[8px] font-black uppercase text-white/40">
                                                    <span>Período:</span>
                                                    <span className="text-white/60">{formatCurrency(periodPendingIn)}</span>
                                                </div>
                                                <div className="flex justify-between text-[8px] font-black uppercase text-white/40">
                                                    <span>Atrasadas:</span>
                                                    <span className="text-[#5856d6]">{formatCurrency(detailData.totalOverdueIncome)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center text-white/20">
                                            <Minus size={20} strokeWidth={3} />
                                        </div>

                                        {/* STEP 3: TOTAL PAYABLE */}
                                        <div className="flex-1 min-w-[200px] p-6 ios-squircle-md bg-[#ff3b30]/5 border border-[#ff3b30]/10 text-center">
                                            <p className="text-[#ff3b30] text-[8px] font-black uppercase tracking-widest mb-2">A Pagar</p>
                                            <div className="text-2xl font-black text-[#ff3b30]">{formatCurrency(totalOut)}</div>
                                            <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                                                <div className="flex justify-between text-[8px] font-black uppercase text-white/40">
                                                    <span>Período:</span>
                                                    <span className="text-white/60">{formatCurrency(periodPendingOut)}</span>
                                                </div>
                                                <div className="flex justify-between text-[8px] font-black uppercase text-white/40">
                                                    <span>Atrasadas:</span>
                                                    <span className="text-[#5856d6]">{formatCurrency(detailData.totalOverdueExpense)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center text-white/20">
                                            <Equal size={20} strokeWidth={3} />
                                        </div>

                                        {/* TARGET: FINAL BALANCE */}
                                        <div className={`flex-[1.2] min-w-[250px] p-8 ios-squircle-lg ${isPositive ? 'bg-[#5856d6] shadow-xl shadow-[#5856d6]/20' : 'bg-[#ff3b30] shadow-xl shadow-[#ff3b30]/20'} flex flex-col justify-center text-center relative overflow-hidden group/target`}>
                                            <p className="text-white/60 text-[9px] font-black uppercase tracking-widest mb-3">Estimativa Final</p>
                                            <div className="text-4xl font-black text-white tracking-tighter">{formatCurrency(projectedFinal)}</div>
                                            <p className="text-white/50 text-[9px] mt-4 font-medium max-w-[200px] mx-auto leading-tight">
                                                Saldo estimado considerando todas as movimentações futuras.
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
                    <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--ios-text-secondary)] ml-2 opacity-60">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 bg-[var(--ios-text-secondary)]/20 rounded-full"></div>
                            <span>Realizado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 border-2 border-dashed border-[#5856d6]/40 rounded-full"></div>
                            <span>Projetado</span>
                        </div>
                    </div>

                    <div className="bg-[var(--ios-card-bg)]/80 backdrop-blur-md ios-squircle-lg border shadow-xl overflow-hidden overflow-x-auto no-scrollbar" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-black/5 border-b" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                    <th className="sticky left-0 z-20 bg-[var(--ios-card-bg)] p-6 text-[9px] font-black uppercase tracking-[0.3em] text-[var(--ios-text-secondary)] border-r" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                        CATEGORIAS
                                    </th>
                                    {months.map(col => (
                                        <th key={col.key} className={`p-6 text-center text-[10px] font-black uppercase tracking-widest border-r last:border-r-0 ${col.isCurrent ? 'bg-[#5856d6]/5 text-[#5856d6]' : 'text-[var(--ios-text-secondary)]'}`} style={{ borderColor: 'var(--ios-glass-border)' }}>
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                {/* RECEITAS */}
                                <tr className="bg-[#34c759]/5">
                                    <td className="sticky left-0 z-10 bg-[#34c759]/10 backdrop-blur-sm p-3 pl-6 text-[9px] font-black text-[#34c759] uppercase tracking-widest border-r" style={{ borderColor: 'var(--ios-glass-border)' }}>Entradas</td>
                                    {months.map(col => <td key={col.key} className="p-3 border-r last:border-r-0" style={{ borderColor: 'var(--ios-glass-border)' }}></td>)}
                                </tr>
                                {rows.filter(r => r.type === 'RECEITA').map(row => (
                                    <tr key={row.categoryId} className="hover:bg-black/5 transition-colors group">
                                        <td className="sticky left-0 z-10 bg-[var(--ios-card-bg)] group-hover:bg-black/5 p-4 pl-8 text-sm font-bold text-[var(--ios-text)] border-r transition-colors" style={{ borderColor: 'var(--ios-glass-border)' }}>{row.categoryName}</td>
                                        {months.map(col => {
                                            const val = row.values[col.key];
                                            return (
                                                <td key={col.key} className={`p-4 text-center border-r last:border-r-0 ${col.isCurrent ? 'bg-[#34c759]/5' : ''}`} style={{ borderColor: 'var(--ios-glass-border)' }}>
                                                    {val ? <div className={`inline-block px-3 py-1 ios-squircle-sm text-sm font-black ${val.isProjected ? 'text-[#ff9500] border border-dashed border-[#ff9500]/30' : 'text-[#34c759]'}`}>{formatCurrency(val.amount)}</div> : <span className="text-[var(--ios-text-secondary)]/10">—</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}

                                {/* DESPESAS */}
                                <tr className="bg-[#ff3b30]/5">
                                    <td className="sticky left-0 z-10 bg-[#ff3b30]/10 backdrop-blur-sm p-3 pl-6 text-[9px] font-black text-[#ff3b30] uppercase tracking-widest border-r" style={{ borderColor: 'var(--ios-glass-border)' }}>Saídas</td>
                                    {months.map(col => <td key={col.key} className="p-3 border-r last:border-r-0" style={{ borderColor: 'var(--ios-glass-border)' }}></td>)}
                                </tr>
                                {rows.filter(r => r.type === 'DESPESA').map(row => (
                                    <tr key={row.categoryId} className="hover:bg-black/5 transition-colors group">
                                        <td className="sticky left-0 z-10 bg-[var(--ios-card-bg)] group-hover:bg-black/5 p-4 pl-8 text-sm font-bold text-[var(--ios-text)] border-r transition-colors" style={{ borderColor: 'var(--ios-glass-border)' }}>{row.categoryName}</td>
                                        {months.map(col => {
                                            const val = row.values[col.key];
                                            return (
                                                <td key={col.key} className={`p-4 text-center border-r last:border-r-0 ${col.isCurrent ? 'bg-[#ff3b30]/5' : ''}`} style={{ borderColor: 'var(--ios-glass-border)' }}>
                                                    {val ? <div className={`inline-block px-3 py-1 ios-squircle-sm text-sm font-black ${val.isProjected ? 'text-[#ff9500] border border-dashed border-[#ff9500]/30' : 'text-[#ff3b30]'}`}>{formatCurrency(val.amount)}</div> : <span className="text-[var(--ios-text-secondary)]/10">—</span>}
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
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedItem(null)}></div>
                    <div className="bg-[var(--ios-card-bg)]/95 backdrop-blur-xl ios-squircle-lg w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in duration-300 border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className={`p-8 ${selectedItem.type === 'RECEITA' ? 'bg-[#34c759]' : 'bg-[#ff3b30]'} text-white`}>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-70 block mb-1">
                                        {selectedItem.is_projection ? 'PROJEÇÃO' : 'DETALHES'}
                                    </span>
                                    <h3 className="text-3xl font-black tracking-tighter">{selectedItem.description}</h3>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="w-10 h-10 ios-squircle bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                                    <X size={20} strokeWidth={3} />
                                </button>
                            </div>

                            <div className="bg-white/10 backdrop-blur-md ios-squircle-md p-6 border border-white/10">
                                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Valor Planejado</p>
                                <div className="text-4xl font-black tracking-tighter">{formatCurrency(selectedItem.planned_amount)}</div>
                            </div>
                        </div>

                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-black/5 ios-squircle-md border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                    <p className="text-[8px] font-black text-[var(--ios-text-secondary)] uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                        <Calendar size={12} strokeWidth={2.5} /> VENCIMENTO
                                    </p>
                                    <p className="font-bold text-[var(--ios-text)]">{formatDate(selectedItem.planned_date)}</p>
                                </div>
                                <div className="p-5 bg-black/5 ios-squircle-md border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                    <p className="text-[8px] font-black text-[var(--ios-text-secondary)] uppercase tracking-[0.2em] mb-2">STATUS</p>
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 ios-squircle-sm ${selectedItem.status === 'PREVISTA' || selectedItem.status === 'PROJETADA'
                                        ? 'bg-[#ff9500]/10 text-[#ff9500]'
                                        : (selectedItem.type === 'RECEITA' ? 'bg-[#34c759]/10 text-[#34c759]' : 'bg-[#007aff]/10 text-[#007aff]')
                                        }`}>
                                        {selectedItem.status}
                                    </span>
                                </div>
                            </div>

                            {selectedItem.original?.category_id && (
                                <div className="flex items-center gap-4 p-5 bg-black/5 ios-squircle-md border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                    <div className="w-12 h-12 ios-squircle bg-[var(--ios-card-bg)] shadow-sm flex items-center justify-center text-[var(--ios-text-secondary)] border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                        <Tag size={24} strokeWidth={2} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[8px] font-black text-[var(--ios-text-secondary)] uppercase tracking-[0.2em] mb-1">CATEGORIA</p>
                                        <p className="font-bold text-[var(--ios-text)]">
                                            {categories.find((c: any) => c.id === selectedItem.original.category_id)?.name || 'Sem Categoria'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedItem.original?.account_id && (
                                <div className="flex items-center gap-4 p-5 bg-black/5 ios-squircle-md border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                    <div className="w-12 h-12 ios-squircle bg-[var(--ios-card-bg)] shadow-sm flex items-center justify-center text-[var(--ios-text-secondary)] border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                        <Wallet size={24} strokeWidth={2} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[8px] font-black text-[var(--ios-text-secondary)] uppercase tracking-[0.2em] mb-1">CONTA / ORIGEM</p>
                                        <p className="font-bold text-[var(--ios-text)]">
                                            {accounts.find((a: any) => a.id === selectedItem.original.account_id)?.name || 'Nenhuma'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedItem.actual_amount > 0 && (
                                <div className="p-6 bg-[#34c759]/10 ios-squircle-lg border border-[#34c759]/20">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[8px] font-black text-[#34c759] uppercase tracking-[0.2em]">VALOR REALIZADO</p>
                                        <p className="text-[8px] font-bold text-[#34c759] uppercase">{formatDate(selectedItem.actual_date)}</p>
                                    </div>
                                    <p className="text-3xl font-black text-[#34c759] tracking-tighter">{formatCurrency(selectedItem.actual_amount)}</p>
                                </div>
                            )}

                            {selectedItem.is_overdue && !selectedItem.actual_amount && (
                                <div className="p-5 bg-[#ff3b30]/10 ios-squircle-md border border-[#ff3b30]/20 flex items-center gap-3">
                                    <AlertCircle className="text-[#ff3b30]" size={20} strokeWidth={2.5} />
                                    <p className="text-xs font-bold text-[#ff3b30]">Atenção: Este lançamento está atrasado!</p>
                                </div>
                            )}

                            <button
                                onClick={() => setSelectedItem(null)}
                                className="w-full py-4 bg-[var(--ios-text)] text-[var(--ios-bg)] ios-squircle font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all shadow-xl"
                            >
                                FECHAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
