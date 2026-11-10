import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function SalesPage({ onNavigate, initialTab = 'new' }) {
  const { isAdmin } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState(initialTab); // 'new' | 'orders'
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Data states
  const [rate, setRate] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [dailyFarms, setDailyFarms] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Form states
  const [form, setForm] = useState({
    customer_id: '',
    daily_farm_id: '',
    boxes: 1,
    weight_kg: '',
    notes: '',
  });

  // Group filter for Admin in register
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');

  // Load groups for admin
  useEffect(() => {
    if (isAdmin) {
      api.admin.getGroups().then(setGroups).catch(console.error);
    }
  }, [isAdmin]);

  // Load data for the selected date
  const loadData = async (dateVal) => {
    setLoading(true);
    try {
      const [r, c, df, ords] = await Promise.all([
        api.rates.getRateByDate(dateVal).catch(() => null),
        api.supervisor.getCustomers().catch(() => []),
        api.dailyFarms.getByDate(dateVal).catch(() => []),
        api.supervisor.getOrders(dateVal, selectedGroup || null).catch(() => []),
      ]);
      setRate(r);
      setCustomers(c);
      setDailyFarms(df);
      setOrders(ords);

      // Auto-select farm if only 1 exists and none selected
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
    loadData(selectedDate);
  }, [selectedDate, selectedGroup]);

  // Calculations for New Drop
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rate) {
      setMsg({ type: 'danger', text: `Cannot record drop: Paper rate for ${selectedDate} has not been set yet.` });
      return;
    }
    if (!form.daily_farm_id) {
      setMsg({ type: 'danger', text: 'Please select a Daily Procurement Farm.' });
      return;
    }
    if (!form.customer_id) {
      setMsg({ type: 'danger', text: 'Please select a Customer.' });
      return;
    }
    if (weight <= 0) {
      setMsg({ type: 'danger', text: 'Please enter a valid weight in kg.' });
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
        date: selectedDate,
        notes: form.notes,
      });

      setMsg({
        type: 'success',
        text: `✅ Voucher #${created.voucher_no} recorded for ${selectedCustomer?.name}! (${boxes} boxes, ${weight} kg @ ₹${finalRate.toFixed(2)} = ₹${totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
      });

      // Reset form but retain date and daily farm
      setForm(prev => ({
        ...prev,
        customer_id: '',
        boxes: 1,
        weight_kg: '',
        notes: '',
      }));

      loadData(selectedDate);
      setTimeout(() => setMsg(null), 5000);
    } catch (err) {
      setMsg({ type: 'danger', text: err.message || 'Failed to submit order' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Cancel & delete Voucher #${order.voucher_no} for ${order.customer_name}?`)) return;
    try {
      await api.supervisor.deleteOrder(order.id);
      loadData(selectedDate);
    } catch (err) {
      alert(err.message || 'Failed to delete order');
    }
  };

  // Register summary calculations
  const totalKg = orders.reduce((s, o) => s + (parseFloat(o.weight_kg) || 0), 0);
  const totalBoxes = orders.reduce((s, o) => s + (parseInt(o.boxes, 10) || 0), 0);
  const totalAmt = orders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);

  return (
    <div className="page" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Page Title */}
      <div className="page-header" style={{ marginBottom: '14px' }}>
        <h1 className="page-title">
          <span>📝</span>
          <span>Sales & Deliveries</span>
        </h1>
        <p className="page-subtitle">Record daily customer drops and view the sales register</p>
      </div>

      {/* Segmented Tab Switcher (Thumb Ergonomics) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: 'var(--bg-elevated)',
        padding: '4px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        marginBottom: '18px'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('new')}
          style={{
            minHeight: '44px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
            fontSize: '13.5px',
            background: activeTab === 'new' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'new' ? 'var(--primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'new' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all var(--transition)'
          }}
        >
          <span>➕</span>
          <span>Record New Drop</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          style={{
            minHeight: '44px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
            fontSize: '13.5px',
            background: activeTab === 'orders' ? 'var(--bg-surface)' : 'transparent',
            color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'orders' ? 'var(--shadow-sm)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all var(--transition)'
          }}
        >
          <span>📋</span>
          <span>Orders Register ({orders.length})</span>
        </button>
      </div>

      {/* Date Bar & Paper Rate Status */}
      <div style={{
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>📅 Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: '13.5px',
              fontWeight: 600,
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rate ? (
            <div style={{
              background: 'var(--accent-gold-bg)',
              border: '1px solid var(--accent-gold)',
              borderRadius: '999px',
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--accent-gold)', fontWeight: 800 }}>PAPER RATE</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-gold)', fontFamily: 'monospace' }}>
                ₹{parseFloat(rate.paper_rate).toFixed(2)}
              </span>
            </div>
          ) : (
            <button
              onClick={() => onNavigate && onNavigate('rate')}
              style={{
                background: 'var(--amber-bg)',
                border: '1px solid var(--amber)',
                color: 'var(--amber)',
                borderRadius: '999px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ⚠️ No Rate Set (Tap to Set)
            </button>
          )}
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* ──────────────── TAB 1: RECORD NEW DROP ──────────────── */}
      {activeTab === 'new' && (
        <div>
          <form onSubmit={handleSubmit}>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header">
                <span className="card-title">📦 Customer Drop Entry</span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Required fields *</span>
              </div>

              <div className="card-body">
                {/* 1. Daily Farm Selection */}
                <div className="form-group">
                  <label className="form-label">
                    🚜 Procurement Farm <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  {dailyFarms.length === 0 ? (
                    <div style={{
                      padding: '12px',
                      background: 'var(--amber-bg)',
                      border: '1px solid var(--amber)',
                      borderRadius: 'var(--radius)',
                      color: 'var(--amber)',
                      fontSize: '13px'
                    }}>
                      ⚠️ No procurement farms recorded for {selectedDate}.{' '}
                      <button
                        type="button"
                        onClick={() => onNavigate && onNavigate('daily-farms')}
                        style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        Add Farm First
                      </button>
                    </div>
                  ) : (
                    <select
                      className="form-input"
                      value={form.daily_farm_id}
                      onChange={(e) => setForm({ ...form, daily_farm_id: e.target.value })}
                      required
                    >
                      <option value="">Select loading farm…</option>
                      {dailyFarms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.farm_name} {f.vehicle_no ? `(${f.vehicle_no})` : ''} — Stock: {f.remaining_boxes} boxes ({parseFloat(f.remaining_kg).toFixed(1)} kg)
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedFarm && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      🚚 Truck Balance: <strong>{selectedFarm.remaining_boxes} boxes</strong> ({parseFloat(selectedFarm.remaining_kg).toFixed(1)} kg remaining)
                    </div>
                  )}
                </div>

                {/* 2. Customer Selection */}
                <div className="form-group">
                  <label className="form-label">
                    👤 Customer <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <select
                    className="form-input"
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    required
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => {
                      const mRate = parseFloat(c.minus_rate || 0);
                      const adjLabel = mRate > 0 ? `-${mRate.toFixed(2)}` : mRate < 0 ? `+${Math.abs(mRate).toFixed(2)}` : 'Flat';
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({adjLabel} ₹/kg)
                        </option>
                      );
                    })}
                  </select>
                  {selectedCustomer && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                      <span>Adj: <strong>{minusRate > 0 ? `-${minusRate.toFixed(2)}` : minusRate < 0 ? `+${Math.abs(minusRate).toFixed(2)}` : 'Flat'}</strong></span>
                      <span>•</span>
                      <span>Drop Rate: <strong style={{ color: 'var(--green)' }}>₹{finalRate.toFixed(2)}/kg</strong></span>
                    </div>
                  )}
                </div>

                {/* 3. Boxes & Net Weight in Ergonomic 2-Column Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Boxes (Crates) <span style={{ color: 'var(--red)' }}>*</span></label>
                    <div className="stepper-container">
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => handleBoxesChange(-1)}
                        aria-label="Decrease boxes"
                      >
                        −
                      </button>
                      <span className="stepper-value">{boxes}</span>
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => handleBoxesChange(1)}
                        aria-label="Increase boxes"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Net Weight (kg) <span style={{ color: 'var(--red)' }}>*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 142.50"
                      className="form-input"
                      value={form.weight_kg}
                      onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                      required
                      style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '17px' }}
                    />
                  </div>
                </div>

                {/* 4. Notes / Vehicle */}
                <div className="form-group">
                  <label className="form-label">Notes / Remarks (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Shop delivery, extra crate"
                    className="form-input"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

                {/* 5. Live Calculation Card */}
                <div style={{
                  background: 'var(--primary-tint)',
                  border: '1.5px solid var(--primary)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  marginTop: '18px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    <span>Paper Rate:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{paperRate.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    <span>Customer Rate Adjustment:</span>
                    <span style={{ fontWeight: 700, color: minusRate > 0 ? 'var(--red)' : minusRate < 0 ? 'var(--green)' : 'var(--text-primary)' }}>
                      {minusRate > 0 ? `- ₹${minusRate.toFixed(2)}` : minusRate < 0 ? `+ ₹${Math.abs(minusRate).toFixed(2)}` : '₹0.00'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>Final Billing Rate:</span>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>₹{finalRate.toFixed(2)}/kg</span>
                  </div>

                  <div style={{
                    borderTop: '1px dashed var(--border)',
                    paddingTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
                        Total Billed Price
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {boxes} boxes • {weight > 0 ? `${weight.toFixed(2)} kg` : '0 kg'}
                      </div>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      ₹{totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '18px', minHeight: '50px', fontSize: '15px', fontWeight: 800 }}
                  disabled={saving || !rate || dailyFarms.length === 0}
                >
                  {saving ? <span className="spinner" /> : '✅ Confirm & Record Drop'}
                </button>
              </div>
            </div>
          </form>

          {/* Today's Recent Drops Preview */}
          {orders.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                  Today's Dispatched Drops ({orders.length})
                </span>
                <button
                  onClick={() => setActiveTab('orders')}
                  style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}
                >
                  View All & Register
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {orders.slice(0, 4).map((o) => (
                  <div
                    key={o.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                        {o.customer_name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Voucher #{o.voucher_no} • {o.boxes} b • {parseFloat(o.weight_kg).toFixed(1)} kg @ ₹{parseFloat(o.final_rate).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        ₹{parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── TAB 2: ORDERS REGISTER ──────────────── */}
      {activeTab === 'orders' && (
        <div>
          {/* KPI Summary Grid */}
          <div className="stats-grid" style={{ marginBottom: '16px' }}>
            <div className="stat-card">
              <div className="stat-label">Total Drops</div>
              <div className="stat-value">{orders.length}</div>
              <div className="stat-sub">{totalBoxes} boxes dispatched</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Net Weight</div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>
                {totalKg.toFixed(2)} kg
              </div>
              <div className="stat-sub">Across all vouchers</div>
            </div>

            <div className="stat-card" style={{ gridColumn: 'span 2' }}>
              <div className="stat-label">Total Billed Value</div>
              <div className="stat-value" style={{ color: 'var(--green)', fontSize: '26px' }}>
                ₹{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="stat-sub">Gross sales value for {selectedDate}</div>
            </div>
          </div>

          {/* Admin Group Filter if Admin */}
          {isAdmin && groups.length > 0 && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Filter Group:</span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              >
                <option value="">All Groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Orders Cards List (Mobile Ergonomic) */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ padding: '36px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>No drops for {selectedDate}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                Tap "Record New Drop" above to start entering daily deliveries.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="card"
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>
                        {order.customer_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Voucher #{order.voucher_no} • {order.farm_name} {order.vehicle_no ? `(${order.vehicle_no})` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--primary)', fontFamily: 'monospace' }}>
                        ₹{parseFloat(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ₹{parseFloat(order.final_rate).toFixed(2)}/kg
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '8px',
                    fontSize: '12px'
                  }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className="badge badge-blue">📦 {order.boxes} boxes</span>
                      <span className="badge badge-amber">⚖️ {parseFloat(order.weight_kg).toFixed(2)} kg</span>
                    </div>

                    <button
                      onClick={() => handleDeleteOrder(order)}
                      style={{
                        color: 'var(--red)',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--red-bg)'
                      }}
                      title="Cancel / Delete Voucher"
                    >
                      🗑️ Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
