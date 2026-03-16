import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface KPICardProps {
    title: string;
    value: string;
    subValue?: string;
    trend?: number;
    trendLabel?: string;
    data: { date: string; value: number }[];
    color: string; // Hex color for the chart
    className?: string;
    valuePrefix?: string;
    valueSuffix?: string;
}

const KPICard: React.FC<KPICardProps> = ({
    title,
    value,
    subValue,
    trend,
    trendLabel = "vs previous period",
    data,
    color,
    className,
    valuePrefix = '',
    valueSuffix = ''
}) => {
    const isPositive = trend && trend > 0;
    const isNegative = trend && trend < 0;
    const isNeutral = !trend || trend === 0;

    // Sanitize title for SVG ID to avoid issues with spaces/special chars
    const gradientId = `color-${title.replace(/[^a-zA-Z0-9]/g, '')}`;

    return (
        <div className={twMerge("glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all duration-300", className)}>
            <div className="flex flex-col h-full justify-between relative z-10">
                <div>
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white tracking-tight">{valuePrefix}{value}{valueSuffix}</span>
                        {subValue && <span className="text-xs font-semibold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md">{subValue}</span>}
                    </div>
                    
                    {trend !== undefined && (
                        <div className="flex items-center gap-1.5 mt-2">
                            <div className={clsx(
                                "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                isPositive ? "text-emerald-400 bg-emerald-400/10" : 
                                isNegative ? "text-rose-400 bg-rose-400/10" : 
                                "text-slate-400 bg-slate-400/10"
                            )}>
                                {isPositive && <ArrowUpRight size={12} />}
                                {isNegative && <ArrowDownRight size={12} />}
                                {isNeutral && <Minus size={12} />}
                                <span>{Math.abs(trend).toFixed(1)}%</span>
                            </div>
                            {/* <span className="text-[10px] text-slate-500">{trendLabel}</span> */}
                        </div>
                    )}
                </div>

                <div className="h-[60px] w-full mt-4 -mb-2 -mx-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f1115', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                                itemStyle={{ color: '#fff' }}
                                labelStyle={{ display: 'none' }}
                                formatter={(value: number) => [valuePrefix + value.toLocaleString() + valueSuffix, title]}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke={color} 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill={`url(#${gradientId})`} 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            {/* Background Glow Effect */}
            <div 
                className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-10 pointer-events-none"
                style={{ backgroundColor: color }}
            />
        </div>
    );
};

export default React.memo(KPICard);
