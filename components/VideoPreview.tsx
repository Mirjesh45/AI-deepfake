
import React from 'react';

interface Props {
  file: File;
}

const VideoPreview: React.FC<Props> = ({ file }) => {
  const objectUrl = React.useMemo(() => URL.createObjectURL(file), [file]);

  return (
    <div className="w-full space-y-4">
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Temporal Frame Sequence Monitor</span>
          </div>
          <span className="text-[10px] font-mono text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">ACTIVE INVESTIGATION</span>
        </div>
        
        <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-900 bg-black group">
          <video 
            src={objectUrl} 
            controls 
            className="w-full h-full object-contain"
          />
          {/* Decorative SOC Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
            <p className="text-[10px] text-slate-500 uppercase mb-1 tracking-tighter">Container Format</p>
            <p className="font-mono text-xs text-blue-400">MPEG-4 / H.264</p>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
            <p className="text-[10px] text-slate-500 uppercase mb-1 tracking-tighter">Resolution Target</p>
            <p className="font-mono text-xs text-blue-400">Dynamic Scan</p>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
            <p className="text-[10px] text-slate-500 uppercase mb-1 tracking-tighter">Frame Consistency</p>
            <p className="font-mono text-xs text-blue-400">Monitoring...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;
