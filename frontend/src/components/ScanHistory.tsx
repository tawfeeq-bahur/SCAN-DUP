import React, { useState, useEffect } from 'react';
import { Database, Calendar, FolderSearch, Trash2, DatabaseZap, Download, Activity } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'motion/react';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function ScanHistory({ isActive = true }: { isActive?: boolean }) {
  const [scans, setScans] = useState<any[]>([]);
  const [cleanups, setCleanups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const [scanRes, cleanupRes] = await Promise.all([
          fetch('http://localhost:8080/api/history/scans'),
          fetch('http://localhost:8080/api/history/cleanups')
        ]);
        if (scanRes.ok) setScans(await scanRes.json());
        if (cleanupRes.ok) setCleanups(await cleanupRes.json());
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [isActive]);

  const totalSaved = cleanups.reduce((acc, c) => acc + c.bytesRecovered, 0);
  const totalDeleted = cleanups.reduce((acc, c) => acc + c.filesDeleted, 0);

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.setFont("helvetica", "italic");
    doc.text("AortaCore Engine", 14, 22);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("System Optimization & Storage Analytics Report", 14, 30);
    
    // Summary Metrics
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Total Lifetime Space Recovered: ${formatBytes(totalSaved)}`, 14, 45);
    doc.text(`Total Lifetime Files Deleted: ${totalDeleted}`, 14, 52);
    
    // Recent Scans Table
    doc.setFontSize(12);
    doc.text("Recent Diagnostic Scans", 14, 65);
    autoTable(doc, {
      startY: 70,
      head: [['Date', 'Target Path', 'Files Analyzed', 'Duplicates Found', 'Wasted Space']],
      body: scans.slice(0, 20).map(s => [
        new Date(s.date + 'Z').toLocaleString(),
        s.path,
        s.filesAnalyzed.toLocaleString(),
        s.duplicateGroups.toLocaleString(),
        formatBytes(s.wastedBytes)
      ]),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 20, 20] }
    });
    
    // Recent Cleanups Table
    const finalY = (doc as any).lastAutoTable.finalY || 70;
    doc.text("Recent Cleanup Operations", 14, finalY + 15);
    autoTable(doc, {
      startY: finalY + 20,
      head: [['Date', 'Files Permanently Deleted', 'Space Recovered']],
      body: cleanups.slice(0, 20).map(c => [
        new Date(c.date + 'Z').toLocaleString(),
        c.filesDeleted.toLocaleString(),
        formatBytes(c.bytesRecovered)
      ]),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [153, 27, 27] } // Red-900ish
    });
    
    // Save
    doc.save('AortaCore-Optimization-Report.pdf');
  };

  const [activeFilter, setActiveFilter] = useState('All');

  const timeline = [
    ...scans.map(s => ({ id: `s-${s.id}`, type: 'scan', date: new Date(s.date + 'Z'), data: s })),
    ...cleanups.map(c => ({ id: `c-${c.id}`, type: 'cleanup', date: new Date(c.date + 'Z'), data: c }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const filteredTimeline = timeline.filter(item => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Scans') return item.type === 'scan';
    if (activeFilter === 'Cleanups') return item.type === 'cleanup';
    return false;
  });

  return (
    <div className="space-y-8 pb-12 min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end pb-6 border-b border-[#141414]/10 gap-6">
        <div>
          <h2 className="font-serif italic text-4xl">Optimization History</h2>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest mt-2">
            Historical Data & Lifetime Analytics
          </p>
        </div>
        
        {/* Minimal Pill Filter Bar */}
        <div className="flex items-center gap-1 bg-white/40 border border-[#141414]/10 p-1 rounded-full backdrop-blur-sm">
           {['All', 'Scans', 'Cleanups', 'Exports', 'Scheduled'].map(filter => (
             <button 
               key={filter}
               onClick={() => setActiveFilter(filter)}
               className={`px-4 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeFilter === filter ? 'bg-[#141414] text-[#E4E3E0] shadow-md' : 'bg-transparent text-[#141414] hover:bg-[#141414]/5'}`}
             >
               {filter}
             </button>
           ))}
        </div>
      </header>

      {loading ? (
        <div className="text-center py-24 font-mono text-sm opacity-60 animate-pulse">
          FETCHING AUDIT INTELLIGENCE...
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-12">
          
           {/* LEFT SIDE: TIMELINE FEED */}
           <div className="flex-1 relative">
             {/* Timeline Vertical Line */}
             <div className="absolute left-[7px] top-6 bottom-4 w-[2px] bg-gradient-to-b from-[#D6B98C] to-transparent opacity-30" />
             
             <div className="space-y-8 pl-8">
               {filteredTimeline.length === 0 && <div className="p-8 font-mono text-xs opacity-50">No activity matches this filter.</div>}
               {filteredTimeline.map((item, i) => (
                 <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={item.id} className="relative group">
                   
                   {/* Node */}
                   <div className="absolute -left-[37px] top-5 w-4 h-4 rounded-full bg-[#E4E3E0] border-2 border-[#D6B98C] shadow-[0_0_10px_rgba(214,185,140,0.5)] z-10 transition-transform group-hover:scale-125" />
                   
                   {/* Card */}
                   <div className="bg-white/40 border border-[#141414]/10 rounded-xl p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] hover:border-[#D6B98C]/50 hover:shadow-[0_4px_20px_rgba(214,185,140,0.1)] transition-all">
                     <div className="flex justify-between items-start mb-4">
                       <span className="font-mono text-[10px] opacity-60 bg-[#141414]/5 px-3 py-1 rounded-full">
                         {item.date.toLocaleString()}
                       </span>
                       <span className={`font-mono text-[9px] uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1 ${item.type === 'scan' ? 'bg-[#141414]/5 text-[#141414]' : 'bg-green-500/10 text-green-700'}`}>
                         <span className="w-1.5 h-1.5 rounded-full bg-current" /> {item.type === 'scan' ? 'COMPLETED' : 'OPTIMIZED'}
                       </span>
                     </div>

                     {item.type === 'scan' ? (
                       <>
                         <div className="font-serif text-xl mb-4 truncate text-[#141414]">Target: {item.data.path}</div>
                         <div className="grid grid-cols-3 gap-4 font-mono text-[10px] uppercase opacity-70">
                           <div className="bg-[#141414]/5 p-3 rounded-lg">
                             <div className="opacity-50 mb-1">Analyzed</div>
                             <div className="font-bold text-sm text-[#141414]">{item.data.filesAnalyzed.toLocaleString()} files</div>
                           </div>
                           <div className="bg-[#141414]/5 p-3 rounded-lg">
                             <div className="opacity-50 mb-1">Duplicates</div>
                             <div className="font-bold text-sm text-[#141414]">{item.data.duplicateGroups.toLocaleString()} groups</div>
                           </div>
                           <div className="bg-[#D6B98C]/10 p-3 rounded-lg border border-[#D6B98C]/30">
                             <div className="opacity-60 text-[#D6B98C] mb-1">Storage Wasted</div>
                             <div className="font-bold text-sm text-[#D6B98C]">{formatBytes(item.data.wastedBytes)}</div>
                           </div>
                         </div>
                       </>
                     ) : (
                       <>
                         <div className="font-serif text-xl mb-4 text-[#141414]">Deleted {item.data.filesDeleted} files permanently.</div>
                         <div className="font-mono text-[10px] uppercase opacity-70 bg-green-500/5 border border-green-500/20 p-3 rounded-lg inline-block">
                           <div className="opacity-60 text-green-700 mb-1">Storage Recovered</div>
                           <div className="font-bold text-sm text-green-600">{formatBytes(item.data.bytesRecovered)}</div>
                         </div>
                       </>
                     )}
                   </div>
                 </motion.div>
               ))}
             </div>
           </div>

           {/* RIGHT SIDE: ANALYTICS DASHBOARD */}
           <div className="w-full lg:w-96 shrink-0 space-y-6">
             
             {/* Total Storage Impact */}
             <div className="bg-white/40 border border-[#141414]/10 rounded-2xl p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#D6B98C]/10 rounded-full blur-3xl" />
               <div className="font-serif italic text-7xl text-[#141414] mb-2 relative z-10 flex items-baseline gap-2">
                 {formatBytes(totalSaved).replace(/ [A-Z]+/, '')} 
                 <span className="text-2xl opacity-60 font-sans not-italic">{formatBytes(totalSaved).replace(/[\d.]+ /, '')}</span>
               </div>
               <div className="font-mono text-xs uppercase tracking-widest opacity-60 mb-6 relative z-10">Total Storage Recovered</div>
               
               {/* Export Actions */}
               <div className="flex gap-3 relative z-10">
                 <button onClick={generatePDF} className="flex-1 py-3 bg-[#141414] text-[#E4E3E0] rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-[#141414]/90 hover:shadow-lg transition-all flex items-center justify-center gap-2">
                   <Download size={14} /> Export PDF
                 </button>
                 <button className="flex-1 py-3 bg-white border border-[#141414]/10 text-[#141414] rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-[#141414]/5 transition-all flex items-center justify-center gap-2">
                   Export CSV
                 </button>
               </div>
             </div>

             {/* Cleanup Statistics */}
             <div className="bg-white/40 border border-[#141414]/10 rounded-2xl p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
               <div className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-6 flex items-center gap-2">
                 <DatabaseZap size={14} /> Cleanup Statistics
               </div>
               <div className="space-y-4">
                 <div className="flex justify-between items-center border-b border-[#141414]/10 pb-3">
                   <span className="font-mono text-xs opacity-70">Files Removed</span>
                   <span className="font-serif italic text-xl">{totalDeleted.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-[#141414]/10 pb-3">
                   <span className="font-mono text-xs opacity-70">Largest Cleanup</span>
                   <span className="font-serif italic text-xl">{cleanups.length > 0 ? formatBytes(Math.max(...cleanups.map(c => c.bytesRecovered))) : '0 B'}</span>
                 </div>
                 <div className="flex justify-between items-center pb-1">
                   <span className="font-mono text-xs opacity-70">Most Common Type</span>
                   <span className="font-serif italic text-xl opacity-80 text-[#D6B98C]">OS Cache</span>
                 </div>
               </div>
             </div>

             {/* Micro Graph (Velocity) */}
             <div className="bg-white/40 border border-[#141414]/10 rounded-2xl p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
               <div className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-6 flex items-center justify-between">
                 Recovery Velocity <Activity size={14} />
               </div>
               <div className="h-24 w-full flex items-end gap-1.5 border-b border-[#141414]/10 pb-2">
                  {[10, 25, 40, 20, 60, 45, 80, 50, 90, 100].map((h, i) => (
                    <motion.div key={i} className="flex-1 bg-[#D6B98C] rounded-t-sm opacity-80" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 1, delay: i * 0.05 }} />
                  ))}
               </div>
               <div className="flex justify-between font-mono text-[8px] opacity-40 mt-2 uppercase tracking-widest">
                 <span>Last 10 Scans</span>
                 <span>Now</span>
               </div>
             </div>
             
             {/* Operations Monolith Cards */}
             <div className="space-y-3 pt-2">
               <div className="font-mono text-[10px] uppercase tracking-widest opacity-60 pl-2">Recent AI Suggestions</div>
               <div className="p-4 bg-white/40 border border-[#141414]/10 rounded-xl flex flex-col justify-center text-xs font-mono shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] group hover:border-[#D6B98C]/50 transition-colors cursor-pointer">
                 <div className="flex justify-between items-center mb-1">
                   <span className="font-bold text-[#141414]">Empty Recycle Bin</span>
                   <span className="opacity-40 uppercase text-[9px] border border-[#141414]/20 px-2 py-0.5 rounded">Action</span>
                 </div>
                 <span className="opacity-50">4.2 GB of potential reclaimable space.</span>
               </div>
               <div className="p-4 bg-white/40 border border-[#141414]/10 rounded-xl flex flex-col justify-center text-xs font-mono shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] group hover:border-[#D6B98C]/50 transition-colors cursor-pointer">
                 <div className="flex justify-between items-center mb-1">
                   <span className="font-bold text-[#141414]">Schedule Smart Sort</span>
                   <span className="opacity-40 uppercase text-[9px] border border-[#141414]/20 px-2 py-0.5 rounded">Automated</span>
                 </div>
                 <span className="opacity-50">Downloads folder entropy is very high.</span>
               </div>
             </div>

           </div>
        </div>
      )}
    </div>
  );
}
