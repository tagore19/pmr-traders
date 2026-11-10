import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

function CustomerModal({ customer, onClose, onSaved, isAdmin }) {
  const initialRateAdj = customer ? -parseFloat(customer.minus_rate || 0) : 0;

  const [name, setName] = useState(customer?.name || '');
  const [groupId, setGroupId] = useState(customer?.group_id || '');
  const [rateAdj, setRateAdj] = useState(initialRateAdj);
  const [openingBalance, setOpeningBalance] = useState(customer ? parseFloat(customer.opening_balance || 0) : '');
  const [openingBalanceType, setOpeningBalanceType] = useState(customer?.opening_balance_type || 'DR');
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAdmin) {
      api.admin.getGroups().then(gList => {
        setGroups(gList);
        if (!groupId && gList.length > 0) {
          setGroupId(gList[0].id);
        }
      }).catch(console.error);
    }
  }, [isAdmin]);

  function handleDecrement() {
    const num = typeof rateAdj === 'number' ? rateAdj : parseFloat(rateAdj) || 0;
    setRateAdj(Math.round((num - 1) * 100) / 100);
  }

  function handleIncrement() {
    const num = typeof rateAdj === 'number' ? rateAdj : parseFloat(rateAdj) || 0;
    setRateAdj(Math.round((num + 1) * 100) / 100);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const customerApi = isAdmin ? api.admin : api.supervisor;
      const numVal = typeof rateAdj === 'number' ? rateAdj : parseFloat(rateAdj) || 0;
      const computedMinusRate = -numVal;

      const payload = {
        name: name.trim(),
        minus_rate: computedMinusRate,
        opening_balance: parseFloat(openingBalance) || 0,
        opening_balance_type: openingBalanceType,
        ...(isAdmin && groupId ? { group_id: groupId } : {}),
      };

      if (customer) {
        await customerApi.updateCustomer(customer.id, payload);
      } else {
        await customerApi.createCustomer(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  const numVal = typeof rateAdj === 'number' ? rateAdj : parseFloat(rateAdj) || 0;
  const formattedDisplay = numVal > 0 ? `+${numVal}` : `${rateAdj}`;
  const rateColor = numVal < 0 ? 'var(--red)' : numVal > 0 ? 'var(--green)' : 'var(--text-primary)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{customer ? '✏️ Edit Customer' : '➕ Add New Customer'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Customer Name <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                className="form-input"
                placeholder="e.g. PMR (Shop), M Saibaba, Pawan"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            {isAdmin && (
              <div className="form-group">
                <label className="form-label">Assign to Supervisor Team / Group</label>
                <select
                  className="form-input"
                  value={groupId}
                  onChange={e => setGroupId(e.target.value)}
                  required
                >
                  <option value="">Select group…</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="form-input"
                  placeholder="e.g. 25000"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-input"
                  value={openingBalanceType}
                  onChange={e => setOpeningBalanceType(e.target.value)}
                >
                  <option value="DR">Dr (Due)</option>
                  <option value="CR">Cr (Adv)</option>
                </select>
              </div>
            </div>

            {/* Tactile Amazon-style Stepper for Rate Adjustment */}
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: 6 }}>
                Paper Rate Adjustment (₹/kg)
              </label>
              <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                Click [ − ] to give customer discount (e.g. -2 ₹/kg from paper rate)
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-elevated)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '6px 12px',
                gap: '14px',
                maxWidth: '260px',
                margin: '0 auto'
              }}>
                <button
                  type="button"
                  className="stepper-btn"
                  style={{ width: '46px', height: '46px', fontSize: '24px' }}
                  onClick={handleDecrement}
                  title="Click to decrease rate"
                >
                  −
                </button>

                <div style={{ minWidth: '90px', textAlign: 'center' }}>
                  <input
                    type="text"
                    value={formattedDisplay}
                    onChange={e => {
                      const val = e.target.value.replace('+', '').trim();
                      if (val === '' || val === '-') {
                        setRateAdj(val);
                      } else {
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) setRateAdj(parsed);
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      fontSize: '24px',
                      fontWeight: '900',
                      background: 'transparent',
                      border: 'none',
                      color: rateColor,
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="stepper-btn"
                  style={{ width: '46px', height: '46px', fontSize: '24px' }}
                  onClick={handleIncrement}
                  title="Click to increase rate"
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: 22 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({ customerId, onClose, onSaved }) {
  const [form, setForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount_paid: '',
    payment_mode: 'CASH',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.accounting.createPayment({
        customer_id: customerId,
        payment_date: form.payment_date,
        amount_paid: parseFloat(form.amount_paid),
        payment_mode: form.payment_mode,
        notes: form.notes
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">💵 Record Cash / Bank Receipt</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input type="date" className="form-input" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Amount Received (₹) <span style={{ color: 'var(--red)' }}>*</span></label>
              <input type="number" step="0.01" inputMode="decimal" className="form-input" placeholder="e.g. 50000"
                value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} required
                style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select className="form-input" value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI (PhonePe / GPay)</option>
                <option value="NEFT">Bank Transfer (NEFT/RTGS)</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes / Reference (optional)</label>
              <input className="form-input" placeholder="e.g. Paid to driver, Ref #12345"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Record Receipt'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CreditNoteModal({ customerId, onClose, onSaved }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    boxes: 0,
    weight_kg: '',
    rate_per_kg: '',
    reason: 'Dead / Mortality Credit'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const weight = parseFloat(form.weight_kg) || 0;
  const rate = parseFloat(form.rate_per_kg) || 0;
  const computedTotal = weight * rate;

  async function handleSubmit(e) {
    e.preventDefault();
    if (weight <= 0 || rate <= 0) {
      setError('Please enter valid positive weight and rate');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.accounting.createCreditNote({
        customer_id: customerId,
        date: form.date,
        boxes: parseInt(form.boxes, 10) || 0,
        weight_kg: weight,
        rate_per_kg: rate,
        reason: form.reason
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📉 Issue Credit Note (Dead Birds / Return)</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Weight (kg) <span style={{ color: 'var(--red)' }}>*</span></label>
                <input type="number" step="0.01" inputMode="decimal" className="form-input" placeholder="e.g. 15.5"
                  value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Rate (₹/kg) <span style={{ color: 'var(--red)' }}>*</span></label>
                <input type="number" step="0.01" inputMode="decimal" className="form-input" placeholder="e.g. 130"
                  value={form.rate_per_kg} onChange={e => setForm({ ...form, rate_per_kg: e.target.value })} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Boxes</label>
                <input type="number" className="form-input" value={form.boxes} onChange={e => setForm({ ...form, boxes: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input className="form-input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
              </div>
            </div>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', margin: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Credit Amount:</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--red)', fontFamily: 'monospace' }}>
                ₹{computedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Issue Credit Note'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CustomerLedgerModal({ customerId, onClose }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);

  function loadLedger() {
    setLoading(true);
    api.accounting.getCustomerLedger(customerId)
      .then(setLedger)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLedger();
  }, [customerId]);

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 840, width: '96%' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <span className="modal-title">📖 {ledger?.customer?.name || 'Customer'} — Tally Ledger</span>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {ledger?.customer?.group_name ? `Team: ${ledger.customer.group_name}` : ''}
              </div>
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" /></div>
            ) : !ledger ? (
              <div className="alert alert-danger">Failed to load customer ledger.</div>
            ) : (
              <div>
                {/* Ledger Summary Stats */}
                <div className="stats-grid" style={{ marginBottom: 16 }}>
                  <div className="stat-card">
                    <div className="stat-label">Total Debits (Sales)</div>
                    <div className="stat-value" style={{ color: 'var(--primary)', fontSize: '18px' }}>
                      ₹{ledger.summary.total_debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Total Credits (Receipts)</div>
                    <div className="stat-value" style={{ color: 'var(--green)', fontSize: '18px' }}>
                      ₹{ledger.summary.total_credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="stat-card" style={{ borderLeft: `3px solid ${ledger.summary.closing_balance_type === 'Dr' ? 'var(--red)' : 'var(--green)'}` }}>
                    <div className="stat-label">Closing Balance</div>
                    <div className="stat-value" style={{ color: ledger.summary.closing_balance_type === 'Dr' ? 'var(--red)' : 'var(--green)', fontSize: '20px' }}>
                      ₹{ledger.summary.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {ledger.summary.closing_balance_type}
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: 16, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowPaymentModal(true)}>
                    💵 Record Receipt
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowCreditNoteModal(true)}>
                    📉 Issue Credit Note
                  </button>
                </div>

                {/* Ledger Transactions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Opening Balance Row */}
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>Opening Balance</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '14px' }}>
                      ₹{ledger.opening_balance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {ledger.opening_balance.type}
                    </div>
                  </div>

                  {ledger.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      style={{
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                          {tx.vch_type === 'Sales' ? '📦 To Sales' : tx.vch_type === 'Receipt' ? '💵 By Cash/Bank' : '📉 By Return Credit'}
                          {tx.voucher_no ? ` (#${tx.voucher_no})` : ''}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          📅 {tx.date}
                          {tx.weight_kg > 0 ? ` • ${tx.weight_kg.toFixed(1)} kg @ ₹${tx.rate.toFixed(2)}` : ''}
                          {tx.boxes > 0 ? ` (${tx.boxes} b)` : ''}
                          {tx.notes ? ` • ${tx.notes}` : ''}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {tx.debit > 0 && (
                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary)', fontFamily: 'monospace' }}>
                            +₹{tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Dr)
                          </div>
                        )}
                        {tx.credit > 0 && (
                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--green)', fontFamily: 'monospace' }}>
                            -₹{tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Cr)
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                          Bal: ₹{tx.running_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {tx.balance_type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal customerId={customerId} onClose={() => setShowPaymentModal(false)} onSaved={() => { setShowPaymentModal(false); loadLedger(); }} />
      )}
      {showCreditNoteModal && (
        <CreditNoteModal customerId={customerId} onClose={() => setShowCreditNoteModal(false)} onSaved={() => { setShowCreditNoteModal(false); loadLedger(); }} />
      )}
    </>
  );
}

export default function CustomersPage({ onNavigate }) {
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [ledgerCustomerId, setLedgerCustomerId] = useState(null);
  const [payCustomerId, setPayCustomerId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (isAdmin) {
      api.admin.getGroups().then(setGroups).catch(console.error);
    }
  }, [isAdmin]);

  function load() {
    setLoading(true);
    (isAdmin ? api.admin.getCustomers(filterGroup || null) : api.supervisor.getCustomers())
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [isAdmin, filterGroup]);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id, name) {
    if (!confirm(`Are you sure you want to delete customer "${name}"?`)) return;
    try {
      const customerApi = isAdmin ? api.admin : api.supervisor;
      await customerApi.deleteCustomer(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="page" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">
            <span>👥</span>
            <span>Customer Directory</span>
          </h1>
          <p className="page-subtitle">Manage customer profiles, rate adjustments, and accounts</p>
        </div>
        <button id="add-customer-btn" className="btn btn-primary" onClick={() => setModal('add')}>
          ➕ Add Customer
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        {/* Search & Filter Bar */}
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '480px' }}>
            <input
              className="form-input"
              style={{ minHeight: '42px', padding: '8px 12px', fontSize: '13.5px' }}
              placeholder="🔍 Search customers by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {isAdmin && (
              <select
                className="form-input"
                style={{ width: '150px', minHeight: '42px', padding: '8px', fontSize: '12.5px' }}
                value={filterGroup}
                onChange={e => setFilterGroup(e.target.value)}
              >
                <option value="">All Groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>
          <span className="badge badge-green" style={{ fontSize: '11px' }}>
            {filtered.length} customers
          </span>
        </div>

        {/* Customer Cards (Mobile-First) */}
        <div className="card-body" style={{ padding: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              No customers found. Tap "+ Add Customer" above to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(c => {
                const val = parseFloat(c.minus_rate || 0);
                const opBal = parseFloat(c.opening_balance || 0);
                return (
                  <div
                    key={c.id}
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div
                          onClick={() => setLedgerCustomerId(c.id)}
                          style={{ fontWeight: 800, fontSize: '15px', color: 'var(--primary)', cursor: 'pointer' }}
                        >
                          {c.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Opening: ₹{opBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {c.opening_balance_type || 'DR'}
                          {isAdmin && c.group_name ? ` • Team: ${c.group_name}` : ''}
                        </div>
                      </div>

                      <div>
                        {val > 0 ? (
                          <span className="badge badge-red" style={{ fontSize: '11.5px' }}>
                            -₹{val.toFixed(2)}/kg
                          </span>
                        ) : val < 0 ? (
                          <span className="badge badge-green" style={{ fontSize: '11.5px' }}>
                            +₹{Math.abs(val).toFixed(2)}/kg
                          </span>
                        ) : (
                          <span className="badge badge-blue" style={{ fontSize: '11.5px' }}>
                            Flat (Paper Rate)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Touch Action Row */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '8px'
                    }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '6px 12px', fontSize: '12px', minHeight: '34px' }}
                          onClick={() => setLedgerCustomerId(c.id)}
                        >
                          📖 Ledger
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 12px', fontSize: '12px', minHeight: '34px' }}
                          onClick={() => setPayCustomerId(c.id)}
                        >
                          💵 Pay
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 10px', fontSize: '12px', minHeight: '34px' }}
                          onClick={() => setModal({ customer: c })}
                          title="Edit Customer"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '6px 10px', fontSize: '12px', minHeight: '34px' }}
                          onClick={() => handleDelete(c.id, c.name)}
                          title="Delete Customer"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <CustomerModal
          customer={modal.customer}
          isAdmin={isAdmin}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {ledgerCustomerId && (
        <CustomerLedgerModal
          customerId={ledgerCustomerId}
          onClose={() => setLedgerCustomerId(null)}
        />
      )}

      {payCustomerId && (
        <PaymentModal
          customerId={payCustomerId}
          onClose={() => setPayCustomerId(null)}
          onSaved={() => { setPayCustomerId(null); load(); }}
        />
      )}
    </div>
  );
}
