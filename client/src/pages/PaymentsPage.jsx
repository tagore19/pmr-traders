import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function PaymentsPage({ onNavigate }) {
  const { isAdmin } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Payment Modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [cList, pList, sum] = await Promise.all([
        api.supervisor.getCustomers().catch(() => []),
        api.accounting.getPayments({ limit: 50 }).catch(() => []),
        api.accounting.getGroupSummary().catch(() => null),
      ]);
      setCustomers(cList);
      setPayments(pList);
      setSummaryData(sum);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openPaymentForCustomer = (cust) => {
    setSelectedCustomerId(cust.id);
    setPaymentDate(todayStr);
    setAmountPaid('');
    setPaymentMode('CASH');
    setNotes('');
    setModalError('');
    setShowPayModal(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setModalError('Please select a customer');
      return;
    }
    const parsedAmount = parseFloat(amountPaid);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setModalError('Please enter a valid payment amount greater than ₹0');
      return;
    }

    setSaving(true);
    setModalError('');
    try {
      await api.accounting.createPayment({
        customer_id: selectedCustomerId,
        payment_date: paymentDate,
        amount_paid: parsedAmount,
        payment_mode: paymentMode,
        notes: notes.trim(),
      });

      const custName = customers.find(c => c.id === selectedCustomerId)?.name || 'Customer';
      setSuccessMsg(`✅ Receipt of ₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded for ${custName}`);
      setShowPayModal(false);
      loadData();
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      setModalError(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (pay) => {
    if (!window.confirm(`Delete receipt of ₹${parseFloat(pay.amount_paid).toFixed(2)} for ${pay.customer_name}?`)) return;
    try {
      await api.accounting.deletePayment(pay.id);
      setSuccessMsg('Payment receipt deleted');
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to delete payment');
    }
  };

  // Compute metrics from summaryData
  const rows = summaryData?.rows || [];
  const totalOutstandingDue = rows
    .filter(r => r.closing_balance_type === 'Dr')
    .reduce((sum, r) => sum + r.closing_balance, 0);

  const todayPayments = payments.filter(p => p.payment_date === todayStr);
  const totalCollectedToday = todayPayments.reduce((sum, p) => sum + (parseFloat(p.amount_paid) || 0), 0);

  // Filter customers by search term
  const pendingCustomers = rows
    .filter(r => r.closing_balance_type === 'Dr' && r.closing_balance > 0)
    .sort((a, b) => b.closing_balance - a.closing_balance)
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Page Title */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h1 className="page-title">
          <span>💵</span>
          <span>Payments & Collections</span>
        </h1>
        <p className="page-subtitle">Track customer pending dues, collect cash/UPI receipts, and view transaction history</p>
      </div>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      {/* KPI Cards Grid */}
      <div className="stats-grid" style={{ marginBottom: '18px' }}>
        <div className="stat-card">
          <div className="stat-label">Total Outstanding Due</div>
          <div className="stat-value" style={{ color: 'var(--red)', fontSize: '24px' }}>
            ₹{loading ? '…' : totalOutstandingDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-sub">Pending customer debt (Dr)</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Collected Today</div>
          <div className="stat-value" style={{ color: 'var(--green)', fontSize: '24px' }}>
            ₹{loading ? '…' : totalCollectedToday.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-sub">{todayPayments.length} receipt(s) on {todayStr}</div>
        </div>
      </div>

      {/* Primary Action Button (Thumb Zone) */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => {
            setSelectedCustomerId(customers[0]?.id || '');
            setPaymentDate(todayStr);
            setAmountPaid('');
            setPaymentMode('CASH');
            setNotes('');
            setModalError('');
            setShowPayModal(true);
          }}
          className="btn btn-primary"
          style={{
            width: '100%',
            minHeight: '50px',
            fontSize: '15px',
            fontWeight: 800,
            borderRadius: 'var(--radius)',
            gap: '8px'
          }}
        >
          <span>➕</span>
          <span>Record New Payment Receipt</span>
        </button>
      </div>

      {/* Section: Pending Dues by Customer */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span className="card-title">⏳ Customer Pending Balances</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({pendingCustomers.length} with due)
            </span>
          </div>

          <input
            type="text"
            placeholder="🔍 Search customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              outline: 'none',
              maxWidth: '180px'
            }}
          />
        </div>

        <div className="card-body" style={{ padding: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading balances…</div>
          ) : pendingCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--green)' }}>
              🎉 No outstanding customer balances found matching your search!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingCustomers.map((cust) => (
                <div
                  key={cust.id}
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                      {cust.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Debits: ₹{cust.total_debits.toLocaleString('en-IN')} • Receipts: ₹{cust.total_credits.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: '15.5px', color: 'var(--red)', fontFamily: 'monospace' }}>
                        ₹{cust.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase' }}>
                        DUE (Dr)
                      </div>
                    </div>

                    <button
                      onClick={() => openPaymentForCustomer(cust)}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '6px 14px', fontWeight: 700, minHeight: '36px' }}
                    >
                      💵 Pay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section: Recent Receipts Log */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🧾 Recent Payment Receipts</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last 50 entries</span>
        </div>

        <div className="card-body" style={{ padding: '12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading receipts…</div>
          ) : payments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No payments recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payments.map((p) => (
                <div
                  key={p.id}
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
                      {p.customer_name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      📅 {p.payment_date} • Mode: <strong>{p.payment_mode}</strong>
                      {p.notes ? ` • ${p.notes}` : ''}
                      {p.collected_by_name ? ` (By ${p.collected_by_name})` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: '15px', color: 'var(--green)', fontFamily: 'monospace' }}>
                        +₹{parseFloat(p.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="badge badge-green" style={{ fontSize: '10px' }}>Received</span>
                    </div>

                    <button
                      onClick={() => handleDeletePayment(p)}
                      style={{
                        background: 'var(--red-bg)',
                        color: 'var(--red)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      title="Cancel payment"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slide-Up Bottom Sheet Modal: Record Payment */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">💵 Record Cash / Bank Receipt</span>
              <button
                className="modal-close"
                onClick={() => setShowPayModal(false)}
                style={{ fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {modalError && <div className="alert alert-danger">{modalError}</div>}

              <form onSubmit={handleSavePayment}>
                {/* 1. Customer Selection */}
                <div className="form-group">
                  <label className="form-label">
                    Customer <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <select
                    className="form-input"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Payment Date */}
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>

                {/* 3. Amount Paid (Big Numeric Input) */}
                <div className="form-group">
                  <label className="form-label">
                    Amount Received (₹) <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="e.g. 25000"
                    className="form-input"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    required
                    style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace' }}
                  />
                </div>

                {/* 4. Payment Mode Segmented Chips */}
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {[
                      { id: 'CASH', label: '💵 Cash' },
                      { id: 'UPI', label: '📱 UPI' },
                      { id: 'NEFT', label: '🏦 Bank' },
                      { id: 'CHEQUE', label: '📝 Cheque' }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setPaymentMode(mode.id)}
                        style={{
                          padding: '8px 4px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: paymentMode === mode.id ? 'var(--primary)' : 'var(--bg-elevated)',
                          color: paymentMode === mode.id ? '#FFFFFF' : 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '12px',
                          textAlign: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Notes / Reference */}
                <div className="form-group">
                  <label className="form-label">Notes / Reference (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid to driver, PhonePe Ref #12345"
                    className="form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '16px', minHeight: '48px', fontWeight: 800, fontSize: '15px' }}
                  disabled={saving}
                >
                  {saving ? <span className="spinner" /> : '✅ Save Payment Receipt'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
