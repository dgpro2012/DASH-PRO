
import React, { useMemo, useState } from 'react';
import { Task } from '../types';

interface TasksViewProps {
    tasks: Task[];
    onToggleStatus: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onAddHistoryNote: (taskId: string, note: string) => void;
}

const TasksView: React.FC<TasksViewProps> = ({ tasks, onToggleStatus, onDeleteTask, onAddHistoryNote }) => {
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'DONE'>('PENDING');
    
    // --- HISTORY MODAL STATE ---
    const [activeHistoryTask, setActiveHistoryTask] = useState<Task | null>(null);
    const [newNote, setNewNote] = useState('');
    
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (filter === 'ALL') return true;
            return t.status === filter;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [tasks, filter]);

    const pendingCount = tasks.filter(t => t.status === 'PENDING').length;

    const openHistoryModal = (task: Task) => {
        setActiveHistoryTask(task);
        setNewNote('');
    };

    const handleSaveNote = () => {
        if (!activeHistoryTask || !newNote.trim()) return;
        onAddHistoryNote(activeHistoryTask.id, newNote);
        setNewNote('');
        
        // Update local active task state to show the new note immediately in the modal
        // Note: The main 'tasks' prop will also update, but we need to reflect it in the modal view
        setActiveHistoryTask(prev => {
            if (!prev) return null;
            return {
                ...prev,
                history: [...prev.history, { timestamp: new Date().toISOString(), note: newNote }]
            };
        });
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20 relative">
            {/* HISTORY MODAL */}
            {activeHistoryTask && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-sm" onClick={() => setActiveHistoryTask(null)}></div>
                    <div className="relative w-full max-w-lg glass-card rounded-2xl border border-white/10 shadow-2xl animate-fade-in flex flex-col overflow-hidden bg-surface-dark">
                         <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined">history_edu</span>
                                Bitácora / Log
                            </h3>
                            <button onClick={() => setActiveHistoryTask(null)} className="text-slate-400 hover:text-white transition-colors">✕</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto max-h-[50vh] p-4 space-y-3 custom-scrollbar">
                            {activeHistoryTask.history.length === 0 ? (
                                <p className="text-slate-500 text-sm italic text-center py-4">No records found.</p>
                            ) : (
                                activeHistoryTask.history.slice().reverse().map((h, i) => (
                                    <div key={i} className="flex gap-3 text-sm">
                                        <div className="flex flex-col items-center">
                                            <div className="size-2 rounded-full bg-slate-600 mt-1.5"></div>
                                            {i !== activeHistoryTask.history.length - 1 && <div className="w-px h-full bg-white/10 my-0.5"></div>}
                                        </div>
                                        <div className="pb-2">
                                            <p className="text-[10px] text-slate-500 font-mono mb-0.5">{new Date(h.timestamp).toLocaleString()}</p>
                                            <p className="text-slate-300">{h.note}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 bg-[#0f1115] border-t border-white/10">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    placeholder="Add new note..."
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
                                />
                                <button 
                                    onClick={handleSaveNote} 
                                    disabled={!newNote.trim()}
                                    className="p-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:bg-slate-700 hover:bg-primary/80 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">send</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        Task Manager
                        {pendingCount > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">{pendingCount} Pending</span>}
                    </h2>
                    <p className="text-slate-500 mt-1">Actionable items from your Strategy Audit & Ads</p>
                </div>
                
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                    {['PENDING', 'DONE', 'ALL'].map((f) => (
                        <button 
                            key={f} 
                            onClick={() => setFilter(f as any)} 
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filter === f ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredTasks.length === 0 ? (
                    <div className="glass-card p-12 rounded-2xl text-center border-dashed border-2 border-white/10">
                        <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">assignment_turned_in</span>
                        <p className="text-slate-500 font-bold">No {filter.toLowerCase()} tasks found.</p>
                        <p className="text-xs text-slate-600 mt-1">Go to "Strategy Audit" or "Ads" to create new tasks.</p>
                    </div>
                ) : (
                    filteredTasks.map(task => (
                        <div key={task.id} className={`glass-card p-4 rounded-xl border-l-4 transition-all hover:bg-white/5 group relative ${task.status === 'DONE' ? 'border-l-neon-green opacity-60' : 'border-l-red-500'}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                    <button 
                                        onClick={() => onToggleStatus(task.id)}
                                        className={`mt-0.5 size-5 rounded border flex items-center justify-center transition-colors ${task.status === 'DONE' ? 'bg-neon-green border-neon-green text-black' : 'border-slate-500 hover:border-white'}`}
                                    >
                                        {task.status === 'DONE' && <span className="material-symbols-outlined text-sm font-bold">check</span>}
                                    </button>
                                    
                                    <div className="flex-1">
                                        <p className={`text-sm font-medium ${task.status === 'DONE' ? 'text-slate-500 line-through' : 'text-white'}`}>
                                            {task.description}
                                        </p>
                                        
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            {/* EXTENDED CONTEXT TAGS */}
                                            {task.context.campaignName && (
                                                <div className="flex items-center gap-1.5 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20 max-w-[200px]" title={task.context.campaignName}>
                                                    <span className="text-[9px] text-blue-400 uppercase font-bold">CMP</span>
                                                    <span className="text-[10px] text-blue-200 truncate max-w-[150px]">{task.context.campaignName}</span>
                                                </div>
                                            )}
                                            {task.context.adSetName && (
                                                <div className="flex items-center gap-1.5 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20 max-w-[200px]" title={task.context.adSetName}>
                                                    <span className="text-[9px] text-purple-400 uppercase font-bold">SET</span>
                                                    <span className="text-[10px] text-purple-200 truncate max-w-[150px]">{task.context.adSetName}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                                <span className="text-[9px] text-slate-500 uppercase font-bold">PC</span>
                                                <span className={`text-[10px] font-mono font-bold ${task.context.pc === 'Sin PC' ? 'text-red-400' : 'text-yellow-400'}`}>{task.context.pc}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                                <span className="text-[9px] text-slate-500 uppercase font-bold">Country</span>
                                                <span className="text-[10px] text-slate-300">{task.context.pais}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col gap-2">
                                     {/* LOG BUTTON */}
                                     <button 
                                        onClick={() => openHistoryModal(task)}
                                        className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                        title="View History / Log"
                                    >
                                        <span className="material-symbols-outlined text-lg">history_edu</span>
                                    </button>

                                    {/* DELETE BUTTON */}
                                    <button 
                                        onClick={() => onDeleteTask(task.id)}
                                        className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Delete Task"
                                    >
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
                                <span className="text-[10px] text-slate-600 font-mono">{new Date(task.createdAt).toLocaleString()}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500">{task.history.length} updates</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TasksView;
