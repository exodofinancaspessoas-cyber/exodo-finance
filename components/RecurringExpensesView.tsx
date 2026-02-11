
import React, { useState, useEffect } from 'react';
import {
    Repeat, Plus, Edit2, Trash2, CheckCircle, AlertCircle,
    Calendar, RotateCw, DollarSign
} from 'lucide-react';
import { RecurringExpense, Category, Account } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';

export default function RecurringExpensesView() {
    const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<RecurringExpense>>({
        description: '',
        amount: 0,
        category_id: '',
        type: 'FIXO',
        frequency: 'MENSAL', // Default
        day_of_month: 1,
        active: true,
        auto_create: true,
        account_id: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setExpenses(StorageService.getRecurringExpenses());
        setCategories(StorageService.getCategories());
        setAccounts(StorageService.getAccounts());
    };

    const handleEdit = (expense: RecurringExpense) => {
        setEditingId(expense.id);
        setFormData(expense);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta recorrência?')) {
            StorageService.deleteRecurringExpense(id);
            loadData();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.description || !formData.amount || !formData.category_id || !formData.day_of_month) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        const newExpense: RecurringExpense = {
            id: editingId || StorageService.generateId(),
            description: formData.description,
            amount: Number(formData.amount),
            category_id: formData.category_id,
            type: formData.type || 'FIXO',
            frequency: 'MENSAL',
            day_of_month: Number(formData.day_of_month),
            active: formData.active !== undefined ? formData.active : true,
            auto_create: formData.auto_create !== undefined ? formData.auto_create : true,
            account_id: formData.account_id,
            // Preserve existing fields if editing
            last_generated: editingId ? expenses.find(e => e.id === editingId)?.last_generated : undefined
        };

        StorageService.saveRecurringExpense(newExpense);
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ description: '', amount: 0, category_id: '', type: 'FIXO', frequency: 'MENSAL', day_of_month: 1, active: true, auto_create: true, account_id: '' });
        loadData();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Repeat className="text-orange-600" /> Despesas Recorrentes
                    </h2>
                    <p className="text-slate-500">Gerencie seus gastos mensais fixos e variáveis</p>
                </div>
                <button
                    onClick={() => { setEditingId(null); setIsModalOpen(true); }}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-colors"
                >
                    <Plus size={20} className="mr-2" />
                    Nova Recorrência
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {expenses.map(exp => {
                    const cat = categories.find(c => c.id === exp.category_id);
                    return (
                        <div key={exp.id} className={`bg-white rounded-xl shadow-sm border ${exp.active ? 'border-slate-100' : 'border-slate-200 bg-slate-50 opacity-75'} p-5 relative group`}>
                            <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(exp)} className="p-1 text-slate-400 hover:text-blue-500"><Edit2 size={16} /></button>
                                <button onClick={() => handleDelete(exp.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>

                            <div className="flex items-center space-x-3 mb-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${exp.active ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400'}`}>
                                    <RotateCw size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{exp.description}</h3>
                                    <span className="text-xs text-slate-500 uppercase font-medium tracking-wide">{cat?.name}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm border-b border-slate-50 pb-2">
                                    <span className="text-slate-500">Valor Estimado</span>
                                    <span className="font-bold text-slate-800">{formatCurrency(exp.amount)}</span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-slate-50 pb-2">
                                    <span className="text-slate-500">Vencimento</span>
                                    <span className="text-slate-800">Dia {exp.day_of_month}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className={`text-xs px-2 py-1 rounded-full ${exp.auto_create ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {exp.auto_create ? 'Automático' : 'Lembrete'}
                                    </span>
                                    <span className={`text-xs font-medium ${exp.type === 'FIXO' ? 'text-blue-600' : 'text-purple-600'}`}>
                                        {exp.type}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {expenses.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <Repeat size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Nenhuma despesa recorrente cadastrada.</p>
                        <button onClick={() => setIsModalOpen(true)} className="text-orange-600 font-medium mt-2 hover:underline">Criar a primeira</button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-xl text-slate-800 mb-6 border-b pb-4">
                            {editingId ? 'Editar Recorrência' : 'Nova Despesa Recorrente'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Type Selection */}
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'FIXO' })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'FIXO' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                                >
                                    Valor Fixo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'VARIAVEL' })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'VARIAVEL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                                >
                                    Valor Variável
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500/20"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ex: Aluguel, Netflix, Luz..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor {formData.type === 'VARIAVEL' ? '(Estimado)' : ''}</label>
                                    <div className="relative">
                                        <DollarSign size={16} className="absolute left-3 top-3 text-slate-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-orange-500/20"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none"
                                        value={formData.category_id}
                                        onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {categories.filter(c => c.type === 'DESPESA').map(c => (
                                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dia do Vencimento</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none"
                                        value={formData.day_of_month}
                                        onChange={e => setFormData({ ...formData, day_of_month: Number(e.target.value) })}
                                        required
                                    >
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                            <option key={d} value={d}>Dia {d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Conta para Debitar</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none"
                                        value={formData.account_id}
                                        onChange={e => setFormData({ ...formData, account_id: e.target.value })}
                                    >
                                        <option value="">Decidir na hora</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 space-y-3">
                                <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.auto_create}
                                        onChange={e => setFormData({ ...formData, auto_create: e.target.checked })}
                                        className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                                    />
                                    <div>
                                        <span className="block font-medium text-slate-800">Criar Automaticamente</span>
                                        <span className="block text-xs text-slate-500">O sistema cria a despesa no dia 1º de cada mês</span>
                                    </div>
                                </label>

                                <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.active}
                                        onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                        className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                                    />
                                    <div>
                                        <span className="block font-medium text-slate-800">Recorrência Ativa</span>
                                        <span className="block text-xs text-slate-500">Desative para pausar temporariamente</span>
                                    </div>
                                </label>
                            </div>

                            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancelar</button>
                                <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-lg shadow-slate-900/10">
                                    {editingId ? 'Salvar Alterações' : 'Criar Recorrência'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
