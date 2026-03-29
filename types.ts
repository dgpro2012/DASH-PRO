
export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export type DataSourceType = 'SHEETS' | 'SUPABASE';

export interface BrandConfig {
  dataSourceType: DataSourceType; // 'SHEETS' or 'SUPABASE'
  // Configuración Google Sheets (Legacy)
  facebookUrl: string;
  kommoUrl: string;
  ventasManualesUrl: string;
  cloudSyncUrl?: string;
  // Configuración Supabase (Direct DB)
  supabaseUrl?: string;
  supabaseKey?: string; // Anon Key
  supabaseTableFacebook?: string;
  supabaseTableKommo?: string;
  supabaseTableManual?: string;
}

export interface AppConfig {
  pecas: BrandConfig;
  lasMejores: BrandConfig;
}

export interface KommoLead {
  id: string;
  nombre: string;
  monto: number;
  status_raw: string;
  status_pipeline: string;
  etapa_raw: string;
  pais: string;
  producto: string;
  fuente_normalizada: string;
  isManual?: boolean;
  ELITE?: string; // Added Elite tag
  [key: string]: any;
}

export interface FacebookRow {
  'Campaign Name': string;
  'Ad Set Name': string;
  'Ad Name': string;
  'Amount Spent': number;
  'USD REAL': number;
  'Messaging Conversations Started': number;
  'Purchases': number;
  parsed_pais: string;
  parsed_producto: string;
  parsed_fuente: string;
  parsed_fuente_tipo: string;
  parsed_fuente_id: string;
  parsed_fase: string;
  parsed_palabra_clave: string;
  dateObj: Date;
  ELITE?: string; // Added Elite tag
  [key: string]: any;
}

export interface ColumnDef {
  id: string;
  name: string;
  type: 'text' | 'money' | 'number' | 'date';
  default: boolean;
}

export interface ExchangeRate {
  date: Date;
  dateKey: string;
  rate: number;
}

export interface ExchangeRates {
  [currency: string]: ExchangeRate[];
}

export interface Cobro {
  id: string;
  pais: string;
  fecha: string; // YYYY-MM-DD (Start Date)
  fechaFin?: string; // YYYY-MM-DD (End Date)
  monto: number;
  tasa: number;
  usd: number;
  uid?: string;
}

export interface TaskHistory {
    timestamp: string;
    note: string;
}

export interface Task {
  id: string;
  description: string;
  status: 'PENDING' | 'DONE';
  createdAt: string; // ISO String
  campaignName?: string; // For AI matching
  history: TaskHistory[]; // New field for changelog
  uid?: string;
  context: {
    rowId: string;
    pais: string;
    producto: string;
    fuente: string;
    pc: string;
    campaignName?: string; // New
    adSetName?: string; // New
  };
}

export interface GlobalFilters {
  fb: {
    dateRange: DateRange;
    viewLevel: string;
    searchTags: string[];
    useUsd: boolean;
    onlyWithDelivery: boolean;
    activeFilter: { campaign: string | null; adset: string | null };
    selectionFilter: string[] | null;
    filterElite: string[]; // Added Elite filter
    filterAccount: string[]; // Added Account filter
  };
  pipeline: {
    dateRange: DateRange;
    filterPais: string[];
    filterProducto: string[];
    filterPalabrasClave: string[];
    filterFuente: string[];
    filterElite: string[];
    dateFilterType: 'created' | 'closed';
  };
  dashboard: {
    dateRange: DateRange;
    filterPais: string[];
    filterProducto: string[];
    filterElite: string[];
    filterCanal: string[];
    useUsd: boolean;
  };
}
