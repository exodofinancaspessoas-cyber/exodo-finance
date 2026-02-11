import { supabase, isSupabaseConfigured } from './supabase';
import {
    Account, Card, Transaction, Category, RecurringExpense, Goal, Budget
} from '../types';

// This service acts as a bridge. If Supabase is configured and the user is logged in, 
// it uses the cloud. Otherwise, it falls back to LocalStorage.

export const DatabaseService = {
    // ACCOUNTS
    async getAccounts(): Promise<Account[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('accounts').select('*');
            if (!error && data) return data as Account[];
        }
        // Fallback to LocalStorage (old logic)
        const stored = localStorage.getItem('exodo_accounts');
        return stored ? JSON.parse(stored) : [];
    },

    async saveAccount(account: Account): Promise<void> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('accounts').upsert(account);
            if (!error) return;
        }
        // Fallback
        const accounts = await this.getAccounts();
        const index = accounts.findIndex(a => a.id === account.id);
        if (index >= 0) accounts[index] = account;
        else accounts.push(account);
        localStorage.setItem('exodo_accounts', JSON.stringify(accounts));
    },

    // CARDS
    async getCards(): Promise<Card[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('cards').select('*');
            if (!error && data) return data as any[]; // Map correctly if needed
        }
        const stored = localStorage.getItem('exodo_cards');
        return stored ? JSON.parse(stored) : [];
    },

    async saveCard(card: Card): Promise<void> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('cards').upsert(card);
            if (!error) return;
        }
        const cards = await this.getCards();
        const index = cards.findIndex(c => c.id === card.id);
        if (index >= 0) cards[index] = card;
        else cards.push(card);
        localStorage.setItem('exodo_cards', JSON.stringify(cards));
    },

    // TRANSACTIONS
    async getTransactions(): Promise<Transaction[]> {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
            if (!error && data) return data as Transaction[];
        }
        const stored = localStorage.getItem('exodo_transactions');
        return stored ? JSON.parse(stored) : [];
    },

    async saveTransaction(transaction: Transaction): Promise<void> {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('transactions').upsert(transaction);
            if (!error) return;
        }
        const transactions = await this.getTransactions();
        const index = transactions.findIndex(t => t.id === transaction.id);
        if (index >= 0) transactions[index] = transaction;
        else transactions.push(transaction);
        localStorage.setItem('exodo_transactions', JSON.stringify(transactions));
    }

    // ... we will expand this for all other types (Categories, Goals, etc)
};
