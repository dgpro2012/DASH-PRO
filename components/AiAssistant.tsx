
import React, { useState, useRef, useEffect } from 'react';
import { AiService, ChatMessage } from '../services/aiService';

interface AiAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    contextSummary: string; // Global data summary
    specificContext?: string | null; // Specific row context (from Audit)
    onClearSpecificContext: () => void;
    systemPrompt: string;
    onSaveSystemPrompt: (newPrompt: string) => void;
    strategicContext: string;
    onSaveStrategicContext: (newContext: string) => void;
    tasks: any[];
    onUpdateTask: (taskId: string, updates: any) => void;
    onAddTask: (task: any) => void;
    facebookData: any[];
}

const AiAssistant: React.FC<AiAssistantProps> = ({ 
    isOpen, 
    onClose, 
    contextSummary, 
    specificContext, 
    onClearSpecificContext,
    systemPrompt,
    onSaveSystemPrompt,
    strategicContext,
    onSaveStrategicContext,
    tasks,
    onUpdateTask,
    onAddTask,
    facebookData
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [useDeepThink, setUseDeepThink] = useState(false);
    const [groundingSources, setGroundingSources] = useState<any[]>([]);
    
    // View Mode: 'chat' or 'brain' (settings)
    const [viewMode, setViewMode] = useState<'chat' | 'brain'>('chat');
    const [brainTab, setBrainTab] = useState<'persona' | 'strategy'>('persona');
    const [tempPrompt, setTempPrompt] = useState(systemPrompt);
    const [tempStrategic, setTempStrategic] = useState(strategicContext);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial greeting
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{
                role: 'model',
                content: "Hola. Soy PECAS Bot. Analizo tu data y te digo la verdad, aunque duela. ¿Qué revisamos hoy?"
            }]);
        }
    }, []);

    // Sync temp prompt when prop changes
    useEffect(() => {
        setTempPrompt(systemPrompt);
        setTempStrategic(strategicContext);
    }, [systemPrompt, strategicContext]);

    // Auto-scroll
    useEffect(() => {
        if (viewMode === 'chat') {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isThinking, viewMode]);

    const handleSend = async (text: string = input, isAudit: boolean = false) => {
        if (!text.trim() && !isAudit) return;

        const userMsg: ChatMessage = { role: 'user', content: text || "Realiza una auditoría de los últimos 3 días." };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);
        setGroundingSources([]);

        try {
            let fullContext = `GLOBAL DASHBOARD SUMMARY:\n${contextSummary}`;
            if (specificContext) {
                fullContext += `\n\nFOCUS CONTEXT (User is currently looking at this specific item):\n${specificContext}`;
            }
            
            // Add Strategic Context
            if (strategicContext) {
                fullContext += `\n\nSTRATEGIC CONTEXT / USER THINKING:\n${strategicContext}`;
            }

            // If audit, add specific data for last 3 days
            if (isAudit) {
                const now = new Date();
                const threeDaysAgo = new Date(now);
                threeDaysAgo.setDate(now.getDate() - 3);
                
                const recentData = facebookData.filter(row => {
                    const d = new Date(row.dateObj);
                    return d >= threeDaysAgo && d <= now;
                });

                fullContext += `\n\nRECENT PERFORMANCE DATA (LAST 3 DAYS):\n${JSON.stringify(recentData, null, 2)}`;
                fullContext += `\n\nINSTRUCTION: Analiza el rendimiento de los últimos 3 días. Si encuentras campañas que necesiten ajustes, genera una nota para la tarea correspondiente.
                Si la tarea no existe, sugiérela. Responde con tu análisis y al final, si hay actualizaciones de tareas, usa este formato JSON:
                [[TASK_UPDATE: {"campaignName": "...", "note": "...", "status": "..."}]]`;
            }

            const stream = AiService.streamChat(messages, text || userMsg.content, fullContext, useDeepThink, systemPrompt);
            
            let accumulatedText = "";
            let isFirstChunk = true;

            for await (const chunk of stream) {
                if (chunk.type === 'grounding') {
                    setGroundingSources(prev => [...prev, ...chunk.content]);
                    continue;
                }

                accumulatedText += chunk.content;

                setMessages(prev => {
                    const newHistory = [...prev];
                    if (isFirstChunk) {
                         if (newHistory[newHistory.length - 1].role === 'user') {
                             newHistory.push({ role: 'model', content: accumulatedText });
                         }
                         isFirstChunk = false;
                    } else {
                        newHistory[newHistory.length - 1].content = accumulatedText;
                    }
                    return newHistory;
                });
            }

            // Parse for task updates
            const taskUpdateRegex = /\[\[TASK_UPDATE: (.*?)\]\]/g;
            let match;
            while ((match = taskUpdateRegex.exec(accumulatedText)) !== null) {
                try {
                    const updateData = JSON.parse(match[1]);
                    // Find existing task for this campaign
                    const existingTask = tasks.find(t => t.campaignName === updateData.campaignName || t.description.includes(updateData.campaignName));
                    
                    if (existingTask) {
                        onUpdateTask(existingTask.id, { 
                            history: [...(existingTask.history || []), { timestamp: new Date().toISOString(), note: updateData.note }]
                        });
                    } else {
                        onAddTask({
                            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            description: `Auditoría PECAS: ${updateData.campaignName}`,
                            campaignName: updateData.campaignName,
                            status: 'PENDING',
                            history: [{ timestamp: new Date().toISOString(), note: updateData.note }]
                        });
                    }
                } catch (e) {
                    console.error("Error parsing task update from AI:", e);
                }
            }

        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', content: "Error de conexión con PECAS Bot." }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleSaveBrain = () => {
        onSaveSystemPrompt(tempPrompt);
        onSaveStrategicContext(tempStrategic);
        setViewMode('chat');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-surface-dark border-l border-white/10 shadow-2xl z-[100] flex flex-col animate-fade-in font-sans">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#0f1115]">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="material-symbols-outlined text-white">psychology</span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-surface-dark rounded-full p-0.5">
                             <span className="flex size-2.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${useDeepThink ? 'bg-purple-400' : 'bg-neon-green'}`}></span>
                                <span className={`relative inline-flex rounded-full size-2.5 ${useDeepThink ? 'bg-purple-500' : 'bg-neon-green'}`}></span>
                            </span>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-base">PECAS Bot</h3>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                                {viewMode === 'brain' ? 'Configuración 🧠' : (useDeepThink ? 'Modo Pensamiento 🧠' : 'Búsqueda en Vivo 🌐')}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {viewMode === 'chat' && (
                        <button 
                            onClick={() => handleSend("", true)}
                            disabled={isThinking}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-500/30 transition-all border border-indigo-500/30 mr-2"
                        >
                            <span className="material-symbols-outlined text-sm">analytics</span>
                            Auditar 3 Días
                        </button>
                    )}

                    <button 
                        onClick={() => setViewMode(viewMode === 'chat' ? 'brain' : 'chat')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'brain' ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                        title="Configurar PECAS Bot"
                    >
                        <span className="material-symbols-outlined text-lg">settings_suggest</span>
                    </button>
                    
                    {viewMode === 'chat' && (
                        <button 
                            onClick={() => setUseDeepThink(!useDeepThink)}
                            className={`p-2 rounded-lg transition-all ${useDeepThink ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                            title={useDeepThink ? "Pensamiento Profundo Activo" : "Activar Pensamiento Profundo"}
                        >
                            <span className="material-symbols-outlined text-lg">network_intelligence</span>
                        </button>
                    )}
                    
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'brain' ? (
                // --- BRAIN EDITOR MODE ---
                <div className="flex-1 flex flex-col p-6 bg-[#0a0c10]">
                    <div className="flex gap-4 mb-6 border-b border-white/5">
                        <button 
                            onClick={() => setBrainTab('persona')}
                            className={`pb-2 text-xs font-bold uppercase tracking-widest transition-all ${brainTab === 'persona' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Persona / Prompt
                        </button>
                        <button 
                            onClick={() => setBrainTab('strategy')}
                            className={`pb-2 text-xs font-bold uppercase tracking-widest transition-all ${brainTab === 'strategy' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Contexto Estratégico
                        </button>
                    </div>

                    {brainTab === 'persona' ? (
                        <div className="flex-1 flex flex-col">
                            <div className="mb-4">
                                <h4 className="text-white font-bold text-lg mb-1">Cerebro de PECAS Bot</h4>
                                <p className="text-xs text-slate-500">Define quién es, qué sabe y cómo responde.</p>
                            </div>
                            <textarea 
                                value={tempPrompt}
                                onChange={(e) => setTempPrompt(e.target.value)}
                                className="flex-1 w-full bg-[#161d26] border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:border-primary/50 focus:ring-0 outline-none resize-none font-mono leading-relaxed"
                                placeholder="Define el prompt del sistema aquí..."
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <div className="mb-4">
                                <h4 className="text-white font-bold text-lg mb-1">Contexto Estratégico</h4>
                                <p className="text-xs text-slate-500">Dile a PECAS Bot cómo piensas, tus reglas de negocio y qué priorizar en sus auditorías.</p>
                            </div>
                            <textarea 
                                value={tempStrategic}
                                onChange={(e) => setTempStrategic(e.target.value)}
                                className="flex-1 w-full bg-[#161d26] border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:border-primary/50 focus:ring-0 outline-none resize-none font-mono leading-relaxed"
                                placeholder="Ej: 'Si el ROAS de Venezuela baja de 2, apaga campañas inmediatamente. Prioriza leads de calidad sobre cantidad...'"
                            />
                        </div>
                    )}

                    <div className="mt-4 flex justify-end gap-3">
                        <button 
                            onClick={() => { setTempPrompt(systemPrompt); setTempStrategic(strategicContext); setViewMode('chat'); }}
                            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSaveBrain}
                            className="px-6 py-2 bg-primary hover:bg-primary/80 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">save</span>
                            Guardar Configuración
                        </button>
                    </div>
                </div>
            ) : (
                // --- CHAT MODE ---
                <>
                    {/* Specific Context Banner */}
                    {specificContext && (
                        <div className="bg-blue-500/10 border-b border-blue-500/20 p-3 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 text-xs text-blue-300">
                                <span className="material-symbols-outlined text-sm">filter_center_focus</span>
                                <div className="flex flex-col">
                                    <span className="font-bold">Contexto Activo</span>
                                    <span className="opacity-70 text-[10px] truncate max-w-[200px]">PECAS Bot tiene la data de lo que seleccionaste.</span>
                                </div>
                            </div>
                            <button onClick={onClearSpecificContext} className="text-[10px] font-bold text-slate-400 hover:text-white uppercase px-2 py-1 bg-white/5 rounded hover:bg-white/10 transition-colors">
                                Limpiar Contexto
                            </button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0a0c10]">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed whitespace-pre-wrap ${
                                    msg.role === 'user' 
                                        ? 'bg-primary text-white rounded-br-none shadow-lg shadow-primary/10' 
                                        : 'bg-white/5 text-slate-200 border border-white/5 rounded-bl-none'
                                }`}>
                                    {msg.role === 'model' && <span className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">PECAS Bot</span>}
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        
                        {groundingSources.length > 0 && (
                            <div className="flex justify-start">
                                 <div className="max-w-[85%] bg-[#111] border border-white/10 rounded-xl p-3">
                                     <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">google</span> Fuentes
                                     </p>
                                     <div className="space-y-1">
                                        {groundingSources.map((source: any, i) => {
                                            const web = source.web || {};
                                            return (
                                                <a key={i} href={web.uri} target="_blank" rel="noreferrer" className="block text-xs text-primary truncate hover:underline">
                                                    {web.title || web.uri}
                                                </a>
                                            );
                                        })}
                                     </div>
                                 </div>
                            </div>
                        )}

                        {isThinking && (
                            <div className="flex justify-start animate-pulse">
                                 <div className="bg-white/5 text-slate-400 rounded-2xl rounded-bl-none p-3 text-xs font-bold flex items-center gap-2">
                                    <span className="size-2 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="size-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="size-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                    {useDeepThink ? 'Razonando...' : 'Escribiendo...'}
                                 </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-[#0f1115] border-t border-white/10">
                        <div className="relative">
                            <input 
                                ref={inputRef}
                                type="text" 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder={specificContext ? "Pregunta sobre esta estrategia..." : "Pregúntale a PECAS Bot..."}
                                className="w-full bg-[#161d26] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors shadow-inner"
                                disabled={isThinking}
                            />
                            <button 
                                onClick={() => handleSend()}
                                disabled={!input.trim() || isThinking}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-white rounded-lg hover:bg-primary/80 disabled:opacity-50 disabled:bg-transparent disabled:text-slate-500 transition-all"
                            >
                                <span className="material-symbols-outlined text-lg">arrow_upward</span>
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-600 text-center mt-2 font-medium">
                            PECAS Bot puede cometer errores. Verifica la información importante.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};

export default AiAssistant;
