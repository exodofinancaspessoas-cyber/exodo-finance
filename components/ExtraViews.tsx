import React from 'react';
import { getCategories, MOCK_GOALS, MOCK_SCHEDULED } from '../services/mockService';
import { Target, Calendar, Clock, Video, FileText, Plus, Folder, Trash2 } from 'lucide-react';

export const CategoriesView = () => {
  const categories = getCategories();
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Categorias</h2>
        <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-md shadow-orange-500/20">
          <Plus size={16} className="mr-2" /> Nova Categoria
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center group hover:border-orange-200 transition-all">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}>
                <Folder size={20} />
              </div>
              <div>
                <p className="font-bold text-slate-700">{cat.name}</p>
                <p className="text-xs text-slate-400">{cat.is_frequent ? 'Frequente' : 'Ocasional'}</p>
              </div>
            </div>
            <button className="text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const GoalsView = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Metas Financeiras</h2>
        <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center">
          <Plus size={16} className="mr-2" /> Nova Meta
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_GOALS.map(goal => {
          const progress = (goal.current / goal.target) * 100;
          return (
            <div key={goal.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                   <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Target size={24} /></div>
                   <div>
                     <h3 className="font-bold text-slate-800">{goal.name}</h3>
                     <p className="text-xs text-slate-500">Alvo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}</p>
                   </div>
                </div>
                <span className="font-bold text-slate-800">R$ {goal.current.toLocaleString()}</span>
              </div>
              
              <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                <div 
                  className="h-3 rounded-full transition-all duration-1000" 
                  style={{ width: `${progress}%`, backgroundColor: goal.color }}
                ></div>
              </div>
              
              <div className="flex justify-between text-xs text-slate-500">
                <span>{progress.toFixed(0)}% concluído</span>
                <span>Meta: R$ {goal.target.toLocaleString()}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export const AgendaView = () => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-slate-800">Agenda Financeira</h2>
         <span className="text-slate-500 font-medium">Dezembro 2025</span>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="grid grid-cols-7 gap-2 mb-4 text-center text-xs font-bold text-slate-400 uppercase">
           <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sab</div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map(d => (
            <div key={d} className={`h-24 border rounded-xl p-2 flex flex-col justify-between ${d === 10 ? 'border-orange-500 bg-orange-50' : 'border-slate-100 hover:border-orange-200'}`}>
               <span className={`text-sm font-bold ${d === 10 ? 'text-orange-600' : 'text-slate-700'}`}>{d}</span>
               {d === 10 && <div className="text-[10px] bg-red-100 text-red-600 px-1 rounded truncate">- R$ 1.800</div>}
               {d === 5 && <div className="text-[10px] bg-green-100 text-green-600 px-1 rounded truncate">+ R$ 4.500</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ScheduledView = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800">Transações Agendadas</h2>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
         <table className="w-full text-left">
           <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium">
             <tr>
               <th className="px-6 py-4">Data Prevista</th>
               <th className="px-6 py-4">Descrição</th>
               <th className="px-6 py-4">Categoria</th>
               <th className="px-6 py-4 text-right">Valor</th>
               <th className="px-6 py-4 text-center">Ação</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {MOCK_SCHEDULED.map(item => (
               <tr key={item.id} className="hover:bg-orange-50/30">
                 <td className="px-6 py-4 flex items-center text-slate-600">
                    <Clock size={16} className="mr-2 text-orange-400" />
                    {new Date(item.date).toLocaleDateString('pt-BR')}
                 </td>
                 <td className="px-6 py-4 font-bold text-slate-800">{item.description}</td>
                 <td className="px-6 py-4 text-sm text-slate-500">{item.category}</td>
                 <td className={`px-6 py-4 text-right font-bold ${item.type === 'RECEITA' ? 'text-green-600' : 'text-red-500'}`}>
                   R$ {item.value.toFixed(2)}
                 </td>
                 <td className="px-6 py-4 text-center">
                   <button className="text-xs text-orange-600 font-bold hover:underline">Editar</button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
      </div>
    </div>
  );
};

export const ReportsView = () => (
  <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl border border-slate-100 border-dashed">
     <div className="p-4 bg-orange-50 rounded-full mb-4"><FileText size={40} className="text-orange-500" /></div>
     <h3 className="text-xl font-bold text-slate-800">Relatórios Avançados</h3>
     <p className="text-slate-500">Funcionalidade em desenvolvimento.</p>
  </div>
);

export const TutorialsView = () => (
  <div className="space-y-6 animate-fade-in">
    <h2 className="text-2xl font-bold text-slate-800">Tutoriais</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
       {[1, 2, 3].map(i => (
         <div key={i} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm group cursor-pointer">
            <div className="h-40 bg-slate-200 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
               <Video size={40} className="text-slate-400 group-hover:text-orange-500" />
            </div>
            <div className="p-4">
               <h3 className="font-bold text-slate-800 mb-1">Como categorizar gastos</h3>
               <p className="text-xs text-slate-500">Aprenda a organizar suas finanças em 3 passos.</p>
            </div>
         </div>
       ))}
    </div>
  </div>
);
