import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function MobileNav({ currentPage, onNavigate }) {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const mainTabs = [
    { id: 'dashboard',   label: 'Home',      icon: '🏠' },
    { id: 'customers',   label: 'Customers', icon: '👥' },
    { id: 'sales',       label: 'Sales',     icon: '📝' },
    { id: 'payments',    label: 'Payments',  icon: '💵' },
    { id: 'more',        label: 'More',      icon: '☰' },
  ];

  const handleTabClick = (tabId) => {
    if (tabId === 'more') {
      setShowMoreMenu(true);
      return;
    }
    setShowMoreMenu(false);
    onNavigate(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDrawerNavigate = (pageId) => {
    setShowMoreMenu(false);
    onNavigate(pageId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Determine current active bottom tab
  const getActiveTab = () => {
    if (currentPage === 'dashboard') return 'dashboard';
    if (currentPage === 'customers') return 'customers';
    if (currentPage === 'sales' || currentPage === 'new-order' || currentPage === 'orders') return 'sales';
    if (currentPage === 'payments') return 'payments';
    return 'more';
  };

  const activeTabId = getActiveTab();

  return (
    <>
      {/* Top App Bar */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{
            width: 34,
            height: 34,
            background: 'var(--primary)',
            color: '#FFFFFF',
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '17px',
            boxShadow: '0 2px 8px var(--primary-glow)'
          }}>
            🐔
          </div>
          <div>
            <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.3px' }}>
              PMR Traders
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {isAdmin ? '👑 Admin' : `🚚 ${user?.name || 'Supervisor'}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Daily Rate Pill */}
          <button
            onClick={() => handleDrawerNavigate('rate')}
            style={{
              background: currentPage === 'rate' ? 'var(--accent-gold)' : 'var(--bg-elevated)',
              color: currentPage === 'rate' ? '#FFFFFF' : 'var(--text-primary)',
              border: '1px solid var(--border)',
              padding: '6px 10px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Today's Paper Rate"
          >
            <span>📋</span>
            <span>Rate</span>
          </button>

          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              cursor: 'pointer'
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Slide-Up Bottom Sheet Drawer for "More" Navigation */}
      {showMoreMenu && (
        <div
          className="modal-overlay"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="modal"
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div style={{
              width: '38px',
              height: '4px',
              background: 'var(--border)',
              borderRadius: '2px',
              margin: '10px auto 14px'
            }} />

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 18px 14px',
              borderBottom: '1px solid var(--border)'
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  PMR Operations Menu
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Logged in as {user?.name} ({isAdmin ? 'Admin' : 'Supervisor'})
                </div>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 18px 24px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginBottom: '18px'
              }}>
                <button
                  onClick={() => handleDrawerNavigate('daily-farms')}
                  style={{
                    background: currentPage === 'daily-farms' ? 'var(--primary-tint)' : 'var(--bg-card)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>🚜</span>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>Daily Farms</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Procurement & Loss</span>
                </button>

                <button
                  onClick={() => handleDrawerNavigate('daily-sheet')}
                  style={{
                    background: currentPage === 'daily-sheet' ? 'var(--primary-tint)' : 'var(--bg-card)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>🖨️</span>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>Daily Sheet</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Print & Save PDF</span>
                </button>

                <button
                  onClick={() => handleDrawerNavigate('rate')}
                  style={{
                    background: currentPage === 'rate' ? 'var(--primary-tint)' : 'var(--bg-card)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>📋</span>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>Paper Rate</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Set Benchmark Rate</span>
                </button>

                <button
                  onClick={() => handleDrawerNavigate('group-summary')}
                  style={{
                    background: currentPage === 'group-summary' ? 'var(--primary-tint)' : 'var(--bg-card)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>📑</span>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>Group Summary</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monthly Tally Ledger</span>
                </button>
              </div>

              {/* Theme quick switch in drawer */}
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{isDark ? '🌙' : '☀️'}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Theme: {isDark ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                <button
                  onClick={toggleTheme}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11.5px', padding: '4px 10px', minHeight: '32px' }}
                >
                  Switch
                </button>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={logout}
                style={{
                  width: '100%',
                  background: 'var(--red-bg)',
                  border: '1px solid var(--red)',
                  color: 'var(--red)',
                  padding: '12px',
                  borderRadius: 'var(--radius)',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>🚪</span> Sign Out from PMR System
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        {mainTabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`mobile-tab-btn ${isActive ? 'active' : ''}`}
              aria-label={tab.label}
            >
              <span className="mobile-tab-icon">{tab.icon}</span>
              <span className="mobile-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
