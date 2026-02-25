import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, CreditCard, Banknote, Landmark, Check, AlertCircle, ChevronDown, Calendar, Tag, RefreshCw, Search, ChevronRight, Camera, Mic, Trash2, StopCircle, Play } from 'lucide-react';
import { Skeleton, hapticFeedback } from './ui/Skeleton';
import { StorageService } from '../services/storage';
import { Transaction, TransactionType, PaymentMethod, Account, Card, Category, TransactionStatus, RecurrenceType, RecurrenceFrequency } from '../types';
import { formatCurrency, toISODate } from '../utils';

interface QuickAddViewProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function QuickAddView({ onClose, onSuccess }: QuickAddViewProps) {
    const [type, setType] = useState<TransactionType>('DESPESA');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(toISODate(new Date()));
    const [categoryId, setCategoryId] = useState('');
    const [status, setStatus] = useState<TransactionStatus>('PAGA');
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringType, setRecurringType] = useState<RecurrenceType>('FIXO');
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('MENSAL');
    const [dayOfMonth, setDayOfMonth] = useState<number>(new Date().getDate());
    const [programmedAmount, setProgrammedAmount] = useState('');
    const [recurringDuration, setRecurringDuration] = useState('');
    const [selectedPayment, setSelectedPayment] = useState<{
        method: PaymentMethod,
        accountId?: string,
        cardId?: string,
        label?: string
    } | null>(null);

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Media Attachments
    const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [capturedAudio, setCapturedAudio] = useState<Blob | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [recordingActive, setRecordingActive] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<number | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Selector States
    const [selectorOpen, setSelectorOpen] = useState<'CARD' | 'ACCOUNT' | 'CATEGORY' | null>(null);

    const amountInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
        const timer = setTimeout(() => {
            amountInputRef.current?.focus();
        }, 400);
        return () => clearTimeout(timer);
    }, []);

    const loadData = async () => {
        const [accs, crds, cats] = await Promise.all([
            StorageService.getAccounts(),
            StorageService.getCards(),
            StorageService.getCategories()
        ]);
        setAccounts(accs);
        setCards(crds);
        setCategories(cats.filter(c => (c.type as string) === type || c.type === 'AMBOS'));
    };

    useEffect(() => {
        loadData();
    }, [type]);

    useEffect(() => {
        const [, , day] = date.split('-').map(Number);
        if (day) setDayOfMonth(day);
    }, [date]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setCapturedAudio(audioBlob);
                setAudioPreviewUrl(URL.createObjectURL(audioBlob));
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setRecordingActive(true);
            setRecordingTime(0);
            recordingIntervalRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000) as unknown as number;
        } catch (err) {
            console.error('Erro ao acessar microfone:', err);
            alert('Não foi possível acessar o microfone.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && recordingActive) {
            mediaRecorderRef.current.stop();
            setRecordingActive(false);
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        }
    };

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCapturedPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async (isComplete: boolean) => {
        const numericAmount = parseFloat(amount.replace(',', '.'));

        // Validations

        if (isComplete && (isNaN(numericAmount) || numericAmount <= 0)) {
            alert('Por favor, insira o valor.');
            amountInputRef.current?.focus();
            return;
        }

        if (isComplete) {
            if (!description.trim()) {
                alert('A descrição é obrigatória!');
                return;
            }
            if (!selectedPayment) {
                alert('Selecione a forma de pagamento!');
                return;
            }
            if (!categoryId) {
                alert('Selecione a categoria!');
                return;
            }
        }

        setIsSaving(true);
        try {
            let photoUrl: string | undefined;
            let audioUrl: string | undefined;

            if (capturedPhoto) {
                const url = await StorageService.uploadEvidence(capturedPhoto, 'photo');
                if (url) photoUrl = url;
            }

            if (capturedAudio) {
                const url = await StorageService.uploadEvidence(capturedAudio, 'audio');
                if (url) audioUrl = url;
            }

            const trxId = StorageService.generateId();
            const newTrx: Transaction = {
                id: trxId,
                description: description || (type === 'DESPESA' ? 'Despesa Rápida' : 'Receita Rápida'),
                amount: isNaN(numericAmount) ? 0 : numericAmount,
                type: type,
                category_id: categoryId,
                date: date,
                status: isComplete ? status : 'INCOMPLETA',
                payment_method: selectedPayment?.method,
                account_id: selectedPayment?.accountId,
                card_id: selectedPayment?.cardId,
                created_at: new Date().toISOString(),
                observation: isRecurring ? 'Lançamento Fixo Gerado' : undefined,
                photo_url: photoUrl,
                audio_url: audioUrl
            };

            await StorageService.saveTransaction(newTrx);

            // Se for recorrente, criar a regra de recorrência
            if (isRecurring) {
                await StorageService.saveRecurringExpense({
                    id: StorageService.generateId(),
                    description: description || (type === 'DESPESA' ? 'Despesa Fixa' : 'Receita Fixa'),
                    amount: numericAmount,
                    category_id: categoryId,
                    type: recurringType,
                    frequency: frequency as any,
                    day_of_month: dayOfMonth,
                    active: true,
                    auto_create: true,
                    start_date: date,
                    account_id: selectedPayment?.accountId,
                    card_id: selectedPayment?.cardId,
                    payment_method: selectedPayment?.method,
                    duration_count: recurringDuration ? Number(recurringDuration) : undefined,
                    programmed_amount: programmedAmount ? Number(programmedAmount.replace(',', '.')) : undefined
                });
            }

            onSuccess();
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar transação');
        } finally {
            setIsSaving(false);
        }
    };

    const isReadyToComplete = amount && description && selectedPayment && categoryId;

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-stretch text-slate-900 animate-in slide-in-from-bottom duration-500 overflow-hidden h-[100dvh]">
            {/* Header */}
            <header className="p-6 flex justify-between items-center bg-white sticky top-0 z-30 shrink-0 border-b border-slate-50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl rotate-3">Ê</div>
                    <div className="flex flex-col">
                        <span className="font-black tracking-[0.2em] uppercase text-[11px] text-orange-600">Exodo Finance</span>
                        <span className="font-black text-lg text-slate-900 leading-none">Novo Lançamento</span>
                    </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-100 flex items-center justify-center transition-all active:scale-90 text-slate-400">
                    <X size={20} />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar pb-32">
                {/* HERO: The Amount Protagonist */}
                <section
                    className={`py-8 px-6 flex flex-col items-center justify-center transition-all relative overflow-hidden bg-white`}
                    onClick={() => amountInputRef.current?.focus()}
                >
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />

                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-6 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse" />
                        Valor da {type === 'DESPESA' ? 'Despesa' : 'Receita'}
                    </label>

                    {/* Miniature Media Actions - Moved to below label/above value */}
                    <div className="flex gap-4 mb-4">
                        {/* Miniature Photo Action */}
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                ref={photoInputRef}
                                onChange={handlePhotoCapture}
                            />
                            {photoPreview ? (
                                <div className="relative group">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-500 shadow-lg shadow-orange-100 ring-4 ring-white">
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setCapturedPhoto(null); setPhotoPreview(null); }}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all font-bold"
                                    >
                                        <X size={10} strokeWidth={4} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); photoInputRef.current?.click(); }}
                                    className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-white hover:text-orange-600 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100 transition-all active:scale-90 group"
                                >
                                    <Camera size={20} strokeWidth={2} />
                                </button>
                            )}
                        </div>

                        {/* Miniature Audio Action */}
                        <div className="relative">
                            {capturedAudio ? (
                                <div className="relative group">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const audio = new Audio(audioPreviewUrl!);
                                            audio.play();
                                        }}
                                        className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 ring-4 ring-white animate-pulse"
                                    >
                                        <Play size={16} fill="currentColor" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setCapturedAudio(null); setAudioPreviewUrl(null); }}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all font-bold"
                                    >
                                        <X size={10} strokeWidth={4} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        recordingActive ? stopRecording() : startRecording();
                                    }}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${recordingActive ? 'bg-red-600 text-white shadow-xl shadow-red-200 animate-bounce' : 'bg-slate-50 border border-slate-100 text-slate-400 hover:bg-white hover:text-indigo-600 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100'}`}
                                >
                                    {recordingActive ? <StopCircle size={20} /> : <Mic size={20} strokeWidth={2} />}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative group flex flex-col items-center">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-200">R$</span>
                            <div className="relative border-b-2 border-slate-50 focus-within:border-orange-200 transition-all px-4 py-2">
                                <input
                                    ref={amountInputRef}
                                    type="text"
                                    inputMode="decimal"
                                    value={amount === '0' ? '' : amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0,00"
                                    className={`bg-transparent border-none outline-none text-7xl md:text-8xl font-black text-center w-full max-w-[320px] placeholder:text-slate-200 transition-colors ${type === 'DESPESA' ? 'text-slate-900' : 'text-slate-900'}`}
                                    onFocus={e => e.target.select()}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <div className="px-6 space-y-6">
                    {/* Primary Type Toggle */}
                    <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl relative border border-slate-200">
                        <button
                            onClick={() => { hapticFeedback(5); setType('DESPESA'); }}
                            className={`py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest z-10 btn-mobile-active ${type === 'DESPESA' ? 'bg-white text-red-600 shadow-lg' : 'text-slate-500'}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${type === 'DESPESA' ? 'bg-red-600' : 'bg-slate-400'}`} />
                            Despesa
                        </button>
                        <button
                            onClick={() => { hapticFeedback(5); setType('RECEITA'); }}
                            className={`py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest z-10 btn-mobile-active ${type === 'RECEITA' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-500'}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${type === 'RECEITA' ? 'bg-blue-600' : 'bg-slate-400'}`} />
                            Receita
                        </button>
                    </div>

                    {/* Section 1: Context */}
                    <div className="bg-slate-50 rounded-[32px] p-1 border border-slate-100">
                        <div className="bg-white rounded-[28px] p-6 space-y-6 shadow-sm">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">O que é isso? <span className="text-orange-600">*</span></label>
                                <input
                                    type="text"
                                    placeholder="Descreva este lançamento..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-5 text-lg outline-none focus:bg-white focus:border-orange-500/10 transition-all font-black placeholder:text-slate-200"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Categoria <span className="text-orange-600">*</span></label>
                                <button
                                    onClick={() => {
                                        hapticFeedback(5);
                                        setSelectorOpen('CATEGORY');
                                        setCategorySearch('');
                                    }}
                                    className={`w-full p-5 rounded-2xl flex items-center justify-between border-2 transition-all btn-mobile-active ${categoryId ? 'border-slate-900 bg-slate-900 text-white shadow-xl' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <Tag size={18} className={categoryId ? 'text-orange-400' : 'text-slate-300'} />
                                        <span className="font-black text-xs uppercase tracking-widest truncate">
                                            {categoryId ? categories.find(c => c.id === categoryId)?.name : 'Escolher Categoria'}
                                        </span>
                                    </div>
                                    <ChevronDown size={18} className={categoryId ? 'text-white/40' : 'text-slate-200'} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Payment */}
                    <div className="bg-slate-50 rounded-[32px] p-1 border border-slate-100">
                        <div className="bg-white rounded-[28px] p-6 space-y-6 shadow-sm">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Forma de Pagamento <span className="text-orange-600">*</span></label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { hapticFeedback(5); setSelectedPayment({ method: 'DINHEIRO', label: 'Dinheiro' }); }}
                                    className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all btn-mobile-active ${selectedPayment?.method === 'DINHEIRO' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                >
                                    <Banknote size={20} strokeWidth={1.5} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Dinheiro</span>
                                </button>
                                <button
                                    onClick={() => { hapticFeedback(5); setSelectedPayment({ method: 'PIX', label: 'Pix' }); }}
                                    className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all btn-mobile-active ${selectedPayment?.method === 'PIX' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                >
                                    <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-[8px] font-black text-white">P</div>
                                    <span className="text-[9px] font-black uppercase tracking-widest">Pix</span>
                                </button>
                                <button
                                    onClick={() => { hapticFeedback(5); setSelectorOpen('CARD'); }}
                                    className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all relative btn-mobile-active ${selectedPayment?.method === 'CREDITO' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                >
                                    <CreditCard size={20} strokeWidth={1.5} />
                                    <span className="text-[9px] font-black uppercase tracking-widest truncate w-full px-1 text-center">
                                        {selectedPayment?.method === 'CREDITO' ? (selectedPayment.label || 'Crédito') : 'Cartão'}
                                    </span>
                                </button>
                                <button
                                    onClick={() => { hapticFeedback(5); setSelectorOpen('ACCOUNT'); }}
                                    className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all relative btn-mobile-active ${selectedPayment?.method === 'DEBITO' ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                >
                                    <Landmark size={20} strokeWidth={1.5} />
                                    <span className="text-[9px] font-black uppercase tracking-widest truncate w-full px-1 text-center">
                                        {selectedPayment?.method === 'DEBITO' ? (selectedPayment.label || 'Conta') : 'Conta/Débito'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Details */}
                    <div className="bg-slate-50 rounded-[32px] p-1 border border-slate-100">
                        <div className="bg-white rounded-[28px] p-6 space-y-6 shadow-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Data</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl p-4 text-xs font-black outline-none focus:border-orange-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Recorrência</label>
                                    <button
                                        onClick={() => { hapticFeedback(5); setIsRecurring(!isRecurring); }}
                                        className={`w-full p-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all duration-300 btn-mobile-active ${isRecurring ? 'border-indigo-600 bg-indigo-600 text-white shadow-md' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                    >
                                        <RefreshCw size={16} className={isRecurring ? 'animate-spin-slow' : ''} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{isRecurring ? 'Ativo' : 'Repetir?'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recurring Section */}
                    {isRecurring && (
                        <div className="bg-indigo-50/50 rounded-[32px] p-2 animate-in slide-in-from-top-4 duration-500">
                            <div className="bg-white rounded-[28px] p-6 space-y-8 shadow-sm border border-indigo-100/50">
                                {/* Recurring Type */}
                                <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                                    {[
                                        { id: 'FIXO', label: 'Fixo', icon: Banknote },
                                        { id: 'VARIAVEL', label: 'Variável', icon: RefreshCw }
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setRecurringType(opt.id as RecurrenceType)}
                                            className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${recurringType === opt.id ? 'bg-white text-indigo-600 shadow-md scale-[1.02]' : 'text-slate-400'}`}
                                        >
                                            <opt.icon size={12} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Recurring Amount */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Valor das Projeções</label>
                                    <div className="relative">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-black text-indigo-600">R$</div>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0,00"
                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl pl-12 pr-6 py-4 outline-none text-xl font-black text-indigo-900 focus:bg-white focus:border-indigo-100 transition-all placeholder:text-slate-200"
                                            value={programmedAmount === '0' ? '' : programmedAmount}
                                            onChange={e => setProgrammedAmount(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Frequency Grid */}
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Frequência</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['DIARIO', 'SEMANAL', 'MENSAL', 'ANUAL'] as RecurrenceFrequency[]).map(f => (
                                            <button
                                                key={f}
                                                type="button"
                                                onClick={() => setFrequency(f)}
                                                className={`py-4 rounded-xl border-2 text-[8px] font-black uppercase tracking-tight transition-all duration-300 ${frequency === f ? 'border-orange-500 bg-orange-500 text-white shadow-lg' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Extra options */}
                                <div className="grid grid-cols-2 gap-4">
                                    {frequency === 'MENSAL' && (
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vencimento</label>
                                            <div className="relative">
                                                <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600" />
                                                <select
                                                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl pl-10 pr-4 py-4 outline-none text-xs font-black text-slate-900 appearance-none focus:bg-white focus:border-indigo-100 transition-all"
                                                    value={dayOfMonth}
                                                    onChange={e => setDayOfMonth(Number(e.target.value))}
                                                >
                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                        <option key={d} value={d}>Dia {d}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300" />
                                            </div>
                                        </div>
                                    )}

                                    <div className={`${frequency === 'MENSAL' ? 'col-span-1' : 'col-span-2'} space-y-3`}>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Repetições</label>
                                        <div className="relative">
                                            <RefreshCw size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600" />
                                            <input
                                                type="number"
                                                min="1"
                                                placeholder="Infinito"
                                                className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl pl-10 pr-4 py-4 outline-none text-xs font-black text-slate-900 focus:bg-white focus:border-indigo-100 transition-all placeholder:text-slate-200"
                                                value={recurringDuration}
                                                onChange={e => setRecurringDuration(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Status Card */}
                                <div className="bg-slate-900 rounded-3xl p-5 flex items-center gap-4 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/20 rounded-full -mr-12 -mt-12 blur-2xl" />
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${type === 'DESPESA' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                        <Check size={24} strokeWidth={3} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Confirmação</span>
                                        <p className="text-[10px] font-bold text-white leading-tight">
                                            {recurringType === 'FIXO'
                                                ? `Criado automaticamente todo ${frequency === 'DIARIO' ? 'dia' : frequency === 'MENSAL' ? 'mês' : frequency === 'SEMANAL' ? 'semana' : 'ano'}.`
                                                : 'Valor variável para controle futuro.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ACTION FOOTER */}
            <footer className="px-6 py-8 pb-12 bg-white/80 backdrop-blur-2xl border-t border-slate-50 sticky bottom-0 z-40 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
                <div className="max-w-xl mx-auto flex gap-4">
                    <button
                        onClick={() => { hapticFeedback(10); handleSave(false); }}
                        disabled={isSaving || (!amount && !capturedPhoto && !capturedAudio)}
                        className={`flex-1 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all text-center leading-tight px-4 btn-mobile-active ${type === 'DESPESA' ? 'bg-red-50 text-red-600 border border-red-100/50' : 'bg-blue-50 text-blue-600 border border-blue-100/50'}`}
                    >
                        Lançamento Parcial
                    </button>
                    <button
                        onClick={() => { hapticFeedback(20); handleSave(true); }}
                        disabled={isSaving || !isReadyToComplete}
                        className={`flex-[1.5] py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-2xl btn-mobile-active ${isReadyToComplete ? (type === 'DESPESA' ? 'bg-red-600 text-white shadow-red-500/30' : 'bg-blue-600 text-white shadow-blue-500/30') : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'}`}
                    >
                        {isSaving ? 'Salvando...' : 'Finalizar'}
                        <Check size={20} strokeWidth={4} />
                    </button>
                </div>
            </footer>

            {/* SELECTION DRAWER */}
            {selectorOpen && (
                <div className="fixed inset-0 z-[110] flex items-end justify-center px-4 pb-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectorOpen(null)} />
                    <div className={`relative w-full max-w-lg bg-white rounded-t-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-500 ${selectorOpen === 'CATEGORY' ? 'h-[92dvh]' : 'rounded-b-[40px]'}`}>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto my-4 shrink-0" />
                        <div className="px-8 pt-2 pb-10 space-y-6 flex flex-col h-full overflow-hidden">
                            <div className="flex justify-between items-center shrink-0">
                                <h3 className="font-black text-xl uppercase tracking-tight text-slate-900">
                                    {selectorOpen === 'CARD' ? 'Escolha o Cartão' : selectorOpen === 'ACCOUNT' ? 'Escolha a Conta' : 'Escolha a Categoria'}
                                </h3>
                                <button onClick={() => setSelectorOpen(null)} className="p-2 bg-slate-50 rounded-full text-slate-400">
                                    <X size={20} />
                                </button>
                            </div>

                            {selectorOpen === 'CATEGORY' && (
                                <div className="relative shrink-0">
                                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Pesquisar categoria..."
                                        value={categorySearch}
                                        onChange={(e) => setCategorySearch(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 pl-12 text-sm outline-none font-bold text-slate-900 focus:bg-white focus:border-indigo-100 transition-all"
                                    />
                                </div>
                            )}

                            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                {selectorOpen === 'CATEGORY' ? (
                                    categories
                                        .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                                        .map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    setCategoryId(cat.id);
                                                    setSelectorOpen(null);
                                                }}
                                                className={`w-full p-5 rounded-2xl transition-all flex items-center justify-between group ${categoryId === cat.id ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-50 hover:bg-slate-100 text-slate-900'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <Tag size={18} className={categoryId === cat.id ? 'text-white' : 'text-slate-400'} />
                                                    <span className="font-black text-xs uppercase tracking-widest">{cat.name}</span>
                                                </div>
                                                {categoryId === cat.id && <Check size={20} />}
                                            </button>
                                        ))
                                ) : (
                                    <div className="space-y-3">
                                        {/* General Option */}
                                        <button
                                            onClick={() => {
                                                setSelectedPayment({ method: selectorOpen === 'CARD' ? 'CREDITO' : 'DEBITO', label: selectorOpen === 'CARD' ? 'Crt. Geral' : 'Cta. Geral' });
                                                setSelectorOpen(null);
                                            }}
                                            className="w-full p-6 rounded-3xl bg-slate-50 hover:bg-orange-50 transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-orange-200 group-hover:text-orange-600 transition-colors">
                                                    {selectorOpen === 'CARD' ? <CreditCard size={24} /> : <Landmark size={24} />}
                                                </div>
                                                <div className="flex flex-col items-start">
                                                    <span className="font-black text-sm text-slate-900 uppercase">Uso Geral</span>
                                                    <span className="text-[10px] font-bold text-slate-400">Sem vínculo específico</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="text-slate-300" />
                                        </button>

                                        {selectorOpen === 'CARD' ? cards.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    setSelectedPayment({ method: 'CREDITO', cardId: item.id, label: item.name });
                                                    setSelectorOpen(null);
                                                }}
                                                className="w-full p-6 rounded-3xl bg-slate-50 hover:bg-indigo-50 transition-all flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                                                        <CreditCard size={24} />
                                                    </div>
                                                    <div className="flex flex-col items-start">
                                                        <span className="font-black text-sm text-slate-900 uppercase">{item.name}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">Final {item.last_digits || '****'}</span>
                                                    </div>
                                                </div>
                                                <ChevronRight size={20} className="text-slate-300" />
                                            </button>
                                        )) : accounts.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    setSelectedPayment({ method: 'DEBITO', accountId: item.id, label: item.name });
                                                    setSelectorOpen(null);
                                                }}
                                                className="w-full p-6 rounded-3xl bg-slate-50 hover:bg-emerald-50 transition-all flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                                                        <Landmark size={24} />
                                                    </div>
                                                    <div className="flex flex-col items-start">
                                                        <span className="font-black text-sm text-slate-900 uppercase">{item.name}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">{item.bank_name || 'Banco'}</span>
                                                    </div>
                                                </div>
                                                <ChevronRight size={20} className="text-slate-300" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
