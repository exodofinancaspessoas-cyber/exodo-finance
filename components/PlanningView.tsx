
import React, { useState } from 'react';
import { Target, PieChart } from 'lucide-react';
import GoalsView from './GoalsView';
import BudgetsView from './BudgetsView';

type Tab = 'goals' | 'budgets';

interface Props {
    initialTab?: Tab;
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'budgets', label: 'Orçamentos', icon: PieChart },
];

export default function PlanningView({ initialTab = 'goals' }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);

    const { hapticFeedback } = require('./ui/Skeleton');

    return (
        <div className="animate-in fade-in duration-700 flex flex-col gap-8">
            {/* iOS Segmented Control */}
            <div className="flex justify-center px-4">
                <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-2xl ios-glass border border-[var(--ios-glass-border)] w-full max-w-sm shadow-inner relative overflow-hidden">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                id={`tab-planning-${tab.id}`}
                                onClick={() => { hapticFeedback(5); setActiveTab(tab.id); }}
                                className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl transition-all duration-300 relative z-10
                                    ${active
                                        ? 'bg-white/10 dark:bg-white/10 shadow-lg'
                                        : 'text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)]'
                                    }`}
                                style={{
                                    border: active ? '1px solid var(--ios-glass-border)' : '1px solid transparent',
                                }}
                            >
                                <Icon size={18} className={active ? 'text-[#ff9500]' : 'opacity-40'} strokeWidth={active ? 3 : 2} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-[var(--ios-text)]' : 'opacity-60'}`}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="px-1">
                {activeTab === 'goals' && <GoalsView />}
                {activeTab === 'budgets' && <BudgetsView />}
            </div>
        </div>
    );
}
