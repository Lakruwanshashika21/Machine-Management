import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/button';
import {
  LayoutDashboard,
  QrCode,
  Database,
  FileText,
  LogOut,
  Menu,
  PlayCircle,
  Users, // Import new icon
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const { user, logout, globalStartDay } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Define navigation items based on user role
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
    { id: 'scanning', label: 'Scanning', icon: QrCode, adminOnly: false },
    ...(user?.role === 'ADMIN'
      ? [
          { id: 'registry', label: 'Machine Registry', icon: Database, adminOnly: true },
          { id: 'users', label: 'Staff Management', icon: Users, adminOnly: true }, // New User Management link
          { id: 'audit', label: 'Audit & Reports', icon: FileText, adminOnly: true },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar - Optimized for all screens */}
      <div className="bg-white border-b h-16 flex items-center justify-between px-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold">Pro-Scan Factory</h1>
            <p className="text-xs text-gray-600">Machine Management System</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-6">
          {user?.role === 'ADMIN' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={globalStartDay}
              className="hidden md:flex bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Global Start Day
            </Button>
          )}
          <div className="text-right border-l pl-4">
            <p className="text-sm font-semibold">{user?.name || user?.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{user?.role}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} title="Sign Out">
            <LogOut className="w-5 h-5 text-red-500" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Smooth transition */}
        <div
          className={`bg-white border-r shadow-sm transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-0'
          } overflow-hidden`}
        >
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant={currentView === item.id ? 'default' : 'ghost'}
                className={`w-full justify-start ${
                  currentView === item.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600'
                }`}
                onClick={() => onViewChange(item.id)}
              >
                <item.icon className={`w-4 h-4 mr-2 ${currentView === item.id ? 'text-white' : 'text-blue-500'}`} />
                {item.label}
              </Button>
            ))}
          </nav>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-[#F8FAFC]">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}