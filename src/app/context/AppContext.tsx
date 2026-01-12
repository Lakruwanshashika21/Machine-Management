import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, auth } from '../../firebase';
import { 
  collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, 
  addDoc, query, orderBy, getDoc 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Machine, AuditLog, ScanMode } from '../types';

interface Section { id: string; name: string; }
interface MachineType { id: string; name: string; sectionId: string; }

interface AppContextType {
  user: any | null;
  logout: () => void;
  machines: Machine[];
  sections: Section[];
  machineTypes: MachineType[];
  addMachine: (machineData: any) => Promise<void>;
  updateMachineStatus: (machineId: string, value: string, fieldName?: 'status' | 'operationalStatus') => Promise<void>;
  deleteMachine: (machineId: string) => Promise<void>;
  addSection: (name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  addMachineType: (name: string, sectionId: string) => Promise<void>;
  deleteMachineType: (id: string) => Promise<void>;
  scanMode: ScanMode;
  setScanMode: (mode: ScanMode) => void;
  auditLogs: AuditLog[];
  globalStartDay: () => Promise<void>;
  loading: boolean;
  isAutoRunMode: boolean;
  setIsAutoRunMode: (val: boolean) => void;
  globalScanId: string | null;
  setGlobalScanId: (val: string | null) => void;
  isProcessing: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [scanMode, setScanMode] = useState<ScanMode>('BLUETOOTH');
  const [loading, setLoading] = useState(true);
  const [isAutoRunMode, setIsAutoRunMode] = useState(false);
  const [globalScanId, setGlobalScanId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- 1. DEFINE HANDLER FUNCTIONS FIRST ---

  const addSection = async (name: string) => {
    const cleanName = name.trim().toUpperCase();
    await setDoc(doc(db, "sections", cleanName), { name: cleanName });
  };

  const deleteSection = async (id: string) => {
    await deleteDoc(doc(db, "sections", id));
  };

  const addMachineType = async (name: string, sectionId: string) => {
    const typeId = `${sectionId}-${name.trim().toUpperCase()}`;
    await setDoc(doc(db, "machineTypes", typeId), { name, sectionId });
  };

  const deleteMachineType = async (id: string) => {
    await deleteDoc(doc(db, "machineTypes", id));
  };

  const updateMachineStatus = async (machineId: string, value: string, fieldName: 'status' | 'operationalStatus' = 'status') => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;
    const time = new Date().toISOString();
    
    // FIXED: Correct dynamic routing
    const updateData: any = { [fieldName]: value, lastUpdated: time };

    if (fieldName === 'status') {
      const scans = { ...machine.scans };
      const slot = !scans.scan1 ? 'scan1' : !scans.scan2 ? 'scan2' : 'scan3';
      updateData.scans = { ...scans, [slot]: { time, status: value, userId: user?.email } };
    }

    await updateDoc(doc(db, "machines", machineId), updateData);
    await addDoc(collection(db, "auditLogs"), {
      timestamp: time, machineId, userName: user?.name || user?.email,
      action: `Updated ${fieldName}`, newStatus: value
    });
  };

  const addMachine = async (data: any) => {
    const count = machines.filter(m => m.section === data.section && m.type === data.type).length;
    const newId = `${data.section}-${data.type}-${(count + 1).toString().padStart(3, '0')}`;
    await setDoc(doc(db, "machines", newId), {
      ...data, id: newId, status: 'IDLE', operationalStatus: data.operationalStatus || 'WORKING',
      scans: {}, lastUpdated: new Date().toISOString()
    });
  };

  const globalStartDay = async () => {
    const promises = machines.map(m => updateDoc(doc(db, "machines", m.id), {
      status: 'IDLE', scans: {}, lastUpdated: new Date().toISOString()
    }));
    await Promise.all(promises);
  };

  // --- 2. EFFECTS ---

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        setUser({ ...firebaseUser, ...userDoc.data() });
      } else { setUser(null); }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const unsubMachines = onSnapshot(collection(db, "machines"), (s) => setMachines(s.docs.map(d => ({ id: d.id, ...d.data() } as Machine))));
    const unsubSections = onSnapshot(collection(db, "sections"), (s) => setSections(s.docs.map(d => ({ id: d.id, ...d.data() } as Section))));
    const unsubTypes = onSnapshot(collection(db, "machineTypes"), (s) => setMachineTypes(s.docs.map(d => ({ id: d.id, ...d.data() } as MachineType))));
    const qLogs = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
    const unsubLogs = onSnapshot(qLogs, (s) => setAuditLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog))));
    return () => { unsubMachines(); unsubSections(); unsubTypes(); unsubLogs(); };
  }, []);

  // Global Hardware Scanner Listener
  useEffect(() => {
    let buffer = '';
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (isProcessing || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          const cleanId = buffer.trim().toUpperCase();
          // Fuzzy search for machines like "Aurora"
          const machine = machines.find(m => 
            m.id.toUpperCase().includes(cleanId) || m.name?.toUpperCase().includes(cleanId)
          );
          if (machine) {
            setIsProcessing(true);
            if (isAutoRunMode) {
              await updateMachineStatus(machine.id, 'RUNNING', 'status');
              setTimeout(() => setIsProcessing(false), 500);
            } else {
              setGlobalScanId(machine.id);
              setTimeout(() => setIsProcessing(false), 1000);
            }
          }
          buffer = ''; 
        }
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [machines, isAutoRunMode, isProcessing]);

  return (
    <AppContext.Provider value={{ 
      user, logout: () => signOut(auth), machines, sections, machineTypes,
      addMachine, updateMachineStatus, deleteMachine: (id) => deleteDoc(doc(db, "machines", id)),
      addSection, deleteSection, addMachineType, deleteMachineType,
      scanMode, setScanMode, auditLogs, globalStartDay, loading,
      isAutoRunMode, setIsAutoRunMode, globalScanId, setGlobalScanId, isProcessing
    }}>
      {!loading && children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp error');
  return context;
};