
import {
    User, Account, Card, Transaction, Category, Transfer,
    DashboardData, TransactionStatus, RecurringExpense, AppNotification,
    Goal, Budget
} from '../types';

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

// --- HELPER FUNCTIONS ---
const getStorage = <T>(key: string, defaultValue: T): T => {
    const stored = localStorage.getItem(key);
    try {
        const parsed = stored ? JSON.parse(stored) : defaultValue;
        if (defaultValue instanceof Array && !Array.isArray(parsed)) {
            return defaultValue;
        }
        return parsed;
    } catch {
        return defaultValue;
    }
};

const setStorage = <T>(key: string, value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
};

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const getDefaultCategories = (): Category[] => [
    { id: 'cat_salario', name: 'Salário', type: 'RECEITA', icon: 'Briefcase', color: '#16a34a', is_default: true },
    { id: 'cat_invest', name: 'Investimentos', type: 'RECEITA', icon: 'TrendingUp', color: '#0ea5e9', is_default: true },
    { id: 'cat_extra', name: 'Renda Extra', type: 'RECEITA', icon: 'PlusCircle', color: '#8b5cf6', is_default: true },
    { id: 'cat_casa', name: 'Moradia', type: 'DESPESA', icon: 'Home', color: '#ea580c', is_default: true },
    { id: 'cat_ali', name: 'Alimentação', type: 'DESPESA', icon: 'ShoppingCart', color: '#dc2626', is_default: true },
    { id: 'cat_trans', name: 'Transporte', type: 'DESPESA', icon: 'Car', color: '#f59e0b', is_default: true },
    { id: 'cat_lazer', name: 'Lazer', type: 'DESPESA', icon: 'Smile', color: '#ec4899', is_default: true },
    { id: 'cat_saude', name: 'Saúde', type: 'DESPESA', icon: 'Heart', color: '#ef4444', is_default: true },
    { id: 'cat_edu', name: 'Educação', type: 'DESPESA', icon: 'Book', color: '#6366f1', is_default: true },
];

const isSameMonth = (d1: Date, d2: Date) => d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// --- SERVICE ---

export const StorageService = {
    generateId, // Exported for use in components

    // USER
    getUser: (): User | null => getStorage<User | null>(STORAGE_KEYS.USER, null),
    setUser: (user: User) => setStorage(STORAGE_KEYS.USER, user),
    logout: () => localStorage.removeItem(STORAGE_KEYS.USER),

    // RECURRING EXPENSES
    getRecurringExpenses: (): RecurringExpense[] => getStorage<RecurringExpense[]>(STORAGE_KEYS.RECURRING_EXPENSES, []),

    saveRecurringExpense: (expense: RecurringExpense) => {
        const list = StorageService.getRecurringExpenses();
        const index = list.findIndex(i => i.id === expense.id);
        if (index >= 0) list[index] = expense;
        else list.push(expense);
        setStorage(STORAGE_KEYS.RECURRING_EXPENSES, list);

        StorageService.processRecurringExpenses();
    },

    deleteRecurringExpense: (id: string) => {
        const list = StorageService.getRecurringExpenses();
        setStorage(STORAGE_KEYS.RECURRING_EXPENSES, list.filter(i => i.id !== id));
    },

    processRecurringExpenses: () => {
        const recurring = StorageService.getRecurringExpenses();
        const transactions = StorageService.getTransactions();
        const today = new Date();
        let changed = false;

        recurring.forEach(rec => {
            if (!rec.active || !rec.auto_create) return;

            const targetDate = new Date(today.getFullYear(), today.getMonth(), rec.day_of_month);

            const exists = transactions.some(t =>
                t.recurrence_id === rec.id &&
                isSameMonth(new Date(t.date), today)
            );

            if (!exists) {
                const newTrx: Transaction = {
                    id: generateId(),
                    description: rec.description,
                    amount: rec.amount,
                    type: 'DESPESA',
                    category_id: rec.category_id,
                    date: targetDate.toISOString().split('T')[0],
                    status: 'PREVISTA',
                    account_id: rec.account_id,
                    recurrence_id: rec.id,
                    created_at: new Date().toISOString()
                };
                transactions.push(newTrx);
                rec.last_generated = new Date().toISOString();
                changed = true;

                StorageService.addNotification({
                    id: generateId(),
                    title: 'Despesa Recorrente Criada',
                    message: `${rec.description} - R$ ${rec.amount} adicionada para este mês.`,
                    type: 'INFO',
                    read: false,
                    date: new Date().toISOString()
                });
            }
        });

        if (changed) {
            setStorage(STORAGE_KEYS.TRANSACTIONS, transactions);
            setStorage(STORAGE_KEYS.RECURRING_EXPENSES, recurring);
        }
    },

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

    // ACCOUNTS
    getAccounts: (): Account[] => {
        const accounts = getStorage<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
        return accounts.map(acc => ({
            ...acc,
            current_balance: StorageService.calculateAccountBalance(acc)
        }));
    },

    saveAccount: (account: Account) => {
        const accounts = getStorage<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
        const index = accounts.findIndex(a => a.id === account.id);
        if (index >= 0) accounts[index] = account;
        else accounts.push(account);
        setStorage(STORAGE_KEYS.ACCOUNTS, accounts);
    },

    // CARDS
    getCards: (): Card[] => {
        const cards = getStorage<Card[]>(STORAGE_KEYS.CARDS, []);
        const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);

        return cards.map(c => {
            const used = transactions
                .filter(t => t.card_id === c.id && t.type === 'DESPESA' && t.status !== 'PAGA')
                .reduce((sum, t) => sum + t.amount, 0);
            return { ...c, limit_used: used };
        });
    },

    saveCard: (card: Card) => {
        const cards = getStorage<Card[]>(STORAGE_KEYS.CARDS, []);
        const index = cards.findIndex(c => c.id === card.id);
        if (index >= 0) cards[index] = card;
        else cards.push(card);
        setStorage(STORAGE_KEYS.CARDS, cards);
    },

    deleteCard: (id: string) => {
        const cards = getStorage<Card[]>(STORAGE_KEYS.CARDS, []);
        setStorage(STORAGE_KEYS.CARDS, cards.filter(c => c.id !== id));
    },

    // TRANSACTIONS
    getTransactions: (): Transaction[] => {
        const trxs = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
        const today = new Date();
        let updated = false;

        trxs.forEach(t => {
            if ((t.status === 'PREVISTA' || t.status === 'CONFIRMADA') && t.type === 'DESPESA') {
                const dueDate = new Date(t.date);
                if (dueDate < startOfDay(today)) {
                    t.status = 'ATRASADA';
                    updated = true;
                }
            }
        });

        if (updated) setStorage(STORAGE_KEYS.TRANSACTIONS, trxs);
        return trxs;
    },

    saveTransaction: (transaction: Transaction) => {
        let transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
        const index = transactions.findIndex(t => t.id === transaction.id);

        // Installment Logic: Only if Creating NEW, has installments > 1, and it's the 1st one
        if (index === -1 && transaction.installments && transaction.installments.current === 1 && transaction.installments.total > 1) {
            const total = transaction.installments.total;
            const baseDate = new Date(transaction.date);

            transactions.push(transaction);

            for (let i = 2; i <= total; i++) {
                const nextDate = addMonths(baseDate, i - 1);
                transactions.push({
                    ...transaction,
                    id: generateId(),
                    date: nextDate.toISOString().split('T')[0],
                    installments: {
                        current: i,
                        total: total,
                        original_transaction_id: transaction.id
                    },
                    status: 'PREVISTA'
                });
            }
        } else {
            if (index >= 0) transactions[index] = transaction;
            else transactions.push(transaction);
        }

        setStorage(STORAGE_KEYS.TRANSACTIONS, transactions);
    },

    deleteTransaction: (id: string) => {
        const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
        setStorage(STORAGE_KEYS.TRANSACTIONS, transactions.filter(t => t.id !== id));
    },

    // UTILS & TRANSFERS
    calculateAccountBalance: (account: Account): number => {
        const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
        const transfers = getStorage<Transfer[]>(STORAGE_KEYS.TRANSFERS, []);

        let balance = account.initial_balance || 0;

        transactions.forEach(t => {
            if (t.account_id === account.id) {
                if (t.type === 'RECEITA' && t.status === 'RECEBIDA') {
                    balance += t.amount;
                } else if (t.type === 'DESPESA' && t.status === 'PAGA') {
                    balance -= t.amount;
                }
            }
        });

        transfers.forEach(t => {
            if (t.from_account_id === account.id) balance -= t.amount;
            if (t.to_account_id === account.id) balance += t.amount;
        });

        return balance;
    },

    getCategories: (): Category[] => {
        const stored = getStorage<Category[]>(STORAGE_KEYS.CATEGORIES, []);
        return stored.length > 0 ? stored : getDefaultCategories();
    },

    saveCategory: (cat: Category) => {
        const list = getStorage<Category[]>(STORAGE_KEYS.CATEGORIES, []);
        const idx = list.findIndex(c => c.id === cat.id);
        if (idx >= 0) list[idx] = cat;
        else list.push(cat);
        setStorage(STORAGE_KEYS.CATEGORIES, list);
    },

    deleteCategory: (id: string) => {
        const list = getStorage<Category[]>(STORAGE_KEYS.CATEGORIES, []);
        setStorage(STORAGE_KEYS.CATEGORIES, list.filter(c => c.id !== id));
    },

    getTransfers: (): Transfer[] => getStorage<Transfer[]>(STORAGE_KEYS.TRANSFERS, []),
    saveTransfer: (t: Transfer) => {
        const list = getStorage<Transfer[]>(STORAGE_KEYS.TRANSFERS, []);
        list.push(t);
        setStorage(STORAGE_KEYS.TRANSFERS, list);
    },

    // GOALS (METAS)
    getGoals: (): Goal[] => getStorage<Goal[]>(STORAGE_KEYS.GOALS, []),
    saveGoal: (goal: Goal) => {
        const list = getStorage<Goal[]>(STORAGE_KEYS.GOALS, []);
        const idx = list.findIndex(g => g.id === goal.id);
        if (idx >= 0) list[idx] = goal;
        else list.push(goal);
        setStorage(STORAGE_KEYS.GOALS, list);
    },
    deleteGoal: (id: string) => {
        const list = getStorage<Goal[]>(STORAGE_KEYS.GOALS, []);
        setStorage(STORAGE_KEYS.GOALS, list.filter(g => g.id !== id));
    },

    // BUDGETS (ORÇAMENTOS)
    getBudgets: (): Budget[] => getStorage<Budget[]>(STORAGE_KEYS.BUDGETS, []),
    saveBudget: (budget: Budget) => {
        const list = getStorage<Budget[]>(STORAGE_KEYS.BUDGETS, []);
        const idx = list.findIndex(b => b.category_id === budget.category_id); // Unique per category
        if (idx >= 0) list[idx] = budget;
        else list.push(budget);
        setStorage(STORAGE_KEYS.BUDGETS, list);
    },

    // DASHBOARD
    getDashboardData: (month: number, year: number): DashboardData => {
        const transactions = StorageService.getTransactions();
        const accounts = StorageService.getAccounts();
        const cards = StorageService.getCards();

        let totalBalance = 0;
        accounts.forEach(a => totalBalance += a.current_balance);

        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);

        const monthData = transactions.filter(t => {
            const date = new Date(t.date + 'T00:00:00');
            return date >= monthStart && date <= monthEnd;
        });

        const income = { total: 0, received: 0, confirmed: 0, predicted: 0 };
        const expense = { total: 0, paid: 0, confirmed: 0, predicted: 0, overdue: 0 };

        monthData.forEach(t => {
            if (t.type === 'RECEITA') {
                income.total += t.amount;
                if (t.status === 'RECEBIDA') income.received += t.amount;
                if (t.status === 'CONFIRMADA') income.confirmed += t.amount;
                if (t.status === 'PREVISTA') income.predicted += t.amount;
            } else {
                expense.total += t.amount;
                if (t.status === 'PAGA') expense.paid += t.amount;
                if (t.status === 'CONFIRMADA') expense.confirmed += t.amount;
                if (t.status === 'PREVISTA') expense.predicted += t.amount;
                if (t.status === 'ATRASADA') expense.overdue += t.amount;
            }
        });

        const cardInvoicesMap = new Map<string, number>();
        monthData.forEach(t => {
            if (t.type === 'DESPESA' && t.card_id) {
                const current = cardInvoicesMap.get(t.card_id) || 0;
                cardInvoicesMap.set(t.card_id, current + t.amount);
            }
        });

        const cardInvoices = cards.map(c => {
            return {
                cardId: c.id,
                cardName: c.name,
                amount: cardInvoicesMap.get(c.id) || 0,
                dueDate: `${c.due_day}/${month + 1}`,
                status: 'OPEN' as any
            };
        }).filter(i => i.amount > 0);

        const toPay = expense.total - expense.paid;

        const alerts = StorageService.getNotifications().filter(n => !n.read);

        return {
            totalBalance,
            monthIncome: income,
            monthExpense: expense,
            monthResult: income.received - expense.paid,
            toPay,
            cardInvoices,
            projection: {
                nextMonthBalance: totalBalance + income.total - expense.total,
                status: (totalBalance + income.total - expense.total) > 0 ? 'POSITIVE' : 'NEGATIVE'
            },
            alerts
        };
    }
};
