
import React, { useState } from 'react';
import { AppConfig, BrandConfig, DataSourceType } from '../types';

interface ConfigPanelProps {
    config: AppConfig;
    onSave: (config: AppConfig) => void;
    onClose: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onSave, onClose }) => {
    const [localConfig, setLocalConfig] = useState<AppConfig>(config);
    const [activeTab, setActiveTab] = useState<'pecas' | 'lasMejores'>('pecas');

    const updateBrandConfig = (field: keyof BrandConfig, value: any) => {
        setLocalConfig(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                [field]: value
            }
        }));
    };

    const currentBrand = localConfig[activeTab];
    const isSupabase = currentBrand.dataSourceType === 'SUPABASE';

    const inputClasses = "w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-slate-600 text-xs";

    return (
        <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-white/10 max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-white/10 flex items-center gap-3 bg-white/5 shrink-0">
                    <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">settings</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Data Configuration</h2>
                        <p className="text-xs text-slate-500">Manage Data Sources & Connections</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 shrink-0">
                    <button 
                        onClick={() => setActiveTab('pecas')}
                        className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'pecas' ? 'text-white border-b-2 border-primary bg-white/5' : 'text-slate-500 hover:text-white'}`}
                    >
                        PECAS
                    </button>
                    <button 
                        onClick={() => setActiveTab('lasMejores')}
                        className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'lasMejores' ? 'text-white border-b-2 border-neon-green bg-white/5' : 'text-slate-500 hover:text-white'}`}
                    >
                        LASMEJORES
                    </button>
                </div>
                
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    {/* Source Selector */}
                    <div className="bg-white/5 p-1 rounded-xl flex border border-white/10">
                        <button 
                            onClick={() => updateBrandConfig('dataSourceType', 'SHEETS')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${!isSupabase ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-sm">table_view</span> Google Sheets
                        </button>
                        <button 
                            onClick={() => updateBrandConfig('dataSourceType', 'SUPABASE')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${isSupabase ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-sm">database</span> Supabase (Direct)
                        </button>
                    </div>

                    {!isSupabase ? (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center gap-2 mb-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-xs">
                                <span className="material-symbols-outlined text-sm">info</span>
                                <span>Using legacy Google Sheets JSON API.</span>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Facebook Ads URL (JSON)</label>
                                <input type="text" className={inputClasses} value={currentBrand.facebookUrl || ''} onChange={(e) => updateBrandConfig('facebookUrl', e.target.value)} placeholder="https://script.google.com/..." />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Kommo CRM URL (JSON)</label>
                                <input type="text" className={inputClasses} value={currentBrand.kommoUrl || ''} onChange={(e) => updateBrandConfig('kommoUrl', e.target.value)} placeholder="https://script.google.com/..." />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Manual Sales URL (JSON)</label>
                                <input type="text" className={inputClasses} value={currentBrand.ventasManualesUrl || ''} onChange={(e) => updateBrandConfig('ventasManualesUrl', e.target.value)} placeholder="https://script.google.com/..." />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                             <div className="flex items-center gap-2 mb-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs">
                                <span className="material-symbols-outlined text-sm">bolt</span>
                                <span>Direct DB Connection. Fast, Secure, No Sheets.</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Supabase Project URL</label>
                                    <input type="text" className={inputClasses} value={currentBrand.supabaseUrl || ''} onChange={(e) => updateBrandConfig('supabaseUrl', e.target.value)} placeholder="https://xyz.supabase.co" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Supabase Anon Key</label>
                                    <input type="password" className={inputClasses} value={currentBrand.supabaseKey || ''} onChange={(e) => updateBrandConfig('supabaseKey', e.target.value)} placeholder="eyJh..." />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">FB Table Name</label>
                                    <input type="text" className={inputClasses} value={currentBrand.supabaseTableFacebook || 'facebook_ads'} onChange={(e) => updateBrandConfig('supabaseTableFacebook', e.target.value)} placeholder="facebook_ads" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Kommo Table Name</label>
                                    <input type="text" className={inputClasses} value={currentBrand.supabaseTableKommo || 'kommo_leads'} onChange={(e) => updateBrandConfig('supabaseTableKommo', e.target.value)} placeholder="kommo_leads" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">Manual Sales Table</label>
                                    <input type="text" className={inputClasses} value={currentBrand.supabaseTableManual || 'ventas_manuales'} onChange={(e) => updateBrandConfig('supabaseTableManual', e.target.value)} placeholder="ventas_manuales" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-white/10">
                        <label className="block text-[10px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider ml-1 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-neon-green">cloud_sync</span>
                            AI Assistant Sync Webhook
                        </label>
                        <input type="text" className={inputClasses} value={currentBrand.cloudSyncUrl || ''} onChange={(e) => updateBrandConfig('cloudSyncUrl', e.target.value)} placeholder="https://n8n.webhook/..." />
                    </div>
                </div>

                <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
                    <button onClick={() => onSave(localConfig)} className="px-6 py-2 text-sm font-bold bg-primary text-white rounded-xl hover:bg-primary/80 shadow-lg shadow-primary/20 active:scale-95 transition-all">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

export default ConfigPanel;
