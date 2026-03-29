
import React, { useMemo, useState } from 'react';
import { ExchangeRates } from '../types';
import { formatNumber } from '../utils';

interface TasasViewProps {
    rates: ExchangeRates;
    onUpdateRate: (dateKey: string, moneda: string, rate: number) => void;
}

const TasasView: React.FC<TasasViewProps> = ({ rates, onUpdateRate }) => {
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [editingCell, setEditingCell] = useState<{ dateKey: string, moneda: string } | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    const monedas = ['COP', 'CLP', 'PEN', 'MXN', 'VES', 'ARS', 'BOB'];
    const monedaNames: Record<string, string> = {
        COP: '🇨🇴 Colombia (COP)',
        CLP: '🇨🇱 Chile (CLP)',
        PEN: '🇵🇪 Perú (PEN)',
        MXN: '🇲🇽 México (MXN)',
        VES: '🇻🇪 Venezuela (VES)',
        ARS: '🇦🇷 Argentina (ARS)',
        BOB: '🇧🇴 Bolivia (BOB)'
    };

    const formatDateShort = (dateKey: string) => {
        if (!dateKey) return '-';
        const [y, m, d] = dateKey.split('-');
        return `${d}/${m}/${y}`;
    };

    const allDates = useMemo(() => {
        const dateSet = new Set<string>();
        Object.keys(rates || {}).forEach(moneda => {
            const rateList = rates[moneda];
            if (Array.isArray(rateList)) {
                rateList.forEach(r => dateSet.add(r.dateKey));
            }
        });
        return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
    }, [rates]);

    const ratesMatrix = useMemo(() => {
        const matrix: Record<string, any> = {};
        allDates.forEach(dateKey => {
            matrix[dateKey] = { dateKey };
            monedas.forEach(moneda => {
                const rateEntry = (rates[moneda] || []).find(r => r.dateKey === dateKey);
                matrix[dateKey][moneda] = rateEntry?.rate || null;
            });
        });
        return matrix;
    }, [rates, allDates]);

    const handleStartEdit = (dateKey: string, moneda: string, currentRate: number | null) => {
        setEditingCell({ dateKey, moneda });
        setEditValue(currentRate !== null ? currentRate.toString() : '');
    };

    const handleSaveEdit = () => {
        if (editingCell) {
            const val = parseFloat(editValue);
            if (!isNaN(val)) {
                onUpdateRate(editingCell.dateKey, editingCell.moneda, val);
            }
            setEditingCell(null);
        }
    };

    const handleAddDate = () => {
        if (!allDates.includes(newDate)) {
            // Initialize with 0 or latest rates if preferred, but here we just add the date to the list
            // by updating one rate (e.g., COP to 0) to make it appear in the matrix
            onUpdateRate(newDate, 'COP', ratesMatrix[allDates[0]]?.COP || 0);
        }
    };

    const totalRates = Object.keys(rates || {}).reduce((sum, key) => sum + (rates[key]?.length || 0), 0);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6 rounded-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">Tasas de Cambio</h2>
                        <p className="text-sm text-slate-500 mt-1">Gestiona las tasas manuales y automáticas.</p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                        <input 
                            type="date" 
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="bg-transparent text-white text-sm outline-none px-2"
                        />
                        <button 
                            onClick={handleAddDate}
                            className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/80 transition-all"
                        >
                            Añadir Fecha
                        </button>
                    </div>
                </div>

                {allDates.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p className="text-4xl mb-4">📊</p>
                        <p className="font-medium">No hay tasas disponibles</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-white/5 text-slate-400 font-semibold border-b border-white/10">
                                <tr>
                                    <th className="px-4 py-3 sticky left-0 bg-surface-dark z-10">📅 Fecha</th>
                                    {monedas.map(moneda => <th key={moneda} className="px-4 py-3 text-right whitespace-nowrap">{monedaNames[moneda]}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-300">
                                {allDates.slice(0, 31).map(dateKey => (
                                    <tr key={dateKey} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-medium sticky left-0 bg-surface-dark/90 backdrop-blur-sm z-10 border-r border-white/5">
                                            {formatDateShort(dateKey)}
                                        </td>
                                        {monedas.map(moneda => {
                                            const rate = ratesMatrix[dateKey]?.[moneda];
                                            const isEditing = editingCell?.dateKey === dateKey && editingCell?.moneda === moneda;

                                            return (
                                                <td 
                                                    key={moneda} 
                                                    className={`px-4 py-3 text-right cursor-pointer transition-all ${isEditing ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                                                    onClick={() => !isEditing && handleStartEdit(dateKey, moneda, rate)}
                                                >
                                                    {isEditing ? (
                                                        <input 
                                                            autoFocus
                                                            type="number"
                                                            step="any"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onBlur={handleSaveEdit}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                                            className="w-24 bg-white/10 border border-primary/50 rounded px-2 py-1 text-right text-white outline-none focus:ring-1 focus:ring-primary"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-end">
                                                            <span className={`font-mono ${rate !== null ? 'text-neon-green' : 'text-slate-600'}`}>
                                                                {rate !== null ? formatNumber(rate) : '-'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                <div className="mt-6 flex items-center gap-4 text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                    <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-neon-green"></span>
                        <span>Tasa Activa</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-slate-600"></span>
                        <span>Sin Datos</span>
                    </div>
                    <p className="ml-auto italic">* Haz clic en cualquier celda para editar el valor.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {monedas.map(moneda => {
                    const monedaRates = rates[moneda] || [];
                    const latestRate = monedaRates[0];
                    return (
                        <div key={moneda} className="glass-card p-5 rounded-2xl border border-white/5 hover:border-primary/30 transition-all group">
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-slate-200 group-hover:text-primary transition-colors">{monedaNames[moneda]}</span>
                                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-slate-500 border border-white/5">{monedaRates.length} registros</span>
                            </div>
                            {latestRate ? (
                                <div>
                                    <p className="text-3xl font-bold text-white tracking-tighter">{formatNumber(latestRate.rate)}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="material-symbols-outlined text-xs text-slate-500">event</span>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Último: {formatDateShort(latestRate.dateKey)}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-slate-600 text-sm italic">Sin datos registrados</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TasasView;
