import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ConversionGaugeProps {
    value: number;
}

const ConversionGauge: React.FC<ConversionGaugeProps> = ({ value }) => {
    // Ensure value is between 0 and 100 for the chart
    const chartValue = Math.min(Math.max(value, 0), 100);
    
    const data = [
        { name: 'Value', value: chartValue },
        { name: 'Rest', value: 100 - chartValue },
    ];
    
    // Green for value, Dark Gray for background track
    const COLORS = ['#22c55e', 'rgba(255,255,255,0.1)']; 

    return (
        <div className="relative h-full w-full flex flex-col items-center justify-center min-h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="75%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="70%"
                        outerRadius="90%"
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                    >
                        <Cell key="cell-0" fill={COLORS[0]} cornerRadius={6} />
                        <Cell key="cell-1" fill={COLORS[1]} />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-[70%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Conversion Rate</p>
                <p className="text-4xl font-bold text-white tracking-tight">{value.toFixed(1)}%</p>
            </div>
        </div>
    );
};

export default React.memo(ConversionGauge);
