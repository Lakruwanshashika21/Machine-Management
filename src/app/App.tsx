import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Scanning } from './components/Scanning';
import { MachineRegistry } from './components/MachineRegistry';
import { AuditReports } from './components/AuditReports';
import { UserManagement } from './components/UserManagement';
import { Toaster } from './components/ui/sonner';
import { Loader2, AlertCircle, Wrench, Activity, X } from 'lucide-react';
import { InstallPrompt } from './components/InstallPrompt';

// UI components for the Global Dialog
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from './components/ui/dialog';
import { Button } from './components/ui/button';

/**
 * Main Content Switcher
 * Handles view routing and authentication checks
 */
function AppContent() {
  const { user, loading } = useApp();
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <p className="text-slate-500 font-black uppercase text-[10px] tracking-tighter animate-pulse">
            Syncing Factory Data...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const renderView = () => {
    const isAdmin = user?.role === 'ADMIN';

    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'scanning':  return <Scanning />;
      case 'registry':  return isAdmin ? <MachineRegistry /> : <AccessDenied />;
      case 'users':     return isAdmin ? <UserManagement /> : <AccessDenied />;
      case 'audit':     return isAdmin ? <AuditReports /> : <AccessDenied />;
      default:          return <Dashboard />;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-full">
        {renderView()}
      </div>
    </Layout>
  );
}

/**
 * Simple Access Denied view for non-admin users
 */
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-red-50 rounded-xl border border-red-100">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-bold text-red-900 uppercase">Restricted Access</h3>
      <p className="text-red-600 max-w-xs font-medium text-sm">
        Administrator permissions are required to view this module.
      </p>
    </div>
  );
}

/**
 * Global Scan Manager
 * Listens for global scanner signals and displays the update dialog
 */
function GlobalScanManager() {
  const { globalScanId, setGlobalScanId, machines, updateMachineStatus, isProcessing } = useApp();
  const [scanMode, setScanMode] = useState<'PRODUCTION' | 'MAINTENANCE'>('PRODUCTION');

  const machine = machines.find(m => m.id === globalScanId);

  const handleUpdate = async (value: string, field: 'status' | 'operationalStatus') => {
    if (globalScanId) {
      await updateMachineStatus(globalScanId, value, field);
      setGlobalScanId(null);
      setScanMode('PRODUCTION'); // Reset for next interaction
    }
  };

  return (
    <Dialog open={!!globalScanId} onOpenChange={(open) => !isProcessing && !open && setGlobalScanId(null)}>
      {/* FIXED: aria-describedby and DialogTitle resolve accessibility warnings */}
      <DialogContent 
        className="w-[95%] sm:max-w-md p-6 md:p-8 rounded-[32px] border-t-8 border-blue-600 shadow-2xl"
        aria-describedby="scan-dialog-description"
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-center text-blue-600 font-black text-[12px] uppercase tracking-widest">
            Scan Logic Verified
          </DialogTitle>
          <DialogDescription id="scan-dialog-description" className="text-center text-[10px] text-slate-400 font-bold uppercase leading-tight">
            Update machine production activity OR maintenance health status
          </DialogDescription>
        </DialogHeader>

        <button 
          onClick={() => setGlobalScanId(null)}
          className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        {machine && (
          <div className="space-y-6 text-center">
            <div className="space-y-1">
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{machine.name}</h2>
              <span className="inline-block px-3 py-1 bg-slate-100 rounded-lg font-mono text-[10px] font-bold text-slate-600 border uppercase tracking-widest">
                ID: {machine.id}
              </span>
            </div>

            {/* TAB SELECTOR: Routes data to Activity vs Maintenance Health */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button 
                onClick={() => setScanMode('PRODUCTION')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${
                  scanMode === 'PRODUCTION' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'
                }`}
              >
                <Activity size={14} /> PRODUCTION
              </button>
              <button 
                onClick={() => setScanMode('MAINTENANCE')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${
                  scanMode === 'MAINTENANCE' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400'
                }`}
              >
                <Wrench size={14} /> MAINTENANCE
              </button>
            </div>
            
            {scanMode === 'PRODUCTION' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button 
                  disabled={isProcessing}
                  onClick={() => handleUpdate('RUNNING', 'status')}
                  className="h-24 text-xl bg-green-600 hover:bg-green-700 font-black shadow-lg rounded-2xl border-b-4 border-green-800"
                >
                  SET RUNNING
                </Button>
                <Button 
                  disabled={isProcessing}
                  onClick={() => handleUpdate('IDLE', 'status')}
                  className="h-24 text-xl bg-red-600 hover:bg-red-700 font-black shadow-lg rounded-2xl border-b-4 border-red-800"
                >
                  SET IDLE
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline"
                  disabled={isProcessing}
                  onClick={() => handleUpdate('WORKING', 'operationalStatus')}
                  className="h-16 border-2 border-green-100 text-green-700 font-black hover:bg-green-50 rounded-2xl text-[10px] uppercase"
                >
                  WORKING
                </Button>
                <Button 
                  variant="outline"
                  disabled={isProcessing}
                  onClick={() => handleUpdate('HALF_WORKING', 'operationalStatus')}
                  className="h-16 border-2 border-yellow-200 text-yellow-800 font-black hover:bg-yellow-50 rounded-2xl text-[10px] uppercase"
                >
                  HALF WORK
                </Button>
                <Button 
                  variant="outline"
                  disabled={isProcessing}
                  onClick={() => handleUpdate('BREAKDOWN', 'operationalStatus')}
                  className="h-16 border-2 border-red-100 text-red-700 font-black hover:bg-red-50 rounded-2xl text-[10px] uppercase"
                >
                  BREAKDOWN
                </Button>
                <Button 
                  variant="outline"
                  disabled={isProcessing}
                  onClick={() => handleUpdate('REMOVED', 'operationalStatus')}
                  className="h-16 border-2 border-slate-200 text-slate-700 font-black hover:bg-slate-50 rounded-2xl text-[10px] uppercase"
                >
                  REMOVED
                </Button>
              </div>
            )}

            <button 
              disabled={isProcessing} 
              onClick={() => setGlobalScanId(null)} 
              className="text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors"
            >
              IGNORE SCAN
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function App() {
  return (
    <AppProvider>
      <InstallPrompt /> 
      <GlobalScanManager />
      <AppContent />
      <Toaster position="top-right" expand={false} richColors closeButton />
    </AppProvider>
  );
}