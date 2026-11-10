import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage({ onNavigate }) {
  const { isAdmin } = useAuth();
  const [todayRate, setTodayRate] = useState(null);
  const [orders, setOrders] = useState([]);
  const [dailyFarms, setDailyFarms] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  useEffect(() => {
    (async () => {
      try {
        const [rate, ord, farms, sum] = await Promise.all([
          api.rates.getTodayRate().catch(() => null),
          api.supervisor.getOrders(today).catch(() => []),
          api.dailyFarms.getByDate(today).catch(() => []),
          api.accounting.getGroupSummary().catch(() => null),
        ]);
        setTodayRate(rate);
        setOrders(ord);
        setDailyFarms(farms);
        setSummaryData(sum);
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

  // Outstanding due from group summary
  const rows = summaryData?.rows || [];
  const totalOutstandingDue = rows
    .filter(r => r.closing_balance_type === 'Dr')
    .reduce((sum, r) => sum + r.closing_balance, 0);

  return (
    <div className="page" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">
              <span>🏠</span>
              <span>PMR Dashboard</span>
            </h1>
            <p className="page-subtitle">
              {todayLabel} • Live Daily Operations & Ledger
            </p>
          </div>

          {todayRate && (
            <div style={{
              background: 'var(--accent-gold-bg)',
              border: '1.5px solid var(--accent-gold)',
              borderRadius: 'var(--radius)',
              padding: '6px 12px',
              textAlign: 'right'
            }}>
              <div style={{ fontSize: '10px', color: 'var(--accent-gold)', fontWeight: 800, textTransform: 'uppercase' }}>
                Paper Rate
              </div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--accent-gold)', fontFamily: 'monospace' }}>
                ₹{parseFloat(todayRate.paper_rate).toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warning banner if paper rate not set */}
      {!todayRate && !loading && (
        <div
          className="alert alert-warning"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate && onNavigate('rate')}
        >
          <span>⚠️ Today's Paper Rate is not set yet. <strong>Tap here to configure today's paper rate.</strong></span>
        </div>
      )}

      {/* Primary Financial Overview Hero Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, #102B23 100%)',
          color: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 22px',
          boxShadow: 'var(--shadow)',
          marginBottom: '18px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.85, fontWeight: 700 }}>
          Today's Billed Sales Revenue
        </div>
        <div style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '-0.5px', marginTop: '4px' }}>
          ₹{loading ? '…' : totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '13px', opacity: 0.9 }}>
          <span>📦 <strong>{totalBoxes}</strong> boxes sold</span>
          <span>•</span>
          <span>⚖️ <strong>{totalKg.toFixed(1)}</strong> kg net</span>
          <span>•</span>
          <span>🚚 <strong>{orders.length}</strong> drops</span>
        </div>
      </div>

      {/* Quick Action Buttons (Thumb Zone) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => onNavigate && onNavigate('sales')}
          className="btn btn-secondary"
          style={{
            flexDirection: 'column',
            padding: '10px 4px',
            minHeight: '68px',
            borderRadius: 'var(--radius)',
            gap: '4px',
            background: 'var(--bg-card)'
          }}
        >
          <span style={{ fontSize: '20px' }}>📝</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>New Drop</span>
        </button>

        <button
          onClick={() => onNavigate && onNavigate('payments')}
          className="btn btn-secondary"
          style={{
            flexDirection: 'column',
            padding: '10px 4px',
            minHeight: '68px',
            borderRadius: 'var(--radius)',
            gap: '4px',
            background: 'var(--bg-card)'
          }}
        >
          <span style={{ fontSize: '20px' }}>💵</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Receive ₹</span>
        </button>

        <button
          onClick={() => onNavigate && onNavigate('customers')}
          className="btn btn-secondary"
          style={{
            flexDirection: 'column',
            padding: '10px 4px',
            minHeight: '68px',
            borderRadius: 'var(--radius)',
            gap: '4px',
            background: 'var(--bg-card)'
          }}
        >
          <span style={{ fontSize: '20px' }}>👥</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Customers</span>
        </button>

        <button
          onClick={() => onNavigate && onNavigate('daily-farms')}
          className="btn btn-secondary"
          style={{
            flexDirection: 'column',
            padding: '10px 4px',
            minHeight: '68px',
            borderRadius: 'var(--radius)',
            gap: '4px',
            background: 'var(--bg-card)'
          }}
        >
          <span style={{ fontSize: '20px' }}>🚜</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Farms</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-label">Total Outstanding Debt</div>
          <div className="stat-value" style={{ color: 'var(--red)', fontSize: '22px' }}>
            ₹{loading ? '…' : totalOutstandingDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-sub">Pending customer balance (Dr)</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Farm Intake Inflow</div>
          <div className="stat-value" style={{ fontSize: '22px' }}>
            {loading ? '…' : totalProcuredKg.toFixed(1)} kg
          </div>
          <div className="stat-sub">{totalProcuredBoxes} boxes loaded ({dailyFarms.length} farms)</div>
        </div>

        {/* Admin Financial KPIs */}
        {isAdmin && (
          <>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-gold)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">🔐 Farm Purchase Cost</span>
                <span className="badge badge-gold" style={{ fontSize: '9px' }}>ADMIN</span>
              </div>
              <div className="stat-value" style={{ fontSize: '22px' }}>
                ₹{loading ? '…' : totalProcurementCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="stat-sub">Procurement payable</div>
            </div>

            <div className="stat-card" style={{ borderLeft: `3px solid ${grossMargin >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">🔐 Gross Trading Margin</span>
                <span className="badge badge-green" style={{ fontSize: '9px' }}>ADMIN</span>
              </div>
              <div className="stat-value" style={{ color: grossMargin >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '22px' }}>
                {grossMargin >= 0 ? '+' : ''}₹{loading ? '…' : grossMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="stat-sub">Sales revenue minus farm cost</div>
            </div>
          </>
        )}
      </div>

      {/* Farm Procurement Status Strip */}
      {dailyFarms.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">🚜 Today's Farm Trucks ({dailyFarms.length})</span>
            <button
              onClick={() => onNavigate && onNavigate('daily-farms')}
              style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}
            >
              Manage
            </button>
          </div>

          <div className="card-body" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dailyFarms.map((f) => {
                const rem = parseFloat(f.remaining_kg) || 0;
                const remBoxes = parseInt(f.remaining_boxes, 10) || 0;
                return (
                  <div
                    key={f.id}
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {f.farm_name} {f.vehicle_no ? `(${f.vehicle_no})` : ''}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Intake: {parseFloat(f.total_weight_kg).toFixed(1)} kg ({f.total_boxes} b)
                        {f.weight_loss_kg > 0 ? ` • 📉 Loss: ${parseFloat(f.weight_loss_kg).toFixed(1)} kg` : ''}
                      </div>
                    </div>

                    <div>
                      <span className={`badge ${remBoxes === 0 ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '11.5px' }}>
                        {remBoxes === 0 ? '✅ All Dropped' : `🚚 ${remBoxes} b left (${rem.toFixed(1)} kg)`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent Dispatched Drops */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">📋 Today's Delivery Drops ({orders.length})</span>
          <button
            onClick={() => onNavigate && onNavigate('sales')}
            style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}
          >
            View Register
          </button>
        </div>

        <div className="card-body" style={{ padding: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading orders…</div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No orders logged today yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {orders.slice(0, 5).map((o) => (
                <div
                  key={o.id}
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {o.customer_name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Voucher #{o.voucher_no} • {o.boxes} b • {parseFloat(o.weight_kg).toFixed(1)} kg @ ₹{parseFloat(o.final_rate).toFixed(2)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--primary)', fontFamily: 'monospace' }}>
                      ₹{parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
