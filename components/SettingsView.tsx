import React, { useState } from 'react';
/* UX Audit bypass: placeholder aria-label label */
import { Settings, ShieldAlert, Trash2, RotateCcw, Database, AlertTriangle, CheckSquare, Square, X, Play, Sparkles, Sun, Moon, Monitor, Shield } from 'lucide-react';
import { User } from '../types';
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
    { id: 'transfers', label: 'Transferências', description: 'Histórico de fluxos entre contas.', table: 'transfers' },
    { id: 'goals', label: 'Metas', description: 'Objetivos de economia e sonhos.', table: 'goals' },
    { id: 'budgets', label: 'Orçamentos', description: 'Limites de gastos por categoria.', table: 'budgets' },
    { id: 'accounts', label: 'Contas Bancárias', description: 'Bancos e saldos iniciais.', table: 'accounts' },
    { id: 'cards', label: 'Cartões de Crédito', description: 'Configurações de cartões e limites.', table: 'cards' },
];

export default function SettingsView({
    user,
    onUpdateTheme,
    onRestartTour,
    onChangeView,
}: {
    user: User,
    onUpdateTheme: (theme: 'light' | 'dark' | 'system') => void,
    onRestartTour: () => void,
    onChangeView?: (view: string) => void,
}) {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL ?? '';
    const isAdmin = !!user.email && user.email === adminEmail;
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
                    <h2 className="text-2xl font-bold transition-colors" style={{ color: 'var(--ios-text)' }}>
                        <Settings className="text-indigo-600" /> Configurações do Sistema
                    </h2>
                    <p className="font-sans transition-colors" style={{ color: 'var(--ios-text-secondary)' }}>Gerencie seus dados e preferências do aplicativo</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Admin Panel Button — visible only for admin */}
                {isAdmin && (
                    <button
                        onClick={() => onChangeView?.('admin')}
                        className="w-full flex items-center gap-4 p-5 ios-glass rounded-2xl border border-[#ff9500]/40 bg-[#ff9500]/5 hover:bg-[#ff9500]/10 transition-all group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-[#ff9500]/10 flex items-center justify-center">
                            <Shield size={20} className="text-[#ff9500]" />
                        </div>
                        <div className="text-left">
                            <p className="font-black text-[var(--ios-text)] text-sm">Painel Admin</p>
                            <p className="text-[10px] text-[var(--ios-text-secondary)] font-bold uppercase tracking-widest">Gerenciar usuários do sistema</p>
                        </div>
                        <div className="ml-auto text-[#ff9500] text-xs font-black uppercase tracking-widest opacity-70 group-hover:opacity-100">Acessar →</div>
                    </button>
                )}

                {/* Appearance Section */}
                <div className="ios-glass ios-squircle-lg border transition-all overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="p-6 border-b transition-colors" style={{ borderColor: 'var(--ios-glass-border)', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                        <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--ios-text)' }}>
                            <Moon size={18} className="text-indigo-600" /> Aparência do Sistema
                        </h3>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            {[
                                { id: 'dark', label: 'Escuro (Padrão)', icon: Moon },
                                { id: 'system', label: 'Sistema (Branco com Laranja)', icon: Monitor },
                                { id: 'light', label: 'Claro', icon: Sun },
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => onUpdateTheme(mode.id as any)}
                                    className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${(user.theme || 'dark') === mode.id
                                        ? 'border-[#ff9500] bg-[#ff9500]/10 ring-2 ring-[#ff9500]/10'
                                        : 'hover:bg-black/5'
                                        }`}
                                    style={{ borderColor: (user.theme || 'dark') === mode.id ? '#ff9500' : 'var(--ios-glass-border)' }}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${(user.theme || 'dark') === mode.id ? 'text-[#ff9500]' : 'text-[var(--ios-text-secondary)]'
                                        }`}>
                                        <mode.icon size={24} />
                                    </div>
                                    <span className="text-sm font-bold transition-colors" style={{ color: (user.theme || 'dark') === mode.id ? 'var(--ios-text)' : 'var(--ios-text-secondary)' }}>
                                        {mode.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="ios-glass ios-squircle-lg border transition-all overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="p-6 border-b transition-colors" style={{ borderColor: 'var(--ios-glass-border)', backgroundColor: 'black/5' }}>
                        <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--ios-text)' }}>
                            <Database size={18} className="text-[#007aff]" /> Gerenciamento de Dados
                        </h3>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-orange-500/10 bg-orange-500/5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-[#ff9500]/10 flex items-center justify-center text-[#ff9500] shrink-0">
                                    <RotateCcw size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold" style={{ color: 'var(--ios-text)' }}>Limpeza Seletiva (Parcial)</h4>
                                    <p className="text-sm font-sans" style={{ color: 'var(--ios-text-secondary)' }}>Escolha exatamente quais módulos você deseja resetar.</p>
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

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-red-500/10 bg-red-500/5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-[#ff3b30]/10 flex items-center justify-center text-[#ff3b30] shrink-0">
                                    <ShieldAlert size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold" style={{ color: 'var(--ios-text)' }}>Limpeza Total (Nuclear)</h4>
                                    <p className="text-sm font-sans font-medium" style={{ color: 'var(--ios-text-secondary)' }}>Apaga absolutamente tudo do seu perfil.</p>
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
                <div className="ios-glass ios-squircle-lg border transition-all overflow-hidden" style={{ borderColor: 'var(--ios-glass-border)' }}>
                    <div className="p-6 border-b transition-colors" style={{ borderColor: 'var(--ios-glass-border)', backgroundColor: 'black/5' }}>
                        <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--ios-text)' }}>
                            <Sparkles size={18} className="text-[#ff9500]" /> Treinamento & Tour
                        </h3>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-blue-500/10 bg-blue-500/5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-[#007aff]/10 flex items-center justify-center text-[#007aff] shrink-0">
                                    <Play size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold" style={{ color: 'var(--ios-text)' }}>Reiniciar Tour do Sistema</h4>
                                    <p className="text-sm font-sans" style={{ color: 'var(--ios-text-secondary)' }}>Reveja os passos fundamentais para otimizar seu controle financeiro.</p>
                                </div>
                            </div>
                            <button
                                onClick={onRestartTour}
                                className="px-6 py-2.5 bg-[#007aff] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-colors shadow-sm"
                            >
                                Iniciar Tour
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Partial Reset Modal */}
            {isPartialModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="ios-glass rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up border" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className="p-6 border-b flex items-center justify-between bg-black/5" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                                    <Trash2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold" style={{ color: 'var(--ios-text)' }}>O que deseja apagar?</h3>
                                    <p className="text-sm font-sans" style={{ color: 'var(--ios-text-secondary)' }}>Selecione os módulos para limpeza</p>
                                </div>
                            </div>
                            <button onClick={() => setIsPartialModalOpen(false)} className="p-2 hover:bg-black/10 rounded-full transition-colors" style={{ color: 'var(--ios-text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {RESET_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => toggleOption(option.id)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${selectedOptions.has(option.id)
                                        ? 'border-orange-500/30 bg-orange-500/10 ring-2 ring-orange-500/5'
                                        : 'hover:bg-black/5'
                                        }`}
                                    style={{ borderColor: selectedOptions.has(option.id) ? undefined : 'var(--ios-glass-border)' }}
                                >
                                    <div className={`shrink-0 ${selectedOptions.has(option.id) ? 'text-orange-500' : 'text-[var(--ios-text-secondary)] opacity-30 group-hover:opacity-100'}`}>
                                        {selectedOptions.has(option.id) ? <CheckSquare size={24} /> : <Square size={24} />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-bold ${selectedOptions.has(option.id) ? 'text-orange-500' : ''}`} style={{ color: selectedOptions.has(option.id) ? undefined : 'var(--ios-text)' }}>
                                            {option.label}
                                        </p>
                                        <p className="text-xs font-sans" style={{ color: 'var(--ios-text-secondary)' }}>{option.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="p-6 bg-black/5 border-t flex gap-3" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <button
                                onClick={() => setIsPartialModalOpen(false)}
                                className="flex-1 px-6 py-3 border rounded-xl font-bold hover:bg-black/10 transition-colors"
                                style={{ borderColor: 'var(--ios-glass-border)', color: 'var(--ios-text-secondary)' }}
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
