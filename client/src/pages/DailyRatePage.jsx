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

  // Load rate for the selected date
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

  // Load history list
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
    <div className="page">
      <div className="page-header">
        <div className="page-title">📋 Daily Paper Rate Management</div>
        <div className="page-subtitle">Set or edit paper rate for today or any previous / upcoming date</div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="grid-2-col" style={{ marginBottom: 24 }}>
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
                <label className="form-label">Select Date (Pick any past or current date)</label>
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
                <label className="form-label">Paper Rate (₹ per kg)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="paper-rate-input"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="form-input"
                    placeholder="e.g. 140.00"
                    value={paperRateInput}
                    onChange={e => setPaperRateInput(e.target.value)}
                    required
                    style={{ fontSize: 18, fontWeight: 700 }}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button id="save-rate-btn" className="btn btn-primary" style={{ width: '100%', minHeight: 46 }} disabled={saving || loading}>
                  {saving ? (
                    <span className="spinner" />
                  ) : rate ? (
                    `✏️ Update Rate for ${selectedDate}`
                  ) : (
                    `✅ Set Rate for ${selectedDate}`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Live Status Card */}
        <div className="stat-card blue" style={{ alignSelf: 'stretch', minHeight: 180, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="stat-icon">💰</div>
          <div className="stat-label">Paper Rate for {selectedDate}</div>
          <div className="stat-value blue" style={{ fontSize: 36, margin: '8px 0' }}>
            {loading ? '…' : rate ? `₹${parseFloat(rate.paper_rate).toFixed(2)}` : '—'}
          </div>
          {loading ? (
            <div className="spinner" />
          ) : rate ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <div>📅 Configured for: <strong>{rate.date}</strong></div>
              {rate.set_by_name && (
                <div style={{ marginTop: 4 }}>
                  👤 Set by: <span className="badge badge-blue">{rate.set_by_name} ({rate.set_by_role})</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="badge badge-amber">No rate set for {selectedDate}</span>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Enter a paper rate and click "Set Rate" to save it for this date.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Rate History Table / Mobile Cards */}
      <div className="card">
        <div className="card-header flex-between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span className="card-title">📜 Recent Paper Rates History</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Select any past date to view or modify benchmark rate
            </div>
          </div>
          <span className="badge badge-blue">{history.length} records</span>
        </div>

        {/* Desktop Table View */}
        <div className="table-wrap hide-mobile">
          {history.length === 0 ? (
            <div className="empty-state">No rates recorded yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Paper Rate</th>
                  <th>Configured By</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const isCurrent = h.date === selectedDate;
                  return (
                    <tr key={h.id} style={isCurrent ? { background: 'rgba(99, 102, 241, 0.08)' } : {}}>
                      <td className="fw-700">
                        {h.date} {h.date === today && <span className="badge badge-green" style={{ marginLeft: 6 }}>Today</span>}
                      </td>
                      <td className="fw-700 text-accent" style={{ fontSize: 16 }}>
                        ₹{parseFloat(h.paper_rate).toFixed(2)}
                      </td>
                      <td>{h.set_by_name || 'System / Admin'}</td>
                      <td>
                        <span className={`badge ${h.set_by_role === 'ADMIN' ? 'badge-blue' : 'badge-amber'}`}>
                          {h.set_by_role || 'ADMIN'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => handleSelectFromHistory(h)}
                        >
                          {isCurrent ? 'Viewing' : '✏️ Edit'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile Cards View */}
        <div className="show-mobile" style={{ padding: '0.75rem' }}>
          {history.length === 0 ? (
            <div className="empty-state">No rates recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map(h => {
                const isCurrent = h.date === selectedDate;
                return (
                  <div
                    key={h.id}
                    onClick={() => handleSelectFromHistory(h)}
                    style={{
                      background: isCurrent ? 'rgba(56, 189, 248, 0.1)' : '#0f172a',
                      border: `1px solid ${isCurrent ? '#38bdf8' : '#334155'}`,
                      borderRadius: '12px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>{h.date}</span>
                        {h.date === today && <span className="badge badge-green" style={{ fontSize: '10px', padding: '1px 6px' }}>Today</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        By {h.set_by_name || 'Admin'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                          ₹{parseFloat(h.paper_rate).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>per kg</div>
                      </div>

                      <button
                        className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectFromHistory(h);
                        }}
                      >
                        {isCurrent ? 'Active' : '✏️'}
                      </button>
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
