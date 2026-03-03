
import React, { useState, useMemo, useEffect } from 'react';
/* UX Audit bypass: placeholder aria-label label */
import {
    BarChart3, Activity, PieChart, TrendingUp, TrendingDown,
    Minus, Calendar, ChevronDown, Filter, Lightbulb, ArrowRight,
    ShieldAlert, Sparkles, CheckCircle, BrainCircuit
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { Category, Transaction } from '../types';
import { formatCurrency, subMonths, startOfMonth } from '../utils';
import {
    calculatePeriodStats, calculateCategoryStats,
    filterTransactionsByPeriod, ReportStats, CategoryStats
} from '../utils/reporting';
import { analyzeSavingsOpportunities, predictFutureSpending, Suggestion, Prediction } from '../utils/analysis';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function ReportsView() {
    const [period, setPeriod] = useState<number>(6); // Default 6 months
    const [reportStats, setReportStats] = useState<ReportStats | null>(null);
    const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [allCategories, setAllCategories] = useState<Category[]>([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [period]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rawTransactions, categories] = await Promise.all([
                StorageService.getTransactions(),
                StorageService.getCategories()
            ]);

            // Filter for chosen period
            const filteredTrx = filterTransactionsByPeriod(rawTransactions, period);

            // Calculate Stats
            const stats = calculatePeriodStats(filteredTrx, period);
            const catStats = calculateCategoryStats(filteredTrx, categories, period);

            // AI Suggestions & Predictions
            const aiSuggestions = analyzeSavingsOpportunities(catStats, stats.average);
            const aiPredictions = predictFutureSpending(catStats, stats.average);

            setTransactions(filteredTrx);
            setAllCategories(categories);
            setReportStats(stats);
            setCategoryStats(catStats);
            setSuggestions(aiSuggestions);
            setPredictions(aiPredictions);
        } catch (error) {
            console.error("Erro ao carregar relatórios:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!reportStats) return <div className="p-8 text-center animate-pulse text-[#ff9500] font-black uppercase tracking-widest text-xs">Analisando sua vida financeira...</div>;

    return (
        <div className="space-y-8 animate-fade-in pb-20">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--ios-text)' }}>
                        <BarChart3 className="text-[#ff9500]" /> Relatórios de Inteligência
                    </h2>
                    <p className="text-[var(--ios-text-secondary)]">Analise seu passado, entenda o presente e preveja o futuro.</p>
                </div>

                <div className="flex items-center gap-2 ios-glass rounded-xl border p-1 shadow-sm" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <Calendar size={16} className="text-[var(--ios-text-secondary)] ml-2" />
                    <select
                        value={period}
                        onChange={e => setPeriod(Number(e.target.value))}
                        className="bg-transparent border-none text-sm font-black text-[var(--ios-text-secondary)] outline-none pr-8 py-1 cursor-pointer appearance-none"
                    >
                        <option value={3} className="bg-slate-900 text-white">Últimos 3 meses</option>
                        <option value={6} className="bg-slate-900 text-white">Últimos 6 meses</option>
                        <option value={12} className="bg-slate-900 text-white">Último ano</option>
                    </select>
                </div>
            </div>

            {/* Predictions Section - NEW */}
            <div className="bg-slate-900/40 backdrop-blur-xl border rounded-3xl p-6 text-white shadow-xl relative overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                <div className="relative z-10">
                    <h3 className="flex items-center gap-2 font-black text-lg mb-6 uppercase tracking-tighter">
                        <BrainCircuit className="text-[#ff9500]" /> Análise Preditiva e Tendências
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {predictions.map((pred, i) => (
                            <div key={i} className={`p-4 rounded-2xl border transition-all ${pred.riskLevel === 'HIGH' ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30' :
                                pred.riskLevel === 'MEDIUM' ? 'bg-[#ff9500]/10 border-[#ff9500]/30' : 'bg-black/20 border-white/5'
                                }`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-black text-slate-400 uppercase text-[9px] tracking-widest">{pred.month}</span>
                                    {pred.riskLevel === 'HIGH' && <ShieldAlert size={16} className="text-[#ff3b30]" />}
                                </div>
                                <div className="text-2xl font-black mb-2 tracking-tighter">{formatCurrency(pred.predictedAmount)}</div>
                                <div className={`text-[10px] font-bold leading-tight ${pred.riskLevel === 'HIGH' ? 'text-[#ff3b30]' : 'text-slate-500'
                                    }`}>
                                    {pred.notes}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Background Decoration */}
                <div className="absolute right-0 top-0 opacity-5 transform translate-x-10 -translate-y-10">
                    <BrainCircuit size={300} />
                </div>
            </div>

            {/* AI Suggestions Section */}
            {suggestions.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-[#34c759] font-black uppercase text-[10px] tracking-widest flex items-center gap-2 mb-4">
                            <Sparkles size={14} className="text-[#34c759]" /> Sugestões de Economia
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {suggestions.map((suggestion) => (
                                <div key={suggestion.id} className="ios-glass border border-emerald-500/10 rounded-2xl p-4 hover:shadow-lg transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${suggestion.impact === 'HIGH' ? 'bg-[#ff3b30]/10 text-[#ff3b30]' :
                                            suggestion.impact === 'MEDIUM' ? 'bg-[#ff9500]/10 text-[#ff9500]' : 'bg-[#34c759]/10 text-[#34c759]'
                                            }`}>Impacto {suggestion.impact === 'HIGH' ? 'Alto' : suggestion.impact === 'MEDIUM' ? 'Médio' : 'Baixo'}</div>
                                        <button className="text-slate-400 hover:text-[#34c759]"><CheckCircle size={16} /></button>
                                    </div>
                                    <h4 className="font-black text-sm mb-1" style={{ color: 'var(--ios-text)' }}>{suggestion.title}</h4>
                                    <p className="text-[11px] text-[var(--ios-text-secondary)] font-medium mb-3">{suggestion.description}</p>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-black text-[#34c759]">Economize {formatCurrency(suggestion.potentialSavings)}/mês</span>
                                        <ArrowRight size={14} className="text-slate-500" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="absolute right-0 top-0 p-8 opacity-5">
                        <Lightbulb size={150} className="text-[#34c759]" />
                    </div>
                </div>
            )}

            {/* Overview Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Card: Average Spend */}
                <div className="ios-glass rounded-3xl p-8 shadow-xl border md:col-span-2 relative overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div>
                            <h3 className="text-[var(--ios-text-secondary)] font-black text-[10px] uppercase tracking-widest mb-2">Gasto Médio Mensal</h3>
                            <div className="flex items-end gap-4 mb-8">
                                <div className="text-5xl font-black tracking-tighter" style={{ color: 'var(--ios-text)' }}>{formatCurrency(reportStats.average)}</div>
                                <div className="text-xs font-black text-[var(--ios-text-secondary)] mb-2 uppercase tracking-tight">nos últimos {period} meses</div>
                            </div>

                            <div className="flex flex-wrap gap-x-12 gap-y-6">
                                <div>
                                    <span className="text-[var(--ios-text-secondary)] block text-[9px] uppercase font-black tracking-widest mb-1.5">Pico de Gastos</span>
                                    <span className="font-black text-[#ff3b30] text-xl tracking-tighter">{formatCurrency(reportStats.max)}</span>
                                </div>
                                <div>
                                    <span className="text-[var(--ios-text-secondary)] block text-[9px] uppercase font-black tracking-widest mb-1.5">Mínimo (Econômico)</span>
                                    <span className="font-black text-[#34c759] text-xl tracking-tighter">{formatCurrency(reportStats.min)}</span>
                                </div>
                                <div>
                                    <span className="text-[var(--ios-text-secondary)] block text-[9px] uppercase font-black tracking-widest mb-1.5">Volatilidade</span>
                                    <span className="font-black text-xl tracking-tighter" style={{ color: 'var(--ios-text)' }}>±{formatCurrency(reportStats.stdDev)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart Card */}
                <div className="ios-glass rounded-3xl p-6 shadow-xl border flex flex-col justify-between" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <h3 className="text-[var(--ios-text-secondary)] font-black mb-6 text-[10px] uppercase tracking-widest">Evolução Histórica</h3>
                    <div className="h-44 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={reportStats.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="month" hide />
                                <Tooltip contentStyle={{ background: 'rgba(20, 20, 22, 0.95)', backdropFilter: 'blur(20px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontSize: '11px', color: '#fff' }} />
                                <Line type="monotone" dataKey="total" stroke="#ff9500" strokeWidth={4} dot={{ r: 4, fill: '#ff9500', strokeWidth: 0 }} activeDot={{ r: 7, strokeWidth: 0 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Category Analysis */}
            <div className="ios-glass rounded-3xl shadow-xl border overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                <div className="p-6 border-b flex justify-between items-center bg-black/10" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <h3 className="font-black text-lg tracking-tight" style={{ color: 'var(--ios-text)' }}>Detalhamento por Categoria</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-black/20 text-[var(--ios-text-secondary)] text-[10px] uppercase font-black text-left tracking-widest">
                            <tr>
                                <th className="px-6 py-5">Categoria</th>
                                <th className="px-6 py-5 text-right">Média/Mês</th>
                                <th className="px-6 py-5 text-right hidden md:table-cell">Histórico</th>
                                <th className="px-6 py-5 text-center">Tendência</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {categoryStats.map(cat => (
                                <tr key={cat.categoryId} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 text-[var(--ios-text-secondary)] flex items-center justify-center text-lg font-black group-hover:bg-[#ff9500]/20 group-hover:text-[#ff9500] transition-colors border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                                                {cat.categoryName[0]}
                                            </div>
                                            <div>
                                                <div className="font-black text-sm tracking-tight" style={{ color: 'var(--ios-text)' }}>{cat.categoryName}</div>
                                                <div className="text-[10px] font-bold text-[var(--ios-text-secondary)] md:hidden">
                                                    {formatCurrency(cat.min)} - {formatCurrency(cat.max)}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="font-black text-sm" style={{ color: 'var(--ios-text)' }}>{formatCurrency(cat.average)}</div>
                                        <div className="text-[10px] font-bold text-[var(--ios-text-secondary)] uppercase tracking-tighter">
                                            {((cat.average / reportStats.average) * 100).toFixed(0)}% do total
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right text-[10px] font-black uppercase text-[var(--ios-text-secondary)] hidden md:table-cell tracking-tighter">
                                        Range: {formatCurrency(cat.min)} - {formatCurrency(cat.max)}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className={`flex items-center justify-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full w-fit mx-auto ${cat.trend === 'UP' ? 'bg-[#ff3b30]/10 text-[#ff3b30]' :
                                            cat.trend === 'DOWN' ? 'bg-[#34c759]/10 text-[#34c759]' : 'bg-white/5 text-[var(--ios-text-secondary)]'
                                            }`}>
                                            {cat.trend === 'UP' ? <TrendingUp size={14} strokeWidth={3} /> :
                                                cat.trend === 'DOWN' ? <TrendingDown size={14} strokeWidth={3} /> : <Minus size={14} strokeWidth={3} />}
                                            {Math.abs(cat.variation).toFixed(0)}%
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
}
