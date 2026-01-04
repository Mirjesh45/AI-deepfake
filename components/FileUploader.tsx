
import React, { useCallback, useState } from 'react';

interface Props {
  onFilesSelect: (files: File[]) => void;
  disabled?: boolean;
}

const FileUploader: React.FC<Props> = ({ onFilesSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelect(Array.from(e.dataTransfer.files));
    }
  }, [onFilesSelect, disabled]);

  const triggerFileInput = () => {
    if (!disabled) {
      document.getElementById('file-input')?.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerFileInput();
    }
  };

  return (
    <div 
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload media files for forensic analysis. Support for bulk upload: JPG, PNG, MP4, MP3, WAV."
      className={`relative w-full border-4 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center gap-4 cursor-pointer focus:outline-none
        ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-blue-400 bg-slate-800/30'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.99]'}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      onClick={triggerFileInput}
    >
      <input 
        id="file-input"
        type="file" 
        multiple
        className="hidden" 
        accept="image/*,video/*,audio/*"
        onChange={(e) => e.target.files && onFilesSelect(Array.from(e.target.files))}
        disabled={disabled}
      />
      <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 pointer-events-none">
        <i className="fas fa-folder-open text-4xl"></i>
      </div>
      <div className="text-center pointer-events-none">
        <p className="text-2xl font-bold mb-1">Batch Upload for Forensic Scan</p>
        <p className="text-slate-400">Drag multiple files or press <kbd className="bg-slate-700 px-2 py-0.5 rounded text-sm font-mono">Enter</kbd></p>
      </div>
      <div className="flex gap-4 mt-2 pointer-events-none">
        <span className="bg-slate-700 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-slate-300">Images</span>
        <span className="bg-slate-700 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-slate-300">Videos</span>
        <span className="bg-slate-700 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-slate-300">Audio</span>
      </div>
    </div>
  );
};

export default FileUploader;
