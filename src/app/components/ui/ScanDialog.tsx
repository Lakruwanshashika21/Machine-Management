import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Activity, Wrench, X } from 'lucide-react';

export function ScanDialog() {
  const { globalScanId, setGlobalScanId, machines, updateMachineStatus } = useApp();
  const [activeTab, setActiveTab] = useState<'PRODUCTION' | 'MAINTENANCE'>('PRODUCTION');

  const machine = machines.find(m => m.id === globalScanId);
  if (!machine) return null;

  const health = (machine as any).operationalStatus || 'WORKING';
  const isBlocked = health === 'BREAKDOWN' || health === 'REMOVED';

  const handleStatusUpdate = async (newStatus: string, field: 'status' | 'operationalStatus') => {
    await updateMachineStatus(machine.id, newStatus, field);
    if (field === 'operationalStatus' && newStatus === 'WORKING') {
        setActiveTab('PRODUCTION'); // Auto-switch back to production once fixed
    } else {
        setGlobalScanId(null); // Close on success
    }
  };

  return (
    <Dialog open={!!globalScanId} onOpenChange={() => setGlobalScanId(null)}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-[32px] border-none">
        <div className="p-8 text-center space-y-6">
          <div className="space-y-1">
            <h2 className="text-blue-600 font-black text-xs uppercase tracking-[0.2em]">Scan Logic Verified</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase">Update machine production activity or maintenance health status</p>
          </div>

          <div className="space-y-2">
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">{machine.name}</h1>
            <div className="bg-slate-100 px-4 py-1 rounded-full w-fit mx-auto text-[10px] font-mono font-bold text-slate-500">
              ID: {machine.id}
            </div>
          </div>

          {/* TAB TOGGLE */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setActiveTab('PRODUCTION')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'PRODUCTION' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
            >
              <Activity size={16} /> PRODUCTION
            </button>
            <button 
              onClick={() => setActiveTab('MAINTENANCE')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'MAINTENANCE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
            >
              <Wrench size={16} /> MAINTENANCE
            </button>
          </div>

          {activeTab === 'PRODUCTION' ? (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <Button 
                disabled={isBlocked}
                onClick={() => handleStatusUpdate('RUNNING', 'status')}
                className="h-32 rounded-[24px] bg-green-500 hover:bg-green-600 text-xl font-black shadow-lg shadow-green-100 disabled:opacity-30 disabled:grayscale"
              >
                SET RUNNING
              </Button>
              <Button 
                disabled={isBlocked}
                onClick={() => handleStatusUpdate('IDLE', 'status')}
                className="h-32 rounded-[24px] bg-red-500 hover:bg-red-600 text-xl font-black shadow-lg shadow-red-100 disabled:opacity-30 disabled:grayscale"
              >
                SET IDLE
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <Button 
                onClick={() => handleStatusUpdate('WORKING', 'operationalStatus')}
                className="h-32 rounded-[24px] border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-50 text-xl font-black"
              >
                MARK WORKING
              </Button>
              <Button 
                onClick={() => handleStatusUpdate('BREAKDOWN', 'operationalStatus')}
                className="h-32 rounded-[24px] bg-slate-900 text-white text-xl font-black"
              >
                BREAKDOWN
              </Button>
            </div>
          )}

          {isBlocked && activeTab === 'PRODUCTION' && (
            <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                <p className="text-red-600 text-[10px] font-black uppercase">
                   Production Locked: This machine is in {health} status.
                </p>
            </div>
          )}

          <button onClick={() => setGlobalScanId(null)} className="text-slate-400 font-black text-xs uppercase tracking-widest pt-4">Ignore Scan</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}