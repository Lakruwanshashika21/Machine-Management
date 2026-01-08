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
  updateMachineStatus: (machineId: string, status: string) => Promise<void>;
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

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        setUser({ ...firebaseUser, ...userDoc.data() });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  // Real-time Database Listeners
  useEffect(() => {
    const unsubMachines = onSnapshot(collection(db, "machines"), (s) => 
      setMachines(s.docs.map(d => ({ id: d.id, ...d.data() } as Machine))));
    
    const unsubSections = onSnapshot(collection(db, "sections"), (s) => 
      setSections(s.docs.map(d => ({ id: d.id, ...d.data() } as Section))));
    
    const unsubTypes = onSnapshot(collection(db, "machineTypes"), (s) => 
      setMachineTypes(s.docs.map(d => ({ id: d.id, ...d.data() } as MachineType))));

    const qLogs = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
    const unsubLogs = onSnapshot(qLogs, (s) => 
      setAuditLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog))));

    return () => { unsubMachines(); unsubSections(); unsubTypes(); unsubLogs(); };
  }, []);

  // Handlers for Sections and Types
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

  const addMachine = async (data: any) => {
    const count = machines.filter(m => m.section === data.section && m.type === data.type).length;
    const newId = `${data.section}-${data.type}-${(count + 1).toString().padStart(3, '0')}`;
    
    await setDoc(doc(db, "machines", newId), {
      ...data,
      id: newId,
      status: 'IDLE',
      scans: {},
      lastUpdated: new Date().toISOString()
    });
  };

  const updateMachineStatus = async (machineId: string, status: string) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;

    const time = new Date().toISOString();
    const scans = { ...machine.scans };
    const slot = !scans.scan1 ? 'scan1' : !scans.scan2 ? 'scan2' : 'scan3';

    const updatedScans = {
      ...scans,
      [slot]: { time, status: status === 'NOT_WORKING' ? 'NA' : status, userId: user?.email }
    };

    await updateDoc(doc(db, "machines", machineId), {
      status,
      scans: updatedScans,
      lastUpdated: time
    });

    await addDoc(collection(db, "auditLogs"), {
      timestamp: time,
      machineId,
      userName: user?.name || user?.email,
      action: `Scanned slot ${slot}`,
      newStatus: status
    });
  };

  const globalStartDay = async () => {
    const promises = machines.map(m => {
      const nextStatus = m.status === 'NOT_WORKING' ? 'NOT_WORKING' : 'IDLE';
      return updateDoc(doc(db, "machines", m.id), {
        status: nextStatus,
        scans: {},
        lastUpdated: new Date().toISOString()
      });
    });
    await Promise.all(promises);
  };

  return (
    <AppContext.Provider value={{ 
      user, logout: () => signOut(auth), machines, sections, machineTypes,
      addMachine, updateMachineStatus, deleteMachine: (id) => deleteDoc(doc(db, "machines", id)),
      addSection, deleteSection, addMachineType, deleteMachineType,
      scanMode, setScanMode, auditLogs, globalStartDay, loading 
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