import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, auth } from '../../firebase';
import { 
  collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, 
  addDoc, query, orderBy, getDoc, arrayUnion, writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Machine, AuditLog, ScanMode } from '../types';

interface Section { 
  id: string; 
  name: string; 
  headcount?: number; 
  headcountHistory?: any[]; 
}
interface MachineType { id: string; name: string; sectionId: string; }

interface Sublocation {
  id: string;          // Formatted as: MAINSECTION_SUBLOCATIONNAME
  name: string;
  sectionId: string;
  linesCount: number;
}

// NEW STRUCTURE: Explicit row tracking profile metadata matching custom constraints
interface RegisteredRow {
  id: string;          // Formatted as: SUBLOCATIONID_ROWNAME
  rowNumber: string;
  sublocationId: string;
  sectionId: string;
}

export interface LayoutSession {
  sectionId: string;
  sublocationId: string;
  rowNumber: string;
  scannedMachines: Array<{
    machineId: string;
    serialNo: string;
    modelNo: string;
    type: string;
    rowIndex: number;
  }>;
}

interface AppContextType {
  user: any | null;
  logout: () => void;
  machines: Machine[];
  sections: Section[];
  machineTypes: MachineType[];
  sublocations: Sublocation[];
  registeredRows: RegisteredRow[]; // NEW Array binding node hook
  addMachine: (machineData: any) => Promise<void>;
  updateMachineStatus: (machineId: string, value: string, fieldName?: 'status' | 'operationalStatus') => Promise<void>;
  deleteMachine: (machineId: string) => Promise<void>;
  addSection: (name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  addMachineType: (name: string, sectionId: string) => Promise<void>;
  deleteMachineType: (id: string) => Promise<void>;
  updateSectionHeadcount: (sectionId: string, amount: number) => Promise<void>;
  
  // NEW LAYOUT, ROW, AND SUBLOCATION PRIMITIVES
  addSublocation: (sectionId: string, name: string, linesCount?: number) => Promise<void>;
  deleteSublocation: (id: string) => Promise<void>;
  addRegisteredRow: (sectionId: string, sublocationId: string, rowName: string) => Promise<void>; // NEW
  deleteRegisteredRow: (id: string) => Promise<void>; // NEW
  saveLayoutConfiguration: (session: LayoutSession) => Promise<void>;

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
  const [sublocations, setSublocations] = useState<Sublocation[]>([]);
  const [registeredRows, setRegisteredRows] = useState<RegisteredRow[]>([]); // NEW state pool binding hook
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [scanMode, setScanMode] = useState<ScanMode>('BLUETOOTH');
  const [loading, setLoading] = useState(true);
  const [isAutoRunMode, setIsAutoRunMode] = useState(false);
  const [globalScanId, setGlobalScanId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Core Management Handlers
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

  // NEW LAYOUT METHOD ENGINES
  const addSublocation = async (sectionId: string, name: string, linesCount: number = 99) => {
    const cleanName = name.trim().toUpperCase().replace(/\s+/g, '_');
    const sublocationId = `${sectionId}_${cleanName}`;
    await setDoc(doc(db, "sublocations", sublocationId), {
      id: sublocationId,
      name: name.trim().toUpperCase(),
      sectionId,
      linesCount: Number(linesCount)
    });
  };
    
  const deleteSublocation = async (id: string) => {
    await deleteDoc(doc(db, "sublocations", id));
  };

  // NEW explicit sublocation line row registrations tracker logic block
  const addRegisteredRow = async (sectionId: string, sublocationId: string, rowName: string) => {
    const cleanRowName = rowName.trim().toUpperCase();
    const rowId = `${sublocationId}_ROW_${cleanRowName}`;
    await setDoc(doc(db, "registeredRows", rowId), {
      id: rowId,
      rowNumber: cleanRowName,
      sublocationId,
      sectionId
    });
  };

  const deleteRegisteredRow = async (id: string) => {
    await deleteDoc(doc(db, "registeredRows", id));
  };

  const saveLayoutConfiguration = async (session: LayoutSession) => {
    const batch = writeBatch(db);
    const time = new Date().toISOString();
    const authorizedUser = user?.name || user?.email || 'Admin';

    for (const item of session.scannedMachines) {
      const machineRef = doc(db, "machines", item.machineId);
      
      // Update data mapping schema attributes inside machine record
      batch.update(machineRef, {
        section: session.sectionId,
        sublocationId: session.sublocationId,
        rowNumber: session.rowNumber,
        rowIndex: item.rowIndex,
        lastUpdated: time,
        layoutConfiguredAt: time,
        layoutConfiguredBy: authorizedUser
      });

      // Append historical audit data trail records
      const auditRef = doc(collection(db, "auditLogs"));
      batch.set(auditRef, {
        timestamp: time,
        machineId: item.machineId,
        userName: authorizedUser,
        action: `Layout Grid Map`,
        newStatus: `Row: ${session.rowNumber} | Index: ${item.rowIndex} under ${session.sublocationId}`
      });
    }

    await batch.commit();
  };

  const updateMachineStatus = async (machineId: string, value: string, fieldName: 'status' | 'operationalStatus' = 'status') => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;
    const time = new Date().toISOString();
    const updateData: any = { [fieldName]: value, lastUpdated: time };

    if (fieldName === 'status') {
      const scans = { ...machine.scans };
      const slot = !scans.scan1 ? 'scan1' : !scans.scan2 ? 'scan2' : 'scan3';
      updateData.scans = { ...scans, [slot]: { time, status: value, userId: user?.email } };
    }

    await updateDoc(doc(db, "machines", machineId), updateData);
    await addDoc(collection(db, "auditLogs"), {
      timestamp: time, 
      machineId, 
      userName: user?.name || user?.email,
      action: `Updated ${fieldName}`, 
      newStatus: value
    });
  };

  const updateSectionHeadcount = async (sectionId: string, amount: number) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const prevCount = section.headcount || 0;
    const newCount = Math.max(0, prevCount + amount);

    const sectionRef = doc(db, "sections", sectionId);
    await updateDoc(sectionRef, {
      headcount: newCount,
      headcountHistory: arrayUnion({
        date: new Date().toISOString(),
        prevCount,
        newCount,
        changedBy: user?.name || 'Admin',
      })
    });
  };

  const addMachine = async (data: any) => {
    const count = machines.filter(m => m.section === data.section && m.type === data.type).length;
    const newId = `${data.section}-${data.type}-${(count + 1).toString().padStart(3, '0')}`;
    await setDoc(doc(db, "machines", newId), {
      ...data, 
      id: newId, 
      status: 'IDLE', 
      operationalStatus: data.operationalStatus || 'WORKING',
      scans: {}, 
      lastUpdated: new Date().toISOString()
    });
  };

  const globalStartDay = async () => {
    const promises = machines.map(m => updateDoc(doc(db, "machines", m.id), {
      status: 'IDLE', scans: {}, lastUpdated: new Date().toISOString()
    }));
    await Promise.all(promises);
  };

  // Auth Synchronization Effect
  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        setUser({ ...firebaseUser, ...userDoc.data() });
      } else { setUser(null); }
      setLoading(false);
    });
  }, []);

  // Collection Synced Pipelines
  useEffect(() => {
    const unsubMachines = onSnapshot(collection(db, "machines"), (s) => setMachines(s.docs.map(d => ({ id: d.id, ...d.data() } as Machine))));
    const unsubSections = onSnapshot(collection(db, "sections"), (s) => setSections(s.docs.map(d => ({ id: d.id, ...d.data() } as Section))));
    const unsubTypes = onSnapshot(collection(db, "machineTypes"), (s) => setMachineTypes(s.docs.map(d => ({ id: d.id, ...d.data() } as MachineType))));
    const unsubSublocs = onSnapshot(collection(db, "sublocations"), (s) => setSublocations(s.docs.map(d => ({ id: d.id, ...d.data() } as Sublocation))));
    const unsubRows = onSnapshot(collection(db, "registeredRows"), (s) => setRegisteredRows(s.docs.map(d => ({ id: d.id, ...d.data() } as RegisteredRow)))); // NEW snapshot listener tracking link
    const qLogs = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
    const unsubLogs = onSnapshot(qLogs, (s) => setAuditLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog))));
    
    return () => { unsubMachines(); unsubSections(); unsubTypes(); unsubSublocs(); unsubRows(); unsubLogs(); };
  }, []);

  // Peripheral Interface Hardware Attachment Pipeline
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (isProcessing || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) buffer = '';
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length > 1) {
          const term = buffer.trim().toUpperCase();
          window.dispatchEvent(new CustomEvent('HARDWARE_BARCODE_SCANNED', { detail: term }));
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProcessing]);

  return (
    <AppContext.Provider value={{ 
      user, logout: () => signOut(auth), machines, sections, machineTypes, sublocations, registeredRows,
      addMachine, updateMachineStatus, deleteMachine: (id) => deleteDoc(doc(db, "machines", id)),
      addSection, deleteSection, addMachineType, deleteMachineType, updateSectionHeadcount,
      addSublocation, deleteSublocation, addRegisteredRow, deleteRegisteredRow, saveLayoutConfiguration,
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