import React, { useState } from 'react';
import { 
  Activity, ShieldCheck, Database, Trash2, 
  Search, HardDrive, PieChart, ListFilter, ChevronRight,
  Image as ImageIcon, Film, FileText, Code2, File,
  Hash, MapPin, X, Fingerprint, Layers
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

export default function Dashboard() {
  const [isScanning, setIsScanning] = useState(false);
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
    }
  };

  return (
    <div className="space-y-8 pb-12 relative min-h-screen">
      
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
              <button 
                onClick={handleStartScan}
                disabled={isScanning}
                className="bg-[#141414] text-[#E4E3E0] px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-[#141414]/90 hover:scale-[1.02] active:scale-[0.98] transition-all font-mono text-xs uppercase tracking-widest shadow-md"
              >
                {isScanning ? <><Activity size={14} className="animate-spin" /> SCANNING</> : <><Search size={14} /> ANALYZE PATH</>}
              </button>
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
                  <div className="flex items-center gap-3"><Activity size={16} className="animate-pulse"/> {isScanning ? 'TELEMETRY SCAN ACTIVE...' : 'PURGING FILES...'}</div>
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
             {parseFloat(scanStats.totalSize as any) > 0 && (
               <motion.div className="h-4 w-4 bg-[#141414]" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} />
             )}
          </div>
        </div>
        <StatCard icon={<ShieldCheck size={16} />} label="SYSTEM HEALTH" value="OPTIMIZED" />
      </div>

      {/* 6. FILTER CHIPS & 5. ANALYTICS TOGGLE */}
      {duplicates.length > 0 && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[#141414]/10 pb-6 gap-4">
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
      <div className="flex gap-8 relative items-start">
        
        {/* LEFT/MAIN LIST: 3. CLUSTER CARDS */}
        <div className={`flex-1 transition-all duration-500 ${selectedFilePreview ? 'md:pr-[360px]' : ''}`}>
          {duplicates.length > 0 && activeTab === 'list' && (
            <div className="space-y-6">
              {paginatedDuplicates.map((group, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                  key={group.hash} 
                  className="bg-white/40 backdrop-blur-sm border border-[#141414]/10 rounded-2xl overflow-hidden hover:border-[#141414]/10 hover:shadow-xl transition-all duration-300 group/card"
                >
                  {/* Original File Header */}
                  <div className="bg-gradient-to-r from-[#141414]/5 to-transparent p-5 flex items-center justify-between border-b border-[#141414]/10">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="bg-[#141414] text-[#E4E3E0] text-[9px] font-mono px-2 py-1 rounded shadow-sm tracking-widest">ORIGINAL</div>
                      <div className="text-[#141414]/50 bg-white/40 p-2 rounded-lg shadow-sm">{getCategoryIcon(group.category, 16)}</div>
                      <div className="min-w-0">
                         {/* 10. TYPOGRAPHY: Bolder filenames */}
                         <div className="font-bold text-sm truncate text-[#141414]">{group.files[0].name}</div>
                         <div className="font-mono text-[10px] opacity-40 truncate mt-0.5">{group.files[0].path}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0 pl-4">
                      {/* Space Saved */}
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-[9px] uppercase tracking-widest opacity-40 mb-1">Reclaimable</span>
                        <span className="text-green-700 font-bold bg-green-500/10 px-3 py-1 rounded-full text-xs font-mono shadow-sm border border-green-500/20">
                          {formatBytes(group.size * (group.files.length - 1))}
                        </span>
                      </div>
                      {/* 11. SHORT HASH */}
                      <div className="group/hash relative cursor-help hidden sm:block">
                        <div className="font-mono text-[10px] opacity-30 hover:opacity-100 transition-opacity bg-[#141414]/5 px-2 py-1 rounded flex items-center gap-1">
                          <Hash size={10} /> {group.hash.substring(0,6)}...
                        </div>
                        <div className="absolute right-0 top-full mt-2 hidden group-hover/hash:block bg-[#141414] text-white p-3 rounded-lg shadow-xl z-50 text-xs whitespace-nowrap font-mono">
                          {group.hash}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Duplicates List */}
                  <div className="divide-y divide-[#2A2A2A]">
                    {group.files.slice(1).map(file => (
                      <div 
                        key={file.path} 
                        className={`p-4 pl-6 flex items-center justify-between transition-colors cursor-pointer border-l-4 
                          ${selectedFilePreview?.file.path === file.path ? 'bg-[#141414]/5 border-[#D6B98C]' : 'border-transparent hover:bg-white/40/60 hover:border-[#141414]/10'}`}
                        onClick={() => setSelectedFilePreview({file, group})}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="relative flex items-center justify-center p-2" onClick={(e) => { e.stopPropagation(); toggleSelection(file.path); }}>
                             <input 
                               type="checkbox" 
                               checked={selectedFiles.has(file.path)} 
                               onChange={() => {}} // Handled by div wrapper
                               className="accent-[#141414] w-5 h-5 cursor-pointer relative z-10"
                             />
                             {selectedFiles.has(file.path) && <motion.div layoutId={`check-${file.path}`} className="absolute inset-0 bg-[#141414]/20 rounded-full blur-sm" />}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            {/* Bolder filename, lighter secondary text */}
                            <div className={`font-semibold text-[13px] truncate transition-colors ${selectedFiles.has(file.path) ? 'text-red-600' : 'text-[#141414]'}`}>{file.name}</div>
                            <div className="font-mono text-[10px] opacity-40 truncate mt-1 flex items-center gap-1">
                               <MapPin size={10} /> {file.path}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 pl-4">
                           <ChevronRight size={16} className={`transition-all ${selectedFilePreview?.file.path === file.path ? 'opacity-100 text-[#141414] translate-x-1' : 'opacity-20'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}

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
            <section className="bg-white/40 backdrop-blur-md border border-[#141414]/10 rounded-2xl p-8 shadow-xl">
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

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode, label: string, value: string | number, accent?: boolean }) {
  return (
    <div className="border border-[#141414]/10 p-6 rounded-xl bg-white/40 hover:bg-[#141414]/5 transition-all shadow-sm">
      <div className="flex items-center gap-2 opacity-50 mb-3">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-3xl font-serif italic ${accent ? 'text-green-700' : 'text-[#141414]'}`}>{value}</div>
    </div>
  );
}
