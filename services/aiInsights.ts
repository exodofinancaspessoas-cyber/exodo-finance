import { Transaction, Budget, Category, Account, RecurringExpense, Goal } from '../types';
import { parseSafeDate, toISODate } from '../utils';

export type InsightSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Insight {
    id: string;
    message: string;
    severity: InsightSeverity;
    icon: string;
    targetView?: string;
}

interface InsightInput {
    transactions: Transaction[];
    budgets: Budget[];
    categories: Category[];
    accounts: Account[];
    recurring: RecurringExpense[];
    goals: Goal[];
    currentMonth: Date;
}

// Generate rule-based insights from financial data (no external API needed)
export function generateInsights(input: InsightInput): Insight[] {
    const { transactions, budgets, categories, accounts, recurring, goals, currentMonth } = input;
    const insights: Insight[] = [];
    const today = new Date();
    const todayStr = toISODate(today);
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();

    const monthTrxs = transactions.filter(t => {
        const p = parseSafeDate(t.date);
        return p && p.y === y && (p.m - 1) === m && t.status !== 'EXCLUIDA';
    });

    // Days remaining in current month
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
    const todayDay = today.getMonth() === m && today.getFullYear() === y ? today.getDate() : lastDayOfMonth;
    const daysRemaining = lastDayOfMonth - todayDay;

    // --- INSIGHT 1: Budget alerts ---
    budgets.forEach(budget => {
        const spent = monthTrxs
            .filter(t => t.category_id === budget.category_id && t.type === 'DESPESA' && (t.status === 'PAGA' || t.status === 'ATRASADA'))
            .reduce((s, t) => s + t.amount, 0);

        if (budget.amount <= 0) return;
        const pct = (spent / budget.amount) * 100;
        const catName = categories.find(c => c.id === budget.category_id)?.name || 'Categoria';

        if (pct >= 100) {
            insights.push({
                id: `budget-over-${budget.id}`,
                message: `🔴 Orçamento de ${catName} estourado! Você gastou ${formatBRL(spent)} de ${formatBRL(budget.amount)} (${Math.round(pct)}%).`,
                severity: 'CRITICAL',
                icon: '🔴',
                targetView: 'planning'
            });
        } else if (pct >= 80 && daysRemaining > 0) {
            insights.push({
                id: `budget-warn-${budget.id}`,
                message: `⚠️ Você usou ${Math.round(pct)}% do orçamento de ${catName} e ainda faltam ${daysRemaining} dia(s) no mês.`,
                severity: 'WARNING',
                icon: '⚠️',
                targetView: 'planning'
            });
        }
    });

    // --- INSIGHT 2: Negative projected balance ---
    const pendingExpenses = monthTrxs
        .filter(t => t.type === 'DESPESA' && (t.status === 'PREVISTA' || t.status === 'CONFIRMADA'))
        .reduce((s, t) => s + t.amount, 0);

    const pendingIncomes = monthTrxs
        .filter(t => t.type === 'RECEITA' && (t.status === 'PREVISTA' || t.status === 'CONFIRMADA'))
        .reduce((s, t) => s + t.amount, 0);

    const totalBalance = accounts.reduce((s, a) => s + (a.current_balance || 0), 0);
    const projectedBalance = totalBalance + pendingIncomes - pendingExpenses;

    if (projectedBalance < 0 && pendingExpenses > 0) {
        insights.push({
            id: 'negative-balance',
            message: `⚠️ Atenção: com as despesas previstas, seu saldo pode ficar ${formatBRL(Math.abs(projectedBalance))} negativo antes do fim do mês.`,
            severity: 'CRITICAL',
            icon: '⚠️',
            targetView: 'projection'
        });
    }

    // --- INSIGHT 3: Upcoming income ---
    const tomorrowStr = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
    const tomorrowIncome = transactions.filter(t =>
        t.type === 'RECEITA' && t.date === tomorrowStr && (t.status === 'PREVISTA' || t.status === 'CONFIRMADA')
    ).reduce((s, t) => s + t.amount, 0);

    if (tomorrowIncome > 0) {
        const afterExpenses = tomorrowIncome - pendingExpenses;
        insights.push({
            id: 'tomorrow-income',
            message: `💰 Você receberá amanhã ${formatBRL(tomorrowIncome)}. ${afterExpenses > 0 ? `Sobrará aproximadamente ${formatBRL(afterExpenses)} após as despesas previstas.` : 'Fique atento às despesas pendentes.'}`,
            severity: 'INFO',
            icon: '💰',
            targetView: 'incomes'
        });
    }

    // --- INSIGHT 4: Overdue transactions ---
    const overdue = transactions.filter(t => t.status === 'ATRASADA' && t.type === 'DESPESA');
    if (overdue.length > 0) {
        const total = overdue.reduce((s, t) => s + t.amount, 0);
        insights.push({
            id: 'overdue-bills',
            message: `🔴 Você tem ${overdue.length} conta(s) atrasada(s) totalizando ${formatBRL(total)}. Regularize para evitar juros.`,
            severity: 'CRITICAL',
            icon: '🔴',
            targetView: 'movements_overdue'
        });
    }

    // --- INSIGHT 5: Category spending above 3-month average ---
    const threeMonthsAgo = new Date(y, m - 3, 1);
    const categorySpendingMap: Record<string, number[]> = {};

    transactions.forEach(t => {
        if (t.type !== 'DESPESA' || t.status === 'EXCLUIDA' || !t.category_id) return;
        const p = parseSafeDate(t.date);
        if (!p) return;
        const tDate = new Date(p.y, p.m - 1, 1);
        if (tDate >= threeMonthsAgo) {
            if (!categorySpendingMap[t.category_id]) categorySpendingMap[t.category_id] = [];
            const monthIdx = (p.y - threeMonthsAgo.getFullYear()) * 12 + (p.m - 1) - threeMonthsAgo.getMonth();
            if (monthIdx < 3) {
                // Historical months only
                categorySpendingMap[t.category_id][monthIdx] = (categorySpendingMap[t.category_id][monthIdx] || 0) + t.amount;
            }
        }
    });

    Object.entries(categorySpendingMap).forEach(([catId, monthlyAmounts]) => {
        const historicalAvg = monthlyAmounts.filter(Boolean).reduce((s, v) => s + v, 0) / Math.max(monthlyAmounts.filter(Boolean).length, 1);
        const currentSpend = monthTrxs
            .filter(t => t.category_id === catId && t.type === 'DESPESA' && t.status !== 'EXCLUIDA')
            .reduce((s, t) => s + t.amount, 0);

        const catName = categories.find(c => c.id === catId)?.name;
        if (!catName || historicalAvg <= 0 || currentSpend <= 0) return;

        const increase = currentSpend - historicalAvg;
        if (increase > historicalAvg * 0.3 && increase > 50) {
            insights.push({
                id: `cat-spike-${catId}`,
                message: `📊 Seu gasto com ${catName} está ${formatBRL(increase)} acima da média dos últimos 3 meses. Confira se há alguma cobrança inesperada.`,
                severity: 'INFO',
                icon: '📊',
                targetView: 'expenses'
            });
        }
    });

    // --- INSIGHT 6: Goal near completion ---
    goals.filter(g => g.status === 'ACTIVE').forEach(goal => {
        const pct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
        if (pct >= 90 && pct < 100) {
            insights.push({
                id: `goal-near-${goal.id}`,
                message: `🎯 Você está quase lá! Meta "${goal.name}" atingiu ${Math.round(pct)}%. Faltam apenas ${formatBRL(goal.target_amount - goal.current_amount)}.`,
                severity: 'INFO',
                icon: '🎯',
                targetView: 'planning'
            });
        }
    });

    // Limit to 5 most important insights (CRITICAL first)
    return insights
        .sort((a, b) => {
            const order: Record<InsightSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
            return order[a.severity] - order[b.severity];
        })
        .slice(0, 5);
}

function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
