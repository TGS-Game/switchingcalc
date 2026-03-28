import { useEffect, useState } from 'react';
import client from '../api/client';

export default function AlertsPage() {
  const [items, setItems] = useState([]);
  const [targetRatio, setTargetRatio] = useState('80');
  const refresh = () => client.get('/alerts').then((r) => setItems(r.data));
  useEffect(() => { refresh(); }, []);

  const submit = async () => {
    await client.post('/alerts', { target_ratio: Number(targetRatio), direction: 'above' });
    refresh();
  };

  return (
    <div className="stack">
      <div className="card">
        <h2>Alerts</h2>
        <input type="number" value={targetRatio} onChange={(e) => setTargetRatio(e.target.value)} />
        <button onClick={submit}>Add alert</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Target ratio</th><th>Direction</th><th>Enabled</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}><td>{item.target_ratio}</td><td>{item.direction}</td><td>{String(item.enabled)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
