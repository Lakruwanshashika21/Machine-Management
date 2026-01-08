import { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableRow } from './ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Download, FileSpreadsheet, Calendar, ChevronDown, ChevronRight, LayoutGrid, Cpu, Activity, Monitor, Minimize, Code2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const STATUS_COLORS = {
  RUNNING: '#22c55e', 
  IDLE: '#ef4444', 
};

export function Dashboard() {
  const { machines, sections, machineTypes } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDisplayMode, setIsDisplayMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [scanFilter, setScanFilter] = useState<'ALL' | 'scan1' | 'scan2' | 'scan3'>('ALL');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => m.status !== 'NOT_WORKING' && (!selectedDate || m.lastUpdated.startsWith(selectedDate)));
  }, [machines, selectedDate]);

  const stats = useMemo(() => {
    const running = filteredMachines.filter((m) => m.status === 'RUNNING').length;
    const idle = filteredMachines.filter((m) => m.status === 'IDLE').length;
    const total = filteredMachines.length;
    const efficiency = total > 0 ? Math.round((running / total) * 100) : 0;
    return { running, idle, total, efficiency };
  }, [filteredMachines]);

  const pieData = [
    { name: 'Running', value: stats.running, color: STATUS_COLORS.RUNNING },
    { name: 'Idle', value: stats.idle, color: STATUS_COLORS.IDLE },
  ];

  const toggleSection = (id: string) => {
    setExpandedSections(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleType = (id: string) => {
    setExpandedTypes(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const calculateGroupStats = (machineList: any[]) => {
    const running = machineList.filter(m => m.status === 'RUNNING').length;
    const idle = machineList.filter(m => m.status === 'IDLE').length;
    const total = machineList.length;
    return { running, idle, utilization: total > 0 ? Math.round((running / total) * 100) : 0 };
  };

  const enableTVMode = () => {
    setIsDisplayMode(true);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const exitTVMode = () => {
    setIsDisplayMode(false);
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Daily Machine Scan History", 14, 20);
    doc.text(`Report Date: ${selectedDate}`, 14, 28);
    const tableData = filteredMachines.map(m => [m.id, m.name, m.status, m.scans?.scan1?.status || '-', m.scans?.scan2?.status || '-', m.scans?.scan3?.status || '-']);
    autoTable(doc, { head: [['ID', 'Name', 'Status', 'S1', 'S2', 'S3']], body: tableData, startY: 35 });
    doc.save(`Scan_History_${selectedDate}.pdf`);
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredMachines);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");
    XLSX.writeFile(wb, "Factory_Data.xlsx");
  };

  const containerClass = isDisplayMode 
    ? "fixed inset-0 z-[100] bg-slate-950 p-10 overflow-y-auto text-white flex flex-col"
    : "p-4 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-20";

  return (
    <div className={containerClass}>
      {/* NORMAL HEADER: PREVIOUS LAYOUT PRESERVED */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border ${isDisplayMode ? 'hidden' : ''}`}>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Monitoring Center</h1>
          <p className="text-slate-500 font-medium tracking-tight">Real-time Production Analytics</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-blue-600 text-blue-600 font-bold" onClick={enableTVMode}>
            <Monitor className="w-4 h-4 mr-2" /> TV MODE
          </Button>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
             <Calendar className="w-4 h-4 ml-2 text-slate-500" />
             <Input type="date" className="border-none bg-transparent shadow-none w-40 font-bold" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <Button variant="outline" className="text-blue-700 border-blue-200" onClick={downloadPDF}><Download className="w-4 h-4 mr-2" /> PDF</Button>
          <Button className="bg-green-600 hover:bg-green-700 font-bold" onClick={downloadExcel}><FileSpreadsheet className="w-4 h-4 mr-2" /> EXCEL</Button>
        </div>
      </div>

      {/* TV HEADER */}
      {isDisplayMode && (
        <div className="flex justify-between items-center mb-10 border-b border-slate-800 pb-8">
          <div className="flex items-center gap-6">
            <div className="text-6xl font-black text-blue-500 tabular-nums">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="h-16 w-px bg-slate-800" />
            <div className="text-2xl font-bold uppercase text-slate-400">
              {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <Button onClick={exitTVMode} className="bg-red-600 hover:bg-red-700 h-16 px-8 text-xl font-black rounded-xl shadow-lg">
            <Minimize className="mr-2 h-6 w-6" /> EXIT DISPLAY
          </Button>
        </div>
      )}

      {/* KPI TILES */}
      <div className={`grid grid-cols-2 ${isDisplayMode ? 'lg:grid-cols-4 gap-8 mb-10' : 'md:grid-cols-4 gap-4'}`}>
        {[
          { label: 'Total Assets', val: stats.total, color: isDisplayMode ? 'text-white' : 'text-slate-900' },
          { label: 'Running', val: stats.running, color: 'text-green-500' },
          { label: 'Idle', val: stats.idle, color: 'text-red-500' },
          { label: 'Utilization', val: `${stats.efficiency}%`, color: 'text-blue-500' }
        ].map((card, i) => (
          <Card key={i} className={`${isDisplayMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'border-none shadow-md overflow-hidden'}`}>
            <div className="p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{card.label}</p>
              <p className={`text-5xl font-black ${card.color}`}>{card.val}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CHART */}
        <Card className={`lg:col-span-4 shadow-xl border-t-4 border-t-blue-500 ${isDisplayMode ? 'bg-slate-900 border-slate-800' : ''}`}>
          <CardHeader><CardTitle className={isDisplayMode ? 'text-white font-black' : 'font-black'}>Machine Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px' }} />
                  <Legend verticalAlign="bottom" height={36} formatter={(val) => <span className="text-[10px] font-black uppercase text-slate-400 mx-2">{val}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* TREE VIEW: WITH SCAN FILTER */}
        <Card className={`lg:col-span-8 shadow-xl ${isDisplayMode ? 'bg-slate-900 border-slate-800' : ''}`}>
          <CardHeader className={`border-b flex flex-row items-center justify-between ${isDisplayMode ? 'border-slate-800' : 'bg-slate-50/50'}`}>
            <CardTitle className={isDisplayMode ? 'text-white font-black uppercase tracking-widest' : 'font-black'}>Activity Hierarchy</CardTitle>
            {!isDisplayMode && (
              <Select value={scanFilter} onValueChange={(val: any) => setScanFilter(val)}>
                <SelectTrigger className="w-40 bg-white font-bold text-xs"><SelectValue placeholder="All Scans" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Scan Activity</SelectItem>
                  <SelectItem value="scan1">Scan 1 Status</SelectItem>
                  <SelectItem value="scan2">Scan 2 Status</SelectItem>
                  <SelectItem value="scan3">Scan 3 Status</SelectItem>
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto max-h-[650px]">
            {sections.map((sec) => {
              const secMachines = filteredMachines.filter(m => m.section === sec.id);
              const secStats = calculateGroupStats(secMachines);
              const isExpanded = expandedSections.includes(sec.id);

              return (
                <div key={sec.id} className={`border-b ${isDisplayMode ? 'border-slate-800' : ''}`}>
                  <div className={`p-5 flex items-center justify-between cursor-pointer transition-all ${isDisplayMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`} onClick={() => toggleSection(sec.id)}>
                    <div className="flex items-center gap-4">
                      {isExpanded ? <ChevronDown className="text-blue-500" /> : <ChevronRight className="text-slate-500" />}
                      <span className={`font-black uppercase tracking-tight ${isDisplayMode ? 'text-2xl text-white' : 'text-lg'}`}>Section {sec.name}</span>
                    </div>
                    <div className="flex gap-8 text-[10px] font-black mr-4">
                      <span className="text-green-500 uppercase tracking-tighter">RUN: {secStats.running}</span>
                      <span className="text-red-500 uppercase tracking-tighter">IDLE: {secStats.idle}</span>
                      <span className="text-blue-500 uppercase tracking-tighter">{secStats.utilization}% UTIL</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={isDisplayMode ? 'bg-black/30' : 'bg-slate-50/50'}>
                      {machineTypes.filter(t => t.sectionId === sec.id).map((type) => {
                        const typeMachines = secMachines.filter(m => m.type === type.name);
                        const typeStats = calculateGroupStats(typeMachines);
                        const isTypeExpanded = expandedTypes.includes(type.id);

                        return (
                          <div key={type.id} className={`border-t pl-10 ${isDisplayMode ? 'border-slate-800' : ''}`}>
                            <div className={`p-4 flex items-center justify-between cursor-pointer ${isDisplayMode ? 'hover:bg-slate-800' : 'hover:bg-blue-50'}`} onClick={() => toggleType(type.id)}>
                              <div className="flex items-center gap-3">
                                {isTypeExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <span className={`text-xs font-black uppercase tracking-widest ${isDisplayMode ? 'text-slate-300' : 'text-slate-500'}`}>{type.name}</span>
                              </div>
                              <div className="flex gap-4 text-[9px] font-black mr-4 opacity-70">
                                <span className="text-green-500 uppercase">R: {typeStats.running}</span>
                                <span className="text-red-500 uppercase">I: {typeStats.idle}</span>
                                <span className="text-blue-500 uppercase">{typeStats.utilization}%</span>
                              </div>
                            </div>

                            {isTypeExpanded && (
                              <div className={`pl-10 pr-4 pb-4 ${isDisplayMode ? '' : 'bg-white'}`}>
                                <Table>
                                  <TableBody>
                                    {typeMachines.map((m) => (
                                      <TableRow key={m.id} className={`h-10 border-none ${isDisplayMode ? 'hover:bg-slate-800' : ''}`}>
                                        <TableCell className="font-mono text-[12px] font-black text-blue-500">{m.id}</TableCell>
                                        <TableCell className={`text-[10px] uppercase font-black ${m.status === 'RUNNING' ? 'text-green-500' : 'text-red-500'}`}>{m.status}</TableCell>
                                        <TableCell className="flex gap-2 justify-end items-center h-full pt-1">
                                          {[1, 2, 3].map(i => {
                                            const scan = (m.scans as any)?.[`scan${i}`];
                                            // Apply Filter Visibility
                                            if (scanFilter !== 'ALL' && scanFilter !== `scan${i}`) return null;
                                            return (
                                              <div key={i} className={`w-10 h-6 rounded flex items-center justify-center text-[9px] font-black border ${
                                                scan?.status === 'RUNNING' ? 'bg-green-500 text-white border-green-400' : 
                                                scan?.status === 'IDLE' ? 'bg-red-500 text-white border-red-400' : 'bg-slate-800 text-slate-600 border-slate-700'
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

      {/* FOOTER */}
      {!isDisplayMode && (
        <div className="mt-12 flex items-center justify-center gap-2 border-t pt-8 pb-4">
          <div className="p-1.5 bg-blue-100 rounded-lg"><Code2 className="w-4 h-4 text-blue-600" /></div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Developed by <span className="text-blue-600">Lakruwan Shashika</span>
          </p>
        </div>
      )}
    </div>
  );
}