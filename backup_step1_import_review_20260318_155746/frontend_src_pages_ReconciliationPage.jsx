import { useEffect, useState } from 'react';
import client from '../api/client';
import ReconciliationTable from '../components/ReconciliationTable';

export default function ReconciliationPage() {
  const [cases, setCases] = useState([]);
  const refresh = () => client.get('/reconciliation').then((r) => setCases(r.data.filter((x) => x.status !== 'resolved')));
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="stack">
      <h2>Reconciliation</h2>
      <p>Review ambiguous sales and switches. Conservative FIFO suggestions are pre-filled and can be edited.</p>
      <ReconciliationTable cases={cases} refresh={refresh} />
    </div>
  );
}
