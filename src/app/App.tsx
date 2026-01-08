import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Scanning } from './components/Scanning';
import { MachineRegistry } from './components/MachineRegistry';
import { AuditReports } from './components/AuditReports';
import { UserManagement } from './components/UserManagement';
import { Toaster } from './components/ui/sonner';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * AppContent handles the conditional rendering of the application
 * based on the authentication state, role, and the selected view.
 */
function AppContent() {
  const { user, loading } = useApp(); // Access live auth state and loading status
  const [currentView, setCurrentView] = useState('dashboard');

  // 1. Loading State: High-visibility spinner for factory floor displays
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium animate-pulse">Syncing Factory Data...</p>
        </div>
      </div>
    );
  }

  // 2. Auth Guard: Redirects unauthenticated users to the Portal
  if (!user) {
    return <Login />;
  }

  // 3. Role-Based View Router
  const renderView = () => {
    // Determine if the user has Admin privileges from their profile
    const isAdmin = user?.role === 'ADMIN';

    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'scanning':
        return <Scanning />;
      // Restricted Admin Views
      case 'registry':
        return isAdmin ? <MachineRegistry /> : <AccessDenied />;
      case 'users':
        return isAdmin ? <UserManagement /> : <AccessDenied />;
      case 'audit':
        return isAdmin ? <AuditReports /> : <AccessDenied />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-full">
        {renderView()}
      </div>
    </Layout>
  );
}

/** * Simple Access Denied Component for restricted routing
 */
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-red-50 rounded-xl border border-red-100">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-bold text-red-900">Restricted Access</h3>
      <p className="text-red-600 max-w-xs">You do not have the administrator permissions required to view this module.</p>
    </div>
  );
}

/**
 * Root App Component
 * Provides the context and feedback toast system for the entire application.
 */
export default function App() {
  return (
    <AppProvider>
      <AppContent />
      {/* Toast notifications positioned for high visibility on dashboards */}
      <Toaster position="top-right" expand={false} richColors closeButton />
    </AppProvider>
  );
}