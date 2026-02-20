import React, { useState } from 'react';
import { Settings, ShieldAlert, Trash2, RotateCcw, Database, AlertTriangle, CheckSquare, Square, X, Play, Sparkles } from 'lucide-react';
import { StorageService } from '../services/storage';

type ResetOption = {
    id: string;
    label: string;
    description: string;
    table: string;
};

const RESET_OPTIONS: ResetOption[] = [
    { id: 'transactions', label: 'Transações', description: 'Todas as receitas e despesas registradas.', table: 'transactions' },
    { id: 'recurring', label: 'Regras de Recorrência', description: 'Configurações de contas fixas e variáveis.', table: 'recurring_expenses' },
    { id: 'transfers', label: 'Transferências', description: 'Histórico de movimentações entre contas.', table: 'transfers' },
    { id: 'goals', label: 'Metas', description: 'Objetivos de economia e sonhos.', table: 'goals' },
    { id: 'budgets', label: 'Orçamentos', description: 'Limites de gastos por categoria.', table: 'budgets' },
    { id: 'accounts', label: 'Contas Bancárias', description: 'Bancos e saldos iniciais.', table: 'accounts' },
    { id: 'cards', label: 'Cartões de Crédito', description: 'Configurações de cartões e limites.', table: 'cards' },
];

export default function SettingsView({ onRestartTour }: { onRestartTour: () => void }) {
    const [isSaving, setIsSaving] = useState(false);
    const [isPartialModalOpen, setIsPartialModalOpen] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set(['transactions', 'recurring']));

    const toggleOption = (id: string) => {
        const next = new Set(selectedOptions);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedOptions(next);
    };

    const handleReset = async (type: 'total' | 'partial') => {
        if (type === 'partial' && selectedOptions.size === 0) {
            alert('Selecione ao menos um item para apagar.');
            return;
        }

        const title = type === 'total' ? 'RESET TOTAL' : 'RESET SELETIVO';
        const message = type === 'total'
            ? 'Isso apagará ABSOLUTAMENTE TUDO da nuvem e deste dispositivo.'
            : `Isso apagará permanentemente os itens selecionados (${selectedOptions.size} categorias).`;

        const confirm1 = confirm(`ATENÇÃO: ${title}\n\n${message}\n\nContinuar?`);
        if (!confirm1) return;

        const confirm2 = confirm('TEM CERTEZA ABSOLUTA? Esta ação é irreversível.');
        if (!confirm2) return;

        const textResult = prompt(`Para confirmar, digite "CONFIRMAR" abaixo:`);
        if (textResult !== 'CONFIRMAR') {
            alert('Confirmação inválida. Operação cancelada.');
            return;
        }

        setIsSaving(true);
        try {
            if (type === 'total') {
                await StorageService.nuclearReset();
            } else {
                const tables = RESET_OPTIONS
                    .filter(opt => selectedOptions.has(opt.id))
                    .map(opt => opt.table);

                await StorageService.customReset(tables);
                setIsPartialModalOpen(false);
            }
        } catch (error) {
            console.error('Reset Error:', error);
            alert('Erro ao realizar reset. Tente novamente.');
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="text-indigo-600" /> Configurações do Sistema
                    </h2>
                    <p className="text-slate-500 font-sans">Gerencie seus dados e preferências do aplicativo</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Database size={18} className="text-indigo-600" /> Gerenciamento de Dados
                        </h3>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-orange-100 bg-orange-50/30">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                                    <RotateCcw size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">Limpeza Seletiva (Parcial)</h4>
                                    <p className="text-sm text-slate-600 font-sans">Escolha exatamente quais módulos você deseja resetar.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPartialModalOpen(true)}
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 transition-colors shadow-sm"
                            >
                                Selecionar Itens
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-red-100 bg-red-50/30">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                                    <ShieldAlert size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">Limpeza Total (Nuclear)</h4>
                                    <p className="text-sm text-red-700/70 font-sans font-medium">Apaga absolutamente tudo do seu perfil.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleReset('total')}
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-sm"
                            >
                                Reset Total
                            </button>
                        </div>
                    </div>
                </div>

                {/* Training & Onboarding Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Sparkles size={18} className="text-orange-600" /> Treinamento & Tour
                        </h3>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-blue-100 bg-blue-50/30">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                    <Play size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">Reiniciar Tour do Sistema</h4>
                                    <p className="text-sm text-slate-600 font-sans">Reveja os passos fundamentais para otimizar seu controle financeiro.</p>
                                </div>
                            </div>
                            <button
                                onClick={onRestartTour}
                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-sm"
                            >
                                Iniciar Tour
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Partial Reset Modal */}
            {isPartialModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                                    <Trash2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">O que deseja apagar?</h3>
                                    <p className="text-sm text-slate-500 font-sans">Selecione os módulos para limpeza</p>
                                </div>
                            </div>
                            <button onClick={() => setIsPartialModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {RESET_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => toggleOption(option.id)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${selectedOptions.has(option.id)
                                        ? 'border-orange-200 bg-orange-50/50 ring-2 ring-orange-500/10'
                                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <div className={`shrink-0 ${selectedOptions.has(option.id) ? 'text-orange-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                        {selectedOptions.has(option.id) ? <CheckSquare size={24} /> : <Square size={24} />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-bold ${selectedOptions.has(option.id) ? 'text-orange-900' : 'text-slate-700'}`}>
                                            {option.label}
                                        </p>
                                        <p className="text-xs text-slate-500 font-sans">{option.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setIsPartialModalOpen(false)}
                                className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleReset('partial')}
                                disabled={selectedOptions.size === 0 || isSaving}
                                className="flex-[2] px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-900/20 disabled:opacity-50"
                            >
                                {isSaving ? 'Limpando...' : `Confirmar Reset (${selectedOptions.size})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
