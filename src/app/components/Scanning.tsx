import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Dialog, DialogContent } from './ui/dialog';
import { Camera, Keyboard, Search, Zap, Loader2, X } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { MachineStatus } from '../types';

export function Scanning() {
  const { machines, updateMachineStatus, scanMode, setScanMode } = useApp();
  const [scannedMachineId, setScannedMachineId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [bluetoothInput, setBluetoothInput] = useState('');
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const machine = machines.find((m) => m.id === scannedMachineId);

  // Cleanup on unmount with state checks
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (scannerRef.current) {
          const state = scannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            await scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        }
      };
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (scanMode === 'BLUETOOTH' && !scannedMachineId) {
      const timer = setInterval(() => hiddenInputRef.current?.focus(), 1000);
      return () => clearInterval(timer);
    }
  }, [scanMode, scannedMachineId]);

  const handleScanSuccess = (id: string) => {
    const cleanId = id.trim().toUpperCase();
    const exists = machines.find(m => m.id === cleanId);
    if (exists) {
      setScannedMachineId(cleanId);
      stopCamera();
    } else {
      alert(`Machine ${cleanId} not found.`);
      setBluetoothInput('');
    }
  };

  const startCamera = async () => {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert("Camera requires HTTPS.");
      return;
    }

    setIsInitializing(true);
    setShowCamera(true);

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        
        await scanner.start(
          { facingMode: 'environment' },
          { 
            fps: 15, 
            qrbox: (viewWidth, viewHeight) => {
              const size = Math.min(viewWidth, viewHeight) * 0.8;
              return { width: size, height: size };
            }
          },
          (text) => handleScanSuccess(text),
          () => {} 
        );
        setIsInitializing(false);
      } catch (err) {
        console.error("Scanner Error:", err);
        setIsInitializing(false);
        setShowCamera(false);
        alert("Camera blocked. Please allow camera permissions in your browser settings.");
      }
    }, 200); 
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      const state = scannerRef.current.getState();
      // FIX: Only stop if the scanner is actually running or paused
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        try {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch (err) {
          console.warn("Stop error:", err);
        }
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
      setBluetoothInput('');
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-4xl mx-auto pb-24">
      <div className="px-1">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">Scanning Terminal</h1>
        <p className="text-sm md:text-base text-slate-500 font-medium tracking-tight">Mobile Camera & Hardware Support</p>
      </div>

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-4 md:py-6">
          <div className="flex items-center justify-around md:justify-center gap-4 md:gap-12">
            <div className={`flex flex-col md:flex-row items-center gap-2 ${scanMode === 'CAMERA' ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
              <Camera size={24} /> <span className="text-[10px] md:text-xs uppercase font-black tracking-widest">Camera</span>
            </div>
            <Switch 
              checked={scanMode === 'BLUETOOTH'} 
              onCheckedChange={(c) => {
                  stopCamera();
                  setScanMode(c ? 'BLUETOOTH' : 'CAMERA');
              }} 
            />
            <div className={`flex flex-col md:flex-row items-center gap-2 ${scanMode === 'BLUETOOTH' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
              <Keyboard size={24} /> <span className="text-[10px] md:text-xs uppercase font-black tracking-widest">Hardware</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-blue-100 bg-blue-50/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] md:text-xs uppercase text-blue-600 font-black flex items-center gap-2">
            <Search size={14} /> ID Lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input 
            placeholder="Search ID..." 
            value={manualInput} 
            list="machine-list"
            className="font-mono font-bold uppercase h-12 md:h-10 bg-white"
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScanSuccess(manualInput)}
          />
          <datalist id="machine-list">
            {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </datalist>
          <Button onClick={() => handleScanSuccess(manualInput)} className="bg-blue-600 h-12 md:h-10 px-6">
            <Search size={20} />
          </Button>
        </CardContent>
      </Card>

      <Card className={`min-h-[350px] md:min-h-[450px] flex items-center justify-center border-2 border-dashed ${scanMode === 'BLUETOOTH' ? 'border-blue-400 bg-blue-50/10' : 'border-slate-200'}`}>
        <CardContent className="w-full text-center p-4">
          {scanMode === 'CAMERA' ? (
            <div className="space-y-4 w-full max-w-sm mx-auto">
              {!showCamera ? (
                <Button onClick={startCamera} size="lg" className="w-full py-12 text-xl rounded-2xl shadow-xl flex flex-col gap-3">
                  <Camera size={32} /> <span>Open Camera Scanner</span>
                </Button>
              ) : (
                <div className="relative">
                  <div id="qr-reader" className="overflow-hidden rounded-2xl border-4 border-white shadow-2xl bg-slate-100 min-h-[300px]"></div>
                  {isInitializing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 rounded-2xl">
                       <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
                    </div>
                  )}
                  <Button variant="destructive" onClick={stopCamera} className="w-full mt-6 h-12 font-black uppercase tracking-widest">
                    <X className="w-5 h-5 mr-2" /> Stop Scanner
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 py-10">
              <div className="bg-blue-600 w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center mx-auto text-white animate-pulse shadow-2xl">
                <Zap size={48} fill="currentColor" />
              </div>
              <p className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">Ready for Hardware</p>
              <input 
                ref={hiddenInputRef}
                className="opacity-0 absolute pointer-events-none"
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
        <DialogContent className="w-[95%] sm:max-w-md p-6 md:p-8 rounded-[32px]">
          {machine && (
            <div className="space-y-8 text-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">{machine.name}</h2>
                <span className="mt-2 px-3 py-1 bg-slate-100 rounded-lg font-mono text-xs font-bold text-slate-600 border uppercase">ID: {machine.id}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button onClick={() => handleStatusUpdate('RUNNING')} className="h-24 text-xl bg-green-600 hover:bg-green-700 font-black shadow-lg rounded-2xl">RUNNING</Button>
                <Button onClick={() => handleStatusUpdate('IDLE')} className="h-24 text-xl bg-red-600 hover:bg-red-700 font-black shadow-lg rounded-2xl">IDLE</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}