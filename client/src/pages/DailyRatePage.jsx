import { useState, useEffect } from 'react';
import { api } from '../api/api';

export default function DailyRatePage() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [rate, setRate] = useState(null);
  const [paperRateInput, setPaperRateInput] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  function loadRateForDate(date) {
    setLoading(true);
    setMsg(null);
    api.rates.getRateByDate(date)
      .then(r => {
        setRate(r);
        setPaperRateInput(r.paper_rate);
      })
      .catch(() => {
        setRate(null);
        setPaperRateInput('');
      })
      .finally(() => setLoading(false));
  }

  function loadHistory() {
    api.rates.getHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }

  useEffect(() => {
    loadRateForDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (!paperRateInput || isNaN(paperRateInput)) {
      setMsg({ type: 'danger', text: 'Please enter a valid paper rate.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.rates.setRate(selectedDate, parseFloat(paperRateInput));
      setRate(res.rate);
      loadHistory();
      if (res.ordersExist) {
        setMsg({
          type: 'warning',
          text: `⚠️ Rate saved for ${selectedDate}. Note: Orders already exist for this date. Existing order calculations remain locked unless edited.`
        });
      } else {
        setMsg({
          type: 'success',
          text: `✅ Paper rate of ₹${parseFloat(paperRateInput).toFixed(2)} successfully saved for ${selectedDate}.`
        });
      }
    } catch (err) {
      setMsg({ type: 'danger', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function handleSelectFromHistory(h) {
    setSelectedDate(h.date);
    setRate(h);
    setPaperRateInput(h.paper_rate);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page" style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1 className="page-title">
          <span>📋</span>
          <span>Daily Paper Rate Management</span>
        </h1>
        <p className="page-subtitle">Configure or edit the daily benchmark paper rate for chicken distribution</p>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: 24 }}>
        {/* Form Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {rate ? `✏️ Update Rate (${selectedDate})` : `➕ Set Rate (${selectedDate})`}
            </span>
            {selectedDate === today && <span className="badge badge-green">Today</span>}
            {selectedDate < today && <span className="badge badge-amber">Past Date</span>}
            {selectedDate > today && <span className="badge badge-blue">Future Date</span>}
          </div>

          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    className="form-input"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    required
                  />
                  {selectedDate !== today && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedDate(today)}
                      title="Jump back to today"
                    >
                      Today
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Benchmark Paper Rate (₹ per kg)</label>
                <input
                  id="paper-rate-input"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="form-input"
                  placeholder="e.g. 132.50"
                  value={paperRateInput}
                  onChange={e => setPaperRateInput(e.target.value)}
                  required
                  style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'monospace' }}
                />
              </div>

              <button
                id="save-rate-btn"
                className="btn btn-primary"
                style={{ width: '100%', minHeight: 48, fontSize: '14.5px', fontWeight: 800, marginTop: 8 }}
                disabled={saving || loading}
              >
                {saving ? (
                  <span className="spinner" />
                ) : rate ? (
                  `✏️ Update Rate for ${selectedDate}`
                ) : (
                  `✅ Set Rate for ${selectedDate}`
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Live Status Card */}
        <div
          className="card"
          style={{
            background: 'var(--accent-gold-bg)',
            border: '1.5px solid var(--accent-gold)',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Benchmark Paper Rate ({selectedDate})
          </div>

          <div style={{ fontSize: '42px', fontWeight: 900, color: 'var(--accent-gold)', fontFamily: 'monospace', margin: '8px 0' }}>
            {loading ? '…' : rate ? `₹${parseFloat(rate.paper_rate).toFixed(2)}` : '—'}
          </div>

          {loading ? (
            <div className="spinner" />
          ) : rate ? (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div>📅 Configured for: <strong>{rate.date}</strong></div>
              {rate.set_by_name && (
                <div style={{ marginTop: 4 }}>
                  👤 Set by: <span className="badge badge-gold">{rate.set_by_name}</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="badge badge-amber">No rate set for {selectedDate}</span>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 6, maxWidth: 220 }}>
                Enter paper rate on the left and tap "Set Rate" to save.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📜 Recent Paper Rates History</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tap any date to modify</span>
        </div>

        <div className="card-body" style={{ padding: '12px' }}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No rate history recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.map(h => (
                <div
                  key={h.date}
                  onClick={() => handleSelectFromHistory(h)}
                  style={{
                    background: h.date === selectedDate ? 'var(--primary-tint)' : 'var(--bg-subtle)',
                    border: `1px solid ${h.date === selectedDate ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                      📅 {h.date}
                    </span>
                    {h.date === today && <span className="badge badge-green">Today</span>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 900, fontSize: '16px', color: 'var(--accent-gold)', fontFamily: 'monospace' }}>
                      ₹{parseFloat(h.paper_rate).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>👉 Edit</span>
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
