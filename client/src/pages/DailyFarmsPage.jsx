import { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function DailyFarmsPage({ onNavigate }) {
  const { user, isAdmin } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Main Modal state (Add / Edit Farm)
  const [showModal, setShowModal] = useState(false);
  const [editingFarm, setEditingFarm] = useState(null);
  const [farmName, setFarmName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [totalBoxes, setTotalBoxes] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [weightLoss, setWeightLoss] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Quick Weight Loss Modal State
  const [lossModalFarm, setLossModalFarm] = useState(null);
  const [quickLossInput, setQuickLossInput] = useState('');
  const [savingLoss, setSavingLoss] = useState(false);
  const [lossError, setLossError] = useState('');

  const loadFarms = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.dailyFarms.getByDate(selectedDate);
      setFarms(data);
    } catch (err) {
      setError(err.message || 'Failed to load daily farms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFarms();
  }, [selectedDate]);

  const openAddModal = () => {
    setEditingFarm(null);
    setFarmName('');
    setVehicleNo('');
    setTotalWeight('');
    setTotalBoxes('');
    setRatePerKg('');
    setWeightLoss('');
    setNotes('');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (f) => {
    setEditingFarm(f);
    setFarmName(f.farm_name);
    setVehicleNo(f.vehicle_no || '');
    setTotalWeight(f.total_weight_kg || '');
    setTotalBoxes(f.total_boxes || '');
    setRatePerKg(f.rate_per_kg ? f.rate_per_kg.toString() : '');
    setWeightLoss(f.weight_loss_kg ? f.weight_loss_kg.toString() : '');
    setNotes(f.notes || '');
    setFormError('');
    setShowModal(true);
  };

  const openQuickLossModal = (f) => {
    setLossModalFarm(f);
    const diff = Math.max(0, (parseFloat(f.total_weight_kg) || 0) - (parseFloat(f.total_dispatched_kg) || 0));
    setQuickLossInput(f.weight_loss_kg > 0 ? f.weight_loss_kg.toString() : diff.toFixed(2));
    setLossError('');
  };

  const handleSaveQuickLoss = async (e) => {
    e.preventDefault();
    if (!lossModalFarm) return;
    const parsed = parseFloat(quickLossInput);
    if (isNaN(parsed) || parsed < 0) {
      setLossError('Please enter a valid non-negative weight loss in kg');
      return;
    }

    setSavingLoss(true);
    setLossError('');
    try {
      await api.dailyFarms.update(lossModalFarm.id, {
        weight_loss_kg: parsed
      });
      setSuccess(`Weight loss of ${parsed.toFixed(2)} kg saved for "${lossModalFarm.farm_name}"`);
      setLossModalFarm(null);
      loadFarms();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setLossError(err.message || 'Failed to save weight loss');
    } finally {
      setSavingLoss(false);
    }
  };

  const handleSaveFarm = async (e) => {
    e.preventDefault();
    if (!farmName.trim()) {
      setFormError('Farm name is required');
      return;
    }
    setSaving(true);
    setFormError('');

    try {
      const payload = {
        date: selectedDate,
        farm_name: farmName.trim(),
        vehicle_no: vehicleNo.trim(),
        total_weight_kg: parseFloat(totalWeight) || 0,
        total_boxes: parseInt(totalBoxes, 10) || 0,
        notes: notes.trim(),
        ...(weightLoss !== '' ? { weight_loss_kg: parseFloat(weightLoss) || 0 } : {}),
        ...(isAdmin ? { rate_per_kg: parseFloat(ratePerKg) || 0 } : {})
      };

      if (editingFarm) {
        await api.dailyFarms.update(editingFarm.id, payload);
        setSuccess(`Farm "${farmName}" updated successfully`);
      } else {
        await api.dailyFarms.create(payload);
        setSuccess(`Farm "${farmName}" added for ${selectedDate}`);
      }
      setShowModal(false);
      loadFarms();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Failed to save daily farm');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (farm) => {
    if (!window.confirm(`Are you sure you want to delete Farm "${farm.farm_name}"?`)) return;
    setError('');
    try {
      await api.dailyFarms.delete(farm.id);
      setSuccess(`Farm "${farm.farm_name}" deleted`);
      loadFarms();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to delete farm');
    }
  };

  // Grand summary for today's intake
  const totalProcuredKg = farms.reduce((sum, f) => sum + (parseFloat(f.total_weight_kg) || 0), 0);
  const totalProcuredBoxes = farms.reduce((sum, f) => sum + (parseInt(f.total_boxes, 10) || 0), 0);
  const totalDispatchedKg = farms.reduce((sum, f) => sum + (parseFloat(f.total_dispatched_kg) || 0), 0);
  const totalDispatchedBoxes = farms.reduce((sum, f) => sum + (parseInt(f.total_dispatched_boxes, 10) || 0), 0);
  const totalWeightLossKg = farms.reduce((sum, f) => sum + (parseFloat(f.weight_loss_kg) || 0), 0);
  const remainingBoxes = Math.max(0, totalProcuredBoxes - totalDispatchedBoxes);
  const remainingKg = farms.reduce((sum, f) => sum + (parseFloat(f.remaining_kg) || 0), 0);

  // Admin Only Calculations
  const totalProcurementCost = farms.reduce((sum, f) => sum + (parseFloat(f.total_procurement_cost) || 0), 0);
  const totalDispatchedRevenue = farms.reduce((sum, f) => sum + (parseFloat(f.total_dispatched_revenue) || 0), 0);
  const totalGrossMargin = totalDispatchedRevenue - totalProcurementCost;

  return (
    <div className="page" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Page Title & Add Button */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">
            <span>🚜</span>
            <span>Farm Procurement & Stock</span>
          </h1>
          <p className="page-subtitle">Track farm loading intake, deliveries, truck balance, and transit weight loss</p>
        </div>

        <button
          onClick={openAddModal}
          className="btn btn-primary"
          style={{ minHeight: '44px', fontWeight: 700 }}
        >
          ➕ Add Farm Intake
        </button>
      </div>

      {/* Date Bar */}
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

        <span className="badge badge-green">
          {farms.length} active farm(s)
        </span>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* KPI Cards Grid */}
      <div className="stats-grid" style={{ marginBottom: '18px' }}>
        <div className="stat-card">
          <div className="stat-label">Total Procured</div>
          <div className="stat-value">{totalProcuredKg.toFixed(1)} kg</div>
          <div className="stat-sub">{totalProcuredBoxes} boxes loaded</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Delivered to Shops</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{totalDispatchedKg.toFixed(1)} kg</div>
          <div className="stat-sub">{totalDispatchedBoxes} boxes dispatched</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Truck Stock Balance</div>
          <div className="stat-value" style={{ color: remainingBoxes > 0 ? 'var(--blue)' : 'var(--green)' }}>
            {remainingBoxes} b ({remainingKg.toFixed(1)} kg)
          </div>
          <div className="stat-sub">{remainingBoxes === 0 ? 'All crates delivered' : 'On truck in transit'}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">📉 Transit Weight Loss</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>
            {totalWeightLossKg.toFixed(1)} kg
          </div>
          <div className="stat-sub">Transit shrinkage</div>
        </div>
      </div>

      {/* Admin Financial Overview (If Admin) */}
      {isAdmin && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--accent-gold)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="badge badge-gold" style={{ fontSize: '10px' }}>ADMIN ONLY</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Financial Procurement Margins</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Total Purchase Cost: <strong>₹{totalProcurementCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Trading Margin</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: totalGrossMargin >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace' }}>
              {totalGrossMargin >= 0 ? '+' : ''}₹{totalGrossMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* Farm Cards List (Mobile-First) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading farms…</div>
      ) : farms.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🚜</div>
          <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)' }}>No farms recorded for {selectedDate}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Tap "+ Add Farm Intake" above to record bird loading from farms.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {farms.map((f) => {
            const intakeW = parseFloat(f.total_weight_kg) || 0;
            const intakeB = parseInt(f.total_boxes, 10) || 0;
            const dispW = parseFloat(f.total_dispatched_kg) || 0;
            const dispB = parseInt(f.total_dispatched_boxes, 10) || 0;
            const remB = parseInt(f.remaining_boxes, 10) || 0;
            const remW = parseFloat(f.remaining_kg) || 0;
            const lossW = parseFloat(f.weight_loss_kg) || 0;
            const lossPct = parseFloat(f.weight_loss_pct) || 0;

            return (
              <div
                key={f.id}
                className="card"
                style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)' }}>
                      {f.farm_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      🚚 Vehicle: <strong>{f.vehicle_no || 'Direct'}</strong>
                      {f.notes ? ` • ${f.notes}` : ''}
                    </div>
                  </div>

                  <div>
                    {remB === 0 ? (
                      <span className="badge badge-green" style={{ fontSize: '11px' }}>
                        ✅ All {intakeB} Boxes Dropped
                      </span>
                    ) : (
                      <span className="badge badge-blue" style={{ fontSize: '11.5px' }}>
                        🚚 {remB} boxes left ({remW.toFixed(1)} kg)
                      </span>
                    )}
                  </div>
                </div>

                {/* Weight & Crate Breakdown Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  background: 'var(--bg-subtle)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)'
                }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      📥 Farm Intake
                    </div>
                    <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {intakeW.toFixed(1)} kg
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {intakeB} boxes (~{f.avg_intake_box_kg?.toFixed(1) || '0'} kg/b)
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      🚚 Dispatched Drops
                    </div>
                    <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {dispW.toFixed(1)} kg
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {dispB} boxes (~{f.avg_dispatched_box_kg?.toFixed(1) || '0'} kg/b)
                    </div>
                  </div>
                </div>

                {/* Transit Weight Loss Pill / Status */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: lossW > 0 ? 'var(--red-bg)' : 'var(--bg-elevated)',
                  border: `1px solid ${lossW > 0 ? 'var(--red)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>📉</span>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: lossW > 0 ? 'var(--red)' : 'var(--text-secondary)' }}>
                      Transit Loss: {lossW > 0 ? `${lossW.toFixed(1)} kg (${lossPct.toFixed(2)}%)` : '0 kg'}
                      {f.is_manual_loss ? ' (Manual)' : ''}
                    </span>
                  </div>

                  <button
                    onClick={() => openQuickLossModal(f)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      minHeight: '32px',
                      background: 'var(--bg-surface)'
                    }}
                  >
                    ⚖️ Edit Loss
                  </button>
                </div>

                {/* Admin Cost & Margin Details */}
                {isAdmin && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11.5px',
                    color: 'var(--text-secondary)',
                    borderTop: '1px dashed var(--border)',
                    paddingTop: '6px'
                  }}>
                    <span>Purchase Rate: <strong>₹{parseFloat(f.rate_per_kg || 0).toFixed(2)}/kg</strong></span>
                    <span>Cost: <strong style={{ color: 'var(--primary)' }}>₹{parseFloat(f.total_procurement_cost || 0).toLocaleString('en-IN')}</strong></span>
                    <span>Effective Cost: <strong style={{ color: 'var(--accent-gold)' }}>₹{f.effective_cost_per_kg?.toFixed(2) || '0.00'}/kg</strong></span>
                  </div>
                )}

                {/* Actions Row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '8px'
                }}>
                  <button
                    onClick={() => onNavigate && onNavigate('sales')}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '6px 14px', minHeight: '34px', fontSize: '12px' }}
                  >
                    📝 Drop Orders
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => openEditModal(f)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 10px', minHeight: '34px' }}
                      title="Edit Farm"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(f)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '6px 10px', minHeight: '34px' }}
                      title="Delete Farm"
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

      {/* Slide-Up Bottom Sheet Modal: Add / Edit Farm */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {editingFarm ? `✏️ Edit "${editingFarm.farm_name}"` : '➕ Add Farm Procurement Intake'}
              </span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {formError && <div className="alert alert-danger">{formError}</div>}

              <form onSubmit={handleSaveFarm}>
                <div className="form-group">
                  <label className="form-label">
                    Farm Name <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Venkat Poultry, Sri Sai Farm"
                    className="form-input"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Vehicle / Truck Number</label>
                  <input
                    type="text"
                    placeholder="e.g. TS 09 TX 4499"
                    className="form-input"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Total Weight (kg) <span style={{ color: 'var(--red)' }}>*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 2000"
                      className="form-input"
                      value={totalWeight}
                      onChange={(e) => setTotalWeight(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Boxes <span style={{ color: 'var(--red)' }}>*</span></label>
                    <input
                      type="number"
                      placeholder="e.g. 57"
                      className="form-input"
                      value={totalBoxes}
                      onChange={(e) => setTotalBoxes(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {isAdmin && (
                  <div className="form-group">
                    <label className="form-label">Procurement Rate (₹/kg) [Admin Only]</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 100"
                      className="form-input"
                      value={ratePerKg}
                      onChange={(e) => setRatePerKg(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Transit Weight Loss (kg) (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Auto-calculated if 0"
                    className="form-input"
                    value={weightLoss}
                    onChange={(e) => setWeightLoss(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Morning batch"
                    className="form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? <span className="spinner" /> : 'Save Farm'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Up Bottom Sheet Modal: Quick Record Weight Loss */}
      {lossModalFarm && (
        <div className="modal-overlay" onClick={() => setLossModalFarm(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">⚖️ Record Transit Weight Loss</span>
              <button className="modal-close" onClick={() => setLossModalFarm(null)}>✕</button>
            </div>

            <div className="modal-body">
              {lossError && <div className="alert alert-danger">{lossError}</div>}

              <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '14px', fontSize: '13px' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{lossModalFarm.farm_name}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Loaded: <strong>{parseFloat(lossModalFarm.total_weight_kg).toFixed(1)} kg</strong> ({lossModalFarm.total_boxes} b)
                  <br />
                  Delivered: <strong>{parseFloat(lossModalFarm.total_dispatched_kg).toFixed(1)} kg</strong> ({lossModalFarm.total_dispatched_boxes} b)
                </div>
              </div>

              <form onSubmit={handleSaveQuickLoss}>
                <div className="form-group">
                  <label className="form-label">
                    Recorded Weight Loss (kg) <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="form-input"
                    value={quickLossInput}
                    onChange={(e) => setQuickLossInput(e.target.value)}
                    required
                    style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      const diff = Math.max(0, (parseFloat(lossModalFarm.total_weight_kg) || 0) - (parseFloat(lossModalFarm.total_dispatched_kg) || 0));
                      setQuickLossInput(diff.toFixed(2));
                    }}
                  >
                    Use Full Diff (Auto)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setQuickLossInput('0')}
                  >
                    Reset to 0
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setLossModalFarm(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={savingLoss}>
                    {savingLoss ? <span className="spinner" /> : 'Save Loss'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
