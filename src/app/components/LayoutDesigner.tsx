import { useState, useEffect, useMemo } from 'react';
import { useApp, LayoutSession } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Layers, Play, CheckCircle2, RotateCcw, FileText, Printer, Trash2, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../firebase';
import { doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export function LayoutDesigner() {
  const { 
    sections = [], 
    sublocations = [], 
    machines = [], 
    registeredRows = [], 
    addSublocation, 
    deleteSublocation,
    addRegisteredRow,
    deleteRegisteredRow,
    saveLayoutConfiguration 
  } = useApp();

  // 1. FREE-TYPE REGISTRATION STATES
  const [regMainSection, setRegMainSection] = useState('');
  const [regSublocationText, setRegSublocationText] = useState('');
  const [regRowText, setRegRowText] = useState('');

  // 2. ACTIVE MATRIX SELECTION FILTERS STATES
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSublocation, setSelectedSublocation] = useState('');
  const [selectedRow, setSelectedRow] = useState('');

  // 3. WORKFLOW RUNTIME STATES
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [scannedSequenceList, setScannedSequenceList] = useState<Array<any>>([]);
  const [viewFilterSection, setViewFilterSection] = useState('ALL');

  // --- FILTER CASCADE INTERCEPTIONS ---
  const filteredSublocationsList = useMemo(() => {
    if (!regMainSection) return [];
    return sublocations.filter(s => s.sectionId === regMainSection);
  }, [sublocations, regMainSection]);

  const filteredSublocationsDropdown = useMemo(() => {
    if (!selectedSection) return [];
    return sublocations.filter(s => s.sectionId === selectedSection);
  }, [sublocations, selectedSection]);

  const filteredRowsList = useMemo(() => {
    if (!selectedSublocation) return [];
    return registeredRows.filter(r => r.sublocationId === selectedSublocation);
  }, [registeredRows, selectedSublocation]);

  // Intercept data streams from connected hardware scanner inputs dynamically
  useEffect(() => {
    const handleHardwareScan = (e: Event) => {
      if (!isSessionActive) return;
      const scannedCode = (e as CustomEvent).detail;
      processAutomatedGridMapping(scannedCode);
    };

    window.addEventListener('HARDWARE_BARCODE_SCANNED', handleHardwareScan);
    return () => window.removeEventListener('HARDWARE_BARCODE_SCANNED', handleHardwareScan);
  }, [isSessionActive, scannedSequenceList]);

  // --- FIXED BARCODE GENERATION ENGINE ---
  const downloadSingleBarcode = (title: string, valueId: string) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [60, 40] });
      
      doc.setFillColor(30, 41, 59);
      doc.rect(2, 2, 56, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("PRO-SCAN SYSTEM LAYOUT REF", 30, 6, { align: 'center' });
      
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text(title.toUpperCase(), 30, 18, { align: 'center' });
      
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.5);
      doc.line(10, 22, 50, 22);
      
      doc.setFont("Courier", "bold");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(`*${valueId.replace(/\s+/g, '')}*`, 30, 28, { align: 'center' });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
      doc.text("SCAN TO POSITION POSITION ARRAY INDEX MATRIX", 30, 35, { align: 'center' });
      
      doc.save(`Barcode_${valueId}.pdf`);
      toast.success("Barcode generated successfully!");
    } catch {
      toast.error("Failed to generate PDF document layout asset streams.");
    }
  };

  // --- SUB-METADATA ACTION ROUTERS ---
  const handleRegisterSublocation = async () => {
    if (!regMainSection || !regSublocationText.trim()) {
      return toast.error("Please choose a main section and type a sublocation name!");
    }
    try {
      await addSublocation(regMainSection, regSublocationText.trim());
      toast.success(`Sublocation registered under ${regMainSection}!`);
      setRegSublocationText('');
    } catch {
      toast.error("Database connection refused write parameters transaction step context.");
    }
  };

  const handleRegisterRowNumber = async () => {
    if (!selectedSection || !selectedSublocation || !regRowText.trim()) {
      return toast.error("Select Main Section & Sublocation context from Panel B first!");
    }
    try {
      const rowNameInput = regRowText.trim().toUpperCase();
      await addRegisteredRow(selectedSection, selectedSublocation, rowNameInput);
      toast.success(`Row ${rowNameInput} successfully initialized in layout scope.`);
      setRegRowText('');
    } catch {
      toast.error("Database write error saving row line profile definitions.");
    }
  };

  // --- CASCADED DELETIONS IMPLEMENTATION ENGINE ---
  const handleDeleteSublocation = async (sublocationId: string, sublocationName: string) => {
    const confirmMessage = `WARNING: Deleting sublocation "${sublocationName}" will clear all matching row components and machine positions in this zone. Proceed?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const batch = writeBatch(db);
      
      machines.filter(m => (m as any).sublocationId === sublocationId).forEach(m => {
        batch.update(doc(db, "machines", m.id), {
          sublocationId: null, rowNumber: null, rowIndex: null,
          layoutConfiguredAt: null, layoutConfiguredBy: null
        });
      });

      registeredRows.filter(r => r.sublocationId === sublocationId).forEach(r => {
        batch.delete(doc(db, "registeredRows", r.id));
      });

      await batch.commit();
      await deleteSublocation(sublocationId);
      toast.success("Sublocation zone metrics safely decoupled from factory grid.");
      
      if (selectedSublocation === sublocationId) {
        setSelectedSublocation('');
        setSelectedRow('');
        setIsSessionActive(false);
      }
    } catch {
      toast.error("Cascaded deletion stack processing crashed during runtime execution update.");
    }
  };

  const handleDeleteRowData = async (rowId: string, rowNumber: string) => {
    const confirmMessage = `WARNING: Deleting Row "${rowNumber}" will reset layout grid coordinates positions indexes for all deployed machines here. Clear row parameters?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const batch = writeBatch(db);
      
      machines.filter(m => (m as any).sublocationId === selectedSublocation && String((m as any).rowNumber) === rowNumber).forEach(m => {
        batch.update(doc(db, "machines", m.id), {
          sublocationId: null, rowNumber: null, rowIndex: null,
          layoutConfiguredAt: null, layoutConfiguredBy: null
        });
      });

      await batch.commit();
      await deleteRegisteredRow(rowId);
      toast.success(`Row ${rowNumber} removed and dependent machines unassigned.`);
      if (selectedRow === rowNumber) {
        setSelectedRow('');
        setIsSessionActive(false);
      }
    } catch {
      toast.error("Failed to clear layout data constraints.");
    }
  };

  // --- AUTOMATED SEQUENCE SCANNING GRID PIPELINES ---
  const startLayoutConfigurationPipeline = () => {
    if (!selectedSection || !selectedSublocation || !selectedRow) {
      return toast.error("Ensure all 3 steps context drop-down scopes are selected!");
    }
    setScannedSequenceList([]);
    setIsSessionActive(true);
  };

  const processAutomatedGridMapping = (inputCode: string) => {
    const term = inputCode.trim().toUpperCase().replace(/[\s-]/g, '');
    
    const targetAsset = machines.find(m => 
      m.id.toUpperCase().replace(/[\s-]/g, '') === term || 
      (m as any).barcodeValue?.toUpperCase().replace(/[\s-]/g, '') === term
    );

    if (!targetAsset) {
      return toast.error(`Asset Identification Error: "${inputCode}" could not be matched.`);
    }
    if (scannedSequenceList.some(item => item.machineId === targetAsset.id)) {
      return toast.warning(`Asset ${targetAsset.id} is already in the current layout row queue.`);
    }

    const nextIndexPosition = scannedSequenceList.length + 1;
    setScannedSequenceList(prev => [...prev, {
      machineId: targetAsset.id,
      name: targetAsset.name,
      serialNo: targetAsset.serialNo,
      modelNo: targetAsset.modelNo,
      type: targetAsset.type,
      rowIndex: nextIndexPosition
    }]);
    toast.success(`Machine ${targetAsset.id} staged at sequence position #${nextIndexPosition}`);
  };

  const resetCurrentWorkingSequence = () => {
    setScannedSequenceList([]);
    setIsSessionActive(false);
  };

  const removeStagedScanItem = (indexToRemove: number) => {
    setScannedSequenceList(prev => {
      const filtered = prev.filter((_, idx) => idx !== indexToRemove);
      return filtered.map((item, idx) => ({ ...item, rowIndex: idx + 1 }));
    });
    toast.info("Staged element dropped. Following items shifted up to maintain continuous indexes sequence positions.");
  };

  const commitLayoutSequenceToDatabase = async () => {
    if (scannedSequenceList.length === 0) return toast.error("Staging queue is empty.");
    
    const operationalPayload: LayoutSession = {
      sectionId: selectedSection,
      sublocationId: selectedSublocation,
      rowNumber: selectedRow,
      scannedMachines: scannedSequenceList
    };

    try {
      await saveLayoutConfiguration(operationalPayload);
      toast.success("Layout row matrix framework successfully committed to database records.");
      setScannedSequenceList([]);
      setIsSessionActive(false);
    } catch {
      toast.error("Layout data save failed to commit transaction state bounds.");
    }
  };

  const activeLayoutViewMachines = useMemo(() => {
    return machines.filter(m => {
      if (viewFilterSection === 'ALL') return (m as any).sublocationId !== undefined;
      return m.section === viewFilterSection && (m as any).sublocationId !== undefined;
    }).sort((a, b) => {
      const subA = (a as any).sublocationId || '';
      const subB = (b as any).sublocationId || '';
      if (subA !== subB) return subA.localeCompare(subB);
      return ((a as any).rowIndex || 0) - ((b as any).rowIndex || 0);
    });
  }, [machines, viewFilterSection]);

  // --- REPAIRED PDF LAYOUT EXPORTER ---
  const exportLayoutPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Eskimo Fashions - Spatial Factory Grid Component Layout Analysis Sheet", 14, 15);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()} | Scope Context: ${viewFilterSection}`, 14, 20);

    const dataRows = activeLayoutViewMachines.map(m => [
      sections.find(s=>s.id === m.section)?.name || m.section,
      (m as any).sublocationId?.split('_')[1] || (m as any).sublocationId,
      `Row ${(m as any).rowNumber}`,
      `Position ${(m as any).rowIndex}`,
      m.id,
      m.type,
      m.modelNo,
      m.serialNo
    ]);

    autoTable(doc, {
      head: [['Section', 'Sublocation Zone', 'Line / Row Target', 'Grid Position Index', 'Asset Code ID', 'Classification Type', 'Model Code', 'Factory Serial ID']],
      body: dataRows,
      startY: 25,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontSize: 7 },
      bodyStyles: { fontSize: 7 }
    });

    doc.save(`Layout_Report_Floor_${viewFilterSection}.pdf`);
  };

  // --- NEW: INTEGRATED LAYOUT DATA SHEET EXCEL ENGINE ---
  const exportLayoutExcel = () => {
    if (activeLayoutViewMachines.length === 0) {
      return toast.warning("No layout data profiles available to export under this selection scope filter.");
    }

    const outputDataset = activeLayoutViewMachines.map(m => ({
      'Layout Date': (m as any).layoutConfiguredAt ? new Date((m as any).layoutConfiguredAt).toLocaleDateString() : 'N/A',
      'Who Create': (m as any).layoutConfiguredBy || 'Admin',
      'Main Section': sections.find(s => s.id === m.section)?.name || m.section,
      'Sublocation': (m as any).sublocationId?.split('_')[1] || (m as any).sublocationId,
      'Row Number': (m as any).rowNumber || 'N/A',
      'Row Index': (m as any).rowIndex !== undefined ? (m as any).rowIndex : 'N/A',
      'Machine Type': m.type || 'N/A',
      'Model': m.modelNo || 'N/A',
      'Serial Number': m.serialNo || 'N/A',
      'Asset Unit Code ID': m.id
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);

    // Custom Header Layout Styling Blocks
    XLSX.utils.sheet_add_aoa(ws, [
      ["Eskimo Fashions (Pvt) Ltd - Floor Grid Layout Matrix Report"],
      [`Filter View Scope Window: ${viewFilterSection} | Export Timestamp: ${new Date().toLocaleString()}`],
      [""] 
    ], { origin: "A1" });

    // Append standard payload tracking parameters fields objects
    XLSX.utils.sheet_add_json(ws, outputDataset, { origin: "A4", skipHeader: false });

    // Set column alignment width vectors explicitly
    ws['!cols'] = [
      {wch: 15}, {wch: 20}, {wch: 18}, {wch: 20}, {wch: 15}, 
      {wch: 12}, {wch: 20}, {wch: 15}, {wch: 20}, {wch: 25}
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Layout Topology Report");
    XLSX.writeFile(wb, `Layout_Matrix_Export_${viewFilterSection}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel spreadsheet downloaded successfully!");
  };

  return (
    <div className="p-4 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Custom Floor Layout Designer</h1>
          <p className="text-xs font-bold tracking-widest text-blue-600 uppercase mt-0.5">Dynamic Sublocation & Sequential Machine Array Register</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* PANEL 1: REGISTRATION TERMINALS */}
        <Card className="shadow-md border-t-4 border-blue-600">
          <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700">1. Sublocation & Line Registration Console</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            
            {/* SUB-SECTION A: REGISTER AND PRINT SUBLOCATION */}
            <div className="space-y-3 p-3 bg-slate-50 border rounded-xl">
              <span className="text-[11px] font-black text-blue-600 uppercase tracking-tight block">A. Add New Sublocation</span>
              <Select value={regMainSection} onValueChange={setRegMainSection}>
                <SelectTrigger className="bg-white text-xs font-bold uppercase"><SelectValue placeholder="Choose Main Location Section" /></SelectTrigger>
                <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id} className="text-xs font-bold uppercase">{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input placeholder="Type Sublocation Name..." value={regSublocationText} onChange={e => setRegSublocationText(e.target.value)} className="text-xs font-bold uppercase bg-white" />
                <Button size="sm" className="bg-blue-600 font-bold text-xs" onClick={handleRegisterSublocation}>Register</Button>
              </div>
              
              <div className="max-h-32 overflow-y-auto border rounded bg-white p-1 space-y-1">
                {filteredSublocationsList.length > 0 ? (
                  filteredSublocationsList.map(s => (
                    <div key={s.id} className="flex justify-between items-center text-[10px] font-bold p-1 bg-slate-50 border rounded animate-in fade-in">
                      <span className="uppercase text-slate-700">{s.name}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-5 w-5 border text-blue-600" onClick={() => downloadSingleBarcode(`SUB: ${s.name}`, `LOC_${s.id}`)} title="Download Sublocation Barcode"><Printer size={10}/></Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 border text-red-500 hover:bg-red-50" onClick={() => handleDeleteSublocation(s.id, s.name)} title="Delete Sublocation Zone"><Trash2 size={10}/></Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-400 italic text-center p-2 uppercase">Select a section to view registered sublocations.</div>
                )}
              </div>
            </div>

            {/* SUB-SECTION B: REGISTER AND PRINT ROW STRINGS */}
            <div className="space-y-3 p-3 bg-slate-50 border rounded-xl">
              <span className="text-[11px] font-black text-orange-600 uppercase tracking-tight block">B. Register Row Number Coordinates</span>
              <div className="grid grid-cols-2 gap-2">
                <Select value={selectedSection} onValueChange={(v) => { setSelectedSection(v); setSelectedSublocation(''); setSelectedRow(''); }}>
                  <SelectTrigger className="bg-white text-xs font-bold uppercase"><SelectValue placeholder="Main Section" /></SelectTrigger>
                  <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id} className="text-xs font-bold uppercase">{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedSublocation} onValueChange={(v) => { setSelectedSublocation(v); setSelectedRow(''); }} disabled={!selectedSection}>
                  <SelectTrigger className="bg-white text-xs font-bold uppercase"><SelectValue placeholder="Sublocation" /></SelectTrigger>
                  <SelectContent>{filteredSublocationsDropdown.map(sub => <SelectItem key={sub.id} value={sub.id} className="text-xs font-bold uppercase">{sub.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Type Row Number Name (e.g. 1)" value={regRowText} onChange={e => setRegRowText(e.target.value)} className="text-xs font-bold bg-white uppercase" />
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-xs font-bold px-3" onClick={handleRegisterRowNumber} disabled={!selectedSublocation}>Register Row</Button>
              </div>

              <div className="max-h-32 overflow-y-auto border rounded bg-white p-1 space-y-1">
                {filteredRowsList.length > 0 ? (
                  filteredRowsList.map(r => (
                    <div key={r.id} className="flex justify-between items-center text-[10px] font-bold p-1 bg-slate-50 border rounded animate-in fade-in">
                      <span className="uppercase text-slate-700">ROW NUMBER {r.rowNumber}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-5 w-5 border text-blue-600" onClick={() => downloadSingleBarcode(`${sublocations.find(sub=>sub.id===selectedSublocation)?.name} - ROW ${r.rowNumber}`, `ROW_${selectedSection}_${sublocations.find(sub=>sub.id===selectedSublocation)?.name}_${r.rowNumber}`)} title="Download Row Target Layout Barcode"><Printer size={10}/></Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 border text-red-500 hover:bg-red-50" onClick={() => handleDeleteRowData(r.id, r.rowNumber)} title="Delete Line Row Vector Block"><Trash2 size={10}/></Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-400 italic text-center p-2 uppercase">Select sublocation above to view registered rows.</div>
                )}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* PANEL 2: THREE DROPDOWNS SEQUENCER ACTIVATOR */}
        <Card className="shadow-md border-t-4 border-orange-500">
          <CardHeader><CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700">2. Active Floor Grid Mapping Initializer Switch</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Step 1: Main Location Section</Label>
              <Select value={selectedSection} onValueChange={(v) => { setSelectedSection(v); setSelectedSublocation(''); setSelectedRow(''); }} disabled={isSessionActive}>
                <SelectTrigger className="font-bold text-xs bg-slate-50 uppercase"><SelectValue placeholder="Choose Section Node" /></SelectTrigger>
                <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id} className="font-bold uppercase text-xs">{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Step 2: Available Sublocations Belongs to Main Section</Label>
              <Select value={selectedSublocation} onValueChange={(v) => { setSelectedSublocation(v); setSelectedRow(''); }} disabled={!selectedSection || isSessionActive}>
                <SelectTrigger className="font-bold text-xs bg-slate-50 uppercase"><SelectValue placeholder="Choose Target Sublocation" /></SelectTrigger>
                <SelectContent>{filteredSublocationsDropdown.map(sub => <SelectItem key={sub.id} value={sub.id} className="font-bold uppercase text-xs">{sub.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400 flex justify-between items-center">Step 3: Choose Target Registered Row</Label>
              <div className="flex gap-2">
                <Select value={selectedRow} onValueChange={setSelectedRow} disabled={!selectedSublocation || isSessionActive}>
                  <SelectTrigger className="font-bold text-xs bg-slate-50 uppercase"><SelectValue placeholder="Choose Registered Row" /></SelectTrigger>
                  <SelectContent>
                    {filteredRowsList.length > 0 ? (
                      filteredRowsList.map(r => (
                        <SelectItem key={r.id} value={r.rowNumber} className="font-bold text-xs">ROW LINE {r.rowNumber}</SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-center text-[10px] text-slate-400 italic">No stored lines found. Register one in Panel B.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!isSessionActive ? (
              <Button className="w-full bg-blue-600 font-black h-12 uppercase text-xs tracking-wider border-b-4 border-blue-800 mt-2" onClick={startLayoutConfigurationPipeline} disabled={!selectedRow || !selectedSublocation}><Play size={14} className="mr-2"/> Start Matrix Session</Button>
            ) : (
              <div className="flex gap-2 mt-2 animate-in slide-in-from-top-1">
                <Button variant="outline" className="flex-1 text-red-600 border-red-200 font-bold text-xs uppercase" onClick={resetCurrentWorkingSequence}>
                  <RotateCcw size={12} className="mr-1"/> Reset Layout Scan
                </Button>
                <Button className="flex-1 bg-green-600 font-black text-xs uppercase border-b-4 border-green-800" onClick={commitLayoutSequenceToDatabase}>
                  <CheckCircle2 size={12} className="mr-1"/> Done Button
                </Button>
              </div>
            )}

          </CardContent>
        </Card>

        {/* PANEL 3: LIVE STREAM QUEUE FEED */}
        <Card className="shadow-md border-t-4 border-purple-600">
          <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-2.5">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700">3. Sequence Mapping Grid Layout Feed Stream</CardTitle>
            {isSessionActive && <span className="px-2 py-0.5 bg-green-100 border border-green-200 text-green-700 font-black rounded text-[8px] animate-pulse uppercase">Active Input Channel</span>}
          </CardHeader>
          <CardContent className="p-0 max-h-[300px] overflow-y-auto">
            {isSessionActive ? (
              scannedSequenceList.length > 0 ? (
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead className="font-bold text-[9px] uppercase">Index Pos</TableHead><TableHead className="font-bold text-[9px] uppercase">Asset Unit ID / Serial</TableHead><TableHead className="font-bold text-[9px] uppercase text-right pr-4">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {scannedSequenceList.map((node, index) => (
                      <TableRow key={node.machineId} className="h-9 bg-purple-50/10">
                        <TableCell className="font-black text-xs text-purple-600 tabular-nums">Index #{node.rowIndex}</TableCell>
                        <TableCell>
                          <div className="font-mono font-bold text-xs text-blue-700">{node.machineId}</div>
                          <div className="text-[10px] text-slate-400">SN: {node.serialNo} | {node.type}</div>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" onClick={() => removeStagedScanItem(index)}>
                            <Trash2 size={12} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-slate-400 italic text-xs uppercase font-bold">Awaiting hardware scan inputs sequence tracking data stream...</div>
              )
            ) : (
              <div className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest bg-slate-50/30">Activate sequence dashboard controls parameters step indicators.</div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* MATRIX GRAPH TABLES SCOPE PLOTS VIEW MODULE GRID */}
      <Card className="shadow-lg">
        <CardHeader className="bg-slate-50 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">Operational Factory Workspace Grid Matrix Index Analyzer Mapping Board</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={viewFilterSection} onValueChange={setViewFilterSection}>
              <SelectTrigger className="w-48 h-9 font-bold text-xs uppercase bg-white"><SelectValue placeholder="Filter Configuration Grid Scope" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs font-bold uppercase">All Configured Floor Components</SelectItem>
                {sections.map(s => <SelectItem key={s.id} value={s.id} className="text-xs font-bold uppercase">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-9 font-bold text-xs border-blue-200 text-blue-700 uppercase" onClick={exportLayoutPDF}>
              <FileText size={14} className="mr-2" /> Download PDF Layout
            </Button>
            {/* NEW: Excel Sheet Download Action Trigger Hook Button */}
            <Button size="sm" className="h-9 font-bold text-xs bg-green-600 hover:bg-green-700 border-none text-white uppercase" onClick={exportLayoutExcel}>
              <FileSpreadsheet size={14} className="mr-2" /> Download Excel Sheet
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100/60">
              <TableRow>
                <TableHead className="font-bold text-[10px] uppercase">Section Name</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Sublocation Zone</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Row Line Number</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Array Index Location</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Machine Asset ID</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Classification Type</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Model Code Architecture</TableHead>
                <TableHead className="font-bold text-[10px] uppercase">Factory Hardware Serial Key</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeLayoutViewMachines.length > 0 ? (
                activeLayoutViewMachines.map((m) => (
                  <TableRow key={m.id} className="hover:bg-slate-50/80">
                    <TableCell className="font-black text-xs uppercase text-slate-800">{sections.find(s=>s.id === m.section)?.name || m.section}</TableCell>
                    <TableCell className="font-bold text-xs text-blue-700 uppercase">{(m as any).sublocationId?.split('_')[1] || (m as any).sublocationId}</TableCell>
                    <TableCell className="font-black text-xs text-slate-700 bg-slate-100/10">Row Target Line: {(m as any).rowNumber}</TableCell>
                    <TableCell className="font-black text-xs text-orange-600 bg-orange-50/10 text-center tabular-nums">Index #{ (m as any).rowIndex }</TableCell>
                    <TableCell className="font-mono text-xs font-black text-blue-600">{m.id}</TableCell>
                    <TableCell className="text-xs uppercase font-medium text-slate-400">{m.type}</TableCell>
                    <TableCell className="text-xs font-bold uppercase text-slate-500">{m.modelNo}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-slate-600">{m.serialNo}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8} className="p-12 text-center text-slate-400 italic text-xs uppercase font-bold">No active layout matching records discovered inside storage pool fields tracking engine.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}