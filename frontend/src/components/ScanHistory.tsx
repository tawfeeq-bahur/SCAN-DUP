import React, { useState, useEffect } from 'react';
import { Database, Calendar, FolderSearch, Trash2, DatabaseZap, Download } from 'lucide-react';
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
    doc.text("OmniClean Pro", 14, 22);
    
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
    doc.save('OmniClean-Optimization-Report.pdf');
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-end pb-6 border-bottom border-[#141414]/20">
        <div>
          <h2 className="font-serif italic text-4xl">System Persistence Layer</h2>
          <p className="font-mono text-xs opacity-60 uppercase tracking-widest mt-2">
            Historical Data & Lifetime Analytics
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-3">
          <div>
            <div className="font-serif italic text-3xl text-green-700">{formatBytes(totalSaved)}</div>
            <div className="font-mono text-xs opacity-60 uppercase tracking-widest">Lifetime Space Recovered</div>
          </div>
          <button 
            onClick={generatePDF}
            className="flex items-center gap-2 bg-[#141414] text-white px-4 py-2 rounded text-[10px] font-mono uppercase tracking-widest hover:bg-[#141414]/80 transition-colors"
          >
            <Download size={14} />
            Export PDF Report
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-center py-12 font-mono text-sm opacity-60 animate-pulse">
          FETCHING SQLITE RECORDS...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Scan History */}
          <section className="bg-white/50 border border-[#141414] rounded-lg overflow-hidden flex flex-col">
            <div className="p-4 bg-[#141414] text-[#E4E3E0] flex items-center gap-2">
              <FolderSearch size={18} />
              <h3 className="font-mono text-xs uppercase tracking-widest">Scan Diagnostics History</h3>
            </div>
            <div className="divide-y divide-[#141414]/10 max-h-[500px] overflow-auto">
              {scans.length === 0 && <div className="p-8 text-center font-mono text-xs opacity-50">No scan history recorded yet.</div>}
              {scans.map((scan) => (
                <div key={scan.id} className="p-4 hover:bg-[#141414]/5 transition-colors">
                  <div className="flex justify-between mb-2">
                    <span className="font-mono text-[10px] bg-[#141414]/10 px-2 py-1 rounded">{new Date(scan.date + 'Z').toLocaleString()}</span>
                    <span className="font-mono text-[10px] font-bold">Wasted: {formatBytes(scan.wastedBytes)}</span>
                  </div>
                  <div className="font-medium text-sm truncate mb-1">Target: {scan.path}</div>
                  <div className="flex gap-4 text-[10px] font-mono opacity-60 uppercase">
                    <span>Analyzed: {scan.filesAnalyzed.toLocaleString()}</span>
                    <span>Duplicates: {scan.duplicateGroups.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cleanup History */}
          <section className="bg-white/50 border border-[#141414] rounded-lg overflow-hidden flex flex-col">
            <div className="p-4 bg-red-900 text-[#E4E3E0] flex items-center gap-2">
              <Trash2 size={18} />
              <h3 className="font-mono text-xs uppercase tracking-widest">Cleanup Operations</h3>
            </div>
            <div className="divide-y divide-[#141414]/10 max-h-[500px] overflow-auto">
              {cleanups.length === 0 && <div className="p-8 text-center font-mono text-xs opacity-50">No cleanups recorded yet.</div>}
              {cleanups.map((cleanup) => (
                <div key={cleanup.id} className="p-4 hover:bg-red-900/5 transition-colors">
                  <div className="flex justify-between mb-2">
                    <span className="font-mono text-[10px] bg-red-900/10 text-red-900 px-2 py-1 rounded">{new Date(cleanup.date + 'Z').toLocaleString()}</span>
                    <span className="font-mono text-[10px] font-bold text-green-700">Recovered: {formatBytes(cleanup.bytesRecovered)}</span>
                  </div>
                  <div className="font-medium text-sm mb-1 text-red-900">
                    Deleted {cleanup.filesDeleted} files permanently.
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
