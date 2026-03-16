
import React, { useState, useMemo, useEffect } from 'react';
import { FacebookRow, KommoLead, ExchangeRates, GlobalFilters } from '../types';
import { normalizePaisName, normalizeProductoName, cleanAndNormalizeSource, formatMoney, formatNumber, getMonedaByPais, formatDate, maskString, getDateRange } from '../utils';
import { DataService } from '../services/dataService';
import DateRangePicker from './DateRangePicker';
import MultiSelect from './MultiSelect';

interface StrategyAuditViewProps {
    facebookData: FacebookRow[];
    kommoData: KommoLead[];
    exchangeRates: ExchangeRates;
    filters: GlobalFilters['dashboard'];
    onAskJuan?: (context: string) => void;
    onAddTask?: (taskData: any) => void;
}

interface RowData {
    id: string;
    pais: string;
    prod: string;
    fuente: string;
    pc: string;
    spend: number;
    messages: number;
    leads: number;
    sales: number;
    revenue: number;
    profit: number; 
    roas: number;
    cpl: number;
    conversion: number;
    semaphore: string;
}

const STATUS_OPTIONS = [
    { value: 'SCALING', label: '🚀 Scaling', color: 'text-neon-green border-neon-green/30 bg-neon-green/10' },
    { value: 'STABLE', label: '⚖️ Stable', color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' },
    { value: 'OBSERVING', label: '👀 Observing', color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' },
    { value: 'OPTIMIZING', label: '🛠️ Optimizing', color: 'text-purple-400 border-purple-400/30 bg-purple-400/10' },
    { value: 'STOPPED', label: '🛑 Stopped', color: 'text-red-500 border-red-500/30 bg-red-500/10' },
];

const COUNTRY_ABBR: Record<string, string> = {
    'Argentina': 'ARG', 'Bolivia': 'BOL', 'Chile': 'CHL', 'Colombia': 'COL',
    'Costa Rica': 'CRI', 'Ecuador': 'ECU', 'España': 'ESP', 'Guatemala': 'GTM',
    'Honduras': 'HND', 'México': 'MEX', 'Panamá': 'PAN', 'Paraguay': 'PRY',
    'Perú': 'PER', 'República Dominicana': 'DOM', 'Uruguay': 'URY', 'Venezuela': 'VEN',
    'Estados Unidos': 'USA', 'Otros': 'OTR'
};

const StrategyRow: React.FC<any> = ({ row, rowState, reviewedItems, onToggleReview, onStatusChange, onNoteSave, onAskJuan, onAddTask }) => {
    const currentState = rowState[row.id] || { status: 'OBSERVING', notes: '' };
    const isChecked = reviewedItems.has(row.id);
    const [localNote, setLocalNote] = useState(currentState.notes);
    const [justSavedTask, setJustSavedTask] = useState(false);

    useEffect(() => setLocalNote(currentState.notes), [currentState.notes]);

    const handleCreateTask = () => {
        if (!localNote.trim()) return;
        if (onAddTask) {
            onAddTask({
                description: localNote,
                context: {
                    rowId: row.id,
                    pais: row.pais,
                    producto: row.prod,
                    fuente: row.fuente,
                    pc: row.pc
                }
            });
            setJustSavedTask(true);
            setTimeout(() => setJustSavedTask(false), 2000);
            if (localNote !== currentState.notes) onNoteSave(row.id, localNote);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            onNoteSave(row.id, localNote);
            e.currentTarget.blur();
            e.currentTarget.classList.add('bg-neon-green/10', 'text-neon-green');
            setTimeout(() => e.currentTarget.classList.remove('bg-neon-green/10', 'text-neon-green'), 500);
        }
    };

    const triggerAi = () => {
        if (onAskJuan) {
            const context = JSON.stringify({
                strategy: "Individual Granular Row Analysis",
                country: row.pais,
                product: row.prod,
                source: row.fuente,
                keyword: row.pc,
                metrics: { spend: row.spend, revenue: row.revenue, profit: row.profit, roas: row.roas, leads: row.leads, sales: row.sales, cost_per_lead: row.cpl },
                current_status: currentState.status,
                user_notes: currentState.notes
            }, null, 2);
            onAskJuan(context);
        }
    };

    return (
        <div className={`grid grid-cols-[40px_1.5fr_1fr_1fr_1fr_2fr_30px_30px] gap-2 px-4 py-3 border-b border-white/5 items-center hover:bg-white/5 transition-all ${isChecked ? 'opacity-50' : ''}`}>
            <div className="flex justify-center">
                <input type="checkbox" checked={isChecked} onChange={() => onToggleReview(row.id)} className="size-4 rounded border-slate-600 bg-slate-800 checked:bg-primary" />
            </div>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">{row.pais.substring(0,3).toUpperCase()}</span>
                    <span className={`text-xs font-black font-mono px-1.5 py-0.5 rounded border ${row.pc === 'Sin PC' ? 'text-red-500 border-red-500/20' : 'text-yellow-500 border-yellow-500/20'}`}>{row.pc}</span>
                </div>
            </div>
            <div className="text-right flex flex-col justify-center text-[10px]">
                <span className="text-slate-400">Spend: <span className="text-slate-200">${formatNumber(row.spend)}</span></span>
                <span className="text-slate-400">Rev: <span className="text-neon-green">${formatNumber(row.revenue)}</span></span>
                <span className="text-slate-400">Profit: <span className={row.profit >= 0 ? 'text-neon-green' : 'text-red-500'}>${formatNumber(row.profit)}</span></span>
                <span className="font-bold text-slate-300">ROAS: {formatNumber(row.roas)}x</span>
            </div>
            <div>
                <select value={currentState.status} onChange={(e) => onStatusChange(row.id, e.target.value)} className={`w-full text-[9px] font-bold py-1 px-1 rounded border bg-transparent outline-none cursor-pointer ${STATUS_OPTIONS.find(o => o.value === currentState.status)?.color}`}>
                    {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-surface-dark text-white">{opt.label}</option>)}
                </select>
            </div>
            <div className="flex justify-center">
                    <div className={`size-3 rounded-full ${row.semaphore === 'red' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : row.semaphore === 'green' ? 'bg-neon-green shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500'}`}></div>
            </div>
            <div className="relative">
                <input type="text" value={localNote} onChange={(e) => setLocalNote(e.target.value)} onKeyDown={handleKeyDown} onBlur={() => { if(localNote !== currentState.notes) onNoteSave(row.id, localNote); }} placeholder="Note..." className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-[10px] text-slate-300 focus:border-primary/50 outline-none transition-all placeholder:text-slate-600" />
            </div>
            <button onClick={handleCreateTask} className={`p-1 rounded transition-colors ${justSavedTask ? 'bg-neon-green text-black' : 'hover:bg-primary/20 text-slate-500 hover:text-primary'}`} title="Create Task from Note">
                <span className="material-symbols-outlined text-lg">{justSavedTask ? 'check' : 'add_task'}</span>
            </button>
            <button onClick={triggerAi} className="p-1 hover:bg-purple-500/20 rounded text-slate-500 hover:text-purple-400 transition-colors" title="Analyze with PECAS Bot">
                <span className="material-symbols-outlined text-lg">psychology</span>
            </button>
        </div>
    );
};

const RoasHeatmapCell: React.FC<{ roas: number; spend: number }> = ({ roas, spend }) => {
    let bgColor = 'bg-transparent';
    let textColor = 'text-slate-500';
    let label = '-';

    if (spend > 0 || roas > 0) {
        label = formatNumber(roas);
        if (spend > 0 && roas === 0) { bgColor = 'bg-red-500/20'; textColor = 'text-red-500 font-bold'; } 
        else if (roas < 1) { bgColor = 'bg-red-500/20'; textColor = 'text-red-400'; } 
        else if (roas < 1.8) { bgColor = 'bg-yellow-500/10'; textColor = 'text-yellow-500'; } 
        else if (roas >= 1.8 && roas < 3) { bgColor = 'bg-neon-green/10'; textColor = 'text-neon-green font-bold'; } 
        else if (roas >= 3) { bgColor = 'bg-neon-green/30'; textColor = 'text-neon-green font-black'; }
    }
    return <div className={`flex items-center justify-center h-full w-full py-2 text-[11px] ${bgColor} ${textColor} border-r border-b border-white/5`}>{label}</div>;
};

const StrategyAuditView: React.FC<StrategyAuditViewProps> = ({ facebookData, kommoData, exchangeRates, onAskJuan, onAddTask }) => {
    // --- STATE MANAGEMENT WITH PERSISTENCE ---
    
    // View Mode
    const [viewMode, setViewMode] = useState<'hierarchy' | 'heatmap'>(() => {
        return localStorage.getItem('audit_view_mode') as any || 'heatmap';
    });
    useEffect(() => localStorage.setItem('audit_view_mode', viewMode), [viewMode]);

    // Mask Data
    const [isMasked, setIsMasked] = useState(() => localStorage.getItem('audit_is_masked') === 'true');
    useEffect(() => localStorage.setItem('audit_is_masked', String(isMasked)), [isMasked]);
    
    // Date Range (Defaults to This Month, not persisted as per usual UX to see fresh data, but logic exists if needed)
    // We keep date range volatile for safety, but filters below are persisted.
    const [dateRange, setDateRange] = useState(() => getDateRange('thisMonth'));
    
    // Elite Filter (Persisted)
    const [filterElite, setFilterElite] = useState<string[]>(() => {
        const saved = localStorage.getItem('audit_filter_elite');
        return saved ? JSON.parse(saved) : ['PECAS'];
    });
    useEffect(() => localStorage.setItem('audit_filter_elite', JSON.stringify(filterElite)), [filterElite]);

    const elitesList = ['PECAS', 'LASMEJORES', 'PLAYITA'];

    // Reviewed / Checks
    const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());
    const todayKey = new Date().toISOString().split('T')[0];

    // Show Archived (Persisted)
    const [showArchived, setShowArchived] = useState(() => localStorage.getItem('audit_show_archived') === 'true');
    useEffect(() => localStorage.setItem('audit_show_archived', String(showArchived)), [showArchived]);

    const [archivedKeys, setArchivedKeys] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('audit_archived_items');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    const toggleArchive = (key: string) => {
        setArchivedKeys(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
            localStorage.setItem('audit_archived_items', JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    };

    useEffect(() => {
        const saved = localStorage.getItem(`audit_checks_${todayKey}`);
        if (saved) setReviewedItems(new Set(JSON.parse(saved)));
        else Object.keys(localStorage).forEach(key => { if (key.startsWith('audit_checks_') && key !== `audit_checks_${todayKey}`) localStorage.removeItem(key); });
    }, [todayKey]);

    const toggleReview = (id: string) => {
        const newSet = new Set(reviewedItems);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setReviewedItems(newSet);
        localStorage.setItem(`audit_checks_${todayKey}`, JSON.stringify(Array.from(newSet)));
    };

    const [rowState, setRowState] = useState<Record<string, { status: string; notes: string }>>(() => {
        const saved = localStorage.getItem('audit_strategies_state');
        return saved ? JSON.parse(saved) : {};
    });

    const [historyLog, setHistoryLog] = useState<any[]>(() => {
        const saved = localStorage.getItem('audit_history_log');
        return saved ? JSON.parse(saved) : [];
    });
    const [showHistory, setShowHistory] = useState(false);

    // --- EXPANDED STATES PERSISTENCE ---
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('audit_expanded_products') || '[]')));
    const [expandedSources, setExpandedSources] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('audit_expanded_sources') || '[]')));
    const [expandedCountries, setExpandedCountries] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('audit_expanded_countries') || '[]')));

    // Persist expanded states effects
    useEffect(() => localStorage.setItem('audit_expanded_products', JSON.stringify(Array.from(expandedProducts))), [expandedProducts]);
    useEffect(() => localStorage.setItem('audit_expanded_sources', JSON.stringify(Array.from(expandedSources))), [expandedSources]);
    useEffect(() => localStorage.setItem('audit_expanded_countries', JSON.stringify(Array.from(expandedCountries))), [expandedCountries]);

    const toggleProduct = (prod: string) => { const newSet = new Set(expandedProducts); if (newSet.has(prod)) newSet.delete(prod); else newSet.add(prod); setExpandedProducts(newSet); };
    const toggleSource = (key: string) => { const newSet = new Set(expandedSources); if (newSet.has(key)) newSet.delete(key); else newSet.add(key); setExpandedSources(newSet); };
    const toggleCountry = (key: string) => { const newSet = new Set(expandedCountries); if (newSet.has(key)) newSet.delete(key); else newSet.add(key); setExpandedCountries(newSet); };

    // --- LOGIC: PROCESS & GROUP DATA ---

    const { tree, totals, heatmapData } = useMemo(() => {
        const groups: Record<string, RowData> = {};
        const getKey = (pais: string, prod: string, fuente: string, pc: string) => `${pais}|||${prod}|||${fuente}|||${pc}`;
        const getLocalDateStr = (date: Date) => { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; };
        const rangeStartStr = getLocalDateStr(dateRange.start);
        const rangeEndStr = getLocalDateStr(dateRange.end);
        const heatmapRaw: Record<string, Record<string, Record<string, { spend: number, rev: number }>>> = {};
        const allDates = new Set<string>();

        // FILTER CHECK HELPERS
        const checkElite = (val: string | undefined) => filterElite.length === 0 || filterElite.includes(val || '');

        // Process FB
        facebookData.forEach(row => {
            if (row.dateObj < dateRange.start || row.dateObj > dateRange.end) return;
            if (!checkElite(row.ELITE)) return; // FILTER

            const pais = normalizePaisName(row.parsed_pais) || 'Desconocido';
            const prod = normalizeProductoName(row.parsed_producto) || 'General';
            const fuente = cleanAndNormalizeSource(row.parsed_fuente);
            const pc = row.parsed_palabra_clave || 'Sin PC';
            
            const key = getKey(pais, prod, fuente, pc);
            if (!groups[key]) groups[key] = { id: key, pais, prod, fuente, pc, spend: 0, messages: 0, leads: 0, sales: 0, revenue: 0, profit: 0, roas: 0, cpl: 0, conversion: 0, semaphore: 'yellow' };
            groups[key].spend += (row['USD REAL'] || 0);
            groups[key].messages += (row['Messaging Conversations Started'] || 0);

            const dateStr = getLocalDateStr(row.dateObj);
            allDates.add(dateStr);
            if(!heatmapRaw[prod]) heatmapRaw[prod] = {};
            if(!heatmapRaw[prod][dateStr]) heatmapRaw[prod][dateStr] = {};
            if(!heatmapRaw[prod][dateStr][pais]) heatmapRaw[prod][dateStr][pais] = { spend: 0, rev: 0 };
            heatmapRaw[prod][dateStr][pais].spend += (row['USD REAL'] || 0);
        });

        // Process Kommo
        kommoData.forEach(lead => {
            if (!checkElite(lead.ELITE)) return; // FILTER

            const created = new Date(lead['Creado en']);
            const closed = new Date(lead['Cerrado en']);
            const isCashing = lead.status_pipeline === 'CASHING';
            const isCreatedInRange = created >= dateRange.start && created <= dateRange.end;
            const isClosedInRange = isCashing && closed >= dateRange.start && closed <= dateRange.end;

            if (!isCreatedInRange && !isClosedInRange) return;

            const pais = normalizePaisName(lead.pais) || 'Desconocido';
            const prod = normalizeProductoName(lead.producto) || 'General';
            const fuente = cleanAndNormalizeSource(lead.Fuente || lead.fuente_normalizada);
            const pc = lead['Palabras Claves'] || 'Sin PC';
            
            const key = getKey(pais, prod, fuente, pc);
            if (!groups[key]) groups[key] = { id: key, pais, prod, fuente, pc, spend: 0, messages: 0, leads: 0, sales: 0, revenue: 0, profit: 0, roas: 0, cpl: 0, conversion: 0, semaphore: 'yellow' };
            if (isCreatedInRange) groups[key].leads++;
            if (isClosedInRange) {
                groups[key].sales++;
                const tasa = DataService.getRateForDate(exchangeRates, getMonedaByPais(lead.pais), closed);
                const revenueUSD = lead.monto / tasa;
                groups[key].revenue += revenueUSD;
                
                const dateStr = getLocalDateStr(closed);
                if (dateStr >= rangeStartStr && dateStr <= rangeEndStr) {
                    allDates.add(dateStr);
                    if(!heatmapRaw[prod]) heatmapRaw[prod] = {};
                    if(!heatmapRaw[prod][dateStr]) heatmapRaw[prod][dateStr] = {};
                    if(!heatmapRaw[prod][dateStr][pais]) heatmapRaw[prod][dateStr][pais] = { spend: 0, rev: 0 };
                    heatmapRaw[prod][dateStr][pais].rev += revenueUSD;
                }
            }
        });

        // Build Tree and Heatmap Processed... (Logic remains same as previous but using filtered groups)
        const productTree: Record<string, any> = {};
        const grandTotals = { spend: 0, revenue: 0, profit: 0, sales: 0 };

        Object.values(groups).forEach(row => {
            if (row.spend === 0 && row.sales === 0) return;
            row.profit = row.revenue - row.spend;
            row.roas = row.spend > 0 ? row.revenue / row.spend : 0;
            row.cpl = row.leads > 0 ? row.spend / row.leads : 0;
            row.conversion = row.messages > 0 ? (row.sales / row.messages) * 100 : 0;
            if (row.spend > 20 && row.sales === 0) row.semaphore = 'red';
            else if (row.roas < 1) row.semaphore = 'red';
            else if (row.roas >= 2) row.semaphore = 'green';
            else row.semaphore = 'yellow';

            if (!productTree[row.prod]) productTree[row.prod] = { metrics: { spend: 0, revenue: 0, profit: 0, sales: 0 }, sources: {} };
            const pNode = productTree[row.prod];
            pNode.metrics.spend += row.spend;
            pNode.metrics.revenue += row.revenue;
            pNode.metrics.profit += row.profit;
            pNode.metrics.sales += row.sales;

            if (!pNode.sources[row.fuente]) pNode.sources[row.fuente] = { metrics: { spend: 0, revenue: 0, profit: 0, sales: 0 }, countries: {} };
            const sNode = pNode.sources[row.fuente];
            sNode.metrics.spend += row.spend;
            sNode.metrics.revenue += row.revenue;
            sNode.metrics.profit += row.profit;
            sNode.metrics.sales += row.sales;

            if (!sNode.countries[row.pais]) sNode.countries[row.pais] = { metrics: { spend: 0, revenue: 0, profit: 0, sales: 0 }, items: [] };
            const cNode = sNode.countries[row.pais];
            cNode.metrics.spend += row.spend;
            cNode.metrics.revenue += row.revenue;
            cNode.metrics.profit += row.profit;
            cNode.metrics.sales += row.sales;

            cNode.items.push(row);
            grandTotals.spend += row.spend;
            grandTotals.revenue += row.revenue;
            grandTotals.profit += row.profit;
            grandTotals.sales += row.sales;
        });

        const sortedDates = Array.from(allDates).sort();
        const heatmapProcessed = Object.keys(heatmapRaw).map(prod => {
            const countriesSet = new Set<string>();
            Object.values(heatmapRaw[prod]).forEach(dayData => {
                Object.keys(dayData).forEach(c => countriesSet.add(c));
            });
            const countries = Array.from(countriesSet).sort();
            return { product: prod, countries, dates: sortedDates, data: heatmapRaw[prod] };
        }).sort((a,b) => a.product.localeCompare(b.product));

        return { tree: productTree, totals: grandTotals, heatmapData: heatmapProcessed };
    }, [facebookData, kommoData, dateRange, exchangeRates, filterElite]);

    const saveChange = (id: string, type: 'STATUS' | 'NOTE', oldValue: string, newValue: string, details: string) => {
        if (oldValue === newValue) return;
        const logEntry = { id: Date.now().toString() + Math.random().toString().slice(2), targetId: id, timestamp: new Date().toISOString(), type, oldValue, newValue, details };
        setHistoryLog(prev => { const updated = [logEntry, ...prev]; localStorage.setItem('audit_history_log', JSON.stringify(updated)); return updated; });
    };

    const handleStatusChange = (id: string, newStatus: string) => {
        const current = rowState[id] || { status: 'OBSERVING', notes: '' };
        saveChange(id, 'STATUS', current.status, newStatus, `Status changed from ${current.status} to ${newStatus}`);
        setRowState(prev => { const newState = { ...prev, [id]: { ...current, status: newStatus } }; localStorage.setItem('audit_strategies_state', JSON.stringify(newState)); return newState; });
    };

    const handleNoteSave = (id: string, newNote: string) => {
        const current = rowState[id] || { status: 'OBSERVING', notes: '' };
        saveChange(id, 'NOTE', current.notes, newNote, `Note updated: "${newNote}"`);
        setRowState(prev => { const newState = { ...prev, [id]: { ...current, notes: newNote } }; localStorage.setItem('audit_strategies_state', JSON.stringify(newState)); return newState; });
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20 relative">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">Strategy Audit</h2>
                    <p className="text-slate-500 mt-1">Deep dive into ROAS and Performance</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                     <MultiSelect placeholder="ELITE" options={elitesList} selected={filterElite} onChange={setFilterElite} icon="star" align="left" />
                     <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                        <button onClick={() => setViewMode('hierarchy')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'hierarchy' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Hierarchy</button>
                        <button onClick={() => setViewMode('heatmap')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'heatmap' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Heatmaps</button>
                    </div>
                    <button onClick={() => setShowArchived(!showArchived)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${showArchived ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined text-sm">{showArchived ? 'visibility' : 'archive'}</span> {showArchived ? 'Show Active' : 'Show Archived'}</button>
                    <button onClick={() => setIsMasked(!isMasked)} className={`p-2 rounded-xl border transition-all ${isMasked ? 'bg-primary text-white border-primary' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined text-sm">{isMasked ? 'visibility_off' : 'visibility'}</span></button>
                    <div className="glass-card p-2 rounded-2xl flex items-center gap-4 relative z-30">
                        <div className="flex gap-4 px-4 border-r border-white/10">
                            <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-500 font-bold">Total Spend</span><span className="text-sm font-bold text-white">{formatMoney(totals.spend)}</span></div>
                            <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-500 font-bold">Total Rev</span><span className="text-sm font-bold text-neon-green">{formatMoney(totals.revenue)}</span></div>
                        </div>
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                    </div>
                </div>
            </div>

            {viewMode === 'heatmap' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {heatmapData.length === 0 && <div className="col-span-full py-20 text-center text-slate-500"><span className="material-symbols-outlined text-4xl mb-2">grid_off</span><p>No heatmap data for this period.</p></div>}
                    {heatmapData.map((matrix) => {
                        const isProdArchived = archivedKeys.has(`PROD::${matrix.product}`);
                        const prodKey = `PROD::${matrix.product}`;
                        const visibleCountries = matrix.countries.filter(c => {
                            const cKey = `COUNTRY::${matrix.product}::${c}`;
                            const isCArchived = archivedKeys.has(cKey);
                            if (showArchived) { if (isProdArchived) return true; return isCArchived; } else { return !isCArchived; }
                        });
                        if (!showArchived && isProdArchived) return null;
                        if (showArchived && !isProdArchived && visibleCountries.length === 0) return null;
                        if (visibleCountries.length === 0) return null;

                        return (
                            <div key={matrix.product} className="glass-card rounded-2xl overflow-hidden border border-white/5 flex flex-col">
                                <div className="bg-white/5 p-4 border-b border-white/5 flex justify-between items-center">
                                    <h3 className="text-white font-bold text-sm uppercase tracking-wide border-l-4 border-primary pl-3 flex items-center gap-2">
                                        {isMasked ? maskString(matrix.product) : matrix.product}
                                        {isProdArchived && <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase">Archived</span>}
                                    </h3>
                                    <button onClick={() => toggleArchive(prodKey)} className={`p-1.5 rounded-lg transition-all ${isProdArchived ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20' : 'text-slate-500 hover:text-white hover:bg-white/10'}`} title={isProdArchived ? "Unarchive Product" : "Archive Product"}><span className="material-symbols-outlined text-sm">{isProdArchived ? 'unarchive' : 'archive'}</span></button>
                                </div>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <div className="inline-block min-w-full align-middle">
                                        <table className="min-w-full divide-y divide-white/5">
                                            <thead className="bg-[#161b22]">
                                                <tr>
                                                    <th scope="col" className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky left-0 bg-[#161b22] z-10 border-r border-white/10">Fecha</th>
                                                    {visibleCountries.map(c => {
                                                        const cKey = `COUNTRY::${matrix.product}::${c}`;
                                                        const isCArchived = archivedKeys.has(cKey);
                                                        return (
                                                            <th key={c} scope="col" className="px-1 py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider border-r border-white/5 w-16 group relative">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span>{COUNTRY_ABBR[c] || c.substring(0,3).toUpperCase()}</span>
                                                                    <button onClick={() => toggleArchive(cKey)} className={`p-0.5 rounded transition-all opacity-0 group-hover:opacity-100 ${isCArchived ? 'opacity-100 text-yellow-500' : 'text-slate-600 hover:text-white'}`}><span className="material-symbols-outlined text-[10px]">{isCArchived ? 'unarchive' : 'archive'}</span></button>
                                                                </div>
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 bg-[#0a0c10]">
                                                {matrix.dates.map(date => (
                                                    <tr key={date}>
                                                        <td className="px-3 py-2 whitespace-nowrap text-[10px] font-mono text-slate-400 sticky left-0 bg-[#0a0c10] z-10 border-r border-white/10">{date.split('-').reverse().slice(0,2).join('/')}</td>
                                                        {visibleCountries.map(c => {
                                                            const cell = matrix.data[date]?.[c];
                                                            const spend = cell?.spend || 0;
                                                            const rev = cell?.rev || 0;
                                                            const roas = spend > 0 ? rev / spend : 0;
                                                            return <td key={c} className="p-0"><RoasHeatmapCell roas={roas} spend={spend} /></td>;
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Hierarchy View Logic Preserved */
                <div className="space-y-4">
                    {Object.keys(tree).sort().map(prod => {
                        const pNode = tree[prod];
                        const isProdArchived = archivedKeys.has(`PROD::${prod}`);
                        const prodKey = `PROD::${prod}`;
                        if (!showArchived && isProdArchived) return null;
                        const isProdExpanded = expandedProducts.has(prod);
                        const pRoas = pNode.metrics.spend > 0 ? pNode.metrics.revenue / pNode.metrics.spend : 0;

                        return (
                            <div key={prod} className="glass-card rounded-2xl overflow-hidden border border-white/5 transition-all">
                                <div className={`p-4 flex items-center justify-between transition-colors ${isProdExpanded ? 'bg-primary/10 border-b border-primary/20' : 'hover:bg-white/5 bg-[#161b22]'}`}>
                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleProduct(prod)}>
                                        <span className={`material-symbols-outlined transition-transform ${isProdExpanded ? 'rotate-90 text-primary' : 'text-slate-500'}`}>chevron_right</span>
                                        <div>
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                {isMasked ? maskString(prod) : prod}
                                                <span className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">{Object.keys(pNode.sources).length} Sources</span>
                                                {isProdArchived && <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase">Archived</span>}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 text-right">
                                        <div className="hidden md:block"><p className="text-[10px] text-slate-500 font-bold uppercase">Spend</p><p className="text-sm font-bold text-slate-200">{formatMoney(pNode.metrics.spend)}</p></div>
                                        <div className="hidden md:block"><p className="text-[10px] text-slate-500 font-bold uppercase">Revenue</p><p className="text-sm font-bold text-neon-green">{formatMoney(pNode.metrics.revenue)}</p></div>
                                        <div className="hidden md:block"><p className="text-[10px] text-slate-500 font-bold uppercase">Profit</p><p className={`text-sm font-bold ${pNode.metrics.profit >= 0 ? 'text-neon-green' : 'text-red-500'}`}>{formatMoney(pNode.metrics.profit)}</p></div>
                                        <div className="hidden md:block"><p className="text-[10px] text-slate-500 font-bold uppercase">ROAS</p><p className={`text-sm font-bold ${pRoas >= 2 ? 'text-neon-green' : pRoas < 1 ? 'text-red-500' : 'text-slate-300'}`}>{formatNumber(pRoas)}x</p></div>
                                        <button onClick={(e) => { e.stopPropagation(); toggleArchive(prodKey); }} className={`p-2 rounded-lg transition-all ${isProdArchived ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}><span className="material-symbols-outlined">{isProdArchived ? 'unarchive' : 'archive'}</span></button>
                                    </div>
                                </div>
                                {isProdExpanded && (
                                    <div className="bg-[#0a0c10]">
                                        {Object.keys(pNode.sources).sort().map(fuente => {
                                            const sNode = pNode.sources[fuente];
                                            const sourceKey = `${prod}|${fuente}`;
                                            const isSourceExpanded = expandedSources.has(sourceKey);
                                            const sRoas = sNode.metrics.spend > 0 ? sNode.metrics.revenue / sNode.metrics.spend : 0;
                                            const validCountries = Object.keys(sNode.countries).filter(pais => {
                                                const cKey = `COUNTRY::${prod}::${pais}`;
                                                const isCArchived = archivedKeys.has(cKey);
                                                if (showArchived) { if (isProdArchived) return true; return isCArchived; } else { return !isCArchived; }
                                            });
                                            if (validCountries.length === 0) return null;

                                            return (
                                                <div key={fuente} className="border-b border-white/5 last:border-0">
                                                    <div onClick={() => toggleSource(sourceKey)} className="px-4 py-3 pl-10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
                                                        <div className="flex items-center gap-3"><span className={`material-symbols-outlined text-sm transition-transform ${isSourceExpanded ? 'rotate-90 text-slate-300' : 'text-slate-600'}`}>chevron_right</span><span className="text-xs font-bold text-slate-300 flex items-center gap-2">{fuente}<span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">{validCountries.length} Countries</span></span></div>
                                                        <div className="flex gap-4 text-xs font-mono text-slate-500"><span>Spend: ${formatNumber(sNode.metrics.spend)}</span><span>Rev: <span className="text-neon-green">${formatNumber(sNode.metrics.revenue)}</span></span><span className={sNode.metrics.profit >= 0 ? 'text-neon-green' : 'text-red-500'}>Profit: ${formatNumber(sNode.metrics.profit)}</span><span className={sRoas >= 2 ? 'text-neon-green' : sRoas < 1 ? 'text-red-500' : ''}>ROAS: {formatNumber(sRoas)}</span></div>
                                                    </div>
                                                    {isSourceExpanded && (
                                                        <div className="bg-[#0e1116] border-t border-white/5">
                                                            {validCountries.sort().map(pais => {
                                                                const cNode = sNode.countries[pais];
                                                                const countryKey = `${prod}|${fuente}|${pais}`;
                                                                const archiveCountryKey = `COUNTRY::${prod}::${pais}`;
                                                                const isCountryArchived = archivedKeys.has(archiveCountryKey);
                                                                const isCountryExpanded = expandedCountries.has(countryKey);
                                                                const cRoas = cNode.metrics.spend > 0 ? cNode.metrics.revenue / cNode.metrics.spend : 0;
                                                                return (
                                                                    <div key={pais} className="border-b border-white/5 last:border-0">
                                                                        <div className="px-4 py-2 pl-16 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
                                                                            <div className="flex items-center gap-3" onClick={() => toggleCountry(countryKey)}><span className={`material-symbols-outlined text-xs transition-transform ${isCountryExpanded ? 'rotate-90 text-slate-400' : 'text-slate-600'}`}>chevron_right</span><span className="text-xs font-bold text-slate-400 flex items-center gap-2">🌎 {pais}<span className="text-[9px] bg-slate-800 text-slate-600 px-1.5 py-0.5 rounded">{cNode.items.length} PCs</span>{isCountryArchived && <span className="text-[8px] bg-yellow-500/10 text-yellow-500 px-1 py-0.5 rounded uppercase">Archived</span>}</span></div>
                                                                            <div className="flex items-center gap-4"><div className="flex gap-4 text-[10px] font-mono text-slate-500"><span>Spend: ${formatNumber(cNode.metrics.spend)}</span><span>Rev: <span className="text-neon-green">${formatNumber(cNode.metrics.revenue)}</span></span><span className={cNode.metrics.profit >= 0 ? 'text-neon-green' : 'text-red-500'}>Profit: ${formatNumber(cNode.metrics.profit)}</span><span className={cRoas >= 2 ? 'text-neon-green' : cRoas < 1 ? 'text-red-500' : ''}>ROAS: {formatNumber(cRoas)}</span></div><button onClick={(e) => { e.stopPropagation(); toggleArchive(archiveCountryKey); }} className={`p-1 rounded hover:bg-white/10 transition-colors ${isCountryArchived ? 'text-yellow-500' : 'text-slate-600 hover:text-white'}`}><span className="material-symbols-outlined text-sm">{isCountryArchived ? 'unarchive' : 'archive'}</span></button></div>
                                                                        </div>
                                                                        {isCountryExpanded && (
                                                                            <div className="bg-[#13161c] pl-8 pb-2">
                                                                                <div className="grid grid-cols-[40px_1.5fr_1fr_1fr_1fr_2fr_30px_30px] gap-2 px-4 py-2 border-b border-white/5 text-[9px] font-bold text-slate-600 uppercase tracking-widest bg-white/5"><div className="text-center">CHK</div><div>Strategy (PC)</div><div className="text-right">Metrics</div><div className="text-center">Status</div><div className="text-center">Alert</div><div>Notes (Enter to Save)</div><div>Task</div><div>AI</div></div>
                                                                                {cNode.items.map(row => <StrategyRow key={row.id} row={row} rowState={rowState} reviewedItems={reviewedItems} onToggleReview={toggleReview} onStatusChange={handleStatusChange} onNoteSave={handleNoteSave} onAskJuan={onAskJuan} onAddTask={onAddTask} />)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl animate-fade-in border border-white/10 bg-surface-dark">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><span className="material-symbols-outlined">history</span> Change History Log</h3>
                            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                            {historyLog.length === 0 ? <div className="p-8 text-center text-slate-500 text-sm">No actions recorded yet.</div> : (
                                <table className="w-full text-left text-xs"><thead className="bg-[#161b22] text-slate-500 font-bold border-b border-white/5 sticky top-0"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Strategy</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-white/5">{historyLog.map((log) => (<tr key={log.id} className="hover:bg-white/5 transition-colors"><td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td><td className="px-4 py-3 max-w-[150px] truncate text-slate-300" title={log.targetId}>{log.targetId.split('|||')[1]} <span className="text-slate-500">|</span> {log.targetId.split('|||')[3]}</td><td className="px-4 py-3 font-bold">{log.type === 'STATUS' ? (<span className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">STATUS</span>) : (<span className="text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">NOTE</span>)}</td><td className="px-4 py-3 text-slate-300">{log.details}</td></tr>))}</tbody></table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrategyAuditView;
