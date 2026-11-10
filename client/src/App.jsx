import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import CustomersPage from './pages/CustomersPage';
import PaymentsPage from './pages/PaymentsPage';
import DailyFarmsPage from './pages/DailyFarmsPage';
import DailyRatePage from './pages/DailyRatePage';
import DailySheetPage from './pages/DailySheetPage';
import GroupSummaryPage from './pages/GroupSummaryPage';

function AppContent() {
  const { user, isAdmin } = useAuth();
  const [page, setPage] = useState(isAdmin ? 'dashboard' : 'sales');

  if (!user) return <LoginPage />;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':     return <DashboardPage onNavigate={setPage} />;
      case 'sales':         return <SalesPage onNavigate={setPage} initialTab="new" />;
      case 'new-order':     return <SalesPage onNavigate={setPage} initialTab="new" />;
      case 'orders':        return <SalesPage onNavigate={setPage} initialTab="orders" />;
      case 'customers':     return <CustomersPage onNavigate={setPage} />;
      case 'payments':      return <PaymentsPage onNavigate={setPage} />;
      case 'daily-farms':   return <DailyFarmsPage onNavigate={setPage} />;
      case 'rate':          return <DailyRatePage onNavigate={setPage} />;
      case 'daily-sheet':   return <DailySheetPage onNavigate={setPage} />;
      case 'group-summary': return <GroupSummaryPage onSelectCustomer={() => setPage('customers')} />;
      default:              return <DashboardPage onNavigate={setPage} />;
    }
  };

  return (
    <div className="app-shell">
      {/* Mobile Top Header & Fixed 5-Tab Bottom Navigation */}
      <MobileNav currentPage={page} onNavigate={setPage} />

      {/* Tablet & Desktop Sidebar */}
      <Sidebar currentPage={page} onNavigate={setPage} />

      {/* Main Scrollable Content Area */}
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
