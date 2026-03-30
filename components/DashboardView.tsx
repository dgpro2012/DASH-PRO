
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { KommoLead, FacebookRow, GlobalFilters, ExchangeRates } from '../types';
import { formatMoney, formatNumber, getDateRange, normalizePaisName, normalizeProductoName, matchPais, matchProducto, getMonedaByPais, cleanAndNormalizeSource } from '../utils';
import { DataService } from '../services/dataService';
import { HISTORY_COLUMNS_DEF } from '../constants';
import DateRangePicker from './DateRangePicker';
import MultiSelect from './MultiSelect';
import KPICard from './KPICard';
import ConversionGauge from './ConversionGauge';

declare global {
    interface Window {
        Chart: any;
    }
}

interface DashboardViewProps {
    kommoData: KommoLead[];
    facebookData: FacebookRow[];
    exchangeRates: ExchangeRates;
    filters: GlobalFilters['dashboard'];
    onFiltersChange: (updates: Partial<GlobalFilters['dashboard']>) => void;
    onAddTask?: (taskData: any) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ kommoData, facebookData, exchangeRates, filters, onFiltersChange, onAddTask }) => {
    const { filterPais, filterProducto, filterElite, filterCanal, dateRange, useUsd } = filters;
    
    const lineChartRef = useRef<HTMLCanvasElement>(null);
    const lineChartInstance = useRef<any>(null);
    const countryChartRef = useRef<HTMLCanvasElement>(null);
    const countryChartInstance = useRef<any>(null);
    const revenueCountryChartRef = useRef<HTMLCanvasElement>(null);
    const revenueCountryChartInstance = useRef<any>(null);
    const productChartRef = useRef<HTMLCanvasElement>(null);
    const productChartInstance = useRef<any>(null);
    const revenueProductChartRef = useRef<HTMLCanvasElement>(null);
    const revenueProductChartInstance = useRef<any>(null);
    
    // Persist Chart View
    const [chartView, setChartView] = useState(() => localStorage.getItem('dashboard_chart_view') || 'daily');
    useEffect(() => localStorage.setItem('dashboard_chart_view', chartView), [chartView]);

    const [historyVisibleCols, setHistoryVisibleCols] = useState<string[]>(() => {
        const saved = localStorage.getItem('history_visible_cols_v3');
        return saved ? JSON.parse(saved) : HISTORY_COLUMNS_DEF.filter(c => c.default).map(c => c.id);
    });
    useEffect(() => localStorage.setItem('history_visible_cols_v3', JSON.stringify(historyVisibleCols)), [historyVisibleCols]);

    const [historyColOrder, setHistoryColOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('history_col_order_v3');
        return saved ? JSON.parse(saved) : HISTORY_COLUMNS_DEF.map(c => c.id);
    });
    useEffect(() => localStorage.setItem('history_col_order_v3', JSON.stringify(historyColOrder)), [historyColOrder]);

    const [showHistoryColManager, setShowHistoryColManager] = useState(false);
    const historyColManagerRef = useRef<HTMLDivElement>(null);
    const [historyOnlyWithDelivery, setHistoryOnlyWithDelivery] = useState(false);

    // --- DYNAMIC FILTERS LOGIC (OPTIMIZED) ---

    // 1. Master Memo: Filter raw data by Date Range ONCE
    const dataOnDateRange = useMemo(() => {
        const fb: FacebookRow[] = [];
        const kommo: KommoLead[] = [];
        const itemsForOptions: { pais: string; prod: string; source: string; elite: string | null }[] = [];

        // Filter Facebook
        facebookData.forEach(row => {
            if (row.dateObj >= dateRange.start && row.dateObj <= dateRange.end) {
                fb.push(row);
                itemsForOptions.push({
                    pais: normalizePaisName(row.parsed_pais),
                    prod: normalizeProductoName(row.parsed_producto),
                    source: cleanAndNormalizeSource(row.parsed_fuente),
                    elite: row.ELITE || null
                });
            }
        });

        // Filter Kommo
        kommoData.forEach(row => {
            const created = new Date(row['Creado en']);
            const closed = new Date(row['Cerrado en']);
            const isActive = (!isNaN(created.getTime()) && created >= dateRange.start && created <= dateRange.end) ||
                             (row.status_pipeline === 'CASHING' && !isNaN(closed.getTime()) && closed >= dateRange.start && closed <= dateRange.end);

            if (isActive) {
                kommo.push(row);
                itemsForOptions.push({
                    pais: normalizePaisName(row.pais),
                    prod: normalizeProductoName(row.producto),
                    source: cleanAndNormalizeSource(row.fuente_normalizada || row.Fuente),
                    elite: row.ELITE || null
                });
            }
        });

        return { fb, kommo, itemsForOptions };
    }, [facebookData, kommoData, dateRange]);

    // 2. Derive Options dynamically from dataOnDateRange
    const checkPais = (itemPais: string, selected: string[]) => selected.length === 0 || matchPais(itemPais, selected);
    const checkProd = (itemProd: string, selected: string[]) => selected.length === 0 || matchProducto(itemProd, selected);
    const checkSource = (itemSource: string, selected: string[]) => selected.length === 0 || selected.includes(itemSource);
    const checkElite = (itemElite: string | null, selected: string[]) => selected.length === 0 || (itemElite && selected.includes(itemElite));

    const paisesOptions = useMemo(() => {
        const set = new Set<string>();
        dataOnDateRange.itemsForOptions.forEach(item => {
            if (checkProd(item.prod, filterProducto) && checkSource(item.source, filterCanal) && checkElite(item.elite, filterElite)) {
                if (item.pais) set.add(item.pais);
            }
        });
        return [...set].sort();
    }, [dataOnDateRange.itemsForOptions, filterProducto, filterCanal, filterElite]);

    const productosOptions = useMemo(() => {
        const set = new Set<string>();
        dataOnDateRange.itemsForOptions.forEach(item => {
            if (checkPais(item.pais, filterPais) && checkSource(item.source, filterCanal) && checkElite(item.elite, filterElite)) {
                if (item.prod) set.add(item.prod);
            }
        });
        return [...set].sort();
    }, [dataOnDateRange.itemsForOptions, filterPais, filterCanal, filterElite]);

    const fuentesOptions = useMemo(() => {
        const set = new Set<string>();
        dataOnDateRange.itemsForOptions.forEach(item => {
            if (checkPais(item.pais, filterPais) && checkProd(item.prod, filterProducto) && checkElite(item.elite, filterElite)) {
                if (item.source && item.source !== 'Desconocido') set.add(item.source);
            }
        });
        return [...set].sort();
    }, [dataOnDateRange.itemsForOptions, filterPais, filterProducto, filterElite]);

    const elitesList = ['PECAS', 'LASMEJORES', 'PLAYITA'];

    // 3. Apply Specific Filters (Country, Product, etc) to the Date-Filtered Data
    const filteredKommo = useMemo(() => dataOnDateRange.kommo.filter(lead => {
        if (!matchPais(lead.pais, filterPais)) return false;
        if (!matchProducto(lead.producto, filterProducto)) return false;
        if (filterElite.length > 0 && !filterElite.includes(lead.ELITE)) return false;
        const fuente = cleanAndNormalizeSource(lead.Fuente || lead.fuente_normalizada);
        if (filterCanal && filterCanal.length > 0 && !filterCanal.includes(fuente)) return false;
        
        // Status check is still needed as dataOnDateRange includes all active leads
        const status = lead.status_pipeline;
        if (!['BASE', 'DESCUENTO', 'CASHING', 'VENTA PERDIDA'].includes(status)) return false;
        
        // Date check is implicit for creation/closing logic, but we need to be careful about which date matched
        // The original logic filtered by creation date for the main list?
        // Original: return !isNaN(leadDate.getTime()) && leadDate >= dateRange.start && leadDate <= dateRange.end;
        const leadDate = new Date(lead['Creado en']);
        return !isNaN(leadDate.getTime()) && leadDate >= dateRange.start && leadDate <= dateRange.end;
    }), [dataOnDateRange.kommo, filterPais, filterProducto, filterElite, filterCanal, dateRange]);

    const filteredFb = useMemo(() => dataOnDateRange.fb.filter(row => {
        if (!matchPais(row.parsed_pais, filterPais)) return false;
        if (!matchProducto(row.parsed_producto, filterProducto)) return false;
        if (filterElite.length > 0 && !filterElite.includes(row.ELITE || '')) return false;
        const fuente = cleanAndNormalizeSource(row.parsed_fuente);
        if (filterCanal && filterCanal.length > 0 && !filterCanal.includes(fuente)) return false;
        return true; // Date already checked
    }), [dataOnDateRange.fb, filterPais, filterProducto, filterCanal, filterElite]);

    const filteredKommoForHistory = useMemo(() => dataOnDateRange.kommo.filter(lead => {
        if (!matchPais(lead.pais, filterPais)) return false;
        if (!matchProducto(lead.producto, filterProducto)) return false;
        if (filterElite.length > 0 && !filterElite.includes(lead.ELITE)) return false;
        const fuente = cleanAndNormalizeSource(lead.Fuente || lead.fuente_normalizada);
        if (filterCanal && filterCanal.length > 0 && !filterCanal.includes(fuente)) return false;
        
        const status = lead.status_pipeline;
        if (!['BASE', 'DESCUENTO', 'CASHING', 'VENTA PERDIDA'].includes(status)) return false;
        
        return true;
    }), [dataOnDateRange.kommo, filterPais, filterProducto, filterElite, filterCanal]);

    const totalVentasData = useMemo(() => dataOnDateRange.kommo.filter(l => {
        if (l.status_pipeline !== 'CASHING') return false;
        if (!matchPais(l.pais, filterPais)) return false;
        if (!matchProducto(l.producto, filterProducto)) return false;
        if (filterElite.length > 0 && !filterElite.includes(l.ELITE)) return false;
        const fuente = cleanAndNormalizeSource(l.Fuente || l.fuente_normalizada);
        if (filterCanal && filterCanal.length > 0 && !filterCanal.includes(fuente)) return false;
        
        const closedDate = new Date(l['Cerrado en']);
        return !isNaN(closedDate.getTime()) && closedDate >= dateRange.start && closedDate <= dateRange.end;
    }), [dataOnDateRange.kommo, filterPais, filterProducto, filterElite, filterCanal, dateRange]);

    // KPIs
    const totalLeads = filteredKommo.length;
    const totalVentasCount = totalVentasData.length;
    const totalGastoUSD = filteredFb.reduce((sum, item) => sum + (item['USD REAL'] || 0), 0);
    const totalGastoPro = useUsd ? totalGastoUSD : filteredFb.reduce((sum, item) => sum + (item['Amount Spent'] || 0), 0);
    
    const totalFacturacionPro = useMemo(() => {
        return totalVentasData.reduce((sum, lead) => {
            let m = lead.monto;
            if (useUsd && exchangeRates) {
                const closedDate = new Date(lead['Cerrado en'] || lead['Creado en']);
                const mon = getMonedaByPais(lead.pais);
                const t = DataService.getRateForDate(exchangeRates, mon, closedDate);
                m = m / t;
            }
            return sum + m;
        }, 0);
    }, [totalVentasData, useUsd, exchangeRates]);

    const roasPro = totalGastoPro > 0 ? totalFacturacionPro / totalGastoPro : 0;
    const ganancia = totalFacturacionPro - totalGastoPro;
    const cplPro = totalLeads > 0 ? totalGastoPro / totalLeads : 0;
    const cprPro = totalVentasCount > 0 ? totalGastoPro / totalVentasCount : 0; // Cost Per Result (Sale)
    const conversionRate = totalLeads > 0 ? (totalVentasCount / totalLeads) * 100 : 0;

    // --- MONTHLY METRICS FOR SPARKLINES (ALWAYS CURRENT MONTH) ---
    const monthlyMetrics = useMemo(() => {
        const now = new Date();
        // Get start of current month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // Get end of current month (or today/end of month)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const map = new Map<string, { date: string; investment: number; revenue: number; sales: number; leads: number }>();
        
        // Initialize map with all days in the current month
        for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
            const key = d.toISOString().split('T')[0];
            map.set(key, { date: key, investment: 0, revenue: 0, sales: 0, leads: 0 });
        }

        // Helper to check attribute filters
        const matchesFilters = (pais: string, prod: string, fuente: string, elite: string | null) => {
            if (!matchPais(pais, filterPais)) return false;
            if (!matchProducto(prod, filterProducto)) return false;
            if (filterElite.length > 0 && !filterElite.includes(elite || '')) return false;
            if (filterCanal && filterCanal.length > 0 && !filterCanal.includes(cleanAndNormalizeSource(fuente))) return false;
            return true;
        };

        // Fill Investment (Facebook)
        facebookData.forEach(row => {
            if (row.dateObj >= startOfMonth && row.dateObj <= endOfMonth) {
                if (matchesFilters(row.parsed_pais, row.parsed_producto, row.parsed_fuente, row.ELITE || null)) {
                    const key = row.dateObj.toISOString().split('T')[0];
                    if (map.has(key)) {
                        const val = useUsd ? (row['USD REAL'] || 0) : (row['Amount Spent'] || 0);
                        const entry = map.get(key)!;
                        entry.investment += val;
                    }
                }
            }
        });

        // Fill Revenue, Sales, Leads (Kommo)
        kommoData.forEach(lead => {
            if (matchesFilters(lead.pais, lead.producto, lead.fuente_normalizada || lead.Fuente, lead.ELITE || null)) {
                // Leads (Created Date)
                const created = new Date(lead['Creado en']);
                if (!isNaN(created.getTime()) && created >= startOfMonth && created <= endOfMonth) {
                    const key = created.toISOString().split('T')[0];
                    if (map.has(key)) {
                        map.get(key)!.leads += 1;
                    }
                }

                // Sales & Revenue (Closed Date)
                if (lead.status_pipeline === 'CASHING') {
                    const closed = new Date(lead['Cerrado en']);
                    if (!isNaN(closed.getTime()) && closed >= startOfMonth && closed <= endOfMonth) {
                        const key = closed.toISOString().split('T')[0];
                        if (map.has(key)) {
                            let m = lead.monto;
                            if (useUsd && exchangeRates) {
                                const mon = getMonedaByPais(lead.pais);
                                const t = DataService.getRateForDate(exchangeRates, mon, closed);
                                m = m / t;
                            }
                            const entry = map.get(key)!;
                            entry.revenue += m;
                            entry.sales += 1;
                        }
                    }
                }
            }
        });

        const arr = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
        
        return arr.map(item => ({
            name: item.date,
            investment: item.investment,
            revenue: item.revenue,
            sales: item.sales,
            leads: item.leads,
            profit: item.revenue - item.investment,
            roas: item.investment > 0 ? item.revenue / item.investment : 0,
            cpa: item.sales > 0 ? item.investment / item.sales : 0,
            cpa_leads: item.leads > 0 ? item.investment / item.leads : 0
        }));
    }, [facebookData, kommoData, filterPais, filterProducto, filterCanal, filterElite, useUsd, exchangeRates]);

    const kpiCards = [
        { 
            title: 'Inversión Ads', 
            value: formatMoney(totalGastoPro), 
            data: monthlyMetrics.map(d => ({ date: d.name, value: d.investment })),
            color: '#ef4444' // red-500
        },
        { 
            title: 'Total Leads', 
            value: formatNumber(totalLeads), 
            subValue: `CPL ${formatMoney(cplPro)}`,
            data: monthlyMetrics.map(d => ({ date: d.name, value: d.leads })),
            color: '#14b8a6' // teal-500
        },
        { 
            title: 'Ventas Cerradas', 
            value: formatNumber(totalVentasCount), 
            subValue: `CPR ${formatMoney(cprPro)}`,
            data: monthlyMetrics.map(d => ({ date: d.name, value: d.sales })),
            color: '#22c55e' // green-500
        },
        { 
            title: 'Facturación', 
            value: formatMoney(totalFacturacionPro), 
            data: monthlyMetrics.map(d => ({ date: d.name, value: d.revenue })),
            color: '#3b82f6' // blue-500
        },
        { 
            title: 'Ganancia', 
            value: formatMoney(ganancia), 
            data: monthlyMetrics.map(d => ({ date: d.name, value: d.profit })),
            color: ganancia >= 0 ? '#22c55e' : '#ef4444' // green-500 or red-500
        },
        { 
            title: 'ROAS', 
            value: formatNumber(roasPro) + 'x', 
            data: monthlyMetrics.map(d => ({ date: d.name, value: d.roas })),
            color: '#eab308' // yellow-500
        }
    ];

    // Chart Data
    const chartHelpers = useMemo(() => {
        const getChartDateKey = (date: Date, view: string) => {
            if (!date || isNaN(date.getTime())) return null;
            const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0'), h = String(date.getHours()).padStart(2,'0');
            if(view==='hourly') return `${y}-${m}-${d} ${h}:00`;
            if(view==='daily') return `${y}-${m}-${d}`;
            if(view==='weekly') { const d2 = new Date(date); d2.setDate(d2.getDate() - d2.getDay() + 1); return `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`; }
            if(view==='monthly') return `${y}-${m}`;
            return `${y}-${m}-${d}`;
        };
        const formatLabel = (k: string, v: string) => {
            if(!k) return '';
            if(v==='hourly') return k.split(' ')[1];
            if(v==='daily') return k.split('-').reverse().slice(0,2).join('/');
            return k;
        };
        return { getChartDateKey, formatLabel };
    }, []);

    const lineChartData = useMemo(() => {
        const dataMap: Record<string, { g: number, f: number }> = {};
        filteredFb.forEach(row => {
            const key = chartHelpers.getChartDateKey(row.dateObj, chartView);
            if (!key) return;
            if (!dataMap[key]) dataMap[key] = { g: 0, f: 0 };
            dataMap[key].g += useUsd ? (row['USD REAL'] || 0) : (row['Amount Spent'] || 0);
        });
        totalVentasData.forEach(lead => {
            const date = new Date(lead['Cerrado en']);
            const key = chartHelpers.getChartDateKey(date, chartView);
            if (!key) return;
            if (!dataMap[key]) dataMap[key] = { g: 0, f: 0 };
            let m = lead.monto;
            if (useUsd && exchangeRates) {
                const mon = getMonedaByPais(lead.pais);
                const t = DataService.getRateForDate(exchangeRates, mon, date);
                m = m / t;
            }
            dataMap[key].f += m;
        });
        const sorted = Object.keys(dataMap).sort();
        return { labels: sorted.map(k => chartHelpers.formatLabel(k, chartView)), g: sorted.map(k => dataMap[k].g), f: sorted.map(k => dataMap[k].f) };
    }, [filteredFb, totalVentasData, chartView, useUsd, exchangeRates, chartHelpers]);

    useEffect(() => {
        if (lineChartRef.current && window.Chart) {
            if (lineChartInstance.current) lineChartInstance.current.destroy();
            window.Chart.defaults.color = '#64748b';
            window.Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';

            lineChartInstance.current = new window.Chart(lineChartRef.current, {
                type: 'line',
                data: {
                    labels: lineChartData.labels,
                    datasets: [
                        { label: 'Inversión', data: lineChartData.g, borderColor: '#00f2ff', backgroundColor: 'rgba(0, 242, 255, 0.1)', borderWidth: 2, tension: 0.4, fill: true },
                        { label: 'Facturación', data: lineChartData.f, borderColor: '#0d7ff2', backgroundColor: 'rgba(13, 127, 242, 0.1)', borderWidth: 3, tension: 0.4, fill: true }
                    ]
                },
                options: { 
                    animation: false,
                    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { labels: { color: '#e2e8f0', font: { family: 'Inter', size: 11, weight: '600' } } } },
                    scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { callback: (v: any) => '$' + formatNumber(v) } }, x: { grid: { display: false } } } 
                }
            });
        }
    }, [lineChartData]);

    const countryChartData = useMemo(() => {
        const countryStats: Record<string, number> = {};
        totalVentasData.forEach(l => {
            const p = normalizePaisName(l.pais) || 'Otros';
            countryStats[p] = (countryStats[p] || 0) + 1;
        });
        const entries = Object.entries(countryStats).sort((a,b) => b[1] - a[1]).slice(0, 10);
        return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
    }, [totalVentasData]);

    const revenueByCountryData = useMemo(() => {
        const counts: Record<string, number> = {};
        totalVentasData.forEach(lead => {
            const p = normalizePaisName(lead.pais) || 'Otros';
            let m = lead.monto;
            if (useUsd && exchangeRates) {
                 const mon = getMonedaByPais(lead.pais);
                 const t = DataService.getRateForDate(exchangeRates, mon, new Date(lead['Cerrado en']));
                 m = m / t;
            }
            counts[p] = (counts[p] || 0) + m;
        });
        const entries = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
    }, [totalVentasData, useUsd, exchangeRates]);

    const productChartData = useMemo(() => {
        const productStats: Record<string, number> = {};
        totalVentasData.forEach(l => {
            const p = normalizeProductoName(l.producto) || 'Otros';
            productStats[p] = (productStats[p] || 0) + 1;
        });
        const entries = Object.entries(productStats).sort((a,b) => b[1] - a[1]).slice(0, 10);
        return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
    }, [totalVentasData]);

    const revenueByProductData = useMemo(() => {
        const counts: Record<string, number> = {};
        totalVentasData.forEach(lead => {
            const p = normalizeProductoName(lead.producto) || 'Otros';
            let m = lead.monto;
            if (useUsd && exchangeRates) {
                 const mon = getMonedaByPais(lead.pais);
                 const t = DataService.getRateForDate(exchangeRates, mon, new Date(lead['Cerrado en']));
                 m = m / t;
            }
            counts[p] = (counts[p] || 0) + m;
        });
        const entries = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
    }, [totalVentasData, useUsd, exchangeRates]);

    useEffect(() => {
        if (!window.Chart) return;

        // Country Sales Chart
        if (countryChartRef.current) {
            if (countryChartInstance.current) countryChartInstance.current.destroy();
            countryChartInstance.current = new window.Chart(countryChartRef.current, {
                type: 'bar',
                data: {
                    labels: countryChartData.labels,
                    datasets: [{ label: 'Ventas Cerradas', data: countryChartData.values, backgroundColor: '#0d7ff2', borderRadius: 6, barThickness: 20 }]
                },
                options: {
                    animation: false,
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { precision: 0 } }, y: { grid: { display: false } } }
                }
            });
        }

        // Revenue by Country Chart
        if (revenueCountryChartRef.current) {
            if (revenueCountryChartInstance.current) revenueCountryChartInstance.current.destroy();
            revenueCountryChartInstance.current = new window.Chart(revenueCountryChartRef.current, {
                type: 'bar',
                data: {
                    labels: revenueByCountryData.labels,
                    datasets: [{ label: 'Facturación', data: revenueByCountryData.values, backgroundColor: '#a855f7', borderRadius: 6, barThickness: 20 }]
                },
                options: {
                    animation: false,
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${formatMoney(c.raw)}` } } },
                    scales: { x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { callback: (v: any) => formatMoney(v) } }, y: { grid: { display: false } } }
                }
            });
        }

        // Product Sales Chart
        if (productChartRef.current) {
            if (productChartInstance.current) productChartInstance.current.destroy();
            productChartInstance.current = new window.Chart(productChartRef.current, {
                type: 'bar',
                data: {
                    labels: productChartData.labels,
                    datasets: [{ label: 'Ventas Cerradas', data: productChartData.values, backgroundColor: '#10b981', borderRadius: 6, barThickness: 20 }]
                },
                options: {
                    animation: false,
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { precision: 0 } }, y: { grid: { display: false } } }
                }
            });
        }

        // Revenue by Product Chart
        if (revenueProductChartRef.current) {
            if (revenueProductChartInstance.current) revenueProductChartInstance.current.destroy();
            revenueProductChartInstance.current = new window.Chart(revenueProductChartRef.current, {
                type: 'bar',
                data: {
                    labels: revenueByProductData.labels,
                    datasets: [{ label: 'Facturación', data: revenueByProductData.values, backgroundColor: '#f59e0b', borderRadius: 6, barThickness: 20 }]
                },
                options: {
                    animation: false,
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${formatMoney(c.raw)}` } } },
                    scales: { x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { callback: (v: any) => formatMoney(v) } }, y: { grid: { display: false } } }
                }
            });
        }
    }, [countryChartData, revenueByCountryData, productChartData, revenueByProductData]);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Vista General</h2>
                    <p className="text-slate-500 mt-1">Rendimiento en tiempo real de WhatsApp y Ads</p>
                </div>
                <div className="glass-card p-2 rounded-2xl flex flex-wrap gap-2 items-center relative z-30">
                    <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/5 px-3">
                        <span className={`text-[10px] font-bold px-1 ${!useUsd ? 'text-primary' : 'text-slate-500'}`}>ORIG</span>
                        <button onClick={() => onFiltersChange({ useUsd: !useUsd })} className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${useUsd ? 'bg-neon-green' : 'bg-slate-700'}`}>
                            <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${useUsd ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                        <span className={`text-[10px] font-bold px-1 ${useUsd ? 'text-neon-green' : 'text-slate-500'}`}>USD</span>
                    </div>
                    <MultiSelect placeholder="País" options={paisesOptions} selected={filterPais} onChange={v => onFiltersChange({ filterPais: v })} icon="public" />
                    <MultiSelect placeholder="Producto" options={productosOptions} selected={filterProducto} onChange={v => onFiltersChange({ filterProducto: v })} icon="inventory_2" />
                    <MultiSelect placeholder="Fuente" options={fuentesOptions} selected={filterCanal} onChange={v => onFiltersChange({ filterCanal: v })} icon="hub" />
                    <MultiSelect placeholder="ELITE" options={elitesList} selected={filterElite} onChange={v => onFiltersChange({ filterElite: v })} icon="star" />
                    <DateRangePicker value={dateRange} onChange={(r) => onFiltersChange({ dateRange: r })} />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 relative z-0">
                {kpiCards.map((kpi, idx) => (
                    <KPICard 
                        key={idx}
                        title={kpi.title}
                        value={kpi.value}
                        subValue={(kpi as any).subValue}
                        data={kpi.data}
                        color={kpi.color}
                    />
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-0">
                {/* Top Left: Conversion Rate */}
                <div className="glass-card p-8 rounded-[2rem] flex flex-col gap-6 items-center justify-center h-[320px]">
                    <div className="w-full text-left">
                        <h3 className="text-white text-xl font-bold">Tasa de Conversión</h3>
                        <p className="text-slate-500 text-sm">Ventas / Leads</p>
                    </div>
                    <div className="flex-1 w-full flex items-center justify-center">
                        <ConversionGauge value={conversionRate} />
                    </div>
                </div>

                {/* Top Right: Investment vs Revenue */}
                <div className="glass-card p-8 rounded-[2rem] flex flex-col gap-6 h-[320px]">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-white text-xl font-bold">Inversión vs. Facturación</h3>
                            <p className="text-slate-500 text-sm">Seguimiento de rendimiento</p>
                        </div>
                        <div className="flex bg-white/5 p-1 rounded-full border border-white/5">
                            {[{ id: 'hourly', label: '1H' }, { id: 'daily', label: '1D' }, { id: 'weekly', label: '1W' }, { id: 'monthly', label: '1M' }].map(v => (
                                <button key={v.id} onClick={() => setChartView(v.id)} className={`px-2 py-1 text-[10px] font-bold rounded-full transition-all ${chartView === v.id ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>{v.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="relative flex-1 w-full mt-4"><canvas ref={lineChartRef}></canvas></div>
                </div>

                {/* Bottom Left: Revenue by Country */}
                <div className="glass-card p-8 rounded-[2rem] flex flex-col gap-6 h-[350px]">
                    <div>
                        <h3 className="text-white text-xl font-bold">Facturación por País</h3>
                        <p className="text-slate-500 text-sm">Distribución geográfica de ingresos</p>
                    </div>
                    <div className="flex-1 relative"><canvas ref={revenueCountryChartRef}></canvas></div>
                </div>

                {/* Bottom Right: Sales by Country */}
                <div className="glass-card p-8 rounded-[2rem] flex flex-col gap-6 h-[350px]">
                    <div>
                        <h3 className="text-white text-xl font-bold">Ventas por País</h3>
                        <p className="text-slate-500 text-sm">Distribución geográfica de ventas</p>
                    </div>
                    <div className="flex-1 relative"><canvas ref={countryChartRef}></canvas></div>
                </div>

                {/* Product Revenue Chart */}
                <div className="glass-card p-8 rounded-[2rem] flex flex-col gap-6 h-[350px]">
                    <div>
                        <h3 className="text-white text-xl font-bold">Facturación por Producto</h3>
                        <p className="text-slate-500 text-sm">Ingresos por cada línea de producto</p>
                    </div>
                    <div className="flex-1 relative"><canvas ref={revenueProductChartRef}></canvas></div>
                </div>

                {/* Product Sales Chart */}
                <div className="glass-card p-8 rounded-[2rem] flex flex-col gap-6 h-[350px]">
                    <div>
                        <h3 className="text-white text-xl font-bold">Ventas por Producto</h3>
                        <p className="text-slate-500 text-sm">Volumen de ventas por producto</p>
                    </div>
                    <div className="flex-1 relative"><canvas ref={productChartRef}></canvas></div>
                </div>
            </div>

            {/* History Table */}
            <div className="glass-card rounded-[2rem] relative z-0">
                <div className="px-8 py-6 border-b border-white/5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                         <div>
                             <h3 className="text-white text-xl font-bold">Desglose Histórico</h3>
                             <p className="text-slate-500 text-sm">Rendimiento diario detallado por dimensión</p>
                         </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-full md:w-auto"><MultiSelect placeholder="Países" options={paisesOptions} selected={filterPais} onChange={v => onFiltersChange({ filterPais: v })} icon="public" align="left" /></div>
                        <div className="w-full md:w-auto"><MultiSelect placeholder="Productos" options={productosOptions} selected={filterProducto} onChange={v => onFiltersChange({ filterProducto: v })} icon="inventory_2" align="left" /></div>
                        <div className="w-full md:w-auto"><MultiSelect placeholder="Fuentes" options={fuentesOptions} selected={filterCanal} onChange={v => onFiltersChange({ filterCanal: v })} icon="hub" align="left" /></div>
                        <div className="w-full md:w-auto"><MultiSelect placeholder="ELITE" options={elitesList} selected={filterElite} onChange={v => onFiltersChange({ filterElite: v })} icon="star" align="left" /></div>
                        <div className="w-full md:w-auto"><DateRangePicker value={dateRange} onChange={(r) => onFiltersChange({ dateRange: r })} align="left" /></div>
                        
                        <div className="w-full md:w-auto">
                            <button onClick={() => setHistoryOnlyWithDelivery(!historyOnlyWithDelivery)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${historyOnlyWithDelivery ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>Solo Activos</button>
                        </div>

                        <div className="relative ml-auto md:ml-0" ref={historyColManagerRef}>
                            <button onClick={() => setShowHistoryColManager(!showHistoryColManager)} className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all shadow-sm"><span className="material-symbols-outlined text-xl">settings</span></button>
                             {showHistoryColManager && (
                                <div className="absolute right-0 top-12 w-64 glass-card shadow-2xl p-4 z-50 rounded-xl animate-fade-in border border-white/10 bg-surface-dark max-h-[80vh] overflow-y-auto custom-scrollbar">
                                    <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Columnas y Orden</h4>
                                    <div className="space-y-1.5">
                                        {historyColOrder.map((colId, idx) => {
                                            const c = HISTORY_COLUMNS_DEF.find(x => x.id === colId);
                                            if (!c) return null;
                                            return (
                                                <div key={c.id} className="flex items-center gap-2 group">
                                                    <label className="flex items-center gap-2.5 p-1.5 hover:bg-white/5 cursor-pointer rounded-lg flex-1">
                                                        <input type="checkbox" className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary" checked={historyVisibleCols.includes(c.id)} onChange={() => setHistoryVisibleCols(historyVisibleCols.includes(c.id) ? historyVisibleCols.filter(x => x!==c.id) : [...historyVisibleCols, c.id])} />
                                                        <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors truncate">{c.name}</span>
                                                    </label>
                                                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => {
                                                            if (idx === 0) return;
                                                            const newOrder = [...historyColOrder];
                                                            [newOrder[idx-1], newOrder[idx]] = [newOrder[idx], newOrder[idx-1]];
                                                            setHistoryColOrder(newOrder);
                                                        }} className="text-slate-500 hover:text-white"><span className="material-symbols-outlined text-xs">expand_less</span></button>
                                                        <button onClick={() => {
                                                            if (idx === historyColOrder.length - 1) return;
                                                            const newOrder = [...historyColOrder];
                                                            [newOrder[idx+1], newOrder[idx]] = [newOrder[idx], newOrder[idx+1]];
                                                            setHistoryColOrder(newOrder);
                                                        }} className="text-slate-500 hover:text-white"><span className="material-symbols-outlined text-xs">expand_more</span></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="overflow-hidden rounded-b-[2rem]">
                    <HistorialDiario 
                        filteredFacebookData={filteredFb}
                        filteredKommoData={filteredKommoForHistory}
                        useUsd={useUsd}
                        exchangeRates={exchangeRates}
                        visibleCols={historyVisibleCols}
                        colOrder={historyColOrder}
                        localDateRange={dateRange}
                        onlyWithDelivery={historyOnlyWithDelivery}
                        onAddTask={onAddTask}
                    />
                </div>
            </div>
        </div>
    );
};

// HistorialDiario Component Refactored
const HistorialDiario: React.FC<any> = ({ filteredFacebookData, filteredKommoData, useUsd, exchangeRates, visibleCols, colOrder, localDateRange, onlyWithDelivery, onAddTask }) => {
    // ... [Content of HistorialDiario remains unchanged but inherits the passed filterElite] ...
    
    // --- TASK STATE ---
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskNote, setTaskNote] = useState('');
    const [activeRow, setActiveRow] = useState<any>(null);
    const taskInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (showTaskModal && taskInputRef.current) setTimeout(() => taskInputRef.current?.focus(), 100);
    }, [showTaskModal]);

    const activeColumns = useMemo(() => {
        const ordered = colOrder || HISTORY_COLUMNS_DEF.map(c => c.id);
        return ordered
            .filter(id => visibleCols.includes(id))
            .map(id => HISTORY_COLUMNS_DEF.find(c => c.id === id))
            .filter(Boolean) as any[];
    }, [visibleCols, colOrder]);
    
    const historialData = useMemo(() => {
        const dataMap: Record<string, any> = {};
        
        // Use pre-filtered data
        filteredFacebookData.forEach((row: any) => {
            const val = useUsd ? (row['USD REAL'] || 0) : (row['Amount Spent'] || 0);
            if (onlyWithDelivery && val < 0.01) return;

            // No need to check date or filters again
            
            const pais = normalizePaisName(row.parsed_pais) || 'Otros';
            const prod = normalizeProductoName(row.parsed_producto) || 'General';
            const fuente = cleanAndNormalizeSource(row.parsed_fuente);
            const dateStr = `${row.dateObj.getFullYear()}-${String(row.dateObj.getMonth()+1).padStart(2,'0')}-${String(row.dateObj.getDate()).padStart(2,'0')}`;
            const key = `${dateStr}|||${pais}|||${prod}|||${fuente}`;
            
            if (!dataMap[key]) dataMap[key] = { date: dateStr, pais: pais, producto: prod, fuente: fuente, gasto: 0, mensajes: 0, ventas_fb: 0, leads: 0, ventas: 0, facturacion: 0 };
            dataMap[key].gasto += val;
            dataMap[key].mensajes += (row['Messaging Conversations Started'] || 0);
            dataMap[key].ventas_fb += (row['Purchases'] || 0);
        });

        const parseLeadDate = (d: any) => { if (!d) return null; const date = new Date(d); return isNaN(date.getTime()) ? null : date; };

        filteredKommoData.forEach((lead: any) => {
            const pais = normalizePaisName(lead.pais) || 'Otros';
            const prod = normalizeProductoName(lead.producto) || 'General';
            const fuente = cleanAndNormalizeSource(lead.fuente_normalizada || lead.Fuente);
            const created = parseLeadDate(lead['Creado en']);
            const closed = parseLeadDate(lead['Cerrado en']);
            const isCashing = lead.status_pipeline === 'CASHING';
            
            // No need to check filters again
            
            // We still need to check which date matches the range for correct attribution to the day
            // But since the lead IS in the range (either created or closed), we just check which one applies
            
            if (created && created >= localDateRange.start && created <= localDateRange.end) {
                const dateKey = `${created.getFullYear()}-${String(created.getMonth()+1).padStart(2,'0')}-${String(created.getDate()).padStart(2,'0')}`;
                const key = `${dateKey}|||${pais}|||${prod}|||${fuente}`;
                if (dataMap[key]) dataMap[key].leads++;
                else dataMap[key] = { date: dateKey, pais: pais, producto: prod, fuente: fuente, gasto: 0, mensajes: 0, ventas_fb: 0, leads: 1, ventas: 0, facturacion: 0 };
            }
            if (isCashing && closed && closed >= localDateRange.start && closed <= localDateRange.end) {
                const dateKey = `${closed.getFullYear()}-${String(closed.getMonth()+1).padStart(2,'0')}-${String(closed.getDate()).padStart(2,'0')}`;
                const key = `${dateKey}|||${pais}|||${prod}|||${fuente}`;
                if (!dataMap[key]) dataMap[key] = { date: dateKey, pais: pais, producto: prod, fuente: fuente, gasto: 0, mensajes: 0, ventas_fb: 0, leads: 0, ventas: 0, facturacion: 0 };
                dataMap[key].ventas++;
                const mon = getMonedaByPais(lead.pais);
                const t = DataService.getRateForDate(exchangeRates, mon, closed);
                dataMap[key].facturacion += useUsd ? (lead.monto / t) : lead.monto;
            }
        });

        let rows = Object.values(dataMap).map((r: any) => ({
            ...r,
            ganancia: r.facturacion - r.gasto,
            roas: r.gasto > 0 ? r.facturacion / r.gasto : 0,
            cpl: r.leads > 0 ? r.gasto / r.leads : 0,
            cpv: r.ventas > 0 ? r.gasto / r.ventas : 0,
            tasaConversion: r.leads > 0 ? (r.ventas / r.leads) * 100 : 0
        }));

        if (onlyWithDelivery) {
            rows = rows.filter(r => r.gasto > 0);
        }

        return rows.sort((a: any, b: any) => b.date.localeCompare(a.date) || a.pais.localeCompare(b.pais));
    }, [filteredFacebookData, filteredKommoData, localDateRange, useUsd, exchangeRates, onlyWithDelivery]);

    // ... [Task Modal Rendering and Table Rendering - Same as before] ...
    const totals = useMemo(() => {
        if (!historialData.length) return null;
        const t = { gasto: 0, mensajes: 0, ventas_fb: 0, leads: 0, ventas: 0, facturacion: 0, ganancia: 0 };
        historialData.forEach(r => {
            t.gasto += r.gasto;
            t.mensajes += r.mensajes;
            t.ventas_fb += r.ventas_fb;
            t.leads += r.leads;
            t.ventas += r.ventas;
            t.facturacion += r.facturacion;
            t.ganancia += r.ganancia;
        });
        return {
            ...t,
            roas: t.gasto > 0 ? t.facturacion / t.gasto : 0,
            cpl: t.leads > 0 ? t.gasto / t.leads : 0,
            cpv: t.ventas > 0 ? t.gasto / t.ventas : 0,
            tasaConversion: t.leads > 0 ? (t.ventas / t.leads) * 100 : 0
        };
    }, [historialData]);

    const openTaskModal = (row: any) => {
        setActiveRow(row);
        setTaskNote('');
        setShowTaskModal(true);
    };

    const confirmSaveTask = () => {
        if (!taskNote.trim() || !activeRow || !onAddTask) return;
        onAddTask({
            description: taskNote,
            context: {
                rowId: 'HISTORY-' + Date.now(), 
                pais: activeRow.pais || 'N/A',
                producto: activeRow.producto || 'N/A',
                fuente: activeRow.fuente || 'N/A',
                pc: 'Historical Data',
                campaignName: `Data: ${activeRow.date}`,
                adSetName: `Source: ${activeRow.fuente}`
            }
        });
        setShowTaskModal(false);
        setActiveRow(null);
        setTaskNote('');
    };

    // --- VIRTUALIZATION / PAGINATION STATE ---
    const [displayLimit, setDisplayLimit] = useState(50);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Reset limit when data changes
    useEffect(() => {
        setDisplayLimit(50);
        if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
    }, [historialData]);

    // Infinite Scroll Handler
    const handleScroll = () => {
        if (tableContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                setDisplayLimit(prev => Math.min(prev + 50, historialData.length));
            }
        }
    };

    const visibleRows = useMemo(() => historialData.slice(0, displayLimit), [historialData, displayLimit]);

    return (
        <div className="overflow-x-auto relative max-h-[600px] custom-scrollbar" ref={tableContainerRef} onScroll={handleScroll}>
            {showTaskModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-sm" onClick={() => setShowTaskModal(false)}></div>
                    <div className="relative w-full max-w-lg glass-card rounded-2xl border border-white/10 shadow-2xl animate-fade-in flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-xl">assignment_add</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Agregar Tarea desde Historial</h3>
                                    <p className="text-xs text-slate-400">Para: <span className="text-primary font-semibold">{activeRow?.date} - {activeRow?.producto}</span></p>
                                </div>
                            </div>
                            <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-white transition-colors"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="p-6 bg-[#0f1115]">
                            <textarea ref={taskInputRef} value={taskNote} onChange={(e) => setTaskNote(e.target.value)} className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none placeholder:text-slate-600" placeholder="¿Qué hay que hacer?" onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmSaveTask(); } }} />
                        </div>
                        <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end gap-3">
                            <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-lg transition-colors">Cancelar</button>
                            <button onClick={confirmSaveTask} disabled={!taskNote.trim()} className="px-6 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center gap-2"><span className="material-symbols-outlined text-sm">save</span> Guardar Tarea</button>
                        </div>
                    </div>
                </div>
            )}
            <table className="w-full text-left">
                <thead className="bg-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-widest sticky top-0 backdrop-blur-md z-10">
                    <tr>
                        {activeColumns.map(c => <th key={c.id} className="px-6 py-4 border-b border-white/5 whitespace-nowrap">{c.name}</th>)}
                        <th className="px-6 py-4 border-b border-white/5 text-center">TAREA</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                    {visibleRows.map((r: any, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                            {activeColumns.map(c => {
                                let v = r[c.id];
                                if (c.type === 'money') v = formatMoney(v);
                                else if (c.type === 'number') {
                                    if (c.id === 'roas') v = formatNumber(v) + 'x';
                                    else if (c.id === 'tasaConversion') v = formatNumber(v) + '%';
                                    else v = formatNumber(v);
                                }
                                return <td key={c.id} className={`px-6 py-3 font-medium whitespace-nowrap ${c.id === 'ganancia' ? (r.ganancia >= 0 ? 'text-neon-green' : 'text-red-500') : 'text-slate-300'}`}>{v || '-'}</td>;
                            })}
                            <td className="px-6 py-3 text-center">
                                <button onClick={() => openTaskModal(r)} className="p-1.5 rounded-lg bg-white/5 hover:bg-primary/20 text-slate-500 hover:text-primary transition-colors" title="Agregar Tarea"><span className="material-symbols-outlined text-base">add_task</span></button>
                            </td>
                        </tr>
                    ))}
                    {visibleRows.length < historialData.length && (
                        <tr>
                            <td colSpan={activeColumns.length + 1} className="px-6 py-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
                                Mostrando {visibleRows.length} de {historialData.length} filas. Desliza para ver más.
                            </td>
                        </tr>
                    )}
                </tbody>
                {totals && (
                    <tfoot className="bg-white/5 font-bold border-t-2 border-white/10 sticky bottom-0 z-10 backdrop-blur-md">
                        <tr>
                            {activeColumns.map((c, idx) => {
                                if (['date', 'pais', 'producto', 'fuente'].includes(c.id)) return <td key={c.id} className="px-6 py-4 text-white uppercase text-[10px] tracking-widest">{idx === 0 ? 'Totales' : ''}</td>;
                                const rawValue = totals[c.id as keyof typeof totals];
                                let v: any = rawValue;
                                if (c.type === 'money') v = formatMoney(rawValue);
                                else if (c.type === 'number') { if (c.id === 'roas') v = formatNumber(rawValue) + 'x'; else if (c.id === 'tasaConversion') v = formatNumber(rawValue) + '%'; else v = formatNumber(rawValue); }
                                return <td key={c.id} className={`px-6 py-4 ${c.id === 'ganancia' ? (totals.ganancia >= 0 ? 'text-neon-green' : 'text-red-500') : 'text-white'}`}>{v}</td>;
                            })}
                            <td className="px-6 py-4"></td>
                        </tr>
                    </tfoot>
                )}
            </table>
            {historialData.length === 0 && <div className="py-20 text-center"><span className="text-slate-500 font-bold uppercase tracking-widest text-xs">No hay datos disponibles para los filtros seleccionados</span></div>}
        </div>
    );
};

export default React.memo(DashboardView);
