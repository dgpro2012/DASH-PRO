
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { KommoLead, GlobalFilters } from '../types';
import { getDateRange, formatMoney, copyToClipboard, matchPais, matchProducto } from '../utils';
import DateRangePicker from './DateRangePicker';
import MultiSelect from './MultiSelect';

interface PipelineViewProps {
    leads: KommoLead[];
    filters: GlobalFilters['pipeline'];
    onFiltersChange: (updates: Partial<GlobalFilters['pipeline']>) => void;
}

const PipelineView: React.FC<PipelineViewProps> = ({ leads, filters, onFiltersChange }) => {
    const { filterPais, filterProducto, filterPalabrasClave, filterFuente, filterElite, dateFilterType, dateRange } = filters;
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [customDateStart, setCustomDateStart] = useState('');
    const [customDateEnd, setCustomDateEnd] = useState('');
    const filterPanelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPanelRef.current && !filterPanelRef.current.contains(event.target as Node)) {
                setShowFilterPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const paises = useMemo(() => [...new Set(leads.map(l => l.pais).filter(Boolean))].sort(), [leads]);
    const productos = useMemo(() => [...new Set(leads.map(l => l.producto).filter(Boolean))].sort(), [leads]);
    const palabrasClaveList = useMemo(() => [...new Set(leads.map(l => l['Palabras Claves']).filter(Boolean))].sort(), [leads]);
    const fuentesList = useMemo(() => [...new Set(leads.map(l => l.fuente_normalizada).filter(Boolean))].sort(), [leads]);
    const elitesList = ['PECAS', 'LASMEJORES', 'PLAYITA'];

    const parseKommoDate = (dateStr: string) => { if (!dateStr) return null; try { const date = new Date(dateStr); return isNaN(date.getTime()) ? null : date; } catch (e) { return null; } };
    const applyDatePreset = (preset: string) => { const range = getDateRange(preset); onFiltersChange({ dateRange: range }); setCustomDateStart(''); setCustomDateEnd(''); };
    const applyCustomDateRange = () => { if (customDateStart && customDateEnd) { const [sy, sm, sd] = customDateStart.split('-').map(Number); const [ey, em, ed] = customDateEnd.split('-').map(Number); const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0); const end = new Date(ey, em - 1, ed, 23, 59, 59, 999); onFiltersChange({ dateRange: { start, end, label: 'Custom' } }); } };
    const clearDateFilter = () => { onFiltersChange({ dateRange: null }); setCustomDateStart(''); setCustomDateEnd(''); };

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            if (!matchPais(lead.pais, filterPais)) return false;
            if (!matchProducto(lead.producto, filterProducto)) return false;
            if (filterPalabrasClave.length > 0 && !filterPalabrasClave.includes(lead['Palabras Claves'])) return false;
            if (filterFuente.length > 0 && !filterFuente.includes(lead.fuente_normalizada)) return false;
            if (filterElite.length > 0 && !filterElite.includes(lead.ELITE)) return false;
            const status = lead.status_pipeline;
            if (!['BASE', 'DESCUENTO', 'CASHING', 'VENTA PERDIDA'].includes(status)) return false;
            if (dateRange) {
                const dateField = dateFilterType === 'created' ? lead['Creado en'] : lead['Cerrado en'];
                if (dateFilterType === 'closed' && !dateField) return false;
                const leadDate = parseKommoDate(dateField);
                if (!leadDate) return false;
                if (leadDate < dateRange.start || leadDate > dateRange.end) return false;
            }
            return true;
        });
    }, [leads, filterPais, filterProducto, filterPalabrasClave, filterFuente, filterElite, dateRange, dateFilterType]);

    const handleCopy = (id: string) => { copyToClipboard(id); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
    
    const columns = [
        { id: 'BASE', title: 'BASE', color: 'border-blue-500' }, 
        { id: 'DESCUENTO', title: 'DESCUENTO', color: 'border-purple-500' }, 
        { id: 'CASHING', title: 'CASHING', color: 'border-neon-green' }, 
        { id: 'VENTA PERDIDA', title: 'VENTA PERDIDA', color: 'border-red-500' }
    ];
    
    const groupedLeads = useMemo(() => { const g: Record<string, KommoLead[]> = { BASE: [], DESCUENTO: [], CASHING: [], 'VENTA PERDIDA': [] }; filteredLeads.forEach(l => { const status = l.status_pipeline; if (g[status]) { g[status].push(l); } }); return g; }, [filteredLeads]);
    const activeFiltersCount = [filterPais.length > 0, filterProducto.length > 0, filterPalabrasClave.length > 0, filterFuente.length > 0, filterElite.length > 0, dateRange].filter(Boolean).length;
    const dateInputClasses = "flex-1 text-xs border border-white/10 rounded-lg p-2 bg-white/5 text-white outline-none focus:ring-1 focus:ring-primary";

    return (
        <div className="h-[calc(100vh-200px)] flex flex-col animate-fade-in">
            {/* Header de filtros con Z-Index superior */}
            <div className="glass-card p-4 rounded-xl mb-4 flex flex-wrap gap-4 items-center relative z-30">
                <div className="relative" ref={filterPanelRef}>
                    <button onClick={() => setShowFilterPanel(!showFilterPanel)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${activeFiltersCount > 0 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10'}`}>
                        <span className="material-symbols-outlined text-sm">filter_list</span>
                        Filter Leads
                        {activeFiltersCount > 0 && <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>}
                    </button>

                    {showFilterPanel && (
                        <div className="absolute left-0 top-12 w-80 glass-card rounded-xl shadow-2xl p-4 z-50 max-h-[75vh] overflow-y-auto animate-fade-in bg-surface-dark border border-white/10">
                            <h4 className="font-bold text-sm text-white mb-3 flex items-center gap-2 border-b border-white/10 pb-2">Filter Options</h4>
                            <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time Period</span>
                                    {dateRange && <button onClick={clearDateFilter} className="text-[10px] font-bold text-red-400 hover:text-white bg-red-500/10 px-1.5 py-0.5 rounded">✕ Clear</button>}
                                </div>
                                <div className="flex bg-white/5 p-1 rounded-lg mb-2.5">
                                    <button onClick={() => onFiltersChange({ dateFilterType: 'created' })} className={`flex-1 text-[11px] py-1.5 rounded-md transition-all font-bold ${dateFilterType === 'created' ? 'bg-primary text-white shadow-sm' : 'text-slate-400'}`}>Created</button>
                                    <button onClick={() => onFiltersChange({ dateFilterType: 'closed' })} className={`flex-1 text-[11px] py-1.5 rounded-md transition-all font-bold ${dateFilterType === 'closed' ? 'bg-primary text-white shadow-sm' : 'text-slate-400'}`}>Closed</button>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                                    {['today', 'yesterday', 'last7', 'thisMonth'].map(p => { const r = getDateRange(p); return <button key={p} onClick={() => applyDatePreset(p)} className={`text-[11px] font-semibold py-1.5 px-2 rounded-lg border transition-all ${dateRange?.label === r.label ? 'bg-primary border-primary text-white' : 'bg-transparent border-white/10 text-slate-400 hover:text-white'}`}>{r.label}</button>; })}
                                </div>
                                <div className="border-t border-white/10 pt-2.5 mt-2.5">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Custom Range</p>
                                    <div className="flex gap-2 mb-2"><input type="date" className={dateInputClasses} value={customDateStart} onChange={e => setCustomDateStart(e.target.value)} /><input type="date" className={dateInputClasses} value={customDateEnd} onChange={e => setCustomDateEnd(e.target.value)} /></div>
                                    <button onClick={applyCustomDateRange} disabled={!customDateStart || !customDateEnd} className="w-full text-xs font-bold py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-all">Apply Range</button>
                                </div>
                            </div>
                            <div className="space-y-3.5">
                                <MultiSelect options={paises} selected={filterPais} onChange={v => onFiltersChange({ filterPais: v })} placeholder="Select Countries" />
                                <MultiSelect options={productos} selected={filterProducto} onChange={v => onFiltersChange({ filterProducto: v })} placeholder="Select Products" />
                                <MultiSelect options={palabrasClaveList} selected={filterPalabrasClave} onChange={v => onFiltersChange({ filterPalabrasClave: v })} placeholder="Select Keywords" />
                                <MultiSelect options={fuentesList} selected={filterFuente} onChange={v => onFiltersChange({ filterFuente: v })} placeholder="Select Sources" />
                                <MultiSelect options={elitesList} selected={filterElite} onChange={v => onFiltersChange({ filterElite: v })} placeholder="Select Levels" />
                            </div>
                            {activeFiltersCount > 0 && (
                                <div className="mt-6 pt-4 border-t border-white/10">
                                    <button onClick={() => { onFiltersChange({ filterPais: [], filterProducto: [], filterPalabrasClave: [], filterFuente: [], filterElite: ['PECAS'], dateFilterType: 'created', dateRange: getDateRange('today') }); setCustomDateStart(''); setCustomDateEnd(''); }} className="w-full text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 py-2.5 rounded-xl border border-red-500/20 transition-all">Reset Filters</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                     {filterPais.length > 0 && <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-[11px] font-bold border border-primary/20">🌎 {filterPais.length}</span>}
                     {filterProducto.length > 0 && <span className="bg-neon-teal/10 text-neon-teal px-2.5 py-1 rounded-lg text-[11px] font-bold border border-neon-teal/20">📦 {filterProducto.length}</span>}
                     {dateRange && <span className="bg-slate-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5">📅 {dateRange.label} <button onClick={clearDateFilter} className="text-slate-400 hover:text-white">✕</button></span>}
                </div>
                 <div className="ml-auto flex items-center gap-2"><span className="text-xs font-bold text-slate-400 bg-white/5 px-2 py-1 rounded-lg">{filteredLeads.length} leads</span></div>
            </div>
            
            <div className="flex-1 overflow-x-auto relative z-0">
                <div className="flex gap-4 h-full min-w-[1000px] pb-2">
                    {columns.map(col => (
                        <div key={col.id} className="flex-1 min-w-[280px] flex flex-col bg-white/5 rounded-2xl border border-white/5">
                            <div className={`p-3.5 border-t-4 ${col.color} bg-white/5 rounded-t-2xl border-b border-white/5 shadow-sm`}>
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className="font-extrabold text-white text-sm tracking-tight">{col.title}</h3>
                                    <span className="bg-white/10 text-slate-300 px-2 py-0.5 rounded-full text-xs font-black">{groupedLeads[col.id].length}</span>
                                </div>
                                <p className="text-[11px] text-neon-green font-bold">Total: {formatMoney(groupedLeads[col.id].reduce((s, l) => s + l.monto, 0))}</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                {groupedLeads[col.id].map((lead, idx) => (
                                    <div key={`${lead.id}-${idx}`} className="glass-card p-3.5 rounded-xl hover:bg-white/10 transition-all group active:scale-[0.98]">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-slate-200 text-sm truncate pr-2 group-hover:text-primary transition-colors">{lead.nombre}</h4>
                                            <span className="text-xs font-black text-neon-green bg-neon-green/10 px-2 py-1 rounded-lg">{formatMoney(lead.monto)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2.5">
                                            <div onClick={() => handleCopy(lead.id)} className="text-[10px] text-slate-500 font-black font-mono flex items-center gap-1.5 cursor-pointer w-fit bg-white/5 px-1.5 py-0.5 rounded-md hover:text-white transition-colors" title="Copy ID">
                                                <span>#{lead.id}</span>
                                                {copiedId === lead.id ? <span className="text-neon-green">✓</span> : <span className="opacity-40">📋</span>}
                                            </div>
                                            {lead['Palabras Claves'] && (
                                                <div className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 ${lead['Palabras Claves'] === 'PC00' ? 'text-red-500 border-red-500/20 bg-red-500/5' : 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5'}`}>
                                                    <span className="opacity-50 text-[8px]">PC:</span>
                                                    {lead['Palabras Claves']}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-2"><span className="bg-white/5 p-1 rounded-md">📦</span><span className="truncate">{lead.producto}</span></div>
                                            <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-2"><span className="bg-white/5 p-1 rounded-md">🌎</span><span>{lead.pais}</span></div>
                                        </div>
                                    </div>
                                ))}
                                {groupedLeads[col.id].length === 0 && (
                                    <div className="h-20 flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl"><span className="text-slate-600 text-xs font-bold uppercase tracking-widest">No Data</span></div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PipelineView;
