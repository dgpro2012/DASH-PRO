
import React, { useMemo } from 'react';
import { KommoLead } from '../types';
import { formatDate } from '../utils';

interface ErrorsViewProps {
    kommoData: KommoLead[];
}

const ErrorsView: React.FC<ErrorsViewProps> = ({ kommoData }) => {
    const problematicLeads = kommoData.filter(lead => !lead.Fuente || !lead['Palabras Claves'] || lead['Palabras Claves'] === 'PC00');
    const leadsWithInvalidStatus = kommoData.filter(lead => lead.status_pipeline === 'OTROS');

    const statusDiagnostics = useMemo(() => {
        const stats: Record<string, { raw: string, mapped: string, count: number }> = {};
        kommoData.forEach(lead => {
            const raw = lead.status_raw || '(Vacío)';
            const mapped = lead.status_pipeline;
            const key = `${raw}|${mapped}`;
            if (!stats[key]) stats[key] = { raw, mapped, count: 0 };
            stats[key].count++;
        });
        return Object.values(stats).sort((a, b) => b.count - a.count);
    }, [kommoData]);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-primary">📊 Status Diagnostics ({kommoData.length} leads)</h2>
                <div className="glass-card rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-primary/10 text-primary font-semibold border-b border-primary/20">
                            <tr>
                                <th className="px-4 py-3">Status Raw</th>
                                <th className="px-4 py-3">Mapped To</th>
                                <th className="px-4 py-3 text-right">Count</th>
                                <th className="px-4 py-3">State</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                            {statusDiagnostics.map((stat, idx) => (
                                <tr key={idx} className="hover:bg-white/5">
                                    <td className="px-4 py-3 font-mono text-slate-500">{stat.raw}</td>
                                    <td className="px-4 py-3 font-bold">{stat.mapped}</td>
                                    <td className="px-4 py-3 text-right font-bold">{stat.count}</td>
                                    <td className="px-4 py-3">{stat.mapped === 'OTROS' ? <span className="text-red-500 font-bold">⚠️ Unmapped</span> : <span className="text-neon-green font-bold">✅ OK</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {leadsWithInvalidStatus.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-red-500">🚨 Unmapped Status Leads ({leadsWithInvalidStatus.length})</h2>
                    <div className="glass-card rounded-xl overflow-hidden max-h-96 overflow-y-auto custom-scrollbar border border-red-500/20">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-red-500/10 text-red-500 font-semibold border-b border-red-500/20 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Original Status</th>
                                    <th className="px-4 py-3">Country</th>
                                    <th className="px-4 py-3">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-300">
                                {leadsWithInvalidStatus.map(lead => (
                                    <tr key={lead.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-medium">{lead.nombre}</td>
                                        <td className="px-4 py-3 text-red-400 font-bold">{lead.status_raw || '(Empty)'}</td>
                                        <td className="px-4 py-3">{lead.pais}</td>
                                        <td className="px-4 py-3">{formatDate(lead['Creado en'])}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-yellow-500">⚠️ Attribution Issues ({problematicLeads.length})</h2>
                <div className="glass-card rounded-xl overflow-hidden max-h-96 overflow-y-auto custom-scrollbar border border-yellow-500/20">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-yellow-500/10 text-yellow-500 font-semibold border-b border-yellow-500/20 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Source</th>
                                <th className="px-4 py-3">PC</th>
                                <th className="px-4 py-3">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                            {problematicLeads.map(lead => (
                                <tr key={lead.id} className="hover:bg-white/5">
                                    <td className="px-4 py-3 font-medium">{lead.nombre}</td>
                                    <td className="px-4 py-3 text-red-400">{lead.Fuente || '(Empty)'}</td>
                                    <td className="px-4 py-3 text-yellow-500">{lead['Palabras Claves'] || '(Empty)'}</td>
                                    <td className="px-4 py-3">{formatDate(lead['Creado en'])}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ErrorsView;
