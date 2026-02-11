import { 
  User, Account, Card, Category, Transaction, 
  TransactionType, TransactionStatus, TransactionOrigin, DashboardData 
} from '../types';

// --- MOCK DATABASE ---
const STORAGE_KEY = 'bruk_db_v1';

const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Alimentação', type: TransactionType.EXPENSE, is_frequent: true, color: '#f97316' }, // Orange
  { id: 'c2', name: 'Transporte', type: TransactionType.EXPENSE, is_frequent: true, color: '#eab308' }, // Yellow
  { id: 'c3', name: 'Moradia', type: TransactionType.EXPENSE, is_frequent: false, color: '#3b82f6' }, // Blue
  { id: 'c4', name: 'Salário', type: TransactionType.INCOME, is_frequent: true, color: '#22c55e' }, // Green
  { id: 'c5', name: 'Lazer', type: TransactionType.EXPENSE, is_frequent: false, color: '#a855f7' }, // Purple
  { id: 'c6', name: 'Outros', type: TransactionType.EXPENSE, is_frequent: false, color: '#94a3b8' }, // Slate
];

const INITIAL_ACCOUNTS: Account[] = [
  { id: 'a1', name: 'Nubank', type: 'corrente', initial_balance: 0, current_balance: 1250.00 },
  { id: 'a2', name: 'Itaú', type: 'corrente', initial_balance: 0, current_balance: 3420.50 },
  { id: 'a3', name: 'Carteira', type: 'carteira', initial_balance: 0, current_balance: 150.00 },
];

const INITIAL_CARDS: Card[] = [
  { id: 'cd1', name: 'Nubank Roxinho', limit: 5000, closing_day: 5, due_day: 12, type: 'credito' },
  { id: 'cd2', name: 'Itaú Click', limit: 8000, closing_day: 15, due_day: 22, type: 'credito' },
];

// Dados Mockados para novas telas
export const MOCK_GOALS = [
  { id: 1, name: 'Viagem para Europa', target: 15000, current: 4500, deadline: '2026-01-01', color: '#f97316' },
  { id: 2, name: 'Reserva de Emergência', target: 10000, current: 8200, deadline: '2025-06-01', color: '#22c55e' },
  { id: 3, name: 'Trocar de Carro', target: 40000, current: 5000, deadline: '2027-12-01', color: '#3b82f6' },
];

export const MOCK_SCHEDULED = [
  { id: 1, description: 'Aluguel', value: 1800, date: '2025-12-10', category: 'Moradia', type: 'DESPESA' },
  { id: 2, description: 'Netflix', value: 55.90, date: '2025-12-15', category: 'Lazer', type: 'DESPESA' },
  { id: 3, description: 'Salário', value: 4500, date: '2025-12-05', category: 'Salário', type: 'RECEITA' },
];

interface DB {
  user: User | null;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  transactions: Transaction[];
}

const getDB = (): DB => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  
  return {
    user: null,
    accounts: INITIAL_ACCOUNTS,
    cards: INITIAL_CARDS,
    categories: INITIAL_CATEGORIES,
    transactions: [],
  };
};

const saveDB = (db: DB) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

// --- NLP LOGIC (SIMULATED) ---
export const processWhatsAppMessage = (message: string): { response: string, transaction?: Transaction } => {
  const db = getDB();
  const lowerMsg = message.toLowerCase();
  
  const numberMatch = lowerMsg.match(/(\d+([.,]\d{1,2})?)/);
  if (!numberMatch) {
    return { response: "Não entendi o valor. Tente algo como: 'Gastei 50 no mercado'." };
  }
  const value = parseFloat(numberMatch[0].replace(',', '.'));

  let type = TransactionType.EXPENSE;
  if (lowerMsg.includes('recebi') || lowerMsg.includes('ganhei') || lowerMsg.includes('entrada') || lowerMsg.includes('salario')) {
    type = TransactionType.INCOME;
  }

  let description = message
    .replace(/gastei|paguei|comprei|recebi|ganhei|no|na|com|de|R\$|r\$|\d+([.,]\d{1,2})?/gi, '')
    .trim();
  if (!description) description = type === TransactionType.EXPENSE ? 'Despesa Avulsa' : 'Receita Avulsa';

  let categoryId = 'c6'; 
  const catKeywords: Record<string, string> = {
    'mercado': 'c1', 'lanche': 'c1', 'ifood': 'c1', 'restaurante': 'c1',
    'uber': 'c2', 'taxi': 'c2', 'gasolina': 'c2',
    'aluguel': 'c3', 'luz': 'c3', 'internet': 'c3',
    'salario': 'c4', 'pix': 'c4',
    'cinema': 'c5', 'jogo': 'c5'
  };
  
  for (const [key, id] of Object.entries(catKeywords)) {
    if (lowerMsg.includes(key)) categoryId = id;
  }

  let paymentMethod = undefined;
  let status = TransactionStatus.PENDING_METHOD;
  
  if (lowerMsg.includes('credito') || lowerMsg.includes('crédito')) paymentMethod = 'credito';
  else if (lowerMsg.includes('debito') || lowerMsg.includes('débito')) paymentMethod = 'debito';
  else if (lowerMsg.includes('pix')) paymentMethod = 'pix';
  else if (lowerMsg.includes('dinheiro')) paymentMethod = 'dinheiro';

  if (paymentMethod) status = TransactionStatus.COMPLETED;

  let installments = undefined;
  const installMatch = lowerMsg.match(/(\d+)x/);
  if (installMatch) {
    installments = { current: 1, total: parseInt(installMatch[1]) };
    paymentMethod = 'credito';
    status = TransactionStatus.COMPLETED;
  }

  const newTransaction: Transaction = {
    id: Date.now().toString(),
    type,
    value,
    description,
    categoryId,
    origin: TransactionOrigin.WA_TEXT,
    status,
    date: new Date().toISOString(),
    paymentMethod,
    installments
  };

  db.transactions.push(newTransaction);
  
  if (status === TransactionStatus.COMPLETED && type === TransactionType.EXPENSE) {
      db.accounts[0].current_balance -= value;
  } else if (status === TransactionStatus.COMPLETED && type === TransactionType.INCOME) {
      db.accounts[0].current_balance += value;
  }

  saveDB(db);

  let responseText = `✅ ${type === TransactionType.EXPENSE ? 'Gasto' : 'Receita'} de R$ ${value.toFixed(2)} registrado! (${description})`;
  if (status === TransactionStatus.PENDING_METHOD) {
    responseText += `\n⚠️ Não identifiquei o meio de pagamento. Vou deixar pendente para você confirmar depois.`;
  } else if (installments) {
    responseText += `\n📅 Parcelado em ${installments.total}x.`;
  }

  return { response: responseText, transaction: newTransaction };
};

export const getDashboardData = (): DashboardData => {
  const db = getDB();
  const today = new Date();
  const currentMonth = today.getMonth();
  
  const transactions = db.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth;
  });

  const totalIncome = transactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((acc, curr) => acc + curr.value, 0);

  const totalExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((acc, curr) => acc + curr.value, 0);

  const pendingCount = db.transactions.filter(t => t.status === TransactionStatus.PENDING_METHOD).length;

  const categoryDistribution = db.categories.map(c => ({
    name: c.name,
    value: transactions.filter(t => t.categoryId === c.id).reduce((acc, curr) => acc + curr.value, 0),
    color: c.color
  })).filter(c => c.value > 0);

  return {
    totalBalance: db.accounts.reduce((acc, curr) => acc + curr.current_balance, 0),
    totalIncome,
    totalExpense,
    monthResult: totalIncome - totalExpense,
    pendingCount,
    dailyEvolution: [
        { day: '01', value: 200 }, { day: '05', value: 450 }, { day: '10', value: 800 }, { day: '15', value: 1200 }, { day: 'Hoje', value: totalExpense }
    ], 
    categoryDistribution
  };
};

export const getTransactions = () => getDB().transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
export const getAccounts = () => getDB().accounts;
export const getCards = () => getDB().cards;
export const getCategories = () => getDB().categories;
export const getUser = () => getDB().user;

export const createUser = (name: string, whatsapp: string) => {
  const db = getDB();
  db.user = {
    id: 'u1',
    name,
    whatsapp,
    daily_alert_time: '20:00',
    onboarded: true
  };
  saveDB(db);
  return db.user;
};

export const resolvePendingTransaction = (id: string, method: string) => {
    const db = getDB();
    const idx = db.transactions.findIndex(t => t.id === id);
    if (idx > -1) {
        db.transactions[idx].paymentMethod = method;
        db.transactions[idx].status = TransactionStatus.COMPLETED;
        if (db.transactions[idx].type === TransactionType.EXPENSE) {
             db.accounts[0].current_balance -= db.transactions[idx].value;
        }
        saveDB(db);
    }
};