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
        let supabaseAccounts: Account[] = [];
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.from('accounts').select('*');
            if (!error && data) {
                supabaseAccounts = (data as any[]).map(acc => ({
                    ...acc,
                    initial_balance: Number(acc.initial_balance || 0),
                    current_balance: Number(acc.balance || 0)
                }));
            }
        }

        // Recupera do LocalStorage (onde seus dados antigos podem estar presos)
        const stored = localStorage.getItem('exodo_accounts');
        let localAccounts: Account[] = [];
        if (stored) {
            try {
                localAccounts = JSON.parse(stored).map((acc: any) => ({
                    ...acc,
                    initial_balance: Number(acc.initial_balance || 0),
                    current_balance: Number(acc.current_balance || acc.balance || 0)
                }));
            } catch (e) { }
        }

        // MESCLAR: Combina o que está na nuvem com o que está no computador
        const mergedMap = new Map<string, Account>();
        localAccounts.forEach(acc => mergedMap.set(acc.id, acc));
        supabaseAccounts.forEach(acc => mergedMap.set(acc.id, acc));

        const finalAccounts = Array.from(mergedMap.values());
        console.log(`[Database] Recuperando Bancos... Encontrados ${supabaseAccounts.length} na nuvem e ${localAccounts.length} locais. Total: ${finalAccounts.length}`);

        return finalAccounts;
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
                    throw new Error(`Falha ao salvar na nuvem: ${error.message}`);
                }
                return;
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
                const supabaseCards = (data as any[]).map(card => ({
                    ...card,
                    limit: Number(card.limit_amount || 0),
                    limit_used: Number(card.limit_used || 0)
                }));

                if (supabaseCards.length === 0) {
                    const stored = localStorage.getItem('exodo_cards');
                    if (stored) {
                        try {
                            const localCards = JSON.parse(stored);
                            if (localCards.length > 0) return localCards;
                        } catch (e) { }
                    }
                }
                return supabaseCards;
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
                    throw new Error(`Falha ao salvar na nuvem: ${error.message}`);
                }
                return;
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
            if (error) {
                console.error('Error fetching transactions from Supabase:', error.message || error);
            } else if (data) {
                const excludedCount = (data as any[]).filter(t => t.status === 'EXCLUIDA').length;
                console.log(`[Database] Fetched ${data.length} transactions (${excludedCount} EXCLUIDA) from Supabase`);

                const supabaseTransactions = (data as any[]).map(t => ({
                    ...t,
                    amount: Number(t.amount || 0),
                    account_id: t.account_id,
                    category_id: t.category_id,
                    card_id: t.card_id,
                    recurrence_id: t.recurrence_id,
                    installments: t.installments_total ? {
                        current: t.installments_current,
                        total: t.installments_total
                    } : undefined,
                    photo_url: t.photo_url,
                    audio_url: t.audio_url
                }));

                const localStored = localStorage.getItem('exodo_transactions');
                if (localStored) {
                    try {
                        const localTrxs = JSON.parse(localStored) as Transaction[];

                        // Proteção de status (LocalStorage pode estar mais atualizado se a sync for lenta)
                        supabaseTransactions.forEach(st => {
                            const lt = localTrxs.find(l => l.id === st.id);
                            if (lt && lt.status === 'EXCLUIDA' && st.status !== 'EXCLUIDA') {
                                st.status = 'EXCLUIDA';
                                console.log(`[Database] Protection: Keeping ${st.description} as EXCLUIDA`);
                            }
                        });

                        // Itens locais (incluindo EXCLUIDA para evitar que o processador de recorrentes os recrie)
                        const localOnly = localTrxs.filter(lt =>
                            !supabaseTransactions.some(st => st.id === lt.id)
                        );

                        const mergedResult = [...supabaseTransactions, ...localOnly].sort((a, b) => b.date.localeCompare(a.date));

                        // PERSISTÊNCIA: Mantém o cache local sempre completo e atualizado
                        localStorage.setItem('exodo_transactions', JSON.stringify(mergedResult));
                        return mergedResult;
                    } catch (e) {
                        console.error('[Database] Error merging local transactions:', e);
                    }
                }

                // Mesmo sem LocalStorage, salva o que veio do Supabase para futuras consultas offline/proteção
                localStorage.setItem('exodo_transactions', JSON.stringify(supabaseTransactions));
                return supabaseTransactions;
            }
        }
        return this._getLocalTransactions();
    },

    async _getLocalTransactions(): Promise<Transaction[]> {
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
                        created_at: transaction.created_at,
                        photo_url: transaction.photo_url,
                        audio_url: transaction.audio_url
                    });
                    if (error) throw error;
                    console.log(`[Database] Saved ${transaction.description} to Supabase`);
                } catch (err: any) {
                    console.error('Supabase Save Error:', err);
                    throw new Error(`Falha ao sincronizar: ${err.message || 'Erro desconhecido'}`);
                }
            }
        }
        const transactions = await this._getLocalTransactions();
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
                const mapped = transactions.map(t => ({
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
                    created_at: t.created_at,
                    photo_url: t.photo_url,
                    audio_url: t.audio_url
                }));

                try {
                    const { error } = await supabase.from('transactions').upsert(mapped);
                    if (error) throw error;
                    console.log(`[Database] Successfully synced ${transactions.length} transactions to Supabase`);
                } catch (err: any) {
                    console.error('Supabase Batch Save Error:', err);
                    throw new Error(`Falha ao sincronizar lote: ${err.message || 'Erro desconhecido'}`);
                }
            }
        }

        const current = await this._getLocalTransactions();
        transactions.forEach(newT => {
            const index = current.findIndex(t => t.id === newT.id);
            if (index >= 0) current[index] = newT;
            else current.push(newT);
        });

        localStorage.setItem('exodo_transactions', JSON.stringify(current));
    },

    async deleteTransaction(id: string): Promise<void> {
        await this.deleteTransactions([id]);
    },

    async deleteTransactions(ids: string[]): Promise<void> {
        if (ids.length === 0) return;

        // 1. Sincroniza com Supabase
        if (isSupabaseConfigured()) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { error } = await supabase
                        .from('transactions')
                        .update({ status: 'EXCLUIDA' })
                        .in('id', ids)
                        .eq('user_id', user.id);
                    if (error) throw error;
                    console.log(`[Database] Marcado ${ids.length} transações como EXCLUIDA no Supabase`);
                }
            } catch (err) {
                console.error('Erro ao deletar no Supabase:', err);
            }
        }

        // 2. Sincroniza LocalStorage (Independente do Supabase)
        const stored = localStorage.getItem('exodo_transactions');
        if (stored) {
            try {
                const trxs = JSON.parse(stored) as Transaction[];
                let changed = false;
                trxs.forEach(t => {
                    if (ids.includes(t.id) && t.status !== 'EXCLUIDA') {
                        t.status = 'EXCLUIDA';
                        changed = true;
                    }
                });
                if (changed) {
                    localStorage.setItem('exodo_transactions', JSON.stringify(trxs));
                    console.log(`[Database] Marcado ${ids.length} transações como EXCLUIDA no LocalStorage`);
                }
            } catch (e) { }
        }
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
                    throw new Error(`Falha ao salvar na nuvem: ${error.message}`);
                }
                return;
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
            console.log(`[Database] Categories fetch: ${data?.length || 0} rows. Error:`, error);
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
                    console.error('Error saving categories to Supabase:', JSON.stringify(error));
                    if (error.code === '42703' || error.message?.includes('parent_id')) {
                        console.warn('[Supabase] Missing parent_id column. Trying without it...');
                        const fallbackUpsert = toUpsert.map(({ parent_id, ...rest }) => rest);
                        await supabase.from('categories').upsert(fallbackUpsert);
                    }
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
                    throw new Error(`Falha ao salvar meta na nuvem: ${error.message}`);
                }
                return;
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
                    throw new Error(`Falha ao salvar orçamento na nuvem: ${error.message}`);
                }
                return;
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
            if (error) {
                console.error('Error fetching recurring expenses from Supabase:', error.message || error);
            } else if (data) {
                return (data as any[]).map(rec => ({
                    ...rec,
                    amount: Number(rec.amount || 0),
                    programmed_amount: Number(rec.programmed_amount || rec.amount || 0),
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
                amount: Number(rec.amount || 0),
                programmed_amount: Number(rec.programmed_amount || rec.amount || 0)
            }));
        } catch {
            return [];
        }
    },

    async saveRecurringExpense(expense: RecurringExpense): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const payload: any = {
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
                    duration_count: expense.duration_count || null
                };

                // Add optional columns only if they don't cause errors (handled in catch)
                payload.programmed_amount = expense.programmed_amount || expense.amount;
                if (isValidUUID(expense.card_id)) payload.card_id = expense.card_id;

                try {
                    const { error } = await supabase.from('recurring_expenses').upsert(payload);
                    if (error) {
                        // Fallback: If programmed_amount column is missing, try without it
                        if (error.code === '42703' || error.message?.includes('programmed_amount')) {
                            console.warn('[Supabase] Missing programmed_amount column, retrying without it...');
                            const { programmed_amount, ...fallbackPayload } = payload;
                            const { error: error2 } = await supabase.from('recurring_expenses').upsert(fallbackPayload);
                            if (!error2) return;
                        }
                        throw error;
                    }
                    return;
                } catch (err: any) {
                    console.error('Error saving recurring expense to Supabase:', err);
                    throw new Error(`Falha ao salvar gasto recorrente na nuvem: ${err.message || 'Erro desconhecido'}`);
                }
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
    },

    async deleteAllUserData(): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const tables = [
                    'transactions',
                    'recurring_expenses',
                    'transfers',
                    'budgets',
                    'goals',
                    'cards',
                    'accounts',
                    'categories'
                ];
                console.log(`[Database] Starting nuclear reset for user ${user.id}...`);
                for (const table of tables) {
                    try {
                        const { error } = await supabase.from(table).delete().eq('user_id', user.id);
                        if (error) console.warn(`[Database] Error clearing table ${table}:`, error.message);
                        else console.log(`[Database] Table ${table} cleared.`);
                    } catch (e) {
                        console.error(`[Database] Failed to clear ${table}:`, e);
                    }
                }
            }
        }
    },

    async deletePartialUserData(): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                console.log(`[Database] Starting partial reset (Transactions & Recurring) for user ${user.id}...`);
                try {
                    await supabase.from('transactions').delete().eq('user_id', user.id);
                    await supabase.from('recurring_expenses').delete().eq('user_id', user.id);
                    console.log(`[Database] Transactions and Recurring rules cleared.`);
                } catch (e) {
                    console.error(`[Database] Failed partial clear:`, e);
                }
            }
        }
    },

    async deleteCustomUserData(tables: string[]): Promise<void> {
        if (isSupabaseConfigured()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && tables.length > 0) {
                console.log(`[Database] Starting custom reset for ${tables.length} modules...`);
                for (const table of tables) {
                    try {
                        await supabase.from(table).delete().eq('user_id', user.id);
                        console.log(`[Database] Table ${table} cleared.`);
                    } catch (e) {
                        console.error(`[Database] Failed clear for ${table}:`, e);
                    }
                }
            }
        }
    }
};
