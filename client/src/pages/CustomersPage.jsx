import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

function CustomerModal({ customer, onClose, onSaved, isAdmin }) {
  // customer.minus_rate in DB: positive is discount (minus), negative is premium (plus)
  // Stepper: -1, -2 is discount, +1, +2 is premium
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
  const rateColor = numVal < 0 ? '#ef4444' : numVal > 0 ? '#10b981' : 'var(--text-main)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{customer ? '✏️ Edit Customer' : '➕ Add Customer'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Customer Name <span style={{ color: '#ef4444' }}>*</span></label>
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
                <label className="form-label">Assign to Group</label>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
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

            {/* Amazon-style Cart Stepper for Rate Adjustment */}
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: 8 }}>
                Paper Rate Adjustment (₹/kg)
              </label>
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginBottom: 10 }}>
                Click [ − ] to give customer discount (e.g. -2 ₹/kg)
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-elevated)',
                border: '1.5px solid var(--border)',
                borderRadius: '12px',
                padding: '8px 12px',
                gap: '16px',
                maxWidth: '260px',
                margin: '0 auto'
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    width: '46px',
                    height: '46px',
                    fontSize: '26px',
                    fontWeight: '900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    lineHeight: 1
                  }}
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
                      fontSize: '26px',
                      fontWeight: '800',
                      background: 'transparent',
                      border: 'none',
                      color: rateColor,
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    width: '46px',
                    height: '46px',
                    fontSize: '26px',
                    fontWeight: '900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    lineHeight: 1
                  }}
                  onClick={handleIncrement}
                  title="Click to increase rate"
                >
                  +
                </button>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>
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
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">💵 Record Cash / Bank Receipt</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input type="date" className="form-input" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Amount Received (₹) <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="number" step="0.01" className="form-input" placeholder="e.g. 50000"
                value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} required />
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
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-green" disabled={saving}>{saving ? <span className="spinner" /> : '💵 Record Receipt'}</button>
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
    boxes: 1,
    weight_kg: '',
    rate_per_kg: '',
    reason: 'Sales Return / Bird Mortality'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.accounting.createCreditNote({
        customer_id: customerId,
        date: form.date,
        boxes: parseInt(form.boxes, 10) || 0,
        weight_kg: parseFloat(form.weight_kg),
        rate_per_kg: parseFloat(form.rate_per_kg),
        reason: form.reason
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const amount = (parseFloat(form.weight_kg) || 0) * (parseFloat(form.rate_per_kg) || 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🏷️ Issue Sales Credit Note</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="grid-3-col">
              <div className="form-group">
                <label className="form-label">Boxes</label>
                <input type="number" min="0" inputMode="numeric" className="form-input" value={form.boxes} onChange={e => setForm({ ...form, boxes: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Weight (kg)</label>
                <input type="number" step="0.01" inputMode="decimal" className="form-input" placeholder="e.g. 30.5" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Rate (₹)</label>
                <input type="number" step="0.01" inputMode="decimal" className="form-input" placeholder="e.g. 130" value={form.rate_per_kg} onChange={e => setForm({ ...form, rate_per_kg: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Reason / Particulars</label>
              <input className="form-input" placeholder="e.g. Return of 1 box birds, mortality" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div style={{ background: '#0f172a', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Credit Amount:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Issue Credit Note'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function LedgerModal({ customerId, onClose }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);

  function loadLedger() {
    setLoading(true);
    api.accounting.getCustomerLedger(customerId, {
      ...(from ? { from } : {}),
      ...(to ? { to } : {})
    })
      .then(setLedger)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(loadLedger, [customerId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 960, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          {/* Controls Bar */}
          <div className="modal-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span className="modal-title" style={{ fontSize: '1.1rem' }}>
              👤 {ledger?.customer?.name || 'Customer'} — Statement
            </span>
            <button className="modal-close" onClick={onClose}>×</button>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#94a3b8' }}>From:</span>
                <input type="date" className="form-input" style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', minHeight: '36px' }} value={from} onChange={e => setFrom(e.target.value)} />
                <span style={{ color: '#94a3b8' }}>To:</span>
                <input type="date" className="form-input" style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', minHeight: '36px' }} value={to} onChange={e => setTo(e.target.value)} />
                <button className="btn btn-secondary btn-sm" style={{ minHeight: '36px' }} onClick={loadLedger}>Filter</button>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-green btn-sm" style={{ minHeight: '36px', padding: '0.3rem 0.65rem' }} onClick={() => setShowPaymentModal(true)}>
                  💵 + Receipt
                </button>
                <button className="btn btn-secondary btn-sm" style={{ minHeight: '36px', padding: '0.3rem 0.65rem' }} onClick={() => setShowCreditNoteModal(true)}>
                  🏷️ + Credit Note
                </button>
                <button className="btn btn-primary btn-sm" style={{ minHeight: '36px', padding: '0.3rem 0.65rem' }} onClick={handlePrint}>
                  🖨️ Print
                </button>
              </div>
            </div>
          </div>

          <div className="modal-body" style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
            {loading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : !ledger ? (
              <div className="empty-state">Failed to load ledger</div>
            ) : (
              /* Printable Ledger Sheet matching User's PMR Shop statement */
              <div className="printable-sheet" style={{ background: '#ffffff', color: '#0f172a', padding: '1.5rem 2rem', borderRadius: '8px', fontFamily: '"Inter", sans-serif' }}>
                {/* Statement Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.8rem', marginBottom: '1rem' }}>
                  <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                    P M REDDY POULTRY TRADERS
                  </h1>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Mahabubabad, Warangal</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '0.35rem' }}>
                    {ledger.customer.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                    Ledger Account • {ledger.customer.group_name}
                  </div>
                </div>

                {/* Ledger Transactions Table with mobile horizontal scroll */}
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', color: '#0f172a', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '90px' }}>Date</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Particulars</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', width: '85px' }}>Vch Type</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', width: '70px' }}>Vch No.</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', width: '100px' }}>Debit (₹)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', width: '100px' }}>Credit (₹)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', width: '120px' }}>Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening Balance Row */}
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 600 }}>
                      <td style={{ padding: '0.5rem' }}>{from || 'Start'}</td>
                      <td colSpan="3" style={{ padding: '0.5rem', fontStyle: 'italic', color: '#334155' }}>
                        To Opening Balance
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>
                        {ledger.opening_balance.type === 'Dr' ? ledger.opening_balance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>
                        {ledger.opening_balance.type === 'Cr' ? ledger.opening_balance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                        {ledger.opening_balance.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ledger.opening_balance.type}
                      </td>
                    </tr>

                    {/* Transaction Rows */}
                    {ledger.transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.5rem', verticalAlign: 'top', color: '#475569' }}>
                          {tx.date}
                        </td>
                        <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {tx.vch_type === 'Sales' ? 'To Sales' : tx.vch_type === 'Receipt' ? 'By Cash' : 'By Sales Return'}
                          </div>
                          {tx.vch_type === 'Sales' && (
                            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.15rem' }}>
                              Live Birds • {tx.weight_kg.toFixed(2)} kgs @ ₹{tx.rate.toFixed(2)}/kg
                              {tx.boxes > 0 && <span style={{ fontWeight: 700, color: '#0f172a', marginLeft: '0.4rem' }}>({tx.boxes < 10 ? '0' + tx.boxes : tx.boxes} b)</span>}
                              {tx.farm_name && <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>[{tx.farm_name}]</span>}
                            </div>
                          )}
                          {tx.vch_type === 'Credit Note' && (
                            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.15rem' }}>
                              Live Birds Return • {tx.weight_kg.toFixed(2)} kgs @ ₹{tx.rate.toFixed(2)}/kg {tx.boxes > 0 ? `(${tx.boxes} b)` : ''}
                            </div>
                          )}
                          {tx.notes && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{tx.notes}</div>}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', verticalAlign: 'top', fontSize: '0.8rem', color: '#475569' }}>
                          {tx.vch_type}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', verticalAlign: 'top', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                          {tx.voucher_no}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', verticalAlign: 'top', fontFamily: 'monospace', fontWeight: tx.debit > 0 ? 600 : 400, color: tx.debit > 0 ? '#0f172a' : '#94a3b8' }}>
                          {tx.debit > 0 ? tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', verticalAlign: 'top', fontFamily: 'monospace', fontWeight: tx.credit > 0 ? 600 : 400, color: tx.credit > 0 ? '#047857' : '#94a3b8' }}>
                          {tx.credit > 0 ? tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', verticalAlign: 'top', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                          {tx.running_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tx.balance_type}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #0f172a', borderBottom: '2.5px solid #0f172a', fontWeight: 800 }}>
                      <td colSpan="4" style={{ padding: '0.65rem 0.5rem', textTransform: 'uppercase' }}>
                        By Closing Balance:
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>
                        ₹{ledger.summary.total_debits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', color: '#047857' }}>
                        ₹{ledger.summary.total_credits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '1rem', color: '#0f172a' }}>
                        ₹{ledger.summary.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ledger.summary.closing_balance_type}
                      </td>
                    </tr>
                  </tfoot>
                </table>
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

export default function CustomersPage() {
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [ledgerCustomerId, setLedgerCustomerId] = useState(null);
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
    <div className="page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div className="page-title" style={{ fontSize: '1.6rem', fontWeight: 700 }}>👥 Customer Directory & Accounting Ledgers</div>
          <div className="page-subtitle" style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Direct access to customer rate stepper adjustments, opening balances, and full Tally ledger statements.
          </div>
        </div>
        <button id="add-customer-btn" className="btn btn-primary" onClick={() => setModal('add')}>
          ➕ Add Customer
        </button>
      </div>

      <div className="card" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flex: 1, maxWidth: '500px' }}>
            <input
              className="form-input"
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 0.75rem', color: '#f8fafc' }}
              placeholder="🔍 Search customers by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {isAdmin && (
              <select
                className="form-input"
                style={{ width: '180px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.5rem 0.75rem', color: '#f8fafc' }}
                value={filterGroup}
                onChange={e => setFilterGroup(e.target.value)}
              >
                <option value="">All Groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>
          <span className="badge badge-blue" style={{ background: '#0369a1', color: '#f0f9ff', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
            {filtered.length} customers
          </span>
        </div>

        {/* Desktop View Table */}
        <div className="hide-mobile">
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state" style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: '3.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
                No customers found. Click "Add Customer" to add one.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Customer Name</th>
                    {isAdmin && <th style={{ padding: '0.75rem 1rem' }}>Group</th>}
                    <th style={{ padding: '0.75rem 1rem' }}>Opening Balance</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Rate Adjustment</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const val = parseFloat(c.minus_rate || 0);
                    const opBal = parseFloat(c.opening_balance || 0);
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            onClick={() => setLedgerCustomerId(c.id)}
                            style={{ fontWeight: 700, color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                            title="Click to view full Tally ledger statement"
                          >
                            {c.name}
                          </span>
                        </td>
                        {isAdmin && <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{c.group_name || '—'}</td>}
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>
                          {opBal > 0 ? (
                            <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                              ₹{opBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {c.opening_balance_type || 'DR'}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>₹0.00</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {val > 0 ? (
                            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
                              -₹{val.toFixed(2)}/kg
                            </span>
                          ) : val < 0 ? (
                            <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
                              +₹{Math.abs(val).toFixed(2)}/kg
                            </span>
                          ) : (
                            <span style={{ background: '#334155', color: '#cbd5e1', padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.85rem' }}>
                              ₹0.00 (Paper Rate)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                              onClick={() => setLedgerCustomerId(c.id)}
                            >
                              📊 Ledger
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ background: '#334155', color: '#f8fafc', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                              onClick={() => setModal({ customer: c })}
                            >
                              ✏️
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                              title="Delete customer"
                              onClick={() => handleDelete(c.id, c.name)}
                            >
                              🗑
                            </button>
                          </div>
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
            <div className="empty-state" style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
              No customers found. Tap "+ Add Customer" to add.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filtered.map(c => {
                const val = parseFloat(c.minus_rate || 0);
                const opBal = parseFloat(c.opening_balance || 0);
                return (
                  <div
                    key={c.id}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div
                        onClick={() => setLedgerCustomerId(c.id)}
                        style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', cursor: 'pointer', lineHeight: 1.3 }}
                      >
                        {c.name}
                      </div>
                      {isAdmin && c.group_name && (
                        <span style={{ fontSize: '0.72rem', background: '#1e293b', color: '#94a3b8', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #334155', whiteSpace: 'nowrap' }}>
                          {c.group_name}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Opening Bal</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace', color: opBal > 0 ? '#f8fafc' : '#64748b' }}>
                          {opBal > 0 ? `₹${opBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${c.opening_balance_type || 'DR'}` : '₹0.00'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Rate Adj</div>
                        <div>
                          {val > 0 ? (
                            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
                              -₹{val.toFixed(2)}/kg
                            </span>
                          ) : val < 0 ? (
                            <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
                              +₹{Math.abs(val).toFixed(2)}/kg
                            </span>
                          ) : (
                            <span style={{ background: '#334155', color: '#cbd5e1', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem' }}>
                              ₹0.00
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Touch Action Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          minHeight: '44px'
                        }}
                        onClick={() => setLedgerCustomerId(c.id)}
                      >
                        📊 View Ledger
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          padding: '0.55rem 0.85rem',
                          borderRadius: '8px',
                          minHeight: '44px',
                          fontSize: '1rem'
                        }}
                        onClick={() => setModal({ customer: c })}
                        title="Edit Customer"
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{
                          padding: '0.55rem 0.85rem',
                          borderRadius: '8px',
                          minHeight: '44px',
                          fontSize: '1rem'
                        }}
                        onClick={() => handleDelete(c.id, c.name)}
                        title="Delete Customer"
                      >
                        🗑
                      </button>
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
          customer={modal === 'add' ? null : modal.customer}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
          isAdmin={isAdmin}
        />
      )}

      {ledgerCustomerId && (
        <LedgerModal customerId={ledgerCustomerId} onClose={() => setLedgerCustomerId(null)} />
      )}
    </div>
  );
}
