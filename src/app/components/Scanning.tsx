import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Dialog, DialogContent } from './ui/dialog';
import { Camera, Keyboard, X, Search } from 'lucide-react';
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

  // Live Machine lookup
  const machine = machines.find((m) => m.id === scannedMachineId);

  // Auto-focus hidden input for Bluetooth HID Scanners
  useEffect(() => {
    if (scanMode === 'BLUETOOTH' && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [scanMode, scannedMachineId]);

  const handleScanSuccess = (id: string) => {
    const exists = machines.find(m => m.id === id);
    if (exists) {
      setScannedMachineId(id);
      if (showCamera) stopCamera();
    } else {
      alert(`Machine ${id} not found in database.`);
    }
  };

  const handleBluetoothKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        { fps: 10, qrbox: { width: 250, height: 250 } },
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
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Scanning Terminal</h1>
          <p className="text-gray-600">Update machine status via Barcode or ID</p>
        </div>
      </div>

      {/* Mode Selector */}
      <Card className="bg-blue-50/50 border-blue-100">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-8">
            <div className={`flex items-center gap-2 ${scanMode === 'CAMERA' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
              <Camera size={20} /> <span>Camera</span>
            </div>
            <Switch 
              checked={scanMode === 'BLUETOOTH'} 
              onCheckedChange={(c) => setScanMode(c ? 'BLUETOOTH' : 'CAMERA')} 
            />
            <div className={`flex items-center gap-2 ${scanMode === 'BLUETOOTH' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
              <Keyboard size={20} /> <span>External Scanner</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ID Search with Auto-Suggest */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Manual ID Entry</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input 
            placeholder="Search Machine ID..." 
            value={manualInput} 
            list="machine-ids"
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScanSuccess(manualInput)}
          />
          <datalist id="machine-ids">
            {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </datalist>
          <Button onClick={() => handleScanSuccess(manualInput)}><Search size={18} /></Button>
        </CardContent>
      </Card>

      {/* Scanning Interface */}
      <Card className="min-h-[300px] flex items-center justify-center border-dashed">
        <CardContent className="w-full">
          {scanMode === 'CAMERA' ? (
            !showCamera ? (
              <div className="text-center space-y-4">
                <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-blue-600">
                  <Camera size={40} />
                </div>
                <Button onClick={startCamera} size="lg">Open Mobile Camera</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div id="qr-reader" className="overflow-hidden rounded-lg"></div>
                <Button variant="destructive" onClick={stopCamera} className="w-full">Close Camera</Button>
              </div>
            )
          ) : (
            <div className="text-center space-y-4">
              <div className="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white animate-pulse">
                <Keyboard size={40} />
              </div>
              <p className="text-xl font-semibold">Scanner Ready</p>
              <p className="text-sm text-gray-500">Scan any barcode now...</p>
              <input 
                ref={hiddenInputRef}
                className="sr-only"
                value={bluetoothInput}
                onChange={(e) => setBluetoothInput(e.target.value)}
                onKeyDown={handleBluetoothKeyDown}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Selection Dialog */}
      <Dialog open={!!scannedMachineId} onOpenChange={() => setScannedMachineId(null)}>
        <DialogContent className="sm:max-w-md">
          {machine && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-2xl font-bold">{machine.name}</h2>
                <p className="font-mono text-blue-600">{machine.id}</p>
                <div className="mt-2 text-sm text-gray-500">
                  Current: <span className="font-bold uppercase">{machine.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Button 
                  onClick={() => handleStatusUpdate('RUNNING')}
                  className="h-16 text-lg bg-green-600 hover:bg-green-700 font-bold"
                >
                  RUNNING
                </Button>
                <Button 
                  onClick={() => handleStatusUpdate('IDLE')}
                  className="h-16 text-lg bg-red-600 hover:bg-red-700 font-bold"
                >
                  IDLE
                </Button>
                <Button 
                  onClick={() => handleStatusUpdate('NOT_WORKING')}
                  className="h-16 text-lg bg-gray-500 hover:bg-gray-600 font-bold"
                >
                  NOT WORKING (NA)
                </Button>
              </div>
              
              <p className="text-xs text-gray-400 italic">
                Scan by: {user?.email} • Slot: {!machine.scans?.scan1 ? '1' : !machine.scans?.scan2 ? '2' : '3'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}