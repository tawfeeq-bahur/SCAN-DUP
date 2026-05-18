import React, { useState, useEffect } from 'react';
import { Target, Search, X, PieChart, Folder, Film, Archive, Code2, FileText, HardDrive, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function StorageRadar() {
  const [path, setPath] = useState('C:\\');
  const [isScanning, setIsScanning] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [maxSize, setMaxSize] = useState(0);
  const [progress, setProgress] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const scanRunRef = React.useRef(0);
  const cancelRequestedRef = React.useRef(false);
  const scanAbortRef = React.useRef<AbortController | null>(null);

  const selectFolder = async () => {
    try {
      const electron = (window as any).require ? (window as any).require('electron') : null;
      const ipc = electron?.ipcRenderer;
      if (!ipc || !ipc.invoke) return;
      const selected = await ipc.invoke('select-folder');
      if (selected) setPath(selected);
    } catch (err) {
      console.error('Failed to select folder', err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:8080/api/scan/progress');
          if (res.ok) {
            setProgress(await res.json());
          }
        } catch (err) { }
      }, 100);
    } else {
      setProgress(null);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  const categories = files.reduce((acc: any, file: any) => {
    const cat = file.category || 'Other';
    if (!acc[cat]) acc[cat] = { count: 0, size: 0 };
    acc[cat].count++;
    acc[cat].size += file.size;
    return acc;
  }, {});

  const startScan = async () => {
    const runId = ++scanRunRef.current;
    cancelRequestedRef.current = false;
    setCancelRequested(false);
    setIsScanning(true);
    setFiles([]);
    try {
      const controller = new AbortController();
      scanAbortRef.current = controller;
      const res = await fetch('http://localhost:8080/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (runId !== scanRunRef.current || cancelRequestedRef.current) return;
      if (res.status === 409) return;
      if (res.ok) {
        setFiles(data.largestFiles);
        setSelectedCategory(null); // Reset filter on new scan
        if (data.largestFiles.length > 0) {
          setMaxSize(data.largestFiles[0].size);
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setIsScanning(false);
      setCancelRequested(false);
      scanAbortRef.current = null;
    }
  };

  const requestStop = async () => {
    if (!isScanning) return;
    cancelRequestedRef.current = true;
    setCancelRequested(true);
    try {
      await fetch('http://localhost:8080/api/scan/stop', { method: 'POST' });
      scanAbortRef.current?.abort();
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
      setCancelRequested(false);
    }
  };

  const handleDelete = async (filePath: string) => {
    try {
      const res = await fetch('http://localhost:8080/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: [filePath],
          moveToTrash: true,
          bytesRecovered: files.find(f => f.path === filePath)?.size || 0
        }),
      });
      if (res.ok) {
        setFiles(files.filter(f => f.path !== filePath));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-end pb-6 border-bottom border-[#141414]/10">
        <div>
          <h2 className="font-serif italic text-4xl">Storage Radar</h2>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest mt-2">
            Top 50 Largest Files Analysis
          </p>
        </div>
        <div className="text-right">
          <div className="font-serif italic text-3xl text-[#141414] flex items-center gap-2 justify-end">
            <Target className={isScanning ? "animate-spin" : ""} /> {files.length} HOGS
          </div>
        </div>
      </header>

      {/* Control Panel */}
      <div className="flex bg-white/40 border border-[#141414]/10 p-2 rounded-xl backdrop-blur-md shadow-sm focus-within:border-[#D6B98C] focus-within:shadow-[0_0_15px_rgba(214,185,140,0.1)] transition-all">
        <label className="font-mono text-[10px] uppercase tracking-widest opacity-60 self-center pl-4 pr-2">
          TARGET DIRECTORY
        </label>
        <input 
          type="text" 
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none font-mono text-sm uppercase px-4 text-[#141414] placeholder:opacity-40"
          placeholder="E.G. C:\USERS\DOWNLOADS..."
          disabled={isScanning}
        />
        <button
          onClick={selectFolder}
          aria-label="Select Folder"
          title="Select folder"
          className="px-3 py-2 rounded-md hover:bg-[#141414]/5 transition-colors"
          disabled={isScanning}
        >
          <Folder size={16} />
        </button>
        <button 
          onClick={startScan}
          disabled={isScanning}
          className="bg-[#141414] text-[#E4E3E0] px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-[#141414]/90 hover:scale-[1.02] active:scale-[0.98] transition-all font-mono text-xs uppercase tracking-widest shadow-md"
        >
          {isScanning ? (
            <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 1 }}><Search size={16} /></motion.div> SCANNING...</>
          ) : (
            <><Target size={16} /> ENGAGE RADAR</>
          )}
        </button>
        {isScanning && (
          <button
            onClick={requestStop}
            disabled={cancelRequested}
            className="ml-2 bg-red-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-red-700 active:scale-[0.98] transition-all font-mono text-xs uppercase tracking-widest shadow-md disabled:opacity-60"
          >
            <X size={16} /> {cancelRequested ? 'STOPPING' : 'STOP'}
          </button>
        )}
      </div>

      {/* Progress & Categories */}
      <AnimatePresence>
        {isScanning && progress && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#141414]/5 border border-[#141414]/10 rounded-lg p-4 font-mono text-xs overflow-hidden"
          >
            <div className="flex justify-between uppercase opacity-60 mb-2">
              <span>{progress.filesScanned.toLocaleString()} files scanned</span>
              <span>{formatBytes(progress.bytesScanned)} processed</span>
            </div>
            <div className="w-full h-1 bg-[#141414]/10 rounded-full overflow-hidden mb-2">
              <motion.div 
                className="h-full bg-[#141414]" 
                animate={{ width: '100%' }} 
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              />
            </div>
            <div className="truncate opacity-50">Current: {progress.currentFile}</div>
          </motion.div>
        )}

        {!isScanning && files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {Object.entries(categories).map(([cat, data]: [string, any]) => {
              const isSelected = selectedCategory === cat;
              return (
                <button 
                  key={cat} 
                  onClick={() => setSelectedCategory(isSelected ? null : cat)}
                  className={`border rounded-lg p-4 flex flex-col items-center justify-center text-center transition-all ${isSelected ? 'bg-[#141414]/10 border-[#D6B98C] shadow-[0_0_15px_rgba(214,185,140,0.3)]' : 'bg-white/40 border-[#141414]/10 hover:border-[#D6B98C]/50'}`}
                >
                  <div className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest mb-2 ${isSelected ? 'text-[#141414] font-bold' : 'opacity-60'}`}>
                    <PieChart size={12} /> {cat}
                  </div>
                  <div className="font-serif italic text-2xl text-[#141414]">{formatBytes(data.size)}</div>
                  <div className="font-mono text-[10px] opacity-40 mt-1">{data.count} Files</div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* EMPTY STATE */}
      <AnimatePresence>
        {!isScanning && files.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="min-h-[60vh] flex items-center justify-center"
          >
            <div className="w-full max-w-4xl text-center">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-[#141414]/10 flex items-center justify-center shadow-[0_0_30px_rgba(20,20,20,0.08)]">
                <Target size={28} className="text-[#141414]" />
              </div>
              <h3 className="mt-6 font-serif italic text-3xl text-[#141414]">Largest File Intelligence</h3>
              <p className="mt-3 text-sm text-[#141414]/70 max-w-xl mx-auto">
                AortaCore will identify massive media files, unused SDKs, old installers, hidden cache systems, and space-consuming archives.
              </p>
              <motion.button
                onClick={startScan}
                disabled={isScanning}
                className="mt-8 bg-[#141414] text-[#E4E3E0] px-10 py-4 rounded-xl font-mono text-xs uppercase tracking-widest shadow-md hover:bg-[#141414]/90 transition-all"
                animate={{ boxShadow: ['0 0 0 rgba(214,185,140,0)', '0 0 18px rgba(214,185,140,0.35)', '0 0 0 rgba(214,185,140,0)'] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                Engage Radar
              </motion.button>

              <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Videos', icon: <Film size={16} /> },
                  { label: 'Archives', icon: <Archive size={16} /> },
                  { label: 'AI Models', icon: <HardDrive size={16} /> },
                  { label: 'SDK Files', icon: <Code2 size={16} /> },
                  { label: 'Documents', icon: <FileText size={16} /> },
                ].map(item => (
                  <div key={item.label} className="bg-white/30 border border-[#141414]/10 rounded-xl p-4 text-center opacity-70 hover:opacity-100 transition-opacity">
                    <div className="mx-auto w-8 h-8 rounded-lg bg-[#141414]/10 flex items-center justify-center text-[#141414]">
                      {item.icon}
                    </div>
                    <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[#141414]/70">{item.label}</div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#141414]/10" />
                  </div>
                ))}
              </div>

              <div className="mt-10 bg-white/30 border border-[#141414]/10 rounded-2xl overflow-hidden text-left">
                <div className="px-5 py-3 border-b border-[#141414]/10 font-mono text-[10px] uppercase tracking-widest text-[#141414]/60">
                  Top Hogs Preview
                </div>
                <div className="divide-y divide-[#141414]/10">
                  {[
                    { name: 'weights.bin', size: '3.2 GB' },
                    { name: 'sdk-system.img', size: '2.1 GB' },
                    { name: 'video-render.mp4', size: '8.4 GB' },
                  ].map((row) => (
                    <div key={row.name} className="px-5 py-3 flex items-center justify-between text-sm text-[#141414]/60">
                      <span className="font-mono text-[11px] uppercase tracking-widest">{row.name}</span>
                      <span className="font-serif italic text-lg">{row.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div className="space-y-4">
        <AnimatePresence>
          {files
            .filter(file => selectedCategory ? (file.category || 'Other') === selectedCategory : true)
            .map((file, index) => {
            const widthPercent = (file.size / maxSize) * 100;
            return (
              <motion.div
                key={file.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.02 }}
                className={`group relative bg-white/40 border p-4 rounded-lg overflow-hidden flex items-center justify-between transition-all ${index === 0 ? 'border-[#D6B98C]/50 shadow-[0_0_20px_rgba(214,185,140,0.15)]' : 'border-[#141414]/10'}`}
              >
                {/* Background Bar */}
                <motion.div 
                  className={`absolute left-0 top-0 bottom-0 -z-10 ${index === 0 ? 'bg-[#141414]/20' : (index < 3 ? 'bg-amber-500/10' : 'bg-[#141414]/5')}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{ type: "spring", stiffness: 50, delay: index * 0.05 }}
                />
                
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                  <div className={`w-8 h-8 rounded text-[#E4E3E0] flex items-center justify-center font-mono text-[10px] shrink-0 font-bold ${index === 0 ? 'bg-[#141414] shadow-[0_0_10px_rgba(20,20,20,0.2)]' : (index < 3 ? 'bg-[#141414]/60' : 'bg-[#E4E3E0] text-[#141414]')}`}>
                    #{index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate text-[#141414]" title={file.path}>
                      {file.path.split('\\').pop() || file.path.split('/').pop()}
                    </div>
                    <div className="font-mono text-[10px] opacity-50 truncate mt-1 text-[#141414]">
                      {file.path}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className={`font-serif italic text-xl ${index === 0 ? 'text-[#141414] drop-shadow-[0_0_5px_rgba(214,185,140,0.5)]' : (index < 3 ? 'text-amber-500' : 'text-[#7A7A7A]')}`}>
                      {formatBytes(file.size)}
                    </div>
                    <div className="font-mono text-[10px] opacity-50 uppercase tracking-widest text-[#141414]">
                      {widthPercent.toFixed(1)}% Relative Size
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleDelete(file.path)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-600 hover:text-[#E4E3E0] rounded transition-all shadow-[0_0_10px_rgba(185,106,106,0)] hover:shadow-[0_0_10px_rgba(185,106,106,0.3)]"
                    title="Move to Recycle Bin"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
      </div>

    </div>
  );
}
