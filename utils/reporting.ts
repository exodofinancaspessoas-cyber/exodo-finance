
import { Transaction, Category } from '../types';
import { startOfMonth, subMonths, isSameMonth, formatCurrency, getMonthKey as getMonthKeyFromIndex } from './index';

export interface ReportStats {
    average: number;
    max: number;
    min: number;
    stdDev: number;
    consistency: 'HIGH' | 'MEDIUM' | 'LOW';
    totalPeriod: number;
    monthlyData: { month: string; total: number }[];
}

export interface CategoryStats {
    categoryId: string;
    categoryName: string;
    average: number;
    min: number;
    max: number;
    variation: number; // Percentage variation from average
    trend: 'UP' | 'DOWN' | 'STABLE';
    monthlyValues: number[];
}

const getMonthKey = getMonthKeyFromIndex;

export const filterTransactionsByPeriod = (transactions: Transaction[], monthsBack: number): Transaction[] => {
    const today = new Date();
    // Get the start date: first day of (Current Month - monthsBack + 1)
    // E.g. if monthsBack=6, and today is Feb 2026. Start is Sep 2025.
    // subMonths(today, 5) => Sep 2025.
    const startDate = startOfMonth(subMonths(today, monthsBack - 1));
    return transactions.filter(t => new Date(t.date) >= startDate);
};

export const calculatePeriodStats = (transactions: Transaction[], monthsCount: number): ReportStats => {
    const monthlyTotals: Record<string, number> = {};
    const today = new Date();

    // Initialize months with 0s to ensure periods without spending are counted as 0
    for (let i = 0; i < monthsCount; i++) {
        const d = subMonths(today, i);
        monthlyTotals[getMonthKey(d)] = 0;
    }

    // Sum transactions
    transactions.forEach(t => {
        if (t.type === 'DESPESA') {
            const key = getMonthKey(new Date(t.date));
            if (monthlyTotals[key] !== undefined) {
                monthlyTotals[key] += t.amount;
            }
        }
    });

    const values = Object.values(monthlyTotals);
    const totalPeriod = values.reduce((a, b) => a + b, 0);
    const average = monthsCount > 0 ? totalPeriod / monthsCount : 0;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Standard Deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / (monthsCount || 1);
    const stdDev = Math.sqrt(variance);

    // Consistency (CV)
    const cv = average > 0 ? stdDev / average : 0;
    let consistency: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
    if (cv > 0.5) consistency = 'LOW';
    else if (cv > 0.25) consistency = 'MEDIUM'; // tweaked threshold

    // Format for Chart (chronological)
    const monthlyData = Object.keys(monthlyTotals).sort().map(key => ({
        month: key,
        total: monthlyTotals[key]
    }));

    return { average, max, min, stdDev, consistency, totalPeriod, monthlyData };
};

export const calculateCategoryStats = (transactions: Transaction[], categories: Category[], monthsCount: number): CategoryStats[] => {
    const today = new Date();
    // Calculate per category
    const stats = categories.map(cat => {
        const catTrans = transactions.filter(t => t.category_id === cat.id && t.type === 'DESPESA');

        // Monthly breakdown for this category
        const monthlyValues: number[] = [];
        for (let i = 0; i < monthsCount; i++) {
            const d = subMonths(today, i);
            const key = getMonthKey(d);
            const monthTotal = catTrans
                .filter(t => getMonthKey(new Date(t.date)) === key)
                .reduce((a, b) => a + b.amount, 0);
            monthlyValues.push(monthTotal); // pushed in reverse chrono (0=today)
        }

        // Reverse so index 0 is oldest? Or keep 0 as newest?
        // Let's normalize: logic usually prefers chronological for charts, but here we just need values for stats.

        const total = monthlyValues.reduce((a, b) => a + b, 0);
        const average = monthsCount > 0 ? total / monthsCount : 0;
        const min = Math.min(...monthlyValues);
        const max = Math.max(...monthlyValues);

        // Trend calculation
        // Compare last month (index 0) vs average
        const currentMonthVal = monthlyValues[0];
        let variation = 0;
        if (average > 0) variation = ((currentMonthVal - average) / average) * 100;
        else if (currentMonthVal > 0) variation = 100;

        let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
        if (variation > 15) trend = 'UP';
        else if (variation < -15) trend = 'DOWN';

        return {
            categoryId: cat.id,
            categoryName: cat.name,
            average, min, max, variation, trend,
            monthlyValues
        };
    }).filter(s => s.average > 0); // Only active categories

    return stats.sort((a, b) => b.average - a.average);
};
