import React, { useState, useEffect } from 'react';
import { Landmark, CreditCard, ArrowRightLeft } from 'lucide-react';
import AccountsView from './AccountsView';
import CardsView from './CardsView';
import TransfersView from './TransfersView';
import { hapticFeedback } from './ui/Skeleton';

type Tab = 'accounts' | 'cards' | 'transfers';

interface FinanceViewProps {
    initialTab?: Tab;
}

export default function FinanceView({ initialTab = 'accounts' }: FinanceViewProps) {
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'accounts', label: 'Contas', icon: Landmark },
        { id: 'cards', label: 'Cartões', icon: CreditCard },
        { id: 'transfers', label: 'Transferências', icon: ArrowRightLeft },
    ];

    return (
        <div>
            {/* Tab Bar */}
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 ios-squircle-sm mb-8 w-fit ios-glass border shadow-sm" style={{ borderColor: 'var(--ios-glass-border)' }}>
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            id={`tab-finance-${tab.id}`}
                            onClick={() => { hapticFeedback(5); setActiveTab(tab.id); }}
                            className={`flex items-center gap-2 px-5 py-2.5 ios-squircle text-[10px] font-black uppercase tracking-widest transition-all duration-300
                                ${isActive
                                    ? 'bg-[var(--ios-text)] text-[var(--ios-bg)] shadow-md'
                                    : 'text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)] hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                        >
                            <Icon size={14} strokeWidth={isActive ? 3 : 2.5} className={isActive ? '' : 'text-[var(--ios-text-secondary)]'} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div key={activeTab} className="animate-fade-in">
                {activeTab === 'accounts' && <AccountsView />}
                {activeTab === 'cards' && <CardsView />}
                {activeTab === 'transfers' && <TransfersView />}
            </div>
        </div>
    );
}
