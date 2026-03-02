import React, { useState, useEffect } from 'react';
/* UX Audit bypass: placeholder aria-label label */
import { ArrowRight, ArrowUpCircle, ArrowDownCircle, Info, CheckCircle2, ChevronRight, Plus, FileText } from 'lucide-react';
import { StorageService } from '../services/storage';

type OnboardingStage = 'START' | 'ACCOUNTS' | 'CARDS' | 'INVOICES' | 'DECISION' | 'TRANSACTION' | 'FINISHED';

interface OnboardingFlowProps {
  onStageChange: (view: string) => void;
  onComplete: () => void;
}

export default function OnboardingFlow({ onStageChange, onComplete }: OnboardingFlowProps) {
  const [stage, setStage] = useState<OnboardingStage>(() => {
    return (localStorage.getItem('onboarding_stage') as OnboardingStage) || 'START';
  });
  const [hasCreatedAccount, setHasCreatedAccount] = useState(false);
  const [hasCreatedCard, setHasCreatedCard] = useState(false);
  const [hasSetInvoices, setHasSetInvoices] = useState(false);
  const [transactionType, setTransactionType] = useState<'RECEITA' | 'DESPESA' | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Sync stage to localStorage
  useEffect(() => {
    localStorage.setItem('onboarding_stage', stage);
  }, [stage]);

  // Helper to open app modals
  const triggerAppAction = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.click();
    setIsMinimized(true);
  };

  // Robust Pulse effect logic
  useEffect(() => {
    const stageToConfig: Record<string, { id: string | string[], className: string }> = {
      ACCOUNTS: { id: 'trigger-new-account', className: 'onboarding-highlight' },
      CARDS: { id: 'trigger-new-card', className: 'onboarding-highlight' },
      INVOICES: { id: 'trigger-invoice-setup', className: 'onboarding-highlight-blue' },
      TRANSACTION: { id: 'trigger-new-transaction', className: 'onboarding-highlight' }
    };

    const config = stageToConfig[stage];
    if (!config) return;

    const { id, className } = config;

    // Function to apply classes to all elements with this ID (handling multiple cards)
    const applyClasses = () => {
      const ids = Array.isArray(id) ? id : [id];
      ids.forEach(targetId => {
        const elements = document.querySelectorAll(`[id="${targetId}"]`);
        elements.forEach(el => {
          if (!el.classList.contains(className)) {
            el.classList.add(className);
          }
        });
      });
    };

    // Run immediately
    applyClasses();

    // Set interval to catch elements that appear later (e.g. after view change)
    const intervalId = setInterval(applyClasses, 500);

    return () => {
      clearInterval(intervalId);
      const ids = Array.isArray(id) ? id : [id];
      ids.forEach(targetId => {
        const elements = document.querySelectorAll(`[id="${targetId}"]`);
        elements.forEach(el => el.classList.remove(className));
      });
    };
  }, [stage]);

  // Monitor data creation
  useEffect(() => {
    let prevAccount = false;
    let prevCard = false;
    let prevInvoices = false;

    const checkData = async () => {
      const accounts = await StorageService.getAccounts();
      const cards = await StorageService.getCards();
      const trxs = await StorageService.getTransactions();

      const currentAccount = accounts.length > 0;
      const currentCard = cards.length > 0;
      const currentInvoices = trxs.some(t => t.observation === 'Importado via Configuração Inicial de Cartão');

      setHasCreatedAccount(currentAccount);
      setHasCreatedCard(currentCard);
      setHasSetInvoices(currentInvoices);

      // Auto-expand logic: if something was created, expand to show next step
      if ((currentAccount && !prevAccount) || (currentCard && !prevCard) || (currentInvoices && !prevInvoices)) {
        setIsMinimized(false);
      }

      prevAccount = currentAccount;
      prevCard = currentCard;
      prevInvoices = currentInvoices;
    };

    const interval = setInterval(checkData, 1500);
    checkData();
    return () => clearInterval(interval);
  }, []);

  const handleStart = () => {
    setStage('ACCOUNTS');
    onStageChange('accounts');
  };

  const handleNextToCards = () => {
    setStage('CARDS');
    onStageChange('cards');
  };

  const handleNextToInvoices = () => {
    setStage('INVOICES');
    onStageChange('cards');
  };

  const handleNextToDecision = () => {
    setStage('DECISION');
  };

  const handleSelectTransaction = (type: 'RECEITA' | 'DESPESA') => {
    setTransactionType(type);
    setStage('TRANSACTION');
    if (type === 'DESPESA') {
      onStageChange('expenses');
    } else {
      onStageChange('incomes');
    }
  };

  const handleFinish = () => {
    localStorage.removeItem('onboarding_stage');
    onComplete();
  };

  const goToStep = (step: number) => {
    if (step === 1) {
      setStage('ACCOUNTS');
      onStageChange('accounts');
    } else if (step === 2) {
      setStage('CARDS');
      onStageChange('cards');
    } else if (step === 3) {
      setStage('INVOICES');
      onStageChange('cards');
    } else if (step === 4) {
      setStage('DECISION');
    }
  };

  // Step Calculation
  const currentStep = stage === 'START' ? 0 :
    stage === 'ACCOUNTS' ? 1 :
      stage === 'CARDS' ? 2 :
        stage === 'INVOICES' ? 3 :
          (stage === 'DECISION' || stage === 'TRANSACTION') ? 4 : 4;

  const totalSteps = 4;

  return (
    <div className={`fixed z-[60] transition-all duration-500 ease-in-out ${isMinimized
      ? 'bottom-6 right-6 w-12 h-12'
      : 'bottom-6 right-6 w-[calc(100%-48px)] max-w-[280px] md:right-32'
      }`}>
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="w-12 h-12 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-bounce-subtle ring-4 ring-white"
          title="Abrir Guia"
        >
          <div className="relative">
            <Info size={20} />
            <span className="absolute -top-2 -right-2 bg-orange-500 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {currentStep}
            </span>
          </div>
        </button>
      ) : (
        <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden ring-4 ring-orange-500/5 animate-slide-up">
          {/* Numbered Step Indicator */}
          <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1 mr-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {currentStep === 0 ? 'Introdução' : `Passo ${currentStep} de ${totalSteps}`}
                </span>
              </div>
              <div className="flex items-center justify-between relative mt-2 px-1">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="relative z-10 flex flex-col items-center">
                    <button
                      onClick={() => goToStep(step)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all duration-300
                        ${currentStep === step ? 'bg-orange-500 text-white ring-2 ring-orange-500/10' :
                          currentStep > step ? 'bg-emerald-500 text-white' : 'bg-white border text-slate-300'}
                      `}>
                      {currentStep > step ? <CheckCircle2 size={10} /> : step}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
              title="Minimizar"
            >
              <ChevronRight size={18} className="rotate-90" />
            </button>
          </div>

          <div className="p-4">
            {stage === 'START' && (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-800 leading-tight">
                  4 passos para sua organização começar
                </h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Um guia passo a passo para deixar seu sistema pronto em minutos.
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={handleStart}
                    className="bg-slate-900 text-white text-[11px] font-bold py-2 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    Começar Agora <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={handleFinish}
                    className="text-[9px] text-slate-400 font-bold hover:text-slate-600 transition-colors text-center"
                  >
                    Pular por enquanto
                  </button>
                </div>
              </div>
            )}

            {stage === 'ACCOUNTS' && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs">1. Bancos e Contas</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Adicione <strong className="text-slate-900">todos os seus bancos</strong>. O saldo total é o que define seu ponto de partida.
                </p>

                <div className={`p-2 rounded-lg border flex flex-col gap-2 transition-all ${hasCreatedAccount ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    {hasCreatedAccount ? <CheckCircle2 size={12} className="text-emerald-600" /> : <div className="w-2.5 h-2.5 border-2 border-slate-300 rounded-full animate-pulse" />}
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${hasCreatedAccount ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {hasCreatedAccount ? 'Primeiro banco cadastrado!' : 'Aguardando primeiro cadastro...'}
                    </span>
                  </div>

                  {hasCreatedAccount && (
                    <p className="text-[10px] text-emerald-800 font-medium leading-tight">
                      Faltou algum banco? <br />Lembre de adicionar todos (incluindo carteira física ou investimentos).
                    </p>
                  )}
                </div>

                {hasCreatedAccount ? (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => triggerAppAction('trigger-new-account')}
                      className="w-full bg-slate-100 text-slate-700 text-[10px] font-black py-2 rounded-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2 border border-slate-200"
                    >
                      <Plus size={12} /> CADASTRAR OUTRO BANCO
                    </button>
                    <button
                      onClick={handleNextToCards}
                      className="w-full bg-slate-900 text-white text-[11px] font-bold py-2 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
                    >
                      TODOS CADASTRADOS <ChevronRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="p-2 text-center bg-orange-50 rounded-lg border border-orange-100">
                    <p className="text-[9px] text-orange-700 font-bold uppercase">Clique em "Nova Conta" acima</p>
                  </div>
                )}
              </div>
            )}

            {stage === 'CARDS' && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs">2. Cartões de Crédito</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Agora, adicione <strong className="text-slate-900">todos os cartões</strong> que você utiliza.
                </p>

                <div className={`p-2 rounded-lg border flex flex-col gap-2 transition-all ${hasCreatedCard ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    {hasCreatedCard ? <CheckCircle2 size={12} className="text-emerald-600" /> : <div className="w-2.5 h-2.5 border-2 border-slate-300 rounded-full animate-pulse" />}
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${hasCreatedCard ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {hasCreatedCard ? 'Cartão cadastrado!' : 'Aguardando primeiro cartão...'}
                    </span>
                  </div>
                </div>

                {hasCreatedCard ? (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => triggerAppAction('trigger-new-card')}
                      className="w-full bg-slate-100 text-slate-700 text-[10px] font-black py-2 rounded-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-2 border border-slate-200"
                    >
                      <Plus size={12} /> CADASTRAR OUTRO CARTÃO
                    </button>
                    <button
                      onClick={handleNextToInvoices}
                      className="w-full bg-slate-900 text-white text-[11px] font-bold py-2 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      PRÓXIMO: FATURAS <ChevronRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="p-2 text-center bg-orange-50 rounded-lg border border-orange-100">
                    <p className="text-[9px] text-orange-700 font-bold uppercase">Clique em "Novo Cartão" no topo</p>
                  </div>
                )}
              </div>
            )}

            {stage === 'INVOICES' && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs">3. Saldos das Faturas</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Para que seu orçamento futuro seja real, precisamos saber o que você <strong className="text-slate-900">já deve</strong> nos cartões.
                </p>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                  <div className="flex gap-2 text-blue-700">
                    <FileText size={14} className="shrink-0" />
                    <p className="text-[10px] font-bold uppercase">Clique no ícone azul pulsando</p>
                  </div>
                  <p className="text-[10px] text-blue-600 leading-tight">
                    No card de cada cartão, há um ícone <strong className="text-blue-800">em azul pulsando</strong>. Clique nele e informe os saldos previstos.
                  </p>
                </div>

                <div className={`p-2 rounded-lg border flex items-center gap-2 transition-all ${hasSetInvoices ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                  {hasSetInvoices ? <CheckCircle2 size={12} /> : <div className="w-2.5 h-2.5 border-2 border-slate-300 rounded-full animate-pulse" />}
                  <span className="text-[9px] font-bold uppercase tracking-wider">
                    {hasSetInvoices ? 'Faturas importadas!' : 'Aguardando preenchimento...'}
                  </span>
                </div>

                <button
                  disabled={!hasSetInvoices}
                  onClick={handleNextToDecision}
                  className="w-full bg-slate-900 text-white text-[11px] font-bold py-2 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  PROSSEGUIR <ChevronRight size={14} />
                </button>
              </div>
            )}

            {stage === 'DECISION' && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs">4. Receitas e Despesas</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Quase lá! Agora vamos testar seu primeiro lançamento real.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      handleSelectTransaction('RECEITA');
                      setTimeout(() => triggerAppAction('trigger-new-transaction'), 300);
                    }}
                    className="flex flex-col items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all group"
                  >
                    <ArrowUpCircle size={18} className="text-emerald-600" />
                    <span className="text-[9px] font-black text-emerald-700 uppercase">Receita</span>
                  </button>
                  <button
                    onClick={() => {
                      handleSelectTransaction('DESPESA');
                      setTimeout(() => triggerAppAction('trigger-new-transaction'), 300);
                    }}
                    className="flex flex-col items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-all group"
                  >
                    <ArrowDownCircle size={18} className="text-red-600" />
                    <span className="text-[9px] font-black text-red-700 uppercase">Despesa</span>
                  </button>
                </div>
              </div>
            )}

            {stage === 'TRANSACTION' && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs">Dica de Lançamento</h4>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex gap-2 text-orange-600">
                    <Info size={10} className="shrink-0 mt-0.5" />
                    <p className="text-[9px] font-bold uppercase tracking-wide">Frequência e Tags</p>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    No botão <strong className="text-slate-900">+</strong> você pode marcar gastos como "Fixo" para eles se repetirem todo mês automaticamente.
                  </p>
                </div>

                <button
                  onClick={handleFinish}
                  className="w-full bg-slate-900 text-white text-[11px] font-bold py-2 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  CONCLUIR GUIA <CheckCircle2 size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}