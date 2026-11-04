import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function MobileNav({ currentPage, onNavigate }) {
  const { user, logout, isAdmin } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const mainTabs = isAdmin ? [
    { id: 'dashboard',   label: 'Dashboard', icon: '📊' },
    { id: 'daily-farms', label: 'Farms',     icon: '🚜' },
    { id: 'new-order',   label: 'New Drop',  icon: '📝' },
    { id: 'daily-sheet', label: 'Sheet',     icon: '🖨️' },
    { id: 'customers',   label: 'Customers', icon: '👥' },
  ] : [
    { id: 'new-order',   label: 'New Drop',  icon: '📝' },
    { id: 'daily-farms', label: 'Farms',     icon: '🚜' },
    { id: 'daily-sheet', label: 'Sheet',     icon: '🖨️' },
    { id: 'customers',   label: 'Customers', icon: '👥' },
  ];

  const handleTabClick = (pageId) => {
    setShowMenu(false);
    onNavigate(pageId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            🐔
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>PMR Traders</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {isAdmin ? 'Admin' : user?.name || 'Supervisor'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => handleTabClick('rate')}
            className="mobile-header-btn"
            style={{
              background: currentPage === 'rate' ? '#38bdf8' : '#1e293b',
              color: currentPage === 'rate' ? '#0f172a' : '#f8fafc',
              border: '1px solid #334155',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            📋 Rate
          </button>

          <button
            onClick={() => setShowMenu(true)}
            className="mobile-header-btn"
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700
            }}
            title="More Options"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Slide-up Menu Drawer for More items */}
      {showMenu && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease'
          }}
          onClick={() => setShowMenu(false)}
        >
          <div
            style={{
              background: '#1e293b',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              borderTop: '1px solid #475569',
              padding: '1.25rem 1.25rem 2rem',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 -10px 25px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', background: '#475569', borderRadius: '2px', margin: '0 auto 1.25rem' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>PMR Navigation Menu</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Logged in as {user?.name}</div>
              </div>
              <button
                onClick={() => setShowMenu(false)}
                style={{ background: '#334155', border: 'none', color: '#f8fafc', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <button
                onClick={() => handleTabClick('dashboard')}
                style={{ background: currentPage === 'dashboard' ? '#2563eb' : '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.75rem', borderRadius: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>📊</div>
                Dashboard
              </button>

              <button
                onClick={() => handleTabClick('new-order')}
                style={{ background: currentPage === 'new-order' ? '#2563eb' : '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.75rem', borderRadius: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>📝</div>
                New Drop
              </button>

              <button
                onClick={() => handleTabClick('daily-farms')}
                style={{ background: currentPage === 'daily-farms' ? '#2563eb' : '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.75rem', borderRadius: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>🚜</div>
                Daily Farms
              </button>

              <button
                onClick={() => handleTabClick('customers')}
                style={{ background: currentPage === 'customers' ? '#2563eb' : '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.75rem', borderRadius: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>👥</div>
                Customers
              </button>

              <button
                onClick={() => handleTabClick('rate')}
                style={{ background: currentPage === 'rate' ? '#2563eb' : '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.75rem', borderRadius: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>📋</div>
                Paper Rate
              </button>

              <button
                onClick={() => handleTabClick('daily-sheet')}
                style={{ background: currentPage === 'daily-sheet' ? '#2563eb' : '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.75rem', borderRadius: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>🖨️</div>
                Daily Sheet
              </button>

              <button
                onClick={() => handleTabClick('group-summary')}
                style={{ background: currentPage === 'group-summary' ? '#2563eb' : '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.75rem', borderRadius: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>📑</div>
                Group Summary
              </button>

              <button
                onClick={() => handleTabClick('orders')}
                style={{ background: currentPage === 'orders' ? '#2563eb' : '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '0.75rem', borderRadius: '10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem' }}
              >
                <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>🛒</div>
                Sales Register
              </button>
            </div>

            <button
              onClick={logout}
              style={{
                width: '100%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '0.85rem',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              ⬅ Sign Out from PMR System
            </button>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar for Mobile Phones */}
      <nav className="mobile-bottom-nav">
        {mainTabs.map(tab => {
          const isActive = currentPage === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`mobile-tab-btn ${isActive ? 'active' : ''}`}
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
