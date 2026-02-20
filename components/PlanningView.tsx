
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

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-xl p-1.5 shadow-sm w-fit">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${active
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div>
                {activeTab === 'goals' && <GoalsView />}
                {activeTab === 'budgets' && <BudgetsView />}
            </div>
        </div>
    );
}
