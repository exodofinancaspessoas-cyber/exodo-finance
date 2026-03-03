
import React, { useState, useEffect } from 'react';
import { Target, Plus, Edit2, Trash2, CheckCircle, TrendingUp, AlertCircle, DollarSign } from 'lucide-react';
import { Goal } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';
import { hapticFeedback } from './ui/Skeleton';

export default function GoalsView() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form
    const [formData, setFormData] = useState<Partial<Goal>>({
        name: '',
        target_amount: 0,
        current_amount: 0,
        deadline: '',
        icon: '🎯',
        status: 'ACTIVE'
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            setGoals(await StorageService.getGoals());
        } catch (error) {
            console.error("Erro ao carregar metas:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateProgress = (curr: number, target: number) => {
        if (target <= 0) return 0;
        return Math.min((curr / target) * 100, 100);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.target_amount) return;

        const newGoal: Goal = {
            id: editingId || StorageService.generateId(),
            name: formData.name,
            target_amount: Number(formData.target_amount),
            current_amount: Number(formData.current_amount),
            deadline: formData.deadline || '',
            icon: formData.icon || '🎯',
            status: (formData.status as any) || 'ACTIVE',
            start_date: editingId ? (goals.find(g => g.id === editingId)?.start_date || new Date().toISOString()) : new Date().toISOString(),
            history: editingId ? (goals.find(g => g.id === editingId)?.history || []) : [{
                date: new Date().toISOString(),
                amount: Number(formData.current_amount),
                note: 'Criação da meta'
            }]
        };

        await StorageService.saveGoal(newGoal);
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ name: '', target_amount: 0, current_amount: 0, deadline: '', icon: '🎯', status: 'ACTIVE' });
        await loadData();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta meta?')) {
            await StorageService.deleteGoal(id);
            await loadData();
        }
    };

    const handleEdit = (goal: Goal) => {
        setEditingId(goal.id);
        setFormData(goal);
        setIsModalOpen(true);
    };

    const handleAddValue = async (goal: Goal) => {
        const amountStr = prompt(`Quanto deseja adicionar à meta "${goal.name}"?`);
        if (amountStr) {
            const amount = parseFloat(amountStr.replace(',', '.'));
            if (!isNaN(amount)) {
                const updatedGoal = { ...goal };
                updatedGoal.current_amount += amount;
                updatedGoal.history.push({
                    date: new Date().toISOString(),
                    amount: amount,
                    note: 'Aporte manual'
                });

                if (updatedGoal.current_amount >= updatedGoal.target_amount) {
                    updatedGoal.status = 'COMPLETED';
                    alert(`Parabéns! Você atingiu a meta "${goal.name}"! 🎉`);
                }

                await StorageService.saveGoal(updatedGoal);
                await loadData();
            }
        }
    };



    return (
        <div className="animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex justify-between items-end mb-10 px-1">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-[#ff9500] uppercase tracking-widest leading-none">Planejamento</span>
                    <h1 className="text-4xl font-black text-[var(--ios-text)] tracking-tight leading-none uppercase text-shadow-sm">Metas</h1>
                </div>
                <button
                    id="btn-nova-meta"
                    onClick={() => { hapticFeedback(10); setEditingId(null); setIsModalOpen(true); }}
                    className="bg-[#ff9500] hover:bg-[#ff9500]/90 text-white w-14 h-14 ios-squircle flex items-center justify-center shadow-lg shadow-[#ff9500]/20 transition-all active:scale-95 border border-white/10"
                    aria-label="Nova Meta"
                >
                    <Plus size={24} strokeWidth={3} />
                </button>
            </div>

            {/* Goals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {goals.map(goal => {
                    const progress = calculateProgress(goal.current_amount, goal.target_amount);
                    const isCompleted = goal.status === 'COMPLETED';

                    return (
                        <div key={goal.id} className={`ios-glass ios-squircle-md shadow-sm border p-7 relative group overflow-hidden transition-all hover:shadow-xl hover:translate-y-[-4px] ${isCompleted ? 'border-[#34c759]/20 bg-[#34c759]/5' : ''}`} style={{ borderColor: 'var(--ios-glass-border)' }}>
                            {isCompleted && (
                                <div className="absolute top-0 right-0 bg-[#34c759] text-white text-[10px] font-black px-6 py-2 rounded-bl-3xl uppercase tracking-widest shadow-md z-10">
                                    Concluída
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-6">
                                <div className="w-16 h-16 ios-squircle bg-black/5 dark:bg-white/5 flex items-center justify-center text-4xl shadow-inner border border-[var(--ios-glass-border)] transition-transform group-hover:scale-110 duration-500">
                                    {goal.icon}
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                        onClick={() => { hapticFeedback(5); handleEdit(goal); }}
                                        className="w-10 h-10 bg-black/5 dark:bg-white/5 ios-squircle flex items-center justify-center text-[var(--ios-text-secondary)] hover:text-[#ff9500] transition-all border border-transparent hover:border-[#ff9500]/30 shadow-sm"
                                    >
                                        <Edit2 size={16} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => { hapticFeedback(20); handleDelete(goal.id); }}
                                        className="w-10 h-10 bg-[#ff3b30]/10 ios-squircle flex items-center justify-center text-[#ff3b30] hover:brightness-110 transition-all border border-transparent hover:border-[#ff3b30]/30 shadow-sm"
                                    >
                                        <Trash2 size={16} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-black text-2xl tracking-tighter mb-1 text-[var(--ios-text)] uppercase">{goal.name}</h3>
                            <div className="flex items-center gap-2 mb-8">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 ios-squircle bg-black/5 dark:bg-white/5 border border-[var(--ios-glass-border)] ${isCompleted ? 'text-[#34c759]' : 'text-[var(--ios-text-secondary)]'}`}>
                                    Prazo: {goal.deadline ? new Date(goal.deadline).toLocaleDateString('pt-BR') : 'Sem prazo'}
                                </span>
                            </div>

                            <div className="mb-4 flex flex-col gap-1">
                                <div className="flex justify-between items-end">
                                    <span className={`text-4xl font-black tracking-tighter shadow-sm ${isCompleted ? 'text-[#34c759]' : 'text-[#ff9500]'}`}>
                                        {formatCurrency(goal.current_amount)}
                                    </span>
                                    <span className="text-[10px] font-black mb-2 uppercase tracking-widest text-[var(--ios-text-secondary)] opacity-60">
                                        Faltam {formatCurrency(Math.max(0, goal.target_amount - goal.current_amount))}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40 text-[var(--ios-text-secondary)]">Meta: {formatCurrency(goal.target_amount)}</p>
                                    <p className={`text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'text-[#34c759]' : 'text-[#ff9500]'}`}>{progress.toFixed(0)}%</p>
                                </div>
                            </div>

                            <div className="w-full bg-black/10 dark:bg-white/5 ios-squircle h-3 mb-8 overflow-hidden shadow-inner border border-[var(--ios-glass-border)]">
                                <div
                                    className={`h-full ios-squircle transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,149,0,0.3)] ${isCompleted ? 'bg-gradient-to-r from-[#34c759] to-[#30d158] shadow-[#34c759]/40' : 'bg-gradient-to-r from-[#ff9500] to-[#ffcc00] shadow-[#ff9500]/40'}`}
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>

                            <button
                                onClick={() => { hapticFeedback(5); handleAddValue(goal); }}
                                className={`w-full py-5 ios-squircle font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 border shadow-sm active:scale-95 ${isCompleted
                                    ? 'bg-[#34c759]/10 border-[#34c759]/20 text-[#34c759]'
                                    : 'bg-[#ff9500]/10 border-[#ff9500]/20 text-[#ff9500] hover:bg-[#ff9500]/15'
                                    }`}
                            >
                                <Plus size={18} strokeWidth={3} /> {isCompleted ? 'Adicionar mais' : 'Aportar valor'}
                            </button>
                        </div>
                    );
                })}

                {goals.length === 0 && (
                    <div className="col-span-full py-24 text-center ios-glass ios-squircle-md border-2 border-dashed flex flex-col items-center justify-center px-6" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        <div className="w-20 h-20 bg-black/5 dark:bg-white/5 ios-squircle flex items-center justify-center mb-6 border shadow-inner" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <Target size={36} className="text-[var(--ios-text-secondary)] opacity-50" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-xl font-black text-[var(--ios-text)] tracking-tight mb-2 uppercase">Nenhuma meta criada</h2>
                        <p className="text-[var(--ios-text-secondary)] text-sm font-black uppercase tracking-widest max-w-xs px-4 opacity-70 mb-10">Defina seus sonhos e comece a poupar de forma organizada.</p>
                        <button
                            onClick={() => { hapticFeedback(10); setEditingId(null); setIsModalOpen(true); }}
                            className="bg-[#ff9500] text-white px-10 py-5 ios-squircle text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all border border-white/10"
                        >
                            Comece agora
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="ios-glass ios-squircle-md shadow-2xl w-full max-w-lg overflow-hidden border animate-slide-up" style={{ borderColor: 'var(--ios-glass-border)' }}>
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b flex justify-between items-center bg-black/5" style={{ borderColor: 'var(--ios-glass-border)' }}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#ff9500] text-white ios-squircle flex items-center justify-center shadow-lg shadow-[#ff9500]/20 border border-white/10">
                                    <Target size={22} strokeWidth={3} />
                                </div>
                                <div>
                                    <h3 className="font-black text-[var(--ios-text)] text-xl tracking-tight leading-none mb-1">
                                        {editingId ? 'Editar Meta' : 'Nova Meta'}
                                    </h3>
                                    <p className="text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest leading-none opacity-60">Qual é o seu próximo sonho?</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { hapticFeedback(5); setIsModalOpen(false); }}
                                className="w-10 h-10 flex items-center justify-center bg-black/5 text-[var(--ios-text-secondary)] hover:text-[#ff3b30] ios-squircle transition-all text-2xl leading-none shadow-inner"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 space-y-8">
                            <div className="space-y-4">
                                <div className="grid grid-cols-[80px_1fr] gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Ícone</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-4 py-5 text-2xl text-center outline-none focus:ring-4 focus:ring-[#ff9500]/10 transition-all shadow-inner"
                                            value={formData.icon}
                                            onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                            placeholder="🎯"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Nome da Meta</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-6 py-5 text-lg font-black text-[var(--ios-text)] placeholder:text-[var(--ios-text-secondary)]/30 outline-none focus:ring-4 focus:ring-[#ff9500]/10 transition-all shadow-inner uppercase"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Ex: Viagem, Carro, Reserva..."
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Valor Alvo</label>
                                        <div className="relative">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--ios-text-secondary)]">R$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm pl-12 pr-6 py-5 text-xl font-black text-[var(--ios-text)] outline-none focus:ring-4 focus:ring-[#ff9500]/10 transition-all shadow-inner"
                                                value={formData.target_amount || ''}
                                                onChange={e => setFormData({ ...formData, target_amount: Number(e.target.value) })}
                                                placeholder="0,00"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Já poupado</label>
                                        <div className="relative">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--ios-text-secondary)]">R$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm pl-12 pr-6 py-5 text-xl font-black text-[#34c759] outline-none focus:ring-4 focus:ring-[#34c759]/10 transition-all shadow-inner"
                                                value={formData.current_amount || ''}
                                                onChange={e => setFormData({ ...formData, current_amount: Number(e.target.value) })}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-[var(--ios-text-secondary)] uppercase tracking-widest pl-1">Prazo Estimado</label>
                                    <input
                                        type="date"
                                        className="w-full bg-black/5 border border-[var(--ios-glass-border)] ios-squircle-sm px-6 py-5 text-sm font-black text-[var(--ios-text)] [color-scheme:dark] outline-none focus:ring-4 focus:ring-[#ff9500]/10 transition-all shadow-inner"
                                        value={formData.deadline}
                                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { hapticFeedback(5); setIsModalOpen(false); }}
                                    className="flex-1 py-5 ios-squircle font-black text-[10px] uppercase tracking-widest text-[var(--ios-text-secondary)] hover:bg-black/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] py-5 bg-[#ff9500] hover:bg-[#ff9500]/90 text-white ios-squircle font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[#ff9500]/30 active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/10"
                                >
                                    Confirmar Meta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
