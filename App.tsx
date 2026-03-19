
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DataService } from './services/dataService';
import { AppConfig, KommoLead, FacebookRow, ExchangeRates, GlobalFilters, Task, DataSourceType, Cobro } from './types';
import { getDateRange, normalizePaisName, normalizeProductoName, getMonedaByPais, extractLast4, reviveDates } from './utils';
import ConfigPanel from './components/ConfigPanel';
import DashboardView from './components/DashboardView';
import FacebookView from './components/FacebookView';
import PipelineView from './components/PipelineView';
import ErrorsView from './components/ErrorsView';
import TasasView from './components/TasasView';
import VentasManualesView from './components/VentasManualesView';
import CobrosView from './components/CobrosView';
import StrategyAuditView from './components/StrategyAuditView';
import TasksView from './components/TasksView';
import AiAssistant from './components/AiAssistant';
import Modal from './components/Modal';

const DEFAULT_JUAN_PERSONA = `Eres PECAS Bot, un asistente de marketing experto, implacable y altamente analítico.

TU PERSONA:
- Eres un senior media buyer para Meta, TikTok y Google Ads.
- Eres directo, conciso y te enfocas en el ROAS (Retorno de la Inversión Publicitaria) y el Beneficio Neto.
- No usas relleno. Das consejos accionables.
- Hablas español.

TU MISIÓN:
- Auditar los datos del usuario.
- Identificar campañas con pérdidas (Gasto alto, ROAS bajo).
- Identificar oportunidades de escalado (ROAS alto, CPA estable).
- Sé crítico. Si una campaña es mala, di "MÁTALA".

CONOCIMIENTO ESTRATÉGICO:
- ROAS < 1.0 en Fase de Escala: Matar inmediatamente.
- ROAS > 2.0: Escalar un 20% el presupuesto diario.
- Sin ventas pero con gasto alto: Revisar CTR y Landing Page.`;

const App: React.FC = () => {
    // Persistencia de la Vista Actual
    const [view, setView] = useState(() => localStorage.getItem('app_current_view') || 'dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

    useEffect(() => {
        localStorage.setItem('app_current_view', view);
    }, [view]);

    const [showConfig, setShowConfig] = useState(false);
    const [showAi, setShowAi] = useState(false);
    const [aiSpecificContext, setAiSpecificContext] = useState<string | null>(null);

    // --- MODALS STATE ---
    const [deleteTaskModal, setDeleteTaskModal] = useState<{ isOpen: boolean; taskId: string | null }>({ isOpen: false, taskId: null });

    // --- TASK MANAGER STATE ---
    const [tasks, setTasks] = useState<Task[]>(() => {
        const saved = localStorage.getItem('app_tasks_data');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('app_tasks_data', JSON.stringify(tasks));
    }, [tasks]);

    const handleAddTask = (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'history'>) => {
        const newTask: Task = {
            id: `task-${Date.now()}`,
            description: taskData.description,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            history: [{ timestamp: new Date().toISOString(), note: 'Tarea creada: ' + taskData.description }],
            context: taskData.context
        };
        setTasks(prev => [newTask, ...prev]);
    };

    const toggleTaskStatus = (taskId: string) => {
        setTasks(prev => prev.map(t => {
            if (t.id === taskId) {
                const newStatus = t.status === 'PENDING' ? 'DONE' : 'PENDING';
                return { 
                    ...t, 
                    status: newStatus,
                    history: [...t.history, { timestamp: new Date().toISOString(), note: `Estado cambiado a ${newStatus === 'PENDING' ? 'PENDIENTE' : 'COMPLETADO'}` }]
                };
            }
            return t;
        }));
    };

    const handleAddHistoryNote = (taskId: string, note: string) => {
        setTasks(prev => prev.map(t => {
            if (t.id === taskId) {
                return {
                    ...t,
                    history: [...t.history, { timestamp: new Date().toISOString(), note }]
                };
            }
            return t;
        }));
    };

    const handleDeleteTask = (taskId: string) => {
        setDeleteTaskModal({ isOpen: true, taskId });
    };

    const confirmDeleteTask = () => {
        if (deleteTaskModal.taskId) {
            setTasks(prev => prev.filter(t => t.id !== deleteTaskModal.taskId));
        }
        setDeleteTaskModal({ isOpen: false, taskId: null });
    };
    // --------------------------

    // --- AI SYSTEM PROMPT MANAGEMENT ---
    const [systemPrompt, setSystemPrompt] = useState(() => {
        return localStorage.getItem('juan_ads_system_prompt') || DEFAULT_JUAN_PERSONA;
    });

    const [cobros, setCobros] = useState<Cobro[]>(() => {
        try {
            const savedV2 = localStorage.getItem('app_cobros_data_v2');
            if (savedV2) return JSON.parse(savedV2);
            const savedLegacy = localStorage.getItem('app_cobros_data');
            if (savedLegacy) {
                const parsed = JSON.parse(savedLegacy);
                if (Array.isArray(parsed)) {
                    return parsed.map((item: any, index: number) => ({
                        ...item,
                        id: `id-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
                        monto: Number(item.monto) || 0,
                        tasa: Number(item.tasa) || 0,
                        usd: Number(item.usd) || 0
                    }));
                }
            }
            return [];
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('app_cobros_data_v2', JSON.stringify(cobros));
    }, [cobros]);

    const handleSaveSystemPrompt = (newPrompt: string) => {
        setSystemPrompt(newPrompt);
        localStorage.setItem('juan_ads_system_prompt', newPrompt);
    };
    // -----------------------------------

    const [loading, setLoading] = useState(false); // No blocking load initially if cache exists
    const [isSyncing, setIsSyncing] = useState(false); // Sincronización en segundo plano
    const [lastCloudSync, setLastCloudSync] = useState<Date | null>(null);
    
    // Referencia para saber si ya cargamos datos al menos una vez
    const isFirstLoadRef = useRef(true);

    const [config, setConfig] = useState<AppConfig>(() => {
        const saved = localStorage.getItem('appConfig_v2');
        
        // Default URLs for PECAS
        const defaultPecas = { 
            dataSourceType: 'SHEETS' as DataSourceType,
            facebookUrl: 'https://script.google.com/macros/s/AKfycbwjCtlf3TF2Oa0iMpdivXY3k3Y_2bU0qZ3TWFAzmNMOgZDhXWnY5TnsjTxuaToi5HiqhA/exec',
            kommoUrl: 'https://script.google.com/macros/s/AKfycby3XTCR796qCPFghoL4lOjJorHzzSLGyEi_sgMAH4GOhD2Fgtv_Lmh93AUhDGv4mSdv/exec',
            ventasManualesUrl: '', 
            cloudSyncUrl: 'https://script.google.com/macros/s/AKfycbwr16932MHZV-BHYI4KNtoEeTUD98c-_d7G_I0_ypIvQ8dBA7Ulhy2y0YqMyT2RsiVa/exec' 
        };
        const defaultLasMejores = { dataSourceType: 'SHEETS' as DataSourceType, facebookUrl: '', kommoUrl: '', ventasManualesUrl: '', cloudSyncUrl: '' };
        
        // Legacy Support check
        const legacy = localStorage.getItem('appConfig');
        let initialConfig = { pecas: defaultPecas, lasMejores: defaultLasMejores };

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge to ensure structure exists even if saved is partial
                initialConfig = {
                    pecas: { 
                        ...defaultPecas, 
                        ...parsed.pecas,
                        // Use default if saved is empty (migration for new feature)
                        cloudSyncUrl: parsed.pecas?.cloudSyncUrl || defaultPecas.cloudSyncUrl
                    },
                    lasMejores: { ...defaultLasMejores, ...parsed.lasMejores }
                };
            } catch(e) {}
        } else if (legacy) {
            try {
                const parsedLegacy = JSON.parse(legacy);
                // Assume legacy config was for PECAS, but respect defaults if legacy is empty
                initialConfig.pecas = { 
                    ...defaultPecas,
                    ...parsedLegacy 
                };
            } catch(e) {}
        }
        return initialConfig;
    });
    
    const [data, setData] = useState<{ kommo: KommoLead[], facebook: FacebookRow[], rates: ExchangeRates, manual: any[] }>(() => {
        const saved = localStorage.getItem('app_cached_data');
        if (saved) {
            try {
                // Use reviver to restore Date objects
                return JSON.parse(saved, reviveDates);
            } catch (e) {
                console.error("Failed to load cached data", e);
            }
        }
        return { kommo: [], facebook: [], rates: {}, manual: [] };
    });

    // Save data to cache whenever it updates
    useEffect(() => {
        if (data.kommo.length > 0 || data.facebook.length > 0) {
            try {
                localStorage.setItem('app_cached_data', JSON.stringify(data));
            } catch (e) {
                console.warn("Cache storage failed (quota exceeded?)", e);
            }
        }
    }, [data]);

    // Persistencia de Filtros Globales
    const [globalFilters, setGlobalFilters] = useState<GlobalFilters>(() => {
        const saved = localStorage.getItem('app_global_filters');
        const defaultFilters: GlobalFilters = {
            fb: {
                dateRange: getDateRange('today'),
                viewLevel: 'campaign',
                searchTags: [],
                useUsd: true,
                onlyWithDelivery: false,
                activeFilter: { campaign: null, adset: null },
                selectionFilter: null,
                filterElite: ['PECAS'] // Default
            },
            pipeline: {
                dateRange: getDateRange('today'),
                filterPais: [],
                filterProducto: [],
                filterPalabrasClave: [],
                filterFuente: [],
                filterElite: ['PECAS'],
                dateFilterType: 'created'
            },
            dashboard: {
                dateRange: getDateRange('thisMonth'),
                filterPais: [],
                filterProducto: [],
                filterElite: ['PECAS'],
                filterCanal: [],
                useUsd: true
            }
        };

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const restoreDates = (range: any) => {
                    if (!range) return getDateRange('today');
                    return { ...range, start: new Date(range.start), end: new Date(range.end) };
                };
                return {
                    fb: { ...defaultFilters.fb, ...parsed.fb, dateRange: restoreDates(parsed.fb?.dateRange) },
                    pipeline: { ...defaultFilters.pipeline, ...parsed.pipeline, dateRange: restoreDates(parsed.pipeline?.dateRange) },
                    dashboard: { ...defaultFilters.dashboard, ...parsed.dashboard, dateRange: restoreDates(parsed.dashboard?.dateRange) }
                };
            } catch (e) {
                return defaultFilters;
            }
        }
        return defaultFilters;
    });

    useEffect(() => {
        localStorage.setItem('app_global_filters', JSON.stringify(globalFilters));
    }, [globalFilters]);

    const augmentedRates = useMemo(() => {
        if (!data.rates) return data.rates;
        const newRates = { ...data.rates };
        
        cobros.forEach(c => {
            const mon = getMonedaByPais(c.pais);
            if (mon === 'USD' || !c.tasa) return;
            const date = new Date(c.fecha);
            if (isNaN(date.getTime())) return;
            if (!newRates[mon]) newRates[mon] = [];
            const dateStr = date.toISOString().split('T')[0];
            const existingIdx = newRates[mon].findIndex(r => r.dateKey === dateStr);
            if (existingIdx >= 0) {
                newRates[mon][existingIdx] = { ...newRates[mon][existingIdx], rate: Number(c.tasa) };
            } else {
                newRates[mon].push({ date, dateKey: dateStr, rate: Number(c.tasa) });
            }
        });
        
        Object.keys(newRates).forEach(k => {
            newRates[k] = [...newRates[k]].sort((a, b) => b.date.getTime() - a.date.getTime());
        });
        
        return newRates;
    }, [data.rates, cobros]);

    const updateDashboardFilters = (updates: Partial<GlobalFilters['dashboard']>) => {
        setGlobalFilters(prev => ({ ...prev, dashboard: { ...prev.dashboard, ...updates } }));
    };

    const updateFbFilters = (updates: Partial<GlobalFilters['fb']>) => {
        setGlobalFilters(prev => ({ ...prev, fb: { ...prev.fb, ...updates } }));
    };

    const updatePipelineFilters = (updates: Partial<GlobalFilters['pipeline']>) => {
        setGlobalFilters(prev => ({ ...prev, pipeline: { ...prev.pipeline, ...updates } }));
    };

    const loadData = async () => {
        console.log('🔄 Iniciando carga de datos...');
        // If we have cached data, we are just syncing. If not, we are loading.
        const hasCache = data.kommo.length > 0 || data.facebook.length > 0;
        
        if (!hasCache && isFirstLoadRef.current) setLoading(true);
        else setIsSyncing(true);

        const startTime = Date.now();

        try {
            const brands = [
                { id: 'PECAS', cfg: config.pecas },
                { id: 'LASMEJORES', cfg: config.lasMejores }
            ];

            const allKommo: KommoLead[] = [];
            const allFb: FacebookRow[] = [];
            const allManual: any[] = [];
            let allRates: ExchangeRates = { COP: [], CLP: [], PEN: [], MXN: [], VES: [], ARS: [] };

            await Promise.all(brands.map(async (brand) => {
                // Determine if configured either via Sheets URL OR Supabase Credentials
                const isConfigured = brand.cfg.dataSourceType === 'SUPABASE' 
                    ? (brand.cfg.supabaseUrl && brand.cfg.supabaseKey)
                    : (brand.cfg.facebookUrl || brand.cfg.kommoUrl);

                if (!isConfigured) return;

                // Use new generic fetcher
                const [kommoRaw, fbRaw, manualRaw] = await Promise.all([
                    DataService.fetchBrandData(brand.cfg, 'kommo'),
                    DataService.fetchBrandData(brand.cfg, 'facebook'),
                    DataService.fetchBrandData(brand.cfg, 'manual')
                ]);

                console.log(`[${brand.id}] Fetched: Kommo=${kommoRaw.length}, FB=${fbRaw.length}, Manual=${manualRaw.length}`);

                // --- NORMALIZE & TAG ---
                const normalizedManual = DataService.normalizeVentasManualesData(manualRaw).map(i => ({ ...i, ELITE: brand.id }));
                const normalizedKommo = DataService.normalizeKommoData(kommoRaw).map(i => ({ ...i, ELITE: brand.id }));
                const normalizedFb = DataService.normalizeFacebookData(fbRaw).map(i => ({ ...i, ELITE: brand.id }));
                
                // Rates (Assume FB provides rates)
                const extractedRates = DataService.extractExchangeRates(fbRaw);
                
                // Merge Rates logic (simple merge for now, prioritizing valid dates)
                Object.keys(extractedRates).forEach(k => {
                    allRates[k] = [...allRates[k], ...extractedRates[k]].sort((a,b) => b.date.getTime() - a.date.getTime());
                });

                DataService.unifyAndMapSources(normalizedKommo, normalizedFb, normalizedManual);
                const combinedLeads = DataService.combineKommoWithManual(normalizedKommo, normalizedManual);

                allKommo.push(...combinedLeads);
                allFb.push(...normalizedFb);
                allManual.push(...manualRaw.map((m: any) => ({ ...m, ELITE: brand.id })));
            }));

            // Only update if we actually got data to avoid wiping cache with empty fetch on error
            // Improved logic: Update each key independently if it has data, otherwise keep previous
            const hasRates = Object.values(allRates).some(arr => arr.length > 0);
            
            if (allFb.length > 0 || allKommo.length > 0) {
                setData(prev => ({ 
                    kommo: allKommo.length > 0 ? allKommo : prev.kommo, 
                    facebook: allFb.length > 0 ? allFb : prev.facebook,
                    rates: hasRates ? allRates : prev.rates,
                    manual: allManual.length > 0 ? allManual : prev.manual
                }));
            } else {
                console.warn("⚠️ No data fetched from any source. Keeping previous cache.");
            }
        } catch (e) {
            console.error("Error al cargar datos:", e);
        } finally {
            // Ensure visual feedback lasts at least 800ms
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 800 - elapsed);
            if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
            
            setLoading(false);
            setIsSyncing(false);
            isFirstLoadRef.current = false; // Always mark first load as done to avoid blocking UI on retries
        }
    };

    useEffect(() => { 
        loadData(); 
    }, [config]);

    useEffect(() => {
        const interval = setInterval(() => {
            console.log('🔄 Auto-refresh: Actualizando datos en segundo plano...');
            loadData();
        }, 120000); 
        return () => clearInterval(interval);
    }, [config]);

    const handleSaveConfig = (newConfig: AppConfig) => { 
        setConfig(newConfig); 
        localStorage.setItem('appConfig_v2', JSON.stringify(newConfig)); 
        setShowConfig(false); 
        isFirstLoadRef.current = true;
        loadData();
    };

    // --- AI Context Generation (OPTIMIZED & NON-BLOCKING) ---
    const [aiContextSummary, setAiContextSummary] = useState<string>("Cargando datos...");

    useEffect(() => {
        if (loading || data.facebook.length === 0) return;

        // Use a timeout to yield to the main thread and avoid freezing UI
        const timer = setTimeout(() => {
            const dateRange = globalFilters.dashboard.dateRange;

            // 1. Process Campaign Performance (Aggregation)
            const campaignStats: Record<string, { 
                spend: number, 
                leads: number, 
                sales: number, 
                revenue: number, 
                country: string, 
                source: string, 
                product: string 
            }> = {};

            // Lookup Map for O(1) access: Country|SourceLast4 -> [CampaignNames]
            const campaignLookup = new Map<string, string[]>();

            // Filter and aggregate Facebook Data
            data.facebook.forEach(row => {
                if (row.dateObj < dateRange.start || row.dateObj > dateRange.end) return;

                const name = row['Campaign Name'];
                if (!campaignStats[name]) {
                    campaignStats[name] = { 
                        spend: 0, leads: 0, sales: 0, revenue: 0, 
                        country: row.parsed_pais, 
                        source: row.parsed_fuente,
                        product: row.parsed_producto
                    };
                    
                    // Build Lookup Key
                    const key = `${normalizePaisName(row.parsed_pais)}|${extractLast4(row.parsed_fuente)}`;
                    if (!campaignLookup.has(key)) campaignLookup.set(key, []);
                    campaignLookup.get(key)?.push(name);
                }
                campaignStats[name].spend += (row['USD REAL'] || 0);
                campaignStats[name].leads += (row['Messaging Conversations Started'] || 0);
            });

            // Attribute Sales (Optimized matching logic)
            const sales = data.kommo.filter(k => k.status_pipeline === 'CASHING');
            
            sales.forEach(sale => {
                const closed = new Date(sale['Cerrado en']);
                if (closed < dateRange.start || closed > dateRange.end) return;

                const salePais = normalizePaisName(sale.pais);
                const saleProd = normalizeProductoName(sale.producto);
                const saleSourceId = extractLast4(sale.Fuente || sale.fuente_normalizada);
                
                // Fast Lookup
                const lookupKey = `${salePais}|${saleSourceId}`;
                const potentialCampaigns = campaignLookup.get(lookupKey);

                if (potentialCampaigns) {
                    // Find best match by Product
                    const campaignName = potentialCampaigns.find(name => {
                        const c = campaignStats[name];
                        return normalizeProductoName(c.product) === saleProd;
                    });

                    if (campaignName) {
                        // Convert sale amount to USD
                        const tasa = DataService.getRateForDate(data.rates, getMonedaByPais(sale.pais), closed);
                        const amountUSD = tasa > 0 ? (sale.monto / tasa) : sale.monto;

                        campaignStats[campaignName].sales++;
                        campaignStats[campaignName].revenue += amountUSD;
                    }
                }
            });

            // 2. Format detailed list for AI
            const campaignsList = Object.entries(campaignStats)
                .map(([name, stats]) => {
                    const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
                    const roas = stats.spend > 0 ? stats.revenue / stats.spend : 0;
                    return {
                        nombre: name,
                        gasto_usd: stats.spend.toFixed(2),
                        leads: stats.leads,
                        cpl_usd: cpl.toFixed(2),
                        ventas: stats.sales,
                        ingresos_usd: stats.revenue.toFixed(2),
                        roas: roas.toFixed(2),
                        pais: stats.country
                    };
                })
                .sort((a, b) => parseFloat(b.gasto_usd) - parseFloat(a.gasto_usd)); // Sort by spend

            // 3. Global Totals
            const totalSpend = campaignsList.reduce((acc, c) => acc + parseFloat(c.gasto_usd), 0);
            const totalRev = campaignsList.reduce((acc, c) => acc + parseFloat(c.ingresos_usd), 0);
            
            const summary = JSON.stringify({
                metadatos_contexto: {
                    rango_fechas: dateRange.label,
                    fecha_inicio: dateRange.start.toISOString().split('T')[0],
                    end_date: dateRange.end.toISOString().split('T')[0],
                    generated_at: new Date().toISOString()
                },
                global_metrics: {
                    total_spend: totalSpend.toFixed(2),
                    total_revenue: totalRev.toFixed(2),
                    total_profit: (totalRev - totalSpend).toFixed(2),
                    total_roas: totalSpend > 0 ? (totalRev/totalSpend).toFixed(2) : 0
                },
                campaigns_detailed_performance: campaignsList
            }, null, 2);

            setAiContextSummary(summary);
        }, 100); // 100ms delay to unblock UI

        return () => clearTimeout(timer);

    }, [data, loading, globalFilters.dashboard.dateRange]);

    // --- AUTOMATIC CLOUD SYNC ---
    // Pushes processed data for active brands
    useEffect(() => {
        const brands = [config.pecas, config.lasMejores];
        
        brands.forEach(brandConfig => {
            if (brandConfig.cloudSyncUrl && !loading && data.facebook.length > 0) {
                const timer = setTimeout(() => {
                    const payload = {
                        type: 'DASHBOARD_SYNC',
                        data: aiContextSummary,
                        timestamp: new Date().toISOString()
                    };

                    fetch(brandConfig.cloudSyncUrl!, {
                        method: 'POST',
                        mode: 'no-cors', 
                        body: JSON.stringify(payload)
                    })
                    .then(() => {
                        console.log('☁️ Data pushed to Cloud Sync');
                        setLastCloudSync(new Date());
                    })
                    .catch(e => console.warn('Cloud Sync Warning (likely network or CORS):', e));
                }, 2000);
                return () => clearTimeout(timer);
            }
        });
    }, [aiContextSummary, config, loading, data.facebook.length]);

    const handleAskJuan = (context: string) => {
        setAiSpecificContext(context);
        setShowAi(true);
    };

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'audit', label: 'Auditoría', icon: 'fact_check' },
        { id: 'tasks', label: 'Tareas', icon: 'task_alt' },
        { id: 'facebook', label: 'Ads', icon: 'ads_click' },
        { id: 'pipeline', label: 'Pipeline', icon: 'filter_list' },
        { id: 'tasas', label: 'Tasas', icon: 'currency_exchange' },
        { id: 'cobros', label: 'Cobros', icon: 'account_balance' },
        { id: 'manual', label: 'Manual', icon: 'edit_note' },
        { id: 'errors', label: 'Errores', icon: 'error' }
    ];

    const mobileMenuItems = [
        menuItems[0], // Dashboard
        menuItems[3], // Ads
        menuItems[5], // Tasas
        menuItems[6], // Cobros
        menuItems[2], // Tareas
    ];

    return (
        <div className="flex w-full h-screen overflow-hidden bg-background-dark text-slate-100 font-display">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-72 flex-col h-screen border-r border-white/5 glass-card shrink-0 z-20 overflow-y-auto custom-scrollbar">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(13,127,242,0.5)]">
                            <span className="material-symbols-outlined text-white text-2xl">monitoring</span>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-white text-lg font-bold tracking-tight">PECAS</h1>
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Analytics v2.0</p>
                        </div>
                    </div>
                    <nav className="flex flex-col gap-2">
                        {menuItems.map(item => (
                            <button 
                                key={item.id}
                                onClick={() => setView(item.id)}
                                className={`flex items-center gap-4 px-4 py-3 rounded-full transition-all duration-300 ${
                                    view === item.id 
                                    ? 'sidebar-active text-primary' 
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <span className="material-symbols-outlined">{item.icon}</span>
                                <span className="text-sm font-semibold flex-1 text-left">{item.label}</span>
                                {item.id === 'tasks' && tasks.filter(t => t.status === 'PENDING').length > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {tasks.filter(t => t.status === 'PENDING').length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>
                
                <div className="mt-auto p-6 flex flex-col gap-4">
                     <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/20">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Estado</p>
                        <p className="text-white font-semibold mb-3 flex items-center gap-2">
                            <span className={`size-2 rounded-full ${isSyncing ? 'bg-primary animate-ping' : 'bg-neon-green pulse-live'}`}></span>
                            {isSyncing ? 'Actualizando...' : 'Sistema Online'}
                        </p>
                        <button 
                            onClick={() => {
                                console.log('🖱️ Force Sync clicked');
                                loadData();
                            }}
                            className={`w-full py-2 bg-primary hover:bg-primary/80 text-white text-xs font-bold rounded-full transition-colors flex items-center justify-center gap-2 ${isSyncing ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
                        >
                            <span className={`material-symbols-outlined text-sm inline-block ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                        </button>
                        {lastCloudSync && (
                            <div className="mt-2 text-[10px] text-slate-500 text-center">
                                Última Sinc: {lastCloudSync.toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3 px-2 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors" onClick={() => setShowConfig(true)}>
                        <div className="size-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                             <span className="material-symbols-outlined text-sm">settings</span>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm font-bold text-white leading-tight">Configuración</p>
                            <p className="text-xs text-slate-500">Gestionar Fuentes</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-background-dark/95 backdrop-blur-xl border-t border-white/10 z-50 flex justify-around items-center px-2 pb-4 pt-2">
                {mobileMenuItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => setView(item.id)}
                        className={`flex flex-col items-center justify-center w-16 gap-1 transition-all duration-300 ${
                            view === item.id 
                            ? 'text-primary' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <div className={`p-1.5 rounded-xl transition-all relative ${view === item.id ? 'bg-primary/20' : ''}`}>
                            <span className={`material-symbols-outlined text-2xl ${view === item.id ? 'fill-1' : ''}`}>{item.icon}</span>
                             {item.id === 'tasks' && tasks.filter(t => t.status === 'PENDING').length > 0 && (
                                <span className="absolute -top-1 -right-1 size-3 bg-red-500 rounded-full border border-background-dark"></span>
                            )}
                        </div>
                        <span className="text-[10px] font-bold">{item.label}</span>
                    </button>
                ))}
                
                <button 
                    onClick={() => setShowAi(true)}
                    className="flex flex-col items-center justify-center w-16 gap-1 text-purple-400 hover:text-white transition-all"
                >
                    <div className="p-1.5 rounded-xl bg-purple-500/20">
                        <span className="material-symbols-outlined text-2xl">psychology</span>
                    </div>
                    <span className="text-[10px] font-bold">PECAS Bot</span>
                </button>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-y-auto relative pb-24 md:pb-20">
                {/* Header */}
                <header className="flex items-center justify-between px-4 md:px-10 py-4 md:py-6 sticky top-0 z-40 glass-card border-x-0 border-t-0 border-b border-white/5 bg-background-dark/80 backdrop-blur-lg">
                    {/* Mobile Logo & Status */}
                    <div className="flex items-center gap-3 md:hidden">
                        <div className="size-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(13,127,242,0.5)]">
                            <span className="material-symbols-outlined text-white text-lg">monitoring</span>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-white text-sm font-bold tracking-tight">PECAS</h1>
                            <div className="flex items-center gap-1.5">
                                <span className={`size-1.5 rounded-full transition-colors duration-500 ${isSyncing ? 'bg-primary' : 'bg-neon-green pulse-live'}`}></span>
                                <p className="text-slate-400 text-[10px] font-bold uppercase">En línea</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 flex-1 hidden md:flex">
                        <div className="relative w-full max-w-md">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl">search</span>
                            <input 
                                className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-slate-500 transition-all" 
                                placeholder="Buscar insights, métricas o campañas..." 
                                type="text"
                                disabled
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-6">
                        {/* AI Button Desktop */}
                        <button 
                            onClick={() => setShowAi(!showAi)}
                            className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${showAi ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'}`}
                        >
                            <span className="material-symbols-outlined text-lg">psychology</span>
                            <span className="text-xs font-bold">PECAS Bot</span>
                        </button>

                        <button 
                            onClick={loadData}
                            disabled={isSyncing || loading} 
                            className="md:hidden size-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-primary active:bg-primary active:text-white transition-colors"
                        >
                            <span className={`material-symbols-outlined text-lg ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                        </button>

                        <div className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${isSyncing ? 'bg-primary/10 border-primary/30' : 'bg-neon-green/10 border-neon-green/20'}`}>
                            <div className={`size-2 rounded-full ${isSyncing ? 'bg-primary animate-bounce' : 'bg-neon-green pulse-live'}`}></div>
                            <span className={`text-[10px] font-bold uppercase tracking-tighter ${isSyncing ? 'text-primary' : 'text-neon-green'}`}>
                                {isSyncing ? 'Actualizando...' : 'Datos en Vivo'}
                            </span>
                        </div>
                    </div>
                </header>

                <div className="p-4 md:p-10 space-y-8 h-full">
                    {view === 'dashboard' && (
                        <DashboardView 
                            kommoData={data.kommo} 
                            facebookData={data.facebook} 
                            exchangeRates={augmentedRates} 
                            filters={globalFilters.dashboard} 
                            onFiltersChange={updateDashboardFilters}
                            onAddTask={handleAddTask} 
                        />
                    )}
                    {view === 'audit' && (
                        <StrategyAuditView 
                            facebookData={data.facebook} 
                            kommoData={data.kommo} 
                            exchangeRates={augmentedRates} 
                            filters={globalFilters.dashboard} // Strategy uses dashboard filters initially
                            onAskJuan={handleAskJuan} 
                            onAddTask={handleAddTask} 
                        />
                    )}
                    {view === 'tasks' && (
                        <TasksView 
                            tasks={tasks} 
                            onToggleStatus={toggleTaskStatus} 
                            onDeleteTask={handleDeleteTask}
                            onAddHistoryNote={handleAddHistoryNote}
                        />
                    )}
                    {view === 'facebook' && (
                        <FacebookView 
                            data={data.facebook} 
                            kommoData={data.kommo} 
                            exchangeRates={augmentedRates} 
                            filters={globalFilters.fb} 
                            onFiltersChange={updateFbFilters} 
                            onAddTask={handleAddTask} 
                            tasks={tasks}
                        />
                    )}
                    {view === 'pipeline' && <PipelineView leads={data.kommo} filters={globalFilters.pipeline} onFiltersChange={updatePipelineFilters} />}
                    {view === 'tasas' && <TasasView rates={augmentedRates} />}
                    {view === 'cobros' && (
                        <CobrosView 
                            kommoData={data.kommo} 
                            exchangeRates={augmentedRates} 
                            cobros={cobros}
                            setCobros={setCobros}
                        />
                    )}
                    {view === 'manual' && <VentasManualesView manualData={data.manual} />}
                    {view === 'errors' && <ErrorsView kommoData={data.kommo} />}
                </div>
            </main>

            {/* AI Assistant Panel */}
            <AiAssistant 
                isOpen={showAi} 
                onClose={() => setShowAi(false)} 
                contextSummary={aiContextSummary} 
                specificContext={aiSpecificContext}
                onClearSpecificContext={() => setAiSpecificContext(null)}
                systemPrompt={systemPrompt}
                onSaveSystemPrompt={handleSaveSystemPrompt}
            />

            {showConfig && <ConfigPanel config={config} onSave={handleSaveConfig} onClose={() => setShowConfig(false)} />}

            {/* Modals */}
            <Modal
                isOpen={deleteTaskModal.isOpen}
                onClose={() => setDeleteTaskModal({ isOpen: false, taskId: null })}
                title="Confirmar Eliminación"
                footer={
                    <>
                        <button
                            onClick={() => setDeleteTaskModal({ isOpen: false, taskId: null })}
                            className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmDeleteTask}
                            className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                            Eliminar Tarea
                        </button>
                    </>
                }
            >
                <p>¿Estás seguro de que quieres eliminar esta tarea? Esta acción no se puede deshacer.</p>
            </Modal>
        </div>
    );
};

export default App;
