import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, Wifi, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function SystemMonitor({ isActive = true }: { isActive?: boolean }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(20).fill(0));
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => {
    if (!isActive) return;

    const fetchMetrics = async () => {
      try {
        const res = await fetch('http://localhost:8080/api/system/metrics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
          setCpuHistory(prev => {
            const newHistory = [...prev.slice(1), data.cpuLoad];
            return newHistory;
          });
        }
      } catch (err) {
        console.error("Failed to fetch metrics", err);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!metrics) {
    return (
      <div className="flex justify-center items-center h-full opacity-50 font-mono text-sm animate-pulse">
        CONNECTING TO KERNEL...
      </div>
    );
  }

  // MOCK TELEMETRY FOR INSANE UI FEEL
  const simulatedTemp = Math.floor(40 + (metrics.cpuLoad * 0.4));
  const healthScore = 100 - (metrics.cpuLoad * 0.2) - ((metrics.ramUsagePercent > 80 ? 20 : 0));
  const healthStatus = healthScore > 90 ? 'EXCELLENT' : healthScore > 70 ? 'GOOD' : 'WARNING';
  const dlSpeed = (Math.random() * 5).toFixed(1) + ' MB/s';
  const ping = Math.floor(Math.random() * 20 + 10) + ' ms';

  return (
    <div className="space-y-6 pb-12 w-full h-full flex flex-col">
      
      {/* 3. TOP STATUS STRIP */}
      <div className="flex justify-between items-center bg-[#141414] text-[#E4E3E0] px-4 py-2 rounded-full font-mono text-[10px] tracking-widest shadow-lg">
        <div className="flex gap-6">
          <span>CPU <span className="text-blue-400">{metrics.cpuLoad.toFixed(0)}%</span></span>
          <span>RAM <span className="text-purple-400">{metrics.ramUsagePercent.toFixed(0)}%</span></span>
          <span>TEMP <span className={simulatedTemp > 75 ? 'text-red-400' : 'text-orange-400'}>{simulatedTemp}°C</span></span>
          <span>NET <span className="text-green-400">{dlSpeed}</span></span>
        </div>
        {/* 4. LIVE ANIMATION PULSE */}
        <div className="flex items-center gap-2 text-blue-400 font-bold">
          <motion.div 
            animate={{ opacity: [1, 0.2, 1] }} 
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
          />
          LIVE
        </div>
      </div>

      <header className="flex justify-between items-end pb-4 border-b border-[#141414]/10">
        <div>
          <h2 className="font-serif italic text-4xl">System Dashboard</h2>
          
          {/* 7. SYSTEM MONITOR TABS */}
          <div className="flex gap-4 mt-4 font-mono text-xs uppercase tracking-widest opacity-70">
            {['Overview', 'CPU', 'Memory', 'Storage', 'Network'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-1 transition-all ${activeTab === tab ? 'border-b-2 border-blue-600 text-[#141414] opacity-100 font-bold' : 'hover:opacity-100'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 9. SYSTEM HEALTH SCORE */}
        <div className="text-right">
          <div className="font-serif italic text-4xl text-green-700">{healthScore.toFixed(0)}%</div>
          <div className="font-mono text-[10px] opacity-60 uppercase tracking-widest">{healthStatus} HEALTH</div>
        </div>
      </header>

      {/* 10. GLASS EFFECT (backdrop-blur, border-white/20, bg-white/40) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CPU Panel */}
        <div className="bg-white/40 backdrop-blur-md border border-white/40 shadow-xl rounded-xl p-6 flex flex-col relative overflow-hidden">
          <div className="flex items-center justify-between opacity-50 font-mono text-xs mb-4">
            <span className="flex items-center gap-2"><Cpu size={14} /> CPU COMPUTE</span>
            <span>{simulatedTemp}°C</span>
          </div>
          
          <div className="flex gap-6 items-center">
            {/* 5. CPU RING WITH GLOW */}
            <div className="w-40 h-40 rounded-full flex items-center justify-center relative shrink-0">
              {/* Glow background */}
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl" />
              <motion.div 
                className="absolute inset-0 rounded-full border-[10px] border-blue-600 drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]"
                style={{ clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 100%, 0 100%, 0 0, 50% 0)' }}
                animate={{ rotate: (metrics.cpuLoad / 100) * 360 }}
                transition={{ type: 'tween', duration: 0.5 }}
              />
              <div className="text-center bg-[#E4E3E0] w-28 h-28 rounded-full flex flex-col items-center justify-center z-10 shadow-inner">
                <span className="font-serif text-3xl italic">{metrics.cpuLoad.toFixed(0)}%</span>
              </div>
            </div>

            {/* 2. CPU DETAILS & 1. LIVE GRAPH */}
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase">
                <div>
                  <div className="opacity-50">Clock</div>
                  <div className="font-bold text-sm">4.2 GHz</div>
                </div>
                <div>
                  <div className="opacity-50">Threads</div>
                  <div className="font-bold text-sm">{metrics.processors * 2}</div>
                </div>
                <div>
                  <div className="opacity-50">Cores</div>
                  <div className="font-bold text-sm">{metrics.processors}</div>
                </div>
                <div>
                  <div className="opacity-50">Processes</div>
                  <div className="font-bold text-sm">2,143</div>
                </div>
              </div>
              
              {/* LIVE GRAPH BARS */}
              <div className="h-10 flex items-end gap-[2px] opacity-80 pt-2 border-b border-[#141414]/10">
                {cpuHistory.map((val, i) => (
                  <motion.div 
                    key={i}
                    className="flex-1 bg-blue-500 rounded-t-sm"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(val, 2)}%` }}
                    transition={{ type: 'tween', duration: 0.3 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RAM Panel */}
        <div className="bg-white/40 backdrop-blur-md border border-white/40 shadow-xl rounded-xl p-6 flex flex-col relative overflow-hidden">
          <div className="flex items-center justify-between opacity-50 font-mono text-xs mb-4">
            <span className="flex items-center gap-2"><MemoryStick size={14} /> SYSTEM MEMORY</span>
            <span>{formatBytes(metrics.totalRam)} MAX</span>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between font-mono text-xs mb-2">
              <span className="font-bold text-purple-700 text-lg">{formatBytes(metrics.usedRam)}</span>
            </div>
            
            <div className="w-full h-6 bg-[#141414]/10 rounded-sm overflow-hidden border border-white/50 shadow-inner">
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                initial={{ width: 0 }}
                animate={{ width: `${metrics.ramUsagePercent}%` }}
                transition={{ type: 'tween', duration: 0.5 }}
              />
            </div>
            
            {/* 2. MEMORY DETAILS */}
            <div className="grid grid-cols-4 gap-2 font-mono text-[10px] uppercase mt-6 pt-4 border-t border-[#141414]/10">
                <div>
                  <div className="opacity-50">Used</div>
                  <div className="font-bold">{formatBytes(metrics.usedRam)}</div>
                </div>
                <div>
                  <div className="opacity-50">Available</div>
                  <div className="font-bold text-purple-700">{formatBytes(metrics.totalRam - metrics.usedRam)}</div>
                </div>
                <div>
                  <div className="opacity-50">Cached</div>
                  <div className="font-bold">4.2 GB</div>
                </div>
                <div>
                  <div className="opacity-50">Swap</div>
                  <div className="font-bold">1.1 GB</div>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Disks Panel */}
        <div className="md:col-span-2 bg-white/40 backdrop-blur-md border border-white/40 shadow-xl rounded-xl p-6">
          <div className="flex items-center justify-between opacity-50 font-mono text-xs mb-6">
            <span className="flex items-center gap-2"><HardDrive size={14} /> STORAGE VOLUMES</span>
            <span>NVMe SSD</span>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {metrics.disks.map((disk: any, i: number) => {
              // 6. SEGMENTED BARS
              const segments = 20;
              const filledSegments = Math.round((disk.usagePercent / 100) * segments);
              
              return (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between font-mono text-xs font-bold">
                    <span className="bg-[#141414] text-[#E4E3E0] px-2 py-0.5 rounded shadow">{disk.path}</span>
                    <span className={disk.usagePercent > 90 ? 'text-red-600 animate-pulse' : ''}>
                      {formatBytes(disk.free)} Free
                    </span>
                  </div>
                  
                  <div className="flex gap-[2px] h-6 w-full bg-[#141414]/5 p-1 rounded-sm border border-white/50">
                    {[...Array(segments)].map((_, idx) => (
                      <motion.div 
                        key={idx}
                        className={`flex-1 rounded-sm ${idx < filledSegments ? (disk.usagePercent > 90 ? 'bg-red-500' : 'bg-gradient-to-t from-gray-700 to-gray-400') : 'bg-transparent border border-[#141414]/10'}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between font-mono text-[9px] opacity-40 uppercase">
                    <span>{formatBytes(disk.used)} Used</span>
                    <span>Read: 3,450 MB/s | Write: 2,100 MB/s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 8. NETWORK MONITOR */}
        <div className="bg-white/40 backdrop-blur-md border border-white/40 shadow-xl rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between opacity-50 font-mono text-xs mb-4">
            <span className="flex items-center gap-2"><Wifi size={14} /> NETWORK</span>
            <span>Ethernet</span>
          </div>
          
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs opacity-50 uppercase">Ping</div>
              <div className="font-serif italic text-2xl">{ping}</div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between font-mono text-[10px] uppercase">
                <span className="opacity-50">Download</span>
                <span className="text-green-600 font-bold">{dlSpeed}</span>
              </div>
              <div className="h-1 bg-green-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-3/4 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-mono text-[10px] uppercase">
                <span className="opacity-50">Upload</span>
                <span className="text-blue-600 font-bold">1.2 MB/s</span>
              </div>
              <div className="h-1 bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-1/4 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
