import React, { useEffect, useState } from 'react';
import { getAccounts, getCards } from '../services/mockService';
import { Account, Card } from '../types';
import { CreditCard, Wallet, Plus, Landmark } from 'lucide-react';

interface Props {
  filter?: 'credit' | 'bank' | 'all';
}

export default function AccountsView({ filter = 'all' }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    setAccounts(getAccounts());
    setCards(getCards());
  }, []);

  const showBank = filter === 'all' || filter === 'bank';
  const showCredit = filter === 'all' || filter === 'credit';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Accounts Section */}
      {showBank && (
      <div>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Contas Bancárias</h2>
            <button className="flex items-center text-sm font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg transition-colors border border-orange-100">
                <Plus size={16} className="mr-1" /> Adicionar
            </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(acc => (
                <div key={acc.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4 hover:border-orange-200 transition-colors group">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                        <Landmark className="text-slate-400 group-hover:text-orange-500" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 group-hover:text-slate-800">{acc.name}</p>
                        <p className={`text-xl font-bold ${acc.current_balance >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
                            R$ {acc.current_balance.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-400 capitalize">{acc.type}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>
      )}

      {/* Cards Section */}
      {showCredit && (
      <div>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Cartões de Crédito</h2>
            <button className="flex items-center text-sm font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg transition-colors border border-orange-100">
                <Plus size={16} className="mr-1" /> Adicionar
            </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map(card => (
                <div key={card.id} className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden group hover:scale-105 transition-transform duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <CreditCard size={100} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <CreditCard className="text-orange-500" />
                            <span className="font-mono text-slate-400">**** **** **** {card.name === 'Nubank Roxinho' ? '4589' : '9981'}</span>
                        </div>
                        <p className="font-medium text-lg mb-1 text-white tracking-wide">{card.name}</p>
                        <div className="flex justify-between items-end mt-6">
                            <div>
                                <p className="text-[10px] opacity-60 uppercase tracking-wider">Limite Disp.</p>
                                <p className="font-bold text-emerald-400">R$ {card.limit.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] opacity-60 uppercase tracking-wider">Vencimento</p>
                                <p className="font-bold text-white">Dia {card.due_day}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
      )}
    </div>
  );
}