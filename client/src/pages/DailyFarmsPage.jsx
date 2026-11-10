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
    // Suggest current loss or difference
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
  const overallLossPct = totalProcuredKg > 0 ? (totalWeightLossKg / totalProcuredKg) * 100 : 0;
  const remainingBoxes = Math.max(0, totalProcuredBoxes - totalDispatchedBoxes);
  const remainingKg = farms.reduce((sum, f) => sum + (parseFloat(f.remaining_kg) || 0), 0);

  const avgLoadedBox = totalProcuredBoxes > 0 ? (totalProcuredKg / totalProcuredBoxes) : 0;
  const avgDroppedBox = totalDispatchedBoxes > 0 ? (totalDispatchedKg / totalDispatchedBoxes) : 0;

  // Admin Only Calculations
  const totalProcurementCost = farms.reduce((sum, f) => sum + (parseFloat(f.total_procurement_cost) || 0), 0);
  const totalDispatchedRevenue = farms.reduce((sum, f) => sum + (parseFloat(f.total_dispatched_revenue) || 0), 0);
  const totalGrossMargin = totalDispatchedRevenue - totalProcurementCost;

  return (
    <div className="daily-farms-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
            🚜 Daily Farms & Vehicles Procurement
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
            Shared intake roster for Supervisor 1, Supervisor 2, and Admin. Real-time bird, box & transit weight loss tracking.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.35rem 0.75rem' }}>
            <span style={{ marginRight: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>📅 Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
            />
          </div>

          <button
            onClick={openAddModal}
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            <span>➕</span> Add Daily Farm
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div style={{ background: '#064e3b', border: '1px solid #059669', color: '#a7f3d0', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
          ✓ {success}
        </div>
      )}
      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Overview Cards (Including Dedicated Transit Weight Loss Card) */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {/* Intake Card */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Intake Procured</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8' }}>{totalProcuredKg.toLocaleString('en-IN', { minimumFractionDigits: 1 })} kg</span>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>({totalProcuredBoxes} boxes)</span>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Avg loaded: {avgLoadedBox.toFixed(2)} kg / box
          </div>
        </div>

        {/* Dispatched Card */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivered to Shops</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{totalDispatchedKg.toLocaleString('en-IN', { minimumFractionDigits: 1 })} kg</span>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>({totalDispatchedBoxes} boxes)</span>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Avg dropped: {avgDroppedBox.toFixed(2)} kg / box
          </div>
        </div>

        {/* Weight Loss KPI Card */}
        <div style={{ background: '#1e293b', border: '1.5px solid #f87171', borderRadius: '12px', padding: '1rem 1.25rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#f87171', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              📉 Transit Weight Loss
            </span>
            <span style={{ fontSize: '0.68rem', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
              SHRINKAGE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171', fontFamily: 'monospace' }}>
              {totalWeightLossKg.toLocaleString('en-IN', { minimumFractionDigits: 1 })} kg
            </span>
            <span style={{ color: '#fca5a5', fontSize: '0.9rem', fontWeight: 600 }}>
              ({overallLossPct.toFixed(2)}%)
            </span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {avgLoadedBox > 0 && avgDroppedBox > 0 ? `Drop diff: -${(avgLoadedBox - avgDroppedBox).toFixed(2)} kg / box` : 'Reconciled upon delivery'}
          </div>
        </div>

        {/* Stock Remaining Card */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem 1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stock Remaining on Trucks</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.35rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: remainingBoxes > 0 ? '#f59e0b' : '#10b981' }}>
              {remainingKg.toLocaleString('en-IN', { minimumFractionDigits: 1 })} kg
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>({remainingBoxes} boxes)</span>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {remainingBoxes === 0 && totalDispatchedBoxes > 0 ? '✅ All boxes dropped to shops' : 'Available for further drops'}
          </div>
        </div>

        {/* Admin-Only Financial Overview Cards */}
        {isAdmin && (
          <>
            <div style={{ background: '#1e293b', border: '1.5px solid #0284c7', borderRadius: '12px', padding: '1rem 1.25rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#38bdf8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  🔐 Procurement Cost
                </span>
                <span style={{ fontSize: '0.68rem', background: '#0369a1', color: '#f0f9ff', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                  ADMIN
                </span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.35rem', fontFamily: 'monospace' }}>
                ₹{totalProcurementCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Total payable to farms for intake
              </div>
            </div>

            <div style={{ background: '#1e293b', border: `1.5px solid ${totalGrossMargin >= 0 ? '#059669' : '#dc2626'}`, borderRadius: '12px', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: totalGrossMargin >= 0 ? '#34d399' : '#f87171', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  🔐 Gross Operating Margin
                </span>
                <span style={{ fontSize: '0.68rem', background: totalGrossMargin >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: totalGrossMargin >= 0 ? '#34d399' : '#f87171', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                  ADMIN
                </span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totalGrossMargin >= 0 ? '#10b981' : '#ef4444', marginTop: '0.35rem', fontFamily: 'monospace' }}>
                {totalGrossMargin >= 0 ? '+' : ''}₹{totalGrossMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Billed Sales: ₹{totalDispatchedRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Daily Farms Table */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', marginTop: '1.5rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 600 }}>
            Procurement Farms for {selectedDate} ({farms.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            ⚖️ Live Shrinkage & Weight Loss Reconciliation
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading farms...</div>
        ) : farms.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌾</div>
            <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.1rem' }}>No farms added for {selectedDate}</div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '400px', margin: '0.5rem auto 1.25rem' }}>
              Supervisor 1, Supervisor 2, or Admin can add the vehicle and farm data here before starting delivery drops.
            </p>
            <button onClick={openAddModal} className="btn" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              + Add First Farm Today
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hide-mobile" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Farm & Vehicle</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Intake Loaded</th>
                    {isAdmin && <th style={{ padding: '0.75rem 1rem', color: '#38bdf8' }}>🔐 Farm Rate</th>}
                    {isAdmin && <th style={{ padding: '0.75rem 1rem', color: '#10b981' }}>🔐 Purchase Cost</th>}
                    <th style={{ padding: '0.75rem 1rem' }}>Dispatched (kg / b)</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#f87171' }}>📉 Weight Loss</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Truck Balance</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Added By</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {farms.map((f, idx) => {
                    const fWeight = parseFloat(f.total_weight_kg) || 0;
                    const fBoxes = parseInt(f.total_boxes, 10) || 0;
                    const fDispKg = parseFloat(f.total_dispatched_kg) || 0;
                    const fDispBoxes = parseInt(f.total_dispatched_boxes, 10) || 0;
                    const fRemKg = parseFloat(f.remaining_kg) || 0;
                    const fRemBoxes = parseInt(f.remaining_boxes, 10) || 0;
                    const fLossKg = parseFloat(f.weight_loss_kg) || 0;
                    const fLossPct = parseFloat(f.weight_loss_pct) || 0;
                    const pctDispatched = fWeight > 0 ? Math.min(100, Math.round((fDispKg / fWeight) * 100)) : 0;
                    const fRate = parseFloat(f.rate_per_kg) || 0;
                    const fCost = parseFloat(f.total_procurement_cost) || 0;
                    const fEffRate = parseFloat(f.effective_cost_per_kg) || fRate;

                    return (
                      <tr key={f.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#f8fafc', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>🌾</span>
                            <span>{f.farm_name}</span>
                          </div>
                          {f.vehicle_no && (
                            <div style={{ marginTop: '0.2rem' }}>
                              <span style={{ background: '#0f172a', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #334155', fontFamily: 'monospace', fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                                🚛 {f.vehicle_no}
                              </span>
                            </div>
                          )}
                          {f.notes && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>{f.notes}</div>}
                        </td>

                        {/* Intake */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ color: '#38bdf8', fontWeight: 700 }}>
                            {fWeight.toLocaleString('en-IN', { minimumFractionDigits: 1 })} kg
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                            {fBoxes} boxes ({f.avg_intake_box_kg ? `${f.avg_intake_box_kg.toFixed(2)} kg/b` : ''})
                          </div>
                        </td>

                        {/* Admin-Only Rate & Total Cost Columns */}
                        {isAdmin && (
                          <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace' }}>
                            {fRate > 0 ? (
                              <div>
                                <div style={{ fontWeight: 700, color: '#38bdf8' }}>₹{fRate.toFixed(2)}/kg</div>
                                {fEffRate > fRate && (
                                  <div style={{ fontSize: '0.72rem', color: '#fca5a5' }} title="True cost after weight loss shrinkage">
                                    Eff: ₹{fEffRate.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#64748b' }}>—</span>
                            )}
                          </td>
                        )}
                        {isAdmin && (
                          <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 800, color: '#10b981' }}>
                            {fCost > 0 ? `₹${fCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span style={{ color: '#64748b' }}>—</span>}
                          </td>
                        )}

                        {/* Dispatched */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ color: '#10b981', fontWeight: 700 }}>
                            {fDispKg.toLocaleString('en-IN', { minimumFractionDigits: 1 })} kg ({fDispBoxes} b)
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Avg drop: {f.avg_dispatched_box_kg ? `${f.avg_dispatched_box_kg.toFixed(2)} kg/b` : '—'}
                          </div>
                          <div style={{ width: '90px', height: '4px', background: '#334155', borderRadius: '2px', marginTop: '0.3rem', overflow: 'hidden' }}>
                            <div style={{ width: `${pctDispatched}%`, height: '100%', background: '#10b981' }} />
                          </div>
                        </td>

                        {/* Weight Loss Column */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: fLossKg > 0 ? '#f87171' : '#94a3b8', fontFamily: 'monospace' }}>
                            {fLossKg > 0 ? `${fLossKg.toFixed(1)} kg` : '0.0 kg'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: fLossKg > 0 ? '#fca5a5' : '#64748b' }}>
                            {fLossKg > 0 ? `${fLossPct.toFixed(2)}% loss` : (fRemBoxes === 0 && fDispBoxes > 0 ? '0% loss' : 'Pending drop')}
                          </div>
                          {f.avg_loss_per_box_kg > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>
                              -{f.avg_loss_per_box_kg.toFixed(2)} kg/b
                            </div>
                          )}
                        </td>

                        {/* Remaining Truck Stock */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {fRemBoxes > 0 ? (
                            <div>
                              <div style={{ fontWeight: 700, color: '#f59e0b' }}>
                                📦 {fRemBoxes} boxes left
                              </div>
                              <div style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>
                                {fRemKg.toFixed(1)} kg remaining
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span style={{ display: 'inline-block', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                                ✅ Trip Complete
                              </span>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                                0 boxes in truck
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Added by */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{f.added_by_name || 'System'}</div>
                          <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                            {new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => openQuickLossModal(f)}
                              title="Record or adjust transit weight loss for this truck"
                              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.3rem 0.55rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              ⚖️ Loss
                            </button>
                            <button
                              onClick={() => openEditModal(f)}
                              style={{ background: '#334155', color: '#f8fafc', border: 'none', padding: '0.3rem 0.55rem', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDelete(f)}
                              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.3rem 0.55rem', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
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
            </div>

            {/* Mobile Cards View */}
            <div className="show-mobile" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {farms.map((f) => {
                const fWeight = parseFloat(f.total_weight_kg) || 0;
                const fBoxes = parseInt(f.total_boxes, 10) || 0;
                const fDispKg = parseFloat(f.total_dispatched_kg) || 0;
                const fDispBoxes = parseInt(f.total_dispatched_boxes, 10) || 0;
                const fRemKg = parseFloat(f.remaining_kg) || 0;
                const fRemBoxes = parseInt(f.remaining_boxes, 10) || 0;
                const fLossKg = parseFloat(f.weight_loss_kg) || 0;
                const fLossPct = parseFloat(f.weight_loss_pct) || 0;
                const pctDispatched = fWeight > 0 ? Math.min(100, Math.round((fDispKg / fWeight) * 100)) : 0;
                const fRate = parseFloat(f.rate_per_kg) || 0;
                const fCost = parseFloat(f.total_procurement_cost) || 0;

                return (
                  <div key={f.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                          🌾 {f.farm_name}
                        </div>
                        {f.vehicle_no && (
                          <span style={{ display: 'inline-block', background: '#1e293b', border: '1px solid #334155', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700, marginTop: '0.2rem' }}>
                            🚛 {f.vehicle_no}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
                        By {f.added_by_name?.split(' ')[0] || 'User'}
                      </div>
                    </div>

                    {/* Admin-Only Financial Panel */}
                    {isAdmin && (
                      <div style={{ background: 'rgba(3, 105, 161, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '0.6rem 0.75rem', margin: '0.4rem 0 0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                            🔐 Admin Farm Purchase
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 700, fontFamily: 'monospace' }}>
                            {fRate > 0 ? `₹${fRate.toFixed(2)}/kg` : 'Rate not set'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Purchase Cost:</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                            ₹{fCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.5rem 0' }}>
                      <div style={{ background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Procured</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.15rem' }}>
                          {fWeight.toFixed(1)} kg ({fBoxes} b)
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          Avg: {f.avg_intake_box_kg ? `${f.avg_intake_box_kg.toFixed(2)} kg/b` : '—'}
                        </div>
                      </div>

                      <div style={{ background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#f87171', textTransform: 'uppercase' }}>Weight Loss</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f87171', marginTop: '0.15rem' }}>
                          {fLossKg.toFixed(1)} kg ({fLossPct.toFixed(1)}%)
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          {f.avg_loss_per_box_kg > 0 ? `-${f.avg_loss_per_box_kg.toFixed(2)} kg/box` : 'Transit loss'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Truck Balance:</span>
                      {fRemBoxes > 0 ? (
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>
                          📦 {fRemBoxes} boxes left ({fRemKg.toFixed(1)} kg)
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399' }}>
                          ✅ All boxes dropped
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div style={{ margin: '0.5rem 0 0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                        <span>Dispatched: {fDispKg.toFixed(1)} kg ({fDispBoxes} b)</span>
                        <span>{pctDispatched}%</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pctDispatched}%`, height: '100%', background: '#10b981' }} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        onClick={() => openQuickLossModal(f)}
                        style={{ flex: 1, minHeight: '38px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        ⚖️ Record Loss
                      </button>
                      <button
                        onClick={() => openEditModal(f)}
                        style={{ flex: 1, minHeight: '38px', background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        ✏️ Edit Farm
                      </button>
                      <button
                        onClick={() => handleDelete(f)}
                        style={{ minHeight: '38px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Quick Weight Loss Modal */}
      {lossModalFarm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1.5px solid #f87171', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>⚖️</span> Record Transit Weight Loss
              </h2>
              <button
                onClick={() => setLossModalFarm(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              Reconcile live bird weight shrinkage for <strong>{lossModalFarm.farm_name}</strong> {lossModalFarm.vehicle_no ? `(${lossModalFarm.vehicle_no})` : ''}.
            </p>

            {lossError && (
              <div style={{ background: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', padding: '0.65rem 0.9rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {lossError}
              </div>
            )}

            {/* Breakdown stats */}
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#94a3b8' }}>Loaded at Farm:</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                  {lossModalFarm.total_weight_kg} kg ({lossModalFarm.total_boxes} boxes)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#94a3b8' }}>Delivered to Shops:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>
                  {lossModalFarm.total_dispatched_kg} kg ({lossModalFarm.total_dispatched_boxes} boxes)
                </span>
              </div>
              <div style={{ borderTop: '1px dashed #334155', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#fca5a5', fontWeight: 600 }}>Unaccounted Difference:</span>
                <span style={{ color: '#f87171', fontWeight: 800, fontFamily: 'monospace' }}>
                  {Math.max(0, lossModalFarm.total_weight_kg - lossModalFarm.total_dispatched_kg).toFixed(2)} kg
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveQuickLoss} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Actual Weight Loss (kg)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="e.g. 120"
                    value={quickLossInput}
                    onChange={(e) => setQuickLossInput(e.target.value)}
                    required
                    style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f87171', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const diff = Math.max(0, lossModalFarm.total_weight_kg - lossModalFarm.total_dispatched_kg);
                      setQuickLossInput(diff.toFixed(2));
                    }}
                    style={{ background: '#334155', color: '#38bdf8', border: 'none', padding: '0 0.85rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Use Full Diff
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                  This loss will reconcile the truck balance and adjust the true effective cost for reporting.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setLossModalFarm(null)}
                  style={{ background: '#334155', color: '#f8fafc', border: 'none', padding: '0.6rem 1.1rem', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLoss}
                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#ffffff', border: 'none', padding: '0.6rem 1.4rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {savingLoss ? 'Saving...' : 'Save Weight Loss'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Add / Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '16px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
                {editingFarm ? '✏️ Edit Daily Farm' : '➕ Add Daily Farm & Vehicle'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ background: '#450a0a', border: '1px solid #dc2626', color: '#fecaca', padding: '0.65rem 0.9rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSaveFarm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 500 }}>
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  disabled={!!editingFarm}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 500 }}>
                  Farm Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Farm A, Venkateshwara Farms, Balaji Poultry"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  required
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 500 }}>
                  Vehicle / Truck Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. TS 08 UA 4567, AP 36 T 1234"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div className="grid-2-col">
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 500 }}>
                    Total Intake Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="e.g. 2000"
                    value={totalWeight}
                    onChange={(e) => setTotalWeight(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 500 }}>
                    Total Intake Boxes
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 50"
                    value={totalBoxes}
                    onChange={(e) => setTotalBoxes(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Weight Loss Input in Edit Modal */}
              {editingFarm && (
                <div>
                  <label style={{ display: 'block', color: '#f87171', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Transit Weight Loss (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Optional manual weight loss in kg"
                    value={weightLoss}
                    onChange={(e) => setWeightLoss(e.target.value)}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f87171', fontSize: '0.95rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Leave empty to auto-calculate once all crates are dropped.
                  </div>
                </div>
              )}

              {/* Admin Only Purchase Rate Input & Live Cost Preview */}
              {isAdmin && (
                <div style={{ background: '#0f172a', border: '1.5px solid #0284c7', borderRadius: '10px', padding: '0.9rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>🔐</span> Farm Purchase Rate (₹/kg)
                    </label>
                    <span style={{ fontSize: '0.68rem', background: '#0369a1', color: '#f0f9ff', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                      ADMIN ONLY
                    </span>
                  </div>

                  <div className="grid-2-col" style={{ alignItems: 'center' }}>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="e.g. 95.00"
                        value={ratePerKg}
                        onChange={(e) => setRatePerKg(e.target.value)}
                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '1rem', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        Rate paid to farm per kg
                      </div>
                    </div>

                    <div style={{ background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #334155' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Purchase Cost</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                        ₹{((parseFloat(totalWeight) || 0) * (parseFloat(ratePerKg) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        {parseFloat(totalWeight) || 0} kg × ₹{parseFloat(ratePerKg) || 0}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.45rem', fontStyle: 'italic' }}>
                    🔒 This purchase rate and cost calculation is strictly hidden from supervisors.
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 500 }}>
                  Notes / Driver Details
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional driver name, contact, route remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#f8fafc', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: '#334155', color: '#f8fafc', border: 'none', padding: '0.6rem 1.1rem', borderRadius: '8px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', padding: '0.6rem 1.4rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {saving ? 'Saving...' : editingFarm ? 'Save Changes' : 'Add Farm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
