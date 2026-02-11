
import React, { useState } from 'react';
import { Database, CloudUpload, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { StorageService } from '../services/storage';

export default function SupabaseSync() {
    const [status, setStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [message, setMessage] = useState('');

    const handleSync = async () => {
        if (!isSupabaseConfigured()) {
            setStatus('ERROR');
            setMessage('Supabase não configurado. Adicione a URL e a Chave no arquivo .env.local');
            return;
        }

        setStatus('SYNCING');
        setMessage('Iniciando sincronização...');

        try {
            // 1. Get all local data
            const accounts = await StorageService.getAccounts();
            const cards = await StorageService.getCards();
            const categories = await StorageService.getCategories();
            const transactions = await StorageService.getTransactions();
            const goals = await StorageService.getGoals();

            // 2. Upload to Supabase (User must be logged in if RLS is on, 
            // but for initial setup we can assume they have access or we'll handle auth next)

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setStatus('ERROR');
                setMessage('Você precisa estar logado para sincronizar. (Iremos configurar o Login a seguir)');
                return;
            }

            // Sync Categories
            setMessage('Sincronizando categorias...');
            for (const cat of categories) {
                await supabase.from('categories').upsert({
                    ...cat,
                    user_id: user.id
                });
            }

            // Sync Accounts
            setMessage('Sincronizando contas...');
            for (const acc of accounts) {
                await supabase.from('accounts').upsert({
                    ...acc,
                    user_id: user.id
                });
            }

            // Sync Cards
            setMessage('Sincronizando cartões...');
            for (const card of cards) {
                await supabase.from('cards').upsert({
                    ...card,
                    user_id: user.id
                });
            }

            // Sync Transactions
            setMessage('Sincronizando transações...');
            // Batch upload is better for many transactions
            const chunks = [];
            for (let i = 0; i < transactions.length; i += 50) {
                chunks.push(transactions.slice(i, i + 50));
            }

            for (const chunk of chunks) {
                await supabase.from('transactions').upsert(
                    chunk.map(t => ({ ...t, user_id: user.id }))
                );
            }

            setStatus('SUCCESS');
            setMessage('Tudo sincronizado com sucesso! Agora seus dados estão na nuvem.');
        } catch (err: any) {
            console.error(err);
            setStatus('ERROR');
            setMessage('Erro na sincronização: ' + err.message);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <Database size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Sincronização com Supabase</h3>
                        <p className="text-sm text-slate-500">Mova seus dados locais para o banco de dados na nuvem.</p>
                    </div>
                </div>

                {status === 'IDLE' && (
                    <button
                        onClick={handleSync}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-600/20"
                    >
                        <CloudUpload size={20} /> Sincronizar Agora
                    </button>
                )}

                {status === 'SYNCING' && (
                    <div className="flex items-center gap-3 text-blue-600 font-bold">
                        <Loader2 size={20} className="animate-spin" /> {message}
                    </div>
                )}

                {status === 'SUCCESS' && (
                    <div className="flex items-center gap-2 text-green-600 font-bold">
                        <CheckCircle size={24} /> {message}
                    </div>
                )}

                {status === 'ERROR' && (
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 text-red-500 font-bold">
                            <AlertTriangle size={20} /> {message}
                        </div>
                        <button onClick={() => setStatus('IDLE')} className="text-xs text-slate-400 underline mt-1">Tentar novamente</button>
                    </div>
                )}
            </div>
        </div>
    );
}
