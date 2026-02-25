
import React, { useState, useEffect } from 'react';
import {
    Repeat, Plus, Edit2, Trash2, CheckCircle, AlertCircle,
    Calendar, RotateCw, DollarSign, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import { RecurringExpense, Category, Account, Card, RecurrenceFrequency, TransactionType } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';

export default function RecurringExpensesView() {
    const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [activeTab, setActiveTab] = useState<TransactionType>('DESPESA');
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

    const filteredExpenses = expenses.filter(exp => {
        const cat = categories.find(c => c.id === exp.category_id);
        return (cat?.type || 'DESPESA') === activeTab;
    });

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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Repeat className="text-indigo-600" /> Lançamentos Recorrentes
                    </h2>
                    <p className="text-slate-500">Gerencie suas receitas e despesas automáticas</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('DESPESA')}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'DESPESA' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            <ArrowDownCircle size={16} /> Despesas
                        </button>
                        <button
                            onClick={() => setActiveTab('RECEITA')}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'RECEITA' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            <ArrowUpCircle size={16} /> Receitas
                        </button>
                    </div>
                    <button
                        onClick={() => { setEditingId(null); setIsModalOpen(true); }}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-colors font-bold text-sm"
                    >
                        <Plus size={18} className="mr-2" />
                        Novo
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExpenses.map(exp => {
                    const cat = categories.find(c => c.id === exp.category_id);
                    return (
                        <div key={exp.id} className={`bg-white rounded-xl shadow-sm border ${exp.active ? 'border-slate-100' : 'border-slate-200 bg-slate-50 opacity-75'} p-5 relative group`}>
                            <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(exp)} className="p-1 text-slate-400 hover:text-blue-500"><Edit2 size={16} /></button>
                                <button onClick={() => handleDelete(exp.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>

                            <div className="flex items-center space-x-3 mb-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${exp.active ? (activeTab === 'RECEITA' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600') : 'bg-slate-200 text-slate-400'}`}>
                                    <RotateCw size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 truncate">{exp.description}</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color }}></span>
                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{cat?.name}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm border-b border-slate-50 pb-2">
                                    <span className="text-slate-500">Valor Estimado</span>
                                    <span className={`font-bold ${activeTab === 'RECEITA' ? 'text-green-600' : 'text-slate-800'}`}>
                                        {formatCurrency(exp.amount)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm border-b border-slate-50 pb-2">
                                    <span className="text-slate-500">Vencimento</span>
                                    <span className="text-slate-800 font-medium">Dia {exp.day_of_month}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${exp.auto_create ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {exp.auto_create ? 'Automático' : 'Lembrete'}
                                    </span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${exp.type === 'FIXO' ? 'text-blue-600' : 'text-purple-600'}`}>
                                        {exp.type}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredExpenses.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Repeat size={48} className="mx-auto mb-4 opacity-10" />
                        <p className="font-bold text-slate-500">Nenhuma {activeTab.toLowerCase()} recorrente cadastrada.</p>
                        <p className="text-xs mt-1">Clique em "Novo" para programar um lançamento.</p>
                        <button onClick={() => setIsModalOpen(true)} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mt-4 hover:underline">Criar a primeira</button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto transform animate-scale-up border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">
                                {editingId ? 'Editar Lançamento' : `Novo Lançamento ${activeTab === 'RECEITA' ? 'de Receita' : 'de Despesa'}`}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Type Selection */}
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'FIXO' })}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${formData.type === 'FIXO' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
                                >
                                    Valor Fixo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'VARIAVEL' })}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${formData.type === 'VARIAVEL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
                                >
                                    Valor Variável
                                </button>
                            </div>

                            <div className="text-[10px] uppercase tracking-wider leading-relaxed text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                {formData.type === 'FIXO' ? (
                                    <p><span className="font-black text-slate-700">Valor Fixo:</span> Ideal para aluguel, assinaturas (Netflix) ou mensalidades. A despesa será criada já como <span className="text-green-600 font-black">confirmada</span>.</p>
                                ) : (
                                    <p><span className="font-black text-slate-700">Valor Variável:</span> Ideal para água, luz ou cartão. O sistema criará a despesa como <span className="text-blue-600 font-black">prevista</span> para você confirmar o valor exato depois.</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Descrição</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all font-medium text-slate-800"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ex: Aluguel, Netflix, Luz..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Valor {formData.type === 'VARIAVEL' ? '(Estimado)' : ''}</label>
                                    <div className="relative">
                                        <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all font-bold text-slate-800"
                                            value={formData.amount || ''}
                                            onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                                            onFocus={e => e.target.select()}
                                            placeholder="0,00"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Categoria</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all font-medium text-slate-700"
                                        value={formData.category_id}
                                        onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {categories.filter(c => c.type === activeTab).map(c => (
                                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Frequência</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-white font-medium text-slate-700"
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
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Dia Venc/Receb</label>
                                        <select
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-white font-medium text-slate-700"
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
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Total de Ocorrências</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="120"
                                        placeholder="Ex: 12"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-white font-medium text-slate-700"
                                        value={formData.duration_count || ''}
                                        onChange={e => setFormData({ ...formData, duration_count: e.target.value ? Number(e.target.value) : undefined })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                        {activeTab === 'RECEITA' ? 'Conta para Recebimento' : 'Conta para Débito'}
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none mb-4 bg-white font-medium text-slate-700"
                                        value={formData.account_id}
                                        onChange={e => setFormData({ ...formData, account_id: e.target.value, card_id: '' })}
                                    >
                                        <option value="">Decidir na hora (ou via cartão)</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>

                                    {activeTab === 'DESPESA' && (
                                        <>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ou no Cartão de Crédito</label>
                                            <select
                                                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-white font-medium text-slate-700"
                                                value={formData.card_id}
                                                onChange={e => setFormData({ ...formData, card_id: e.target.value, account_id: '' })}
                                            >
                                                <option value="">Não usar cartão</option>
                                                {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 space-y-3">
                                <label className="flex items-center space-x-4 p-4 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all group">
                                    <input
                                        type="checkbox"
                                        checked={formData.auto_create}
                                        onChange={e => setFormData({ ...formData, auto_create: e.target.checked })}
                                        className="w-5 h-5 text-indigo-600 rounded-lg focus:ring-indigo-500 border-slate-300 transition-all group-hover:scale-110"
                                    />
                                    <div>
                                        <span className="block font-bold text-slate-800 text-sm">Criar Automaticamente</span>
                                        <span className="block text-[10px] uppercase font-black tracking-widest text-slate-400">Geração automática no dia programado</span>
                                    </div>
                                </label>

                                <label className="flex items-center space-x-4 p-4 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all group">
                                    <input
                                        type="checkbox"
                                        checked={formData.active}
                                        onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                        className="w-5 h-5 text-indigo-600 rounded-lg focus:ring-indigo-500 border-slate-300 transition-all group-hover:scale-110"
                                    />
                                    <div>
                                        <span className="block font-bold text-slate-800 text-sm">Recorrência Ativa</span>
                                        <span className="block text-[10px] uppercase font-black tracking-widest text-slate-400">Pause para interromper lançamentos</span>
                                    </div>
                                </label>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold text-sm bg-slate-50 hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-[2] py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xl shadow-slate-900/20 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Processando...
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
