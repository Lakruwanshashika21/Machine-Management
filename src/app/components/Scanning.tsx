import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Camera, Keyboard, Search, Zap, Loader2, X, FastForward } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { toast } from 'sonner';

export function Scanning() {
  const { 
    machines, 
    scanMode, 
    setScanMode, 
    isAutoRunMode, 
    setIsAutoRunMode, 
    setGlobalScanId,
    updateMachineStatus 
  } = useApp();

  const [manualInput, setManualInput] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Universal cleanup to prevent camera lock and handle component unmounting
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          scannerRef.current.stop().catch(() => {});
        }
      }
    };
  }, []);

  // UNIVERSAL FUZZY SEARCH: Finds Aurora-001 even if you just type "Aurora 1"
 // Inside Scanning.tsx

const handleIdSubmission = async (input: string) => {
  const term = input.trim().toUpperCase();
  if (!term) return;

  // 1. Find the machine (using your existing fuzzy search logic)
  let machine = machines.find(m => m.id.toUpperCase() === term);
  if (!machine) {
    const cleanSearch = term.replace(/[\s-]/g, '');
    machine = machines.find((m: any) => {
      const cleanDbId = m.id.toUpperCase().replace(/[\s-]/g, '');
      const cleanDbName = (m.name || '').toUpperCase().replace(/[\s-]/g, '');
      return cleanDbId.includes(cleanSearch) || cleanDbName.includes(cleanSearch);
    });
  }
  
  if (machine) {
    const finalId = machine.id;
    const health = (machine as any).operationalStatus || 'WORKING';
    const isPhysicallyDown = health === 'BREAKDOWN' || health === 'REMOVED';

    // UPDATED LOGIC:
    // If machine is BREAKDOWN, we NEVER auto-run, even if the switch is ON.
    if (isPhysicallyDown) {
      if (isAutoRunMode) {
        toast.warning(`Auto-Run Bypassed: Machine ${finalId} is in ${health} state.`, {
          description: "Please update health status in the Maintenance tab.",
          duration: 4000
        });
      }
      // Force open the dialog so they can fix the health status
      setGlobalScanId(finalId);
      if (showCamera) stopCamera();
      setManualInput('');
      return;
    }

    // Normal behavior for WORKING machines
    if (isAutoRunMode) {
      await updateMachineStatus(finalId, 'RUNNING', 'status');
      toast.success(`${machine.name || finalId} set to RUNNING`);
      setManualInput('');
      if (showCamera) stopCamera();
    } else {
      setGlobalScanId(finalId);
      if (showCamera) stopCamera();
      setManualInput('');
    }
  } else {
    toast.error(`No machine found matching "${input}"`);
  }
};

  /**
   * CAMERA INITIALIZATION FIX:
   * 1. Uses a longer delay to ensure the 'qr-reader' div is in the DOM.
   * 2. Sets explicit aspectRatio to help PC/Mobile browsers initialize.
   * 3. Catches 'NotAllowedError' to provide helpful feedback.
   */
  const startCamera = async () => {
    setIsInitializing(true);
    setShowCamera(true);
    
    // WAIT for React to render the "qr-reader" div
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        
        await scanner.start(
          { facingMode: "environment" }, 
          { 
            fps: 25, 
            qrbox: (vw, vh) => ({ width: Math.min(vw, vh) * 0.7, height: Math.min(vw, vh) * 0.7 }),
            aspectRatio: 1.0 
          },
          (text) => handleIdSubmission(text),
          () => {} 
        );
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Camera Error:", err);
        setIsInitializing(false);
        setShowCamera(false);
        
        // Provide specific advice based on the error type
        if (err?.name === "NotAllowedError" || String(err).includes("denied")) {
          toast.error("Access Denied: Click the 'Lock' icon in your browser address bar and set Camera to 'Allow'.");
        } else {
          toast.error("Camera failed. Ensure no other apps (Zoom/Teams) are using it.");
        }
      }
    }, 500); 
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      const state = scannerRef.current.getState();
      if (state === Html5QrcodeScannerState.SCANNING) {
        await scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
    }
    setShowCamera(false);
    setIsInitializing(false);
  };

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-4xl mx-auto pb-24">
      {/* HEADER & AUTO-RUN TOGGLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Universal Terminal</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight mt-1">Scanner facility for Handheld, WiFi & Mobile.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg border-b-4 border-blue-800 transition-all active:scale-95">
          <FastForward size={20} className={isAutoRunMode ? "animate-pulse" : ""} />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-tighter leading-none">Auto-Run Mode</span>
            <span className="text-[8px] opacity-80 uppercase leading-none">Instant Activity</span>
          </div>
          <Switch 
            checked={isAutoRunMode} 
            onCheckedChange={setIsAutoRunMode} 
            className="data-[state=checked]:bg-white data-[state=unchecked]:bg-blue-800"
          />
        </div>
      </div>

      {/* SEARCH / TYPING FACILITY */}
      <Card className="shadow-sm border-blue-100 bg-blue-50/20">
        <div className="p-4 flex gap-2">
          {/* Search Input in Scanning.tsx */}
            <Input 
              placeholder="Type Machine ID..." 
              value={manualInput} 
              list="machine-list" // Link to the datalist below
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleIdSubmission(manualInput)}
            />

            <datalist id="machine-list">
              {machines.map((m) => (
                // Use ID as the value to ensure uniqueness
                <option key={m.id} value={m.id}>
                  {m.name} ({m.section})
                </option>
              ))}
            </datalist>
          <Button onClick={() => handleIdSubmission(manualInput)} className="bg-blue-600 h-14 px-6 shadow-md hover:bg-blue-700 transition-colors">
            <Search size={24} />
          </Button>
        </div>
      </Card>

      {/* DEVICE SELECTOR */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-4 flex items-center justify-center gap-12">
          <div 
            onClick={() => { if(!isInitializing) setScanMode('CAMERA'); }}
            className={`flex items-center gap-2 cursor-pointer transition-colors ${scanMode === 'CAMERA' ? 'text-blue-600 font-bold' : 'text-slate-400'}`}
          >
            <Camera size={24} /> <span className="text-xs uppercase font-black tracking-widest">Phone Cam</span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div 
            onClick={() => { if(!isInitializing) setScanMode('BLUETOOTH'); }}
            className={`flex items-center gap-2 cursor-pointer transition-colors ${scanMode === 'BLUETOOTH' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}
          >
            <Keyboard size={24} /> <span className="text-xs uppercase font-black tracking-widest">WiFi / Handheld</span>
          </div>
        </CardContent>
      </Card>

      {/* SCANNER VIEWPORT */}
      <Card className={`min-h-[400px] flex items-center justify-center border-2 border-dashed transition-all duration-500 overflow-hidden ${
        isAutoRunMode ? 'border-green-400 bg-green-50/5' : 'border-blue-400 bg-blue-50/5'
      }`}>
        <CardContent className="w-full text-center p-4">
          {scanMode === 'CAMERA' ? (
            <div className="space-y-4 w-full max-w-sm mx-auto">
              {!showCamera ? (
                <Button onClick={startCamera} size="lg" className="w-full py-16 rounded-[32px] flex flex-col gap-4 shadow-xl transition-transform active:scale-95 bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50">
                  <Camera size={48} /> <span className="font-black uppercase tracking-widest text-xl">Open Camera</span>
                </Button>
              ) : (
                <div className="relative">
                  <div id="qr-reader" className={`overflow-hidden rounded-[32px] border-4 shadow-2xl bg-slate-100 min-h-[300px] ${isAutoRunMode ? 'border-green-500' : 'border-blue-600'}`}></div>
                  {isInitializing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 rounded-[32px]">
                       <Loader2 className="animate-spin text-blue-600 w-12 h-12" />
                    </div>
                  )}
                  <Button variant="destructive" onClick={stopCamera} className="w-full mt-6 h-14 font-black uppercase shadow-lg tracking-widest text-lg rounded-2xl">
                    <X className="w-6 h-6 mr-2" /> Stop Scanner
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 py-10">
              <div className={`w-28 h-28 md:w-36 md:h-36 rounded-[40px] flex items-center justify-center mx-auto text-white animate-pulse shadow-2xl transition-colors ${
                isAutoRunMode ? 'bg-green-500' : 'bg-blue-600'
              }`}>
                <Zap size={64} fill="currentColor" />
              </div>
              <div className="space-y-2">
                <p className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter leading-tight">
                  {isAutoRunMode ? 'INSTANT ACTIVITY LOGGING' : 'UNIVERSAL SCANNER READY'}
                </p>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">
                  Device: {scanMode === 'BLUETOOTH' ? 'Industrial Handheld' : 'Mobile Camera'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}