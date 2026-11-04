import { useState, useEffect } from 'react';
import { api } from '../api/api';

export default function NewOrderPage({ onNavigate }) {
  const today = new Date().toISOString().split('T')[0];
  const [rate, setRate] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [dailyFarms, setDailyFarms] = useState([]);
  const [todayOrders, setTodayOrders] = useState([]);
  const [form, setForm] = useState({
    date: today,
    customer_id: '',
    daily_farm_id: '',
    boxes: 1,
    weight_kg: '',
    notes: '',
  });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load rate, customers, daily farms, and orders
  const loadData = async (dateVal) => {
    try {
      const [r, c, df, ords] = await Promise.all([
        api.rates.getRateByDate(dateVal).catch(() => null),
        api.supervisor.getCustomers(),
        api.dailyFarms.getByDate(dateVal).catch(() => []),
        api.supervisor.getOrders(dateVal).catch(() => []),
      ]);
      setRate(r);
      setCustomers(c);
      setDailyFarms(df);
      setTodayOrders(ords);

      // Auto-select farm if only 1 exists
      if (df.length === 1 && !form.daily_farm_id) {
        setForm(prev => ({ ...prev, daily_farm_id: df[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(form.date);
  }, [form.date]);

  const selectedCustomer = customers.find(c => c.id === form.customer_id);
  const selectedFarm = dailyFarms.find(f => f.id === form.daily_farm_id);
  const paperRate = rate ? parseFloat(rate.paper_rate) : 0;
  const minusRate = selectedCustomer ? parseFloat(selectedCustomer.minus_rate) : 0;
  const finalRate = paperRate - minusRate;
  const weight = parseFloat(form.weight_kg) || 0;
  const boxes = parseInt(form.boxes, 10) || 1;
  const totalPrice = finalRate * weight;

  const handleBoxesChange = (delta) => {
    setForm(prev => ({ ...prev, boxes: Math.max(1, (parseInt(prev.boxes, 10) || 1) + delta) }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rate) {
      setMsg({ type: 'danger', text: `Cannot place order: Paper rate for ${form.date} has not been set yet.` });
      return;
    }
    if (!form.daily_farm_id) {
      setMsg({ type: 'danger', text: 'Please select a Daily Procurement Farm.' });
      return;
    }
    if (weight <= 0) {
      setMsg({ type: 'danger', text: 'Please enter valid weight in kg.' });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const created = await api.supervisor.submitOrder({
        customer_id: form.customer_id,
        daily_farm_id: form.daily_farm_id,
        boxes,
        weight_kg: weight,
        date: form.date,
        notes: form.notes,
      });

      setMsg({
        type: 'success',
        text: `✅ Voucher #${created.voucher_no} placed for ${selectedCustomer?.name}! (${boxes} boxes, ${weight} kg @ ₹${finalRate.toFixed(2)} = ₹${totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
      });

      // Reset form but retain date and daily farm
      setForm(prev => ({
        ...prev,
        customer_id: '',
        boxes: 1,
        weight_kg: '',
        notes: '',
      }));

      // Refresh orders and farms
      loadData(form.date);
      setTimeout(() => setMsg(null), 5000);
    } catch (err) {
      setMsg({ type: 'danger', text: err.message || 'Failed to submit order' });
    } finally {
      setSaving(false);
    }
  }

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Cancel / Delete Voucher #${order.voucher_no} for ${order.customer_name}?`)) return;
    try {
      await api.supervisor.deleteOrder(order.id);
      loadData(form.date);
    } catch (err) {
      alert(err.message || 'Failed to delete order');
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div className="page-title" style={{ fontSize: '1.6rem', fontWeight: 700 }}>📝 Record Customer Delivery Drop</div>
          <div className="page-subtitle" style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Enter farm source, customer boxes, and kg. Generates Tally-compatible sequential voucher numbers.
          </div>
        </div>

        {onNavigate && (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('daily-sheet')}>
              🖨️ Open Daily Sheet
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('daily-farms')}>
              🚜 Manage Daily Farms
            </button>
          </div>
        )}
      </div>

      {!rate && (
        <div className="alert alert-warning flex-between" style={{ alignItems: 'center', marginBottom: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', color: '#fbbf24', padding: '0.75rem 1rem', borderRadius: '8px' }}>
          <span>⚠️ Paper Rate for {form.date} has not been set yet. Please set rate to place orders.</span>
          {onNavigate && (
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('rate')}>
              📋 Set Paper Rate
            </button>
          )}
        </div>
      )}

      {dailyFarms.length === 0 && (
        <div className="alert alert-warning flex-between" style={{ alignItems: 'center', marginBottom: '1rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', color: '#7dd3fc', padding: '0.75rem 1rem', borderRadius: '8px' }}>
          <span>🚜 No Daily Procurement Farms found for {form.date}. Please add today's farms first.</span>
          {onNavigate && (
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('daily-farms')}>
              ➕ Add Daily Farm
            </button>
          )}
        </div>
      )}

      {msg && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          background: msg.type === 'success' ? '#064e3b' : '#450a0a',
          color: msg.type === 'success' ? '#a7f3d0' : '#fecaca',
          border: `1px solid ${msg.type === 'success' ? '#059669' : '#dc2626'}`
        }}>
          {msg.text}
        </div>
      )}

      <div className="order-form-grid">
        {/* Order Form */}
        <div className="card" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#f8fafc', marginBottom: '1rem' }}>
            Delivery Drop Entry
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="grid-2-col">
              <div>
                <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Date
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Procurement Farm <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={form.daily_farm_id}
                  onChange={e => setForm({ ...form, daily_farm_id: e.target.value })}
                  required
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc' }}
                >
                  <option value="">Select farm…</option>
                  {dailyFarms.map(f => (
                    <option key={f.id} value={f.id}>
                      🌾 {f.farm_name} {f.vehicle_no ? `(${f.vehicle_no})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                Customer <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="order-customer"
                className="form-input"
                value={form.customer_id}
                onChange={e => setForm({ ...form, customer_id: e.target.value })}
                required
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc' }}
              >
                <option value="">Select customer…</option>
                {customers.map(c => {
                  const adj = parseFloat(c.minus_rate || 0);
                  const adjLabel = adj > 0 ? ` (-₹${adj.toFixed(2)})` : adj < 0 ? ` (+₹${Math.abs(adj).toFixed(2)})` : '';
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name}{adjLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid-boxes-weight">
              <div>
                <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Boxes Delivered <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', height: '48px' }}>
                  <button
                    type="button"
                    onClick={() => handleBoxesChange(-1)}
                    style={{ background: '#1e293b', border: 'none', color: '#f8fafc', width: '44px', height: '100%', cursor: 'pointer', fontWeight: 800, fontSize: '1.25rem' }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={form.boxes}
                    onChange={e => setForm({ ...form, boxes: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'center', color: '#f8fafc', fontWeight: 700, outline: 'none', fontSize: '1.1rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleBoxesChange(1)}
                    style={{ background: '#1e293b', border: 'none', color: '#f8fafc', width: '44px', height: '100%', cursor: 'pointer', fontWeight: 800, fontSize: '1.25rem' }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Net Weight (kg) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="order-weight"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="form-input"
                  placeholder="e.g. 75.50"
                  value={form.weight_kg}
                  onChange={e => setForm({ ...form, weight_kg: e.target.value })}
                  required
                  style={{ width: '100%', height: '48px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc', fontSize: '1.1rem', fontWeight: 700 }}
                />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                Remarks / Notes (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. morning drop, driver Ramu"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc' }}
              />
            </div>

            <button
              id="submit-order-btn"
              type="submit"
              disabled={saving || !rate || dailyFarms.length === 0}
              style={{
                marginTop: '0.5rem',
                minHeight: '50px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.85rem',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)'
              }}
            >
              {saving ? 'Recording Order...' : '✅ Confirm & Save Delivery Drop'}
            </button>
          </form>
        </div>

        {/* Live Calculation Preview */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: '#f8fafc', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
            💡 Live Calculation Breakdown
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Paper Rate ({form.date})</span>
              <span style={{ fontWeight: 600, color: '#f8fafc' }}>₹{paperRate.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Customer Rate Adj.</span>
              <span style={{ fontWeight: 600, color: minusRate > 0 ? '#38bdf8' : minusRate < 0 ? '#10b981' : '#94a3b8' }}>
                {minusRate > 0 ? `-₹${minusRate.toFixed(2)}` : minusRate < 0 ? `+₹${Math.abs(minusRate).toFixed(2)}` : '₹0.00'}
              </span>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #334155', margin: '0.25rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Effective Rate/kg</span>
              <span style={{ fontWeight: 700, color: '#10b981', fontSize: '1.05rem' }}>
                ₹{finalRate.toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Boxes</span>
              <span style={{ fontWeight: 600, color: '#f8fafc' }}>{boxes} {boxes === 1 ? 'box' : 'boxes'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Weight</span>
              <span style={{ fontWeight: 600, color: '#f8fafc' }}>{weight.toFixed(2)} kg</span>
            </div>

            {selectedFarm && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                <span>Source Farm</span>
                <span>{selectedFarm.farm_name}</span>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid #334155', margin: '0.25rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
              <span style={{ fontWeight: 700, color: '#f8fafc' }}>Total Amount</span>
              <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#38bdf8' }}>
                ₹{totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Orders: Desktop Table + Mobile Cards */}
      <div style={{ marginTop: '2rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
            📦 Recorded Orders for {form.date} ({todayOrders.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Click cancel button to reverse an accidental drop
          </span>
        </div>

        {todayOrders.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
            No orders placed yet for {form.date}.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hide-mobile" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.65rem 1rem' }}>Voucher</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Customer</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Farm & Vehicle</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>Boxes</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Weight (kg)</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {todayOrders.map((ord) => (
                    <tr key={ord.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                        #{ord.voucher_no}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                        {ord.customer_name}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#cbd5e1' }}>
                        🌾 {ord.farm_name || 'Direct'} {ord.vehicle_no ? `(${ord.vehicle_no})` : ''}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                        {ord.boxes} b
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                        {parseFloat(ord.weight_kg).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                        {parseFloat(ord.final_rate).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }}>
                        ₹{parseFloat(ord.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteOrder(ord)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="show-mobile" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {todayOrders.map((ord) => (
                <div key={ord.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8', fontSize: '0.95rem' }}>
                      #{ord.voucher_no}
                    </span>
                    <span style={{ fontWeight: 800, color: '#10b981', fontSize: '1rem', fontFamily: 'monospace' }}>
                      ₹{parseFloat(ord.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>
                    {ord.customer_name}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    🌾 {ord.farm_name || 'Direct'} {ord.vehicle_no ? `• ${ord.vehicle_no}` : ''}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}>
                    <span>📦 <strong>{ord.boxes} b</strong></span>
                    <span>⚖️ <strong>{parseFloat(ord.weight_kg).toFixed(2)} kg</strong></span>
                    <span>Rate: <strong>₹{parseFloat(ord.final_rate).toFixed(2)}</strong></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => handleDeleteOrder(ord)}
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      🗑 Cancel Drop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
