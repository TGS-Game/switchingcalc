import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import client from '../api/client';
import StatCard from '../components/StatCard';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [showGold, setShowGold] = useState(true);
  const [showSilver, setShowSilver] = useState(true);

  useEffect(() => {
    client.get('/dashboard/summary').then((r) => setSummary(r.data));
  }, []);

  const demoSeries = [
    { month: 'Jan', gold: 10, silver: 200 },
    { month: 'Feb', gold: 11, silver: 180 },
    { month: 'Mar', gold: 11.5, silver: 210 }
  ];

  const filteredSeries = useMemo(() => {
    return demoSeries.map((row) => ({
      month: row.month,
      gold: showGold ? row.gold : null,
      silver: showSilver ? row.silver : null
    }));
  }, [showGold, showSilver]);

  if (!summary) return <p>Loading...</p>;

  return (
    <div className="stack">
      <div className="grid-4">
        <StatCard label="Gold (g)" value={summary.gold_grams} />
        <StatCard label="Silver (g)" value={summary.silver_grams} />
        <StatCard label="Switch count" value={summary.switch_count} />
        <StatCard label="Storage fees (g)" value={summary.storage_fee_grams} />
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>Holdings over time</h2>
            <div style={{ color: '#475569', fontSize: 14 }}>
              Choose whether to show Gold, Silver, or both.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={showGold}
                onChange={(e) => setShowGold(e.target.checked)}
              />
              <span>Gold Holdings</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={showSilver}
                onChange={(e) => setShowSilver(e.target.checked)}
              />
              <span>Silver Holdings</span>
            </label>
          </div>
        </div>

        {!showGold && !showSilver ? (
          <div style={{ marginTop: 18, padding: 18, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10 }}>
            Tick Gold Holdings, Silver Holdings, or both to show the chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={filteredSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              {showGold ? <Line type="monotone" dataKey="gold" name="Gold" /> : null}
              {showSilver ? <Line type="monotone" dataKey="silver" name="Silver" /> : null}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
