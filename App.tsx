
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnalysisState, MediaType, Verdict, DetectionResult } from './types';
import { analyzeMedia } from './services/geminiService';
import { dbService, AuditEntry } from './services/dbService';
import FileUploader from './components/FileUploader';
import VerdictBadge from './components/VerdictBadge';
import AudioVisualizer from './components/AudioVisualizer';
import VideoPreview from './components/VideoPreview';
import LoginPage from './components/LoginPage';
import { useAuth } from './contexts/AuthContext';
import { useSettings } from './contexts/SettingsContext';

const ANALYSIS_STAGES: Record<MediaType, string[]> = {
  [MediaType.AUDIO]: [
    'Initializing spectral scan...',
    'Extracting acoustic features...',
    'Analyzing pitch consistency...',
    'Verifying voice signature...',
    'Detecting neural cloning artifacts...',
    'Finalizing forensic report...'
  ],
  [MediaType.VIDEO]: [
    'Initializing frame sequence extraction...',
    'Analyzing lip-sync temporal alignment...',
    'Mapping facial landmarks...',
    'Checking blink pattern regularities...',
    'Scanning for GAN blending artifacts...',
    'Finalizing temporal integrity check...'
  ],
  [MediaType.IMAGE]: [
    'Loading pixel-level metadata...',
    'Scanning frequency-domain anomalies...',
    'Analyzing lighting consistency...',
    'Detecting AI-generated textures...',
    'Checking for compression artifacts...',
    'Compiling forensic signals...'
  ],
  [MediaType.URL]: [
    'Resolving domain reputation...',
    'Tracing redirect chains...',
    'Querying WHOIS registry records...',
    'Auditing certificate transparency logs...',
    'Compiling risk assessment...',
    'Finalizing distribution scan...'
  ]
};

interface SOCNotification {
  id: string;
  type: 'critical' | 'info' | 'success';
  title: string;
  message: string;
  fileName: string;
  confidence?: number;
}

const App: React.FC = () => {
  const { isAuthenticated, operatorId, logout } = useAuth();
  const { settings, resetWeights, updateSettings } = useSettings();
  const [urlInput, setUrlInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AuditEntry[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [batchFiles, setBatchFiles] = useState<Record<string, File>>({});
  const [isDbSyncing, setIsDbSyncing] = useState(false);
  const [isUplinkActive, setIsUplinkActive] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<SOCNotification[]>([]);

  useEffect(() => {
    checkKeySelection();
    if (isAuthenticated && operatorId) {
      const loadHistory = async () => {
        setIsDbSyncing(true);
        try {
          const history = await dbService.getInvestigations(operatorId);
          const historyMap = history.reduce((acc, inv) => {
            acc[inv.id] = inv;
            return acc;
          }, {} as Record<string, AnalysisState>);
          setAnalyses(historyMap);
          
          const logs = await dbService.getRecentLogs(operatorId);
          setRecentLogs(logs);
        } catch (e) {
          console.error('DATABASE_SYNC_ERROR:', e);
        } finally {
          setIsDbSyncing(false);
        }
      };
      loadHistory();
    }
  }, [isAuthenticated, operatorId]);

  const checkKeySelection = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
      const active = await aistudio.hasSelectedApiKey();
      setIsUplinkActive(active);
    }
  };

  const handleOpenKeyDialog = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.openSelectKey === 'function') {
      await aistudio.openSelectKey();
      setIsUplinkActive(true);
    }
  };

  const addNotification = useCallback((notif: Omit<SOCNotification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { ...notif, id }]);
    const duration = notif.type === 'critical' ? 8000 : 4000;
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const refreshLogs = async () => {
    if (operatorId) {
      const logs = await dbService.getRecentLogs(operatorId);
      setRecentLogs(logs);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const processUrl = async (id: string, url: string) => {
    const type = MediaType.URL;
    const stages = ANALYSIS_STAGES[type];
    const updateAnalysis = (patch: Partial<AnalysisState>) => {
      setAnalyses(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    updateAnalysis({ isAnalyzing: true, progress: 5, currentStage: stages[0], error: null });
    if (operatorId) dbService.logAction(operatorId, 'URL_SCAN_START', `Target Domain: ${url}`);

    const timer = setInterval(() => {
      setAnalyses(prev => {
        if (!prev[id]) return prev;
        const nextProgress = Math.min(prev[id].progress + (Math.random() * 8 + 1), 92);
        const stageIndex = Math.min(Math.floor((nextProgress / 100) * stages.length), stages.length - 1);
        return { ...prev, [id]: { ...prev[id], progress: nextProgress, currentStage: stages[stageIndex] } };
      });
    }, 800);

    try {
      let result = await analyzeMedia(type, url);
      
      clearInterval(timer);
      const finalState: AnalysisState = {
        ...(analyses[id] || {}),
        id,
        fileName: url,
        isAnalyzing: false,
        progress: 100,
        currentStage: 'Cyber Intelligence Commit Complete',
        result: { ...result, id, fileName: url },
        error: null
      };

      updateAnalysis(finalState);

      // --- Threat Notification System ---
      if (result.verdict === Verdict.LIKELY_FAKE && result.confidence_score >= settings.confidenceThreshold) {
        addNotification({
          type: 'critical',
          title: 'CYBER THREAT ALERT',
          message: `Malicious domain pattern detected with ${result.confidence_score}% confidence.`,
          fileName: url,
          confidence: result.confidence_score
        });
      } else {
        addNotification({
          type: 'info',
          title: 'URL SCAN COMPLETE',
          message: `Intelligence gathering for ${url} finalized.`,
          fileName: url
        });
      }

      if (operatorId) {
        await dbService.saveInvestigation(finalState, operatorId);
        refreshLogs();
      }
    } catch (err: any) {
      clearInterval(timer);
      const errorMsg = err.message || "Forensic engine failure.";
      
      if (errorMsg.includes("UPLINK_TERMINATED")) {
        setIsUplinkActive(false);
      }

      updateAnalysis({ 
        isAnalyzing: false, 
        error: { 
          code: "ENGINE_ERROR", 
          message: errorMsg, 
          guidance: ["Reset Cloud Uplink", "Check Network Transparency"], 
          severity: 'critical' 
        } 
      });
    }
  };

  const processFile = async (id: string, file: File) => {
    let type = MediaType.IMAGE;
    if (file.type.startsWith('video/')) type = MediaType.VIDEO;
    if (file.type.startsWith('audio/')) type = MediaType.AUDIO;

    const stages = ANALYSIS_STAGES[type];
    const updateAnalysis = (patch: Partial<AnalysisState>) => {
      setAnalyses(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    updateAnalysis({ isAnalyzing: true, progress: 5, currentStage: stages[0], error: null });
    if (operatorId) dbService.logAction(operatorId, 'ANALYSIS_START', `Target: ${file.name} [${type}]`);

    const timer = setInterval(() => {
      setAnalyses(prev => {
        if (!prev[id]) return prev;
        const nextProgress = Math.min(prev[id].progress + (Math.random() * 8 + 1), 92);
        const stageIndex = Math.min(Math.floor((nextProgress / 100) * stages.length), stages.length - 1);
        return { ...prev, [id]: { ...prev[id], progress: nextProgress, currentStage: stages[stageIndex] } };
      });
    }, 800);

    try {
      const base64 = await fileToBase64(file);
      let result = await analyzeMedia(type, base64, file.type);
      
      clearInterval(timer);
      const finalState: AnalysisState = {
        ...(analyses[id] || {}),
        id,
        fileName: file.name,
        isAnalyzing: false,
        progress: 100,
        currentStage: 'Final Forensic Commit Complete',
        result: { ...result, id, fileName: file.name },
        error: null
      };

      updateAnalysis(finalState);

      // --- Threat Notification System ---
      if (result.verdict === Verdict.LIKELY_FAKE && result.confidence_score >= settings.confidenceThreshold) {
        addNotification({
          type: 'critical',
          title: 'CRITICAL THREAT DETECTED',
          message: `Deepfake signatures identified with ${result.confidence_score}% confidence.`,
          fileName: file.name,
          confidence: result.confidence_score
        });
      } else {
        addNotification({
          type: 'success',
          title: 'ANALYSIS COMPLETE',
          message: `Forensic scan for ${file.name} finalized successfully.`,
          fileName: file.name
        });
      }

      if (operatorId) {
        await dbService.saveInvestigation(finalState, operatorId);
        refreshLogs();
      }
    } catch (err: any) {
      clearInterval(timer);
      const errorMsg = err.message || "Forensic engine failure.";
      
      if (errorMsg.includes("UPLINK_TERMINATED")) {
        setIsUplinkActive(false);
      }

      updateAnalysis({ 
        isAnalyzing: false, 
        error: { 
          code: "ENGINE_ERROR", 
          message: errorMsg, 
          guidance: ["Reset Cloud Uplink", "Check Project Permissions"], 
          severity: 'critical' 
        } 
      });
    }
  };

  const handleFilesSelect = (files: File[]) => {
    if (!isUplinkActive) {
      handleOpenKeyDialog();
      return;
    }
    const newAnalyses: Record<string, AnalysisState> = {};
    const newFiles: Record<string, File> = {};
    files.forEach(file => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      newAnalyses[id] = { id, fileName: file.name, isAnalyzing: false, result: null, error: null, progress: 0 };
      newFiles[id] = file;
    });
    setAnalyses(prev => ({ ...prev, ...newAnalyses }));
    setBatchFiles(prev => ({ ...prev, ...newFiles }));
    if (!activeId && files.length > 0) setActiveId(Object.keys(newAnalyses)[0]);
    Object.keys(newAnalyses).forEach((id, index) => setTimeout(() => processFile(id, newFiles[id]), index * 500));
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUplinkActive) {
      handleOpenKeyDialog();
      return;
    }
    if (!urlInput.trim()) return;
    
    const urls = urlInput.split(/[\n, ]+/).map(u => u.trim()).filter(u => u.includes('.'));
    if (urls.length === 0) return;

    const newAnalyses: Record<string, AnalysisState> = {};
    urls.forEach((url, index) => {
      const id = `URL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      newAnalyses[id] = { id, fileName: url, isAnalyzing: true, result: null, error: null, progress: 0 };
    });

    setAnalyses(prev => ({ ...prev, ...newAnalyses }));
    setUrlInput('');
    
    if (!activeId) setActiveId(Object.keys(newAnalyses)[0]);

    // Concurrently process all URLs with a slight stagger for UI smoothness
    Object.keys(newAnalyses).forEach((id, index) => {
      const url = newAnalyses[id].fileName;
      setTimeout(() => processUrl(id, url), index * 300);
    });
  };

  const removeAnalysis = async (id: string) => {
    await dbService.deleteInvestigation(id);
    setAnalyses(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (activeId === id) setActiveId(null);
    refreshLogs();
  };

  const activeAnalysis = activeId ? analyses[activeId] : null;

  if (!isAuthenticated) return <LoginPage />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center">
      
      {/* Real-time Notification Overlay */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-4 w-full max-w-sm">
        {notifications.map((notif) => (
          <div 
            key={notif.id} 
            onClick={() => removeNotification(notif.id)}
            className={`cursor-pointer p-4 rounded-2xl border-2 shadow-2xl animate-in slide-in-from-right duration-500 backdrop-blur-xl group transition-all hover:scale-105 ${
              notif.type === 'critical' 
                ? 'bg-red-500/20 border-red-500/50 text-red-200' 
                : 'bg-slate-900/90 border-slate-800 text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded ${
                notif.type === 'critical' ? 'bg-red-600 animate-pulse' : 'bg-blue-600'
              }`}>
                {notif.title}
              </span>
              <button className="text-slate-500 group-hover:text-white"><i className="fas fa-times text-xs"></i></button>
            </div>
            <p className="text-[11px] font-mono mb-2 line-clamp-2 uppercase leading-tight">{notif.fileName}</p>
            <p className="text-xs font-medium opacity-80">{notif.message}</p>
            {notif.confidence && (
              <div className="mt-3 w-full h-1 bg-red-950 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ width: `${notif.confidence}%` }}></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showLogs && (
        <div className="fixed inset-0 z-[60] flex justify-end">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogs(false)}></div>
           <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-8 shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black uppercase tracking-tighter">System Ledger</h2>
                 <button onClick={() => setShowLogs(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
              </div>
              <div className="space-y-4 overflow-y-auto h-[calc(100%-80px)] pr-2">
                 {recentLogs.map((log) => (
                    <div key={log.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                       <div className="flex justify-between text-[10px] font-mono text-blue-500 uppercase">
                          <span>{log.action}</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                       </div>
                       <p className="text-xs text-slate-400 leading-relaxed font-mono">{log.details}</p>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black uppercase tracking-tighter">SOC System Parameters</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-6">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Automated Flag Threshold</p>
                <input type="range" min="50" max="100" value={settings.confidenceThreshold} onChange={(e) => updateSettings({ confidenceThreshold: parseInt(e.target.value) })} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                <div className="flex justify-between mt-2 font-mono text-xs text-blue-400"><span>50%</span><span>{settings.confidenceThreshold}%</span><span>100%</span></div>
              </div>
              <button onClick={resetWeights} className="w-full py-3 bg-slate-800 rounded-xl text-xs font-bold uppercase hover:bg-slate-700 transition-all">Factory Reset Neural Weights</button>
            </div>
          </div>
        </div>
      )}

      <header className="w-full max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 mb-8 border-b border-slate-900 pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20"><i className="fas fa-shield-halved text-2xl text-white"></i></div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">Sentinel SOC</h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Operator: {operatorId} // Node Connected</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1.5 rounded-full border flex items-center gap-2 cursor-pointer transition-all hover:bg-slate-900 ${isUplinkActive ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400 animate-pulse'}`} onClick={handleOpenKeyDialog}>
             <i className={`fas ${isUplinkActive ? 'fa-bolt' : 'fa-bolt-slash'}`}></i>
             <span className="text-[10px] font-black uppercase tracking-widest">{isUplinkActive ? 'Uplink: Online' : 'Uplink: Terminated'}</span>
          </div>
          <button onClick={() => setShowLogs(true)} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-emerald-500 transition-all"><i className="fas fa-file-shield"></i></button>
          <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-blue-500 transition-all"><i className="fas fa-sliders"></i></button>
          <button onClick={logout} className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-red-500 transition-all"><i className="fas fa-power-off"></i></button>
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col max-h-[70vh] shadow-xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Queue Monitor</h3>
              {Object.keys(analyses).length > 0 && (
                <button onClick={async () => { await dbService.clearOperatorInvestigations(operatorId!); setAnalyses({}); refreshLogs(); }} className="text-[9px] font-bold text-red-500 uppercase hover:underline">Clear</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {(Object.values(analyses) as AnalysisState[]).length === 0 ? (
                <div className="p-12 text-center opacity-20 italic text-[10px] uppercase tracking-[0.2em] font-mono">No Active Scans</div>
              ) : (
                (Object.values(analyses) as AnalysisState[]).map((an) => (
                  <button key={an.id} onClick={() => setActiveId(an.id)} className={`w-full p-3 rounded-xl border flex flex-col gap-1 transition-all ${activeId === an.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-slate-950/30 border-slate-800 hover:bg-slate-800/50'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px] uppercase font-mono">{an.fileName}</span>
                      {an.isAnalyzing ? <i className="fas fa-circle-notch animate-spin text-blue-500 text-[10px]"></i> : an.result ? <i className={`fas ${an.result.verdict === Verdict.REAL ? 'fa-check-double text-green-500' : 'fa-biohazard text-red-500'} text-[10px]`}></i> : an.error ? <i className="fas fa-warning text-red-400 text-[10px]"></i> : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isDbSyncing ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`}></span>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Local Ledger</span>
              </div>
              <span className="text-[9px] font-mono text-slate-600 uppercase">v3.2</span>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-8">
          {(!activeAnalysis || Object.keys(analyses).length === 0) ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <FileUploader onFilesSelect={handleFilesSelect} />
               <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-3"><i className="fas fa-link text-blue-500"></i> Cyber Intelligence Domain Scan</h3>
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-950 px-2 py-1 rounded">MULTI-UPLINK SUPPORT</span>
                  </div>
                  <form onSubmit={handleUrlSubmit} className="space-y-4">
                    <textarea value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Enter URLs for deep forensic intelligence gathering (one per line or comma-separated)..." rows={3} className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-6 focus:border-blue-500 outline-none font-mono text-sm resize-none transition-all placeholder:opacity-30" />
                    <button type="submit" disabled={!urlInput.trim()} className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-30 py-5 rounded-2xl font-black uppercase text-sm tracking-[0.3em] transition-all shadow-lg shadow-blue-600/20">Authorize Batch Scan</button>
                  </form>
               </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl relative animate-in fade-in zoom-in-95 duration-500">
              <button onClick={() => removeAnalysis(activeAnalysis.id)} className="absolute top-8 right-8 text-slate-500 hover:text-red-500 transition-colors p-2"><i className="fas fa-trash-can"></i></button>
              <div className="mb-10 pb-10 border-b border-slate-800 flex justify-between items-center">
                 <div>
                   <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Investigation Profile</h2>
                   <p className="text-2xl font-black font-mono text-blue-400 break-all">{activeAnalysis.fileName}</p>
                 </div>
                 {activeAnalysis.result && <VerdictBadge verdict={activeAnalysis.result.verdict} />}
              </div>
              
              {activeAnalysis.isAnalyzing ? (
                 <div className="py-24 flex flex-col items-center gap-12">
                    <div className="relative">
                      <i className="fas fa-microscope text-7xl text-blue-500 animate-pulse"></i>
                      <div className="absolute -inset-4 border border-blue-500/20 rounded-full animate-[spin_8s_linear_infinite]"></div>
                    </div>
                    <div className="text-center space-y-3">
                      <p className="text-blue-400 font-mono text-sm uppercase tracking-[0.4em]">{activeAnalysis.currentStage}</p>
                      <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden mx-auto">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${activeAnalysis.progress}%` }}></div>
                      </div>
                    </div>
                 </div>
              ) : activeAnalysis.error ? (
                <div className="py-24 flex flex-col items-center gap-8">
                   <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/30">
                     <i className="fas fa-triangle-exclamation text-5xl"></i>
                   </div>
                   <div className="text-center space-y-3">
                     <h3 className="text-2xl font-black uppercase tracking-tighter text-red-400">{activeAnalysis.error.code}</h3>
                     <p className="text-slate-400 font-medium max-w-md mx-auto">{activeAnalysis.error.message}</p>
                   </div>
                   <div className="flex gap-4">
                     <button onClick={() => activeAnalysis.id.startsWith('URL') ? processUrl(activeAnalysis.id, activeAnalysis.fileName) : (batchFiles[activeAnalysis.id] && processFile(activeAnalysis.id, batchFiles[activeAnalysis.id]))} className="px-10 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all">Retry Investigation</button>
                     {!isUplinkActive && <button onClick={handleOpenKeyDialog} className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all">Re-Provision Uplink</button>}
                   </div>
                </div>
              ) : activeAnalysis.result ? (
                 <div className="space-y-12 animate-in slide-in-from-top-4 duration-700">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Forensic Report Ledger</h3>
                      <div className="p-8 bg-slate-950 border border-slate-800 rounded-3xl italic text-xl leading-relaxed text-slate-300 shadow-inner">
                         {activeAnalysis.result.forensic_analysis}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                       <div className="space-y-6">
                          <div className="flex justify-between items-end mb-2">
                             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Neural Confidence</h3>
                             <span className="font-mono text-xl text-blue-400">{activeAnalysis.result.confidence_score}%</span>
                          </div>
                          <div className="w-full h-5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-1 shadow-inner">
                             <div className={`h-full rounded-full shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all duration-[1.5s] ease-out ${
                               activeAnalysis.result.confidence_score >= settings.confidenceThreshold ? 'bg-red-500 shadow-red-500/40' : 'bg-blue-500'
                             }`} style={{ width: `${activeAnalysis.result.confidence_score}%` }}></div>
                          </div>
                          <div className="bg-blue-500/5 p-6 rounded-2xl border border-blue-500/10 mt-8">
                             <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Recommended Protocols</h4>
                             <p className="text-sm text-slate-300 leading-relaxed font-medium">{activeAnalysis.result.recommendation}</p>
                          </div>
                       </div>
                       
                       <div className="space-y-4">
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Detected Neural Signals</h3>
                          <div className="flex flex-wrap gap-3">
                             {activeAnalysis.result.signals_detected.map((s, i) => (
                                <span key={i} className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-3 transition-colors hover:border-blue-500/30">
                                   <i className="fas fa-fingerprint text-blue-500/50"></i>{s}
                                </span>
                             ))}
                          </div>
                          {activeAnalysis.result.grounding_sources && (
                            <div className="mt-8 space-y-4">
                               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Threat Intelligence Sources</h3>
                               <div className="space-y-2">
                                  {activeAnalysis.result.grounding_sources.map((src, i) => (
                                     <a key={i} href={src.uri} target="_blank" rel="noreferrer" className="block p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-[10px] font-mono text-blue-400 hover:bg-blue-500/10 transition-all truncate">
                                        <i className="fas fa-globe mr-2 text-slate-600"></i>{src.title}
                                     </a>
                                  ))}
                               </div>
                            </div>
                          )}
                       </div>
                    </div>
                    {batchFiles[activeAnalysis.id] && (
                       <div className="pt-10 border-t border-slate-800 flex flex-col gap-6">
                         <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Integrated Media Monitor</h3>
                         {batchFiles[activeAnalysis.id].type.startsWith('video/') && <VideoPreview file={batchFiles[activeAnalysis.id]} />}
                         {batchFiles[activeAnalysis.id].type.startsWith('audio/') && <AudioVisualizer file={batchFiles[activeAnalysis.id]} isActive={activeId === activeAnalysis.id} />}
                         {batchFiles[activeAnalysis.id].type.startsWith('image/') && (
                            <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800">
                               <img src={URL.createObjectURL(batchFiles[activeAnalysis.id])} alt="Investigation Target" className="w-full h-auto max-h-[500px] object-contain rounded-xl" />
                            </div>
                         )}
                       </div>
                    )}
                 </div>
              ) : null}
            </div>
          )}
        </div>
      </main>

      <footer className="mt-20 py-12 text-[10px] font-mono text-slate-700 uppercase tracking-[0.6em] flex flex-col items-center gap-6 w-full max-w-7xl border-t border-slate-900">
        <p>© 2025 SENTINEL SOC // GLOBAL FORENSIC GRID</p>
        <div className="flex gap-10 opacity-30 font-bold">
           <span className="flex items-center gap-2"><i className="fas fa-database"></i> LEDGER: SECURE</span>
           <span className="flex items-center gap-2"><i className="fas fa-wifi"></i> UPLINK: {isUplinkActive ? 'STABLE' : 'LOST'}</span>
           <span className="flex items-center gap-2"><i className="fas fa-clock"></i> LATENCY: 22MS</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
