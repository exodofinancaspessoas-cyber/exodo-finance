
import React, { useState, useEffect } from 'react';
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

    useEffect(() => {
        loadData();
    }, [period]);

    const loadData = () => {
        const rawTransactions = StorageService.getTransactions();
        const categories = StorageService.getCategories();

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
    };

    if (!reportStats) return <div className="p-8 text-center animate-pulse text-indigo-600 font-medium">Analisando suas finanças...</div>;

    return (
        <div className="space-y-8 animate-fade-in pb-20">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="text-indigo-600" /> Relatórios de Inteligência
                    </h2>
                    <p className="text-slate-500">Analise seu passado, entenda o presente e preveja o futuro.</p>
                </div>

                <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                    <Calendar size={16} className="text-slate-400 ml-2" />
                    <select
                        value={period}
                        onChange={e => setPeriod(Number(e.target.value))}
                        className="bg-transparent border-none text-sm font-medium text-slate-700 outline-none pr-8 py-1 cursor-pointer"
                    >
                        <option value={3}>Últimos 3 meses</option>
                        <option value={6}>Últimos 6 meses</option>
                        <option value={12}>Último ano</option>
                    </select>
                </div>
            </div>

            {/* Predictions Section - NEW */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="flex items-center gap-2 font-bold text-lg mb-6">
                        <BrainCircuit className="text-purple-400" /> Análise Preditiva e Tendências
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {predictions.map((pred, i) => (
                            <div key={i} className={`p-4 rounded-xl border ${pred.riskLevel === 'HIGH' ? 'bg-red-500/10 border-red-500/30' :
                                    pred.riskLevel === 'MEDIUM' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-slate-800 border-slate-700'
                                }`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-slate-300 uppercase text-xs">{pred.month}</span>
                                    {pred.riskLevel === 'HIGH' && <ShieldAlert size={16} className="text-red-400" />}
                                </div>
                                <div className="text-2xl font-bold mb-2">{formatCurrency(pred.predictedAmount)}</div>
                                <div className={`text-xs ${pred.riskLevel === 'HIGH' ? 'text-red-300' : 'text-slate-400'
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
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-emerald-800 font-bold text-lg flex items-center gap-2 mb-4">
                            <Sparkles className="text-emerald-500" /> Sugestões Inteligentes de Economia
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {suggestions.map((suggestion) => (
                                <div key={suggestion.id} className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-xl p-4 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${suggestion.impact === 'HIGH' ? 'bg-red-100 text-red-600' :
                                                suggestion.impact === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-600'
                                            }`}>Impacto {suggestion.impact === 'HIGH' ? 'Alto' : suggestion.impact === 'MEDIUM' ? 'Médio' : 'Baixo'}</div>
                                        <button className="text-slate-400 hover:text-emerald-600"><CheckCircle size={16} /></button>
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">{suggestion.title}</h4>
                                    <p className="text-xs text-slate-500 mb-3">{suggestion.description}</p>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-semibold text-emerald-600">Economie {formatCurrency(suggestion.potentialSavings)}/mês</span>
                                        <ArrowRight size={14} className="text-slate-300" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="absolute right-0 top-0 p-8 opacity-5">
                        <Lightbulb size={150} />
                    </div>
                </div>
            )}

            {/* Overview Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Card: Average Spend */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 md:col-span-2 relative overflow-hidden">
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div>
                            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">Gasto Médio Mensal</h3>
                            <div className="flex items-end gap-4 mb-6">
                                <div className="text-4xl font-bold text-slate-800">{formatCurrency(reportStats.average)}</div>
                                <div className="text-sm font-medium text-slate-400 mb-2">nos últimos {period} meses</div>
                            </div>

                            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
                                <div>
                                    <span className="text-slate-400 block text-xs uppercase mb-1">Pico de Gastos</span>
                                    <span className="font-bold text-indigo-600 text-lg">{formatCurrency(reportStats.max)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-xs uppercase mb-1">Mínimo (Economia)</span>
                                    <span className="font-bold text-green-600 text-lg">{formatCurrency(reportStats.min)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-xs uppercase mb-1">Volatilidade</span>
                                    <span className="font-bold text-slate-700 text-lg">±{formatCurrency(reportStats.stdDev)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                    <h3 className="text-slate-600 font-bold mb-4 text-sm uppercase">Evolução Histórica</h3>
                    <div className="h-40 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={reportStats.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="month" hide />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Category Analysis */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800">Detalhamento por Categoria</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold text-left">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-lg">Categoria</th>
                                <th className="px-6 py-4 text-right">Média/Mês</th>
                                <th className="px-6 py-4 text-right hidden md:table-cell">Histórico</th>
                                <th className="px-6 py-4 text-center">Tendência</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {categoryStats.map(cat => (
                                <tr key={cat.categoryId} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-lg group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                {cat.categoryName[0]}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{cat.categoryName}</div>
                                                <div className="text-xs text-slate-400 md:hidden">{formatCurrency(cat.min)} - {formatCurrency(cat.max)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-bold text-slate-700">{formatCurrency(cat.average)}</div>
                                        <div className="text-xs text-slate-400">{((cat.average / reportStats.average) * 100).toFixed(0)}% do total</div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-xs text-slate-500 hidden md:table-cell h-16 w-32 relative">
                                        {/* Mini sparkline visualization could go here, for now just range */}
                                        Range: {formatCurrency(cat.min)} - {formatCurrency(cat.max)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`flex items-center justify-center gap-1 text-sm font-bold px-2 py-1 rounded-full w-fit mx-auto ${cat.trend === 'UP' ? 'bg-red-50 text-red-600' :
                                                cat.trend === 'DOWN' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'
                                            }`}>
                                            {cat.trend === 'UP' ? <TrendingUp size={14} /> :
                                                cat.trend === 'DOWN' ? <TrendingDown size={14} /> : <Minus size={14} />}
                                            {Math.abs(cat.variation).toFixed(0)}%
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
