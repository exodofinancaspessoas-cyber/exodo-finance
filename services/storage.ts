import {
    User, Account, Card, Transaction, TransactionType, Category, Transfer,
    DashboardData, RecurringExpense, AppNotification,
    Goal, Budget
} from '../types';
import { DatabaseService } from './database';
import { supabase } from './supabase';
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

const APP_VERSION = '1.1.5';
const DEPLOY_DATE = '2026-02-20 18:15';

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

    // Proper UUID v4 fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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
    { id: '11111111-1111-4111-a111-111111111111', name: 'Salário', type: 'RECEITA', icon: 'Briefcase', color: '#16a34a', is_default: true },
    { id: '22222222-2222-4222-a222-222222222222', name: 'Investimentos', type: 'RECEITA', icon: 'TrendingUp', color: '#0ea5e9', is_default: true },
    { id: '33333333-3333-4333-a333-333333333333', name: 'Moradia', type: 'DESPESA', icon: 'Home', color: '#ea580c', is_default: true },
    { id: '44444444-4444-4444-a444-444444444444', name: 'Alimentação', type: 'DESPESA', icon: 'ShoppingCart', color: '#dc2626', is_default: true },
    { id: '55555555-5555-4555-a555-555555555555', name: 'Transporte', type: 'DESPESA', icon: 'Car', color: '#f59e0b', is_default: true },
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

    generateId: () => generateId(),

    // STORAGE (Supabase Buckets)
    async uploadEvidence(file: File | Blob, type: 'photo' | 'audio'): Promise<string | null> {
        if (!supabase) return null;

        // VALIDAÇÃO DE SEGURANÇA
        const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
        const MAX_AUDIO_SIZE = 2 * 1024 * 1024; // 2MB

        const sizeLimit = type === 'photo' ? MAX_PHOTO_SIZE : MAX_AUDIO_SIZE;
        if (file.size > sizeLimit) {
            console.error(`File too large: ${file.size} bytes. Limit for ${type} is ${sizeLimit} bytes.`);
            alert(`O arquivo é muito grande! O limite para ${type === 'photo' ? 'fotos' : 'áudio'} é de ${type === 'photo' ? '5MB' : '2MB'}.`);
            return null;
        }

        // Validate MIME type
        if (type === 'photo' && !file.type.startsWith('image/')) {
            console.error('Invalid photo type:', file.type);
            return null;
        }
        if (type === 'audio' && !file.type.startsWith('audio/') && !file.type.includes('application/octet-stream')) {
            // Some browsers use octet-stream for blobs
            console.error('Invalid audio type:', file.type);
        }

        const fileName = `${type}_${StorageService.generateId()}.${type === 'photo' ? 'jpg' : 'webm'}`;
        const filePath = `${fileName}`;

        try {
            const { data, error } = await supabase.storage
                .from('evidences')
                .upload(filePath, file, {
                    contentType: file.type,
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Retornamos apenas o nome do arquivo para salvar no banco.
            // O link assinado será gerado apenas sob demanda para visualização.
            return fileName;
        } catch (error) {
            console.error('Error uploading to Supabase Storage:', error);
            return null;
        }
    },

    async getSignedUrl(fileName: string | null | undefined): Promise<string | null> {
        if (!supabase || !fileName) return null;

        try {
            // Gera uma URL assinada válida por 1 hora (3600 segundos)
            const { data, error } = await supabase.storage
                .from('evidences')
                .createSignedUrl(fileName, 3600);

            if (error) throw error;
            return data.signedUrl;
        } catch (error) {
            console.error('Error generating signed URL:', error);
            return null;
        }
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

    async nuclearReset() {
        await DatabaseService.deleteAllUserData();
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    },

    async partialReset() {
        await DatabaseService.deletePartialUserData();
        localStorage.removeItem('exodo_transactions');
        localStorage.removeItem('exodo_recurring');
        StorageService.clearCache();
        localStorage.removeItem('onboarding_completed');
        window.location.reload();
    },

    async customReset(tables: string[]) {
        await DatabaseService.deleteCustomUserData(tables);

        // Map table names to LocalStorage keys
        const keyMap: Record<string, string> = {
            'transactions': 'exodo_transactions',
            'recurring_expenses': 'exodo_recurring',
            'transfers': 'exodo_transfers',
            'goals': 'exodo_goals',
            'budgets': 'exodo_budgets',
            'accounts': 'exodo_accounts',
            'cards': 'exodo_cards'
        };

        tables.forEach(table => {
            const key = keyMap[table];
            if (key) localStorage.removeItem(key);
        });

        StorageService.clearCache();
        localStorage.removeItem('onboarding_completed');
        window.location.reload();
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

            const categories = await StorageService.getCategories();

            for (const rec of recurring) {
                if (!rec.active || !rec.auto_create) continue;

                const cat = categories.find(c => c.id === rec.category_id);
                const entryType = (cat?.type === 'AMBOS' ? 'DESPESA' : cat?.type || 'DESPESA') as TransactionType;

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
                        if (t.recurrence_id !== rec.id || !t.date) return false;

                        // Consider it "exists" even if EXCLUIDA, to prevent re-creation of deleted items
                        let isSamePeriod = false;
                        if (rec.frequency === 'MENSAL') {
                            const [ty, tm] = t.date.split('-').map(Number);
                            isSamePeriod = ty === targetDate.getFullYear() && (tm - 1) === targetDate.getMonth();
                        } else {
                            isSamePeriod = t.date === dateStr;
                        }

                        return isSamePeriod;
                    });

                    if (exists) {
                        // console.log(`[Recurring] Skipping ${rec.description} for ${dateStr} - already exists.`);
                    } else {
                        const targetAmount = rec.programmed_amount ?? rec.amount;
                        const isFuture = dateStr > toISODate(today);

                        // Logic: Future transactions are ALWAYS 'PREVISTA' to allow user adjustment and accurate projections.
                        // Only FIXED transactions for TODAY or PAST are marked as PAID/RECEIVED.
                        const finalStatus = (rec.type === 'FIXO' && !isFuture)
                            ? (entryType === 'RECEITA' ? 'RECEBIDA' : 'PAGA')
                            : 'PREVISTA';

                        const newTrx: Transaction = {
                            id: generateId(),
                            description: rec.description,
                            amount: targetAmount,
                            type: entryType,
                            category_id: rec.category_id,
                            date: dateStr,
                            status: finalStatus,
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
                                title: entryType === 'RECEITA' ? 'Receita Programada' : 'Pagamento Programado',
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
                if ((t.status === 'PREVISTA' || t.status === 'CONFIRMADA') && t.date < todayStr) {
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

    async deleteTransactions(ids: string[]) {
        await DatabaseService.deleteTransactions(ids);
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

    async deleteCategory(id: string) {
        await DatabaseService.deleteCategory(id);
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

        // Adicionar categorias de RECEITA primeiro
        const incomeCategories = [
            { name: 'SALÁRIO', color: '#16a34a', sub: ['Pró-labore', 'Bônus', 'Décimo Terceiro', 'Férias', 'Comissões', 'PLR'] },
            { name: 'FREELANCE', color: '#22c55e', sub: ['Projetos TI', 'Consultoria', 'Aulas', 'Vendas diretas'] },
            { name: 'INVESTIMENTOS', color: '#0ea5e9', sub: ['Dividendos', 'Juros sobre Capital', 'Rendimentos Poupança', 'Rendimentos CDB'] },
            { name: 'OUTROS', color: '#94a3b8', sub: ['Presentes', 'Reembolsos', 'Venda de itens usados'] }
        ];

        for (const mainCat of incomeCategories) {
            const parentId = generateId();
            allToSave.push({ id: parentId, name: mainCat.name, type: 'RECEITA', color: mainCat.color, icon: 'Folder' });
            for (const subName of mainCat.sub) {
                allToSave.push({ id: generateId(), name: subName, type: 'RECEITA', color: mainCat.color, icon: 'Tag', parent_id: parentId });
            }
        }

        // Adicionar categorias de DESPESA
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
