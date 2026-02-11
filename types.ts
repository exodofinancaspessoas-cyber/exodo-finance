
export type TransactionType = 'RECEITA' | 'DESPESA';

export type TransactionStatus = 'PREVISTA' | 'CONFIRMADA' | 'PAGA' | 'RECEBIDA' | 'ATRASADA';

export type AccountType = 'CORRENTE' | 'POUPANCA' | 'SALARIO' | 'DINHEIRO' | 'OUTRO';

export type PaymentMethod = 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'PIX' | 'BOLETO' | 'TRANSFERENCIA';

export type RecurrenceType = 'FIXO' | 'VARIAVEL';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  settings?: {
    monthly_income?: number;
    reserve_percentage?: number; // Default 20%
    default_interest_rate?: number; // Default 2.5%
    simulate_installments?: number[]; // [3, 6, 12, 18, 24]
  };
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  bank?: string;
  initial_balance: number;
  current_balance: number;
  color?: string;
}

export interface Card {
  id: string;
  name: string;
  limit: number;
  limit_used: number;
  closing_day: number;
  due_day: number;
  brand?: 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD' | 'OUTRO';
  bank?: string;
  color?: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
  is_default?: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category_id: string;
  date: string; // ISO Date (YYYY-MM-DD)
  status: TransactionStatus;
  payment_method?: PaymentMethod;
  account_id?: string;
  card_id?: string;
  installments?: {
    current: number;
    total: number;
    original_transaction_id?: string;
  };
  recurrence_id?: string;
  observation?: string;
  created_at: string;

  // New fields for Stage 3 (Simulations/Splits)
  original_invoice_id?: string; // If this transaction is a result of a split execution
  is_simulation_result?: boolean;
}

export interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  category_id: string;
  type: RecurrenceType;
  frequency: 'MENSAL';
  day_of_month: number;
  active: boolean;
  auto_create: boolean;
  last_generated?: string;
  start_date?: string;
  end_date?: string;
  account_id?: string;
  payment_method?: PaymentMethod;
}

export interface Transfer {
  id: string;
  description?: string;
  amount: number;
  from_account_id: string;
  to_account_id: string;
  date: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  read: boolean;
  date: string;
  action_link?: string;
}

// --- NEW STAGE 3 INTERFACES ---

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target_amount: number;
  current_amount: number;
  deadline: string; // YYYY-MM-DD
  start_date: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  history: {
    date: string;
    amount: number;
    note?: string;
  }[];
}

export interface Budget {
  id: string;
  category_id: string;
  amount: number;
  alert_80: boolean;
  alert_100: boolean;
}

export interface SimulationScenario {
  installments: number;
  installment_amount: number;
  total_amount: number;
  total_interest: number;
  first_payment_date: string;
  cet: number; // monthly percentage
  budget_impact_percent: number; // % of monthly income
  viability: 'GOOD' | 'WARNING' | 'BAD' | 'IMPOSSIBLE';
  projected_balance_end: number;
}

export interface DashboardData {
  totalBalance: number;
  monthIncome: {
    total: number;
    received: number;
    confirmed: number;
    predicted: number;
  };
  monthExpense: {
    total: number;
    paid: number;
    confirmed: number;
    predicted: number;
    overdue: number;
  };
  monthResult: number;
  toPay: number;
  cardInvoices: {
    cardId: string;
    cardName: string;
    amount: number;
    dueDate: string;
    status: 'OPEN' | 'CLOSED' | 'OVERDUE';
    items?: Transaction[];
  }[];
  projection?: {
    nextMonthBalance: number;
    status: 'POSITIVE' | 'WARNING' | 'NEGATIVE';
  };
  alerts?: AppNotification[];
}

export interface ProjectionMonth {
  month: string;
  label: string;
  start_balance: number;
  end_balance: number;
  incomes: number;
  expenses: number;
  status: 'POSITIVE' | 'WARNING' | 'NEGATIVE';
  details: {
    incomes: Transaction[];
    expenses: Transaction[];
    recurring: RecurringExpense[];
    card_invoices: { cardId: string; amount: number; dueDate: string }[];
  }
}
