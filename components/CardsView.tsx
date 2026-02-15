
import React, { useState, useEffect } from 'react';
import { CreditCard, PlusCircle, Edit, Trash2, FileText, Check, AlertCircle } from 'lucide-react';
import { Card, Category, Transaction } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';

export default function CardsView() {
    const [cards, setCards] = useState<Card[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<Card | null>(null);

    // Invoice Setup Modal
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [selectedCardForInvoice, setSelectedCardForInvoice] = useState<Card | null>(null);
    const [invoiceSetupData, setInvoiceSetupData] = useState<{ month: string, year: number, monthIndex: number, amount: string }[]>([]);
    const [invoiceCategory, setInvoiceCategory] = useState<string>('');
    const [isSavingInvoices, setIsSavingInvoices] = useState(false);

    // Form
    const [formData, setFormData] = useState({
        name: '',
        limit: 0,
        closing_day: 1,
        due_day: 10,
        bank: '',
        brand: 'VISA'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [crds, cats] = await Promise.all([
            StorageService.getCards(),
            StorageService.getCategories()
        ]);
        setCards(crds);
        setCategories(cats);
    };

    const handleOpenModal = (card?: Card) => {
        if (card) {
            setEditingCard(card);
            setFormData({
                name: card.name,
                limit: card.limit,
                closing_day: card.closing_day,
                due_day: card.due_day,
                bank: card.bank || '',
                brand: card.brand || 'VISA'
            });
        } else {
            setEditingCard(null);
            setFormData({
                name: '',
                limit: 0,
                closing_day: 1,
                due_day: 10,
                bank: '',
                brand: 'VISA'
            });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este cartão?')) {
            await StorageService.deleteCard(id);
            loadData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newCard: Card = {
            id: editingCard ? editingCard.id : StorageService.generateId(),
            name: formData.name,
            limit: Number(formData.limit),
            limit_used: editingCard ? editingCard.limit_used : 0, // Recalc by service
            closing_day: Number(formData.closing_day),
            due_day: Number(formData.due_day),
            bank: formData.bank,
            brand: formData.brand as any,
        };
        await StorageService.saveCard(newCard);
        setIsModalOpen(false);
        loadData();
    };

    // --- Invoice Setup Logic ---
    const handleOpenInvoiceSetup = (card: Card) => {
        setSelectedCardForInvoice(card);

        // Prioritize "Fatura de Cartão" or "Outros"
        const expenseCats = categories.filter(c => c.type === 'DESPESA');
        const defaultCat = expenseCats.find(c => c.name === 'Fatura de Cartão') ||
            expenseCats.find(c => c.name === 'Outros') ||
            expenseCats[0];
        if (defaultCat) setInvoiceCategory(defaultCat.id);

        // Generate next 12 months slots
        // Start from NEXT month if current day > closing day? 
        // User wants to input "Future Invoices".
        // Let's just list Current Month + 11.
        const today = new Date();
        const slots = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const monthName = d.toLocaleDateString('pt-BR', { month: 'long' });
            // Capitalize
            const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            slots.push({
                month: monthLabel,
                year: d.getFullYear(),
                monthIndex: d.getMonth(), // 0-11
                amount: ''
            });
        }
        setInvoiceSetupData(slots);
        setIsInvoiceModalOpen(true);
    };

    const handleSaveInvoices = async () => {
        if (!selectedCardForInvoice || isSavingInvoices) return;

        let importCount = 0;
        const newTransactions: Transaction[] = [];

        invoiceSetupData.forEach(slot => {
            const amountVal = Number(slot.amount);
            if (amountVal > 0) {
                const dueDate = new Date(slot.year, slot.monthIndex, selectedCardForInvoice.due_day);

                const newTrx: Transaction = {
                    id: StorageService.generateId(),
                    description: `Fatura de Cartão de Crédito - ${slot.month}/${slot.year}`,
                    amount: amountVal,
                    type: 'DESPESA',
                    category_id: invoiceCategory,
                    date: dueDate.toISOString().split('T')[0],
                    status: 'PREVISTA',
                    payment_method: 'CREDITO',
                    card_id: selectedCardForInvoice.id,
                    created_at: new Date().toISOString(),
                    observation: 'Importado via Configuração Inicial de Cartão'
                };

                newTransactions.push(newTrx);
                importCount++;
            }
        });

        if (importCount > 0) {
            setIsSavingInvoices(true);
            try {
                // Batch save is MUCH faster and prevents duplicates by disabling the button
                await StorageService.saveTransactions(newTransactions);

                alert(`${importCount} faturas importadas com sucesso!`);
                setIsInvoiceModalOpen(false);
                await loadData(); // Update limits used
            } catch (error) {
                console.error('Erro ao importar faturas:', error);
                alert('Ocorreu um erro ao salvar as faturas. Tente novamente.');
            } finally {
                setIsSavingInvoices(false);
            }
        } else {
            alert('Nenhum valor preenchido para importar.');
        }
    };

    const handleSlotChange = (index: number, val: string) => {
        const newData = [...invoiceSetupData];
        newData[index].amount = val;
        setInvoiceSetupData(newData);
    };

    return (
        <div className="animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Meus Cartões</h2>
                    <p className="text-slate-500">Gerencie seus limites e faturas.</p>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl flex items-center shadow-lg hover:shadow-xl transition-all font-bold">
                    <PlusCircle size={20} className="mr-2" />
                    Novo Cartão
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cards.map(card => {
                    const available = card.limit - card.limit_used;
                    const percentUsed = (card.limit_used / card.limit) * 100;

                    return (
                        <div key={card.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group">
                            <div className="flex justify-between items-start mb-6">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${card.brand === 'MASTERCARD' ? 'bg-orange-500' :
                                    card.brand === 'VISA' ? 'bg-blue-600' :
                                        card.brand === 'ELO' ? 'bg-red-500' :
                                            card.brand === 'AMEX' ? 'bg-slate-500' : 'bg-slate-800'
                                    }`}>
                                    <CreditCard size={24} />
                                </div>
                                <div className="flex space-x-1">
                                    <button
                                        onClick={() => handleOpenInvoiceSetup(card)}
                                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                                        title="Importar Faturas/Saldos Anteriores"
                                    >
                                        <FileText size={18} />
                                    </button>
                                    <button onClick={() => handleOpenModal(card)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(card.id)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="font-bold text-lg text-slate-800 mb-1">{card.name}</h4>
                                <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">{card.bank} • {card.brand}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-2 font-medium">
                                        <span className="text-slate-500">Limite Utilizado</span>
                                        <span className="text-slate-800">{Math.round(percentUsed)}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${percentUsed > 90 ? 'bg-red-500' : percentUsed > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Fatura Atual</p>
                                        <p className="font-bold text-slate-800">{formatCurrency(card.limit_used)}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-right">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Disponível</p>
                                        <p className="font-bold text-green-600">{formatCurrency(available)}</p>
                                    </div>
                                </div>

                                <div className="flex justify-between text-xs pt-4 border-t border-slate-50 text-slate-500 font-medium">
                                    <p>Fecha dia {card.closing_day}</p>
                                    <p>Vence dia {card.due_day}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {cards.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center">
                        <CreditCard size={48} className="mb-4 opacity-50" />
                        <p className="text-xl font-bold text-slate-600">Nenhum cartão cadastrado</p>
                        <p className="max-w-md mx-auto mt-2">Adicione seus cartões de crédito para controlar limites, vencimentos e faturas num só lugar.</p>
                        <button onClick={() => handleOpenModal()} className="mt-6 text-orange-600 font-bold hover:underline">
                            Cadastrar primeiro cartão
                        </button>
                    </div>
                )}
            </div>

            {/* EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">{editingCard ? 'Editar Cartão' : 'Novo Cartão'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Cartão (Apelido)</label>
                                <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 font-medium" placeholder="Ex: Nubank Principal" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Limite Total</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3.5 text-slate-400 font-medium">R$</span>
                                    <input type="number" step="0.01" className="w-full pl-10 border border-slate-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 font-mono text-lg font-bold text-slate-800" value={formData.limit} onChange={e => setFormData({ ...formData, limit: Number(e.target.value) })} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dia Fechamento</label>
                                    <input type="number" min="1" max="31" className="w-full border border-slate-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 text-center font-bold text-slate-700" value={formData.closing_day} onChange={e => setFormData({ ...formData, closing_day: Number(e.target.value) })} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dia Vencimento</label>
                                    <input type="number" min="1" max="31" className="w-full border border-slate-200 rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-orange-500/20 text-center font-bold text-slate-700" value={formData.due_day} onChange={e => setFormData({ ...formData, due_day: Number(e.target.value) })} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bandeira</label>
                                    <select className="w-full border border-slate-200 rounded-lg px-3 py-3 outline-none bg-white text-sm font-medium text-slate-700" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })}>
                                        <option value="VISA">Visa</option>
                                        <option value="MASTERCARD">Mastercard</option>
                                        <option value="ELO">Elo</option>
                                        <option value="AMEX">Amex</option>
                                        <option value="HIPERCARD">Hipercard</option>
                                        <option value="OUTRO">Outro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Banco Emissor</label>
                                    <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-3 outline-none text-sm font-medium text-slate-700" placeholder="Ex: Itaú" value={formData.bank} onChange={e => setFormData({ ...formData, bank: e.target.value })} />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancelar</button>
                                <button type="submit" className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium shadow-lg shadow-slate-900/10">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* INVOICE SETUP MODAL */}
            {isInvoiceModalOpen && selectedCardForInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 bg-slate-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                                        <FileText className="text-blue-600" /> Configuração Inicial de Fatura
                                    </h3>
                                    <p className="text-slate-500 text-sm mt-1">
                                        Cartão: <strong className="text-slate-700">{selectedCardForInvoice.name}</strong>
                                    </p>
                                </div>
                                <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">&times;</button>
                            </div>

                            <div className="mt-4 bg-blue-50 text-blue-800 text-sm p-3 rounded-lg flex gap-3 border border-blue-100">
                                <AlertCircle size={20} className="shrink-0" />
                                <p>
                                    Use esta tela para lançar <span className="font-bold">valores totais que você já deve</span> para os próximos meses (ex: compras parceladas antigas).
                                    Isso garantirá que seu orçamento futuro considere essas dívidas pré-existentes.
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria para estes lançamentos</label>
                                        <select
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                            value={invoiceCategory}
                                            onChange={e => setInvoiceCategory(e.target.value)}
                                        >
                                            {categories.filter(c => c.type === 'DESPESA').map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Total a Importar</span>
                                            <p className="text-2xl font-bold text-slate-800">
                                                {formatCurrency(invoiceSetupData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0))}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                                            <tr>
                                                <th className="px-4 py-3">Mês de Referência</th>
                                                <th className="px-4 py-3">Vencimento Estimado</th>
                                                <th className="px-4 py-3 w-1/3">Valor da Fatura (R$)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {invoiceSetupData.map((slot, index) => {
                                                const dueDate = new Date(slot.year, slot.monthIndex, selectedCardForInvoice.due_day);
                                                return (
                                                    <tr key={`${slot.year}-${slot.monthIndex}`} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-slate-700">
                                                            {slot.month} de {slot.year}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 text-sm">
                                                            {dueDate.toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                placeholder="0,00"
                                                                className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none font-bold transition-all ${Number(slot.amount) > 0 ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}
                                                                value={slot.amount}
                                                                onChange={e => handleSlotChange(index, e.target.value)}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsInvoiceModalOpen(false)}
                                className="px-5 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                                disabled={isSavingInvoices}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveInvoices}
                                disabled={isSavingInvoices}
                                className={`px-6 py-3 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all ${isSavingInvoices ? 'bg-slate-400 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 active:scale-95'}`}
                            >
                                {isSavingInvoices ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Check size={20} /> Confirmar Importação
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
