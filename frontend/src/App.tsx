import React, { useState, useEffect } from 'react';
import { 
  FolderSearch, 
  Trash2, 
  FileText, 
  Settings, 
  BookOpen, 
  LayoutDashboard, 
  Activity,
  ChevronRight,
  Database,
  Terminal,
  Code2,
  History,
  AlertCircle,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import ScanHistory from './components/ScanHistory';
import SettingsView from './components/SettingsView';
import SystemMonitor from './components/SystemMonitor';
import StorageRadar from './components/StorageRadar';

export type View = 'monitor' | 'dashboard' | 'radar' | 'history' | 'settings';

export default function App() {
  const [activeView, setActiveView] = useState<View>('monitor');
  const [theme, setTheme] = useState(localStorage.getItem('appTheme') || 'light');

  // Listen for theme changes from SettingsView
  useEffect(() => {
    const handleStorage = () => {
      setTheme(localStorage.getItem('appTheme') || 'light');
    };
    window.addEventListener('storage', handleStorage);
    // Custom event for same-window updates
    window.addEventListener('theme-changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('theme-changed', handleStorage);
    };
  }, []);

  let themeClass = '';
  if (theme === 'dark') themeClass = 'invert hue-rotate-180';
  if (theme === 'hacker') themeClass = 'invert sepia hue-rotate-60 saturate-200 contrast-125';

  return (
    <div className={`flex h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0] transition-all duration-500 ${themeClass}`}>
      {/* Sidebar - Technical Grid Style */}
      <nav className="w-64 border-r border-[#141414] flex flex-col pt-8 bg-[#E4E3E0] relative z-10">
        <div className="px-6 mb-12">
          <h1 className="font-serif italic text-2xl tracking-tight flex items-center gap-2">
             OmniClean Pro
          </h1>
          <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest mt-1">
            System Optimizer v2.0
          </p>
        </div>

        <div className="flex-1 px-3 space-y-1">
          <NavItem 
            icon={<Activity size={18} />} 
            label="System Monitor" 
            active={activeView === 'monitor'} 
            onClick={() => setActiveView('monitor')} 
          />
          <NavItem 
            icon={<FolderSearch size={18} />} 
            label="Duplicate Scanner" 
            active={activeView === 'dashboard'} 
            onClick={() => setActiveView('dashboard')} 
          />
          <NavItem 
            icon={<Target size={18} />} 
            label="Storage Radar" 
            active={activeView === 'radar'} 
            onClick={() => setActiveView('radar')} 
          />
          <NavItem 
            icon={<History size={18} />} 
            label="Scan History"  
            active={activeView === 'history'} 
            onClick={() => setActiveView('history')} 
          />
          <NavItem 
            icon={<Settings size={18} />} 
            label="Settings" 
            active={activeView === 'settings'} 
            onClick={() => setActiveView('settings')} 
          />
        </div>

        <div className="p-6 border-t border-[#141414]">
          <div className="flex items-center gap-2 text-[10px] font-mono opacity-60 uppercase">
             <Database size={12} />
             <span>SQLite Ready</span>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        <motion.div
          animate={{ 
            opacity: activeView === 'monitor' ? 1 : 0, 
            y: activeView === 'monitor' ? 0 : 10,
            scale: activeView === 'monitor' ? 1 : 0.98
          }}
          transition={{ duration: 0.2 }}
          className={`absolute inset-0 p-8 max-w-6xl mx-auto overflow-auto ${activeView === 'monitor' ? 'pointer-events-auto z-10' : 'pointer-events-none z-0'}`}
        >
          <SystemMonitor isActive={activeView === 'monitor'} />
        </motion.div>

        <motion.div
          animate={{ 
            opacity: activeView === 'dashboard' ? 1 : 0, 
            y: activeView === 'dashboard' ? 0 : 10,
            scale: activeView === 'dashboard' ? 1 : 0.98
          }}
          transition={{ duration: 0.2 }}
          className={`absolute inset-0 p-8 max-w-6xl mx-auto overflow-auto ${activeView === 'dashboard' ? 'pointer-events-auto z-10' : 'pointer-events-none z-0'}`}
        >
          <Dashboard />
        </motion.div>

        <motion.div
          animate={{ 
            opacity: activeView === 'radar' ? 1 : 0, 
            y: activeView === 'radar' ? 0 : 10,
            scale: activeView === 'radar' ? 1 : 0.98
          }}
          transition={{ duration: 0.2 }}
          className={`absolute inset-0 p-8 max-w-6xl mx-auto overflow-auto ${activeView === 'radar' ? 'pointer-events-auto z-10' : 'pointer-events-none z-0'}`}
        >
          <StorageRadar />
        </motion.div>

        <motion.div
          animate={{ 
            opacity: activeView === 'history' ? 1 : 0, 
            y: activeView === 'history' ? 0 : 10,
            scale: activeView === 'history' ? 1 : 0.98
          }}
          transition={{ duration: 0.2 }}
          className={`absolute inset-0 p-8 max-w-6xl mx-auto overflow-auto ${activeView === 'history' ? 'pointer-events-auto z-10' : 'pointer-events-none z-0'}`}
        >
          <ScanHistory isActive={activeView === 'history'} />
        </motion.div>

        <motion.div
          animate={{ 
            opacity: activeView === 'settings' ? 1 : 0, 
            y: activeView === 'settings' ? 0 : 10,
            scale: activeView === 'settings' ? 1 : 0.98
          }}
          transition={{ duration: 0.2 }}
          className={`absolute inset-0 p-8 max-w-6xl mx-auto overflow-auto ${activeView === 'settings' ? 'pointer-events-auto z-10' : 'pointer-events-none z-0'}`}
        >
          <SettingsView />
        </motion.div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded text-sm transition-all duration-200 group relative
        ${active 
          ? 'bg-[#141414] text-[#E4E3E0]' 
          : 'hover:bg-[#141414]/5 text-[#141414]/70 hover:text-[#141414]'}`}
    >
      {icon}
      <span className="font-medium tracking-tight">{label}</span>
      {active && (
        <motion.div 
          layoutId="active-indicator"
          className="absolute right-2 w-1.5 h-1.5 rounded-full bg-[#E4E3E0]" 
        />
      )}
    </button>
  );
}
