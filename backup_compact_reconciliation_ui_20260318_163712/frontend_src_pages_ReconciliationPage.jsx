import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import ReconciliationTable from '../components/ReconciliationTable';

export default function ReconciliationPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await client.get(`/reconciliation?status=${status}`);
      setCases(response.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [status]);

  const filteredCases = useMemo(() => {
    return (cases || []).filter((item) => {
      const matchesType = typeFilter === 'all' ? true : item.suggestion_type === typeFilter;
      const text = `${item.raw_definition || ''} ${item.notes || ''} ${item.raw_date || ''}`.toLowerCase();
      const matchesSearch = search.trim() === '' ? true : text.includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [cases, typeFilter, search]);

  return (
    <div className="stack">
      <h2>Review imported rows</h2>
      <p>Tick rows and approve them in bulk, or amend individual rows before approving. Only confirmed or amended rows enter the ledger and affect holdings.</p>

      <div className="card">
        <div className="grid-3">
          <label>
            <div>Status</div>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="amended">amended</option>
              <option value="ignored">ignored</option>
              <option value="rejected">rejected</option>
              <option value="all">all</option>
            </select>
          </label>

          <label>
            <div>Suggested type</div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">all</option>
              <option value="purchase">purchase</option>
              <option value="transfer_in">transfer_in</option>
              <option value="transfer_out">transfer_out</option>
              <option value="depot_fee">depot_fee</option>
              <option value="switch">switch</option>
              <option value="unknown">unknown</option>
              <option value="ignored">ignored</option>
            </select>
          </label>

          <label>
            <div>Search</div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="definition, notes, date" />
          </label>
        </div>
      </div>

      {loading ? <p>Loading review items...</p> : <ReconciliationTable cases={filteredCases} refresh={refresh} />}
    </div>
  );
}
