import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Camera, Keyboard, Search, Zap, Loader2, X, FastForward } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

export function Scanning() {
  const { 
    machines, 
    scanMode, 
    setScanMode, 
    isAutoRunMode, 
    setIsAutoRunMode, 
    setGlobalScanId 
  } = useApp();

  const [manualInput, setManualInput] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // 1. Cleanup camera on unmount
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

  // 2. Handle Camera Scan Success
  const handleCameraSuccess = (id: string) => {
    const cleanId = id.trim().toUpperCase();
    const exists = machines.find((m: any) => m.id === cleanId);
    
    if (exists) {
      // Pass the ID to the global manager in App.tsx
      setGlobalScanId(cleanId);
      stopCamera();
    } else {
      alert(`Machine ${cleanId} not found.`);
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
          { fps: 15, qrbox: (vw, vh) => ({ width: Math.min(vw, vh) * 0.8, height: Math.min(vw, vh) * 0.8 }) },
          (text) => handleCameraSuccess(text),
          () => {} 
        );
        setIsInitializing(false);
      } catch (err) {
        setIsInitializing(false);
        setShowCamera(false);
        alert("Camera access denied.");
      }
    }, 200); 
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      const state = scannerRef.current.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
    }
    setShowCamera(false);
  };

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-4xl mx-auto pb-24">
      {/* 1. PERSISTENT GLOBAL AUTO-RUN TOGGLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">Scanning Terminal</h1>
          <p className="text-sm md:text-base text-slate-500 font-medium tracking-tight">Active for Industrial WiFi/Wireless Scanners</p>
        </div>
        
        <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg transition-all">
          <FastForward size={20} className={isAutoRunMode ? "animate-pulse" : ""} />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-tighter leading-none">Auto-Run Mode</span>
            <span className="text-[8px] opacity-80 uppercase leading-none">Instant Update</span>
          </div>
          <Switch 
            checked={isAutoRunMode} 
            onCheckedChange={setIsAutoRunMode} // Updates state in AppContext
            className="data-[state=checked]:bg-white data-[state=unchecked]:bg-blue-800"
          />
        </div>
      </div>

      {/* 2. MODE INDICATOR */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-4 md:py-6">
          <div className="flex items-center justify-around md:justify-center gap-4 md:gap-12">
            <div 
              onClick={() => setScanMode('CAMERA')}
              className={`flex flex-col md:flex-row items-center gap-2 cursor-pointer ${scanMode === 'CAMERA' ? 'text-blue-600 font-bold' : 'text-slate-400'}`}
            >
              <Camera size={24} /> <span className="text-[10px] md:text-xs uppercase font-black tracking-widest">Mobile Cam</span>
            </div>
            
            <div className="h-8 w-px bg-slate-200" />

            <div 
              onClick={() => setScanMode('BLUETOOTH')}
              className={`flex flex-col md:flex-row items-center gap-2 cursor-pointer ${scanMode === 'BLUETOOTH' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}
            >
              <Keyboard size={24} /> <span className="text-[10px] md:text-xs uppercase font-black tracking-widest">WiFi/Handheld</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. MANUAL SEARCH CARD */}
      <Card className="shadow-sm border-blue-100 bg-blue-50/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] md:text-xs uppercase text-blue-600 font-black flex items-center gap-2">
            <Search size={14} /> ID Lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input 
            placeholder="Enter ID manually..." 
            value={manualInput} 
            list="machine-list"
            className="font-mono font-bold uppercase h-12 md:h-10 bg-white"
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setGlobalScanId(manualInput)}
          />
          <datalist id="machine-list">
            {machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </datalist>
          <Button onClick={() => setGlobalScanId(manualInput)} className="bg-blue-600 h-12 md:h-10 px-6">
            <Search size={20} />
          </Button>
        </CardContent>
      </Card>

      {/* 4. SCANNER DISPLAY AREA */}
      <Card className={`min-h-[350px] md:min-h-[450px] flex items-center justify-center border-2 border-dashed ${scanMode === 'BLUETOOTH' ? 'border-blue-400 bg-blue-50/10' : 'border-slate-200'}`}>
        <CardContent className="w-full text-center p-4">
          {scanMode === 'CAMERA' ? (
            <div className="space-y-4 w-full max-w-sm mx-auto">
              {!showCamera ? (
                <Button onClick={startCamera} size="lg" className="w-full py-12 text-xl rounded-2xl shadow-xl flex flex-col gap-3">
                  <Camera size={32} /> <span>Open Camera</span>
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
              <div className="space-y-1">
                <p className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">WiFi Scanner Ready</p>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Listening globally on all pages</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}