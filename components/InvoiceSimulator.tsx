
import React, { useState, useEffect } from 'react';
import {
    Calculator, AlertTriangle, CheckCircle, TrendingUp, Info,
    HelpCircle, DollarSign, ArrowRight, XCircle
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { calculatePMT, calculateBudgetImpact } from '../utils/finance';
import { formatCurrency } from '../utils';
import { SimulationScenario } from '../types';

export default function InvoiceSimulator() {
    // Inputs
    const [invoiceAmount, setInvoiceAmount] = useState<number>(1000);
    const [availableBudget, setAvailableBudget] = useState<number>(2000); // Mocked from user income
    const [interestRate, setInterestRate] = useState<number>(2.5); // Default 2.5% per month
    const [customScenarios, setCustomScenarios] = useState<number[]>([3, 6, 12]);

    // Results
    const [simulationResults, setSimulationResults] = useState<SimulationScenario[]>([]);
    const [recommendedScenario, setRecommendedScenario] = useState<SimulationScenario | null>(null);
    const [showResults, setShowResults] = useState(false);

    // Advanced Mode
    const [firstPaymentDate, setFirstPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        // Auto-fetch dashboard data to estimate available budget?
        // For now, let's keep it simple or auto-fill if User settings exist
    }, []);

    const handleSimulate = () => {
        const results: SimulationScenario[] = [];

        // Spot Payment (À Vista) - Special Scenario
        const spotScenario: SimulationScenario = {
            installments: 1,
            installment_amount: invoiceAmount,
            total_amount: invoiceAmount,
            total_interest: 0,
            first_payment_date: firstPaymentDate,
            cet: 0,
            budget_impact_percent: calculateBudgetImpact(invoiceAmount, availableBudget),
            viability: invoiceAmount > availableBudget ? 'IMPOSSIBLE' : 'GOOD',
            projected_balance_end: availableBudget - invoiceAmount
        };
        results.push(spotScenario);

        // Installment Scenarios
        customScenarios.forEach(months => {
            const pmt = calculatePMT(invoiceAmount, interestRate, months);
            const total = pmt * months;
            const totalInterest = total - invoiceAmount;
            const cet = (totalInterest / invoiceAmount) * 100;
            const impact = calculateBudgetImpact(pmt, availableBudget);
            const balance = availableBudget - pmt;

            let viability: 'GOOD' | 'WARNING' | 'BAD' | 'IMPOSSIBLE' = 'GOOD';
            if (balance < 0) viability = 'IMPOSSIBLE';
            else if (balance < availableBudget * 0.1) viability = 'BAD';
            else if (balance < availableBudget * 0.3) viability = 'WARNING';

            results.push({
                installments: months,
                installment_amount: pmt,
                total_amount: total,
                total_interest: totalInterest,
                first_payment_date: firstPaymentDate,
                cet: cet,
                budget_impact_percent: impact,
                viability,
                projected_balance_end: balance
            });
        });

        setSimulationResults(results);
        recommendOption(results);
        setShowResults(true);
    };

    const recommendOption = (scenarios: SimulationScenario[]) => {
        // Logic:
        // 1. Filter out impossible
        // 2. Sort by lowest interest IF impact is manageable (< 30% of budget)
        // 3. If tight budget, prefer lower installment amount (higher months)

        const viable = scenarios.filter(s => s.viability !== 'IMPOSSIBLE');

        if (viable.length === 0) {
            setRecommendedScenario(scenarios[scenarios.length - 1]); // Suggest longest term as "least impossible"
            return;
        }

        // If Spot is viable and leaves decent buffer (> 20%), Recommend Spot
        const spot = viable.find(s => s.installments === 1);
        if (spot && spot.projected_balance_end > (availableBudget * 0.2)) {
            setRecommendedScenario(spot);
            return;
        }

        // Otherwise, find option with best balance between Interest and Impact
        // We want: Lowest Interest that has 'GOOD' viability.
        const goodOptions = viable.filter(s => s.viability === 'GOOD');
        if (goodOptions.length > 0) {
            // Pick the one with lowest interest (which is usually fewer installments)
            setRecommendedScenario(goodOptions.sort((a, b) => a.total_interest - b.total_interest)[0]);
            return;
        }

        // If no GOOD options, pick lowest monthly payment from WARNING options
        const warningOptions = viable.filter(s => s.viability === 'WARNING');
        if (warningOptions.length > 0) {
            setRecommendedScenario(warningOptions.sort((a, b) => a.installment_amount - b.installment_amount)[0]);
            return;
        }

        // Last resort
        setRecommendedScenario(viable[0]);
    };

    const applyInstallment = (scenario: SimulationScenario) => {
        if (confirm(`Confirmar parcelamento em ${scenario.installments}x de ${formatCurrency(scenario.installment_amount)}?`)) {
            // Logic to generate transactions
            const newTrx = {
                id: StorageService.generateId(),
                description: `Parcelamento Fatura (${scenario.installments}x)`,
                amount: scenario.installment_amount, // per installment
                total_amount: scenario.total_amount, // total
                type: 'DESPESA',
                category_id: 'cat_boleto', // todo: valid cat
                date: scenario.first_payment_date,
                status: 'PREVISTA',
                installments: {
                    current: 1,
                    total: scenario.installments
                },
                is_simulation_result: true
            };

            // We use the existing saveTransaction logic which handles splitting
            // Note: saveTransaction expects a single Transaction object and splits it if installments.current=1
            // We need to cast types correctly.
            StorageService.saveTransaction(newTrx as any);
            alert('Parcelamento confirmado e gerado com sucesso!');
            setShowResults(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Calculator className="text-blue-400" /> Simulador de Parcelamento
                    </h2>
                    <p className="text-slate-400 mt-1">Veja quanto você vai pagar de juros e como isso afeta seu bolso.</p>
                </div>
                <div className="absolute right-0 top-0 opacity-10 p-4 transform translate-x-10 -translate-y-5">
                    <Calculator size={120} />
                </div>
            </div>

            {!showResults && (
                <div className="bg-white rounded-xl shadow border border-slate-200 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Valor da Fatura</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-slate-400">R$</span>
                                <input
                                    type="number"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={invoiceAmount}
                                    onChange={e => setInvoiceAmount(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Orçamento Disponível</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-slate-400">R$</span>
                                <input
                                    type="number"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={availableBudget}
                                    onChange={e => setAvailableBudget(Number(e.target.value))}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Sua reserva ou saldo no momento.</p>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
                            Taxa de Juros (a.m.) <HelpCircle size={14} className="text-slate-400" title="Consulte seu banco" />
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                step="0.1"
                                className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-center font-bold"
                                value={interestRate}
                                onChange={e => setInterestRate(Number(e.target.value))}
                            />
                            <span className="text-slate-600 font-medium">%</span>
                            <div className="text-xs text-slate-500 flex-1">
                                Taxa média de cartão gira em torno de 2.5% a 14% ao mês. Cuidado!
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-slate-700">Opções de Parcelamento</label>
                        <div className="flex flex-wrap gap-2">
                            {[3, 6, 9, 12, 18, 24].map(n => (
                                <button
                                    key={n}
                                    onClick={() => {
                                        if (customScenarios.includes(n)) setCustomScenarios(customScenarios.filter(x => x !== n));
                                        else setCustomScenarios([...customScenarios, n].sort((a, b) => a - b));
                                    }}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${customScenarios.includes(n)
                                            ? 'bg-slate-800 text-white border-slate-800'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    {n}x
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleSimulate}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-600/20 transition-all flex justify-center items-center gap-2"
                    >
                        <TrendingUp size={24} /> SIMULAR CENÁRIOS
                    </button>
                </div>
            )}

            {showResults && (
                <div className="space-y-6">
                    <button onClick={() => setShowResults(false)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium">← Voltar para configuração</button>

                    {/* Recommendation Card */}
                    {recommendedScenario && (
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                            <div className="absolute right-0 top-0 p-4 opacity-5"><CheckCircle size={100} /></div>
                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase mb-3">
                                    <TrendingUp size={12} /> Nossa Recomendação
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-1">
                                    {recommendedScenario.installments === 1 ? 'Pagar à Vista' : `Parcelar em ${recommendedScenario.installments}x`}
                                </h3>
                                <p className="text-slate-600 mb-6 max-w-lg">
                                    {recommendedScenario.installments === 1
                                        ? 'Você tem saldo suficiente e economiza 100% dos juros!'
                                        : `Esta opção equilibra uma parcela que cabe no bolso (${formatCurrency(recommendedScenario.installment_amount)}) com o menor juros possível.`}
                                </p>

                                <div className="flex flex-col md:flex-row gap-4 items-center">
                                    <button onClick={() => applyInstallment(recommendedScenario)} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-green-600/20 w-full md:w-auto">
                                        Aceitar Recomendação
                                    </button>
                                    <div className="text-sm font-medium text-green-800">
                                        Saldo projetado: {formatCurrency(recommendedScenario.projected_balance_end)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Comparison Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-x-auto pb-4">
                        {simulationResults.map((scenario, idx) => (
                            <div key={idx} className={`bg-white rounded-xl shadow-sm border p-5 flex flex-col relative ${recommendedScenario === scenario ? 'border-green-500 ring-2 ring-green-500/10' : 'border-slate-200'}`}>
                                {recommendedScenario === scenario && (
                                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">Melhor Opção</div>
                                )}

                                <div className="border-b border-slate-100 pb-4 mb-4">
                                    <h4 className="text-lg font-bold text-slate-800 mb-1">
                                        {scenario.installments === 1 ? 'À Vista' : `${scenario.installments}x de ${formatCurrency(scenario.installment_amount)}`}
                                    </h4>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Total Final</span>
                                        <span className={`font-bold ${scenario.total_interest > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatCurrency(scenario.total_amount)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6 flex-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Juros Totais</span>
                                        <span className="font-medium text-slate-700">{formatCurrency(scenario.total_interest)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">CET mensal</span>
                                        <span className="font-medium text-slate-700">{scenario.cet.toFixed(1)}%</span>
                                    </div>

                                    <div className="mt-4">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-500">Impacto no Orçamento</span>
                                            <span className={`font-bold ${scenario.budget_impact_percent > 50 ? 'text-red-500' : 'text-slate-700'}`}>{scenario.budget_impact_percent.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${scenario.budget_impact_percent > 50 ? 'bg-red-500' : scenario.budget_impact_percent > 30 ? 'bg-yellow-400' : 'bg-green-500'}`}
                                                style={{ width: `${Math.min(scenario.budget_impact_percent, 100)}%` }}>
                                            </div>
                                        </div>
                                    </div>

                                    {scenario.viability === 'IMPOSSIBLE' && (
                                        <div className="bg-red-50 text-red-600 text-xs p-2 rounded flex items-center gap-1 mt-2">
                                            <XCircle size={12} /> Saldo ficaria negativo!
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => applyInstallment(scenario)}
                                    disabled={scenario.viability === 'IMPOSSIBLE'}
                                    className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${scenario.viability === 'IMPOSSIBLE'
                                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                                        }`}
                                >
                                    Escolher {scenario.installments}x
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
