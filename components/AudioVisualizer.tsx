
import React, { useEffect, useRef } from 'react';

interface Props {
  file: File;
  isActive: boolean;
}

const AudioVisualizer: React.FC<Props> = ({ file, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive || !audioRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }

    const bufferLength = analyserRef.current!.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        // Gradient for SOC aesthetic
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, '#60a5fa');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  const objectUrl = URL.createObjectURL(file);

  return (
    <div className="w-full space-y-4">
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Spectral Frequency Monitor</span>
          <span className="text-xs font-mono text-blue-500">REAL-TIME DATA FEED</span>
        </div>
        <canvas 
          ref={canvasRef} 
          width={600} 
          height={100} 
          className="w-full h-24 rounded border border-slate-900"
        />
        <audio 
          ref={audioRef} 
          src={objectUrl} 
          controls 
          className="w-full mt-4 h-10 filter invert opacity-80"
          onPlay={() => audioContextRef.current?.resume()}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Sampling Rate</p>
          <p className="font-mono text-sm text-blue-400">44.1 kHz / 16-bit</p>
        </div>
        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Channel Count</p>
          <p className="font-mono text-sm text-blue-400">Stereo (2.0)</p>
        </div>
      </div>
    </div>
  );
};

export default AudioVisualizer;
