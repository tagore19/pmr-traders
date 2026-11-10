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
    <div className="page" style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* Header Controls */}
      <div className="no-print" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 18px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '18px' }}>
            <span>📑</span>
            <span>Group Summary & Monthly Statements</span>
          </h1>
          <p className="page-subtitle">
            Tally-matched ledger summary: Opening Balance, Debits (Sales), Credits (Receipts), and Closing Balance
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="btn btn-primary"
          style={{ minHeight: '40px', padding: '8px 16px', fontWeight: 700 }}
        >
          <span>🖨️</span> Print Statement
        </button>
      </div>

      {error && <div className="alert alert-danger no-print">{error}</div>}

      {/* Date & Group Filters Bar */}
      <div className="no-print" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && groups.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Group:</span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>From:</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 8px',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>To:</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 8px',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <input
          type="text"
          placeholder="🔍 Search customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            outline: 'none',
            maxWidth: '180px'
          }}
        />
      </div>

      {/* Mobile Cards View (for Phone Screen) */}
      <div className="show-mobile no-print" style={{ marginBottom: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Loading summary…</div>
        ) : filteredRows.length === 0 ? (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No customer records found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredRows.map((r, idx) => (
              <div
                key={r.id}
                className="card"
                style={{ padding: '12px 14px', cursor: onSelectCustomer ? 'pointer' : 'default' }}
                onClick={() => onSelectCustomer && onSelectCustomer(r)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--primary)' }}>
                    {idx + 1}. {r.name}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontWeight: 900,
                      fontSize: '15.5px',
                      color: r.closing_balance_type === 'Dr' ? 'var(--red)' : 'var(--green)',
                      fontFamily: 'monospace'
                    }}>
                      ₹{r.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {r.closing_balance_type}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  background: 'var(--bg-subtle)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '8px',
                  fontSize: '11.5px'
                }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Opening</div>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      ₹{r.opening_balance > 0 ? r.opening_balance.toLocaleString('en-IN') : '0'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Debits (Sales)</div>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      ₹{r.debit.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Credits (Receipts)</div>
                    <div style={{ fontWeight: 700, color: 'var(--green)', fontFamily: 'monospace' }}>
                      ₹{r.credit.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Printable Sheet & Desktop Table */}
      <div className="sheet-scroll-container hide-mobile" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '1rem' }}>
        <div className="printable-sheet" style={{ background: '#ffffff', color: '#0f172a', borderRadius: '8px', padding: '1.5rem', minWidth: '650px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
          {/* Statement Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
              P M REDDY POULTRY TRADERS
            </h1>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Mahabubabad, Warangal</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.3rem', textTransform: 'uppercase' }}>
              {summaryData?.group_name || 'Group'} Summary
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.15rem' }}>
              Period: <strong>{new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> to <strong>{new Date(to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Generating group summary...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
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
                  <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>{r.name}</td>
                    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                      {r.opening_balance > 0 ? `${r.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${r.opening_balance_type}` : '0.00'}
                    </td>
                    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                      {r.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: '#047857' }}>
                      {r.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                      {r.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {r.closing_balance_type}
                    </td>
                  </tr>
                ))}
              </tbody>
              {summaryData?.grand_total && (
                <tfoot>
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 800, color: '#0f172a' }}>
                    <td colSpan="2" style={{ padding: '0.65rem 0.75rem', textTransform: 'uppercase' }}>GRAND TOTAL:</td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                      {summaryData.grand_total.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                      {summaryData.grand_total.total_debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', color: '#047857' }}>
                      {summaryData.grand_total.total_credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '1rem' }}>
                      {summaryData.grand_total.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {summaryData.grand_total.closing_balance_type}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
