
import React, { useMemo } from 'react';
import { ExchangeRates } from '../types';
import { formatNumber } from '../utils';

interface TasasViewProps {
    rates: ExchangeRates;
}

const TasasView: React.FC<TasasViewProps> = ({ rates }) => {
    const monedas = ['COP', 'CLP', 'PEN', 'MXN', 'VES', 'ARS', 'BOB'];
    const monedaNames: Record<string, string> = {
        COP: '🇨🇴 Colombia (COP)',
        CLP: '🇨🇱 Chile (CLP)',
        PEN: '🇵🇪 Perú (PEN)',
        MXN: '🇲🇽 México (MXN)',
        VES: '🇻🇪 Venezuela (VES)',
        ARS: '🇦🇷 Argentina (ARS)',
        BOB: '🇧🇴 Bolivia (BOB)'
    };

    const formatDateShort = (dateKey: string) => {
        if (!dateKey) return '-';
        const [y, m, d] = dateKey.split('-');
        return `${d}/${m}/${y}`;
    };

    const allDates = useMemo(() => {
        const dateSet = new Set<string>();
        Object.keys(rates || {}).forEach(moneda => {
            const rateList = rates[moneda];
            if (Array.isArray(rateList)) {
                rateList.forEach(r => dateSet.add(r.dateKey));
            }
        });
        return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
    }, [rates]);

    const ratesMatrix = useMemo(() => {
        const matrix: Record<string, any> = {};
        allDates.forEach(dateKey => {
            matrix[dateKey] = { dateKey };
            monedas.forEach(moneda => {
                const rateEntry = (rates[moneda] || []).find(r => r.dateKey === dateKey);
                matrix[dateKey][moneda] = rateEntry?.rate || null;
            });
        });
        return matrix;
    }, [rates, allDates]);

    const totalRates = Object.keys(rates || {}).reduce((sum, key) => sum + (rates[key]?.length || 0), 0);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">Exchange Rates</h2>
                        <p className="text-sm text-slate-500 mt-1">Automatic rates extracted from Facebook Ads data.</p>
                    </div>
                    <div className="bg-primary/20 text-primary px-4 py-2 rounded-lg font-medium border border-primary/30">
                        {totalRates} rates loaded
                    </div>
                </div>

                {allDates.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p className="text-4xl mb-4">📊</p>
                        <p className="font-medium">No exchange rates available</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white/5 text-slate-400 font-semibold border-b border-white/10">
                                <tr>
                                    <th className="px-4 py-3">📅 Date</th>
                                    {monedas.map(moneda => <th key={moneda} className="px-4 py-3 text-right">{monedaNames[moneda]}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-300">
                                {allDates.slice(0, 30).map(dateKey => (
                                    <tr key={dateKey} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-medium">{formatDateShort(dateKey)}</td>
                                        {monedas.map(moneda => {
                                            const rate = ratesMatrix[dateKey]?.[moneda];
                                            return (
                                                <td key={moneda} className="px-4 py-3 text-right">
                                                    {rate !== null ? (
                                                        <span className="font-mono">{formatNumber(rate)}</span>
                                                    ) : (
                                                        <span className="text-slate-600">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monedas.map(moneda => {
                    const monedaRates = rates[moneda] || [];
                    const latestRate = monedaRates[0];
                    return (
                        <div key={moneda} className="glass-card p-4 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-slate-200">{monedaNames[moneda]}</span>
                                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-slate-400">{monedaRates.length} records</span>
                            </div>
                            {latestRate ? (
                                <div>
                                    <p className="text-2xl font-bold text-neon-green">{formatNumber(latestRate.rate)}</p>
                                    <p className="text-xs text-slate-500 mt-1">Latest: {formatDateShort(latestRate.dateKey)}</p>
                                </div>
                            ) : (
                                <p className="text-slate-600">No data</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TasasView;
