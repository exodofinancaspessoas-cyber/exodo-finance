
import React, { useState } from 'react';
import { X, FileText, FileJson, Printer, Download, CheckSquare, Square, FileSpreadsheet } from 'lucide-react';
import { Transaction, Category } from '../types';
import { formatDate, formatCurrency } from '../utils';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    categories: Category[];
}

type ExportColumn = 'date' | 'description' | 'category' | 'amount' | 'type' | 'status' | 'payment_method' | 'observation';

export default function ExportModal({ isOpen, onClose, transactions, categories }: ExportModalProps) {
    const [format, setFormat] = useState<'CSV' | 'JSON' | 'PRINT'>('CSV');
    const [columns, setColumns] = useState<Record<ExportColumn, boolean>>({
        date: true,
        description: true,
        category: true,
        amount: true,
        type: true,
        status: true,
        payment_method: false,
        observation: false
    });

    if (!isOpen) return null;

    const toggleColumn = (col: ExportColumn) => {
        setColumns(prev => ({ ...prev, [col]: !prev[col] }));
    };

    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Geral';

    const handleExport = () => {
        if (format === 'JSON') {
            const data = transactions.map(t => {
                const filtered: any = {};
                if (columns.date) filtered.date = t.date;
                if (columns.description) filtered.description = t.description;
                if (columns.amount) filtered.amount = t.amount;
                if (columns.type) filtered.type = t.type;
                if (columns.category) filtered.category = getCategoryName(t.category_id);
                if (columns.status) filtered.status = t.status;
                if (columns.payment_method) filtered.payment_method = t.payment_method;
                if (columns.observation) filtered.observation = t.observation;
                return filtered;
            });

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            downloadFile(blob, 'relatorio_financeiro.json');
        }
        else if (format === 'CSV') {
            // Header
            const headerRow = Object.keys(columns).filter(k => columns[k as ExportColumn]).map(k => k.toUpperCase());

            // Rows
            const rows = transactions.map(t => {
                return Object.keys(columns).filter(k => columns[k as ExportColumn]).map(k => {
                    const col = k as ExportColumn;
                    let val = '';
                    switch (col) {
                        case 'date': val = t.date; break;
                        case 'description': val = `"${t.description}"`; break; // quote strings
                        case 'amount': val = t.amount.toString().replace('.', ','); break; // PT-BR standard
                        case 'category': val = getCategoryName(t.category_id); break;
                        case 'type': val = t.type; break;
                        case 'status': val = t.status; break;
                        case 'payment_method': val = t.payment_method || ''; break;
                        case 'observation': val = `"${t.observation || ''}"`; break;
                    }
                    return val;
                }).join(';'); // Semicolon for Excel compatibility in BR
            });

            const csvContent = "\uFEFF" + [headerRow.join(';'), ...rows].join('\n'); // Add BOM for Excel
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            downloadFile(blob, 'relatorio_financeiro.csv');
        }
        else if (format === 'PRINT') {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                const html = `
                    <html>
                    <head>
                        <title>Relatório Financeiro - Exodo Finance</title>
                        <style>
                            body { font-family: 'Inter', sans-serif; padding: 40px; }
                            h1 { color: #1e293b; margin-bottom: 5px; }
                            .meta { color: #64748b; font-size: 14px; margin-bottom: 30px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                            th { background: #f8fafc; text-align: left; padding: 12px 8px; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-size: 11px; }
                            td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
                            .amount { font-weight: bold; text-align: right; }
                            .in { color: #16a34a; }
                            .out { color: #dc2626; }
                            .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <h1>Relatório de Transações</h1>
                        <div class="meta">Gerado em ${new Date().toLocaleDateString()} às ${new Date().toLocaleTimeString()} • ${transactions.length} registros</div>
                        
                        <table>
                            <thead>
                                <tr>
                                    ${columns.date ? '<th>Data</th>' : ''}
                                    ${columns.description ? '<th>Descrição</th>' : ''}
                                    ${columns.category ? '<th>Categoria</th>' : ''}
                                    ${columns.type ? '<th>Tipo</th>' : ''}
                                    ${columns.status ? '<th>Status</th>' : ''}
                                    ${columns.amount ? '<th class="amount">Valor</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${transactions.map(t => `
                                    <tr>
                                        ${columns.date ? `<td>${formatDate(t.date)}</td>` : ''}
                                        ${columns.description ? `<td>${t.description}</td>` : ''}
                                        ${columns.category ? `<td>${getCategoryName(t.category_id)}</td>` : ''}
                                        ${columns.type ? `<td>${t.type}</td>` : ''}
                                        ${columns.status ? `<td>${t.status}</td>` : ''}
                                        ${columns.amount ? `<td class="amount ${t.type === 'RECEITA' ? 'in' : 'out'}">${t.type === 'RECEITA' ? '+' : '-'}${formatCurrency(t.amount)}</td>` : ''}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="footer">Exodo Finance App • Documento Confidencial</div>
                        <script>window.print();</script>
                    </body>
                    </html>
                `;
                printWindow.document.write(html);
                printWindow.document.close();
            }
        }
    };

    const downloadFile = (blob: Blob, fileName: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Exportar Dados</h3>
                        <p className="text-xs text-slate-500">{transactions.length} registros selecionados</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors bg-white p-1 rounded-full hover:bg-slate-100">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Format Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-3 text-center">Formato do Arquivo</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setFormat('CSV')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${format === 'CSV' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-100 hover:border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                <FileSpreadsheet size={24} />
                                <span className="text-xs font-bold">Excel / CSV</span>
                            </button>
                            <button
                                onClick={() => setFormat('JSON')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${format === 'JSON' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 hover:border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                <FileJson size={24} />
                                <span className="text-xs font-bold">JSON</span>
                            </button>
                            <button
                                onClick={() => setFormat('PRINT')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 ${format === 'PRINT' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                <Printer size={24} />
                                <span className="text-xs font-bold">PDF / Print</span>
                            </button>
                        </div>
                    </div>

                    {/* Columns Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Colunas a Incluir</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(columns) as ExportColumn[]).map((col) => (
                                <button
                                    key={col}
                                    onClick={() => toggleColumn(col)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${columns[col] ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-400 border-slate-100'}`}
                                >
                                    {columns[col] ? <CheckSquare size={14} /> : <Square size={14} />}
                                    <span className="capitalize">{col.replace('_', ' ')}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors text-sm">Cancelar</button>
                    <button onClick={handleExport} className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-lg shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all text-sm flex items-center gap-2">
                        <Download size={16} />
                        {format === 'PRINT' ? 'Gerar Relatório' : 'Baixar Arquivo'}
                    </button>
                </div>
            </div>
        </div>
    );
}
