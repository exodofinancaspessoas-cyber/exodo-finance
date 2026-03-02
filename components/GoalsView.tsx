
import React, { useState, useEffect } from 'react';
import { Target, Plus, Edit2, Trash2, CheckCircle, TrendingUp, AlertCircle, DollarSign } from 'lucide-react';
import { Goal } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';

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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Target className="text-[#ff9500]" /> Metas Financeiras
                    </h2>
                    <p className="text-slate-500">Defina objetivos e acompanhe seu progresso.</p>
                </div>
                <button
                    onClick={() => { setEditingId(null); setIsModalOpen(true); }}
                    className="bg-[#ff9500] hover:bg-[#ff9500]/90 text-white px-5 py-3 ios-squircle flex items-center shadow-lg shadow-[#ff9500]/20 transition-all active:scale-95 text-xs font-black uppercase tracking-widest"
                >
                    <Plus size={20} className="mr-2" strokeWidth={3} />
                    Nova Meta
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {goals.map(goal => {
                    const progress = calculateProgress(goal.current_amount, goal.target_amount);
                    const isCompleted = goal.status === 'COMPLETED';

                    return (
                        <div key={goal.id} className={`bg-white/80 backdrop-blur-xl ios-squircle shadow-sm border p-7 relative group overflow-hidden transition-all hover:shadow-xl hover:translate-y-[-4px] ${isCompleted ? 'border-[#34c759]/20 bg-[#34c759]/5' : 'border-slate-100'}`}>
                            {isCompleted && <div className="absolute top-0 right-0 bg-[#34c759] text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest">Concluída</div>}

                            <div className="flex justify-between items-start mb-4">
                                <div className="w-14 h-14 ios-squircle bg-slate-50 flex items-center justify-center text-3xl shadow-inner border border-white">
                                    {goal.icon}
                                </div>
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(goal)} className="w-9 h-9 bg-slate-100 ios-squircle flex items-center justify-center text-slate-400 hover:text-[#ff9500] transition-all"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(goal.id)} className="w-9 h-9 bg-red-50 ios-squircle flex items-center justify-center text-red-400 hover:text-[#ff3b30] transition-all"><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <h3 className="font-black text-xl text-slate-900 tracking-tight mb-1">{goal.name}</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Prazo: {goal.deadline ? new Date(goal.deadline).toLocaleDateString('pt-BR') : 'Sem prazo'}</p>

                            <div className="mb-2 flex justify-between items-end">
                                <span className="text-3xl font-black text-[#007aff] tracking-tighter">{formatCurrency(goal.current_amount)}</span>
                                <span className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">de {formatCurrency(goal.target_amount)}</span>
                            </div>

                            <div className="w-full bg-slate-100 ios-squircle h-2.5 mb-6 overflow-hidden shadow-inner">
                                <div className={`h-full ios-squircle transition-all duration-1000 ${isCompleted ? 'bg-[#34c759]' : 'bg-[#ff9500]'}`} style={{ width: `${progress}%` }}></div>
                            </div>

                            <button
                                onClick={() => handleAddValue(goal)}
                                className="w-full py-4 border border-dashed border-[#ff9500]/30 text-[#ff9500] ios-squircle hover:bg-[#ff9500]/5 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={16} strokeWidth={3} /> Adicionar Valor
                            </button>
                        </div>
                    );
                })}

                {goals.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <Target size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Nenhuma meta criada. Comece a planejar seus sonhos!</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                        <h3 className="font-bold text-xl text-slate-800 mb-6 border-b pb-4">{editingId ? 'Editar Meta' : 'Nova Meta'}</h3>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nome do Objetivo</label>
                                <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Viagem Europa, Carro Novo..." required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Valor Alvo</label>
                                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.target_amount || ''} onChange={e => setFormData({ ...formData, target_amount: Number(e.target.value) })} onFocus={e => e.target.select()} placeholder="0,00" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Já tenho guardado</label>
                                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.current_amount || ''} onChange={e => setFormData({ ...formData, current_amount: Number(e.target.value) })} onFocus={e => e.target.select()} placeholder="0,00" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Prazo (Opcional)</label>
                                    <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Ícone</label>
                                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none" value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })}>
                                        <option value="🎯">🎯 Padrão</option>
                                        <option value="🏠">🏠 Casa</option>
                                        <option value="🚗">🚗 Carro</option>
                                        <option value="✈️">✈️ Viagem</option>
                                        <option value="🎓">🎓 Estudos</option>
                                        <option value="💰">💰 Investimento</option>
                                        <option value="💍">💍 Casamento</option>
                                        <option value="👶">👶 Filhos</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-3 text-slate-500 hover:bg-slate-50 ios-squircle font-black text-xs uppercase tracking-widest transition-all">Cancelar</button>
                                <button type="submit" className="px-8 py-3 bg-[#ff9500] hover:bg-[#ff9500]/90 text-white ios-squircle font-black text-xs uppercase tracking-widest shadow-lg shadow-[#ff9500]/20 active:scale-95 transition-all">{editingId ? 'Salvar' : 'Criar Meta'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
