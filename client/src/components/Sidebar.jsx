import { useAuth } from '../context/AuthContext';

const adminNav = [
  { icon: '📊', label: 'Dashboard',          page: 'dashboard' },
  { icon: '📋', label: 'Paper Rate',         page: 'rate' },
  { icon: '🚜', label: 'Daily Farms',        page: 'daily-farms' },
  { icon: '📝', label: 'New Order Drop',     page: 'new-order' },
  { icon: '🖨️', label: 'Daily Sheet (PDF)',  page: 'daily-sheet' },
  { icon: '📑', label: 'Group Summary',      page: 'group-summary' },
  { icon: '👥', label: 'Customers & Ledger', page: 'customers' },
  { icon: '🛒', label: 'Sales Register',     page: 'orders' },
];

const supervisorNav = [
  { icon: '📝', label: 'New Order Drop',     page: 'new-order' },
  { icon: '🚜', label: 'Daily Farms',        page: 'daily-farms' },
  { icon: '🖨️', label: 'Daily Sheet (PDF)',  page: 'daily-sheet' },
  { icon: '📋', label: 'Paper Rate',         page: 'rate' },
  { icon: '👥', label: 'Customers & Ledger', page: 'customers' },
  { icon: '📑', label: 'Group Summary',      page: 'group-summary' },
  { icon: '🛒', label: 'My Orders',          page: 'orders' },
];

export default function Sidebar({ currentPage, onNavigate }) {
  const { user, logout, isAdmin } = useAuth();
  const navItems = isAdmin ? adminNav : supervisorNav;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🐔</div>
        <div>
          <div className="sidebar-logo-text">PMR Traders</div>
          <div className="sidebar-logo-sub">Poultry Distribution</div>
        </div>
      </div>

      <div className="sidebar-section-label">
        {isAdmin ? '👑 Admin Owner' : `🚚 ${user?.name || 'Supervisor'}`}
      </div>

      {navItems.map(item => (
        <button
          key={item.page}
          className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
          onClick={() => onNavigate(item.page)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}

      <div className="sidebar-bottom">
        <div className="user-chip">
          <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>⬅ Sign Out</button>
      </div>
    </aside>
  );
}
