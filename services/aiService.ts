import { supabase } from './supabase';
import { Category } from '../types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const AI_GATEWAY_URL = `${SUPABASE_URL}/functions/v1/ai-gateway`;

// Rate limit client-side: prevent duplicate calls
const _pendingCalls = new Map<string, Promise<any>>();

async function callAIGateway<T>(action: string, payload: object): Promise<T | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
            console.warn('[AI] No auth token. Skipping AI call.');
            return null;
        }

        const res = await fetch(AI_GATEWAY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action, payload })
        });

        if (!res.ok) {
            const err = await res.text();
            console.warn(`[AI] Gateway error (${res.status}):`, err);
            return null;
        }

        return res.json() as T;
    } catch (err) {
        console.warn('[AI] Network error:', err);
        return null;
    }
}

// --- FEATURE 2: Categorização por IA ---
export interface CategorizationResult {
    category_id: string;
    confidence: number;
}

export async function suggestCategory(
    description: string,
    categories: Category[]
): Promise<CategorizationResult | null> {
    if (!description || description.trim().length < 3) return null;

    // Deduplicate concurrent calls for same description
    const key = `categorize:${description}`;
    if (_pendingCalls.has(key)) return _pendingCalls.get(key)!;

    const validCategories = categories
        .filter(c => c.type === 'DESPESA' || c.type === 'RECEITA')
        .map(c => ({ id: c.id, name: c.name, type: c.type }));

    const promise = callAIGateway<CategorizationResult>('categorize', {
        description: description.trim(),
        categories: validCategories
    }).finally(() => _pendingCalls.delete(key));

    _pendingCalls.set(key, promise);
    return promise;
}

// --- FEATURE 3: OCR de Nota Fiscal ---
export interface ReceiptData {
    description: string;
    amount: number;
    date: string;
    items?: string[];
}

export async function scanReceipt(imageFile: File): Promise<ReceiptData | null> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            if (!base64) { resolve(null); return; }

            const result = await callAIGateway<ReceiptData>('scan_receipt', {
                image: base64,
                mimeType: imageFile.type || 'image/jpeg'
            });
            resolve(result);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(imageFile);
    });
}

// --- FEATURE 4: Chat Financeiro ---
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatContext {
    totalBalance: number;
    monthIncome: number;
    monthExpense: number;
    topCategories: { name: string; amount: number }[];
    budgetStatus: { name: string; used: number; total: number }[];
    goalProgress: { name: string; current: number; target: number }[];
    today: string;
}

export interface ChatResult {
    reply: string;
}

export async function sendChatMessage(
    message: string,
    context: ChatContext,
    history: ChatMessage[]
): Promise<ChatResult | null> {
    return callAIGateway<ChatResult>('chat', {
        message,
        context,
        history: history.slice(-6) // last 6 messages for context
    });
}
