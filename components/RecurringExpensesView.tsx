
import React, { useState, useEffect } from 'react';
import {
    Repeat, Plus, Edit2, Trash2, CheckCircle, AlertCircle,
    Calendar, RotateCw, DollarSign
} from 'lucide-react';
import { RecurringExpense, Category, Account, Card, RecurrenceFrequency } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';

export default function RecurringExpensesView() {
    const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<RecurringExpense>>({
        description: '',
        amount: 0,
        category_id: '',
        type: 'FIXO',
        frequency: 'MENSAL',
        day_of_month: 1,
        active: true,
        auto_create: true,
        account_id: '',
        card_id: '',
        duration_count: undefined
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [exps, cats, accs, crds] = await Promise.all([
                StorageService.getRecurringExpenses(),
                StorageService.getCategories(),
                StorageService.getAccounts(),
                StorageService.getCards()
            ]);
            setExpenses(exps);
            setCategories(cats);
            setAccounts(accs);
            setCards(crds || []);
        } catch (error) {
            console.error("Erro ao carregar recorrências:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (expense: RecurringExpense) => {
        setEditingId(expense.id);
        setFormData(expense);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta recorrência?')) {
            await StorageService.deleteRecurringExpense(id);
            await loadData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;

        if (!formData.description || !formData.amount || !formData.category_id || !formData.day_of_month) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        setIsSaving(true);
        try {
            const newExpense: RecurringExpense = {
                id: editingId || StorageService.generateId(),
                description: formData.description,
                amount: Number(formData.amount),
                category_id: formData.category_id,
                type: formData.type || 'FIXO',
                frequency: formData.frequency || 'MENSAL',
                day_of_month: Number(formData.day_of_month),
                active: formData.active !== undefined ? formData.active : true,
                auto_create: formData.auto_create !== undefined ? formData.auto_create : true,
                account_id: formData.account_id,
                card_id: formData.card_id,
                duration_count: formData.duration_count,
                // Preserve existing fields if editing
                last_generated: editingId ? expenses.find(e => e.id === editingId)?.last_generated : undefined,
                start_date: editingId ? expenses.find(e => e.id === editingId)?.start_date : new Date().toISOString().split('T')[0]
            };

            await StorageService.saveRecurringExpense(newExpense);
            setIsModalOpen(false);
            setEditingId(null);
            setFormData({ description: '', amount: 0, category_id: '', type: 'FIXO', frequency: 'MENSAL', day_of_month: 1, active: true, auto_create: true, account_id: '', duration_count: undefined });
            await loadData();
        } catch (error) {
            console.error("Erro ao salvar recorrência:", error);
            alert("Erro ao salvar. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
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

                            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {formData.type === 'FIXO' ? (
                                    <p><span className="font-bold text-slate-700">Valor Fixo:</span> Ideal para aluguel, assinaturas (Netflix) ou mensalidades. A despesa será criada já como <span className="text-green-600 font-bold">confirmada</span>.</p>
                                ) : (
                                    <p><span className="font-bold text-slate-700">Valor Variável:</span> Ideal para água, luz ou cartão. O sistema criará a despesa como <span className="text-blue-600 font-bold">prevista</span> para você confirmar o valor exato depois.</p>
                                )}
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
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Frequência</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none"
                                        value={formData.frequency}
                                        onChange={e => setFormData({ ...formData, frequency: e.target.value as RecurrenceFrequency })}
                                        required
                                    >
                                        <option value="DIARIO">Diário</option>
                                        <option value="SEMANAL">Semanal</option>
                                        <option value="MENSAL">Mensal</option>
                                        <option value="ANUAL">Anual</option>
                                    </select>
                                </div>
                                {formData.frequency === 'MENSAL' && (
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
                                )}
                                <div className={formData.frequency !== 'MENSAL' ? 'col-span-2' : ''}>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Duração (Repetições)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Infinito"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none"
                                        value={formData.duration_count || ''}
                                        onChange={e => setFormData({ ...formData, duration_count: e.target.value ? Number(e.target.value) : undefined })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Conta para Debitar</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none mb-3"
                                        value={formData.account_id}
                                        onChange={e => setFormData({ ...formData, account_id: e.target.value, card_id: '' })}
                                    >
                                        <option value="">Decidir na hora (ou via cartão)</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ou no Cartão de Crédito</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none"
                                        value={formData.card_id}
                                        onChange={e => setFormData({ ...formData, card_id: e.target.value, account_id: '' })}
                                    >
                                        <option value="">Não usar cartão</option>
                                        {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-lg shadow-slate-900/10 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        editingId ? 'Salvar Alterações' : 'Criar Recorrência'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
