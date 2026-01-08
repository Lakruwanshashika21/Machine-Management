import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Dialog, DialogContent } from './ui/dialog';
import { Camera, Keyboard, Search, Zap } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { MachineStatus } from '../types';

export function Scanning() {
  const { machines, updateMachineStatus, scanMode, setScanMode, user } = useApp();
  const [scannedMachineId, setScannedMachineId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [bluetoothInput, setBluetoothInput] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const machine = machines.find((m) => m.id === scannedMachineId);

  // Focus management for hardware scanners
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
      if (showCamera) stopCamera();
    } else {
      alert(`Machine ${cleanId} not found in database.`);
    }
  };

  const handleExternalScannerInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && bluetoothInput.trim()) {
      handleScanSuccess(bluetoothInput.trim());
      setBluetoothInput('');
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (text) => handleScanSuccess(text),
        () => {}
      );
    } catch (err) {
      alert('Camera error. Check permissions.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(console.error);
      scannerRef.current = null;
    }
    setShowCamera(false);
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
        <p className="text-slate-500 font-medium">Fast entry via Camera, Hardware, or Manual Search</p>
      </div>

      {/* Mode Selector */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-8">
            <div className={`flex items-center gap-2 ${scanMode === 'CAMERA' ? 'text-blue-600 font-black' : 'text-slate-400'}`}>
              <Camera size={20} /> <span className="text-xs uppercase tracking-widest">Mobile Camera</span>
            </div>
            <Switch 
              checked={scanMode === 'BLUETOOTH'} 
              onCheckedChange={(c) => setScanMode(c ? 'BLUETOOTH' : 'CAMERA')} 
            />
            <div className={`flex items-center gap-2 ${scanMode === 'BLUETOOTH' ? 'text-blue-600 font-black' : 'text-slate-400'}`}>
              <Keyboard size={20} /> <span className="text-xs uppercase tracking-widest">External Hardware</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MANUAL ENTRY WITH AUTO-SUGGEST */}
      <Card className="shadow-sm border-blue-100 bg-blue-50/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase text-blue-600 font-black flex items-center gap-2">
            <Search size={14} /> Manual ID Entry & Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input 
            placeholder="Type Machine ID (e.g. A-CNC-001)..." 
            value={manualInput} 
            list="machine-suggestions"
            className="font-mono font-bold uppercase"
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScanSuccess(manualInput)}
          />
          {/* HTML5 Suggestion Engine */}
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

      {/* MAIN SCAN AREA */}
      <Card className={`min-h-[300px] flex items-center justify-center border-2 border-dashed ${scanMode === 'BLUETOOTH' ? 'border-blue-400' : 'border-slate-200'}`}>
        <CardContent className="w-full text-center">
          {scanMode === 'CAMERA' ? (
            !showCamera ? (
              <Button onClick={startCamera} size="lg" className="px-10 py-8 text-xl rounded-xl shadow-xl">
                <Camera className="mr-3" /> Start Camera
              </Button>
            ) : (
              <div className="space-y-4 max-w-sm mx-auto">
                <div id="qr-reader" className="overflow-hidden rounded-2xl border-4 border-white shadow-xl"></div>
                <Button variant="destructive" onClick={stopCamera} className="w-full">Stop Scanning</Button>
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white animate-pulse">
                <Zap size={40} fill="currentColor" />
              </div>
              <p className="text-xl font-black text-slate-800 tracking-tight">Listening for Hardware Scan</p>
              <input 
                ref={hiddenInputRef}
                className="opacity-0 absolute"
                value={bluetoothInput}
                onChange={(e) => setBluetoothInput(e.target.value)}
                onKeyDown={handleExternalScannerInput}
                autoFocus
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* STATUS DIALOG */}
      <Dialog open={!!scannedMachineId} onOpenChange={() => setScannedMachineId(null)}>
        <DialogContent className="sm:max-w-md p-8">
          {machine && (
            <div className="space-y-8 text-center">
              <div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">{machine.name}</h2>
                <p className="inline-block mt-2 px-3 py-1 bg-slate-100 rounded font-mono text-sm font-bold text-slate-600 border">
                  {machine.id}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Button 
                  onClick={() => handleStatusUpdate('RUNNING')}
                  className="h-24 text-2xl bg-green-600 hover:bg-green-700 font-black"
                >
                  RUNNING
                </Button>
                <Button 
                  onClick={() => handleStatusUpdate('IDLE')}
                  className="h-24 text-2xl bg-red-600 hover:bg-red-700 font-black"
                >
                  IDLE
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}