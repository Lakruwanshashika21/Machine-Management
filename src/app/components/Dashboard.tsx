import { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableRow } from './ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Download, FileSpreadsheet, Calendar, ChevronDown, ChevronRight, Monitor, Minimize, Code2, Wrench } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const STATUS_COLORS = {
  RUNNING: '#22c55e', 
  IDLE: '#ef4444', 
  MAINTAIN: '#f59e0b', // Amber for breakdown/removed
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
    return machines
      .filter((m) => m.status !== 'NOT_WORKING')
      .map((m) => {
        const isUpdatedOnDate = m.lastUpdated?.startsWith(selectedDate);
        return {
          ...m,
          status: isUpdatedOnDate ? m.status : 'IDLE',
          displayScans: isUpdatedOnDate ? m.scans : {
            scan1: { status: 'IDLE' },
            scan2: { status: 'IDLE' },
            scan3: { status: 'IDLE' }
          }
        };
      });
  }, [machines, selectedDate]);

  // Updated Stats for 5 KPIs
  const stats = useMemo(() => {
    const maintain = filteredMachines.filter(m => 
      (m as any).operationalStatus === 'BREAKDOWN' || (m as any).operationalStatus === 'REMOVED'
    ).length;
    
    const activeFleet = filteredMachines.filter(m => 
      (m as any).operationalStatus !== 'BREAKDOWN' && (m as any).operationalStatus !== 'REMOVED'
    );

    const running = activeFleet.filter((m) => m.status === 'RUNNING').length;
    const idle = activeFleet.filter((m) => m.status === 'IDLE').length;
    const total = filteredMachines.length;
    const efficiency = activeFleet.length > 0 ? Math.round((running / activeFleet.length) * 100) : 0;
    
    return { total, running, idle, maintain, efficiency };
  }, [filteredMachines]);

  const pieData = [
    { name: 'Running', value: stats.running, color: STATUS_COLORS.RUNNING },
    { name: 'Idle', value: stats.idle, color: STATUS_COLORS.IDLE },
    { name: 'Maintain', value: stats.maintain, color: STATUS_COLORS.MAINTAIN },
  ];

  const toggleSection = (id: string) => {
    setExpandedSections(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleType = (id: string) => {
    setExpandedTypes(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const calculateGroupStats = (machineList: any[]) => {
    const maintain = machineList.filter(m => 
      m.operationalStatus === 'BREAKDOWN' || m.operationalStatus === 'REMOVED'
    ).length;

    const activeList = machineList.filter(m => 
      m.operationalStatus !== 'BREAKDOWN' && m.operationalStatus !== 'REMOVED'
    );

    const running = activeList.filter(m => m.status === 'RUNNING').length;
    const idle = activeList.filter(m => m.status === 'IDLE').length;
    const total = machineList.length;
    
    return { 
      total, 
      running, 
      idle, 
      maintain,
      utilization: activeList.length > 0 ? Math.round((running / activeList.length) * 100) : 0 
    };
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

  const calculateAge = (dateString: string) => {
    if (!dateString) return 'N/A';
    const birth = new Date(dateString);
    const now = new Date();
    const age = now.getFullYear() - birth.getFullYear();
    return age >= 0 ? age : 0;
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Daily Machine Scan History", 14, 20);
    doc.text(`Report Date: ${selectedDate}`, 14, 28);

    const tableData = filteredMachines.map(m => [
      m.id, 
      m.name, 
      (m as any).operationalStatus === 'BREAKDOWN' || (m as any).operationalStatus === 'REMOVED' ? 'MAINTAIN' : m.status, 
      m.displayScans?.scan1?.status || 'IDLE', 
      m.displayScans?.scan2?.status || 'IDLE', 
      m.displayScans?.scan3?.status || 'IDLE'
    ]);

    autoTable(doc, { 
      head: [['ID', 'Name', 'Status', 'S1', 'S2', 'S3']], 
      body: tableData, 
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`Scan_History_${selectedDate}.pdf`);
  };

  const downloadExcel = () => {
    const detailedData = filteredMachines.map(m => ({
      'Machine ID': m.id,
      'Section': sections.find(s => s.id === m.section)?.name || m.section,
      'Status': (m as any).operationalStatus || 'WORKING',
      'Activity': m.status,
      'Maintain': (m as any).operationalStatus === 'BREAKDOWN' || (m as any).operationalStatus === 'REMOVED' ? 'Yes' : 'No',
      'Age (Years)': calculateAge(m.purchaseDate),
      'Utilization %': m.status === 'RUNNING' ? '100%' : '0%',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [
      ["Eskimo Fashions (Pvt) Ltd - Machine Inventory"],
      [`Date: ${selectedDate}`],
      []
    ], { origin: "A1" });
    XLSX.utils.sheet_add_json(ws, detailedData, { origin: "A4", skipHeader: false });
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Report");
    XLSX.writeFile(wb, `Machine_Inventory_Report_${selectedDate}.xlsx`);
  };

  const containerClass = isDisplayMode 
    ? "fixed inset-0 z-[100] bg-slate-950 p-10 overflow-y-auto text-white flex flex-col"
    : "p-4 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-20";

  return (
    <div className={containerClass}>
      {/* HEADER */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border ${isDisplayMode ? 'hidden' : ''}`}>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Machine Inventory</h1>
          <p className="text-slate-500 font-medium tracking-tight">Factory Performance Dashboard</p>
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

      {/* 5 KPI TILES */}
      <div className={`grid grid-cols-2 ${isDisplayMode ? 'lg:grid-cols-5 gap-8 mb-10' : 'md:grid-cols-5 gap-4'}`}>
        {[
          { label: 'Total Assets', val: stats.total, color: isDisplayMode ? 'text-white' : 'text-slate-900' },
          { label: 'Running', val: stats.running, color: 'text-green-500' },
          { label: 'Idle', val: stats.idle, color: 'text-red-500' },
          { label: 'Maintain', val: stats.maintain, color: 'text-amber-500' },
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
        {/* PIE CHART - INCLUDES MAINTAIN */}
        <Card className={`lg:col-span-4 shadow-xl border-t-4 border-t-blue-500 ${isDisplayMode ? 'bg-slate-900 border-slate-800' : ''}`}>
          <CardHeader><CardTitle className={isDisplayMode ? 'text-white font-black' : 'font-black'}>Status Overview</CardTitle></CardHeader>
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

        {/* TREE VIEW - UPDATED WITH MAINTAIN COLUMN */}
        <Card className={`lg:col-span-8 shadow-xl ${isDisplayMode ? 'bg-slate-900 border-slate-800' : ''}`}>
          <CardHeader className={`border-b flex flex-row items-center justify-between ${isDisplayMode ? 'border-slate-800' : 'bg-slate-50/50'}`}>
            <CardTitle className={isDisplayMode ? 'text-white font-black uppercase tracking-widest' : 'font-black'}>Hierarchy Analysis</CardTitle>
            <div className="hidden sm:flex gap-8 text-[10px] font-black text-slate-400 uppercase tracking-widest mr-4">
               <div className="w-12 text-center">Total</div>
               <div className="w-12 text-center text-green-600">Run</div>
               <div className="w-12 text-center text-red-600">Idle</div>
               <div className="w-12 text-center text-amber-600">Mtn</div>
               <div className="w-12 text-center text-blue-600">%</div>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-y-auto max-h-[650px]">
            {sections.map((sec) => {
              const secMachines = filteredMachines.filter(m => m.section === sec.id);
              const secStats = calculateGroupStats(secMachines);
              const isExpanded = expandedSections.includes(sec.id);

              return (
                <div key={sec.id} className={`border-b ${isDisplayMode ? 'border-slate-800' : ''}`}>
                  <div className={`p-4 flex items-center justify-between cursor-pointer transition-all ${isDisplayMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`} onClick={() => toggleSection(sec.id)}>
                    <div className="flex items-center gap-4">
                      {isExpanded ? <ChevronDown className="text-blue-500" /> : <ChevronRight className="text-slate-500" />}
                      <span className={`font-black uppercase tracking-tight ${isDisplayMode ? 'text-xl text-white' : 'text-lg text-slate-900'}`}>{sec.name}</span>
                    </div>
                    <div className="flex gap-8 text-[11px] font-black mr-4 tabular-nums">
                      <div className="w-12 text-center text-slate-500">{secStats.total}</div>
                      <div className="w-12 text-center text-green-500">{secStats.running}</div>
                      <div className="w-12 text-center text-red-500">{secStats.idle}</div>
                      <div className="w-12 text-center text-amber-500">{secStats.maintain}</div>
                      <div className="w-12 text-center text-blue-500">{secStats.utilization}%</div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={isDisplayMode ? 'bg-black/30' : 'bg-slate-50/50'}>
                      {machineTypes.filter(t => t.sectionId === sec.id).map((type) => {
                        const typeMachines = secMachines.filter(m => m.type === type.name);
                        const typeStats = calculateGroupStats(typeMachines);
                        const isTypeExpanded = expandedTypes.includes(type.id);

                        return (
                          <div key={type.id} className={`border-t pl-8 ${isDisplayMode ? 'border-slate-800' : ''}`}>
                            <div className={`p-3 flex items-center justify-between cursor-pointer ${isDisplayMode ? 'hover:bg-slate-800' : 'hover:bg-blue-50'}`} onClick={() => toggleType(type.id)}>
                              <div className="flex items-center gap-3">
                                {isTypeExpanded ? <ChevronDown size={14} className="text-blue-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                <span className={`text-xs font-black uppercase tracking-widest ${isDisplayMode ? 'text-slate-300' : 'text-slate-500'}`}>{type.name}</span>
                              </div>
                              <div className="flex gap-8 text-[10px] font-bold mr-4 opacity-80 tabular-nums">
                                <div className="w-12 text-center text-slate-500">{typeStats.total}</div>
                                <div className="w-12 text-center text-green-500">{typeStats.running}</div>
                                <div className="w-12 text-center text-red-500">{typeStats.idle}</div>
                                <div className="w-12 text-center text-amber-500">{typeStats.maintain}</div>
                                <div className="w-12 text-center text-blue-500">{typeStats.utilization}%</div>
                              </div>
                            </div>

                            {isTypeExpanded && (
                              <div className={`pl-10 pr-4 pb-4 ${isDisplayMode ? '' : 'bg-white'}`}>
                                <Table>
                                  <TableBody>
                                    {typeMachines.map((m) => (
                                      <TableRow key={m.id} className={`h-10 border-none ${isDisplayMode ? 'hover:bg-slate-800' : ''}`}>
                                        <TableCell className="font-mono text-[12px] font-black text-blue-500">{m.id}</TableCell>
                                        <TableCell className={`text-[10px] uppercase font-black ${
                                          (m as any).operationalStatus === 'BREAKDOWN' || (m as any).operationalStatus === 'REMOVED' ? 'text-amber-500' :
                                          m.status === 'RUNNING' ? 'text-green-500' : 'text-red-500'
                                        }`}>
                                          {(m as any).operationalStatus === 'BREAKDOWN' || (m as any).operationalStatus === 'REMOVED' ? 'MAINTAIN' : m.status}
                                        </TableCell>
                                        <TableCell className="flex gap-2 justify-end items-center h-full pt-1">
                                          {[1, 2, 3].map(i => {
                                            const scan = (m as any).displayScans?.[`scan${i}`];
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
        <div className="mt-8 md:mt-12 flex flex-col items-center justify-center gap-2 border-t pt-8 pb-4">
          <div className="p-1.5 bg-blue-100 rounded-lg"><Code2 className="w-4 h-4 text-blue-600" /></div>
          <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest text-center">
            Developed by{" "}
            <a 
              href="https://www.linkedin.com/in/lakruwan-shashika/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline transition-all decoration-2 underline-offset-4 block sm:inline"
            >
              Lakruwan Shashika
            </a>
          </p>
        </div>
      )}
    </div>
  );
}