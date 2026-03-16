
import React, { useState, useEffect, useRef } from 'react';
import { DateRange } from '../types';
import { getDateRange } from '../utils';

interface DateRangePickerProps {
    onChange: (range: DateRange) => void;
    value?: DateRange;
    align?: 'left' | 'right';
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ onChange, value, align = 'right' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [label, setLabel] = useState('This Month');
    
    // Estado para el calendario
    const [viewDate, setViewDate] = useState(new Date()); // Fecha para controlar el mes que se ve
    const [tempStart, setTempStart] = useState<Date | null>(null);
    const [tempEnd, setTempEnd] = useState<Date | null>(null);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    const ref = useRef<HTMLDivElement>(null);

    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Sincronizar con value externo o inicializar
    useEffect(() => {
        if (value) {
            setLabel(value.label);
            setTempStart(value.start);
            setTempEnd(value.end);
            // Opcional: mover vista del calendario a la fecha de fin seleccionada si cambia externamente
            // setViewDate(value.end); 
        } else {
            const initial = getDateRange('thisMonth');
            setLabel(initial.label);
            setTempStart(initial.start);
            setTempEnd(initial.end);
        }
    }, [value]);

    const handlePreset = (preset: string) => {
        const range = getDateRange(preset);
        // Si no es controlado externamente, actualizamos estado local para UX inmediata
        if (!value) {
            setLabel(range.label);
            setTempStart(range.start);
            setTempEnd(range.end);
        }
        setViewDate(range.end); // Mover calendario al final del rango
        onChange(range);
        if (preset !== 'custom') setIsOpen(false);
    };

    const handleApply = () => {
        if (tempStart && tempEnd) {
            // Asegurar orden
            const start = tempStart < tempEnd ? tempStart : tempEnd;
            const end = tempEnd > tempStart ? tempEnd : tempStart;
            // Ajustar horas
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);

            const startStr = start.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
            const endStr = end.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
            
            const newLabel = `${startStr} - ${endStr}`;
            
            if (!value) setLabel(newLabel);
            
            onChange({ start, end, label: 'Custom' });
            setIsOpen(false);
        }
    };

    // Lógica del Calendario
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const changeMonth = (offset: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
        setViewDate(newDate);
    };

    const handleDateClick = (day: number) => {
        const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        clickedDate.setHours(0,0,0,0);

        if (!tempStart || (tempStart && tempEnd)) {
            // Empezar nueva selección
            setTempStart(clickedDate);
            setTempEnd(null);
        } else {
            // Completar rango
            if (clickedDate < tempStart) {
                setTempEnd(tempStart);
                setTempStart(clickedDate);
            } else {
                setTempEnd(clickedDate);
            }
        }
    };

    const isSelected = (day: number) => {
        if (!tempStart) return false;
        const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const s = new Date(tempStart); s.setHours(0,0,0,0);
        
        // Es inicio exacto
        if (current.getTime() === s.getTime()) return 'start';
        
        if (tempEnd) {
            const e = new Date(tempEnd); e.setHours(0,0,0,0);
            // Es fin exacto
            if (current.getTime() === e.getTime()) return 'end';
            // Está en medio
            if (current > s && current < e) return 'between';
        } else if (hoverDate) {
             // Preview de rango al hacer hover (opcional, para UX avanzada)
             const h = new Date(hoverDate); h.setHours(0,0,0,0);
             if (current > s && current <= h) return 'preview';
             if (current < s && current >= h) return 'preview';
        }
        return false;
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                // Solo cerrar si NO es móvil (en móvil usamos backdrop)
                if (window.innerWidth >= 768) {
                   setIsOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const alignClass = align === 'left' ? 'md:left-0 md:right-auto' : 'md:right-0 md:left-auto';

    // Renderizado de días
    const renderCalendarDays = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        
        const days = [];
        
        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const status = isSelected(d);
            let bgClass = "hover:bg-white/10 text-slate-300";
            
            if (status === 'start' || status === 'end') bgClass = "bg-primary text-white shadow-lg shadow-primary/40 font-bold scale-110 z-10";
            else if (status === 'between') bgClass = "bg-primary/20 text-primary-200 rounded-none mx-[-2px]";
            else if (status === 'preview') bgClass = "bg-white/5 text-slate-200";

            // Bordes redondeados para el rango visual
            const roundedClass = status === 'start' ? 'rounded-l-full rounded-r-none' : 
                                 status === 'end' ? 'rounded-r-full rounded-l-none' : 
                                 status === 'between' ? '' : 'rounded-full';

            // Override si es selección única
            const finalRounded = (status === 'start' && !tempEnd) ? 'rounded-full' : roundedClass;

            days.push(
                <button
                    key={d}
                    onClick={() => handleDateClick(d)}
                    onMouseEnter={() => setHoverDate(new Date(year, month, d))}
                    className={`h-8 w-8 text-xs flex items-center justify-center transition-all relative ${bgClass} ${finalRounded}`}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    return (
        <div className="relative z-50" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-slate-300 transition-all">
                <span className="material-symbols-outlined text-sm text-slate-400">calendar_month</span>
                {label}
                <span className={`material-symbols-outlined text-sm ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop Mobile */}
                    <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm z-[60] md:hidden" onClick={() => setIsOpen(false)}></div>
                    
                    {/* Container: Centered Modal on Mobile, Absolute Dropdown on Desktop */}
                    <div className={`
                        fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[95vw] max-w-[360px] max-h-[90vh] overflow-y-auto
                        md:absolute md:top-12 md:translate-x-0 md:translate-y-0 md:w-auto md:min-w-[500px] md:max-w-none md:max-h-none md:overflow-visible
                        ${alignClass}
                        glass-card rounded-xl shadow-2xl border border-white/10 p-4 bg-surface-dark animate-fade-in flex flex-col md:flex-row gap-4
                    `}>
                        
                        {/* Left: Presets */}
                        <div className="flex flex-row overflow-x-auto md:flex-col gap-2 md:gap-1 w-full md:w-40 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-4 shrink-0">
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider hidden md:block">Quick Select</p>
                            {['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth'].map(key => {
                                 const l = key === 'today' ? 'Today' : key === 'yesterday' ? 'Yesterday' : key === 'last7' ? 'Last 7 Days' : key === 'thisMonth' ? 'This Month' : 'Last Month';
                                 return (
                                    <button key={key} onClick={() => handlePreset(key)} className="text-center md:text-left px-3 py-2 bg-white/5 md:bg-transparent hover:bg-white/5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors flex justify-between items-center group whitespace-nowrap">
                                        {l}
                                        <span className="material-symbols-outlined text--[10px] opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">chevron_right</span>
                                    </button>
                                 )
                            })}
                        </div>

                        {/* Right: Calendar */}
                        <div className="flex-1 w-full">
                             {/* Header */}
                            <div className="flex items-center justify-between mb-4 px-2">
                                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                                </button>
                                <span className="text-sm font-bold text-white">
                                    {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                                </span>
                                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                                </button>
                            </div>

                            {/* Week Days */}
                            <div className="grid grid-cols-7 mb-2 text-center">
                                {weekDays.map(d => (
                                    <span key={d} className="text-[10px] font-bold text-slate-500 uppercase">{d}</span>
                                ))}
                            </div>

                            {/* Days Grid */}
                            <div className="grid grid-cols-7 gap-y-1 justify-items-center">
                                {renderCalendarDays()}
                            </div>

                            {/* Footer / Info */}
                            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Selected Range</span>
                                    <span className="text-xs text-primary font-bold">
                                        {tempStart ? tempStart.toLocaleDateString() : 'Start'} - {tempEnd ? tempEnd.toLocaleDateString() : 'End'}
                                    </span>
                                </div>
                                <button 
                                    onClick={handleApply} 
                                    disabled={!tempStart || !tempEnd}
                                    className="bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary/20"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default DateRangePicker;
