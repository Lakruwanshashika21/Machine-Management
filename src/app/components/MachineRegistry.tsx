import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, Trash2, FileText, Settings2, Printer, Loader2 } from 'lucide-react';
import Barcode from 'react-barcode';
import { Machine } from '../types';
import { jsPDF } from 'jspdf';

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
    deleteMachineType 
  } = useApp(); //

  const [showAddForm, setShowAddForm] = useState(false);
  const [showManageConfig, setShowManageConfig] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form states
  const [section, setSection] = useState('');
  const [type, setType] = useState('');
  const [modelNo, setModelNo] = useState('');
  const [dept, setDept] = useState('');
  const [name, setName] = useState('');

  const [newSectionName, setNewSectionName] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [targetSectionForType, setTargetSectionForType] = useState('');

  const availableTypesForSelectedSection = useMemo(() => {
    return machineTypes.filter(t => t.sectionId === section);
  }, [section, machineTypes]); //

  // --- REFINED PDF GENERATION LOGIC ---
  const generateSingleBarcodePDF = async (machine: Machine) => {
    setIsGenerating(true);
    // Select the specific container
    const container = document.getElementById(`barcode-render-${machine.id}`);
    let canvas = container?.querySelector('canvas');

    // Safety Delay: If canvas isn't ready, wait 300ms
    if (!canvas) {
      await new Promise(resolve => setTimeout(resolve, 300));
      canvas = container?.querySelector('canvas');
    }

    if (canvas) {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [50, 30] }); //
      const imgData = canvas.toDataURL("image/png");
      
      doc.addImage(imgData, 'PNG', 5, 2, 40, 15); //
      doc.setFontSize(10);
      doc.text(machine.id, 25, 22, { align: 'center' });
      
      doc.setFontSize(7);
      const sectionName = sections.find(s => s.id === machine.section)?.name || machine.section;
      doc.text(`${sectionName} | ${machine.type}`, 25, 26, { align: 'center' });
      
      doc.save(`Barcode_${machine.id}.pdf`);
    } else {
      alert("Error: Barcode canvas not found. Please try again.");
    }
    setIsGenerating(false);
  };

  const downloadSectionBarcodes = async (sectionId: string) => {
    const sectionMachines = machines.filter(m => m.section === sectionId);
    if (sectionMachines.length === 0) return alert("No machines found in this section.");

    setIsGenerating(true);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [50, 30] });
    const sectionObj = sections.find(s => s.id === sectionId);

    for (let i = 0; i < sectionMachines.length; i++) {
      const machine = sectionMachines[i];
      const container = document.getElementById(`barcode-render-${machine.id}`);
      const canvas = container?.querySelector('canvas');

      if (canvas) {
        if (i > 0) doc.addPage([50, 30], 'landscape');
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, 'PNG', 5, 2, 40, 15);
        doc.setFontSize(10);
        doc.text(machine.id, 25, 22, { align: 'center' });
        doc.setFontSize(7);
        doc.text(`${sectionObj?.name || 'Sec'} | ${machine.type}`, 25, 26, { align: 'center' });
      }
    }

    doc.save(`Section_${sectionObj?.name || 'Barcodes'}.pdf`);
    setIsGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addMachine({ section, type, modelNo, dept, name, status: 'IDLE', notes: '' });
    setSection(''); setType(''); setModelNo(''); setDept(''); setName('');
    setShowAddForm(false);
  };

  return (
    <div className="p-4 space-y-6">
      {/* HIDDEN RENDER AREA: Always renders barcodes as CANVASES */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, visibility: 'hidden' }}>
        {machines.map(m => (
          <div key={m.id} id={`barcode-render-${m.id}`}>
            <Barcode 
              value={m.id} 
              renderer="canvas" 
              width={2} 
              height={60} 
              displayValue={false} 
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Machine Registry</h1>
          <p className="text-slate-500 font-medium">Database & Label Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowManageConfig(true)}>
            <Settings2 className="w-4 h-4 mr-2" /> Configure
          </Button>
          <Button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Add Machine
          </Button>
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50">
          <CardTitle>Asset Inventory</CardTitle>
          <div className="flex gap-2">
             <Select onValueChange={(val) => downloadSectionBarcodes(val)}>
               <SelectTrigger className="w-56 bg-white"><SelectValue placeholder="Bulk Print Section" /></SelectTrigger>
               <SelectContent>
                 {sections.map(s => <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>)}
               </SelectContent>
             </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.map((machine) => (
                <TableRow key={machine.id}>
                  <TableCell className="font-mono font-bold text-blue-700">{machine.id}</TableCell>
                  <TableCell className="font-medium">{machine.name}</TableCell>
                  <TableCell className="text-slate-500">
                    {(sections.find(s => s.id === machine.section))?.name || machine.section} / {machine.type}
                  </TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isGenerating}
                      onClick={() => generateSingleBarcodePDF(machine)}
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMachine(machine.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* System Configuration Dialog */}
      <Dialog open={showManageConfig} onOpenChange={setShowManageConfig}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
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

      {/* Add Machine Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register New Asset</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Section</Label>
                <Select value={section} onValueChange={(val) => { setSection(val); setType(''); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={setType} disabled={!section}>
                  <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>{availableTypesForSelectedSection.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Input placeholder="Machine Name" value={name} onChange={e => setName(e.target.value)} required />
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Model No" value={modelNo} onChange={e => setModelNo(e.target.value)} required />
              <Input placeholder="Department" value={dept} onChange={e => setDept(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-blue-600" disabled={!type}>Complete Registration</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}