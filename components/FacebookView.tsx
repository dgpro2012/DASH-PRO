
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FacebookRow, KommoLead, ExchangeRates, GlobalFilters, Task } from '../types';
import { FB_COLUMNS_DEF } from '../constants';
import { DataService } from '../services/dataService';
import { formatMoney, formatNumber, formatDate, getDateRange, getMonedaByPais, maskString, normalizePaisName, normalizeProductoName, extractLast4, normalizePC } from '../utils';
import DateRangePicker from './DateRangePicker';
import MultiSelect from './MultiSelect';

interface FacebookViewProps {
    data: FacebookRow[];
    kommoData: KommoLead[];
    exchangeRates: ExchangeRates;
    filters: GlobalFilters['fb'];
    onFiltersChange: (updates: Partial<GlobalFilters['fb']>) => void;
    onAddTask?: (taskData: any) => void;
    tasks?: Task[];
}

const FacebookView: React.FC<FacebookViewProps> = ({ data, kommoData, exchangeRates, filters, onFiltersChange, onAddTask, tasks = [] }) => {
    const { viewLevel, searchTags, useUsd, onlyWithDelivery, activeFilter, dateRange, selectionFilter, filterElite } = filters;
    
    const clickable = (viewLevel === 'campaign' && !activeFilter.campaign) || (viewLevel === 'adset' && !activeFilter.adset);
    
    const [inputValue, setInputValue] = useState('');
    const [selectedRows, setSelectedRows] = useState(new Set<string>());
    const [showAuditPanel, setShowAuditPanel] = useState(false);
    const [showColManager, setShowColManager] = useState(false);
    
    // --- PERSISTENT UI STATE ---
    const [maskProduct, setMaskProduct] = useState(() => localStorage.getItem('fb_mask_product') === 'true');
    useEffect(() => localStorage.setItem('fb_mask_product', String(maskProduct)), [maskProduct]);

    const [isBreakdown, setIsBreakdown] = useState(() => localStorage.getItem('fb_is_breakdown') === 'true');
    useEffect(() => localStorage.setItem('fb_is_breakdown', String(isBreakdown)), [isBreakdown]);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(() => {
        const saved = localStorage.getItem('fb_sort_config');
        return saved ? JSON.parse(saved) : null;
    });
    useEffect(() => {
        if (sortConfig) localStorage.setItem('fb_sort_config', JSON.stringify(sortConfig));
        else localStorage.removeItem('fb_sort_config');
    }, [sortConfig]);
    // ---------------------------
    
    // --- TASK MODAL STATE ---
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskNote, setTaskNote] = useState('');
    const [activeTaskRow, setActiveTaskRow] = useState<any>(null);
    const taskInputRef = useRef<HTMLTextAreaElement>(null);
    // -----------------------

    const colManagerRef = useRef<HTMLDivElement>(null);
    const elitesList = ['PECAS', 'LASMEJORES', 'PLAYITA'];

    const setViewLevel = (val: string) => onFiltersChange({ viewLevel: val });
    const setSearchTags = (val: string[]) => onFiltersChange({ searchTags: val });
    const setUseUsd = (val: boolean) => onFiltersChange({ useUsd: val });
    const setOnlyWithDelivery = (val: boolean) => onFiltersChange({ onlyWithDelivery: val });
    const setActiveFilter = (val: { campaign: string | null; adset: string | null }) => onFiltersChange({ activeFilter: val });
    const setDateRange = (val: any) => onFiltersChange({ dateRange: val });
    const setSelectionFilter = (val: string[] | null) => onFiltersChange({ selectionFilter: val });
    
    // Updated Storage Keys to v9 to force new defaults
    const [visibleCols, setVisibleCols] = useState<string[]>(() => {
        const saved = localStorage.getItem('fb_visible_cols_v9');
        return saved ? JSON.parse(saved) : FB_COLUMNS_DEF.filter(c => c.default).map(c => c.id);
    });
    const [colOrder, setColOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('fb_col_order_v9');
        return saved ? JSON.parse(saved) : FB_COLUMNS_DEF.map(c => c.id);
    });

    useEffect(() => { localStorage.setItem('fb_visible_cols_v9', JSON.stringify(visibleCols)); }, [visibleCols]);
    useEffect(() => { localStorage.setItem('fb_col_order_v9', JSON.stringify(colOrder)); }, [colOrder]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (colManagerRef.current && !colManagerRef.current.contains(event.target as Node)) {
                setShowColManager(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when modal opens
    useEffect(() => {
        if (showTaskModal && taskInputRef.current) {
            setTimeout(() => taskInputRef.current?.focus(), 100);
        }
    }, [showTaskModal]);

    // Helper: Get Local Date String (YYYY-MM-DD) preventing UTC shifts
    const getLocalDateKey = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const handleViewLevelChange = (level: string, keepActiveFilter = true) => {
        setViewLevel(level);
        if (!keepActiveFilter) setActiveFilter({ campaign: null, adset: null });
        const config = {
            'campaign': { show: 'Campaign Name', hide: ['Ad Set Name', 'Ad Name', 'Ad Set ID', 'Ad ID'] },
            'adset': { show: 'Ad Set Name', hide: ['Campaign Name', 'Ad Name', 'Campaign ID', 'Ad ID'] },
            'ad': { show: 'Ad Name', hide: ['Campaign Name', 'Ad Set Name', 'Campaign ID', 'Ad Set ID'] }
        }[level as 'campaign' | 'adset' | 'ad'];
        if (!config) return;
        let newVisible = visibleCols.filter(id => !config.hide.includes(id));
        if (!newVisible.includes(config.show)) newVisible.push(config.show);
        let newOrder = colOrder.filter(id => id !== config.show);
        newOrder.unshift(config.show);
        setVisibleCols(newVisible);
        setColOrder(newOrder);
    };

    const removeCampaignFilter = () => { setActiveFilter({ campaign: null, adset: null }); handleViewLevelChange('campaign', false); };
    const removeAdSetFilter = () => { setActiveFilter({ ...activeFilter, adset: null }); handleViewLevelChange('adset', true); };
    const handleRowClick = (type: string, name: string) => {
        if (isBreakdown) return; // Disable diving when in breakdown mode to avoid confusion
        if (type === 'campaign') { setActiveFilter({ campaign: name, adset: null }); handleViewLevelChange('adset', true); }
        else if (type === 'adset') { setActiveFilter({ campaign: activeFilter.campaign, adset: name }); handleViewLevelChange('ad', true); }
    };
    const toggleRowSelection = (rowName: string) => { setSelectedRows(prev => { const newSet = new Set(prev); if (newSet.has(rowName)) newSet.delete(rowName); else newSet.add(rowName); return newSet; }); };
    const applySelectionFilter = () => { setSelectionFilter(Array.from(selectedRows)); setSelectedRows(new Set()); };
    const clearAllFilters = () => { onFiltersChange({ searchTags: [], activeFilter: { campaign: null, adset: null }, onlyWithDelivery: false, selectionFilter: null, filterElite: ['PECAS'] }); setInputValue(''); setDateRange(getDateRange('today')); setSelectedRows(new Set()); handleViewLevelChange('campaign', false); setIsBreakdown(false); setSortConfig(null); };
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) { setSearchTags([...searchTags, inputValue.trim()]); setInputValue(''); }
        else if (e.key === 'Backspace' && !inputValue && searchTags.length > 0) setSearchTags(searchTags.slice(0, -1));
    };

    // OPEN MODAL
    const openTaskModal = (row: any) => {
        setActiveTaskRow(row);
        setTaskNote('');
        setShowTaskModal(true);
    };

    // SAVE TASK
    const confirmSaveTask = () => {
        if (!taskNote.trim() || !activeTaskRow || !onAddTask) return;

        onAddTask({
            description: taskNote,
            context: {
                rowId: activeTaskRow['Campaign ID'] || activeTaskRow['Ad Set ID'] || activeTaskRow['Ad ID'] || 'unknown',
                pais: activeTaskRow.parsed_pais || 'N/A',
                producto: activeTaskRow.parsed_producto || 'N/A',
                fuente: activeTaskRow.parsed_fuente || 'N/A',
                pc: activeTaskRow.parsed_palabra_clave || 'N/A',
                campaignName: activeTaskRow['Campaign Name'], 
                adSetName: activeTaskRow['Ad Set Name']
            }
        });

        setShowTaskModal(false);
        setActiveTaskRow(null);
        setTaskNote('');
    };

    // Sorting Handler
    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current && current.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const activeColumns = useMemo(() => colOrder.filter(id => visibleCols.includes(id)).map(id => FB_COLUMNS_DEF.find(c => c.id === id)).filter(Boolean) as any[], [visibleCols, colOrder]);

    const { tableRows, unassignedLeads } = useMemo(() => {
        if (!data.length) return { tableRows: [], unassignedLeads: [] };
        const groups: Record<string, any> = {};
        
        data.forEach(row => {
            if (row.dateObj < dateRange.start || row.dateObj > dateRange.end) return;
            // ELITE Filter
            if (filterElite && filterElite.length > 0 && !filterElite.includes(row.ELITE || '')) return;

            if (activeFilter.campaign && row['Campaign Name'] !== activeFilter.campaign) return;
            if (activeFilter.adset && row['Ad Set Name'] !== activeFilter.adset) return;
            const currentName = viewLevel === 'campaign' ? row['Campaign Name'] : (viewLevel === 'adset' ? row['Ad Set Name'] : row['Ad Name']);
            if (selectionFilter && selectionFilter.length > 0 && !selectionFilter.includes(currentName)) return;
            const s = `${row['Campaign Name']} ${row['Ad Set Name']} ${row['Ad Name']} ${row.parsed_pais} ${row.parsed_producto}`.toLowerCase();
            if (searchTags.length && !searchTags.every(t => s.includes(t.toLowerCase()))) return;
            
            // --- GROUPING KEY LOGIC ---
            let hierarchyKey = row['Campaign Name'];
            if (viewLevel === 'adset') hierarchyKey += '|||' + row['Ad Set Name'];
            if (viewLevel === 'ad') hierarchyKey += '|||' + row['Ad Set Name'] + '|||' + row['Ad Name'];

            // IF BREAKDOWN IS ACTIVE, WE APPEND THE DATE TO THE KEY
            if (isBreakdown) {
                const dateKey = getLocalDateKey(row.dateObj);
                hierarchyKey += '|||' + dateKey;
            }

            if (!groups[hierarchyKey]) {
                groups[hierarchyKey] = { 
                    ...row, 
                    _rows: [], 
                    'Amount Spent': 0, 
                    'USD REAL': 0, 
                    'Gasto Pro': 0, 
                    'Messaging Conversations Started': 0, 
                    'Ventas (Kommo)': 0, 
                    'Facturación Kommo Pro': 0, 
                    'Impressions': 0, 
                    'Unique Clicks (All)': 0 
                };
            }
            groups[hierarchyKey]._rows.push(row);
            groups[hierarchyKey]['Amount Spent'] += (row['Amount Spent'] || 0);
            groups[hierarchyKey]['USD REAL'] += (row['USD REAL'] || 0);
            groups[hierarchyKey]['Gasto Pro'] += useUsd ? (row['USD REAL'] || 0) : (row['Amount Spent'] || 0);
            groups[hierarchyKey]['Impressions'] += (parseInt(row['Impressions']) || 0);
            groups[hierarchyKey]['Unique Clicks (All)'] += (parseInt(row['Unique Clicks (All)']) || 0);
        });

        const rowsArray = Object.values(groups);
        
        rowsArray.forEach(g => {
            const fbRows = g._rows as FacebookRow[];
            const uniquePCs = new Set(fbRows.map(r => r.parsed_palabra_clave).filter(p => p && p !== 'PC00'));
            g.pcsSet = uniquePCs;
            if (uniquePCs.size === 1) g.parsed_palabra_clave = Array.from(uniquePCs)[0];
            else if (uniquePCs.size > 1) g.parsed_palabra_clave = 'VARIOS';
            else g.parsed_palabra_clave = 'PC00';
            
            const msgs = g['Messaging Conversations Started'];
            g['Cost per Messaging Conversations Started'] = msgs > 0 ? g['USD REAL'] / msgs : 0;
            g['ROAS Pro'] = g['Gasto Pro'] > 0 ? g['Facturación Kommo Pro'] / g['Gasto Pro'] : 0;
            g['Margen'] = g['Facturación Kommo Pro'] - g['Gasto Pro'];
        });

        // --- ATTRIBUTION LOGIC (OPTIMIZED) ---
        const leadsAtribuidosIds = new Set<string>();
        const potentialLeadsForVisibleCampaigns: KommoLead[] = [];

        // 1. Build Lookup Map: Country|SourceLast4 -> [Criteria]
        const criteriaMap = new Map<string, any[]>();

        const rowCriteria = rowsArray.map(g => {
            const fbRows = g._rows as FacebookRow[];
            const firstRow = fbRows[0];
            const crit = {
                group: g,
                pais: normalizePaisName(firstRow.parsed_pais),
                prod: normalizeProductoName(firstRow.parsed_producto),
                f4: extractLast4(firstRow.parsed_fuente_id),
                pcs: g.pcsSet,
                rowDateString: isBreakdown ? getLocalDateKey(firstRow.dateObj) : null
            };

            // Add to Map
            const key = `${crit.pais}|${crit.f4}`;
            if (!criteriaMap.has(key)) criteriaMap.set(key, []);
            criteriaMap.get(key)?.push(crit);

            return crit;
        });

        kommoData.forEach(lead => {
            const createdDate = new Date(lead['Creado en']);
            const closedDate = new Date(lead['Cerrado en']);
            const isCashing = lead.status_pipeline === 'CASHING';
            
            const isInDateRange = (createdDate >= dateRange.start && createdDate <= dateRange.end) || 
                                  (isCashing && closedDate >= dateRange.start && closedDate <= dateRange.end);
            if (!isInDateRange) return;

            // ELITE Filter Check for Kommo too
            if (filterElite && filterElite.length > 0 && !filterElite.includes(lead.ELITE || '')) return;

            const leadPais = normalizePaisName(lead.pais);
            const leadProd = normalizeProductoName(lead.producto);
            const leadF4 = extractLast4(lead.Fuente);
            const leadPC = normalizePC(lead['Palabras Claves']);
            
            const leadCreatedDateString = getLocalDateKey(createdDate);
            const leadClosedDateString = closedDate && !isNaN(closedDate.getTime()) ? getLocalDateKey(closedDate) : null;

            // FAST LOOKUP
            const lookupKey = `${leadPais}|${leadF4}`;
            const potentialMatches = criteriaMap.get(lookupKey);

            if (potentialMatches) {
                // Filter by Product (Fuzzy Match)
                const baseMatches = potentialMatches.filter(crit => {
                    return leadProd.includes(crit.prod) || crit.prod.includes(leadProd);
                });

                if (baseMatches.length > 0) {
                    const alreadyPotential = potentialLeadsForVisibleCampaigns.some(pl => pl.id === lead.id);
                    if (!alreadyPotential) potentialLeadsForVisibleCampaigns.push(lead);

                    if (leadPC && leadPC !== 'PC00') {
                        const validMatches = baseMatches.filter(crit => crit.pcs.has(leadPC));

                        if (validMatches.length > 0) {
                            if (isBreakdown) {
                                const creationMatch = validMatches.find(crit => crit.rowDateString === leadCreatedDateString);
                                if (creationMatch) creationMatch.group['Messaging Conversations Started']++;

                                if (isCashing && leadClosedDateString) {
                                    const closingMatch = validMatches.find(crit => crit.rowDateString === leadClosedDateString);
                                    if (closingMatch) {
                                        const g = closingMatch.group;
                                        leadsAtribuidosIds.add(lead.id);
                                        g['Ventas (Kommo)']++;
                                        const tasa = DataService.getRateForDate(exchangeRates, getMonedaByPais(lead.pais), closedDate);
                                        g['Facturación Kommo Pro'] += useUsd ? (lead.monto / tasa) : lead.monto;
                                    }
                                }
                            } else {
                                const match = validMatches[0];
                                const g = match.group;
                                if (createdDate >= dateRange.start && createdDate <= dateRange.end) g['Messaging Conversations Started']++;
                                if (isCashing && closedDate >= dateRange.start && closedDate <= dateRange.end) {
                                    leadsAtribuidosIds.add(lead.id);
                                    g['Ventas (Kommo)']++;
                                    const tasa = DataService.getRateForDate(exchangeRates, getMonedaByPais(lead.pais), closedDate);
                                    g['Facturación Kommo Pro'] += useUsd ? (lead.monto / tasa) : lead.monto;
                                }
                            }
                        }
                    }
                }
            }
        });

        rowsArray.forEach(g => {
            g['ROAS Pro'] = g['Gasto Pro'] > 0 ? g['Facturación Kommo Pro'] / g['Gasto Pro'] : 0;
            g['Margen'] = g['Facturación Kommo Pro'] - g['Gasto Pro'];
        });

        const finalUnassigned = potentialLeadsForVisibleCampaigns.filter(l => !leadsAtribuidosIds.has(l.id) && l.status_pipeline === 'CASHING');
        
        if (sortConfig) {
            rowsArray.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (typeof aValue === 'string' && typeof bValue === 'string') { return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue); }
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else if (isBreakdown) {
             rowsArray.sort((a, b) => {
                 const nameA = a['Campaign Name'] || '';
                 const nameB = b['Campaign Name'] || '';
                 if (nameA !== nameB) return nameA.localeCompare(nameB);
                 return b.dateObj.getTime() - a.dateObj.getTime();
             });
        }

        return { tableRows: rowsArray.filter(r => !onlyWithDelivery || r['Gasto Pro'] >= 0.01), unassignedLeads: finalUnassigned };
    }, [data, kommoData, activeColumns, searchTags, dateRange, useUsd, onlyWithDelivery, viewLevel, activeFilter, exchangeRates, selectionFilter, isBreakdown, sortConfig, filterElite]);

    // ... [Footer Data logic remains mostly same but depends on filtered rows] ...
    const footerData = useMemo(() => {
        if (!tableRows.length) return null;
        const t: any = { 'Amount Spent': 0, 'USD REAL': 0, 'Gasto Pro': 0, 'Messaging Conversations Started': 0, 'Ventas (Kommo)': 0, 'Facturación Kommo Pro': 0, 'Impressions': 0, 'Unique Clicks (All)': 0 };
        tableRows.forEach(r => { Object.keys(t).forEach(k => t[k] += (r[k] || 0)); });

        if (unassignedLeads.length > 0) {
            t['Ventas (Kommo)'] += unassignedLeads.length;
            unassignedLeads.forEach(l => {
                const closedDate = new Date(l['Cerrado en']);
                const tasa = DataService.getRateForDate(exchangeRates, getMonedaByPais(l.pais), closedDate);
                const monto = useUsd ? (l.monto / tasa) : l.monto;
                t['Facturación Kommo Pro'] += monto;
            });
        }

        t['Cost per Messaging Conversations Started'] = t['Messaging Conversations Started'] > 0 ? t['USD REAL'] / t['Messaging Conversations Started'] : 0;
        t['ROAS Pro'] = t['Gasto Pro'] > 0 ? t['Facturación Kommo Pro'] / t['Gasto Pro'] : 0;
        t['Margen'] = t['Facturación Kommo Pro'] - t['Gasto Pro'];
        return t;
    }, [tableRows, unassignedLeads, kommoData, dateRange, useUsd, exchangeRates]);

    const hasActiveFilters = activeFilter.campaign || activeFilter.adset || onlyWithDelivery || (selectionFilter && selectionFilter.length > 0);

    // --- VIRTUALIZATION / PAGINATION STATE ---
    const [displayLimit, setDisplayLimit] = useState(50);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Reset limit when filters change
    useEffect(() => {
        setDisplayLimit(50);
        if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
    }, [viewLevel, searchTags, activeFilter, dateRange, onlyWithDelivery, selectionFilter, isBreakdown, sortConfig, filterElite]);

    // Infinite Scroll Handler
    const handleScroll = () => {
        if (tableContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                setDisplayLimit(prev => Math.min(prev + 50, tableRows.length));
            }
        }
    };

    // Slice rows for display
    const visibleRows = useMemo(() => tableRows.slice(0, displayLimit), [tableRows, displayLimit]);

    return (
        <div className="space-y-4 animate-fade-in relative">
            {/* ... (Audit Panel & Task Modal unchanged) ... */}
            {showAuditPanel && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-sm" onClick={() => setShowAuditPanel(false)} />
                    <div className="relative w-full max-w-md bg-surface-dark h-full shadow-2xl animate-fade-in flex flex-col border-l border-white/10">
                        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <div><h3 className="text-lg font-extrabold text-white">Attribution Audit</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Unassigned Sales</p></div>
                            <button onClick={() => setShowAuditPanel(false)} className="text-slate-400 hover:text-white p-2 transition-colors">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-[13px] text-primary font-medium leading-relaxed">These <b>{unassignedLeads.length} sales</b> belong to these Campaigns (Source Match), but have <b>PC00</b> or missing Keywords, so they are not attributed to any specific row to avoid data inflation.</div>
                            {unassignedLeads.slice(0, 100).map(l => (
                                <div key={l.id} className="p-4 border border-white/5 rounded-xl hover:border-primary/50 transition-all bg-white/5 shadow-sm group">
                                    <div className="flex justify-between items-start mb-2"><h4 className="font-bold text-white group-hover:text-primary truncate mr-2">{l.nombre}</h4><span className="text-xs font-black text-neon-green shrink-0">{formatMoney(l.monto)}</span></div>
                                    <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-400"><span className="font-bold uppercase">ID:</span> <span className="text-slate-200 font-mono">#{l.id}</span><span className="font-bold uppercase">Country:</span> <span className="text-slate-200">{l.pais}</span><span className="font-bold uppercase">Product:</span> <span className="text-slate-200">{l.producto}</span><span className="font-bold uppercase">Source:</span> <span className="text-primary font-bold">{l.Fuente}</span><span className="font-bold uppercase">PC:</span> <span className="text-red-500 font-black">{l['Palabras Claves'] || 'EMPTY'}</span></div>
                                </div>
                            ))}
                            {unassignedLeads.length > 100 && <div className="text-center text-xs text-slate-500 italic">And {unassignedLeads.length - 100} more...</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* ... (Task Modal unchanged) ... */}
            {showTaskModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-sm" onClick={() => setShowTaskModal(false)}></div>
                    <div className="relative w-full max-w-lg glass-card rounded-2xl border border-white/10 shadow-2xl animate-fade-in flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary"><span className="material-symbols-outlined text-xl">assignment_add</span></div>
                                <div><h3 className="text-lg font-bold text-white">Create New Task</h3><p className="text-xs text-slate-400 max-w-[250px] truncate">For: <span className="text-primary font-semibold">{activeTaskRow?.['Campaign Name'] || activeTaskRow?.['Ad Set Name'] || activeTaskRow?.['Ad Name']}</span></p></div>
                            </div>
                            <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-white transition-colors"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="p-6 bg-[#0f1115]">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task Description</label>
                            <textarea ref={taskInputRef} value={taskNote} onChange={(e) => setTaskNote(e.target.value)} className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none placeholder:text-slate-600" placeholder="What needs to be done?" onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmSaveTask(); } }} />
                            <div className="mt-3 flex gap-2"><div className="px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-slate-400 font-mono">{activeTaskRow?.parsed_pais || 'N/A'}</div><div className="px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-slate-400 font-mono">{activeTaskRow?.parsed_producto || 'N/A'}</div><div className="px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-slate-400 font-mono">{activeTaskRow?.parsed_palabra_clave || 'N/A'}</div></div>
                        </div>
                        <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end gap-3">
                            <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">Cancel</button>
                            <button onClick={confirmSaveTask} disabled={!taskNote.trim()} className="px-6 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center gap-2"><span className="material-symbols-outlined text-sm">save</span>Save Task</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTROLS */}
            <div className="glass-card p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 relative z-30">
                <div className="flex items-center gap-3">
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
                        {['campaign', 'adset', 'ad'].map(l => (
                            <button key={l} onClick={() => handleViewLevelChange(l, true)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewLevel === l ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>{l.toUpperCase()}</button>
                        ))}
                    </div>
                    {selectedRows.size > 0 && <button onClick={applySelectionFilter} className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg border border-primary hover:bg-primary/80 transition-all font-black shadow-lg shadow-primary/20">Filter Selected ({selectedRows.size})</button>}
                    {(searchTags.length > 0 || hasActiveFilters) && <button onClick={clearAllFilters} className="bg-red-500/10 text-red-500 text-xs px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-colors font-bold">Reset Filters</button>}
                </div>
                
                <div className="relative flex-1 max-w-lg">
                    <div className="flex flex-wrap items-center gap-2 w-full pl-10 pr-4 py-2 border border-white/10 rounded-lg text-sm bg-white/5 focus-within:ring-2 focus-within:ring-primary/50 transition-all shadow-sm group">
                        <span className="material-symbols-outlined absolute left-3 top-2 text-slate-500 text-lg">search</span>
                        {searchTags.map((t, i) => <span key={i} className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold border border-primary/30 flex items-center gap-1.5">{t}<button onClick={() => setSearchTags(searchTags.filter((_, idx) => idx !== i))} className="hover:text-white">×</button></span>)}
                        <input type="text" className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-slate-500 text-xs font-medium" placeholder={searchTags.length ? "" : "Search campaigns..."} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleInputKeyDown} />
                    </div>
                </div>

                <div className="flex gap-2 items-center">
                    <MultiSelect placeholder="ELITE" options={elitesList} selected={filterElite} onChange={v => onFiltersChange({ filterElite: v })} icon="star" align="left" />
                    
                    <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/5 px-3">
                        <span className={`text-[10px] font-bold px-1 ${!useUsd ? 'text-primary' : 'text-slate-500'}`}>ORIG</span>
                        <button onClick={() => setUseUsd(!useUsd)} className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${useUsd ? 'bg-neon-green' : 'bg-slate-700'}`}>
                            <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${useUsd ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                        <span className={`text-[10px] font-bold px-1 ${useUsd ? 'text-neon-green' : 'text-slate-500'}`}>USD</span>
                    </div>

                    <button onClick={() => setMaskProduct(!maskProduct)} className={`p-2 rounded-lg border transition-all ${maskProduct ? 'bg-primary text-white border-primary' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`} title="Mask Products">
                        <span className="material-symbols-outlined text-lg">{maskProduct ? 'visibility_off' : 'visibility'}</span>
                    </button>

                    <button onClick={() => setIsBreakdown(!isBreakdown)} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${isBreakdown ? 'bg-blue-500 text-white border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`} title="Daily Breakdown"><span className="material-symbols-outlined text-sm">calendar_month</span>Desglose</button>
                    <button onClick={() => setOnlyWithDelivery(!onlyWithDelivery)} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${onlyWithDelivery ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>Active Only</button>
                    
                    <div className="relative" ref={colManagerRef}>
                        <button onClick={() => setShowColManager(!showColManager)} className={`p-2 rounded-lg border transition-all ${showColManager ? 'bg-white text-background-dark' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined text-lg">view_column</span></button>
                        {showColManager && (
                            <div className="absolute right-0 top-11 w-64 glass-card rounded-xl shadow-2xl p-4 z-50 animate-fade-in max-h-[80vh] overflow-y-auto custom-scrollbar bg-surface-dark">
                                <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Visible Columns</h4>
                                <div className="space-y-1.5">
                                    {FB_COLUMNS_DEF.map(col => {
                                        const isMandatory = ['Campaign Name', 'Ad Set Name', 'Ad Name'].includes(col.id);
                                        return (
                                            <label key={col.id} className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors ${isMandatory ? 'opacity-50' : ''}`}>
                                                <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary" checked={visibleCols.includes(col.id)} disabled={isMandatory} onChange={() => { const newVisible = visibleCols.includes(col.id) ? visibleCols.filter(id => id !== col.id) : [...visibleCols, col.id]; setVisibleCols(newVisible); }} />
                                                <span className="text-sm font-medium text-slate-300 group-hover:text-white truncate">{col.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <DateRangePicker onChange={setDateRange} />
                </div>
            </div>

            {/* Main Table Logic */}
            {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 animate-fade-in">
                    {activeFilter.campaign && <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/20 flex items-center gap-2">📢 Campaign: {activeFilter.campaign}<button onClick={removeCampaignFilter} className="hover:text-white font-black">✕</button></span>}
                    {activeFilter.adset && <span className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-xs font-bold border border-purple-500/20 flex items-center gap-2">💠 Ad Set: {activeFilter.adset}<button onClick={removeAdSetFilter} className="hover:text-white font-black">✕</button></span>}
                </div>
            )}

            <div className="glass-card rounded-xl overflow-hidden relative z-0">
                <div className="overflow-x-auto max-h-[70vh] custom-scrollbar" ref={tableContainerRef} onScroll={handleScroll}>
                    <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
                        <thead className="bg-white/5 text-slate-400 font-bold border-b border-white/10 sticky top-0 z-20 backdrop-blur-md">
                            <tr>
                                {clickable && <th className="px-3 py-3 w-10 text-center"></th>}
                                {isBreakdown && <th className="px-4 py-3 min-w-[100px] uppercase tracking-wider text-[10px] text-blue-400">DATE</th>}
                                {activeColumns.map(c => (
                                    <th key={c.id} className="px-4 py-3 min-w-[120px] uppercase tracking-wider text-[10px] cursor-pointer hover:bg-white/10 hover:text-white transition-colors select-none" onClick={() => handleSort(c.id)}>
                                        <div className="flex items-center gap-1">{c.name}{sortConfig?.key === c.id && <span className="material-symbols-outlined text-[10px]">{sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}</div>
                                    </th>
                                ))}
                                <th className="px-4 py-3 min-w-[50px] uppercase tracking-wider text-[10px] text-slate-500 text-center">TASK</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {visibleRows.map((row, i) => {
                                const rowName = viewLevel === 'campaign' ? row['Campaign Name'] : (viewLevel === 'adset' ? row['Ad Set Name'] : row['Ad Name']);
                                const rowId = row['Campaign ID'] || row['Ad Set ID'] || row['Ad ID'] || 'unknown';
                                const hasPendingTask = tasks.some(t => t.context.rowId === rowId && t.status === 'PENDING');

                                return (
                                    <tr key={i} className={`transition-colors group ${clickable && !isBreakdown ? 'cursor-pointer hover:bg-white/5' : 'hover:bg-white/5'}`} onClick={() => clickable && handleRowClick(viewLevel, rowName)}>
                                        {clickable && (
                                            <td className="px-3 py-3 w-10 text-center" onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" checked={selectedRows.has(rowName)} onChange={() => toggleRowSelection(rowName)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary" disabled={isBreakdown} />
                                            </td>
                                        )}
                                        {isBreakdown && <td className="px-4 py-3 font-mono text-xs text-blue-300 font-bold">{formatDate(row.dateObj).split(',')[0]}</td>}
                                        {activeColumns.map(c => {
                                            let v = row[c.id];
                                            if (maskProduct && (c.id === 'Campaign Name' || c.id === 'Ad Set Name' || c.id === 'Ad Name')) { const pts = String(v).split('|'); if (pts.length >= 2) { pts[1] = ` ${maskString(pts[1].trim())} `; v = pts.join('|'); } }
                                            if (c.type === 'money') v = formatMoney(v); else if (c.type === 'number') v = formatNumber(v); else if (c.type === 'date') v = formatDate(v);
                                            return <td key={c.id} className={`px-4 py-3 font-medium text-slate-300 ${clickable && !isBreakdown && (c.id === 'Campaign Name' || c.id === 'Ad Set Name') ? 'text-primary font-bold group-hover:text-neon-teal' : ''}`}>{v}</td>;
                                        })}
                                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                            <div className="relative inline-block">
                                                <button onClick={() => openTaskModal(row)} className="p-1.5 rounded-lg bg-white/5 hover:bg-primary/20 text-slate-500 hover:text-primary transition-colors" title="Add Task"><span className="material-symbols-outlined text-base">add_task</span></button>
                                                {hasPendingTask && <span className="absolute -top-1 -right-1 text-[10px]" title="Has Pending Task">🚩</span>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {visibleRows.length < tableRows.length && (
                                <tr>
                                    <td colSpan={activeColumns.length + (clickable ? 2 : 1) + (isBreakdown ? 1 : 0)} className="px-4 py-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
                                        Showing {visibleRows.length} of {tableRows.length} rows. Scroll for more.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {footerData && (
                            <tfoot className="bg-white/5 font-bold border-t-2 border-white/10 sticky bottom-0 z-10 backdrop-blur-md">
                                <tr>
                                    {clickable && <td className="px-3 py-3"></td>}
                                    {isBreakdown && <td className="px-4 py-3"></td>}
                                    {activeColumns.map((c, idx) => {
                                        if (idx === 0) {
                                            const totalVentas = footerData['Ventas (Kommo)'];
                                            const atribuidas = totalVentas - unassignedLeads.length;
                                            return <td key={c.id} className="px-4 py-3 text-white uppercase text-[10px]"><div className="flex flex-col"><span className="text-sm font-black text-white">TOTAL: {totalVentas} SALES</span><div className="flex gap-1 text-[9px] text-slate-400 font-medium"><span>({atribuidas} Attr.</span><span>+</span><span className={unassignedLeads.length > 0 ? "text-yellow-500 font-bold" : ""}>{unassignedLeads.length} Unassigned)</span></div>{unassignedLeads.length > 0 && <button onClick={(e) => { e.stopPropagation(); setShowAuditPanel(true); }} className="text-neon-green hover:underline text-[9px] flex items-center gap-1 mt-0.5 w-fit">⚠️ View Breakdown</button>}</div></td>;
                                        }
                                        if (c.type === 'text' || c.type === 'date') return <td key={c.id} className="px-4 py-3"></td>;
                                        let v = footerData[c.id];
                                        if (c.type === 'money') v = formatMoney(v); else if (c.type === 'number') v = c.id.includes('CTR') ? formatNumber(v) + '%' : formatNumber(v);
                                        return <td key={c.id} className="px-4 py-3 text-white">{v}</td>;
                                    })}
                                    <td className="px-4 py-3"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default React.memo(FacebookView);
