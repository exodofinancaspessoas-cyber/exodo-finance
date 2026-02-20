
import React, { useState } from 'react';
import { Landmark, CreditCard } from 'lucide-react';
import AccountsView from './AccountsView';
import CardsView from './CardsView';

type Tab = 'accounts' | 'cards';

interface FinanceViewProps {
    initialTab?: Tab;
}

export default function FinanceView({ initialTab = 'accounts' }: FinanceViewProps) {
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'accounts', label: 'Contas Bancárias', icon: Landmark },
        { id: 'cards', label: 'Cartões de Crédito', icon: CreditCard },
    ];

    return (
        <div>
            {/* Tab Bar */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                                ${isActive
                                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Icon size={16} className={isActive ? 'text-orange-600' : ''} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div key={activeTab} className="animate-fade-in">
                {activeTab === 'accounts' ? <AccountsView /> : <CardsView />}
            </div>
        </div>
    );
}
