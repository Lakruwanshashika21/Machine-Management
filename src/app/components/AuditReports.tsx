import { useState, useMemo, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function AuditReports() {
  const [logs, setLogs] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Real-time DB Connection
  useEffect(() => {
    const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logData);
    });
    return unsub;
  }, []);

  // 2. Filtering Logic (Date and Search)
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesDate = dateFilter ? log.timestamp.startsWith(dateFilter) : true;
      const matchesSearch = log.machineId.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           log.userName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDate && matchesSearch;
    });
  }, [logs, dateFilter, searchQuery]);

  // 3. Download PDF Report
  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Factory Audit Report", 14, 15);
    
    const tableData = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.userName,
      log.machineId,
      log.action,
      log.newStatus
    ]);

    autoTable(doc, {
      head: [['Timestamp', 'User', 'Machine ID', 'Action', 'Status']],
      body: tableData,
      startY: 20
    });
    
    doc.save(`Audit_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // 4. Download Excel (All DB Data)
  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(logs);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "All_Audit_Logs");
    XLSX.writeFile(workbook, "Factory_Database_Export.xlsx");
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Audit & Reports</h1>
          <p className="text-gray-600">Real-time system activity logs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
          </Button>
          <Button onClick={downloadPDF}>
            <FileText className="w-4 h-4 mr-2" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Date</label>
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Search User or Machine</label>
              <Input placeholder="Search ID or Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Machine ID</TableHead>
                  <TableHead>New Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.userName}</TableCell>
                    <TableCell className="font-mono">{log.machineId}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-white text-xs ${
                        log.newStatus === 'RUNNING' ? 'bg-green-600' : 
                        log.newStatus === 'IDLE' ? 'bg-red-500' : 'bg-gray-500'
                      }`}>
                        {log.newStatus}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}