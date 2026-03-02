import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, CreditCard, Banknote, Landmark, Check, AlertCircle, ChevronDown, Calendar, Tag, RefreshCw, Search, ChevronRight, Camera, Mic, Trash2, StopCircle, Play, Sparkles, ScanLine, Loader2 } from 'lucide-react';
import { Skeleton, hapticFeedback } from './ui/Skeleton';
import { StorageService } from '../services/storage';
import { Transaction, TransactionType, PaymentMethod, Account, Card, Category, TransactionStatus, RecurrenceType, RecurrenceFrequency } from '../types';
import { formatCurrency, toISODate } from '../utils';
import { suggestCategory, scanReceipt as scanReceiptAI } from '../services/aiService';

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
    const [interestAmount, setInterestAmount] = useState('');

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
    const [isAISuggesting, setIsAISuggesting] = useState(false);
    const [aiSuggestedCategoryId, setAiSuggestedCategoryId] = useState<string | null>(null);
    const [isOCRScanning, setIsOCRScanning] = useState(false);
    const ocrInputRef = useRef<HTMLInputElement>(null);

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

    // AI: Categorization on description blur
    const handleDescriptionBlur = async () => {
        if (description.trim().length < 3 || categoryId) return;
        setIsAISuggesting(true);
        try {
            const result = await suggestCategory(description, categories);
            if (result?.category_id) {
                const matchedCat = categories.find(c => c.id === result.category_id);
                if (matchedCat) {
                    setCategoryId(result.category_id);
                    setAiSuggestedCategoryId(result.category_id);
                }
            }
        } catch (e) {
            console.warn('[AI] Categorization failed:', e);
        } finally {
            setIsAISuggesting(false);
        }
    };

    // AI: OCR scan of receipt image
    const handleOCRCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsOCRScanning(true);
        try {
            const result = await scanReceiptAI(file);
            if (result) {
                if (result.description) setDescription(result.description);
                if (result.amount) setAmount(String(result.amount));
                if (result.date) setDate(result.date);
                if (result.description && !categoryId) {
                    const catResult = await suggestCategory(result.description, categories);
                    if (catResult?.category_id) {
                        setCategoryId(catResult.category_id);
                        setAiSuggestedCategoryId(catResult.category_id);
                    }
                }
            } else {
                alert('Ótima tentativa! Não consegui extrair os dados. Tente com a imagem mais nítida.');
            }
        } catch (e) {
            console.warn('[AI] OCR failed:', e);
            alert('Erro ao processar a imagem. Tente novamente.');
        } finally {
            setIsOCRScanning(false);
        }
    };

    const handleSave = async (isComplete: boolean) => {
        const numericAmount = parseFloat(amount.replace(',', '.'));

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
                audio_url: audioUrl,
                interest_amount: interestAmount ? parseFloat(interestAmount.replace(',', '.')) : 0
            };

            await StorageService.saveTransaction(newTrx);

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
        <div className="fixed inset-0 z-[100] bg-[#f2f2f7] flex flex-col items-stretch text-slate-900 animate-in slide-in-from-bottom duration-500 overflow-hidden h-[100dvh]">
            {/* Header */}
            <header className="px-6 py-5 flex justify-between items-center ios-glass sticky top-0 z-30 shrink-0 border-b border-white/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 ios-squircle flex items-center justify-center text-white font-black text-xl">Ê</div>
                    <div className="flex flex-col">
                        <span className="font-black tracking-tight text-lg text-slate-900 leading-none">Novo Lançamento</span>
                        <span className="font-bold text-[10px] text-[#007aff] uppercase tracking-widest">Exodo Finance</span>
                    </div>
                </div>
                <button onClick={onClose} className="w-9 h-9 bg-slate-200/50 hover:bg-slate-300/50 ios-squircle flex items-center justify-center transition-all active:scale-90 text-slate-500">
                    <X size={18} strokeWidth={3} />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain pb-32">
                {/* HERO: The Amount Protagonist */}
                <section
                    className="py-12 px-6 flex flex-col items-center justify-center bg-white border-b border-slate-100 mb-6"
                    onClick={() => amountInputRef.current?.focus()}
                >
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                        <div className={`w-2 h-2 ios-squircle animate-pulse ${type === 'DESPESA' ? 'bg-[#ff3b30]' : 'bg-[#34c759]'}`} />
                        {type === 'DESPESA' ? 'Valor da Despesa' : 'Valor da Receita'}
                    </label>

                    <div className="flex gap-5 mb-10">
                        {/* OCR Scanner button */}
                        <div className="relative">
                            <input type="file" accept="image/*" capture="environment" className="hidden" ref={ocrInputRef} onChange={handleOCRCapture} />
                            <button
                                onClick={(e) => { e.stopPropagation(); ocrInputRef.current?.click(); }}
                                disabled={isOCRScanning}
                                className={`w-14 h-14 ios-squircle flex items-center justify-center transition-all active:scale-95 ${isOCRScanning
                                    ? 'bg-[#ff9500]/10 text-[#ff9500] animate-pulse'
                                    : 'bg-[#f2f2f7] text-slate-500 hover:bg-[#ff9500]/10 hover:text-[#ff9500]'
                                    }`}
                            >
                                {isOCRScanning ? <Loader2 size={24} className="animate-spin" /> : <ScanLine size={24} strokeWidth={2.5} />}
                            </button>
                            {isOCRScanning && (
                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-black text-[#ff9500] uppercase tracking-widest">
                                    Lendo...
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <input type="file" accept="image/*" capture="environment" className="hidden" ref={photoInputRef} onChange={handlePhotoCapture} />
                            {photoPreview ? (
                                <div className="relative">
                                    <div className={`w-14 h-14 ios-squircle overflow-hidden border-2 p-0.5 ${type === 'DESPESA' ? 'border-[#ff3b30]' : 'border-[#34c759]'}`}>
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover ios-squircle" />
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setCapturedPhoto(null); setPhotoPreview(null); }} className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[#ff3b30] text-white ios-squircle flex items-center justify-center shadow-lg active:scale-90 transition-all">
                                        <X size={12} strokeWidth={4} />
                                    </button>
                                </div>
                            ) : (
                                <button onClick={(e) => { e.stopPropagation(); photoInputRef.current?.click(); }} className="w-14 h-14 ios-squircle bg-[#f2f2f7] flex items-center justify-center text-slate-500 hover:bg-[#ff3b30]/10 hover:text-[#ff3b30] transition-all active:scale-95">
                                    <Camera size={24} strokeWidth={2.5} />
                                </button>
                            )}
                        </div>

                        <div className="relative">
                            {capturedAudio ? (
                                <div className="relative">
                                    <button onClick={(e) => { e.stopPropagation(); const audio = new Audio(audioPreviewUrl!); audio.play(); }} className="w-14 h-14 ios-squircle bg-[#5856d6] flex items-center justify-center text-white shadow-lg animate-pulse">
                                        <Play size={20} fill="currentColor" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setCapturedAudio(null); setAudioPreviewUrl(null); }} className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[#ff3b30] text-white ios-squircle flex items-center justify-center shadow-lg active:scale-90 transition-all">
                                        <X size={12} strokeWidth={4} />
                                    </button>
                                </div>
                            ) : (
                                <button onClick={(e) => { e.stopPropagation(); recordingActive ? stopRecording() : startRecording(); }} className={`w-14 h-14 ios-squircle flex items-center justify-center transition-all active:scale-95 ${recordingActive ? 'bg-[#ff3b30] text-white animate-bounce' : 'bg-[#f2f2f7] text-slate-500 hover:bg-[#5856d6]/10 hover:text-[#5856d6]'}`}>
                                    {recordingActive ? <StopCircle size={24} strokeWidth={2.5} /> : <Mic size={24} strokeWidth={2.5} />}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative flex flex-col items-center w-full max-w-sm px-4">
                        <div className="flex items-baseline justify-center w-full gap-2">
                            <span className="text-3xl font-black text-slate-300">R$</span>
                            <input
                                ref={amountInputRef}
                                type="text"
                                inputMode="decimal"
                                value={amount === '0' ? '' : amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0,00"
                                className="bg-transparent border-none outline-none text-7xl font-black text-center w-full placeholder:text-slate-100 transition-colors text-slate-900"
                                onFocus={e => e.target.select()}
                            />
                        </div>
                    </div>
                </section>

                <div className="px-6 space-y-8">
                    {/* Primary Type Toggle */}
                    <div className="flex bg-slate-200/50 p-1 ios-squircle">
                        <button
                            onClick={() => { hapticFeedback(5); setType('DESPESA'); }}
                            className={`flex-1 py-3 ios-squircle flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest ${type === 'DESPESA' ? 'bg-white text-[#ff3b30] shadow-md' : 'text-slate-500'}`}
                        >
                            Despesa
                        </button>
                        <button
                            onClick={() => { hapticFeedback(5); setType('RECEITA'); }}
                            className={`flex-1 py-3 ios-squircle flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest ${type === 'RECEITA' ? 'bg-white text-[#34c759] shadow-md' : 'text-slate-500'}`}
                        >
                            Receita
                        </button>
                    </div>

                    {/* Recurring Section */}
                    <div className={`ios-squircle p-0.5 border border-white/50 shadow-sm overflow-hidden ${isRecurring ? (type === 'RECEITA' ? 'bg-[#34c759]/5' : 'bg-[#ff3b30]/5') : 'bg-slate-100'}`}>
                        <div className="bg-white/60 backdrop-blur-md p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 ios-squircle flex items-center justify-center ${isRecurring ? (type === 'RECEITA' ? 'bg-[#34c759]/10 text-[#34c759]' : 'bg-[#ff3b30]/10 text-[#ff3b30]') : 'bg-slate-100 text-slate-400'}`}>
                                    <RefreshCw size={20} strokeWidth={2.5} className={isRecurring ? 'animate-spin-slow' : ''} />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Repetir Lançamento</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fixo ou Parcelado</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { hapticFeedback(5); setIsRecurring(!isRecurring); }}
                                className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isRecurring ? (type === 'RECEITA' ? 'bg-[#34c759]' : 'bg-[#ff3b30]') : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white ios-squircle shadow-sm transition-all duration-300 ${isRecurring ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {isRecurring && (
                            <div className="p-6 space-y-8 animate-in slide-in-from-top-4 duration-500">
                                <div className="flex bg-slate-200/40 p-1 ios-squircle gap-1">
                                    {[
                                        { id: 'FIXO', label: 'Fixo' },
                                        { id: 'VARIAVEL', label: 'Variável' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setRecurringType(opt.id as RecurrenceType)}
                                            className={`flex-1 py-2.5 ios-squircle text-[10px] font-black uppercase tracking-widest transition-all ${recurringType === opt.id ? 'bg-white text-[#007aff] shadow-sm' : 'text-slate-500'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Vencerá todo dia</label>
                                        <div className="flex gap-2 pb-2 overflow-x-auto custom-scrollbar">
                                            {[1, 5, 10, 15, 20, 25, 28].map((d) => (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    onClick={() => setDayOfMonth(d)}
                                                    className={`shrink-0 w-12 h-12 ios-squircle font-black text-sm flex items-center justify-center transition-all active:scale-90 ${dayOfMonth === d ? 'bg-slate-900 text-white shadow-lg scale-110' : 'bg-white text-slate-400 border border-white/50'}`}
                                                >
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#007aff] pl-1">Valor Unitário Programado</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={programmedAmount}
                                                onChange={(e) => setProgrammedAmount(e.target.value)}
                                                placeholder="R$ 0,00"
                                                className="w-full bg-[#007aff]/5 ios-squircle p-5 text-lg font-black outline-none focus:bg-white transition-all text-[#007aff] placeholder:text-[#007aff]/30"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Frequência</label>
                                        <div className="flex bg-slate-200/40 p-1 ios-squircle gap-1">
                                            {['SEMANAL', 'MENSAL', 'ANUAL'].map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setFrequency(f as any)}
                                                    className={`flex-1 py-2.5 ios-squircle text-[9px] font-black uppercase tracking-widest transition-all ${frequency === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                                >
                                                    {f === 'SEMANAL' ? 'Semanal' : f === 'MENSAL' ? 'Mensal' : 'Anual'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Context Section */}
                    <div className="bg-white ios-squircle p-6 space-y-8 shadow-sm border border-slate-100">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Descrição do Lançamento</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="O que você comprou?"
                                    value={description}
                                    onChange={(e) => { setDescription(e.target.value); if (aiSuggestedCategoryId) setAiSuggestedCategoryId(null); }}
                                    onBlur={handleDescriptionBlur}
                                    className="w-full bg-[#f2f2f7] ios-squircle p-5 text-lg outline-none focus:bg-white focus:ring-4 focus:ring-[#007aff]/5 transition-all font-black placeholder:text-slate-300"
                                />
                                {isAISuggesting && (
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <Loader2 size={16} className="animate-spin text-[#ff9500]" />
                                        <span className="text-[10px] font-black text-[#ff9500] uppercase tracking-widest">IA</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Categoria Selecionada</label>
                                {aiSuggestedCategoryId && categoryId === aiSuggestedCategoryId && (
                                    <span className="flex items-center gap-1.5 text-[9px] font-black text-[#ff9500] bg-[#ff9500]/10 px-3 py-1 ios-squircle">
                                        <Sparkles size={10} /> Sugestão IA ✨
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    hapticFeedback(5);
                                    setSelectorOpen('CATEGORY');
                                    setCategorySearch('');
                                }}
                                className={`w-full p-5 ios-squircle flex items-center justify-between transition-all active:scale-95 ${categoryId ? 'bg-slate-900 text-white shadow-xl' : 'bg-[#f2f2f7] text-slate-400'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <Tag size={20} strokeWidth={2.5} className={categoryId ? 'text-[#ff3b30]' : 'text-slate-300'} />
                                    <span className="font-black text-xs uppercase tracking-widest">
                                        {categoryId ? categories.find(c => c.id === categoryId)?.name : 'Selecionar'}
                                    </span>
                                </div>
                                <ChevronDown size={20} className={categoryId ? 'text-white/40' : 'text-slate-300'} />
                            </button>
                        </div>
                    </div>

                    {/* Payment Section */}
                    <div className="bg-white ios-squircle p-6 space-y-6 shadow-sm border border-slate-100">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Forma de Pagamento</label>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { method: 'DINHEIRO' as PaymentMethod, icon: Banknote, label: 'Dinheiro' },
                                { method: 'PIX' as PaymentMethod, icon: ScanLine, label: 'Pix' },
                                { method: 'CREDITO' as PaymentMethod, icon: CreditCard, label: 'Crédito', selector: 'CARD' },
                                { method: 'DEBITO' as PaymentMethod, icon: Landmark, label: 'Conta', selector: 'ACCOUNT' }
                            ].map((item) => (
                                <button
                                    key={item.method}
                                    onClick={() => {
                                        hapticFeedback(5);
                                        if (item.selector) {
                                            setSelectorOpen(item.selector as any);
                                        } else {
                                            setSelectedPayment({ method: item.method, label: item.label });
                                        }
                                    }}
                                    className={`p-5 ios-squircle flex flex-col items-center gap-3 transition-all active:scale-95 ${selectedPayment?.method === item.method ? 'bg-[#007aff]/10 ring-2 ring-[#007aff] text-[#007aff]' : 'bg-[#f2f2f7] text-slate-500'}`}
                                >
                                    <item.icon size={24} strokeWidth={2.5} />
                                    <span className="text-[10px] font-black uppercase tracking-widest truncate w-full text-center">
                                        {(selectedPayment?.method === item.method && selectedPayment.label) ? selectedPayment.label : item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Meta Section */}
                    <div className="bg-white ios-squircle p-6 space-y-6 shadow-sm border border-slate-100">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Data</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-[#f2f2f7] ios-squircle p-4 text-[11px] font-black outline-none focus:bg-white transition-all"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#007aff] pl-1">Taxas / Juros</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={interestAmount}
                                        onChange={(e) => setInterestAmount(e.target.value)}
                                        placeholder="0,00"
                                        className="w-full bg-[#007aff]/5 ios-squircle p-4 text-[11px] font-black outline-none focus:bg-white transition-all text-[#007aff] placeholder:text-[#007aff]/30"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION FOOTER */}
            <footer className="px-6 py-8 pb-10 ios-glass border-t border-white/20 sticky bottom-0 z-40 shrink-0 shadow-2xl">
                <div className="max-w-xl mx-auto flex gap-4">
                    <button
                        onClick={() => { hapticFeedback(10); handleSave(false); }}
                        disabled={isSaving || (!amount && !capturedPhoto && !capturedAudio)}
                        className={`flex-1 py-4 ios-squircle font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all text-center px-4 ${type === 'DESPESA' ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : 'bg-[#34c759]/10 text-[#34c759]'}`}
                    >
                        Parcial
                    </button>
                    <button
                        onClick={() => { hapticFeedback(20); handleSave(true); }}
                        disabled={isSaving || !isReadyToComplete}
                        className={`flex-[2] py-4 ios-squircle font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl ${isReadyToComplete ? (type === 'DESPESA' ? 'bg-[#ff3b30] text-white shadow-[#ff3b30]/20' : 'bg-[#34c759] text-white shadow-[#34c759]/20') : 'bg-slate-300 text-white cursor-not-allowed'}`}
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
                    <div className={`relative w-full max-w-lg ios-glass rounded-t-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-500 flex flex-col ${selectorOpen === 'CATEGORY' ? 'h-[85dvh]' : 'h-auto max-h-[70dvh]'}`}>
                        <div className="w-12 h-1.5 bg-slate-300/50 ios-squircle mx-auto my-4 shrink-0" />
                        <div className="px-8 pt-2 pb-10 space-y-6 flex flex-col h-full overflow-hidden">
                            <div className="flex justify-between items-center shrink-0">
                                <h3 className="font-black text-xl uppercase tracking-tight text-slate-900">
                                    {selectorOpen === 'CARD' ? 'Escolha o Cartão' : selectorOpen === 'ACCOUNT' ? 'Escolha a Conta' : 'Escolha a Categoria'}
                                </h3>
                                <button onClick={() => setSelectorOpen(null)} className="w-9 h-9 bg-slate-200/50 ios-squircle flex items-center justify-center text-slate-500 active:scale-90 transition-all">
                                    <X size={18} strokeWidth={3} />
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
                                        className="w-full bg-white/50 ios-squircle p-5 pl-12 text-sm outline-none font-black text-slate-900 focus:bg-white transition-all border border-white/20"
                                    />
                                </div>
                            )}

                            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-10">
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
                                                className={`w-full p-5 ios-squircle transition-all flex items-center justify-between group active:scale-[0.98] ${categoryId === cat.id ? 'bg-[#ff3b30] text-white shadow-lg' : 'bg-white/40 text-slate-900'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <Tag size={18} strokeWidth={2.5} className={categoryId === cat.id ? 'text-white' : 'text-[#ff3b30]'} />
                                                    <span className="font-black text-xs uppercase tracking-widest">{cat.name}</span>
                                                </div>
                                                {categoryId === cat.id && <Check size={20} strokeWidth={4} />}
                                            </button>
                                        ))
                                ) : (
                                    <div className="space-y-4">
                                        <button
                                            onClick={() => {
                                                setSelectedPayment({ method: selectorOpen === 'CARD' ? 'CREDITO' : 'DEBITO', label: selectorOpen === 'CARD' ? 'Crt. Geral' : 'Cta. Geral' });
                                                setSelectorOpen(null);
                                            }}
                                            className="w-full p-6 ios-squircle bg-white/40 active:scale-[0.98] transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 ios-squircle flex items-center justify-center ${selectorOpen === 'CARD' ? 'bg-[#ff9500]/10 text-[#ff9500]' : 'bg-[#34c759]/10 text-[#34c759]'}`}>
                                                    {selectorOpen === 'CARD' ? <CreditCard size={24} /> : <Landmark size={24} />}
                                                </div>
                                                <div className="flex flex-col items-start">
                                                    <span className="font-black text-sm text-slate-900 uppercase">Uso Geral</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sem vínculo</span>
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
                                                className="w-full p-6 ios-squircle bg-white/40 active:scale-[0.98] transition-all flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-[#007aff]/10 ios-squircle flex items-center justify-center text-[#007aff]">
                                                        <CreditCard size={24} />
                                                    </div>
                                                    <div className="flex flex-col items-start">
                                                        <span className="font-black text-sm text-slate-900 uppercase">{item.name}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Final {item.last_digits || '****'}</span>
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
                                                className="w-full p-6 ios-squircle bg-white/40 active:scale-[0.98] transition-all flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-[#34c759]/10 ios-squircle flex items-center justify-center text-[#34c759]">
                                                        <Landmark size={24} />
                                                    </div>
                                                    <div className="flex flex-col items-start">
                                                        <span className="font-black text-sm text-slate-900 uppercase">{item.name}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.bank_name || 'Banco'}</span>
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
