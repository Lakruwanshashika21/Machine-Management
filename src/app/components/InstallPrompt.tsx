import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';
import { Button } from './ui/button';

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Check if the app is already running as a PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    
    if (isStandalone) return;

    // 2. Identify iOS users for specific instructions
    const isIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    setIsIOS(isIphone);

    // 3. Listen for the official Android/Chrome install event
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true); // Trigger UI as soon as browser confirms installability
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    // 4. Fallback Trigger: If no browser event fires after 3 seconds, 
    // force show the UI for iOS or as a manual reminder for others.
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    // If the browser provided a prompt, use it
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    } else {
      // Fallback for browsers without auto-prompting support (like desktop Safari)
      alert("Please use your browser's menu to install this app.");
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
      <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-8 relative overflow-hidden border border-slate-100">
        <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
        
        <button 
          onClick={() => setShowPrompt(false)} 
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Download className="text-blue-600 w-10 h-10" />
          </div>
          
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Install Dashboard</h2>
          <p className="text-slate-500 mb-8 font-medium leading-relaxed">
            Add this system to your home screen for fast, full-screen access to factory monitoring.
          </p>

          {isIOS ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-left space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Instructions for iPhone</p>
              <div className="flex items-center gap-4 text-sm font-bold text-slate-700">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                  <Share size={18} className="text-blue-600" />
                </div>
                <span>1. Tap the Share button</span>
              </div>
              <div className="flex items-center gap-4 text-sm font-bold text-slate-700">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                  <PlusSquare size={18} className="text-blue-600" />
                </div>
                <span>2. Select 'Add to Home Screen'</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleInstall} 
                className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg font-black rounded-2xl shadow-lg shadow-blue-200"
              >
                INSTALL NOW
              </Button>
              <button 
                onClick={() => setShowPrompt(false)} 
                className="text-slate-400 font-bold py-2 text-xs uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}