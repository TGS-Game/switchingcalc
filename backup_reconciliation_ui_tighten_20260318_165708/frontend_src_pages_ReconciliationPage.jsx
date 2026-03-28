import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import ReconciliationTable from '../components/ReconciliationTable';

function isHiddenNoise(item) {
  const text = `${item.raw_definition || ''}`.toLowerCase().trim();
  return text.startsWith('za') || text === 'bank transfer';
}

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
      if (isHiddenNoise(item)) return false;
      const matchesType = typeFilter === 'all' ? true : item.suggestion_type === typeFilter;
      const text = `${item.raw_definition || ''} ${item.notes || ''} ${item.raw_date || ''}`.toLowerCase();
      const matchesSearch = search.trim() === '' ? true : text.includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [cases, typeFilter, search]);

  return (
    <div className="stack">
      <h2>Review imported rows</h2>
      <p>
        Obvious rows are shown first and auto-ticked. Noise rows such as Bank transfer and ZA are hidden from this list.
      </p>

      <div className="card" style={{ padding: 10 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))',
            gap: 10
          }}
        >
          <label>
            <div>Status</div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', padding: 6 }}>
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
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: '100%', padding: 6 }}>
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
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="definition, notes, date"
              style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
            />
          </label>
        </div>
      </div>

      {loading ? <p>Loading review items...</p> : <ReconciliationTable cases={filteredCases} refresh={refresh} />}
    </div>
  );
}
