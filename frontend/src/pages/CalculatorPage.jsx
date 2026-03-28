import { useEffect, useState } from 'react';
import client from '../api/client';

export default function CalculatorPage() {
  const [futureRatio, setFutureRatio] = useState('70');
  const [feePercent, setFeePercent] = useState('3');
  const [scenarioName, setScenarioName] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadScenarios = async () => {
    const response = await client.get('/dashboard/calculator/scenarios');
    setScenarios(response.data || []);
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  const runPreview = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await client.post('/dashboard/calculator/preview', {
        future_ratio: Number(futureRatio),
        fee_percent: Number(feePercent),
      });
      setPreview(response.data);
    } catch (error) {
      setMessage(error?.response?.data?.error || error?.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const saveScenario = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await client.post('/dashboard/calculator/scenarios', {
        future_ratio: Number(futureRatio),
        fee_percent: Number(feePercent),
        scenario_name: scenarioName,
        notes,
      });
      setMessage('Scenario saved.');
      await loadScenarios();
      if (!preview) {
        setPreview(response.data.snapshot_json);
      }
    } catch (error) {
      setMessage(error?.response?.data?.error || error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <h2>Current holdings calculator</h2>
        <p>
          This calculator only uses your current confirmed holdings in their current form.
          Saved scenarios are snapshots for reference only. Actual confirmed transactions always dominate.
        </p>

        <form className="grid-3" onSubmit={runPreview}>
          <label>
            <div>Future switch ratio</div>
            <input
              type="number"
              step="0.000001"
              value={futureRatio}
              onChange={(e) => setFutureRatio(e.target.value)}
            />
          </label>

          <label>
            <div>Fee per switch (%)</div>
            <input
              type="number"
              step="0.01"
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="submit" disabled={loading}>
              {loading ? 'Calculating...' : 'Run calculator'}
            </button>
          </div>
        </form>

        {message ? <p>{message}</p> : null}
      </div>

      <div className="card">
        <h3>Save this scenario</h3>
        <div className="grid-3">
          <label>
            <div>Scenario name</div>
            <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
          </label>

          <label style={{ gridColumn: 'span 2' }}>
            <div>Notes</div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <button onClick={saveScenario} disabled={saving}>
          {saving ? 'Saving...' : 'Save scenario'}
        </button>
      </div>

      {preview ? (
        <>
          <div className="card">
            <h3>Headline figures</h3>
            <div className="grid-3">
              <div><strong>Gold now:</strong> {preview.current_holdings_summary?.gold_grams ?? 0}</div>
              <div><strong>Silver now:</strong> {preview.current_holdings_summary?.silver_grams ?? 0}</div>
              <div><strong>Future ratio:</strong> {preview.future_ratio}</div>
            </div>
          </div>

          <div className="card">
            <h3>Current lots and calculations</h3>
            <table>
              <thead>
                <tr>
                  <th>Current metal</th>
                  <th>Current grams</th>
                  <th>Basis ratio</th>
                  <th>Target metal</th>
                  <th>Baseline quantity</th>
                  <th>Projected quantity</th>
                  <th>Gain %</th>
                </tr>
              </thead>
              <tbody>
                {(preview.lots || []).map((row) => (
                  <tr key={row.lot_key}>
                    <td>{row.current_metal}</td>
                    <td>{row.current_quantity_grams}</td>
                    <td>{row.basis_ratio ?? '-'}</td>
                    <td>{row.target_metal || '-'}</td>
                    <td>{row.baseline_quantity_compare_metal ?? '-'}</td>
                    <td>{row.projected_quantity_compare_metal ?? '-'}</td>
                    <td>{row.gain_percent ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Totals by current metal</h3>
            <table>
              <thead>
                <tr>
                  <th>Current metal</th>
                  <th>Target metal</th>
                  <th>Current grams total</th>
                  <th>Baseline total</th>
                  <th>Projected total</th>
                  <th>Gain %</th>
                </tr>
              </thead>
              <tbody>
                {(preview.totals || []).map((row, index) => (
                  <tr key={index}>
                    <td>{row.current_metal}</td>
                    <td>{row.target_metal}</td>
                    <td>{row.current_quantity_grams_total}</td>
                    <td>{row.baseline_quantity_compare_metal_total}</td>
                    <td>{row.projected_quantity_compare_metal_total}</td>
                    <td>{row.gain_percent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <div className="card">
        <h3>Saved calculator scenarios</h3>
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Name</th>
              <th>Future ratio</th>
              <th>Fee %</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((row) => (
              <tr key={row.id}>
                <td>{row.created_at}</td>
                <td>{row.scenario_name || '-'}</td>
                <td>{row.future_ratio}</td>
                <td>{row.fee_percent}</td>
                <td>{row.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
