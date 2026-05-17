import React, { useState, useEffect } from 'react';
import { Target, Search, FileWarning, Trash2, PieChart } from 'lucide-react';
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
  const [files, setFiles] = useState<any[]>([]);
  const [maxSize, setMaxSize] = useState(0);
  const [progress, setProgress] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    setIsScanning(true);
    setFiles([]);
    try {
      const res = await fetch('http://localhost:8080/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.largestFiles);
        setSelectedCategory(null); // Reset filter on new scan
        if (data.largestFiles.length > 0) {
          setMaxSize(data.largestFiles[0].size);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
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
      <header className="flex justify-between items-end pb-6 border-bottom border-[#141414]/20">
        <div>
          <h2 className="font-serif italic text-4xl">Storage Radar</h2>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest mt-2">
            Top 50 Largest Files Analysis
          </p>
        </div>
        <div className="text-right">
          <div className="font-serif italic text-3xl text-orange-700 flex items-center gap-2 justify-end">
            <Target className={isScanning ? "animate-spin" : ""} /> {files.length} HOGS
          </div>
        </div>
      </header>

      {/* Control Panel */}
      <div className="bg-[#141414] p-6 rounded-lg text-[#E4E3E0] flex gap-4 items-end shadow-xl">
        <div className="flex-1 space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">
            Target Directory
          </label>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="w-full bg-[#E4E3E0] text-[#141414] font-mono text-sm px-4 py-3 rounded outline-none border-2 border-transparent focus:border-orange-500 transition-colors"
            placeholder="e.g., C:\Users\Downloads"
            disabled={isScanning}
          />
        </div>
        <button
          onClick={startScan}
          disabled={isScanning}
          className="bg-orange-600 hover:bg-orange-500 text-white font-mono text-xs uppercase tracking-widest px-8 py-3 rounded transition-colors disabled:opacity-50 flex items-center gap-2 h-[46px]"
        >
          {isScanning ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 1 }}>
                <Search size={16} />
              </motion.div>
              SCANNING...
            </>
          ) : (
            <>
              <Target size={16} /> ENGAGE RADAR
            </>
          )}
        </button>
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
                className="h-full bg-orange-500" 
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
                  className={`border rounded-lg p-4 flex flex-col items-center justify-center text-center transition-all ${isSelected ? 'bg-orange-600/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-white/50 border-[#141414]/20 hover:border-orange-500/50'}`}
                >
                  <div className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest mb-2 ${isSelected ? 'text-orange-600 font-bold' : 'opacity-60'}`}>
                    <PieChart size={12} /> {cat}
                  </div>
                  <div className="font-serif italic text-2xl text-orange-700">{formatBytes(data.size)}</div>
                  <div className="font-mono text-[10px] opacity-40 mt-1">{data.count} Files</div>
                </button>
              );
            })}
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
                className="group relative bg-white/50 border border-[#141414]/20 p-4 rounded-lg overflow-hidden flex items-center justify-between"
              >
                {/* Background Bar */}
                <motion.div 
                  className="absolute left-0 top-0 bottom-0 bg-orange-600/10 -z-10"
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{ type: "spring", stiffness: 50, delay: index * 0.05 }}
                />
                
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                  <div className="w-8 h-8 rounded bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-mono text-[10px] shrink-0">
                    #{index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate" title={file.path}>
                      {file.path.split('\\').pop() || file.path.split('/').pop()}
                    </div>
                    <div className="font-mono text-[10px] opacity-50 truncate mt-1">
                      {file.path}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="font-serif italic text-xl text-orange-700">
                      {formatBytes(file.size)}
                    </div>
                    <div className="font-mono text-[10px] opacity-50 uppercase tracking-widest">
                      {widthPercent.toFixed(1)}% Relative Size
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleDelete(file.path)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-600 hover:text-white rounded transition-all"
                    title="Move to Recycle Bin"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {!isScanning && files.length === 0 && (
          <div className="py-24 text-center font-mono text-sm opacity-50 border-2 border-dashed border-[#141414]/20 rounded-lg">
            <FileWarning className="mx-auto mb-4 opacity-50" size={32} />
            NO DATA. RUN RADAR TO DETECT STORAGE HOGS.
          </div>
        )}
      </div>

    </div>
  );
}
