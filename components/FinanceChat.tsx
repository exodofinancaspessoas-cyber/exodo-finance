import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, Bot, User, Loader2, MessageSquare, ChevronDown } from 'lucide-react';
import { sendChatMessage, ChatMessage, ChatContext } from '../services/aiService';
import { StorageService } from '../services/storage';
import { formatCurrency, parseSafeDate, toISODate } from '../utils';

interface FinanceChatProps {
    isOpen: boolean;
    onClose: () => void;
}

async function buildChatContext(): Promise<ChatContext> {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    const [transactions, accounts, budgets, goals, categories] = await Promise.all([
        StorageService.getTransactions(),
        StorageService.getAccounts(),
        StorageService.getBudgets(),
        StorageService.getGoals(),
        StorageService.getCategories(),
    ]);

    const monthTrxs = transactions.filter(t => {
        const p = parseSafeDate(t.date);
        return p && p.y === y && (p.m - 1) === m && t.status !== 'EXCLUIDA';
    });

    const monthIncome = monthTrxs
        .filter(t => t.type === 'RECEITA' && (t.status === 'RECEBIDA' || t.status === 'CONFIRMADA'))
        .reduce((s, t) => s + t.amount, 0);

    const monthExpense = monthTrxs
        .filter(t => t.type === 'DESPESA' && (t.status === 'PAGA' || t.status === 'ATRASADA'))
        .reduce((s, t) => s + t.amount, 0);

    const totalBalance = accounts.reduce((s, a) => s + (a.current_balance || 0), 0);

    // Top 5 categories by spending
    const catMap: Record<string, number> = {};
    monthTrxs.filter(t => t.type === 'DESPESA').forEach(t => {
        catMap[t.category_id] = (catMap[t.category_id] || 0) + t.amount;
    });
    const topCategories = Object.entries(catMap)
        .map(([id, amount]) => ({
            name: categories.find(c => c.id === id)?.name || 'Outros',
            amount: Math.round(amount * 100) / 100
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    // Budget status
    const budgetStatus = budgets.map(b => {
        const spent = monthTrxs
            .filter(t => t.type === 'DESPESA' && t.category_id === b.category_id)
            .reduce((s, t) => s + t.amount, 0);
        return {
            name: categories.find(c => c.id === b.category_id)?.name || 'Categoria',
            used: Math.round(spent * 100) / 100,
            total: b.amount
        };
    });

    // Goal progress (active only)
    const goalProgress = goals
        .filter(g => g.status === 'ACTIVE')
        .map(g => ({
            name: g.name,
            current: g.current_amount,
            target: g.target_amount
        }));

    return {
        totalBalance: Math.round(totalBalance * 100) / 100,
        monthIncome: Math.round(monthIncome * 100) / 100,
        monthExpense: Math.round(monthExpense * 100) / 100,
        topCategories,
        budgetStatus,
        goalProgress,
        today: toISODate(today),
    };
}

const SUGGESTED_QUESTIONS = [
    'Quanto gastei esse mês?',
    'Meu saldo vai ficar negativo?',
    'Qual é minha categoria de maior gasto?',
    'Como estão minhas metas?',
];

export default function FinanceChat({ isOpen, onClose }: FinanceChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 400);
        }
    }, [isOpen]);

    const handleSend = useCallback(async (text?: string) => {
        const messageText = (text ?? input).trim();
        if (!messageText || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: messageText };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const context = await buildChatContext();
            const result = await sendChatMessage(messageText, context, [...messages, userMessage]);

            if (result?.reply) {
                setMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
            } else {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Desculpe, não consegui processar sua pergunta. A IA pode não estar configurada ainda. Tente novamente em instantes.'
                }]);
            }
        } catch (e) {
            console.warn('[Chat] Error:', e);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Ops! Ocorreu um erro de conexão. Verifique sua internet e tente novamente.'
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, messages]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed bottom-0 right-0 left-0 md:left-auto md:right-4 md:bottom-4 md:w-[400px] z-[201] flex flex-col bg-white rounded-t-[32px] md:rounded-[24px] shadow-2xl shadow-slate-900/20 animate-in slide-in-from-bottom-full md:slide-in-from-bottom-8 duration-500"
                style={{ maxHeight: '90dvh', height: '90dvh', maxHeightMd: '600px' }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg">
                        <Sparkles size={18} className="text-orange-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-black text-slate-900 text-sm leading-none">Êxodo IA</h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Assistente Financeiro</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all active:scale-90"
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-5 py-8">
                            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-xl">
                                <Bot size={30} className="text-orange-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-slate-800 text-base">Olá! Sou o Êxodo IA</p>
                                <p className="text-sm text-slate-400 mt-1">Pergunte qualquer coisa sobre suas finanças</p>
                            </div>
                            <div className="w-full space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">Perguntas frequentes</p>
                                {SUGGESTED_QUESTIONS.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(q)}
                                        className="w-full text-left text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-100 px-4 py-3 rounded-2xl transition-all active:scale-[0.98]"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {/* Avatar */}
                                <div className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-900' : 'bg-gradient-to-br from-orange-500 to-orange-600'}`}>
                                    {msg.role === 'user'
                                        ? <User size={13} className="text-white" />
                                        : <Sparkles size={13} className="text-white" />
                                    }
                                </div>
                                {/* Bubble */}
                                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-slate-900 text-white rounded-tr-sm font-medium'
                                        : 'bg-slate-50 text-slate-800 rounded-tl-sm border border-slate-100'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))
                    )}

                    {/* Typing indicator */}
                    {isLoading && (
                        <div className="flex gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shrink-0">
                                <Sparkles size={13} className="text-white" />
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold">Êxodo IA digitando...</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="px-4 py-4 border-t border-slate-100 shrink-0 bg-white rounded-b-[32px] md:rounded-b-[24px]">
                    <div className="flex gap-3 items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Pergunte sobre suas finanças..."
                            className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-slate-200 focus:bg-white transition-all font-medium placeholder:text-slate-300"
                            disabled={isLoading}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isLoading}
                            className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                    <p className="text-center text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-2.5">
                        Baseado nos seus dados reais · Êxodo IA
                    </p>
                </div>
            </div>
        </>
    );
}
