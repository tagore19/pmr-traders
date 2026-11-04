import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function GroupSummaryPage({ onSelectCustomer }) {
  const { user, isAdmin } = useAuth();
  const now = new Date();
  const firstDayStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [from, setFrom] = useState(firstDayStr);
  const [to, setTo] = useState(todayStr);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(user?.group_id || '');
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Load groups if admin
  useEffect(() => {
    if (isAdmin) {
      api.supervisor.getGroups().then(data => {
        setGroups(data);
        if (data.length > 0 && !selectedGroup) {
          setSelectedGroup(data[0].id);
        }
      }).catch(console.error);
    }
  }, [isAdmin]);

  const loadSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.accounting.getGroupSummary({
        group_id: selectedGroup || null,
        from,
        to,
      });
      setSummaryData(data);
    } catch (err) {
      setError(err.message || 'Failed to load group summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [selectedGroup, from, to]);

  const filteredRows = (summaryData?.rows || []).filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header Controls */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.25rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
            📑 Group Summary (Monthly Statements)
          </h1>
          <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            Tally-matched ledger summary: Opening Balance, Debits (Sales), Credits (Receipts), and Closing Balance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.4rem 0.75rem' }}>
                <span style={{ marginRight: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>👥 Group:</span>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id} style={{ background: '#1e293b' }}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.4rem 0.6rem', gap: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>From:</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
              />
              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>To:</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
              />
            </div>
          </div>

          <button
            onClick={handlePrint}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '0.55rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <span>🖨️</span> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="no-print" style={{ background: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Search customer in summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '350px', width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.55rem 0.85rem', color: '#f8fafc', fontSize: '0.9rem', outline: 'none' }}
        />
        <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
          Showing <strong>{filteredRows.length}</strong> customers • Tap customer for ledger
        </div>
      </div>

      <div className="swipe-hint no-print">👉 Swipe table sideways to inspect all columns</div>
      {/* Summary Paper / Table with mobile scroll */}
      <div className="sheet-scroll-container" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '1rem' }}>
        <div className="printable-sheet" style={{ background: '#ffffff', color: '#0f172a', borderRadius: '8px', padding: '1.5rem', minWidth: '650px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', margin: '0 auto', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
          {/* Statement Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
              P M REDDY POULTRY TRADERS
            </h1>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>Mahabubabad, Warangal</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '0.4rem', textTransform: 'uppercase' }}>
              {summaryData?.group_name || 'Group'} Summary
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.15rem' }}>
              Period: <strong>{new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> to <strong>{new Date(to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Generating group summary...</div>
          ) : (
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', color: '#0f172a', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', width: '35px' }}>#</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Particulars (Customer)</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', width: '150px' }}>Opening Balance</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', width: '135px' }}>Debit (Sales)</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', width: '135px' }}>Credit (Receipts)</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', width: '155px' }}>Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, idx) => (
                <tr
                  key={r.id}
                  onClick={() => onSelectCustomer && onSelectCustomer(r)}
                  style={{ borderBottom: '1px solid #e2e8f0', cursor: onSelectCustomer ? 'pointer' : 'default', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>
                    {r.name}
                  </td>
                  <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    {r.opening_balance > 0 ? (
                      <span>
                        {r.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {r.opening_balance_type}
                      </span>
                    ) : '0.00'}
                  </td>
                  <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: r.debit > 0 ? 600 : 400, color: r.debit > 0 ? '#0f172a' : '#94a3b8' }}>
                    {r.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: r.credit > 0 ? 600 : 400, color: r.credit > 0 ? '#10b981' : '#94a3b8' }}>
                    {r.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                    {r.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {r.closing_balance_type}
                  </td>
                </tr>
              ))}
            </tbody>
            {summaryData?.grand_total && (
              <tfoot>
                <tr style={{ background: '#f1f5f9', borderTop: '2.5px solid #0f172a', borderBottom: '2.5px solid #0f172a', fontWeight: 800, color: '#0f172a' }}>
                  <td colSpan="2" style={{ padding: '0.75rem 0.75rem', textTransform: 'uppercase' }}>
                    GRAND TOTAL ({summaryData.group_name})
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    ₹{summaryData.grand_total.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {summaryData.grand_total.opening_balance_type}
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    ₹{summaryData.grand_total.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: '#047857' }}>
                    ₹{summaryData.grand_total.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    ₹{summaryData.grand_total.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {summaryData.grand_total.closing_balance_type}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
        </div>
      </div>

      {/* Mobile Floating Print Action Button */}
      {summaryData && summaryData.rows && summaryData.rows.length > 0 && (
        <button
          type="button"
          className="show-mobile no-print"
          onClick={handlePrint}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '18px',
            zIndex: 90,
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '50px',
            padding: '0.75rem 1.35rem',
            fontWeight: 800,
            fontSize: '0.95rem',
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer'
          }}
        >
          <span>🖨️</span> Print / PDF
        </button>
      )}

      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .app-shell .sidebar,
          .mobile-header,
          .mobile-bottom-nav,
          .page-header,
          .no-print {
            display: none !important;
          }
          .main-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .printable-sheet {
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
