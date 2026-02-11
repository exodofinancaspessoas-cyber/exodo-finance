import React, { useEffect, useState } from 'react';
import { getTransactions } from '../services/mockService';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { ArrowDownLeft, ArrowUpRight, Search, Filter } from 'lucide-react';

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setTransactions(getTransactions());
  }, []);

  const filtered = transactions.filter(t => {
      if (filter === 'pending') return t.status === TransactionStatus.PENDING_METHOD;
      if (filter === 'expense') return t.type === TransactionType.EXPENSE;
      if (filter === 'income') return t.type === TransactionType.INCOME;
      return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800">Histórico de Transações</h2>
        
        <div className="flex space-x-2 bg-slate-50 p-1 rounded-lg">
             <button 
                onClick={() => setFilter('all')} 
                className={`px-4 py-2 text-sm rounded-md transition-all ${filter === 'all' ? 'bg-white text-orange-600 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Todas
             </button>
             <button 
                onClick={() => setFilter('pending')} 
                className={`px-4 py-2 text-sm rounded-md transition-all ${filter === 'pending' ? 'bg-orange-50 text-orange-600 font-bold border border-orange-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Pendentes
             </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Data</th>
              <th className="px-6 py-4">Descrição</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Pagamento</th>
              <th className="px-6 py-4 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhuma transação encontrada.</td></tr>
            ) : filtered.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 text-sm text-slate-500 group-hover:text-slate-700">
                  {new Date(t.date).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 font-medium text-slate-800">
                  {t.description}
                  {t.installments && (
                      <span className="ml-2 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                          {t.installments.current}/{t.installments.total}
                      </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                   <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200">Geral</span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {t.status === TransactionStatus.PENDING_METHOD ? (
                    <span className="text-orange-600 bg-orange-50 border border-orange-100 px-2 py-1 rounded text-xs font-bold">Pendente</span>
                  ) : (
                    <span className="capitalize text-slate-600">{t.paymentMethod || 'Carteira'}</span>
                  )}
                </td>
                <td className={`px-6 py-4 text-right font-bold ${
                    t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-700'
                }`}>
                   {t.type === TransactionType.INCOME ? '+' : '-'} R$ {t.value.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}