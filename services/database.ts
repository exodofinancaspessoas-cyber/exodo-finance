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
                    ...account,
                    user_id: user.id
                });
                if (!error) return;
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
                    ...card,
                    user_id: user.id
                });
                if (!error) return;
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
                    ...transaction,
                    user_id: user.id
                });
                if (!error) return;
            }
        }
        const transactions = await this.getTransactions();
        const index = transactions.findIndex(t => t.id === transaction.id);
        if (index >= 0) transactions[index] = transaction;
        else transactions.push(transaction);
        localStorage.setItem('exodo_transactions', JSON.stringify(transactions));
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
                    ...transfer,
                    user_id: user.id
                });
                if (!error) return;
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
                    ...category,
                    user_id: user.id
                });
                if (!error) return;
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
                    ...goal,
                    user_id: user.id
                });
                if (!error) return;
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
                    ...budget,
                    user_id: user.id
                });
                if (!error) return;
            }
        }
        const budgets = await this.getBudgets();
        const index = budgets.findIndex(b => b.category_id === budget.category_id);
        if (index >= 0) budgets[index] = budget;
        else budgets.push(budget);
        localStorage.setItem('exodo_budgets', JSON.stringify(budgets));
    }
};
