import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Plus, Trash2, Settings2, Printer, Loader2, Layers, MapPin, 
  FileSpreadsheet, Download, FileText, Wrench, CalendarClock, 
  ArrowLeftRight, Search, QrCode 
} from 'lucide-react';
import Barcode from 'react-barcode';
import { Machine } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const NEEDLE_TYPES = ["DBx1", "DPx5", "DCx27", "TVx7", "UY128GAS", "TQx1"];


const OPERATIONAL_STATUS_OPTIONS = [
  { id: 'WORKING', label: 'Working', color: 'bg-green-500' },
  { id: 'HALF_WORKING', label: 'Half Working', color: 'bg-amber-500' },
  { id: 'BREAKDOWN', label: 'Breakdown', color: 'bg-red-500' },
  { id: 'REMOVED', label: 'Permanently Removed', color: 'bg-slate-900' },
];

export function MachineRegistry() {
  const { 
  machines = [], 
  sections = [], 
  machineTypes = [], 
  addMachine, 
  deleteMachine, 
  addSection, 
  deleteSection, 
  addMachineType, 
  deleteMachineType, 
  updateMachineStatus, // Use this if updateMachineTransfer is not defined in AppContext
  user 
} = useApp();

const [newSectionName, setNewSectionName] = useState('');
const [newTypeName, setNewTypeName] = useState('');
const [targetSectionForType, setTargetSectionForType] = useState('');
  // --- UI & MODAL STATES ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [showManageConfig, setShowManageConfig] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // --- FILTERING & SEARCH ---
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('ALL');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // --- ADD FORM STATES ---
  const [section, setSection] = useState('');
  const [type, setType] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [faNumber, setFaNumber] = useState('');
  const [modelNo, setModelNo] = useState('');
  const [dept, setDept] = useState('');
  const [needleSize, setNeedleSize] = useState('');
  const [needleType, setNeedleType] = useState('');
  const [location, setLocation] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [barcodeValue, setBarcodeValue] = useState('');
  const [machineValue, setMachineValue] = useState('');
  const [operationalStatus, setOperationalStatus] = useState('WORKING');
  const [ownership, setOwnership] = useState<'OWNED' | 'RENT'>('OWNED');
  const [rentedDate, setRentedDate] = useState('');
  const [rentedCompany, setRentedCompany] = useState('');
  const [inhouseGatepass, setInhouseGatepass] = useState('');

  // --- TRANSFER STATES ---
  const [transferTo, setTransferTo] = useState('');
  const [gatepassNo, setGatepassNo] = useState('');
  const [isFinishingRent, setIsFinishingRent] = useState(false);

  // --- CONFIG MODAL STATES (FIXED REFERENCE ERROR) ---

  const [sectionToDownload, setSectionToDownload] = useState('');

  // --- SEARCH LOGIC (ID, BARCODE, SECTION, PLANT) ---
  const filteredTableMachines = useMemo(() => {
    return machines.filter(m => {
      const matchesSection = selectedSectionFilter === 'ALL' || m.section === selectedSectionFilter;
      const matchesLocation = selectedLocationFilter === 'ALL' || (m as any).location === selectedLocationFilter;
      const matchesSearch = searchQuery === '' || 
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (m as any).barcodeValue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m as any).location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSection && matchesLocation && matchesSearch;
    });
  }, [machines, selectedSectionFilter, selectedLocationFilter, searchQuery]);

  const availableTypesForSelectedSection = useMemo(() => machineTypes.filter(t => t.sectionId === section), [section, machineTypes]);
  const needsNeedleInfo = useMemo(() => type.toUpperCase().includes('SEWING') || type.toUpperCase().includes('SNLS'), [type]);

  // --- PRINTING ENGINE (FIXED ASYNC LOGIC) ---
  const fetchActiveCanvas = async (id: string): Promise<string | null> => {
    const container = document.getElementById(`barcode-render-${id}`);
    if (!container) return null;
    
    for (let i = 0; i < 20; i++) {
      const canvas = container.querySelector('canvas');
      if (canvas && canvas.width > 10) return canvas.toDataURL("image/png", 1.0);
      await new Promise(r => setTimeout(r, 150));
    }
    return null;
  };

  const downloadBarcodes = async (machineList: any[], label: string) => {
    if (machineList.length === 0) return alert("No machines found.");
    setIsGenerating(true);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [50, 30] });
    
    let pageCount = 0;
    for (const machine of machineList) {
      const imgData = await fetchActiveCanvas(machine.id);
      if (imgData) {
        if (pageCount > 0) doc.addPage([50, 30], 'landscape');
        doc.addImage(imgData, 'PNG', 5, 2, 40, 15);
        doc.setFontSize(10); doc.text(machine.id, 25, 22, { align: 'center' });
        doc.setFontSize(7); doc.text(`${sections.find(s => s.id === machine.section)?.name || 'Sec'} | ${machine.type}`, 25, 26, { align: 'center' });
        pageCount++;
      }
    }
    if (pageCount > 0) doc.save(`${label}_Barcodes.pdf`);
    setIsGenerating(false);
  };

  // --- EXCEL & PDF REPORTS ---
  const downloadInventoryExcel = () => {
    const dataToExport = filteredTableMachines.map(m => ({
      'Machine ID': m.id,
      'Operational Status': (m as any).operationalStatus || 'WORKING', 
      'Ownership': (m as any).ownership || 'OWNED',
      'Rented Company': (m as any).rentedCompany || 'N/A',
      'Inhouse Gatepass': (m as any).inhouseGatepass || 'N/A',
      'Current Activity': m.status || 'IDLE',
      'Location': (m as any).location || 'N/A',
      'Asset Value': (m as any).machineValue || '0',
      'Section': sections.find(s => s.id === m.section)?.name || m.section,
      'Machine Type': m.type,
      'Machine Name': m.name,
      'Brand': (m as any).brand || 'N/A',
      'Serial Number': (m as any).serialNo || 'N/A',
      'FA Number': (m as any).faNumber || 'N/A',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [["Eskimo Fashions (Pvt) Ltd machine inventory report"], [`Export Date: ${new Date().toLocaleDateString()}`]], { origin: "A1" });
    XLSX.utils.sheet_add_json(ws, dataToExport, { origin: "A4", skipHeader: false });
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadTransferHistoryPDF = (machine: any) => {
    const doc = new jsPDF();
    doc.text(`Transfer History: ${machine.id}`, 14, 15);
    const tableData = (machine.transferHistory || []).map((h: any) => [
      new Date(h.date).toLocaleString(),
      h.from,
      h.to,
      h.gatepass,
      h.byWho,
      h.type
    ]);
    autoTable(doc, {
      head: [['Date', 'From', 'To', 'Gatepass #', 'Authorized By', 'Type']],
      body: tableData,
      startY: 20
    });
    doc.save(`History_${machine.id}.pdf`);
  };

  // --- ACTION HANDLERS ---
  const handleTransferSubmit = async () => {
        if (!gatepassNo.trim()) return alert("Gatepass Number is mandatory!");
        if (!isFinishingRent && !transferTo) return alert("Please select a destination location!");

        // 1. Create the detailed record for the Machine's History
        const newRecord = {
          date: new Date().toISOString(),
          from: selectedMachine.location || 'INITIAL REG',
          to: isFinishingRent ? 'VENDOR RETURNED' : transferTo,
          byWho: user?.name || 'Authorized Admin',
          gatepass: gatepassNo,
          type: isFinishingRent ? 'RENT_FINISHED' : 'TRANSFER'
        };

        try {
          // 2. Prepare the updated history array
          const updatedHistory = [...(selectedMachine.transferHistory || []), newRecord];

          // 3. Update the Machine History (Silent update - no audit log)
          // Note: If your updateMachineStatus always logs to audit, 
          // we use a specific audit string for the second call.
          await updateMachineStatus(selectedMachine.id, updatedHistory, 'transferHistory');

          // 4. Create a readable STRING for the Audit Report (Prevents the "Object" crash)
          const auditMessage = isFinishingRent 
            ? `RENT FINISHED (GP: ${gatepassNo})` 
            : `TRANSFERRED TO ${transferTo} (GP: ${gatepassNo})`;

          // 5. Update Location and trigger the Audit Log with the String message
          await updateMachineStatus(selectedMachine.id, newRecord.to, 'location');
          await updateMachineStatus(selectedMachine.id, auditMessage, 'status'); 
          
          if (isFinishingRent) {
            await updateMachineStatus(selectedMachine.id, 'REMOVED', 'operationalStatus');
          }
          
          // Reset UI
          setShowTransferForm(false);
          setGatepassNo('');
          setTransferTo('');
          setIsFinishingRent(false);
          alert("Machine transfer successfully logged!");
        } catch (err) {
          console.error("Transfer Error:", err);
          alert("Could not save transfer. Please check connection.");
        }
      };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // 1. Prepare the standard machine data object
      await addMachine({ 
        section,
        type,
        brand,
        purchaseDate,
        serialNo,
        faNumber,
        modelNo,
        dept,
        name,
        status: 'IDLE',
        operationalStatus,
        location,
        companyId,
        barcodeValue,
        machineValue,
        ownership,
        
        // 2. Logic to handle Rented vs Owned specific data
        rentedDate: ownership === 'RENT' ? rentedDate : '',
        rentedCompany: ownership === 'RENT' ? rentedCompany : 'N/A',
        inhouseGatepass: ownership === 'RENT' ? inhouseGatepass : 'N/A',
        
        // 3. Initialize history and needle info
        transferHistory: [], // Crucial: Initialize as empty to prevent "ReferenceError" later
        needleSize: needsNeedleInfo ? needleSize : 'N/A',
        needleType: needsNeedleInfo ? needleType : 'N/A'
      });

      // 4. Reset all form fields to empty states
      setSection(''); setType(''); setBrand(''); setPurchaseDate('');
      setSerialNo(''); setFaNumber(''); setModelNo(''); setDept('');
      setName(''); setNeedleSize(''); setNeedleType(''); setLocation('');
      setCompanyId(''); setBarcodeValue(''); setMachineValue('');
      setOperationalStatus('WORKING'); setOwnership('OWNED'); setRentedDate('');
      setRentedCompany(''); setInhouseGatepass('');
      
      setShowAddForm(false);
    };

  return (
    <div className="p-4 space-y-6">
      <div style={{ position: 'fixed', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
        {machines.map(m => (
          <div key={`render-${m.id}`} id={`barcode-render-${m.id}`} style={{ padding: '20px' }}>
            <Barcode value={m.id.replace(/\s/g, '')} renderer="canvas" width={2} height={60} displayValue={false} />
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Machine Registry</h1>
          <p className="text-slate-500 font-medium tracking-tighter">Asset & Health Management</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border shadow-sm">
            <Search className="w-4 h-4 text-blue-500" />
            <Input 
              placeholder="Search ID, Barcode, Plant..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-none shadow-none text-xs w-48 font-bold uppercase"
            />
            <QrCode className="w-4 h-4 text-slate-300" />
          </div>

          <Card className="flex items-center gap-2 bg-blue-50 p-2 border-blue-200">
             <Printer className="w-4 h-4 text-blue-600" />
             <Select value={sectionToDownload} onValueChange={setSectionToDownload}>
                <SelectTrigger className="w-40 h-8 font-bold text-[10px] uppercase bg-white">
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
             </Select>
             <Button 
               size="sm" 
               className="h-8 bg-blue-600 text-[10px] font-black"
               disabled={!sectionToDownload || isGenerating}
               onClick={() => downloadBarcodes(machines.filter(m => m.section === sectionToDownload), `Section_${sectionToDownload}`)}
             >
               {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'PRINT SECTION'}
             </Button>
          </Card>

          <Button variant="outline" className="bg-green-50 text-green-700 border-green-200" onClick={downloadInventoryExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button variant="outline" onClick={() => setShowManageConfig(true)}><Settings2 className="w-4 h-4 mr-2" /> Config</Button>
          <Button onClick={() => setShowAddForm(true)} className="bg-blue-600 font-bold"><Plus className="w-4 h-4 mr-2" /> Add Machine</Button>
        </div>
      </div>

      <Card className="shadow-md overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold text-[11px] uppercase">ID / Health</TableHead>
              <TableHead className="font-bold text-[11px] uppercase">Machine Details</TableHead>
              <TableHead className="font-bold text-[11px] uppercase">Section</TableHead>
              <TableHead className="font-bold text-[11px] uppercase text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTableMachines.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="font-mono font-bold text-blue-700 text-xs">{m.id}</div>
                  <div className={`mt-1 px-2 py-0.5 rounded text-[8px] font-black text-white w-fit uppercase ${
                    OPERATIONAL_STATUS_OPTIONS.find(o => o.id === (m as any).operationalStatus)?.color || 'bg-green-500'
                  }`}>
                    {(m as any).operationalStatus || 'WORKING'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-bold uppercase text-xs">{m.name}</div>
                  <div className="text-[10px] text-slate-500">{(m as any).location} | <span className="font-bold">{(m as any).ownership || 'OWNED'}</span></div>
                </TableCell>
                <TableCell>
                  <div className="text-xs font-bold">{sections.find(s => s.id === m.section)?.name}</div>
                  <div className="text-[10px] text-slate-400">{m.type}</div>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => downloadBarcodes([m], `Machine_${m.id}`)} title="Print Barcode"><Printer className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => downloadTransferHistoryPDF(m)} title="Transfer History"><FileText className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" className="border-blue-200" onClick={() => { setSelectedMachine(m); setShowTransferForm(true); }}>
                      <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMachine(m.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* TRANSFER TERMINAL */}
      <Dialog open={showTransferForm} onOpenChange={setShowTransferForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase font-black text-blue-600">Transfer terminal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
              <Label className="text-xs font-black uppercase text-orange-600">Finish Rent Contract?</Label>
              <input type="checkbox" className="w-5 h-5" checked={isFinishingRent} onChange={(e) => setIsFinishingRent(e.target.checked)} />
            </div>
            {!isFinishingRent && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">New Location</Label>
                <Select value={transferTo} onValueChange={setTransferTo}>
                  <SelectTrigger><SelectValue placeholder="Select Destination" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Negombo">Negombo</SelectItem>
                    <SelectItem value="Pallekale">Pallekale</SelectItem>
                    <SelectItem value="Punani">Punani</SelectItem>
                    <SelectItem value="Bungalow">Bungalow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 bg-red-50 p-4 rounded-xl border border-red-100">
              <Label className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2"><QrCode size={14} /> Mandatory Gatepass Number</Label>
              <Input placeholder="Enter GP NO..." className="bg-white" value={gatepassNo} onChange={e => setGatepassNo(e.target.value)} />
            </div>
            <Button className="w-full bg-blue-600 h-14 font-black uppercase" onClick={handleTransferSubmit}>
              {isFinishingRent ? 'Terminate Rent' : 'Confirm Transfer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD MACHINE DIALOG */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Factory Asset</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            
            {/* Health Status */}
            <div className="space-y-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <Label className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2">
                <Wrench size={14} /> Health Status
              </Label>
              <Select value={operationalStatus} onValueChange={setOperationalStatus}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATIONAL_STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ownership Selection & Conditional Rented Fields */}
            <div className="space-y-4 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-orange-600">Ownership Type</Label>
                  <Select value={ownership} onValueChange={(val: any) => setOwnership(val)}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNED">Company Owned</SelectItem>
                      <SelectItem value="RENT">Rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {ownership === 'RENT' && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-left-1">
                    <Label className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-2">
                      <CalendarClock size={12}/> Rented Date
                    </Label>
                    <Input type="date" value={rentedDate} onChange={e => setRentedDate(e.target.value)} required />
                  </div>
                )}
              </div>

              {/* NEW: Conditional Rented Company & Gatepass - Only appears if Ownership is RENT */}
              {ownership === 'RENT' && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-orange-200/50 animate-in zoom-in-95">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-blue-600">Rented Company</Label>
                    <Input 
                      placeholder="Vendor Name" 
                      value={rentedCompany} 
                      onChange={e => setRentedCompany(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-blue-600">Initial Gatepass</Label>
                    <Input 
                      placeholder="GP Number" 
                      value={inhouseGatepass} 
                      onChange={e => setInhouseGatepass(e.target.value)} 
                      required 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Location and Company */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2">
                  <MapPin size={12}/> Location
                </Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bungalow">Bungalow</SelectItem>
                    <SelectItem value="Negombo">Negombo</SelectItem>
                    <SelectItem value="Pallekale">Pallekale</SelectItem>
                    <SelectItem value="Punani">Punani</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-blue-600">Company ID</Label>
                <Input placeholder="Enter ID" value={companyId} onChange={e => setCompanyId(e.target.value)} />
              </div>
            </div>

            {/* Barcode and Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-slate-400">Barcode Value</Label>
                <Input placeholder="Scan/Enter" value={barcodeValue} onChange={e => setBarcodeValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-slate-400">Machine Value</Label>
                <Input placeholder="Asset Value" value={machineValue} onChange={e => setMachineValue(e.target.value)} />
              </div>
            </div>

            {/* Section and Type */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black">Section</Label>
                <Select value={section} onValueChange={(val) => { setSection(val); setType(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black">Machine Type</Label>
                <Select value={type} onValueChange={setType} disabled={!section}>
                  <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    {availableTypesForSelectedSection.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Name, Brand, Serial, FA */}
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
              <Input placeholder="Brand" value={brand} onChange={e => setBrand(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Serial No" value={serialNo} onChange={e => setSerialNo(e.target.value)} required />
              <Input placeholder="FA Number" value={faNumber} onChange={e => setFaNumber(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
              <Input placeholder="Model No" value={modelNo} onChange={e => setModelNo(e.target.value)} required />
            </div>

            {/* Needle Info (Conditional) */}
            {needsNeedleInfo && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-blue-600 uppercase">Needle Size</Label>
                  <Input placeholder="14/90" value={needleSize} onChange={e => setNeedleSize(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-blue-600 uppercase">Needle Type</Label>
                  <Select value={needleType} onValueChange={setNeedleType}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {NEEDLE_TYPES.map(nt => <SelectItem key={nt} value={nt}>{nt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Input placeholder="Department" value={dept} onChange={e => setDept(e.target.value)} required />
            
            <Button type="submit" className="w-full bg-blue-600 h-14 font-black uppercase shadow-lg hover:bg-blue-700 transition-all">
              Complete Registration
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIGURATION DIALOG */}
      <Dialog open={showManageConfig} onOpenChange={setShowManageConfig}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Structure Configuration</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            <div className="space-y-4">
              <h3 className="text-sm font-bold border-b pb-2">Sections</h3>
              <div className="flex gap-2">
                {/* Inside the Configuration Dialog */}
                <Input 
                  placeholder="e.g. A" 
                  value={newSectionName} 
                  onChange={e => setNewSectionName(e.target.value)} 
                />
                <Button size="sm" onClick={() => { if(newSectionName) { addSection(newSectionName); setNewSectionName(''); }}}>Add</Button>
              </div>
              <div className="space-y-1">
                {sections.map(s => (
                  <div key={s.id} className="flex justify-between items-center bg-slate-50 p-2 rounded text-sm">
                    <span>{s.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteSection(s.id)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-bold border-b pb-2">Machine Types</h3>
              <Select value={targetSectionForType} onValueChange={setTargetSectionForType}>
                <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input placeholder="e.g. CNC" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} />
                <Button size="sm" onClick={() => { if(newTypeName && targetSectionForType) { addMachineType(newTypeName, targetSectionForType); setNewTypeName(''); }}}>Add</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}