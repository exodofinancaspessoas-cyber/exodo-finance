import {
    User, Account, Card, Transaction, Category, Transfer,
    DashboardData, RecurringExpense, AppNotification,
    Goal, Budget
} from '../types';
import { DatabaseService } from './database';
import { toISODate } from '../utils';
import { INITIAL_CATEGORIES_DATA } from './initialCategories';

const STORAGE_KEYS = {
    USER: 'exodo_user',
    ACCOUNTS: 'exodo_accounts',
    CARDS: 'exodo_cards',
    TRANSACTIONS: 'exodo_transactions',
    TRANSFERS: 'exodo_transfers',
    CATEGORIES: 'exodo_categories',
    RECURRING_EXPENSES: 'exodo_recurring',
    NOTIFICATIONS: 'exodo_notifications',
    GOALS: 'exodo_goals',
    BUDGETS: 'exodo_budgets'
};

const APP_VERSION = '1.1.3';
const DEPLOY_DATE = '2026-02-16 13:45';

// --- HELPER FUNCTIONS ---
const getStorage = <T>(key: string, defaultValue: T): T => {
    const stored = localStorage.getItem(key);
    try {
        const parsed = stored ? JSON.parse(stored) : defaultValue;
        if (defaultValue instanceof Array && !Array.isArray(parsed)) return defaultValue;
        return parsed;
    } catch {
        return defaultValue;
    }
};

const setStorage = <T>(key: string, value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
};

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Helper for recurrence logic
const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

const addWeeks = (date: Date, weeks: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + (weeks * 7));
    return d;
};

const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

const addYears = (date: Date, years: number) => {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + years);
    return d;
};

const matchesYearMonth = (isoDate: string, target: Date) => {
    const [y, m] = isoDate.split('-').map(Number);
    return y === target.getFullYear() && (m - 1) === target.getMonth();
};

const getDefaultCategories = (): Category[] => [
    { id: 'cat_salario', name: 'Salário', type: 'RECEITA', icon: 'Briefcase', color: '#16a34a', is_default: true },
    { id: 'cat_invest', name: 'Investimentos', type: 'RECEITA', icon: 'TrendingUp', color: '#0ea5e9', is_default: true },
    { id: 'cat_casa', name: 'Moradia', type: 'DESPESA', icon: 'Home', color: '#ea580c', is_default: true },
    { id: 'cat_ali', name: 'Alimentação', type: 'DESPESA', icon: 'ShoppingCart', color: '#dc2626', is_default: true },
    { id: 'cat_trans', name: 'Transporte', type: 'DESPESA', icon: 'Car', color: '#f59e0b', is_default: true },
];

export const StorageService = {
    _isProcessingRecurring: false,
    _cache: {
        transactions: null as Transaction[] | null,
        accounts: null as Account[] | null,
        cards: null as Card[] | null,
        categories: null as Category[] | null,
        transfers: null as Transfer[] | null,
        recurring: null as RecurringExpense[] | null
    },
    _pending: {
        transactions: null as Promise<Transaction[]> | null,
        accounts: null as Promise<Account[]> | null,
        cards: null as Promise<Card[]> | null,
        categories: null as Promise<Category[]> | null,
        transfers: null as Promise<Transfer[]> | null,
        recurring: null as Promise<RecurringExpense[]> | null,
    },

    clearCache: () => {
        StorageService._cache = {
            transactions: null,
            accounts: null,
            cards: null,
            categories: null,
            transfers: null,
            recurring: null
        };
        StorageService._pending = {
            transactions: null,
            accounts: null,
            cards: null,
            categories: null,
            transfers: null,
            recurring: null
        };
    },

    generateId: () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    },

    // USER
    getUser: (): User | null => getStorage<User | null>(STORAGE_KEYS.USER, null),
    setUser: (user: User) => setStorage(STORAGE_KEYS.USER, user),
    logout: () => {
        localStorage.removeItem(STORAGE_KEYS.USER);
        StorageService.clearCache();
    },

    // RECURRING
    async getRecurringExpenses(): Promise<RecurringExpense[]> {
        if (StorageService._cache.recurring) return StorageService._cache.recurring;
        if (StorageService._pending.recurring) return StorageService._pending.recurring;

        StorageService._pending.recurring = DatabaseService.getRecurringExpenses();
        try {
            const data = await StorageService._pending.recurring;
            StorageService._cache.recurring = data;
            return data;
        } finally {
            StorageService._pending.recurring = null;
        }
    },

    async saveRecurringExpense(expense: RecurringExpense) {
        await DatabaseService.saveRecurringExpense(expense);
        StorageService.clearCache();
        await StorageService.processRecurringExpenses();
    },

    async deleteRecurringExpense(id: string) {
        await DatabaseService.deleteRecurringExpense(id);
        StorageService.clearCache();
    },

    async processRecurringExpenses() {
        if (StorageService._isProcessingRecurring) return;
        StorageService._isProcessingRecurring = true;
        console.log('[Recurring] Starting check for scheduled transactions...');

        try {
            const recurring = await StorageService.getRecurringExpenses();
            const transactions = await StorageService.getTransactions();
            const today = new Date();
            const newTransactions: Transaction[] = [];
            let changed = false;

            console.log(`[Recurring] Found ${recurring.length} recurring expenses. Transactions in memory: ${transactions.length}`);

            const defaultHorizon = 12;

            for (const rec of recurring) {
                if (!rec.active || !rec.auto_create) continue;

                const count = rec.duration_count || defaultHorizon;
                const startDate = rec.start_date ? new Date(rec.start_date) : today;

                for (let i = 0; i < count; i++) {
                    let targetDate: Date;
                    switch (rec.frequency) {
                        case 'DIARIO': targetDate = addDays(startDate, i); break;
                        case 'SEMANAL': targetDate = addWeeks(startDate, i); break;
                        case 'ANUAL': targetDate = addYears(startDate, i); break;
                        case 'MENSAL':
                        default:
                            targetDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
                            const lastDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
                            const day = Math.min(rec.day_of_month || 1, lastDay);
                            targetDate.setDate(day);
                            break;
                    }

                    const dateStr = toISODate(targetDate);
                    if (rec.end_date && dateStr > rec.end_date) break;

                    const exists = transactions.some(t => {
                        if (t.recurrence_id !== rec.id || t.status === 'EXCLUIDA' || !t.date) return false;
                        if (rec.frequency === 'MENSAL') {
                            const [ty, tm] = t.date.split('-').map(Number);
                            return ty === targetDate.getFullYear() && (tm - 1) === targetDate.getMonth();
                        }
                        return t.date === dateStr;
                    });

                    if (!exists) {
                        const newTrx: Transaction = {
                            id: generateId(),
                            description: rec.description,
                            amount: rec.amount,
                            type: 'DESPESA',
                            category_id: rec.category_id,
                            date: dateStr,
                            status: rec.type === 'FIXO' ? 'CONFIRMADA' : 'PREVISTA',
                            account_id: rec.account_id,
                            card_id: rec.card_id,
                            payment_method: rec.payment_method,
                            recurrence_id: rec.id,
                            created_at: new Date().toISOString()
                        };
                        newTransactions.push(newTrx);
                        transactions.push(newTrx);
                        rec.last_generated = new Date().toISOString();
                        changed = true;

                        if (matchesYearMonth(dateStr, today)) {
                            StorageService.addNotification({
                                id: generateId(),
                                title: 'Pagamento Programado',
                                message: `${rec.description} (R$ ${rec.amount}) para ${dateStr}.`,
                                type: 'INFO',
                                read: false,
                                date: new Date().toISOString()
                            });
                        }
                    }
                }
            }

            if (newTransactions.length > 0) {
                console.log(`[Recurring] Generated ${newTransactions.length} items. Syncing...`);
                await DatabaseService.saveTransactions(newTransactions);
            }

            if (changed) {
                for (const rec of recurring) {
                    if (rec.last_generated) await DatabaseService.saveRecurringExpense(rec);
                }
                StorageService.clearCache();
            }
        } catch (err) {
            console.error('[Recurring] Error:', err);
        } finally {
            StorageService._isProcessingRecurring = false;
        }
    },

    // ACCOUNTS
    async getAccounts(): Promise<Account[]> {
        const [accounts, transactions, transfers] = await Promise.all([
            StorageService._getAccountsRaw(),
            StorageService.getTransactions(),
            StorageService.getTransfers()
        ]);

        const balanceMap = new Map<string, number>();
        accounts.forEach(acc => balanceMap.set(acc.id, acc.initial_balance || 0));

        transactions.forEach(t => {
            if (t.account_id) {
                const current = balanceMap.get(t.account_id) || 0;
                if (t.type === 'RECEITA' && (t.status === 'RECEBIDA' || t.status === 'CONFIRMADA')) {
                    balanceMap.set(t.account_id, current + t.amount);
                } else if (t.type === 'DESPESA' && t.status === 'PAGA') {
                    balanceMap.set(t.account_id, current - t.amount);
                }
            }
        });

        transfers.forEach(t => {
            if (t.from_account_id) balanceMap.set(t.from_account_id, (balanceMap.get(t.from_account_id) || 0) - t.amount);
            if (t.to_account_id) balanceMap.set(t.to_account_id, (balanceMap.get(t.to_account_id) || 0) + t.amount);
        });

        return accounts.map(acc => ({
            ...acc,
            current_balance: balanceMap.get(acc.id) || acc.initial_balance || 0
        }));
    },

    async _getAccountsRaw(): Promise<Account[]> {
        if (StorageService._cache.accounts) return StorageService._cache.accounts;
        if (StorageService._pending.accounts) return StorageService._pending.accounts;
        StorageService._pending.accounts = DatabaseService.getAccounts();
        try {
            const data = await StorageService._pending.accounts;
            StorageService._cache.accounts = data;
            return data;
        } finally {
            StorageService._pending.accounts = null;
        }
    },

    async saveAccount(account: Account) {
        await DatabaseService.saveAccount(account);
        StorageService.clearCache();
    },

    async deleteAccount(id: string) {
        await DatabaseService.deleteAccount(id);
        StorageService.clearCache();
    },

    // CARDS
    async getCards(): Promise<Card[]> {
        const [cards, transactions] = await Promise.all([
            StorageService._getCardsRaw(),
            StorageService.getTransactions()
        ]);

        const cardUsageMap = new Map<string, number>();
        transactions.forEach(t => {
            if (t.card_id && t.type === 'DESPESA' && t.status !== 'PAGA') {
                const current = cardUsageMap.get(t.card_id) || 0;
                cardUsageMap.set(t.card_id, current + t.amount);
            }
        });

        return cards.map(c => ({
            ...c,
            limit_used: cardUsageMap.get(c.id) || 0
        }));
    },

    async _getCardsRaw(): Promise<Card[]> {
        if (StorageService._cache.cards) return StorageService._cache.cards;
        if (StorageService._pending.cards) return StorageService._pending.cards;
        StorageService._pending.cards = DatabaseService.getCards();
        try {
            const data = await StorageService._pending.cards;
            StorageService._cache.cards = data;
            return data;
        } finally {
            StorageService._pending.cards = null;
        }
    },

    async saveCard(card: Card) {
        await DatabaseService.saveCard(card);
        StorageService.clearCache();
    },

    async deleteCard(id: string) {
        await DatabaseService.deleteCard(id);
        StorageService.clearCache();
    },

    // TRANSACTIONS
    async getTransactions(): Promise<Transaction[]> {
        if (StorageService._cache.transactions) return StorageService._cache.transactions;
        if (StorageService._pending.transactions) return StorageService._pending.transactions;

        StorageService._pending.transactions = DatabaseService.getTransactions();
        try {
            const trxs = await StorageService._pending.transactions;
            StorageService._cache.transactions = trxs;

            const todayStr = toISODate(new Date());
            const toUpdate: Transaction[] = [];

            trxs.forEach(t => {
                if ((t.status === 'PREVISTA' || t.status === 'CONFIRMADA') && t.type === 'DESPESA' && t.date < todayStr) {
                    t.status = 'ATRASADA';
                    toUpdate.push(t);
                }
            });

            if (toUpdate.length > 0) {
                await DatabaseService.saveTransactions(toUpdate);
            }
            return trxs;
        } finally {
            StorageService._pending.transactions = null;
        }
    },

    async saveTransaction(transaction: Transaction) {
        await DatabaseService.saveTransaction(transaction);
        StorageService.clearCache();
    },

    async saveTransactions(transactions: Transaction[]) {
        await DatabaseService.saveTransactions(transactions);
        StorageService.clearCache();
    },

    async deleteTransaction(id: string) {
        await DatabaseService.deleteTransaction(id);
        StorageService.clearCache();
    },

    // CATEGORIES
    async getCategories(): Promise<Category[]> {
        if (StorageService._cache.categories) return StorageService._cache.categories;
        if (StorageService._pending.categories) return StorageService._pending.categories;
        StorageService._pending.categories = DatabaseService.getCategories();
        try {
            const stored = await StorageService._pending.categories;
            const data = stored.length > 0 ? stored : getDefaultCategories();
            StorageService._cache.categories = data;
            return data;
        } finally {
            StorageService._pending.categories = null;
        }
    },

    async saveCategory(category: Category) {
        await DatabaseService.saveCategory(category);
        StorageService.clearCache();
    },

    async saveCategories(categories: Category[]) {
        await DatabaseService.saveCategories(categories);
        StorageService.clearCache();
    },

    async resetCategories(): Promise<void> {
        localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
        await StorageService.initializeDefaultCategories(true);
    },

    async initializeDefaultCategories(force = false) {
        const existing = await StorageService.getCategories();
        if (!force && existing.length > 10) return;

        const allToSave: Category[] = [];
        for (const mainCat of INITIAL_CATEGORIES_DATA) {
            const parentId = generateId();
            allToSave.push({ id: parentId, name: mainCat.name, type: 'DESPESA', color: mainCat.color, icon: 'Folder' });
            for (const subName of mainCat.sub) {
                allToSave.push({ id: generateId(), name: subName, type: 'DESPESA', color: mainCat.color, icon: 'Tag', parent_id: parentId });
            }
        }
        await StorageService.saveCategories(allToSave);
    },

    // TRANSFERS
    async getTransfers(): Promise<Transfer[]> {
        if (StorageService._cache.transfers) return StorageService._cache.transfers;
        if (StorageService._pending.transfers) return StorageService._pending.transfers;
        StorageService._pending.transfers = DatabaseService.getTransfers();
        try {
            const data = await StorageService._pending.transfers;
            StorageService._cache.transfers = data;
            return data;
        } finally {
            StorageService._pending.transfers = null;
        }
    },

    async saveTransfer(transfer: Transfer) {
        await DatabaseService.saveTransfer(transfer);
        StorageService.clearCache();
    },

    // GOALS
    async getGoals(): Promise<Goal[]> { return await DatabaseService.getGoals(); },
    async saveGoal(goal: Goal) { await DatabaseService.saveGoal(goal); },
    async deleteGoal(id: string) { await DatabaseService.deleteGoal(id); },

    // BUDGETS
    async getBudgets(): Promise<Budget[]> { return await DatabaseService.getBudgets(); },
    async saveBudget(budget: Budget) { await DatabaseService.saveBudget(budget); },

    // NOTIFICATIONS
    getNotifications: (): AppNotification[] => getStorage<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []),
    addNotification: (notification: AppNotification) => {
        const list = StorageService.getNotifications();
        list.unshift(notification);
        setStorage(STORAGE_KEYS.NOTIFICATIONS, list.slice(0, 50));
    },
    markNotificationRead: (id: string) => {
        const list = StorageService.getNotifications();
        const item = list.find(n => n.id === id);
        if (item) {
            item.read = true;
            setStorage(STORAGE_KEYS.NOTIFICATIONS, list);
        }
    },

    // VERSION
    getVersion: () => ({ version: APP_VERSION, date: DEPLOY_DATE })
};
