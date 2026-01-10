import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, Trash2, Settings2, Printer, Loader2, FileDown, Layers, MapPin, FileSpreadsheet } from 'lucide-react';
import Barcode from 'react-barcode';
import { Machine } from '../types';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const NEEDLE_TYPES = ["DBx1", "DPx5", "DCx27", "TVx7", "UY128GAS", "TQx1"];

export function MachineRegistry() {
  const { machines = [], sections = [], machineTypes = [], addMachine, deleteMachine, addSection, deleteSection, addMachineType, deleteMachineType } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showManageConfig, setShowManageConfig] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Filtering State
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('ALL');

  // Form States
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

  const [newSectionName, setNewSectionName] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [targetSectionForType, setTargetSectionForType] = useState('');

  // Computed Values for filtering the table view
  const filteredTableMachines = useMemo(() => {
    if (selectedSectionFilter === 'ALL') return machines;
    return machines.filter(m => m.section === selectedSectionFilter);
  }, [machines, selectedSectionFilter]);

  const availableTypesForSelectedSection = useMemo(() => machineTypes.filter(t => t.sectionId === section), [section, machineTypes]);
  const needsNeedleInfo = useMemo(() => type.toUpperCase().includes('SEWING') || type.toUpperCase().includes('SNLS'), [type]);

  // --- EXCEL EXPORT LOGIC ---
  const downloadInventoryExcel = () => {
    // Determine which machines to export (respect current filter)
    const dataToExport = filteredTableMachines.map(m => ({
      'Machine ID': m.id,
      'Location': (m as any).location || 'N/A',
      'Company ID': (m as any).companyId || 'N/A',
      'Barcode Value': (m as any).barcodeValue || 'N/A',
      'Asset Value': (m as any).machineValue || '0',
      'Section': sections.find(s => s.id === m.section)?.name || m.section,
      'Machine Type': m.type,
      'Machine Name': m.name,
      'Brand': (m as any).brand || 'N/A',
      'Model Number': (m as any).modelNo || 'N/A',
      'Serial Number': (m as any).serialNo || 'N/A',
      'FA Number': (m as any).faNumber || 'N/A',
      'Purchasing Date': (m as any).purchaseDate || 'N/A',
      'Department': (m as any).dept || 'N/A',
      'Needle Size': (m as any).needleSize || 'N/A',
      'Needle Type': (m as any).needleType || 'N/A',
      'Current Status': m.status
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);

    // Add professional Heading and Metadata
    XLSX.utils.sheet_add_aoa(ws, [
      ["Eskimo Fashions (Pvt) Ltd machine inventory report"],
      [`Export Date: ${new Date().toLocaleDateString()}`],
      [`Filter: ${selectedSectionFilter === 'ALL' ? 'All Sections' : sections.find(s => s.id === selectedSectionFilter)?.name}`],
      [] // Spacer row
    ], { origin: "A1" });

    // Add the actual data starting from Row 5
    XLSX.utils.sheet_add_json(ws, dataToExport, { origin: "A5", skipHeader: false });

    // Set column widths for readability
    const wscols = Array(17).fill({ wch: 20 });
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Eskimo_Inventory_${selectedSectionFilter}.xlsx`);
  };

  // --- ROBUST CANVAS FETCH LOGIC ---
  const fetchActiveCanvas = async (id: string): Promise<string | null> => {
    const container = document.getElementById(`barcode-render-${id}`);
    if (!container) return null;
    container.scrollIntoView(); 
    for (let i = 0; i < 20; i++) {
      const canvas = container.querySelector('canvas');
      if (canvas && canvas.width > 10) return canvas.toDataURL("image/png", 1.0);
      await new Promise(r => setTimeout(r, 100));
    }
    return null;
  };

  const downloadSectionBarcodes = async (sectionId: string) => {
    const sectionMachines = machines.filter(m => m.section === sectionId);
    if (sectionMachines.length === 0) return alert("No machines found.");
    setIsGenerating(true);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [50, 30] });
    const sectionObj = sections.find(s => s.id === sectionId);

    let pageCount = 0;
    for (const machine of sectionMachines) {
      const imgData = await fetchActiveCanvas(machine.id);
      if (imgData) {
        if (pageCount > 0) doc.addPage([50, 30], 'landscape');
        doc.addImage(imgData, 'PNG', 5, 2, 40, 15);
        doc.setFontSize(10);
        doc.text(machine.id, 25, 22, { align: 'center' });
        doc.setFontSize(7);
        doc.text(`${sectionObj?.name || 'Sec'} | ${machine.type}`, 25, 26, { align: 'center' });
        pageCount++;
      }
    }
    if (pageCount > 0) doc.save(`Section_${sectionObj?.name}.pdf`);
    setIsGenerating(false);
  };

  const downloadAllBarcodes = async () => {
    setIsGenerating(true);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [50, 30] });
    let pageCount = 0;
    for (const machine of machines) {
      const imgData = await fetchActiveCanvas(machine.id);
      if (imgData) {
        if (pageCount > 0) doc.addPage([50, 30], 'landscape');
        doc.addImage(imgData, 'PNG', 5, 2, 40, 15);
        doc.setFontSize(10);
        doc.text(machine.id, 25, 22, { align: 'center' });
        doc.setFontSize(7);
        doc.text(`${machine.section} | ${machine.type}`, 25, 26, { align: 'center' });
        pageCount++;
      }
    }
    doc.save(`All_Factory_Barcodes.pdf`);
    setIsGenerating(false);
  };

  const generateSingleBarcodePDF = async (machine: Machine) => {
    setIsGenerating(true);
    const imgData = await fetchActiveCanvas(machine.id);
    if (imgData) {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [50, 30] });
      doc.addImage(imgData, 'PNG', 5, 2, 40, 15);
      doc.setFontSize(10);
      doc.text(machine.id, 25, 22, { align: 'center' });
      doc.setFontSize(7);
      const sectionName = sections.find(s => s.id === machine.section)?.name || machine.section;
      doc.text(`${sectionName} | ${machine.type}`, 25, 26, { align: 'center' });
      doc.save(`Barcode_${machine.id}.pdf`);
    }
    setIsGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addMachine({ 
      section, type, brand, purchaseDate, serialNo, faNumber, modelNo, dept, name, 
      status: 'IDLE', location, companyId, barcodeValue, machineValue,
      needleSize: needsNeedleInfo ? needleSize : 'N/A',
      needleType: needsNeedleInfo ? needleType : 'N/A'
    });
    setSection(''); setType(''); setBrand(''); setPurchaseDate(''); setSerialNo(''); 
    setFaNumber(''); setModelNo(''); setDept(''); setName(''); setNeedleSize(''); 
    setNeedleType(''); setLocation(''); setCompanyId(''); setBarcodeValue(''); setMachineValue('');
    setShowAddForm(false);
  };

  return (
    <div className="p-4 space-y-6">
      {/* HIDDEN RENDER PORTAL */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0, zIndex: -1, overflow: 'auto' }}>
        {machines.map(m => (
          <div key={`render-${m.id}-${m.lastUpdated || 'v1'}`} id={`barcode-render-${m.id}`} style={{ padding: '20px' }}>
            <Barcode value={m.id.replace(/\s/g, '')} renderer="canvas" width={2} height={60} displayValue={false} />
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Machine Registry</h1>
          <p className="text-slate-500 font-medium">Professional Asset Management</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* SECTION FILTER DROPDOWN */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border mr-2">
            <Layers className="w-4 h-4 ml-2 text-slate-400" />
            <Select value={selectedSectionFilter} onValueChange={setSelectedSectionFilter}>
              <SelectTrigger className="w-40 border-none bg-transparent shadow-none font-bold text-xs uppercase">
                <SelectValue placeholder="All Sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sections</SelectItem>
                {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100" onClick={downloadInventoryExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
          </Button>

          {isGenerating ? (
             <Button disabled className="bg-slate-800"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering...</Button>
          ) : (
            <Select onValueChange={downloadSectionBarcodes}>
              <SelectTrigger className="w-40 font-bold uppercase text-xs border-blue-200"><SelectValue placeholder="Print Barcodes" /></SelectTrigger>
              <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          
          <Button variant="outline" onClick={() => setShowManageConfig(true)}><Settings2 className="w-4 h-4 mr-2" /> Config</Button>
          <Button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700 font-bold"><Plus className="w-4 h-4 mr-2" /> Add Machine</Button>
        </div>
      </div>

      <Card className="shadow-md border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold text-[11px] uppercase">ID / FA NO</TableHead>
                <TableHead className="font-bold text-[11px] uppercase">Machine Details</TableHead>
                <TableHead className="font-bold text-[11px] uppercase">Section</TableHead>
                <TableHead className="font-bold text-[11px] uppercase">Registration</TableHead>
                <TableHead className="text-right font-bold pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTableMachines.map((machine) => (
                <TableRow key={machine.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="font-mono font-bold text-blue-700 uppercase text-xs">{machine.id}</div>
                    <div className="text-[10px] text-slate-400 font-bold">FA: {(machine as any).faNumber}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold uppercase text-xs">{machine.name}</div>
                    <div className="text-[10px] text-slate-500">{(machine as any).brand} | {machine.modelNo}</div>
                    <div className="text-[10px] text-blue-600 font-semibold flex items-center gap-1"><MapPin size={10} /> {(machine as any).location}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-bold text-slate-600">{sections.find(s => s.id === machine.section)?.name || machine.section}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{machine.type}</div>
                  </TableCell>
                  <TableCell>
                     <div className="text-xs font-medium">Purchased: {(machine as any).purchaseDate || 'N/A'}</div>
                     <div className="text-[10px] text-slate-400 font-mono">SN: {(machine as any).serialNo}</div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => generateSingleBarcodePDF(machine)}><Printer className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMachine(machine.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredTableMachines.length === 0 && (
            <div className="p-8 text-center text-slate-400 font-medium italic">No machines found for the selected section filter.</div>
          )}
        </CardContent>
      </Card>

      {/* Registration and Config Dialogs remain the same as previous functional version */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold uppercase">Register Factory Asset</DialogTitle>
            <DialogDescription className="hidden">Form to register a new machine asset</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* ... Form content ... */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-blue-600">Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select Location" /></SelectTrigger>
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
                <Input placeholder="Enter Company ID" value={companyId} onChange={e => setCompanyId(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Barcode Value</Label>
                <Input placeholder="Scan/Enter Barcode" value={barcodeValue} onChange={e => setBarcodeValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Machine Value</Label>
                <Input placeholder="Asset Value" value={machineValue} onChange={e => setMachineValue(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Section</Label>
                <Select value={section} onValueChange={(val) => { setSection(val); setType(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Machine Type</Label>
                <Select value={type} onValueChange={setType} disabled={!section}>
                  <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>{availableTypesForSelectedSection.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Machine Name" value={name} onChange={e => setName(e.target.value)} required />
              <Input placeholder="Brand" value={brand} onChange={e => setBrand(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Serial No" value={serialNo} onChange={e => setSerialNo(e.target.value)} required />
              <Input placeholder="FA Number" value={faNumber} onChange={e => setFaNumber(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
              <Input placeholder="Model Number" value={modelNo} onChange={e => setModelNo(e.target.value)} required />
            </div>
            {needsNeedleInfo && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-blue-600 uppercase">Needle Size</Label>
                  <Input placeholder="e.g. 14/90" value={needleSize} onChange={e => setNeedleSize(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-blue-600 uppercase">Needle Type</Label>
                  <Select value={needleType} onValueChange={setNeedleType}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{NEEDLE_TYPES.map(nt => <SelectItem key={nt} value={nt}>{nt}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <Input placeholder="Department" value={dept} onChange={e => setDept(e.target.value)} required />
            <Button type="submit" className="w-full bg-blue-600 h-14 text-lg font-black uppercase" disabled={!type}>Complete Registration</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showManageConfig} onOpenChange={setShowManageConfig}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Structure Configuration</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            <div className="space-y-4">
              <h3 className="text-sm font-bold border-b pb-2">Sections</h3>
              <div className="flex gap-2">
                <Input placeholder="e.g. A" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} />
                <Button size="sm" onClick={() => { addSection(newSectionName); setNewSectionName(''); }}>Add</Button>
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
                <Button size="sm" onClick={() => { addMachineType(newTypeName, targetSectionForType); setNewTypeName(''); }}>Add</Button>
              </div>
              <div className="space-y-1">
                {machineTypes.filter(t => t.sectionId === targetSectionForType).map(t => (
                  <div key={t.id} className="flex justify-between items-center bg-blue-50 p-2 rounded text-sm">
                    <span>{t.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteMachineType(t.id)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}