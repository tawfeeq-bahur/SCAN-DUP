import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Moon, Bell, Database, Clock, RefreshCw, Lock, Star, Info, Cpu, Filter, Trash2, Cloud, Folder } from 'lucide-react';

export default function SettingsView() {
  const [scheduleMode, setScheduleMode] = useState(localStorage.getItem('scheduleMode') || 'disabled');
  const [schedulePath, setSchedulePath] = useState(localStorage.getItem('schedulePath') || 'D:\\');
  const [isScheduling, setIsScheduling] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('appTheme') || 'light');

  const selectFolder = async () => {
    try {
      const electron = (window as any).require ? (window as any).require('electron') : null;
      const ipc = electron?.ipcRenderer;
      if (!ipc || !ipc.invoke) return;
      const selected = await ipc.invoke('select-folder');
      if (selected) setSchedulePath(selected);
    } catch (err) {
      alert('Failed to select folder.');
    }
  };

  useEffect(() => {
    localStorage.setItem('scheduleMode', scheduleMode);
    localStorage.setItem('schedulePath', schedulePath);
  }, [scheduleMode, schedulePath]);

  const handleThemeChange = (newTheme: string) => {
    // If the same theme is clicked again, default to light
    const finalTheme = theme === newTheme ? 'light' : newTheme;
    setTheme(finalTheme);
    localStorage.setItem('appTheme', finalTheme);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const handleApplySchedule = async () => {
    setIsScheduling(true);
    try {
      await fetch('http://localhost:8080/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: scheduleMode, path: schedulePath })
      });
      alert(`Scheduler activated in ${scheduleMode.toUpperCase()} mode for ${schedulePath}`);
    } catch (err) {
      alert('Failed to configure scheduler. Is the backend running?');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="space-y-12 pb-24">
      <header className="pb-6 border-bottom border-[#141414]/20">
        <h2 className="font-serif italic text-4xl">System Configuration</h2>
        <p className="text-xs font-mono opacity-50 mt-2 uppercase">Advanced Tuning & Core Parameters</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* SCHEDULING - FULLY FUNCTIONAL */}
          <section id="scheduling" className="space-y-6">
            <SectionHeader icon={<Clock size={20} />} title="Automated Scan Scheduler" desc="Configure automatic duplicate scanning routines." />
            <div className="bg-white/50 border border-[#141414]/20 rounded-lg p-6 space-y-6 shadow-sm">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Scan Frequency</label>
                <select 
                  value={scheduleMode} 
                  onChange={(e) => setScheduleMode(e.target.value)}
                  className="w-full bg-[#141414]/5 border border-[#141414]/20 rounded p-3 text-sm font-medium focus:outline-none focus:border-[#141414]"
                >
                  <option value="disabled">Disabled</option>
                  <option value="startup">Startup Scan (Run once now in background)</option>
                  <option value="daily">Daily Scan (Every 24 hours)</option>
                  <option value="weekly">Weekly Scan (Every 7 days)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Target Directory</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={schedulePath}
                    onChange={(e) => setSchedulePath(e.target.value)}
                    placeholder="e.g. D:\ or C:\Users"
                    className="flex-1 bg-[#141414]/5 border border-[#141414]/20 rounded p-3 text-sm font-mono focus:outline-none focus:border-[#141414]"
                  />
                  <button
                    onClick={selectFolder}
                    aria-label="Select Folder"
                    title="Select folder"
                    className="p-3 rounded border border-[#141414]/20 bg-[#141414]/5 hover:bg-[#141414]/10 transition-colors"
                  >
                    <Folder size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#141414]/10">
                <ToggleItem label="Background Execution" description="Run scheduled scans silently in the background." defaultOn />
                <ToggleItem label="Notification Alerts" description="Receive notifications when duplicates are detected." defaultOn />
                <ToggleItem label="Auto Generate Reports" description="Automatically export reports after scheduled scans." />
              </div>

              <button 
                onClick={handleApplySchedule}
                disabled={isScheduling}
                className="w-full bg-[#141414] text-[#E4E3E0] py-3 rounded font-mono text-xs hover:bg-[#141414]/80 transition-colors uppercase tracking-widest disabled:opacity-50"
              >
                {isScheduling ? 'Configuring Engine...' : 'Apply Schedule Configuration'}
              </button>
            </div>
          </section>

          {/* ADVANCED SETTINGS */}
          <section className="space-y-6">
            <SectionHeader icon={<Cpu size={20} />} title="Advanced Scan Engine" desc="Performance Optimization & Hashing Settings" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ToggleItem label="MD5 Fast Hashing" description="Recommended for general usage." defaultOn />
              <ToggleItem label="Multithreaded Scanning" description="Use parallel processing for faster scans." defaultOn />
              <ToggleItem label="Smart Memory Config" description="Reduce RAM usage during large-scale scans." defaultOn />
              <ToggleItem label="Skip System Folders" description="Avoid protected OS directories." defaultOn />
            </div>
          </section>

          {/* FILE FILTERING */}
          <section className="space-y-6">
            <SectionHeader icon={<Filter size={20} />} title="File Filtering" desc="Include or exclude specific data types." />
            <div className="bg-white/40 border border-[#141414]/10 rounded-lg p-6 space-y-4">
               <div className="space-y-1">
                 <label className="text-[9px] font-mono opacity-40 uppercase">Include Extensions</label>
                 <input type="text" defaultValue=".jpg, .png, .pdf, .mp4" className="w-full bg-[#141414]/5 border border-[#141414]/20 rounded p-2 text-xs font-mono" />
               </div>
               <div className="space-y-1">
                 <label className="text-[9px] font-mono opacity-40 uppercase">Exclude Extensions</label>
                 <input type="text" defaultValue=".tmp, .log, .bak" className="w-full bg-[#141414]/5 border border-[#141414]/20 rounded p-2 text-xs font-mono" />
               </div>
               <div className="space-y-1">
                 <label className="text-[9px] font-mono opacity-40 uppercase">Excluded Folders</label>
                 <textarea defaultValue="node_modules&#10;Windows&#10;AppData&#10;.git" className="w-full bg-[#141414]/5 border border-[#141414]/20 rounded p-2 text-xs font-mono h-24" />
               </div>
            </div>
          </section>

          {/* CLEANUP SAFETY */}
          <section className="space-y-6">
            <SectionHeader icon={<Trash2 size={20} />} title="Cleanup Safety" desc="Protection against accidental data loss." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ToggleItem label="Move to Recycle Bin" description="Prevent permanent deletion." defaultOn />
              <ToggleItem label="Enable Recovery Mode" description="Restore accidentally deleted duplicates." defaultOn />
              <ToggleItem label="Duplicate Verification" description="Verify file integrity before cleanup." defaultOn />
              <ToggleItem label="Protected Folder Lock" description="Prevent deletion inside important directories." defaultOn />
            </div>
          </section>

        </div>

        {/* Right Column (Sidebar Settings) */}
        <div className="space-y-8">
          
          <section className="space-y-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 flex items-center gap-2"><SettingsIcon size={12}/> General Appearance</h3>
            <div className="space-y-2">
              <ToggleItem 
                label="Dark Mode" 
                description="Optimized for long sessions." 
                forcedOn={theme === 'dark'}
                onToggle={() => handleThemeChange('dark')}
              />
              <ToggleItem 
                label="Hacker Mode" 
                description="Terminal-inspired high contrast." 
                forcedOn={theme === 'hacker'}
                onToggle={() => handleThemeChange('hacker')}
              />
              <ToggleItem label="Enable Animations" description="Display live scan effects." defaultOn />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 flex items-center gap-2"><RefreshCw size={12}/> Updates</h3>
            <div className="bg-white/40 border border-[#141414]/10 rounded-lg p-4 space-y-3 text-sm">
              <div className="flex justify-between items-center"><span className="opacity-70">Current Version</span><span className="font-mono font-bold">v2.0.1</span></div>
              <button className="w-full bg-[#141414]/5 py-2 rounded text-xs font-bold hover:bg-[#141414]/10 transition-colors">Check for Updates</button>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-40 flex items-center gap-2"><Lock size={12}/> Privacy</h3>
            <div className="space-y-2">
              <ToggleItem label="Share Analytics" description="Help improve scanning performance." />
              <ToggleItem label="Secure Deletion" description="Overwrite deleted files." />
              <ToggleItem label="Encrypted Logs" description="Protect stored scan data." defaultOn />
            </div>
          </section>

          <section className="bg-[#141414] text-[#E4E3E0] p-6 rounded-xl shadow-lg relative overflow-hidden">
            <Star className="absolute -right-4 -top-4 opacity-10" size={100} />
            <h4 className="font-serif italic text-2xl mb-2 relative z-10">ScanDupe Pro</h4>
            <ul className="text-xs space-y-2 opacity-80 mb-4 font-mono relative z-10">
              <li>• AI Duplicate Detection</li>
              <li>• Cloud Synchronization</li>
              <li>• Unlimited Scan History</li>
            </ul>
            <button className="w-full bg-[#E4E3E0] text-[#141414] py-2 rounded text-xs font-bold hover:bg-white transition-colors relative z-10">Manage License</button>
          </section>

          <section className="bg-white/30 border border-[#141414]/10 rounded-lg p-4 space-y-3 font-mono text-[10px] uppercase opacity-60 text-center">
            <p>ScanDupe v2.0</p>
            <p>Powered by JavaFX • SQLite • Multithreaded Engine</p>
            <p>Built for High Performance File Intelligence</p>
          </section>
          
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-4 border-b border-[#141414]/10 pb-4">
      <div className="p-3 bg-[#141414] text-[#E4E3E0] rounded-lg shadow-md">{icon}</div>
      <div>
        <h3 className="font-serif italic text-2xl">{title}</h3>
        <p className="text-xs opacity-60 font-sans">{desc}</p>
      </div>
    </div>
  );
}

function ToggleItem({ label, description, defaultOn, forcedOn, onToggle }: { label: string, description: string, defaultOn?: boolean, forcedOn?: boolean, onToggle?: () => void }) {
  const [on, setOn] = React.useState(defaultOn || false);
  
  const isActuallyOn = forcedOn !== undefined ? forcedOn : on;

  const handleClick = () => {
    if (onToggle) {
      onToggle();
    } else {
      setOn(!on);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white/40 border border-[#141414]/10 rounded-lg hover:border-[#141414]/30 transition-all cursor-pointer group" onClick={handleClick}>
      <div className="space-y-1 pr-4">
        <h4 className="font-mono text-[11px] font-bold uppercase">{label}</h4>
        <p className="text-[10px] opacity-60 font-sans leading-tight">{description}</p>
      </div>
      <div className={`w-10 h-5 rounded-full transition-all flex items-center px-1 flex-shrink-0 ${isActuallyOn ? 'bg-green-700' : 'bg-[#141414]/20'}`}>
        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-all ${isActuallyOn ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </div>
  );
}
