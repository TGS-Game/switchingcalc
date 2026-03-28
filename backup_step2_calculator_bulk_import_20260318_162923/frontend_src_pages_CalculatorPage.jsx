import { useState } from 'react';
import client from '../api/client';

export default function CalculatorPage() {
  const [target, setTarget] = useState('80');
  const [result, setResult] = useState(null);

  const run = async () => {
    const { data } = await client.get(`/dashboard/calculator?target_ratio=${target}`);
    setResult(data);
  };

  return (
    <div className="stack">
      <div className="card">
        <h2>Ratio simulator</h2>
        <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
        <button onClick={run}>Run</button>
      </div>
      {result && (
        <div className="card">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
