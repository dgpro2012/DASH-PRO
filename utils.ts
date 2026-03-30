
import { DateRange } from "./types";
import { PAIS_TO_MONEDA } from "./constants";

export const formatMoney = (amount: number | undefined): string => {
    if (!amount && amount !== 0) return '$0.00';
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    }).format(amount);
};

export const formatNumber = (num: number | undefined): string => {
    if (!num && num !== 0) return '0';
    return new Intl.NumberFormat('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
    }).format(num);
};

export const formatDate = (dateStr: string | undefined | Date): string => {
    if (!dateStr) return '-';
    try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    } catch (e) {
        return String(dateStr);
    }
};

export const formatDateShort = (dateStr: string | undefined | Date): string => {
    if (!dateStr) return '-';
    try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit'
        }).format(date);
    } catch (e) {
        return '-';
    }
};

export const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {});
};

export const maskString = (text: string): string => {
    if (!text) return '';
    return text.split(' ').map(word => {
        // Keep strictly first 2 chars, then mask the rest
        if (word.length <= 2) return word;
        const visible = word.substring(0, 2);
        const masked = '*'.repeat(word.length - 2);
        return `${visible}${masked}`;
    }).join(' ');
};

export const getDateRange = (preset: string): DateRange => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);

    switch (preset) {
        case 'today':
            return { start, end: today, label: 'Hoy' };
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            yesterday.setHours(0,0,0,0);
            const endYesterday = new Date(yesterday);
            endYesterday.setHours(23,59,59,999);
            return { start: yesterday, end: endYesterday, label: 'Ayer' };
        case 'last7':
            const last7 = new Date(today);
            last7.setDate(today.getDate() - 6);
            last7.setHours(0,0,0,0);
            return { start: last7, end: today, label: 'Últimos 7 días' };
        case 'thisMonth':
            const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            return { start: startMonth, end: today, label: 'Este mes' };
        case 'lastMonth':
            const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
            return { start: startLastMonth, end: endLastMonth, label: 'Mes anterior' };
        default:
            return { start, end: today, label: 'Hoy' };
    }
};

export const cleanAndNormalizeSource = (source: any): string => {
    let s = String(source || '').trim();
    if (!s || s === 'undefined' || s === 'null') return 'Desconocido';

    // 1. Extraer ID si viene en formato "Nombre (ID)" ej: "WPP API (1545)"
    const parenMatch = s.match(/^(.+?)\s*\((.+)\)$/);
    if (parenMatch) {
        s = parenMatch[2].trim();
    }

    return s;
};

export const parseCampaignNomenclature = (campaignName: string) => {
    if (!campaignName) return { pais: '', producto: '', fuente: '', fase: '', fuente_tipo: '', fuente_id: '' };
    
    let parts = campaignName.split('|');
    
    // If pipe didn't work or looked like it failed (only 1 part), try other separators
    if (parts.length < 2) {
        if (campaignName.includes(' - ')) {
            parts = campaignName.split(' - ');
        } else if (campaignName.includes('-')) {
             // Only split by hyphen if it looks like a separator (spaces around or multiple hyphens)
             // But simple splitting might break names like "Daniel-Garcia". 
             // Let's assume nomenclature uses " - " or just "-" if there are enough parts.
             const hyphenParts = campaignName.split('-');
             if (hyphenParts.length >= 3) parts = hyphenParts;
        } else if (campaignName.includes('_')) {
            const underscoreParts = campaignName.split('_');
            if (underscoreParts.length >= 3) parts = underscoreParts;
        }
    }

    parts = parts.map(s => s.trim());
    
    // Fallback for 2 parts: Assume PAIS | PRODUCTO
    const pais = parts[0] || 'Desconocido';
    const producto = parts[1] || 'General';
    const fuenteRaw = parts[2] || '';
    
    let fuente_tipo = '';
    let fuente_id = '';
    
    if (fuenteRaw) {
        const parenMatch = fuenteRaw.match(/^(.+?)\s*\((.+)\)$/);
        
        if (parenMatch) {
            fuente_tipo = parenMatch[1].trim();
            fuente_id = parenMatch[2].trim();
        } else {
            const spaceMatch = fuenteRaw.match(/^([A-Za-z]+)\s+(.+)$/);
            if (spaceMatch) {
                fuente_tipo = spaceMatch[1].trim();
                fuente_id = spaceMatch[2].trim();
            } else {
                fuente_id = fuenteRaw;
                fuente_tipo = 'Directo';
            }
        }
    }
    
    const normalizedId = cleanAndNormalizeSource(fuente_id || fuenteRaw);
    
    return {
        pais: pais,
        producto: producto,
        fuente: normalizedId,
        fase: parts[3] || 'N/A',
        fuente_tipo: fuente_tipo || 'N/A',
        fuente_id: normalizedId 
    };
};

export const getMonedaByPais = (pais: string): string => {
    if (!pais) return 'USD';
    const normalized = normalizePaisName(pais);
    const cleaned = normalized.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return PAIS_TO_MONEDA[cleaned] || 'USD';
};

// --- MEMOIZATION CACHE ---
const memoCache: Record<string, string> = {};

export const normalizePaisName = (pais: string | undefined): string => {
    if (!pais) return '';
    const key = `pais_${pais}`;
    if (memoCache[key]) return memoCache[key];

    const p = pais.toString().toUpperCase().trim();
    
    const paisMap: Record<string, string> = {
        'ARG': 'Argentina', 'ARGENTINA': 'Argentina',
        'VEN': 'Venezuela', 'VENEZUELA': 'Venezuela',
        'COL': 'Colombia', 'COLOMBIA': 'Colombia',
        'CHL': 'Chile', 'CHILE': 'Chile',
        'MEX': 'México', 'MEXICO': 'México', 'MÉXICO': 'México', 'MXN': 'México',
        'PER': 'Perú', 'PERU': 'Perú', 'PERÚ': 'Perú',
        'ECU': 'Ecuador', 'ECUADOR': 'Ecuador',
        'BOL': 'Bolivia', 'BOLIVIA': 'Bolivia', 'BOB': 'Bolivia',
        'URY': 'Uruguay', 'URUGUAY': 'Uruguay',
        'PRY': 'Paraguay', 'PARAGUAY': 'Paraguay',
        'PAN': 'Panamá', 'PANAMA': 'Panamá', 'PANAMÁ': 'Panamá',
        'CRI': 'Costa Rica', 'COSTA RICA': 'Costa Rica', 'COSTARICA': 'Costa Rica',
        'GTM': 'Guatemala', 'GUATEMALA': 'Guatemala',
        'SLV': 'El Salvador', 'EL SALVADOR': 'El Salvador', 'SALVADOR': 'El Salvador',
        'HND': 'Honduras', 'HONDURAS': 'Honduras',
        'NIC': 'Nicaragua', 'NICARAGUA': 'Nicaragua',
        'DOM': 'República Dominicana', 'REPUBLICA DOMINICANA': 'República Dominicana', 'DOMINICANA': 'República Dominicana',
        'PRI': 'Puerto Rico', 'PUERTO RICO': 'Puerto Rico',
        'ESP': 'España', 'ESPANA': 'España', 'ESPAÑA': 'España', 'SPAIN': 'España',
        'USA': 'Estados Unidos', 'ESTADOS UNIDOS': 'Estados Unidos', 'EEUU': 'Estados Unidos', 'US': 'Estados Unidos'
    };
    
    const result = paisMap[p] || String(pais).trim();
    memoCache[key] = result;
    return result;
};

export const normalizeProductoName = (producto: string | undefined): string => {
    if (!producto) return '';
    const key = `prod_${producto}`;
    if (memoCache[key]) return memoCache[key];

    const p = producto.toString().toUpperCase().trim();
    let result = String(producto).trim();

    if (p.includes('MAQUINA') && p.includes('GYM')) {
        result = 'MAQUINAS GYM';
    } else if (p.includes('REMOLQUE')) {
        result = 'REMOLQUES';
    }
    
    memoCache[key] = result;
    return result;
};

export const matchProducto = (leadProducto: string | undefined, filterProductos: string[]): boolean => {
    if (!filterProductos || filterProductos.length === 0) return true;
    if (!leadProducto) return false;
    
    const leadProd = leadProducto.toString().toLowerCase().trim();
    
    return filterProductos.some(f => {
        const filterProd = f.toString().toLowerCase().trim();
        if (leadProd === filterProd) return true;
        if (leadProd.includes(filterProd)) return true;
        
        const filterWords = filterProd.split(/\s+/).filter(w => w.length > 2);
        if (filterWords.length > 0 && filterWords.every(word => leadProd.includes(word))) return true;
        
        return false;
    });
};

export const matchPais = (leadPais: string | undefined, filterPaises: string[]): boolean => {
    if (!filterPaises || filterPaises.length === 0) return true;
    if (!leadPais) return false;
    
    const normalizedLead = normalizePaisName(leadPais);
    return filterPaises.some(fp => normalizePaisName(fp) === normalizedLead);
};

export const extractLast4 = (str: any): string => {
    if (!str) return '';
    const d = String(str).replace(/\D/g, '');
    return d.slice(-4);
};

export const normalizePC = (pc: any): string => {
    if (!pc) return '';
    const m = String(pc).trim().toUpperCase().match(/PC\s*(\d+)/i);
    return m ? 'PC' + m[1].padStart(2, '0') : '';
};

export const reviveDates = (key: string, value: any) => {
    if (typeof value === 'string') {
        // Simple heuristic for ISO dates or YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) return d;
        }
    }
    return value;
};
