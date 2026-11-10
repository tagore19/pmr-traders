import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function DailySheetPage() {
  const { user, isAdmin } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(user?.group_id || '');
  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // Load daily sheet
  const loadSheet = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.sheets.getDaily(selectedDate, selectedGroup || null);
      setSheetData(data);
    } catch (err) {
      setError(err.message || 'Failed to load daily sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSheet();
  }, [selectedDate, selectedGroup]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Non-print controls bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            🖨️ Daily Farm-Wise Distribution Sheet
          </h1>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Formatted for official A4 printing and PDF generation per supervisor team.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}>
                <span style={{ marginRight: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>👥 Group:</span>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}>
              <span style={{ marginRight: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>📅 Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
              />
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="btn btn-primary"
            style={{
              padding: '0.55rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>🖨️</span> Print / Save PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger no-print">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Generating distribution sheet...</div>
      ) : !sheetData || sheetData.farms.length === 0 ? (
        <div className="card no-print" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>No orders recorded for {selectedDate}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0.5rem auto' }}>
            There are no customer delivery orders placed for {sheetData?.group_name || 'this group'} on this date yet.
          </p>
        </div>
      ) : (
        <>
          <div className="swipe-hint no-print">👉 Swipe table sideways to inspect full sheet</div>
          {/* Printable Sheet Paper Layout with mobile horizontal scroll */}
          <div className="sheet-scroll-container" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '1rem' }}>
          <div className="printable-sheet" style={{ background: '#ffffff', color: '#0f172a', borderRadius: '8px', padding: '1.5rem', minWidth: '650px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: '900px', margin: '0 auto', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, letterSpacing: '0.04em', color: '#0f172a', textTransform: 'uppercase' }}>
              P M REDDY POULTRY TRADERS
            </h1>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', marginTop: '0.2rem' }}>
              Mahabubabad, Warangal
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.9rem', fontWeight: 600 }}>
              <span style={{ textTransform: 'uppercase', color: '#1e293b', background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                📋 {sheetData.group_name}
              </span>
              <span>
                📅 Date: <strong>{new Date(sheetData.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
              </span>
              {sheetData.paper_rate && (
                <span>
                  Paper Rate: <strong>₹{parseFloat(sheetData.paper_rate).toFixed(2)}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Farm-Wise Sections */}
          {sheetData.farms.map((farm, farmIdx) => (
            <div key={farm.farm_id} style={{ marginBottom: '1.75rem', pageBreakInside: 'avoid' }}>
              {/* Farm Section Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderLeft: '4px solid #0f172a', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', textTransform: 'uppercase' }}>
                <span>
                  🌾 {farm.farm_name} {farm.vehicle_no ? `(Vehicle: ${farm.vehicle_no})` : ''}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>
                  Total Orders: {farm.orders.length}
                </span>
              </div>

              {/* Farm Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #0f172a', color: '#334155', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '40px' }}>S.No</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Customer Name</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '85px' }}>Boxes</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', width: '110px' }}>Weight (kg)</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', width: '90px' }}>Rate (₹)</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', width: '120px' }}>Price (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {farm.orders.map((item, itemIdx) => (
                    <tr key={item.order_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center', color: '#64748b' }}>
                        {itemIdx + 1}.
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>
                        {item.customer_name}
                        {item.notes && <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem', fontWeight: 400 }}>({item.notes})</span>}
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>
                        {item.boxes} {item.boxes === 1 ? 'box' : 'boxes'}
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {item.weight_kg.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                        {item.rate.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                        {item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', fontWeight: 700, color: '#0f172a' }}>
                    <td colSpan="2" style={{ padding: '0.55rem 0.75rem', textTransform: 'uppercase' }}>
                      TOTAL FOR {farm.farm_name}:
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: '#0f172a' }}>
                      {farm.subtotal.boxes} boxes
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                      {farm.subtotal.weight_kg.toFixed(2)} kgs
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem', color: '#475569' }}>
                      Avg ₹{farm.subtotal.avg_rate.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                      ₹{farm.subtotal.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Transit & Vehicle Reconciliation */}
              {farm.reconciliation && farm.reconciliation.intake_boxes > 0 && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderTop: 'none',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8rem',
                  color: '#334155',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>
                      📥 <strong>Farm Intake:</strong> {farm.reconciliation.intake_weight_kg.toFixed(2)} kg ({farm.reconciliation.intake_boxes} b @ {farm.reconciliation.avg_intake_box_kg.toFixed(2)} kg/b)
                    </span>
                    <span>
                      🚚 <strong>Dispatched:</strong> {farm.reconciliation.dispatched_weight_kg.toFixed(2)} kg ({farm.reconciliation.dispatched_boxes} b @ {farm.reconciliation.avg_dispatched_box_kg.toFixed(2)} kg/b)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {farm.reconciliation.weight_loss_kg > 0 ? (
                      <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                        📉 Transit Loss: {farm.reconciliation.weight_loss_kg.toFixed(2)} kg ({farm.reconciliation.weight_loss_pct.toFixed(2)}%)
                        {farm.reconciliation.avg_loss_per_box_kg > 0 && (
                          <span style={{ fontWeight: 500, marginLeft: '0.3rem', color: '#64748b' }}>
                            (~{farm.reconciliation.avg_loss_per_box_kg.toFixed(2)} kg/b)
                          </span>
                        )}
                      </span>
                    ) : farm.reconciliation.remaining_boxes > 0 ? (
                      <span style={{ color: '#2563eb', fontWeight: 600 }}>
                        📦 On Truck: {farm.reconciliation.remaining_boxes} boxes remaining
                      </span>
                    ) : (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        ✅ Clean Reconciliation (0 Loss)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Grand Total Summary Box */}
          <div style={{ marginTop: '2rem', border: '2px solid #0f172a', borderRadius: '6px', background: '#f1f5f9', padding: '0.85rem 1.25rem', pageBreakInside: 'avoid' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', fontWeight: 700 }}>
                  DAILY GRAND TOTAL ({sheetData.group_name})
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' }}>
                  Total Deliveries: {sheetData.total_orders_count} orders across {sheetData.farms.length} farm(s)
                </div>
              </div>

              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Total Boxes</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{sheetData.grand_total.boxes} boxes</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Total Weight</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                    {sheetData.grand_total.weight_kg.toFixed(2)} kgs
                  </div>
                </div>

                {sheetData.grand_total.total_weight_loss_kg > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#dc2626', textTransform: 'uppercase', fontWeight: 700 }}>Total Weight Loss</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                      {sheetData.grand_total.total_weight_loss_kg.toFixed(2)} kgs
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '0.25rem', color: '#b91c1c' }}>
                        ({sheetData.grand_total.overall_loss_pct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Total Amount</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                    ₹{sheetData.grand_total.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Signature Lines */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3.5rem', paddingTop: '1.5rem', fontSize: '0.85rem', color: '#475569', pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '0.4rem', fontWeight: 600 }}>
                Supervisor Signature
              </div>
            </div>
            <div style={{ textAlign: 'center', width: '200px' }}>
              <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '0.4rem', fontWeight: 600 }}>
                Authorized / Admin
              </div>
            </div>
          </div>
        </div>
        </div>
        </>
      )}

      {/* Mobile Floating Print Action Button */}
      {sheetData && sheetData.farms && sheetData.farms.length > 0 && (
        <button
          type="button"
          className="show-mobile no-print"
          onClick={handlePrint}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '18px',
            zIndex: 90,
            background: 'var(--primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '50px',
            padding: '0.75rem 1.35rem',
            fontWeight: 800,
            fontSize: '0.95rem',
            boxShadow: '0 8px 24px var(--primary-glow)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer'
          }}
        >
          <span>🖨️</span> Print / PDF
        </button>
      )}

      {/* Print Styles */}
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
