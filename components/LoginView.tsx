
import React from 'react';

interface LoginViewProps {
    onLogin: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background-dark p-6">
            <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
                <div className="size-20 rounded-3xl bg-primary mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(13,127,242,0.4)] mb-8">
                    <span className="material-symbols-outlined text-white text-4xl">monitoring</span>
                </div>
                
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">PECAS Dashboard</h1>
                <p className="text-slate-400 mb-10">Tu centro de estrategia y ads unificado.</p>
                
                <button 
                    onClick={onLogin}
                    className="w-full py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-200 transition-all active:scale-95 shadow-xl"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="size-6" />
                    Continuar con Google
                </button>
                
                <p className="mt-8 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    Sincronización en tiempo real activa
                </p>
            </div>
        </div>
    );
};

export default LoginView;
