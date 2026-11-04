import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function OrdersPage() {
  const { isAdmin } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(today);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');

  useEffect(() => {
    if (isAdmin) {
      api.admin.getGroups().then(setGroups).catch(console.error);
    }
  }, [isAdmin]);

  function load() {
    setLoading(true);
    api.supervisor.getOrders(date, selectedGroup || null)
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [date, selectedGroup]);

  const totalKg = orders.reduce((s, o) => s + (parseFloat(o.weight_kg) || 0), 0);
  const totalBoxes = orders.reduce((s, o) => s + (parseInt(o.boxes, 10) || 0), 0);
  const totalAmt = orders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete Voucher #${order.voucher_no} for ${order.customer_name}?`)) return;
    try {
      await api.supervisor.deleteOrder(order.id);
      load();
    } catch (err) {
      alert(err.message || 'Failed to delete order');
    }
  };

  return (
    <div className="page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div className="page-title" style={{ fontSize: '1.6rem', fontWeight: 700 }}>🛒 Sales Orders Register</div>
          <div className="page-subtitle" style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Daily distribution log showing vouchers, boxes, procurement farms, and billed amounts.
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Orders Count</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.25rem' }}>{orders.length}</div>
        </div>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Boxes</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>{totalBoxes} boxes</div>
        </div>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Net Weight</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.25rem', fontFamily: 'monospace' }}>
            {totalKg.toFixed(2)} kg
          </div>
        </div>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Billed Value</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem', fontFamily: 'monospace' }}>
            ₹{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="card" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.35rem 0.75rem' }}>
            <span style={{ marginRight: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>📅 Date:</span>
            <input
              type="date"
              style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.35rem 0.75rem' }}>
              <span style={{ marginRight: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>👥 Group:</span>
              <select
                style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
              >
                <option value="" style={{ background: '#1e293b' }}>All Groups</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id} style={{ background: '#1e293b' }}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Desktop View Table */}
        <div className="hide-mobile">
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state" style={{ padding: '3.5rem', textAlign: 'center' }}><div className="spinner" /></div>
            ) : orders.length === 0 ? (
              <div className="empty-state" style={{ padding: '3.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
                No orders on {date}.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.7rem 1rem' }}>Vch #</th>
                    <th style={{ padding: '0.7rem 1rem' }}>Customer</th>
                    <th style={{ padding: '0.7rem 1rem' }}>Farm & Vehicle</th>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>Boxes</th>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>Weight (kg)</th>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>Paper Rate</th>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>Rate Adj.</th>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>Final Rate</th>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>Total Amount</th>
                    <th style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const adj = parseFloat(o.applied_minus_rate);
                    const finalRate = parseFloat(o.applied_paper_rate) - adj;
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                          #{o.voucher_no}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 700, color: '#f8fafc' }}>
                          {o.customer_name}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: '#cbd5e1' }}>
                          🌾 {o.farm_name || 'Direct'} {o.vehicle_no ? `(${o.vehicle_no})` : ''}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                          {o.boxes} b
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                          {parseFloat(o.weight_kg).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>
                          ₹{parseFloat(o.applied_paper_rate).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          {adj > 0 ? (
                            <span style={{ color: '#f87171', fontWeight: 700 }}>-₹{adj.toFixed(2)}</span>
                          ) : adj < 0 ? (
                            <span style={{ color: '#34d399', fontWeight: 700 }}>+₹{Math.abs(adj).toFixed(2)}</span>
                          ) : (
                            <span style={{ color: '#64748b' }}>₹0.00</span>
                          )}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#34d399' }}>
                          ₹{finalRate.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8' }}>
                          ₹{parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDelete(o)}
                            style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Mobile View: High-Ergonomics Touch Cards */}
        <div className="show-mobile" style={{ padding: '0.75rem' }}>
          {loading ? (
            <div className="empty-state" style={{ padding: '3.5rem', textAlign: 'center' }}><div className="spinner" /></div>
          ) : orders.length === 0 ? (
            <div className="empty-state" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              No orders on {date}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {orders.map(o => {
                const adj = parseFloat(o.applied_minus_rate);
                const finalRate = parseFloat(o.applied_paper_rate) - adj;
                return (
                  <div
                    key={o.id}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8', fontSize: '0.9rem' }}>
                        Vch #{o.voucher_no}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(o)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>

                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                      {o.customer_name}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      🌾 {o.farm_name || 'Direct'} {o.vehicle_no ? `• ${o.vehicle_no}` : ''}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#1e293b', padding: '0.6rem 0.75rem', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Quantity</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                          {parseFloat(o.weight_kg).toFixed(2)} kg <span style={{ color: '#38bdf8' }}>({o.boxes} b)</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Final Rate</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>
                          ₹{finalRate.toFixed(2)}/kg
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem', borderTop: '1px dashed #334155' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Billed:</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                        ₹{parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
