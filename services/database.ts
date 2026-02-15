import { supabase, isSupabaseConfigured } from './supabase';
import {
    Account, Card, Transaction, Category, RecurringExpense, Goal, Budget, Transfer
} from '../types';

// Helper to ensure we always get an array
const ensureArray = <T>(data: any): T[] => {
    return Array.isArray(data) ? data : [];
};

export const DatabaseService = {
    // ACCOUNTS
    async getAccounts(): Promise<Account[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('accounts').select('*');
            if (!error && data) return ensureArray<Account>(data);
        }
        const stored = localStorage.getItem('exodo_accounts');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Account>(parsed);
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
            const { error } = await supabase.from('accounts').delete().eq('id', id);
            if (!error) return;
        }
        const accounts = await this.getAccounts();
        const filtered = accounts.filter(a => a.id !== id);
        localStorage.setItem('exodo_accounts', JSON.stringify(filtered));
    },

    // CARDS
    async getCards(): Promise<Card[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('cards').select('*');
            if (!error && data) return ensureArray<Card>(data);
        }
        const stored = localStorage.getItem('exodo_cards');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Card>(parsed);
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
            if (!error && data) return ensureArray<Transaction>(data);
        }
        const stored = localStorage.getItem('exodo_transactions');
        try {
            const parsed = stored ? JSON.parse(stored) : [];
            return ensureArray<Transaction>(parsed);
        } catch {
            return [];
        }
    },

    async saveTransaction(transaction: Transaction): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('transactions').upsert({
                    id: transaction.id,
                    user_id: user.id,
                    description: transaction.description,
                    amount: transaction.amount,
                    type: transaction.type,
                    category_id: transaction.category_id,
                    account_id: transaction.account_id,
                    card_id: transaction.card_id,
                    date: transaction.date,
                    status: transaction.status,
                    payment_method: transaction.payment_method,
                    installments_current: transaction.installments?.current,
                    installments_total: transaction.installments?.total,
                    observation: transaction.observation,
                    created_at: transaction.created_at
                });
                if (error) {
                    console.error('Error saving transaction to Supabase:', error);
                } else {
                    return;
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
                    category_id: t.category_id,
                    account_id: t.account_id,
                    card_id: t.card_id,
                    date: t.date,
                    status: t.status,
                    payment_method: t.payment_method,
                    installments_current: t.installments?.current,
                    installments_total: t.installments?.total,
                    observation: t.observation,
                    created_at: t.created_at
                }));

                const { error } = await supabase.from('transactions').upsert(mappedTransactions);
                if (error) {
                    console.error('Error saving batch transactions to Supabase:', error);
                } else {
                    return;
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
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (!error) return;
        }
        const transactions = await this.getTransactions();
        const filtered = transactions.filter(t => t.id !== id);
        localStorage.setItem('exodo_transactions', JSON.stringify(filtered));
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
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('categories').upsert({
                    id: category.id,
                    user_id: user.id,
                    name: category.name,
                    type: category.type,
                    icon: category.icon,
                    color: category.color,
                    is_default: category.is_default
                });
                if (error) {
                    console.error('Error saving category to Supabase:', error);
                } else {
                    return;
                }
            }
        }
        const categories = await this.getCategories();
        const index = categories.findIndex(c => c.id === category.id);
        if (index >= 0) categories[index] = category;
        else categories.push(category);
        localStorage.setItem('exodo_categories', JSON.stringify(categories));
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
    }
};
