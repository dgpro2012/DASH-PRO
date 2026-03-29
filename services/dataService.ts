
import { FacebookRow, KommoLead, ExchangeRates, BrandConfig } from "../types";
import { parseCampaignNomenclature, cleanAndNormalizeSource } from "../utils";

// TASAS DE RESPALDO (SAFETY NET)
const FALLBACK_RATES: Record<string, number> = {
    'COP': 4150, 'CLP': 950, 'MXN': 17.5, 'PEN': 3.75, 'ARS': 1050, 'VES': 36, 'BOB': 6.96
};

// --- HELPERS (Same as before) ---
const standardizePC = (val: any): string => {
    if (!val) return 'PC00';
    const str = String(val).toUpperCase().trim();
    if (str === 'PC00' || str === 'SIN PC' || str === '') return 'PC00';
    const match = str.match(/PC\s*(\d+)/i);
    if (match) return 'PC' + String(parseInt(match[1], 10)).padStart(2, '0');
    return str;
};

const parseFlexibleDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) { const [y, m, d] = str.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) { const [d, m, y] = str.split('/').map(Number); return new Date(y, m - 1, d, 12, 0, 0); }
    const d = new Date(str);
    if (!isNaN(d.getTime())) { d.setHours(12, 0, 0, 0); return d; }
    return new Date(); 
};

const parseSafeFloat = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim();
    if (str.match(/^-?\d{1,3}(,\d{3})*(\.\d+)?$/)) str = str.replace(/,/g, '');
    else if (str.match(/^-?\d{1,3}(\.\d{3})*(,\d+)?$/)) str = str.replace(/\./g, '').replace(',', '.');
    else if (str.indexOf(',') > -1 && str.indexOf('.') === -1) str = str.replace(',', '.');
    return parseFloat(str) || 0;
};

// --- SERVICE IMPLEMENTATION ---

export const DataService = {
    // Universal Fetcher that delegates based on Config
    fetchBrandData: async (config: BrandConfig, type: 'facebook' | 'kommo' | 'manual'): Promise<any[]> => {
        if (config.dataSourceType === 'SUPABASE') {
            return DataService.fetchSupabase(config, type);
        } else {
            // Legacy Sheets
            const url = type === 'facebook' ? config.facebookUrl : type === 'kommo' ? config.kommoUrl : config.ventasManualesUrl;
            return DataService.fetchSheets(url);
        }
    },

    fetchWithRetry: async (url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> => {
        try {
            return await fetch(url, options);
        } catch (error: any) {
            // Don't retry if the request was aborted (timeout)
            if (error.name === 'AbortError') throw error;
            
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, backoff));
                return DataService.fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            throw error;
        }
    },

    fetchSheets: async (url: string): Promise<any[]> => {
        if (!url) return [];
        try {
            const controller = new AbortController();
            // Google Apps Script limit is ~6 mins (360s). Set to 180s (3m) as requested.
            const timeoutId = setTimeout(() => controller.abort(), 180000); 
            const response = await DataService.fetchWithRetry(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) {
                console.error(`Fetch Sheets Error: ${response.status} ${response.statusText} for ${url}`);
                return [];
            }
            const text = await response.text();
            try { return JSON.parse(text) || []; } catch (e) { 
                console.error("JSON Parse Error in fetchSheets:", e);
                return []; 
            }
        } catch (e: any) { 
            if (e.name === 'AbortError') {
                console.error(`Request timed out after 180s (3m) for ${url}.`);
            } else {
                console.error("Network/Fetch Error in fetchSheets:", e);
            }
            return []; 
        }
    },

    fetchSupabase: async (config: BrandConfig, type: 'facebook' | 'kommo' | 'manual'): Promise<any[]> => {
        if (!config.supabaseUrl || !config.supabaseKey) return [];
        
        let tableName = '';
        if (type === 'facebook') tableName = config.supabaseTableFacebook || 'facebook_ads';
        else if (type === 'kommo') tableName = config.supabaseTableKommo || 'kommo_leads';
        else tableName = config.supabaseTableManual || 'ventas_manuales';

        const endpoint = `${config.supabaseUrl}/rest/v1/${tableName}?select=*`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s timeout
            const response = await DataService.fetchWithRetry(endpoint, {
                method: 'GET',
                headers: {
                    'apikey': config.supabaseKey,
                    'Authorization': `Bearer ${config.supabaseKey}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`Supabase Error (${type}): ${response.statusText}`);
                return [];
            }
            return await response.json();
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.error(`Supabase request timed out after 180s for ${type}`);
            } else {
                console.error(`Supabase connection failed for ${type}`, e);
            }
            return [];
        }
    },

    extractExchangeRates: (data: any[]): ExchangeRates => {
        const rates: ExchangeRates = { COP: [], CLP: [], PEN: [], MXN: [], VES: [], ARS: [], BOB: [] };
        const monedas = ['COP', 'CLP', 'PEN', 'MXN', 'VES', 'ARS', 'BOB'];

        data.forEach(item => {
            monedas.forEach(moneda => {
                // Support both Sheets format (USDCOP_Date) and likely DB format (usd_cop_date)
                const dateField = item[`USD${moneda}_Date`] || item[`usd_${moneda.toLowerCase()}_date`];
                const closeField = item[`USD${moneda}_Close`] || item[`usd_${moneda.toLowerCase()}_close`];

                if (dateField && closeField && closeField !== '' && closeField !== '#N/A') {
                    const date = parseFlexibleDate(dateField);
                    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    
                    const exists = rates[moneda].some(r => r.dateKey === dateKey);
                    if (!exists) {
                        rates[moneda].push({
                            date: date,
                            dateKey: dateKey,
                            rate: parseSafeFloat(closeField) || 0
                        });
                    }
                }
            });
        });

        Object.keys(rates).forEach(moneda => {
            rates[moneda].sort((a, b) => b.date.getTime() - a.date.getTime());
        });

        return rates;
    },

    getRateForDate: (rates: ExchangeRates, moneda: string, targetDate: Date): number => {
        if (moneda === 'USD') return 1;
        const monedaRates = rates[moneda];
        if (!monedaRates || monedaRates.length === 0) return FALLBACK_RATES[moneda] || 1;

        const targetTime = targetDate.getTime();
        
        // Ordenamos ascendente para buscar la primera fecha que sea >= a la buscada
        const sortedAsc = [...monedaRates].sort((a, b) => a.date.getTime() - b.date.getTime());
        
        for (const entry of sortedAsc) {
            if (entry.date.getTime() >= targetTime) {
                return entry.rate;
            }
        }
        
        // Si la fecha buscada es posterior a todos los registros, usamos el último disponible
        return sortedAsc[sortedAsc.length - 1].rate;
    },
    
    normalizeKommoData: (data: any[]): KommoLead[] => {
        const mapPipelineStatus = (rawStatus: any) => {
            if (!rawStatus) return 'DESCONOCIDO';
            const s = String(rawStatus).toUpperCase().trim();
            if (s === 'CASHING') return 'CASHING';
            if (s.includes('BASE')) return 'BASE';
            if (s.includes('DESCUENTO')) return 'DESCUENTO';
            if (s.includes('VENTA PERDIDO') || s.includes('VENTA PERDIDA')) return 'VENTA PERDIDA';
            return 'OTROS';
        };

        const leadMap = new Map();
        data.forEach(item => {
            // Support DB snake_case or Sheets Title Case
            const leadId = item['Lead ID'] || item['id'] || item['lead_id'] || '';
            const createdVal = item['Creado en'] || item['Actualizado en'] || item['created_at'];
            
            if (leadId) {
                if (leadMap.has(leadId)) {
                    const existing = leadMap.get(leadId);
                    const exDate = parseFlexibleDate(existing['Creado en'] || existing['created_at']);
                    const newDate = parseFlexibleDate(createdVal);
                    if (newDate > exDate) leadMap.set(leadId, item);
                } else {
                    leadMap.set(leadId, item);
                }
            }
        });
        
        return Array.from(leadMap.values()).map(item => ({
            ...item,
            id: item['Lead ID'] || item['id'] || item['lead_id'] || '',
            nombre: item['Contacto Nombre'] || item['Lead Nombre'] || item['contact_name'] || 'Sin Nombre',
            monto: Math.round(parseSafeFloat(item['Precio'] || item['price'] || item['monto'])),
            status_raw: item['Status Nombre'] || item['status_name'],
            status_pipeline: mapPipelineStatus(item['Status Nombre'] || item['status_name']),
            etapa_raw: item['ETAPA'] || item['stage'] || '',
            pais: item['Pais'] || item['country'] || 'Desconocido',
            producto: item['Producto'] || item['product'] || 'N/A',
            fuente_normalizada: cleanAndNormalizeSource(item['Fuente'] || item['source']),
            'Palabras Claves': standardizePC(item['Palabras Claves'] || item['PC'] || item['keywords']),
            'Creado en': parseFlexibleDate(item['Creado en'] || item['created_at']),
            'Cerrado en': parseFlexibleDate(item['Cerrado en'] || item['closed_at'])
        }));
    },

    normalizeFacebookData: (data: any[]): FacebookRow[] => {
        return data.map(item => {
            const campaignName = item['Campaign Name'] || item['campaign_name'] || '';
            if (!campaignName) return null;

            const parsed = parseCampaignNomenclature(campaignName);
            const dateStr = item['Day'] || item['Date Created'] || item['date'] || item['day'];
            let dateObj = parseFlexibleDate(dateStr);

            const rawSpent = parseSafeFloat(item['Amount Spent'] || item['amount_spent'] || item['spend']);
            let usdRealValue = parseSafeFloat(item['USD REAL'] || item['usd_real']);
            const currency = item['Currency'] || item['currency'] || 'USD';
            
            // --- HEURÍSTICA DE SEGURIDAD (Se mantiene igual) ---
            if (currency !== 'USD' && rawSpent > 0) {
                const implicitRate = usdRealValue > 0 ? rawSpent / usdRealValue : 0;
                if (implicitRate < 10) { 
                    const fallbackRate = FALLBACK_RATES[currency] || 1;
                    usdRealValue = rawSpent / fallbackRate;
                }
            }
            if ((!usdRealValue || usdRealValue === 0) && rawSpent > 0) {
                 if (currency === 'USD') usdRealValue = rawSpent;
                 else usdRealValue = rawSpent / (FALLBACK_RATES[currency] || 1);
            }
            // -----------------------------------------------------

            const adName = item['Ad Name'] || item['ad_name'] || '';
            const adSetName = item['Ad Set Name'] || item['adset_name'] || '';
            
            let palabraClave = 'PC00';
            const pcMatchAd = adName.match(/PC\s*(\d+)/i);
            const pcMatchSet = adSetName.match(/PC\s*(\d+)/i);
            
            if (pcMatchAd) palabraClave = 'PC' + pcMatchAd[1].padStart(2, '0');
            else if (pcMatchSet) palabraClave = 'PC' + pcMatchSet[1].padStart(2, '0');

            return {
                ...item,
                'Campaign Name': campaignName,
                'Ad Name': adName,
                'Amount Spent': rawSpent,
                'Currency': currency,
                'USD REAL': usdRealValue,
                'Messaging Conversations Started': parseInt(item['Messaging Conversations Started'] || item['messages'] || '0'),
                'Purchases': parseInt(item['Purchases'] || item['results'] || item['purchases'] || '0'),
                'Impressions': parseInt(item['Impressions'] || item['impressions'] || '0'),
                'Unique Clicks (All)': parseInt(item['Unique Clicks (All)'] || item['unique_clicks'] || '0'),
                parsed_pais: parsed.pais,
                parsed_producto: parsed.producto,
                parsed_fuente: parsed.fuente,
                parsed_fuente_tipo: parsed.fuente_tipo,
                parsed_fuente_id: parsed.fuente_id,
                parsed_fase: parsed.fase,
                parsed_palabra_clave: palabraClave,
                dateObj: dateObj
            };
        }).filter(Boolean) as FacebookRow[];
    },

    normalizeVentasManualesData: (data: any[]): KommoLead[] => {
        if (!Array.isArray(data)) return [];
        return data.map(item => ({
            ...item,
            id: 'MANUAL-' + Math.random().toString(36).substr(2, 9),
            nombre: 'Venta Manual',
            monto: parseSafeFloat(item['Monto'] || item['amount']),
            status_raw: 'CASHING',
            status_pipeline: 'CASHING',
            pais: item['Pais'] || item['country'] || 'Desconocido',
            producto: item['Producto'] || item['product'] || 'N/A',
            fuente_normalizada: cleanAndNormalizeSource(item['Fuente'] || item['source']),
            'Creado en': parseFlexibleDate(item['Fecha'] || item['date']),
            'Cerrado en': parseFlexibleDate(item['Fecha'] || item['date']),
            'Palabras Claves': standardizePC(item['PC'] || item['pc']),
            Fuente: String(item['Fuente'] || item['source'] || ''),
            isManual: true
        }));
    },

    unifyAndMapSources: (kommo: KommoLead[], facebook: FacebookRow[], manual: KommoLead[]) => {
        const allSources = new Set<string>();
        const collect = (s: string) => { if(s && s !== 'Desconocido') allSources.add(s); };
        
        kommo.forEach(k => collect(k.fuente_normalizada));
        facebook.forEach(f => collect(f.parsed_fuente));
        manual.forEach(m => collect(m.fuente_normalizada));

        const sourceList = Array.from(allSources);
        const longNumbers = sourceList.filter(s => /^\d{7,}$/.test(s));
        const shortNumbers = sourceList.filter(s => /^\d{3,6}$/.test(s));

        const mapping: Record<string, string> = {};

        shortNumbers.forEach(short => {
            const matches = longNumbers.filter(long => long.endsWith(short));
            if (matches.length === 1) mapping[short] = matches[0];
        });
        
        const apply = (s: string) => mapping[s] || s;

        kommo.forEach(k => { if(k.fuente_normalizada) k.fuente_normalizada = apply(k.fuente_normalizada); });
        facebook.forEach(f => { 
            if(f.parsed_fuente) f.parsed_fuente = apply(f.parsed_fuente); 
            if(f.parsed_fuente_id) f.parsed_fuente_id = apply(f.parsed_fuente_id); 
        });
        manual.forEach(m => { if(m.fuente_normalizada) m.fuente_normalizada = apply(m.fuente_normalizada); });
    },

    combineKommoWithManual: (kommoData: KommoLead[], manualData: KommoLead[]): KommoLead[] => {
        return [...kommoData, ...manualData];
    }
};
