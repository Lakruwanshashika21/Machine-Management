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
import { Loader2, AlertCircle } from 'lucide-react';
import { InstallPrompt } from './components/InstallPrompt';

// Import UI components for the Global Dialog
import { Dialog, DialogContent } from './components/ui/dialog';
import { Button } from './components/ui/button';

function AppContent() {
  const { user, loading } = useApp();
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium animate-pulse">Syncing Factory Data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderView = () => {
    const isAdmin = user?.role === 'ADMIN';

    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'scanning':
        return <Scanning />;
      case 'registry':
        return isAdmin ? <MachineRegistry /> : <AccessDenied />;
      case 'users':
        return isAdmin ? <UserManagement /> : <AccessDenied />;
      case 'audit':
        return isAdmin ? <AuditReports /> : <AccessDenied />;
      default:
        return <Dashboard />;
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

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-red-50 rounded-xl border border-red-100">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-bold text-red-900">Restricted Access</h3>
      <p className="text-red-600 max-w-xs">You do not have the administrator permissions required to view this module.</p>
    </div>
  );
}

// Internal component to handle the Global Dialog logic
function GlobalScanManager() {
  const { globalScanId, setGlobalScanId, machines, updateMachineStatus, isProcessing } = useApp();
  
  const machine = machines.find(m => m.id === globalScanId);

  const handleUpdate = async (status: string) => {
    if (globalScanId) {
      await updateMachineStatus(globalScanId, status);
      setGlobalScanId(null);
    }
  };

  return (
    <Dialog open={!!globalScanId} onOpenChange={() => !isProcessing && setGlobalScanId(null)}>
      <DialogContent className="w-[95%] sm:max-w-md p-6 md:p-8 rounded-[32px] border-t-8 border-blue-600">
        {machine && (
          <div className="space-y-8 text-center">
            <div className="space-y-1">
              <p className="text-blue-600 font-black text-[10px] uppercase tracking-widest">Global Scan Detected</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{machine.name}</h2>
              <span className="inline-block px-3 py-1 bg-slate-100 rounded-lg font-mono text-xs font-bold text-slate-600 border uppercase">ID: {machine.id}</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                disabled={isProcessing}
                onClick={() => handleUpdate('RUNNING')} 
                className="h-24 text-xl bg-green-600 hover:bg-green-700 font-black shadow-lg rounded-2xl border-b-4 border-green-800"
              >
                SET RUNNING
              </Button>
              <Button 
                disabled={isProcessing}
                onClick={() => handleUpdate('IDLE')} 
                className="h-24 text-xl bg-red-600 hover:bg-red-700 font-black shadow-lg rounded-2xl border-b-4 border-red-800"
              >
                SET IDLE
              </Button>
            </div>
            <Button variant="ghost" disabled={isProcessing} onClick={() => setGlobalScanId(null)} className="text-slate-400 font-bold uppercase text-[10px]">Ignore Scan</Button>
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
      <GlobalScanManager /> {/* New: Listens for hardware scans on any page */}
      <AppContent />
      <Toaster position="top-right" expand={false} richColors closeButton />
    </AppProvider>
  );
}