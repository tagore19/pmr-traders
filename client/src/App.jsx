import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import DashboardPage from './pages/DashboardPage';
import DailyRatePage from './pages/DailyRatePage';
import CustomersPage from './pages/CustomersPage';
import OrdersPage from './pages/OrdersPage';
import NewOrderPage from './pages/NewOrderPage';
import DailyFarmsPage from './pages/DailyFarmsPage';
import DailySheetPage from './pages/DailySheetPage';
import GroupSummaryPage from './pages/GroupSummaryPage';

function AppContent() {
  const { user, isAdmin } = useAuth();
  const [page, setPage] = useState(isAdmin ? 'dashboard' : 'new-order');

  if (!user) return <LoginPage />;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':     return <DashboardPage />;
      case 'rate':          return <DailyRatePage />;
      case 'daily-farms':   return <DailyFarmsPage onNavigate={setPage} />;
      case 'daily-sheet':   return <DailySheetPage />;
      case 'group-summary': return <GroupSummaryPage onSelectCustomer={() => setPage('customers')} />;
      case 'customers':     return <CustomersPage />;
      case 'orders':        return <OrdersPage />;
      case 'new-order':     return <NewOrderPage onNavigate={setPage} />;
      default:              return <DashboardPage />;
    }
  };

  return (
    <div className="app-shell">
      {/* Mobile Top Header & Bottom Navigation */}
      <MobileNav currentPage={page} onNavigate={setPage} />

      {/* Desktop Sidebar */}
      <Sidebar currentPage={page} onNavigate={setPage} />

      {/* Main Content Area */}
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
