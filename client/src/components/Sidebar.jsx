import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const adminNav = [
  { icon: '🏠', label: 'Dashboard',          page: 'dashboard' },
  { icon: '👥', label: 'Customers & Ledger', page: 'customers' },
  { icon: '📝', label: 'Sales & Drops',      page: 'sales' },
  { icon: '💵', label: 'Payments',           page: 'payments' },
  { icon: '🚜', label: 'Daily Farms',        page: 'daily-farms' },
  { icon: '📋', label: 'Paper Rate',         page: 'rate' },
  { icon: '🖨️', label: 'Daily Sheet (PDF)',  page: 'daily-sheet' },
  { icon: '📑', label: 'Group Summary',      page: 'group-summary' },
];

const supervisorNav = [
  { icon: '📝', label: 'Sales & Drops',      page: 'sales' },
  { icon: '👥', label: 'Customers & Ledger', page: 'customers' },
  { icon: '💵', label: 'Payments',           page: 'payments' },
  { icon: '🚜', label: 'Daily Farms',        page: 'daily-farms' },
  { icon: '📋', label: 'Paper Rate',         page: 'rate' },
  { icon: '🖨️', label: 'Daily Sheet (PDF)',  page: 'daily-sheet' },
  { icon: '📑', label: 'Group Summary',      page: 'group-summary' },
];

export default function Sidebar({ currentPage, onNavigate }) {
  const { user, logout, isAdmin } = useAuth();
  const { toggleTheme, isDark } = useTheme();
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

      {navItems.map((item) => (
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
        <button
          onClick={toggleTheme}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', justifyContent: 'center', gap: '8px', minHeight: '38px' }}
        >
          <span>{isDark ? '☀️' : '🌙'}</span>
          <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
        </button>

        <div className="user-chip">
          <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--border)' }}
          onClick={logout}
        >
          ⬅ Sign Out
        </button>
      </div>
    </aside>
  );
}
