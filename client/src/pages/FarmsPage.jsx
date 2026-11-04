import { useState, useEffect } from 'react';
import { api } from '../api/api';

function FarmModal({ farm, onClose, onSaved }) {
  const [form, setForm] = useState({ farm_name: farm?.farm_name || '', route_details: farm?.route_details || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (farm) { await api.admin.updateFarm(farm.id, form); }
      else { await api.admin.createFarm(form); }
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{farm ? '✏️ Edit Farm' : '🌾 Add Farm'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Farm Name</label>
              <input className="form-input" value={form.farm_name} onChange={e => setForm({ ...form, farm_name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Route / Location Details</label>
              <textarea className="form-input" rows={3} value={form.route_details} onChange={e => setForm({ ...form, route_details: e.target.value })} />
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

function FarmPaymentModal({ farmId, onClose, onSaved }) {
  const [form, setForm] = useState({ payment_date: new Date().toISOString().split('T')[0], amount_paid: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.admin.addFarmPayment(farmId, { ...form, amount_paid: parseFloat(form.amount_paid) });
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">💸 Pay to Farm</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Amount Paid (₹)</label>
              <input type="number" step="0.01" className="form-input" placeholder="e.g. 25000"
                value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" placeholder="e.g. Cash, NEFT, Cheque"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-green" disabled={saving}>{saving ? <span className="spinner" /> : '💸 Record Payment'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function FarmProfileModal({ farmId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [showPayModal, setShowPayModal] = useState(false);

  function load() {
    setLoading(true);
    api.admin.getFarmProfile(farmId, year ? { year } : {}).then(setProfile).finally(() => setLoading(false));
  }
  useEffect(load, [farmId, year]);

  const s = profile?.summary;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <span className="modal-title">🌾 {profile?.farm?.farm_name || 'Farm'} — Ledger</span>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
            <div className="flex gap-2 mb-4">
              <input type="number" className="form-input" style={{ width: 100 }} placeholder="Year" value={year}
                onChange={e => setYear(e.target.value)} />
              <button className="btn btn-secondary btn-sm" onClick={load}>Filter</button>
              <button className="btn btn-green btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowPayModal(true)}>
                💸 Pay Farm
              </button>
            </div>

            {loading ? <div className="empty-state"><div className="spinner" /></div> : (
              <>
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
                  <div className="stat-card blue"><div className="stat-label">Total KG Received</div><div className="stat-value blue" style={{ fontSize: 18 }}>{parseFloat(s.total_kg).toFixed(1)}</div></div>
                  <div className="stat-card amber"><div className="stat-label">Total Payable</div><div className="stat-value amber" style={{ fontSize: 18 }}>₹{parseFloat(s.total_payable).toLocaleString('en-IN')}</div></div>
                  <div className="stat-card green"><div className="stat-label">Total Paid</div><div className="stat-value green" style={{ fontSize: 18 }}>₹{parseFloat(s.total_paid).toLocaleString('en-IN')}</div></div>
                  <div className={`stat-card ${s.outstanding_due > 0 ? 'red' : 'green'}`}>
                    <div className="stat-label">{s.outstanding_due > 0 ? 'Still Owed to Farm' : 'Overpaid'}</div>
                    <div className={`stat-value ${s.outstanding_due > 0 ? 'red' : 'green'}`} style={{ fontSize: 18 }}>
                      ₹{Math.abs(parseFloat(s.outstanding_due)).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="card mb-4">
                  <div className="card-header"><span className="card-title">Stock Intake History</span><span className="badge badge-blue">{profile.intakes.length}</span></div>
                  <div className="table-wrap">
                    {profile.intakes.length === 0 ? <div className="empty-state">No stock records</div> : (
                      <table>
                        <thead><tr><th>Date</th><th>KG Brought</th><th>Rate/kg</th><th>Weight Loss</th><th>Net KG</th><th>Payable</th><th>Notes</th></tr></thead>
                        <tbody>
                          {profile.intakes.map(s => (
                            <tr key={s.id}>
                              <td>{s.date}</td>
                              <td>{parseFloat(s.weight_kg).toFixed(2)}</td>
                              <td>₹{parseFloat(s.rate_per_kg).toFixed(2)}</td>
                              <td className={parseFloat(s.weight_loss_kg) > 0 ? 'text-red' : 'text-muted'}>
                                -{parseFloat(s.weight_loss_kg).toFixed(2)} kg
                              </td>
                              <td className="fw-700">{parseFloat(s.net_weight_kg).toFixed(2)} kg</td>
                              <td className="fw-700 text-amber">₹{parseFloat(s.payable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="text-muted">{s.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><span className="card-title">Payments Made to Farm</span></div>
                  <div className="table-wrap">
                    {profile.payments.length === 0 ? <div className="empty-state">No payments recorded</div> : (
                      <table>
                        <thead><tr><th>Date</th><th>Amount</th><th>Notes</th><th>Status</th></tr></thead>
                        <tbody>
                          {profile.payments.map(p => (
                            <tr key={p.id}>
                              <td>{p.payment_date}</td>
                              <td className="fw-700 text-green">₹{parseFloat(p.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td>{p.notes || '—'}</td>
                              <td>{p.is_reversed ? <span className="badge badge-red">Reversed</span> : <span className="badge badge-green">Paid</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {showPayModal && (
        <FarmPaymentModal farmId={farmId} onClose={() => setShowPayModal(false)} onSaved={() => { setShowPayModal(false); load(); }} />
      )}
    </>
  );
}

export default function FarmsPage() {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [search, setSearch] = useState('');

  function load() { setLoading(true); api.admin.getFarms().then(setFarms).finally(() => setLoading(false)); }
  useEffect(load, []);

  const filtered = farms.filter(f => f.farm_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div className="page-header flex-between">
        <div>
          <div className="page-title">🌾 Farms</div>
          <div className="page-subtitle">Manage farm profiles, stock ledgers, and payments</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>➕ Add Farm</button>
      </div>

      <div className="card">
        <div className="card-header">
          <input className="form-input" style={{ width: 240 }} placeholder="🔍 Search farms…" value={search} onChange={e => setSearch(e.target.value)} />
          <span className="badge badge-blue">{filtered.length} farms</span>
        </div>
        <div className="table-wrap">
          {loading ? <div className="empty-state"><div className="spinner" /></div> : filtered.length === 0 ? (
            <div className="empty-state"><div className="emoji">🌾</div>No farms found.</div>
          ) : (
            <table>
              <thead><tr><th>Farm Name</th><th>Route / Location</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f.id}>
                    <td className="fw-700">{f.farm_name}</td>
                    <td>{f.route_details || '—'}</td>
                    <td>{f.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}</td>
                    <td>
                      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setProfileId(f.id)}>📊 Ledger</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ farm: f })}>✏️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <FarmModal farm={modal === 'add' ? null : modal.farm} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {profileId && <FarmProfileModal farmId={profileId} onClose={() => setProfileId(null)} />}
    </div>
  );
}
