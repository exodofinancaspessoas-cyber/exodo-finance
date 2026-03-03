
import React, { useState } from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';
import ProjectionView from './ProjectionView';
import ReportsView from './ReportsView';
import FluxoCaixaView from './FluxoCaixaView';

type Tab = 'projection' | 'reports' | 'fluxo';

interface Props {
    initialTab?: Tab;
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'projection', label: 'Projeção', icon: TrendingUp },
    { id: 'fluxo', label: 'Tabela de Caixa', icon: BarChart3 },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
];

export default function AnalyticsView({ initialTab = 'projection' }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-1 ios-glass border rounded-xl p-1.5 shadow-sm w-fit" style={{ borderColor: 'var(--ios-glass-border)' }}>
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${active
                                ? 'bg-[#ff9500] text-white shadow-md'
                                : 'text-[var(--ios-text-secondary)] hover:text-[var(--ios-text)] hover:bg-white/5'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div>
                {activeTab === 'projection' && <ProjectionView />}
                {activeTab === 'fluxo' && <FluxoCaixaView />}
                {activeTab === 'reports' && <ReportsView />}
            </div>
        </div>
    );
}
