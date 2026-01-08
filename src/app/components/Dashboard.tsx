import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Download, FileSpreadsheet, Calendar, ChevronDown, ChevronRight, LayoutGrid, Cpu, Activity } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const STATUS_COLORS = {
  RUNNING: '#27AE60',
  IDLE: '#EB5757',
  NOT_WORKING: '#828282',
};

export function Dashboard() {
  const { machines, sections, machineTypes } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [scanFilter, setScanFilter] = useState<'ALL' | 'scan1' | 'scan2' | 'scan3'>('ALL');

  // 1. Dynamic machine filtering logic by Date
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => !selectedDate || m.lastUpdated.startsWith(selectedDate));
  }, [machines, selectedDate]);

  // 2. Statistics calculated from filtered data
  const stats = useMemo(() => {
    const running = filteredMachines.filter((m) => m.status === 'RUNNING').length;
    const idle = filteredMachines.filter((m) => m.status === 'IDLE').length;
    const notWorking = filteredMachines.filter((m) => m.status === 'NOT_WORKING').length;
    const total = filteredMachines.length;
    const efficiency = total > 0 ? Math.round((running / total) * 100) : 0;
    return { running, idle, notWorking, total, efficiency };
  }, [filteredMachines]);

  const pieData = [
    { name: 'Running', value: stats.running, color: STATUS_COLORS.RUNNING },
    { name: 'Idle', value: stats.idle, color: STATUS_COLORS.IDLE },
    { name: 'N/A', value: stats.notWorking, color: STATUS_COLORS.NOT_WORKING },
  ];

  // 3. Hierarchy Helpers
  const toggleSection = (id: string) => setExpandedSections(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleType = (id: string) => setExpandedTypes(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const calculateGroupStats = (machineList: any[]) => {
    const running = machineList.filter(m => m.status === 'RUNNING').length;
    const total = machineList.length;
    return { utilization: total > 0 ? Math.round((running / total) * 100) : 0 };
  };

  // 4. Export Logic
  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Daily Machine Scan History", 14, 20);
    doc.setFontSize(10);
    doc.text(`Report Date: ${selectedDate}`, 14, 28);
    
    const tableData = filteredMachines.map(m => [
      m.id, m.name, m.status === 'NOT_WORKING' ? 'N/A' : m.status,
      m.scans?.scan1?.status || '-', m.scans?.scan2?.status || '-', m.scans?.scan3?.status || '-'
    ]);

    autoTable(doc, {
      head: [['Machine ID', 'Name', 'Status', 'Scan 1', 'Scan 2', 'Scan 3']],
      body: tableData,
      startY: 35,
      headStyles: { fillColor: [41, 128, 185] }
    });
    doc.save(`Scan_History_${selectedDate}.pdf`);
  };

  const downloadExcel = () => {
    // Download all DB data but remove N/A broken (Running and Idle only)
    const activeMachines = machines.filter(m => m.status !== 'NOT_WORKING');

    const dataToExport = activeMachines.map(m => ({
      "Machine ID": m.id,
      "Section": m.section,
      "Type": m.type,
      "Name": m.name,
      "Current Status": m.status,
      "Scan 1": m.scans?.scan1?.status || 'N/A',
      "Scan 2": m.scans?.scan2?.status || 'N/A',
      "Scan 3": m.scans?.scan3?.status || 'N/A',
      "Last Updated": new Date(m.lastUpdated).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Active_Assets");
    XLSX.writeFile(wb, "Factory_Active_Data.xlsx");
  };

  return (
    <div className="p-4 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Monitoring Center</h1>
          <p className="text-slate-500 font-medium">Live Factory Floor Statistics</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
             <Calendar className="w-4 h-4 ml-2 text-slate-500" />
             <Input 
                type="date" 
                className="border-none bg-transparent shadow-none focus-visible:ring-0 w-40"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
             />
          </div>
          <Button variant="outline" className="text-blue-700 border-blue-200" onClick={downloadPDF}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={downloadExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Assets', val: stats.total, color: 'text-slate-900' },
          { label: 'Running', val: stats.running, color: 'text-[#27AE60]' },
          { label: 'Idle', val: stats.idle, color: 'text-[#EB5757]' },
          { label: 'N/A (Broken)', val: stats.notWorking, color: 'text-[#828282]' },
          { label: 'Efficiency', val: `${stats.efficiency}%`, color: 'text-blue-600' }
        ].map((card, i) => (
          <Card key={i} className="border-none shadow-md overflow-hidden">
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{card.label}</p>
              <p className={`text-4xl font-black ${card.color}`}>{card.val}</p>
            </div>
            <div className={`h-1 w-full bg-current opacity-20 ${card.color}`}></div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual Distribution (Pie Chart) */}
        <Card className="lg:col-span-4 shadow-lg border-t-4 border-t-blue-500">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500"/>
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Hierarchical Activity Log Table */}
        <Card className="lg:col-span-8 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50">
            <CardTitle className="text-lg">Hierarchical Activity Log</CardTitle>
            <Select value={scanFilter} onValueChange={(val: any) => setScanFilter(val)}>
              <SelectTrigger className="w-40 bg-white"><SelectValue placeholder="All Scans" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Scan Activity</SelectItem>
                <SelectItem value="scan1">Scan 1 Only</SelectItem>
                <SelectItem value="scan2">Scan 2 Only</SelectItem>
                <SelectItem value="scan3">Scan 3 Only</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto max-h-[500px]">
            {sections.map((sec) => {
              const secMachines = filteredMachines.filter(m => m.section === sec.id);
              const secStats = calculateGroupStats(secMachines);
              const isExpanded = expandedSections.includes(sec.id);

              return (
                <div key={sec.id} className="border-b last:border-none">
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100" onClick={() => toggleSection(sec.id)}>
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <LayoutGrid className="w-5 h-5 text-blue-600" />
                      <span className="font-bold">Section {sec.name}</span>
                    </div>
                    <div className="text-[10px] font-bold text-blue-600 pr-4">{secStats.utilization}% Utilization</div>
                  </div>

                  {isExpanded && (
                    <div className="bg-slate-50/50">
                      {machineTypes.filter(t => t.sectionId === sec.id).map((type) => {
                        const typeMachines = secMachines.filter(m => m.type === type.name);
                        const isTypeExpanded = expandedTypes.includes(type.id);

                        return (
                          <div key={type.id} className="border-t pl-6">
                            <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-blue-50" onClick={() => toggleType(type.id)}>
                              <div className="flex items-center gap-2">
                                {isTypeExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <Cpu className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-medium">{type.name}</span>
                              </div>
                            </div>

                            {isTypeExpanded && (
                              <div className="pl-6 pr-4 pb-2 bg-white">
                                <Table>
                                  <TableBody>
                                    {typeMachines.map((m) => (
                                      <TableRow key={m.id} className="h-8 hover:bg-slate-50">
                                        <TableCell className="font-mono text-[10px] font-black text-blue-700">{m.id}</TableCell>
                                        <TableCell className="text-[10px] uppercase font-bold text-slate-600">{m.status}</TableCell>
                                        <TableCell className="flex gap-1 justify-end">
                                          {[1, 2, 3].map(i => {
                                            const scan = (m.scans as any)?.[`scan${i}`];
                                            if (scanFilter !== 'ALL' && scanFilter !== `scan${i}`) return null;
                                            return (
                                              <div key={i} className={`px-1.5 py-0.5 rounded text-[8px] font-black border transition-colors ${
                                                scan?.status === 'RUNNING' ? 'bg-green-50 border-green-200 text-green-700' : 
                                                scan?.status === 'IDLE' ? 'bg-red-50 border-red-200 text-red-700' : 
                                                scan?.status === 'NA' ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-200'
                                              }`}>S{i}</div>
                                            );
                                          })}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}