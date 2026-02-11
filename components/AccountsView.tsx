
import React, { useState, useEffect } from 'react';
import {
    Landmark, Wallet, Briefcase, PlusCircle, MoreHorizontal, Edit, Trash2, Loader2
} from 'lucide-react';
import { Landmark as BankIcon, Wallet as WalletIcon, Briefcase as BriefcaseIcon, PlusCircle as PlusIcon, Edit as EditIcon, Trash2 as TrashIcon } from 'lucide-react';
import { Account, AccountType } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency } from '../utils';

export default function AccountsView() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'CORRENTE' as AccountType,
        bank: '',
        initial_balance: 0,
        color: 'blue-500'
    });

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const accs = await StorageService.getAccounts();
            setAccounts(accs);
        } catch (error) {
            console.error("Erro ao carregar contas:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (acc?: Account) => {
        if (acc) {
            setEditingAccount(acc);
            setFormData({
                name: acc.name,
                type: acc.type,
                bank: acc.bank || '',
                initial_balance: acc.initial_balance,
                color: acc.color || 'blue-500'
            });
        } else {
            setEditingAccount(null);
            setFormData({
                name: '',
                type: 'CORRENTE',
                bank: '',
                initial_balance: 0,
                color: 'blue-500'
            });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta conta?')) {
            await StorageService.deleteAccount(id);
            await loadAccounts();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newAccount: Account = {
            id: editingAccount ? editingAccount.id : StorageService.generateId(),
            name: formData.name,
            type: formData.type,
            bank: formData.bank,
            initial_balance: Number(formData.initial_balance),
            current_balance: 0, // Recalculated by service
            color: formData.color
        };
        await StorageService.saveAccount(newAccount);
        setIsModalOpen(false);
        loadAccounts();
    };

    const getIcon = (type: AccountType) => {
        switch (type) {
            case 'POUPANCA': return <WalletIcon className="text-green-500" />;
            case 'SALARIO': return <BriefcaseIcon className="text-orange-500" />;
            default: return <BankIcon className="text-blue-500" />;
        }
    };

    if (loading && accounts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 size={40} className="animate-spin mb-4" />
                <p>Carregando contas...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6 text-white md:text-inherit">
                <h2 className="text-2xl font-bold text-slate-800">Contas Bancárias</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-colors"
                >
                    <PlusIcon size={20} className="mr-2" />
                    Nova Conta
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map(acc => (
                    <div key={acc.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                            <button onClick={() => handleOpenModal(acc)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><EditIcon size={16} /></button>
                            <button onClick={() => handleDelete(acc.id)} className="p-1 hover:bg-red-50 rounded text-red-500"><TrashIcon size={16} /></button>
                        </div>

                        <div className="flex items-center space-x-4 mb-4">
                            <div className={`p-3 rounded-xl bg-slate-50 border border-slate-100`}>
                                {getIcon(acc.type)}
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">{acc.name}</h3>
                                <p className="text-xs text-slate-500 uppercase">{acc.bank || acc.type}</p>
                            </div>
                        </div>

                        <div className="mt-4">
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Saldo Atual</p>
                            <h4 className={`text-2xl font-bold ${acc.current_balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                                {formatCurrency(acc.current_balance || 0)}
                            </h4>
                        </div>
                    </div>
                ))}

                {accounts.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <WalletIcon size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Nenhuma conta cadastrada</p>
                        <p className="text-sm">Clique em "Nova Conta" para começar</p>
                    </div>
                )}
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">{editingAccount ? 'Editar Conta' : 'Nova Conta'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Conta</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as AccountType })}
                                    >
                                        <option value="CORRENTE">Conta Corrente</option>
                                        <option value="POUPANCA">Poupança</option>
                                        <option value="SALARIO">Conta Salário</option>
                                        <option value="DINHEIRO">Dinheiro</option>
                                        <option value="OUTRO">Outro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Banco (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none"
                                        value={formData.bank}
                                        onChange={e => setFormData({ ...formData, bank: e.target.value })}
                                        placeholder="Ex: Nubank"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none font-mono"
                                    value={formData.initial_balance}
                                    onChange={e => setFormData({ ...formData, initial_balance: Number(e.target.value) })}
                                    disabled={!!editingAccount}
                                />
                                {editingAccount && <p className="text-xs text-slate-500 mt-1">Para ajustar o saldo atual, crie uma transação de ajuste.</p>}
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium shadow-sm transition-all"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
