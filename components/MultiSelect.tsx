
import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (values: string[]) => void;
    placeholder: string;
    icon?: string;
    align?: 'left' | 'right';
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, placeholder, icon, align = 'right' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                // Only close on click outside if on desktop. On mobile, backdrop handles it.
                if (window.innerWidth >= 768) {
                    setIsOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        const newSelected = selected.includes(option) ? selected.filter(s => s !== option) : [...selected, option];
        onChange(newSelected);
    };

    const filteredOptions = options.filter(o => String(o).toLowerCase().includes(search.toLowerCase()));
    const label = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`;

    const alignClass = align === 'left' ? 'md:left-0 md:right-auto' : 'md:right-0 md:left-auto';

    return (
        <div className="relative inline-block text-left w-full md:w-auto min-w-[160px]" ref={containerRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between w-full px-4 py-2 bg-white/5 border rounded-xl text-xs font-bold transition-all ${selected.length > 0 ? 'border-primary text-primary' : 'border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                <div className="flex items-center gap-2 truncate">
                    {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
                    <span className="truncate">{label}</span>
                </div>
                <span className="material-symbols-outlined text-sm ml-2">expand_more</span>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop Mobile */}
                    <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm z-[60] md:hidden" onClick={() => setIsOpen(false)}></div>

                    {/* Container: Bottom Sheet Mobile, Dropdown Desktop */}
                    <div className={`
                        fixed bottom-0 left-0 right-0 p-4 pb-8 z-[70] max-h-[80vh] flex flex-col rounded-t-2xl border-t border-white/10 bg-surface-dark shadow-[0_-10px_40px_rgba(0,0,0,0.5)]
                        md:absolute md:bottom-auto md:top-full md:mt-2 md:w-64 md:rounded-xl md:shadow-2xl md:border md:max-h-[500px]
                        ${alignClass}
                        glass-card animate-fade-in
                    `}>
                        {/* Mobile Handle */}
                        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-4 md:hidden"></div>

                        <div className="p-2 border-b border-white/10 shrink-0">
                            <input type="text" className="w-full px-3 py-2 md:py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg outline-none focus:ring-1 focus:ring-primary text-white placeholder:text-slate-600" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                        </div>
                        <div className="overflow-y-auto p-1 custom-scrollbar flex-1 min-h-0">
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-4 text-xs text-slate-500 text-center font-bold">No results</div>
                            ) : (
                                filteredOptions.map(option => (
                                    <label key={String(option)} className="flex items-center px-3 py-3 md:py-2 text-xs hover:bg-white/5 rounded-lg cursor-pointer group transition-colors">
                                        <input type="checkbox" className="w-5 h-5 md:w-4 md:h-4 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary" checked={selected.includes(option)} onChange={() => toggleOption(option)} />
                                        <span className={`ml-3 truncate font-medium ${selected.includes(option) ? 'text-primary' : 'text-slate-300 group-hover:text-white'}`}>{option}</span>
                                    </label>
                                ))
                            )}
                        </div>
                        {selected.length > 0 && (
                            <div className="p-2 border-t border-white/10 bg-white/5 flex justify-between items-center shrink-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">{selected.length} active</span>
                                <button onClick={() => onChange([])} className="text-[10px] font-bold text-red-400 hover:text-white px-2 py-1">Clear All</button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default MultiSelect;
