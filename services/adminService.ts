import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`;

async function callAdmin(action: string, payload: Record<string, any> = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Não autenticado');

    const resp = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, payload }),
    });

    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
    return json;
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface AdminUser {
    id: string;
    name: string;
    email: string;
    created_at: string;
    plan: 'TRIAL' | 'PRO' | 'BLOCKED';
    trial_starts: string | null;
    trial_ends: string | null;
    blocked_at: string | null;
    notes: string | null;
    total_transactions: number;
    total_balance: number;
    last_activity: string | null;
    status: 'ATIVO' | 'EXPIRANDO' | 'EXPIRADO' | 'PRO' | 'BLOQUEADO';
    dias_restantes: number;
}

export interface AdminUserSummary {
    user: AdminUser;
    recent_transactions: {
        id: string;
        description: string;
        amount: number;
        type: string;
        status: string;
        date: string;
    }[];
    accounts: { id: string; name: string; balance: number; type: string }[];
    active_goals: { id: string; name: string; target_amount: number; current_amount: number }[];
}

// ── API ─────────────────────────────────────────────────────────────────────
export async function adminListUsers(): Promise<AdminUser[]> {
    const data = await callAdmin('list_users');
    return data.users ?? [];
}

export async function adminGetUserSummary(userId: string): Promise<AdminUserSummary> {
    return callAdmin('get_user_summary', { user_id: userId });
}

export async function adminUnblockUser(userId: string, days = 30): Promise<void> {
    await callAdmin('unblock_user', { user_id: userId, days });
}

export async function adminBlockUser(userId: string): Promise<void> {
    await callAdmin('block_user', { user_id: userId });
}

export async function adminExtendTrial(userId: string, days: number): Promise<void> {
    await callAdmin('extend_trial', { user_id: userId, days });
}

export async function adminUpdateNotes(userId: string, notes: string): Promise<void> {
    await callAdmin('update_notes', { user_id: userId, notes });
}

export async function adminDeleteUser(userId: string): Promise<void> {
    await callAdmin('delete_user', { user_id: userId });
}
