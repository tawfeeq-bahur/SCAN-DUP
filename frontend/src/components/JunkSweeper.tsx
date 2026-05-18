import React, { useState, useEffect } from 'react';
import { Trash2, ShieldAlert, Cpu, Eraser, FileWarning, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function JunkSweeper() {
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedPaths, setFailedPaths] = useState<string[]>([]);
  const [forceDelete, setForceDelete] = useState(false);
  const scanRunRef = React.useRef(0);
  const cancelRequestedRef = React.useRef(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning || isCleaning) {
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
  }, [isScanning, isCleaning]);

  const startScan = async () => {
    const runId = ++scanRunRef.current;
    cancelRequestedRef.current = false;
    setCancelRequested(false);
    setIsScanning(true);
    setHasScanned(true);
    setFiles([]);
    setDisplayLimit(100);
    setErrorMsg('');
    setFailedPaths([]);
    try {
      const res = await fetch('http://localhost:8080/api/junk/scan');
      const data = await res.json();
      if (runId !== scanRunRef.current || cancelRequestedRef.current) return;
      if (res.status === 409) {
        setErrorMsg(data.error || 'Scan canceled.');
        return;
      }
      if (res.ok) {
        setFiles(data.junkFiles);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
      setCancelRequested(false);
    }
  };

  const requestStop = async () => {
    if (!isScanning) return;
    cancelRequestedRef.current = true;
    setCancelRequested(true);
    try {
      await fetch('http://localhost:8080/api/scan/stop', { method: 'POST' });
    } catch (err) {
      setErrorMsg('Failed to request stop.');
    }
  };

  const executeClean = async () => {
    if (files.length === 0) return;
    setIsCleaning(true);
    setErrorMsg('');
    setFailedPaths([]);
    try {
      const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
      const res = await fetch('http://localhost:8080/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: files.map(f => f.path),
          moveToTrash: true, // Safety first, move to recycle bin
          forceDelete,
          bytesRecovered: totalBytes
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.deletedCount > 0) {
          const deletedSet = new Set(data.deletedPaths || []);
          const remaining = files.filter(f => !deletedSet.has(f.path));
          setFiles(remaining);
        } else {
          setErrorMsg('No files were deleted. Some items may be locked or require admin access.');
        }
        if (data.failedCount > 0) {
          setFailedPaths(data.failedPaths || []);
          setErrorMsg('Some files could not be deleted. Close apps using them and try again.');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to communicate with the cleanup engine.');
    } finally {
      setIsCleaning(false);
    }
  };

  const requestAdminRestart = async () => {
    try {
      const electron = (window as any).require ? (window as any).require('electron') : null;
      const ipc = electron?.ipcRenderer;
      if (!ipc || !ipc.invoke) {
        setErrorMsg('Admin restart is not available in this environment.');
        return;
      }
      const result = await ipc.invoke('restart-elevated');
      if (!result?.ok) {
        setErrorMsg(result?.message || 'Failed to request elevation.');
      }
    } catch (err) {
      setErrorMsg('Failed to request elevation.');
    }
  };

  const categories = files.reduce((acc: any, file: any) => {
    const cat = file.category || 'Other';
    if (!acc[cat]) acc[cat] = { count: 0, size: 0 };
    acc[cat].count++;
    acc[cat].size += file.size;
    return acc;
  }, {});

  const totalJunkSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-end pb-6 border-b border-[#141414]/10">
        <div>
          <h2 className="font-serif italic text-4xl">System Sweeper</h2>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest mt-2">
            OS Cache & Temporary File Cleanup
          </p>
        </div>
        <div className="text-right">
          <div className="font-serif italic text-3xl text-[#141414] flex items-center gap-2 justify-end">
            <Trash2 className={isScanning ? "animate-bounce" : ""} /> {files.length} JUNK FILES
          </div>
        </div>
      </header>

      {/* Hero Control Panel */}
      <div className={`rounded-xl p-8 text-[#E4E3E0] shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center transition-all bg-[#141414]`}>
        
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#E4E3E0]/20 to-transparent" />
        <div className="absolute -right-20 -top-20 opacity-5">
          <Cpu size={200} />
        </div>

        <h3 className="font-serif italic text-5xl mb-4">
          {isScanning ? "Analyzing System Core..." : 
           isCleaning ? "Erasing Digital Footprint..." :
           hasScanned && files.length === 0 ? "System is Pristine." :
           hasScanned ? `${formatBytes(totalJunkSize)} of Junk Found.` :
           "Ready for Deep Clean."}
        </h3>
        
        <p className="font-mono text-xs opacity-60 uppercase tracking-widest max-w-md mb-8">
          {hasScanned && files.length > 0 
            ? "WARNING: Massive amounts of unused cache files are degrading your disk read speeds. Execute cleanup immediately." 
            : "Scan your Windows Temp, Prefetch, and AppData cache directories for hidden performance-killing files."}
        </p>

        <div className="flex gap-4">
          <button
            onClick={startScan}
            disabled={isScanning || isCleaning}
            className="bg-white/10 hover:bg-white/20 text-[#E4E3E0] font-mono text-xs uppercase tracking-widest px-8 py-4 rounded transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isScanning ? (
              <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 1 }}><Search size={16} /></motion.div> SCANNING...</>
            ) : (
              <><Search size={16} /> ANALYZE KERNEL</>
            )}
          </button>
          {isScanning && (
            <button
              onClick={requestStop}
              disabled={cancelRequested}
              className="bg-red-600 hover:bg-red-700 text-[#E4E3E0] font-mono text-xs uppercase tracking-widest px-8 py-4 rounded transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center gap-2 disabled:opacity-60"
            >
              {cancelRequested ? 'STOPPING...' : 'STOP'}
            </button>
          )}

          <AnimatePresence>
            {files.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={executeClean}
                disabled={isCleaning}
                className="bg-red-600 hover:bg-red-700 text-[#E4E3E0] font-mono text-xs uppercase tracking-widest px-12 py-4 rounded transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] flex items-center gap-2"
              >
                {isCleaning ? "ERASING..." : <><Eraser size={16} /> DEEP CLEAN SYSTEM</>}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[10px] font-mono uppercase tracking-widest text-[#E4E3E0]/70">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={forceDelete}
              onChange={(e) => setForceDelete(e.target.checked)}
              className="accent-red-500"
            />
            Force Delete (skip Recycle Bin)
          </label>
          {failedPaths.length > 0 && (
            <button
              onClick={requestAdminRestart}
              className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
            >
              Retry as Administrator
            </button>
          )}
        </div>
        {errorMsg && (
          <div className="mt-4 text-xs font-mono uppercase tracking-widest text-red-400">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Progress Monitor */}
      <AnimatePresence>
        {(isScanning || isCleaning) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#141414]/5 border border-[#141414]/10 rounded-lg p-6 font-mono text-xs overflow-hidden"
          >
            <div className="flex justify-between uppercase text-[#141414] font-bold mb-3">
              <span className="flex items-center gap-2"><ShieldAlert size={14} className="animate-pulse" /> {isCleaning ? "ERASING JUNK" : (cancelRequested ? "CANCELING SCAN" : "SCANNING DIRECTORIES")}</span>
              <span>{progress ? `${formatBytes(progress.bytesScanned)} PROCESSED` : 'WORKING...'}</span>
            </div>
            <div className="w-full h-2 bg-[#141414]/10 rounded-full overflow-hidden mb-3">
              <motion.div 
                className="h-full bg-[#141414]" 
                animate={{ width: '100%' }} 
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              />
            </div>
            <div className="truncate opacity-50 text-[10px] text-[#141414]">Target: {progress?.currentFile || 'Preparing scan...'}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories Grid */}
      <AnimatePresence>
        {!isScanning && files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {Object.entries(categories).map(([cat, data]: [string, any], index) => (
              <motion.div 
                key={cat} 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/40 border border-[#141414]/10 rounded-xl p-6 relative overflow-hidden group hover:border-[#c2a477] transition-colors"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#141414] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between items-start mb-4">
                  <div className="font-mono text-xs uppercase tracking-widest opacity-60 text-[#141414]">{cat}</div>
                  <div className="bg-[#141414]/10 text-[#141414] px-2 py-1 rounded text-[10px] font-mono font-bold">{data.count} Files</div>
                </div>
                <div className="font-serif italic text-4xl text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.2)]">{formatBytes(data.size)}</div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Failed Deletions */}
      {failedPaths.length > 0 && (
        <div className="bg-white/40 border border-red-500/30 rounded-lg p-4 font-mono text-xs text-red-700">
          <div className="uppercase tracking-widest text-[10px] mb-2">Failed to delete ({failedPaths.length})</div>
          <div className="max-h-[160px] overflow-y-auto space-y-1">
            {failedPaths.slice(0, 100).map((path, idx) => (
              <div key={`${path}-${idx}`} className="truncate" title={path}>{path}</div>
            ))}
          </div>
          {failedPaths.length > 100 && (
            <div className="mt-2 text-[10px] opacity-60">Showing first 100 paths.</div>
          )}
        </div>
      )}

      {/* File List Preview */}
      <AnimatePresence>
        {!isScanning && files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 mt-8"
          >
            <div className="font-mono text-xs opacity-50 uppercase tracking-widest px-2">
              Previewing {Math.min(displayLimit, files.length)} of {files.length} Files
            </div>
            
            {files.slice(0, displayLimit).map((file, index) => (
              <div
                key={file.path + index}
                className="group bg-white/40 border border-[#141414]/10 p-3 rounded-lg flex items-center justify-between hover:bg-white/40 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-6 h-6 rounded bg-[#141414]/5 text-[#141414]/50 flex items-center justify-center font-mono text-[9px] shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] opacity-70 truncate" title={file.path}>
                      {file.path}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 pl-4">
                  <div className="bg-[#141414]/5 px-2 py-1 rounded font-mono text-[9px] uppercase opacity-60">
                    {file.category}
                  </div>
                  <div className="font-serif italic text-lg text-[#141414] min-w-[80px] text-right">
                    {formatBytes(file.size)}
                  </div>
                </div>
              </div>
            ))}

            {displayLimit < files.length && (
              <button 
                onClick={() => setDisplayLimit(prev => prev + 100)}
                className="w-full py-4 mt-4 border border-dashed border-[#141414]/10 rounded-lg text-[#141414]/50 hover:bg-[#141414]/5 hover:text-[#141414] transition-all font-mono text-xs uppercase tracking-widest"
              >
                Load 100 More
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
