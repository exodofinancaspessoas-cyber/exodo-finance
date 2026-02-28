# 📖 Êxodo Finance — Documentação Técnica

> **Versão:** 1.6.1 | **Deploy:** 2026-02-25 | **Stack:** React 19 + TypeScript + Supabase + Vite

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Quick Start](#2-quick-start)
3. [Autenticação](#3-autenticação)
4. [Arquitetura](#4-arquitetura)
5. [Módulos da Aplicação](#5-módulos-da-aplicação)
6. [DatabaseService — Referência Completa](#6-databaseservice--referência-completa)
7. [StorageService](#7-storageservice)
8. [Tipos e Interfaces](#8-tipos-e-interfaces)
9. [Schema do Banco de Dados](#9-schema-do-banco-de-dados)
10. [Segurança (RLS)](#10-segurança-rls)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Deploy](#12-deploy)
13. [Changelog](#13-changelog)

---

## 1. Visão Geral

**Êxodo Finance** é um sistema de gestão financeira pessoal desenvolvido em React 19 com TypeScript. A aplicação oferece controle completo de receitas, despesas, contas bancárias, cartões de crédito, metas, orçamentos e projeções financeiras.

### Características Principais

| Feature | Descrição |
|---|---|
| 💳 Contas & Cartões | Gerenciamento de contas bancárias e cartões de crédito |
| 💸 Transações | Receitas, despesas e transferências com status detalhado |
| 🔄 Recorrências | Gastos recorrentes com geração automática |
| 📊 Analytics | Relatórios, projeções e fluxo de caixa |
| 🎯 Metas & Orçamentos | Planejamento financeiro com metas e orçamento por categoria |
| 🧮 Simulador | Simulação de parcelamentos com cálculo de juros e CET |
| 📱 Mobile-First | Interface responsiva com Quick Add otimizado para mobile |
| ☁️ Sincronização | Sincronização em tempo real via Supabase com fallback localStorage |

---

## 2. Quick Start

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.local.example .env.local
# Editar .env.local com suas credenciais Supabase

# 3. Iniciar desenvolvimento
npm run dev

# 4. Build de produção
npm run build
```

### Dependências Principais

```json
{
  "@supabase/supabase-js": "^2.95.3",
  "react": "^19.2.1",
  "recharts": "^3.5.1",
  "lucide-react": "^0.556.0"
}
```

---

## 3. Autenticação

O sistema usa **Supabase Auth** com email/senha. O fluxo é gerenciado pelo `AuthService`.

### Fluxo de Login

```
Usuário → Auth.tsx → AuthService.signIn() → Supabase Auth
                                          → Busca perfil em profiles
                                          → Cria perfil se ausente (legacy users)
                                          → StorageService.setUser()
                                          → App renderiza
```

### AuthService

#### `signIn(email, password)`

Autentica o usuário e retorna o perfil.

```typescript
const { user, error } = await AuthService.signIn('user@email.com', 'senha123');
```

**Retorno:**
```typescript
{
  user: User | null;
  error: string | null;
}
```

**Comportamento especial:** Usuários legados (sem perfil criado via trigger) têm o perfil criado automaticamente no primeiro login.

---

#### `signUp(email, password, name)`

Registra novo usuário.

```typescript
const { user, error } = await AuthService.signUp('user@email.com', 'senha123', 'João Silva');
```

> ⚠️ O email de confirmação é obrigatório. O usuário verá o aviso para verificar o e-mail.

---

#### `signOut()`

Encerra a sessão e limpa o estado local.

```typescript
await AuthService.signOut();
```

---

### Estratégia Offline

Quando o Supabase não está configurado (`isSupabaseConfigured() === false`), o app opera em modo **100% LocalStorage**, garantindo funcionamento offline.

---

## 4. Arquitetura

### Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    React App (SPA)                  │
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Auth.tsx│  │ Layout   │  │  Views (Módulos)  │  │
│  └─────────┘  │ (Sidebar)│  │  Dashboard        │  │
│               └──────────┘  │  TransactionsView │  │
│                             │  AccountsView     │  │
│                             │  CardsView        │  │
│                             │  ...              │  │
│                             └───────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │     Service Layer       │
          │                         │
          │  StorageService         │
          │  ├── DatabaseService    │
          │  │   └── Supabase SDK   │
          │  └── LocalStorage       │
          │                         │
          │  AuthService            │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │     Data Layer          │
          │                         │
          │  Supabase (Cloud)       │
          │  └── PostgreSQL + RLS   │
          │                         │
          │  LocalStorage (Offline) │
          └─────────────────────────┘
```

### Estratégia de Dados (Dual-Source)

O sistema implementa uma estratégia de **merge inteligente** entre Supabase e LocalStorage:

1. **Cloud-First:** Dados do Supabase têm prioridade
2. **Merge:** Itens locais ausentes na nuvem são preservados
3. **Cache Local:** Supabase data é cacheado localmente para acesso offline
4. **Fallback:** Se Supabase falhar, dados locais são usados

```
getTransactions()
  ├── Supabase disponível?
  │   ├── Sim → Busca Supabase + Merge com Local → Retorna merged
  │   └── Não → Retorna LocalStorage
  └── Fallback: [] vazio
```

---

## 5. Módulos da Aplicação

### Roteamento (App.tsx)

O roteamento é controlado por `currentView` via `useState`. Sem React Router — navegação SPA pura.

| View Key | Componente | Descrição |
|---|---|---|
| `dashboard` | `Dashboard.tsx` | Painel principal com resumo financeiro |
| `movements` | `TransactionsView.tsx` | Lista todos os movimentos |
| `incomes` | `TransactionsView` (filtro RECEITA) | Apenas receitas |
| `expenses` | `TransactionsView` (filtro DESPESA) | Apenas despesas |
| `agenda` | `AgendaView.tsx` | Calendário de compromissos financeiros |
| `fluxo-caixa` | `FluxoCaixaView.tsx` | Fluxo de caixa detalhado |
| `accounts` | `FinanceView` (tab accounts) | Contas bancárias |
| `cards` | `FinanceView` (tab cards) | Cartões de crédito |
| `recurring` | `RecurringExpensesView.tsx` | Gastos recorrentes |
| `analytics` | `AnalyticsView.tsx` | Análises e gráficos |
| `projection` | `AnalyticsView` (tab projection) | Projeções futuras |
| `reports` | `AnalyticsView` (tab reports) | Relatórios |
| `goals` | `PlanningView` (tab goals) | Metas financeiras |
| `budgets` | `PlanningView` (tab budgets) | Orçamentos por categoria |
| `simulator` | `InvoiceSimulator.tsx` | Simulador de parcelamentos |
| `settings` | `SettingsView.tsx` | Configurações e reset de dados |

### Quick Add (Mobile)

O `QuickAddView` é aberto automaticamente em devices mobile (`width < 768px`) na primeira sessão. Também pode ser aberto via URL `?view=quick-add`.

```typescript
// Auto-open logic
const isMobile = window.innerWidth < 768;
const hasOpenedBefore = sessionStorage.getItem('quick_add_auto_opened');
if ((hasQuickAddParam || isMobile) && !hasOpenedBefore) {
  setIsQuickAddOpen(true);
}
```

### Onboarding

Fluxo de boas-vindas para novos usuários:

1. **ActionManual** — Modal com guia de uso (para quem prefere ler)
2. **OnboardingFlow** — Tour interativo passo a passo

```
Primeiro acesso
  └── Usuário sem contas no DB → Mostra ActionManual
      ├── "Ler manual" → ActionManual
      └── "Iniciar tour" → OnboardingFlow
```

---

## 6. DatabaseService — Referência Completa

Localizado em `services/database.ts`. Gerencia todas as operações de persistência de dados.

### Contas (`accounts`)

#### `getAccounts(): Promise<Account[]>`

Retorna todas as contas do usuário mesclando nuvem + local.

```typescript
const accounts = await DatabaseService.getAccounts();
```

**Comportamento de merge:**
- Prioridade: Supabase > LocalStorage
- Remove duplicatas pelo `id`

---

#### `saveAccount(account: Account): Promise<void>`

Cria ou atualiza uma conta (upsert).

```typescript
await DatabaseService.saveAccount({
  id: 'uuid-v4',
  name: 'Conta Corrente',
  type: 'CORRENTE',
  bank: 'Nubank',
  initial_balance: 1000,
  current_balance: 1500,
  color: '#8B5CF6'
});
```

**Campos Supabase mapeados:**

| Campo App | Campo DB |
|---|---|
| `current_balance` | `balance` |
| `initial_balance` | `initial_balance` |

---

#### `deleteAccount(id: string): Promise<void>`

Deleta conta e **cascata** todos os dados relacionados:

1. Transações vinculadas
2. Cartões vinculados
3. Transferências (origem ou destino)
4. A própria conta

---

### Cartões (`cards`)

#### `getCards(): Promise<Card[]>`

```typescript
const cards = await DatabaseService.getCards();
```

**Campo mapeado:** `limit_amount` (DB) → `limit` (App)

---

#### `saveCard(card: Card): Promise<void>`

```typescript
await DatabaseService.saveCard({
  id: 'uuid',
  name: 'Nubank Gold',
  limit: 5000,
  limit_used: 1200,
  closing_day: 15,
  due_day: 22,
  brand: 'VISA',
  bank: 'Nubank',
  color: '#8B5CF6'
});
```

---

#### `deleteCard(id: string): Promise<void>`

```typescript
await DatabaseService.deleteCard('uuid-do-cartao');
```

---

### Transações (`transactions`)

#### `getTransactions(): Promise<Transaction[]>`

Retorna todas as transações ordenadas por data (mais recente primeiro).

```typescript
const transactions = await DatabaseService.getTransactions();
```

**Proteção de status:** Se uma transação está marcada como `EXCLUIDA` no LocalStorage mas não no Supabase (race condition de sync), o status `EXCLUIDA` é preservado.

---

#### `saveTransaction(transaction: Transaction): Promise<void>`

```typescript
await DatabaseService.saveTransaction({
  id: crypto.randomUUID(),
  description: 'Aluguel',
  amount: 2500,
  type: 'DESPESA',
  category_id: 'uuid-categoria',
  date: '2026-02-25',
  status: 'CONFIRMADA',
  payment_method: 'PIX',
  created_at: new Date().toISOString()
});
```

**Validação de UUID:** `category_id`, `account_id` e `card_id` são validados antes do envio. IDs inválidos ou placeholders são enviados como `null`.

---

#### `saveTransactions(transactions: Transaction[]): Promise<void>`

Batch upsert — útil para importações e geração de recorrências.

```typescript
await DatabaseService.saveTransactions(listaDeTransacoes);
```

---

#### `deleteTransaction(id: string): Promise<void>`

**Soft delete** — Marca o status como `EXCLUIDA`, não remove do banco.

```typescript
await DatabaseService.deleteTransaction('uuid-da-transacao');
```

---

#### `deleteTransactions(ids: string[]): Promise<void>`

Batch soft delete.

```typescript
await DatabaseService.deleteTransactions(['uuid-1', 'uuid-2']);
```

---

### Transferências (`transfers`)

#### `getTransfers(): Promise<Transfer[]>`

```typescript
const transfers = await DatabaseService.getTransfers();
```

---

#### `saveTransfer(transfer: Transfer): Promise<void>`

```typescript
await DatabaseService.saveTransfer({
  id: crypto.randomUUID(),
  description: 'Reserva de emergência',
  amount: 500,
  from_account_id: 'uuid-conta-origem',
  to_account_id: 'uuid-conta-destino',
  date: '2026-02-25',
  created_at: new Date().toISOString()
});
```

---

### Categorias (`categories`)

#### `getCategories(): Promise<Category[]>`

```typescript
const categories = await DatabaseService.getCategories();
```

---

#### `saveCategory(category: Category): Promise<void>`

```typescript
await DatabaseService.saveCategory({
  id: crypto.randomUUID(),
  name: 'Alimentação',
  type: 'DESPESA',
  icon: '🍔',
  color: '#F97316'
});
```

---

#### `saveCategories(categories: Category[]): Promise<void>`

Batch upsert para múltiplas categorias.

**Fallback automático:** Se a coluna `parent_id` não existir no banco, a operação é retentada sem esse campo.

---

#### `deleteCategory(id: string): Promise<void>`

```typescript
await DatabaseService.deleteCategory('uuid-categoria');
```

---

### Gastos Recorrentes (`recurring_expenses`)

#### `getRecurringExpenses(): Promise<RecurringExpense[]>`

```typescript
const recurrings = await DatabaseService.getRecurringExpenses();
```

---

#### `saveRecurringExpense(expense: RecurringExpense): Promise<void>`

```typescript
await DatabaseService.saveRecurringExpense({
  id: crypto.randomUUID(),
  description: 'Netflix',
  amount: 39.90,
  category_id: 'uuid-categoria',
  type: 'FIXO',
  frequency: 'MENSAL',
  day_of_month: 15,
  active: true,
  auto_create: true
});
```

**Fallback automático:** Se `programmed_amount` não existir no banco, a operação é retentada sem esse campo.

---

#### `deleteRecurringExpense(id: string): Promise<void>`

```typescript
await DatabaseService.deleteRecurringExpense('uuid-recorrencia');
```

---

### Metas (`goals`)

#### `getGoals(): Promise<Goal[]>`

```typescript
const goals = await DatabaseService.getGoals();
```

---

#### `saveGoal(goal: Goal): Promise<void>`

```typescript
await DatabaseService.saveGoal({
  id: crypto.randomUUID(),
  name: 'Viagem às Maldivas',
  icon: '✈️',
  target_amount: 15000,
  current_amount: 3500,
  deadline: '2026-12-31',
  start_date: '2026-01-01',
  status: 'ACTIVE',
  history: []
});
```

---

#### `deleteGoal(id: string): Promise<void>`

```typescript
await DatabaseService.deleteGoal('uuid-meta');
```

---

### Orçamentos (`budgets`)

#### `getBudgets(): Promise<Budget[]>`

```typescript
const budgets = await DatabaseService.getBudgets();
```

---

#### `saveBudget(budget: Budget): Promise<void>`

```typescript
await DatabaseService.saveBudget({
  id: crypto.randomUUID(),
  category_id: 'uuid-categoria',
  amount: 800,
  alert_80: true,
  alert_100: true
});
```

---

### Reset de Dados

#### `deleteAllUserData(): Promise<void>`

Reset nuclear — apaga **todos** os dados do usuário no Supabase.

```typescript
// Tabelas afetadas (em ordem):
// transactions, recurring_expenses, transfers, budgets,
// goals, cards, accounts, categories
await DatabaseService.deleteAllUserData();
```

---

#### `deletePartialUserData(): Promise<void>`

Apaga apenas transações e regras de recorrência.

```typescript
await DatabaseService.deletePartialUserData();
```

---

#### `deleteCustomUserData(tables: string[]): Promise<void>`

Apaga dados de módulos específicos.

```typescript
await DatabaseService.deleteCustomUserData(['transactions', 'goals']);
```

**Tabelas disponíveis:** `transactions`, `recurring_expenses`, `transfers`, `budgets`, `goals`, `cards`, `accounts`, `categories`

---

## 7. StorageService

Localizado em `services/storage.ts`. Camada de orquestração acima do `DatabaseService`.

### Principais responsabilidades

- Gerenciamento da sessão do usuário (`getUser`, `setUser`, `logout`)
- Processamento automático de recorrências (`processRecurringExpenses`)
- Cálculo do dashboard (`getDashboardData`)
- Projeções futuras (`getProjection`)
- Abstração de todos os `get/save/delete` via `DatabaseService`

### Processamento de Recorrências

```typescript
// Chamado automaticamente no App.tsx ao carregar
await StorageService.processRecurringExpenses();
```

Verifica todas as regras de recorrência ativas e gera as transações devidas para o período atual.

---

## 8. Tipos e Interfaces

### Enums de Status/Tipo

```typescript
// Tipos de transação
type TransactionType = 'RECEITA' | 'DESPESA';

// Status possíveis
type TransactionStatus = 
  | 'PREVISTA'    // Agendada, ainda não ocorreu
  | 'CONFIRMADA'  // Confirmada mas não paga
  | 'PAGA'        // Despesa paga
  | 'RECEBIDA'    // Receita recebida
  | 'ATRASADA'    // Vencida e não paga
  | 'EXCLUIDA'    // Soft deleted
  | 'INCOMPLETA'; // Dados faltando

// Tipos de conta
type AccountType = 'CORRENTE' | 'POUPANCA' | 'SALARIO' | 'DINHEIRO' | 'OUTRO';

// Métodos de pagamento
type PaymentMethod = 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'PIX' | 'BOLETO' | 'TRANSFERENCIA';

// Frequência de recorrência
type RecurrenceFrequency = 'DIARIO' | 'SEMANAL' | 'MENSAL' | 'ANUAL';
```

### Interface: `Transaction`

```typescript
interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category_id: string;
  date: string;                // 'YYYY-MM-DD'
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
  created_at: string;          // ISO DateTime
  photo_url?: string;          // URL signed (Supabase Storage)
  audio_url?: string;          // URL signed (Supabase Storage)
  interest_amount?: number;    // Juros/multas
  is_simulation_result?: boolean;
}
```

### Interface: `Account`

```typescript
interface Account {
  id: string;
  name: string;
  type: AccountType;
  bank?: string;
  initial_balance: number;
  current_balance: number;
  color?: string;
}
```

### Interface: `Card`

```typescript
interface Card {
  id: string;
  name: string;
  limit: number;
  limit_used: number;
  closing_day: number;         // 1-31
  due_day: number;             // 1-31
  brand?: 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD' | 'OUTRO';
  bank?: string;
  account_id?: string;
  color?: string;
}
```

### Interface: `RecurringExpense`

```typescript
interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  category_id: string;
  type: 'FIXO' | 'VARIAVEL';
  frequency: RecurrenceFrequency;
  day_of_month: number;
  active: boolean;
  auto_create: boolean;
  last_generated?: string;
  start_date?: string;
  end_date?: string;
  account_id?: string;
  card_id?: string;
  payment_method?: PaymentMethod;
  duration_count?: number;     // Total de repetições
  programmed_amount?: number;  // Valor override para instâncias futuras
}
```

### Interface: `SimulationScenario`

```typescript
interface SimulationScenario {
  installments: number;
  installment_amount: number;
  total_amount: number;
  total_interest: number;
  first_payment_date: string;
  cet: number;                 // CET mensal em %
  budget_impact_percent: number; // % da renda mensal
  viability: 'GOOD' | 'WARNING' | 'BAD' | 'IMPOSSIBLE';
  projected_balance_end: number;
}
```

### Interface: `DashboardData`

```typescript
interface DashboardData {
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
```

---

## 9. Schema do Banco de Dados

### Tabelas

```sql
-- profiles (1:1 com auth.users)
profiles {
  id          uuid  PK → auth.users
  email       text
  name        text
  avatar_url  text
  currency    text  DEFAULT 'BRL'
  created_at  timestamptz
  updated_at  timestamptz
}

-- accounts
accounts {
  id              uuid  PK
  user_id         uuid  FK → profiles
  name            text  NOT NULL
  type            text  -- CORRENTE | POUPANCA | SALARIO | DINHEIRO | OUTRO
  balance         numeric(15,2)
  initial_balance numeric(15,2)
  color           text
  bank            text
  created_at      timestamptz
}

-- cards
cards {
  id           uuid  PK
  user_id      uuid  FK → profiles
  name         text  NOT NULL
  limit_amount numeric(15,2)  NOT NULL
  closing_day  integer
  due_day      integer
  brand        text  -- VISA | MASTERCARD | ELO | AMEX | HIPERCARD | OUTRO
  bank         text
  account_id   uuid  FK → accounts  ON DELETE SET NULL
  color        text
  created_at   timestamptz
}

-- categories
categories {
  id         uuid  PK
  user_id    uuid  FK → profiles
  name       text  NOT NULL
  type       text  -- RECEITA | DESPESA | AMBOS
  icon       text
  color      text
  is_default boolean
  created_at timestamptz
}

-- transactions
transactions {
  id                   uuid  PK
  user_id              uuid  FK → profiles
  description          text  NOT NULL
  amount               numeric(15,2)  NOT NULL
  type                 text  -- RECEITA | DESPESA
  category_id          uuid  FK → categories
  account_id           uuid  FK → accounts
  card_id              uuid  FK → cards
  date                 date  NOT NULL
  status               text  DEFAULT 'CONFIRMADA'
  payment_method       text
  installments_current integer
  installments_total   integer
  observation          text
  recurrence_id        uuid  FK → recurring_expenses  ON DELETE SET NULL
  interest_amount      numeric(15,2)  DEFAULT 0
  photo_url            text
  audio_url            text
  created_at           timestamptz
}

-- recurring_expenses
recurring_expenses {
  id                uuid  PK
  user_id           uuid  FK → profiles
  description       text  NOT NULL
  amount            numeric(15,2)
  category_id       uuid  FK → categories
  account_id        uuid  FK → accounts
  card_id           uuid  FK → cards
  frequency         text  DEFAULT 'MENSAL'
  day_of_month      integer
  type              text  -- FIXO | VARIAVEL
  active            boolean  DEFAULT true
  auto_create       boolean  DEFAULT true
  last_generated    date
  start_date        date
  end_date          date
  duration_count    integer
  programmed_amount numeric(15,2)
  created_at        timestamptz
}

-- goals
goals {
  id             uuid  PK
  user_id        uuid  FK → profiles
  name           text  NOT NULL
  target_amount  numeric(15,2)
  current_amount numeric(15,2)  DEFAULT 0
  deadline       date
  status         text  DEFAULT 'EM_ANDAMENTO'
  color          text
  icon           text
  created_at     timestamptz
}

-- budgets
budgets {
  id          uuid  PK
  user_id     uuid  FK → profiles
  category_id uuid  FK → categories
  amount      numeric(15,2)
  month       text  -- 'YYYY-MM'
  created_at  timestamptz
}
```

### Triggers

```sql
-- Cria perfil automaticamente quando um novo usuário é criado no Auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

---

## 10. Segurança (RLS)

Todas as tabelas têm **Row Level Security (RLS)** habilitado. Usuários só acessam seus próprios dados.

### Políticas aplicadas (por tabela)

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|:---:|:---:|:---:|:---:|
| `profiles` | `auth.uid() = id` | — | `auth.uid() = id` | — |
| `accounts` | ✅ | ✅ | ✅ | ✅ |
| `cards` | ✅ | ✅ | ✅ | ✅ |
| `categories` | ✅ | ✅ | ✅ | ✅ |
| `transactions` | ✅ | ✅ | ✅ | ✅ |
| `recurring_expenses` | ✅ | ✅ | ✅ | ✅ |
| `goals` | ✅ | ✅ | ✅ | ✅ |
| `budgets` | ✅ | ✅ | ✅ | ✅ |

> Todas as políticas nas tabelas usam `auth.uid() = user_id`.

### Validação de UUIDs no Frontend

Antes de enviar dados ao Supabase, o `DatabaseService` valida todos os `uuid` de referência:

```typescript
// IDs placeholder usados no LocalStorage são filtrados
const dummies = [
  '11111111-1111-4111-a111-111111111111',
  '22222222-2222-4222-a222-222222222222',
  // ...
];
// Se inválido → enviado como null para evitar FK violation
```

### Evidências (Supabase Storage)

Anexos de transações (`photo_url`, `audio_url`) usam **Signed URLs** com expiração de 1 hora para garantir acesso autorizado.

---

## 11. Variáveis de Ambiente

Arquivo: `.env.local`

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ Nunca commitar `.env.local`. Ele está no `.gitignore`.

### Verificação

```bash
node check_envs.js
```

---

## 12. Deploy

### Plataforma: Vercel

```bash
# Deploy via CLI
vercel --prod

# Ou via GitHub Actions (automático no push para main)
```

Configuração em `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Variáveis no Vercel

Configure em **Project Settings → Environment Variables**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 13. Changelog

| Versão | Data | Mudanças |
|---|---|---|
| **1.6.1** | 2026-02-25 | Correção de botões mobile no Forecast View |
| **1.6.0** | 2026-02-21 | Suporte a Signed URLs no Storage; Correção de faturas de cartão |
| **1.5.0** | 2026-02-20 | Dashboard dinâmico por mês; Configurações com reset seletivo |
| **1.4.0** | 2026-02-19 | Módulo de calculadora; Correções de deploy |
| **1.3.0** | 2026-02-17 | Correções de Recurring Expenses |
| **1.2.0** | 2026-02-15 | Auto-criação de perfil para usuários legados |
| **1.1.3** | 2026-02-16 | Sincronização de recorrências em tempo real |
| **1.1.0** | 2026-02-12 | Supabase Realtime subscriptions |
| **1.0.0** | — | Release inicial |

---

*Documentação gerada em 2026-02-25 | Êxodo Finance v1.6.1*
