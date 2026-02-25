
import React, { useState, useEffect } from 'react';
import {
    Repeat, Plus, Edit2, Trash2, CheckCircle, AlertCircle,
    Calendar, RotateCw, DollarSign, ArrowUpCircle, ArrowDownCircle,
    Power, Pause, Play, TrendingUp, Clock
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
        duration_count: undefined,
        programmed_amount: undefined
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

    const toggleActive = async (expense: RecurringExpense) => {
        setIsSaving(true);
        try {
            await StorageService.saveRecurringExpense({
                ...expense,
                active: !expense.active
            });
            await loadData();
        } catch (error) {
            console.error("Erro ao alternar status:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta recorrência? Todas as projeções futuras serão removidas.')) {
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
                programmed_amount: formData.programmed_amount,
                // Preserve existing fields if editing
                last_generated: editingId ? expenses.find(e => e.id === editingId)?.last_generated : undefined,
                start_date: editingId ? expenses.find(e => e.id === editingId)?.start_date : new Date().toISOString().split('T')[0]
            };

            await StorageService.saveRecurringExpense(newExpense);
            setIsModalOpen(false);
            setEditingId(null);
            setFormData({ description: '', amount: 0, category_id: '', type: 'FIXO', frequency: 'MENSAL', day_of_month: 1, active: true, auto_create: true, account_id: '', duration_count: undefined, programmed_amount: undefined });
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
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'DESPESA' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
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
                    const isIncome = (cat?.type || activeTab) === 'RECEITA';

                    return (
                        <div key={exp.id} className={`bg-white rounded-[2rem] shadow-xl transition-all duration-300 border-2 overflow-hidden flex flex-col ${exp.active ? 'border-indigo-50 shadow-slate-200/50' : 'border-slate-100 opacity-60 grayscale-[0.5]'}`}>
                            {/* Card Header with Category and Actions */}
                            <div className={`p-5 flex justify-between items-start ${exp.active ? (isIncome ? 'bg-emerald-50/30' : 'bg-rose-50/30') : 'bg-slate-50/50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${exp.active
                                        ? (isIncome ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-rose-600 text-white shadow-rose-200')
                                        : 'bg-slate-200 text-slate-400 shadow-none'}`}>
                                        <RotateCw size={22} className={exp.active ? 'animate-spin-slow' : ''} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 text-lg leading-tight truncate max-w-[150px]">{exp.description}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color }}></span>
                                            <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none">{cat?.name}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    <button onClick={() => toggleActive(exp)} className={`p-2 rounded-xl transition-all ${exp.active ? 'bg-white text-rose-500 hover:bg-rose-50 shadow-sm' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'}`}>
                                        {exp.active ? <Pause size={16} /> : <Play size={16} />}
                                    </button>
                                    <button onClick={() => handleEdit(exp)} className="p-2 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm hover:shadow transition-all"><Edit2 size={16} /></button>
                                </div>
                            </div>

                            {/* Card Body with Financial Info */}
                            <div className="p-6 space-y-4 flex-1">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                                            <DollarSign size={10} /> Valor Atual
                                        </p>
                                        <p className="text-xl font-black text-slate-800">{formatCurrency(exp.amount)}</p>
                                    </div>
                                    {exp.programmed_amount && exp.programmed_amount !== exp.amount && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest flex items-center gap-1">
                                                <TrendingUp size={10} /> Programado
                                            </p>
                                            <p className="text-xl font-black text-indigo-600">{formatCurrency(exp.programmed_amount)}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter flex items-center gap-1"><Calendar size={10} /> Frequência</span>
                                        <span className="text-xs font-bold text-slate-700">{exp.frequency}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter flex items-center gap-1"><Clock size={10} /> Próximo</span>
                                        <span className="text-xs font-bold text-slate-700">Dia {exp.day_of_month}</span>
                                    </div>
                                </div>

                                <div className="pt-2 flex flex-wrap gap-2">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${exp.auto_create ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                        {exp.auto_create ? 'Auto-Lançamento' : 'Manual'}
                                    </span>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${exp.type === 'FIXO' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-purple-50 border-purple-100 text-purple-600'}`}>
                                        {exp.type}
                                    </span>
                                    {!exp.active && (
                                        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-slate-100 border-slate-200 text-slate-500 flex items-center gap-1">
                                            <Pause size={8} /> Pausado
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center group-hover:bg-slate-50 transition-all">
                                <button onClick={() => handleDelete(exp.id)} className="text-[10px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest transition-colors flex items-center gap-1">
                                    <Trash2 size={12} /> Excluir
                                </button>
                                <div className={`w-2 h-2 rounded-full ${exp.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
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
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Valor {formData.type === 'VARIAVEL' ? '(Real)' : ''}</label>
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
                                    <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 ml-1 italic">Valor Programado/Estimado</label>
                                    <div className="relative">
                                        <TrendingUp size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 font-bold" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border border-indigo-100 bg-indigo-50/30 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all font-bold text-indigo-900"
                                            value={formData.programmed_amount || ''}
                                            onChange={e => setFormData({ ...formData, programmed_amount: e.target.value ? Number(e.target.value) : undefined })}
                                            onFocus={e => e.target.select()}
                                            placeholder="Para projeções..."
                                        />
                                    </div>
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
