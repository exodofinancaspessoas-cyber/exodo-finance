import React from 'react';
import { X, CheckCircle2, Landmark, CreditCard, TrendingUp, ArrowRight, ShieldCheck } from 'lucide-react';

interface ActionManualProps {
    onClose: () => void;
    onStartTour: () => void;
}

export default function ActionManual({ onClose, onStartTour }: ActionManualProps) {
    const steps = [
        {
            icon: Landmark,
            title: "1. Bancos e Saldos",
            color: "text-orange-600",
            bg: "bg-orange-50",
            content: "O primeiro passo é cadastrar todas as suas contas. É aqui que você define seu patrimônio base e de onde o dinheiro sai para os gastos."
        },
        {
            icon: CreditCard,
            title: "2. Cartões e Faturas",
            color: "text-blue-600",
            bg: "bg-blue-50",
            content: "Cadastre seus cartões e use a 'Importação de Faturas' para lançar o que você já deve. Isso garante que seu orçamento futuro seja 100% real."
        },
        {
            icon: TrendingUp,
            title: "3. Receitas e Despesas",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            content: "Com a base pronta, basta lançar seu dia a dia. Marque gastos fixos como recorrentes para o sistema trabalhar por você todo mês."
        }
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in px-4">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
                {/* Minimal Header */}
                <div className="p-5 flex justify-between items-center border-b border-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center text-white text-[10px] font-black">Ê</div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Treinamento Êxodo</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X size={18} />
                    </button>
                </div>

                {/* Persuasive Callout */}
                <div className="px-6 pt-6 pb-2 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase mb-3">
                        <ShieldCheck size={12} /> Comece do jeito certo
                    </div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight mb-2">
                        A regra de ouro: <br />3 passos para o controle.
                    </h3>
                </div>

                {/* Focused Content */}
                <div className="p-6 space-y-5">
                    {steps.map((step, idx) => (
                        <div key={idx} className="flex gap-4 relative">
                            {idx < steps.length - 1 && (
                                <div className="absolute left-[22px] top-10 w-0.5 h-6 bg-slate-100" />
                            )}
                            <div className={`shrink-0 w-11 h-11 rounded-xl ${step.bg} ${step.color} flex items-center justify-center shadow-sm z-10 font-black text-xs`}>
                                <step.icon size={20} />
                            </div>
                            <div className="space-y-1 py-1">
                                <h4 className="font-black text-slate-800 text-[13px] leading-none">
                                    {step.title}
                                </h4>
                                <p className="text-[11px] text-slate-500 leading-tight font-medium max-w-[220px]">
                                    {step.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2">
                    <button
                        onClick={onStartTour}
                        className="w-full bg-slate-900 text-white text-xs font-black py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                    >
                        COMEÇAR GUIA PASSO A PASSO <ArrowRight size={16} />
                    </button>
                    <p className="text-[9px] text-slate-400 font-bold text-center uppercase tracking-widest mt-1">
                        Recomendado para usuários novos
                    </p>
                </div>
            </div>
        </div>
    );
}
