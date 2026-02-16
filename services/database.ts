import { supabase, isSupabaseConfigured } from './supabase';
import {
    Account, Card, Transaction, Category, RecurringExpense, Goal, Budget, Transfer
} from '../types';

// Helper to ensure we always get an array
const ensureArray = <T>(data: any): T[] => {
    return Array.isArray(data) ? data : [];
};

// Helper to validate UUIDs
const isValidUUID = (uuid: string | null | undefined): boolean => {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

export const DatabaseService = {
    // ACCOUNTS
    async getAccounts(): Promise<Account[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('accounts').select('*');
            if (!error && data) {
                return (data as any[]).map(acc => ({
                    ...acc,
                    initial_balance: Number(acc.initial_balance || 0),
                    current_balance: Number(acc.balance || 0)
                }));
            }
        }
        const stored = localStorage.getItem('exodo_accounts');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Account>(parsed).map(acc => ({
                ...acc,
                initial_balance: Number(acc.initial_balance || 0),
                current_balance: Number(acc.current_balance || 0)
            }));
        } catch {
            return [];
        }
    },

    async saveAccount(account: Account): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('accounts').upsert({
                    id: account.id,
                    user_id: user.id,
                    name: account.name,
                    type: account.type,
                    bank: account.bank,
                    initial_balance: account.initial_balance,
                    balance: account.current_balance || 0,
                    color: account.color
                });
                if (error) {
                    console.error('Error saving account to Supabase:', error);
                } else {
                    return;
                }
            }
        }
        const accounts = await this.getAccounts();
        const index = accounts.findIndex(a => a.id === account.id);
        if (index >= 0) accounts[index] = account;
        else accounts.push(account);
        localStorage.setItem('exodo_accounts', JSON.stringify(accounts));
    },

    async deleteAccount(id: string): Promise<void> {
        if (isSupabaseConfigured()) {
            // 1. Delete linked transactions
            await supabase.from('transactions').delete().eq('account_id', id);

            // 2. Delete linked cards
            await supabase.from('cards').delete().eq('account_id', id);

            // 3. Delete linked transfers (from or to)
            await supabase.from('transfers').delete().or(`from_account_id.eq.${id},to_account_id.eq.${id}`);

            // 4. Finally delete the account
            const { error } = await supabase.from('accounts').delete().eq('id', id);
            if (!error) return;
        }
        const accounts = await this.getAccounts();
        const filtered = accounts.filter(a => a.id !== id);
        localStorage.setItem('exodo_accounts', JSON.stringify(filtered));

        // Localstorage fallback for related data (simplified)
        const trxs = localStorage.getItem('exodo_transactions');
        if (trxs) {
            const parsed = JSON.parse(trxs);
            localStorage.setItem('exodo_transactions', JSON.stringify(parsed.filter((t: any) => t.account_id !== id)));
        }
    },

    // CARDS
    async getCards(): Promise<Card[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('cards').select('*');
            if (!error && data) {
                return (data as any[]).map(card => ({
                    ...card,
                    limit: Number(card.limit_amount || 0),
                    limit_used: Number(card.limit_used || 0)
                }));
            }
        }
        const stored = localStorage.getItem('exodo_cards');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Card>(parsed).map(card => ({
                ...card,
                limit: Number(card.limit || 0),
                limit_used: Number(card.limit_used || 0)
            }));
        } catch {
            return [];
        }
    },

    async saveCard(card: Card): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('cards').upsert({
                    id: card.id,
                    user_id: user.id,
                    name: card.name,
                    limit_amount: card.limit,
                    closing_day: card.closing_day,
                    due_day: card.due_day,
                    brand: card.brand,
                    bank: card.bank,
                    account_id: card.account_id,
                    color: card.color
                });
                if (error) {
                    console.error('Error saving card to Supabase:', error);
                } else {
                    return;
                }
            }
        }
        const cards = await this.getCards();
        const index = cards.findIndex(c => c.id === card.id);
        if (index >= 0) cards[index] = card;
        else cards.push(card);
        localStorage.setItem('exodo_cards', JSON.stringify(cards));
    },

    async deleteCard(id: string): Promise<void> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('cards').delete().eq('id', id);
            if (!error) return;
        }
        const cards = await this.getCards();
        const filtered = cards.filter(c => c.id !== id);
        localStorage.setItem('exodo_cards', JSON.stringify(filtered));
    },

    // TRANSACTIONS
    async getTransactions(): Promise<Transaction[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
            if (!error && data) {
                return (data as any[]).map(t => ({
                    ...t,
                    amount: Number(t.amount || 0),
                    account_id: t.account_id,
                    category_id: t.category_id,
                    card_id: t.card_id,
                    recurrence_id: t.recurrence_id,
                    installments: t.installments_total ? {
                        current: t.installments_current,
                        total: t.installments_total
                    } : undefined
                }));
            }
        }
        const stored = localStorage.getItem('exodo_transactions');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Transaction>(parsed).map(t => ({
                ...t,
                amount: Number(t.amount || 0)
            }));
        } catch {
            return [];
        }
    },

    async saveTransaction(transaction: Transaction): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                try {
                    const { error } = await supabase.from('transactions').upsert({
                        id: transaction.id,
                        user_id: user.id,
                        description: transaction.description,
                        amount: transaction.amount,
                        type: transaction.type,
                        category_id: isValidUUID(transaction.category_id) ? transaction.category_id : null,
                        account_id: isValidUUID(transaction.account_id) ? transaction.account_id : null,
                        card_id: isValidUUID(transaction.card_id) ? transaction.card_id : null,
                        date: transaction.date,
                        status: transaction.status,
                        payment_method: transaction.payment_method,
                        installments_current: transaction.installments?.current,
                        installments_total: transaction.installments?.total,
                        recurrence_id: transaction.recurrence_id,
                        observation: transaction.observation,
                        created_at: transaction.created_at
                    });
                    if (error) throw error;
                    return;
                } catch (err) {
                    console.error('Supabase Save Error (falling back to LocalStorage):', err);
                    // Continue to local storage fallback
                }
            }
        }
        const transactions = await this.getTransactions();
        const index = transactions.findIndex(t => t.id === transaction.id);
        if (index >= 0) transactions[index] = transaction;
        else transactions.push(transaction);
        localStorage.setItem('exodo_transactions', JSON.stringify(transactions));
    },

    async saveTransactions(transactions: Transaction[]): Promise<void> {
        if (transactions.length === 0) return;

        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const mappedTransactions = transactions.map(t => ({
                    id: t.id,
                    user_id: user.id,
                    description: t.description,
                    amount: t.amount,
                    type: t.type,
                    category_id: isValidUUID(t.category_id) ? t.category_id : null,
                    account_id: isValidUUID(t.account_id) ? t.account_id : null,
                    card_id: isValidUUID(t.card_id) ? t.card_id : null,
                    date: t.date,
                    status: t.status,
                    payment_method: t.payment_method,
                    installments_current: t.installments?.current,
                    installments_total: t.installments?.total,
                    recurrence_id: t.recurrence_id,
                    observation: t.observation,
                    created_at: t.created_at
                }));

                try {
                    const { error } = await supabase.from('transactions').upsert(mappedTransactions);
                    if (error) throw error;
                    return;
                } catch (err) {
                    console.error('Supabase Batch Save Error:', err);
                }
            }
        }

        const currentTransactions = await this.getTransactions();
        const updatedList = [...currentTransactions];

        transactions.forEach(newT => {
            const index = updatedList.findIndex(t => t.id === newT.id);
            if (index >= 0) updatedList[index] = newT;
            else updatedList.push(newT);
        });

        localStorage.setItem('exodo_transactions', JSON.stringify(updatedList));
    },

    async deleteTransaction(id: string): Promise<void> {
        const transactions = await this.getTransactions();
        const trx = transactions.find(t => t.id === id);
        if (!trx) return;

        trx.status = 'EXCLUIDA';

        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                try {
                    const { error } = await supabase.from('transactions').upsert({
                        id: trx.id,
                        user_id: user.id,
                        description: trx.description,
                        amount: trx.amount,
                        type: trx.type,
                        date: trx.date,
                        status: 'EXCLUIDA',
                        created_at: trx.created_at
                    });
                    if (error) throw error;
                    return;
                } catch (err) {
                    console.error('Supabase Soft Delete Error:', err);
                }
            }
        }

        localStorage.setItem('exodo_transactions', JSON.stringify(transactions));
    },

    // TRANSFERS
    async getTransfers(): Promise<Transfer[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('transfers').select('*').order('date', { ascending: false });
            if (!error && data) return ensureArray<Transfer>(data);
        }
        const stored = localStorage.getItem('exodo_transfers');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Transfer>(parsed);
        } catch {
            return [];
        }
    },

    async saveTransfer(transfer: Transfer): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('transfers').upsert({
                    id: transfer.id,
                    user_id: user.id,
                    description: transfer.description,
                    amount: transfer.amount,
                    from_account_id: transfer.from_account_id,
                    to_account_id: transfer.to_account_id,
                    date: transfer.date,
                    created_at: transfer.created_at
                });
                if (error) {
                    console.error('Error saving transfer to Supabase:', error);
                } else {
                    return;
                }
            }
        }
        const transfers = await this.getTransfers();
        const index = transfers.findIndex(t => t.id === transfer.id);
        if (index >= 0) transfers[index] = transfer;
        else transfers.push(transfer);
        localStorage.setItem('exodo_transfers', JSON.stringify(transfers));
    },

    // CATEGORIES
    async getCategories(): Promise<Category[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('categories').select('*');
            if (!error && data) return ensureArray<Category>(data);
        }
        const stored = localStorage.getItem('exodo_categories');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Category>(parsed);
        } catch {
            return [];
        }
    },

    async saveCategory(category: Category): Promise<void> {
        await this.saveCategories([category]);
    },

    async saveCategories(categories: Category[]): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const toUpsert = categories.map(c => ({
                    id: c.id,
                    user_id: user.id,
                    name: c.name,
                    type: c.type,
                    icon: c.icon,
                    color: c.color,
                    is_default: c.is_default,
                    parent_id: c.parent_id
                }));

                const { error } = await supabase.from('categories').upsert(toUpsert);
                if (error) {
                    console.error('Error saving categories to Supabase:', error);
                } else {
                    return;
                }
            }
        }
        const existing = await this.getCategories();
        const updated = [...existing];

        categories.forEach(category => {
            const index = updated.findIndex(c => c.id === category.id);
            if (index >= 0) updated[index] = category;
            else updated.push(category);
        });

        localStorage.setItem('exodo_categories', JSON.stringify(updated));
    },

    async deleteCategory(id: string): Promise<void> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (!error) return;
            console.error('Error deleting category from Supabase:', error);
        }
        const categories = await this.getCategories();
        localStorage.setItem('exodo_categories', JSON.stringify(categories.filter(c => c.id !== id)));
    },

    // FALLBACKS/OTHERS (Will implement as needed)
    async getGoals(): Promise<Goal[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('goals').select('*');
            if (!error && data) return ensureArray<Goal>(data);
        }
        const stored = localStorage.getItem('exodo_goals');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Goal>(parsed);
        } catch {
            return [];
        }
    },

    async saveGoal(goal: Goal): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('goals').upsert({
                    id: goal.id,
                    user_id: user.id,
                    name: goal.name,
                    target_amount: goal.target_amount,
                    current_amount: goal.current_amount,
                    deadline: goal.deadline,
                    status: goal.status,
                    color: '#f97316', // default color or get from goal if exists
                    icon: goal.icon
                });
                if (error) {
                    console.error('Error saving goal to Supabase:', error);
                } else {
                    return;
                }
            }
        }
        const goals = await this.getGoals();
        const index = goals.findIndex(g => g.id === goal.id);
        if (index >= 0) goals[index] = goal;
        else goals.push(goal);
        localStorage.setItem('exodo_goals', JSON.stringify(goals));
    },

    async deleteGoal(id: string): Promise<void> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('goals').delete().eq('id', id);
            if (!error) return;
        }
        const goals = await this.getGoals();
        const filtered = goals.filter(g => g.id !== id);
        localStorage.setItem('exodo_goals', JSON.stringify(filtered));
    },

    async getBudgets(): Promise<Budget[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('budgets').select('*');
            if (!error && data) return ensureArray<Budget>(data);
        }
        const stored = localStorage.getItem('exodo_budgets');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Budget>(parsed);
        } catch {
            return [];
        }
    },

    async saveBudget(budget: Budget): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('budgets').upsert({
                    id: budget.id,
                    user_id: user.id,
                    category_id: budget.category_id,
                    amount: budget.amount,
                    month: new Date().toISOString().substring(0, 7) // Default to current month YYYY-MM
                });
                if (error) {
                    console.error('Error saving budget to Supabase:', error);
                } else {
                    return;
                }
            }
        }
        const budgets = await this.getBudgets();
        const index = budgets.findIndex(b => b.category_id === budget.category_id);
        if (index >= 0) budgets[index] = budget;
        else budgets.push(budget);
        localStorage.setItem('exodo_budgets', JSON.stringify(budgets));
    },

    // RECURRING EXPENSES
    async getRecurringExpenses(): Promise<RecurringExpense[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('recurring_expenses').select('*');
            if (!error && data) {
                return (data as any[]).map(rec => ({
                    ...rec,
                    amount: Number(rec.amount || 0),
                    type: rec.type as any, // FIXO or VARIAVEL
                    start_date: rec.start_date,
                    end_date: rec.end_date,
                    duration_count: rec.duration_count,
                    payment_method: rec.payment_method
                }));
            }
        }
        const stored = localStorage.getItem('exodo_recurring');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<RecurringExpense>(parsed).map(rec => ({
                ...rec,
                amount: Number(rec.amount || 0)
            }));
        } catch {
            return [];
        }
    },

    async saveRecurringExpense(expense: RecurringExpense): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('recurring_expenses').upsert({
                    id: expense.id,
                    user_id: user.id,
                    description: expense.description,
                    amount: expense.amount,
                    category_id: expense.category_id || null,
                    account_id: expense.account_id || null,
                    frequency: expense.frequency,
                    day_of_month: expense.day_of_month,
                    type: expense.type,
                    active: expense.active,
                    auto_create: expense.auto_create,
                    last_generated: expense.last_generated || null,
                    start_date: expense.start_date || null,
                    end_date: expense.end_date || null,
                    payment_method: expense.payment_method || null,
                    duration_count: expense.duration_count || null,
                    card_id: isValidUUID(expense.card_id) ? expense.card_id : null
                });
                if (error) {
                    console.error('Error saving recurring expense to Supabase:', error);
                    throw error;
                }
                return;
            }
        }
        const list = await this.getRecurringExpenses();
        const index = list.findIndex(i => i.id === expense.id);
        if (index >= 0) list[index] = expense;
        else list.push(expense);
        localStorage.setItem('exodo_recurring', JSON.stringify(list));
    },

    async deleteRecurringExpense(id: string): Promise<void> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
            if (!error) return;
            else throw error;
        }
        const list = await this.getRecurringExpenses();
        const filtered = list.filter(i => i.id !== id);
        localStorage.setItem('exodo_recurring', JSON.stringify(filtered));
    }
};
