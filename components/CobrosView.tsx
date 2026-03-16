
import React, { useState, useEffect, useMemo } from 'react';
import { KommoLead, Cobro, DateRange } from '../types';
import { formatMoney, formatNumber, normalizePaisName } from '../utils';
import DateRangePicker from './DateRangePicker';

interface CobrosViewProps {
    kommoData: KommoLead[];
}

const CobrosView: React.FC<CobrosViewProps> = ({ kommoData }) => {
    // --- SOLUCIÓN NUCLEAR PARA IDS ---
    // Migramos a una nueva key 'app_cobros_data_v2' para limpiar cualquier basura de la versión anterior.
    const [cobros, setCobros] = useState<Cobro[]>(() => {
        try {
            // 1. Intentar cargar datos limpios v2
            const savedV2 = localStorage.getItem('app_cobros_data_v2');
            if (savedV2) {
                return JSON.parse(savedV2);
            }

            // 2. Si no hay v2, buscar v1 (legacy), migrar y limpiar
            const savedLegacy = localStorage.getItem('app_cobros_data');
            if (savedLegacy) {
                const parsed = JSON.parse(savedLegacy);
                if (Array.isArray(parsed)) {
                    const migrated = parsed.map((item: any, index: number) => ({
                        ...item,
                        // Generar ID completamente nuevo y único para asegurar que el borrado funcione
                        id: `id-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
                        monto: Number(item.monto) || 0,
                        tasa: Number(item.tasa) || 0,
                        usd: Number(item.usd) || 0
                    }));
                    console.log('Migración completada: Datos movidos a v2');
                    return migrated;
                }
            }
            return [];
        } catch (e) {
            console.error("Error cargando cobros, iniciando base limpia:", e);
            return [];
        }
    });

    // Guardar siempre en la nueva key v2
    useEffect(() => {
        localStorage.setItem('app_cobros_data_v2', JSON.stringify(cobros));
    }, [cobros]);

    // Estado para el formulario
    const [newCobro, setNewCobro] = useState<Record<string, { dateRange?: DateRange; monto?: number; tasa?: number }>>({});

    // Cálculos
    const salesByCountry = useMemo(() => {
        const totals: Record<string, number> = {};
        kommoData.forEach(lead => {
            if (lead.status_pipeline === 'CASHING') {
                const pais = normalizePaisName(lead.pais) || 'Desconocido';
                if (!totals[pais]) totals[pais] = 0;
                totals[pais] += lead.monto;
            }
        });
        return totals;
    }, [kommoData]);

    const allCountries = useMemo(() => {
        const countries = new Set<string>();
        Object.keys(salesByCountry).forEach(c => countries.add(c));
        cobros.forEach(c => countries.add(c.pais));
        return Array.from(countries).sort();
    }, [salesByCountry, cobros]);

    // Actions
    const handleAddCobro = (pais: string) => {
        const entry = newCobro[pais];
        if (!entry || !entry.dateRange || !entry.monto || !entry.tasa) return;

        const formatDateStr = (d: Date) => {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };

        const newItem: Cobro = {
            id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            pais: pais,
            fecha: formatDateStr(entry.dateRange.start),
            fechaFin: formatDateStr(entry.dateRange.end),
            monto: Number(entry.monto),
            tasa: Number(entry.tasa),
            usd: Number(entry.monto) / Number(entry.tasa)
        };

        setCobros(prev => [newItem, ...prev]);
        setNewCobro(prev => ({ ...prev, [pais]: { monto: 0, tasa: 0, dateRange: undefined } }));
    };

    const handleDeleteCobro = (idToDelete: string) => {
        // Confirmación simple
        if (!window.confirm('¿Borrar este cobro?')) return;
        
        // Actualización inmutable
        setCobros(prev => prev.filter(c => c.id !== idToDelete));
    };

    const updateNewCobro = (pais: string, field: 'monto' | 'tasa' | 'dateRange', value: any) => {
        setNewCobro(prev => ({
            ...prev,
            [pais]: { ...prev[pais], [field]: value }
        }));
    };

    const formatCobroDate = (c: Cobro) => {
        const d1 = formatDateShort(c.fecha);
        const d2 = c.fechaFin ? formatDateShort(c.fechaFin) : '';
        if (d2 && d2 !== d1) return `${d1} - ${d2}`;
        return d1;
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Gestión de Cobros</h2>
                    <p className="text-slate-500 mt-1">Control de bajada de dinero y saldos pendientes por país.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {allCountries.map(pais => {
                    const countrySales = salesByCountry[pais] || 0;
                    const countryCobros = cobros.filter(c => c.pais === pais).sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
                    const totalBajado = countryCobros.reduce((sum, c) => sum + c.monto, 0);
                    const pendiente = countrySales - totalBajado;
                    
                    const entry = newCobro[pais] || {};

                    return (
                        <div key={pais} className="glass-card rounded-2xl flex flex-col border border-white/5 bg-[#0f1115]">
                            {/* Header */}
                            <div className="bg-[#161b22] border-b border-white/5 p-4 flex items-center justify-between rounded-t-2xl">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-xl">public</span>
                                    {pais}
                                </h3>
                                <span className="text-[10px] font-bold bg-[#262b36] px-2 py-1 rounded text-slate-400 border border-white/5">
                                    {getCurrencyCode(pais)}
                                </span>
                            </div>

                            {/* KPIs */}
                            <div className="p-5 space-y-3 border-b border-white/5 bg-[#0f1115]">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-500">Tenemos (Facturado)</span>
                                    <span className="text-sm font-bold text-slate-200">{formatMoney(countrySales).replace('USD', '')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-500">Bajado (Cobrado)</span>
                                    <span className="text-sm font-bold text-neon-green">{formatMoney(totalBajado).replace('USD', '')}</span>
                                </div>
                                <div className="h-px bg-white/5 my-2"></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-300">Pendiente</span>
                                    <span className={`text-xl font-bold ${pendiente > 0 ? 'text-yellow-500' : 'text-slate-500'}`}>
                                        {formatMoney(pendiente).replace('USD', '')}
                                    </span>
                                </div>
                            </div>

                            {/* Tabla */}
                            <div className="flex-1 overflow-y-auto max-h-[250px] custom-scrollbar bg-[#0a0c10]">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="text-slate-500 font-semibold bg-[#11141a] sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-white/5 bg-[#11141a]">Fecha / Periodo</th>
                                            <th className="px-4 py-3 text-right border-b border-white/5 bg-[#11141a]">Monto</th>
                                            <th className="px-4 py-3 text-right border-b border-white/5 bg-[#11141a]">Tasa</th>
                                            <th className="px-4 py-3 text-right border-b border-white/5 bg-[#11141a]">USD</th>
                                            <th className="w-10 border-b border-white/5 bg-[#11141a]"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {countryCobros.map((cobro) => (
                                            <tr key={cobro.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 text-slate-400 font-medium whitespace-nowrap">{formatCobroDate(cobro)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-200 decoration-slate-600 line-through decoration-1 opacity-80">{formatNumber(cobro.monto)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-500">{formatNumber(cobro.tasa)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-400">${formatNumber(cobro.usd)}</td>
                                                <td className="px-1 text-center">
                                                    {/* BOTÓN SIMPLIFICADO Y DIRECTO */}
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleDeleteCobro(cobro.id)}
                                                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all mx-auto cursor-pointer"
                                                        title="Eliminar"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {countryCobros.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-slate-600 italic">Sin cobros registrados</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer Input */}
                            <div className="p-4 bg-[#11141a] border-t border-white/5 rounded-b-2xl">
                                <div className="flex flex-col gap-3 mb-3">
                                    <div className="w-full relative z-30">
                                        <DateRangePicker 
                                            value={entry.dateRange} 
                                            onChange={(range) => updateNewCobro(pais, 'dateRange', range)}
                                            align="left"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input 
                                            type="number" 
                                            placeholder="Monto" 
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/50 transition-all placeholder:text-slate-600"
                                            value={entry.monto || ''}
                                            onChange={(e) => updateNewCobro(pais, 'monto', parseFloat(e.target.value))}
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Tasa" 
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/50 transition-all placeholder:text-slate-600"
                                            value={entry.tasa || ''}
                                            onChange={(e) => updateNewCobro(pais, 'tasa', parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => handleAddCobro(pais)}
                                    disabled={!entry.dateRange || !entry.monto || !entry.tasa}
                                    className="w-full bg-[#1e293b] hover:bg-primary hover:text-white text-primary border border-white/5 hover:border-primary/50 text-xs font-bold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg"
                                >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Agregar Cobro
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
};

const getCurrencyCode = (pais: string) => {
    const map: Record<string, string> = {
        'Colombia': 'COP', 'Chile': 'CLP', 'Mexico': 'MXN', 'Peru': 'PEN', 'Argentina': 'ARS', 'Venezuela': 'VES'
    };
    return map[pais] || 'USD';
};

export default CobrosView;
