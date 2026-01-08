// Types for the Factory Machine Monitoring System

export type MachineStatus = 'RUNNING' | 'IDLE' | 'NOT_WORKING';

export interface Machine {
  id: string; // Format: SECTION-TYPE-001
  section: string;
  type: string;
  modelNo: string;
  dept: string;
  name: string;
  notes?: string;
  status: MachineStatus;
  scans: {
    scan1?: { time: string; status: MachineStatus; userId: string };
    scan2?: { time: string; status: MachineStatus; userId: string };
    scan3?: { time: string; status: MachineStatus; userId: string };
  };
  lastUpdated: string;
  isNotWorking?: boolean; // Persists "Not Working" state
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  machineId: string;
  action: string;
  oldStatus?: MachineStatus;
  newStatus: MachineStatus;
}

export type ScanMode = 'CAMERA' | 'BLUETOOTH';

export interface DashboardFilters {
  section: string;
  machineType: string;
  dateFilter: 'daily' | 'monthly';
  shiftTime: string;
}
