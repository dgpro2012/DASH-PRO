
import React from 'react';
import { formatDate, formatMoney } from '../utils';

interface VentasManualesViewProps {
    manualData: any[];
}

const VentasManualesView: React.FC<VentasManualesViewProps> = ({ manualData }) => {
    if (!manualData || manualData.length === 0) {
        return (
            <div className="glass-card p-8 rounded-xl text-center">
                <p className="text-4xl mb-4">📝</p>
                <h3 className="text-lg font-bold text-white">No manual sales loaded</h3>
                <p className="text-slate-500 mt-2">Configure the Google Sheets URL in settings.</p>
            </div>
        );
    }

    return (
        <div className="glass-card p-6 rounded-xl animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                📝 Manual Sales
                <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">{manualData.length} records</span>
            </h2>
            <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-slate-400 font-semibold border-b border-white/10 sticky top-0 backdrop-blur-md">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Country</th>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">PC</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                        {manualData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-white/5">
                                <td className="px-4 py-3">{formatDate(row['Fecha'])}</td>
                                <td className="px-4 py-3">{row['Pais']}</td>
                                <td className="px-4 py-3">{row['Producto']}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{row['Fuente']}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{row['PC']}</td>
                                <td className="px-4 py-3 text-right font-bold text-neon-green">{formatMoney(parseFloat(row['Monto'] || 0))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default VentasManualesView;
