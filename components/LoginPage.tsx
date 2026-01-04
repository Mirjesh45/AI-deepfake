
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login, register, resetError, error: authError } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState('');
  const [hasUplink, setHasUplink] = useState<boolean>(false);
  
  const firstInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNodeId(Math.random().toString(16).slice(2, 8).toUpperCase());
    checkUplink();
    firstInputRef.current?.focus();
  }, [isRegistering]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  const checkUplink = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
      const active = await aistudio.hasSelectedApiKey();
      setHasUplink(active);
      if (active) addLog("CLOUD UPLINK DETECTED: NODE READY");
    }
  };

  const handleLinkKey = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.openSelectKey === 'function') {
      addLog("INITIATING CLOUD UPLINK PROVISIONING...");
      await aistudio.openSelectKey();
      // Assume success as per race condition mitigation rules
      setHasUplink(true);
      addLog("UPLINK ESTABLISHED: SECURE HANDSHAKE COMPLETE");
    } else {
      setLocalError("UPLINK_ERROR: AI Studio orchestration tools missing from environment.");
    }
  };

  const addLog = (msg: string) => {
    setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setConsoleLogs([]);

    if (!hasUplink) {
      setLocalError("UPLINK_REQUIRED: Initialize Gemini Cloud Uplink before authentication.");
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setLocalError("VALIDATION_ERROR: Passkey confirmation mismatch.");
      return;
    }

    setIsAuthenticating(true);
    try {
      if (isRegistering) {
        await register(username, password, addLog);
      } else {
        await login(username, password, addLog);
      }
    } catch (error: any) {
      addLog(`CRITICAL_FAILURE: ${error.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setLocalError(null);
    resetError();
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setConsoleLogs([]);
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: `radial-gradient(#1e293b 1px, transparent 1px)`, backgroundSize: '40px 40px' }}></div>
      
      <div className="w-full max-w-2xl z-10 flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-500">
        <header className="text-center space-y-4">
          <h1 className="text-6xl font-black tracking-tighter uppercase">Sentinel <span className="text-blue-500">SOC</span></h1>
          <div className="flex items-center justify-center gap-4">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.5em]">Forensic Node {nodeId}</p>
            <div className={`px-2 py-0.5 rounded border text-[8px] font-mono uppercase transition-all ${hasUplink ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'}`}>
              {hasUplink ? 'UPLINK: ACTIVE' : 'UPLINK: DISCONNECTED'}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              {!hasUplink && (
                <div className="mb-8 p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 text-blue-400">
                    <i className="fas fa-satellite text-xl"></i>
                    <h3 className="font-bold text-xs uppercase tracking-widest">Digital Uplink Required</h3>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-400 font-medium font-mono uppercase">
                    Connect to Google Cloud Platform to activate Gemini 3 Pro Forensic Engine.
                  </p>
                  <button 
                    onClick={handleLinkKey}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                  >
                    Auto-Provision Uplink
                  </button>
                </div>
              )}

              {activeError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-mono">
                  <i className="fas fa-triangle-exclamation mr-2"></i> {activeError}
                </div>
              )}

              <form onSubmit={handleSubmit} className={`space-y-5 transition-all duration-500 ${!hasUplink ? 'opacity-20 blur-sm pointer-events-none' : 'opacity-100'}`}>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Operator ID</label>
                  <input 
                    ref={firstInputRef}
                    type="text" 
                    required
                    placeholder="SOC-ALPHA-2025"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all font-mono placeholder:opacity-30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Forensic Passkey</label>
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all font-mono placeholder:opacity-30"
                  />
                </div>

                {isRegistering && (
                  <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Confirm Credentials</label>
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all font-mono"
                    />
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full bg-slate-100 text-slate-950 hover:bg-white disabled:opacity-50 py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all active:scale-95 shadow-xl"
                >
                  {isAuthenticating ? 'VERIFYING...' : (isRegistering ? 'INITIALIZE OPERATOR' : 'AUTHORIZE ACCESS')}
                </button>
              </form>

              <button 
                onClick={toggleMode}
                className="w-full mt-6 text-center text-[10px] font-bold text-slate-500 hover:text-white uppercase transition-colors"
              >
                {isRegistering ? 'Existing Operator? Sign In' : 'New Operator? Request Credentials'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col h-[400px] lg:h-auto overflow-hidden">
             <div className="flex items-center gap-2 mb-4">
                <span className={`w-2 h-2 rounded-full ${hasUplink ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-[9px] font-mono text-slate-300 uppercase font-bold tracking-widest">SOC Uplink Console</span>
             </div>
             <div className="flex-1 overflow-y-auto font-mono text-[9px] space-y-2 text-slate-400 scrollbar-hide">
                {consoleLogs.length === 0 ? (
                  <p className="opacity-30 italic">Terminal idle. Awaiting handshake...</p>
                ) : (
                  consoleLogs.map((log, i) => <p key={i} className="animate-in fade-in slide-in-from-bottom-1 duration-200">{log}</p>)
                )}
                <div ref={logEndRef} />
             </div>
             <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[8px] font-mono text-slate-600">PBKDF2-SHA256 // AES-GCM</span>
                <button onClick={checkUplink} className="text-[8px] font-mono text-blue-500 hover:text-blue-400 transition-colors">SYSCALL: RE-PING</button>
             </div>
          </div>
        </div>
        
        <footer className="text-center text-[9px] font-mono text-slate-700 uppercase tracking-[0.4em]">
           Sentinel SOC v3.2 // Forensic Integrity Engine // (C) 2025
        </footer>
      </div>
    </div>
  );
};

export default LoginPage;
