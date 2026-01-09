import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Dialog, DialogContent } from './ui/dialog';
import { Camera, Keyboard, Search, Zap, Loader2, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { MachineStatus } from '../types';

export function Scanning() {
  const { machines, updateMachineStatus, scanMode, setScanMode, user } = useApp();
  const [scannedMachineId, setScannedMachineId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [bluetoothInput, setBluetoothInput] = useState('');
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const machine = machines.find((m) => m.id === scannedMachineId);

  // 1. CLEANUP ON UNMOUNT
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
        });
      }
    };
  }, []);

  // 2. BLUETOOTH FOCUS LOGIC
  useEffect(() => {
    const keepFocus = () => {
      if (scanMode === 'BLUETOOTH' && !scannedMachineId && hiddenInputRef.current) {
        hiddenInputRef.current.focus();
      }
    };
    keepFocus();
    const interval = setInterval(keepFocus, 1000);
    return () => clearInterval(interval);
  }, [scanMode, scannedMachineId]);

  const handleScanSuccess = (id: string) => {
    const cleanId = id.trim().toUpperCase();
    const exists = machines.find(m => m.id === cleanId);
    if (exists) {
      setScannedMachineId(cleanId);
      stopCamera();
    } else {
      alert(`Machine ${cleanId} not found in database.`);
    }
  };

  const startCamera = async () => {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert("Camera requires HTTPS.");
      return;
    }

    setIsInitializing(true);
    setShowCamera(true);

    // Small delay to ensure the DOM is ready for injection
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (text) => handleScanSuccess(text),
          () => {} 
        );
        setIsInitializing(false);
      } catch (err) {
        console.error("Scanner Error:", err);
        setIsInitializing(false);
        setShowCamera(false);
      }
    }, 100); 
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear(); 
      } catch (err) {
        console.warn("Cleanup error:", err);
      }
      scannerRef.current = null;
    }
    setShowCamera(false);
    setIsInitializing(false);
  };

  const handleStatusUpdate = async (status: MachineStatus) => {
    if (scannedMachineId) {
      await updateMachineStatus(scannedMachineId, status);
      setScannedMachineId(null);
      setManualInput('');
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-slate-900">Scanning Terminal</h1>
        <p className="text-slate-500 font-medium tracking-tight">Support for Mobile Camera & Hardware Scanners</p>
      </div>

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-8">
            <div className={`flex items-center gap-2 ${scanMode === 'CAMERA' ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
              <Camera size={20} /> <span className="text-xs uppercase tracking-widest">Mobile Camera</span>
            </div>
            <Switch 
              checked={scanMode === 'BLUETOOTH'} 
              onCheckedChange={(c) => {
                  stopCamera();
                  setScanMode(c ? 'BLUETOOTH' : 'CAMERA');
              }} 
            />
            <div className={`flex items-center gap-2 ${scanMode === 'BLUETOOTH' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
              <Keyboard size={20} /> <span className="text-xs uppercase tracking-widest">External Hardware</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-blue-100 bg-blue-50/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase text-blue-600 font-black flex items-center gap-2">
            <Search size={14} /> Manual ID Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input 
            placeholder="Type Machine ID..." 
            value={manualInput} 
            list="machine-suggestions"
            className="font-mono font-bold uppercase"
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScanSuccess(manualInput)}
          />
          <datalist id="machine-suggestions">
            {machines.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.section})</option>
            ))}
          </datalist>
          <Button onClick={() => handleScanSuccess(manualInput)} className="bg-blue-600">
            <Search size={18} />
          </Button>
        </CardContent>
      </Card>

      <Card className={`min-h-[350px] flex items-center justify-center border-2 border-dashed ${scanMode === 'BLUETOOTH' ? 'border-blue-400 bg-blue-50/10' : 'border-slate-200'}`}>
        <CardContent className="w-full text-center">
          {scanMode === 'CAMERA' ? (
            <div className="space-y-4 max-w-sm mx-auto">
              {!showCamera ? (
                <Button onClick={startCamera} size="lg" className="px-10 py-8 text-xl rounded-xl shadow-xl">
                  <Camera className="mr-3" /> Open Camera
                </Button>
              ) : (
                <div className="relative">
                  {/* CRITICAL: This div is ALWAYS in the DOM when showCamera is true to prevent removeChild error */}
                  <div id="qr-reader" className="overflow-hidden rounded-2xl border-4 border-white shadow-xl bg-slate-100 min-h-[250px]"></div>
                  
                  {isInitializing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 rounded-2xl">
                       <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
                    </div>
                  )}
                  <Button variant="destructive" onClick={stopCamera} className="w-full mt-4 font-bold">
                    <X className="w-4 h-4 mr-2" /> Cancel Scan
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white animate-pulse shadow-lg">
                <Zap size={40} fill="currentColor" />
              </div>
              <p className="text-xl font-black text-slate-800 tracking-tight uppercase">Ready for Hardware Scan</p>
              <input 
                ref={hiddenInputRef}
                className="opacity-0 absolute"
                value={bluetoothInput}
                onChange={(e) => setBluetoothInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanSuccess(bluetoothInput)}
                autoFocus
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!scannedMachineId} onOpenChange={() => setScannedMachineId(null)}>
        <DialogContent className="sm:max-w-md p-8">
          {machine && (
            <div className="space-y-8 text-center">
              <div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tighter uppercase">{machine.name}</h2>
                <p className="inline-block mt-2 px-3 py-1 bg-slate-100 rounded font-mono text-sm font-bold text-slate-600 border tracking-widest uppercase">
                  {machine.id}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Button 
                  onClick={() => handleStatusUpdate('RUNNING')}
                  className="h-20 text-2xl bg-green-600 hover:bg-green-700 font-black shadow-lg"
                >
                  SET RUNNING
                </Button>
                <Button 
                  onClick={() => handleStatusUpdate('IDLE')}
                  className="h-20 text-2xl bg-red-600 hover:bg-red-700 font-black shadow-lg"
                >
                  SET IDLE
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}