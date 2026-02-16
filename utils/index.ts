
export const formatCurrency = (value: number): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return (0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
};

export const startOfMonth = (date: Date): Date => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

export const subMonths = (date: Date, months: number): Date => {
    const d = new Date(date);
    d.setMonth(d.getMonth() - months);
    return d;
};

export const isSameMonth = (d1: Date, d2: Date): boolean => {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
};

export const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const APP_VERSION = '1.1.1'; // Increment this on every deploy
const DEPLOY_DATE = '2026-02-16 13:15';

export const toISODate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const getMonthBounds = (offset = 0) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return {
        start: toISODate(start),
        end: toISODate(end)
    };
};

export const parseSafeDate = (dateStr: string): { y: number, m: number, d: number } | null => {
    if (!dateStr) return null;

    // Handle YYYY-MM-DD (standard)
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-').map(Number);
        if (parts.length >= 3) return { y: parts[0], m: parts[1], d: parts[2] };
    }

    // Handle DD/MM/YYYY (legacy/locale)
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/').map(Number);
        if (parts.length >= 3) return { y: parts[2], m: parts[1], d: parts[0] };
    }

    // Fallback for full ISO strings or garbage
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
        }
    } catch { }

    return null;
};
