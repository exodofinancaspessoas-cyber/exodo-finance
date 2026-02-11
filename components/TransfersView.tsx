
import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Plus } from 'lucide-react';
import { Transfer, Account } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../utils';

export default function TransfersView() {
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        from: '', to: '', amount: '', date: new Date().toISOString().split('T')[0], description: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setTransfers(StorageService.getTransfers());
        setAccounts(StorageService.getAccounts());
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.from === formData.to) {
            alert('Contas de origem e destino devem ser diferentes');
            return;
        }
        const newTransfer: Transfer = {
            id: StorageService.generateId(),
            from_account_id: formData.from,
            to_account_id: formData.to,
            amount: Number(formData.amount),
            date: formData.date,
            description: formData.description,
            created_at: new Date().toISOString()
        };
        StorageService.saveTransfer(newTransfer);
        setIsModalOpen(false);
        loadData();
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Transferências</h2>
                <button onClick={() => setIsModalOpen(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-colors">
                    <Plus size={20} className="mr-2" />
                    Nova Transferência
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Descrição</th>
                            <th className="px-6 py-4">Origem</th>
                            <th className="px-6 py-4">Destino</th>
                            <th className="px-6 py-4 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {transfers.map(t => {
                            const from = accounts.find(a => a.id === t.from_account_id);
                            const to = accounts.find(a => a.id === t.to_account_id);
                            return (
                                <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 text-slate-500">{formatDate(t.date)}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800">{t.description || 'Transferência'}</td>
                                    <td className="px-6 py-4 text-red-500">{from?.name}</td>
                                    <td className="px-6 py-4 text-green-500">{to?.name}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">{formatCurrency(t.amount)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {transfers.length === 0 && <div className="p-12 text-center text-slate-400">Nenhuma transferência registrada.</div>}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="font-bold text-lg text-slate-800 mb-4">Nova Transferência</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Origem</label>
                                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none" value={formData.from} onChange={e => setFormData({ ...formData, from: e.target.value })} required>
                                        <option value="">Selecione...</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Destino</label>
                                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none" value={formData.to} onChange={e => setFormData({ ...formData, to: e.target.value })} required>
                                        <option value="">Selecione...</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
                                <input type="number" step="0.01" className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Opcional)</label>
                                <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium">Transferir</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
