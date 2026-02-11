import React, { useState } from 'react';
import { ArrowRight, CheckCircle, MessageCircle, PieChart, ShieldCheck } from 'lucide-react';
import { createUser } from '../services/mockService';
import { User } from '../types';

interface Props {
  onComplete: (user: User) => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', whatsapp: '' });

  const handleNext = () => setStep(step + 1);

  const handleFinish = () => {
    if (formData.name && formData.whatsapp) {
      const user = createUser(formData.name, formData.whatsapp);
      onComplete(user);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-xl p-8 md:p-12 relative overflow-hidden border border-slate-100">
        
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-orange-100">
              <ShieldCheck className="text-orange-600 w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Bem-vindo ao BRUK</h2>
            <p className="text-slate-500 text-lg max-w-md mx-auto">
              A maneira mais fácil de organizar suas finanças usando apenas o WhatsApp.
            </p>
            <button onClick={handleNext} className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-full font-bold transition-all flex items-center mx-auto space-x-2 shadow-lg shadow-orange-500/20">
              <span>Começar Tour</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Features */}
        {step === 2 && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-center mb-8 text-slate-800">O que o sistema faz?</h2>
            <div className="grid gap-6">
              <div className="flex items-start space-x-4 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm"><MessageCircle className="text-green-600" /></div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-800">Registro via WhatsApp</h3>
                  <p className="text-slate-500 text-sm">Mande áudio, texto ou foto e a IA registra tudo automaticamente.</p>
                </div>
              </div>
              <div className="flex items-start space-x-4 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm"><PieChart className="text-orange-500" /></div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-800">Dashboard Completo</h3>
                  <p className="text-slate-500 text-sm">Veja para onde seu dinheiro vai com gráficos e relatórios.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleNext} className="text-orange-600 font-bold flex items-center hover:text-orange-700">
                Próximo <ArrowRight size={16} className="ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Connect WhatsApp */}
        {step === 3 && (
          <div className="text-center space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-800">Conecte seu WhatsApp</h2>
            <div className="bg-slate-900 p-6 rounded-2xl inline-block shadow-lg">
              <div className="w-32 h-32 bg-white rounded-lg mx-auto flex items-center justify-center text-slate-900 text-xs font-bold">
                [QR Code]
              </div>
            </div>
            <p className="text-slate-500 text-sm">
              Salve nosso número: <strong className="text-slate-900">(11) 99999-9999</strong><br/>
              Sempre que mandar um gasto, nós registramos.
            </p>
            <button onClick={handleNext} className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-6 py-2 rounded-lg text-sm font-bold transition-colors">
              Já salvei o número
            </button>
          </div>
        )}

        {/* Step 4: Profile & Finish */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in max-w-sm mx-auto">
            <div className="text-center">
               <h2 className="text-2xl font-bold text-slate-800">Vamos nos conhecer</h2>
               <p className="text-slate-500">Configuração rápida do perfil</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Seu Nome</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Ex: João Silva"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Seu WhatsApp</label>
                <input 
                  type="tel" 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="(00) 00000-0000"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData(prev => ({...prev, whatsapp: e.target.value}))}
                />
              </div>
            </div>

            <button 
              onClick={handleFinish} 
              disabled={!formData.name || !formData.whatsapp}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-lg font-bold transition-all shadow-lg shadow-orange-500/20"
            >
              Acessar Sistema
            </button>
          </div>
        )}
        
        {/* Progress dots */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-2">
          {[1,2,3,4].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-orange-500 w-4' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}