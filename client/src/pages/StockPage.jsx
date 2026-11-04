import { useState, useEffect } from 'react';
import { api } from '../api/api';

function StockModal({ record, farms, onClose, onSaved }) {
  const [form, setForm] = useState({
    date: record?.date || new Date().toISOString().split('T')[0],
    farm_id: record?.farm_id || '',
    weight_kg: record?.weight_kg || '',
    rate_per_kg: record?.rate_per_kg || '',
    weight_loss_kg: record?.weight_loss_kg || '0',
    notes: record?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const netKg = Math.max(0, parseFloat(form.weight_kg || 0) - parseFloat(form.weight_loss_kg || 0));
  const payable = netKg * parseFloat(form.rate_per_kg || 0);

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (record) {
        await api.admin.updateStock(record.id, { weight_loss_kg: parseFloat(form.weight_loss_kg), notes: form.notes });
      } else {
        await api.admin.addStock({
          date: form.date, farm_id: form.farm_id,
          weight_kg: parseFloat(form.weight_kg),
          rate_per_kg: parseFloat(form.rate_per_kg),
          notes: form.notes,
        });
      }
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{record ? '⚖️ Update Weight Loss' : '🐔 Log Stock Intake'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            {!record && (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Farm</label>
                    <select className="form-input" value={form.farm_id} onChange={e => setForm({ ...form, farm_id: e.target.value })} required>
                      <option value="">Select farm…</option>
                      {farms.map(f => <option key={f.id} value={f.id}>{f.farm_name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Weight Brought (kg)</label>
                    <input type="number" step="0.01" className="form-input" placeholder="e.g. 1000" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate per kg (₹)</label>
                    <input type="number" step="0.01" className="form-input" placeholder="e.g. 123" value={form.rate_per_kg} onChange={e => setForm({ ...form, rate_per_kg: e.target.value })} required />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Weight Loss / Deduction (kg)</label>
              <input type="number" step="0.01" className="form-input" placeholder="0" value={form.weight_loss_kg} onChange={e => setForm({ ...form, weight_loss_kg: e.target.value })} />
            </div>

            {/* Live preview */}
            <div className="card" style={{ background: 'var(--bg-elevated)', marginBottom: 16 }}>
              <div className="card-body" style={{ padding: 14 }}>
                <div className="flex-between" style={{ fontSize: 13 }}>
                  <span className="text-muted">Net Weight:</span>
                  <span className="fw-700">{netKg.toFixed(2)} kg</span>
                </div>
                <div className="flex-between" style={{ fontSize: 14, marginTop: 6 }}>
                  <span className="text-muted">Payable to Farm:</span>
                  <span className="fw-700 text-amber">₹{payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" placeholder="e.g. weight checked at gate" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Save'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function StockPage() {
  const [stock, setStock] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterFarm, setFilterFarm] = useState('');

  function load() {
    setLoading(true);
    const params = {};
    if (filterDate) params.date = filterDate;
    if (filterFarm) params.farm_id = filterFarm;
    Promise.all([
      api.admin.getStock(params),
      api.admin.getFarms(),
    ]).then(([s, f]) => { setStock(s); setFarms(f); }).finally(() => setLoading(false));
  }
  useEffect(load, [filterDate, filterFarm]);

  const totalKg      = stock.reduce((s, r) => s + parseFloat(r.weight_kg || 0), 0);
  const totalPayable = stock.reduce((s, r) => s + parseFloat(r.payable_amount || 0), 0);

  return (
    <div className="page">
      <div className="page-header flex-between">
        <div>
          <div className="page-title">🐔 Stock Intake</div>
          <div className="page-subtitle">Daily hens/stock brought from farms — Admin only</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>➕ Log Stock</button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card blue"><div className="stat-label">Records Shown</div><div className="stat-value blue">{stock.length}</div></div>
        <div className="stat-card amber"><div className="stat-label">Total KG</div><div className="stat-value amber">{totalKg.toFixed(1)} kg</div></div>
        <div className="stat-card red"><div className="stat-label">Total Payable</div><div className="stat-value red">₹{totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex gap-2">
            <input type="date" className="form-input" style={{ width: 160 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            <select className="form-input" style={{ width: 180 }} value={filterFarm} onChange={e => setFilterFarm(e.target.value)}>
              <option value="">All farms</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.farm_name}</option>)}
            </select>
            {(filterDate || filterFarm) && <button className="btn btn-secondary btn-sm" onClick={() => { setFilterDate(''); setFilterFarm(''); }}>✕ Clear</button>}
          </div>
        </div>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner" /></div> : stock.length === 0 ? (
            <div className="empty-state"><div className="emoji">🐔</div>No stock records found.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Date</th><th>Farm</th><th>KG Brought</th><th>Rate/kg</th><th>Weight Loss</th><th>Net KG</th><th>Payable</th><th>Notes</th><th></th></tr>
              </thead>
              <tbody>
                {stock.map(r => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td className="fw-700">{r.farm_name}</td>
                    <td>{parseFloat(r.weight_kg).toFixed(2)}</td>
                    <td>₹{parseFloat(r.rate_per_kg).toFixed(2)}</td>
                    <td className={parseFloat(r.weight_loss_kg) > 0 ? 'text-red' : 'text-muted'}>
                      {parseFloat(r.weight_loss_kg) > 0 ? `-${parseFloat(r.weight_loss_kg).toFixed(2)} kg` : '—'}
                    </td>
                    <td className="fw-700">{parseFloat(r.net_weight_kg).toFixed(2)} kg</td>
                    <td className="fw-700 text-amber">₹{parseFloat(r.payable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="text-muted">{r.notes || '—'}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal({ record: r })}>⚖️ Update</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <StockModal
          record={modal === 'add' ? null : modal.record}
          farms={farms}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
