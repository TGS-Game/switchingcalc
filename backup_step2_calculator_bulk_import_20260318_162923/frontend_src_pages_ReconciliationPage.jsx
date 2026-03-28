import { useEffect, useState } from 'react';
import client from '../api/client';
import ReconciliationTable from '../components/ReconciliationTable';

export default function ReconciliationPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await client.get('/reconciliation?status=pending');
      setCases(response.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="stack">
      <h2>Review imported rows</h2>
      <p>Confirm, amend, ignore, or reject the suggested transactions. Only confirmed or amended rows are written into the ledger and shown on the dashboard.</p>
      {loading ? <p>Loading review items...</p> : <ReconciliationTable cases={cases} refresh={refresh} />}
    </div>
  );
}
