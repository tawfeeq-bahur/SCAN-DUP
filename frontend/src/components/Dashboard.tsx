import React, { useState } from 'react';
import { 
  Activity, ShieldCheck, Database, Trash2, 
  Search, HardDrive, PieChart, ListFilter, ChevronRight,
  Image as ImageIcon, Film, FileText, Code2, File,
  Hash, MapPin, X, Fingerprint, Layers, Folder
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DuplicateFile {
  name: string;
  path: string;
  category: string;
}

interface DuplicateGroup {
  hash: string;
  size: number;
  category: string;
  files: DuplicateFile[];
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getCategoryIcon = (category: string, size = 14) => {
  switch (category) {
    case 'Images': return <ImageIcon size={size} />;
    case 'Videos': return <Film size={size} />;
    case 'Documents': return <FileText size={size} />;
    case 'Code Files': 
    case 'Modules & Packages': return <Code2 size={size} />;
    default: return <File size={size} />;
  }
};

const getCategoryTone = (category: string) => {
  switch (category) {
    case 'Images': return 'text-[#8b7bd1]';
    case 'Videos': return 'text-[#c0726a]';
    case 'Documents': return 'text-[#7c8a9a]';
    case 'Code Files':
    case 'Modules & Packages': return 'text-[#c9a45c]';
    default: return 'text-[#8c8c8c]';
  }
};

export default function Dashboard() {
  const [isScanning, setIsScanning] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [scanPath, setScanPath] = useState('D:\\');
  const [scanStats, setScanStats] = useState({ files: 0, totalSize: 0, duplicates: 0 });
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const groupsPerPage = 100;
  
  const [activeTab, setActiveTab] = useState<'list'|'analytics'>('list');
  const [selectedFilePreview, setSelectedFilePreview] = useState<{file: DuplicateFile, group: DuplicateGroup} | null>(null);
  const [scanProgress, setScanProgress] = useState<{filesScanned: number, bytesScanned: number, currentFile: string, phase: string} | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scanTime, setScanTime] = useState<number | null>(null);
  const [deleteStats, setDeleteStats] = useState<{count: number, time: number} | null>(null);
  const scanRunRef = React.useRef(0);
  const cancelRequestedRef = React.useRef(false);

  const sortedDuplicates = React.useMemo(() => {
    if (selectedFiles.size === 0) return duplicates;
    return [...duplicates].sort((a, b) => {
      const aHasSelected = a.files.slice(1).some(f => selectedFiles.has(f.path));
      const bHasSelected = b.files.slice(1).some(f => selectedFiles.has(f.path));
      if (aHasSelected && !bHasSelected) return -1;
      if (!aHasSelected && bHasSelected) return 1;
      return 0;
    });
  }, [duplicates, selectedFiles]);

  const totalPages = Math.ceil(sortedDuplicates.length / groupsPerPage);
  const paginatedDuplicates = sortedDuplicates.slice((currentPage - 1) * groupsPerPage, currentPage * groupsPerPage);

  const selectedSize = duplicates.reduce((acc, group) => {
    let groupSelectedSize = 0;
    group.files.slice(1).forEach(f => {
      if (selectedFiles.has(f.path)) groupSelectedSize += group.size;
    });
    return acc + groupSelectedSize;
  }, 0);

  const handleSelectAll = () => {
    const allDups = new Set<string>();
    duplicates.forEach(group => {
      group.files.slice(1).forEach(f => allDups.add(f.path));
    });
    setSelectedFiles(allDups);
  };

  const handleSelectCategory = (category: string, isSelected: boolean) => {
    setSelectedFiles(prev => {
      const newSel = new Set(prev);
      duplicates.forEach(group => {
        group.files.slice(1).forEach(f => {
          if (categoryMap[f.path] === category) {
            if (isSelected) newSel.add(f.path);
            else newSel.delete(f.path);
          }
        });
      });
      return newSel;
    });
  };

  const isCategoryFullySelected = (category: string) => {
    let allSelected = true;
    let hasAny = false;
    for (const group of duplicates) {
      for (const f of group.files.slice(1)) {
        if (categoryMap[f.path] === category) {
          hasAny = true;
          if (!selectedFiles.has(f.path)) {
            allSelected = false;
            break;
          }
        }
      }
      if (!allSelected) break;
    }
    return hasAny && allSelected;
  };

  const toggleSelection = (path: string) => {
    setSelectedFiles(prev => {
      const newSel = new Set(prev);
      if (newSel.has(path)) newSel.delete(path);
      else newSel.add(path);
      return newSel;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedFiles.size === 0) return;
    setShowDeleteModal(true);
  };

  const confirmDelete = async (moveToTrash: boolean) => {
    setShowDeleteModal(false);
    setIsDeleting(true);
    setDeleteStats(null);
    const startDeleteTime = performance.now();
    
    try {
      const response = await fetch('http://localhost:8080/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: Array.from(selectedFiles), moveToTrash, bytesRecovered: selectedSize })
      });
      if (response.ok) {
        const data = await response.json();
        const deletedSet = new Set(data.deletedPaths || Array.from(selectedFiles));
        
        const updatedDuplicates = duplicates.map(group => ({
          ...group,
          files: group.files.filter(f => !deletedSet.has(f.path))
        })).filter(group => group.files.length > 1);
        
        setDuplicates(updatedDuplicates);
        let totalFiles = 0;
        let totalWastedSize = 0;
        updatedDuplicates.forEach(group => {
          totalWastedSize += group.size * (group.files.length - 1);
          totalFiles += (group.files.length - 1);
        });
        setScanStats({
          files: totalFiles,
          totalSize: (totalWastedSize / (1024 * 1024 * 1024)).toFixed(2) as any,
          duplicates: updatedDuplicates.length
        });
        
        const newTotalPages = Math.ceil(updatedDuplicates.length / groupsPerPage);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages);
        }
        
        setSelectedFiles(new Set());
        setSelectedFilePreview(null);
        setDeleteStats({ count: data.deletedCount || 0, time: performance.now() - startDeleteTime });
      } else {
        setErrorMsg('Failed to delete files');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to backend during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartScan = async () => {
    const runId = ++scanRunRef.current;
    cancelRequestedRef.current = false;
    setCancelRequested(false);
    setIsScanning(true);
    setErrorMsg('');
    setDuplicates([]);
    setSelectedFiles(new Set());
    setSelectedFilePreview(null);
    setCurrentPage(1);
    setScanTime(null);
    setDeleteStats(null);
    
    const progressInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8080/api/scan/progress');
        if (res.ok) setScanProgress(await res.json());
      } catch (e) {}
    }, 150);
    
    const startTime = performance.now();
    try {
      const response = await fetch('http://localhost:8080/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: scanPath })
      });
      
      const data = await response.json();

      if (runId !== scanRunRef.current || cancelRequestedRef.current) {
        return;
      }

      if (response.status === 409) {
        setErrorMsg(data.error || 'Scan canceled.');
        return;
      }
      
      if (!response.ok) {
        setErrorMsg(data.error || 'Scan failed');
        setIsScanning(false);
        return;
      }
      
      const newDuplicates: DuplicateGroup[] = [];
      const newCategoryMap: Record<string, string> = {};
      let totalFiles = 0;
      let totalWastedSize = 0;
      
      Object.keys(data.duplicates).forEach(hash => {
        const fileGroup = data.duplicates[hash];
        if (fileGroup.length > 1) {
           const size = fileGroup[0].size;
           totalWastedSize += size * (fileGroup.length - 1);
           totalFiles += (fileGroup.length - 1);
           
           newDuplicates.push({
             hash: hash,
             size: size,
             category: fileGroup[0].category || 'Others',
             files: fileGroup.map((f: any) => {
               newCategoryMap[f.path] = f.category || 'Others';
               return {
                 name: f.path.split('\\').pop() || f.path.split('/').pop(),
                 path: f.path,
                 category: f.category || 'Others'
               };
             }).sort((a: any, b: any) => {
               const depthA = (a.path.match(/[\\/]/g) || []).length;
               const depthB = (b.path.match(/[\\/]/g) || []).length;
               if (depthA !== depthB) return depthA - depthB;
               if (a.name.length !== b.name.length) return a.name.length - b.name.length;
               return a.path.localeCompare(b.path);
             })
           });
        }
      });
      
      setDuplicates(newDuplicates);
      setCategoryMap(newCategoryMap);
      setScanTime(data.timeMs || (performance.now() - startTime));
      setScanStats({
        files: totalFiles,
        totalSize: (totalWastedSize / (1024 * 1024 * 1024)).toFixed(2) as any,
        duplicates: newDuplicates.length
      });
      
    } catch (err) {
      setErrorMsg('Failed to connect to backend. Is the Java server running?');
    } finally {
      clearInterval(progressInterval);
      setScanProgress(null);
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

  const selectFolder = async () => {
    try {
      const electron = (window as any).require ? (window as any).require('electron') : null;
      const ipc = electron?.ipcRenderer;
      if (!ipc || !ipc.invoke) {
        setErrorMsg('Folder picker not available in this environment.');
        return;
      }
      const selected = await ipc.invoke('select-folder');
      if (selected) setScanPath(selected);
    } catch (err) {
      setErrorMsg('Failed to select folder.');
    }
  };

  const reclaimableValue = Number(scanStats.totalSize) || 0;

  return (
    <div className="space-y-8 pb-12 relative min-h-screen overflow-x-hidden">
      
      {/* 1. TOP ACTION BAR HIERARCHY */}
      <header className="flex flex-col gap-6 pb-6 border-b border-[#141414]/10 relative z-20">
        <div className="flex justify-between items-start">
          <div className="flex-1 max-w-2xl">
            <h2 className="font-serif italic text-4xl mb-4 text-[#141414]">System Intelligence</h2>
            <div className="flex bg-white/40 border border-[#141414]/10 p-2 rounded-xl backdrop-blur-md shadow-sm focus-within:border-[#D6B98C] focus-within:shadow-[0_0_15px_rgba(214,185,140,0.1)] transition-all">
              <input 
                type="text" 
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none font-mono text-sm uppercase px-4 text-[#141414] placeholder:opacity-40"
                placeholder="ENTER TARGET DIRECTORY..."
              />
              <button onClick={selectFolder} aria-label="Select Folder" title="Select folder" className="px-3 py-2 rounded-md hover:bg-[#141414]/5 transition-colors">
                <Folder size={16} />
              </button>
              <button 
                onClick={handleStartScan}
                disabled={isScanning}
                className="bg-[#141414] text-[#E4E3E0] px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-[#141414]/90 hover:scale-[1.02] active:scale-[0.98] transition-all font-mono text-xs uppercase tracking-widest shadow-md"
              >
                {isScanning ? <><Activity size={14} className="animate-spin" /> SCANNING</> : <><Search size={14} /> ANALYZE PATH</>}
              </button>
              {isScanning && (
                <button
                  onClick={requestStop}
                  disabled={cancelRequested}
                  className="ml-2 bg-red-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-red-700 active:scale-[0.98] transition-all font-mono text-xs uppercase tracking-widest shadow-md disabled:opacity-60"
                >
                  <X size={14} /> {cancelRequested ? 'STOPPING' : 'STOP'}
                </button>
              )}
            </div>
            {errorMsg && <p className="text-red-500 text-xs font-mono mt-2 ml-2">{errorMsg}</p>}
            <div className="flex gap-4 font-mono text-[10px] uppercase opacity-50 mt-2 ml-2">
              {scanTime !== null && <span>Fetch Time: {(scanTime / 1000).toFixed(2)}s</span>}
              {deleteStats !== null && <span className="text-red-600 font-bold">Deleted {deleteStats.count} files in {(deleteStats.time / 1000).toFixed(2)}s</span>}
            </div>
          </div>

          {/* 2. SECONDARY ACTIONS (Muted Red) */}
          {duplicates.length > 0 && (
            <div className="flex flex-col items-end gap-3 mt-4">
              <div className="font-mono text-[10px] uppercase tracking-widest opacity-60">Bulk Control</div>
              <div className="flex gap-2">
                <button onClick={handleSelectAll} className="px-4 py-3 bg-white/40 border border-[#141414]/10 hover:bg-[#141414]/5 rounded-lg font-mono text-xs transition-colors text-[#141414]">
                  SELECT ALL
                </button>
                <button 
                  onClick={handleDeleteSelected}
                  disabled={selectedFiles.size === 0 || isDeleting}
                  className={`px-6 py-3 rounded-lg font-mono text-xs transition-all flex items-center gap-2 ${selectedFiles.size > 0 ? 'bg-red-600 text-white hover:bg-[#9a3d3b] shadow-lg shadow-[#B86A6A]/20 hover:scale-[1.02] active:scale-[0.98]' : 'bg-[#141414]/5 text-[#141414]/40 cursor-not-allowed border border-[#141414]/10'}`}
                >
                  <Trash2 size={14} /> PURGE SELECTED ({selectedFiles.size})
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 9. LIVE SCAN STATUS */}
      <AnimatePresence>
        {(isScanning || isDeleting) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-[#141414]/5 border border-[#D6B98C]/20 p-6 rounded-xl relative overflow-hidden backdrop-blur-md">
               <div className="absolute top-0 left-0 w-1 h-full bg-[#141414]" />
               <div className="flex justify-between items-center text-xs font-mono uppercase tracking-widest text-[#141414] mb-3">
                  <div className="flex items-center gap-3"><Activity size={16} className="animate-pulse"/> {isScanning ? (cancelRequested ? 'CANCELING SCAN...' : 'TELEMETRY SCAN ACTIVE...') : 'PURGING FILES...'}</div>
                  {scanProgress && <span className="font-bold">{formatBytes(scanProgress.bytesScanned)} DATA PROCESSED</span>}
               </div>
               <div className="h-1.5 bg-[#141414]/10 rounded-full overflow-hidden mb-3">
                 <motion.div className="h-full bg-[#141414]" style={{ backgroundSize: '200% 100%' }} animate={{ backgroundPosition: ['100% 0', '-100% 0'] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear'}} />
               </div>
               {scanProgress && <div className="text-[10px] font-mono opacity-60 truncate">{scanProgress.currentFile || 'Awaiting file...'}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<HardDrive size={16} />} label="FILES ANALYZED" value={scanStats.files.toLocaleString()} />
        <StatCard icon={<Layers size={16} />} label="DUPLICATE CLUSTERS" value={scanStats.duplicates} />
        {/* 8. SPACE SAVED VISUALIZATION */}
        <div className="border border-[#141414]/10 p-4 rounded-xl bg-white/40 hover:bg-[#141414]/5 transition-all relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#141414]/30 group-hover:bg-[#141414]/80 transition-colors" />
          <div className="flex items-center gap-2 opacity-50 mb-2">
            <Database size={14} />
            <span className="text-[9px] font-mono uppercase tracking-widest">RECLAIMABLE STORAGE</span>
          </div>
          <div className="text-3xl font-serif italic text-[#141414] flex items-center gap-3">
             {scanStats.totalSize} GB
          </div>
          {reclaimableValue > 0 && (
            <div className="mt-3 h-1 bg-[#141414]/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#D6B98C]"
                animate={{ x: ['-40%', '100%'] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
                style={{ width: '40%' }}
              />
            </div>
          )}
        </div>
        <StatCard icon={<ShieldCheck size={16} />} label="SYSTEM HEALTH" value="OPTIMIZED" supportText="No integrity risks detected" />
      </div>

      {/* EMPTY STATE */}
      <AnimatePresence>
        {!isScanning && !isDeleting && duplicates.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="min-h-[60vh] flex items-center justify-center"
          >
            <div className="w-full max-w-3xl text-center">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-[#141414]/10 flex items-center justify-center shadow-[0_0_30px_rgba(20,20,20,0.08)]">
                <Fingerprint size={28} className="text-[#141414]" />
              </div>
              <h3 className="mt-6 font-serif italic text-3xl text-[#141414]">Intelligent Duplicate Detection Engine</h3>
              <p className="mt-3 text-sm text-[#141414]/70 max-w-xl mx-auto">
                Analyze your storage to identify redundant media, duplicate source code, repeated archives, and wasted disk clusters.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {['Code Files', 'Images', 'Videos', 'Archives', 'Documents'].map(label => (
                  <span
                    key={label}
                    className="px-3 py-1.5 rounded-full border border-[#141414]/10 bg-white/40 text-[10px] font-mono uppercase tracking-widest text-[#141414]/70 hover:border-[#D6B98C] hover:text-[#141414] transition-colors"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <motion.button
                onClick={handleStartScan}
                disabled={isScanning}
                className="mt-8 bg-[#141414] text-[#E4E3E0] px-10 py-4 rounded-xl font-mono text-xs uppercase tracking-widest shadow-md hover:bg-[#141414]/90 transition-all"
                animate={{ boxShadow: ['0 0 0 rgba(214,185,140,0)', '0 0 18px rgba(214,185,140,0.35)', '0 0 0 rgba(214,185,140,0)'] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                Initiate Deep Scan
              </motion.button>
              <div className="mt-8 flex flex-col items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#141414]/60">
                <span>Discovery</span>
                <span className="opacity-30">|</span>
                <span>Hashing</span>
                <span className="opacity-30">|</span>
                <span>Clustering</span>
                <span className="opacity-30">|</span>
                <span>Analysis</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. FILTER CHIPS & 5. ANALYTICS TOGGLE */}
      {duplicates.length > 0 && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[#141414]/10 pb-6 gap-4 mt-6">
          <div className="flex flex-wrap gap-2 items-center">
             <span className="font-mono text-[10px] uppercase opacity-50 tracking-widest mr-2">SMART FILTERS:</span>
             {Array.from(new Set(Object.values(categoryMap))).sort().map(cat => {
               const isSelected = isCategoryFullySelected(cat);
               return (
                 <button
                   key={cat}
                   onClick={() => handleSelectCategory(cat, !isSelected)}
                   className={`px-4 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all duration-300 border flex items-center gap-2
                    ${isSelected 
                      ? 'bg-[#141414]/10 border-[#D6B98C] text-[#141414] shadow-[0_0_15px_rgba(214,185,140,0.1)]' 
                      : 'bg-white/40 border-[#141414]/10 text-[#141414]/60 hover:border-[#141414]/10 hover:bg-[#141414]/5'}`}
                 >
                   {getCategoryIcon(cat, 12)}
                   {cat}
                 </button>
               )
             })}
          </div>
          
          <div className="bg-[#141414]/5 p-1 rounded-full flex font-mono text-xs relative shadow-inner">
            <motion.div 
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#141414] rounded-full shadow-md z-0"
              animate={{ x: activeTab === 'list' ? 0 : '100%', left: activeTab === 'list' ? 4 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            <button onClick={() => setActiveTab('list')} className={`relative z-10 px-6 py-2 flex items-center gap-2 transition-colors duration-300 rounded-full ${activeTab === 'list' ? 'text-[#E4E3E0]' : 'text-[#141414]/60 hover:text-[#141414]'}`}>
              <ListFilter size={14}/> CLUSTERS
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`relative z-10 px-6 py-2 flex items-center gap-2 transition-colors duration-300 rounded-full ${activeTab === 'analytics' ? 'text-[#E4E3E0]' : 'text-[#141414]/60 hover:text-[#141414]'}`}>
              <PieChart size={14}/> ANALYTICS
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex gap-8 relative items-start pr-4 md:pr-[380px]">

        {/* LEFT/MAIN LIST: 3. CLUSTER CARDS */}
        <div className={`flex-1 min-w-0 transition-all duration-500`}>
          {duplicates.length > 0 && activeTab === 'list' && (
            <div className="space-y-6 px-4 pb-2">
              <div className="h-3" />
              {paginatedDuplicates.map((group, idx) => {
                const clusterIndex = (currentPage - 1) * groupsPerPage + idx + 1;
                const totalClusterSize = group.size * group.files.length;
                const duplicateCount = group.files.length - 1;
                return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                  key={group.hash} 
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-visible hover:border-[#141414]/10 hover:shadow-xl transition-all duration-300 group/card border-l-[3px] border-l-[#f5e7c1]"
                >
                  {/* Cluster Header */}
                  <div className="px-5 pt-5 pb-4 border-b border-[#141414]/10">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10px] uppercase tracking-widest opacity-60">Cluster #{clusterIndex}</div>
                        <div className="font-mono text-[11px] opacity-50 mt-1">
                          {duplicateCount + 1} identical files • {formatBytes(totalClusterSize)} total
                        </div>
                      </div>
                      <div className="group/hash relative cursor-help hidden sm:flex shrink-0">
                        <div className="font-mono text-[10px] opacity-40 hover:opacity-100 transition-opacity bg-[#141414]/5 px-2 py-1 rounded flex items-center gap-1">
                          <Hash size={10} /> {group.hash.substring(0,6)}...
                        </div>
                        <div className="absolute right-0 top-full mt-2 hidden group-hover/hash:block bg-[#141414] text-white p-3 rounded-lg shadow-xl z-50 text-xs whitespace-nowrap font-mono">
                          {group.hash}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Original File Row */}
                  <div className="p-5 flex items-center justify-between border-b border-[#141414]/10 bg-white/10">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="bg-[#141414] text-[#E4E3E0] text-[9px] font-mono px-2 py-1 rounded shadow-sm tracking-widest shrink-0">ORIGINAL</div>
                      <div className={`p-2 rounded-lg shadow-sm bg-white/40 ${getCategoryTone(group.category)} shrink-0`}>
                        {getCategoryIcon(group.category, 16)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate text-[#141414]">{group.files[0].name}</div>
                        <div className="font-mono text-[10px] opacity-50 mt-1">
                          {formatBytes(group.size)} • {group.files[0].category}
                        </div>
                        <div className="font-mono text-[10px] opacity-40 mt-1 flex items-center gap-1 min-w-0">
                          <MapPin size={10} className="shrink-0" />
                          <span className="truncate">{group.files[0].path}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-4">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-[9px] uppercase tracking-widest opacity-40 mb-1">Reclaimable</span>
                        <span className="text-green-700 font-bold bg-green-500/10 px-3 py-1 rounded-full text-xs font-mono shadow-sm border border-green-500/20">
                          {formatBytes(group.size * duplicateCount)}
                        </span>
                      </div>
                      <div className="hidden sm:flex items-center gap-2">
                        {['Open', 'Reveal', 'Hash'].map(action => (
                          <button
                            key={action}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest border border-[#141414]/15 text-[#141414]/60 hover:text-[#141414] hover:border-[#D6B98C] hover:bg-[#141414]/5 transition-colors"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Duplicates List */}
                  <div className="divide-y divide-[#141414]/10">
                    {group.files.slice(1).map(file => (
                      <div 
                        key={file.path} 
                        className={`p-4 pl-5 flex items-center justify-between transition-colors cursor-pointer border-l-4 
                          ${selectedFilePreview?.file.path === file.path ? 'bg-[#141414]/5 border-[#D6B98C]' : 'border-transparent hover:bg-white/10 hover:border-[#141414]/10'}`}
                        onClick={() => setSelectedFilePreview({file, group})}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div
                            className="relative flex items-center justify-center min-w-[42px]"
                            onClick={(e) => { e.stopPropagation(); toggleSelection(file.path); }}
                          >
                            <input 
                              type="checkbox" 
                              checked={selectedFiles.has(file.path)} 
                              onChange={() => {}} // Handled by div wrapper
                              className="accent-[#141414] w-5 h-5 cursor-pointer relative z-10"
                            />
                            {selectedFiles.has(file.path) && <motion.div layoutId={`check-${file.path}`} className="absolute inset-0 bg-[#141414]/20 rounded-full blur-sm" />}
                          </div>
                          
                          <div className={`p-2 rounded-lg bg-white/40 ${getCategoryTone(file.category)}`}>
                            {getCategoryIcon(file.category, 14)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className={`font-semibold text-[13px] truncate transition-colors ${selectedFiles.has(file.path) ? 'text-red-600' : 'text-[#141414]'}`}>{file.name}</div>
                            <div className="font-mono text-[10px] opacity-50 mt-1">
                              {formatBytes(group.size)} • {file.category}
                            </div>
                            <div className="font-mono text-[10px] opacity-40 mt-1 flex items-center gap-1 min-w-0">
                              <MapPin size={10} className="shrink-0" />
                              <span className="truncate">{file.path}</span>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 pl-4 flex items-center gap-2">
                          {['Open', 'Reveal', 'Hash'].map(action => (
                            <button
                              key={action}
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest border border-[#141414]/15 text-[#141414]/60 hover:text-[#141414] hover:border-[#D6B98C] hover:bg-[#141414]/5 transition-colors"
                            >
                              {action}
                            </button>
                          ))}
                          <ChevronRight size={16} className={`transition-all ${selectedFilePreview?.file.path === file.path ? 'opacity-100 text-[#141414] translate-x-1' : 'opacity-20'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )})}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 py-8 font-mono text-xs opacity-70">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-6 py-2 border border-[#141414]/10 rounded-full hover:bg-[#141414]/10 disabled:opacity-30 transition-all uppercase tracking-widest">
                    Previous
                  </button>
                  <span className="bg-white/40 px-4 py-2 rounded-full border border-[#141414]/10 shadow-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="px-6 py-2 border border-[#141414]/10 rounded-full hover:bg-[#141414]/10 disabled:opacity-30 transition-all uppercase tracking-widest">
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {duplicates.length > 0 && activeTab === 'analytics' && (
            <section className="bg-white/40 backdrop-blur-md border border-[#141414]/10 rounded-2xl p-8 shadow-xl mr-0">
              <div className="flex items-center gap-3 mb-8 opacity-70">
                <PieChart size={24} />
                <h3 className="font-serif italic text-2xl">Storage Breakdown</h3>
              </div>
              
              <div className="space-y-8">
                {Object.entries(
                  duplicates.reduce((acc, group) => {
                    acc[group.category] = (acc[group.category] || 0) + (group.size * (group.files.length - 1));
                    return acc;
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]).map(([cat, size], idx) => {
                  const percentage = (size / duplicates.reduce((sum, g) => sum + g.size * (g.files.length - 1), 0)) * 100;
                  const isDangerous = cat === 'Code Files' || cat === 'Modules & Packages';
                  return (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} key={cat} className="space-y-3 group/stat">
                      <div className="flex justify-between font-mono text-xs uppercase tracking-widest">
                        <span className={`flex items-center gap-2 ${isDangerous ? 'text-red-600 font-bold' : 'opacity-80'}`}>
                          {getCategoryIcon(cat, 14)} {cat}
                        </span>
                        <span className="font-bold text-[#141414]">{formatBytes(size)} <span className="opacity-40 font-normal ml-2">({percentage.toFixed(1)}%)</span></span>
                      </div>
                      <div className="h-3 bg-white/40 w-full rounded-full overflow-hidden shadow-inner border border-[#141414]/10">
                        <motion.div 
                          className={`h-full relative overflow-hidden ${isDangerous ? 'bg-red-600' : 'bg-[#141414]'}`} 
                          initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                        >
                          <div className="absolute inset-0 bg-white/40/20 w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', transform: 'skewX(-20deg)', animation: 'shimmer 2s infinite' }} />
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* 7. PREVIEW PANEL (Right Side Drawer) */}
        <AnimatePresence>
          {selectedFilePreview && activeTab === 'list' && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="hidden md:flex w-[340px] fixed right-8 top-32 bottom-12 bg-white/40 text-[#141414] rounded-2xl shadow-2xl border border-[#D6B98C]/30 p-6 flex-col z-40 overflow-hidden"
            >
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-[#141414]/10">
                 <div className="flex items-center gap-3">
                   <div className="p-3 bg-[#141414]/10 text-[#141414] rounded-xl">
                      {getCategoryIcon(selectedFilePreview.file.category, 24)}
                   </div>
                   <div>
                     <div className="font-mono text-[10px] uppercase tracking-widest opacity-50 text-[#141414] mb-1">File Intelligence</div>
                     <h4 className="font-serif italic text-xl truncate max-w-[200px]" title={selectedFilePreview.file.name}>{selectedFilePreview.file.name}</h4>
                   </div>
                 </div>
                 <button onClick={() => setSelectedFilePreview(null)} className="p-2 hover:bg-white/40/10 rounded-full transition-colors opacity-50 hover:opacity-100">
                   <X size={16} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide">
                 {/* Visual Preview (if image) */}
                 {selectedFilePreview.file.category === 'Images' && (
                   <div className="bg-black/50 rounded-xl p-2 border border-[#141414]/10 flex items-center justify-center min-h-[150px] relative overflow-hidden group">
                     <img 
                       src={`file:///${selectedFilePreview.file.path.replace(/\\/g, '/')}`} 
                       alt="Preview" 
                       className="max-w-full max-h-[200px] object-contain rounded-lg group-hover:scale-110 transition-transform duration-500"
                     />
                   </div>
                 )}

                 {/* Metadata Grid */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/40/5 p-4 rounded-xl border border-[#141414]/10">
                     <div className="flex items-center gap-2 font-mono text-[9px] uppercase opacity-50 mb-2"><HardDrive size={10} /> Size</div>
                     <div className="font-bold text-lg">{formatBytes(selectedFilePreview.group.size)}</div>
                   </div>
                   <div className="bg-white/40/5 p-4 rounded-xl border border-[#141414]/10">
                     <div className="flex items-center gap-2 font-mono text-[9px] uppercase opacity-50 mb-2"><Layers size={10} /> Category</div>
                     <div className="font-bold text-sm truncate">{selectedFilePreview.file.category}</div>
                   </div>
                 </div>

                 <div className="bg-white/40/5 p-4 rounded-xl border border-[#141414]/10 space-y-4">
                   <div>
                     <div className="flex items-center gap-2 font-mono text-[9px] uppercase opacity-50 mb-1"><MapPin size={10} /> Location</div>
                     <div className="font-mono text-xs break-all opacity-80 leading-relaxed">{selectedFilePreview.file.path}</div>
                   </div>
                   <div>
                     <div className="flex items-center gap-2 font-mono text-[9px] uppercase opacity-50 mb-1"><Fingerprint size={10} /> SHA-256 Hash</div>
                     <div className="font-mono text-[10px] break-all text-[#7A7A7A] bg-[#E4E3E0] p-2 rounded border border-[#141414]/10">{selectedFilePreview.group.hash}</div>
                   </div>
                 </div>

                 <div className="pt-4 border-t border-[#141414]/10">
                   <button 
                     onClick={() => toggleSelection(selectedFilePreview.file.path)}
                     className={`w-full py-4 rounded-xl font-mono text-xs tracking-widest transition-all flex items-center justify-center gap-2 ${selectedFiles.has(selectedFilePreview.file.path) ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(185,74,72,0.4)]' : 'bg-white/40/10 hover:bg-white/40/20'}`}
                   >
                     {selectedFiles.has(selectedFilePreview.file.path) ? 'MARKED FOR DELETION' : 'MARK TO PURGE'}
                   </button>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Delete Confirmation Modal (Same functionality, styled up) */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#141414] text-[#E4E3E0] p-8 rounded-2xl max-w-lg w-full shadow-2xl border border-[#141414]/10 space-y-6">
            <div className="flex flex-col items-center text-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center text-red-600 shadow-[0_0_30px_rgba(185,74,72,0.3)]">
                 <Trash2 size={32} />
              </div>
              <h3 className="font-serif italic text-3xl">Purge Confirmation</h3>
              <p className="font-sans text-sm opacity-60 leading-relaxed max-w-sm">
                Initiating protocol to purge <strong>{selectedFiles.size}</strong> duplicate files. This operation will reclaim <strong className="text-green-500">{formatBytes(selectedSize)}</strong> of storage.
              </p>
            </div>

            <div className="bg-white/40/5 p-4 rounded-xl border border-[#141414]/10">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#141414]/10">
                <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-50">Target Intelligence</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                {Object.entries(
                  Array.from(selectedFiles).reduce((acc, path) => {
                    const cat = categoryMap[path] || 'Others';
                    acc[cat] = (acc[cat] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([cat, count]) => {
                  const isDangerous = cat === 'Code Files' || cat === 'Modules & Packages';
                  return (
                    <div key={cat} className={`flex justify-between items-center p-2 rounded ${isDangerous ? 'bg-red-500/10 text-red-400' : 'bg-white/40/5'}`}>
                      <span className="flex items-center gap-2">{getCategoryIcon(cat, 12)} {cat}</span>
                      <span className="font-bold opacity-50">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex flex-col gap-3 font-mono text-xs pt-4">
              <button onClick={() => confirmDelete(true)} className="w-full px-4 py-4 bg-white/40/10 text-[#E4E3E0] hover:bg-white/40/20 rounded-xl transition-all flex items-center justify-center gap-3">
                <ShieldCheck size={16} className="text-green-500" /> MOVE TO RECYCLE BIN (SAFE)
              </button>
              <button onClick={() => confirmDelete(false)} className="w-full px-4 py-4 border border-[#B86A6A]/30 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all flex items-center justify-center gap-3 group">
                <Trash2 size={16} /> PERMANENT OBLITERATION
              </button>
              <button onClick={() => setShowDeleteModal(false)} className="w-full px-4 py-4 opacity-50 hover:opacity-100 rounded-xl transition-all text-center mt-2 uppercase tracking-widest">
                ABORT SEQUENCE
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}

function StatCard({ icon, label, value, accent, supportText }: { icon: React.ReactNode, label: string, value: string | number, accent?: boolean, supportText?: string }) {
  return (
    <div className="border border-[#141414]/10 p-6 rounded-xl bg-white/40 hover:bg-[#141414]/5 transition-all shadow-sm">
      <div className="flex items-center gap-2 opacity-50 mb-3">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-3xl font-serif italic ${accent ? 'text-green-700' : 'text-[#141414]'}`}>{value}</div>
      {supportText && (
        <div className="mt-2 text-[10px] font-mono uppercase tracking-widest opacity-50">
          {supportText}
        </div>
      )}
    </div>
  );
}
