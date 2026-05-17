import React, { useState } from 'react';
import { 
  FolderTree, Activity, Image as ImageIcon, Film, FileText, 
  Code2, Archive, Play, CheckCircle2, ChevronRight, FolderOutput, File, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MoveOperation {
  originalPath: string;
  destinationPath: string;
  category: string;
  size: number;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getCategoryIcon = (category: string, size = 20) => {
  switch (category) {
    case 'Images': return <ImageIcon size={size} />;
    case 'Videos': return <Film size={size} />;
    case 'Audio': return <Activity size={size} />;
    case 'Documents': return <FileText size={size} />;
    case 'Archives': return <Archive size={size} />;
    case 'Code': return <Code2 size={size} />;
    default: return <File size={size} />;
  }
};

const getCategoryColor = (category: string) => {
  return 'from-[#141414] to-[#141414]/80'; // Unified theme color
};

export default function SmartOrganizer() {
  const [scanPath, setScanPath] = useState('D:\\Downloads');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [operations, setOperations] = useState<MoveOperation[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<{filesScanned: number, bytesScanned: number, currentFile: string, phase: string} | null>(null);

  const totalSize = operations.reduce((acc, op) => acc + op.size, 0);

  const categoryGroups = operations.reduce((acc, op) => {
    if (!acc[op.category]) acc[op.category] = [];
    acc[op.category].push(op);
    return acc;
  }, {} as Record<string, MoveOperation[]>);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setOperations([]);
    setErrorMsg('');
    setSuccessCount(null);

    const progressInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8080/api/scan/progress');
        if (res.ok) setProgress(await res.json());
      } catch (e) {}
    }, 150);

    try {
      const response = await fetch('http://localhost:8080/api/organizer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: scanPath })
      });
      
      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error || 'Failed to analyze directory');
      } else {
        setOperations(data.operations);
        if (data.operations.length === 0) {
           setErrorMsg('No unorganized files found in this directory.');
        }
      }
    } catch (err) {
      setErrorMsg('Failed to connect to backend engine.');
    } finally {
      clearInterval(progressInterval);
      setProgress(null);
      setIsAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setErrorMsg('');

    const progressInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8080/api/scan/progress');
        if (res.ok) setProgress(await res.json());
      } catch (e) {}
    }, 100);

    try {
      const response = await fetch('http://localhost:8080/api/organizer/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations })
      });
      
      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error || 'Failed to execute operations');
      } else {
        setSuccessCount(data.movedCount);
      }
    } catch (err) {
      setErrorMsg('Failed to execute sorting.');
    } finally {
      clearInterval(progressInterval);
      setProgress(null);
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col gap-6 pb-6 border-b border-[#141414]/10 relative z-20">
        <div className="flex justify-between items-start">
          <div className="flex-1 max-w-2xl">
            <h2 className="font-serif italic text-4xl mb-4 text-[#141414]">Smart Auto-Organizer</h2>
            <p className="font-sans text-sm opacity-60 mb-6 max-w-md leading-relaxed text-[#141414]">
              Instantly categorize cluttered directories. We will scan your chaotic folders and neatly sort files into dedicated sub-folders based on their genetic signature.
            </p>
            <div className="flex bg-white/40 border border-[#141414]/10 p-2 rounded-xl backdrop-blur-md shadow-sm focus-within:border-[#D6B98C] focus-within:shadow-[0_0_15px_rgba(214,185,140,0.1)] transition-all">
              <input 
                type="text" 
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none font-mono text-sm uppercase px-4 text-[#141414] placeholder:opacity-40"
                placeholder="ENTER CLUTTERED DIRECTORY (E.G. DOWNLOADS)..."
              />
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing || isExecuting}
                className="bg-[#141414] text-[#E4E3E0] px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-[#141414]/90 transition-all font-mono text-xs uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                {isAnalyzing ? <><Activity size={14} className="animate-spin" /> ANALYZING...</> : <><FolderTree size={14} /> ANALYZE FOLDER</>}
              </button>
            </div>
            {errorMsg && <p className="text-red-500 text-xs font-mono mt-3 ml-2">{errorMsg}</p>}
          </div>
        </div>
      </header>

      {/* Progress Monitor */}
      <AnimatePresence>
        {(isAnalyzing || isExecuting) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#141414]/5 border border-[#D6B98C]/20 p-6 rounded-xl relative overflow-hidden backdrop-blur-md">
               <div className="absolute top-0 left-0 w-1 h-full bg-[#141414]" />
               <div className="flex justify-between items-center text-xs font-mono uppercase tracking-widest text-[#141414] mb-3">
                  <div className="flex items-center gap-3"><Activity size={16} className="animate-pulse"/> {isExecuting ? 'EXECUTING SMART SORT...' : 'ANALYZING FILE SIGNATURES...'}</div>
                  {progress && <span className="font-bold">{progress.filesScanned} FILES PROCESSED</span>}
               </div>
               <div className="h-1.5 bg-[#141414]/10 rounded-full overflow-hidden mb-3">
                 <motion.div className="h-full bg-[#141414]" style={{ backgroundSize: '200% 100%' }} animate={{ backgroundPosition: ['100% 0', '-100% 0'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear'}} />
               </div>
               {progress && <div className="text-[10px] font-mono opacity-60 truncate text-[#141414]">TARGET: {progress.currentFile || 'Scanning...'}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Banner */}
      <AnimatePresence>
        {successCount !== null && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-500/10 border border-green-500/30 p-6 rounded-2xl flex items-center gap-6 relative overflow-hidden">
             <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-[#E4E3E0] shrink-0 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
               <CheckCircle2 size={32} />
             </div>
             <div>
               <h3 className="font-serif italic text-2xl text-green-500 mb-1">Organization Complete</h3>
               <p className="font-mono text-xs opacity-70 text-[#141414]">Successfully routed <strong className="text-green-500">{successCount}</strong> files into intelligent category structures.</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analytics Presentation */}
      {operations.length > 0 && successCount === null && !isExecuting && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
           <div className="flex items-center justify-between border-b border-[#141414]/10 pb-4">
             <div className="flex items-center gap-3">
               <FolderOutput size={24} className="text-[#141414] opacity-80" />
               <h3 className="font-serif italic text-2xl text-[#141414]">Proposed Architecture</h3>
             </div>
             <button 
               onClick={handleExecute}
               className="bg-[#141414] hover:bg-[#141414]/90 text-[#E4E3E0] px-8 py-4 rounded-xl flex items-center gap-3 font-mono text-sm tracking-widest shadow-[0_0_20px_rgba(214,185,140,0.3)] hover:shadow-[0_0_30px_rgba(214,185,140,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all"
             >
               <Play size={16} className="fill-[#0A0A0A]" />
               EXECUTE AUTO-SORT
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(categoryGroups).sort((a,b) => b[1].length - a[1].length).map(([cat, ops], idx) => {
              const catSize = ops.reduce((acc, op) => acc + op.size, 0);
              const colorClass = getCategoryColor(cat);
              
              return (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }} key={cat} className="bg-white/40 border border-[#141414]/10 rounded-2xl p-6 shadow-sm hover:border-[#D6B98C]/50 transition-all group overflow-hidden relative">
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colorClass} opacity-50 group-hover:opacity-100`} />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-xl bg-[#141414]/10 text-[#141414]`}>
                      {getCategoryIcon(cat, 24)}
                    </div>
                    <div className="text-right">
                      <div className="font-serif italic text-3xl font-bold text-[#141414]">{ops.length}</div>
                      <div className="font-mono text-[9px] uppercase tracking-widest opacity-40 text-[#141414]">Files</div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-bold text-lg mb-1 text-[#141414]">{cat}</h4>
                    <div className="font-mono text-xs opacity-60 flex items-center gap-2 text-[#141414]">
                       <MapPin size={12} /> /Organized_{cat}
                    </div>
                  </div>

                  <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-[10px] font-mono opacity-50 uppercase text-gray-900">
                      <span>Payload Size</span>
                      <span>{formatBytes(catSize)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${colorClass}`} style={{ width: `${(catSize/totalSize) * 100}%` }} />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Operation Log Preview */}
          <div className="bg-white/40 border border-[#141414]/10 rounded-2xl overflow-hidden mt-8">
            <div className="bg-[#E4E3E0] p-4 border-b border-[#141414]/10">
              <h4 className="font-mono text-xs uppercase tracking-widest opacity-60 text-[#141414]">Operation Manifest Preview (Top 100)</h4>
            </div>
            <div className="divide-y divide-[#2A2A2A] max-h-[400px] overflow-y-auto">
              {operations.slice(0, 100).map((op, i) => (
                <div key={i} className="p-3 pl-6 flex items-center gap-4 hover:bg-[#141414]/5 transition-colors">
                  <div className="opacity-40 text-[#141414]">{getCategoryIcon(op.category, 14)}</div>
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <div className="font-mono text-[10px] opacity-60 truncate flex-1 text-[#141414]" title={op.originalPath}>{op.originalPath.split('\\').pop() || op.originalPath.split('/').pop()}</div>
                    <ChevronRight size={14} className="opacity-30 shrink-0 text-[#141414]" />
                    <div className="font-mono text-[10px] font-bold text-[#141414] truncate flex-1" title={op.destinationPath}>Organized_{op.category}\{op.destinationPath.split('\\').pop() || op.destinationPath.split('/').pop()}</div>
                  </div>
                  <div className="font-mono text-[10px] opacity-40 shrink-0 w-16 text-right text-[#141414]">
                    {formatBytes(op.size)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
