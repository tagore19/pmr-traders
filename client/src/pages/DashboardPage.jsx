import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const [todayRate, setTodayRate] = useState(null);
  const [orders, setOrders] = useState([]);
  const [dailyFarms, setDailyFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    (async () => {
      try {
        const [rate, ord, farms] = await Promise.all([
          api.rates.getTodayRate().catch(() => null),
          api.supervisor.getOrders(today).catch(() => []),
          api.dailyFarms.getByDate(today).catch(() => []),
        ]);
        setTodayRate(rate);
        setOrders(ord);
        setDailyFarms(farms);
      } finally {
        setLoading(false);
      }
    })();
  }, [today]);

  const totalKg = orders.reduce((s, o) => s + (parseFloat(o.weight_kg) || 0), 0);
  const totalBoxes = orders.reduce((s, o) => s + (parseInt(o.boxes, 10) || 0), 0);
  const totalAmt = orders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);

  const totalProcuredKg = dailyFarms.reduce((s, f) => s + (parseFloat(f.total_weight_kg) || 0), 0);
  const totalProcuredBoxes = dailyFarms.reduce((s, f) => s + (parseInt(f.total_boxes, 10) || 0), 0);
  const totalProcurementCost = dailyFarms.reduce((s, f) => s + (parseFloat(f.total_procurement_cost) || 0), 0);
  const grossMargin = totalAmt - totalProcurementCost;

  return (
    <div className="page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div className="page-title" style={{ fontSize: '1.6rem', fontWeight: 700 }}>📊 Operations Dashboard</div>
        <div className="page-subtitle" style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{todayLabel} • Real-time PMR Distribution Monitor</div>
      </div>

      {!todayRate && !loading && (
        <div className="alert alert-warning" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', color: '#fbbf24', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
          ⚠️ Today's Paper Rate has not been set yet. Supervisors cannot place orders until today's rate is configured.
        </div>
      )}

      {/* KPI Cards */}
      <div className="stats-grid">
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.15rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>Today's Paper Rate</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            ₹{todayRate ? parseFloat(todayRate.paper_rate).toFixed(2) : '—'}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.2rem' }}>Benchmark rate</div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.15rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>Daily Farms Intake</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem', fontFamily: 'monospace' }}>
            {loading ? '…' : totalProcuredKg.toFixed(1)} kg
          </div>
          <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.2rem' }}>
            {totalProcuredBoxes} b • {dailyFarms.length} farm(s)
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.15rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>Orders Dispatched</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
            {loading ? '…' : `${orders.length} drops`}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.2rem' }}>
            {totalBoxes} b • {totalKg.toFixed(1)} kg
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.15rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>Total Billed Today</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem', fontFamily: 'monospace' }}>
            ₹{loading ? '…' : totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.2rem' }}>Gross sales value</div>
        </div>

        {/* Admin Only KPI Cards */}
        {isAdmin && (
          <>
            <div style={{ background: '#1e293b', border: '1.5px solid #0284c7', borderRadius: '12px', padding: '1rem 1.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#38bdf8', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  🔐 Farm Cost
                </span>
                <span style={{ fontSize: '0.65rem', background: '#0369a1', color: '#f0f9ff', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                  ADMIN
                </span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                ₹{loading ? '…' : totalProcurementCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.2rem' }}>Intake payable</div>
            </div>

            <div style={{ background: '#1e293b', border: `1.5px solid ${grossMargin >= 0 ? '#059669' : '#dc2626'}`, borderRadius: '12px', padding: '1rem 1.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: grossMargin >= 0 ? '#34d399' : '#f87171', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  🔐 Gross Margin
                </span>
                <span style={{ fontSize: '0.65rem', background: grossMargin >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: grossMargin >= 0 ? '#34d399' : '#f87171', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                  ADMIN
                </span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: grossMargin >= 0 ? '#10b981' : '#ef4444', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                {grossMargin >= 0 ? '+' : ''}₹{loading ? '…' : grossMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.2rem' }}>Sales minus Farm Cost</div>
            </div>
          </>
        )}
      </div>

      {/* Procurement Farms Live Status */}
      {dailyFarms.length > 0 && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
            🌾 Today's Farm Procurement Inflow ({dailyFarms.length} active)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
            {dailyFarms.map(f => {
              const weight = parseFloat(f.total_weight_kg) || 0;
              const disp = parseFloat(f.total_dispatched_kg) || 0;
              const rem = weight - disp;
              const rate = parseFloat(f.rate_per_kg) || 0;
              const cost = parseFloat(f.total_procurement_cost) || 0;

              return (
                <div key={f.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#f8fafc' }}>{f.farm_name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#1e293b', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      {f.vehicle_no || 'Direct'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '0.4rem' }}>
                    <span style={{ color: '#94a3b8' }}>Procured: {weight.toFixed(1)} kg ({f.total_boxes} b)</span>
                    <span style={{ color: rem < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                      Left: {rem.toFixed(1)} kg
                    </span>
                  </div>

                  {/* Admin Only Purchase Rate & Cost */}
                  {isAdmin && (
                    <div style={{ marginTop: '0.45rem', paddingTop: '0.35rem', borderTop: '1px dashed #334155', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                        {rate > 0 ? `Rate: ₹${rate.toFixed(2)}/kg` : 'Rate: Not set'}
                      </span>
                      <span style={{ color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>
                        Cost: ₹{cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's Recent Orders: Desktop Table + Mobile Cards */}
      <div className="card" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title" style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>Today's Orders Register</span>
          <span className="badge badge-blue" style={{ background: '#0369a1', color: '#f0f9ff', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
            {orders.length} orders
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="table-wrap hide-mobile">
          {loading ? (
            <div className="empty-state" style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" /></div>
          ) : orders.length === 0 ? (
            <div className="empty-state" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              No orders logged today yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.65rem 1rem' }}>Vch #</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Customer</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Farm</th>
                  <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>Boxes</th>
                  <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>KG</th>
                  <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Final Rate</th>
                  <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                        #{o.voucher_no}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#f8fafc' }}>{o.customer_name}</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#cbd5e1' }}>🌾 {o.farm_name || 'Direct'}</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'center', fontWeight: 600 }}>{o.boxes} b</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>{parseFloat(o.weight_kg).toFixed(2)}</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>
                        ₹{parseFloat(o.final_rate).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8' }}>
                        ₹{parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>{o.supervisor_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile Cards View */}
        <div className="show-mobile" style={{ padding: '0.75rem' }}>
          {loading ? (
            <div className="empty-state" style={{ padding: '2.5rem', textAlign: 'center' }}><div className="spinner" /></div>
          ) : orders.length === 0 ? (
            <div className="empty-state" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              No orders logged today yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {orders.map(o => (
                <div
                  key={o.id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8', fontSize: '0.92rem' }}>
                      #{o.voucher_no}
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                      ₹{parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                    {o.customer_name}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    🌾 {o.farm_name || 'Direct'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', borderRadius: '8px', padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}>
                    <span>📦 <strong>{o.boxes} b</strong></span>
                    <span>⚖️ <strong>{parseFloat(o.weight_kg).toFixed(2)} kg</strong></span>
                    <span>Rate: <strong style={{ color: '#10b981' }}>₹{parseFloat(o.final_rate).toFixed(2)}</strong></span>
                  </div>

                  {o.supervisor_name && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
                      Logged by: {o.supervisor_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
