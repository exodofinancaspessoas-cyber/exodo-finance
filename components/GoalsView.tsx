
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
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Target className="text-indigo-600" /> Metas Financeiras
                    </h2>
                    <p className="text-slate-500">Defina objetivos e acompanhe seu progresso.</p>
                </div>
                <button
                    onClick={() => { setEditingId(null); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-colors"
                >
                    <Plus size={20} className="mr-2" />
                    Nova Meta
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {goals.map(goal => {
                    const progress = calculateProgress(goal.current_amount, goal.target_amount);
                    const isCompleted = goal.status === 'COMPLETED';

                    return (
                        <div key={goal.id} className={`bg-white rounded-xl shadow-sm border p-6 relative group overflow-hidden ${isCompleted ? 'border-green-200 bg-green-50' : 'border-slate-100'}`}>
                            {isCompleted && <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">CONCLUÍDA</div>}

                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-2xl shadow-sm">
                                    {goal.icon}
                                </div>
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(goal)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(goal.id)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <h3 className="font-bold text-lg text-slate-800 mb-1">{goal.name}</h3>
                            <p className="text-xs text-slate-500 mb-4">Prazo: {goal.deadline ? new Date(goal.deadline).toLocaleDateString('pt-BR') : 'Sem prazo'}</p>

                            <div className="mb-2 flex justify-between items-end">
                                <span className="text-2xl font-bold text-indigo-900">{formatCurrency(goal.current_amount)}</span>
                                <span className="text-xs text-slate-400 mb-1">de {formatCurrency(goal.target_amount)}</span>
                            </div>

                            <div className="w-full bg-slate-100 rounded-full h-3 mb-4 overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-green-500' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }}></div>
                            </div>

                            <button
                                onClick={() => handleAddValue(goal)}
                                className="w-full py-2 border border-dashed border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={16} /> Adicionar Valor
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
                                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.target_amount} onChange={e => setFormData({ ...formData, target_amount: Number(e.target.value) })} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Já tenho guardado</label>
                                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.current_amount} onChange={e => setFormData({ ...formData, current_amount: Number(e.target.value) })} />
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
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancelar</button>
                                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-lg shadow-indigo-600/20">{editingId ? 'Salvar' : 'Criar Meta'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
